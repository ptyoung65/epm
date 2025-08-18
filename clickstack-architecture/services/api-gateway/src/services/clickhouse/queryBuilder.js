/**
 * Query builder for ClickHouse with Korean timezone optimization
 * Provides helper functions for dashboard queries, analytics, and anomaly detection
 */

const moment = require('moment-timezone');

/**
 * Convert time range string to datetime bounds in Korean timezone
 */
function parseTimeRange(timeRange, timezone = 'Asia/Seoul') {
  const now = moment().tz(timezone);
  let startTime, endTime;

  switch (timeRange) {
    case '5m':
      startTime = now.clone().subtract(5, 'minutes');
      break;
    case '15m':
      startTime = now.clone().subtract(15, 'minutes');
      break;
    case '30m':
      startTime = now.clone().subtract(30, 'minutes');
      break;
    case '1h':
      startTime = now.clone().subtract(1, 'hours');
      break;
    case '3h':
      startTime = now.clone().subtract(3, 'hours');
      break;
    case '6h':
      startTime = now.clone().subtract(6, 'hours');
      break;
    case '12h':
      startTime = now.clone().subtract(12, 'hours');
      break;
    case '24h':
    case '1d':
      startTime = now.clone().subtract(1, 'days');
      break;
    case '3d':
      startTime = now.clone().subtract(3, 'days');
      break;
    case '7d':
    case '1w':
      startTime = now.clone().subtract(7, 'days');
      break;
    case '30d':
    case '1M':
      startTime = now.clone().subtract(30, 'days');
      break;
    default:
      startTime = now.clone().subtract(1, 'hours');
  }

  endTime = now;
  
  return {
    startTime: startTime.format(),
    endTime: endTime.format(),
    startTimeKST: startTime.format('YYYY-MM-DD HH:mm:ss'),
    endTimeKST: endTime.format('YYYY-MM-DD HH:mm:ss')
  };
}

/**
 * Build WHERE clause with filters
 */
function buildWhereClause(filters = {}, timeRange = '1h', timezone = 'Asia/Seoul') {
  const { startTime, endTime } = parseTimeRange(timeRange, timezone);
  let whereClause = `timestamp >= '${startTime}' AND timestamp <= '${endTime}'`;

  if (filters.services && filters.services.length > 0) {
    const serviceList = filters.services.map(s => `'${s}'`).join(',');
    whereClause += ` AND service_name IN (${serviceList})`;
  }

  if (filters.environments && filters.environments.length > 0) {
    const envList = filters.environments.map(e => `'${e}'`).join(',');
    whereClause += ` AND environment IN (${envList})`;
  }

  if (filters.eventTypes && filters.eventTypes.length > 0) {
    const typeList = filters.eventTypes.map(t => `'${t}'`).join(',');
    whereClause += ` AND event_type IN (${typeList})`;
  }

  if (filters.logLevels && filters.logLevels.length > 0) {
    const levelList = filters.logLevels.map(l => `'${l}'`).join(',');
    whereClause += ` AND log_level IN (${levelList})`;
  }

  if (filters.businessHoursOnly) {
    whereClause += ` AND korean_hour BETWEEN 9 AND 18 AND korean_day_of_week NOT IN ('토', '일')`;
  }

  return whereClause;
}

/**
 * Get overview metrics for dashboard
 */
function getOverviewMetrics(timeRange = '1h', filters = {}) {
  const whereClause = buildWhereClause(filters, timeRange);
  
  return `
    SELECT
      count() as total_events,
      uniq(service_name) as unique_services,
      countIf(event_type = 'metric') as metric_events,
      countIf(event_type = 'log') as log_events,
      countIf(event_type = 'trace') as trace_events,
      countIf(event_type = 'alert') as alert_events,
      countIf(log_level IN ('ERROR', 'FATAL')) as error_count,
      countIf(log_level = 'WARN') as warning_count,
      countIf(alert_severity = 'CRITICAL') as critical_alerts,
      countIf(alert_severity = 'HIGH') as high_alerts,
      avg(metric_value) as avg_metric_value,
      avg(span_duration) as avg_response_time,
      countIf(korean_hour BETWEEN 9 AND 18 AND korean_day_of_week NOT IN ('토', '일')) as business_hours_events,
      countIf(korean_hour NOT BETWEEN 9 AND 18 OR korean_day_of_week IN ('토', '일')) as off_hours_events
    FROM wide_events
    WHERE ${whereClause}
  `;
}

