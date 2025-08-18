-- AIRIS-MON 세션 리플레이 전용 테이블 스키마

-- 1. 세션 이벤트 테이블 (모든 사용자 행동 기록)
CREATE TABLE IF NOT EXISTS session_events (
    id String,
    session_id String,
    timestamp DateTime64(3, 'Asia/Seoul'),
    event_type String,
    page_url Nullable(String),
    page_title Nullable(String),
    element_id Nullable(String),
    element_type Nullable(String),
    element_text Nullable(String),
    x_coordinate Nullable(Int32),
    y_coordinate Nullable(Int32),
    scroll_x Nullable(Int32),
    scroll_y Nullable(Int32),
    value_masked Nullable(String),
    button Nullable(String),
    key_code Nullable(Int32),
    error_message Nullable(String),
    error_stack Nullable(String),
    error_file Nullable(String),
    error_line Nullable(Int32),
    response_time Nullable(Int32),
    status_code Nullable(Int32),
    ip_address Nullable(String),
    user_agent Nullable(String),
    viewport_width Nullable(Int32),
    viewport_height Nullable(Int32),
    load_time Nullable(Int32),
    user_intent Nullable(String),
    notes Nullable(String),
    metadata String
) ENGINE = MergeTree()
ORDER BY (session_id, timestamp)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 90 DAY;

-- 2. 세션 요약 테이블 (세션별 집계 정보)
CREATE TABLE IF NOT EXISTS session_summaries (
    session_id String,
    user_id String,
    scenario String,
    start_time DateTime64(3, 'Asia/Seoul'),
    end_time DateTime64(3, 'Asia/Seoul'),
    duration Int32,
    page_views_count Int32,
    user_actions_count Int32,
    errors_count Int32,
    clicks_count Int32,
    form_inputs_count Int32,
    scroll_events_count Int32,
    conversion_completed Bool,
    exit_reason Nullable(String),
    device_type Nullable(String),
    os Nullable(String),
    browser Nullable(String),
    browser_version Nullable(String),
    screen_resolution Nullable(String),
    quality_score Float32,
    recording_fps Float32,
    compression_ratio Float32,
    data_integrity Bool,
    satisfaction_score Nullable(Float32),
    task_completion_rate Nullable(Float32),
    bounce_rate Nullable(Float32),
    metadata String
) ENGINE = MergeTree()
ORDER BY (scenario, start_time)
PARTITION BY toYYYYMM(start_time)
TTL start_time + INTERVAL 90 DAY;

-- 3. 보안 인시던트 테이블
CREATE TABLE IF NOT EXISTS security_incidents (
    incident_id String,
    session_id String,
    incident_type String,
    severity Enum8('low' = 1, 'medium' = 2, 'high' = 3, 'critical' = 4),
    source_ip String,
    target_username Nullable(String),
    attack_attempts Int32,
    success_attempts Int32,
    detection_time Int32,
    mitigation_time Int32,
    blocked Bool,
    alert_triggered Bool,
    geo_location Nullable(String),
    threat_score Float32,
    attack_vector Nullable(String),
    user_agent_suspicious Bool,
    ip_reputation Nullable(String),
    timestamp DateTime64(3, 'Asia/Seoul'),
    metadata String
) ENGINE = MergeTree()
ORDER BY (severity, timestamp)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 365 DAY; -- 보안 데이터는 1년 보관

-- 4. 성능 메트릭 테이블
CREATE TABLE IF NOT EXISTS performance_metrics (
    metric_id String,
    session_id String,
    page_url String,
    page_load_start DateTime64(3, 'Asia/Seoul'),
    page_load_complete DateTime64(3, 'Asia/Seoul'),
    total_load_time Int32,
    dom_ready_time Int32,
    first_paint Int32,
    first_contentful_paint Int32,
    largest_contentful_paint Int32,
    cumulative_layout_shift Float32,
    first_input_delay Int32,
    total_blocking_time Int32,
    memory_usage Int64,
    cpu_usage Float32,
    network_usage Int64,
    api_response_time Int32,
    chart_render_time Nullable(Int32),
    resource_count Int32,
    cache_hit_ratio Float32,
    user_satisfaction Float32,
    abandonment_point Nullable(String),
    bottleneck_type Nullable(String),
    optimization_score Float32,
    timestamp DateTime64(3, 'Asia/Seoul'),
    metadata String
) ENGINE = MergeTree()
ORDER BY (page_url, timestamp)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 180 DAY; -- 성능 데이터는 6개월 보관

