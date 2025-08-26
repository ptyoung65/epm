import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger, performanceLogger } from '../utils/logger';
import { config } from '../config/environment';

/**
 * Request logging middleware
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique request ID
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  (req as any).requestId = requestId;
  
  // Set request ID in response headers
  res.set('X-Request-ID', requestId);
  
  const startTime = Date.now();
  const startHrTime = process.hrtime.bigint();
  
  // Extract client information
  const clientInfo = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    origin: req.get('Origin'),
    clientVersion: req.headers['x-client-version'] as string,
    apiVersion: req.headers['x-api-version'] as string,
  };

  // Log incoming request
  if (config.features.enableRequestLogging && shouldLogRequest(req)) {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      query: req.query,
      requestId,
      ...clientInfo,
    });
  }

  // Override res.end to capture response information
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const endTime = Date.now();
    const endHrTime = process.hrtime.bigint();
    const duration = endTime - startTime;
    const hrDuration = Number(endHrTime - startHrTime) / 1e6; // Convert to milliseconds

    // Log response
    if (config.features.enableRequestLogging && shouldLogRequest(req)) {
      const logLevel = getLogLevel(res.statusCode);
      logger[logLevel]('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: duration,
        hrResponseTime: hrDuration,
        requestId,
        contentLength: res.get('Content-Length') || '0',
        ...clientInfo,
      });
    }

    // Performance logging for analytics
    if (config.features.enableMetricsCollection) {
      performanceLogger.api('Request performance', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: duration,
        hrResponseTime: hrDuration,
        requestId,
        userId: (req as any).user?.id,
        tenantId: (req as any).user?.tenantId,
        clientVersion: clientInfo.clientVersion,
        apiVersion: clientInfo.apiVersion,
      });
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Determine if request should be logged
 */
function shouldLogRequest(req: Request): boolean {
  const path = req.path;
  
  // Skip logging for health checks and static assets
  const skipPaths = ['/health', '/favicon.ico', '/robots.txt'];
  const skipPatterns = [/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i];
  
  if (skipPaths.includes(path)) {
    return false;
  }
  
  if (skipPatterns.some(pattern => pattern.test(path))) {
    return false;
  }
  
  return true;
}

/**
 * Get appropriate log level based on status code
 */
function getLogLevel(statusCode: number): 'info' | 'warn' | 'error' {
  if (statusCode >= 500) {
    return 'error';
  } else if (statusCode >= 400) {
    return 'warn';
  }
  return 'info';
}

/**
 * Extract request size middleware
 */
export const requestSizeLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentLength = req.get('Content-Length');
  
  if (contentLength) {
    const sizeInBytes = parseInt(contentLength, 10);
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    // Log large requests
    if (sizeInMB > 10) {
      logger.warn('Large request received', {
        method: req.method,
        path: req.path,
        contentLength: sizeInBytes,
        sizeMB: sizeInMB.toFixed(2),
        requestId: (req as any).requestId,
      });
    }
    
    // Track request size for analytics
    performanceLogger.api('Request size', {
      method: req.method,
      path: req.path,
      contentLength: sizeInBytes,
      sizeMB: sizeInMB,
      requestId: (req as any).requestId,
    });
  }
  
  next();
};
