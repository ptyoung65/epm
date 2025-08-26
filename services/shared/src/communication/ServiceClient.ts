import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ServiceRegistry } from '../discovery/ServiceRegistry';
import { CircuitBreaker } from '../resilience/CircuitBreaker';
import { Logger } from 'winston';
import { Tracer, Span } from 'opentracing';
import { v4 as uuidv4 } from 'uuid';

export interface ServiceClientConfig {
  serviceName: string;
  serviceRegistry: ServiceRegistry;
  circuitBreaker?: CircuitBreaker;
  tracer?: Tracer;
  logger: Logger;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  loadBalancingStrategy?: 'round-robin' | 'random' | 'least-connections';
}

export interface RequestOptions extends AxiosRequestConfig {
  retries?: number;
  circuitBreaker?: boolean;
  timeout?: number;
  tracing?: boolean;
}

export interface ServiceResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timing: {
    start: number;
    end: number;
    duration: number;
  };
  instance?: {
    id: string;
    address: string;
    port: number;
  };
}

export class ServiceClient {
  private config: ServiceClientConfig;
  private axiosInstance: AxiosInstance;
  private instanceIndex: number = 0;

  constructor(config: ServiceClientConfig) {
    this.config = {
      timeout: 5000,
      retries: 3,
      retryDelay: 1000,
      loadBalancingStrategy: 'round-robin',
      ...config
    };

    // Create axios instance with default configuration
    this.axiosInstance = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Name': 'airis-epm-service-client',
        'X-Client-Version': '1.0.0'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add correlation ID
        config.headers['X-Correlation-ID'] = uuidv4();
        
        // Add timestamp
        config.metadata = { startTime: Date.now() };
        
        this.config.logger.debug('Making request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          correlationId: config.headers['X-Correlation-ID']
        });
        