/**
 * Get timeseries metrics for charts
 */
function getTimeseriesMetrics(timeRange = '1h', filters = {}) {
  const whereClause = buildWhereClause(filters, timeRange);
  
  // Determine granularity based on time range
  let timeGranularity;
  if (timeRange.includes('m') || timeRange === '1h') {
    timeGranularity = "toStartOfMinute(timestamp, 'Asia/Seoul')";
  } else if (timeRange.includes('h') || timeRange === '1d') {
    timeGranularity = "toStartOfHour(timestamp, 'Asia/Seoul')";
  } else {
    timeGranularity = "toStartOfDay(timestamp, 'Asia/Seoul')";
  }
  
  return `
    SELECT
      ${timeGranularity} as time_bucket,
      formatDateTime(time_bucket, '%Y-%m-%d %H:%i:%s', 'Asia/Seoul') as korean_time,
      count() as total_events,
      countIf(event_type = 'metric') as metric_events,
      countIf(event_type = 'log') as log_events,
      countIf(event_type = 'trace') as trace_events,
      countIf(event_type = 'alert') as alert_events,
      countIf(log_level IN ('ERROR', 'FATAL')) as errors,
      countIf(log_level = 'WARN') as warnings,
      avg(metric_value) as avg_metric,
      avg(span_duration) as avg_response_time,
      quantile(0.95)(span_duration) as p95_response_time
    FROM wide_events
    WHERE ${whereClause}
    GROUP BY time_bucket
    ORDER BY time_bucket ASC
  `;
}

/**
 * Get top services by event volume
 */
function getTopServices(timeRange = '1h', filters = {}, limit = 10) {
  const whereClause = buildWhereClause(filters, timeRange);
  
  return `
    SELECT
      service_name,
      count() as total_events,
      countIf(event_type = 'metric') as metric_events,
      countIf(event_type = 'log') as log_events,
      countIf(event_type = 'trace') as trace_events,
      countIf(event_type = 'alert') as alert_events,
      countIf(log_level IN ('ERROR', 'FATAL')) as error_count,
      countIf(alert_severity IN ('CRITICAL', 'HIGH')) as critical_alerts,
      error_count / total_events * 100 as error_rate,
      avg(metric_value) as avg_metric_value,
      avg(span_duration) as avg_response_time,
      max(timestamp) as last_seen,
      formatDateTime(last_seen, '%Y-%m-%d %H:%i:%s', 'Asia/Seoul') as last_seen_korean
    FROM wide_events
    WHERE ${whereClause}
    GROUP BY service_name
    ORDER BY total_events DESC
    LIMIT ${limit}
  `;
}

/**
 * Get error rates by service and time
 */
function getErrorRates(timeRange = '1h', filters = {}) {
  const whereClause = buildWhereClause(filters, timeRange);
  
  let timeGranularity;
  if (timeRange.includes('m') || timeRange === '1h') {
    timeGranularity = "toStartOfMinute(timestamp, 'Asia/Seoul')";
  } else {
    timeGranularity = "toStartOfHour(timestamp, 'Asia/Seoul')";
  }
  
  return `
    SELECT
      ${timeGranularity} as time_bucket,
      service_name,
      formatDateTime(time_bucket, '%Y-%m-%d %H:%i:%s', 'Asia/Seoul') as korean_time,
      count() as total_events,
      countIf(log_level IN ('ERROR', 'FATAL')) as error_count,
      countIf(log_level = 'WARN') as warning_count,
      countIf(span_status != 'OK') as failed_spans,
      countIf(alert_severity IN ('CRITICAL', 'HIGH')) as critical_alerts,
      error_count / total_events * 100 as error_rate,
      warning_count / total_events * 100 as warning_rate
    FROM wide_events
    WHERE ${whereClause} AND event_type IN ('log', 'trace', 'alert')
    GROUP BY time_bucket, service_name
    HAVING total_events > 0
    ORDER BY time_bucket ASC, error_rate DESC
  `;
}

