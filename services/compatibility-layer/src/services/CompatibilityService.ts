import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { config } from '../config/environment';
import { logger, performanceLogger } from '../utils/logger';
import { ApiVersionManager } from './ApiVersionManager';
import { DataTransformer } from './DataTransformer';
import { RedisCache } from './cache/RedisCache';
import { EventEmitter } from 'events';

/**
 * Request context interface
 */
export interface RequestContext {
  userId?: string;
  tenantId?: string;
  clientVersion?: string;
  apiVersion?: string;
  requestId: string;
  startTime: number;
  headers: Record<string, string>;
}

/**
 * API Response interface
 */
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
  headers?: Record<string, string>;
  metadata?: {
    version: string;
    deprecated?: boolean;
    migrationAvailable?: boolean;
    responseTime: number;
  };
}

/**
 * Compatibility Service
 * 
 * Handles routing requests between legacy AIRIS APM and new EPM APIs,
 * transforming data formats and maintaining backward compatibility.
 */
export class CompatibilityService extends EventEmitter {
  private legacyClient: AxiosInstance;
  private newClient: AxiosInstance;
  private cache: RedisCache;
  private healthStatus: Map<string, boolean> = new Map();
  private requestStats: Map<string, number> = new Map();

  constructor(
    private versionManager: ApiVersionManager,
    private dataTransformer: DataTransformer
  ) {
    super();
    this.setupHttpClients();
    this.cache = new RedisCache(config.databases.redis);
    this.initializeHealthTracking();
  }

