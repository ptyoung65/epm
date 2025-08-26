import express, { Application, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import winston from 'winston';
import * as promClient from 'prom-client';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { ServiceRegistry } from '../discovery/ServiceRegistry';
import { HealthChecker } from '../health/HealthChecker';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { ConfigManager } from '../config/ConfigManager';
import { ErrorHandler } from '../error/ErrorHandler';
import { TracingManager } from '../tracing/TracingManager';
import { CircuitBreaker } from '../resilience/CircuitBreaker';
import { MessageBus } from '../messaging/MessageBus';

export interface MicroserviceConfig {
  serviceName: string;
  serviceVersion: string;
  port: number;
  environment: 'development' | 'staging' | 'production';
  consul?: {
    host: string;
    port: number;
  };
  kafka?: {
    brokers: string[];
    clientId: string;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  jaeger?: {
    serviceName: string;
    agentHost: string;
    agentPort: number;
  };
  rateLimiting?: {
    windowMs: number;
    max: number;
  };
}

export abstract class MicroserviceBase {
  protected app: Application;
  protected server?: Server;
  protected logger: winston.Logger;
  protected config: MicroserviceConfig;
  protected serviceRegistry?: ServiceRegistry;
  protected healthChecker: HealthChecker;
  protected metricsCollector: MetricsCollector;
  protected configManager: ConfigManager;
  protected errorHandler: ErrorHandler;
  protected tracingManager?: TracingManager;
  protected messageBus?: MessageBus;
  protected circuitBreakers: Map<string, CircuitBreaker>;

  constructor(config: MicroserviceConfig) {
    this.config = config;
    this.app = express();
    this.logger = this.createLogger();
    this.healthChecker = new HealthChecker();
    this.metricsCollector = new MetricsCollector(config.serviceName);
    this.configManager = new ConfigManager(config);
    this.errorHandler = new ErrorHandler(this.logger);
    this.circuitBreakers = new Map();

    this.initializeMiddleware();
    this.initializeMetrics();
    this.initializeHealthChecks();
  }

  /**
   * Initialize Express middleware
   */
  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    if (this.config.rateLimiting) {
      const limiter = rateLimit({
        windowMs: this.config.rateLimiting.windowMs,
        max: this.config.rateLimiting.max,
        message: 'Too many requests from this IP'
      });
      this.app.use('/api', limiter);
    }

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.info('Request processed', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          ip: req.ip
        });
        this.metricsCollector.recordHttpRequest(req.method, req.path, res.statusCode, duration);
      });
      next();
    });

    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.id = req.headers['x-request-id'] as string || this.generateRequestId();
      res.setHeader('x-request-id', req.id);
      next();
    });
  }

  /**
   * Initialize Prometheus metrics
   */
  private initializeMetrics(): void {
    // Default metrics
    promClient.collectDefaultMetrics({ prefix: `${this.config.serviceName}_` });

    // Metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      try {
        res.set('Content-Type', promClient.register.contentType);
        res.end(await promClient.register.metrics());
      } catch (error) {
        res.status(500).end();
      }
    });
  }

  /**
   * Initialize health check endpoints
   */
  private initializeHealthChecks(): void {
    // Liveness probe
    this.app.get('/health/live', (req: Request, res: Response) => {
      res.json({ status: 'UP', timestamp: new Date().toISOString() });
    });

    // Readiness probe
    this.app.get('/health/ready', async (req: Request, res: Response) => {
      const health = await this.healthChecker.checkHealth();
      const statusCode = health.status === 'UP' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Detailed health check
    this.app.get('/health', async (req: Request, res: Response) => {
      const health = await this.healthChecker.getDetailedHealth();
      const statusCode = health.status === 'UP' ? 200 : 503;
      res.status(statusCode).json(health);
    });
  }

  /**
   * Create Winston logger instance
   */
  private createLogger(): winston.Logger {
    return winston.createLogger({
      level: this.config.environment === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { 
        service: this.config.serviceName,
        version: this.config.serviceVersion,
        environment: this.config.environment
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  /**
   * Initialize service discovery
   */
  protected async initializeServiceDiscovery(): Promise<void> {
    if (this.config.consul) {
      this.serviceRegistry = new ServiceRegistry(this.config.consul);
      await this.serviceRegistry.register({
        name: this.config.serviceName,
        id: `${this.config.serviceName}-${process.pid}`,
        address: this.getServiceAddress(),
        port: this.config.port,
        tags: [this.config.environment, this.config.serviceVersion],
        check: {
          http: `http://localhost:${this.config.port}/health/ready`,
          interval: '10s',
          timeout: '5s'
        }
      });
      this.logger.info('Service registered with Consul');
    }
  }

  /**
   * Initialize distributed tracing
   */
  protected initializeTracing(): void {
    if (this.config.jaeger) {
      this.tracingManager = new TracingManager(this.config.jaeger);
      this.app.use(this.tracingManager.middleware());
      this.logger.info('Distributed tracing initialized');
    }
  }

  /**
   * Initialize message bus
   */
  protected async initializeMessageBus(): Promise<void> {
    if (this.config.kafka) {
      this.messageBus = new MessageBus(this.config.kafka);
      await this.messageBus.connect();
      this.logger.info('Message bus connected');
    }
  }

  /**
   * Create a circuit breaker for external service calls
   */
  protected createCircuitBreaker(name: string, options?: any): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const breaker = new CircuitBreaker(name, options);
      this.circuitBreakers.set(name, breaker);
    }
    return this.circuitBreakers.get(name)!;
  }

  /**
   * Register API routes - to be implemented by child classes
   */
  protected abstract registerRoutes(): void;

  /**
   * Initialize service-specific components - to be implemented by child classes
   */
  protected abstract initializeService(): Promise<void>;

  /**
   * Start the microservice
   */
  public async start(): Promise<void> {
    try {
      // Initialize components
      await this.initializeServiceDiscovery();
      this.initializeTracing();
      await this.initializeMessageBus();
      await this.initializeService();

      // Register routes
      this.registerRoutes();

      // Error handling middleware (must be last)
      this.app.use(this.errorHandler.middleware());

      // Start server
      this.server = this.app.listen(this.config.port, () => {
        this.logger.info(`${this.config.serviceName} started on port ${this.config.port}`);
      });

      // Graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start service', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`${signal} received, starting graceful shutdown`);

      // Stop accepting new connections
      if (this.server) {
        this.server.close();
      }

      // Deregister from service discovery
      if (this.serviceRegistry) {
        await this.serviceRegistry.deregister();
      }

      // Close message bus
      if (this.messageBus) {
        await this.messageBus.disconnect();
      }

      // Close tracing
      if (this.tracingManager) {
        this.tracingManager.close();
      }

      // Wait for existing connections to close
      setTimeout(() => {
        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get service address for registration
   */
  private getServiceAddress(): string {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${this.config.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get Express app instance
   */
  public getApp(): Application {
    return this.app;
  }

  /**
   * Get logger instance
   */
  public getLogger(): winston.Logger {
    return this.logger;
  }

  /**
   * Get metrics collector
   */
  public getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Get message bus
   */
  public getMessageBus(): MessageBus | undefined {
    return this.messageBus;
  }
}

// Extend Express Request type to include custom properties
declare global {
  namespace Express {
    interface Request {
      id?: string;
      span?: any;
    }
  }
}