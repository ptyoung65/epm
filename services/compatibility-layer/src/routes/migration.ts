import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRoles, AuthenticatedRequest } from '../middleware/authentication';
import { MigrationService, MigrationTask } from '../services/MigrationService';
import { logger } from '../utils/logger';

/**
 * Create migration routes
 */
export const migrationRoutes = (migrationService: MigrationService) => {
  const router = Router();

  /**
   * Get migration service status
   */
  router.get('/status', asyncHandler(async (req: Request, res: Response) => {
    const status = migrationService.getMigrationStatus();
    const stats = migrationService.getMigrationStats();
    
    res.json({
      status,
      statistics: stats,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Get migration statistics
   */
  router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
    const stats = migrationService.getMigrationStats();
    
    res.json({
      statistics: stats,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Create a new migration task
   */
  router.post('/tasks',
    requireRoles(['admin', 'operator']),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { name, description, priority, metadata } = req.body;
      
      if (!name || !description) {
        return res.status(400).json({
          error: 'Missing Parameters',
          message: 'name and description are required',
        });
      }
      
      const taskId = migrationService.addMigrationTask({
        name,
        description,
        priority: priority || 'medium',
        metadata: {
          ...metadata,
          createdBy: req.user?.id,
          createdAt: new Date().toISOString(),
        },
      });
      
      logger.info('Migration task created', {
        taskId,
        name,
        createdBy: req.user?.id,
      });
      
      res.status(201).json({
        taskId,
        message: 'Migration task created successfully',
        timestamp: new Date().toISOString(),
      });
    })
  );

  /**
   * Create a migration batch
   */
  router.post('/batches',
    requireRoles(['admin', 'operator']),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { batchName, dataSource, fromVersion, toVersion, estimatedRecords } = req.body;
      
      if (!batchName || !dataSource || !fromVersion || !toVersion || !estimatedRecords) {
        return res.status(400).json({
          error: 'Missing Parameters',
          message: 'batchName, dataSource, fromVersion, toVersion, and estimatedRecords are required',
        });
      }
      
      try {
        const batchId = await migrationService.createMigrationBatch(
          batchName,
          dataSource,
          fromVersion,
          toVersion,
          parseInt(estimatedRecords, 10)
        );
        
        logger.info('Migration batch created', {
          batchId,
          batchName,
          dataSource,
          fromVersion,
          toVersion,
          estimatedRecords,
          createdBy: req.user?.id,
        });
        
        res.status(201).json({
          batchId,
          message: 'Migration batch created successfully',
          batchName,
          estimatedTasks: Math.ceil(parseInt(estimatedRecords, 10) / 1000),
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        logger.error('Failed to create migration batch', {
          error: error.message,
          batchName,
          dataSource,
        });
        
        res.status(500).json({
          error: 'Batch Creation Failed',
          message: error.message,
        });
      }
    })
  );

  /**
   * Get batch information
   */
  router.get('/batches/:batchId',
    requireRoles(['admin', 'operator', 'viewer']),
    asyncHandler(async (req: Request, res: Response) => {
      const { batchId } = req.params;
      
      // This would typically fetch from cache or database
      // For now, return a mock response
      try {
        const batchInfo = {
          id: batchId,
          name: `Migration Batch ${batchId}`,
          description: 'Data migration batch',
          status: 'pending',
          totalTasks: 10,
          completedTasks: 3,
          failedTasks: 1,
          progress: 30,
          createdAt: new Date().toISOString(),
          tasks: [], // Would contain actual task list
        };
        
        res.json({
          batch: batchInfo,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        logger.error('Failed to get batch information', {
          error: error.message,
          batchId,
        });
        
        res.status(404).json({
          error: 'Batch Not Found',
          message: `Batch ${batchId} not found`,
        });
      }
    })
  );

  /**
   * Get migration history
   */
  router.get('/history',
    requireRoles(['admin', 'operator', 'viewer']),
    asyncHandler(async (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      
      // This would typically fetch from database
      // For now, return mock history
      const history = {
        migrations: [],
        totalCount: 0,
        limit,
        offset,
        hasMore: false,
      };
      
      res.json({
        history,
        timestamp: new Date().toISOString(),
      });
    })
  );

  /**
   * Estimate migration effort
   */
  router.post('/estimate',
    requireRoles(['admin', 'operator']),
    asyncHandler(async (req: Request, res: Response) => {
      const { dataSource, fromVersion, toVersion, sampleSize } = req.body;
      
      if (!dataSource || !fromVersion || !toVersion) {
        return res.status(400).json({
          error: 'Missing Parameters',
          message: 'dataSource, fromVersion, and toVersion are required',
        });
      }
      
      try {
        // Mock estimation logic
        const estimatedRecords = Math.floor(Math.random() * 100000) + 10000;
        const estimatedDuration = Math.floor(estimatedRecords / 1000) * 30; // 30 seconds per 1000 records
        const complexity = fromVersion === '1.0' && toVersion === '3.0' ? 'high' : 'medium';
        
        const estimate = {
          dataSource,
          fromVersion,
          toVersion,
          estimatedRecords,
          estimatedDuration: `${Math.floor(estimatedDuration / 60)} minutes`,
          estimatedTasks: Math.ceil(estimatedRecords / 1000),
          complexity,
          recommendedBatchSize: 1000,
          risks: [
            complexity === 'high' ? 'Major version gap may require extensive transformation' : null,
            estimatedRecords > 50000 ? 'Large dataset may impact system performance' : null,
          ].filter(Boolean),
          recommendations: [
            'Schedule migration during low-traffic hours',
            'Monitor system resources during migration',
            'Have rollback plan ready',
          ],
        };
        
        res.json({
          estimate,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        logger.error('Migration estimation failed', {
          error: error.message,
          dataSource,
          fromVersion,
          toVersion,
        });
        
        res.status(500).json({
          error: 'Estimation Failed',
          message: error.message,
        });
      }
    })
  );

  /**
   * Validate migration readiness
   */
  router.post('/validate',
    requireRoles(['admin', 'operator']),
    asyncHandler(async (req: Request, res: Response) => {
      const { dataSource, fromVersion, toVersion } = req.body;
      
      if (!dataSource || !fromVersion || !toVersion) {
        return res.status(400).json({
          error: 'Missing Parameters',
          message: 'dataSource, fromVersion, and toVersion are required',
        });
      }
      
      try {
        // Mock validation logic
        const validation = {
          dataSource: {
            accessible: true,
            authenticated: true,
            schema: 'compatible',
          },
          versions: {
            fromVersionSupported: true,
            toVersionSupported: true,
            transformationRulesAvailable: true,
          },
          system: {
            diskSpace: 'sufficient',
            memory: 'sufficient',
            networkConnectivity: 'good',
          },
          dependencies: {
            legacyApiAvailable: true,
            newApiAvailable: true,
            cacheServiceAvailable: true,
          },
          overall: 'ready',
          warnings: [],
          blockers: [],
        };
        
        // Add some conditional warnings
        if (fromVersion === '1.0' && toVersion === '3.0') {
          validation.warnings.push('Large version gap may require extended migration time');
        }
        
        res.json({
          validation,
          dataSource,
          fromVersion,
          toVersion,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        logger.error('Migration validation failed', {
          error: error.message,
          dataSource,
          fromVersion,
          toVersion,
        });
        
        res.status(500).json({
          error: 'Validation Failed',
          message: error.message,
        });
      }
    })
  );

  /**
   * Cancel migration task or batch
   */
  router.post('/cancel/:id',
    requireRoles(['admin', 'operator']),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { reason } = req.body;
      
      try {
        logger.info('Migration cancellation requested', {
          id,
          reason,
          cancelledBy: req.user?.id,
        });
        
        // Mock cancellation logic
        res.json({
          message: `Migration ${id} cancelled successfully`,
          id,
          reason: reason || 'No reason provided',
          cancelledBy: req.user?.username,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        logger.error('Migration cancellation failed', {
          error: error.message,
          id,
        });
        
        res.status(500).json({
          error: 'Cancellation Failed',
          message: error.message,
        });
      }
    })
  );

  /**
   * Migration service health check
   */
  router.get('/health', asyncHandler(async (req: Request, res: Response) => {
    try {
      const status = migrationService.getMigrationStatus();
      const stats = migrationService.getMigrationStats();
      
      const health = {
        status: 'healthy',
        queueSize: status.queueSize,
        activeMigrations: status.activeMigrations,
        successRate: stats.successRate,
        averageTime: stats.averageMigrationTime,
        lastMigration: stats.lastMigrationTime,
        timestamp: new Date().toISOString(),
      };
      
      // Determine health based on metrics
      if (status.queueSize > 1000 || stats.successRate < 90) {
        health.status = 'degraded';
      }
      
      if (status.activeMigrations === 0 && status.queueSize > 100) {
        health.status = 'unhealthy';
      }
      
      res.json(health);
      
    } catch (error) {
      logger.error('Migration health check failed', {
        error: error.message,
      });
      
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  return router;
};
