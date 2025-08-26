import { Tracer, Span, SpanOptions, SpanContext, Tags } from 'opentracing';
import { initTracer, JaegerTracer } from 'jaeger-client';
import { Logger } from 'winston';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface TracingConfig {
  serviceName: string;
  agentHost?: string;
  agentPort?: number;
  collectorEndpoint?: string;
  samplerType?: 'const' | 'probabilistic' | 'rateLimiting' | 'remote';
  samplerParam?: number;
  reporterLogSpans?: boolean;
  reporterMaxQueueSize?: number;
  reporterFlushInterval?: number;
  logger?: Logger;
  tags?: Record<string, any>;
}

export interface SpanInfo {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  finishTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    fields: Record<string, any>;
  }>;
  baggage: Record<string, string>;
  references: Array<{
    type: string;
    referencedContext: SpanContext;
  }>;
}

export interface TraceInfo {
  traceId: string;
  spans: SpanInfo[];
  rootSpan?: SpanInfo;
  duration?: number;
  serviceName: string;
  startTime: number;
  finishTime?: number;
}

/**
 * Distributed tracing manager using Jaeger
 */
export class TracingManager extends EventEmitter {
  private config: TracingConfig;
  private tracer: JaegerTracer;
  private activeSpans: Map<string, Span> = new Map();
  private spanCounter = 0;

  constructor(config: TracingConfig) {
    super();
    this.config = {
      agentHost: 'localhost',
      agentPort: 6831,
      samplerType: 'probabilistic',
      samplerParam: 0.1,
      reporterLogSpans: false,
      reporterMaxQueueSize: 1000,
      reporterFlushInterval: 1000,
      tags: {},
      ...config
    };

    this.tracer = this.initializeTracer();
    this.setupEventHandlers();
  }

  /**
   * Initialize Jaeger tracer
   */
  private initializeTracer(): JaegerTracer {
    const tracerConfig = {
      serviceName: this.config.serviceName,
      sampler: {
        type: this.config.samplerType!,
        param: this.config.samplerParam!
      },
      reporter: {
        logSpans: this.config.reporterLogSpans,
        maxQueueSize: this.config.reporterMaxQueueSize,
        flushInterval: this.config.reporterFlushInterval
      },
      tags: this.config.tags
    };

    // Set agent or collector endpoint
    if (this.config.collectorEndpoint) {
      (tracerConfig.reporter as any).collectorEndpoint = this.config.collectorEndpoint;
    } else {
      (tracerConfig.reporter as any).agentHost = this.config.agentHost;
      (tracerConfig.reporter as any).agentPort = this.config.agentPort;
    }

    const tracerOptions = {
      logger: {
        info: (msg: string) => {
          if (this.config.logger) {
            this.config.logger.info(`Jaeger: ${msg}`);
          }
        },
        error: (msg: string) => {
          if (this.config.logger) {
            this.config.logger.error(`Jaeger: ${msg}`);
          }
        }
      }
    };

    const tracer = initTracer(tracerConfig, tracerOptions) as JaegerTracer;
    
    if (this.config.logger) {
      this.config.logger.info('Jaeger tracer initialized', {
        serviceName: this.config.serviceName,
        samplerType: this.config.samplerType,
        samplerParam: this.config.samplerParam
      });
    }

    return tracer;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('span.started', (spanInfo: SpanInfo) => {
      if (this.config.logger) {
        this.config.logger.debug('Span started', {
          traceId: spanInfo.traceId,
          spanId: spanInfo.spanId,
          operationName: spanInfo.operationName
        });
      }
    });

    this.on('span.finished', (spanInfo: SpanInfo) => {
      if (this.config.logger) {
        this.config.logger.debug('Span finished', {
          traceId: spanInfo.traceId,
          spanId: spanInfo.spanId,
          operationName: spanInfo.operationName,
          duration: spanInfo.duration
        });
      }
    });
  }

  /**
   * Get the underlying tracer
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Start a new span
   */
  startSpan(
    operationName: string,
    options: SpanOptions = {},
    parentSpan?: Span
  ): Span {
    const spanOptions: SpanOptions = {
      ...options
    };

    // Set parent span if provided
    if (parentSpan) {
      spanOptions.childOf = parentSpan.context();
    }

    const span = this.tracer.startSpan(operationName, spanOptions);
    const spanId = this.generateSpanId();
    
    // Add default tags
    span.setTag(Tags.COMPONENT, this.config.serviceName);
    span.setTag('span.kind', options.tags?.['span.kind'] || 'internal');
    span.setTag('service.name', this.config.serviceName);
    
    // Add custom tags if provided
    if (options.tags) {
      Object.entries(options.tags).forEach(([key, value]) => {
        span.setTag(key, value);
      });
    }

    // Store active span
    this.activeSpans.set(spanId, span);

    const spanInfo = this.getSpanInfo(span);
    this.emit('span.started', spanInfo);

    return span;
  }

