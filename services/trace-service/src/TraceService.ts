import { MicroserviceBase, MicroserviceConfig } from '@airis-epm/shared/base/MicroserviceBase';
import { TraceController } from './controllers/TraceController';
import { SpanController } from './controllers/SpanController';
import { TraceRepository } from './repositories/TraceRepository';
import { TraceProcessor } from './processors/TraceProcessor';
import { TraceAggregator } from './aggregators/TraceAggregator';
import { TraceCacheManager } from './cache/TraceCacheManager';
import { TraceIngestionQueue } from './queues/TraceIngestionQueue';
import { DependencyAnalyzer } from './analyzers/DependencyAnalyzer';
import { PerformanceAnalyzer } from './analyzers/PerformanceAnalyzer';
import * as cron from 'node-cron';
import Redis from 'ioredis';
import { initTracer } from 'jaeger-client';
import { Tracer } from 'opentracing';

export class TraceService extends MicroserviceBase {
  private traceRepository!: TraceRepository;
  private traceProcessor!: TraceProcessor;
  private traceAggregator!: TraceAggregator;
  private cacheManager!: TraceCacheManager;
  private ingestionQueue!: TraceIngestionQueue;
  private dependencyAnalyzer!: DependencyAnalyzer;
  private performanceAnalyzer!: PerformanceAnalyzer;
  private redisClient!: Redis;
  private tracer!: Tracer;
  private cronJobs: cron.ScheduledTask[] = [];

  constructor() {
    const config: MicroserviceConfig = {
      serviceName: 'trace-service',
      serviceVersion: '1.0.0',
      port: parseInt(process.env.PORT || '8003'),
      environment: (process.env.NODE_ENV as any) || 'development',
      consul: {
        host: process.env.CONSUL_HOST || 'localhost',
        port: parseInt(process.env.CONSUL_PORT || '8500')
      },
      kafka: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientId: 'trace-service'
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      jaeger: {
        serviceName: 'trace-service',
        agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
        agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6831')
      },
      rateLimiting: {
        windowMs: 60000,
        max: 5000 // High limit for trace ingestion
      }
    };

    super(config);
  }

  /**
   * Initialize service-specific components
   */
  protected async initializeService(): Promise<void> {
    // Initialize Redis client
    this.redisClient = new Redis({
      host: this.config.redis!.host,
      port: this.config.redis!.port,
      password: this.config.redis?.password
    });

    // Initialize Jaeger tracer
    this.tracer = initTracer({
      serviceName: this.config.serviceName,
      sampler: {
        type: 'probabilistic',
        param: parseFloat(process.env.JAEGER_SAMPLE_RATE || '0.1')
      },
      reporter: {
        agentHost: this.config.jaeger!.agentHost,
        agentPort: this.config.jaeger!.agentPort,
        logSpans: process.env.NODE_ENV === 'development'
      }
    }, {
      logger: {
        info: (msg: string) => this.logger.info(msg),
        error: (msg: string) => this.logger.error(msg)
      }
    });

    // Initialize trace repository (ClickHouse)
    this.traceRepository = new TraceRepository({
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: parseInt(process.env.CLICKHOUSE_PORT || '9000'),
      database: process.env.CLICKHOUSE_DATABASE || 'traces',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || ''
    });

    await this.traceRepository.initialize();

    // Initialize cache manager
    this.cacheManager = new TraceCacheManager(this.redisClient);

    // Initialize trace processor
    this.traceProcessor = new TraceProcessor(
      this.traceRepository,
      this.cacheManager,
      this.tracer
    );

    // Initialize trace aggregator
    this.traceAggregator = new TraceAggregator(
      this.traceRepository,
      this.cacheManager
    );

    // Initialize analyzers
    this.dependencyAnalyzer = new DependencyAnalyzer(
      this.traceRepository,
      this.cacheManager
    );

    this.performanceAnalyzer = new PerformanceAnalyzer(
      this.traceRepository,
      this.cacheManager
    );

    // Initialize ingestion queue
    this.ingestionQueue = new TraceIngestionQueue(
      this.redisClient,
      this.traceProcessor
    );

    await this.ingestionQueue.initialize();

    // Setup scheduled tasks
    this.setupScheduledTasks();

    // Setup Kafka consumers
    await this.setupKafkaConsumers();

    // Setup health checks
    this.setupHealthChecks();

    this.logger.info('Trace Service initialized successfully');
  }

