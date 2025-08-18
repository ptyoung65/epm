/**
 * AIOps ML Engine Server
 * Express.js server for the AIOps ML Engine
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const AIOpsMLEngine = require('./ml-engine');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize AIOps ML Engine
const aiopsEngine = new AIOpsMLEngine({
  modelPath: process.env.MODEL_PATH || './models',
  anomalyThreshold: parseFloat(process.env.ANOMALY_THRESHOLD) || 0.95,
  predictionHorizon: parseInt(process.env.PREDICTION_HORIZON) || 24
});

let isServiceReady = false;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    if (!isServiceReady) {
      return res.status(503).json({
        status: 'not_ready',
        message: 'AIOps ML 엔진이 아직 준비되지 않았습니다'
      });
    }

    const health = await aiopsEngine.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Detect anomalies
app.post('/api/anomalies/detect', async (req, res) => {
  try {
    const currentData = req.body;
    const result = await aiopsEngine.detectAnomalies(currentData);
    
    res.json({
      success: true,
      ...result,
      korean_message: result.is_anomaly ? '이상 현상이 감지되었습니다' : '정상 범위 내입니다'
    });

  } catch (error) {
    logger.error('이상 탐지 API 오류', {
      error: error.message,
      data: req.body
    });
    
    res.status(500).json({
      error: '이상 탐지 실패',
      message: error.message
    });
  }
});

// Predict failures
app.post('/api/predictions/failure', async (req, res) => {
  try {
    const { metrics } = req.body;
    const result = await aiopsEngine.predictFailure(metrics);
    
    res.json({
      success: true,
      ...result,
      korean_message: `${result.prediction_horizon} 내 장애 가능성: ${(result.failure_probability * 100).toFixed(1)}%`
    });

  } catch (error) {
    logger.error('장애 예측 API 오류', {
      error: error.message,
      metricsCount: req.body.metrics?.length
    });
    
    res.status(500).json({
      error: '장애 예측 실패',
      message: error.message
    });
  }
});

// Automated Root Cause Analysis
app.post('/api/analysis/rca', async (req, res) => {
  try {
    const incident = req.body;
    const result = await aiopsEngine.automatedRCA(incident);
    
    res.json({
      success: true,
      ...result,
      korean_message: '근본 원인 분석이 완료되었습니다'
    });

  } catch (error) {
    logger.error('RCA API 오류', {
      error: error.message,
      incident: req.body
    });
    
    res.status(500).json({
      error: '근본 원인 분석 실패',
      message: error.message
    });
  }
});

// Cluster incidents
app.post('/api/analysis/cluster', async (req, res) => {
  try {
    const { incidents } = req.body;
    const result = await aiopsEngine.clusterIncidents(incidents);
    
    res.json({
      success: true,
      ...result,
      korean_message: '인시던트 클러스터링이 완료되었습니다'
    });

  } catch (error) {
    logger.error('클러스터링 API 오류', {
      error: error.message,
      incidentCount: req.body.incidents?.length
    });
    
    res.status(500).json({
      error: '인시던트 클러스터링 실패',
      message: error.message
    });
  }
});

// Get service metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = aiopsEngine.getMetrics();
    
    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    logger.error('메트릭 조회 API 오류', {
      error: error.message
    });
    
    res.status(500).json({
      error: '메트릭 조회 실패',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Express 오류', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: '서버 내부 오류',
    message: process.env.NODE_ENV === 'development' ? error.message : '서버에서 오류가 발생했습니다'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: '엔드포인트를 찾을 수 없습니다',
    path: req.originalUrl
  });
});

// Initialize and start server
async function startServer() {
  try {
    logger.info('AIOps ML 엔진 서버 시작 중...', { port: PORT });

    // Initialize services
    const services = {
      clickhouse: null, // Will be injected by service manager
      redis: null       // Will be injected by service manager
    };

    // Initialize AIOps ML Engine
    await aiopsEngine.initialize(services);
    await aiopsEngine.start();
    
    isServiceReady = true;

    // Start Express server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info('AIOps ML 엔진 서버가 시작되었습니다', {
        port: PORT,
        env: process.env.NODE_ENV || 'development'
      });
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} 신호를 받았습니다. 서버를 정상적으로 종료합니다...`);
      
      server.close(async () => {
        logger.info('HTTP 서버가 종료되었습니다');
        
        try {
          await aiopsEngine.stop();
          logger.info('AIOps ML 엔진이 종료되었습니다');
          process.exit(0);
        } catch (error) {
          logger.error('서비스 종료 중 오류 발생', { error: error.message });
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('서버 시작 실패', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;