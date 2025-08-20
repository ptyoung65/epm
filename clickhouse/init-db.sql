-- Create OpenTelemetry database
CREATE DATABASE IF NOT EXISTS otel;

USE otel;

-- Traces table with optimized schema
CREATE TABLE IF NOT EXISTS otel_traces (
    -- Trace identification
    trace_id String,
    span_id String,
    parent_span_id String,
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    start_time_unix_nano UInt64,
    end_time_unix_nano UInt64,
    duration_nano UInt64 MATERIALIZED (end_time_unix_nano - start_time_unix_nano),
    
    -- Service and operation info
    service_name LowCardinality(String),
    service_namespace LowCardinality(String),
    service_instance_id String,
    operation_name LowCardinality(String),
    span_name LowCardinality(String),
    
    -- Span metadata
    span_kind LowCardinality(String),
    status_code Int32,
    status_message String,
    
    -- Attributes (stored as JSON for flexibility)
    resource_attributes String,
    span_attributes String,
    
    -- Events and links
    events Array(Tuple(
        timestamp_unix_nano UInt64,
        name String,
        attributes String
    )),
    links Array(Tuple(
        trace_id String,
        span_id String,
        trace_state String,
        attributes String
    )),
    
    -- HTTP specific fields
    http_method LowCardinality(String),
    http_url String,
    http_target String,
    http_host String,
    http_scheme LowCardinality(String),
    http_status_code Int32,
    http_user_agent String,
    
    -- Database specific fields
    db_system LowCardinality(String),
    db_name String,
    db_statement String,
    db_operation LowCardinality(String),
    
    -- Network fields
    net_peer_name String,
    net_peer_port Int32,
    net_host_name String,
    net_host_port Int32,
    
    -- Error information
    exception_type String,
    exception_message String,
    exception_stacktrace String,
    
    -- Custom fields for APM
    environment LowCardinality(String) DEFAULT 'production',
    deployment_id String,
    version String,
    
    -- Indexing optimization
    INDEX idx_trace_id trace_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_service service_name TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_operation operation_name TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_http_status http_status_code TYPE minmax GRANULARITY 1,
    INDEX idx_duration duration_nano TYPE minmax GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service_name, timestamp, trace_id)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Metrics tables (separate tables for different metric types)
