/**
 * ClickHouse database schemas for AIRIS-MON
 * Optimized for Korean timezone and wide events data model
 */

/**
 * Create wide events table for unified observability data
 */
function createWideEventsTable(timezone = 'Asia/Seoul') {
  return `
    CREATE TABLE IF NOT EXISTS wide_events (
      -- Core event fields
      timestamp DateTime64(3, '${timezone}') CODEC(DoubleDelta),
      korean_timestamp String CODEC(ZSTD(1)),
      event_id String CODEC(ZSTD(1)),
      event_type LowCardinality(String) CODEC(ZSTD(1)),
      source LowCardinality(String) CODEC(ZSTD(1)),
      service_name LowCardinality(String) CODEC(ZSTD(1)),
      environment LowCardinality(String) CODEC(ZSTD(1)),
      
      -- Metrics fields
      metric_name LowCardinality(Nullable(String)) CODEC(ZSTD(1)),
      metric_value Nullable(Float64) CODEC(DoubleDelta),
      metric_unit LowCardinality(Nullable(String)) CODEC(ZSTD(1)),
      metric_tags String CODEC(ZSTD(3)),
      
      -- Logs fields
      log_level LowCardinality(Nullable(String)) CODEC(ZSTD(1)),
      log_message Nullable(String) CODEC(ZSTD(3)),
      log_context String CODEC(ZSTD(3)),
      
      -- Traces fields
      trace_id Nullable(String) CODEC(ZSTD(1)),
      span_id Nullable(String) CODEC(ZSTD(1)),
      parent_span_id Nullable(String) CODEC(ZSTD(1)),
      span_name Nullable(String) CODEC(ZSTD(1)),
      span_duration Nullable(UInt64) CODEC(DoubleDelta),
      span_status LowCardinality(Nullable(String)) CODEC(ZSTD(1)),
      
      -- Alerts fields
      alert_name Nullable(String) CODEC(ZSTD(1)),
      alert_severity LowCardinality(Nullable(String)) CODEC(ZSTD(1)),
      alert_status LowCardinality(Nullable(String)) CODEC(ZSTD(1)),
      alert_message Nullable(String) CODEC(ZSTD(3)),
      
      -- Additional attributes
      attributes String CODEC(ZSTD(3)),
      labels String CODEC(ZSTD(3)),
      
      -- Korean specific fields
      korean_date String CODEC(ZSTD(1)),
      korean_hour UInt8 CODEC(DoubleDelta),
      korean_day_of_week LowCardinality(String) CODEC(ZSTD(1)),
      
      -- Metadata
      created_at DateTime64(3, '${timezone}') DEFAULT now64(3, '${timezone}') CODEC(DoubleDelta)
    )
    ENGINE = MergeTree()
    PARTITION BY toYYYYMM(timestamp, '${timezone}')
    ORDER BY (service_name, event_type, timestamp, event_id)
    TTL timestamp + INTERVAL 90 DAY DELETE
    SETTINGS index_granularity = 8192,
             ttl_only_drop_parts = 1,
             merge_with_ttl_timeout = 3600
  `;
}

/**
 * Create materialized views for real-time metrics aggregation
 */