/**
 * Get performance metrics by service
 */
function getPerformanceMetrics(timeRange = '1h', filters = {}) {
  const whereClause = buildWhereClause(filters, timeRange);
  
  return `
    SELECT
      service_name,
      span_name,
      count() as request_count,
      avg(span_duration) as avg_duration,
      quantile(0.5)(span_duration) as p50_duration,
      quantile(0.95)(span_duration) as p95_duration,
      quantile(0.99)(span_duration) as p99_duration,
      min(span_duration) as min_duration,
      max(span_duration) as max_duration,
      countIf(span_status != 'OK') as error_count,
      error_count / request_count * 100 as error_rate,
      sum(span_duration) as total_duration
    FROM wide_events
    WHERE ${whereClause} AND event_type = 'trace' AND span_duration IS NOT NULL
    GROUP BY service_name, span_name
    HAVING request_count >= 10
    ORDER BY request_count DESC, avg_duration DESC
  `;
}

/**
 * Get anomaly detection query with Korean business hours context
 */
function getAnomalyDetectionQuery(metricName, timeRange = '24h', sensitivity = 'medium', timezone = 'Asia/Seoul') {
  const { startTime, endTime } = parseTimeRange(timeRange, timezone);
  
  // Sensitivity thresholds
  const thresholds = {
    low: { stddev_multiplier: 3, min_samples: 10 },
    medium: { stddev_multiplier: 2.5, min_samples: 15 },
    high: { stddev_multiplier: 2, min_samples: 20 }
  };
  
  const config = thresholds[sensitivity] || thresholds.medium;
  
  return `
    WITH 
      baseline AS (
        SELECT
          korean_hour,
          korean_day_of_week,
          avg(metric_value) as baseline_avg,
          stddevPop(metric_value) as baseline_stddev,
          count() as sample_count
        FROM wide_events
        WHERE 
          event_type = 'metric' 
          AND metric_name = '${metricName}'
          AND timestamp >= '${startTime}' - INTERVAL 7 DAY
          AND timestamp < '${startTime}'
          AND metric_value IS NOT NULL
        GROUP BY korean_hour, korean_day_of_week
        HAVING sample_count >= ${config.min_samples}
      ),
      current_data AS (
        SELECT
          timestamp,
          formatDateTime(timestamp, '%Y-%m-%d %H:%i:%s', '${timezone}') as korean_time,
          korean_hour,
          korean_day_of_week,
          service_name,
          metric_value,
          CASE
            WHEN korean_day_of_week IN ('토', '일') THEN 'weekend'
            WHEN korean_hour BETWEEN 9 AND 18 THEN 'business_hours'
            WHEN korean_hour BETWEEN 19 AND 22 THEN 'evening'
            ELSE 'night'
          END as time_category
        FROM wide_events
        WHERE 
          event_type = 'metric' 
          AND metric_name = '${metricName}'
          AND timestamp >= '${startTime}' 
          AND timestamp <= '${endTime}'
          AND metric_value IS NOT NULL
      )
    SELECT
      c.timestamp,
      c.korean_time,
      c.korean_hour,
      c.korean_day_of_week,
      c.time_category,
      c.service_name,
      c.metric_value,
      b.baseline_avg,
      b.baseline_stddev,
      abs(c.metric_value - b.baseline_avg) as deviation,
      deviation / b.baseline_stddev as z_score,
      CASE
        WHEN z_score > ${config.stddev_multiplier} THEN 'HIGH'
        WHEN z_score > ${config.stddev_multiplier * 0.7} THEN 'MEDIUM'
        WHEN z_score > ${config.stddev_multiplier * 0.4} THEN 'LOW'
        ELSE 'NORMAL'
      END as anomaly_severity,
      CASE
        WHEN c.metric_value > b.baseline_avg + (b.baseline_stddev * ${config.stddev_multiplier}) THEN 'SPIKE'
        WHEN c.metric_value < b.baseline_avg - (b.baseline_stddev * ${config.stddev_multiplier}) THEN 'DIP'
        ELSE 'NORMAL'
      END as anomaly_type
    FROM current_data c
    LEFT JOIN baseline b ON c.korean_hour = b.korean_hour AND c.korean_day_of_week = b.korean_day_of_week
    WHERE b.baseline_avg IS NOT NULL AND z_score > ${config.stddev_multiplier * 0.4}
    ORDER BY z_score DESC, timestamp DESC
  `;
}