  /**
   * Register API routes
   */
  protected registerRoutes(): void {
    const traceController = new TraceController(
      this.traceProcessor,
      this.dependencyAnalyzer,
      this.performanceAnalyzer
    );

    const spanController = new SpanController(
      this.traceProcessor,
      this.ingestionQueue
    );

    // Trace ingestion endpoints
    this.app.post('/api/v1/traces', traceController.ingestTrace.bind(traceController));
    this.app.post('/api/v1/traces/batch', traceController.ingestBatch.bind(traceController));
    this.app.post('/api/v1/spans', spanController.ingestSpan.bind(spanController));
    
    // Query endpoints
    this.app.get('/api/v1/traces', traceController.getTraces.bind(traceController));
    this.app.get('/api/v1/traces/:traceId', traceController.getTrace.bind(traceController));
    this.app.get('/api/v1/traces/:traceId/spans', traceController.getTraceSpans.bind(traceController));
    this.app.get('/api/v1/spans/:spanId', spanController.getSpan.bind(spanController));
    
    // Analysis endpoints
    this.app.get('/api/v1/traces/dependencies', traceController.getDependencies.bind(traceController));
    this.app.get('/api/v1/traces/performance', traceController.getPerformanceMetrics.bind(traceController));
    this.app.get('/api/v1/traces/errors', traceController.getErrorAnalysis.bind(traceController));
    this.app.get('/api/v1/traces/latency', traceController.getLatencyAnalysis.bind(traceController));
    
    // Service map endpoints
    this.app.get('/api/v1/traces/service-map', traceController.getServiceMap.bind(traceController));
    this.app.get('/api/v1/traces/critical-path/:traceId', traceController.getCriticalPath.bind(traceController));
    
    // Management endpoints
    this.app.post('/api/v1/traces/sampling', traceController.updateSamplingConfig.bind(traceController));
    this.app.delete('/api/v1/traces/cleanup', traceController.cleanupOldTraces.bind(traceController));
    this.app.post('/api/v1/traces/reindex', traceController.reindexTraces.bind(traceController));

    this.logger.info('Routes registered successfully');
  }

  /**
   * Setup scheduled tasks
   */
  private setupScheduledTasks(): void {
    // Dependency analysis job - every 10 minutes
    const dependencyJob = cron.schedule('*/10 * * * *', async () => {
      try {
        await this.dependencyAnalyzer.analyzeDependencies();
        this.logger.info('Dependency analysis completed');
      } catch (error) {
        this.logger.error('Dependency analysis failed:', error);
      }
    });

    // Performance analysis job - every 5 minutes
    const performanceJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.performanceAnalyzer.analyzePerformance();
        this.logger.info('Performance analysis completed');
      } catch (error) {
        this.logger.error('Performance analysis failed:', error);
      }
    });

    // Trace aggregation job - every hour
    const aggregationJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.traceAggregator.aggregateHourlyStats();
        this.logger.info('Trace aggregation completed');
      } catch (error) {
        this.logger.error('Trace aggregation failed:', error);
      }
    });

    // Cleanup job - daily at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      try {
        await this.traceRepository.cleanupOldTraces();
        await this.cacheManager.cleanup();
        this.logger.info('Scheduled cleanup completed');
      } catch (error) {
        this.logger.error('Scheduled cleanup failed:', error);
      }
    });

    this.cronJobs.push(dependencyJob, performanceJob, aggregationJob, cleanupJob);
    this.logger.info('Scheduled tasks setup completed');
  }

  /**
   * Setup Kafka consumers
   */
  private async setupKafkaConsumers(): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    // Subscribe to traces topic
    await this.messageBus.subscribe('traces.spans', async (message: any) => {
      try {
        await this.ingestionQueue.add(message);
      } catch (error) {
        this.logger.error('Failed to process span message:', error);
      }
    });

    // Subscribe to application traces
    await this.messageBus.subscribe('traces.application', async (message: any) => {
      try {
        await this.ingestionQueue.add({
          ...message,
          source: 'application'
        });
      } catch (error) {
        this.logger.error('Failed to process application trace:', error);
      }
    });

    // Subscribe to infrastructure traces
    await this.messageBus.subscribe('traces.infrastructure', async (message: any) => {
      try {
        await this.ingestionQueue.add({
          ...message,
          source: 'infrastructure'
        });
      } catch (error) {
        this.logger.error('Failed to process infrastructure trace:', error);
      }
    });

    this.logger.info('Kafka consumers setup completed');
  }

  /**
   * Setup health checks
   */
  private setupHealthChecks(): void {
    // ClickHouse health check
    this.healthChecker.addCheck('clickhouse', async () => {
      try {
        await this.traceRepository.ping();
        return { status: 'UP' };
      } catch (error) {
        return { status: 'DOWN', error: error.message };
      }
    });

    // Redis health check
    this.healthChecker.addCheck('redis', async () => {
      try {
        await this.redisClient.ping();
        return { status: 'UP' };
      } catch (error) {
        return { status: 'DOWN', error: error.message };
      }
    });

    // Ingestion queue health check
    this.healthChecker.addCheck('ingestion-queue', async () => {
      const stats = await this.ingestionQueue.getStats();
      return {
        status: stats.waiting < 10000 ? 'UP' : 'DOWN',
        details: stats
      };
    });

    // Jaeger tracer health check
    this.healthChecker.addCheck('tracer', async () => {
      try {
        const span = this.tracer.startSpan('health-check');
        span.finish();
        return { status: 'UP' };
      } catch (error) {
        return { status: 'DOWN', error: error.message };
      }
    });

    this.logger.info('Health checks setup completed');
  }
}