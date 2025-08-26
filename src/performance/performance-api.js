/**
 * Performance Optimization API
 * AIRIS EPM - Enterprise Performance Management
 * 성능 최적화 시스템 통합 API
 */

import express from 'express';
import { CacheManager } from './caching/cache-manager.js';
import { QueryOptimizer } from './query-optimizer.js';
import { DatabaseConnectionPool } from './pooling/connection-pool.js';
import { CDNManager, CloudFrontProvider } from './cdn/cdn-manager.js';
import { MetricsCollector, PerformanceAnalyzer, PerformanceDashboardProvider } from './monitoring/performance-monitor.js';

const router = express.Router();

// 성능 시스템 인스턴스
const cacheManager = new CacheManager();
const queryOptimizer = new QueryOptimizer();
const dbPool = new DatabaseConnectionPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'airis_epm',
  user: process.env.DB_USER || 'postgres'
});

const cdnManager = new CDNManager();
const metricsCollector = new MetricsCollector();
const performanceAnalyzer = new PerformanceAnalyzer(metricsCollector);
const dashboardProvider = new PerformanceDashboardProvider(metricsCollector, performanceAnalyzer);

// CDN 제공자 설정
if (process.env.CLOUDFRONT_DISTRIBUTION_ID) {
  const cloudFrontProvider = new CloudFrontProvider({
    distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    bucketName: process.env.S3_BUCKET_NAME,
    domainName: process.env.CDN_DOMAIN_NAME
  });
  cdnManager.addProvider(cloudFrontProvider, true);
}

// 시스템 초기화
let isInitialized = false;

async function initializeSystems() {
  if (isInitialized) return;
  
  try {
    await Promise.all([
      cacheManager.init(),
      dbPool.init(),
      metricsCollector.start(),
      performanceAnalyzer.start()
    ]);
    
    isInitialized = true;
    console.log('Performance systems initialized successfully');
  } catch (error) {
    console.error('Failed to initialize performance systems:', error);
    throw error;
  }
}

// 시스템 초기화 미들웨어
router.use(async (req, res, next) => {
  if (!isInitialized) {
    try {
      await initializeSystems();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Performance systems initialization failed'
      });
    }
  }
  next();
});

/**
 * 캐시 관련 API
 */

