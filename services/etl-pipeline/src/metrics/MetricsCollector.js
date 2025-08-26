const promClient = require('prom-client');

class MetricsCollector {
  constructor({ redis, logger }) {
    this.redis = redis;
    this.logger = logger;
    
    // Initialize Prometheus metrics
    this.metrics = {
      messagesProcessed: new promClient.Counter({
        name: 'etl_messages_processed_total',
        help: 'Total number of messages processed',
        labelNames: ['type', 'status']
      }),
      processingDuration: new promClient.Histogram({
        name: 'etl_processing_duration_seconds',
        help: 'Processing duration in seconds',
        labelNames: ['type'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10]
      }),
      batchSize: new promClient.Gauge({
        name: 'etl_batch_size',
        help: 'Current batch size',
        labelNames: ['type']
      }),
      kafkaLag: new promClient.Gauge({
        name: 'etl_kafka_lag',
        help: 'Kafka consumer lag',
        labelNames: ['topic', 'partition', 'consumer_group']
      }),
      errorRate: new promClient.Gauge({
        name: 'etl_error_rate',
        help: 'Error rate per minute',
        labelNames: ['type']
      }),
      throughput: new promClient.Gauge({
        name: 'etl_throughput_per_second',
        help: 'Messages processed per second',
        labelNames: ['type']
      }),
      storageLatency: new promClient.Histogram({
        name: 'etl_storage_latency_seconds',
        help: 'Storage write latency in seconds',
        labelNames: ['storage_type'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
      }),
      cacheHitRate: new promClient.Gauge({
        name: 'etl_cache_hit_rate',
        help: 'Cache hit rate percentage',
        labelNames: ['cache_type']
      })
    };

    // Register all metrics
    promClient.register.clear();
    Object.values(this.metrics).forEach(metric => {
      promClient.register.registerMetric(metric);
    });
    
    // Collect default metrics
    promClient.collectDefaultMetrics({ prefix: 'etl_' });
    
    this.stats = {
      startTime: Date.now(),
      totalMessages: 0,
      errorCount: 0,
      successCount: 0,
      lastReset: Date.now()
    };
  }

  async initialize() {
    try {
      // Start periodic stats collection
      this.startStatsCollection();
      
      this.logger.info('Metrics Collector initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Metrics Collector:', error);
      throw error;
    }
  }

  startStatsCollection() {
    // Update metrics every 10 seconds
    setInterval(async () => {
      await this.collectSystemMetrics();
      await this.collectKafkaMetrics();
      await this.collectProcessingMetrics();
      await this.calculateRates();
    }, 10000);

    // Reset counters every minute
    setInterval(() => {
      this.resetMinuteCounters();
    }, 60000);
  }

  async collectSystemMetrics() {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      await this.redis.hset('metrics:system', {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external
      });

      // CPU usage
      const cpuUsage = process.cpuUsage();
      await this.redis.hset('metrics:cpu', {
        user: cpuUsage.user,
        system: cpuUsage.system
      });

    } catch (error) {
      this.logger.error('Error collecting system metrics:', error);
    }
  }

  async collectKafkaMetrics() {
    try {
      // Get consumer lag from Redis (should be updated by consumers)
      const lagData = await this.redis.hgetall('kafka:lag');
      
      for (const [key, value] of Object.entries(lagData || {})) {
        const [topic, partition, group] = key.split(':');
        this.metrics.kafkaLag.set(
          { topic, partition, consumer_group: group },
          parseInt(value)
        );
      }
    } catch (error) {
      this.logger.error('Error collecting Kafka metrics:', error);
    }
  }

  async collectProcessingMetrics() {
    try {
      const stats = await this.redis.hgetall('stats:processing');
      
      if (stats) {
        // Update throughput
        if (stats.processingRate) {
          this.metrics.throughput.set(
            { type: 'overall' },
            parseFloat(stats.processingRate)
          );
        }

        // Update error rate
        if (stats.totalErrors && stats.totalProcessed) {
          const errorRate = (parseInt(stats.totalErrors) / parseInt(stats.totalProcessed)) * 100;
          this.metrics.errorRate.set({ type: 'overall' }, errorRate);
        }
      }

      // Get batch sizes from Redis
      const batchSizes = await this.redis.hgetall('batch:sizes');
      for (const [type, size] of Object.entries(batchSizes || {})) {
        this.metrics.batchSize.set({ type }, parseInt(size));
      }

    } catch (error) {
      this.logger.error('Error collecting processing metrics:', error);
    }
  }

