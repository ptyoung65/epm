/**
 * Event Delta Analyzer Server
 * Express.js server for the Event Delta Analyzer
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const EventDeltaAnalyzer = require('./index');
const logger = require('../../api-gateway/src/utils/logger');

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Event Delta Analyzer
const deltaAnalyzer = new EventDeltaAnalyzer({
  baselineWindow: parseInt(process.env.BASELINE_WINDOW) || 24,
  comparisonWindow: parseInt(process.env.COMPARISON_WINDOW) || 1,
  significanceThreshold: parseFloat(process.env.SIGNIFICANCE_THRESHOLD) || 0.05
});

let isServiceReady = false;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    if (!isServiceReady) {
      return res.status(503).json({
        status: 'not_ready',
        message: '이벤트 델타 분석기가 아직 준비되지 않았습니다'
      });
    }

    const health = await deltaAnalyzer.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Analyze delta between baseline and anomaly
app.post('/api/analysis/delta', async (req, res) => {
  try {
    const { anomaly_event, options } = req.body;
    
    if (!anomaly_event) {
      return res.status(400).json({
        error: 'anomaly_event는 필수입니다'
      });
    }

    const result = await deltaAnalyzer.analyzeDelta(anomaly_event, options);
    
    res.json({
      success: true,
      ...result,
      korean_message: '델타 분석이 완료되었습니다'
    });

  } catch (error) {
    logger.error('델타 분석 API 오류', {
      error: error.message,
      anomaly_event: req.body.anomaly_event
    });
    
    res.status(500).json({
      error: '델타 분석 실패',
      message: error.message
    });
  }
});

// Get service metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = deltaAnalyzer.getMetrics();
    
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
    logger.info('이벤트 델타 분석기 서버 시작 중...', { port: PORT });

    // Initialize services
    const services = {
      clickhouse: null, // Will be injected by service manager
      redis: null       // Will be injected by service manager
    };

    // Initialize Event Delta Analyzer
    await deltaAnalyzer.initialize(services);
    await deltaAnalyzer.start();
    
    isServiceReady = true;

    // Start Express server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info('이벤트 델타 분석기 서버가 시작되었습니다', {
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
          await deltaAnalyzer.stop();
          logger.info('이벤트 델타 분석기가 종료되었습니다');
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