-- 5. UX 분석 테이블
CREATE TABLE IF NOT EXISTS ux_analytics (
    analysis_id String,
    session_id String,
    page_url String,
    user_journey_step Int32,
    action_taken String,
    action_success Bool,
    click_efficiency Float32,
    navigation_clarity Enum8('poor' = 1, 'fair' = 2, 'good' = 3, 'excellent' = 4),
    confusion_indicators Array(String),
    time_to_confusion Int32,
    bounce_probability Float32,
    improvement_suggestions Array(String),
    a_b_test_variant Nullable(String),
    conversion_funnel_step String,
    drop_off_point Nullable(String),
    engagement_score Float32,
    timestamp DateTime64(3, 'Asia/Seoul'),
    metadata String
) ENGINE = MergeTree()
ORDER BY (page_url, timestamp)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 90 DAY;

-- 6. 버그 리포트 테이블
CREATE TABLE IF NOT EXISTS bug_reports (
    bug_id String,
    session_id String,
    bug_type String,
    severity Enum8('low' = 1, 'medium' = 2, 'high' = 3, 'critical' = 4),
    page_url String,
    element_path Nullable(String),
    error_message Nullable(String),
    stack_trace Nullable(String),
    reproduction_steps Array(String),
    browser_info String,
    device_info String,
    user_impact Enum8('none' = 0, 'minor' = 1, 'moderate' = 2, 'major' = 3, 'critical' = 4),
    fix_priority Int32,
    status Enum8('new' = 1, 'assigned' = 2, 'in_progress' = 3, 'fixed' = 4, 'verified' = 5),
    resolution_time Nullable(Int32),
    fix_applied Bool,
    regression_test_passed Bool,
    reported_at DateTime64(3, 'Asia/Seoul'),
    fixed_at Nullable(DateTime64(3, 'Asia/Seoul')),
    metadata String
) ENGINE = MergeTree()
ORDER BY (severity, reported_at)
PARTITION BY toYYYYMM(reported_at)
TTL reported_at + INTERVAL 365 DAY;

-- 7. 실시간 세션 상태 테이블 (현재 진행 중인 세션)
CREATE TABLE IF NOT EXISTS active_sessions (
    session_id String,
    user_id String,
    start_time DateTime64(3, 'Asia/Seoul'),
    last_activity DateTime64(3, 'Asia/Seoul'),
    current_page String,
    events_count Int32,
    is_recording Bool,
    quality_score Float32,
    device_type String,
    browser String,
    ip_address String,
    geo_location String,
    status Enum8('active' = 1, 'idle' = 2, 'ended' = 3),
    metadata String
) ENGINE = MergeTree()
ORDER BY (last_activity, session_id)
PARTITION BY toYYYYMM(last_activity)
TTL last_activity + INTERVAL 7 DAY; -- 7일 후 자동 삭제

-- 인덱스 및 최적화 설정

-- 1. 세션 이벤트 최적화
ALTER TABLE session_events ADD INDEX idx_event_type event_type TYPE bloom_filter GRANULARITY 1;
ALTER TABLE session_events ADD INDEX idx_page_url page_url TYPE bloom_filter GRANULARITY 1;
ALTER TABLE session_events ADD INDEX idx_element_id element_id TYPE bloom_filter GRANULARITY 1;

-- 2. 세션 요약 최적화
ALTER TABLE session_summaries ADD INDEX idx_scenario scenario TYPE bloom_filter GRANULARITY 1;
ALTER TABLE session_summaries ADD INDEX idx_user_id user_id TYPE bloom_filter GRANULARITY 1;
ALTER TABLE session_summaries ADD INDEX idx_device device_type TYPE bloom_filter GRANULARITY 1;

