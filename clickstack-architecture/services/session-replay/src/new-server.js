#!/usr/bin/env node

/**
 * Session Replay Service Server with rrweb + Playwright Integration
 * Express.js server for the Session Replay Service
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const logger = require('./utils/logger');

// 서비스 클래스들 import
const SessionRecordingService = require('./services/SessionRecordingService');
const PlaywrightConverterService = require('./services/PlaywrightConverterService');
const PlaywrightExecutorService = require('./services/PlaywrightExecutorService');

const app = express();
const port = process.env.PORT || 3004;

// 서비스 인스턴스 생성
const recordingService = new SessionRecordingService();
const converterService = new PlaywrightConverterService();
const executorService = new PlaywrightExecutorService();

// 기본 미들웨어
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// 정적 파일 제공 (테스트용 레코더 페이지)
app.use('/static', express.static(path.join(__dirname, '../public')));

// 파일 업로드 설정
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// ===== 헬스 체크 =====
app.get('/health', (req, res) => {
  res.json({
    status: '정상',
    service: 'Session Replay Service',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    korean_time: new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date()),
    features: {
      'rrweb Recording': '✅ 활성화',
      'Playwright Conversion': '✅ 활성화',
      'Replay Execution': '✅ 활성화'
    },
    message: '📽️ 세션 리플레이 서비스가 성공적으로 시작되었습니다!'
  });
});

// ===== 세션 기록 API =====

// 새 세션 기록 시작
app.post('/api/v1/sessions/start', async (req, res) => {
  try {
    const sessionInfo = req.body;
    const sessionId = await recordingService.startRecording(sessionInfo);
    
    res.json({
      success: true,
      sessionId,
      message: '세션 기록이 시작되었습니다'
    });
  } catch (error) {
    logger.error('세션 시작 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 세션 이벤트 추가
app.post('/api/v1/sessions/:sessionId/events', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { events } = req.body;

    await recordingService.addEvents(sessionId, events);

    res.json({
      success: true,
      message: '이벤트가 추가되었습니다'
    });
  } catch (error) {
    logger.error('이벤트 추가 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 세션 기록 종료
app.post('/api/v1/sessions/:sessionId/stop', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await recordingService.stopRecording(sessionId);

    res.json({
      success: true,
      session,
      message: '세션 기록이 종료되었습니다'
    });
  } catch (error) {
    logger.error('세션 종료 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 세션 목록 조회
app.get('/api/v1/sessions', async (req, res) => {
  try {
    const filters = req.query;
    const sessions = await recordingService.getSessionList(filters);

    res.json({
      success: true,
      sessions,
      total: sessions.length
    });
  } catch (error) {
    logger.error('세션 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 세션 상세 조회
app.get('/api/v1/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await recordingService.getSession(sessionId);

    res.json({
      success: true,
      session
    });
  } catch (error) {
    logger.error('세션 조회 실패:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// 세션 삭제
app.delete('/api/v1/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await recordingService.deleteSession(sessionId);

    res.json({
      success: true,
      message: '세션이 삭제되었습니다'
    });
  } catch (error) {
    logger.error('세션 삭제 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== Playwright 변환 API =====

// 세션을 Playwright 스크립트로 변환
app.post('/api/v1/sessions/:sessionId/convert', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const options = req.body || {};

    // 세션 데이터 조회
    const sessionData = await recordingService.getSession(sessionId);
    
    // Playwright 스크립트로 변환
    const scriptInfo = await converterService.convertSession(sessionData, options);

    res.json({
      success: true,
      script: scriptInfo,
      message: 'Playwright 스크립트가 생성되었습니다'
    });
  } catch (error) {
    logger.error('스크립트 변환 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Playwright 스크립트 조회
app.get('/api/v1/scripts/:scriptId', async (req, res) => {
  try {
    const { scriptId } = req.params;
    const script = await converterService.getScript(scriptId);

    res.json({
      success: true,
      script
    });
  } catch (error) {
    logger.error('스크립트 조회 실패:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Playwright 스크립트 다운로드
app.get('/api/v1/scripts/:scriptId/download', async (req, res) => {
  try {
    const { scriptId } = req.params;
    const script = await converterService.getScript(scriptId);

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', `attachment; filename="${script.fileName}"`);
    res.send(script.content);
  } catch (error) {
    logger.error('스크립트 다운로드 실패:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// ===== Playwright 실행 API =====

// Playwright 스크립트 실행
app.post('/api/v1/scripts/:scriptId/execute', async (req, res) => {
  try {
    const { scriptId } = req.params;
    const options = req.body || {};

    // 스크립트 파일 경로 조회
    const script = await converterService.getScript(scriptId);
    const scriptPath = path.join(process.cwd(), 'playwright-scripts', script.fileName);

    // 실행
    const executionId = await executorService.executeScript(scriptPath, options);

    res.json({
      success: true,
      executionId,
      message: 'Playwright 스크립트 실행이 시작되었습니다'
    });
  } catch (error) {
    logger.error('스크립트 실행 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 실행 상태 조회
app.get('/api/v1/executions/:executionId', (req, res) => {
  try {
    const { executionId } = req.params;
    const execution = executorService.getExecution(executionId);

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: '실행을 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      execution
    });
  } catch (error) {
    logger.error('실행 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 실행 목록 조회
app.get('/api/v1/executions', (req, res) => {
  try {
    const executions = executorService.getAllExecutions();

    res.json({
      success: true,
      executions,
      total: executions.length
    });
  } catch (error) {
    logger.error('실행 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 실행 중지
app.post('/api/v1/executions/:executionId/stop', async (req, res) => {
  try {
    const { executionId } = req.params;
    const execution = await executorService.stopExecution(executionId);

    res.json({
      success: true,
      execution,
      message: '실행이 중지되었습니다'
    });
  } catch (error) {
    logger.error('실행 중지 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 실행 로그 조회
app.get('/api/v1/executions/:executionId/logs', (req, res) => {
  try {
    const { executionId } = req.params;
    const logs = executorService.getExecutionLogs(executionId);

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    logger.error('실행 로그 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 실행 아티팩트 다운로드 (스크린샷, 비디오 등)
app.get('/api/v1/executions/:executionId/artifacts/:type/:fileName', (req, res) => {
  try {
    const { executionId, type, fileName } = req.params;
    const filePath = executorService.getArtifactPath(executionId, type, fileName);

    res.download(filePath, fileName);
  } catch (error) {
    logger.error('아티팩트 다운로드 실패:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// ===== 통계 API =====

// 세션 통계
app.get('/api/v1/stats/sessions', async (req, res) => {
  try {
    const stats = await recordingService.getStatistics();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('세션 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 실행 통계
app.get('/api/v1/stats/executions', (req, res) => {
  try {
    const stats = executorService.getExecutionStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('실행 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== 관리 API =====

// 정리 작업
app.post('/api/v1/admin/cleanup', async (req, res) => {
  try {
    const { maxAge = 24 * 60 * 60 * 1000 } = req.body; // 기본 24시간
    
    const deletedExecutions = await executorService.cleanup(maxAge);

    res.json({
      success: true,
      deletedExecutions,
      message: `${deletedExecutions}개 실행 기록이 정리되었습니다`
    });
  } catch (error) {
    logger.error('정리 작업 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 에러 핸들러
app.use((error, req, res, next) => {
  logger.error('서버 오류:', error);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: '서버 내부 오류가 발생했습니다'
  });
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: '요청한 리소스를 찾을 수 없습니다'
  });
});

app.listen(port, '0.0.0.0', () => {
  logger.info('세션 리플레이 서비스가 성공적으로 시작되었습니다', {
    port: port,
    service: 'session-replay',
    version: '2.0.0',
    features: ['rrweb Recording', 'Playwright Conversion', 'Replay Execution'],
    status: '정상'
  });
});

module.exports = app;