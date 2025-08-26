/**
 * Data Quality API Endpoints
 * AIRIS EPM - Enterprise Performance Management
 * 데이터 품질 관리 API
 */

import express from 'express';
import { DataValidator, DataQualityScorer } from './validation-schema.js';
import { HybridAnomalyDetector } from './anomaly-detector.js';
import { DataCleansingPipeline, DataTransformer, DataEnricher } from './data-cleansing.js';
import { QualityMetricsCollector, QualityDashboardProvider } from './quality-metrics.js';

const router = express.Router();

// 인스턴스 생성
const validator = new DataValidator();
const qualityScorer = new DataQualityScorer();
const anomalyDetector = new HybridAnomalyDetector();
const cleansingPipeline = new DataCleansingPipeline();
const transformer = new DataTransformer();
const enricher = new DataEnricher();
const metricsCollector = new QualityMetricsCollector();
const dashboardProvider = new QualityDashboardProvider(metricsCollector);

// 메트릭 수집 시작
metricsCollector.start();

/**
 * POST /api/quality/validate
 * 데이터 검증
 */
router.post('/validate', async (req, res) => {
  try {
    const { data, schemaType, options = {} } = req.body;
    
    if (!data || !schemaType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: data, schemaType'
      });
    }
    
    // 검증 수행
    const startTime = Date.now();
    const result = validator.validate(data, schemaType);
    const duration = Date.now() - startTime;
    
    // 메트릭 기록
    metricsCollector.recordValidation(schemaType, result.isValid, result.errors || []);
    metricsCollector.recordPerformance('validation', duration, result.isValid);
    
    res.json({
      success: true,
      result,
      duration
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/quality/validate-batch
 * 배치 데이터 검증
 */
router.post('/validate-batch', async (req, res) => {
  try {
    const { dataArray, schemaType } = req.body;
    
    if (!Array.isArray(dataArray) || !schemaType) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: dataArray must be an array'
      });
    }
    
    // 배치 검증
    const startTime = Date.now();
    const result = validator.validateBatch(dataArray, schemaType);
    const duration = Date.now() - startTime;
    
    // 메트릭 기록
    metricsCollector.recordValidation(schemaType, result.successRate === 100, []);
    metricsCollector.recordPerformance('batch-validation', duration);
    
    res.json({
      success: true,
      result,
      duration
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/quality/score
 * 데이터 품질 점수 계산
 */
router.post('/score', async (req, res) => {
  try {
    const { data, schemaType } = req.body;
    
    if (!data || !schemaType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: data, schemaType'
      });
    }
    
    // 품질 점수 계산
    const score = qualityScorer.calculateScore(data, schemaType);
    
    // 메트릭 기록
    metricsCollector.recordQualityScore(schemaType, score.overallScore, score.dimensions);
    
    res.json({
      success: true,
      score
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/quality/detect-anomaly
 * 이상치 탐지
 */
router.post('/detect-anomaly', async (req, res) => {
  try {
    const { dataPoint } = req.body;
    
    if (!dataPoint) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: dataPoint'
      });
    }
    
    // 이상치 탐지
    const result = await anomalyDetector.detect(dataPoint);
    
    // 메트릭 기록
    metricsCollector.recordAnomaly(
      dataPoint.metricName,
      result.isAnomaly,
      result.confidence,
      result
    );
    
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

/**
 * POST /api/quality/cleanse
 * 데이터 클렌징
 */
router.post('/cleanse', async (req, res) => {
  try {
    const { data, options = {} } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: data'
      });
    }
    
    // 클렌징 수행
    const startTime = Date.now();
    const result = cleansingPipeline.cleanSingle(data);
    const duration = Date.now() - startTime;
    
    // 메트릭 기록
    const dataType = data.metricType || 'unknown';
    metricsCollector.recordCleansing(
      dataType,
      result.cleaned ? 1 : 0,
      result.steps.filter(s => s.name === 'removeNullValues').length,
      result.steps.filter(s => s.name === 'normalizeValues').length
    );
    metricsCollector.recordPerformance('cleansing', duration);
    
    res.json({
      success: true,
      result,
      duration
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/quality/cleanse-batch
 * 배치 데이터 클렌징
 */
router.post('/cleanse-batch', async (req, res) => {
  try {
    const { dataArray } = req.body;
    
    if (!Array.isArray(dataArray)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: dataArray must be an array'
      });
    }
    
    // 배치 클렌징
    const startTime = Date.now();
    const result = cleansingPipeline.cleanBatch(dataArray);
    const duration = Date.now() - startTime;
    
    // 메트릭 기록
    metricsCollector.recordPerformance('batch-cleansing', duration);
    
    res.json({
      success: true,
      result,
      duration
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/quality/transform
 * 데이터 변환
 */
router.post('/transform', async (req, res) => {
  try {
    const { data, transformations } = req.body;
    
    if (!data || !transformations) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: data, transformations'
      });
    }
    
    // 변환 적용
    const result = Array.isArray(transformations)
      ? transformer.applyChain(transformations, data)
      : transformer.apply(transformations, data);
    
    res.json({
      success: true,
      original: data,
      transformed: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/quality/enrich
 * 데이터 농축
 */
router.post('/enrich', async (req, res) => {
  try {
    const { data, rules = [] } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: data'
      });
    }
    
    // 기본 농축 규칙 등록
    enricher.addRule('geoData', enricher.enrichWithGeoData);
    enricher.addRule('businessContext', enricher.enrichWithBusinessContext);
    enricher.addRule('timeContext', (d) => enricher.enrichWithTimeContext(d));
    
    // 농축 수행
    const result = await enricher.enrich(data, rules);
    
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

/**
 * POST /api/quality/train-model
 * ML 모델 학습
 */
router.post('/train-model', async (req, res) => {
  try {
    const { trainingData } = req.body;
    
    if (!Array.isArray(trainingData)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: trainingData must be an array'
      });
    }
    
    // ML 모델 학습
    const result = await anomalyDetector.trainMLModel(trainingData);
    
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

/**
 * GET /api/quality/metrics
 * 품질 메트릭 조회
 */
router.get('/metrics', (req, res) => {
  try {
    const { type, level = '1m' } = req.query;
    
    const metrics = type
      ? metricsCollector.getAggregatedMetrics(level, type)
      : metricsCollector.getAggregatedMetrics(level);
    
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

/**
 * GET /api/quality/report
 * 품질 보고서 생성
 */
router.get('/report', (req, res) => {
  try {
    const report = metricsCollector.generateReport();
    
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
 * GET /api/quality/dashboard
 * 대시보드 데이터 조회
 */
router.get('/dashboard', (req, res) => {
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
 * GET /api/quality/anomalies
 * 최근 이상치 조회
 */
router.get('/anomalies', (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const anomalies = anomalyDetector.getAnomalyHistory(parseInt(limit));
    
    res.json({
      success: true,
      anomalies,
      statistics: anomalyDetector.getAnomalyStatistics()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/quality/validation-stats
 * 검증 통계 조회
 */
router.get('/validation-stats', (req, res) => {
  try {
    const stats = validator.getStats();
    
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
 * POST /api/quality/reset-stats
 * 통계 초기화
 */
router.post('/reset-stats', (req, res) => {
  try {
    validator.resetStats();
    cleansingPipeline.resetStats();
    metricsCollector.resetStats();
    
    res.json({
      success: true,
      message: 'Statistics reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * WebSocket 연결 설정 (실시간 모니터링)
 */
export function setupWebSocket(io) {
  const qualityNamespace = io.of('/quality');
  
  qualityNamespace.on('connection', (socket) => {
    console.log('Client connected to quality monitoring');
    
    // 실시간 메트릭 전송
    const metricsInterval = setInterval(() => {
      const dashboardData = dashboardProvider.getDashboardData();
      socket.emit('dashboard-update', dashboardData);
    }, 5000); // 5초마다 업데이트
    
    // 실시간 이상치 알림
    const anomalyCheck = setInterval(async () => {
      const recentAnomalies = anomalyDetector.getAnomalyHistory(1);
      if (recentAnomalies.length > 0) {
        socket.emit('anomaly-detected', recentAnomalies[0]);
      }
    }, 1000); // 1초마다 체크
    
    socket.on('disconnect', () => {
      console.log('Client disconnected from quality monitoring');
      clearInterval(metricsInterval);
      clearInterval(anomalyCheck);
    });
    
    // 수동 새로고침 요청
    socket.on('refresh', () => {
      const dashboardData = dashboardProvider.getDashboardData();
      socket.emit('dashboard-update', dashboardData);
    });
  });
}

export default router;