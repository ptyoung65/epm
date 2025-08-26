const BaseService = require('../common/BaseService');
const { Kafka } = require('kafkajs');
const { ClickHouse } = require('clickhouse');
const { Client } = require('elasticsearch');
const Joi = require('joi');
const moment = require('moment');
// Simplified log parsing without Grok for easier deployment

class LogsService extends BaseService {
  constructor() {
    super({
      serviceName: 'logs-service',
      serviceVersion: '1.0.0',
      port: process.env.PORT || 3022
    });

    this.logsBuffer = [];
    this.bufferSize = parseInt(process.env.BUFFER_SIZE || '2000');
    this.flushInterval = parseInt(process.env.FLUSH_INTERVAL || '3000');

    // Log validation schema
    this.logSchema = Joi.object({
      message: Joi.string().required(),
      level: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').default('info'),
      timestamp: Joi.date().iso(),
      service: Joi.string(),
      host: Joi.string(),
      logger: Joi.string(),
      metadata: Joi.object(),
      tags: Joi.array().items(Joi.string())
    });

    this.setupRoutes();
  }

  async initialize() {
    // Initialize Kafka
    this.kafka = new Kafka({
      clientId: 'logs-service',
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

    // Initialize Elasticsearch (optional for full-text search)
    if (process.env.ELASTICSEARCH_URL) {
      this.elasticsearch = new Client({
        host: process.env.ELASTICSEARCH_URL
      });
    }

    // Start log consumer
    await this.startLogConsumer();

    // Initialize log patterns (simplified)
    this.initializeLogPatterns();

    // Start buffer flush timer
    this.startBufferFlush();

    this.logger.info('Logs service initialized');
  }

  initializeLogPatterns() {
    // Simplified log patterns using regex for basic parsing
    this.logPatterns = {
      json: /^\s*\{/,
      apache: /^\d+\.\d+\.\d+\.\d+/,
      nginx: /^\d+\.\d+\.\d+\.\d+/,
      syslog: /^<\d+>/,
      java: /^\d{4}-\d{2}-\d{2}/
    };
  }

  setupRoutes() {
    // Ingest single log
    this.app.post('/api/logs', async (req, res) => {
      try {
        const log = await this.validateLog(req.body);
        await this.ingestLog(log);
        res.status(201).json({ success: true, log });
      } catch (error) {
        if (error.isJoi) {
          res.status(400).json({ error: error.details[0].message });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    });

    // Bulk ingest logs
    this.app.post('/api/logs/bulk', async (req, res) => {
      try {
        const { logs } = req.body;
        if (!Array.isArray(logs)) {
          return res.status(400).json({ error: 'Logs must be an array' });
        }

        const validatedLogs = [];
        for (const log of logs) {
          validatedLogs.push(await this.validateLog(log));
        }

        await this.ingestBulkLogs(validatedLogs);
        res.status(201).json({ 
          success: true, 
          count: validatedLogs.length 
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Parse log with grok patterns
    this.app.post('/api/logs/parse', async (req, res) => {
      try {
        const { message, pattern } = req.body;
        const parsed = await this.parseLogMessage(message, pattern);
        res.json({ parsed });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Query logs
    this.app.get('/api/logs', async (req, res) => {
      try {
        const { 
          service, 
          level, 
          from, 
          to, 
          search, 
          limit = 100, 
          offset = 0 
        } = req.query;
        
        const logs = await this.queryLogs({
          service,
          level,
          from: from || moment().subtract(1, 'hour').toISOString(),
          to: to || moment().toISOString(),
          search,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
        
        res.json({ logs });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Search logs with full-text search
    this.app.get('/api/logs/search', async (req, res) => {
      try {
        const { q, size = 50, from = 0 } = req.query;
        
        if (!this.elasticsearch) {
          return res.status(503).json({ 
            error: 'Elasticsearch not available' 
          });
        }

        const results = await this.searchLogs(q, { size, from });
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get log statistics
    this.app.get('/api/logs/stats', async (req, res) => {
      try {
        const stats = await this.getLogStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Log level distribution
    this.app.get('/api/logs/levels', async (req, res) => {
      try {
        const distribution = await this.getLogLevelDistribution();
        res.json({ distribution });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Services that are logging
    this.app.get('/api/logs/services', async (req, res) => {
      try {
        const services = await this.getLoggingServices();
        res.json({ services });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Real-time log stream (SSE)
    this.app.get('/api/logs/stream', (req, res) => {
      const { level, service } = req.query;
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const subscriber = this.subscribeToLogs((log) => {
        // Filter based on query params
        if (level && log.level !== level) return;
        if (service && log.service !== service) return;
        
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      });

      req.on('close', () => {
        subscriber.unsubscribe();
      });
    });
  }

  async validateLog(data) {
    const validated = await this.logSchema.validateAsync(data);
    
    // Add defaults
    if (!validated.timestamp) {
      validated.timestamp = new Date().toISOString();
    }
    if (!validated.service) {
      validated.service = 'unknown';
    }
    if (!validated.host) {
      validated.host = process.env.HOSTNAME || 'unknown';
    }
    if (!validated.metadata) {
      validated.metadata = {};
    }
    if (!validated.tags) {
      validated.tags = [];
    }

    // Parse message if it looks structured
    if (validated.message.startsWith('{') || validated.message.includes('=')) {
      const parsed = await this.parseLogMessage(validated.message);
      if (parsed && Object.keys(parsed).length > 0) {
        validated.parsed = parsed;
      }
    }

    return validated;
  }

  async parseLogMessage(message, patternName = null) {
    if (!message) return {};

    // Try JSON first
    if (message.startsWith('{')) {
      try {
        return JSON.parse(message);
      } catch {
        // Not JSON, continue with grok patterns
      }
    }

    // Try to identify log format
    for (const [name, pattern] of Object.entries(this.logPatterns)) {
      if (pattern.test(message)) {
        return { 
          message,
          logFormat: name,
          timestamp: new Date().toISOString(),
          parsed: name === 'json' ? this.tryParseJSON(message) : { raw: message }
        };
      }
    }

    return { message, timestamp: new Date().toISOString(), logFormat: 'unknown' };
  }

  tryParseJSON(message) {
    try {
      return JSON.parse(message);
    } catch {
      return { raw: message };
    }
  }

  async ingestLog(log) {
    // Add to buffer
    this.logsBuffer.push(log);

    // Send to Kafka for real-time processing
    await this.producer.send({
      topic: 'airis-epm-logs',
      messages: [{
        key: log.service,
        value: JSON.stringify(log),
        timestamp: Date.now().toString()
      }]
    });

    // Publish to Redis for real-time subscribers
    await this.publish('logs:realtime', log);

    // Check if buffer needs flushing
    if (this.logsBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  async ingestBulkLogs(logs) {
    // Add to buffer
    this.logsBuffer.push(...logs);

    // Send to Kafka
    const messages = logs.map(log => ({
      key: log.service,
      value: JSON.stringify(log),
      timestamp: Date.now().toString()
    }));

    await this.producer.send({
      topic: 'airis-epm-logs',
      messages
    });

    // Check buffer
    if (this.logsBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  async flushBuffer() {
    if (this.logsBuffer.length === 0) return;

    const logs = [...this.logsBuffer];
    this.logsBuffer = [];

    try {
      // Prepare data for ClickHouse
      const values = logs.map(l => [
        moment(l.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS'),
        l.level.toUpperCase(),
        l.message,
        l.service,
        l.host,
        l.logger || '',
        JSON.stringify(l.metadata),
        JSON.stringify(l.tags),
        JSON.stringify(l.parsed || {})
      ]);

      // Insert into ClickHouse
      await this.clickhouse.insert(
        `INSERT INTO airis_epm.logs 
         (timestamp, level, message, service, host, logger, metadata, tags, parsed) VALUES`,
        values
      ).toPromise();

      // Index in Elasticsearch if available
      if (this.elasticsearch) {
        const body = logs.flatMap(log => [
          { index: { _index: 'airis-logs', _type: '_doc' } },
          log
        ]);

        await this.elasticsearch.bulk({ body });
      }

      this.logger.debug(`Flushed ${logs.length} logs to storage`);
    } catch (error) {
      this.logger.error('Failed to flush logs buffer:', error);
      // Return logs to buffer for retry
      this.logsBuffer.unshift(...logs);
    }
  }

  startBufferFlush() {
    setInterval(() => {
      this.flushBuffer().catch(err => {
        this.logger.error('Buffer flush error:', err);
      });
    }, this.flushInterval);
  }

  async startLogConsumer() {
    const consumer = this.kafka.consumer({ 
      groupId: 'logs-service-processor' 
    });
    
    await consumer.connect();
    await consumer.subscribe({ 
      topic: 'airis-epm-logs', 
      fromBeginning: false 
    });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const log = JSON.parse(message.value.toString());
          await this.processLog(log);
        } catch (error) {
          this.logger.error('Error processing log:', error);
        }
      }
    });
  }

  async processLog(log) {
    // Extract error patterns
    if (log.level === 'error' || log.level === 'fatal') {
      await this.extractErrorPatterns(log);
    }

    // Update log statistics
    await this.updateLogStats(log);

    // Check for alert conditions
    await this.checkAlertConditions(log);
  }

  async extractErrorPatterns(log) {
    const key = `error_patterns:${log.service}`;
    const pattern = this.extractPattern(log.message);
    
    if (pattern) {
      await this.redis.hincrby(key, pattern, 1);
      await this.redis.expire(key, 3600);
      
      // Check if this error pattern is increasing
      const count = await this.redis.hget(key, pattern);
      if (parseInt(count) > 10) {
        await this.publish('alerts:error_pattern', {
          service: log.service,
          pattern,
          count: parseInt(count),
          example: log.message,
          timestamp: log.timestamp
        });
      }
    }
  }

  extractPattern(message) {
    // Simple pattern extraction - replace numbers and paths with placeholders
    return message
      .replace(/\d+/g, '<NUM>')
      .replace(/\/[^\s]+/g, '<PATH>')
      .replace(/[a-f0-9]{8,}/g, '<HEX>')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '<EMAIL>')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<IP>');
  }

  async updateLogStats(log) {
    const hour = moment(log.timestamp).format('YYYY-MM-DD-HH');
    const statsKey = `log_stats:${hour}`;
    
    await this.redis.hincrby(statsKey, 'total', 1);
    await this.redis.hincrby(statsKey, `level_${log.level}`, 1);
    await this.redis.hincrby(statsKey, `service_${log.service}`, 1);
    await this.redis.expire(statsKey, 86400);
  }

  async checkAlertConditions(log) {
    if (log.level === 'error' || log.level === 'fatal') {
      // Check error rate
      const key = `error_rate:${log.service}`;
      await this.redis.incr(key);
      await this.redis.expire(key, 300); // 5 minutes window
      
      const errorCount = await this.redis.get(key);
      if (parseInt(errorCount) > 50) {
        await this.publish('alerts:high_error_rate', {
          service: log.service,
          errorCount: parseInt(errorCount),
          window: '5m',
          timestamp: log.timestamp
        });
      }
    }
  }

  async queryLogs(params) {
    const { service, level, from, to, search, limit, offset } = params;
    
    let query = `
      SELECT * FROM airis_epm.logs
      WHERE timestamp >= '${moment(from).format('YYYY-MM-DD HH:mm:ss')}'
        AND timestamp <= '${moment(to).format('YYYY-MM-DD HH:mm:ss')}'
    `;
    
    if (service) {
      query += ` AND service = '${service}'`;
    }
    
    if (level) {
      query += ` AND level = '${level.toUpperCase()}'`;
    }
    
    if (search) {
      query += ` AND (message LIKE '%${search}%' OR logger LIKE '%${search}%')`;
    }
    
    query += ` ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`;

    const result = await this.clickhouse.query(query).toPromise();
    return result;
  }

  async searchLogs(query, options = {}) {
    const { size = 50, from = 0 } = options;
    
    const searchBody = {
      index: 'airis-logs',
      body: {
        query: {
          query_string: {
            query: query || '*'
          }
        },
        sort: [{ timestamp: { order: 'desc' } }],
        size,
        from
      }
    };

    const response = await this.elasticsearch.search(searchBody);
    return {
      total: response.hits.total.value || response.hits.total,
      logs: response.hits.hits.map(hit => hit._source)
    };
  }

  async getLogStats() {
    const currentHour = moment().format('YYYY-MM-DD-HH');
    const stats = await this.redis.hgetall(`log_stats:${currentHour}`);
    
    const daily = await this.clickhouse.query(`
      SELECT 
        level,
        count(*) as count
      FROM airis_epm.logs
      WHERE timestamp >= today()
      GROUP BY level
      ORDER BY count DESC
    `).toPromise();

    return {
      hourly: stats,
      daily: daily.reduce((acc, item) => {
        acc[item.level] = item.count;
        return acc;
      }, {}),
      buffer: {
        size: this.logsBuffer.length,
        maxSize: this.bufferSize
      }
    };
  }

  async getLogLevelDistribution() {
    const query = `
      SELECT 
        level,
        count(*) as count,
        count(*) * 100.0 / sum(count(*)) OVER () as percentage
      FROM airis_epm.logs
      WHERE timestamp >= now() - INTERVAL 24 HOUR
      GROUP BY level
      ORDER BY count DESC
    `;

    const result = await this.clickhouse.query(query).toPromise();
    return result;
  }

  async getLoggingServices() {
    const query = `
      SELECT 
        service,
        count(*) as log_count,
        max(timestamp) as last_log
      FROM airis_epm.logs
      WHERE timestamp >= now() - INTERVAL 24 HOUR
      GROUP BY service
      ORDER BY log_count DESC
    `;

    const result = await this.clickhouse.query(query).toPromise();
    return result;
  }

  subscribeToLogs(callback) {
    const subscriber = this.subscribe('logs:realtime', callback);
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
      elasticsearch: {
        status: this.elasticsearch ? 'healthy' : 'not_configured'
      },
      buffer: {
        size: this.logsBuffer.length,
        status: this.logsBuffer.length < this.bufferSize * 0.9 ? 'healthy' : 'warning'
      }
    };
  }

  getFeatures() {
    return [
      'structured-logging',
      'log-parsing',
      'pattern-detection',
      'real-time-ingestion',
      'full-text-search',
      'error-pattern-detection',
      'log-aggregation',
      'stream-api'
    ];
  }

  async cleanup() {
    // Flush remaining buffer
    await this.flushBuffer();
    
    // Disconnect Kafka
    if (this.producer) {
      await this.producer.disconnect();
    }
    
    this.logger.info('Logs service cleanup complete');
  }
}

// Start the service
const service = new LogsService();
service.start();