-- Gauge metrics
CREATE TABLE IF NOT EXISTS otel_metrics_gauge (
    -- Metric identification
    metric_name LowCardinality(String),
    metric_description String,
    metric_unit LowCardinality(String),
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    start_time_unix_nano UInt64,
    time_unix_nano UInt64,
    
    -- Service info
    service_name LowCardinality(String),
    service_namespace LowCardinality(String),
    service_instance_id String,
    
    -- Metric value
    value Float64,
    
    -- Attributes
    resource_attributes String,
    metric_attributes String,
    scope_attributes String,
    
    -- Exemplars
    exemplars Array(Tuple(
        value Float64,
        time_unix_nano UInt64,
        trace_id String,
        span_id String,
        attributes String
    )),
    
    -- Custom fields
    environment LowCardinality(String) DEFAULT 'production',
    host_name String,
    
    INDEX idx_metric_name metric_name TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_service service_name TYPE bloom_filter(0.001) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service_name, metric_name, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Sum metrics (counters)
CREATE TABLE IF NOT EXISTS otel_metrics_sum (
    -- Metric identification
    metric_name LowCardinality(String),
    metric_description String,
    metric_unit LowCardinality(String),
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    start_time_unix_nano UInt64,
    time_unix_nano UInt64,
    
    -- Service info
    service_name LowCardinality(String),
    service_namespace LowCardinality(String),
    service_instance_id String,
    
    -- Metric values
    value Float64,
    is_monotonic Boolean,
    aggregation_temporality LowCardinality(String),
    
    -- Attributes
    resource_attributes String,
    metric_attributes String,
    scope_attributes String,
    
    -- Custom fields
    environment LowCardinality(String) DEFAULT 'production',
    host_name String,
    
    INDEX idx_metric_name metric_name TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_service service_name TYPE bloom_filter(0.001) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service_name, metric_name, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Histogram metrics
CREATE TABLE IF NOT EXISTS otel_metrics_histogram (
    -- Metric identification
    metric_name LowCardinality(String),
    metric_description String,
    metric_unit LowCardinality(String),
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    start_time_unix_nano UInt64,
    time_unix_nano UInt64,
    
    -- Service info
    service_name LowCardinality(String),
    service_namespace LowCardinality(String),
    service_instance_id String,
    
    -- Histogram data
    count UInt64,
    sum Float64,
    min Float64,
    max Float64,
    bucket_counts Array(UInt64),
    explicit_bounds Array(Float64),
    
    -- Aggregation info
    aggregation_temporality LowCardinality(String),
    
    -- Attributes
    resource_attributes String,
    metric_attributes String,
    scope_attributes String,
    
    -- Custom fields
    environment LowCardinality(String) DEFAULT 'production',
    host_name String,
    
    INDEX idx_metric_name metric_name TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_service service_name TYPE bloom_filter(0.001) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service_name, metric_name, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Summary metrics
CREATE TABLE IF NOT EXISTS otel_metrics_summary (
    -- Metric identification
    metric_name LowCardinality(String),
    metric_description String,
    metric_unit LowCardinality(String),
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    start_time_unix_nano UInt64,
    time_unix_nano UInt64,
    
    -- Service info
    service_name LowCardinality(String),
    service_namespace LowCardinality(String),
    service_instance_id String,
    
    -- Summary data
    count UInt64,
    sum Float64,
    quantile_values Array(Tuple(
        quantile Float64,
        value Float64
    )),
    
    -- Attributes
    resource_attributes String,
    metric_attributes String,
    scope_attributes String,
    
    -- Custom fields
    environment LowCardinality(String) DEFAULT 'production',
    host_name String,
    
    INDEX idx_metric_name metric_name TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_service service_name TYPE bloom_filter(0.001) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service_name, metric_name, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Exponential histogram metrics
CREATE TABLE IF NOT EXISTS otel_metrics_exp_histogram (
    -- Metric identification
    metric_name LowCardinality(String),
    metric_description String,
    metric_unit LowCardinality(String),
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    start_time_unix_nano UInt64,
    time_unix_nano UInt64,
    
    -- Service info
    service_name LowCardinality(String),
    service_namespace LowCardinality(String),
    service_instance_id String,
    
    -- Exponential histogram data
    count UInt64,
    sum Float64,
    scale Int32,
    zero_count UInt64,
    positive_offset Int32,
    positive_bucket_counts Array(UInt64),
    negative_offset Int32,
    negative_bucket_counts Array(UInt64),
    
    -- Aggregation info
    aggregation_temporality LowCardinality(String),
    
    -- Attributes
    resource_attributes String,
    metric_attributes String,
    scope_attributes String,
    
    -- Custom fields
    environment LowCardinality(String) DEFAULT 'production',
    host_name String,
    
    INDEX idx_metric_name metric_name TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_service service_name TYPE bloom_filter(0.001) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service_name, metric_name, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Logs table
CREATE TABLE IF NOT EXISTS otel_logs (
    -- Log identification
    trace_id String,
    span_id String,
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    observed_timestamp DateTime64(9),
    time_unix_nano UInt64,
    observed_time_unix_nano UInt64,
    
    -- Service info
    service_name LowCardinality(String),
    service_namespace LowCardinality(String),
    service_instance_id String,
    
    -- Log data
    severity_text LowCardinality(String),
    severity_number Int32,
    body String,
    
    -- Attributes
    resource_attributes String,
    log_attributes String,
    scope_attributes String,
    
    -- Custom fields for better querying
    level LowCardinality(String),
    logger_name String,
    thread_name String,
    file_name String,
    file_line Int32,
    function_name String,
    
    -- Application context
    environment LowCardinality(String) DEFAULT 'production',
    deployment_id String,
    version String,
    host_name String,
    container_name String,
    container_id String,
    
    -- Error tracking
    error_type String,
    error_message String,
    error_stack String,
    
    INDEX idx_trace_id trace_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_service service_name TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_severity severity_number TYPE minmax GRANULARITY 1,
    INDEX idx_level level TYPE bloom_filter(0.001) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service_name, timestamp, trace_id)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Create materialized views for common queries
-- Service performance overview
CREATE MATERIALIZED VIEW IF NOT EXISTS service_performance_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service_name, timestamp)
AS SELECT
    toStartOfMinute(timestamp) as timestamp,
    service_name,
    operation_name,
    count() as request_count,
    avg(duration_nano / 1000000) as avg_duration_ms,
    quantile(0.50)(duration_nano / 1000000) as p50_duration_ms,
    quantile(0.95)(duration_nano / 1000000) as p95_duration_ms,
    quantile(0.99)(duration_nano / 1000000) as p99_duration_ms,
    sum(CASE WHEN status_code = 2 THEN 1 ELSE 0 END) as error_count
FROM otel_traces
GROUP BY timestamp, service_name, operation_name;

-- Service dependencies view
CREATE MATERIALIZED VIEW IF NOT EXISTS service_dependencies_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (source_service, target_service, timestamp)
AS SELECT
    toStartOfMinute(timestamp) as timestamp,
    service_name as source_service,
    JSONExtractString(span_attributes, 'peer.service') as target_service,
    count() as call_count,
    avg(duration_nano / 1000000) as avg_duration_ms,
    sum(CASE WHEN status_code = 2 THEN 1 ELSE 0 END) as error_count
FROM otel_traces
WHERE JSONExtractString(span_attributes, 'peer.service') != ''
GROUP BY timestamp, source_service, target_service;

-- Error analysis view
CREATE MATERIALIZED VIEW IF NOT EXISTS error_analysis_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service_name, error_type, timestamp)
AS SELECT
    toStartOfMinute(timestamp) as timestamp,
    service_name,
    exception_type as error_type,
    exception_message as error_message,
    count() as error_count,
    uniq(trace_id) as affected_traces
FROM otel_traces
WHERE status_code = 2 AND exception_type != ''
GROUP BY timestamp, service_name, error_type, error_message;