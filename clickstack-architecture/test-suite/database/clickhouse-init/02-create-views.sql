-- AIRIS-MON 테스트 데이터베이스 뷰 생성
-- 분석 및 대시보드를 위한 미리 계산된 뷰들

USE airis_test;

-- 실시간 시스템 메트릭 뷰 (최근 1시간)
CREATE VIEW IF NOT EXISTS v_realtime_metrics AS
SELECT 
    service,
    metric_name,
    korean_name,
    avg(value) as avg_value,
    max(value) as max_value,
    min(value) as min_value,
    count() as data_points,
    toStartOfInterval(timestamp, INTERVAL 1 MINUTE) as time_bucket,
    formatDateTime(time_bucket, '%Y-%m-%d %H:%i', 'Asia/Seoul') as korean_time
FROM metrics 
WHERE timestamp >= now() - INTERVAL 1 HOUR
GROUP BY service, metric_name, korean_name, time_bucket
ORDER BY time_bucket DESC, service, metric_name;

-- 서비스별 오류율 뷰 (최근 24시간)
CREATE VIEW IF NOT EXISTS v_service_error_rates AS
SELECT 
    service,
    count() as total_events,
    countIf(severity IN ('error', 'critical')) as error_events,
    round(error_events * 100.0 / total_events, 2) as error_rate_percent,
    toStartOfHour(timestamp) as hour_bucket,
    formatDateTime(hour_bucket, '%Y-%m-%d %H:00', 'Asia/Seoul') as korean_time
FROM events 
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY service, hour_bucket
HAVING total_events > 0
ORDER BY hour_bucket DESC, error_rate_percent DESC;

-- 사용자 활동 요약 뷰 (일별)
CREATE VIEW IF NOT EXISTS v_daily_user_activity AS
SELECT 
    toDate(start_time, 'Asia/Seoul') as activity_date,
    formatDateTime(activity_date, '%Y년 %m월 %d일', 'Asia/Seoul') as korean_date,
    count(DISTINCT user_id) as unique_users,
    count() as total_sessions,
    avg(duration_ms) / 1000 as avg_session_duration_sec,
    sum(page_views) as total_page_views,
    sum(actions_count) as total_actions,
    round(avg(page_views), 2) as avg_pages_per_session
FROM user_sessions 
WHERE start_time >= now() - INTERVAL 30 DAY
GROUP BY activity_date
ORDER BY activity_date DESC;

-- 알림 심각도별 통계 뷰
CREATE VIEW IF NOT EXISTS v_alert_severity_stats AS
SELECT 
    severity,
    korean_severity,
    service,
    count() as total_alerts,
    countIf(status = 'active') as active_alerts,
    countIf(status = 'acknowledged') as acknowledged_alerts,
    countIf(status = 'resolved') as resolved_alerts,
    round(acknowledged_alerts * 100.0 / total_alerts, 1) as acknowledgment_rate,
    round(resolved_alerts * 100.0 / total_alerts, 1) as resolution_rate,
    toStartOfDay(timestamp) as alert_date,
    formatDateTime(alert_date, '%Y-%m-%d', 'Asia/Seoul') as korean_date
FROM alerts 
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY severity, korean_severity, service, alert_date
ORDER BY alert_date DESC, severity, service;

-- 이상 탐지 정확도 뷰
CREATE VIEW IF NOT EXISTS v_anomaly_accuracy AS
SELECT 
    anomaly_type,
    korean_type,
    affected_service,
    count() as total_detections,
    avg(confidence) as avg_confidence,
    countIf(confidence >= 0.8) as high_confidence_detections,
    round(high_confidence_detections * 100.0 / total_detections, 1) as high_confidence_rate,
    toStartOfDay(timestamp) as detection_date,
    formatDateTime(detection_date, '%Y-%m-%d', 'Asia/Seoul') as korean_date
FROM anomalies 
WHERE timestamp >= now() - INTERVAL 14 DAY
GROUP BY anomaly_type, korean_type, affected_service, detection_date
ORDER BY detection_date DESC, avg_confidence DESC;

-- NLP 검색 성능 뷰
CREATE VIEW IF NOT EXISTS v_nlp_search_performance AS
SELECT 
    language,
    intent,
    count() as total_queries,
    countIf(success = true) as successful_queries,
    round(successful_queries * 100.0 / total_queries, 1) as success_rate,
    avg(execution_time_ms) as avg_execution_time,
    percentile(0.95)(execution_time_ms) as p95_execution_time,
    avg(result_count) as avg_results_per_query,
    toStartOfHour(timestamp) as query_hour,
    formatDateTime(query_hour, '%Y-%m-%d %H:00', 'Asia/Seoul') as korean_time
