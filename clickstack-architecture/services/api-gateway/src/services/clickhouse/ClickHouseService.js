const { createClient } = require('@clickhouse/client');
const Redis = require('redis');
const logger = require('../../../utils/logger');
const { promisify } = require('util');

/**
 * ClickHouse service for AIRIS-MON with Korean timezone support
 * Implements ClickStack architecture patterns for unified observability
 */
class ClickHouseService {
  constructor(config = {}) {
    this.config = {
      clickhouse: {
        host: config.clickhouse?.host || process.env.CLICKHOUSE_HOST || 'localhost',
        port: config.clickhouse?.port || process.env.CLICKHOUSE_PORT || 8123,
        username: config.clickhouse?.username || process.env.CLICKHOUSE_USER || 'default',
        password: config.clickhouse?.password || process.env.CLICKHOUSE_PASSWORD || '',
        database: config.clickhouse?.database || process.env.CLICKHOUSE_DATABASE || 'airis_mon',
        max_open_connections: config.clickhouse?.max_open_connections || 10,
        request_timeout: config.clickhouse?.request_timeout || 30000,
        compression: {
          request: true,
          response: true
        }
      },
      redis: {
        host: config.redis?.host || process.env.REDIS_HOST || 'localhost',
        port: config.redis?.port || process.env.REDIS_PORT || 6379,
        password: config.redis?.password || process.env.REDIS_PASSWORD || null,
        db: config.redis?.db || 0,
        ttl: config.redis?.ttl || 3600 // 1 hour cache TTL
      },
      batch: {
        size: config.batch?.size || 1000,
        flushInterval: config.batch?.flushInterval || 5000, // 5 seconds
        maxRetries: config.batch?.maxRetries || 3
      },
      korean: {
        timezone: 'Asia/Seoul',
        locale: 'ko-KR'
      }
    };

    this.client = null;
    this.redisClient = null;
    this.batchBuffer = [];
    this.batchTimer = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    
    // Performance metrics
    this.metrics = {
      queries: 0,
      inserts: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
  }

  /**
   * Initialize ClickHouse and Redis connections
   */
  async initialize() {
    try {
      await this.connectClickHouse();
      await this.connectRedis();
      await this.createTables();
      this.startBatchProcessor();
      
      logger.info('ClickHouse service initialized successfully', {
        database: this.config.clickhouse.database,
        timezone: this.config.korean.timezone
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize ClickHouse service', { error: error.message });
      throw error;
    }
  }

  /**
   * Connect to ClickHouse with retry logic
   */
  async connectClickHouse() {
    try {
      this.client = createClient({
        host: `http://${this.config.clickhouse.host}:${this.config.clickhouse.port}`,
        username: this.config.clickhouse.username,
        password: this.config.clickhouse.password,
        database: this.config.clickhouse.database,
        request_timeout: this.config.clickhouse.request_timeout,
        compression: this.config.clickhouse.compression,
        max_open_connections: this.config.clickhouse.max_open_connections,
        keep_alive: {
          enabled: true
        },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          timezone: this.config.korean.timezone,
          max_memory_usage: '10000000000', // 10GB
          max_execution_time: 300 // 5 minutes
        }
      });

      // Test connection
      await this.client.ping();
      this.isConnected = true;
      this.retryCount = 0;
      
      logger.info('ClickHouse connection established', {
        host: this.config.clickhouse.host,
        database: this.config.clickhouse.database
      });

    } catch (error) {
      this.isConnected = false;
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = Math.pow(2, this.retryCount) * 1000; // Exponential backoff
        
        logger.warn(`ClickHouse connection failed, retrying in ${delay}ms`, {
          attempt: this.retryCount,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connectClickHouse();
      }
      
      throw new Error(`Failed to connect to ClickHouse after ${this.maxRetries} attempts: ${error.message}`);
    }
  }

  /**
   * Connect to Redis for query caching
   */
  async connectRedis() {
    try {
      this.redisClient = Redis.createClient({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('Redis server refused connection');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      await this.redisClient.connect();
      
      logger.info('Redis connection established for query caching');
    } catch (error) {
      logger.warn('Redis connection failed, caching disabled', { error: error.message });
      this.redisClient = null;
    }
  }

  /**
   * Create ClickHouse tables and materialized views
   */
  async createTables() {
    const schemas = require('./schemas');
    
    try {
      // Create database
      await this.client.exec({
        query: `CREATE DATABASE IF NOT EXISTS ${this.config.clickhouse.database}`
      });

      // Create wide events table
      await this.client.exec({
        query: schemas.createWideEventsTable(this.config.korean.timezone)
      });

      // Create metrics materialized views
      for (const viewQuery of schemas.createMetricViews()) {
        await this.client.exec({ query: viewQuery });
      }

      // Create indexes
      for (const indexQuery of schemas.createIndexes()) {
        await this.client.exec({ query: indexQuery });
      }

      logger.info('ClickHouse tables and views created successfully');
    } catch (error) {
      logger.error('Failed to create ClickHouse tables', { error: error.message });
      throw error;
    }
  }

  /**
   * Insert wide event data with batch processing
   */
  async insertWideEvent(eventData) {
    const enrichedEvent = this.enrichEventData(eventData);
    
    if (this.config.batch.size > 1) {
      this.batchBuffer.push(enrichedEvent);
      
      if (this.batchBuffer.length >= this.config.batch.size) {
        await this.flushBatch();
      }
    } else {
      await this.insertBatch([enrichedEvent]);
    }
  }

  /**
   * Insert multiple wide events in batch
   */
  async insertWideEvents(eventsData) {
    const enrichedEvents = eventsData.map(event => this.enrichEventData(event));
    
    if (this.config.batch.size > 1) {
      this.batchBuffer.push(...enrichedEvents);
      
      if (this.batchBuffer.length >= this.config.batch.size) {
        await this.flushBatch();
      }
    } else {
      await this.insertBatch(enrichedEvents);
    }
  }

  /**
   * Enrich event data with Korean timezone and metadata
   */
  enrichEventData(eventData) {
    const now = new Date();
    const koreanTime = new Intl.DateTimeFormat('ko-KR', {
      timeZone: this.config.korean.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);

    return {
      timestamp: now.toISOString(),
      korean_timestamp: koreanTime,
      event_id: eventData.event_id || this.generateEventId(),
      event_type: eventData.event_type || 'unknown',
      source: eventData.source || 'airis-mon',
      service_name: eventData.service_name || 'unknown',
      environment: eventData.environment || process.env.NODE_ENV || 'development',
      
      // Metrics
      metric_name: eventData.metric_name || null,
      metric_value: eventData.metric_value || null,
      metric_unit: eventData.metric_unit || null,
      metric_tags: JSON.stringify(eventData.metric_tags || {}),
      
      // Logs
      log_level: eventData.log_level || null,
      log_message: eventData.log_message || null,
      log_context: JSON.stringify(eventData.log_context || {}),
      
      // Traces
      trace_id: eventData.trace_id || null,
      span_id: eventData.span_id || null,
      parent_span_id: eventData.parent_span_id || null,
      span_name: eventData.span_name || null,
      span_duration: eventData.span_duration || null,
      span_status: eventData.span_status || null,
      
      // Alerts
      alert_name: eventData.alert_name || null,
      alert_severity: eventData.alert_severity || null,
      alert_status: eventData.alert_status || null,
      alert_message: eventData.alert_message || null,
      
      // Additional attributes
      attributes: JSON.stringify(eventData.attributes || {}),
      labels: JSON.stringify(eventData.labels || {}),
      
      // Korean specific fields
      korean_date: this.getKoreanDate(now),
      korean_hour: this.getKoreanHour(now),
      korean_day_of_week: this.getKoreanDayOfWeek(now),
      
      created_at: now.toISOString()
    };
  }

  /**
   * Execute batch insert with retry logic
   */
  async insertBatch(events) {
    if (!events.length) return;

    let retryCount = 0;
    
    while (retryCount < this.config.batch.maxRetries) {
      try {
        await this.client.insert({
          table: 'wide_events',
          values: events,
          format: 'JSONEachRow'
        });
        
        this.metrics.inserts += events.length;
        
        logger.debug(`Inserted ${events.length} events to ClickHouse`, {
          batchSize: events.length,
          totalInserts: this.metrics.inserts
        });
        
        return;
      } catch (error) {
        retryCount++;
        this.metrics.errors++;
        
        if (retryCount >= this.config.batch.maxRetries) {
          logger.error(`Failed to insert batch after ${retryCount} retries`, {
            error: error.message,
            batchSize: events.length
          });
          throw error;
        }
        
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Flush batch buffer
   */
  async flushBatch() {
    if (this.batchBuffer.length === 0) return;
    
    const events = [...this.batchBuffer];
    this.batchBuffer = [];
    
    await this.insertBatch(events);
  }

  /**
   * Start batch processor timer
   */
  startBatchProcessor() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    
    this.batchTimer = setInterval(async () => {
      await this.flushBatch();
    }, this.config.batch.flushInterval);
  }

  /**
   * Execute query with caching
   */
  async query(queryString, params = {}) {
    const cacheKey = this.generateCacheKey(queryString, params);
    
    try {
      // Try cache first
      if (this.redisClient) {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          return JSON.parse(cached);
        }
        this.metrics.cacheMisses++;
      }
      
      // Execute query
      const result = await this.client.query({
        query: queryString,
        query_params: params,
        format: 'JSON'
      });
      
      const data = await result.json();
      this.metrics.queries++;
      
      // Cache result
      if (this.redisClient && data) {
        await this.redisClient.setex(cacheKey, this.config.redis.ttl, JSON.stringify(data));
      }
      
      return data;
    } catch (error) {
      this.metrics.errors++;
      logger.error('ClickHouse query failed', {
        error: error.message,
        query: queryString,
        params
      });
      throw error;
    }
  }

  /**
   * Stream large result sets
   */
  async stream(queryString, params = {}) {
    try {
      const result = await this.client.query({
        query: queryString,
        query_params: params,
        format: 'JSONEachRow'
      });
      
      this.metrics.queries++;
      return result.stream();
    } catch (error) {
      this.metrics.errors++;
      logger.error('ClickHouse stream query failed', {
        error: error.message,
        query: queryString,
        params
      });
      throw error;
    }
  }

  /**
   * Get real-time metrics for dashboard
   */
  async getDashboardMetrics(timeRange = '1h', filters = {}) {
    const queryBuilder = require('./queryBuilder');
    
    const queries = {
      overview: queryBuilder.getOverviewMetrics(timeRange, filters),
      timeseries: queryBuilder.getTimeseriesMetrics(timeRange, filters),
      topServices: queryBuilder.getTopServices(timeRange, filters),
      errorRates: queryBuilder.getErrorRates(timeRange, filters),
      performance: queryBuilder.getPerformanceMetrics(timeRange, filters)
    };
    
    const results = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        results[key] = await this.query(query);
      } catch (error) {
        logger.error(`Failed to fetch ${key} metrics`, { error: error.message });
        results[key] = null;
      }
    }
    
    return results;
  }

  /**
   * Detect anomalies using Korean business hours context
   */
  async detectAnomalies(metricName, timeRange = '24h', sensitivity = 'medium') {
    const queryBuilder = require('./queryBuilder');
    
    const query = queryBuilder.getAnomalyDetectionQuery(
      metricName, 
      timeRange, 
      sensitivity,
      this.config.korean.timezone
    );
    
    return await this.query(query);
  }

  /**
   * Get Korean-optimized time range data
   */
  async getKoreanTimeRangeData(startTime, endTime, aggregation = 'hour') {
    const queryBuilder = require('./queryBuilder');
    
    const query = queryBuilder.getKoreanTimeRangeQuery(
      startTime,
      endTime,
      aggregation,
      this.config.korean.timezone
    );
    
    return await this.query(query);
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.client.ping();
      
      const stats = await this.query('SELECT count() as total_events FROM wide_events');
      
      return {
        status: 'healthy',
        connected: this.isConnected,
        metrics: this.metrics,
        totalEvents: stats.data?.[0]?.total_events || 0,
        batchBufferSize: this.batchBuffer.length,
        redis: this.redisClient ? 'connected' : 'disconnected'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false,
        metrics: this.metrics
      };
    }
  }

  /**
   * Utility methods
   */
  generateEventId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCacheKey(query, params) {
    const hash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify({ query, params }))
      .digest('hex');
    return `clickhouse:query:${hash}`;
  }

  getKoreanDate(date = new Date()) {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: this.config.korean.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  getKoreanHour(date = new Date()) {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: this.config.korean.timezone,
      hour: '2-digit',
      hour12: false
    }).format(date).replace('시', '');
  }

  getKoreanDayOfWeek(date = new Date()) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const koreanDate = new Date(date.toLocaleString('en-US', {
      timeZone: this.config.korean.timezone
    }));
    return days[koreanDate.getDay()];
  }

  /**
   * Cleanup and close connections
   */
  async close() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    
    // Flush remaining batch
    await this.flushBatch();
    
    if (this.client) {
      await this.client.close();
    }
    
    if (this.redisClient) {
      await this.redisClient.disconnect();
    }
    
    logger.info('ClickHouse service closed');
  }
}

module.exports = ClickHouseService;