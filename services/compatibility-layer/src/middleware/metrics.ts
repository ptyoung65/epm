import { Request, Response, NextFunction } from 'express';
import { logger, performanceLogger } from '../utils/logger';
import { config } from '../config/environment';

/**
 * Request metrics collection interface
 */
interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  userAgent?: string;
  apiVersion?: string;
  clientVersion?: string;
  userId?: string;
  tenantId?: string;
  requestId: string;
  timestamp: number;
}

/**
 * In-memory metrics store (should be replaced with proper metrics backend)
 */
class MetricsStore {
  private metrics: RequestMetrics[] = [];
  private readonly maxMetrics = 10000;

  public addMetric(metric: RequestMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics to prevent memory leak
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  public getMetrics(filters?: Partial<RequestMetrics>): RequestMetrics[] {
    if (!filters) return [...this.metrics];
    
    return this.metrics.filter(metric => {
      return Object.keys(filters).every(key => 
        metric[key as keyof RequestMetrics] === filters[key as keyof RequestMetrics]
      );
    });
  }

  public getStats(timeWindowMs: number = 300000): any { // 5 minutes default
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < timeWindowMs);
    
    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        requestsPerMinute: 0,
        statusCodes: {},
        topPaths: [],
        errorRate: 0,
      };
    }

    const totalRequests = recentMetrics.length;
    const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
    const requestsPerMinute = (totalRequests / (timeWindowMs / 60000));
    
    const statusCodes: Record<number, number> = {};
    const pathCounts: Record<string, number> = {};
    let errorCount = 0;

    recentMetrics.forEach(metric => {
      // Status code distribution
      statusCodes[metric.statusCode] = (statusCodes[metric.statusCode] || 0) + 1;
      
      // Path frequency
      pathCounts[metric.path] = (pathCounts[metric.path] || 0) + 1;
      
      // Error count
      if (metric.statusCode >= 400) {
        errorCount++;
      }
    });

    const topPaths = Object.entries(pathCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
      statusCodes,
      topPaths,
      errorRate: Math.round((errorCount / totalRequests) * 10000) / 100, // percentage with 2 decimals
      timeWindowMs,
    };
  }

  public clearOldMetrics(olderThanMs: number = 3600000): void { // 1 hour default
    const cutoff = Date.now() - olderThanMs;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }
}

// Global metrics store instance
const metricsStore = new MetricsStore();

/**
 * Metrics collection middleware
 */
export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!config.features.enableMetricsCollection) {
    return next();
  }

  const startTime = Date.now();
  const startHrTime = process.hrtime.bigint();
  
  // Get request size
  const requestSize = parseInt(req.get('Content-Length') || '0', 10);
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  const originalWrite = res.write;
  
  let responseSize = 0;
  
  res.write = function(chunk: any, ...args: any[]) {
    if (chunk) {
      responseSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    }
    return originalWrite.apply(this, [chunk, ...args]);
  };
  
  res.end = function(chunk?: any, ...args: any[]) {
    if (chunk) {
      responseSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    }
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Collect metrics
    const metric: RequestMetrics = {
      method: req.method,
      path: normalizePath(req.path),
      statusCode: res.statusCode,
      responseTime,
      requestSize,
      responseSize,
      userAgent: req.get('User-Agent'),
      apiVersion: (req as any).apiVersion,
      clientVersion: req.headers['x-client-version'] as string,
      userId: (req as any).user?.id,
      tenantId: (req as any).user?.tenantId,
      requestId: (req as any).requestId || 'unknown',
      timestamp: startTime,
    };
    
    // Store metric
    metricsStore.addMetric(metric);
    
    // Log performance metric
    performanceLogger.api('Request metric collected', {
      ...metric,
      hrResponseTime: Number(process.hrtime.bigint() - startHrTime) / 1e6,
    });
    
    // Log slow requests
    if (responseTime > 1000) { // Slower than 1 second
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        responseTime,
        statusCode: res.statusCode,
        requestId: metric.requestId,
      });
    }
    
    // Log large responses
    if (responseSize > 1024 * 1024) { // Larger than 1MB
      logger.warn('Large response detected', {
        method: req.method,
        path: req.path,
        responseSize,
        responseSizeMB: Math.round(responseSize / (1024 * 1024) * 100) / 100,
        requestId: metric.requestId,
      });
    }
    
    return originalEnd.apply(this, [chunk, ...args]);
  };
  
  next();
};

