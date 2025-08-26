const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const _ = require('lodash');

class ETLProcessor {
  constructor({ kafka, redis, clickhouse, mongodb, postgres, logger }) {
    this.kafka = kafka;
    this.redis = redis;
    this.clickhouse = clickhouse;
    this.mongodb = mongodb;
    this.postgres = postgres;
    this.logger = logger;
    
    this.processors = new Map();
    this.processingStats = {
      totalProcessed: 0,
      totalErrors: 0,
      processingRate: 0,
      lastProcessedAt: null
    };
    
    this.batchSize = parseInt(process.env.ETL_BATCH_SIZE || '1000');
    this.batchInterval = parseInt(process.env.ETL_BATCH_INTERVAL || '5000');
    this.isProcessing = false;
  }

  async initialize() {
    try {
      // Initialize ClickHouse tables
      await this.initializeClickHouseTables();
      
      // Initialize processing pipelines
      this.initializeProcessors();
      
      // Initialize cache warming
      await this.warmCache();
      
      this.logger.info('ETL Processor initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ETL Processor:', error);
      throw error;
    }
  }

  async initializeClickHouseTables() {
    const tables = [
      {
        name: 'metrics',
        query: `
          CREATE TABLE IF NOT EXISTS airis_epm.metrics (
            id UUID,
            timestamp DateTime64(3),
            metric_name String,
            metric_value Float64,
            tags Map(String, String),
            source String,
            environment String,
            processed_at DateTime64(3)
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (metric_name, timestamp, id)
          TTL timestamp + INTERVAL 30 DAY
        `
      },
      {
        name: 'logs',
        query: `
          CREATE TABLE IF NOT EXISTS airis_epm.logs (
            id UUID,
            timestamp DateTime64(3),
            level String,
            message String,
            service String,
            host String,
            metadata String,
            processed_at DateTime64(3)
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (service, level, timestamp, id)
          TTL timestamp + INTERVAL 7 DAY
        `
      },
      {
        name: 'traces',
        query: `
          CREATE TABLE IF NOT EXISTS airis_epm.traces (
            trace_id String,
            span_id String,
            parent_span_id Nullable(String),
            operation_name String,
            service_name String,
            start_time DateTime64(6),
            end_time DateTime64(6),
            duration_ms UInt64,
            status_code UInt8,
            tags Map(String, String),
            processed_at DateTime64(3)
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(start_time)
          ORDER BY (trace_id, span_id, start_time)
          TTL start_time + INTERVAL 14 DAY
        `
      },
      {
        name: 'business_metrics',
        query: `
          CREATE TABLE IF NOT EXISTS airis_epm.business_metrics (
            id UUID,
            timestamp DateTime64(3),
            kpi_name String,
            kpi_value Float64,
            business_unit String,
            category String,
            dimensions Map(String, String),
            processed_at DateTime64(3)
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (kpi_name, business_unit, timestamp, id)
          TTL timestamp + INTERVAL 90 DAY
        `
      },
      {
        name: 'aggregated_metrics',
        query: `
          CREATE TABLE IF NOT EXISTS airis_epm.aggregated_metrics (
            period_start DateTime,
            period_end DateTime,
            metric_name String,
            aggregation_type String,
            value Float64,
            count UInt64,
            min_value Float64,
            max_value Float64,
            p50 Float64,
            p95 Float64,
            p99 Float64,
            tags Map(String, String)
          ) ENGINE = SummingMergeTree()
          PARTITION BY toYYYYMM(period_start)
          ORDER BY (metric_name, aggregation_type, period_start)
        `
      }
    ];

    for (const table of tables) {
      try {
        await this.clickhouse.query(table.query).toPromise();
        this.logger.info(`ClickHouse table ${table.name} initialized`);
      } catch (error) {
        this.logger.error(`Error creating table ${table.name}:`, error);
      }
    }
  }

