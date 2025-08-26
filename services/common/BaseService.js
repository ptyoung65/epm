const express = require('express');
const winston = require('winston');
const promClient = require('prom-client');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

class BaseService {
  constructor(config) {
    this.serviceName = config.serviceName;
    this.serviceVersion = config.serviceVersion || '1.0.0';
    this.serviceId = `${this.serviceName}-${uuidv4().slice(0, 8)}`;
    this.port = config.port || 3000;
    this.app = express();
    
    // Service registry configuration
    this.registryUrl = process.env.SERVICE_REGISTRY_URL || 'http://localhost:8500';
    this.registryEnabled = process.env.ENABLE_SERVICE_REGISTRY === 'true';
    
    // Initialize logger
    this.logger = this.initializeLogger();
    
    // Initialize Redis for caching and pub/sub
    this.redis = this.initializeRedis();
    
    // Initialize metrics
    this.metrics = this.initializeMetrics();
    
    // Health check data
    this.health = {
      status: 'starting',
      uptime: 0,
      startTime: Date.now()
    };
    
    // Service dependencies
    this.dependencies = new Map();
    
    // Setup middleware
    this.setupBaseMiddleware();
    
    // Setup base routes
    this.setupBaseRoutes();
  }

  initializeLogger() {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { 
        service: this.serviceName,
        serviceId: this.serviceId
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: `logs/${this.serviceName}-error.log`, 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: `logs/${this.serviceName}.log` 
        })
      ]
    });
  }

  initializeRedis() {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      reconnectOnError: (err) => {
        this.logger.error('Redis connection error:', err);
        return true;
      }
    });

    redis.on('connect', () => {
      this.logger.info('Redis connected');
    });

    redis.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });

    return redis;
  }

  initializeMetrics() {
    // Clear any existing metrics
    promClient.register.clear();
    
    // Default metrics
    promClient.collectDefaultMetrics({ 
      prefix: `${this.serviceName}_`,
      register: promClient.register
    });

    // Custom metrics
    const metrics = {
      httpRequestDuration: new promClient.Histogram({
        name: `${this.serviceName}_http_request_duration_seconds`,
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status']
      }),
      httpRequestTotal: new promClient.Counter({
        name: `${this.serviceName}_http_requests_total`,
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status']
      }),
      activeConnections: new promClient.Gauge({
        name: `${this.serviceName}_active_connections`,
        help: 'Number of active connections'
      }),
      errorRate: new promClient.Counter({
        name: `${this.serviceName}_errors_total`,
        help: 'Total number of errors',
        labelNames: ['type']
      })
    };

    return metrics;
  }

  setupBaseMiddleware() {
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request ID middleware
    this.app.use((req, res, next) => {
      req.id = req.headers['x-request-id'] || uuidv4();
      res.setHeader('X-Request-Id', req.id);
      next();
    });
    
    // Logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.info('Request completed', {
          requestId: req.id,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration
        });
        
        // Update metrics
        this.metrics.httpRequestDuration.observe(
          { method: req.method, route: req.path, status: res.statusCode },
          duration / 1000
        );
        this.metrics.httpRequestTotal.inc({
          method: req.method,
          route: req.path,
          status: res.statusCode
        });
      });
      
      next();
    });
    
    // Error handling middleware
    this.app.use((err, req, res, next) => {
      this.logger.error('Request error', {
        requestId: req.id,
        error: err.message,
        stack: err.stack
      });
      
      this.metrics.errorRate.inc({ type: 'request_error' });
      
      res.status(err.status || 500).json({
        error: {
          message: err.message,
          requestId: req.id
        }
      });
    });
  }

  setupBaseRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const uptime = Date.now() - this.health.startTime;
      res.json({
        service: this.serviceName,
        serviceId: this.serviceId,
        version: this.serviceVersion,
        status: this.health.status,
        uptime,
        timestamp: new Date().toISOString(),
        checks: this.getHealthChecks()
      });
    });
    
    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', promClient.register.contentType);
      const metrics = await promClient.register.metrics();
      res.end(metrics);
    });
    
    // Service info endpoint
    this.app.get('/info', (req, res) => {
      res.json({
        service: this.serviceName,
        serviceId: this.serviceId,
        version: this.serviceVersion,
        dependencies: Array.from(this.dependencies.keys()),
        environment: process.env.NODE_ENV || 'development',
        features: this.getFeatures()
      });
    });
    
    // Ready check endpoint
    this.app.get('/ready', (req, res) => {
      if (this.health.status === 'healthy') {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false });
      }
    });
  }

  getHealthChecks() {
    const checks = {};
    
    // Redis health
    checks.redis = {
      status: this.redis.status === 'ready' ? 'healthy' : 'unhealthy',
      latency: null
    };
    
    // Add custom health checks from child services
    if (this.customHealthChecks) {
      Object.assign(checks, this.customHealthChecks());
    }
    
    return checks;
  }

  getFeatures() {
    // Override in child services to list features
    return [];
  }

  // Service discovery methods
  async registerService() {
    if (!this.registryEnabled) {
      this.logger.info('Service registry disabled');
      return;
    }

    try {
      const registration = {
        id: this.serviceId,
        name: this.serviceName,
        address: process.env.SERVICE_ADDRESS || 'localhost',
        port: this.port,
        tags: [
          `version:${this.serviceVersion}`,
          `env:${process.env.NODE_ENV || 'development'}`
        ],
        check: {
          http: `http://localhost:${this.port}/health`,
          interval: '10s',
          timeout: '5s'
        }
      };

      // Register with Consul or custom registry
      await axios.put(
        `${this.registryUrl}/v1/agent/service/register`,
        registration
      );

      this.logger.info('Service registered', { 
        serviceId: this.serviceId,
        serviceName: this.serviceName
      });
    } catch (error) {
      this.logger.error('Failed to register service:', error);
    }
  }

  async deregisterService() {
    if (!this.registryEnabled) {
      return;
    }

    try {
      await axios.put(
        `${this.registryUrl}/v1/agent/service/deregister/${this.serviceId}`
      );
      
      this.logger.info('Service deregistered', { serviceId: this.serviceId });
    } catch (error) {
      this.logger.error('Failed to deregister service:', error);
    }
  }

  async discoverService(serviceName) {
    if (!this.registryEnabled) {
      // Fallback to environment variables
      const host = process.env[`${serviceName.toUpperCase()}_HOST`] || 'localhost';
      const port = process.env[`${serviceName.toUpperCase()}_PORT`];
      return port ? `http://${host}:${port}` : null;
    }

    try {
      const response = await axios.get(
        `${this.registryUrl}/v1/health/service/${serviceName}?passing`
      );
      
      if (response.data && response.data.length > 0) {
        // Load balance: pick random healthy instance
        const instance = response.data[Math.floor(Math.random() * response.data.length)];
        return `http://${instance.Service.Address}:${instance.Service.Port}`;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Failed to discover service ${serviceName}:`, error);
      return null;
    }
  }

  // Inter-service communication
  async callService(serviceName, method, path, data = null, options = {}) {
    const serviceUrl = await this.discoverService(serviceName);
    
    if (!serviceUrl) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const config = {
      method,
      url: `${serviceUrl}${path}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Name': this.serviceName,
        'X-Service-Id': this.serviceId,
        ...options.headers
      },
      timeout: options.timeout || 5000
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      this.logger.error(`Service call failed to ${serviceName}:`, error);
      throw error;
    }
  }

  // Pub/Sub messaging
  async publish(channel, message) {
    try {
      const payload = JSON.stringify({
        ...message,
        serviceId: this.serviceId,
        serviceName: this.serviceName,
        timestamp: Date.now()
      });
      
      await this.redis.publish(channel, payload);
      this.logger.debug(`Published to channel ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to publish to ${channel}:`, error);
      throw error;
    }
  }

  async subscribe(channel, handler) {
    const subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });

    subscriber.on('message', async (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const data = JSON.parse(message);
          await handler(data);
        } catch (error) {
          this.logger.error(`Error handling message from ${channel}:`, error);
        }
      }
    });

    await subscriber.subscribe(channel);
    this.logger.info(`Subscribed to channel ${channel}`);
    
    return subscriber;
  }

  // Caching utilities
  async cacheSet(key, value, ttl = 3600) {
    const cacheKey = `${this.serviceName}:${key}`;
    await this.redis.setex(cacheKey, ttl, JSON.stringify(value));
  }

  async cacheGet(key) {
    const cacheKey = `${this.serviceName}:${key}`;
    const value = await this.redis.get(cacheKey);
    return value ? JSON.parse(value) : null;
  }

  async cacheDelete(key) {
    const cacheKey = `${this.serviceName}:${key}`;
    await this.redis.del(cacheKey);
  }

  // Lifecycle methods
  async start() {
    try {
      // Initialize service-specific components
      if (this.initialize) {
        await this.initialize();
      }

      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        this.logger.info(`${this.serviceName} listening on port ${this.port}`);
        this.health.status = 'healthy';
      });

      // Register with service registry
      await this.registerService();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start service:', error);
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      this.logger.info(`${signal} received, shutting down gracefully`);
      this.health.status = 'shutting_down';

      // Deregister from service registry
      await this.deregisterService();

      // Close HTTP server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
      }

      // Cleanup service-specific resources
      if (this.cleanup) {
        await this.cleanup();
      }

      // Close Redis connections
      this.redis.disconnect();

      this.logger.info('Service shut down complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

module.exports = BaseService;