  /**
   * Initialize the compatibility service
   */
  public async initialize(): Promise<void> {
    try {
      await this.cache.connect();
      await this.performHealthChecks();
      
      logger.info('Compatibility service initialized', {
        legacyApi: config.apis.legacyApm.url,
        newApi: config.apis.newEpm.restUrl,
        supportedVersions: this.versionManager.getSupportedVersions(),
      });
    } catch (error) {
      logger.error('Failed to initialize compatibility service', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Shutdown the compatibility service
   */
  public async shutdown(): Promise<void> {
    try {
      await this.cache.disconnect();
      logger.info('Compatibility service shut down');
    } catch (error) {
      logger.error('Error shutting down compatibility service', {
        error: error.message,
      });
    }
  }

  /**
   * Setup HTTP clients for legacy and new APIs
   */
  private setupHttpClients(): void {
    // Legacy AIRIS APM client
    this.legacyClient = axios.create({
      baseURL: config.apis.legacyApm.url,
      timeout: config.apis.legacyApm.timeout,
      headers: {
        'User-Agent': 'AIRIS-EPM-Compatibility/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // New AIRIS EPM client
    this.newClient = axios.create({
      baseURL: config.apis.newEpm.restUrl,
      timeout: config.apis.newEpm.timeout,
      headers: {
        'User-Agent': 'AIRIS-EPM-Compatibility/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors for monitoring
    this.setupInterceptors();
  }

  /**
   * Setup HTTP interceptors for monitoring and error handling
   */
  private setupInterceptors(): void {
    // Legacy client interceptors
    this.legacyClient.interceptors.request.use(
      (config) => {
        const startTime = Date.now();
        config.metadata = { startTime };
        return config;
      },
      (error) => {
        logger.error('Legacy API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.legacyClient.interceptors.response.use(
      (response) => {
        const endTime = Date.now();
        const startTime = response.config.metadata?.startTime || endTime;
        const duration = endTime - startTime;

        performanceLogger.api('Legacy API request completed', {
          method: response.config.method?.toUpperCase() || 'GET',
          path: response.config.url || '',
          statusCode: response.status,
          responseTime: duration,
          requestId: response.config.headers['x-request-id'] || 'unknown',
        });

        this.updateHealthStatus('legacy', true);
        return response;
      },
      (error) => {
        const endTime = Date.now();
        const startTime = error.config?.metadata?.startTime || endTime;
        const duration = endTime - startTime;

        logger.error('Legacy API response error', {
          method: error.config?.method,
          path: error.config?.url,
          status: error.response?.status,
          message: error.message,
          duration,
        });

        this.updateHealthStatus('legacy', false);
        return Promise.reject(error);
      }
    );

    // New client interceptors (similar structure)
    this.newClient.interceptors.request.use(
      (config) => {
        const startTime = Date.now();
        config.metadata = { startTime };
        return config;
      },
      (error) => {
        logger.error('New API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.newClient.interceptors.response.use(
      (response) => {
        const endTime = Date.now();
        const startTime = response.config.metadata?.startTime || endTime;
        const duration = endTime - startTime;

        performanceLogger.api('New API request completed', {
          method: response.config.method?.toUpperCase() || 'GET',
          path: response.config.url || '',
          statusCode: response.status,
          responseTime: duration,
          requestId: response.config.headers['x-request-id'] || 'unknown',
        });

        this.updateHealthStatus('new', true);
        return response;
      },
      (error) => {
        const endTime = Date.now();
        const startTime = error.config?.metadata?.startTime || endTime;
        const duration = endTime - startTime;

        logger.error('New API response error', {
          method: error.config?.method,
          path: error.config?.url,
          status: error.response?.status,
          message: error.message,
          duration,
        });

        this.updateHealthStatus('new', false);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Route request to appropriate API (legacy or new)
   */
  public async routeRequest(
    method: string,
    path: string,
    data: any,
    context: RequestContext
  ): Promise<ApiResponse> {
    const startTime = Date.now();
    
    try {
      // Determine which API to use
      const shouldUseLegacy = await this.shouldUseLegacyApi(path, context);
      const targetPath = this.mapEndpointPath(path, shouldUseLegacy);

      logger.info('Routing request', {
        method,
        originalPath: path,
        targetPath,
        useLegacy: shouldUseLegacy,
        clientVersion: context.clientVersion,
        apiVersion: context.apiVersion,
        requestId: context.requestId,
      });

      let response: ApiResponse;

      if (shouldUseLegacy) {
        response = await this.callLegacyApi(method, targetPath, data, context);
      } else {
        response = await this.callNewApi(method, targetPath, data, context);
      }

      // Transform response if needed
      if (context.clientVersion && this.versionManager.requiresTransformation(context.clientVersion)) {
        response.data = await this.dataTransformer.transformResponse(
          response.data,
          context.clientVersion,
          config.compatibility.currentVersion
        );
      }

      // Add compatibility metadata
      response.metadata = {
        ...response.metadata,
        version: shouldUseLegacy ? config.apis.legacyApm.version : config.compatibility.currentVersion,
        deprecated: shouldUseLegacy,
        migrationAvailable: shouldUseLegacy,
        responseTime: Date.now() - startTime,
      };

      // Cache response if enabled
      if (config.features.enableResponseCaching && method === 'GET') {
        await this.cacheResponse(path, data, response, context);
      }

      // Update request statistics
      this.updateRequestStats(path, shouldUseLegacy);

      // Emit event for analytics
      this.emit('requestCompleted', {
        method,
        path,
        usedLegacy: shouldUseLegacy,
        responseTime: Date.now() - startTime,
        context,
      });

      return response;

    } catch (error) {
      logger.error('Request routing failed', {
        method,
        path,
        error: error.message,
        stack: error.stack,
        requestId: context.requestId,
      });

      // Return error response
      return {
        error: 'Internal Server Error',
        message: error.message,
        status: 500,
        metadata: {
          version: config.compatibility.currentVersion,
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Determine if request should use legacy API
   */
  private async shouldUseLegacyApi(path: string, context: RequestContext): Promise<boolean> {
    // Check migration mode
    switch (config.migration.mode) {
      case 'forced':
        return false; // Always use new API
      case 'gradual':
        // Use client version to decide
        if (context.clientVersion) {
          return this.versionManager.isLegacyVersion(context.clientVersion);
        }
        break;
      case 'transparent':
      default:
        // Check if new API endpoint exists
        const newApiHealthy = this.healthStatus.get('new') !== false;
        if (!newApiHealthy) {
          logger.warn('New API unhealthy, falling back to legacy', {
            path,
            requestId: context.requestId,
          });
          return true;
        }
        break;
    }

    // Default: prefer new API unless client explicitly requests legacy
    return context.apiVersion ? this.versionManager.isLegacyVersion(context.apiVersion) : false;
  }

  /**
   * Map endpoint path between APIs
   */
  private mapEndpointPath(originalPath: string, useLegacy: boolean): string {
    if (useLegacy) {
      // Map new paths to legacy paths
      const reverseMapping = Object.entries(config.endpointMappings)
        .find(([, newPath]) => originalPath.startsWith(newPath));
      
      if (reverseMapping) {
        return originalPath.replace(reverseMapping[1], reverseMapping[0]);
      }
    } else {
      // Map legacy paths to new paths
      for (const [legacyPath, newPath] of Object.entries(config.endpointMappings)) {
        if (originalPath.startsWith(legacyPath)) {
          return originalPath.replace(legacyPath, newPath);
        }
      }
    }

    return originalPath;
  }

  /**
   * Call legacy AIRIS APM API
   */
  private async callLegacyApi(
    method: string,
    path: string,
    data: any,
    context: RequestContext
  ): Promise<ApiResponse> {
    try {
      const requestConfig: AxiosRequestConfig = {
        method: method.toLowerCase() as any,
        url: path,
        headers: {
          ...context.headers,
          'x-request-id': context.requestId,
          'x-forwarded-for': context.headers['x-forwarded-for'],
        },
      };

      if (['post', 'put', 'patch'].includes(method.toLowerCase())) {
        requestConfig.data = data;
      } else if (data && Object.keys(data).length > 0) {
        requestConfig.params = data;
      }

      const response = await this.legacyClient.request(requestConfig);

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      if (error.response) {
        return {
          error: error.response.data?.error || 'API Error',
          message: error.response.data?.message || error.message,
          status: error.response.status,
          data: error.response.data,
        };
      }
      throw error;
    }
  }

  /**
   * Call new AIRIS EPM API
   */
  private async callNewApi(
    method: string,
    path: string,
    data: any,
    context: RequestContext
  ): Promise<ApiResponse> {
    try {
      const requestConfig: AxiosRequestConfig = {
        method: method.toLowerCase() as any,
        url: path,
        headers: {
          ...context.headers,
          'x-request-id': context.requestId,
          'x-user-id': context.userId,
          'x-tenant-id': context.tenantId,
        },
      };

      if (['post', 'put', 'patch'].includes(method.toLowerCase())) {
        requestConfig.data = data;
      } else if (data && Object.keys(data).length > 0) {
        requestConfig.params = data;
      }

      const response = await this.newClient.request(requestConfig);

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      if (error.response) {
        return {
          error: error.response.data?.error || 'API Error',
          message: error.response.data?.message || error.message,
          status: error.response.status,
          data: error.response.data,
        };
      }
      throw error;
    }
  }

  /**
   * Cache response for GET requests
   */
  private async cacheResponse(
    path: string,
    params: any,
    response: ApiResponse,
    context: RequestContext
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(path, params, context);
      const cacheData = {
        data: response.data,
        status: response.status,
        timestamp: Date.now(),
      };

      await this.cache.setex(cacheKey, 300, JSON.stringify(cacheData)); // 5 minute cache
    } catch (error) {
      logger.warn('Failed to cache response', {
        path,
        error: error.message,
        requestId: context.requestId,
      });
    }
  }

  /**
   * Get cached response
   */
  public async getCachedResponse(
    path: string,
    params: any,
    context: RequestContext
  ): Promise<ApiResponse | null> {
    if (!config.features.enableResponseCaching) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(path, params, context);
      const cachedData = await this.cache.get(cacheKey);

      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Check if cache is still fresh (within 5 minutes)
        if (Date.now() - parsed.timestamp < 300000) {
          logger.debug('Cache hit', {
            path,
            cacheKey,
            requestId: context.requestId,
          });

          return {
            data: parsed.data,
            status: parsed.status,
            metadata: {
              version: config.compatibility.currentVersion,
              responseTime: 0,
              cached: true,
            },
          };
        }
      }
    } catch (error) {
      logger.warn('Failed to retrieve cached response', {
        path,
        error: error.message,
      });
    }

    return null;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(path: string, params: any, context: RequestContext): string {
    const keyParts = [
      path,
      context.userId || 'anonymous',
      context.tenantId || 'default',
      JSON.stringify(params || {}),
    ];
    
    return `api_cache:${Buffer.from(keyParts.join('|')).toString('base64')}`;
  }

  /**
   * Update health status tracking
   */
  private updateHealthStatus(api: string, isHealthy: boolean): void {
    this.healthStatus.set(api, isHealthy);
  }

  /**
   * Update request statistics
   */
  private updateRequestStats(path: string, usedLegacy: boolean): void {
    const key = `${path}:${usedLegacy ? 'legacy' : 'new'}`;
    const current = this.requestStats.get(key) || 0;
    this.requestStats.set(key, current + 1);
  }

  /**
   * Perform initial health checks
   */
  private async performHealthChecks(): Promise<void> {
    try {
      // Check legacy API
      await this.legacyClient.get('/health', { timeout: 5000 });
      this.updateHealthStatus('legacy', true);
    } catch (error) {
      logger.warn('Legacy API health check failed', { error: error.message });
      this.updateHealthStatus('legacy', false);
    }

    try {
      // Check new API
      await this.newClient.get('/health', { timeout: 5000 });
      this.updateHealthStatus('new', true);
    } catch (error) {
      logger.warn('New API health check failed', { error: error.message });
      this.updateHealthStatus('new', false);
    }
  }

  /**
   * Initialize continuous health tracking
   */
  private initializeHealthTracking(): void {
    setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    healthStatus: Record<string, boolean>;
    requestStats: Record<string, number>;
    cacheStats: any;
  } {
    return {
      healthStatus: Object.fromEntries(this.healthStatus),
      requestStats: Object.fromEntries(this.requestStats),
      cacheStats: {}, // Would be populated by cache service
    };
  }
}