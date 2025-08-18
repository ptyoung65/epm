/**
 * Data Ingestion Service for AIRIS-MON ClickStack Architecture
 * Korean-optimized unified data ingestion with wide events model
 */

const EventEmitter = require('events');
const logger = require('./utils/logger');

class DataIngestionService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      batchSize: config.batchSize || 1000,
      flushInterval: config.flushInterval || 5000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    };

    this.clickhouseService = null;
    this.kafkaService = null;
    this.redisService = null;
    
    this.batches = {
      metrics: [],
      logs: [],
      traces: [],
      alerts: []
    };
    
    this.metrics = {
      totalIngested: 0,
      totalBatches: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.flushTimers = new Map();
    this.isRunning = false;
  }

  /**
   * Initialize with required services
   */
  async initialize(services) {
    this.clickhouseService = services.clickhouse;
    this.kafkaService = services.kafka;
    this.redisService = services.redis;

    if (!this.clickhouseService) {
      throw new Error('ClickHouse 서비스가 필요합니다');
    }

    logger.info('데이터 수집 서비스 초기화됨', {
      service: 'data-ingestion',
      clickhouse: !!this.clickhouseService,
      kafka: !!this.kafkaService,
      redis: !!this.redisService
    });
  }

  async start() {
    try {
      logger.info('데이터 수집 서비스 시작 중...', { service: 'data-ingestion' });
      
      this.isRunning = true;
      this.setupFlushTimers();
      
      // Setup Kafka consumers if available
      if (this.kafkaService) {
        await this.setupKafkaConsumers();
      }

      logger.info('데이터 수집 서비스가 시작되었습니다', { 
        service: 'data-ingestion',
        batchSize: this.config.batchSize,
        flushInterval: this.config.flushInterval
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('데이터 수집 서비스 시작 실패', {
        error: error.message,
        service: 'data-ingestion'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('데이터 수집 서비스 종료 중...', { service: 'data-ingestion' });
      
      this.isRunning = false;
      this.clearFlushTimers();
      
      // Flush any remaining data
      await this.flushAllBatches();

      logger.info('데이터 수집 서비스가 종료되었습니다', { service: 'data-ingestion' });

    } catch (error) {
      this.metrics.errors++;
      logger.error('데이터 수집 서비스 종료 중 오류', {
        error: error.message,
        service: 'data-ingestion'
      });
    }
  }

  /**
   * Setup periodic flush timers
   */
  setupFlushTimers() {
    Object.keys(this.batches).forEach(eventType => {
      const timer = setInterval(async () => {
        await this.flushBatch(eventType);
      }, this.config.flushInterval);
      
      this.flushTimers.set(eventType, timer);
    });
  }

  /**
   * Clear flush timers
   */
  clearFlushTimers() {
    this.flushTimers.forEach(timer => clearInterval(timer));
    this.flushTimers.clear();
  }

  /**
   * Setup Kafka consumers for real-time ingestion
   */
  async setupKafkaConsumers() {
    const consumerTypes = [
      { topic: 'airis-mon-metrics', handler: this.handleMetricMessage.bind(this) },
      { topic: 'airis-mon-logs', handler: this.handleLogMessage.bind(this) },
      { topic: 'airis-mon-traces', handler: this.handleTraceMessage.bind(this) },
      { topic: 'airis-mon-alerts', handler: this.handleAlertMessage.bind(this) }
    ];

    for (const { topic, handler } of consumerTypes) {
      const consumer = await this.kafkaService.createConsumer({
        groupId: `airis-mon-ingestion-${topic}`,
        consumerName: `ingestion-${topic}`
      });

      await consumer.subscribe([topic]);
      await consumer.run(handler);

      logger.info(`Kafka 컨슈머 설정 완료: ${topic}`, { service: 'data-ingestion' });
    }
  }

  /**
   * Ingest wide event (unified data model)
   */
  async ingestWideEvent(event) {
    if (!this.isRunning) {
      logger.warn('데이터 수집 서비스가 실행 중이 아닙니다', { service: 'data-ingestion' });
      return;
    }

    try {
      // Enrich event with Korean timezone information
      const enrichedEvent = this.enrichWithKoreanContext(event);
      
      // Validate event structure
      const validatedEvent = this.validateEvent(enrichedEvent);
      
      // Add to appropriate batch
      const eventType = this.getEventType(validatedEvent);
      this.addToBatch(eventType, validatedEvent);
      
      // Emit event for real-time processing
      this.emit('event-ingested', validatedEvent);
      
      this.metrics.totalIngested++;

    } catch (error) {
      this.metrics.errors++;
      logger.error('Wide event 수집 실패', {
        error: error.message,
        event_type: event?.event_type,
        service: 'data-ingestion'
      });
    }
  }

  /**
   * Enrich event with Korean timezone context
   */
  enrichWithKoreanContext(event) {
    const now = new Date();
    const koreanTime = new Date(now.toLocaleString('en-US', { 
      timeZone: 'Asia/Seoul' 
    }));

    const koreanHour = koreanTime.getHours();
    const koreanDay = koreanTime.getDay();
    const koreanDayName = ['일', '월', '화', '수', '목', '금', '토'][koreanDay];

    return {
      ...event,
      timestamp: event.timestamp || now.toISOString(),
      korean_timestamp: koreanTime.toLocaleString('ko-KR'),
      korean_hour: koreanHour,
      korean_day_of_week: koreanDayName,
      korean_business_hours: this.isKoreanBusinessHours(koreanHour, koreanDay),
      time_category: this.getKoreanTimeCategory(koreanHour, koreanDay),
      ingested_at: now.toISOString(),
      ingestion_source: 'data-ingestion-service'
    };
  }

  /**
   * Validate event structure
   */
  validateEvent(event) {
    // Required fields for wide events
    const requiredFields = ['event_type', 'service_name', 'timestamp'];
    
    for (const field of requiredFields) {
      if (!event[field]) {
        throw new Error(`필수 필드 누락: ${field}`);
      }
    }

    // Validate event type
    const validEventTypes = ['metric', 'log', 'trace', 'alert'];
    if (!validEventTypes.includes(event.event_type)) {
      throw new Error(`유효하지 않은 이벤트 타입: ${event.event_type}`);
    }

    // Type-specific validation
    switch (event.event_type) {
      case 'metric':
        if (typeof event.metric_value !== 'number') {
          throw new Error('메트릭 값은 숫자여야 합니다');
        }
        break;
        
      case 'log':
        if (!event.log_level || !event.log_message) {
          throw new Error('로그는 레벨과 메시지가 필요합니다');
        }
        break;
        
      case 'trace':
        if (!event.trace_id || typeof event.span_duration !== 'number') {
          throw new Error('트레이스는 ID와 지속시간이 필요합니다');
        }
        break;
        
      case 'alert':
        if (!event.alert_severity || !event.alert_status) {
          throw new Error('알림은 심각도와 상태가 필요합니다');
        }
        break;
    }

    return event;
  }

  /**
   * Get event type for batching
   */
  getEventType(event) {
    return event.event_type;
  }

  /**
   * Add event to batch
   */
  addToBatch(eventType, event) {
    if (!this.batches[eventType]) {
      this.batches[eventType] = [];
    }

    this.batches[eventType].push(event);

    // Check if batch is full
    if (this.batches[eventType].length >= this.config.batchSize) {
      setImmediate(() => this.flushBatch(eventType));
    }
  }

  /**
   * Flush specific batch to ClickHouse
   */
  async flushBatch(eventType) {
    const batch = this.batches[eventType];
    
    if (!batch || batch.length === 0) {
      return;
    }

    // Move batch to processing
    this.batches[eventType] = [];
    
    let retries = 0;
    const maxRetries = this.config.maxRetries;

    while (retries <= maxRetries) {
      try {
        // Insert batch to ClickHouse
        await this.clickhouseService.insertWideEvents(batch);
        
        this.metrics.totalBatches++;
        
        logger.info(`배치 처리 완료: ${eventType}`, {
          batch_size: batch.length,
          event_type: eventType,
          service: 'data-ingestion'
        });

        // Cache frequently accessed data
        if (this.redisService && this.shouldCacheData(eventType, batch)) {
          await this.cacheRecentData(eventType, batch);
        }

        // Success - break retry loop
        break;

      } catch (error) {
        retries++;
        this.metrics.errors++;

        logger.error(`배치 처리 실패: ${eventType} (재시도 ${retries}/${maxRetries})`, {
          batch_size: batch.length,
          error: error.message,
          service: 'data-ingestion'
        });

        if (retries > maxRetries) {
          // Send to dead letter queue or alert
          await this.handleFailedBatch(eventType, batch, error);
          break;
        }

        // Wait before retry with exponential backoff
        await this.sleep(this.config.retryDelay * Math.pow(2, retries - 1));
      }
    }
  }

  /**
   * Flush all batches
   */
  async flushAllBatches() {
    const flushPromises = Object.keys(this.batches).map(eventType => 
      this.flushBatch(eventType)
    );
    
    await Promise.all(flushPromises);
    logger.info('모든 배치가 플러시되었습니다', { service: 'data-ingestion' });
  }

  /**
   * Handle failed batch
   */
  async handleFailedBatch(eventType, batch, error) {
    logger.error(`배치 처리 완전 실패: ${eventType}`, {
      batch_size: batch.length,
      error: error.message,
      service: 'data-ingestion'
    });

    // Try to save to Redis as backup
    if (this.redisService) {
      try {
        const backupKey = `failed-batch:${eventType}:${Date.now()}`;
        await this.redisService.set(backupKey, batch, 86400); // 24 hours
        logger.info('실패한 배치를 Redis에 백업했습니다', {
          backup_key: backupKey,
          service: 'data-ingestion'
        });
      } catch (backupError) {
        logger.error('배치 백업 실패', {
          error: backupError.message,
          service: 'data-ingestion'
        });
      }
    }

    // Emit alert for monitoring
    this.emit('batch-failed', {
      event_type: eventType,
      batch_size: batch.length,
      error: error.message,
      korean_timestamp: new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul'
      })
    });
  }

  /**
   * Determine if data should be cached
   */
  shouldCacheData(eventType, batch) {
    // Cache metrics and alerts for dashboard
    if (eventType === 'metric' || eventType === 'alert') {
      return true;
    }
    
    // Cache critical logs
    if (eventType === 'log') {
      return batch.some(event => 
        event.log_level === 'ERROR' || 
        event.log_level === 'CRITICAL'
      );
    }
    
    return false;
  }

  /**
   * Cache recent data for dashboard
   */
  async cacheRecentData(eventType, batch) {
    try {
      const cacheKey = `recent-${eventType}-${Date.now()}`;
      const recentData = batch.slice(-100); // Last 100 events
      
      await this.redisService.set(cacheKey, recentData, 300); // 5 minutes
      
      logger.debug(`최근 데이터 캐시됨: ${eventType}`, {
        cache_key: cacheKey,
        events_count: recentData.length,
        service: 'data-ingestion'
      });

    } catch (error) {
      logger.error('데이터 캐싱 실패', {
        event_type: eventType,
        error: error.message,
        service: 'data-ingestion'
      });
    }
  }

  /**
   * Korean timezone helpers
   */
  isKoreanBusinessHours(hour, dayOfWeek) {
    return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour <= 18;
  }

  getKoreanTimeCategory(hour, dayOfWeek) {
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'weekend';
    } else if (hour >= 9 && hour <= 18) {
      return 'business_hours';
    } else if (hour >= 19 && hour <= 22) {
      return 'evening';
    } else {
      return 'night';
    }
  }

  /**
   * Kafka message handlers
   */
  async handleMetricMessage(message) {
    await this.ingestWideEvent({
      event_type: 'metric',
      ...message
    });
  }

  async handleLogMessage(message) {
    await this.ingestWideEvent({
      event_type: 'log',
      ...message
    });
  }

  async handleTraceMessage(message) {
    await this.ingestWideEvent({
      event_type: 'trace',
      ...message
    });
  }

  async handleAlertMessage(message) {
    await this.ingestWideEvent({
      event_type: 'alert',
      ...message
    });
  }

  /**
   * Convenience methods for different event types
   */
  async ingestMetric(serviceName, metricName, value, unit = null, tags = {}) {
    return this.ingestWideEvent({
      event_type: 'metric',
      service_name: serviceName,
      metric_name: metricName,
      metric_value: value,
      metric_unit: unit,
      metric_tags: tags
    });
  }

  async ingestLog(serviceName, level, message, context = {}) {
    return this.ingestWideEvent({
      event_type: 'log',
      service_name: serviceName,
      log_level: level,
      log_message: message,
      log_context: context
    });
  }

  async ingestTrace(serviceName, operationName, duration, status, traceId, spanId) {
    return this.ingestWideEvent({
      event_type: 'trace',
      service_name: serviceName,
      trace_operation: operationName,
      span_duration: duration,
      trace_status: status,
      trace_id: traceId,
      span_id: spanId
    });
  }

  async ingestAlert(serviceName, alertName, severity, status, message) {
    return this.ingestWideEvent({
      event_type: 'alert',
      service_name: serviceName,
      alert_name: alertName,
      alert_severity: severity,
      alert_status: status,
      alert_message: message
    });
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const health = {
        status: this.isRunning ? 'healthy' : 'stopped',
        running: this.isRunning,
        metrics: this.getMetrics(),
        batches: this.getBatchStats(),
        services: {
          clickhouse: !!this.clickhouseService,
          kafka: !!this.kafkaService,
          redis: !!this.redisService
        }
      };

      return health;

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        error: error.message
      };
    }
  }

  /**
   * Get batch statistics
   */
  getBatchStats() {
    const stats = {};
    
    Object.keys(this.batches).forEach(eventType => {
      stats[eventType] = {
        pending: this.batches[eventType].length,
        ready_to_flush: this.batches[eventType].length >= this.config.batchSize
      };
    });

    return stats;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      ingestion_rate: this.metrics.totalIngested / 
                     ((Date.now() - this.metrics.startTime) / 1000) || 0,
      batch_rate: this.metrics.totalBatches / 
                 ((Date.now() - this.metrics.startTime) / 1000) || 0
    };
  }

  /**
   * Utility method for sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DataIngestionService;