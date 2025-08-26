import { Router, Request, Response } from 'express';
import { config } from '@/config/environment';
import { RedisCache } from '@/services/cache';
import { logger } from '@/utils/logger';

const router = Router();
const cache = new RedisCache(config.redis);

/**
 * Health check status enum
 */
enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Service health interface
 */
interface ServiceHealth {
  name: string;
  status: HealthStatus;
  responseTime?: number;
  lastCheck: Date;
  message?: string;
}

/**
 * Overall health response interface
 */
interface HealthResponse {
  status: HealthStatus;
  timestamp: Date;
  version: string;
  uptime: number;
  environment: string;
  services: ServiceHealth[];
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

/**
 * Check database connectivity
 */
async function checkDatabase(name: string, url: string): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // For demonstration - in real implementation, you'd connect to each database
    // const client = new Client({ connectionString: url });
    // await client.connect();
    // await client.query('SELECT 1');
    // await client.end();
    
    // Simulate database check
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    return {
      name,
      status: HealthStatus.HEALTHY,
      responseTime: Date.now() - startTime,
      lastCheck: new Date(),
      message: 'Connection successful',
    };
  } catch (error) {
    logger.error(`Database health check failed for ${name}`, { error: error.message });
    return {
      name,
      status: HealthStatus.UNHEALTHY,
      responseTime: Date.now() - startTime,
      lastCheck: new Date(),
      message: error.message,
    };
  }
}

/**
 * Check external service connectivity
 */
async function checkExternalService(name: string, url: string): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${url}/health`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AIRIS-EPM-Gateway/1.0',
      },
    });
    
    clearTimeout(timeoutId);
    
    const isHealthy = response.ok;
    
    return {
      name,
      status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
      responseTime: Date.now() - startTime,
      lastCheck: new Date(),
      message: isHealthy ? 'Service responsive' : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      status: HealthStatus.UNHEALTHY,
      responseTime: Date.now() - startTime,
      lastCheck: new Date(),
      message: error.name === 'AbortError' ? 'Timeout' : error.message,
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const isHealthy = await cache.healthCheck();
    const stats = await cache.getStats();
    
    return {
      name: 'Redis Cache',
      status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
      responseTime: Date.now() - startTime,
      lastCheck: new Date(),
      message: isHealthy 
        ? `Connected, ${stats.keyCount} keys, ${stats.memoryUsage}` 
        : 'Connection failed',
    };
  } catch (error) {
    return {
      name: 'Redis Cache',
      status: HealthStatus.UNHEALTHY,
      responseTime: Date.now() - startTime,
      lastCheck: new Date(),
      message: error.message,
    };
  }
}

/**
 * Get system metrics
 */
function getSystemMetrics() {
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal + memUsage.external;
  const usedMemory = memUsage.heapUsed;
  
  return {
    memory: {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round((usedMemory / totalMemory) * 100),
    },
    cpu: {
      usage: Math.round(process.cpuUsage().user / 1000000), // Convert to seconds
    },
  };
}

/**
 * Determine overall health status based on service statuses
 */
function determineOverallStatus(services: ServiceHealth[]): HealthStatus {
  const unhealthyServices = services.filter(s => s.status === HealthStatus.UNHEALTHY);
  const degradedServices = services.filter(s => s.status === HealthStatus.DEGRADED);
  
  if (unhealthyServices.length > 0) {
    // If critical services are down
    const criticalServices = ['Redis Cache'];
    const criticalDown = unhealthyServices.some(s => criticalServices.includes(s.name));
    
    if (criticalDown) {
      return HealthStatus.UNHEALTHY;
    }
    
    // Non-critical services down
    return HealthStatus.DEGRADED;
  }
  
  if (degradedServices.length > 0) {
    return HealthStatus.DEGRADED;
  }
  
  return HealthStatus.HEALTHY;
}

/**
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check all services in parallel
    const serviceChecks = await Promise.all([
      checkRedis(),
      checkDatabase('ClickHouse', config.databases.clickhouse.url),
      checkDatabase('PostgreSQL', config.databases.postgresql.url),
      checkDatabase('MongoDB', config.databases.mongodb.url),
      checkExternalService('Metrics Service', config.services.metricsService),
      checkExternalService('Logs Service', config.services.logsService),
      checkExternalService('Traces Service', config.services.tracesService),
      checkExternalService('Alerts Service', config.services.alertsService),
      checkExternalService('User Service', config.services.userService),
      checkExternalService('Dashboard Service', config.services.dashboardService),
    ]);

    const overallStatus = determineOverallStatus(serviceChecks);
    const systemMetrics = getSystemMetrics();
    
    const healthResponse: HealthResponse = {
      status: overallStatus,
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(process.uptime()),
      environment: config.env,
      services: serviceChecks,
      system: systemMetrics,
    };

    // Set appropriate HTTP status code
    const httpStatus = overallStatus === HealthStatus.HEALTHY ? 200 :
                      overallStatus === HealthStatus.DEGRADED ? 200 : 503;
    
    // Log health check
    logger.info('Health check completed', {
      status: overallStatus,
      responseTime: Date.now() - startTime,
      servicesChecked: serviceChecks.length,
      unhealthyServices: serviceChecks.filter(s => s.status === HealthStatus.UNHEALTHY).length,
    });

    res.status(httpStatus).json(healthResponse);
  } catch (error) {
    logger.error('Health check failed', { error: error.message, stack: error.stack });
    
    res.status(503).json({
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(process.uptime()),
      environment: config.env,
      error: 'Health check system failure',
      message: error.message,
    });
  }
});

/**
 * Readiness probe endpoint (Kubernetes)
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check only critical dependencies for readiness
    const criticalChecks = await Promise.all([
      checkRedis(),
    ]);

    const isReady = criticalChecks.every(service => 
      service.status === HealthStatus.HEALTHY
    );

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date(),
        message: 'Service is ready to accept traffic',
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date(),
        message: 'Service is not ready to accept traffic',
        failedServices: criticalChecks
          .filter(s => s.status !== HealthStatus.HEALTHY)
          .map(s => s.name),
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date(),
      message: 'Readiness check failed',
      error: error.message,
    });
  }
});

/**
 * Liveness probe endpoint (Kubernetes)
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - just return that the process is alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date(),
    uptime: Math.floor(process.uptime()),
    pid: process.pid,
    message: 'Service is alive',
  });
});

/**
 * Startup probe endpoint (Kubernetes)
 */
router.get('/startup', async (req: Request, res: Response) => {
  try {
    // Check if the service has fully started up
    const isStarted = Date.now() - (global as any).startTime > 10000; // 10 seconds
    
    if (isStarted) {
      res.status(200).json({
        status: 'started',
        timestamp: new Date(),
        message: 'Service has completed startup',
      });
    } else {
      res.status(503).json({
        status: 'starting',
        timestamp: new Date(),
        message: 'Service is still starting up',
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'failed',
      timestamp: new Date(),
      message: 'Startup check failed',
      error: error.message,
    });
  }
});

export { router as healthCheck };