  async calculateRates() {
    try {
      const now = Date.now();
      const timeDiff = (now - this.stats.lastReset) / 1000; // in seconds

      // Calculate rates
      const messageRate = this.stats.totalMessages / timeDiff;
      const errorRate = this.stats.errorCount / timeDiff;
      const successRate = this.stats.successCount / timeDiff;

      await this.redis.hset('metrics:rates', {
        messageRate,
        errorRate,
        successRate,
        calculatedAt: now
      });

      // Update Prometheus metrics
      this.metrics.throughput.set({ type: 'messages' }, messageRate);
      this.metrics.errorRate.set({ type: 'messages' }, errorRate);

    } catch (error) {
      this.logger.error('Error calculating rates:', error);
    }
  }

  resetMinuteCounters() {
    this.stats = {
      ...this.stats,
      totalMessages: 0,
      errorCount: 0,
      successCount: 0,
      lastReset: Date.now()
    };
  }

  // Methods to record metrics
  recordMessage(type, status = 'success') {
    this.metrics.messagesProcessed.inc({ type, status });
    this.stats.totalMessages++;
    
    if (status === 'success') {
      this.stats.successCount++;
    } else if (status === 'error') {
      this.stats.errorCount++;
    }
  }

  recordProcessingTime(type, duration) {
    this.metrics.processingDuration.observe({ type }, duration);
  }

  recordStorageLatency(storageType, latency) {
    this.metrics.storageLatency.observe({ storage_type: storageType }, latency);
  }

  updateBatchSize(type, size) {
    this.metrics.batchSize.set({ type }, size);
  }

  updateCacheHitRate(cacheType, hitRate) {
    this.metrics.cacheHitRate.set({ cache_type: cacheType }, hitRate);
  }

  async recordKafkaLag(topic, partition, consumerGroup, lag) {
    this.metrics.kafkaLag.set(
      { topic, partition, consumer_group: consumerGroup },
      lag
    );
    
    // Store in Redis for persistence
    await this.redis.hset(
      'kafka:lag',
      `${topic}:${partition}:${consumerGroup}`,
      lag
    );
  }

  async getStats() {
    try {
      const systemMetrics = await this.redis.hgetall('metrics:system');
      const cpuMetrics = await this.redis.hgetall('metrics:cpu');
      const processingStats = await this.redis.hgetall('stats:processing');
      const rates = await this.redis.hgetall('metrics:rates');
      const kafkaLag = await this.redis.hgetall('kafka:lag');

      const uptime = Date.now() - this.stats.startTime;

      return {
        uptime: {
          milliseconds: uptime,
          seconds: Math.floor(uptime / 1000),
          minutes: Math.floor(uptime / 60000),
          hours: Math.floor(uptime / 3600000)
        },
        system: {
          memory: systemMetrics,
          cpu: cpuMetrics
        },
        processing: processingStats,
        rates: rates,
        kafka: {
          lag: kafkaLag
        },
        current: {
          totalMessages: this.stats.totalMessages,
          errorCount: this.stats.errorCount,
          successCount: this.stats.successCount,
          errorRate: this.stats.errorCount > 0 
            ? (this.stats.errorCount / this.stats.totalMessages) * 100 
            : 0
        }
      };
    } catch (error) {
      this.logger.error('Error getting stats:', error);
      return {};
    }
  }

  async getPrometheusMetrics() {
    return await promClient.register.metrics();
  }

  async reset() {
    this.stats = {
      startTime: Date.now(),
      totalMessages: 0,
      errorCount: 0,
      successCount: 0,
      lastReset: Date.now()
    };
    
    // Clear Redis stats
    await this.redis.del('metrics:system', 'metrics:cpu', 'stats:processing', 'metrics:rates');
    
    // Reset Prometheus metrics
    promClient.register.resetMetrics();
  }
}

module.exports = MetricsCollector;