/**
 * Metrics endpoint middleware
 */
export const metricsEndpoint = (
  req: Request,
  res: Response
): void => {
  const timeWindow = parseInt(req.query.timeWindow as string) || 300000; // 5 minutes default
  const stats = metricsStore.getStats(timeWindow);
  
  res.json({
    status: 'success',
    data: stats,
    timestamp: new Date().toISOString(),
    timeWindow,
  });
};

/**
 * Health metrics endpoint
 */
export const healthMetrics = (
  req: Request,
  res: Response
): void => {
  const stats = metricsStore.getStats();
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  // Determine health status
  const isHealthy = (
    stats.errorRate < 5 && // Less than 5% error rate
    stats.averageResponseTime < 1000 && // Less than 1 second average response time
    memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9 // Less than 90% heap usage
  );
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    metrics: stats,
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100, // MB
      rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100, // MB
    },
    process: {
      pid: process.pid,
      version: process.version,
      platform: process.platform,
    },
  });
};

/**
 * Prometheus metrics format endpoint
 */
export const prometheusMetrics = (
  req: Request,
  res: Response
): void => {
  const stats = metricsStore.getStats();
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  let output = '';
  
  // Request metrics
  output += `# HELP compatibility_layer_requests_total Total number of requests\n`;
  output += `# TYPE compatibility_layer_requests_total counter\n`;
  output += `compatibility_layer_requests_total ${stats.totalRequests}\n\n`;
  
  output += `# HELP compatibility_layer_request_duration_ms Average request duration in milliseconds\n`;
  output += `# TYPE compatibility_layer_request_duration_ms gauge\n`;
  output += `compatibility_layer_request_duration_ms ${stats.averageResponseTime}\n\n`;
  
  output += `# HELP compatibility_layer_requests_per_minute Requests per minute\n`;
  output += `# TYPE compatibility_layer_requests_per_minute gauge\n`;
  output += `compatibility_layer_requests_per_minute ${stats.requestsPerMinute}\n\n`;
  
  output += `# HELP compatibility_layer_error_rate Error rate percentage\n`;
  output += `# TYPE compatibility_layer_error_rate gauge\n`;
  output += `compatibility_layer_error_rate ${stats.errorRate}\n\n`;
  
  // Memory metrics
  output += `# HELP compatibility_layer_memory_heap_used_bytes Memory heap used in bytes\n`;
  output += `# TYPE compatibility_layer_memory_heap_used_bytes gauge\n`;
  output += `compatibility_layer_memory_heap_used_bytes ${memoryUsage.heapUsed}\n\n`;
  
  output += `# HELP compatibility_layer_memory_heap_total_bytes Memory heap total in bytes\n`;
  output += `# TYPE compatibility_layer_memory_heap_total_bytes gauge\n`;
  output += `compatibility_layer_memory_heap_total_bytes ${memoryUsage.heapTotal}\n\n`;
  
  // Process metrics
  output += `# HELP compatibility_layer_uptime_seconds Process uptime in seconds\n`;
  output += `# TYPE compatibility_layer_uptime_seconds gauge\n`;
  output += `compatibility_layer_uptime_seconds ${Math.floor(uptime)}\n\n`;
  
  res.set('Content-Type', 'text/plain');
  res.send(output);
};

/**
 * Cleanup old metrics periodically
 */
setInterval(() => {
  metricsStore.clearOldMetrics();
}, 300000); // Clean up every 5 minutes

/**
 * Normalize path for metrics (remove IDs and parameters)
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/\d+/g, '/:id') // Replace numeric IDs
    .replace(/\/[a-f0-9-]{8,}/g, '/:id') // Replace UUIDs and hex IDs
    .replace(/\?.+$/, '') // Remove query parameters
    .replace(/\/$/, '') || '/'; // Remove trailing slash
}

/**
 * Export metrics store for testing
 */
export { metricsStore };