  /**
   * Start a child span from parent span
   */
  startChildSpan(
    parentSpan: Span,
    operationName: string,
    options: SpanOptions = {}
  ): Span {
    return this.startSpan(operationName, {
      ...options,
      childOf: parentSpan.context()
    });
  }

  /**
   * Start a span from span context (e.g., from HTTP headers)
   */
  startSpanFromContext(
    spanContext: SpanContext,
    operationName: string,
    options: SpanOptions = {}
  ): Span {
    return this.startSpan(operationName, {
      ...options,
      childOf: spanContext
    });
  }

  /**
   * Finish a span
   */
  finishSpan(span: Span, finishTime?: number): void {
    if (finishTime) {
      span.finish(finishTime);
    } else {
      span.finish();
    }

    const spanInfo = this.getSpanInfo(span);
    spanInfo.finishTime = finishTime || Date.now();
    spanInfo.duration = spanInfo.finishTime - spanInfo.startTime;

    // Remove from active spans
    for (const [id, activeSpan] of this.activeSpans) {
      if (activeSpan === span) {
        this.activeSpans.delete(id);
        break;
      }
    }

    this.emit('span.finished', spanInfo);
  }

  /**
   * Add log to span
   */
  logToSpan(span: Span, level: string, message: string, fields?: Record<string, any>): void {
    const logData = {
      level,
      message,
      timestamp: Date.now(),
      ...fields
    };

    span.log(logData);
  }

  /**
   * Add error to span
   */
  logErrorToSpan(span: Span, error: Error, fields?: Record<string, any>): void {
    span.setTag(Tags.ERROR, true);
    span.setTag('error.message', error.message);
    span.setTag('error.name', error.name);
    
    if (error.stack) {
      span.setTag('error.stack', error.stack);
    }

    span.log({
      event: 'error',
      'error.object': error,
      'error.kind': error.name,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      ...fields
    });
  }

  /**
   * Set tag on span
   */
  setSpanTag(span: Span, key: string, value: any): void {
    span.setTag(key, value);
  }

  /**
   * Set multiple tags on span
   */
  setSpanTags(span: Span, tags: Record<string, any>): void {
    Object.entries(tags).forEach(([key, value]) => {
      span.setTag(key, value);
    });
  }

  /**
   * Set baggage item on span
   */
  setBaggageItem(span: Span, key: string, value: string): void {
    span.setBaggageItem(key, value);
  }

  /**
   * Get baggage item from span
   */
  getBaggageItem(span: Span, key: string): string | undefined {
    return span.getBaggageItem(key);
  }

  /**
   * Extract span context from HTTP headers
   */
  extractFromHttpHeaders(headers: Record<string, string>): SpanContext | null {
    try {
      return this.tracer.extract('http_headers', headers);
    } catch (error) {
      if (this.config.logger) {
        this.config.logger.warn('Failed to extract span context from headers:', error);
      }
      return null;
    }
  }

  /**
   * Inject span context into HTTP headers
   */
  injectToHttpHeaders(span: Span, headers: Record<string, string>): void {
    try {
      this.tracer.inject(span.context(), 'http_headers', headers);
    } catch (error) {
      if (this.config.logger) {
        this.config.logger.warn('Failed to inject span context to headers:', error);
      }
    }
  }

