/**
 * Session Replay Service Server
 * Express.js server for the Session Replay Service
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const SessionReplayService = require('./index');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:*", "ws://localhost:*"]
    }
  }
}));
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

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

// Store session events
app.post('/api/sessions/events', async (req, res) => {
  try {
    const { sessionId, events, url, timestamp, unload } = req.body;
    
    if (!sessionId || !events) {
      return res.status(400).json({
        error: 'sessionId와 events는 필수입니다'
      });
    }
    
    // 세션 데이터 저장 (메모리 기반)
    if (!sessionReplayService.sessions) {
      sessionReplayService.sessions = new Map();
    }
    
    let session = sessionReplayService.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        createdAt: new Date().toISOString(),
        rrwebEvents: [],
        pageViews: [],
        eventCount: 0
      };
      sessionReplayService.sessions.set(sessionId, session);
    }
    
    // 이벤트 추가
    session.rrwebEvents.push(...events);
    session.eventCount = session.rrwebEvents.length;
    
    // 페이지 URL 추가
    if (url && !session.pageViews.includes(url)) {
      session.pageViews.push(url);
    }
    
    // 세션 종료 처리
    if (unload) {
      session.status = 'completed';
      session.completedAt = timestamp;
    }
    
    sessionReplayService.sessions.set(sessionId, session);
    
    res.json({
      success: true,
      message: `${events.length}개 이벤트 저장됨`,
      sessionId,
      totalEvents: session.eventCount
    });
    
  } catch (error) {
    logger.error('세션 이벤트 저장 API 오류', {
      error: error.message,
      sessionId: req.body.sessionId
    });
    
    res.status(500).json({
      error: '세션 이벤트 저장 실패',
      message: error.message
    });
  }
});

// Get session events
app.get('/api/sessions/:sessionId/events', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionReplayService.sessions) {
      sessionReplayService.sessions = new Map();
    }
    
    const session = sessionReplayService.sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        error: '세션을 찾을 수 없습니다'
      });
    }
    
    res.json({
      success: true,
      sessionId: session.sessionId,
      events: session.rrwebEvents || [],
      pageViews: session.pageViews || [],
      duration: session.completedAt ? 
        new Date(session.completedAt) - new Date(session.createdAt) : 0,
      eventCount: session.eventCount || 0
    });
    
  } catch (error) {
    logger.error('세션 이벤트 조회 API 오류', {
      error: error.message,
      sessionId: req.params.sessionId
    });
    
    res.status(500).json({
      error: '세션 이벤트 조회 실패',
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

// Convert rrweb events to Playwright script
app.post('/api/sessions/convert-to-playwright', async (req, res) => {
  try {
    const { events, options = {} } = req.body;
    
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        error: '유효한 이벤트 배열이 필요합니다'
      });
    }

    const playwrightScript = generatePlaywrightScript(events, options);
    
    // 실행 결과를 위한 스크립트 생성
    const executionResult = await executePlaywrightScript(playwrightScript, options);
    
    res.json({
      success: true,
      playwright_script: playwrightScript,
      event_count: events.length,
      script_id: executionResult.script_id,
      execution_info: executionResult,
      korean_message: 'Playwright 스크립트가 생성되었습니다'
    });

  } catch (error) {
    logger.error('Playwright 변환 API 오류', {
      error: error.message,
      eventCount: req.body.events?.length || 0
    });
    
    res.status(500).json({
      error: 'Playwright 스크립트 생성 실패',
      message: error.message
    });
  }
});

// Execute Playwright script
app.post('/api/sessions/execute-playwright', async (req, res) => {
  try {
    const { script, options = {} } = req.body;
    
    if (!script) {
      return res.status(400).json({
        error: 'Playwright 스크립트가 필요합니다'
      });
    }

    // Playwright 스크립트 실행 (실제 구현에서는 별도 프로세스에서 실행)
    const executionResult = await executePlaywrightScript(script, options);
    
    res.json({
      success: true,
      execution_result: executionResult,
      korean_message: 'Playwright 스크립트가 실행되었습니다'
    });

  } catch (error) {
    logger.error('Playwright 실행 API 오류', {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Playwright 스크립트 실행 실패',
      message: error.message
    });
  }
});

// Get all sessions (for dashboard)
app.get('/api/sessions', async (req, res) => {
  try {
    // 기본 검색 조건으로 최근 세션들 가져오기
    const limit = parseInt(req.query.limit) || 20;
    const criteria = { limit };
    
    // 로컬 저장소 시뮬레이션 (ClickHouse가 없을 경우)
    const mockSessions = [
      {
        session_id: 'session_1724610000000',
        user_id: 'user_001',
        url: 'http://localhost:3002/',
        korean_timestamp: '2025. 08. 25. 오후 10:00:00',
        duration: 45000,
        event_count: 156,
        korean_business_hours: false,
        metadata: { userAgent: 'Chrome/91.0' }
      },
      {
        session_id: 'session_1724609700000',
        user_id: 'user_002',
        url: 'http://localhost:3002/j2ee-dashboard.html',
        korean_timestamp: '2025. 08. 25. 오후 9:55:00',
        duration: 120000,
        event_count: 324,
        korean_business_hours: false,
        metadata: { userAgent: 'Chrome/91.0' }
      }
    ];
    
    if (sessionReplayService.clickhouseService) {
      // ClickHouse가 있으면 실제 데이터 조회
      const sessions = await sessionReplayService.searchSessions(criteria);
      res.json({
        success: true,
        sessions,
        count: sessions.length,
        source: 'database'
      });
    } else {
      // ClickHouse가 없으면 목업 데이터 반환
      res.json({
        success: true,
        sessions: mockSessions,
        count: mockSessions.length,
        source: 'mock'
      });
    }

  } catch (error) {
    logger.error('세션 목록 API 오류', {
      error: error.message
    });
    
    res.status(500).json({
      error: '세션 목록 조회 실패',
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

// rrweb events를 Playwright 스크립트로 변환
function generatePlaywrightScript(events, options = {}) {
  const { 
    browser = 'chromium', 
    headless = false, 
    slowMo = 100,
    timeout = 30000 
  } = options;

  let script = `// Generated Playwright script from rrweb session
const { ${browser} } = require('playwright');

async function replaySession() {
  const browser = await ${browser}.launch({ 
    headless: ${headless}, 
    slowMo: ${slowMo} 
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🎬 세션 리플레이 시작...');
    
`;

  let currentUrl = null;
  let actionCount = 0;

  // rrweb 이벤트를 Playwright 액션으로 변환
  for (const event of events) {
    try {
      switch (event.type) {
        case 2: // DOMContentLoaded or Full Snapshot
          if (event.data?.href && event.data.href !== currentUrl) {
            currentUrl = event.data.href;
            script += `    // 페이지 이동
    await page.goto('${currentUrl}', { timeout: ${timeout} });
    await page.waitForLoadState('domcontentloaded');
    console.log('📄 페이지 로드:', '${currentUrl}');
    
`;
            actionCount++;
          }
          break;

        case 3: // Interaction Event
          if (event.data?.source === 2) { // Mouse interaction
            const { x, y, type } = event.data;
            if (type === 1) { // Click
              script += `    // 클릭 이벤트 (${x}, ${y})
    await page.mouse.click(${x}, ${y});
    await page.waitForTimeout(${slowMo});
    console.log('🖱️ 클릭:', ${x}, ${y});
    
`;
              actionCount++;
            }
          } else if (event.data?.source === 5) { // Keyboard input
            const text = event.data.text || '';
            if (text) {
              script += `    // 키보드 입력
    await page.keyboard.type('${text.replace(/'/g, "\\'")}');
    await page.waitForTimeout(${slowMo});
    console.log('⌨️ 입력:', '${text.replace(/'/g, "\\'")}');
    
`;
              actionCount++;
            }
          } else if (event.data?.source === 3) { // Scroll
            const { x, y } = event.data;
            script += `    // 스크롤 이벤트
    await page.mouse.wheel(${x || 0}, ${y || 0});
    await page.waitForTimeout(${slowMo / 2});
    
`;
            actionCount++;
          }
          break;

        case 5: // Focus event
          if (event.data?.id) {
            script += `    // 포커스 이벤트
    await page.waitForTimeout(${slowMo / 2});
    
`;
          }
          break;
      }
    } catch (eventError) {
      // 개별 이벤트 처리 오류는 무시하고 계속 진행
      console.warn('이벤트 처리 중 오류:', eventError.message);
    }
  }

  script += `    console.log('✅ 세션 리플레이 완료! 총 ${actionCount}개 액션 실행됨');
    
    // 결과 확인을 위해 5초 대기
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ 리플레이 중 오류:', error);
  } finally {
    await browser.close();
    console.log('🏁 브라우저 종료');
  }
}

// 스크립트 실행
replaySession().catch(console.error);
`;

  return script;
}

// Playwright 스크립트 실행 (실제로는 별도 프로세스에서 실행해야 함)
async function executePlaywrightScript(script, options = {}) {
  const fs = require('fs');
  const { spawn } = require('child_process');
  const path = require('path');
  const { v4: uuidv4 } = require('uuid');
  
  try {
    // 데이터 디렉토리 확인 및 생성
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 고유한 스크립트 파일 생성
    const scriptId = uuidv4().substring(0, 8);
    const scriptPath = path.join(dataDir, `replay_${scriptId}.js`);
    
    // 스크립트에 실행 환경 설정 추가
    const enhancedScript = `// AIRIS 세션 리플레이 Playwright 스크립트
// 생성 시간: ${new Date().toLocaleString('ko-KR')}
// 스크립트 ID: ${scriptId}

const fs = require('fs');
const path = require('path');

// 실행 로그 저장
const logPath = path.join(__dirname, 'execution_${scriptId}.log');
function log(message) {
  const timestamp = new Date().toLocaleString('ko-KR');
  const logEntry = \`[\${timestamp}] \${message}\\n\`;
  fs.appendFileSync(logPath, logEntry);
  console.log(message);
}

log('🎬 AIRIS 세션 리플레이 시작');

${script}

// 실행 완료 후 정리
process.on('exit', (code) => {
  log(\`🏁 스크립트 실행 완료 (종료 코드: \${code})\`);
});`;

    fs.writeFileSync(scriptPath, enhancedScript);
    
    // package.json 확인 및 Playwright 설치
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const hasPlaywright = packageJson.dependencies?.playwright || packageJson.devDependencies?.playwright;
    
    return {
      status: 'generated',
      script_id: scriptId,
      script_path: scriptPath,
      log_path: path.join(dataDir, `execution_${scriptId}.log`),
      message: '스크립트가 생성되었습니다.',
      korean_message: 'Playwright 스크립트가 생성되었습니다',
      execution_command: `cd ${path.dirname(scriptPath)} && node ${path.basename(scriptPath)}`,
      install_command: hasPlaywright ? null : 'npm install playwright',
      browser_install_command: 'npx playwright install chromium',
      download_url: `/api/sessions/download-script/${scriptId}`,
      instructions: [
        '1. Playwright가 설치되지 않았다면: npm install playwright',
        '2. 브라우저 설치: npx playwright install chromium',
        '3. 스크립트 실행: node ' + path.basename(scriptPath),
        '4. 실행 로그는 execution_' + scriptId + '.log에서 확인 가능'
      ],
      note: 'Playwright 스크립트가 생성되었습니다. 위 순서대로 설치 및 실행하세요.'
    };
  } catch (error) {
    throw new Error('스크립트 생성 중 오류: ' + error.message);
  }
}

// Download generated Playwright script
app.get('/api/sessions/download-script/:scriptId', (req, res) => {
  try {
    const { scriptId } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, '../data', `replay_${scriptId}.js`);
    
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({
        error: '스크립트 파일을 찾을 수 없습니다',
        script_id: scriptId
      });
    }
    
    const filename = `airis_session_replay_${scriptId}.js`;
    
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Description', 'AIRIS Session Replay Playwright Script');
    
    const fileStream = fs.createReadStream(scriptPath);
    fileStream.pipe(res);
    
  } catch (error) {
    logger.error('스크립트 다운로드 오류', {
      error: error.message,
      scriptId: req.params.scriptId
    });
    
    res.status(500).json({
      error: '스크립트 다운로드 실패',
      message: error.message
    });
  }
});

// Get execution log for script
app.get('/api/sessions/execution-log/:scriptId', (req, res) => {
  try {
    const { scriptId } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    const logPath = path.join(__dirname, '../data', `execution_${scriptId}.log`);
    
    if (!fs.existsSync(logPath)) {
      return res.json({
        success: true,
        log_exists: false,
        message: '실행 로그가 없습니다. 스크립트가 실행되지 않았거나 실행 중입니다.',
        script_id: scriptId
      });
    }
    
    const logContent = fs.readFileSync(logPath, 'utf8');
    
    res.json({
      success: true,
      log_exists: true,
      log_content: logContent,
      script_id: scriptId,
      korean_message: '실행 로그를 성공적으로 가져왔습니다'
    });
    
  } catch (error) {
    logger.error('실행 로그 조회 오류', {
      error: error.message,
      scriptId: req.params.scriptId
    });
    
    res.status(500).json({
      error: '실행 로그 조회 실패',
      message: error.message
    });
  }
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
    // const ClickHouseService = require('./services/ClickHouseService');
    // const clickhouseService = new ClickHouseService();
    // await clickhouseService.connect();
    
    const services = {
      // clickhouse: clickhouseService,
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