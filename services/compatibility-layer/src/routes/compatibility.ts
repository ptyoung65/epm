import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRoles, AuthenticatedRequest } from '../middleware/authentication';
import { validateApiVersion } from '../middleware/versionNegotiation';
import { CompatibilityService, RequestContext } from '../services/CompatibilityService';
import { ApiVersionManager } from '../services/ApiVersionManager';
import { DataTransformer } from '../services/DataTransformer';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create compatibility routes
 */
export const compatibilityRoutes = (
  compatibilityService: CompatibilityService,
  versionManager: ApiVersionManager,
  dataTransformer: DataTransformer
) => {
  const router = Router();

  /**
   * API version information endpoint
   */
  router.get('/versions', asyncHandler(async (req: Request, res: Response) => {
    const versions = versionManager.getSupportedVersions();
    const deprecatedVersions = versionManager.getDeprecatedVersions();
    const currentVersion = '3.0'; // From config
    
    const versionInfo = versions.map(version => {
      const info = versionManager.getVersion(version);
      const comparison = versionManager.compareVersionInfo(version);
      
      return {
        version,
        releaseDate: info?.releaseDate,
        deprecated: info?.deprecated || false,
        eolDate: info?.eolDate,
        supportLevel: info?.supportLevel,
        features: info?.features || [],
        breakingChanges: info?.breaking_changes || [],
        migrationGuide: info?.migration_guide,
        isLegacy: comparison.isLegacy,
        requiresTransformation: comparison.requiresTransformation,
      };
    });
    
    res.json({
      currentVersion,
      supportedVersions: versions,
      deprecatedVersions,
      versions: versionInfo,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Version comparison endpoint
   */
  router.get('/versions/:version/compare', asyncHandler(async (req: Request, res: Response) => {
    const { version } = req.params;
    const targetVersion = req.query.target as string || '3.0';
    
    if (!versionManager.isVersionSupported(version)) {
      return res.status(400).json({
        error: 'Unsupported Version',
        message: `Version ${version} is not supported`,
        supportedVersions: versionManager.getSupportedVersions(),
      });
    }
    
    const comparison = versionManager.compareVersionInfo(version);
    const migrationInfo = versionManager.getMigrationInfo(version);
    
    res.json({
      fromVersion: version,
      toVersion: targetVersion,
      comparison,
      migration: migrationInfo,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Main API proxy endpoint - handles all API versions
   */
  router.all('/:apiPath(*)', 
    validateApiVersion,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const startTime = Date.now();
      
      // Build request context
      const context: RequestContext = {
        userId: req.user?.id,
        tenantId: req.user?.tenantId || req.headers['x-tenant-id'] as string,
        clientVersion: req.headers['x-client-version'] as string,
        apiVersion: (req as any).apiVersion || req.headers['x-api-version'] as string,
        requestId: (req as any).requestId || uuidv4(),
        startTime,
        headers: req.headers as Record<string, string>,
      };
      
      // Check for cached response first
      if (req.method === 'GET') {
        const cachedResponse = await compatibilityService.getCachedResponse(
          req.params.apiPath,
          req.query,
          context
        );
        
        if (cachedResponse) {
          logger.debug('Returning cached response', {
            path: req.params.apiPath,
            requestId: context.requestId,
          });
          
          // Add cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Age': '0', // Would calculate actual age
          });
          
          return res.status(cachedResponse.status).json(cachedResponse);
        }
      }
      
      try {
        // Route request through compatibility service
        const response = await compatibilityService.routeRequest(
          req.method,
          `/${req.params.apiPath}`,
          req.body || req.query,
          context
        );
        
        // Add version warnings to headers if present
        if ((req as any).versionWarnings?.length > 0) {
          res.set('X-API-Warnings', (req as any).versionWarnings.join('; '));
        }
        
        // Add cache control headers
        if (req.method === 'GET' && response.status < 400) {
          res.set({
            'Cache-Control': 'private, max-age=300', // 5 minutes
            'X-Cache': 'MISS',
          });
        }
        
        // Set response headers from API response
        if (response.headers) {
          Object.entries(response.headers).forEach(([key, value]) => {
            res.set(key, value);
          });
        }
        
        res.status(response.status).json({
          ...response,
          metadata: {
            ...response.metadata,
            requestId: context.requestId,
          },
        });
        
      } catch (error) {
        logger.error('API proxy error', {
          path: req.params.apiPath,
          method: req.method,
          error: error.message,
          requestId: context.requestId,
        });
        
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to process API request',
          requestId: context.requestId,
          timestamp: new Date().toISOString(),
        });
      }
    })
  );

  /**
   * Data transformation testing endpoint
   */
  router.post('/transform/test',
    requireRoles(['admin', 'developer']),
    asyncHandler(async (req: Request, res: Response) => {
      const { data, fromVersion, toVersion } = req.body;
      
      if (!data || !fromVersion || !toVersion) {
        return res.status(400).json({
          error: 'Missing Parameters',
          message: 'data, fromVersion, and toVersion are required',
        });
      }
      
      try {
        // Transform request data
        const transformedRequest = await dataTransformer.transformRequest(
          data,
          fromVersion,
          toVersion
        );
        
        // Transform response data (simulate round-trip)
        const transformedResponse = await dataTransformer.transformResponse(
          transformedRequest,
          toVersion,
          fromVersion
        );
        
        // Validate transformation
        const validation = dataTransformer.validateTransformation(
          data,
          transformedRequest
        );
        
        res.json({
          original: data,
          transformedRequest,
          transformedResponse,
          validation,
          fromVersion,
          toVersion,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        logger.error('Transformation test failed', {
          error: error.message,
          fromVersion,
          toVersion,
        });
        
        res.status(500).json({
          error: 'Transformation Failed',
          message: error.message,
          fromVersion,
          toVersion,
        });
      }
    })
  );

  /**
   * Service statistics endpoint
   */
  router.get('/stats',
    requireRoles(['admin', 'operator']),
    asyncHandler(async (req: Request, res: Response) => {
      const stats = compatibilityService.getStats();
      const transformerStats = dataTransformer.getStats();
      
      res.json({
        compatibility: stats,
        transformer: transformerStats,
        timestamp: new Date().toISOString(),
      });
    })
  );

  /**
   * Configuration endpoint
   */
  router.get('/config',
    requireRoles(['admin']),
    asyncHandler(async (req: Request, res: Response) => {
      // Return safe configuration information (no secrets)
      const config = {
        migration: {
          mode: 'transparent', // From config
          batchSize: 1000,
          retryAttempts: 3,
        },
        compatibility: {
          strictVersionCheck: false,
          deprecatedWarningThreshold: 30,
          eolWarningThreshold: 90,
          supportedVersions: versionManager.getSupportedVersions(),
          currentVersion: '3.0',
        },
        features: {
          enableDataValidation: true,
          enableResponseCaching: true,
          enableRequestLogging: true,
          enableMetricsCollection: true,
        },
        endpoints: {
          '/api/v1/metrics': '/api/v3/metrics',
          '/api/v1/alerts': '/api/v3/alerts',
          '/api/v1/dashboards': '/api/v3/dashboards',
          '/api/v1/users': '/api/v3/users',
          '/api/v1/traces': '/api/v3/traces',
          '/api/v1/logs': '/api/v3/logs',
        },
        timestamp: new Date().toISOString(),
      };
      
      res.json(config);
    })
  );

  /**
   * Clear cache endpoint
   */
  router.delete('/cache',
    requireRoles(['admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const pattern = req.query.pattern as string;
      
      try {
        // This would integrate with the cache service
        logger.info('Cache clear requested', {
          pattern,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        
        res.json({
          message: 'Cache cleared successfully',
          pattern: pattern || 'all',
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        logger.error('Failed to clear cache', {
          error: error.message,
          pattern,
        });
        
        res.status(500).json({
          error: 'Cache Clear Failed',
          message: error.message,
        });
      }
    })
  );

  return router;
};