/**
 * Get Korean time range query with proper aggregation
 */
function getKoreanTimeRangeQuery(startTime, endTime, aggregation = 'hour', timezone = 'Asia/Seoul') {
  let timeGranularity;
  let dateFormat;
  
  switch (aggregation) {
    case 'minute':
      timeGranularity = `toStartOfMinute(timestamp, '${timezone}')`;
      dateFormat = '%Y-%m-%d %H:%i:00';
      break;
    case 'hour':
      timeGranularity = `toStartOfHour(timestamp, '${timezone}')`;
      dateFormat = '%Y-%m-%d %H:00:00';
      break;
    case 'day':
      timeGranularity = `toStartOfDay(timestamp, '${timezone}')`;
      dateFormat = '%Y-%m-%d 00:00:00';
      break;
    case 'week':
      timeGranularity = `toStartOfWeek(timestamp, '${timezone}')`;
      dateFormat = '%Y-%m-%d 00:00:00';
      break;
    default:
      timeGranularity = `toStartOfHour(timestamp, '${timezone}')`;
      dateFormat = '%Y-%m-%d %H:00:00';
  }
  
  return `
    SELECT
      ${timeGranularity} as time_bucket,
      formatDateTime(time_bucket, '${dateFormat}', '${timezone}') as korean_time,
      toHour(time_bucket, '${timezone}') as korean_hour,
      CASE toDayOfWeek(time_bucket, '${timezone}')
        WHEN 1 THEN '월'
        WHEN 2 THEN '화'
        WHEN 3 THEN '수'
        WHEN 4 THEN '목'
        WHEN 5 THEN '금'
        WHEN 6 THEN '토'
        WHEN 7 THEN '일'
      END as korean_day_of_week,
      CASE
        WHEN toDayOfWeek(time_bucket, '${timezone}') IN (6, 7) THEN 'weekend'
        WHEN toHour(time_bucket, '${timezone}') BETWEEN 9 AND 18 THEN 'business_hours'
        WHEN toHour(time_bucket, '${timezone}') BETWEEN 19 AND 22 THEN 'evening'
        ELSE 'night'
      END as time_category,
      service_name,
      event_type,
      count() as event_count,
      countIf(log_level IN ('ERROR', 'FATAL')) as error_count,
      countIf(log_level = 'WARN') as warning_count,
      countIf(alert_severity IN ('CRITICAL', 'HIGH')) as critical_alerts,
      countIf(alert_severity = 'MEDIUM') as medium_alerts,
      avg(metric_value) as avg_metric_value,
      quantile(0.5)(metric_value) as median_metric_value,
      quantile(0.95)(metric_value) as p95_metric_value,
      avg(span_duration) as avg_response_time,
      quantile(0.95)(span_duration) as p95_response_time,
      uniq(trace_id) as unique_traces
    FROM wide_events
    WHERE timestamp >= '${startTime}' AND timestamp <= '${endTime}'
    GROUP BY time_bucket, service_name, event_type
    ORDER BY time_bucket ASC, event_count DESC
  `;
}