function createMetricViews() {
  const views = [];

  // Metrics summary by service and minute
  views.push(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_by_service_minute_mv
    TO metrics_by_service_minute
    AS SELECT
      toStartOfMinute(timestamp, 'Asia/Seoul') as minute,
      service_name,
      metric_name,
      metric_unit,
      count() as sample_count,
      avg(metric_value) as avg_value,
      min(metric_value) as min_value,
      max(metric_value) as max_value,
      sum(metric_value) as sum_value,
      quantile(0.5)(metric_value) as p50_value,
      quantile(0.95)(metric_value) as p95_value,
      quantile(0.99)(metric_value) as p99_value
    FROM wide_events
    WHERE event_type = 'metric' AND metric_value IS NOT NULL
    GROUP BY minute, service_name, metric_name, metric_unit
  `);

  // Error rates by service and hour
  views.push(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS error_rates_by_service_hour_mv
    TO error_rates_by_service_hour
    AS SELECT
      toStartOfHour(timestamp, 'Asia/Seoul') as hour,
      service_name,
      korean_hour,
      korean_day_of_week,
      countIf(log_level IN ('ERROR', 'FATAL')) as error_count,
      countIf(log_level = 'WARN') as warning_count,
      count() as total_count,
      error_count / total_count * 100 as error_rate,
      warning_count / total_count * 100 as warning_rate
    FROM wide_events
    WHERE event_type = 'log'
    GROUP BY hour, service_name, korean_hour, korean_day_of_week
  `);

  // Performance metrics by service and span
  views.push(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS performance_by_service_span_mv
    TO performance_by_service_span
    AS SELECT
      toStartOfMinute(timestamp, 'Asia/Seoul') as minute,
      service_name,
      span_name,
      span_status,
      count() as span_count,
      avg(span_duration) as avg_duration,
      min(span_duration) as min_duration,
      max(span_duration) as max_duration,
      quantile(0.5)(span_duration) as p50_duration,
      quantile(0.95)(span_duration) as p95_duration,
      quantile(0.99)(span_duration) as p99_duration,
      countIf(span_status != 'OK') as error_spans
    FROM wide_events
    WHERE event_type = 'trace' AND span_duration IS NOT NULL
    GROUP BY minute, service_name, span_name, span_status
  `);

  // Alert summary by severity and hour
  views.push(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS alerts_by_severity_hour_mv
    TO alerts_by_severity_hour
    AS SELECT
      toStartOfHour(timestamp, 'Asia/Seoul') as hour,
      service_name,
      alert_severity,
      alert_status,
      korean_hour,
      korean_day_of_week,
      count() as alert_count,
      uniq(alert_name) as unique_alerts,
      countIf(alert_status = 'FIRING') as firing_count,
      countIf(alert_status = 'RESOLVED') as resolved_count
    FROM wide_events
    WHERE event_type = 'alert' AND alert_name IS NOT NULL
    GROUP BY hour, service_name, alert_severity, alert_status, korean_hour, korean_day_of_week
  `);

  // Korean business hours analysis
  views.push(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS korean_business_hours_mv
    TO korean_business_hours
    AS SELECT
      korean_date,
      korean_hour,
      korean_day_of_week,
      service_name,
      event_type,
      count() as event_count,
      countIf(log_level IN ('ERROR', 'FATAL')) as error_count,
      countIf(alert_severity IN ('CRITICAL', 'HIGH')) as critical_alerts,
      avg(metric_value) as avg_metric_value,
      avg(span_duration) as avg_response_time,
      CASE
        WHEN korean_day_of_week IN ('토', '일') THEN 'weekend'
        WHEN korean_hour BETWEEN 9 AND 18 THEN 'business_hours'
        WHEN korean_hour BETWEEN 19 AND 22 THEN 'evening'
        ELSE 'night'
      END as time_category
    FROM wide_events
    GROUP BY korean_date, korean_hour, korean_day_of_week, service_name, event_type
  `);

  return views;
}

/**
 * Create destination tables for materialized views
 */
function createDestinationTables() {
  const tables = [];

  // Metrics by service minute table
  tables.push(`
    CREATE TABLE IF NOT EXISTS metrics_by_service_minute (
      minute DateTime CODEC(DoubleDelta),
      service_name LowCardinality(String) CODEC(ZSTD(1)),
      metric_name LowCardinality(String) CODEC(ZSTD(1)),
      metric_unit LowCardinality(String) CODEC(ZSTD(1)),
      sample_count UInt64 CODEC(DoubleDelta),
      avg_value Float64 CODEC(DoubleDelta),
      min_value Float64 CODEC(DoubleDelta),
      max_value Float64 CODEC(DoubleDelta),
      sum_value Float64 CODEC(DoubleDelta),
      p50_value Float64 CODEC(DoubleDelta),
      p95_value Float64 CODEC(DoubleDelta),
      p99_value Float64 CODEC(DoubleDelta)
    )
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(minute)
    ORDER BY (service_name, metric_name, minute)
    TTL minute + INTERVAL 30 DAY DELETE
  `);

  // Error rates by service hour table
  tables.push(`
    CREATE TABLE IF NOT EXISTS error_rates_by_service_hour (
      hour DateTime CODEC(DoubleDelta),
      service_name LowCardinality(String) CODEC(ZSTD(1)),
      korean_hour UInt8 CODEC(DoubleDelta),
      korean_day_of_week LowCardinality(String) CODEC(ZSTD(1)),
      error_count UInt64 CODEC(DoubleDelta),
      warning_count UInt64 CODEC(DoubleDelta),
      total_count UInt64 CODEC(DoubleDelta),
      error_rate Float64 CODEC(DoubleDelta),
      warning_rate Float64 CODEC(DoubleDelta)
    )
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(hour)
    ORDER BY (service_name, hour)
    TTL hour + INTERVAL 90 DAY DELETE
  `);

  // Performance by service span table
  tables.push(`
    CREATE TABLE IF NOT EXISTS performance_by_service_span (
      minute DateTime CODEC(DoubleDelta),
      service_name LowCardinality(String) CODEC(ZSTD(1)),
      span_name LowCardinality(String) CODEC(ZSTD(1)),
      span_status LowCardinality(String) CODEC(ZSTD(1)),
      span_count UInt64 CODEC(DoubleDelta),
      avg_duration Float64 CODEC(DoubleDelta),
      min_duration Float64 CODEC(DoubleDelta),
      max_duration Float64 CODEC(DoubleDelta),
      p50_duration Float64 CODEC(DoubleDelta),
      p95_duration Float64 CODEC(DoubleDelta),
      p99_duration Float64 CODEC(DoubleDelta),
      error_spans UInt64 CODEC(DoubleDelta)
    )
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(minute)
    ORDER BY (service_name, span_name, minute)
    TTL minute + INTERVAL 30 DAY DELETE
  `);

  // Alerts by severity hour table
  tables.push(`
    CREATE TABLE IF NOT EXISTS alerts_by_severity_hour (
      hour DateTime CODEC(DoubleDelta),
      service_name LowCardinality(String) CODEC(ZSTD(1)),
      alert_severity LowCardinality(String) CODEC(ZSTD(1)),
      alert_status LowCardinality(String) CODEC(ZSTD(1)),
      korean_hour UInt8 CODEC(DoubleDelta),
      korean_day_of_week LowCardinality(String) CODEC(ZSTD(1)),
      alert_count UInt64 CODEC(DoubleDelta),
      unique_alerts UInt64 CODEC(DoubleDelta),
      firing_count UInt64 CODEC(DoubleDelta),
      resolved_count UInt64 CODEC(DoubleDelta)
    )
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(hour)
    ORDER BY (service_name, alert_severity, hour)
    TTL hour + INTERVAL 90 DAY DELETE
  `);

  // Korean business hours table
  tables.push(`
    CREATE TABLE IF NOT EXISTS korean_business_hours (
      korean_date String CODEC(ZSTD(1)),
      korean_hour UInt8 CODEC(DoubleDelta),
      korean_day_of_week LowCardinality(String) CODEC(ZSTD(1)),
      service_name LowCardinality(String) CODEC(ZSTD(1)),
      event_type LowCardinality(String) CODEC(ZSTD(1)),
      event_count UInt64 CODEC(DoubleDelta),
      error_count UInt64 CODEC(DoubleDelta),
      critical_alerts UInt64 CODEC(DoubleDelta),
      avg_metric_value Float64 CODEC(DoubleDelta),
      avg_response_time Float64 CODEC(DoubleDelta),
      time_category LowCardinality(String) CODEC(ZSTD(1))
    )
    ENGINE = SummingMergeTree()
    PARTITION BY korean_date
    ORDER BY (service_name, korean_date, korean_hour)
    TTL toDate(korean_date) + INTERVAL 90 DAY DELETE
  `);

  return tables;
}

/**
 * Create indexes for performance optimization
 */
function createIndexes() {
  const indexes = [];

  // Main table indexes
  indexes.push(`
    ALTER TABLE wide_events 
    ADD INDEX IF NOT EXISTS idx_service_timestamp (service_name, timestamp) 
    TYPE minmax GRANULARITY 1
  `);

  indexes.push(`
    ALTER TABLE wide_events 
    ADD INDEX IF NOT EXISTS idx_event_type_timestamp (event_type, timestamp) 
    TYPE minmax GRANULARITY 1
  `);

  indexes.push(`
    ALTER TABLE wide_events 
    ADD INDEX IF NOT EXISTS idx_trace_id (trace_id) 
    TYPE bloom_filter(0.01) GRANULARITY 1
  `);

  indexes.push(`
    ALTER TABLE wide_events 
    ADD INDEX IF NOT EXISTS idx_korean_business_hours (korean_hour, korean_day_of_week) 
    TYPE set(100) GRANULARITY 1
  `);

  indexes.push(`
    ALTER TABLE wide_events 
    ADD INDEX IF NOT EXISTS idx_log_level (log_level) 
    TYPE set(10) GRANULARITY 1
  `);

  indexes.push(`
    ALTER TABLE wide_events 
    ADD INDEX IF NOT EXISTS idx_alert_severity (alert_severity) 
    TYPE set(10) GRANULARITY 1
  `);

  // Metric name index for fast metric queries
  indexes.push(`
    ALTER TABLE wide_events 
    ADD INDEX IF NOT EXISTS idx_metric_name (metric_name) 
    TYPE bloom_filter(0.01) GRANULARITY 1
  `);

  return indexes;
}

/**
 * Create functions for Korean date/time handling
 */
function createKoreanFunctions() {
  const functions = [];

  // Function to check if time is during Korean business hours
  functions.push(`
    CREATE OR REPLACE FUNCTION isKoreanBusinessHours(dt DateTime, tz String DEFAULT 'Asia/Seoul')
    RETURNS UInt8
    AS (
      SELECT 
        CASE 
          WHEN toDayOfWeek(dt, tz) IN (6, 7) THEN 0  -- Weekend
          WHEN toHour(dt, tz) BETWEEN 9 AND 18 THEN 1  -- Business hours
          ELSE 0
        END
    )
  `);

  // Function to get Korean time category
  functions.push(`
    CREATE OR REPLACE FUNCTION getKoreanTimeCategory(dt DateTime, tz String DEFAULT 'Asia/Seoul')
    RETURNS String
    AS (
      SELECT 
        CASE 
          WHEN toDayOfWeek(dt, tz) IN (6, 7) THEN 'weekend'
          WHEN toHour(dt, tz) BETWEEN 9 AND 18 THEN 'business_hours'
          WHEN toHour(dt, tz) BETWEEN 19 AND 22 THEN 'evening'
          ELSE 'night'
        END
    )
  `);

  // Function to format Korean datetime
  functions.push(`
    CREATE OR REPLACE FUNCTION formatKoreanDateTime(dt DateTime, tz String DEFAULT 'Asia/Seoul')
    RETURNS String
    AS (
      SELECT concat(
        toString(toYear(dt, tz)), '년 ',
        toString(toMonth(dt, tz)), '월 ',
        toString(toDayOfMonth(dt, tz)), '일 ',
        toString(toHour(dt, tz)), '시 ',
        toString(toMinute(dt, tz)), '분'
      )
    )
  `);

  return functions;
}

module.exports = {
  createWideEventsTable,
  createMetricViews,
  createDestinationTables,
  createIndexes,
  createKoreanFunctions
};