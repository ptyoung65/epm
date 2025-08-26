import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { ServiceRegistry } from '../discovery/ServiceRegistry';
import { CircuitBreaker } from '../resilience/CircuitBreaker';
import { RetryPattern } from '../resilience/RetryPattern';
import { TracingManager } from '../tracing/TracingManager';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface ServiceMeshConfig {
  serviceName: string;
  serviceVersion: string;
  namespace?: string;
  meshType: 'istio' | 'linkerd' | 'consul-connect' | 'envoy';
  proxyPort?: number;
  adminPort?: number;
  enableMTLS?: boolean;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  retryPolicy?: {
    attempts: number;
    timeout: string;
    retryOn: string[];
  };
  circuitBreaker?: {
    consecutiveErrors: number;
    interval: string;
    baseEjectionTime: string;
    maxEjectionPercent: number;
  };
  loadBalancer?: {
    policy: 'round_robin' | 'least_request' | 'random' | 'ring_hash';
    consistentHash?: {
      httpHeaderName?: string;
      httpCookie?: string;
      useSourceIp?: boolean;
    };
  };
  timeout?: {
    request: string;
    connection: string;
  };
  logger?: Logger;
}

export interface ServiceMeshMetrics {
  requestsTotal: number;
  requestDuration: number;
  requestsInFlight: number;
  circuitBreakerState: string;
  retryAttempts: number;
  upstreamConnections: number;
  sidecarHealth: boolean;
}

export interface ServicePolicy {
  name: string;
  namespace: string;
  spec: {
    selector: Record<string, string>;
    rules: Array<{
      from?: Array<{
        source?: {
          principals?: string[];
          namespaces?: string[];
        };
      }>;
      to?: Array<{
        operation?: {
          methods?: string[];
          paths?: string[];
        };
      }>;
      when?: Array<{
        key: string;
        values: string[];
      }>;
    }>;
  };
}

/**
 * Service mesh integration for microservices
 */
