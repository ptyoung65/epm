import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { ServiceController } from './controllers/ServiceController';
import { HealthController } from './controllers/HealthController';
import { ConfigController } from './controllers/ConfigController';
import { ServiceDiscovery } from './discovery/ServiceDiscovery';
import { ConfigManager } from './config/ConfigManager';
import { ServiceMonitor } from './monitoring/ServiceMonitor';
import { LoadBalancer } from './balancing/LoadBalancer';
import { ServiceCache } from './cache/ServiceCache';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import * as cron from 'node-cron';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export interface ServiceRegistryConfig {
  port: number;
  consul: {
    host: string;
    port: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  etcd?: {
    hosts: string[];
  };
  rateLimiting: {
    windowMs: number;
    max: number;
  };
  healthCheck: {
    interval: number;
    timeout: number;
    retries: number;
  };
}

export class ServiceRegistryApp {
  private app: Express;
  private server: any;
  private config: ServiceRegistryConfig;
  private logger: Logger;
  private serviceDiscovery!: ServiceDiscovery;
  private configManager!: ConfigManager;
  private serviceMonitor!: ServiceMonitor;
  private loadBalancer!: LoadBalancer;
  private serviceCache!: ServiceCache;
  private redisClient!: Redis;
  private cronJobs: cron.ScheduledTask[] = [];
  private instanceId: string;

  constructor(config: ServiceRegistryConfig) {
    this.app = express();
    this.config = config;
    this.instanceId = uuidv4();
    
    // Initialize logger
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      defaultMeta: { service: 'service-registry', instanceId: this.instanceId },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        })
      ]
    });

    this.setupMiddleware();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimiting.windowMs,
      max: this.config.rateLimiting.max,
      message: 'Too many requests from this IP'
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  /**
   * Initialize service components
   */
  private async initializeServices(): Promise<void> {
    // Initialize Redis client
    this.redisClient = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    // Initialize service cache
    this.serviceCache = new ServiceCache(this.redisClient);

    // Initialize service discovery
    this.serviceDiscovery = new ServiceDiscovery({
      consul: this.config.consul,
      etcd: this.config.etcd,
      cache: this.serviceCache
    });
    
    await this.serviceDiscovery.initialize();

    // Initialize configuration manager
    this.configManager = new ConfigManager({
      consul: this.config.consul,
      cache: this.serviceCache
    });
    
    await this.configManager.initialize();

    // Initialize load balancer
    this.loadBalancer = new LoadBalancer({
      discovery: this.serviceDiscovery,
      cache: this.serviceCache,
      strategies: ['round-robin', 'least-connections', 'weighted-round-robin', 'health-based']
    });

    // Initialize service monitor
    this.serviceMonitor = new ServiceMonitor({
      discovery: this.serviceDiscovery,
      cache: this.serviceCache,
      healthCheck: this.config.healthCheck
    });
    
    await this.serviceMonitor.initialize();

    this.logger.info('All service components initialized successfully');
  }

  /**
   * Register API routes
   */
  private registerRoutes(): void {
    const serviceController = new ServiceController(
      this.serviceDiscovery,
      this.loadBalancer,
      this.serviceCache
    );

    const healthController = new HealthController(
      this.serviceMonitor,
      this.serviceCache
    );

    const configController = new ConfigController(
      this.configManager
    );

    // Service registration and discovery
    this.app.post('/api/v1/services/register', serviceController.registerService.bind(serviceController));
    this.app.delete('/api/v1/services/:serviceId', serviceController.deregisterService.bind(serviceController));
    this.app.get('/api/v1/services', serviceController.getServices.bind(serviceController));
    this.app.get('/api/v1/services/:serviceName', serviceController.getServiceInstances.bind(serviceController));
    this.app.get('/api/v1/services/:serviceName/healthy', serviceController.getHealthyInstances.bind(serviceController));
    
    // Load balancing
    this.app.get('/api/v1/services/:serviceName/instance', serviceController.getServiceInstance.bind(serviceController));
    this.app.post('/api/v1/services/:serviceName/route', serviceController.routeRequest.bind(serviceController));
    
    // Service discovery
    this.app.post('/api/v1/discovery/query', serviceController.queryServices.bind(serviceController));
    this.app.get('/api/v1/discovery/catalog', serviceController.getServiceCatalog.bind(serviceController));
    
    // Health monitoring
    this.app.get('/api/v1/health', healthController.getSystemHealth.bind(healthController));
    this.app.get('/api/v1/health/:serviceName', healthController.getServiceHealth.bind(healthController));
    this.app.post('/api/v1/health/:serviceId/check', healthController.performHealthCheck.bind(healthController));
    this.app.get('/api/v1/health/status/summary', healthController.getHealthSummary.bind(healthController));
    
    // Configuration management
    this.app.get('/api/v1/config/:serviceName', configController.getServiceConfig.bind(configController));
    this.app.put('/api/v1/config/:serviceName', configController.updateServiceConfig.bind(configController));
    this.app.get('/api/v1/config/:serviceName/watch', configController.watchConfig.bind(configController));
    this.app.post('/api/v1/config/validate', configController.validateConfig.bind(configController));
    
    // Service mesh features
    this.app.get('/api/v1/mesh/topology', serviceController.getServiceTopology.bind(serviceController));
    this.app.get('/api/v1/mesh/dependencies/:serviceName', serviceController.getServiceDependencies.bind(serviceController));
    this.app.post('/api/v1/mesh/circuit-breaker/:serviceName', serviceController.updateCircuitBreaker.bind(serviceController));
    
    // Registry management
    this.app.get('/api/v1/registry/stats', serviceController.getRegistryStats.bind(serviceController));
    this.app.post('/api/v1/registry/cleanup', serviceController.cleanupStaleServices.bind(serviceController));
    this.app.post('/api/v1/registry/maintenance', serviceController.setMaintenanceMode.bind(serviceController));
    
    // WebSocket endpoint for real-time updates
    this.app.get('/api/v1/services/watch', serviceController.watchServices.bind(serviceController));
    
    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        service: 'AIRIS EPM Service Registry',
        version: '1.0.0',
        instanceId: this.instanceId,
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });

    // Error handling middleware
    this.app.use((err: any, req: Request, res: Response, next: any) => {
      this.logger.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });

    this.logger.info('API routes registered successfully');
  }

  /**
   * Setup scheduled tasks
   */
  private setupScheduledTasks(): void {
    // Health check job - every 30 seconds
    const healthCheckJob = cron.schedule('*/30 * * * * *', async () => {
      try {
        await this.serviceMonitor.performHealthChecks();
      } catch (error) {
        this.logger.error('Health check job failed:', error);
      }
    });

    // Service cleanup job - every 5 minutes
    const cleanupJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.serviceDiscovery.cleanupStaleServices();
        await this.serviceCache.cleanup();
      } catch (error) {
        this.logger.error('Cleanup job failed:', error);
      }
    });

    // Cache refresh job - every minute
    const cacheRefreshJob = cron.schedule('* * * * *', async () => {
      try {
        await this.serviceCache.refreshCache();
      } catch (error) {
        this.logger.error('Cache refresh job failed:', error);
      }
    });

    // Statistics collection job - every hour
    const statsJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.serviceMonitor.collectStatistics();
      } catch (error) {
        this.logger.error('Statistics collection job failed:', error);
      }
    });

    this.cronJobs.push(healthCheckJob, cleanupJob, cacheRefreshJob, statsJob);
    this.logger.info('Scheduled tasks setup completed');
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      // Stop accepting new requests
      if (this.server) {
        this.server.close(async () => {
          try {
            // Stop cron jobs
            this.cronJobs.forEach(job => job.stop());
            
            // Deregister from service discovery
            if (this.serviceDiscovery) {
              await this.serviceDiscovery.deregister(this.instanceId);
            }
            
            // Close database connections
            if (this.redisClient) {
              await this.redisClient.quit();
            }
            
            this.logger.info('Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
          }
        });
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * Start the service registry
   */
  async start(): Promise<void> {
    try {
      // Initialize all services
      await this.initializeServices();
      
      // Register API routes
      this.registerRoutes();
      
      // Setup scheduled tasks
      this.setupScheduledTasks();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      // Start HTTP server
      this.server = this.app.listen(this.config.port, () => {
        this.logger.info(`Service Registry started on port ${this.config.port}`);
        this.logger.info(`Instance ID: ${this.instanceId}`);
        this.logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      // Register self in service discovery
      await this.serviceDiscovery.register({
        id: this.instanceId,
        name: 'service-registry',
        address: 'localhost',
        port: this.config.port,
        tags: ['registry', 'discovery', 'core'],
        healthCheck: {
          http: `http://localhost:${this.config.port}/api/v1/health`,
          interval: '10s',
          timeout: '3s'
        }
      });

    } catch (error) {
      this.logger.error('Failed to start Service Registry:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the service registry
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping Service Registry...');
    
    try {
      // Stop cron jobs
      this.cronJobs.forEach(job => job.stop());
      
      // Close server
      if (this.server) {
        this.server.close();
      }
      
      // Close Redis connection
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      
      this.logger.info('Service Registry stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping Service Registry:', error);
      throw error;
    }
  }
}