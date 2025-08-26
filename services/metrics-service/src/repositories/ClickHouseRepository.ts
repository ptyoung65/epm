import { createClient, ClickHouseClient } from '@clickhouse/client';

export interface ClickHouseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface QueryOptions {
  startTime: Date;
  endTime: Date;
  metricNames?: string[];
  labels?: Record<string, string>;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  groupBy?: string[];
  interval?: string;
  limit?: number;
}

export class ClickHouseRepository {
  private client: ClickHouseClient;
  private config: ClickHouseConfig;

  constructor(config: ClickHouseConfig) {
    this.config = config;
    this.client = createClient({
      host: `http://${config.host}:${config.port}`,
      username: config.username,
      password: config.password,
      database: config.database,
      clickhouse_settings: {
        async_insert: 1,
        wait_for_async_insert: 1,
        async_insert_max_data_size: '10485760', // 10MB
        async_insert_busy_timeout_ms: 1000
      }
    });
  }

  /**
   * Initialize database and tables
   */
  async initialize(): Promise<void> {
    await this.createDatabase();
    await this.createTables();
    await this.createMaterializedViews();
  }

  /**
   * Create database if not exists
   */
  private async createDatabase(): Promise<void> {
    await this.client.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${this.config.database}`
    });
  }

  /**
   * Create required tables
   */
  private async createTables(): Promise<void> {
    // Main metrics table
    await this.client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS metrics (
          name String,
          value Float64,
          timestamp DateTime64(3),
          date Date DEFAULT toDate(timestamp),
          labels Map(String, String),
          metadata String,
          INDEX idx_name name TYPE bloom_filter GRANULARITY 1,
          INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 1
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(date)
        ORDER BY (name, timestamp)
        TTL date + INTERVAL 90 DAY
        SETTINGS index_granularity = 8192
      `
    });

    // Aggregated metrics table (5-minute buckets)
    await this.client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS metrics_5m (
          name String,
          timestamp DateTime,
          date Date DEFAULT toDate(timestamp),
          labels Map(String, String),
          count UInt64,
          sum Float64,
          min Float64,
          max Float64,
          avg Float64,
          p50 Float64,
          p90 Float64,
          p95 Float64,
          p99 Float64
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(date)
        ORDER BY (name, timestamp)
        TTL date + INTERVAL 30 DAY
        SETTINGS index_granularity = 8192
      `
    });

    // Hourly aggregated metrics
    await this.client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS metrics_1h (
          name String,
          timestamp DateTime,
          date Date DEFAULT toDate(timestamp),
          labels Map(String, String),
          count UInt64,
          sum Float64,
          min Float64,
          max Float64,
          avg Float64,
          p50 Float64,
          p90 Float64,
          p95 Float64,
          p99 Float64
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(date)
        ORDER BY (name, timestamp)
        TTL date + INTERVAL 365 DAY
        SETTINGS index_granularity = 8192
      `
    });
  }

  /**
   * Create materialized views for real-time aggregation
   */
  private async createMaterializedViews(): Promise<void> {
    // 5-minute aggregation view
    await this.client.exec({
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_5m_mv
        TO metrics_5m
        AS SELECT
          name,
          toStartOfFiveMinutes(timestamp) AS timestamp,
          labels,
          count() AS count,
          sum(value) AS sum,
          min(value) AS min,
          max(value) AS max,
          avg(value) AS avg,
          quantile(0.5)(value) AS p50,
          quantile(0.9)(value) AS p90,
          quantile(0.95)(value) AS p95,
          quantile(0.99)(value) AS p99
        FROM metrics
        GROUP BY name, timestamp, labels
      `
    });

    // Hourly aggregation view
    await this.client.exec({
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1h_mv
        TO metrics_1h
        AS SELECT
          name,
          toStartOfHour(timestamp) AS timestamp,
          labels,
          count() AS count,
          sum(value) AS sum,
          min(value) AS min,
          max(value) AS max,
          avg(value) AS avg,
          quantile(0.5)(value) AS p50,
          quantile(0.9)(value) AS p90,
          quantile(0.95)(value) AS p95,
          quantile(0.99)(value) AS p99
        FROM metrics
        GROUP BY name, timestamp, labels
      `
    });
  }

  /**
   * Insert single metric
   */
  async insertMetric(metric: Metric): Promise<void> {
    await this.client.insert({
      table: 'metrics',
      values: [{
        name: metric.name,
        value: metric.value,
        timestamp: metric.timestamp,
        labels: metric.labels,
        metadata: metric.metadata ? JSON.stringify(metric.metadata) : ''
      }],
      format: 'JSONEachRow'
    });
  }

  /**
   * Batch insert metrics
   */
  async insertMetricsBatch(metrics: Metric[]): Promise<void> {
    if (metrics.length === 0) return;

    const values = metrics.map(metric => ({
      name: metric.name,
      value: metric.value,
      timestamp: metric.timestamp,
      labels: metric.labels,
      metadata: metric.metadata ? JSON.stringify(metric.metadata) : ''
    }));

    await this.client.insert({
      table: 'metrics',
      values,
      format: 'JSONEachRow'
    });
  }

  /**
   * Query metrics
   */
  async queryMetrics(options: QueryOptions): Promise<any[]> {
    let query = this.buildQuery(options);
    
    const result = await this.client.query({
      query,
      format: 'JSONEachRow'
    });

    return await result.json();
  }

  /**
   * Build query from options
   */
  private buildQuery(options: QueryOptions): string {
    const table = this.selectTable(options);
    const select = this.buildSelectClause(options);
    const where = this.buildWhereClause(options);
    const groupBy = this.buildGroupByClause(options);
    const orderBy = 'ORDER BY timestamp ASC';
    const limit = options.limit ? `LIMIT ${options.limit}` : '';

    return `${select} FROM ${table} ${where} ${groupBy} ${orderBy} ${limit}`;
  }

  /**
   * Select appropriate table based on query range
   */
  private selectTable(options: QueryOptions): string {
    const range = options.endTime.getTime() - options.startTime.getTime();
    const hours = range / (1000 * 60 * 60);

    if (hours > 24 * 7) {
      return 'metrics_1h'; // Use hourly table for queries > 1 week
    } else if (hours > 24) {
      return 'metrics_5m'; // Use 5-minute table for queries > 1 day
    } else {
      return 'metrics'; // Use raw table for recent queries
    }
  }

  /**
   * Build SELECT clause
   */
  private buildSelectClause(options: QueryOptions): string {
    if (options.aggregation && options.interval) {
      const timeFunc = this.getTimeFunction(options.interval);
      const aggFunc = options.aggregation;
      return `SELECT 
        name,
        ${timeFunc}(timestamp) AS timestamp,
        ${aggFunc}(value) AS value,
        labels`;
    } else if (options.aggregation) {
      return `SELECT 
        name,
        ${options.aggregation}(value) AS value,
        labels`;
    } else {
      return 'SELECT name, value, timestamp, labels';
    }
  }

  /**
   * Build WHERE clause
   */
  private buildWhereClause(options: QueryOptions): string {
    const conditions: string[] = [
      `timestamp >= '${options.startTime.toISOString()}'`,
      `timestamp <= '${options.endTime.toISOString()}'`
    ];

    if (options.metricNames && options.metricNames.length > 0) {
      const names = options.metricNames.map(n => `'${n}'`).join(',');
      conditions.push(`name IN (${names})`);
    }

    if (options.labels) {
      Object.entries(options.labels).forEach(([key, value]) => {
        conditions.push(`labels['${key}'] = '${value}'`);
      });
    }

    return `WHERE ${conditions.join(' AND ')}`;
  }

  /**
   * Build GROUP BY clause
   */
  private buildGroupByClause(options: QueryOptions): string {
    if (!options.aggregation) return '';

    const groupByFields = ['name', 'labels'];
    
    if (options.interval) {
      const timeFunc = this.getTimeFunction(options.interval);
      groupByFields.unshift(`${timeFunc}(timestamp)`);
    }

    if (options.groupBy) {
      options.groupBy.forEach(field => {
        if (!groupByFields.includes(field)) {
          groupByFields.push(field);
        }
      });
    }

    return `GROUP BY ${groupByFields.join(', ')}`;
  }

  /**
   * Get time function for interval
   */
  private getTimeFunction(interval: string): string {
    switch (interval) {
      case '1m': return 'toStartOfMinute';
      case '5m': return 'toStartOfFiveMinutes';
      case '15m': return 'toStartOfFifteenMinutes';
      case '1h': return 'toStartOfHour';
      case '1d': return 'toStartOfDay';
      default: return 'toStartOfMinute';
    }
  }

  /**
   * Get metric labels
   */
  async getLabels(metricName?: string): Promise<string[]> {
    let query = 'SELECT DISTINCT arrayJoin(mapKeys(labels)) AS label FROM metrics';
    
    if (metricName) {
      query += ` WHERE name = '${metricName}'`;
    }

    const result = await this.client.query({
      query,
      format: 'JSONEachRow'
    });

    const data = await result.json() as any[];
    return data.map(row => row.label);
  }

  /**
   * Get label values
   */
  async getLabelValues(label: string, metricName?: string): Promise<string[]> {
    let query = `SELECT DISTINCT labels['${label}'] AS value FROM metrics WHERE labels['${label}'] != ''`;
    
    if (metricName) {
      query += ` AND name = '${metricName}'`;
    }

    const result = await this.client.query({
      query,
      format: 'JSONEachRow'
    });

    const data = await result.json() as any[];
    return data.map(row => row.value);
  }

  /**
   * Delete old data
   */
  async cleanupOldData(retentionDays: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    await this.client.exec({
      query: `ALTER TABLE metrics DELETE WHERE date < '${cutoffDate.toISOString().split('T')[0]}'`
    });
  }

  /**
   * Ping database
   */
  async ping(): Promise<void> {
    await this.client.ping();
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}