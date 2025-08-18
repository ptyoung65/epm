/**
 * Kafka Service for AIRIS-MON ClickStack Architecture
 * Korean-optimized real-time data streaming service
 */

const { Kafka, logLevel } = require('kafkajs');
const logger = require('../../api-gateway/src/utils/logger');

class KafkaService {
  constructor(config = {}) {
    this.config = {
      brokers: config.brokers || ['localhost:9092'],
      clientId: config.clientId || 'airis-mon-kafka',
      ...config
    };

    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      logLevel: logLevel.WARN,
      connectionTimeout: 10000,
      requestTimeout: 30000
    });

    this.producer = null;
    this.consumers = new Map();
    this.topics = [
      'airis-mon-metrics',
      'airis-mon-logs', 
      'airis-mon-traces',
      'airis-mon-alerts',
      'airis-mon-korean-analytics'
    ];
    
    this.isConnected = false;
    this.metrics = {
      messagesProduced: 0,
      messagesConsumed: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  async start() {
    try {
      logger.info('카프카 서비스 시작 중...', { service: 'kafka' });
      
      await this.initializeProducer();
      await this.createTopics();
      
      this.isConnected = true;
      logger.info('카프카 서비스가 성공적으로 시작되었습니다', { 
        service: 'kafka',
        topics: this.topics.length,
        brokers: this.config.brokers 
      });
      
    } catch (error) {
      this.metrics.errors++;
      logger.error('카프카 서비스 시작 실패', { 
        error: error.message,
        service: 'kafka' 
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('카프카 서비스 종료 중...', { service: 'kafka' });
      
      if (this.producer) {
        await this.producer.disconnect();
      }

      for (const [name, consumer] of this.consumers) {
        await consumer.disconnect();
        logger.debug(`컨슈머 ${name} 연결 해제됨`, { service: 'kafka' });
      }

      this.isConnected = false;
      logger.info('카프카 서비스가 종료되었습니다', { service: 'kafka' });
      
    } catch (error) {
      this.metrics.errors++;
      logger.error('카프카 서비스 종료 중 오류 발생', { 
        error: error.message,
        service: 'kafka' 
      });
    }
  }

  async initializeProducer() {
    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    await this.producer.connect();
    logger.info('카프카 프로듀서 연결됨', { service: 'kafka' });
  }

  async createTopics() {
    const admin = this.kafka.admin();
    await admin.connect();

    try {
      const existingTopics = await admin.listTopics();
      const topicsToCreate = this.topics.filter(topic => !existingTopics.includes(topic));

      if (topicsToCreate.length > 0) {
        await admin.createTopics({
          topics: topicsToCreate.map(topic => ({
            topic,
            numPartitions: 3,
            replicationFactor: 1,
            configEntries: [
              { name: 'cleanup.policy', value: 'delete' },
              { name: 'retention.ms', value: '604800000' }, // 7 days
              { name: 'compression.type', value: 'snappy' }
            ]
          }))
        });

        logger.info('새 토픽이 생성되었습니다', { 
          topics: topicsToCreate,
          service: 'kafka' 
        });
      }
    } finally {
      await admin.disconnect();
    }
  }

  /**
   * Send message to topic with Korean timezone and metadata
   */
  async sendMessage(topic, message, options = {}) {
    if (!this.producer) {
      throw new Error('카프카 프로듀서가 초기화되지 않았습니다');
    }

    try {
      const koreanTime = new Date().toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul' 
      });

      const enrichedMessage = {
        ...message,
        korean_timestamp: koreanTime,
        korean_hour: new Date().toLocaleString('en-US', { 
          timeZone: 'Asia/Seoul', 
          hour: '2-digit', 
          hour12: false 
        }),
        korean_day: new Date().toLocaleDateString('ko-KR', { 
          timeZone: 'Asia/Seoul', 
          weekday: 'short' 
        }),
        source_service: 'airis-mon',
        ...options.metadata
      };

      const result = await this.producer.send({
        topic,
        messages: [{
          key: options.key || message.service_name || 'default',
          value: JSON.stringify(enrichedMessage),
          timestamp: Date.now(),
          headers: {
            'content-type': 'application/json',
            'korean-time': koreanTime,
            ...options.headers
          }
        }]
      });

      this.metrics.messagesProduced++;
      logger.debug('메시지 전송 완료', {
        topic,
        partition: result[0].partition,
        offset: result[0].baseOffset,
        service: 'kafka'
      });

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('메시지 전송 실패', {
        topic,
        error: error.message,
        service: 'kafka'
      });
      throw error;
    }
  }

  /**
   * Send batch messages for high-throughput scenarios
   */
  async sendBatch(topic, messages, options = {}) {
    if (!this.producer) {
      throw new Error('카프카 프로듀서가 초기화되지 않았습니다');
    }

    try {
      const koreanTime = new Date().toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul' 
      });

      const kafkaMessages = messages.map((message, index) => ({
        key: options.keyGenerator ? options.keyGenerator(message, index) : 
             message.service_name || `batch-${index}`,
        value: JSON.stringify({
          ...message,
          korean_timestamp: koreanTime,
          batch_id: options.batchId || Date.now(),
          batch_index: index
        }),
        timestamp: Date.now()
      }));

      const result = await this.producer.send({
        topic,
        messages: kafkaMessages
      });

      this.metrics.messagesProduced += messages.length;
      logger.info('배치 메시지 전송 완료', {
        topic,
        messageCount: messages.length,
        service: 'kafka'
      });

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('배치 메시지 전송 실패', {
        topic,
        messageCount: messages.length,
        error: error.message,
        service: 'kafka'
      });
      throw error;
    }
  }

  /**
   * Create consumer with Korean timezone processing
   */
  async createConsumer(consumerConfig = {}) {
    const config = {
      groupId: 'airis-mon-consumer-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      ...consumerConfig
    };

    const consumer = this.kafka.consumer(config);
    const consumerName = config.consumerName || config.groupId;

    await consumer.connect();
    this.consumers.set(consumerName, consumer);

    logger.info('카프카 컨슈머 생성됨', { 
      consumerName,
      groupId: config.groupId,
      service: 'kafka' 
    });

    return {
      consumer,
      subscribe: async (topics) => {
        await consumer.subscribe({ topics });
        logger.info('토픽 구독 완료', { topics, consumerName, service: 'kafka' });
      },
      run: async (handler) => {
        await consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            try {
              const value = JSON.parse(message.value.toString());
              
              // Add Korean timezone processing
              const processedMessage = {
                ...value,
                consumed_at: new Date().toLocaleString('ko-KR', { 
                  timeZone: 'Asia/Seoul' 
                }),
                topic,
                partition,
                offset: message.offset
              };

              await handler(processedMessage);
              this.metrics.messagesConsumed++;

            } catch (error) {
              this.metrics.errors++;
              logger.error('메시지 처리 중 오류 발생', {
                topic,
                partition,
                offset: message.offset,
                error: error.message,
                service: 'kafka'
              });
            }
          }
        });
      }
    };
  }

  /**
   * Send metrics data
   */
  async sendMetric(metricData) {
    return this.sendMessage('airis-mon-metrics', {
      event_type: 'metric',
      ...metricData
    });
  }

  /**
   * Send log data
   */
  async sendLog(logData) {
    return this.sendMessage('airis-mon-logs', {
      event_type: 'log',
      ...logData
    });
  }

  /**
   * Send trace data
   */
  async sendTrace(traceData) {
    return this.sendMessage('airis-mon-traces', {
      event_type: 'trace',
      ...traceData
    });
  }

  /**
   * Send alert data
   */
  async sendAlert(alertData) {
    return this.sendMessage('airis-mon-alerts', {
      event_type: 'alert',
      ...alertData
    });
  }

  /**
   * Send Korean analytics data
   */
  async sendKoreanAnalytics(analyticsData) {
    return this.sendMessage('airis-mon-korean-analytics', {
      event_type: 'korean_analytics',
      ...analyticsData
    });
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          message: '카프카 서비스에 연결되지 않음',
          connected: false
        };
      }

      const admin = this.kafka.admin();
      await admin.connect();
      
      try {
        const metadata = await admin.fetchTopicMetadata({ topics: this.topics });
        await admin.disconnect();

        return {
          status: 'healthy',
          connected: true,
          topics: this.topics.length,
          brokers: this.config.brokers,
          metrics: this.getMetrics(),
          uptime: Date.now() - this.metrics.startTime
        };

      } catch (error) {
        await admin.disconnect();
        throw error;
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      connected_consumers: this.consumers.size,
      topics_count: this.topics.length
    };
  }

  /**
   * Korean business hours message routing
   */
  async routeByBusinessHours(message) {
    const now = new Date();
    const koreanHour = new Date(now.toLocaleString('en-US', { 
      timeZone: 'Asia/Seoul' 
    })).getHours();
    const koreanDay = new Date(now.toLocaleString('en-US', { 
      timeZone: 'Asia/Seoul' 
    })).getDay();

    const isBusinessHours = koreanDay >= 1 && koreanDay <= 5 && 
                           koreanHour >= 9 && koreanHour <= 18;

    const routingKey = isBusinessHours ? 'business-hours' : 'after-hours';
    
    return this.sendMessage('airis-mon-korean-analytics', {
      ...message,
      routing_key: routingKey,
      korean_business_hours: isBusinessHours,
      korean_time_category: this.getKoreanTimeCategory(koreanHour, koreanDay)
    });
  }

  /**
   * Get Korean time category
   */
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
}

module.exports = KafkaService;