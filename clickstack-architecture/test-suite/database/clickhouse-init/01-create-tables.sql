-- AIRIS-MON 테스트 데이터베이스 스키마
-- ClickHouse 초기화 스크립트

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS airis_test;
USE airis_test;

-- 메트릭 테이블 (시계열 데이터)
CREATE TABLE IF NOT EXISTS metrics (
    id String,
    timestamp DateTime64(3, 'Asia/Seoul'),
    metric_type String,
    metric_name String,
    value Float64,
    unit String DEFAULT '',
    labels String DEFAULT '{}',
    source String DEFAULT 'unknown',
    service String DEFAULT 'unknown',
    environment String DEFAULT 'test',
    korean_name String DEFAULT '',
    korean_time String DEFAULT '',
    INDEX idx_metric_name metric_name TYPE bloom_filter GRANULARITY 1,
    INDEX idx_service service TYPE bloom_filter GRANULARITY 1,
    INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 8192
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (service, metric_name, timestamp)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- 이벤트 테이블 (로그 데이터)
CREATE TABLE IF NOT EXISTS events (
    id String,
    timestamp DateTime64(3, 'Asia/Seoul'),
    event_type String,
    sub_type String DEFAULT '',
    severity String DEFAULT 'info',
    message String,
    korean_message String DEFAULT '',
    user_id String DEFAULT '',
    session_id String DEFAULT '',
    trace_id String DEFAULT '',
    span_id String DEFAULT '',
    service String DEFAULT 'unknown',
    environment String DEFAULT 'test',
    attributes String DEFAULT '{}',
    tags Array(String) DEFAULT [],
    korean_time String DEFAULT '',
    INDEX idx_event_type event_type TYPE bloom_filter GRANULARITY 1,
    INDEX idx_severity severity TYPE bloom_filter GRANULARITY 1,
    INDEX idx_user_id user_id TYPE bloom_filter GRANULARITY 1,
    INDEX idx_service service TYPE bloom_filter GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (service, event_type, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- 사용자 세션 테이블
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id String,
    user_id String,
    start_time DateTime64(3, 'Asia/Seoul'),
    end_time DateTime64(3, 'Asia/Seoul'),
    duration_ms UInt64,
    page_views UInt32 DEFAULT 0,
    actions_count UInt32 DEFAULT 0,
    browser String DEFAULT '',
    device String DEFAULT '',
    ip_address String DEFAULT '',
    user_agent String DEFAULT '',
    location_country String DEFAULT '대한민국',
    location_city String DEFAULT '',
    events_data String DEFAULT '{}',
    korean_start_time String DEFAULT '',
    korean_end_time String DEFAULT '',
    INDEX idx_user_id user_id TYPE bloom_filter GRANULARITY 1,
    INDEX idx_session_id session_id TYPE bloom_filter GRANULARITY 1,
    INDEX idx_start_time start_time TYPE minmax GRANULARITY 8192
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(start_time)
ORDER BY (user_id, start_time)
TTL start_time + INTERVAL 180 DAY
SETTINGS index_granularity = 8192;

-- 알림 테이블
CREATE TABLE IF NOT EXISTS alerts (
    id String,
    timestamp DateTime64(3, 'Asia/Seoul'),
    alert_type String,
    korean_type String DEFAULT '',
    severity String,
    korean_severity String DEFAULT '',
    title String,
    message String,
    korean_message String DEFAULT '',
    service String DEFAULT 'unknown',
    status String DEFAULT 'active',
    rule_id String DEFAULT '',
    attributes String DEFAULT '{}',
    escalation_level UInt8 DEFAULT 0,
    acknowledged_at DateTime64(3, 'Asia/Seoul') DEFAULT toDateTime64(0, 3, 'Asia/Seoul'),
    resolved_at DateTime64(3, 'Asia/Seoul') DEFAULT toDateTime64(0, 3, 'Asia/Seoul'),
    tags Array(String) DEFAULT [],
    korean_time String DEFAULT '',
    INDEX idx_alert_type alert_type TYPE bloom_filter GRANULARITY 1,
    INDEX idx_severity severity TYPE bloom_filter GRANULARITY 1,
    INDEX idx_service service TYPE bloom_filter GRANULARITY 1,
    INDEX idx_status status TYPE bloom_filter GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (service, severity, timestamp)
TTL timestamp + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;

-- 이상 탐지 결과 테이블
CREATE TABLE IF NOT EXISTS anomalies (
    id String,
    timestamp DateTime64(3, 'Asia/Seoul'),
    anomaly_type String,
    korean_type String DEFAULT '',
    confidence Float64,
    severity String DEFAULT 'medium',
    affected_service String DEFAULT 'unknown',
    baseline_value Float64 DEFAULT 0,
    actual_value Float64 DEFAULT 0,
    deviation Float64 DEFAULT 0,
    description String DEFAULT '',
    korean_description String DEFAULT '',
    korean_analysis String DEFAULT '',
    recommended_action String DEFAULT '',
    metric_name String DEFAULT '',
    features String DEFAULT '{}',
    model_version String DEFAULT 'v1.0.0',
    korean_time String DEFAULT '',
    INDEX idx_anomaly_type anomaly_type TYPE bloom_filter GRANULARITY 1,
    INDEX idx_service affected_service TYPE bloom_filter GRANULARITY 1,
    INDEX idx_confidence confidence TYPE minmax GRANULARITY 8192
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (affected_service, anomaly_type, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- NLP 검색 쿼리 로그 테이블
CREATE TABLE IF NOT EXISTS nlp_queries (
    id String,
    timestamp DateTime64(3, 'Asia/Seoul'),
    query_text String,
    korean_query String DEFAULT '',
    user_id String DEFAULT '',
    language String DEFAULT 'ko',
    intent String DEFAULT '',
    entities String DEFAULT '[]',
    confidence Float64 DEFAULT 0,
    result_count UInt32 DEFAULT 0,
    execution_time_ms UInt32 DEFAULT 0,
    success Bool DEFAULT true,
    error_message String DEFAULT '',
    korean_time String DEFAULT '',
    INDEX idx_user_id user_id TYPE bloom_filter GRANULARITY 1,
    INDEX idx_language language TYPE bloom_filter GRANULARITY 1,
    INDEX idx_intent intent TYPE bloom_filter GRANULARITY 1,
    INDEX idx_query_text query_text TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- 테스트 결과 테이블
CREATE TABLE IF NOT EXISTS test_results (
    id String,
    timestamp DateTime64(3, 'Asia/Seoul'),
    test_suite String,
    scenario_id String,
    scenario_name String,
    korean_name String DEFAULT '',
    status String, -- running, completed, failed
    start_time DateTime64(3, 'Asia/Seoul'),
    end_time DateTime64(3, 'Asia/Seoul'),
    duration_ms UInt64 DEFAULT 0,
    success_rate Float64 DEFAULT 0,
    total_steps UInt32 DEFAULT 0,
    completed_steps UInt32 DEFAULT 0,
    failed_steps UInt32 DEFAULT 0,
    metrics String DEFAULT '{}',
    error_message String DEFAULT '',
    korean_time String DEFAULT '',
    INDEX idx_test_suite test_suite TYPE bloom_filter GRANULARITY 1,
    INDEX idx_scenario_id scenario_id TYPE bloom_filter GRANULARITY 1,
    INDEX idx_status status TYPE bloom_filter GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (test_suite, scenario_id, timestamp)
TTL timestamp + INTERVAL 180 DAY
SETTINGS index_granularity = 8192;

-- 성능 벤치마크 테이블
CREATE TABLE IF NOT EXISTS performance_benchmarks (
    id String,
    timestamp DateTime64(3, 'Asia/Seoul'),
    benchmark_type String,
    korean_type String DEFAULT '',
    test_name String,
    korean_name String DEFAULT '',
    duration_ms UInt64,
    throughput Float64 DEFAULT 0,
    latency_avg Float64 DEFAULT 0,
    latency_p95 Float64 DEFAULT 0,
    latency_p99 Float64 DEFAULT 0,
    error_rate Float64 DEFAULT 0,
    memory_usage Float64 DEFAULT 0,
    cpu_usage Float64 DEFAULT 0,
    concurrent_users UInt32 DEFAULT 1,
    total_requests UInt64 DEFAULT 0,
    successful_requests UInt64 DEFAULT 0,
    failed_requests UInt64 DEFAULT 0,
    metadata String DEFAULT '{}',
    korean_time String DEFAULT '',
    INDEX idx_benchmark_type benchmark_type TYPE bloom_filter GRANULARITY 1,
    INDEX idx_test_name test_name TYPE bloom_filter GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (benchmark_type, test_name, timestamp)
TTL timestamp + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;