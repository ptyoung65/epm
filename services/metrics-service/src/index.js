const BaseService = require('../common/BaseService');
const { Kafka } = require('kafkajs');
const { ClickHouse } = require('clickhouse');
const Joi = require('joi');
const moment = require('moment');
const cron = require('node-cron');

class MetricsService extends BaseService {
  constructor() {
    super({
      serviceName: 'metrics-service',
      serviceVersion: '1.0.0',
      port: process.env.PORT || 3021
    });

    this.metricsBuffer = [];
    this.bufferSize = parseInt(process.env.BUFFER_SIZE || '1000');
    this.flushInterval = parseInt(process.env.FLUSH_INTERVAL || '5000');
    
    // Metric validation schema
    this.metricSchema = Joi.object({
      name: Joi.string().required(),
      value: Joi.number().required(),
      timestamp: Joi.date().iso(),
      tags: Joi.object().pattern(Joi.string(), Joi.string()),
      type: Joi.string().valid('gauge', 'counter', 'histogram', 'summary').default('gauge'),
      unit: Joi.string(),
      source: Joi.string()
    });

    this.setupRoutes();
  }

  async initialize() {
    // Initialize Kafka
    this.kafka = new Kafka({
      clientId: 'metrics-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
    });

    this.producer = this.kafka.producer();
    await this.producer.connect();

    // Initialize ClickHouse
    this.clickhouse = new ClickHouse({
      url: process.env.CLICKHOUSE_URL || 'http://localhost',
      port: process.env.CLICKHOUSE_PORT || 8123,
      debug: false,
      format: "json",
      config: {
        database: process.env.CLICKHOUSE_DB || 'airis_epm'
      }
    });

    // Start metric consumer
    await this.startMetricConsumer();

    // Start buffer flush timer
    this.startBufferFlush();

    // Start aggregation jobs
    this.startAggregationJobs();

    this.logger.info('Metrics service initialized');
  }

