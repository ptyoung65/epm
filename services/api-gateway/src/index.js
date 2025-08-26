const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const winston = require('winston');
const Redis = require('ioredis');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const JWTManager = require('./auth/JWTManager');
const RBACManager = require('./auth/RBACManager');
const APIVersionManager = require('./versioning/APIVersionManager');
const TransformationMiddleware = require('./middleware/TransformationMiddleware');

class APIGateway {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.serviceRegistryUrl = process.env.SERVICE_REGISTRY_URL || 'http://localhost:8500';
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/api-gateway.log' })
      ]
    });

    // Initialize Redis for caching and rate limiting
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    // Initialize authentication and authorization managers
    this.jwtManager = new JWTManager({
      jwtSecret: process.env.JWT_SECRET || 'airis-jwt-secret-key',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'airis-refresh-secret-key',
      tokenExpiry: process.env.JWT_EXPIRY || '15m',
      refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
    });
    this.rbacManager = new RBACManager();
    this.versionManager = new APIVersionManager();
    this.transformationMiddleware = new TransformationMiddleware({
      maxBodySize: 10 * 1024 * 1024, // 10MB
      enableCompression: true,
      enableValidation: true,
      enableSanitization: true
    });

    // Service routes configuration
    this.routes = [
      { path: '/api/metrics', service: 'metrics-service', stripPath: true },
      { path: '/api/logs', service: 'logs-service', stripPath: true },
      { path: '/api/traces', service: 'traces-service', stripPath: true },
      { path: '/api/alerts', service: 'alerts-service', stripPath: true },
      { path: '/api/etl', service: 'etl-pipeline', stripPath: true },
      { path: '/registry', service: 'service-registry', stripPath: false }
    ];

    // Cache for service instances
    this.serviceCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds

    // Make logger available to middleware
    this.app.set('logger', this.logger);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.startCacheRefresh();
  }

  setupMiddleware() {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disabled for development
      crossOriginEmbedderPolicy: false
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
      credentials: true
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.id = req.headers['x-request-id'] || uuidv4();
      res.setHeader('X-Request-Id', req.id);
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.info('Request completed', {
          requestId: req.id,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('user-agent'),
          ip: req.ip
        });
      });
      
      next();
    });

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: new rateLimit.MemoryStore() // Could use Redis store for distributed rate limiting
    });

    this.app.use('/api/', limiter);

    // Slow down middleware for additional protection
    const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 500, // Allow 500 requests per 15 minutes at full speed
      delayMs: 500, // Add 500ms delay per request after delayAfter
      maxDelayMs: 20000, // Max delay of 20 seconds
      skipFailedRequests: true
    });

    this.app.use('/api/', speedLimiter);
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        services: this.serviceCache.size
      });
    });

    // Gateway status and metrics
    this.app.get('/gateway/status', async (req, res) => {
      try {
        const services = await this.getAllServices();
        const stats = await this.getGatewayStats();
        
        res.json({
          gateway: {
            status: 'operational',
            uptime: process.uptime(),
            version: '1.0.0'
          },
          services,
          stats
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Service discovery endpoint
    this.app.get('/gateway/discover/:serviceName', async (req, res) => {
      try {
        const { serviceName } = req.params;
        const instances = await this.discoverService(serviceName);
        res.json({ service: serviceName, instances });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Authentication routes
    this.app.post('/auth/login', async (req, res) => {
      try {
        const { username, password, email } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({
            error: 'Username and password required',
            code: 'MISSING_CREDENTIALS'
          });
        }

        // In production, validate against user database
        // This is a simplified example
        const validCredentials = username === 'admin' && password === 'admin123';
        
        if (!validCredentials) {
          return res.status(401).json({
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          });
        }

        // Create user payload (in production, fetch from database)
        const userPayload = {
          userId: 'user_' + username,
          username: username,
          email: email || `${username}@example.com`,
          role: 'admin' // In production, get from user profile
        };

        const accessToken = this.jwtManager.generateAccessToken(userPayload);
        const refreshToken = this.jwtManager.generateRefreshToken(userPayload);

        res.json({
          message: 'Login successful',
          accessToken,
          refreshToken,
          user: {
            id: userPayload.userId,
            username: userPayload.username,
            email: userPayload.email,
            role: userPayload.role,
            permissions: this.rbacManager.getRolePermissions(userPayload.role),
            level: this.rbacManager.getRole(userPayload.role).level
          }
        });

      } catch (error) {
        this.logger.error('Login error:', error);
        res.status(500).json({
          error: 'Login system error',
          code: 'LOGIN_ERROR'
        });
      }
    });

    this.app.post('/auth/refresh', async (req, res) => {
      try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
          return res.status(400).json({
            error: 'Refresh token required',
            code: 'REFRESH_TOKEN_MISSING'
          });
        }

        const tokens = await this.jwtManager.refreshTokens(refreshToken);
        
        res.json({
          message: 'Token refresh successful',
          ...tokens
        });

      } catch (error) {
        this.logger.warn('Token refresh failed:', error.message);
        res.status(401).json({
          error: error.message,
          code: 'REFRESH_FAILED'
        });
      }
    });

    this.app.post('/auth/logout', this.authenticateToken.bind(this), async (req, res) => {
      try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (token) {
          await this.jwtManager.blacklistToken(token);
        }

        res.json({
          message: 'Logout successful'
        });

      } catch (error) {
        this.logger.error('Logout error:', error);
        res.status(500).json({
          error: 'Logout system error',
          code: 'LOGOUT_ERROR'
        });
      }
    });

    // RBAC management routes (admin only)
    this.app.get('/auth/roles', this.authenticateToken.bind(this), this.authorizeEndpoint.bind(this), (req, res) => {
      try {
        const hierarchy = this.rbacManager.getRoleHierarchy();
        res.json({
          roles: hierarchy,
          totalRoles: hierarchy.length
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get roles',
          code: 'ROLES_ERROR'
        });
      }
    });

    this.app.post('/auth/api-key/generate', this.authenticateToken.bind(this), this.authorizeEndpoint.bind(this), (req, res) => {
      try {
        const { role } = req.body;
        
        if (!role || !this.rbacManager.getRole(role)) {
          return res.status(400).json({
            error: 'Valid role required',
            code: 'INVALID_ROLE'
          });
        }

        // Check if user can assign this role
        const canAssign = this.rbacManager.canAssignRole(
          req.user.role,
          req.user.level,
          role
        );

        if (!canAssign.allowed) {
          return res.status(403).json({
            error: canAssign.reason,
            code: 'CANNOT_ASSIGN_ROLE'
          });
        }

        const apiKey = this.rbacManager.generateRoleApiKey(role);
        
        res.json({
          message: 'API key generated successfully',
          apiKey,
          role,
          permissions: this.rbacManager.getRolePermissions(role),
          expiresIn: 'Never (revoke manually)'
        });

      } catch (error) {
        this.logger.error('API key generation error:', error);
        res.status(500).json({
          error: 'API key generation failed',
          code: 'API_KEY_GEN_ERROR'
        });
      }
    });

    // API version management routes
    this.app.get('/api/versions', (req, res) => {
      try {
        const versions = this.versionManager.getSupportedVersions();
        res.json({
          versions,
          default: this.versionManager.defaultVersion,
          latest: this.versionManager.latestVersion,
          compatibility: this.versionManager.getCompatibilityMatrix()
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get version information',
          code: 'VERSION_INFO_ERROR'
        });
      }
    });

    this.app.post('/api/versions/:version/deprecate', 
      this.authenticateToken.bind(this), 
      this.authorizeEndpoint.bind(this), 
      (req, res) => {
        try {
          const { version } = req.params;
          const { sunsetDate } = req.body;
          
          const success = this.versionManager.deprecateVersion(version, sunsetDate);
          
          if (success) {
            res.json({
              message: `API version ${version} deprecated successfully`,
              version,
              sunsetDate: sunsetDate || 'TBD'
            });
          } else {
            res.status(404).json({
              error: 'Version not found',
              code: 'VERSION_NOT_FOUND'
            });
          }
        } catch (error) {
          res.status(400).json({
            error: error.message,
            code: 'DEPRECATION_ERROR'
          });
        }
      }
    );

    this.app.post('/api/versions', 
      this.authenticateToken.bind(this), 
      this.authorizeEndpoint.bind(this), 
      (req, res) => {
        try {
          const { version, config } = req.body;
          
          if (!version || !config) {
            return res.status(400).json({
              error: 'Version and config required',
              code: 'MISSING_VERSION_CONFIG'
            });
          }
          
          const success = this.versionManager.addVersion(version, config);
          
          if (success) {
            res.status(201).json({
              message: `API version ${version} added successfully`,
              version,
              config
            });
          }
        } catch (error) {
          res.status(400).json({
            error: error.message,
            code: 'ADD_VERSION_ERROR'
          });
        }
      }
    );

    // Setup proxy routes for each service
    for (const route of this.routes) {
      this.setupServiceProxy(route);
    }

    // Catch-all for undefined routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        message: `The requested route ${req.method} ${req.originalUrl} was not found.`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Gateway error', {
        requestId: req.id,
        error: error.message,
        stack: error.stack,
        path: req.path
      });

      res.status(error.status || 500).json({
        error: 'Internal gateway error',
        message: error.message,
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    });
  }

  setupServiceProxy(route) {
    const proxyMiddleware = createProxyMiddleware({
      target: 'http://placeholder', // Will be replaced dynamically
      changeOrigin: true,
      pathRewrite: route.stripPath ? { [`^${route.path}`]: '/api' } : undefined,
      
      router: async (req) => {
        try {
          const instance = await this.getServiceInstance(route.service);
          if (!instance) {
            throw new Error(`Service ${route.service} not available`);
          }
          
          const target = `http://${instance.address}:${instance.port}`;
          this.logger.debug(`Routing ${req.method} ${req.path} to ${target}`);
          return target;
          
        } catch (error) {
          this.logger.error(`Failed to route request: ${error.message}`);
          throw error;
        }
      },

      onError: (err, req, res) => {
        this.logger.error('Proxy error', {
          error: err.message,
          service: route.service,
          path: req.path
        });

        res.status(503).json({
          error: 'Service temporarily unavailable',
          service: route.service,
          message: err.message,
          timestamp: new Date().toISOString()
        });
      },

      onProxyReq: (proxyReq, req, res) => {
        // Add gateway headers
        proxyReq.setHeader('X-Gateway-Request-Id', req.id);
        proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
        proxyReq.setHeader('X-Forwarded-For', req.ip);
        
        // Forward authentication headers
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
      },

      onProxyRes: (proxyRes, req, res) => {
        // Add response headers
        res.setHeader('X-Service', route.service);
        res.setHeader('X-Response-Time', Date.now() - req.startTime);
      }
    });

    // Apply middleware chain to API routes
    if (route.path.startsWith('/api/')) {
      this.app.use(route.path, 
        this.transformationMiddleware.middleware(),
        this.apiVersionMiddleware.bind(this),
        this.authenticateToken.bind(this), 
        this.authorizeEndpoint.bind(this),
        proxyMiddleware
      );
      this.logger.info(`Configured full middleware chain proxy route: ${route.path} -> ${route.service}`);
    } else {
      this.app.use(route.path, proxyMiddleware);
      this.logger.info(`Configured proxy route: ${route.path} -> ${route.service}`);
    }
  }

  async getServiceInstance(serviceName) {
    // Check cache first
    const cached = this.serviceCache.get(serviceName);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return this.selectInstance(cached.instances);
    }

    // Discover service instances
    const instances = await this.discoverService(serviceName);
    if (instances.length === 0) {
      return null;
    }

    // Cache the instances
    this.serviceCache.set(serviceName, {
      instances,
      timestamp: Date.now()
    });

    return this.selectInstance(instances);
  }

  async discoverService(serviceName) {
    try {
      const response = await axios.get(
        `${this.serviceRegistryUrl}/v1/health/service/${serviceName}?passing=true`,
        { timeout: 5000 }
      );

      return response.data.map(entry => ({
        id: entry.Service.ID,
        name: entry.Service.Service,
        address: entry.Service.Address,
        port: entry.Service.Port,
        tags: entry.Service.Tags,
        meta: entry.Service.Meta
      }));
      
    } catch (error) {
      this.logger.error(`Service discovery failed for ${serviceName}:`, error.message);
      return [];
    }
  }

  selectInstance(instances) {
    if (instances.length === 0) return null;
    if (instances.length === 1) return instances[0];
    
    // Simple round-robin selection
    // In production, you might want weighted round-robin or least connections
    const now = Date.now();
    const index = Math.floor(now / 1000) % instances.length;
    return instances[index];
  }

  async getAllServices() {
    try {
      const response = await axios.get(
        `${this.serviceRegistryUrl}/v1/catalog/services`,
        { timeout: 5000 }
      );
      
      const services = {};
      for (const [serviceName, tags] of Object.entries(response.data)) {
        const instances = await this.discoverService(serviceName);
        services[serviceName] = {
          instances: instances.length,
          tags,
          status: instances.length > 0 ? 'available' : 'unavailable'
        };
      }
      
      return services;
    } catch (error) {
      this.logger.error('Failed to get services:', error.message);
      return {};
    }
  }

  async getGatewayStats() {
    const stats = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        size: this.serviceCache.size
      },
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    // In a production environment, you would collect these stats
    // from metrics or logging systems
    
    return stats;
  }

  startCacheRefresh() {
    // Refresh service cache every 30 seconds
    setInterval(async () => {
      for (const [serviceName, cached] of this.serviceCache) {
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
          try {
            const instances = await this.discoverService(serviceName);
            this.serviceCache.set(serviceName, {
              instances,
              timestamp: Date.now()
            });
          } catch (error) {
            this.logger.warn(`Failed to refresh cache for ${serviceName}:`, error.message);
          }
        }
      }
    }, 30000);

    // Clean up stale cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [serviceName, cached] of this.serviceCache) {
        if (now - cached.timestamp > this.cacheTimeout * 2) {
          this.serviceCache.delete(serviceName);
          this.logger.debug(`Removed stale cache entry for ${serviceName}`);
        }
      }
    }, 300000);
  }

  // Enhanced JWT authentication middleware
  async authenticateToken(req, res, next) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ 
          error: 'Access token required',
          code: 'TOKEN_MISSING'
        });
      }

      const decoded = await this.jwtManager.verifyAccessToken(token);
      req.user = decoded;
      
      // Add audit trail
      const auditData = this.rbacManager.auditPermissionCheck(
        decoded.userId,
        decoded.username,
        decoded.role,
        decoded.permissions,
        null, // will be filled by authorization middleware
        true
      );
      req.auditData = auditData;
      
      next();
    } catch (error) {
      this.logger.warn('JWT authentication failed:', { 
        error: error.message,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    }
  }

  // Enhanced API key authentication middleware
  async authenticateApiKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({ 
          error: 'API key required',
          code: 'API_KEY_MISSING'
        });
      }

      // Validate API key format
      if (!this.jwtManager.validateApiKeyFormat(apiKey)) {
        return res.status(400).json({
          error: 'Invalid API key format',
          code: 'API_KEY_INVALID_FORMAT'
        });
      }

      // Extract role from API key prefix
      const prefix = apiKey.split('_')[0];
      const roleMapping = {
        'sa': 'superadmin',
        'ad': 'admin', 
        'op': 'operator',
        'dv': 'developer',
        'an': 'analyst',
        'vw': 'viewer',
        'gt': 'guest'
      };
      
      const role = roleMapping[prefix] || 'guest';
      const roleData = this.rbacManager.getRole(role);
      
      if (!roleData) {
        return res.status(403).json({
          error: 'Invalid API key role',
          code: 'API_KEY_INVALID_ROLE'
        });
      }

      // Create user context from API key
      req.user = {
        userId: `api_key_${prefix}`,
        username: `API Key (${role})`,
        role: role,
        permissions: this.rbacManager.getRolePermissions(role),
        level: roleData.level,
        type: 'api_key'
      };

      next();
    } catch (error) {
      this.logger.warn('API Key authentication failed:', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      
      return res.status(403).json({
        error: 'Invalid API key',
        code: 'API_KEY_INVALID'
      });
    }
  }

  // API versioning middleware
  apiVersionMiddleware(req, res, next) {
    try {
      // Extract and validate API version
      const version = this.versionManager.extractVersion(req);
      
      if (!this.versionManager.isValidVersion(version)) {
        return res.status(400).json({
          error: 'Unsupported API version',
          code: 'UNSUPPORTED_VERSION',
          requestedVersion: version,
          supportedVersions: this.versionManager.supportedVersions
        });
      }

      // Add version info to request
      req.apiVersion = version;
      req.versionInfo = this.versionManager.getVersionInfo(version);

      // Add version headers to response
      res.setHeader('API-Version', version);
      res.setHeader('API-Status', req.versionInfo.status);
      
      // Add deprecation warnings
      if (this.versionManager.isDeprecated(version)) {
        res.setHeader('Deprecated', 'true');
        res.setHeader('Sunset', req.versionInfo.sunsetDate || 'TBD');
        res.setHeader('Link', `</docs/${version}>; rel="deprecation"`);
        
        this.logger.warn('Deprecated API version accessed', {
          version,
          path: req.path,
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
      }

      if (this.versionManager.isNearSunset(version)) {
        res.setHeader('Warning', `299 - "API version ${version} will be sunset on ${req.versionInfo.sunsetDate}"`);
      }

      // Transform request for version compatibility
      req.originalBody = req.body;
      req.originalQuery = req.query;
      this.versionManager.transformRequest(req, version);

      next();
    } catch (error) {
      this.logger.error('API versioning middleware error:', error);
      return res.status(500).json({
        error: 'Version processing error',
        code: 'VERSION_ERROR'
      });
    }
  }

  // RBAC authorization middleware
  authorizeEndpoint(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const endpointInfo = this.rbacManager.getEndpointPermissions(req.method, req.path);
      
      if (!endpointInfo) {
        // Unknown endpoint - allow through (will be handled by 404)
        return next();
      }

      const hasPermission = this.rbacManager.hasPermission(
        req.user.role,
        req.user.permissions,
        endpointInfo.permission
      );

      const hasMinLevel = this.rbacManager.hasMinimumLevel(
        req.user.level,
        endpointInfo.requiredLevel
      );

      if (!hasPermission || !hasMinLevel) {
        // Update audit data
        if (req.auditData) {
          req.auditData.requiredPermission = endpointInfo.permission;
          req.auditData.granted = false;
        }

        this.logger.warn('Authorization failed:', {
          userId: req.user.userId,
          role: req.user.role,
          requiredPermission: endpointInfo.permission,
          userLevel: req.user.level,
          requiredLevel: endpointInfo.requiredLevel,
          path: req.path,
          method: req.method
        });

        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED',
          required: endpointInfo.permission,
          minimumLevel: endpointInfo.requiredLevel
        });
      }

      // Update audit data
      if (req.auditData) {
        req.auditData.requiredPermission = endpointInfo.permission;
        req.auditData.granted = true;
      }

      next();
    } catch (error) {
      this.logger.error('Authorization middleware error:', error);
      return res.status(500).json({
        error: 'Authorization system error',
        code: 'AUTH_SYSTEM_ERROR'
      });
    }
  }

  async start() {
    try {
      // Test connections
      await this.redis.ping();
      await axios.get(`${this.serviceRegistryUrl}/health`, { timeout: 5000 });
      
      this.server = this.app.listen(this.port, () => {
        this.logger.info(`API Gateway listening on port ${this.port}`);
        this.logger.info(`Service Registry: ${this.serviceRegistryUrl}`);
        this.logger.info('Configured routes:', this.routes.map(r => r.path));
      });

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        this.logger.info('SIGTERM received, shutting down gracefully');
        await this.shutdown();
      });

      process.on('SIGINT', async () => {
        this.logger.info('SIGINT received, shutting down gracefully');
        await this.shutdown();
      });

    } catch (error) {
      this.logger.error('Failed to start API Gateway:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    // Close HTTP server
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }

    // Disconnect Redis
    this.redis.disconnect();

    this.logger.info('API Gateway shut down complete');
    process.exit(0);
  }
}

// Start the API Gateway
const gateway = new APIGateway();
gateway.start();