const express = require('express');
const logger = require('./utils/logger');
const DataIngestionService = require('./index');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Create data ingestion service instance
const dataIngestion = new DataIngestionService({
  batchSize: 1000,
  flushInterval: 5000
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await dataIngestion.healthCheck();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json(dataIngestion.getMetrics());
});

// Ingest data endpoint
app.post('/ingest', async (req, res) => {
  try {
    const { type, data } = req.body;
    await dataIngestion.ingest(type, data);
    res.json({ success: true, message: 'Data ingested' });
  } catch (error) {
    logger.error('Ingestion failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`데이터 수집 서비스가 포트 ${PORT}에서 시작되었습니다`);
  
  // Initialize services (simplified for now)
  dataIngestion.initialize({
    clickhouse: null,
    kafka: null,
    redis: null
  }).then(() => {
    logger.info('데이터 수집 서비스 초기화 완료');
  }).catch(error => {
    logger.error('데이터 수집 서비스 초기화 실패', { error: error.message });
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM 신호 수신, 정리 중...');
  await dataIngestion.stop();
  process.exit(0);
});