-- 3. 보안 인시던트 최적화
ALTER TABLE security_incidents ADD INDEX idx_ip source_ip TYPE bloom_filter GRANULARITY 1;
ALTER TABLE security_incidents ADD INDEX idx_incident_type incident_type TYPE bloom_filter GRANULARITY 1;

-- 4. 성능 메트릭 최적화
ALTER TABLE performance_metrics ADD INDEX idx_page_perf page_url TYPE bloom_filter GRANULARITY 1;

-- Materialized Views for Real-time Analytics

-- 1. 실시간 세션 통계
CREATE MATERIALIZED VIEW IF NOT EXISTS session_stats_realtime
ENGINE = SummingMergeTree()
ORDER BY (date, hour, scenario)
AS SELECT
    toDate(start_time) as date,
    toHour(start_time) as hour,
    scenario,
    count() as sessions_count,
    avg(duration) as avg_duration,
    avg(quality_score) as avg_quality,
    sum(errors_count) as total_errors,
    avg(satisfaction_score) as avg_satisfaction
FROM session_summaries
GROUP BY date, hour, scenario;

-- 2. 실시간 성능 통계
CREATE MATERIALIZED VIEW IF NOT EXISTS performance_stats_realtime
ENGINE = SummingMergeTree()
ORDER BY (date, hour, page_url)
AS SELECT
    toDate(timestamp) as date,
    toHour(timestamp) as hour,
    page_url,
    count() as page_loads,
    avg(total_load_time) as avg_load_time,
    quantile(0.95)(total_load_time) as p95_load_time,
    avg(user_satisfaction) as avg_satisfaction,
    sum(if(total_load_time > 3000, 1, 0)) as slow_loads_count
FROM performance_metrics
GROUP BY date, hour, page_url;

-- 3. 실시간 보안 통계
CREATE MATERIALIZED VIEW IF NOT EXISTS security_stats_realtime
ENGINE = SummingMergeTree()
ORDER BY (date, hour, severity)
AS SELECT
    toDate(timestamp) as date,
    toHour(timestamp) as hour,
    severity,
    incident_type,
    count() as incidents_count,
    sum(attack_attempts) as total_attempts,
    sum(if(blocked = 1, 1, 0)) as blocked_count,
    avg(detection_time) as avg_detection_time
FROM security_incidents
GROUP BY date, hour, severity, incident_type;

-- 4. 실시간 UX 통계
CREATE MATERIALIZED VIEW IF NOT EXISTS ux_stats_realtime
ENGINE = SummingMergeTree()
ORDER BY (date, hour, page_url)
AS SELECT
    toDate(timestamp) as date,
    toHour(timestamp) as hour,
    page_url,
    count() as sessions_count,
    avg(click_efficiency) as avg_click_efficiency,
    avg(engagement_score) as avg_engagement,
    sum(if(bounce_probability > 0.5, 1, 0)) as high_bounce_sessions
FROM ux_analytics
GROUP BY date, hour, page_url;

-- 샘플 쿼리 함수들

-- 1. 최근 24시간 세션 요약
CREATE FUNCTION get_recent_sessions() AS () -> (
    SELECT 
        scenario,
        count() as session_count,
        avg(duration) as avg_duration,
        avg(quality_score) as avg_quality,
        sum(errors_count) as total_errors
    FROM session_summaries 
    WHERE start_time >= now() - INTERVAL 24 HOUR
    GROUP BY scenario
    ORDER BY session_count DESC
);

-- 2. 성능 병목 지점 분석
CREATE FUNCTION get_performance_bottlenecks() AS () -> (
    SELECT 
        page_url,
        avg(total_load_time) as avg_load_time,
        quantile(0.95)(total_load_time) as p95_load_time,
        avg(user_satisfaction) as satisfaction,
        count() as sample_size
    FROM performance_metrics
    WHERE timestamp >= now() - INTERVAL 7 DAY
    GROUP BY page_url
    HAVING avg_load_time > 3000
    ORDER BY avg_load_time DESC
    LIMIT 10
);

