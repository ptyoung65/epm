const BaseService = require('../common/BaseService');
const { Kafka } = require('kafkajs');
const { ClickHouse } = require('clickhouse');
const Joi = require('joi');
const moment = require('moment');
const { mean, median, quantile } = require('d3-array');

class TracesService extends BaseService {
  constructor() {
    super({
      serviceName: 'traces-service',
      serviceVersion: '1.0.0',
      port: process.env.PORT || 3023
    });

    this.tracesBuffer = [];
    this.spansBuffer = [];
    this.bufferSize = parseInt(process.env.BUFFER_SIZE || '1000');
    this.flushInterval = parseInt(process.env.FLUSH_INTERVAL || '5000');

    // Trace validation schemas
    this.traceSchema = Joi.object({
      traceId: Joi.string().required(),
      spans: Joi.array().items(Joi.object({
        spanId: Joi.string().required(),
        parentSpanId: Joi.string().allow(null),
        operationName: Joi.string().required(),
        serviceName: Joi.string().required(),
        startTime: Joi.date().required(),
        endTime: Joi.date().required(),
        duration: Joi.number().positive(),
        tags: Joi.object(),
        logs: Joi.array(),
        status: Joi.object()
      }))
    });

    this.spanSchema = Joi.object({
      traceId: Joi.string().required(),
      spanId: Joi.string().required(),
      parentSpanId: Joi.string().allow(null),
      operationName: Joi.string().required(),
      serviceName: Joi.string().required(),
      startTime: Joi.date().required(),
      endTime: Joi.date().required(),
      duration: Joi.number().positive(),
      tags: Joi.object().default({}),
      logs: Joi.array().default([]),
      status: Joi.object().default({})
    });

    this.setupRoutes();
  }