  /**
   * Create a traced HTTP client wrapper
   */
  traceHttpRequest(
    method: string,
    url: string,
    parentSpan?: Span
  ): {
    span: Span;
    headers: Record<string, string>;
    finish: (statusCode?: number, error?: Error) => void;
  } {
    const span = this.startSpan(`HTTP ${method.toUpperCase()}`, {
      tags: {
        [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_CLIENT,
        [Tags.HTTP_METHOD]: method.toUpperCase(),
        [Tags.HTTP_URL]: url,
        [Tags.COMPONENT]: 'http-client'
      }
    }, parentSpan);

    const headers: Record<string, string> = {};
    this.injectToHttpHeaders(span, headers);

    const finish = (statusCode?: number, error?: Error) => {
      if (statusCode) {
        span.setTag(Tags.HTTP_STATUS_CODE, statusCode);
        
        if (statusCode >= 400) {
          span.setTag(Tags.ERROR, true);
          span.setTag('http.status_text', this.getHttpStatusText(statusCode));
        }
      }

      if (error) {
        this.logErrorToSpan(span, error);
      }

      this.finishSpan(span);
    };

    return { span, headers, finish };
  }

  /**
   * Trace a database operation
   */
  traceDatabaseOperation(
    database: string,
    operation: string,
    query?: string,
    parentSpan?: Span
  ): {
    span: Span;
    finish: (error?: Error, rowCount?: number) => void;
  } {
    const span = this.startSpan(`DB ${operation}`, {
      tags: {
        [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_CLIENT,
        [Tags.COMPONENT]: 'database',
        [Tags.DB_INSTANCE]: database,
        [Tags.DB_TYPE]: 'sql', // or determine from database type
        'db.operation': operation
      }
    }, parentSpan);

    if (query) {
      span.setTag(Tags.DB_STATEMENT, query);
    }

    const finish = (error?: Error, rowCount?: number) => {
      if (rowCount !== undefined) {
        span.setTag('db.rows_affected', rowCount);
      }

      if (error) {
        this.logErrorToSpan(span, error);
      }

      this.finishSpan(span);
    };

    return { span, finish };
  }

  /**
   * Trace a message queue operation
   */
  traceMessageOperation(
    queue: string,
    topic: string,
    operation: 'publish' | 'consume',
    parentSpan?: Span
  ): {
    span: Span;
    finish: (error?: Error, messageCount?: number) => void;
  } {
    const spanKind = operation === 'publish' 
      ? Tags.SPAN_KIND_PRODUCER 
      : Tags.SPAN_KIND_CONSUMER;

    const span = this.startSpan(`MESSAGE ${operation.toUpperCase()}`, {
      tags: {
        [Tags.SPAN_KIND]: spanKind,
        [Tags.COMPONENT]: 'message-queue',
        'message_bus.destination': topic,
        'message_bus.queue': queue,
        'message_bus.operation': operation
      }
    }, parentSpan);

    const finish = (error?: Error, messageCount?: number) => {
      if (messageCount !== undefined) {
        span.setTag('message_bus.message_count', messageCount);
      }

      if (error) {
        this.logErrorToSpan(span, error);
      }

      this.finishSpan(span);
    };

    return { span, finish };
  }

  /**
   * Execute function with tracing
   */
  async traceFunction<T>(
    operationName: string,
    fn: (span: Span) => Promise<T>,
    parentSpan?: Span,
    tags?: Record<string, any>
  ): Promise<T> {
    const span = this.startSpan(operationName, { tags }, parentSpan);
    
    try {
      const result = await fn(span);
      span.setTag('success', true);
      return result;
    } catch (error: any) {
      this.logErrorToSpan(span, error);
      throw error;
    } finally {
      this.finishSpan(span);
    }
  }

  /**
   * Execute synchronous function with tracing
   */
  traceSync<T>(
    operationName: string,
    fn: (span: Span) => T,
    parentSpan?: Span,
    tags?: Record<string, any>
  ): T {
    const span = this.startSpan(operationName, { tags }, parentSpan);
    
    try {
      const result = fn(span);
      span.setTag('success', true);
      return result;
    } catch (error: any) {
      this.logErrorToSpan(span, error);
      throw error;
    } finally {
      this.finishSpan(span);
    }
  }

  /**
   * Get span information
   */
  private getSpanInfo(span: Span): SpanInfo {
    const context = span.context() as any;
    
    return {
      traceId: context.traceId || 'unknown',
      spanId: context.spanId || 'unknown',
      parentSpanId: context.parentId || undefined,
      operationName: (span as any)._operationName || 'unknown',
      startTime: (span as any)._startTime || Date.now(),
      tags: (span as any)._tags || {},
      logs: (span as any)._logs || [],
      baggage: context.baggage || {},
      references: (span as any)._references || []
    };
  }

  /**
   * Generate unique span ID
   */
  private generateSpanId(): string {
    return `${this.config.serviceName}-${++this.spanCounter}-${Date.now()}`;
  }

  /**
   * Get HTTP status text
   */
  private getHttpStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable'
    };
    
    return statusTexts[statusCode] || 'Unknown';
  }

  /**
   * Get active spans count
   */
  getActiveSpansCount(): number {
    return this.activeSpans.size;
  }

  /**
   * Get all active spans
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Close the tracer
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.tracer.close(() => {
        if (this.config.logger) {
          this.config.logger.info('Jaeger tracer closed');
        }
        resolve();
      });
    });
  }

  /**
   * Flush any pending spans
   */
  flush(): Promise<void> {
    return new Promise((resolve) => {
      this.tracer.close(() => {
        resolve();
      });
    });
  }

  /**
   * Get tracer configuration
   */
  getConfig(): TracingConfig {
    return { ...this.config };
  }

  /**
   * Update sampling rate
   */
  updateSamplingRate(rate: number): void {
    if (rate < 0 || rate > 1) {
      throw new Error('Sampling rate must be between 0 and 1');
    }
    
    this.config.samplerParam = rate;
    
    // Note: Jaeger tracer doesn't support dynamic sampling rate updates
    // This would typically require recreating the tracer
    if (this.config.logger) {
      this.config.logger.warn('Sampling rate updated in config, but tracer restart required for it to take effect');
    }
  }

  /**
   * Get tracing statistics
   */
  getStats(): {
    activeSpans: number;
    totalSpansStarted: number;
    serviceName: string;
    samplerType: string;
    samplerParam: number;
  } {
    return {
      activeSpans: this.activeSpans.size,
      totalSpansStarted: this.spanCounter,
      serviceName: this.config.serviceName,
      samplerType: this.config.samplerType!,
      samplerParam: this.config.samplerParam!
    };
  }
}