        return config;
      },
      (error) => {
        this.config.logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        
        this.config.logger.debug('Request completed', {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          duration,
          correlationId: response.config.headers['X-Correlation-ID']
        });
        
        return response;
      },
      (error) => {
        const duration = Date.now() - (error.config?.metadata?.startTime || 0);
        
        this.config.logger.warn('Request failed', {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          duration,
          error: error.message,
          correlationId: error.config?.headers['X-Correlation-ID']
        });
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get service instance using load balancing
   */
  private async getServiceInstance(): Promise<any> {
    const instances = await this.config.serviceRegistry.discover(this.config.serviceName, true);
    
    if (!instances || instances.length === 0) {
      throw new Error(`No healthy instances found for service: ${this.config.serviceName}`);
    }

    // Apply load balancing strategy
    let selectedInstance;
    
    switch (this.config.loadBalancingStrategy) {
      case 'random':
        selectedInstance = instances[Math.floor(Math.random() * instances.length)];
        break;
      
      case 'least-connections':
        // For simplicity, use round-robin. In production, this should track actual connections
        selectedInstance = instances[this.instanceIndex % instances.length];
        this.instanceIndex++;
        break;
      
      case 'round-robin':
      default:
        selectedInstance = instances[this.instanceIndex % instances.length];
        this.instanceIndex++;
        break;
    }

    return selectedInstance;
  }

  /**
   * Build service URL
   */
  private buildServiceUrl(instance: any, path: string): string {
    const protocol = instance.secure ? 'https' : 'http';
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${protocol}://${instance.address}:${instance.port}${cleanPath}`;
  }

  /**
   * Execute request with retries and circuit breaker
   */
  private async executeRequest<T>(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<ServiceResponse<T>> {
    const startTime = Date.now();
    const maxRetries = options.retries ?? this.config.retries!;
    let lastError: any;
    let span: Span | undefined;

    // Create tracing span if tracer is available
    if (this.config.tracer && options.tracing !== false) {
      span = this.config.tracer.startSpan(`${method.toUpperCase()} ${this.config.serviceName}${path}`);
      span.setTag('service.name', this.config.serviceName);
      span.setTag('http.method', method.toUpperCase());
      span.setTag('http.path', path);
    }

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const instance = await this.getServiceInstance();
          const url = this.buildServiceUrl(instance, path);
          
          const requestConfig: AxiosRequestConfig = {
            ...options,
            method: method as any,
            url,
            timeout: options.timeout ?? this.config.timeout
          };

          let response: AxiosResponse<T>;
          
          // Execute with circuit breaker if enabled
          if (this.config.circuitBreaker && options.circuitBreaker !== false) {
            response = await this.config.circuitBreaker.execute(async () => {
              return this.axiosInstance.request<T>(requestConfig);
            });
          } else {
            response = await this.axiosInstance.request<T>(requestConfig);
          }

          const endTime = Date.now();
          
          // Update span with success
          if (span) {
            span.setTag('http.status_code', response.status);
            span.setTag('instance.id', instance.id);
            span.setTag('instance.address', `${instance.address}:${instance.port}`);
            span.finish();
          }

          return {
            data: response.data,
            status: response.status,
            headers: response.headers,
            timing: {
              start: startTime,
              end: endTime,
              duration: endTime - startTime
            },
            instance: {
              id: instance.id,
              address: instance.address,
              port: instance.port
            }
          };
          
        } catch (error: any) {
          lastError = error;
          
          // Don't retry on certain status codes
          if (error.response?.status >= 400 && error.response?.status < 500) {
            break;
          }
          
          // Wait before retry (except on last attempt)
          if (attempt < maxRetries) {
            await this.sleep(this.config.retryDelay! * Math.pow(2, attempt));
          }
        }
      }
      
      throw lastError;
      
    } catch (error: any) {
      // Update span with error
      if (span) {
        span.setTag('error', true);
        span.setTag('error.message', error.message);
        span.setTag('http.status_code', error.response?.status || 0);
        span.finish();
      }
      
      this.config.logger.error(`Service call failed after ${maxRetries + 1} attempts`, {
        service: this.config.serviceName,
        method: method.toUpperCase(),
        path,
        error: error.message,
        attempts: maxRetries + 1
      });
      
      throw error;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET request
   */
  async get<T = any>(path: string, options: RequestOptions = {}): Promise<ServiceResponse<T>> {
    return this.executeRequest<T>('GET', path, options);
  }

  /**
   * POST request
   */
  async post<T = any>(path: string, data?: any, options: RequestOptions = {}): Promise<ServiceResponse<T>> {
    return this.executeRequest<T>('POST', path, { ...options, data });
  }

  /**
   * PUT request
   */
  async put<T = any>(path: string, data?: any, options: RequestOptions = {}): Promise<ServiceResponse<T>> {
    return this.executeRequest<T>('PUT', path, { ...options, data });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(path: string, options: RequestOptions = {}): Promise<ServiceResponse<T>> {
    return this.executeRequest<T>('DELETE', path, options);
  }

  /**
   * PATCH request
   */
  async patch<T = any>(path: string, data?: any, options: RequestOptions = {}): Promise<ServiceResponse<T>> {
    return this.executeRequest<T>('PATCH', path, { ...options, data });
  }

  /**
   * HEAD request
   */
  async head(path: string, options: RequestOptions = {}): Promise<ServiceResponse<void>> {
    return this.executeRequest<void>('HEAD', path, options);
  }

  /**
   * OPTIONS request
   */
  async options(path: string, options: RequestOptions = {}): Promise<ServiceResponse<any>> {
    return this.executeRequest('OPTIONS', path, options);
  }

  /**
   * Stream request
   */
  async stream(path: string, options: RequestOptions = {}): Promise<NodeJS.ReadableStream> {
    const instance = await this.getServiceInstance();
    const url = this.buildServiceUrl(instance, path);
    
    const response = await this.axiosInstance.request({
      ...options,
      method: 'GET',
      url,
      responseType: 'stream'
    });
    
    return response.data;
  }

  /**
   * Upload file
   */
  async upload<T = any>(
    path: string,
    formData: FormData | any,
    options: RequestOptions = {}
  ): Promise<ServiceResponse<T>> {
    return this.executeRequest<T>('POST', path, {
      ...options,
      data: formData,
      headers: {
        ...options.headers,
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.get('/health', {
        timeout: 3000,
        retries: 1,
        circuitBreaker: false,
        tracing: false
      });
      
      return response.status === 200;
    } catch (error) {
      this.config.logger.warn(`Health check failed for service: ${this.config.serviceName}`, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get service info
   */
  async getServiceInfo(): Promise<any> {
    const response = await this.get('/', {
      timeout: 3000,
      retries: 1,
      tracing: false
    });
    
    return response.data;
  }

  /**
   * Update circuit breaker
   */
  setCircuitBreaker(circuitBreaker: CircuitBreaker): void {
    this.config.circuitBreaker = circuitBreaker;
  }

  /**
   * Get current configuration
   */
  getConfig(): ServiceClientConfig {
    return { ...this.config };
  }

  /**
   * Update client configuration
   */
  updateConfig(updates: Partial<ServiceClientConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Update axios instance if timeout changed
    if (updates.timeout) {
      this.axiosInstance.defaults.timeout = updates.timeout;
    }
  }
}