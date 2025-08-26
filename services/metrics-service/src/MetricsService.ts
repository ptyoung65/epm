import { MicroserviceBase, MicroserviceConfig } from '@airis-epm/shared/base/MicroserviceBase';
import { MetricsController } from './controllers/MetricsController';
import { AggregationController } from './controllers/AggregationController';
import { QueryController } from './controllers/QueryController';
import { ClickHouseRepository } from './repositories/ClickHouseRepository';
import { MetricsProcessor } from './processors/MetricsProcessor';
import { AggregationEngine } from './engines/AggregationEngine';
import { MetricsCacheManager } from './cache/MetricsCacheManager';
import { MetricsIngestionQueue } from './queues/MetricsIngestionQueue';
import * as cron from 'node-cron';
import Redis from 'ioredis';

export class MetricsService extends MicroserviceBase {
  private clickHouseRepo!: ClickHouseRepository;
  private metricsProcessor!: MetricsProcessor;
  private aggregationEngine!: AggregationEngine;
  private cacheManager!: MetricsCacheManager;
  private ingestionQueue!: MetricsIngestionQueue;
  private redisClient!: Redis;
  private cronJobs: cron.ScheduledTask[] = [];

  constructor() {
    const config: MicroserviceConfig = {
      serviceName: 'metrics-service',
      serviceVersion: '1.0.0',
      port: parseInt(process.env.PORT || '8001'),
      environment: (process.env.NODE_ENV as any) || 'development',
      consul: {
        host: process.env.CONSUL_HOST || 'localhost',
        port: parseInt(process.env.CONSUL_PORT || '8500')
      },
      kafka: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientId: 'metrics-service'
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      jaeger: {
        serviceName: 'metrics-service',
        agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
        agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6831')
      },
      rateLimiting: {
        windowMs: 60000,
        max: 1000
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

    // Initialize repositories
    this.clickHouseRepo = new ClickHouseRepository({
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
      database: process.env.CLICKHOUSE_DATABASE || 'metrics',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || ''
    });

    await this.clickHouseRepo.initialize();

    // Initialize cache manager
    this.cacheManager = new MetricsCacheManager(this.redisClient);

    // Initialize processors
    this.metricsProcessor = new MetricsProcessor(
      this.clickHouseRepo,
      this.cacheManager
    );

    // Initialize aggregation engine
    this.aggregationEngine = new AggregationEngine(
      this.clickHouseRepo,
      this.cacheManager
    );

    // Initialize ingestion queue
    this.ingestionQueue = new MetricsIngestionQueue(
      this.redisClient,
      this.metricsProcessor
    );

    await this.ingestionQueue.initialize();

    // Setup scheduled tasks
    this.setupScheduledTasks();

    // Setup Kafka consumers
    await this.setupKafkaConsumers();

    // Add health checks
    this.setupHealthChecks();

    this.logger.info('Metrics Service initialized successfully');
  }

  /**
   * Register API routes
   */
  protected registerRoutes(): void {
    const metricsController = new MetricsController(
      this.metricsProcessor,
      this.ingestionQueue
    );

    const aggregationController = new AggregationController(
      this.aggregationEngine
    );

    const queryController = new QueryController(
      this.clickHouseRepo,
      this.cacheManager
    );

    // Metrics ingestion endpoints
    this.app.post('/api/v1/metrics', metricsController.ingestMetric.bind(metricsController));
    this.app.post('/api/v1/metrics/batch', metricsController.ingestBatch.bind(metricsController));
    
    // Query endpoints
    this.app.get('/api/v1/metrics/query', queryController.queryMetrics.bind(queryController));
    this.app.get('/api/v1/metrics/series', queryController.getTimeSeries.bind(queryController));
    this.app.get('/api/v1/metrics/labels', queryController.getLabels.bind(queryController));
    this.app.get('/api/v1/metrics/values', queryController.getLabelValues.bind(queryController));
    
    // Aggregation endpoints
    this.app.get('/api/v1/metrics/aggregate', aggregationController.aggregate.bind(aggregationController));
    this.app.get('/api/v1/metrics/histogram', aggregationController.histogram.bind(aggregationController));
    this.app.get('/api/v1/metrics/heatmap', aggregationController.heatmap.bind(aggregationController));
    
    // Management endpoints
    this.app.post('/api/v1/metrics/retention', metricsController.setRetentionPolicy.bind(metricsController));
    this.app.delete('/api/v1/metrics/purge', metricsController.purgeOldData.bind(metricsController));
    
    // Export endpoints
    this.app.get('/api/v1/metrics/export', queryController.exportMetrics.bind(queryController));

    this.logger.info('Routes registered successfully');
  }

  /**
   * Setup scheduled tasks
   */
  private setupScheduledTasks(): void {
    // Aggregation job - every 5 minutes
    const aggregationJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.aggregationEngine.runScheduledAggregations();
        this.logger.info('Scheduled aggregations completed');
      } catch (error) {
        this.logger.error('Scheduled aggregation failed:', error);
      }
    });

    // Cleanup job - daily at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      try {
        await this.clickHouseRepo.cleanupOldData();
        await this.cacheManager.cleanup();
        this.logger.info('Scheduled cleanup completed');
      } catch (error) {
        this.logger.error('Scheduled cleanup failed:', error);
      }
    });

    // Cache warmup job - every hour
    const cacheWarmupJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.cacheManager.warmupCache();
        this.logger.info('Cache warmup completed');
      } catch (error) {
        this.logger.error('Cache warmup failed:', error);
      }
    });

    this.cronJobs.push(aggregationJob, cleanupJob, cacheWarmupJob);
    this.logger.info('Scheduled tasks setup completed');
  }

  /**
   * Setup Kafka consumers
   */
  private async setupKafkaConsumers(): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    // Subscribe to metrics topic
    await this.messageBus.subscribe('metrics.raw', async (message: any) => {
      try {
        await this.ingestionQueue.add(message);
      } catch (error) {
        this.logger.error('Failed to process Kafka message:', error);
      }
    });

    // Subscribe to aggregation requests
    await this.messageBus.subscribe('metrics.aggregate.request', async (message: any) => {
      try {
        const result = await this.aggregationEngine.processAggregationRequest(message);
        await this.messageBus.publish('metrics.aggregate.response', result);
      } catch (error) {
        this.logger.error('Failed to process aggregation request:', error);
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
        await this.clickHouseRepo.ping();
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

    // Queue health check
    this.healthChecker.addCheck('ingestion-queue', async () => {
      const stats = await this.ingestionQueue.getStats();
      return {
        status: stats.waiting < 10000 ? 'UP' : 'DOWN',
        details: stats
      };
    });

    this.logger.info('Health checks setup completed');
  }
}