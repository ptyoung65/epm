/**
 * Session Replay Service Server
 * Express.js server for the Session Replay Service
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const SessionReplayService = require('./index');
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

// Initialize Session Replay Service
const sessionReplayService = new SessionReplayService({
  maxSessionDuration: parseInt(process.env.MAX_SESSION_DURATION) || 1800000,
  samplingRate: parseFloat(process.env.SAMPLING_RATE) || 1.0,
  maskAllInputs: process.env.MASK_ALL_INPUTS !== 'false'
});

let isServiceReady = false;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    if (!isServiceReady) {
      return res.status(503).json({
        status: 'not_ready',
        message: '서비스가 아직 준비되지 않았습니다'
      });
    }

    const health = await sessionReplayService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Start recording session
app.post('/api/sessions/start', async (req, res) => {
  try {
    const { sessionId, metadata } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId는 필수입니다'
      });
    }

    const recording = await sessionReplayService.startRecording(sessionId, metadata);
    
    res.json({
      success: true,
      recording,
      korean_message: '세션 녹화가 시작되었습니다'
    });

  } catch (error) {
    logger.error('세션 녹화 시작 API 오류', {
      error: error.message,
      sessionId: req.body.sessionId
    });
    
    res.status(500).json({
      error: '세션 녹화 시작 실패',
      message: error.message
    });
  }
});

// Stop recording session
app.post('/api/sessions/:sessionId/stop', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = await sessionReplayService.stopRecording(sessionId);
    
    res.json({
      success,
      korean_message: success ? '세션 녹화가 종료되었습니다' : '세션을 찾을 수 없습니다'
    });

  } catch (error) {
    logger.error('세션 녹화 종료 API 오류', {
      error: error.message,
      sessionId: req.params.sessionId
    });
    
    res.status(500).json({
      error: '세션 녹화 종료 실패',
      message: error.message
    });
  }
});

// Get session data
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionData = await sessionReplayService.getSessionData(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({
        error: '세션을 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      session: sessionData
    });

  } catch (error) {
    logger.error('세션 데이터 조회 API 오류', {
      error: error.message,
      sessionId: req.params.sessionId
    });
    
    res.status(500).json({
      error: '세션 데이터 조회 실패',
      message: error.message
    });
  }
});

// Create replay
app.post('/api/sessions/:sessionId/replay', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const options = req.body;
    
    const replayer = await sessionReplayService.replay(sessionId, options);
    
    res.json({
      success: true,
      replayer_config: replayer,
      korean_message: '리플레이가 준비되었습니다'
    });

  } catch (error) {
    logger.error('세션 리플레이 API 오류', {
      error: error.message,
      sessionId: req.params.sessionId
    });
    
    res.status(500).json({
      error: '세션 리플레이 실패',
      message: error.message
    });
  }
});

// Search sessions
app.post('/api/sessions/search', async (req, res) => {
  try {
    const criteria = req.body;
    const sessions = await sessionReplayService.searchSessions(criteria);
    
    res.json({
      success: true,
      sessions,
      count: sessions.length
    });

  } catch (error) {
    logger.error('세션 검색 API 오류', {
      error: error.message,
      criteria: req.body
    });
    
    res.status(500).json({
      error: '세션 검색 실패',
      message: error.message
    });
  }
});

// Analyze session
app.post('/api/sessions/:sessionId/analyze', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const analysis = await sessionReplayService.analyzeSession(sessionId);
    
    res.json({
      success: true,
      analysis,
      korean_message: '세션 분석이 완료되었습니다'
    });

  } catch (error) {
    logger.error('세션 분석 API 오류', {
      error: error.message,
      sessionId: req.params.sessionId
    });
    
    res.status(500).json({
      error: '세션 분석 실패',
      message: error.message
    });
  }
});

// Get service metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = sessionReplayService.getMetrics();
    
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
    logger.info('세션 리플레이 서버 시작 중...', { port: PORT });

    // Initialize services
    const ClickHouseService = require('./services/ClickHouseService');
    const clickhouseService = new ClickHouseService();
    await clickhouseService.connect();
    
    const services = {
      clickhouse: clickhouseService,
      redis: null,      // Will be injected later if needed
      kafka: null       // Will be injected later if needed  
    };

    // Initialize Session Replay Service
    await sessionReplayService.initialize(services);
    await sessionReplayService.start();
    
    isServiceReady = true;

    // Start Express server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info('세션 리플레이 서버가 시작되었습니다', {
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
          await sessionReplayService.stop();
          logger.info('세션 리플레이 서비스가 종료되었습니다');
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