  initializeProcessors() {
    // Metrics processor
    this.processors.set('metrics', {
      transform: this.transformMetrics.bind(this),
      validate: this.validateMetrics.bind(this),
      enrich: this.enrichMetrics.bind(this),
      aggregate: this.aggregateMetrics.bind(this)
    });

    // Logs processor
    this.processors.set('logs', {
      transform: this.transformLogs.bind(this),
      validate: this.validateLogs.bind(this),
      enrich: this.enrichLogs.bind(this),
      parse: this.parseLogs.bind(this)
    });

    // Traces processor
    this.processors.set('traces', {
      transform: this.transformTraces.bind(this),
      validate: this.validateTraces.bind(this),
      enrich: this.enrichTraces.bind(this),
      correlate: this.correlateTraces.bind(this)
    });

    // Business metrics processor
    this.processors.set('business', {
      transform: this.transformBusinessMetrics.bind(this),
      validate: this.validateBusinessMetrics.bind(this),
      enrich: this.enrichBusinessMetrics.bind(this),
      calculate: this.calculateDerivedMetrics.bind(this)
    });
  }

  async warmCache() {
    try {
      // Cache frequently used metadata
      const services = await this.mongodb.collection('services').find({}).toArray();
      for (const service of services) {
        await this.redis.hset('service:metadata', service.name, JSON.stringify(service));
      }

      // Cache thresholds and rules
      const rules = await this.mongodb.collection('processing_rules').find({}).toArray();
      await this.redis.set('processing:rules', JSON.stringify(rules));

      this.logger.info('Cache warmed successfully');
    } catch (error) {
      this.logger.error('Error warming cache:', error);
    }
  }

  async startProcessing() {
    if (this.isProcessing) {
      this.logger.warn('Processing already started');
      return;
    }

    this.isProcessing = true;
    
    // Start consumers for each data type
    await this.startMetricsConsumer();
    await this.startLogsConsumer();
    await this.startTracesConsumer();
    await this.startBusinessMetricsConsumer();
    
    // Start batch processing timer
    this.startBatchProcessor();
    
    this.logger.info('ETL processing started');
  }