/**
 * Get Korean business hours analysis
 */
function getKoreanBusinessHoursAnalysis(timeRange = '7d', filters = {}) {
  const whereClause = buildWhereClause(filters, timeRange);
  
  return `
    SELECT
      korean_hour,
      korean_day_of_week,
      CASE
        WHEN korean_day_of_week IN ('토', '일') THEN 'weekend'
        WHEN korean_hour BETWEEN 9 AND 18 THEN 'business_hours'
        WHEN korean_hour BETWEEN 19 AND 22 THEN 'evening'
        ELSE 'night'
      END as time_category,
      service_name,
      count() as event_count,
      countIf(log_level IN ('ERROR', 'FATAL')) as error_count,
      countIf(alert_severity IN ('CRITICAL', 'HIGH')) as critical_alerts,
      avg(metric_value) as avg_metric_value,
      avg(span_duration) as avg_response_time,
      error_count / event_count * 100 as error_rate,
      critical_alerts / event_count * 100 as alert_rate
    FROM wide_events
    WHERE ${whereClause}
    GROUP BY korean_hour, korean_day_of_week, service_name
    ORDER BY korean_day_of_week, korean_hour, event_count DESC
  `;
}

/**
 * Get service health overview
 */
function getServiceHealthOverview(timeRange = '1h', filters = {}) {
  const whereClause = buildWhereClause(filters, timeRange);
  
  return `
    SELECT
      service_name,
      count() as total_events,
      countIf(log_level IN ('ERROR', 'FATAL')) as error_count,
      countIf(log_level = 'WARN') as warning_count,
      countIf(alert_severity = 'CRITICAL') as critical_alerts,
      countIf(alert_severity = 'HIGH') as high_alerts,
      countIf(span_status != 'OK') as failed_requests,
      error_count / total_events * 100 as error_rate,
      failed_requests / nullIf(countIf(event_type = 'trace'), 0) * 100 as failure_rate,
      avg(span_duration) as avg_response_time,
      quantile(0.95)(span_duration) as p95_response_time,
      max(timestamp) as last_seen,
      formatDateTime(last_seen, '%Y-%m-%d %H:%i:%s', 'Asia/Seoul') as last_seen_korean,
      CASE
        WHEN error_rate > 5 OR failure_rate > 5 OR critical_alerts > 0 THEN 'CRITICAL'
        WHEN error_rate > 2 OR failure_rate > 2 OR high_alerts > 0 THEN 'WARNING'
        WHEN error_rate > 0.5 OR failure_rate > 0.5 THEN 'DEGRADED'
        ELSE 'HEALTHY'
      END as health_status
    FROM wide_events
    WHERE ${whereClause}
    GROUP BY service_name
    ORDER BY 
      CASE health_status 
        WHEN 'CRITICAL' THEN 1
        WHEN 'WARNING' THEN 2
        WHEN 'DEGRADED' THEN 3
        ELSE 4
      END,
      total_events DESC
  `;
}

/**
 * Get trace analysis query
 */
function getTraceAnalysis(traceId, timezone = 'Asia/Seoul') {
  return `
    SELECT
      timestamp,
      formatDateTime(timestamp, '%Y-%m-%d %H:%i:%s.%f', '${timezone}') as korean_time,
      service_name,
      span_id,
      parent_span_id,
      span_name,
      span_duration,
      span_status,
      attributes,
      labels
    FROM wide_events
    WHERE trace_id = '${traceId}' AND event_type = 'trace'
    ORDER BY timestamp ASC, span_id ASC
  `;
}

module.exports = {
  parseTimeRange,
  buildWhereClause,
  getOverviewMetrics,
  getTimeseriesMetrics,
  getTopServices,
  getErrorRates,
  getPerformanceMetrics,
  getAnomalyDetectionQuery,
  getKoreanTimeRangeQuery,
  getKoreanBusinessHoursAnalysis,
  getServiceHealthOverview,
  getTraceAnalysis
};