  async initialize() {
    // Initialize Kafka
    this.kafka = new Kafka({
      clientId: 'traces-service',
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

    // Start trace consumer
    await this.startTraceConsumer();

    // Start buffer flush timer
    this.startBufferFlush();

    this.logger.info('Traces service initialized');
  }

  setupRoutes() {
    // Ingest single trace
    this.app.post('/api/traces', async (req, res) => {
      try {
        const trace = await this.validateTrace(req.body);
        await this.ingestTrace(trace);
        res.status(201).json({ success: true, traceId: trace.traceId });
      } catch (error) {
        if (error.isJoi) {
          res.status(400).json({ error: error.details[0].message });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    });

    // Ingest single span
    this.app.post('/api/spans', async (req, res) => {
      try {
        const span = await this.validateSpan(req.body);
        await this.ingestSpan(span);
        res.status(201).json({ success: true, spanId: span.spanId });
      } catch (error) {
        if (error.isJoi) {
          res.status(400).json({ error: error.details[0].message });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    });

    // Get trace by ID
    this.app.get('/api/traces/:traceId', async (req, res) => {
      try {
        const { traceId } = req.params;
        const trace = await this.getTrace(traceId);
        if (!trace) {
          return res.status(404).json({ error: 'Trace not found' });
        }
        res.json(trace);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Search traces
    this.app.get('/api/traces', async (req, res) => {
      try {
        const {
          service,
          operation,
          minDuration,
          maxDuration,
          from,
          to,
          tags,
          limit = 50,
          offset = 0
        } = req.query;

        const traces = await this.searchTraces({
          service,
          operation,
          minDuration: minDuration ? parseInt(minDuration) : null,
          maxDuration: maxDuration ? parseInt(maxDuration) : null,
          from: from || moment().subtract(1, 'hour').toISOString(),
          to: to || moment().toISOString(),
          tags: tags ? JSON.parse(tags) : {},
          limit: parseInt(limit),
          offset: parseInt(offset)
        });

        res.json({ traces });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get service dependencies
    this.app.get('/api/traces/dependencies', async (req, res) => {
      try {
        const { from, to } = req.query;
        const dependencies = await this.getServiceDependencies(
          from || moment().subtract(1, 'hour').toISOString(),
          to || moment().toISOString()
        );
        res.json({ dependencies });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get service map
    this.app.get('/api/traces/service-map', async (req, res) => {
      try {
        const { from, to } = req.query;
        const serviceMap = await this.getServiceMap(
          from || moment().subtract(1, 'hour').toISOString(),
          to || moment().toISOString()
        );
        res.json(serviceMap);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get operation statistics
    this.app.get('/api/traces/operations/:service', async (req, res) => {
      try {
        const { service } = req.params;
        const { from, to } = req.query;
        
        const operations = await this.getOperationStats(
          service,
          from || moment().subtract(1, 'hour').toISOString(),
          to || moment().toISOString()
        );
        
        res.json({ operations });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get performance metrics
    this.app.get('/api/traces/performance', async (req, res) => {
      try {
        const { service, operation, from, to } = req.query;
        
        const metrics = await this.getPerformanceMetrics({
          service,
          operation,
          from: from || moment().subtract(1, 'hour').toISOString(),
          to: to || moment().toISOString()
        });
        
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get error analysis
    this.app.get('/api/traces/errors', async (req, res) => {
      try {
        const { service, from, to } = req.query;
        
        const errors = await this.getErrorAnalysis({
          service,
          from: from || moment().subtract(1, 'hour').toISOString(),
          to: to || moment().toISOString()
        });
        
        res.json(errors);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get trace statistics
    this.app.get('/api/traces/stats', async (req, res) => {
      try {
        const stats = await this.getTraceStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async validateTrace(data) {
    const validated = await this.traceSchema.validateAsync(data);
    
    // Calculate trace duration if not provided
    if (validated.spans && validated.spans.length > 0) {
      const startTimes = validated.spans.map(s => new Date(s.startTime).getTime());
      const endTimes = validated.spans.map(s => new Date(s.endTime).getTime());
      
      validated.startTime = new Date(Math.min(...startTimes));
      validated.endTime = new Date(Math.max(...endTimes));
      validated.duration = Math.max(...endTimes) - Math.min(...startTimes);
      
      // Calculate span durations
      validated.spans = validated.spans.map(span => ({
        ...span,
        duration: span.duration || (new Date(span.endTime) - new Date(span.startTime))
      }));
    }

    return validated;
  }

  async validateSpan(data) {
    const validated = await this.spanSchema.validateAsync(data);
    
    // Calculate duration if not provided
    if (!validated.duration) {
      validated.duration = new Date(validated.endTime) - new Date(validated.startTime);
    }

    return validated;
  }

  async ingestTrace(trace) {
    // Add trace to buffer
    this.tracesBuffer.push({
      traceId: trace.traceId,
      startTime: trace.startTime,
      endTime: trace.endTime,
      duration: trace.duration,
      spanCount: trace.spans ? trace.spans.length : 0,
      services: trace.spans ? [...new Set(trace.spans.map(s => s.serviceName))] : [],
      rootService: trace.spans ? trace.spans.find(s => !s.parentSpanId)?.serviceName : null
    });

    // Add spans to buffer
    if (trace.spans) {
      this.spansBuffer.push(...trace.spans);
    }

    // Send to Kafka
    await this.producer.send({
      topic: 'airis-epm-traces',
      messages: [{
        key: trace.traceId,
        value: JSON.stringify(trace),
        timestamp: Date.now().toString()
      }]
    });

    // Publish to Redis for real-time analysis
    await this.publish('traces:realtime', trace);

    // Check if buffer needs flushing
    if (this.tracesBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  async ingestSpan(span) {
    // Add to spans buffer
    this.spansBuffer.push(span);

    // Send to Kafka
    await this.producer.send({
      topic: 'airis-epm-traces',
      messages: [{
        key: span.traceId,
        value: JSON.stringify({ spans: [span] }),
        timestamp: Date.now().toString()
      }]
    });

    // Check if buffer needs flushing
    if (this.spansBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  async flushBuffer() {
    if (this.tracesBuffer.length === 0 && this.spansBuffer.length === 0) return;

    try {
      // Flush traces
      if (this.tracesBuffer.length > 0) {
        const traces = [...this.tracesBuffer];
        this.tracesBuffer = [];

        const traceValues = traces.map(t => [
          t.traceId,
          moment(t.startTime).format('YYYY-MM-DD HH:mm:ss.SSS'),
          moment(t.endTime).format('YYYY-MM-DD HH:mm:ss.SSS'),
          t.duration,
          t.spanCount,
          JSON.stringify(t.services),
          t.rootService || ''
        ]);

        await this.clickhouse.insert(
          `INSERT INTO airis_epm.traces 
           (trace_id, start_time, end_time, duration, span_count, services, root_service) VALUES`,
          traceValues
        ).toPromise();
      }

      // Flush spans
      if (this.spansBuffer.length > 0) {
        const spans = [...this.spansBuffer];
        this.spansBuffer = [];

        const spanValues = spans.map(s => [
          s.traceId,
          s.spanId,
          s.parentSpanId || '',
          s.operationName,
          s.serviceName,
          moment(s.startTime).format('YYYY-MM-DD HH:mm:ss.SSS'),
          moment(s.endTime).format('YYYY-MM-DD HH:mm:ss.SSS'),
          s.duration,
          JSON.stringify(s.tags),
          JSON.stringify(s.logs),
          JSON.stringify(s.status)
        ]);

        await this.clickhouse.insert(
          `INSERT INTO airis_epm.spans 
           (trace_id, span_id, parent_span_id, operation_name, service_name, 
            start_time, end_time, duration, tags, logs, status) VALUES`,
          spanValues
        ).toPromise();
      }

      this.logger.debug(`Flushed ${this.tracesBuffer.length} traces and ${this.spansBuffer.length} spans`);
    } catch (error) {
      this.logger.error('Failed to flush traces buffer:', error);
      // Return data to buffer for retry (simplified)
    }
  }

  startBufferFlush() {
    setInterval(() => {
      this.flushBuffer().catch(err => {
        this.logger.error('Buffer flush error:', err);
      });
    }, this.flushInterval);
  }

  async startTraceConsumer() {
    const consumer = this.kafka.consumer({ 
      groupId: 'traces-service-processor' 
    });
    
    await consumer.connect();
    await consumer.subscribe({ 
      topic: 'airis-epm-traces', 
      fromBeginning: false 
    });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          await this.processTrace(data);
        } catch (error) {
          this.logger.error('Error processing trace:', error);
        }
      }
    });
  }

  async processTrace(data) {
    // Analyze trace patterns
    if (data.spans) {
      await this.analyzeTracePattern(data);
      await this.updateServiceDependencies(data.spans);
      await this.detectAnomalies(data);
    }
  }

  async analyzeTracePattern(trace) {
    // Create trace signature based on service call pattern
    const signature = trace.spans
      .filter(s => !s.parentSpanId) // Root spans
      .map(s => s.serviceName)
      .sort()
      .join('->');

    const key = `trace_patterns:${signature}`;
    await this.redis.hincrby(key, 'count', 1);
    await this.redis.hset(key, 'last_seen', Date.now());
    await this.redis.hincrbyfloat(key, 'total_duration', trace.duration || 0);
    await this.redis.expire(key, 3600);
  }

  async updateServiceDependencies(spans) {
    const dependencies = new Set();
    
    for (const span of spans) {
      const childSpans = spans.filter(s => s.parentSpanId === span.spanId);
      
      for (const child of childSpans) {
        if (child.serviceName !== span.serviceName) {
          dependencies.add(`${span.serviceName}->${child.serviceName}`);
        }
      }
    }

    for (const dep of dependencies) {
      await this.redis.incr(`service_deps:${dep}`);
      await this.redis.expire(`service_deps:${dep}`, 3600);
    }
  }

  async detectAnomalies(trace) {
    if (!trace.duration) return;

    // Simple anomaly detection based on duration
    const key = `trace_durations:${trace.rootService}`;
    const durations = await this.redis.lrange(key, 0, 99);
    
    if (durations.length >= 10) {
      const values = durations.map(d => parseFloat(d));
      const p95 = quantile(values, 0.95);
      const p99 = quantile(values, 0.99);
      
      if (trace.duration > p99) {
        await this.publish('alerts:slow_trace', {
          traceId: trace.traceId,
          duration: trace.duration,
          p99,
          service: trace.rootService,
          timestamp: trace.startTime
        });
      }
    }

    await this.redis.lpush(key, trace.duration);
    await this.redis.ltrim(key, 0, 99);
    await this.redis.expire(key, 3600);
  }

  async getTrace(traceId) {
    // Get trace metadata
    const traceQuery = `
      SELECT * FROM airis_epm.traces 
      WHERE trace_id = '${traceId}'
    `;
    const traces = await this.clickhouse.query(traceQuery).toPromise();
    
    if (traces.length === 0) return null;

    // Get all spans for this trace
    const spansQuery = `
      SELECT * FROM airis_epm.spans 
      WHERE trace_id = '${traceId}'
      ORDER BY start_time
    `;
    const spans = await this.clickhouse.query(spansQuery).toPromise();

    return {
      ...traces[0],
      spans: spans.map(s => ({
        ...s,
        tags: JSON.parse(s.tags || '{}'),
        logs: JSON.parse(s.logs || '[]'),
        status: JSON.parse(s.status || '{}')
      }))
    };
  }

  async searchTraces(params) {
    const { service, operation, minDuration, maxDuration, from, to, tags, limit, offset } = params;
    
    let query = `
      SELECT * FROM airis_epm.traces t
      WHERE t.start_time >= '${moment(from).format('YYYY-MM-DD HH:mm:ss')}'
        AND t.start_time <= '${moment(to).format('YYYY-MM-DD HH:mm:ss')}'
    `;
    
    if (service) {
      query += ` AND has(JSONExtractArrayRaw(t.services), '${service}')`;
    }
    
    if (minDuration) {
      query += ` AND t.duration >= ${minDuration}`;
    }
    
    if (maxDuration) {
      query += ` AND t.duration <= ${maxDuration}`;
    }
    
    if (operation) {
      query += ` AND t.trace_id IN (
        SELECT DISTINCT trace_id FROM airis_epm.spans 
        WHERE operation_name = '${operation}'
      )`;
    }
    
    query += ` ORDER BY t.start_time DESC LIMIT ${limit} OFFSET ${offset}`;

    const result = await this.clickhouse.query(query).toPromise();
    return result.map(t => ({
      ...t,
      services: JSON.parse(t.services || '[]')
    }));
  }

  async getServiceDependencies(from, to) {
    const query = `
      SELECT 
        s1.service_name as from_service,
        s2.service_name as to_service,
        count(*) as call_count,
        avg(s2.duration) as avg_duration
      FROM airis_epm.spans s1
      JOIN airis_epm.spans s2 ON s1.trace_id = s2.trace_id AND s1.span_id = s2.parent_span_id
      WHERE s1.start_time >= '${moment(from).format('YYYY-MM-DD HH:mm:ss')}'
        AND s1.start_time <= '${moment(to).format('YYYY-MM-DD HH:mm:ss')}'
        AND s1.service_name != s2.service_name
      GROUP BY s1.service_name, s2.service_name
      ORDER BY call_count DESC
    `;

    return await this.clickhouse.query(query).toPromise();
  }

  async getServiceMap(from, to) {
    const dependencies = await this.getServiceDependencies(from, to);
    
    const services = new Set();
    const links = [];
    
    dependencies.forEach(dep => {
      services.add(dep.from_service);
      services.add(dep.to_service);
      links.push({
        source: dep.from_service,
        target: dep.to_service,
        calls: dep.call_count,
        avgDuration: dep.avg_duration
      });
    });

    // Get service stats
    const serviceStats = await Promise.all(
      Array.from(services).map(async service => {
        const stats = await this.getServiceStats(service, from, to);
        return {
          name: service,
          ...stats
        };
      })
    );

    return {
      nodes: serviceStats,
      links
    };
  }

  async getServiceStats(service, from, to) {
    const query = `
      SELECT 
        count(*) as span_count,
        avg(duration) as avg_duration,
        quantile(0.95)(duration) as p95_duration,
        quantile(0.99)(duration) as p99_duration,
        countIf(JSONExtractString(status, 'code') != '0') as error_count
      FROM airis_epm.spans
      WHERE service_name = '${service}'
        AND start_time >= '${moment(from).format('YYYY-MM-DD HH:mm:ss')}'
        AND start_time <= '${moment(to).format('YYYY-MM-DD HH:mm:ss')}'
    `;

    const result = await this.clickhouse.query(query).toPromise();
    return result[0] || {};
  }

  async getOperationStats(service, from, to) {
    const query = `
      SELECT 
        operation_name,
        count(*) as call_count,
        avg(duration) as avg_duration,
        quantile(0.5)(duration) as p50_duration,
        quantile(0.95)(duration) as p95_duration,
        quantile(0.99)(duration) as p99_duration,
        countIf(JSONExtractString(status, 'code') != '0') as error_count,
        error_count * 100.0 / call_count as error_rate
      FROM airis_epm.spans
      WHERE service_name = '${service}'
        AND start_time >= '${moment(from).format('YYYY-MM-DD HH:mm:ss')}'
        AND start_time <= '${moment(to).format('YYYY-MM-DD HH:mm:ss')}'
      GROUP BY operation_name
      ORDER BY call_count DESC
    `;

    return await this.clickhouse.query(query).toPromise();
  }

  async getPerformanceMetrics(params) {
    const { service, operation, from, to } = params;
    
    let whereClause = `
      WHERE start_time >= '${moment(from).format('YYYY-MM-DD HH:mm:ss')}'
        AND start_time <= '${moment(to).format('YYYY-MM-DD HH:mm:ss')}'
    `;
    
    if (service) {
      whereClause += ` AND service_name = '${service}'`;
    }
    
    if (operation) {
      whereClause += ` AND operation_name = '${operation}'`;
    }

    const query = `
      SELECT 
        toStartOfMinute(start_time) as minute,
        count(*) as requests,
        avg(duration) as avg_duration,
        quantile(0.95)(duration) as p95_duration,
        countIf(JSONExtractString(status, 'code') != '0') as errors
      FROM airis_epm.spans
      ${whereClause}
      GROUP BY minute
      ORDER BY minute
    `;

    return await this.clickhouse.query(query).toPromise();
  }

  async getErrorAnalysis(params) {
    const { service, from, to } = params;
    
    let whereClause = `
      WHERE start_time >= '${moment(from).format('YYYY-MM-DD HH:mm:ss')}'
        AND start_time <= '${moment(to).format('YYYY-MM-DD HH:mm:ss')}'
        AND JSONExtractString(status, 'code') != '0'
    `;
    
    if (service) {
      whereClause += ` AND service_name = '${service}'`;
    }

    const query = `
      SELECT 
        service_name,
        operation_name,
        JSONExtractString(status, 'message') as error_message,
        count(*) as error_count,
        max(start_time) as last_seen
      FROM airis_epm.spans
      ${whereClause}
      GROUP BY service_name, operation_name, error_message
      ORDER BY error_count DESC
      LIMIT 100
    `;

    return await this.clickhouse.query(query).toPromise();
  }

  async getTraceStats() {
    const hourly = await this.clickhouse.query(`
      SELECT 
        count(*) as trace_count,
        count(DISTINCT services) as service_count,
        avg(duration) as avg_duration
      FROM airis_epm.traces
      WHERE start_time >= now() - INTERVAL 1 HOUR
    `).toPromise();

    const daily = await this.clickhouse.query(`
      SELECT 
        count(*) as trace_count,
        count(DISTINCT services) as service_count,
        avg(duration) as avg_duration,
        quantile(0.95)(duration) as p95_duration
      FROM airis_epm.traces
      WHERE start_time >= today()
    `).toPromise();

    return {
      hourly: hourly[0] || {},
      daily: daily[0] || {},
      buffer: {
        traces: this.tracesBuffer.length,
        spans: this.spansBuffer.length,
        maxSize: this.bufferSize
      }
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
        traces: this.tracesBuffer.length,
        spans: this.spansBuffer.length,
        status: (this.tracesBuffer.length + this.spansBuffer.length) < this.bufferSize * 0.9 ? 'healthy' : 'warning'
      }
    };
  }

  getFeatures() {
    return [
      'distributed-tracing',
      'trace-analysis',
      'service-dependencies',
      'performance-metrics',
      'error-analysis',
      'anomaly-detection',
      'service-map',
      'real-time-processing'
    ];
  }

  async cleanup() {
    // Flush remaining buffers
    await this.flushBuffer();
    
    // Disconnect Kafka
    if (this.producer) {
      await this.producer.disconnect();
    }
    
    this.logger.info('Traces service cleanup complete');
  }
}

// Start the service
const service = new TracesService();
service.start();