FROM nlp_queries 
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY language, intent, query_hour
ORDER BY query_hour DESC, total_queries DESC;

-- 테스트 실행 요약 뷰
CREATE VIEW IF NOT EXISTS v_test_execution_summary AS
SELECT 
    test_suite,
    scenario_name,
    korean_name,
    count() as total_executions,
    countIf(status = 'completed') as successful_executions,
    countIf(status = 'failed') as failed_executions,
    round(successful_executions * 100.0 / total_executions, 1) as success_rate,
    avg(duration_ms) / 1000 as avg_duration_sec,
    avg(success_rate) as avg_test_success_rate,
    max(timestamp) as last_execution,
    formatDateTime(last_execution, '%Y-%m-%d %H:%i:%s', 'Asia/Seoul') as korean_last_execution
FROM test_results 
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY test_suite, scenario_name, korean_name
ORDER BY last_execution DESC, success_rate DESC;

-- 성능 벤치마크 트렌드 뷰
CREATE VIEW IF NOT EXISTS v_performance_trends AS
SELECT 
    benchmark_type,
    korean_type,
    test_name,
    korean_name,
    avg(throughput) as avg_throughput,
    avg(latency_avg) as avg_latency,
    avg(latency_p95) as avg_p95_latency,
    avg(error_rate) as avg_error_rate,
    toStartOfDay(timestamp) as benchmark_date,
    formatDateTime(benchmark_date, '%Y-%m-%d', 'Asia/Seoul') as korean_date,
    count() as benchmark_runs
FROM performance_benchmarks 
WHERE timestamp >= now() - INTERVAL 30 DAY
GROUP BY benchmark_type, korean_type, test_name, korean_name, benchmark_date
ORDER BY benchmark_date DESC, avg_throughput DESC;

-- 종합 시스템 상태 뷰 (실시간)
CREATE VIEW IF NOT EXISTS v_system_health_overview AS
SELECT 
    'metrics' as component,
    '메트릭 수집' as korean_component,
    count() as total_records,
    max(timestamp) as last_update,
    formatDateTime(last_update, '%Y-%m-%d %H:%i:%s', 'Asia/Seoul') as korean_last_update,
    if(last_update >= now() - INTERVAL 5 MINUTE, 'healthy', 'stale') as health_status,
    if(health_status = 'healthy', '정상', '지연') as korean_health_status
FROM metrics 
WHERE timestamp >= now() - INTERVAL 1 HOUR

UNION ALL

SELECT 
    'events' as component,
    '이벤트 처리' as korean_component,
    count() as total_records,
    max(timestamp) as last_update,
    formatDateTime(last_update, '%Y-%m-%d %H:%i:%s', 'Asia/Seoul') as korean_last_update,
    if(last_update >= now() - INTERVAL 5 MINUTE, 'healthy', 'stale') as health_status,
    if(health_status = 'healthy', '정상', '지연') as korean_health_status
FROM events 
WHERE timestamp >= now() - INTERVAL 1 HOUR

UNION ALL

SELECT 
    'sessions' as component,
    '세션 추적' as korean_component,
    count() as total_records,
    max(start_time) as last_update,
    formatDateTime(last_update, '%Y-%m-%d %H:%i:%s', 'Asia/Seoul') as korean_last_update,
    if(last_update >= now() - INTERVAL 10 MINUTE, 'healthy', 'stale') as health_status,
    if(health_status = 'healthy', '정상', '지연') as korean_health_status
FROM user_sessions 
WHERE start_time >= now() - INTERVAL 2 HOUR

UNION ALL

SELECT 
    'alerts' as component,
    '알림 시스템' as korean_component,
    count() as total_records,
    max(timestamp) as last_update,
    formatDateTime(last_update, '%Y-%m-%d %H:%i:%s', 'Asia/Seoul') as korean_last_update,
    if(last_update >= now() - INTERVAL 10 MINUTE, 'healthy', 'stale') as health_status,
    if(health_status = 'healthy', '정상', '지연') as korean_health_status
FROM alerts 
WHERE timestamp >= now() - INTERVAL 1 HOUR

ORDER BY component;