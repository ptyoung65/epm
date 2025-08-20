-- Session Replay Tables for Browser Monitoring
USE otel;

-- Browser sessions table
CREATE TABLE IF NOT EXISTS browser_sessions (
    -- Session identification
    session_id String,
    user_id String,
    anonymous_id String,
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    start_time DateTime64(9),
    end_time DateTime64(9),
    duration_ms UInt64,
    
    -- Browser info
    user_agent String,
    browser_name LowCardinality(String),
    browser_version String,
    os_name LowCardinality(String),
    os_version String,
    device_type LowCardinality(String),
    
    -- Location info
    ip_address String,
    country LowCardinality(String),
    city String,
    region String,
    timezone String,
    
    -- Page info
    initial_page_url String,
    initial_page_title String,
    referrer String,
    utm_source String,
    utm_medium String,
    utm_campaign String,
    
    -- Session metrics
    page_views_count UInt32,
    clicks_count UInt32,
    errors_count UInt32,
    rage_clicks_count UInt32,
    dead_clicks_count UInt32,
    
    -- Performance metrics
    avg_page_load_time Float32,
    avg_dom_content_loaded Float32,
    avg_first_contentful_paint Float32,
    avg_largest_contentful_paint Float32,
    
    -- Session attributes
    is_bounce Boolean,
    is_crashed Boolean,
    has_replay Boolean,
    
    -- Custom attributes
    attributes String,
    
    INDEX idx_session_id session_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_user_id user_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, session_id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Session replay events table
CREATE TABLE IF NOT EXISTS session_replay_events (
    -- Identification
    session_id String,
    event_id String,
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    relative_timestamp UInt64, -- Milliseconds since session start
    
    -- Event data
    event_type LowCardinality(String), -- 'dom_mutation', 'mouse_move', 'mouse_click', 'scroll', 'input', 'custom'
    event_data String, -- JSON encoded event data
    
    -- DOM snapshot (for full snapshots)
    is_full_snapshot Boolean DEFAULT false,
    dom_snapshot String CODEC(ZSTD(3)), -- Compressed DOM structure
    
    -- Incremental updates
    mutations Array(Tuple(
        type String,
        target_id String,
        attribute_name String,
        old_value String,
        new_value String
    )),
    
    -- Mouse/Touch events
    mouse_x Float32,
    mouse_y Float32,
    
    -- Scroll position
    scroll_x Float32,
    scroll_y Float32,
    
    -- Page context
    page_url String,
    page_title String,
    viewport_width UInt16,
    viewport_height UInt16,
    
    -- Privacy settings applied
    is_masked Boolean DEFAULT false,
    mask_level LowCardinality(String), -- 'none', 'inputs', 'all_text'
    
    INDEX idx_session_id session_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 1,
    INDEX idx_event_type event_type TYPE bloom_filter(0.001) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (session_id, timestamp)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Browser errors table
CREATE TABLE IF NOT EXISTS browser_errors (
    -- Identification
    error_id String,
    session_id String,
    trace_id String,
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    
    -- Error details
    error_type LowCardinality(String), -- 'javascript', 'network', 'resource', 'console'
    error_message String,
    error_stack String,
    error_filename String,
    error_lineno UInt32,
    error_colno UInt32,
    
    -- Context
    page_url String,
    user_agent String,
    browser_name LowCardinality(String),
    
    -- User impact
    user_id String,
    affected_users_count UInt32,
    occurrence_count UInt32,
    
    -- Network errors specific
    request_url String,
    request_method LowCardinality(String),
    response_status UInt16,
    
    -- Additional context
    breadcrumbs String, -- JSON array of user actions before error
    custom_data String, -- JSON custom context
    
    INDEX idx_session_id session_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_error_type error_type TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, session_id)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Page views table
CREATE TABLE IF NOT EXISTS browser_page_views (
    -- Identification
    view_id String,
    session_id String,
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    
    -- Page info
    page_url String,
    page_title String,
    page_path String,
    page_domain LowCardinality(String),
    
    -- Navigation
    referrer String,
    navigation_type LowCardinality(String), -- 'navigate', 'reload', 'back_forward', 'prerender'
    
    -- Performance metrics (Web Vitals)
    time_to_first_byte Float32,
    first_contentful_paint Float32,
    largest_contentful_paint Float32,
    first_input_delay Float32,
    cumulative_layout_shift Float32,
    interaction_to_next_paint Float32,
    
    -- Resource timing
    dom_interactive Float32,
    dom_content_loaded Float32,
    dom_complete Float32,
    load_event_end Float32,
    
    -- User context
    user_id String,
    viewport_width UInt16,
    viewport_height UInt16,
    screen_width UInt16,
    screen_height UInt16,
    
    -- Engagement metrics
    time_on_page UInt32,
    scroll_depth UInt8, -- Percentage
    clicks_count UInt16,
    
    INDEX idx_session_id session_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_page_domain page_domain TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, session_id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- User interactions table
CREATE TABLE IF NOT EXISTS browser_interactions (
    -- Identification
    interaction_id String,
    session_id String,
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    
    -- Interaction details
    interaction_type LowCardinality(String), -- 'click', 'input', 'submit', 'focus', 'blur', 'change'
    target_element String, -- CSS selector or element identifier
    target_text String,
    target_attributes String, -- JSON
    
    -- Position data
    x_position Float32,
    y_position Float32,
    page_x Float32,
    page_y Float32,
    
    -- Form data (for inputs, masked by default)
    field_name String,
    field_type LowCardinality(String),
    is_sensitive Boolean DEFAULT false,
    
    -- Context
    page_url String,
    
    -- Rage/Dead click detection
    is_rage_click Boolean DEFAULT false,
    is_dead_click Boolean DEFAULT false,
    click_count_in_area UInt8,
    
    INDEX idx_session_id session_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_interaction_type interaction_type TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, session_id)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Network requests table (for browser)
CREATE TABLE IF NOT EXISTS browser_network_requests (
    -- Identification
    request_id String,
    session_id String,
    trace_id String,
    span_id String,
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    
    -- Request details
    method LowCardinality(String),
    url String,
    domain LowCardinality(String),
    path String,
    
    -- Response details
    status_code UInt16,
    response_size UInt32,
    
    -- Timing (in milliseconds)
    duration Float32,
    dns_lookup Float32,
    tcp_connect Float32,
    tls_handshake Float32,
    request_time Float32,
    response_time Float32,
    
    -- Request type
    resource_type LowCardinality(String), -- 'xhr', 'fetch', 'document', 'stylesheet', 'script', 'image', 'font'
    initiator_type LowCardinality(String),
    
    -- Cache info
    from_cache Boolean,
    cache_status LowCardinality(String),
    
    -- Error info
    is_error Boolean DEFAULT false,
    error_message String,
    
    INDEX idx_session_id session_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_domain domain TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_status_code status_code TYPE minmax GRANULARITY 1,
    INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, session_id)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Console logs table (for debugging)
CREATE TABLE IF NOT EXISTS browser_console_logs (
    -- Identification
    log_id String,
    session_id String,
    
    -- Temporal data
    timestamp DateTime64(9) CODEC(DoubleDelta, ZSTD(1)),
    
    -- Log details
    level LowCardinality(String), -- 'debug', 'info', 'warn', 'error'
    message String,
    stack_trace String,
    
    -- Context
    page_url String,
    source_file String,
    line_number UInt32,
    column_number UInt32,
    
    -- Additional data
    arguments String, -- JSON array of console arguments
    
    INDEX idx_session_id session_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_level level TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, session_id)
TTL timestamp + INTERVAL 7 DAY
SETTINGS index_granularity = 8192;

-- Create materialized views for analytics
-- Session analytics view
CREATE MATERIALIZED VIEW IF NOT EXISTS session_analytics_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, browser_name, os_name, country)
AS SELECT
    toStartOfHour(timestamp) as timestamp,
    browser_name,
    os_name,
    device_type,
    country,
    count(DISTINCT session_id) as unique_sessions,
    count(DISTINCT user_id) as unique_users,
    avg(duration_ms) as avg_session_duration,
    sum(page_views_count) as total_page_views,
    sum(errors_count) as total_errors,
    sum(CASE WHEN is_bounce THEN 1 ELSE 0 END) as bounce_sessions,
    avg(avg_page_load_time) as avg_page_load_time
FROM browser_sessions
GROUP BY timestamp, browser_name, os_name, device_type, country;

-- Page performance view
CREATE MATERIALIZED VIEW IF NOT EXISTS page_performance_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, page_domain, page_path)
AS SELECT
    toStartOfHour(timestamp) as timestamp,
    page_domain,
    page_path,
    count() as view_count,
    avg(first_contentful_paint) as avg_fcp,
    avg(largest_contentful_paint) as avg_lcp,
    avg(first_input_delay) as avg_fid,
    avg(cumulative_layout_shift) as avg_cls,
    quantile(0.75)(largest_contentful_paint) as p75_lcp,
    quantile(0.95)(largest_contentful_paint) as p95_lcp
FROM browser_page_views
GROUP BY timestamp, page_domain, page_path;

-- Error summary view
CREATE MATERIALIZED VIEW IF NOT EXISTS browser_error_summary_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, error_type, error_message)
AS SELECT
    toStartOfHour(timestamp) as timestamp,
    error_type,
    error_message,
    count() as error_count,
    count(DISTINCT session_id) as affected_sessions,
    count(DISTINCT user_id) as affected_users,
    any(error_stack) as sample_stack,
    any(page_url) as sample_url
FROM browser_errors
GROUP BY timestamp, error_type, error_message;