// 캐시에서 데이터 조회
router.get('/cache/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const context = {
      type,
      id,
      strategy: req.query.strategy || 'lru'
    };
    
    const result = await cacheManager.get(context);
    
    if (result !== null) {
      res.json({
        success: true,
        data: result,
        cached: true
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Data not found in cache'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 캐시에 데이터 저장
router.post('/cache/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { data } = req.body;
    
    const context = {
      type,
      id,
      strategy: req.body.strategy || 'lru',
      accessCount: req.body.accessCount || 1,
      dataSize: JSON.stringify(data).length
    };
    
    const success = await cacheManager.set(context, data);
    
    res.json({
      success,
      message: success ? 'Data cached successfully' : 'Failed to cache data'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 캐시 무효화
router.delete('/cache/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const context = { type, id };
    
    const count = await cacheManager.invalidate(context);
    
    res.json({
      success: true,
      invalidatedCount: count,
      message: `Invalidated ${count} cache entries`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 캐시 통계
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = cacheManager.getMetrics();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 쿼리 최적화 관련 API
 */

// 쿼리 최적화
router.post('/query/optimize', async (req, res) => {
  try {
    const { sql, params = [], context = {} } = req.body;
    
    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required'
      });
    }
    
    const result = await queryOptimizer.optimizeQuery(sql, params, context);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 쿼리 분석
router.post('/query/analyze', async (req, res) => {
  try {
    const { sql, params = [] } = req.body;
    
    const analysis = queryOptimizer.analyzer.analyzeQuery(sql, params);
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 느린 쿼리 조회
router.get('/query/slow', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 1000;
    const slowQueries = queryOptimizer.getSlowQueries(threshold);
    
    res.json({
      success: true,
      slowQueries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 인덱스 제안
router.get('/query/index-suggestions', async (req, res) => {
  try {
    const report = queryOptimizer.indexManager.generateIndexReport();
    
    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 연결 풀 관련 API
 */

// 연결 풀 상태
router.get('/pool/status', async (req, res) => {
  try {
    const stats = dbPool.getStats();
    const health = await dbPool.health();
    
    res.json({
      success: true,
      stats,
      health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 연결 상태 조회
router.get('/pool/connections', async (req, res) => {
  try {
    const connections = dbPool.getConnectionStatus();
    
    res.json({
      success: true,
      connections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * CDN 관련 API
 */

// 파일 업로드
router.post('/cdn/upload', async (req, res) => {
  try {
    const { file, options = {} } = req.body;
    
    if (!file || !file.name || !file.content) {
      return res.status(400).json({
        success: false,
        error: 'File name and content are required'
      });
    }
    
    const result = await cdnManager.upload(file, options);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// CDN 통계
router.get('/cdn/stats', async (req, res) => {
  try {
    const stats = await cdnManager.getAllStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 캐시 무효화
router.post('/cdn/invalidate', async (req, res) => {
  try {
    const { paths } = req.body;
    
    if (!Array.isArray(paths)) {
      return res.status(400).json({
        success: false,
        error: 'Paths array is required'
      });
    }
    
    const results = await cdnManager.invalidate(paths);
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 성능 모니터링 관련 API
 */

// 최신 메트릭 조회
router.get('/metrics/latest', async (req, res) => {
  try {
    const metrics = metricsCollector.getLatestMetrics();
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 시간 범위별 메트릭 조회
router.get('/metrics/range', async (req, res) => {
  try {
    const { start, end, category } = req.query;
    
    const timeRange = start && end ? {
      start: parseInt(start),
      end: parseInt(end)
    } : null;
    
    const metrics = metricsCollector.getMetrics(category, timeRange);
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 성능 분석 보고서
router.get('/analysis/report', async (req, res) => {
  try {
    const report = await performanceAnalyzer.analyze();
    
    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 알림 조회
router.get('/alerts', async (req, res) => {
  try {
    const { severity, limit = 100 } = req.query;
    const alerts = performanceAnalyzer.getAlerts(severity, parseInt(limit));
    
    res.json({
      success: true,
      alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 대시보드 데이터
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = dashboardProvider.getDashboardData();
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 통합 성능 관리 API
 */

// 전체 시스템 상태
router.get('/health', async (req, res) => {
  try {
    const health = {
      cache: await cacheManager.health(),
      query: queryOptimizer.getHealth(),
      pool: await dbPool.health(),
      cdn: await cdnManager.health(),
      monitor: {
        status: 'healthy',
        collecting: metricsCollector.isCollecting,
        analyzing: performanceAnalyzer.analysisTimer !== null
      }
    };
    
    // 전체 상태 결정
    const statuses = Object.values(health).map(h => h.status);
    const overallStatus = statuses.includes('critical') ? 'critical' :
                         statuses.includes('warning') ? 'warning' : 'healthy';
    
    res.json({
      success: true,
      overall: overallStatus,
      systems: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 성능 요약
router.get('/summary', async (req, res) => {
  try {
    const [
      cacheStats,
      poolStats,
      cdnStats,
      alerts,
      latestMetrics
    ] = await Promise.all([
      cacheManager.getMetrics(),
      dbPool.getStats(),
      cdnManager.getAllStats(),
      performanceAnalyzer.getAlerts(null, 10),
      metricsCollector.getLatestMetrics()
    ]);
    
    const summary = {
      cache: {
        hitRate: cacheStats.manager.hitRate,
        totalRequests: cacheStats.manager.hits + cacheStats.manager.misses,
        errors: cacheStats.manager.errors
      },
      connections: {
        total: poolStats.total,
        active: poolStats.inUse,
        utilization: poolStats.utilization
      },
      cdn: {
        totalUploads: cdnStats.manager.uploads,
        bandwidth: `${(cdnStats.manager.bandwidth / 1024 / 1024 / 1024).toFixed(2)}GB`,
        errorRate: cdnStats.manager.uploads > 0 
          ? ((cdnStats.manager.errors / cdnStats.manager.uploads) * 100).toFixed(2) + '%' 
          : '0%'
      },
      system: latestMetrics.system ? {
        cpuUsage: latestMetrics.system.cpu?.usage?.average || 0,
        memoryUsage: latestMetrics.system.memory?.usagePercent || 0
      } : null,
      alerts: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warnings: alerts.filter(a => a.severity === 'warning').length
      }
    };
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 벤치마크 실행
router.post('/benchmark', async (req, res) => {
  try {
    const { type, iterations = 1000 } = req.body;
    
    const results = {};
    const startTime = Date.now();
    
    switch (type) {
      case 'cache':
        // 캐시 성능 벤치마크
        for (let i = 0; i < iterations; i++) {
          await cacheManager.set({
            type: 'benchmark',
            id: i.toString()
          }, { data: `test-${i}` });
        }
        
        for (let i = 0; i < iterations; i++) {
          await cacheManager.get({
            type: 'benchmark',
            id: i.toString()
          });
        }
        
        results.cache = {
          operations: iterations * 2,
          duration: Date.now() - startTime,
          opsPerSecond: (iterations * 2) / ((Date.now() - startTime) / 1000)
        };
        break;
        
      case 'pool':
        // 연결 풀 벤치마크
        const promises = [];
        for (let i = 0; i < iterations; i++) {
          promises.push((async () => {
            const conn = await dbPool.acquire();
            await new Promise(resolve => setTimeout(resolve, 1));
            await dbPool.release(conn);
          })());
        }
        
        await Promise.all(promises);
        
        results.pool = {
          connections: iterations,
          duration: Date.now() - startTime,
          connectionsPerSecond: iterations / ((Date.now() - startTime) / 1000)
        };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid benchmark type'
        });
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 시스템 종료 처리
process.on('SIGTERM', async () => {
  console.log('Shutting down performance systems...');
  
  try {
    await Promise.all([
      cacheManager.disconnect(),
      dbPool.shutdown()
    ]);
    
    metricsCollector.stop();
    performanceAnalyzer.stop();
    
    console.log('Performance systems shut down successfully');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
});

export default router;