import { MicroserviceBase, MicroserviceConfig } from '@airis-epm/shared/base/MicroserviceBase';
import { LogController } from './controllers/LogController';
import { SearchController } from './controllers/SearchController';
import { StreamController } from './controllers/StreamController';
import { ElasticsearchRepository } from './repositories/ElasticsearchRepository';
import { LogProcessor } from './processors/LogProcessor';
import { LogParser } from './parsers/LogParser';
import { LogCacheManager } from './cache/LogCacheManager';
import { LogIngestionQueue } from './queues/LogIngestionQueue';
import { AlertingEngine } from './engines/AlertingEngine';
import * as cron from 'node-cron';
import Redis from 'ioredis';

export class LogService extends MicroserviceBase {
  private elasticsearchRepo!: ElasticsearchRepository;
  private logProcessor!: LogProcessor;
  private logParser!: LogParser;
  private cacheManager!: LogCacheManager;
  private ingestionQueue!: LogIngestionQueue;
  private alertingEngine!: AlertingEngine;
  private redisClient!: Redis;
  private cronJobs: cron.ScheduledTask[] = [];

  constructor() {
    const config: MicroserviceConfig = {
      serviceName: 'log-service',
      serviceVersion: '1.0.0',
      port: parseInt(process.env.PORT || '8002'),
      environment: (process.env.NODE_ENV as any) || 'development',
      consul: {
        host: process.env.CONSUL_HOST || 'localhost',
        port: parseInt(process.env.CONSUL_PORT || '8500')
      },
      kafka: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientId: 'log-service'
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      jaeger: {
        serviceName: 'log-service',
        agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
        agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6831')
      },
      rateLimiting: {
        windowMs: 60000,
        max: 2000 // Higher limit for log ingestion
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

    // Initialize Elasticsearch repository
    this.elasticsearchRepo = new ElasticsearchRepository({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD,
      indexPrefix: process.env.ELASTICSEARCH_INDEX_PREFIX || 'airis-logs'
    });

    await this.elasticsearchRepo.initialize();

    // Initialize cache manager
    this.cacheManager = new LogCacheManager(this.redisClient);

    // Initialize log parser with Grok patterns
    this.logParser = new LogParser();

    // Initialize log processor
    this.logProcessor = new LogProcessor(
      this.elasticsearchRepo,
      this.cacheManager,
      this.logParser
    );

    // Initialize alerting engine
    this.alertingEngine = new AlertingEngine(
      this.logProcessor,
      this.cacheManager
    );

    // Initialize ingestion queue
    this.ingestionQueue = new LogIngestionQueue(
      this.redisClient,
      this.logProcessor
    );

    await this.ingestionQueue.initialize();

    // Setup scheduled tasks
    this.setupScheduledTasks();

    // Setup Kafka consumers
    await this.setupKafkaConsumers();

    // Setup health checks
    this.setupHealthChecks();

    this.logger.info('Log Service initialized successfully');
  }

  /**
   * Register API routes
   */
  protected registerRoutes(): void {
    const logController = new LogController(
      this.logProcessor,
      this.ingestionQueue
    );

    const searchController = new SearchController(
      this.elasticsearchRepo,
      this.cacheManager
    );

    const streamController = new StreamController(
      this.elasticsearchRepo,
      this.cacheManager
    );

    // Log ingestion endpoints
    this.app.post('/api/v1/logs', logController.ingestLog.bind(logController));
    this.app.post('/api/v1/logs/batch', logController.ingestBatch.bind(logController));
    this.app.post('/api/v1/logs/structured', logController.ingestStructured.bind(logController));
    
    // Search endpoints
    this.app.get('/api/v1/logs/search', searchController.search.bind(searchController));
    this.app.post('/api/v1/logs/search', searchController.complexSearch.bind(searchController));
    this.app.get('/api/v1/logs/query', searchController.query.bind(searchController));
    this.app.get('/api/v1/logs/fields', searchController.getFields.bind(searchController));
    this.app.get('/api/v1/logs/histogram', searchController.getHistogram.bind(searchController));
    
    // Streaming endpoints
    this.app.get('/api/v1/logs/stream', streamController.streamLogs.bind(streamController));
    this.app.get('/api/v1/logs/tail', streamController.tailLogs.bind(streamController));
    
    // Analysis endpoints
    this.app.get('/api/v1/logs/patterns', searchController.getPatterns.bind(searchController));
    this.app.get('/api/v1/logs/anomalies', searchController.getAnomalies.bind(searchController));
    this.app.get('/api/v1/logs/errors', searchController.getErrors.bind(searchController));
    
    // Management endpoints
    this.app.post('/api/v1/logs/retention', logController.setRetentionPolicy.bind(logController));
    this.app.delete('/api/v1/logs/purge', logController.purgeOldLogs.bind(logController));
    this.app.post('/api/v1/logs/reindex', logController.reindexLogs.bind(logController));
    
    // Export endpoints
    this.app.get('/api/v1/logs/export', searchController.exportLogs.bind(searchController));

    this.logger.info('Routes registered successfully');
  }

  /**
   * Setup scheduled tasks
   */
  private setupScheduledTasks(): void {
    // Index optimization job - every 30 minutes
    const optimizationJob = cron.schedule('*/30 * * * *', async () => {
      try {
        await this.elasticsearchRepo.optimizeIndices();
        this.logger.info('Index optimization completed');
      } catch (error) {
        this.logger.error('Index optimization failed:', error);
      }
    });

    // Cleanup job - daily at 3 AM
    const cleanupJob = cron.schedule('0 3 * * *', async () => {
      try {
        await this.elasticsearchRepo.cleanupOldIndices();
        await this.cacheManager.cleanup();
        this.logger.info('Scheduled cleanup completed');
      } catch (error) {
        this.logger.error('Scheduled cleanup failed:', error);
      }
    });

    // Pattern analysis job - every hour
    const patternAnalysisJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.logProcessor.analyzePatterns();
        this.logger.info('Pattern analysis completed');
      } catch (error) {
        this.logger.error('Pattern analysis failed:', error);
      }
    });

