const express = require('express');
const logger = require('./utils/logger');
const AnalyticsEngine = require('./index');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ClickHouse connection setup using HTTP requests
const axios = require('axios');

// Create ClickHouse client with retry logic
async function createClickHouseClient() {
  const baseURL = `http://${process.env.CLICKHOUSE_HOST || 'clickhouse'}:${process.env.CLICKHOUSE_PORT || 8123}`;
  const auth = {
    username: process.env.CLICKHOUSE_USER || 'admin',
    password: process.env.CLICKHOUSE_PASSWORD || 'airis_secure_2024'
  };

  // Create HTTP-based ClickHouse client
  const client = {
    baseURL,
    auth,
    async query(options) {
      const response = await axios.get(`${baseURL}/?query=${encodeURIComponent(options.query)}`, {
        auth: this.auth,
        timeout: 10000
      });
      return response.data;
    }
  };

  // Test connection with retry logic
  let retries = 10;
  let delay = 1000;
  
  while (retries > 0) {
    try {
      logger.info(`ClickHouse 연결 시도 중... (남은 시도: ${retries})`);
      await client.query({ query: 'SELECT 1' });
      logger.info('✅ ClickHouse 연결 성공');
      return client;
    } catch (error) {
      retries--;
      if (retries === 0) {
        logger.error('❌ ClickHouse 연결 최종 실패:', error.message);
        throw error;
      }
      logger.warn(`⚠️ ClickHouse 연결 실패, ${delay}ms 후 재시도:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 30000); // Exponential backoff with max 30s
    }
  }
}

// Create analytics engine instance
const analyticsEngine = new AnalyticsEngine({
  anomalyThreshold: 2.5,
  trendAnalysisWindow: 24
});

// Health check endpoint - simplified for Docker health checks
app.get('/health', (req, res) => {
  // Simple health check - just verify HTTP server is responding
  res.status(200).json({ 
    status: 'healthy', 
    service: 'analytics-engine',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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

// Start server and initialize services
async function startServer() {
  try {
    // Start HTTP server first
    const server = app.listen(PORT, () => {
      logger.info(`분석 엔진 서비스가 포트 ${PORT}에서 시작되었습니다`);
    });

    // Initialize ClickHouse connection in background
    setImmediate(async () => {
      try {
        const clickhouseClient = await createClickHouseClient();
        
        // Initialize services with real connections
        await analyticsEngine.initialize({
          clickhouse: clickhouseClient,
          kafka: null, // Will be implemented later
          redis: null  // Will be implemented later
        });
        
        // Start analytics engine
        await analyticsEngine.start();
        
        logger.info('✅ 분석 엔진 초기화 및 시작 완료');
      } catch (error) {
        logger.error('❌ ClickHouse 연결 실패, 서비스는 계속 실행:', error.message);
      }
    });
    
    return server;
    
  } catch (error) {
    logger.error('❌ 서비스 시작 실패:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM 신호 수신, 정리 중...');
  await analyticsEngine.stop();
  process.exit(0);
});