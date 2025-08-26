import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { register, Gauge, Counter, Histogram, Summary, collectDefaultMetrics } from 'prom-client';

export interface MetricsConfig {
  serviceName: string;
  instanceId?: string;
  version?: string;
  logger?: Logger;
  prefix?: string;
  collectDefaultMetrics?: boolean;
  defaultMetricsInterval?: number;
  labels?: Record<string, string>;
}

export interface CustomMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labels?: string[];
  buckets?: number[]; // For histogram
  percentiles?: number[]; // For summary
}

/**
 * Metrics collector for Prometheus-compatible metrics
 */
export class MetricsCollector extends EventEmitter {
  private config: MetricsConfig;
  private gauges: Map<string, Gauge<any>> = new Map();
  private counters: Map<string, Counter<any>> = new Map();
  private histograms: Map<string, Histogram<any>> = new Map();
  private summaries: Map<string, Summary<any>> = new Map();
  private customMetrics: Map<string, CustomMetric> = new Map();
  private defaultLabels: Record<string, string>;

  constructor(config: MetricsConfig) {
    super();
    this.config = {
      prefix: '',
      collectDefaultMetrics: true,
      defaultMetricsInterval: 10000,
      labels: {},
      ...config
    };

    this.defaultLabels = {
      service: this.config.serviceName,
      instance: this.config.instanceId || 'unknown',
      version: this.config.version || 'unknown',
      ...this.config.labels
    };

    this.initializeDefaultMetrics();
    this.createBuiltinMetrics();
  }

  /**
   * Initialize default Node.js metrics
   */
  private initializeDefaultMetrics(): void {
    if (this.config.collectDefaultMetrics) {
      collectDefaultMetrics({
        register,
        prefix: this.config.prefix,
        timeout: this.config.defaultMetricsInterval,
        labels: this.defaultLabels
      });

      if (this.config.logger) {
        this.config.logger.debug('Default metrics collection initialized');
      }
    }
  }