    // Alerting job - every 5 minutes
    const alertingJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.alertingEngine.processAlerts();
        this.logger.info('Alert processing completed');
      } catch (error) {
        this.logger.error('Alert processing failed:', error);
      }
    });

    this.cronJobs.push(optimizationJob, cleanupJob, patternAnalysisJob, alertingJob);
    this.logger.info('Scheduled tasks setup completed');
  }

  /**
   * Setup Kafka consumers
   */
  private async setupKafkaConsumers(): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    // Subscribe to logs topic
    await this.messageBus.subscribe('logs.raw', async (message: any) => {
      try {
        await this.ingestionQueue.add(message);
      } catch (error) {
        this.logger.error('Failed to process Kafka message:', error);
      }
    });

    // Subscribe to application logs
    await this.messageBus.subscribe('logs.application', async (message: any) => {
      try {
        await this.ingestionQueue.add({
          ...message,
          source: 'application',
          type: 'structured'
        });
      } catch (error) {
        this.logger.error('Failed to process application log:', error);
      }
    });

    // Subscribe to system logs
    await this.messageBus.subscribe('logs.system', async (message: any) => {
      try {
        await this.ingestionQueue.add({
          ...message,
          source: 'system',
          type: 'syslog'
        });
      } catch (error) {
        this.logger.error('Failed to process system log:', error);
      }
    });

    // Subscribe to audit logs
    await this.messageBus.subscribe('logs.audit', async (message: any) => {
      try {
        await this.ingestionQueue.add({
          ...message,
          source: 'audit',
          type: 'audit',
          priority: 'high'
        });
      } catch (error) {
        this.logger.error('Failed to process audit log:', error);
      }
    });

    this.logger.info('Kafka consumers setup completed');
  }

  /**
   * Setup health checks
   */
  private setupHealthChecks(): void {
    // Elasticsearch health check
    this.healthChecker.addCheck('elasticsearch', async () => {
      try {
        const health = await this.elasticsearchRepo.getHealth();
        return {
          status: health.status === 'green' || health.status === 'yellow' ? 'UP' : 'DOWN',
          details: health
        };
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
        status: stats.waiting < 50000 ? 'UP' : 'DOWN', // Higher threshold for logs
        details: stats
      };
    });

    // Index health check
    this.healthChecker.addCheck('indices', async () => {
      try {
        const indices = await this.elasticsearchRepo.getIndicesStats();
        const unhealthyIndices = indices.filter(idx => idx.health !== 'green' && idx.health !== 'yellow');
        
        return {
          status: unhealthyIndices.length === 0 ? 'UP' : 'DOWN',
          details: {
            total: indices.length,
            unhealthy: unhealthyIndices.length,
            unhealthyIndices: unhealthyIndices.map(idx => idx.name)
          }
        };
      } catch (error) {
        return { status: 'DOWN', error: error.message };
      }
    });

    this.logger.info('Health checks setup completed');
  }
}