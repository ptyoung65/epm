-- 세션 리플레이와 OpenTelemetry 연계 통합 추적 DB 스키마
-- AIRIS APM 시스템용 통합 세션 추적 테이블

-- 1. 통합 세션 추적 마스터 테이블
CREATE TABLE IF NOT EXISTS session_tracking (
    id SERIAL PRIMARY KEY,
    
    -- 세션 식별 정보
    airis_session_id VARCHAR(100) NOT NULL UNIQUE,          -- AIRIS 세션 리플레이 ID
    otel_session_id VARCHAR(100),                           -- OpenTelemetry 세션 ID
    otel_trace_id VARCHAR(100),                             -- OpenTelemetry Trace ID
    
    -- 사용자 및 환경 정보
    user_id VARCHAR(100),                                   -- 사용자 ID (있는 경우)
    user_agent TEXT,                                        -- 브라우저 정보
    ip_address VARCHAR(45),                                 -- 클라이언트 IP
    geo_location JSONB,                                     -- 지리적 위치 정보
    
    -- 세션 메타데이터
    session_start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end_time TIMESTAMP WITH TIME ZONE,
    session_duration_ms INTEGER,
    total_page_views INTEGER DEFAULT 0,
    
    -- 세션 리플레이 정보
    replay_event_count INTEGER DEFAULT 0,
    replay_file_size INTEGER DEFAULT 0,
    replay_status VARCHAR(20) DEFAULT 'active',            -- active, completed, failed
    
    -- OpenTelemetry 메트릭 요약
    otel_span_count INTEGER DEFAULT 0,
    otel_error_count INTEGER DEFAULT 0,
    avg_response_time_ms DECIMAL(10,2),
    total_requests INTEGER DEFAULT 0,
    
    -- 비즈니스 메트릭
    conversion_events JSONB DEFAULT '[]',                   -- 전환 이벤트들
    business_value DECIMAL(10,2),                           -- 비즈니스 가치
    customer_satisfaction_score INTEGER,                    -- 고객 만족도
    
    -- 시스템 정보
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 인덱스를 위한 컬럼들
    date_partition DATE GENERATED ALWAYS AS (session_start_time::DATE) STORED
);

