import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { json, urlencoded } from 'body-parser';
import { config } from './config/environment';
import { logger, performanceLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authentication } from './middleware/authentication';
import { versionNegotiation } from './middleware/versionNegotiation';
import { metricsMiddleware } from './middleware/metrics';
import { healthCheck } from './routes/health';
import { compatibilityRoutes } from './routes/compatibility';
import { migrationRoutes } from './routes/migration';
import { documentationRoutes } from './routes/documentation';
import { CompatibilityService } from './services/CompatibilityService';
import { MigrationService } from './services/MigrationService';
import { ApiVersionManager } from './services/ApiVersionManager';
import { DataTransformer } from './services/DataTransformer';

/**
 * AIRIS APM to EPM Compatibility Layer Server
 * 
 * Provides seamless backward compatibility for existing AIRIS APM clients
 * while transparently routing requests to new EPM services.
 */
class CompatibilityServer {
  private app: express.Application;
  private compatibilityService: CompatibilityService;
  private migrationService: MigrationService;
  private versionManager: ApiVersionManager;
  private dataTransformer: DataTransformer;

  constructor() {
    this.app = express();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Initialize core services
   */
  private initializeServices(): void {
    this.versionManager = new ApiVersionManager();
    this.dataTransformer = new DataTransformer();
    this.compatibilityService = new CompatibilityService(
      this.versionManager,
      this.dataTransformer
    );
    this.migrationService = new MigrationService(
      this.compatibilityService,
      this.dataTransformer
    );

    logger.info('Compatibility layer services initialized', {
      supportedVersions: this.versionManager.getSupportedVersions(),
      service: 'compatibility-layer'
    });
  }

  /**
   * Setup Express middleware stack
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // CORS configuration for backward compatibility
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow all origins in development, specific origins in production
        if (config.isDevelopment || !origin) {
          callback(null, true);
        } else {
          const allowedOrigins = config.cors.allowedOrigins;
          if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-API-Version',
        'X-Client-Version',
        'X-Migration-Mode',
        'Accept',
        'Origin'
      ],
      exposedHeaders: [
        'X-API-Version',
        'X-Deprecated',
        'X-Migration-Available',
        'X-Rate-Limit-Remaining'
      ]
    }));

    // Compression
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6,
      threshold: 1024,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimiting.windowMs,
      max: config.rateLimiting.maxRequests,
      message: {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000),
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method,
        });
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000),
        });
      },
    });

    this.app.use(limiter);

    // Body parsing with size limits
    this.app.use(json({ 
      limit: config.server.maxPayloadSize,
      verify: (req, res, buf) => {
        // Store raw body for webhook signature verification if needed
        (req as any).rawBody = buf;
      }
    }));
    this.app.use(urlencoded({ 
      extended: true, 
      limit: config.server.maxPayloadSize 
    }));

    // Request logging and metrics
    this.app.use(requestLogger);
    this.app.use(metricsMiddleware);

    // API version negotiation
    this.app.use(versionNegotiation(this.versionManager));

    // Authentication (optional for some endpoints)
    this.app.use(authentication);

    // Custom middleware for compatibility tracking
    this.app.use((req, res, next) => {
      // Track API usage patterns
      const clientVersion = req.headers['x-client-version'] as string;
      const apiVersion = req.headers['x-api-version'] as string || 'v1';
      
      if (clientVersion) {
        performanceLogger.api('Client API usage', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime: 0, // Will be updated by response middleware
          clientVersion,
          apiVersion,
          userId: (req as any).user?.id,
          requestId: (req as any).requestId || 'unknown'
        });
      }

      next();
    });
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Health check (no authentication required)
    this.app.use('/health', healthCheck);

    // Documentation routes
    this.app.use('/docs', documentationRoutes);

    // Migration utilities and status
    this.app.use('/migration', migrationRoutes(this.migrationService));

    // Main compatibility layer routes
    this.app.use('/api', compatibilityRoutes(
      this.compatibilityService,
      this.versionManager,
      this.dataTransformer
    ));

    // Legacy AIRIS APM endpoints (redirect with warnings)
    this.app.use('/apm', (req, res, next) => {
      res.set('X-Deprecated', 'true');
      res.set('X-Migration-Available', 'true');
      
      logger.warn('Legacy APM endpoint accessed', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
      });

      // Redirect to new API with compatibility layer
      const newPath = req.path.replace('/apm', '/api/v1');
      req.url = newPath;
      req.path = newPath;
      
      next();
    });

    // Catch-all for unknown routes
    this.app.use('*', (req, res) => {
      logger.info('Unknown endpoint accessed', {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });

      res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
        suggestion: 'Check API documentation at /docs',
        availableVersions: this.versionManager.getSupportedVersions(),
      });
    });

    // Error handling middleware (must be last)
    this.app.use(errorHandler);
  }

  /**
   * Start the compatibility layer server
   */
  public async start(): Promise<void> {
    try {
      // Initialize services
      await this.compatibilityService.initialize();
      await this.migrationService.initialize();

      // Start HTTP server
      const server = this.app.listen(config.server.port, () => {
        logger.info(`🔄 AIRIS Compatibility Layer ready at http://localhost:${config.server.port}`, {
          environment: config.env,
          supportedVersions: this.versionManager.getSupportedVersions(),
          service: 'compatibility-layer'
        });
        logger.info(`📚 API Documentation: http://localhost:${config.server.port}/docs`);
        logger.info(`🔍 Health Check: http://localhost:${config.server.port}/health`);
        logger.info(`🔄 Migration Status: http://localhost:${config.server.port}/migration/status`);
      });

      // Graceful shutdown handling
      const shutdown = async (signal: string) => {
        logger.info(`${signal} received, shutting down gracefully`);
        
        server.close(async () => {
          logger.info('HTTP server closed');
          
          try {
            await this.compatibilityService.shutdown();
            await this.migrationService.shutdown();
            logger.info('Services shut down successfully');
            process.exit(0);
          } catch (error) {
            logger.error('Error during shutdown', { error: error.message });
            process.exit(1);
          }
        });

        // Force close after timeout
        setTimeout(() => {
          logger.error('Could not close connections in time, forcefully shutting down');
          process.exit(1);
        }, 10000);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception', { 
          error: error.message, 
          stack: error.stack 
        });
        process.exit(1);
      });

      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection', { 
          reason, 
          promise: promise.toString() 
        });
        process.exit(1);
      });

    } catch (error) {
      logger.error('Failed to start compatibility layer server', { 
        error: error.message,
        stack: error.stack 
      });
      process.exit(1);
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new CompatibilityServer();
  
  // Store start time for health checks
  (global as any).startTime = Date.now();
  
  server.start().catch((error) => {
    logger.error('Failed to start compatibility server:', error);
    process.exit(1);
  });
}

export default CompatibilityServer;