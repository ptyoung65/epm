#!/usr/bin/env node

const express = require('express');
const logger = require('./utils/logger');

const app = express();
const port = process.env.PORT || 3000;

// 기본 미들웨어
app.use(express.json());

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({
    status: '정상',
    service: 'Session Replay Service',
    version: '1.0.0',
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
    message: '📽️ 세션 리플레이 서비스가 성공적으로 시작되었습니다!'
  });
});

// API 상태  
app.get('/api/v1/status', (req, res) => {
  res.json({
    system: '정상',
    features: {
      'Session Recording': '✅ 준비됨',
      'User Behavior Analysis': '✅ 활성화됨',
      'Replay Engine': '✅ 정상'
    },
    korean_time: new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul'
    }).format(new Date())
  });
});

app.listen(port, '0.0.0.0', () => {
  logger.info('세션 리플레이 서비스가 성공적으로 시작되었습니다', {
    port: port,
    service: 'session-replay',
    status: '정상'
  });
});

module.exports = app;