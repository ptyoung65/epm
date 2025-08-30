const express = require('express');
const logger = require('./utils/logger');
const AnalyticsEngine = require('./index');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Create analytics engine instance
const analyticsEngine = new AnalyticsEngine({
  anomalyThreshold: 2.5,
  trendAnalysisWindow: 24
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await analyticsEngine.healthCheck();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json(analyticsEngine.getMetrics());
});

// Analysis summary endpoint
app.get('/analysis/summary', async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '24h';
    const summary = await analyticsEngine.getAnalysisSummary(timeRange);
    res.json(summary);
  } catch (error) {
    logger.error('분석 요약 조회 실패', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Trigger analysis endpoint
app.post('/analysis/trigger', async (req, res) => {
  try {
    await analyticsEngine.runPeriodicAnalysis();
    res.json({ success: true, message: '분석이 트리거되었습니다' });
  } catch (error) {
    logger.error('분석 트리거 실패', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`분석 엔진 서비스가 포트 ${PORT}에서 시작되었습니다`);
  
  // Initialize services (simplified for now)
  analyticsEngine.initialize({
    clickhouse: null,
    kafka: null,
    redis: null
  }).then(() => {
    logger.info('분석 엔진 초기화 완료');
    return analyticsEngine.start();
  }).then(() => {
    logger.info('분석 엔진 시작됨');
  }).catch(error => {
    logger.error('분석 엔진 초기화 실패', { error: error.message });
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM 신호 수신, 정리 중...');
  await analyticsEngine.stop();
  process.exit(0);
});