  /**
   * Create built-in metrics for microservices
   */
  private createBuiltinMetrics(): void {
    // HTTP request metrics
    this.createCounter('http_requests_total', {
      help: 'Total number of HTTP requests',
      labels: ['method', 'path', 'status_code']
    });

    this.createHistogram('http_request_duration_seconds', {
      help: 'HTTP request duration in seconds',
      labels: ['method', 'path', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    // Service health metrics
    this.createGauge('service_health_status', {
      help: 'Service health status (1 = healthy, 0 = unhealthy)',
      labels: ['check_name']
    });

    this.createGauge('service_uptime_seconds', {
      help: 'Service uptime in seconds'
    });

    // Database connection metrics
    this.createGauge('database_connections_active', {
      help: 'Number of active database connections',
      labels: ['database', 'type']
    });

    this.createCounter('database_queries_total', {
      help: 'Total number of database queries',
      labels: ['database', 'operation', 'status']
    });

    this.createHistogram('database_query_duration_seconds', {
      help: 'Database query duration in seconds',
      labels: ['database', 'operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
    });

    // Message queue metrics
    this.createCounter('message_queue_messages_total', {
      help: 'Total number of messages processed',
      labels: ['queue', 'topic', 'status']
    });

    this.createGauge('message_queue_size', {
      help: 'Current message queue size',
      labels: ['queue', 'topic']
    });

    this.createHistogram('message_processing_duration_seconds', {
      help: 'Message processing duration in seconds',
      labels: ['queue', 'topic'],
      buckets: [0.01, 0.1, 0.5, 1, 5, 10, 30]
    });

    // Circuit breaker metrics
    this.createGauge('circuit_breaker_state', {
      help: 'Circuit breaker state (0 = closed, 1 = open, 0.5 = half-open)',
      labels: ['circuit_breaker']
    });

    this.createCounter('circuit_breaker_calls_total', {
      help: 'Total number of circuit breaker calls',
      labels: ['circuit_breaker', 'status']
    });

    // Cache metrics
    this.createCounter('cache_operations_total', {
      help: 'Total number of cache operations',
      labels: ['cache', 'operation', 'result']
    });

    this.createGauge('cache_size_bytes', {
      help: 'Cache size in bytes',
      labels: ['cache']
    });

    if (this.config.logger) {
      this.config.logger.debug('Built-in metrics created');
    }
  }

  /**
   * Get metric name with prefix
   */
  private getMetricName(name: string): string {
    return this.config.prefix ? `${this.config.prefix}${name}` : name;
  }

  /**
   * Create a counter metric
   */
  createCounter(name: string, options: {
    help: string;
    labels?: string[];
  }): Counter<any> {
    const metricName = this.getMetricName(name);
    
    if (this.counters.has(name)) {
      return this.counters.get(name)!;
    }

    const counter = new Counter({
      name: metricName,
      help: options.help,
      labelNames: [...(options.labels || []), ...Object.keys(this.defaultLabels)],
      registers: [register]
    });

    this.counters.set(name, counter);
    
    this.emit('metric.created', {
      name,
      type: 'counter',
      metricName
    });

    return counter;
  }

  /**
   * Create a gauge metric
   */
  createGauge(name: string, options: {
    help: string;
    labels?: string[];
  }): Gauge<any> {
    const metricName = this.getMetricName(name);
    
    if (this.gauges.has(name)) {
      return this.gauges.get(name)!;
    }

    const gauge = new Gauge({
      name: metricName,
      help: options.help,
      labelNames: [...(options.labels || []), ...Object.keys(this.defaultLabels)],
      registers: [register]
    });

    this.gauges.set(name, gauge);
    
    this.emit('metric.created', {
      name,
      type: 'gauge',
      metricName
    });

    return gauge;
  }

  /**
   * Create a histogram metric
   */
  createHistogram(name: string, options: {
    help: string;
    labels?: string[];
    buckets?: number[];
  }): Histogram<any> {
    const metricName = this.getMetricName(name);
    
    if (this.histograms.has(name)) {
      return this.histograms.get(name)!;
    }

    const histogram = new Histogram({
      name: metricName,
      help: options.help,
      labelNames: [...(options.labels || []), ...Object.keys(this.defaultLabels)],
      buckets: options.buckets,
      registers: [register]
    });

    this.histograms.set(name, histogram);
    
    this.emit('metric.created', {
      name,
      type: 'histogram',
      metricName
    });

    return histogram;
  }

  /**
   * Create a summary metric
   */
  createSummary(name: string, options: {
    help: string;
    labels?: string[];
    percentiles?: number[];
  }): Summary<any> {
    const metricName = this.getMetricName(name);
    
    if (this.summaries.has(name)) {
      return this.summaries.get(name)!;
    }

    const summary = new Summary({
      name: metricName,
      help: options.help,
      labelNames: [...(options.labels || []), ...Object.keys(this.defaultLabels)],
      percentiles: options.percentiles,
      registers: [register]
    });

    this.summaries.set(name, summary);
    
    this.emit('metric.created', {
      name,
      type: 'summary',
      metricName
    });

    return summary;
  }

  /**
   * Get counter by name
   */
  getCounter(name: string): Counter<any> | undefined {
    return this.counters.get(name);
  }

  /**
   * Get gauge by name
   */
  getGauge(name: string): Gauge<any> | undefined {
    return this.gauges.get(name);
  }

  /**
   * Get histogram by name
   */
  getHistogram(name: string): Histogram<any> | undefined {
    return this.histograms.get(name);
  }

  /**
   * Get summary by name
   */
  getSummary(name: string): Summary<any> | undefined {
    return this.summaries.get(name);
  }

  /**
   * Increment counter
   */
  incrementCounter(name: string, labels?: Record<string, string>, value: number = 1): void {
    const counter = this.getCounter(name);
    if (counter) {
      const allLabels = { ...this.defaultLabels, ...labels };
      counter.inc(allLabels, value);
      
      this.emit('metric.updated', {
        name,
        type: 'counter',
        operation: 'increment',
        value,
        labels: allLabels
      });
    } else if (this.config.logger) {
      this.config.logger.warn(`Counter '${name}' not found`);
    }
  }

  /**
   * Set gauge value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const gauge = this.getGauge(name);
    if (gauge) {
      const allLabels = { ...this.defaultLabels, ...labels };
      gauge.set(allLabels, value);
      
      this.emit('metric.updated', {
        name,
        type: 'gauge',
        operation: 'set',
        value,
        labels: allLabels
      });
    } else if (this.config.logger) {
      this.config.logger.warn(`Gauge '${name}' not found`);
    }
  }

  /**
   * Increment gauge
   */
  incrementGauge(name: string, labels?: Record<string, string>, value: number = 1): void {
    const gauge = this.getGauge(name);
    if (gauge) {
      const allLabels = { ...this.defaultLabels, ...labels };
      gauge.inc(allLabels, value);
      
      this.emit('metric.updated', {
        name,
        type: 'gauge',
        operation: 'increment',
        value,
        labels: allLabels
      });
    } else if (this.config.logger) {
      this.config.logger.warn(`Gauge '${name}' not found`);
    }
  }

  /**
   * Decrement gauge
   */
  decrementGauge(name: string, labels?: Record<string, string>, value: number = 1): void {
    const gauge = this.getGauge(name);
    if (gauge) {
      const allLabels = { ...this.defaultLabels, ...labels };
      gauge.dec(allLabels, value);
      
      this.emit('metric.updated', {
        name,
        type: 'gauge',
        operation: 'decrement',
        value,
        labels: allLabels
      });
    } else if (this.config.logger) {
      this.config.logger.warn(`Gauge '${name}' not found`);
    }
  }

  /**
   * Observe histogram
   */
  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const histogram = this.getHistogram(name);
    if (histogram) {
      const allLabels = { ...this.defaultLabels, ...labels };
      histogram.observe(allLabels, value);
      
      this.emit('metric.updated', {
        name,
        type: 'histogram',
        operation: 'observe',
        value,
        labels: allLabels
      });
    } else if (this.config.logger) {
      this.config.logger.warn(`Histogram '${name}' not found`);
    }
  }

  /**
   * Observe summary
   */
  observeSummary(name: string, value: number, labels?: Record<string, string>): void {
    const summary = this.getSummary(name);
    if (summary) {
      const allLabels = { ...this.defaultLabels, ...labels };
      summary.observe(allLabels, value);
      
      this.emit('metric.updated', {
        name,
        type: 'summary',
        operation: 'observe',
        value,
        labels: allLabels
      });
    } else if (this.config.logger) {
      this.config.logger.warn(`Summary '${name}' not found`);
    }
  }

  /**
   * Start timer for histogram
   */
  startHistogramTimer(name: string, labels?: Record<string, string>): () => void {
    const histogram = this.getHistogram(name);
    if (histogram) {
      const allLabels = { ...this.defaultLabels, ...labels };
      return histogram.startTimer(allLabels);
    } else {
      if (this.config.logger) {
        this.config.logger.warn(`Histogram '${name}' not found`);
      }
      return () => {}; // No-op function
    }
  }

  /**
   * Start timer for summary
   */
  startSummaryTimer(name: string, labels?: Record<string, string>): () => void {
    const summary = this.getSummary(name);
    if (summary) {
      const allLabels = { ...this.defaultLabels, ...labels };
      return summary.startTimer(allLabels);
    } else {
      if (this.config.logger) {
        this.config.logger.warn(`Summary '${name}' not found`);
      }
      return () => {}; // No-op function
    }
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.incrementCounter('http_requests_total', {
      method,
      path,
      status_code: statusCode.toString()
    });

    this.observeHistogram('http_request_duration_seconds', duration / 1000, {
      method,
      path,
      status_code: statusCode.toString()
    });
  }

  /**
   * Record database operation metrics
   */
  recordDatabaseOperation(
    database: string,
    operation: string,
    status: 'success' | 'error',
    duration: number
  ): void {
    this.incrementCounter('database_queries_total', {
      database,
      operation,
      status
    });

    this.observeHistogram('database_query_duration_seconds', duration / 1000, {
      database,
      operation
    });
  }

  /**
   * Update service health status
   */
  updateHealthStatus(checkName: string, isHealthy: boolean): void {
    this.setGauge('service_health_status', isHealthy ? 1 : 0, {
      check_name: checkName
    });
  }

  /**
   * Update service uptime
   */
  updateUptime(): void {
    this.setGauge('service_uptime_seconds', process.uptime());
  }

  /**
   * Record message queue metrics
   */
  recordMessageProcessing(
    queue: string,
    topic: string,
    status: 'success' | 'error',
    duration: number,
    queueSize?: number
  ): void {
    this.incrementCounter('message_queue_messages_total', {
      queue,
      topic,
      status
    });

    this.observeHistogram('message_processing_duration_seconds', duration / 1000, {
      queue,
      topic
    });

    if (queueSize !== undefined) {
      this.setGauge('message_queue_size', queueSize, {
        queue,
        topic
      });
    }
  }

  /**
   * Update circuit breaker metrics
   */
  updateCircuitBreakerMetrics(
    circuitBreakerName: string,
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
    callResult?: 'success' | 'failure' | 'timeout' | 'rejected'
  ): void {
    const stateValue = state === 'CLOSED' ? 0 : state === 'OPEN' ? 1 : 0.5;
    this.setGauge('circuit_breaker_state', stateValue, {
      circuit_breaker: circuitBreakerName
    });

    if (callResult) {
      this.incrementCounter('circuit_breaker_calls_total', {
        circuit_breaker: circuitBreakerName,
        status: callResult
      });
    }
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(
    cacheName: string,
    operation: 'get' | 'set' | 'delete' | 'clear',
    result: 'hit' | 'miss' | 'success' | 'error',
    cacheSize?: number
  ): void {
    this.incrementCounter('cache_operations_total', {
      cache: cacheName,
      operation,
      result
    });

    if (cacheSize !== undefined) {
      this.setGauge('cache_size_bytes', cacheSize, {
        cache: cacheName
      });
    }
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    // Update uptime before returning metrics
    this.updateUptime();
    
    return await register.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsAsJSON(): Promise<any> {
    const metrics = await register.getMetricsAsJSON();
    return {
      timestamp: new Date().toISOString(),
      service: this.config.serviceName,
      instance: this.config.instanceId,
      version: this.config.version,
      metrics
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    register.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
    
    // Reinitialize
    this.initializeDefaultMetrics();
    this.createBuiltinMetrics();
    
    this.emit('metrics.cleared');
    
    if (this.config.logger) {
      this.config.logger.info('All metrics cleared and reinitialized');
    }
  }

  /**
   * Get metrics statistics
   */
  getStats(): {
    counters: number;
    gauges: number;
    histograms: number;
    summaries: number;
    total: number;
  } {
    return {
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
      summaries: this.summaries.size,
      total: this.counters.size + this.gauges.size + this.histograms.size + this.summaries.size
    };
  }
}