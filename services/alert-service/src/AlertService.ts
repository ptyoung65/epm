import { MicroserviceBase, MicroserviceConfig } from '@airis-epm/shared/base/MicroserviceBase';
import { AlertController } from './controllers/AlertController';
import { NotificationController } from './controllers/NotificationController';
import { RuleController } from './controllers/RuleController';
import { AlertRepository } from './repositories/AlertRepository';
import { AlertProcessor } from './processors/AlertProcessor';
import { RuleEngine } from './engines/RuleEngine';
import { NotificationManager } from './managers/NotificationManager';
import { AlertCacheManager } from './cache/AlertCacheManager';
import { AlertQueue } from './queues/AlertQueue';
import { EscalationManager } from './managers/EscalationManager';
import { CorrelationEngine } from './engines/CorrelationEngine';
import * as cron from 'node-cron';
import Redis from 'ioredis';

export class AlertService extends MicroserviceBase {
  private alertRepository!: AlertRepository;
  private alertProcessor!: AlertProcessor;
  private ruleEngine!: RuleEngine;
  private notificationManager!: NotificationManager;
  private cacheManager!: AlertCacheManager;
  private alertQueue!: AlertQueue;
  private escalationManager!: EscalationManager;
  private correlationEngine!: CorrelationEngine;
  private redisClient!: Redis;
  private cronJobs: cron.ScheduledTask[] = [];