  setupRoutes() {
    // Ingest single metric
    this.app.post('/api/metrics', async (req, res) => {
      try {
        const metric = await this.validateMetric(req.body);
        await this.ingestMetric(metric);
        res.status(201).json({ success: true, metric });
      } catch (error) {
        if (error.isJoi) {
          res.status(400).json({ error: error.details[0].message });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    });

    // Bulk ingest metrics
    this.app.post('/api/metrics/bulk', async (req, res) => {
      try {
        const { metrics } = req.body;
        if (!Array.isArray(metrics)) {
          return res.status(400).json({ error: 'Metrics must be an array' });
        }

        const validatedMetrics = [];
        for (const metric of metrics) {
          validatedMetrics.push(await this.validateMetric(metric));
        }

        await this.ingestBulkMetrics(validatedMetrics);
        res.status(201).json({ 
          success: true, 
          count: validatedMetrics.length 
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Query metrics
    this.app.get('/api/metrics', async (req, res) => {
      try {
        const { name, from, to, tags, aggregation } = req.query;
        const metrics = await this.queryMetrics({
          name,
          from: from || moment().subtract(1, 'hour').toISOString(),
          to: to || moment().toISOString(),
          tags: tags ? JSON.parse(tags) : {},
          aggregation: aggregation || 'raw'
        });
        res.json({ metrics });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get metric names
    this.app.get('/api/metrics/names', async (req, res) => {
      try {
        const names = await this.getMetricNames();
        res.json({ names });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get metric statistics
    this.app.get('/api/metrics/stats', async (req, res) => {
      try {
        const stats = await this.getMetricStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Real-time metrics stream (SSE)
    this.app.get('/api/metrics/stream', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const subscriber = this.subscribeToMetrics((metric) => {
        res.write(`data: ${JSON.stringify(metric)}\n\n`);
      });

      req.on('close', () => {
        subscriber.unsubscribe();
      });
    });
  }

  async validateMetric(data) {
    const validated = await this.metricSchema.validateAsync(data);
    
    // Add defaults
    if (!validated.timestamp) {
      validated.timestamp = new Date().toISOString();
    }
    if (!validated.source) {
      validated.source = 'unknown';
    }
    if (!validated.tags) {
      validated.tags = {};
    }

    return validated;
  }

  async ingestMetric(metric) {
    // Add to buffer
    this.metricsBuffer.push(metric);

    // Send to Kafka for real-time processing
    await this.producer.send({
      topic: 'airis-epm-metrics',
      messages: [{
        key: metric.name,
        value: JSON.stringify(metric),
        timestamp: Date.now().toString()
      }]
    });

    // Publish to Redis for real-time subscribers
    await this.publish('metrics:realtime', metric);

    // Check if buffer needs flushing
    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  async ingestBulkMetrics(metrics) {
    // Add to buffer
    this.metricsBuffer.push(...metrics);

    // Send to Kafka
    const messages = metrics.map(metric => ({
      key: metric.name,
      value: JSON.stringify(metric),
      timestamp: Date.now().toString()
    }));

    await this.producer.send({
      topic: 'airis-epm-metrics',
      messages
    });

    // Check buffer
    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  async flushBuffer() {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Prepare data for ClickHouse
      const values = metrics.map(m => [
        m.name,
        m.value,
        moment(m.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS'),
        JSON.stringify(m.tags),
        m.type,
        m.unit || '',
        m.source
      ]);

      // Insert into ClickHouse
      await this.clickhouse.insert(
        `INSERT INTO airis_epm.metrics 
         (name, value, timestamp, tags, type, unit, source) VALUES`,
        values
      ).toPromise();

      this.logger.debug(`Flushed ${metrics.length} metrics to ClickHouse`);
    } catch (error) {
      this.logger.error('Failed to flush metrics buffer:', error);
      // Return metrics to buffer for retry
      this.metricsBuffer.unshift(...metrics);
    }
  }

  startBufferFlush() {
    setInterval(() => {
      this.flushBuffer().catch(err => {
        this.logger.error('Buffer flush error:', err);
      });
    }, this.flushInterval);
  }

  async startMetricConsumer() {
    const consumer = this.kafka.consumer({ 
      groupId: 'metrics-service-processor' 
    });
    
    await consumer.connect();
    await consumer.subscribe({ 
      topic: 'airis-epm-metrics', 
      fromBeginning: false 
    });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const metric = JSON.parse(message.value.toString());
          await this.processMetric(metric);
        } catch (error) {
          this.logger.error('Error processing metric:', error);
        }
      }
    });
  }

  async processMetric(metric) {
    // Apply processing rules
    const rules = await this.getProcessingRules(metric.name);
    
    for (const rule of rules) {
      if (rule.type === 'threshold') {
        await this.checkThreshold(metric, rule);
      } else if (rule.type === 'anomaly') {
        await this.checkAnomaly(metric, rule);
      } else if (rule.type === 'aggregate') {
        await this.updateAggregation(metric, rule);
      }
    }

    // Update real-time statistics
    await this.updateRealtimeStats(metric);
  }

  async getProcessingRules(metricName) {
    const cached = await this.cacheGet(`rules:${metricName}`);
    if (cached) return cached;

    // Default rules
    const rules = [
      {
        type: 'threshold',
        condition: 'value > 90',
        severity: 'warning',
        action: 'alert'
      }
    ];

    await this.cacheSet(`rules:${metricName}`, rules, 300);
    return rules;
  }

  async checkThreshold(metric, rule) {
    // Simple threshold check
    if (rule.condition === 'value > 90' && metric.value > 90) {
      await this.publish('alerts:threshold', {
        metric: metric.name,
        value: metric.value,
        threshold: 90,
        severity: rule.severity,
        timestamp: metric.timestamp
      });
    }
  }

  async checkAnomaly(metric, rule) {
    // Simple anomaly detection using moving average
    const key = `anomaly:${metric.name}`;
    const history = await this.redis.lrange(key, 0, 99);
    
    if (history.length >= 10) {
      const values = history.map(h => parseFloat(h));
      const avg = values.reduce((a, b) => a + b) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length
      );
      
      if (Math.abs(metric.value - avg) > 3 * stdDev) {
        await this.publish('alerts:anomaly', {
          metric: metric.name,
          value: metric.value,
          expected: avg,
          deviation: Math.abs(metric.value - avg) / stdDev,
          timestamp: metric.timestamp
        });
      }
    }

    await this.redis.lpush(key, metric.value);
    await this.redis.ltrim(key, 0, 99);
    await this.redis.expire(key, 3600);
  }

  async updateAggregation(metric, rule) {
    const key = `agg:${metric.name}:${moment().format('YYYY-MM-DD-HH')}`;
    
    await this.redis.hincrby(key, 'count', 1);
    await this.redis.hincrbyfloat(key, 'sum', metric.value);
    
    const min = await this.redis.hget(key, 'min');
    if (!min || metric.value < parseFloat(min)) {
      await this.redis.hset(key, 'min', metric.value);
    }
    
    const max = await this.redis.hget(key, 'max');
    if (!max || metric.value > parseFloat(max)) {
      await this.redis.hset(key, 'max', metric.value);
    }
    
    await this.redis.expire(key, 7200);
  }

  async updateRealtimeStats(metric) {
    const statsKey = 'metrics:stats:realtime';
    
    await this.redis.hincrby(statsKey, 'total_count', 1);
    await this.redis.hincrbyfloat(statsKey, 'total_sum', metric.value);
    await this.redis.hset(statsKey, 'last_metric', JSON.stringify(metric));
    await this.redis.hset(statsKey, 'last_updated', Date.now());
  }

  startAggregationJobs() {
    // Every minute: create 1-minute aggregations
    cron.schedule('* * * * *', async () => {
      await this.createAggregations('1m');
    });

    // Every 5 minutes: create 5-minute aggregations
    cron.schedule('*/5 * * * *', async () => {
      await this.createAggregations('5m');
    });

    // Every hour: create hourly aggregations
    cron.schedule('0 * * * *', async () => {
      await this.createAggregations('1h');
    });

    // Every day: create daily aggregations
    cron.schedule('0 0 * * *', async () => {
      await this.createAggregations('1d');
    });
  }

  async createAggregations(interval) {
    try {
      const endTime = moment().startOf('minute');
      let startTime;

      switch (interval) {
        case '1m':
          startTime = moment(endTime).subtract(1, 'minute');
          break;
        case '5m':
          startTime = moment(endTime).subtract(5, 'minutes');
          break;
        case '1h':
          startTime = moment(endTime).subtract(1, 'hour');
          break;
        case '1d':
          startTime = moment(endTime).subtract(1, 'day');
          break;
      }

      const query = `
        INSERT INTO airis_epm.aggregated_metrics
        SELECT 
          '${startTime.format('YYYY-MM-DD HH:mm:ss')}' as period_start,
          '${endTime.format('YYYY-MM-DD HH:mm:ss')}' as period_end,
          name as metric_name,
          '${interval}' as aggregation_type,
          avg(value) as avg_value,
          count(*) as count,
          min(value) as min_value,
          max(value) as max_value,
          quantile(0.5)(value) as p50,
          quantile(0.95)(value) as p95,
          quantile(0.99)(value) as p99,
          tags
        FROM airis_epm.metrics
        WHERE timestamp >= '${startTime.format('YYYY-MM-DD HH:mm:ss')}'
          AND timestamp < '${endTime.format('YYYY-MM-DD HH:mm:ss')}'
        GROUP BY name, tags
      `;

      await this.clickhouse.query(query).toPromise();
      
      this.logger.debug(`Created ${interval} aggregations`);
    } catch (error) {
      this.logger.error(`Failed to create ${interval} aggregations:`, error);
    }
  }

  async queryMetrics(params) {
    const { name, from, to, tags, aggregation } = params;
    
    let query;
    if (aggregation === 'raw') {
      query = `
        SELECT * FROM airis_epm.metrics
        WHERE timestamp >= '${moment(from).format('YYYY-MM-DD HH:mm:ss')}'
          AND timestamp <= '${moment(to).format('YYYY-MM-DD HH:mm:ss')}'
      `;
      
      if (name) {
        query += ` AND name = '${name}'`;
      }
      
      if (tags && Object.keys(tags).length > 0) {
        for (const [key, value] of Object.entries(tags)) {
          query += ` AND JSONExtractString(tags, '${key}') = '${value}'`;
        }
      }
      
      query += ' ORDER BY timestamp DESC LIMIT 10000';
    } else {
      // Query aggregated data
      query = `
        SELECT * FROM airis_epm.aggregated_metrics
        WHERE period_start >= '${moment(from).format('YYYY-MM-DD HH:mm:ss')}'
          AND period_end <= '${moment(to).format('YYYY-MM-DD HH:mm:ss')}'
          AND aggregation_type = '${aggregation}'
      `;
      
      if (name) {
        query += ` AND metric_name = '${name}'`;
      }
      
      query += ' ORDER BY period_start DESC LIMIT 1000';
    }

    const result = await this.clickhouse.query(query).toPromise();
    return result;
  }

  async getMetricNames() {
    const query = `
      SELECT DISTINCT name 
      FROM airis_epm.metrics 
      WHERE timestamp >= now() - INTERVAL 1 DAY
      ORDER BY name
    `;
    
    const result = await this.clickhouse.query(query).toPromise();
    return result.map(r => r.name);
  }

  async getMetricStats() {
    const realtime = await this.redis.hgetall('metrics:stats:realtime');
    
    const dailyStats = await this.clickhouse.query(`
      SELECT 
        count(*) as total_metrics,
        count(DISTINCT name) as unique_metrics,
        max(timestamp) as last_metric_time
      FROM airis_epm.metrics
      WHERE timestamp >= today()
    `).toPromise();

    return {
      realtime: {
        totalCount: parseInt(realtime.total_count || 0),
        totalSum: parseFloat(realtime.total_sum || 0),
        lastUpdated: parseInt(realtime.last_updated || 0)
      },
      daily: dailyStats[0] || {},
      buffer: {
        size: this.metricsBuffer.length,
        maxSize: this.bufferSize
      }
    };
  }

  subscribeToMetrics(callback) {
    const subscriber = this.subscribe('metrics:realtime', callback);
    return {
      unsubscribe: () => subscriber.then(s => s.unsubscribe())
    };
  }

  customHealthChecks() {
    return {
      kafka: {
        status: this.producer ? 'healthy' : 'unhealthy'
      },
      clickhouse: {
        status: this.clickhouse ? 'healthy' : 'unhealthy'
      },
      buffer: {
        size: this.metricsBuffer.length,
        status: this.metricsBuffer.length < this.bufferSize * 0.9 ? 'healthy' : 'warning'
      }
    };
  }

  getFeatures() {
    return [
      'real-time-ingestion',
      'bulk-ingestion',
      'metric-aggregation',
      'threshold-alerts',
      'anomaly-detection',
      'stream-api',
      'clickhouse-storage'
    ];
  }

  async cleanup() {
    // Flush remaining buffer
    await this.flushBuffer();
    
    // Disconnect Kafka
    if (this.producer) {
      await this.producer.disconnect();
    }
    
    this.logger.info('Metrics service cleanup complete');
  }
}

// Start the service
const service = new MetricsService();
service.start();