  async startMetricsConsumer() {
    const consumer = this.kafka.consumer({ groupId: 'etl-metrics-processor' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'airis-epm-metrics', fromBeginning: false });

    const batch = [];
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          const processed = await this.processMetric(data);
          batch.push(processed);

          if (batch.length >= this.batchSize) {
            await this.flushMetricsBatch(batch.splice(0));
          }
        } catch (error) {
          this.logger.error('Error processing metric:', error);
          this.processingStats.totalErrors++;
        }
      }
    });
  }

  async startLogsConsumer() {
    const consumer = this.kafka.consumer({ groupId: 'etl-logs-processor' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'airis-epm-logs', fromBeginning: false });

    const batch = [];
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          const processed = await this.processLog(data);
          batch.push(processed);

          if (batch.length >= this.batchSize) {
            await this.flushLogsBatch(batch.splice(0));
          }
        } catch (error) {
          this.logger.error('Error processing log:', error);
          this.processingStats.totalErrors++;
        }
      }
    });
  }

  async startTracesConsumer() {
    const consumer = this.kafka.consumer({ groupId: 'etl-traces-processor' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'airis-epm-traces', fromBeginning: false });

    const batch = [];
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          const processed = await this.processTrace(data);
          batch.push(processed);

          if (batch.length >= this.batchSize) {
            await this.flushTracesBatch(batch.splice(0));
          }
        } catch (error) {
          this.logger.error('Error processing trace:', error);
          this.processingStats.totalErrors++;
        }
      }
    });
  }

  async startBusinessMetricsConsumer() {
    const consumer = this.kafka.consumer({ groupId: 'etl-business-processor' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'airis-epm-business-metrics', fromBeginning: false });

    const batch = [];
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          const processed = await this.processBusinessMetric(data);
          batch.push(processed);

          if (batch.length >= this.batchSize) {
            await this.flushBusinessMetricsBatch(batch.splice(0));
          }
        } catch (error) {
          this.logger.error('Error processing business metric:', error);
          this.processingStats.totalErrors++;
        }
      }
    });
  }

  startBatchProcessor() {
    setInterval(async () => {
      try {
        await this.processPendingBatches();
        await this.updateProcessingStats();
      } catch (error) {
        this.logger.error('Error in batch processor:', error);
      }
    }, this.batchInterval);
  }

  async processMetric(data) {
    const processor = this.processors.get('metrics');
    
    let metric = await processor.transform(data);
    metric = await processor.validate(metric);
    metric = await processor.enrich(metric);
    
    this.processingStats.totalProcessed++;
    this.processingStats.lastProcessedAt = new Date();
    
    return metric;
  }

  async processLog(data) {
    const processor = this.processors.get('logs');
    
    let log = await processor.parse(data);
    log = await processor.transform(log);
    log = await processor.validate(log);
    log = await processor.enrich(log);
    
    this.processingStats.totalProcessed++;
    this.processingStats.lastProcessedAt = new Date();
    
    return log;
  }

  async processTrace(data) {
    const processor = this.processors.get('traces');
    
    let trace = await processor.transform(data);
    trace = await processor.validate(trace);
    trace = await processor.enrich(trace);
    trace = await processor.correlate(trace);
    
    this.processingStats.totalProcessed++;
    this.processingStats.lastProcessedAt = new Date();
    
    return trace;
  }

  async processBusinessMetric(data) {
    const processor = this.processors.get('business');
    
    let metric = await processor.transform(data);
    metric = await processor.validate(metric);
    metric = await processor.enrich(metric);
    metric = await processor.calculate(metric);
    
    this.processingStats.totalProcessed++;
    this.processingStats.lastProcessedAt = new Date();
    
    return metric;
  }

  // Transform methods
  async transformMetrics(data) {
    return {
      id: uuidv4(),
      timestamp: moment(data.timestamp || Date.now()).format('YYYY-MM-DD HH:mm:ss.SSS'),
      metric_name: data.name || data.metric_name,
      metric_value: parseFloat(data.value || data.metric_value || 0),
      tags: data.tags || {},
      source: data.source || 'unknown',
      environment: data.environment || process.env.ENVIRONMENT || 'production',
      processed_at: moment().format('YYYY-MM-DD HH:mm:ss.SSS')
    };
  }

  async transformLogs(data) {
    return {
      id: uuidv4(),
      timestamp: moment(data.timestamp || Date.now()).format('YYYY-MM-DD HH:mm:ss.SSS'),
      level: (data.level || 'info').toUpperCase(),
      message: data.message || '',
      service: data.service || 'unknown',
      host: data.host || 'unknown',
      metadata: JSON.stringify(data.metadata || {}),
      processed_at: moment().format('YYYY-MM-DD HH:mm:ss.SSS')
    };
  }

  async transformTraces(data) {
    return {
      trace_id: data.traceId || data.trace_id,
      span_id: data.spanId || data.span_id,
      parent_span_id: data.parentSpanId || data.parent_span_id || null,
      operation_name: data.operationName || data.operation_name,
      service_name: data.serviceName || data.service_name,
      start_time: moment(data.startTime || data.start_time).format('YYYY-MM-DD HH:mm:ss.SSSSSS'),
      end_time: moment(data.endTime || data.end_time).format('YYYY-MM-DD HH:mm:ss.SSSSSS'),
      duration_ms: data.duration || (data.endTime - data.startTime),
      status_code: data.statusCode || data.status_code || 0,
      tags: data.tags || {},
      processed_at: moment().format('YYYY-MM-DD HH:mm:ss.SSS')
    };
  }

  async transformBusinessMetrics(data) {
    return {
      id: uuidv4(),
      timestamp: moment(data.timestamp || Date.now()).format('YYYY-MM-DD HH:mm:ss.SSS'),
      kpi_name: data.kpi || data.kpi_name,
      kpi_value: parseFloat(data.value || data.kpi_value || 0),
      business_unit: data.businessUnit || data.business_unit || 'default',
      category: data.category || 'general',
      dimensions: data.dimensions || {},
      processed_at: moment().format('YYYY-MM-DD HH:mm:ss.SSS')
    };
  }

  // Validation methods
  async validateMetrics(metric) {
    if (!metric.metric_name || metric.metric_value === null || metric.metric_value === undefined) {
      throw new Error('Invalid metric: missing required fields');
    }
    return metric;
  }

  async validateLogs(log) {
    if (!log.message) {
      throw new Error('Invalid log: missing message');
    }
    return log;
  }

  async validateTraces(trace) {
    if (!trace.trace_id || !trace.span_id) {
      throw new Error('Invalid trace: missing trace_id or span_id');
    }
    return trace;
  }

  async validateBusinessMetrics(metric) {
    if (!metric.kpi_name || metric.kpi_value === null || metric.kpi_value === undefined) {
      throw new Error('Invalid business metric: missing required fields');
    }
    return metric;
  }

  // Enrichment methods
  async enrichMetrics(metric) {
    // Add service metadata from cache
    const serviceMetadata = await this.redis.hget('service:metadata', metric.source);
    if (serviceMetadata) {
      const metadata = JSON.parse(serviceMetadata);
      metric.tags = { ...metric.tags, ...metadata.tags };
    }
    return metric;
  }

  async enrichLogs(log) {
    // Add context from cache
    const context = await this.redis.get(`context:${log.service}`);
    if (context) {
      log.metadata = JSON.stringify({
        ...JSON.parse(log.metadata),
        context: JSON.parse(context)
      });
    }
    return log;
  }

  async enrichTraces(trace) {
    // Add service dependencies
    const dependencies = await this.redis.smembers(`dependencies:${trace.service_name}`);
    if (dependencies && dependencies.length > 0) {
      trace.tags.dependencies = dependencies.join(',');
    }
    return trace;
  }

  async enrichBusinessMetrics(metric) {
    // Add business context
    const businessContext = await this.redis.hget('business:context', metric.business_unit);
    if (businessContext) {
      metric.dimensions = { ...metric.dimensions, ...JSON.parse(businessContext) };
    }
    return metric;
  }

  // Additional processing methods
  async parseLogs(data) {
    // Parse structured logs
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return { message: data };
      }
    }
    return data;
  }

  async correlateTraces(trace) {
    // Correlate with parent traces
    if (trace.parent_span_id) {
      const parentKey = `trace:${trace.trace_id}:${trace.parent_span_id}`;
      await this.redis.setex(parentKey, 3600, JSON.stringify(trace));
    }
    return trace;
  }

  async calculateDerivedMetrics(metric) {
    // Calculate derived business metrics
    if (metric.kpi_name === 'revenue') {
      const cost = await this.redis.get(`cost:${metric.business_unit}`);
      if (cost) {
        metric.dimensions.profit = metric.kpi_value - parseFloat(cost);
        metric.dimensions.margin = (metric.dimensions.profit / metric.kpi_value) * 100;
      }
    }
    return metric;
  }

  async aggregateMetrics(metrics) {
    const grouped = _.groupBy(metrics, 'metric_name');
    const aggregated = [];

    for (const [name, values] of Object.entries(grouped)) {
      const stats = {
        period_start: moment().startOf('minute').format('YYYY-MM-DD HH:mm:ss'),
        period_end: moment().endOf('minute').format('YYYY-MM-DD HH:mm:ss'),
        metric_name: name,
        aggregation_type: 'minute',
        value: _.meanBy(values, 'metric_value'),
        count: values.length,
        min_value: _.minBy(values, 'metric_value').metric_value,
        max_value: _.maxBy(values, 'metric_value').metric_value,
        p50: this.percentile(values.map(v => v.metric_value), 0.5),
        p95: this.percentile(values.map(v => v.metric_value), 0.95),
        p99: this.percentile(values.map(v => v.metric_value), 0.99),
        tags: {}
      };
      aggregated.push(stats);
    }

    return aggregated;
  }

  percentile(values, p) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.floor(sorted.length * p);
    return sorted[index];
  }

  // Batch flush methods
  async flushMetricsBatch(batch) {
    if (batch.length === 0) return;

    try {
      const values = batch.map(m => [
        m.id, m.timestamp, m.metric_name, m.metric_value,
        m.tags, m.source, m.environment, m.processed_at
      ]);

      await this.clickhouse.insert(
        'INSERT INTO airis_epm.metrics VALUES',
        values
      ).toPromise();

      // Store aggregated metrics
      const aggregated = await this.aggregateMetrics(batch);
      if (aggregated.length > 0) {
        await this.clickhouse.insert(
          'INSERT INTO airis_epm.aggregated_metrics VALUES',
          aggregated.map(a => Object.values(a))
        ).toPromise();
      }

      this.logger.debug(`Flushed ${batch.length} metrics to ClickHouse`);
    } catch (error) {
      this.logger.error('Error flushing metrics batch:', error);
      throw error;
    }
  }

  async flushLogsBatch(batch) {
    if (batch.length === 0) return;

    try {
      const values = batch.map(l => [
        l.id, l.timestamp, l.level, l.message,
        l.service, l.host, l.metadata, l.processed_at
      ]);

      await this.clickhouse.insert(
        'INSERT INTO airis_epm.logs VALUES',
        values
      ).toPromise();

      this.logger.debug(`Flushed ${batch.length} logs to ClickHouse`);
    } catch (error) {
      this.logger.error('Error flushing logs batch:', error);
      throw error;
    }
  }

  async flushTracesBatch(batch) {
    if (batch.length === 0) return;

    try {
      const values = batch.map(t => [
        t.trace_id, t.span_id, t.parent_span_id, t.operation_name,
        t.service_name, t.start_time, t.end_time, t.duration_ms,
        t.status_code, t.tags, t.processed_at
      ]);

      await this.clickhouse.insert(
        'INSERT INTO airis_epm.traces VALUES',
        values
      ).toPromise();

      this.logger.debug(`Flushed ${batch.length} traces to ClickHouse`);
    } catch (error) {
      this.logger.error('Error flushing traces batch:', error);
      throw error;
    }
  }

  async flushBusinessMetricsBatch(batch) {
    if (batch.length === 0) return;

    try {
      const values = batch.map(b => [
        b.id, b.timestamp, b.kpi_name, b.kpi_value,
        b.business_unit, b.category, b.dimensions, b.processed_at
      ]);

      await this.clickhouse.insert(
        'INSERT INTO airis_epm.business_metrics VALUES',
        values
      ).toPromise();

      this.logger.debug(`Flushed ${batch.length} business metrics to ClickHouse`);
    } catch (error) {
      this.logger.error('Error flushing business metrics batch:', error);
      throw error;
    }
  }

  async processPendingBatches() {
    // Process any pending batches in Redis
    const pendingKeys = await this.redis.keys('batch:pending:*');
    
    for (const key of pendingKeys) {
      try {
        const batch = JSON.parse(await this.redis.get(key));
        const type = key.split(':')[2];
        
        switch (type) {
          case 'metrics':
            await this.flushMetricsBatch(batch);
            break;
          case 'logs':
            await this.flushLogsBatch(batch);
            break;
          case 'traces':
            await this.flushTracesBatch(batch);
            break;
          case 'business':
            await this.flushBusinessMetricsBatch(batch);
            break;
        }
        
        await this.redis.del(key);
      } catch (error) {
        this.logger.error(`Error processing pending batch ${key}:`, error);
      }
    }
  }

  async updateProcessingStats() {
    const now = Date.now();
    const lastUpdate = await this.redis.get('stats:lastUpdate');
    
    if (lastUpdate) {
      const timeDiff = (now - parseInt(lastUpdate)) / 1000; // seconds
      this.processingStats.processingRate = this.processingStats.totalProcessed / timeDiff;
    }
    
    await this.redis.set('stats:lastUpdate', now);
    await this.redis.hset('stats:processing', {
      totalProcessed: this.processingStats.totalProcessed,
      totalErrors: this.processingStats.totalErrors,
      processingRate: this.processingStats.processingRate,
      lastProcessedAt: this.processingStats.lastProcessedAt
    });
  }

  async stopProcessing() {
    this.isProcessing = false;
    // Stop all consumers
    // Note: Actual consumer stopping logic would be implemented here
    this.logger.info('ETL processing stopped');
  }

  async process(data, processingType) {
    switch (processingType) {
      case 'metric':
        return await this.processMetric(data);
      case 'log':
        return await this.processLog(data);
      case 'trace':
        return await this.processTrace(data);
      case 'business':
        return await this.processBusinessMetric(data);
      default:
        throw new Error(`Unknown processing type: ${processingType}`);
    }
  }

  getStatus() {
    return {
      isProcessing: this.isProcessing,
      stats: this.processingStats,
      processors: Array.from(this.processors.keys())
    };
  }
}

module.exports = ETLProcessor;