-- 3. 보안 위협 대시보드
CREATE FUNCTION get_security_threats() AS () -> (
    SELECT 
        incident_type,
        severity,
        count() as incident_count,
        countDistinct(source_ip) as unique_ips,
        sum(attack_attempts) as total_attempts,
        avg(detection_time) as avg_detection_ms
    FROM security_incidents
    WHERE timestamp >= now() - INTERVAL 24 HOUR
    GROUP BY incident_type, severity
    ORDER BY incident_count DESC
);

-- 4. UX 개선 인사이트
CREATE FUNCTION get_ux_insights() AS () -> (
    SELECT 
        page_url,
        avg(click_efficiency) as efficiency,
        avg(engagement_score) as engagement,
        count() as sessions,
        arrayStringConcat(
            arrayDistinct(arrayFlatten(groupArray(confusion_indicators))), 
            ', '
        ) as common_issues
    FROM ux_analytics
    WHERE timestamp >= now() - INTERVAL 7 DAY
    GROUP BY page_url
    HAVING efficiency < 0.5
    ORDER BY sessions DESC
    LIMIT 10
);

-- 사용자 정의 딕셔너리 (빠른 룩업용)

-- 브라우저 정보 딕셔너리
CREATE DICTIONARY IF NOT EXISTS browser_dict (
    user_agent String,
    browser_name String,
    browser_version String,
    os_name String,
    device_type String
) PRIMARY KEY user_agent
SOURCE(HTTP(
    url 'http://localhost:3100/api/browser-info'
    format 'JSON'
))
LIFETIME(MIN 3600 MAX 7200)
LAYOUT(CACHE(SIZE_IN_CELLS 100000));

-- IP 지리적 위치 딕셔너리
CREATE DICTIONARY IF NOT EXISTS geo_dict (
    ip_address String,
    country String,
    region String,
    city String,
    latitude Float32,
    longitude Float32
) PRIMARY KEY ip_address
SOURCE(HTTP(
    url 'http://localhost:3100/api/geo-info'
    format 'JSON'
))
LIFETIME(MIN 86400 MAX 172800)
LAYOUT(CACHE(SIZE_IN_CELLS 1000000));

-- 초기 테스트 데이터 삽입 (개발용)
INSERT INTO session_events VALUES 
('test-event-1', 'test-session-1', now(), 'page_load', '/test', 'Test Page', null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1200, null, '192.168.1.1', 'Mozilla/5.0', 1920, 1080, 1200, null, 'Initial test event', '{}'),
('test-event-2', 'test-session-1', now(), 'click', '/test', 'Test Page', 'test-button', 'button', 'Click Me', 100, 200, null, null, null, 'left', null, null, null, null, null, 200, null, '192.168.1.1', 'Mozilla/5.0', 1920, 1080, null, 'button_click', 'User clicked test button', '{}');

INSERT INTO session_summaries VALUES 
('test-session-1', 'test-user-1', 'test_scenario', now() - INTERVAL 5 MINUTE, now(), 300000, 1, 2, 0, 1, 0, 0, false, 'test_completion', 'desktop', 'Windows', 'Chrome', '91.0', '1920x1080', 95.5, 30.0, 0.75, true, 8.5, 1.0, 0.0, '{"test": true}');

-- 권한 및 사용자 설정
-- CREATE USER IF NOT EXISTS 'airis_readonly' IDENTIFIED BY 'readonly_password';
-- GRANT SELECT ON airis_test.* TO 'airis_readonly';

-- CREATE USER IF NOT EXISTS 'airis_writer' IDENTIFIED BY 'writer_password'; 
-- GRANT SELECT, INSERT, UPDATE ON airis_test.* TO 'airis_writer';

OPTIMIZE TABLE session_events FINAL;
OPTIMIZE TABLE session_summaries FINAL;
OPTIMIZE TABLE security_incidents FINAL;
OPTIMIZE TABLE performance_metrics FINAL;
OPTIMIZE TABLE ux_analytics FINAL;

-- 설치 완료 로그
SELECT 'AIRIS-MON Session Replay Tables Created Successfully!' as status;