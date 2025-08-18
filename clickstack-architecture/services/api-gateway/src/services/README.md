# AIRIS-MON ClickHouse Service

A comprehensive ClickHouse service implementation for AIRIS-MON following ClickStack architecture patterns, optimized for Korean timezone and unified observability data model.

## Features

### 🏗️ ClickStack Architecture
- **Wide Events Data Model**: Unified schema for metrics, logs, traces, and alerts
- **Korean Timezone Support**: Asia/Seoul timezone handling throughout the stack
- **Real-time Analytics**: Materialized views for dashboard queries
- **High-Performance**: Connection pooling and batch processing

### 🌏 Korean Localization
- **Timezone Optimization**: All timestamps in Asia/Seoul timezone
- **Business Hours Analysis**: Korean working hours (9-18) and weekend detection
- **Korean Date Formatting**: Localized date/time display
- **Time Categorization**: Business hours, evening, night, weekend classification

### 📊 Observability Signals
- **Metrics**: Time-series data with tags and Korean timezone aggregation
- **Logs**: Structured logging with severity levels and context
- **Traces**: Distributed tracing with span relationships
- **Alerts**: Alert management with Korean time-aware analysis

### ⚡ Performance Features
- **Connection Pooling**: High-throughput connection management with failover
- **Batch Processing**: Configurable batch sizes for optimal ingestion
- **Query Caching**: Redis-based caching for dashboard queries
- **Async Operations**: Non-blocking operations with retry logic
- **Memory Optimization**: Streaming results for large datasets

## Quick Start

```javascript
const { initializeClickHouse, eventBuilders } = require('./clickhouse');

// Initialize service
const clickHouse = await initializeClickHouse({
  clickhouse: {
    host: 'localhost',
    port: 8123,
    username: 'default',
    password: '',
    database: 'airis_mon'
  },
  redis: {
    host: 'localhost',
    port: 6379
  },
  batch: {
    size: 1000,
    flushInterval: 5000
  }
});

// Insert metrics
await clickHouse.insertWideEvent(
  eventBuilders.metric('cpu_usage', 75.5, 'percent', {
    host: 'web-01',
    region: 'seoul'
  }, 'api-gateway')
);

// Get dashboard data
const dashboardData = await clickHouse.getDashboardMetrics('1h', {
  services: ['api-gateway', 'database'],
  businessHoursOnly: true
});

// Detect anomalies
const anomalies = await clickHouse.detectAnomalies(
  'response_time', 
  '24h', 
  'medium'
);
```

## Architecture

### Wide Events Schema
```sql
CREATE TABLE wide_events (
    -- Core fields
    timestamp DateTime64(3, 'Asia/Seoul'),
    event_type LowCardinality(String),
    service_name LowCardinality(String),
    
    -- Metrics
    metric_name Nullable(String),
    metric_value Nullable(Float64),
    
    -- Logs
    log_level Nullable(String),
    log_message Nullable(String),
    
    -- Traces
    trace_id Nullable(String),
    span_duration Nullable(UInt64),
    
    -- Alerts
    alert_severity Nullable(String),
    
    -- Korean timezone fields
    korean_hour UInt8,
    korean_day_of_week String
);
```

### Connection Pool
- **Failover Support**: Multiple ClickHouse hosts with round-robin
- **Health Monitoring**: Automatic connection health checks
- **Resource Management**: Configurable min/max connections
- **Statistics**: Query performance and connection metrics

### Query Builder
- **Korean Time Ranges**: Business hours, weekend, evening analysis
- **Anomaly Detection**: Statistical anomaly detection with Korean context
- **Dashboard Queries**: Pre-built queries for real-time dashboards
- **Performance Optimization**: Efficient aggregation queries

## Configuration

### Environment Variables
```bash
# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=airis_mon

# Redis (optional, for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Node Environment
NODE_ENV=production
```

### Service Configuration
```javascript
const config = {
  clickhouse: {
    hosts: [
      { host: 'clickhouse-01', port: 8123 },
      { host: 'clickhouse-02', port: 8123 }
    ],
    maxConnections: 20,
    connectionTimeout: 5000,
    timezone: 'Asia/Seoul'
  },
  redis: {
    host: 'redis',
    ttl: 3600
  },
  batch: {
    size: 1000,
    flushInterval: 5000,
    maxRetries: 3
  }
};
```

## Usage Examples

### Metrics Collection
```javascript
// Single metric
await clickHouse.insertWideEvent({
  event_type: 'metric',
  service_name: 'api-gateway',
  metric_name: 'request_duration',
  metric_value: 150.5,
  metric_unit: 'ms',
  metric_tags: { endpoint: '/api/health', method: 'GET' }
});

// Batch metrics
await clickHouse.insertWideEvents([
  eventBuilders.metric('cpu_usage', 75.0, 'percent', {}, 'web-server'),
  eventBuilders.metric('memory_usage', 60.5, 'percent', {}, 'web-server'),
  eventBuilders.metric('disk_usage', 45.2, 'percent', {}, 'web-server')
]);
```

### Log Ingestion
```javascript
await clickHouse.insertWideEvent(
  eventBuilders.log('ERROR', 'Database connection failed', {
    error_code: 'DB_CONN_ERR',
    retry_count: 3,
    database: 'users'
  }, 'api-gateway')
);
```

