const express = require('express');
const { ClickHouse } = require('clickhouse');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const PORT = 3013;

// Middleware
app.use(cors());
app.use(express.json());

// ClickHouse client configuration
const clickhouse = new ClickHouse({
    url: process.env.CLICKHOUSE_HOST || 'http://clickhouse',
    port: 8123,
    debug: false,
    basicAuth: null,
    isUseGzip: false,
    format: "json",
    config: {
        session_timeout: 60,
        output_format_json_quote_64bit_integers: 0,
        enable_http_compression: 0,
        database: 'otel',
    }
});

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 3014 });

// Broadcast to all connected clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'otel-monitor', timestamp: new Date() });
});

// Get traces
app.get('/api/traces', async (req, res) => {
    try {
        const { service, operation, status, limit = 100, offset = 0 } = req.query;
        
        // Generate mock trace data
        const mockTraces = [];
        const services = ['java-sample-app', 'python-sample-app', 'otel-collector', 'otel-gateway'];
        const operations = ['HTTP GET', 'HTTP POST', 'database_query', 'cache_operation', 'processing'];
        
        for (let i = 0; i < Math.min(limit, 20); i++) {
            const serviceName = service || services[Math.floor(Math.random() * services.length)];
            const operationName = operation || operations[Math.floor(Math.random() * operations.length)];
            const statusCode = status !== undefined ? parseInt(status) : Math.random() > 0.9 ? 2 : 0;
            
            mockTraces.push({
                trace_id: `trace_${Date.now()}_${i}`,
                span_id: `span_${Date.now()}_${i}`,
                parent_span_id: i > 0 ? `span_${Date.now()}_${i-1}` : null,
                service_name: serviceName,
                operation_name: operationName,
                span_name: `${serviceName}.${operationName}`,
                timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
                duration_ms: Math.random() * 500 + 10,
                status_code: statusCode,
                status_message: statusCode === 0 ? '' : 'Error occurred',
                http_method: 'GET',
                http_url: '/api/test',
                http_status_code: statusCode === 0 ? 200 : 500,
                span_attributes: JSON.stringify({
                    'http.method': 'GET',
                    'http.url': '/api/test'
                })
            });
        }
        
        res.json(mockTraces);
    } catch (error) {
        console.error('Error fetching traces:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get trace details
app.get('/api/traces/:traceId', async (req, res) => {
    try {
        const { traceId } = req.params;
        
        const query = `
            SELECT *
            FROM otel_traces
            WHERE trace_id = '${traceId}'
            ORDER BY timestamp ASC
        `;
        
        const result = await clickhouse.query(query).toPromise();
        res.json(result);
    } catch (error) {
        console.error('Error fetching trace details:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get metrics
app.get('/api/metrics', async (req, res) => {
    try {
        const { service, metric, type = 'gauge', limit = 1000 } = req.query;
        
        // Generate mock metrics data
        const mockMetrics = [];
        const services = ['java-sample-app', 'python-sample-app'];
        const metricNames = ['processing_duration', 'memory_usage_percent', 'cpu_usage_percent', 'api_call_duration', 'cache_hit_rate'];
        
        for (let i = 0; i < Math.min(limit, 50); i++) {
            const serviceName = service || services[Math.floor(Math.random() * services.length)];
            const metricName = metric || metricNames[Math.floor(Math.random() * metricNames.length)];
            
            mockMetrics.push({
                metric_name: metricName,
                service_name: serviceName,
                timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
                value: Math.random() * 100 + 10,
                metric_attributes: JSON.stringify({
                    'service.name': serviceName,
                    'metric.type': type
                })
            });
        }
        
        res.json(mockMetrics);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get logs
app.get('/api/logs', async (req, res) => {
    try {
        const { service, level, search, limit = 100, offset = 0 } = req.query;
        
        let query = `
            SELECT 
                timestamp,
                service_name,
                severity_text,
                severity_number,
                body,
                trace_id,
                span_id,
                log_attributes
            FROM otel_logs
            WHERE 1=1
        `;
        
        if (service) query += ` AND service_name = '${service}'`;
        if (level) query += ` AND severity_text = '${level}'`;
        if (search) query += ` AND body LIKE '%${search}%'`;
        
        query += ` ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`;
        
        const result = await clickhouse.query(query).toPromise();
        res.json(result);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get service list
app.get('/api/services', async (req, res) => {
    try {
        // Return mock services list
        const mockServices = ['java-sample-app', 'python-sample-app', 'otel-collector', 'otel-gateway'];
        res.json(mockServices);
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get service dependencies
app.get('/api/dependencies', async (req, res) => {
    try {
        // Generate mock dependency data
        const mockDependencies = [
            {
                source_service: 'java-sample-app',
                target_service: 'clickhouse',
                total_calls: Math.floor(Math.random() * 100) + 50,
                avg_duration: Math.random() * 100 + 20,
                total_errors: Math.floor(Math.random() * 5)
            },
            {
                source_service: 'python-sample-app',
                target_service: 'clickhouse',
                total_calls: Math.floor(Math.random() * 80) + 30,
                avg_duration: Math.random() * 80 + 15,
                total_errors: Math.floor(Math.random() * 3)
            },
            {
                source_service: 'otel-collector',
                target_service: 'otel-gateway',
                total_calls: Math.floor(Math.random() * 200) + 100,
                avg_duration: Math.random() * 50 + 5,
                total_errors: Math.floor(Math.random() * 2)
            }
        ];
        
        res.json(mockDependencies);
    } catch (error) {
        console.error('Error fetching dependencies:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get service performance metrics
app.get('/api/services/:service/performance', async (req, res) => {
    try {
        const { service } = req.params;
        
        // Generate mock performance data for the requested service
        const mockPerformance = [];
        const now = Date.now();
        
        for (let i = 0; i < 20; i++) {
            const timestamp = new Date(now - (i * 60000)); // Each minute back
            mockPerformance.push({
                timestamp: timestamp.toISOString(),
                operation_name: 'HTTP GET',
                request_count: Math.floor(Math.random() * 100) + 20,
                avg_duration_ms: Math.random() * 200 + 50,
                p50_duration_ms: Math.random() * 150 + 30,
                p95_duration_ms: Math.random() * 400 + 100,
                p99_duration_ms: Math.random() * 800 + 200,
                error_count: Math.floor(Math.random() * 5),
                error_rate: Math.random() * 10
            });
        }
        
        res.json(mockPerformance);
    } catch (error) {
        console.error('Error fetching service performance:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get error analysis
app.get('/api/errors', async (req, res) => {
    try {
        const { service } = req.query;
        
        // Generate mock error analysis data
        const mockErrors = [];
        const services = service ? [service] : ['java-sample-app', 'python-sample-app'];
        const errorTypes = ['NullPointerException', 'ConnectionTimeout', 'ValidationError', 'DatabaseError', 'NetworkError'];
        const errorMessages = [
            'Cannot read property of undefined',
            'Connection timeout after 30 seconds',
            'Invalid input parameters',
            'Database connection failed',
            'Network request failed'
        ];
        
        for (let i = 0; i < 10; i++) {
            const timestamp = new Date(Date.now() - Math.random() * 3600000);
            const serviceName = services[Math.floor(Math.random() * services.length)];
            const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
            const errorMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
            
            mockErrors.push({
                timestamp: timestamp.toISOString(),
                service_name: serviceName,
                error_type: errorType,
                error_message: errorMessage,
                error_count: Math.floor(Math.random() * 10) + 1,
                affected_traces: Math.floor(Math.random() * 20) + 5
            });
        }
        
        // Sort by error_count DESC
        mockErrors.sort((a, b) => b.error_count - a.error_count);
        
        res.json(mockErrors);
    } catch (error) {
        console.error('Error fetching error analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

// Session replay endpoints
app.get('/api/sessions', async (req, res) => {
    try {
        const { userId, limit = 50 } = req.query;
        
        let query = `
            SELECT 
                session_id,
                user_id,
                timestamp,
                start_time,
                duration_ms,
                browser_name,
                os_name,
                country,
                page_views_count,
                errors_count,
                has_replay
            FROM browser_sessions
            WHERE has_replay = true
        `;
        
        if (userId) query += ` AND user_id = '${userId}'`;
        
        query += ` ORDER BY timestamp DESC LIMIT ${limit}`;
        
        const result = await clickhouse.query(query).toPromise();
        res.json(result);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get session replay events
app.get('/api/sessions/:sessionId/replay', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const query = `
            SELECT 
                event_id,
                timestamp,
                relative_timestamp,
                event_type,
                event_data,
                is_full_snapshot,
                dom_snapshot,
                mouse_x,
                mouse_y,
                scroll_x,
                scroll_y,
                page_url
            FROM session_replay_events
            WHERE session_id = '${sessionId}'
            ORDER BY relative_timestamp ASC
        `;
        
        const result = await clickhouse.query(query).toPromise();
        res.json(result);
    } catch (error) {
        console.error('Error fetching replay events:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get browser errors
app.get('/api/browser/errors', async (req, res) => {
    try {
        const { sessionId, type, limit = 100 } = req.query;
        
        let query = `
            SELECT 
                error_id,
                session_id,
                timestamp,
                error_type,
                error_message,
                error_stack,
                page_url,
                user_id
            FROM browser_errors
            WHERE 1=1
        `;
        
        if (sessionId) query += ` AND session_id = '${sessionId}'`;
        if (type) query += ` AND error_type = '${type}'`;
        
        query += ` ORDER BY timestamp DESC LIMIT ${limit}`;
        
        const result = await clickhouse.query(query).toPromise();
        res.json(result);
    } catch (error) {
        console.error('Error fetching browser errors:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get page performance metrics
app.get('/api/browser/performance', async (req, res) => {
    try {
        const { domain, path, interval = '1h' } = req.query;
        
        let query = `
            SELECT 
                timestamp,
                page_domain,
                page_path,
                view_count,
                avg_fcp,
                avg_lcp,
                avg_fid,
                avg_cls,
                p75_lcp,
                p95_lcp
            FROM page_performance_mv
            WHERE timestamp > now() - INTERVAL ${interval}
        `;
        
        if (domain) query += ` AND page_domain = '${domain}'`;
        if (path) query += ` AND page_path = '${path}'`;
        
        query += ` ORDER BY timestamp DESC`;
        
        const result = await clickhouse.query(query).toPromise();
        res.json(result);
    } catch (error) {
        console.error('Error fetching page performance:', error);
        res.status(500).json({ error: error.message });
    }
});

// System metrics aggregation
app.get('/api/system/metrics', async (req, res) => {
    try {
        // Generate mock system metrics data
        const mockSystemMetrics = [];
        const now = Date.now();
        const metricNames = ['system_cpu_usage', 'system_memory_usage', 'db_connections_active'];
        const services = ['java-sample-app', 'python-sample-app', 'otel-collector'];
        
        for (let i = 0; i < 10; i++) {
            const time = new Date(now - (i * 60000));
            
            metricNames.forEach(metricName => {
                services.forEach(serviceName => {
                    let avgValue;
                    if (metricName === 'system_cpu_usage') {
                        avgValue = Math.random() * 80 + 10;
                    } else if (metricName === 'system_memory_usage') {
                        avgValue = Math.random() * 70 + 20;
                    } else {
                        avgValue = Math.floor(Math.random() * 20) + 5;
                    }
                    
                    mockSystemMetrics.push({
                        time: time.toISOString(),
                        service_name: serviceName,
                        metric_name: metricName,
                        avg_value: avgValue,
                        max_value: avgValue + Math.random() * 10,
                        min_value: Math.max(0, avgValue - Math.random() * 10)
                    });
                });
            });
        }
        
        res.json(mockSystemMetrics);
    } catch (error) {
        console.error('Error fetching system metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Database metrics
app.get('/api/database/metrics', async (req, res) => {
    try {
        // Generate mock database metrics data
        const mockDbMetrics = [];
        const now = Date.now();
        const services = ['java-sample-app', 'python-sample-app'];
        const dbSystems = ['clickhouse', 'postgresql', 'redis'];
        
        for (let i = 0; i < 15; i++) {
            const time = new Date(now - (i * 60000));
            
            services.forEach(serviceName => {
                dbSystems.forEach(dbSystem => {
                    mockDbMetrics.push({
                        time: time.toISOString(),
                        service_name: serviceName,
                        db_system: dbSystem,
                        db_name: dbSystem === 'clickhouse' ? 'otel' : 'airis_apm',
                        query_count: Math.floor(Math.random() * 50) + 10,
                        avg_duration_ms: Math.random() * 200 + 30,
                        max_duration_ms: Math.random() * 500 + 100,
                        error_count: Math.floor(Math.random() * 3)
                    });
                });
            });
        }
        
        res.json(mockDbMetrics);
    } catch (error) {
        console.error('Error fetching database metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

// WAS metrics (JVM, Thread Pool, etc.)
app.get('/api/was/metrics', async (req, res) => {
    try {
        const { service } = req.query;
        
        let query = `
            SELECT 
                toStartOfMinute(timestamp) as time,
                service_name,
                metric_name,
                avg(value) as avg_value
            FROM otel_metrics_gauge
            WHERE metric_name LIKE 'jvm.%' 
                OR metric_name LIKE 'thread.%'
                OR metric_name LIKE 'http.server.%'
        `;
        
        if (service) query += ` AND service_name = '${service}'`;
        
        query += `
            AND timestamp > now() - INTERVAL 1 HOUR
            GROUP BY time, service_name, metric_name
            ORDER BY time DESC
        `;
        
        const result = await clickhouse.query(query).toPromise();
        res.json(result);
    } catch (error) {
        console.error('Error fetching WAS metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`OpenTelemetry Monitor Service running on port ${PORT}`);
});

// Start metrics polling for WebSocket updates
setInterval(async () => {
    try {
        // Generate mock real-time metrics for WebSocket
        const mockMetrics = [
            {
                service_name: 'java-sample-app',
                request_count: Math.floor(Math.random() * 100) + 50,
                avg_duration_ms: Math.random() * 200 + 50,
                error_count: Math.floor(Math.random() * 5)
            },
            {
                service_name: 'python-sample-app', 
                request_count: Math.floor(Math.random() * 80) + 30,
                avg_duration_ms: Math.random() * 150 + 30,
                error_count: Math.floor(Math.random() * 3)
            }
        ];
        
        broadcast({ type: 'metrics_update', data: mockMetrics });
    } catch (error) {
        console.error('Error in metrics polling:', error);
    }
}, 5000); // Poll every 5 seconds