import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { healthMetrics } from '../middleware/metrics';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Basic health check endpoint
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  // Check basic system health
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
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
    responseTime: Date.now() - startTime,
  };
  
  // Determine if system is healthy
  const isHealthy = (
    memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9 && // Less than 90% heap usage
    uptime > 0 // Process is running
  );
  
  if (!isHealthy) {
    health.status = 'unhealthy';
    res.status(503);
  }
  
  res.json(health);
}));

/**
 * Detailed health check with metrics
 */
router.get('/detailed', healthMetrics);

/**
 * Readiness probe for Kubernetes
 */
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  // Check if all required services are ready
  const readiness = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    services: {
      // These would be checked against actual services
      database: 'ready',
      cache: 'ready',
      legacyApi: 'ready',
      newApi: 'ready',
    },
  };
  
  // In a real implementation, you would check actual service connectivity
  const allServicesReady = Object.values(readiness.services).every(status => status === 'ready');
  
  if (!allServicesReady) {
    readiness.status = 'not ready';
    res.status(503);
  }
  
  res.json(readiness);
}));

/**
 * Liveness probe for Kubernetes
 */
router.get('/live', asyncHandler(async (req: Request, res: Response) => {
  const liveness = {
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
  };
  
  res.json(liveness);
}));

/**
 * System information endpoint
 */
router.get('/info', asyncHandler(async (req: Request, res: Response) => {
  const info = {
    service: 'AIRIS APM to EPM Compatibility Layer',
    version: process.env.npm_package_version || '1.0.0',
    description: 'Provides backward compatibility between AIRIS APM and EPM APIs',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    node: {
      version: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    features: {
      apiVersioning: true,
      dataTransformation: true,
      caching: true,
      metrics: true,
      migration: true,
    },
    supportedVersions: ['1.0', '1.1', '1.2', '2.0', '2.1', '3.0'],
    currentVersion: '3.0',
  };
  
  res.json(info);
}));

export { router as healthCheck };