-- 2. 세션별 페이지 뷰 추적 테이블
CREATE TABLE IF NOT EXISTS session_page_views (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES session_tracking(airis_session_id),
    
    -- 페이지 정보
    page_url TEXT NOT NULL,
    page_title VARCHAR(500),
    page_load_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    page_unload_time TIMESTAMP WITH TIME ZONE,
    time_spent_ms INTEGER,
    
    -- 페이지 성능 메트릭
    dom_content_loaded_ms INTEGER,
    first_contentful_paint_ms INTEGER,
    largest_contentful_paint_ms INTEGER,
    
    -- OpenTelemetry 연계 정보
    otel_page_span_id VARCHAR(100),
    otel_page_trace_id VARCHAR(100),
    
    -- 페이지별 사용자 행동
    click_count INTEGER DEFAULT 0,
    scroll_depth_percentage INTEGER DEFAULT 0,
    form_interactions INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 세션-텔레메트리 이벤트 상관관계 테이블
CREATE TABLE IF NOT EXISTS session_telemetry_correlation (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES session_tracking(airis_session_id),
    
    -- OpenTelemetry 정보
    otel_span_id VARCHAR(100) NOT NULL,
    otel_trace_id VARCHAR(100) NOT NULL,
    otel_service_name VARCHAR(100),
    otel_operation_name VARCHAR(200),
    
    -- 타이밍 정보 (마이크로초 단위)
    otel_start_time TIMESTAMP WITH TIME ZONE,
    otel_end_time TIMESTAMP WITH TIME ZONE,
    otel_duration_us BIGINT,
    
    -- 세션 리플레이 이벤트 정보
    replay_event_timestamp TIMESTAMP WITH TIME ZONE,
    replay_event_type VARCHAR(50),                          -- dom, click, input, navigation 등
    replay_event_data JSONB,
    
    -- 상관관계 메타데이터
    correlation_confidence DECIMAL(3,2) DEFAULT 1.0,       -- 0.00 - 1.00
    correlation_type VARCHAR(50),                           -- direct, inferred, manual
    
    -- 오류 및 성능 정보
    is_error BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    http_status_code INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 세션 분석 인사이트 테이블 (AI 분석 결과)
CREATE TABLE IF NOT EXISTS session_analysis_insights (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES session_tracking(airis_session_id),
    
    -- 분석 정보
    analysis_type VARCHAR(50) NOT NULL,                     -- performance, user_behavior, error_analysis
    analysis_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- AI 분석 결과
    insight_title VARCHAR(200),
    insight_description TEXT,
    insight_severity VARCHAR(20),                           -- low, medium, high, critical
    insight_category VARCHAR(50),                           -- performance, ux, error, security
    
    -- 정량적 지표
    metric_name VARCHAR(100),
    metric_value DECIMAL(15,4),
    metric_unit VARCHAR(20),
    baseline_value DECIMAL(15,4),
    deviation_percentage DECIMAL(5,2),
    
    -- 권장사항
    recommendations JSONB,                                  -- 개선 권장사항들
    estimated_impact VARCHAR(20),                           -- low, medium, high
    
    -- 관련 데이터 참조
    related_spans TEXT[],                                   -- 관련 OpenTelemetry span ID들
    related_events JSONB,                                   -- 관련 세션 리플레이 이벤트들
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 세션 태그 및 분류 테이블
CREATE TABLE IF NOT EXISTS session_tags (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES session_tracking(airis_session_id),
    
    -- 태그 정보
    tag_key VARCHAR(100) NOT NULL,
    tag_value VARCHAR(500) NOT NULL,
    tag_source VARCHAR(50) NOT NULL,                        -- manual, auto, ai_generated
    
    -- 메타데이터
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    created_by VARCHAR(100),                                -- 태그를 생성한 사용자/시스템
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id, tag_key, tag_value)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_session_tracking_otel_session ON session_tracking(otel_session_id);
CREATE INDEX IF NOT EXISTS idx_session_tracking_otel_trace ON session_tracking(otel_trace_id);
CREATE INDEX IF NOT EXISTS idx_session_tracking_start_time ON session_tracking(session_start_time);
CREATE INDEX IF NOT EXISTS idx_session_tracking_status ON session_tracking(replay_status);
CREATE INDEX IF NOT EXISTS idx_session_tracking_date_partition ON session_tracking(date_partition);

CREATE INDEX IF NOT EXISTS idx_page_views_session ON session_page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_url ON session_page_views(page_url);
CREATE INDEX IF NOT EXISTS idx_page_views_load_time ON session_page_views(page_load_time);

CREATE INDEX IF NOT EXISTS idx_correlation_session ON session_telemetry_correlation(session_id);
CREATE INDEX IF NOT EXISTS idx_correlation_span ON session_telemetry_correlation(otel_span_id);
CREATE INDEX IF NOT EXISTS idx_correlation_trace ON session_telemetry_correlation(otel_trace_id);
CREATE INDEX IF NOT EXISTS idx_correlation_service ON session_telemetry_correlation(otel_service_name);
CREATE INDEX IF NOT EXISTS idx_correlation_time ON session_telemetry_correlation(otel_start_time);

CREATE INDEX IF NOT EXISTS idx_insights_session ON session_analysis_insights(session_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON session_analysis_insights(analysis_type);
CREATE INDEX IF NOT EXISTS idx_insights_severity ON session_analysis_insights(insight_severity);
CREATE INDEX IF NOT EXISTS idx_insights_timestamp ON session_analysis_insights(analysis_timestamp);

CREATE INDEX IF NOT EXISTS idx_tags_session ON session_tags(session_id);
CREATE INDEX IF NOT EXISTS idx_tags_key ON session_tags(tag_key);
CREATE INDEX IF NOT EXISTS idx_tags_source ON session_tags(tag_source);

-- 뷰 생성: 통합 세션 요약 뷰
CREATE OR REPLACE VIEW session_summary AS
SELECT 
    st.airis_session_id,
    st.otel_session_id,
    st.otel_trace_id,
    st.user_id,
    st.session_start_time,
    st.session_end_time,
    st.session_duration_ms,
    st.total_page_views,
    st.replay_event_count,
    st.replay_status,
    st.otel_span_count,
    st.otel_error_count,
    st.avg_response_time_ms,
    st.total_requests,
    
    -- 페이지 뷰 통계
    COALESCE(pv.page_count, 0) as actual_page_count,
    COALESCE(pv.total_time_spent_ms, 0) as total_time_spent_ms,
    COALESCE(pv.avg_page_load_time, 0) as avg_page_load_time_ms,
    
    -- 인사이트 요약
    COALESCE(ins.critical_insights, 0) as critical_insights_count,
    COALESCE(ins.high_insights, 0) as high_insights_count,
    
    -- 태그 정보
    COALESCE(tags.tag_list, '[]'::jsonb) as session_tags
    
FROM session_tracking st
LEFT JOIN (
    SELECT 
        session_id,
        COUNT(*) as page_count,
        SUM(time_spent_ms) as total_time_spent_ms,
        AVG(dom_content_loaded_ms) as avg_page_load_time
    FROM session_page_views 
    GROUP BY session_id
) pv ON st.airis_session_id = pv.session_id
LEFT JOIN (
    SELECT 
        session_id,
        COUNT(CASE WHEN insight_severity = 'critical' THEN 1 END) as critical_insights,
        COUNT(CASE WHEN insight_severity = 'high' THEN 1 END) as high_insights
    FROM session_analysis_insights
    GROUP BY session_id
) ins ON st.airis_session_id = ins.session_id
LEFT JOIN (
    SELECT 
        session_id,
        jsonb_agg(jsonb_build_object('key', tag_key, 'value', tag_value, 'source', tag_source)) as tag_list
    FROM session_tags
    GROUP BY session_id
) tags ON st.airis_session_id = tags.session_id;

-- 트리거 함수: 세션 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_tracking_update_timestamp
    BEFORE UPDATE ON session_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_session_timestamp();

-- 샘플 데이터 삽입 (개발/테스트용)
INSERT INTO session_tracking (
    airis_session_id, otel_session_id, otel_trace_id,
    user_id, user_agent, ip_address,
    total_page_views, replay_event_count, replay_status,
    otel_span_count, otel_error_count, avg_response_time_ms, total_requests
) VALUES 
(
    'airis-session-' || generate_random_uuid()::text,
    'otel-session-' || generate_random_uuid()::text,  
    'trace-' || generate_random_uuid()::text,
    'user-demo-001',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    '192.168.1.100',
    3, 127, 'completed',
    15, 0, 145.67, 8
),
(
    'airis-session-' || generate_random_uuid()::text,
    'otel-session-' || generate_random_uuid()::text,
    'trace-' || generate_random_uuid()::text,
    'user-demo-002', 
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    '192.168.1.101',
    5, 234, 'active',
    23, 2, 89.34, 12
);

-- 주석: 이 스키마는 다음과 같은 주요 기능을 제공합니다:
-- 1. 세션 리플레이와 OpenTelemetry 데이터의 완전한 연계 추적
-- 2. 페이지별 상세 성능 메트릭 및 사용자 행동 분석  
-- 3. AI 기반 인사이트 생성 및 저장
-- 4. 유연한 태깅 시스템으로 세션 분류
-- 5. 효율적인 쿼리를 위한 최적화된 인덱스
-- 6. 실시간 분석을 위한 뷰 및 트리거