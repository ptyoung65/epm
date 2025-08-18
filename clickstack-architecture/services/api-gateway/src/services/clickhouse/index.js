/**
 * ClickHouse service module exports
 * Main entry point for AIRIS-MON ClickHouse integration
 */

const ClickHouseService = require('./ClickHouseService');
const ClickHouseConnectionPool = require('./connectionPool');
const queryBuilder = require('./queryBuilder');
const schemas = require('./schemas');

// Create singleton instance
let clickHouseInstance = null;

/**
 * Get ClickHouse service instance (singleton)
 */
function getClickHouseService(config = {}) {
  if (!clickHouseInstance) {
    clickHouseInstance = new ClickHouseService(config);
  }
  return clickHouseInstance;
}

/**
 * Initialize ClickHouse service with configuration
 */
async function initializeClickHouse(config = {}) {
  const service = getClickHouseService(config);
  await service.initialize();
  return service;
}

/**
 * Factory for creating connection pool
 */
function createConnectionPool(config = {}) {
  return new ClickHouseConnectionPool(config);
}

/**
 * Pre-configured query builders for common use cases
 */
const queries = {
  dashboard: {
    overview: (timeRange, filters) => queryBuilder.getOverviewMetrics(timeRange, filters),
    timeseries: (timeRange, filters) => queryBuilder.getTimeseriesMetrics(timeRange, filters),
    services: (timeRange, filters, limit) => queryBuilder.getTopServices(timeRange, filters, limit),
    errors: (timeRange, filters) => queryBuilder.getErrorRates(timeRange, filters),
    performance: (timeRange, filters) => queryBuilder.getPerformanceMetrics(timeRange, filters),
    health: (timeRange, filters) => queryBuilder.getServiceHealthOverview(timeRange, filters)
  },
  analytics: {
    anomalies: (metric, timeRange, sensitivity) => 
      queryBuilder.getAnomalyDetectionQuery(metric, timeRange, sensitivity),
    businessHours: (timeRange, filters) => 
      queryBuilder.getKoreanBusinessHoursAnalysis(timeRange, filters),
    timeRange: (start, end, aggregation) => 
      queryBuilder.getKoreanTimeRangeQuery(start, end, aggregation)
  },
  traces: {
    analysis: (traceId) => queryBuilder.getTraceAnalysis(traceId)
  }
};

/**
 * Helper functions for Korean timezone operations
 */
const korean = {
  now: () => {
    return new Date().toLocaleString('ko-KR', { 
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  },
  
  formatDate: (date = new Date()) => {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  },
  
  formatDateTime: (date = new Date()) => {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  },
  
  getBusinessHours: () => ({ start: 9, end: 18 }),
  
  isBusinessHours: (date = new Date()) => {
    const koreanTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const hour = koreanTime.getHours();
    const dayOfWeek = koreanTime.getDay();
    
    // Monday = 1, Sunday = 0
    return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour <= 18;
  },
  
  getDayOfWeek: (date = new Date()) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const koreanTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return days[koreanTime.getDay()];
  },
  
  getTimeCategory: (date = new Date()) => {
    const koreanTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const hour = koreanTime.getHours();
    const dayOfWeek = koreanTime.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'weekend';
    } else if (hour >= 9 && hour <= 18) {
      return 'business_hours';
    } else if (hour >= 19 && hour <= 22) {
      return 'evening';
    } else {
      return 'night';
    }
  }
};

/**
 * Health check utilities
 */
const health = {
  async checkService(service = null) {
    const svc = service || getClickHouseService();
    return await svc.healthCheck();
  },
  
  async checkConnectionPool(pool) {
    if (!pool) return { status: 'not_configured' };
    
    try {
      const stats = pool.getStats();
      return {
        status: 'healthy',
        stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
};

/**
 * Event data builders for different observability signals
 */
const eventBuilders = {
  metric: (name, value, unit, tags = {}, service = 'unknown') => ({
    event_type: 'metric',
    service_name: service,
    metric_name: name,
    metric_value: value,
    metric_unit: unit,
    metric_tags: tags
  }),
  
  log: (level, message, context = {}, service = 'unknown') => ({
    event_type: 'log',
    service_name: service,
    log_level: level,
    log_message: message,
    log_context: context
  }),
  
  trace: (spanName, duration, status = 'OK', traceId = null, spanId = null, service = 'unknown') => ({
    event_type: 'trace',
    service_name: service,
    span_name: spanName,
    span_duration: duration,
    span_status: status,
    trace_id: traceId,
    span_id: spanId
  }),
  
  alert: (name, severity, status, message, service = 'unknown') => ({
    event_type: 'alert',
    service_name: service,
    alert_name: name,
    alert_severity: severity,
    alert_status: status,
    alert_message: message
  })
};

/**
 * Batch processing utilities
 */
const batch = {
  async insertEvents(events, service = null) {
    const svc = service || getClickHouseService();
    await svc.insertWideEvents(events);
  },
  
  async insertMetrics(metrics, service = null) {
    const events = metrics.map(m => eventBuilders.metric(
      m.name, m.value, m.unit, m.tags, m.service
    ));
    await batch.insertEvents(events, service);
  },
  
  async insertLogs(logs, service = null) {
    const events = logs.map(l => eventBuilders.log(
      l.level, l.message, l.context, l.service
    ));
    await batch.insertEvents(events, service);
  }
};

module.exports = {
  // Core classes
  ClickHouseService,
  ClickHouseConnectionPool,
  
  // Factory functions
  getClickHouseService,
  initializeClickHouse,
  createConnectionPool,
  
  // Query utilities
  queryBuilder,
  queries,
  schemas,
  
  // Korean timezone utilities
  korean,
  
  // Health utilities
  health,
  
  // Event builders
  eventBuilders,
  
  // Batch utilities
  batch,
  
  // Constants
  constants: {
    DEFAULT_TIMEZONE: 'Asia/Seoul',
    BUSINESS_HOURS: { start: 9, end: 18 },
    WEEKEND_DAYS: ['토', '일'],
    TIME_CATEGORIES: ['business_hours', 'evening', 'night', 'weekend'],
    LOG_LEVELS: ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'],
    ALERT_SEVERITIES: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    SPAN_STATUSES: ['OK', 'CANCELLED', 'UNKNOWN', 'INVALID_ARGUMENT', 'DEADLINE_EXCEEDED', 'NOT_FOUND', 'ALREADY_EXISTS', 'PERMISSION_DENIED', 'RESOURCE_EXHAUSTED', 'FAILED_PRECONDITION', 'ABORTED', 'OUT_OF_RANGE', 'UNIMPLEMENTED', 'INTERNAL', 'UNAVAILABLE', 'DATA_LOSS', 'UNAUTHENTICATED']
  }
};