  constructor() {
    const config: MicroserviceConfig = {
      serviceName: 'alert-service',
      serviceVersion: '1.0.0',
      port: parseInt(process.env.PORT || '8004'),
      environment: (process.env.NODE_ENV as any) || 'development',
      consul: {
        host: process.env.CONSUL_HOST || 'localhost',
        port: parseInt(process.env.CONSUL_PORT || '8500')
      },
      kafka: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientId: 'alert-service'
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      jaeger: {
        serviceName: 'alert-service',
        agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
        agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6831')
      },
      rateLimiting: {
        windowMs: 60000,
        max: 10000 // High limit for alert processing
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

    // Initialize alert repository (ClickHouse)
    this.alertRepository = new AlertRepository({
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: parseInt(process.env.CLICKHOUSE_PORT || '9000'),
      database: process.env.CLICKHOUSE_DATABASE || 'alerts',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || ''
    });

    await this.alertRepository.initialize();

    // Initialize cache manager
    this.cacheManager = new AlertCacheManager(this.redisClient);

    // Initialize rule engine
    this.ruleEngine = new RuleEngine(
      this.alertRepository,
      this.cacheManager
    );

    // Initialize notification manager
    this.notificationManager = new NotificationManager({
      email: {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      slack: {
        token: process.env.SLACK_BOT_TOKEN
      },
      webhook: {
        timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '5000')
      },
      sms: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER
      },
      pagerduty: {
        apiToken: process.env.PAGERDUTY_API_TOKEN
      }
    });

    // Initialize escalation manager
    this.escalationManager = new EscalationManager(
      this.alertRepository,
      this.notificationManager,
      this.cacheManager
    );

    // Initialize correlation engine
    this.correlationEngine = new CorrelationEngine(
      this.alertRepository,
      this.cacheManager
    );

    // Initialize alert processor
    this.alertProcessor = new AlertProcessor(
      this.alertRepository,
      this.ruleEngine,
      this.notificationManager,
      this.correlationEngine,
      this.cacheManager
    );

    // Initialize alert queue
    this.alertQueue = new AlertQueue(
      this.redisClient,
      this.alertProcessor
    );

    await this.alertQueue.initialize();

    // Setup scheduled tasks
    this.setupScheduledTasks();

    // Setup Kafka consumers
    await this.setupKafkaConsumers();

    // Setup health checks
    this.setupHealthChecks();

    this.logger.info('Alert Service initialized successfully');
  }

  /**
   * Register API routes
   */
  protected registerRoutes(): void {
    const alertController = new AlertController(
      this.alertProcessor,
      this.alertQueue,
      this.escalationManager
    );

    const notificationController = new NotificationController(
      this.notificationManager,
      this.cacheManager
    );

    const ruleController = new RuleController(
      this.ruleEngine,
      this.cacheManager
    );

    // Alert endpoints
    this.app.post('/api/v1/alerts', alertController.createAlert.bind(alertController));
    this.app.post('/api/v1/alerts/batch', alertController.createBatch.bind(alertController));
    this.app.get('/api/v1/alerts', alertController.getAlerts.bind(alertController));
    this.app.get('/api/v1/alerts/:alertId', alertController.getAlert.bind(alertController));
    this.app.put('/api/v1/alerts/:alertId/status', alertController.updateStatus.bind(alertController));
    this.app.post('/api/v1/alerts/:alertId/acknowledge', alertController.acknowledgeAlert.bind(alertController));
    this.app.post('/api/v1/alerts/:alertId/resolve', alertController.resolveAlert.bind(alertController));
    this.app.post('/api/v1/alerts/:alertId/escalate', alertController.escalateAlert.bind(alertController));
    
    // Alert statistics
    this.app.get('/api/v1/alerts/stats/summary', alertController.getAlertSummary.bind(alertController));
    this.app.get('/api/v1/alerts/stats/trends', alertController.getAlertTrends.bind(alertController));
    this.app.get('/api/v1/alerts/stats/top-services', alertController.getTopServices.bind(alertController));
    
    // Notification endpoints
    this.app.post('/api/v1/notifications/test', notificationController.testNotification.bind(notificationController));
    this.app.get('/api/v1/notifications/channels', notificationController.getChannels.bind(notificationController));
    this.app.post('/api/v1/notifications/channels', notificationController.createChannel.bind(notificationController));
    this.app.put('/api/v1/notifications/channels/:channelId', notificationController.updateChannel.bind(notificationController));
    this.app.delete('/api/v1/notifications/channels/:channelId', notificationController.deleteChannel.bind(notificationController));
    
    // Rule endpoints
    this.app.get('/api/v1/rules', ruleController.getRules.bind(ruleController));
    this.app.post('/api/v1/rules', ruleController.createRule.bind(ruleController));
    this.app.get('/api/v1/rules/:ruleId', ruleController.getRule.bind(ruleController));
    this.app.put('/api/v1/rules/:ruleId', ruleController.updateRule.bind(ruleController));
    this.app.delete('/api/v1/rules/:ruleId', ruleController.deleteRule.bind(ruleController));
    this.app.post('/api/v1/rules/:ruleId/test', ruleController.testRule.bind(ruleController));
    this.app.post('/api/v1/rules/validate', ruleController.validateRule.bind(ruleController));
    
    // Escalation endpoints
    this.app.get('/api/v1/escalations', alertController.getEscalations.bind(alertController));
    this.app.post('/api/v1/escalations', alertController.createEscalation.bind(alertController));
    this.app.put('/api/v1/escalations/:escalationId', alertController.updateEscalation.bind(alertController));
    
    // Correlation endpoints
    this.app.get('/api/v1/alerts/correlations', alertController.getCorrelations.bind(alertController));
    this.app.post('/api/v1/alerts/correlations/analyze', alertController.analyzeCorrelations.bind(alertController));
    
    // Management endpoints
    this.app.post('/api/v1/alerts/maintenance', alertController.setMaintenanceMode.bind(alertController));
    this.app.delete('/api/v1/alerts/cleanup', alertController.cleanupOldAlerts.bind(alertController));
    this.app.post('/api/v1/alerts/bulk-action', alertController.bulkAction.bind(alertController));

    this.logger.info('Routes registered successfully');
  }

  /**
   * Setup scheduled tasks
   */
  private setupScheduledTasks(): void {
    // Escalation processing job - every minute
    const escalationJob = cron.schedule('* * * * *', async () => {
      try {
        await this.escalationManager.processEscalations();
        this.logger.debug('Escalation processing completed');
      } catch (error) {
        this.logger.error('Escalation processing failed:', error);
      }
    });

    // Correlation analysis job - every 5 minutes
    const correlationJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.correlationEngine.analyzeCorrelations();
        this.logger.info('Correlation analysis completed');
      } catch (error) {
        this.logger.error('Correlation analysis failed:', error);
      }
    });

    // Alert cleanup job - daily at 1 AM
    const cleanupJob = cron.schedule('0 1 * * *', async () => {
      try {
        await this.alertRepository.cleanupOldAlerts();
        await this.cacheManager.cleanup();
        this.logger.info('Alert cleanup completed');
      } catch (error) {
        this.logger.error('Alert cleanup failed:', error);
      }
    });

    // Statistics aggregation job - every hour
    const statsJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.alertProcessor.aggregateStatistics();
        this.logger.info('Statistics aggregation completed');
      } catch (error) {
        this.logger.error('Statistics aggregation failed:', error);
      }
    });

    // Rule evaluation job - every 30 seconds
    const ruleEvaluationJob = cron.schedule('*/30 * * * * *', async () => {
      try {
        await this.ruleEngine.evaluateRules();
        this.logger.debug('Rule evaluation completed');
      } catch (error) {
        this.logger.error('Rule evaluation failed:', error);
      }
    });

    this.cronJobs.push(escalationJob, correlationJob, cleanupJob, statsJob, ruleEvaluationJob);
    this.logger.info('Scheduled tasks setup completed');
  }

  /**
   * Setup Kafka consumers
   */
  private async setupKafkaConsumers(): Promise<void> {
    if (!this.messageBus) {
      return;
    }

    // Subscribe to metric alerts
    await this.messageBus.subscribe('alerts.metrics', async (message: any) => {
      try {
        await this.alertQueue.add({
          ...message,
          source: 'metrics',
          type: 'metric_alert'
        });
      } catch (error) {
        this.logger.error('Failed to process metric alert:', error);
      }
    });

    // Subscribe to log alerts
    await this.messageBus.subscribe('alerts.logs', async (message: any) => {
      try {
        await this.alertQueue.add({
          ...message,
          source: 'logs',
          type: 'log_alert'
        });
      } catch (error) {
        this.logger.error('Failed to process log alert:', error);
      }
    });

    // Subscribe to trace alerts
    await this.messageBus.subscribe('alerts.traces', async (message: any) => {
      try {
        await this.alertQueue.add({
          ...message,
          source: 'traces',
          type: 'trace_alert'
        });
      } catch (error) {
        this.logger.error('Failed to process trace alert:', error);
      }
    });

    // Subscribe to system alerts
    await this.messageBus.subscribe('alerts.system', async (message: any) => {
      try {
        await this.alertQueue.add({
          ...message,
          source: 'system',
          type: 'system_alert',
          priority: 'high'
        });
      } catch (error) {
        this.logger.error('Failed to process system alert:', error);
      }
    });

    // Subscribe to external alerts (webhooks)
    await this.messageBus.subscribe('alerts.external', async (message: any) => {
      try {
        await this.alertQueue.add({
          ...message,
          source: 'external',
          type: 'webhook_alert'
        });
      } catch (error) {
        this.logger.error('Failed to process external alert:', error);
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
        await this.alertRepository.ping();
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

    // Alert queue health check
    this.healthChecker.addCheck('alert-queue', async () => {
      const stats = await this.alertQueue.getStats();
      return {
        status: stats.waiting < 1000 ? 'UP' : 'DOWN',
        details: stats
      };
    });

    // Notification channels health check
    this.healthChecker.addCheck('notification-channels', async () => {
      try {
        const channelStatus = await this.notificationManager.checkChannelHealth();
        const unhealthy = Object.values(channelStatus).filter(status => status !== 'UP').length;
        return {
          status: unhealthy === 0 ? 'UP' : 'PARTIAL',
          details: channelStatus
        };
      } catch (error) {
        return { status: 'DOWN', error: error.message };
      }
    });

    // Rule engine health check
    this.healthChecker.addCheck('rule-engine', async () => {
      try {
        const ruleCount = await this.ruleEngine.getActiveRuleCount();
        return {
          status: 'UP',
          details: { activeRules: ruleCount }
        };
      } catch (error) {
        return { status: 'DOWN', error: error.message };
      }
    });

    this.logger.info('Health checks setup completed');
  }
}