### Trace Collection
```javascript
await clickHouse.insertWideEvent(
  eventBuilders.trace('GET /api/users', 250000, 'OK', 
    'trace-123', 'span-456', 'user-service')
);
```

### Alert Management
```javascript
await clickHouse.insertWideEvent(
  eventBuilders.alert('HighCPUUsage', 'CRITICAL', 'FIRING',
    'CPU usage exceeded 90% for 10 minutes', 'web-server')
);
```

### Dashboard Queries
```javascript
// Overview metrics
const overview = await clickHouse.query(
  queries.dashboard.overview('1h', { services: ['api-gateway'] })
);

// Time series data
const timeseries = await clickHouse.query(
  queries.dashboard.timeseries('24h')
);

// Korean business hours analysis
const businessHours = await clickHouse.query(
  queries.analytics.businessHours('7d')
);
```

### Anomaly Detection
```javascript
// Detect CPU usage anomalies
const cpuAnomalies = await clickHouse.detectAnomalies(
  'cpu_usage', '24h', 'medium'
);

// Memory usage spikes during business hours
const memorySpikes = await clickHouse.query(
  queries.analytics.anomalies('memory_usage', '7d', 'high')
);
```

### Korean Time Analysis
```javascript
// Get data for Korean business hours only
const businessHoursData = await clickHouse.getKoreanTimeRangeData(
  '2024-01-01T09:00:00+09:00',
  '2024-01-01T18:00:00+09:00',
  'hour'
);

// Check if current time is business hours
const isBusinessHours = korean.isBusinessHours();
const timeCategory = korean.getTimeCategory();
```

## Performance Optimization

### Batch Processing
- Configure batch size based on your ingestion rate
- Higher batch sizes = better throughput, higher latency
- Lower batch sizes = lower latency, more overhead

### Query Caching
- Dashboard queries are cached in Redis
- TTL configurable per query type
- Cache keys include query hash and parameters

### Connection Pooling
- Min/max connection limits prevent resource exhaustion
- Health checks ensure connection reliability
- Failover support for high availability

### Memory Management
- Use streaming for large result sets
- Compress data with ZSTD codec
- TTL policies for automatic data cleanup

## Monitoring and Health

### Health Check
```javascript
const health = await clickHouse.healthCheck();
console.log(health);
// {
//   status: 'healthy',
//   connected: true,
//   metrics: { queries: 1250, inserts: 5000, errors: 2 },
//   totalEvents: 125000,
//   redis: 'connected'
// }
```

### Performance Metrics
```javascript
const stats = connectionPool.getStats();
console.log(stats);
// {
//   totalConnections: 10,
//   activeConnections: 3,
//   waitingRequests: 0,
//   successfulQueries: 1250,
//   avgAcquireTime: 15.5
// }
```

## Database Schema

### Tables
- `wide_events` - Main unified events table
- `metrics_by_service_minute` - Pre-aggregated metrics
- `error_rates_by_service_hour` - Error rate summaries  
- `performance_by_service_span` - Performance metrics
- `korean_business_hours` - Korean timezone analysis

### Materialized Views
- Real-time aggregation of metrics, logs, traces, alerts
- Korean business hours categorization
- Performance percentiles calculation
- Error rate monitoring

### Indexes
- Service name and timestamp (minmax)
- Event type and timestamp (minmax) 
- Trace ID (bloom filter)
- Korean business hours (set)
- Log levels and alert severities (set)

## Korean Timezone Features

### Time Categories
- `business_hours`: 09:00-18:00, Monday-Friday
- `evening`: 19:00-22:00, Monday-Friday
- `night`: 23:00-08:00, all days
- `weekend`: Saturday-Sunday, all hours

### Business Hours Analysis
```javascript
// Get events during Korean business hours
const businessEvents = await clickHouse.query(`
  SELECT * FROM wide_events 
  WHERE korean_hour BETWEEN 9 AND 18 
    AND korean_day_of_week NOT IN ('토', '일')
`);

// Compare weekend vs weekday patterns
const weekendComparison = await clickHouse.query(
  queries.analytics.businessHours('30d')
);
```

### Korean Date Functions
```javascript
korean.now()                    // "2024-01-15 14:30:25"
korean.formatDate()             // "2024-01-15" 
korean.formatDateTime()         // "2024-01-15 14:30:25"
korean.getDayOfWeek()          // "월" (Monday)
korean.getTimeCategory()        // "business_hours"
korean.isBusinessHours()        // true/false
```

## Error Handling

### Connection Errors
- Automatic retry with exponential backoff
- Failover to secondary ClickHouse instances
- Connection pool health monitoring
- Circuit breaker pattern for fault tolerance

### Query Errors
- Query validation and sanitization
- Timeout handling with configurable limits
- Error categorization and logging
- Graceful degradation for non-critical queries

### Batch Processing Errors
- Failed batch retry with exponential backoff
- Partial batch processing on errors
- Dead letter queue for persistently failing events
- Monitoring and alerting for batch failures

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage

# Benchmark performance
npm run benchmark
```

## License

MIT License - see LICENSE file for details.