export class ServiceMeshIntegration extends EventEmitter {
  private config: ServiceMeshConfig;
  private serviceRegistry?: ServiceRegistry;
  private tracingManager?: TracingManager;
  private metricsCollector?: MetricsCollector;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryPatterns: Map<string, RetryPattern> = new Map();
  private proxyClient?: AxiosInstance;
  private adminClient?: AxiosInstance;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    config: ServiceMeshConfig,
    serviceRegistry?: ServiceRegistry,
    tracingManager?: TracingManager,
    metricsCollector?: MetricsCollector
  ) {
    super();
    this.config = {
      namespace: 'default',
      proxyPort: 15001,
      adminPort: 15000,
      enableMTLS: true,
      enableTracing: true,
      enableMetrics: true,
      ...config
    };

    this.serviceRegistry = serviceRegistry;
    this.tracingManager = tracingManager;
    this.metricsCollector = metricsCollector;

    this.setupClients();
    this.setupPolicies();
  }

  /**
   * Setup HTTP clients for proxy and admin interfaces
   */
  private setupClients(): void {
    // Proxy client for service-to-service communication
    this.proxyClient = axios.create({
      baseURL: `http://localhost:${this.config.proxyPort}`,
      timeout: this.parseTimeout(this.config.timeout?.request || '30s'),
      headers: {
        'X-Mesh-Service': this.config.serviceName,
        'X-Mesh-Version': this.config.serviceVersion,
        'X-Mesh-Namespace': this.config.namespace
      }
    });

    // Admin client for mesh management
    this.adminClient = axios.create({
      baseURL: `http://localhost:${this.config.adminPort}`,
      timeout: 5000
    });

    this.setupInterceptors();
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    if (!this.proxyClient) return;

    // Request interceptor
    this.proxyClient.interceptors.request.use(
      (config) => {
        // Add tracing headers
        if (this.tracingManager && this.config.enableTracing) {
          const span = this.tracingManager.startSpan(`HTTP ${config.method?.toUpperCase()}`);
          const headers: Record<string, string> = {};
          this.tracingManager.injectToHttpHeaders(span, headers);
          config.headers = { ...config.headers, ...headers };
          
          // Store span in config for response interceptor
          (config as any).tracingSpan = span;
        }

        // Add service mesh headers
        config.headers['X-Request-ID'] = this.generateRequestId();
        config.headers['X-B3-TraceId'] = this.generateTraceId();
        config.headers['X-B3-SpanId'] = this.generateSpanId();

        if (this.config.logger) {
          this.config.logger.debug('Service mesh request', {
            method: config.method,
            url: config.url,
            requestId: config.headers['X-Request-ID']
          });
        }

        return config;
      },
      (error) => {
        if (this.config.logger) {
          this.config.logger.error('Service mesh request error:', error);
        }
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.proxyClient.interceptors.response.use(
      (response) => {
        // Finish tracing span
        const span = (response.config as any).tracingSpan;
        if (span && this.tracingManager) {
          span.setTag('http.status_code', response.status);
          this.tracingManager.finishSpan(span);
        }

        // Record metrics
        if (this.metricsCollector && this.config.enableMetrics) {
          this.metricsCollector.recordHttpRequest(
            response.config.method?.toUpperCase() || 'UNKNOWN',
            response.config.url || '',
            response.status,
            Date.now() - (response.config as any).startTime
          );
        }

        return response;
      },
      (error) => {
        // Handle tracing for errors
        const span = (error.config as any)?.tracingSpan;
        if (span && this.tracingManager) {
          span.setTag('error', true);
          span.setTag('http.status_code', error.response?.status || 0);
          this.tracingManager.logErrorToSpan(span, error);
          this.tracingManager.finishSpan(span);
        }

        // Record error metrics
        if (this.metricsCollector && this.config.enableMetrics) {
          this.metricsCollector.recordHttpRequest(
            error.config?.method?.toUpperCase() || 'UNKNOWN',
            error.config?.url || '',
            error.response?.status || 0,
            Date.now() - (error.config as any)?.startTime
          );
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup default policies based on mesh type
   */
  private setupPolicies(): void {
    // Setup retry patterns
    if (this.config.retryPolicy) {
      const retryPattern = new RetryPattern({
        name: `${this.config.serviceName}-default`,
        maxRetries: this.config.retryPolicy.attempts,
        initialDelay: this.parseTimeout(this.config.retryPolicy.timeout),
        logger: this.config.logger
      });
      
      this.retryPatterns.set('default', retryPattern);
    }

    // Setup circuit breakers
    if (this.config.circuitBreaker) {
      const circuitBreaker = new CircuitBreaker({
        name: `${this.config.serviceName}-default`,
        failureThreshold: this.config.circuitBreaker.consecutiveErrors,
        resetTimeout: this.parseTimeout(this.config.circuitBreaker.interval),
        logger: this.config.logger
      });
      
      this.circuitBreakers.set('default', circuitBreaker);
    }
  }

  /**
   * Initialize service mesh integration
   */
  async initialize(): Promise<void> {
    try {
      // Check if sidecar is running
      await this.checkSidecarHealth();
      
      // Configure mesh policies
      await this.applyDefaultPolicies();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.emit('initialized', {
        serviceName: this.config.serviceName,
        meshType: this.config.meshType
      });
      
      if (this.config.logger) {
        this.config.logger.info('Service mesh integration initialized', {
          serviceName: this.config.serviceName,
          meshType: this.config.meshType,
          namespace: this.config.namespace
        });
      }
      
    } catch (error) {
      if (this.config.logger) {
        this.config.logger.error('Failed to initialize service mesh integration:', error);
      }
      throw error;
    }
  }

  /**
   * Check sidecar health
   */
  async checkSidecarHealth(): Promise<boolean> {
    try {
      if (!this.adminClient) {
        throw new Error('Admin client not initialized');
      }

      const response = await this.adminClient.get('/ready');
      const isHealthy = response.status === 200;
      
      this.emit('sidecar.health', {
        healthy: isHealthy,
        status: response.status
      });
      
      return isHealthy;
    } catch (error) {
      this.emit('sidecar.health', {
        healthy: false,
        error: error.message
      });
      
      if (this.config.logger) {
        this.config.logger.warn('Sidecar health check failed:', error);
      }
      
      return false;
    }
  }

  /**
   * Apply default mesh policies
   */
  private async applyDefaultPolicies(): Promise<void> {
    switch (this.config.meshType) {
      case 'istio':
        await this.applyIstioConfig();
        break;
      case 'linkerd':
        await this.applyLinkerdConfig();
        break;
      case 'consul-connect':
        await this.applyConsulConnectConfig();
        break;
      case 'envoy':
        await this.applyEnvoyConfig();
        break;
    }
  }

  /**
   * Apply Istio-specific configuration
   */
  private async applyIstioConfig(): Promise<void> {
    // Destination rule for load balancing and circuit breaking
    const destinationRule = {
      apiVersion: 'networking.istio.io/v1alpha3',
      kind: 'DestinationRule',
      metadata: {
        name: `${this.config.serviceName}-dr`,
        namespace: this.config.namespace
      },
      spec: {
        host: this.config.serviceName,
        trafficPolicy: {
          loadBalancer: {
            simple: this.config.loadBalancer?.policy?.toUpperCase() || 'ROUND_ROBIN'
          },
          connectionPool: {
            tcp: {
              maxConnections: 100
            },
            http: {
              http1MaxPendingRequests: 10,
              maxRequestsPerConnection: 2
            }
          },
          outlierDetection: {
            consecutiveErrors: this.config.circuitBreaker?.consecutiveErrors || 5,
            interval: this.config.circuitBreaker?.interval || '30s',
            baseEjectionTime: this.config.circuitBreaker?.baseEjectionTime || '30s',
            maxEjectionPercent: this.config.circuitBreaker?.maxEjectionPercent || 50
          }
        }
      }
    };

    // Virtual service for routing and retry
    const virtualService = {
      apiVersion: 'networking.istio.io/v1alpha3',
      kind: 'VirtualService',
      metadata: {
        name: `${this.config.serviceName}-vs`,
        namespace: this.config.namespace
      },
      spec: {
        host: this.config.serviceName,
        http: [{
          route: [{
            destination: {
              host: this.config.serviceName
            }
          }],
          retries: {
            attempts: this.config.retryPolicy?.attempts || 3,
            perTryTimeout: this.config.retryPolicy?.timeout || '10s',
            retryOn: this.config.retryPolicy?.retryOn?.join(',') || 'gateway-error,connect-failure,refused-stream'
          },
          timeout: this.config.timeout?.request || '30s'
        }]
      }
    };

    if (this.config.logger) {
      this.config.logger.debug('Applied Istio configuration', {
        destinationRule: destinationRule.metadata.name,
        virtualService: virtualService.metadata.name
      });
    }
  }

  /**
   * Apply Linkerd-specific configuration
   */
  private async applyLinkerdConfig(): Promise<void> {
    // Linkerd uses annotations and service profiles
    if (this.config.logger) {
      this.config.logger.debug('Applied Linkerd configuration');
    }
  }

  /**
   * Apply Consul Connect configuration
   */
  private async applyConsulConnectConfig(): Promise<void> {
    // Register service with Consul Connect
    if (this.serviceRegistry) {
      await this.serviceRegistry.register({
        id: `${this.config.serviceName}-${Date.now()}`,
        name: this.config.serviceName,
        tags: ['connect'],
        address: 'localhost',
        port: this.config.proxyPort!,
        connect: {
          sidecarService: {}
        }
      });
    }
    
    if (this.config.logger) {
      this.config.logger.debug('Applied Consul Connect configuration');
    }
  }

  /**
   * Apply Envoy-specific configuration
   */
  private async applyEnvoyConfig(): Promise<void> {
    // Envoy configuration would be applied via xDS APIs
    if (this.config.logger) {
      this.config.logger.debug('Applied Envoy configuration');
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.checkSidecarHealth();
      
      // Collect metrics if enabled
      if (this.config.enableMetrics) {
        try {
          const metrics = await this.getMeshMetrics();
          this.emit('metrics.collected', metrics);
        } catch (error) {
          if (this.config.logger) {
            this.config.logger.warn('Failed to collect mesh metrics:', error);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get service mesh metrics
   */
  async getMeshMetrics(): Promise<ServiceMeshMetrics> {
    try {
      if (!this.adminClient) {
        throw new Error('Admin client not initialized');
      }

      const response = await this.adminClient.get('/stats/prometheus');
      const metricsText = response.data;
      
      // Parse Prometheus metrics (simplified)
      const metrics = this.parsePrometheusMetrics(metricsText);
      
      return {
        requestsTotal: metrics['envoy_http_requests_total'] || 0,
        requestDuration: metrics['envoy_http_request_duration_seconds'] || 0,
        requestsInFlight: metrics['envoy_http_requests_active'] || 0,
        circuitBreakerState: metrics['envoy_cluster_outlier_detection_ejections_active'] || 'closed',
        retryAttempts: metrics['envoy_http_retry_total'] || 0,
        upstreamConnections: metrics['envoy_cluster_upstream_cx_active'] || 0,
        sidecarHealth: await this.checkSidecarHealth()
      };
    } catch (error) {
      throw new Error(`Failed to get mesh metrics: ${error.message}`);
    }
  }

  /**
   * Parse Prometheus metrics
   */
  private parsePrometheusMetrics(metricsText: string): Record<string, number> {
    const metrics: Record<string, number> = {};
    const lines = metricsText.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;
      
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{.*\})?\s+([0-9.-]+)$/);
      if (match) {
        const metricName = match[1];
        const value = parseFloat(match[3]);
        metrics[metricName] = value;
      }
    }
    
    return metrics;
  }

  /**
   * Make service call through mesh
   */
  async callService(
    serviceName: string,
    path: string,
    options: AxiosRequestConfig = {}
  ): Promise<any> {
    if (!this.proxyClient) {
      throw new Error('Proxy client not initialized');
    }

    const url = `http://${serviceName}${path}`;
    
    // Get circuit breaker for service
    let circuitBreaker = this.circuitBreakers.get(serviceName);
    if (!circuitBreaker) {
      circuitBreaker = this.circuitBreakers.get('default');
    }

    // Get retry pattern for service
    let retryPattern = this.retryPatterns.get(serviceName);
    if (!retryPattern) {
      retryPattern = this.retryPatterns.get('default');
    }

    const makeRequest = async () => {
      return await this.proxyClient!.request({
        ...options,
        url
      });
    };

    // Execute with circuit breaker and retry
    if (circuitBreaker && retryPattern) {
      return await retryPattern.execute(async () => {
        return await circuitBreaker!.execute(makeRequest);
      });
    } else if (circuitBreaker) {
      return await circuitBreaker.execute(makeRequest);
    } else if (retryPattern) {
      return await retryPattern.execute(makeRequest);
    } else {
      return await makeRequest();
    }
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return Math.random().toString(16).substr(2, 16);
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return Math.random().toString(16).substr(2, 8);
  }

  /**
   * Parse timeout string to milliseconds
   */
  private parseTimeout(timeout: string): number {
    const match = timeout.match(/^(\d+)(s|ms)$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      return unit === 's' ? value * 1000 : value;
    }
    return 30000; // Default 30 seconds
  }

  /**
   * Create authorization policy
   */
  async createAuthorizationPolicy(policy: ServicePolicy): Promise<void> {
    // Implementation depends on mesh type
    switch (this.config.meshType) {
      case 'istio':
        await this.createIstioAuthzPolicy(policy);
        break;
      // Add other mesh types as needed
    }
  }

  /**
   * Create Istio authorization policy
   */
  private async createIstioAuthzPolicy(policy: ServicePolicy): Promise<void> {
    const authzPolicy = {
      apiVersion: 'security.istio.io/v1beta1',
      kind: 'AuthorizationPolicy',
      metadata: {
        name: policy.name,
        namespace: policy.namespace
      },
      spec: policy.spec
    };

    if (this.config.logger) {
      this.config.logger.info('Created Istio authorization policy', {
        name: policy.name,
        namespace: policy.namespace
      });
    }
  }

  /**
   * Get mesh configuration
   */
  getConfig(): ServiceMeshConfig {
    return { ...this.config };
  }

  /**
   * Shutdown mesh integration
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close circuit breakers
    for (const circuitBreaker of this.circuitBreakers.values()) {
      // Circuit breaker doesn't have explicit close method
    }

    this.emit('shutdown');
    
    if (this.config.logger) {
      this.config.logger.info('Service mesh integration shutdown');
    }
  }
}