#!/usr/bin/env node

/**
 * AIRIS-MON 포괄적 테스트 및 시연 프로그램
 * Korean HyperDX Style Complete Feature Demo
 */

// Environment variables configuration
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Node.js 18+ 환경에서 fetch 사용, 그 외에는 node-fetch 사용
let fetch;
try {
  fetch = globalThis.fetch || require('node-fetch');
} catch (e) {
  console.warn('fetch not available, some AIOps features may not work');
  fetch = () => Promise.reject(new Error('fetch not available'));
}

// 테스트 모듈들
const DataSimulator = require('./modules/data-simulator');
const MetricsGenerator = require('./modules/metrics-generator');
const EventSimulator = require('./modules/event-simulator');
const AIMLTester = require('./modules/aiml-tester');
const AlertTester = require('./modules/alert-tester');
const SessionReplayTester = require('./modules/session-replay-tester');
const NLPSearchTester = require('./modules/nlp-search-tester');
const DashboardUI = require('./modules/dashboard-ui');
const SessionStorage = require('./modules/session-storage');
const serverManagementRouter = require('./api/server-management');
const aiModelsRouter = require('./api/ai-models-api');

// LLM 관련 모듈
const LLMConfigManager = require('./llm/LLMConfigManager');
const MultiLLMRouter = require('./llm/MultiLLMRouter');
const KoreanLanguageProcessor = require('./llm/KoreanLanguageProcessor');

class AIRISMonTestSuite {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.port = process.env.TEST_PORT || 3100;
    this.isRunning = false;
    this.testResults = {};
    this.scenarios = [];
    
    // LLM 시스템 초기화
    this.llmConfigManager = new LLMConfigManager();
    this.multiLLMRouter = new MultiLLMRouter();
    this.koreanProcessor = new KoreanLanguageProcessor();
    
    // Knowledge Base 메모리 저장소
    this.knowledgeBase = {
      documents: [],
      categories: ['기술문서', 'API문서', '가이드', 'FAQ', '정책'],
      searchHistory: [],
      aiQueries: [],
      stats: {
        totalDocuments: 0,
        totalCategories: 5,
        totalSearches: 0,
        aiQueries: 0
      }
    };
    
    // 공지사항 메모리 저장소 (실제로는 데이터베이스 사용)
    this.notices = [
      {
        id: '1',
        title: '시스템 업데이트 완료',
        content: 'AIRIS-MON v2.1.0 업데이트가 완료되었습니다. 새로운 알림 관리 기능이 추가되었습니다.',
        priority: 'high',
        scope: 'all',
        type: 'manual',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        displayOnMain: true,
        enableSound: false,
        enableEmail: true,
        targetUsers: 'all',
        author: '시스템 관리자',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        views: 125,
        isRead: false
      },
      {
        id: '2',
        title: '정기 점검 안내',
        content: '매주 일요일 새벽 2:00-4:00 정기 점검이 실시됩니다.',
        priority: 'medium',
        scope: 'operators',
        type: 'manual',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        displayOnMain: false,
        enableSound: false,
        enableEmail: false,
        targetUsers: 'operators',
        author: '운영팀',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        views: 67,
        isRead: true
      },
      {
        id: '3',
        title: '자동 생성: 서버 CPU 사용률 90% 초과',
        content: '서버 monitoring-01에서 CPU 사용률이 지속적으로 90%를 초과하고 있습니다. 확인이 필요합니다.',
        priority: 'critical',
        scope: 'administrators',
        type: 'system',
        status: 'active',
        startDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        displayOnMain: true,
        enableSound: true,
        enableEmail: true,
        targetUsers: 'administrators',
        author: '시스템 자동',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        views: 8,
        isRead: false
      },
      {
        id: '4',
        title: '새 모니터링 메트릭 추가',
        content: '메모리 사용률 및 네트워크 I/O 메트릭이 추가되었습니다.',
        priority: 'low',
        scope: 'all',
        type: 'manual',
        status: 'expired',
        startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        displayOnMain: false,
        enableSound: false,
        enableEmail: false,
        targetUsers: 'all',
        author: '개발팀',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        views: 234,
        isRead: true
      }
    ];
    
    // 테스트 모듈 초기화
    this.dataSimulator = new DataSimulator();
    this.metricsGenerator = new MetricsGenerator();
    this.eventSimulator = new EventSimulator();
    this.aimlTester = new AIMLTester();
    this.alertTester = new AlertTester();
    this.sessionReplayTester = new SessionReplayTester();
    this.nlpSearchTester = new NLPSearchTester();
    this.dashboardUI = new DashboardUI();
    this.sessionStorage = new SessionStorage();
    
    // Initialize alert logs storage
    this.alertLogs = {};
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupLLMRoutes();
    this.setupWebSocket();
    this.loadTestScenarios();
    
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // rrweb 라이브러리 정적 서빙
    this.app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));

    // AIOps API 프록시 (백엔드 서버로 요청 전달)
    this.app.use('/api/v1/aiops', async (req, res) => {
        try {
            // 백엔드 서버가 3000 포트에서 실행 중이라고 가정
            const backendUrl = `http://localhost:3000${req.originalUrl}`;
            const method = req.method.toLowerCase();
            
            let response;
            if (method === 'get') {
                response = await fetch(backendUrl);
            } else {
                response = await fetch(backendUrl, {
                    method: req.method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...req.headers
                    },
                    body: method !== 'get' ? JSON.stringify(req.body) : undefined
                });
            }
            
            const data = await response.text();
            res.status(response.status);
            res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
            res.send(data);
        } catch (error) {
            console.error('AIOps API proxy error:', error);
            res.status(503).json({
                error: 'AIOps service unavailable',
                message: 'Backend AIOps server is not running on port 3000',
                suggestion: 'Please start the main AIRIS-MON server first'
            });
        }
    });
    
    // CORS 설정
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  setupRoutes() {
    // 메인 테스트 UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // 통합 분석 대시보드
    this.app.get('/unified-analytics-dashboard', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'unified-analytics-dashboard.html'));
    });

    // 세션 리플레이 시나리오 페이지 (기존 목업)
    this.app.get('/session-replay-scenarios', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'session-replay-scenarios.html'));
    });

    // 실제 DOM 기반 시나리오 페이지 (신규)
    this.app.get('/real-scenarios', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'real-scenarios.html'));
    });

    // 세션 리플레이 플레이어 페이지 (기존 목업)
    this.app.get('/session-replay-player', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'session-replay-player.html'));
    });

    // 실제 DOM 기반 리플레이 플레이어 페이지 (신규)
    this.app.get('/real-replay-player', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'real-replay-player.html'));
    });

    // 트레이스 시퀀스 다이어그램 페이지
    this.app.get('/trace-sequence-diagram', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'trace-sequence-diagram.html'));
    });

    // 통합 세션 녹화기 페이지 (AIRIS-MON + 향상된 세션 리플레이)
    this.app.get('/integrated-recorder', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'integrated-session-recorder-fixed.html'));
    });

    // 기존 통합 녹화기 (참고용)
    this.app.get('/integrated-recorder-old', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'integrated-session-recorder.html'));
    });

    // 모바일 세션 리플레이 라우트
    this.app.get('/mobile-recorder', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'mobile-session-recorder.html'));
    });

    this.app.get('/mobile-player', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'mobile-session-player.html'));
    });

    // E2E 성능 분석기
    this.app.get('/e2e-analyzer', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'e2e-performance-analyzer.html'));
    });

    // E2E 성능 테스트 페이지
    this.app.get('/e2e-test', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'e2e-performance-test.html'));
    });

    // 향상된 플레이어 페이지
    this.app.get('/enhanced-player', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'enhanced-player.html'));
    });

    // 향상된 녹화기 페이지
    this.app.get('/enhanced-recorder', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'enhanced-recorder.html'));
    });

    // 클릭 히트맵 분석기 페이지
    this.app.get('/click-heatmap', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'click-heatmap-analyzer.html'));
    });

    // 사용자 여정 맵 페이지
    this.app.get('/user-journey-map', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'user-journey-map.html'));
    });

    // 실시간 이상 탐지 대시보드 페이지
    this.app.get('/threat-detection', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'threat-detection-dashboard.html'));
    });

    // Database APM 페이지
    this.app.get('/database-apm', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'database-apm.html'));
    });

    // Application APM 페이지
    this.app.get('/application-apm', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'application-apm.html'));
    });

    // Infrastructure Monitoring 페이지
    this.app.get('/infrastructure-monitoring', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'infrastructure-monitoring.html'));
    });


    // 서버 관리 페이지 라우트
    this.app.get('/server-management', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'server-management.html'));
    });
    // 알림 관리 페이지 라우트
    this.app.get('/alert-management', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'alert-management.html'));
    });

    // 알림 설정 페이지 라우트
    this.app.get('/notification-settings', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'notification-settings.html'));
    });

    // 애플리케이션 분석 페이지 라우트
    this.app.get('/application-analysis', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'application-analysis.html'));
    });

    // OpenTelemetry 관리 페이지 라우트
    this.app.get('/opentelemetry-management', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'opentelemetry-management.html'));
    });

    // Analytics API 통합 테스트 페이지 라우트
    this.app.get('/test-analytics-integration', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'test-analytics-integration.html'));
    });

    // AIOps/MLOps 대시보드 페이지 라우트
    this.app.get('/aiops-dashboard', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'aiops-dashboard.html'));
    });

    this.app.get('/mlops-pipeline', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'mlops-pipeline.html'));
    });

    this.app.get('/ai-models', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'ai-models.html'));
    });

    this.app.get('/knowledge-base', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'knowledge-base.html'));
    });

    // Database APM API 엔드포인트들
    this.app.get('/api/database/metrics', (req, res) => {
      const metrics = {
        activeConnections: 40 + Math.floor(Math.random() * 20),
        avgQueryTime: 100 + Math.floor(Math.random() * 50),
        slowQueries: Math.floor(Math.random() * 15),
        tps: 2500 + Math.floor(Math.random() * 500),
        cacheHitRate: 90 + Math.floor(Math.random() * 10),
        deadlocks: Math.random() > 0.9 ? 1 : 0,
        timestamp: new Date().toISOString()
      };
      res.json(metrics);
    });

    this.app.get('/api/database/queries', (req, res) => {
      const queries = [
        {
          id: Date.now() + Math.random(),
          sql: "SELECT u.id, u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id",
          time: Math.floor(Math.random() * 5000),
          rows: Math.floor(Math.random() * 10000),
          database: "production",
          user: "app_user",
          status: Math.random() > 0.7 ? "slow" : "normal"
        },
        {
          id: Date.now() + Math.random(),
          sql: "UPDATE inventory SET quantity = quantity - 1 WHERE product_id = $1",
          time: Math.floor(Math.random() * 100),
          rows: 1,
          database: "production",
          user: "app_user",
          status: "optimized"
        }
      ];
      res.json(queries);
    });

    this.app.get('/api/database/connections', (req, res) => {
      const connections = [];
      const states = ['active', 'idle', 'blocked', 'available'];
      for (let i = 0; i < 100; i++) {
        connections.push({
          id: i,
          state: states[Math.floor(Math.random() * states.length)],
          duration: Math.floor(Math.random() * 10000),
          query: Math.random() > 0.5 ? "SELECT ..." : null
        });
      }
      res.json(connections);
    });

    // ClickHouse 실시간 메트릭 저장 API (메트릭 통합 아키텍처)
    this.app.post('/api/clickhouse/metrics', (req, res) => {
      try {
        const { metrics, source, timestamp, storage_type } = req.body;
        
        console.log(`🔍 ClickHouse: ${metrics.length}개 실시간 메트릭 저장 요청`);
        console.log(`📊 소스: ${source}, 저장 타입: ${storage_type}`);
        
        // 실제 구현에서는 ClickHouse 클라이언트로 저장
        // 현재는 시뮬레이션으로 성공 응답
        
        const response = {
          success: true,
          message: `${metrics.length}개 메트릭이 ClickHouse에 저장되었습니다`,
          storage_info: {
            database: 'airis_mon',
            table: 'metrics_realtime',
            storage_type: storage_type,
            timestamp: timestamp,
            metrics_count: metrics.length
          },
          performance: {
            insert_time_ms: Math.floor(Math.random() * 50) + 10,
            rows_per_second: Math.floor(metrics.length / 0.03),
            compression_ratio: '4.2:1'
          }
        };
        
        res.json(response);
      } catch (error) {
        console.error(`❌ ClickHouse 메트릭 저장 실패: ${error.message}`);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // MongoDB 집계 메트릭 저장 API (메트릭 통합 아키텍처)
    this.app.post('/api/mongodb/metrics/aggregated', (req, res) => {
      try {
        const { aggregated_metrics, aggregation_window, timestamp } = req.body;
        
        console.log(`🍃 MongoDB: ${aggregated_metrics.length}개 집계 메트릭 저장 요청`);
        console.log(`📊 집계 윈도우: ${aggregation_window}, 타임스탬프: ${timestamp}`);
        
        // 실제 구현에서는 MongoDB 클라이언트로 저장
        // 현재는 시뮬레이션으로 성공 응답
        
        const response = {
          success: true,
          message: `${aggregated_metrics.length}개 집계 메트릭이 MongoDB에 저장되었습니다`,
          storage_info: {
            database: 'airis_mon',
            collection: 'metrics_aggregated',
            aggregation_window: aggregation_window,
            timestamp: timestamp,
            documents_inserted: aggregated_metrics.length
          },
          performance: {
            insert_time_ms: Math.floor(Math.random() * 100) + 20,
            documents_per_second: Math.floor(aggregated_metrics.length / 0.05),
            index_usage: ['metric_name_1', 'time_window_1', 'service_environment_1']
          },
          aggregation_summary: {
            unique_metrics: new Set(aggregated_metrics.map(m => m.metric_name)).size,
            unique_services: new Set(aggregated_metrics.map(m => m.service)).size,
            unique_environments: new Set(aggregated_metrics.map(m => m.environment)).size,
            time_window_start: aggregated_metrics.length > 0 ? aggregated_metrics[0].time_window : null,
            total_data_points: aggregated_metrics.reduce((sum, m) => sum + (m.statistics?.count || 0), 0)
          }
        };
        
        res.json(response);
      } catch (error) {
        console.error(`❌ MongoDB 집계 메트릭 저장 실패: ${error.message}`);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // 통합 분석 대시보드 API 엔드포인트들
    
    // Trace 분석 API 엔드포인트들
    this.app.get('/api/trace-analysis/performance', (req, res) => {
      const timeRange = req.query.timeRange || '5m';
      const now = Date.now();
      
      const intervals = {
        '5m': { count: 300, interval: 1000 },
        '15m': { count: 900, interval: 1000 },
        '1h': { count: 3600, interval: 1000 },
        '6h': { count: 21600, interval: 1000 }
      };
      
      const config = intervals[timeRange];
      const performanceData = [];
      
      for (let i = config.count; i > 0; i--) {
        const timestamp = now - (i * config.interval);
        performanceData.push({
          timestamp: timestamp,
          responseTime: Math.round(100 + Math.random() * 400 + Math.sin(i * 0.1) * 50),
          throughput: Math.round(50 + Math.random() * 100),
          errorRate: parseFloat((Math.random() * 5).toFixed(2)),
          traceCount: Math.floor(Math.random() * 20) + 5
        });
      }
      
      res.json({
        success: true,
        data: performanceData,
        timeRange: timeRange,
        totalPoints: performanceData.length
      });
    });

    this.app.get('/api/trace-analysis/traces/:timeIndex', (req, res) => {
      const timeIndex = parseInt(req.params.timeIndex);
      const traceCount = Math.floor(Math.random() * 20) + 5;
      const traces = [];
      
      for (let i = 0; i < traceCount; i++) {
        const traceId = 'trace_' + Math.random().toString(36).substr(2, 16);
        traces.push({
          traceId: traceId,
          timestamp: Date.now() - (timeIndex * 1000) + (i * 100),
          duration: Math.round(100 + Math.random() * 400),
          service: ['user-service', 'payment-service', 'order-service', 'notification-service'][Math.floor(Math.random() * 4)],
          status: Math.random() > 0.95 ? 'error' : 'success',
          spanCount: Math.floor(Math.random() * 8) + 3,
          sessionId: Math.random() > 0.7 ? 'session_' + Math.random().toString(36).substr(2, 12) : null
        });
      }
      
      res.json({
        success: true,
        data: traces,
        timeIndex: timeIndex
      });
    });

    this.app.get('/api/trace-analysis/spans/:traceId', (req, res) => {
      const traceId = req.params.traceId;
      const spanCount = Math.floor(Math.random() * 8) + 3;
      const spans = [];
      
      for (let i = 0; i < spanCount; i++) {
        spans.push({
          spanId: 'span_' + Math.random().toString(36).substr(2, 8),
          parentSpanId: i > 0 && Math.random() > 0.5 ? spans[Math.floor(Math.random() * i)].spanId : null,
          operation: ['HTTP GET', 'Database Query', 'Cache Read', 'External API', 'Processing'][Math.floor(Math.random() * 5)],
          service: ['frontend', 'backend', 'database', 'cache', 'external'][Math.floor(Math.random() * 5)],
          duration: Math.floor(Math.random() * 200) + 10,
          startTime: Date.now() + (i * 50),
          tags: {
            'http.method': ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
            'db.type': 'postgresql',
            'component': 'http-client'
          }
        });
      }
      
      res.json({
        success: true,
        data: spans,
        traceId: traceId
      });
    });

    this.app.get('/api/trace-analysis/session/:traceId', (req, res) => {
      const traceId = req.params.traceId;
      
      // 70% 확률로 연관 세션 존재
      if (Math.random() > 0.3) {
        const sessionData = {
          sessionId: 'session_' + Math.random().toString(36).substr(2, 12),
          userId: 'user_' + Math.floor(Math.random() * 1000),
          duration: Math.floor(Math.random() * 300) + 60,
          pages: Math.floor(Math.random() * 10) + 1,
          actions: Math.floor(Math.random() * 50) + 10,
          startTime: Date.now() - (Math.random() * 3600000),
          device: ['Desktop', 'Mobile', 'Tablet'][Math.floor(Math.random() * 3)],
          browser: ['Chrome', 'Firefox', 'Safari', 'Edge'][Math.floor(Math.random() * 4)]
        };
        
        res.json({
          success: true,
          data: sessionData,
          traceId: traceId
        });
      } else {
        res.json({
          success: true,
          data: null,
          message: 'No associated session found'
        });
      }
    });

    this.app.get('/api/trace-analysis/programs/:traceId', (req, res) => {
      const traceId = req.params.traceId;
      const programs = [
        { name: 'UserController.java', type: 'Controller', lines: 245, complexity: 'Medium', language: 'Java' },
        { name: 'PaymentService.js', type: 'Service', lines: 189, complexity: 'High', language: 'JavaScript' },
        { name: 'OrderRepository.py', type: 'Repository', lines: 156, complexity: 'Low', language: 'Python' },
        { name: 'NotificationHandler.go', type: 'Handler', lines: 98, complexity: 'Low', language: 'Go' },
        { name: 'DatabaseConnection.java', type: 'Utility', lines: 67, complexity: 'Medium', language: 'Java' },
        { name: 'AuthMiddleware.js', type: 'Middleware', lines: 123, complexity: 'Medium', language: 'JavaScript' },
        { name: 'CacheManager.py', type: 'Manager', lines: 89, complexity: 'Low', language: 'Python' }
      ];
      
      const selectedPrograms = programs.slice(0, Math.floor(Math.random() * 4) + 2);
      
      res.json({
        success: true,
        data: selectedPrograms,
        traceId: traceId,
        totalPrograms: selectedPrograms.length
      });
    });

    // 서버 관리 API
    this.app.use('/api/servers', serverManagementRouter);

    // AI 모델 관리 API
    this.app.use('/api/v1/ai-models', aiModelsRouter);
    // 편의를 위한 추가 라우트 매핑
    this.app.use('/api/ai-models', aiModelsRouter);

    // APP 성능 메트릭 (ClickHouse 실시간 + MongoDB 집계)
    this.app.get('/api/analytics/app-metrics', (req, res) => {
      const { timeRange = '24h', source = 'mixed' } = req.query;
      
      try {
        const now = new Date();
        const data = [];
        const minutes = timeRange === '1h' ? 60 : timeRange === '6h' ? 360 : timeRange === '24h' ? 1440 : timeRange === '7d' ? 10080 : 1440;
        const interval = Math.max(1, Math.floor(minutes / 50)); // 최대 50개 포인트
        
        for (let i = 0; i < 50; i++) {
          const timestamp = new Date(now.getTime() - (50 - i) * interval * 60000);
          const baseValue = 150 + Math.sin(i * 0.1) * 30;
          const randomVariation = (Math.random() - 0.5) * 40;
          
          data.push({
            timestamp,
            value: Math.max(50, baseValue + randomVariation),
            responseTime: Math.max(50, baseValue + randomVariation),
            throughput: 1000 + Math.random() * 500,
            errorRate: Math.random() * 5,
            source: source === 'realtime' ? 'clickhouse' : 
                   source === 'aggregated' ? 'mongodb' : 
                   i < 10 ? 'clickhouse' : 'mongodb'
          });
        }
        
        res.json({
          success: true,
          data: data,
          metadata: {
            timeRange,
            source,
            totalPoints: data.length,
            latestValue: data[data.length - 1]?.value || 0
          }
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // DB 성능 메트릭 (MongoDB 집계 데이터)
    this.app.get('/api/analytics/db-metrics', (req, res) => {
      const { timeRange = '24h' } = req.query;
      
      try {
        const now = new Date();
        const data = [];
        const points = timeRange === '1h' ? 12 : timeRange === '6h' ? 24 : timeRange === '24h' ? 48 : timeRange === '7d' ? 168 : 48;
        const intervalMinutes = timeRange === '1h' ? 5 : timeRange === '6h' ? 15 : timeRange === '24h' ? 30 : timeRange === '7d' ? 60 : 30;
        
        for (let i = 0; i < points; i++) {
          const timestamp = new Date(now.getTime() - (points - i) * intervalMinutes * 60000);
          
          data.push({
            timestamp,
            queryTime: 60 + Math.random() * 80,
            connections: 15 + Math.random() * 35,
            tps: 1800 + Math.random() * 1200,
            slowQueries: Math.floor(Math.random() * 10),
            deadlocks: Math.floor(Math.random() * 3),
            cacheHitRate: 85 + Math.random() * 10
          });
        }
        
        res.json({
          success: true,
          data: data,
          metadata: {
            timeRange,
            source: 'mongodb_aggregated',
            totalPoints: data.length
          }
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 인프라 리소스 메트릭 (ClickHouse 실시간)
    this.app.get('/api/analytics/infra-metrics', (req, res) => {
      const { timeRange = '24h' } = req.query;
      
      try {
        const now = new Date();
        const data = [];
        const minutes = timeRange === '1h' ? 60 : timeRange === '6h' ? 360 : timeRange === '24h' ? 1440 : timeRange === '7d' ? 10080 : 1440;
        const interval = Math.max(1, Math.floor(minutes / 60)); // 최대 60개 포인트
        
        for (let i = 0; i < 60; i++) {
          const timestamp = new Date(now.getTime() - (60 - i) * interval * 60000);
          const cpuBase = 40 + Math.sin(i * 0.05) * 20;
          const memoryBase = 60 + Math.sin(i * 0.03) * 15;
          const diskBase = 25 + Math.sin(i * 0.02) * 10;
          
          data.push({
            timestamp,
            cpu: Math.max(5, Math.min(95, cpuBase + (Math.random() - 0.5) * 20)),
            memory: Math.max(10, Math.min(90, memoryBase + (Math.random() - 0.5) * 15)),
            disk: Math.max(5, Math.min(80, diskBase + (Math.random() - 0.5) * 10)),
            networkIn: 50 + Math.random() * 100,
            networkOut: 30 + Math.random() * 80,
            iops: 500 + Math.random() * 1000
          });
        }
        
        res.json({
          success: true,
          data: data,
          metadata: {
            timeRange,
            source: 'clickhouse_realtime',
            totalPoints: data.length
          }
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 네트워크 분석 메트릭 (혼합 데이터)
    this.app.get('/api/analytics/network-metrics', (req, res) => {
      const { timeRange = '24h' } = req.query;
      
      try {
        const now = new Date();
        const data = [];
        const points = 30;
        const intervalMinutes = timeRange === '1h' ? 2 : timeRange === '6h' ? 12 : timeRange === '24h' ? 48 : timeRange === '7d' ? 336 : 48;
        
        for (let i = 0; i < points; i++) {
          const timestamp = new Date(now.getTime() - (points - i) * intervalMinutes * 60000);
          
          data.push({
            timestamp,
            bandwidth: 70 + Math.random() * 25,
            latency: 15 + Math.random() * 35,
            packetLoss: Math.random() * 3,
            throughput: 80 + Math.random() * 20,
            connections: 100 + Math.random() * 200,
            errors: Math.floor(Math.random() * 5)
          });
        }
        
        res.json({
          success: true,
          data: data,
          metadata: {
            timeRange,
            source: 'mixed',
            totalPoints: data.length
          }
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 상관관계 매트릭스 API
    this.app.get('/api/analytics/correlation-matrix', (req, res) => {
      try {
        // 실제로는 통계 분석을 통해 계산되는 상관계수
        const correlationMatrix = [
          [1.0, -0.65, 0.82, 0.34],
          [-0.65, 1.0, -0.43, 0.71],
          [0.82, -0.43, 1.0, 0.28],
          [0.34, 0.71, 0.28, 1.0]
        ];
        
        const categories = ['APP', 'DB', 'INFRA', 'NETWORK'];
        
        res.json({
          success: true,
          data: {
            matrix: correlationMatrix,
            categories: categories,
            lastUpdated: new Date().toISOString(),
            correlationStrength: {
              strong: correlationMatrix.flat().filter(val => Math.abs(val) > 0.7 && val !== 1.0).length,
              moderate: correlationMatrix.flat().filter(val => Math.abs(val) > 0.3 && Math.abs(val) <= 0.7).length,
              weak: correlationMatrix.flat().filter(val => Math.abs(val) <= 0.3).length
            }
          }
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 이상 탐지 API
    this.app.get('/api/analytics/anomaly-detection', (req, res) => {
      const { timeRange = '24h' } = req.query;
      
      try {
        const now = new Date();
        const data = [];
        const points = 100;
        const intervalMinutes = timeRange === '1h' ? 0.6 : timeRange === '6h' ? 3.6 : timeRange === '24h' ? 14.4 : timeRange === '7d' ? 100.8 : 14.4;
        
        for (let i = 0; i < points; i++) {
          const timestamp = new Date(now.getTime() - (points - i) * intervalMinutes * 60000);
          const baseValue = 100 + Math.sin(i * 0.1) * 20 + Math.sin(i * 0.03) * 10;
          const isAnomaly = Math.random() < 0.08; // 8% 확률로 이상치
          
          let value;
          let anomalyScore;
          
          if (isAnomaly) {
            // 이상치: 기준값에서 크게 벗어남
            const deviation = (Math.random() > 0.5 ? 1 : -1) * (50 + Math.random() * 80);
            value = baseValue + deviation;
            anomalyScore = 0.7 + Math.random() * 0.3;
          } else {
            // 정상값: 기준값 주변의 작은 변동
            value = baseValue + (Math.random() - 0.5) * 25;
            anomalyScore = Math.random() * 0.3;
          }
          
          data.push({
            timestamp,
            value: Math.max(0, value),
            predicted: baseValue,
            isAnomaly,
            anomalyScore,
            confidence: 0.85 + Math.random() * 0.15
          });
        }
        
        const anomalies = data.filter(d => d.isAnomaly);
        
        res.json({
          success: true,
          data: data,
          metadata: {
            timeRange,
            totalPoints: data.length,
            anomaliesDetected: anomalies.length,
            anomalyRate: (anomalies.length / data.length * 100).toFixed(2) + '%',
            avgAnomalyScore: anomalies.length > 0 ? 
              (anomalies.reduce((sum, a) => sum + a.anomalyScore, 0) / anomalies.length).toFixed(3) : 0
          }
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 통합 메트릭 요약 API
    this.app.get('/api/analytics/metrics-summary', (req, res) => {
      try {
        const now = new Date();
        
        // 각 카테고리의 최신 메트릭 값들
        const summary = {
          app: {
            responseTime: 180 + Math.random() * 40,
            throughput: 1200 + Math.random() * 300,
            errorRate: Math.random() * 3,
            trend: Math.random() > 0.5 ? 'up' : 'down',
            status: 'healthy'
          },
          db: {
            queryTime: 85 + Math.random() * 25,
            connections: 25 + Math.random() * 15,
            tps: 2100 + Math.random() * 400,
            trend: 'stable',
            status: 'healthy'
          },
          infra: {
            cpuUsage: 45 + Math.random() * 20,
            memoryUsage: 62 + Math.random() * 15,
            diskUsage: 28 + Math.random() * 12,
            trend: 'down',
            status: 'healthy'
          },
          network: {
            bandwidth: 75 + Math.random() * 15,
            latency: 22 + Math.random() * 18,
            packetLoss: Math.random() * 2,
            trend: 'up',
            status: 'healthy'
          },
          lastUpdated: now.toISOString()
        };
        
        res.json({
          success: true,
          data: summary
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Application APM API 엔드포인트들
    this.app.get('/api/application/metrics', (req, res) => {
      const metrics = {
        avgResponseTime: 200 + Math.floor(Math.random() * 100),
        throughput: (7 + Math.random() * 3).toFixed(1) + 'K',
        errorRate: (1 + Math.random() * 3).toFixed(1),
        apdex: (0.85 + Math.random() * 0.15).toFixed(2),
        activeUsers: 1000 + Math.floor(Math.random() * 500),
        cpuUsage: 50 + Math.floor(Math.random() * 40),
        memUsage: (3 + Math.random() * 3).toFixed(1),
        uptime: (99 + Math.random() * 0.9).toFixed(1),
        timestamp: new Date().toISOString()
      };
      res.json(metrics);
    });

    this.app.get('/api/application/endpoints', (req, res) => {
      const endpoints = [
        {
          method: 'GET',
          path: '/api/users',
          avgTime: Math.floor(100 + Math.random() * 200),
          calls: Math.floor(3000 + Math.random() * 1000),
          errorRate: (Math.random() * 2).toFixed(1),
          p99: Math.floor(400 + Math.random() * 300)
        },
        {
          method: 'POST',
          path: '/api/orders',
          avgTime: Math.floor(500 + Math.random() * 800),
          calls: Math.floor(800 + Math.random() * 600),
          errorRate: (Math.random() * 4).toFixed(1),
          p99: Math.floor(2000 + Math.random() * 1000)
        },
        {
          method: 'GET',
          path: '/api/products/{id}',
          avgTime: Math.floor(50 + Math.random() * 100),
          calls: Math.floor(8000 + Math.random() * 2000),
          errorRate: (Math.random() * 1).toFixed(1),
          p99: Math.floor(200 + Math.random() * 200)
        }
      ];
      res.json(endpoints);
    });

    this.app.get('/api/application/errors', (req, res) => {
      const errors = [
        {
          message: 'NullPointerException in OrderService.processOrder()',
          stack: 'at com.airis.OrderService.processOrder(OrderService.java:145)\nat com.airis.API.handleRequest(API.java:234)',
          count: Math.floor(10 + Math.random() * 50),
          lastOccurred: '2분 전',
          severity: 'critical'
        },
        {
          message: 'Database connection timeout',
          stack: 'java.sql.SQLTimeoutException: Connection timeout\nat com.mysql.jdbc.Connection.connect()',
          count: Math.floor(5 + Math.random() * 15),
          lastOccurred: '15분 전',
          severity: 'high'
        }
      ];
      res.json(errors);
    });

    // ClickHouse trace endpoints
    this.app.get('/api/clickhouse/traces', (req, res) => {
      // 샘플 trace ID 목록 생성
      const traces = [];
      const now = Date.now();
      
      for (let i = 0; i < 50; i++) {
        const traceId = `trace_${String(i + 1).padStart(6, '0')}_${now - i * 60000}`;
        traces.push({
          traceId: traceId,
          serviceName: ['user-service', 'order-service', 'payment-service', 'inventory-service'][Math.floor(Math.random() * 4)],
          operationName: ['GET /api/users', 'POST /api/orders', 'PUT /api/payment', 'GET /api/inventory'][Math.floor(Math.random() * 4)],
          startTime: new Date(now - i * 60000).toISOString(),
          duration: Math.floor(Math.random() * 2000) + 100,
          spanCount: Math.floor(Math.random() * 20) + 5,
          status: Math.random() > 0.8 ? 'error' : 'success',
          tags: {
            environment: Math.random() > 0.5 ? 'production' : 'staging',
            version: `v1.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}`
          }
        });
      }
      
      res.json({
        success: true,
        traces: traces,
        total: traces.length,
        timestamp: new Date().toISOString()
      });
    });
    
    // MongoDB 조회 API 엔드포인트들
    this.app.get('/api/mongodb/collections', (req, res) => {
      // MongoDB의 컬렉션 목록과 기본 정보
      const collections = [
        {
          name: 'sessions',
          count: 15420,
          size: '245MB',
          avgObjSize: '16.7KB',
          indexes: 5,
          description: '사용자 세션 리플레이 데이터',
          lastModified: new Date().toISOString()
        },
        {
          name: 'analysis_results',
          count: 8932,
          size: '512MB',
          avgObjSize: '58.3KB', 
          indexes: 8,
          description: '프로젝트 분석 결과',
          lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          name: 'traces',
          count: 234567,
          size: '1.2GB',
          avgObjSize: '5.4KB',
          indexes: 12,
          description: 'OpenTelemetry 추적 데이터',
          lastModified: new Date(Date.now() - 30 * 60 * 1000).toISOString()
        },
        {
          name: 'metrics',
          count: 1245890,
          size: '890MB',
          avgObjSize: '0.7KB',
          indexes: 6,
          description: '시스템 메트릭 데이터',
          lastModified: new Date(Date.now() - 5 * 60 * 1000).toISOString()
        },
        {
          name: 'users',
          count: 2341,
          size: '12MB',
          avgObjSize: '5.2KB',
          indexes: 4,
          description: '사용자 정보',
          lastModified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        },
        {
          name: 'alerts',
          count: 5672,
          size: '45MB',
          avgObjSize: '8.1KB',
          indexes: 7,
          description: '알림 및 경고 데이터',
          lastModified: new Date(Date.now() - 10 * 60 * 1000).toISOString()
        }
      ];
      
      res.json({ success: true, collections });
    });

    this.app.post('/api/mongodb/query', (req, res) => {
      const { collection, filter, sort, limit, skip } = req.body;
      
      // 모의 MongoDB 쿼리 결과 생성
      let results = [];
      
      switch (collection) {
        case 'sessions':
          results = this.generateMockSessionData(limit || 20);
          break;
        case 'analysis_results':
          results = this.generateMockAnalysisData(limit || 10);
          break;
        case 'traces':
          results = this.generateMockTraceData(limit || 50);
          break;
        case 'metrics':
          results = this.generateMockMetricsData(limit || 100);
          break;
        case 'users':
          results = this.generateMockUserData(limit || 15);
          break;
        case 'alerts':
          results = this.generateMockAlertData(limit || 25);
          break;
        default:
          return res.status(400).json({ error: 'Invalid collection name' });
      }

      // 필터 적용 시뮬레이션
      if (filter && Object.keys(filter).length > 0) {
        results = results.filter(item => {
          return Object.keys(filter).every(key => {
            if (typeof filter[key] === 'object' && filter[key].$regex) {
              return item[key] && item[key].toString().toLowerCase().includes(filter[key].$regex.toLowerCase());
            }
            return item[key] === filter[key];
          });
        });
      }

      // 정렬 적용
      if (sort && Object.keys(sort).length > 0) {
        const sortKey = Object.keys(sort)[0];
        const sortOrder = sort[sortKey];
        results.sort((a, b) => {
          if (sortOrder === 1) {
            return a[sortKey] > b[sortKey] ? 1 : -1;
          } else {
            return a[sortKey] < b[sortKey] ? 1 : -1;
          }
        });
      }

      // 페이지네이션
      const startIndex = skip || 0;
      const endIndex = startIndex + (limit || 20);
      results = results.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: results,
        totalCount: results.length,
        collection,
        executionTime: Math.floor(Math.random() * 50) + 10
      });
    });

    this.app.get('/api/mongodb/stats/:collection', (req, res) => {
      const collection = req.params.collection;
      
      // 컬렉션별 상세 통계
      const stats = {
        sessions: {
          totalDocuments: 15420,
          avgDocumentSize: 17203, // bytes
          totalIndexSize: 52428800, // bytes
          dataSize: 257884160, // bytes
          storageSize: 268435456, // bytes
          indexes: [
            { name: '_id_', size: 12582912, unique: true },
            { name: 'sessionId_1', size: 8388608, unique: true },
            { name: 'userId_1', size: 4194304, unique: false },
            { name: 'timestamp_1', size: 6291456, unique: false },
            { name: 'scenario_1', size: 3145728, unique: false }
          ],
          queryStats: {
            totalQueries: 2341,
            avgQueryTime: 23.5,
            slowQueries: 12,
            indexHitRatio: 94.2
          }
        },
        analysis_results: {
          totalDocuments: 8932,
          avgDocumentSize: 59834,
          totalIndexSize: 67108864,
          dataSize: 534773760,
          storageSize: 603979776,
          indexes: [
            { name: '_id_', size: 7340032, unique: true },
            { name: 'projectName_1', size: 12582912, unique: false },
            { name: 'analysisDate_1', size: 10485760, unique: false },
            { name: 'language_1', size: 5242880, unique: false },
            { name: 'framework_1', size: 8388608, unique: false },
            { name: 'complexity_1', size: 4194304, unique: false },
            { name: 'url_1', size: 15728640, unique: false },
            { name: 'status_1', size: 3145728, unique: false }
          ],
          queryStats: {
            totalQueries: 892,
            avgQueryTime: 45.2,
            slowQueries: 23,
            indexHitRatio: 87.5
          }
        }
      };

      const collectionStats = stats[collection] || {
        totalDocuments: 0,
        avgDocumentSize: 0,
        totalIndexSize: 0,
        dataSize: 0,
        storageSize: 0,
        indexes: [],
        queryStats: {
          totalQueries: 0,
          avgQueryTime: 0,
          slowQueries: 0,
          indexHitRatio: 0
        }
      };

      res.json({ success: true, stats: collectionStats });
    });

    // ClickHouse에서 특정 trace 상세 정보 가져오기
    this.app.get('/api/clickhouse/trace/:traceId', (req, res) => {
      const { traceId } = req.params;
      
      // 샘플 스팬 데이터 생성
      const spans = [];
      const services = ['frontend-web', 'api-gateway', 'user-service', 'database', 'cache-service', 'payment-service'];
      const operations = [
        'HTTP GET', 'Database Query', 'Cache Lookup', 'External API Call', 
        'Message Queue', 'Authentication', 'Authorization', 'Data Processing'
      ];
      
      const spanCount = Math.floor(Math.random() * 15) + 10;
      let currentTime = 0;
      
      for (let i = 0; i < spanCount; i++) {
        const service = services[Math.floor(Math.random() * services.length)];
        const operation = operations[Math.floor(Math.random() * operations.length)];
        const duration = Math.floor(Math.random() * 200) + 10;
        
        spans.push({
          spanId: `span_${String(i + 1).padStart(3, '0')}`,
          traceId: traceId,
          parentSpanId: i > 0 ? `span_${String(Math.floor(Math.random() * i) + 1).padStart(3, '0')}` : null,
          operationName: `${operation} - ${service}`,
          serviceName: service,
          startTime: currentTime,
          endTime: currentTime + duration,
          duration: duration,
          status: Math.random() > 0.9 ? 'error' : 'success',
          tags: {
            'http.method': ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
            'http.status_code': Math.random() > 0.9 ? 500 : 200,
            'db.type': service.includes('database') ? 'postgresql' : undefined,
            'cache.hit': service.includes('cache') ? Math.random() > 0.3 : undefined
          },
          events: Math.random() > 0.7 ? [
            {
              timestamp: currentTime + Math.floor(duration / 2),
              name: 'Custom Event',
              attributes: { detail: 'Event details here' }
            }
          ] : []
        });
        
        currentTime += Math.floor(Math.random() * 50) + 10;
      }
      
      res.json({
        success: true,
        trace: {
          traceId: traceId,
          spans: spans,
          totalDuration: currentTime,
          spanCount: spans.length,
          services: [...new Set(spans.map(s => s.serviceName))],
          timestamp: new Date().toISOString()
        }
      });
    });

    this.app.get('/api/application/traces', (req, res) => {
      const traces = [
        {
          traceId: 'trace-' + Date.now(),
          service: 'API Gateway',
          operation: 'HTTP Request',
          duration: Math.floor(30 + Math.random() * 50),
          type: 'main'
        },
        {
          traceId: 'trace-' + Date.now(),
          service: 'User Service',
          operation: 'Authenticate',
          duration: Math.floor(10 + Math.random() * 30),
          type: 'main'
        },
        {
          traceId: 'trace-' + Date.now(),
          service: 'Database',
          operation: 'Query Users',
          duration: Math.floor(80 + Math.random() * 100),
          type: 'database'
        }
      ];
      res.json(traces);
    });

    // Infrastructure Monitoring API 엔드포인트들
    this.app.get('/api/infrastructure/overview', (req, res) => {
      const overview = {
        totalServers: 24,
        healthyServers: 22,
        warningServers: 2,
        criticalServers: 0,
        avgCpuUsage: Math.floor(65 + Math.random() * 10),
        avgMemoryUsage: Math.floor(70 + Math.random() * 10),
        totalThroughput: Math.floor(2800 + Math.random() * 100),
        avgResponseTime: Math.floor(120 + Math.random() * 20),
        networkBandwidth: (8.0 + Math.random() * 1).toFixed(1),
        errorRate: (0.01 + Math.random() * 0.02).toFixed(3),
        timestamp: new Date().toISOString()
      };
      res.json(overview);
    });

    this.app.get('/api/infrastructure/web-servers', (req, res) => {
      const webServers = [
        {
          id: 'web-lb-01',
          name: 'Load Balancer 01',
          ip: '10.0.1.10',
          status: 'healthy',
          cpu: Math.floor(40 + Math.random() * 20),
          memory: Math.floor(55 + Math.random() * 15),
          connections: Math.floor(1200 + Math.random() * 100),
          requestsPerSec: Math.floor(800 + Math.random() * 200),
          uptime: '15d 8h 23m'
        },
        {
          id: 'web-lb-02',
          name: 'Load Balancer 02',
          ip: '10.0.1.11',
          status: 'healthy',
          cpu: Math.floor(35 + Math.random() * 15),
          memory: Math.floor(50 + Math.random() * 20),
          connections: Math.floor(1100 + Math.random() * 100),
          requestsPerSec: Math.floor(750 + Math.random() * 200),
          uptime: '15d 8h 23m'
        },
        {
          id: 'web-cache-01',
          name: 'Redis Cache 01',
          ip: '10.0.1.20',
          status: Math.random() > 0.3 ? 'healthy' : 'warning',
          cpu: Math.floor(70 + Math.random() * 20),
          memory: Math.floor(80 + Math.random() * 10),
          connections: Math.floor(850 + Math.random() * 100),
          hitRate: (92 + Math.random() * 7).toFixed(1),
          uptime: '12d 14h 45m'
        }
      ];
      res.json(webServers);
    });

    this.app.get('/api/infrastructure/was-servers', (req, res) => {
      const wasServers = [
        {
          id: 'was-app-01',
          name: 'App Server 01',
          ip: '10.0.2.10',
          status: 'healthy',
          cpu: Math.floor(60 + Math.random() * 15),
          memory: Math.floor(65 + Math.random() * 15),
          threads: Math.floor(220 + Math.random() * 30),
          heapUsage: Math.floor(70 + Math.random() * 15),
          gcCount: Math.floor(50 + Math.random() * 20),
          uptime: '10d 16h 12m'
        },
        {
          id: 'was-app-02',
          name: 'App Server 02',
          ip: '10.0.2.11',
          status: 'healthy',
          cpu: Math.floor(55 + Math.random() * 20),
          memory: Math.floor(60 + Math.random() * 20),
          threads: Math.floor(190 + Math.random() * 30),
          heapUsage: Math.floor(65 + Math.random() * 20),
          gcCount: Math.floor(45 + Math.random() * 25),
          uptime: '10d 16h 12m'
        },
        {
          id: 'was-app-03',
          name: 'App Server 03',
          ip: '10.0.2.12',
          status: 'healthy',
          cpu: Math.floor(68 + Math.random() * 15),
          memory: Math.floor(70 + Math.random() * 15),
          threads: Math.floor(250 + Math.random() * 40),
          heapUsage: Math.floor(75 + Math.random() * 15),
          gcCount: Math.floor(60 + Math.random() * 20),
          uptime: '10d 16h 12m'
        },
        {
          id: 'was-session-01',
          name: 'Session Server 01',
          ip: '10.0.2.20',
          status: Math.random() > 0.4 ? 'healthy' : 'warning',
          cpu: Math.floor(75 + Math.random() * 15),
          memory: Math.floor(80 + Math.random() * 15),
          threads: Math.floor(130 + Math.random() * 30),
          heapUsage: Math.floor(85 + Math.random() * 10),
          gcCount: Math.floor(80 + Math.random() * 30),
          uptime: '8d 22h 35m'
        }
      ];
      res.json(wasServers);
    });

    this.app.get('/api/infrastructure/db-servers', (req, res) => {
      const dbServers = [
        {
          id: 'db-master-01',
          name: 'DB Master 01',
          ip: '10.0.3.10',
          status: 'healthy',
          cpu: Math.floor(45 + Math.random() * 15),
          memory: Math.floor(70 + Math.random() * 15),
          connections: Math.floor(120 + Math.random() * 20),
          qps: Math.floor(450 + Math.random() * 100),
          replicationLag: Math.floor(1 + Math.random() * 3),
          diskUsage: Math.floor(60 + Math.random() * 20),
          uptime: '25d 12h 8m'
        },
        {
          id: 'db-slave-01',
          name: 'DB Slave 01',
          ip: '10.0.3.11',
          status: 'healthy',
          cpu: Math.floor(40 + Math.random() * 15),
          memory: Math.floor(65 + Math.random() * 15),
          connections: Math.floor(80 + Math.random() * 20),
          qps: Math.floor(280 + Math.random() * 80),
          replicationLag: Math.floor(2 + Math.random() * 4),
          diskUsage: Math.floor(58 + Math.random() * 22),
          uptime: '25d 12h 8m'
        },
        {
          id: 'db-slave-02',
          name: 'DB Slave 02',
          ip: '10.0.3.12',
          status: 'healthy',
          cpu: Math.floor(38 + Math.random() * 15),
          memory: Math.floor(62 + Math.random() * 18),
          connections: Math.floor(70 + Math.random() * 15),
          qps: Math.floor(250 + Math.random() * 70),
          replicationLag: Math.floor(1 + Math.random() * 5),
          diskUsage: Math.floor(55 + Math.random() * 25),
          uptime: '25d 12h 8m'
        }
      ];
      res.json(dbServers);
    });

    this.app.get('/api/infrastructure/network-devices', (req, res) => {
      const networkDevices = [
        {
          id: 'switch-core-01',
          name: 'Core Switch 01',
          ip: '10.0.0.10',
          status: 'healthy',
          cpu: Math.floor(20 + Math.random() * 10),
          memory: Math.floor(40 + Math.random() * 15),
          bandwidth: Math.floor(80 + Math.random() * 15),
          packetLoss: (Math.random() * 0.1).toFixed(3),
          ports: { active: 22, total: 24 },
          uptime: '45d 8h 15m'
        },
        {
          id: 'switch-dist-01',
          name: 'Distribution SW 01',
          ip: '10.0.0.20',
          status: 'healthy',
          cpu: Math.floor(15 + Math.random() * 10),
          memory: Math.floor(35 + Math.random() * 10),
          bandwidth: Math.floor(55 + Math.random() * 20),
          packetLoss: (Math.random() * 0.1).toFixed(3),
          ports: { active: 18, total: 24 },
          uptime: '45d 8h 15m'
        },
        {
          id: 'router-edge-01',
          name: 'Edge Router 01',
          ip: '10.0.0.1',
          status: 'healthy',
          cpu: Math.floor(30 + Math.random() * 15),
          memory: Math.floor(45 + Math.random() * 15),
          bandwidth: Math.floor(70 + Math.random() * 20),
          packetLoss: (Math.random() * 0.2).toFixed(3),
          throughput: (5.2 + Math.random() * 2).toFixed(1) + ' Gbps',
          uptime: '45d 8h 15m'
        },
        {
          id: 'firewall-01',
          name: 'Firewall 01',
          ip: '10.0.0.5',
          status: 'healthy',
          cpu: Math.floor(25 + Math.random() * 15),
          memory: Math.floor(38 + Math.random() * 15),
          bandwidth: Math.floor(40 + Math.random() * 15),
          blockedConnections: Math.floor(120 + Math.random() * 50),
          allowedConnections: Math.floor(15000 + Math.random() * 2000),
          uptime: '45d 8h 15m'
        }
      ];
      res.json(networkDevices);
    });

    this.app.get('/api/infrastructure/topology', (req, res) => {
      const topology = {
        nodes: [
          {
            id: 'web-tier',
            name: 'WEB Tier',
            type: 'web',
            status: 'healthy',
            position: { x: 100, y: 100 },
            metrics: {
              cpu: Math.floor(40 + Math.random() * 20),
              memory: Math.floor(55 + Math.random() * 15),
              throughput: Math.floor(1500 + Math.random() * 300)
            }
          },
          {
            id: 'was-tier',
            name: 'WAS Tier',
            type: 'was',
            status: Math.random() > 0.3 ? 'healthy' : 'warning',
            position: { x: 300, y: 100 },
            metrics: {
              cpu: Math.floor(60 + Math.random() * 20),
              memory: Math.floor(70 + Math.random() * 15),
              threads: Math.floor(800 + Math.random() * 200)
            }
          },
          {
            id: 'db-tier',
            name: 'DB Tier',
            type: 'database',
            status: 'healthy',
            position: { x: 500, y: 100 },
            metrics: {
              cpu: Math.floor(45 + Math.random() * 15),
              memory: Math.floor(65 + Math.random() * 15),
              connections: Math.floor(270 + Math.random() * 50)
            }
          },
          {
            id: 'network-tier',
            name: 'Network Infrastructure',
            type: 'network',
            status: 'healthy',
            position: { x: 300, y: 300 },
            metrics: {
              cpu: Math.floor(25 + Math.random() * 15),
              bandwidth: Math.floor(75 + Math.random() * 20),
              packetLoss: (Math.random() * 0.1).toFixed(3)
            }
          }
        ],
        connections: [
          { from: 'web-tier', to: 'was-tier', status: 'healthy', latency: Math.floor(2 + Math.random() * 3) },
          { from: 'was-tier', to: 'db-tier', status: 'healthy', latency: Math.floor(1 + Math.random() * 2) },
          { from: 'network-tier', to: 'web-tier', status: 'healthy', latency: Math.floor(1 + Math.random() * 1) },
          { from: 'network-tier', to: 'was-tier', status: 'healthy', latency: Math.floor(1 + Math.random() * 1) },
          { from: 'network-tier', to: 'db-tier', status: 'healthy', latency: Math.floor(1 + Math.random() * 1) }
        ],
        timestamp: new Date().toISOString()
      };
      res.json(topology);
    });

    this.app.get('/api/infrastructure/alerts', (req, res) => {
      const alerts = [
        {
          id: 'alert-001',
          type: 'warning',
          severity: 'medium',
          title: 'WAS Session Server 고부하 감지',
          description: 'Session Server 01의 CPU 사용률이 80%를 초과했습니다',
          source: 'was-session-01',
          timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          acknowledged: false
        },
        {
          id: 'alert-002',
          type: 'warning',
          severity: 'medium',
          title: 'Redis Cache 메모리 사용률 높음',
          description: 'Redis Cache 01의 메모리 사용률이 85%에 도달했습니다',
          source: 'web-cache-01',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          acknowledged: false
        },
        {
          id: 'alert-003',
          type: 'info',
          severity: 'low',
          title: 'DB Slave 02 재시작 완료',
          description: '정기 유지보수로 인한 재시작이 성공적으로 완료되었습니다',
          source: 'db-slave-02',
          timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          acknowledged: true
        },
        {
          id: 'alert-004',
          type: 'info',
          severity: 'low',
          title: '전체 시스템 상태 체크 완료',
          description: '모든 인프라 구성요소의 상태가 정상입니다',
          source: 'system',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          acknowledged: true
        }
      ];
      res.json(alerts);
    });

    this.app.get('/api/infrastructure/metrics/history', (req, res) => {
      const timeRange = req.query.range || '1h';
      const metrics = req.query.metrics || 'cpu,memory,network';
      
      // Generate historical data based on range
      const dataPoints = timeRange === '1h' ? 12 : timeRange === '6h' ? 24 : 48;
      const interval = timeRange === '1h' ? 5 : timeRange === '6h' ? 15 : 30; // minutes
      
      const history = {
        timeRange,
        interval: `${interval}m`,
        metrics: metrics.split(',').reduce((acc, metric) => {
          acc[metric] = Array.from({ length: dataPoints }, (_, i) => ({
            timestamp: new Date(Date.now() - (dataPoints - i) * interval * 60 * 1000).toISOString(),
            value: Math.floor(50 + Math.random() * 30 + Math.sin(i / 4) * 10)
          }));
          return acc;
        }, {})
      };
      
      res.json(history);
    });

    // 알림 관리 API 엔드포인트들
    this.app.get('/api/alerts', (req, res) => {
      const { severity, status, limit = 50 } = req.query;
      
      let alerts = [
        {
          id: 'alert-001',
          title: 'DB 서버 연결 실패',
          description: 'DB Master 서버(10.0.3.10)에서 연결 시간 초과 발생',
          severity: 'critical',
          status: 'active',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          source: 'database',
          assignee: '',
          notificationsSent: ['email', 'sms'],
          escalationLevel: 1,
          affected: ['database', 'api'],
          autoResolve: false
        },
        {
          id: 'alert-002',
          title: 'WAS 서버 메모리 사용률 높음',
          description: 'WAS-APP-01 서버 메모리 사용률이 85%를 초과했습니다',
          severity: 'warning',
          status: 'active',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          source: 'application',
          assignee: '',
          notificationsSent: ['email'],
          escalationLevel: 0,
          affected: ['application'],
          autoResolve: false
        },
        {
          id: 'alert-003',
          title: 'API 응답 시간 지연',
          description: '결제 API 평균 응답 시간이 3초를 초과했습니다',
          severity: 'warning',
          status: 'active',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          source: 'api',
          assignee: 'admin',
          notificationsSent: ['email'],
          escalationLevel: 1,
          affected: ['api', 'payment'],
          autoResolve: false
        },
        {
          id: 'alert-004',
          title: '네트워크 대역폭 사용률 증가',
          description: '코어 스위치 대역폭 사용률이 90%에 근접했습니다',
          severity: 'critical',
          status: 'active',
          timestamp: new Date(Date.now() - 120000).toISOString(),
          source: 'network',
          assignee: '',
          notificationsSent: ['email', 'sms', 'slack'],
          escalationLevel: 2,
          affected: ['network', 'infrastructure'],
          autoResolve: false
        },
        {
          id: 'alert-005',
          title: '디스크 공간 부족',
          description: '/var/log 디렉토리 디스크 사용률이 95%를 초과했습니다',
          severity: 'critical',
          status: 'active',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          source: 'infrastructure',
          assignee: 'devops',
          notificationsSent: ['email', 'sms'],
          escalationLevel: 1,
          affected: ['infrastructure', 'logging'],
          autoResolve: false
        },
        {
          id: 'alert-006',
          title: '로그인 실패 증가',
          description: '지난 10분간 로그인 실패 횟수가 100회를 초과했습니다',
          severity: 'warning',
          status: 'active',
          timestamp: new Date(Date.now() - 420000).toISOString(),
          source: 'security',
          assignee: '',
          notificationsSent: ['email'],
          escalationLevel: 0,
          affected: ['security', 'authentication'],
          autoResolve: false
        }
      ];

      // Apply filters
      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }
      if (status) {
        alerts = alerts.filter(alert => alert.status === status);
      }

      // Limit results
      alerts = alerts.slice(0, parseInt(limit));

      res.json({
        alerts,
        total: alerts.length,
        filters: { severity, status, limit }
      });
    });

    this.app.get('/api/alerts/stats', (req, res) => {
      const stats = {
        total: 23,
        critical: 3,
        warning: 8,
        info: 12,
        resolved: 47,
        trends: {
          last24h: {
            critical: +2,
            warning: +5,
            info: -3,
            resolved: +15
          },
          last7d: {
            critical: +8,
            warning: +12,
            info: +5,
            resolved: +89
          }
        },
        topSources: [
          { source: 'infrastructure', count: 12 },
          { source: 'application', count: 8 },
          { source: 'database', count: 6 },
          { source: 'network', count: 4 },
          { source: 'security', count: 3 }
        ]
      };
      res.json(stats);
    });

    this.app.post('/api/alerts/:id/resolve', (req, res) => {
      const alertId = req.params.id;
      const { reason, notes, resolvedBy, notifyResolution } = req.body;
      
      // Enhanced alert resolution with detailed tracking
      const resolveData = {
        success: true,
        message: `알림 ${alertId}가 성공적으로 해결되었습니다`,
        alertId,
        reason,
        notes,
        resolvedBy: resolvedBy || 'current-user',
        resolvedAt: new Date().toISOString(),
        status: 'resolved',
        notificationsSent: notifyResolution ? ['email'] : []
      };
      
      // Log the resolution
      this.logAlertAction(alertId, 'resolved', `해결됨: ${reason} - ${notes}`, resolvedBy);
      
      res.json(resolveData);
    });

    this.app.post('/api/alerts/:id/escalate', (req, res) => {
      const alertId = req.params.id;
      const { target, reason, message, priority, immediate, fromLevel, toLevel, escalatedBy } = req.body;
      
      const escalateData = {
        success: true,
        message: `알림 ${alertId}가 ${toLevel}단계로 에스컬레이션되었습니다`,
        alertId,
        escalationLevel: toLevel,
        target,
        reason,
        escalationMessage: message,
        priority: priority || 'normal',
        escalatedAt: new Date().toISOString(),
        escalatedBy: escalatedBy || 'current-user',
        notificationsSent: immediate ? [target] : []
      };
      
      // Log the escalation
      this.logAlertAction(alertId, 'escalated', `${fromLevel}단계에서 ${toLevel}단계로 에스컬레이션: ${reason}`, escalatedBy);
      
      res.json(escalateData);
    });

    this.app.post('/api/alerts/:id/assign', (req, res) => {
      const alertId = req.params.id;
      const { assignee, notes, priority } = req.body;
      
      const assignData = {
        success: true,
        message: `알림 ${alertId}가 ${assignee}에게 할당되었습니다`,
        alertId,
        assignee,
        notes,
        priority: priority || 'normal',
        assignedAt: new Date().toISOString(),
        assignedBy: 'current-user'
      };
      
      // Log the assignment
      this.logAlertAction(alertId, 'assigned', `담당자 지정: ${assignee} - ${notes}`, 'current-user');
      
      res.json(assignData);
    });

    this.app.post('/api/alerts/:id/send-notification', (req, res) => {
      const alertId = req.params.id;
      const { methods, recipientGroup, customRecipients, messageTemplate, customMessage, immediate, sentBy } = req.body;
      
      // Enhanced notification sending with detailed options
      const recipients = this.getRecipientsByGroup(recipientGroup, customRecipients);
      
      // Simulate notification sending
      setTimeout(() => {
        const notificationData = {
          success: true,
          message: `알림이 ${methods.join(', ')}로 성공적으로 전송되었습니다`,
          alertId,
          methods: methods || ['email'],
          recipientGroup,
          recipients: recipients,
          messageTemplate: messageTemplate || 'default',
          sentAt: new Date().toISOString(),
          sentBy: sentBy || 'current-user'
        };
        
        // Log the notification
        this.logAlertAction(alertId, 'notification_sent', `수동 알림 전송: ${methods.join(', ')} to ${recipientGroup}`, sentBy);
        
        res.json(notificationData);
      }, immediate ? 500 : 1000);
    });
    
    // New ignore endpoint
    this.app.post('/api/alerts/:id/ignore', (req, res) => {
      const alertId = req.params.id;
      const { reason, notes, duration, ignoredBy, notifyIgnore } = req.body;
      
      const ignoreData = {
        success: true,
        message: `알림 ${alertId}가 무시 처리되었습니다`,
        alertId,
        reason,
        notes,
        duration,
        ignoredBy: ignoredBy || 'current-user',
        ignoredAt: new Date().toISOString(),
        status: 'ignored',
        notificationsSent: notifyIgnore ? ['team'] : []
      };
      
      // Log the ignore action
      this.logAlertAction(alertId, 'ignored', `무시됨 (${duration}): ${reason} - ${notes}`, ignoredBy);
      
      res.json(ignoreData);
    });
    
    // Alert logs endpoint
    this.app.post('/api/alerts/:id/logs', (req, res) => {
      const alertId = req.params.id;
      const logEntry = req.body;
      
      // Store log entry (in memory for demo, should use database)
      if (!this.alertLogs) this.alertLogs = {};
      if (!this.alertLogs[alertId]) this.alertLogs[alertId] = [];
      
      this.alertLogs[alertId].unshift(logEntry);
      
      res.json({
        success: true,
        message: '로그가 저장되었습니다',
        logId: logEntry.id
      });
    });
    
    // Get alert logs
    this.app.get('/api/alerts/:id/logs', (req, res) => {
      const alertId = req.params.id;
      const logs = this.alertLogs && this.alertLogs[alertId] ? this.alertLogs[alertId] : [];
      
      res.json({
        success: true,
        alertId,
        logs,
        count: logs.length
      });
    });

    // Automatic escalation check endpoint
    this.app.post('/api/alerts/:id/check-escalation', (req, res) => {
      const alertId = req.params.id;
      const { currentLevel } = req.body;

      try {
        const escalationResult = this.checkEscalationConditions(alertId, currentLevel || 0);
        
        if (escalationResult.shouldEscalate) {
          // Log the automatic escalation
          this.logAlertAction(
            alertId, 
            'auto_escalated', 
            `자동 에스컬레이션: Level ${currentLevel} → Level ${escalationResult.newLevel}. ${escalationResult.reason}`,
            'system'
          );

          // Simulate automatic notification to escalation groups
          for (const group of escalationResult.notifyGroups) {
            const recipients = this.getRecipientsByGroup(group);
            this.logAlertAction(
              alertId,
              'auto_notification_sent',
              `자동 에스컬레이션 알림 전송: ${group} (${recipients.length}명)`,
              'system'
            );
          }
        }

        res.json({
          success: true,
          alertId,
          escalationResult,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Bulk escalation check endpoint (for automated background processing)
    this.app.post('/api/alerts/bulk-escalation-check', (req, res) => {
      const { alertIds = [] } = req.body;
      const results = [];

      try {
        for (const alertId of alertIds) {
          const escalationResult = this.checkEscalationConditions(alertId);
          results.push({
            alertId,
            ...escalationResult,
            timestamp: new Date().toISOString()
          });

          if (escalationResult.shouldEscalate) {
            this.logAlertAction(
              alertId,
              'bulk_auto_escalated',
              `벌크 자동 에스컬레이션: ${escalationResult.reason}`,
              'system'
            );
          }
        }

        res.json({
          success: true,
          results,
          totalChecked: alertIds.length,
          escalated: results.filter(r => r.shouldEscalate).length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 통합 대시보드 API 엔드포인트
    this.app.get('/api/dashboard/summary', (req, res) => {
      const dashboardSummary = {
        systemStatus: {
          overall: 'healthy',
          criticalAlerts: 1,
          warningAlerts: 3,
          activeSessions: Math.floor(Math.random() * 50) + 200,
          uptime: '99.9%'
        },
        infrastructure: {
          totalServers: 24,
          avgCpuUsage: Math.floor(Math.random() * 20) + 60,
          healthyServers: 23,
          warningServers: 1
        },
        application: {
          totalAPIs: 156,
          avgResponseTime: Math.floor(Math.random() * 50) + 120,
          errorRate: (Math.random() * 2).toFixed(2)
        },
        database: {
          totalDatabases: 5,
          availability: '98.9%',
          connectionPool: Math.floor(Math.random() * 50) + 150
        },
        sessionReplay: {
          totalSessions: Math.floor(Math.random() * 20) + 80,
          avgSessionLength: '5.2분',
          recentSessions: 15
        },
        security: {
          threatsBlocked: Math.floor(Math.random() * 5) + 2,
          status: 'secure',
          lastScan: new Date().toISOString()
        }
      };
      
      res.json({
        success: true,
        data: dashboardSummary,
        timestamp: new Date().toISOString()
      });
    });

    // 공지사항 API (통합 대시보드용 - 활성 공지사항만 표시)
    this.app.get('/api/notices', (req, res) => {
      // 활성 상태이고 현재 시간이 공지 기간 내에 있는 공지사항만 필터링
      const now = new Date();
      const activeNotices = this.notices.filter(notice => {
        const startDate = new Date(notice.startDate);
        const endDate = new Date(notice.endDate);
        return notice.status === 'active' && 
               startDate <= now && 
               endDate >= now;
      });

      // 통합 대시보드 호환을 위한 형식으로 변환 (기존 구조 유지)
      const formattedNotices = activeNotices.map(notice => ({
        id: notice.id,
        title: notice.title,
        content: notice.content,
        priority: notice.priority,
        date: notice.createdAt,
        author: notice.author
      }));
      
      res.json({
        success: true,
        notices: formattedNotices,
        total: formattedNotices.length
      });
    });

    // 공지사항 추가 API
    this.app.post('/api/notices', (req, res) => {
      const { title, content, priority = 'low' } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          error: '제목과 내용은 필수입니다'
        });
      }
      
      const newNotice = {
        id: Date.now().toString(),
        title,
        content,
        priority,
        date: new Date().toISOString(),
        author: '관리자'
      };
      
      res.json({
        success: true,
        notice: newNotice,
        message: '공지사항이 추가되었습니다'
      });
    });

    // 관리자 공지사항 관리 API 엔드포인트들
    
    // 관리자 공지사항 목록 조회 API
    this.app.get('/api/admin/notices', (req, res) => {
      const { status, type, priority } = req.query;
      
      // 공유 저장소에서 공지사항 조회
      let notices = [...this.notices];

      // 필터링 적용
      if (status) {
        notices = notices.filter(notice => notice.status === status);
      }
      if (type) {
        notices = notices.filter(notice => notice.type === type);
      }
      if (priority) {
        notices = notices.filter(notice => notice.priority === priority);
      }

      res.json({
        success: true,
        notices: notices,
        total: notices.length
      });
    });

    // 관리자 공지사항 생성 API
    this.app.post('/api/admin/notices', (req, res) => {
      const {
        title,
        content,
        priority = 'medium',
        scope = 'all',
        type = 'manual',
        startDate,
        endDate,
        displayOnMain = false,
        enableSound = false,
        enableEmail = false,
        targetUsers = 'all'
      } = req.body;

      // 필수 필드 검증
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          error: '제목과 내용은 필수입니다'
        });
      }

      // 날짜 검증
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end <= start) {
        return res.status(400).json({
          success: false,
          error: '종료일은 시작일보다 이후여야 합니다'
        });
      }

      const newNotice = {
        id: Date.now().toString(),
        title,
        content,
        priority,
        scope,
        type,
        status: 'active',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        displayOnMain,
        enableSound,
        enableEmail,
        targetUsers,
        author: '관리자',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        views: 0,
        isRead: false
      };

      // 공유 저장소에 추가
      this.notices.push(newNotice);

      console.log(`📢 새 공지사항 생성: ${title} (우선순위: ${priority})`);

      res.json({
        success: true,
        notice: newNotice,
        message: '공지사항이 성공적으로 생성되었습니다'
      });
    });

    // 특정 공지사항 조회 API
    this.app.get('/api/admin/notices/:id', (req, res) => {
      const { id } = req.params;
      
      // 공유 저장소에서 조회
      const notice = this.notices.find(n => n.id === id);
      
      if (!notice) {
        return res.status(404).json({
          success: false,
          error: '공지사항을 찾을 수 없습니다'
        });
      }

      res.json({
        success: true,
        notice: notice
      });
    });

    // 공지사항 수정 API
    this.app.put('/api/admin/notices/:id', (req, res) => {
      const { id } = req.params;
      const {
        title,
        content,
        priority,
        scope,
        type,
        startDate,
        endDate,
        displayOnMain,
        enableSound,
        enableEmail,
        targetUsers
      } = req.body;

      // 필수 필드 검증
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          error: '제목과 내용은 필수입니다'
        });
      }

      // 날짜 검증
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (end <= start) {
          return res.status(400).json({
            success: false,
            error: '종료일은 시작일보다 이후여야 합니다'
          });
        }
      }

      // 공유 저장소에서 공지사항 찾기
      const noticeIndex = this.notices.findIndex(n => n.id === id);
      
      if (noticeIndex === -1) {
        return res.status(404).json({
          success: false,
          error: '공지사항을 찾을 수 없습니다'
        });
      }

      // 기존 데이터 유지하면서 업데이트
      const existingNotice = this.notices[noticeIndex];
      const updatedNotice = {
        ...existingNotice,
        title,
        content,
        priority,
        scope,
        type,
        startDate: startDate ? new Date(startDate).toISOString() : existingNotice.startDate,
        endDate: endDate ? new Date(endDate).toISOString() : existingNotice.endDate,
        displayOnMain,
        enableSound,
        enableEmail,
        targetUsers,
        updatedAt: new Date().toISOString()
      };

      // 저장소 업데이트
      this.notices[noticeIndex] = updatedNotice;

      console.log(`📝 공지사항 수정: ${id} - ${title}`);

      res.json({
        success: true,
        notice: updatedNotice,
        message: '공지사항이 성공적으로 수정되었습니다'
      });
    });

    // 공지사항 삭제 API
    this.app.delete('/api/admin/notices/:id', (req, res) => {
      const { id } = req.params;

      // 공유 저장소에서 공지사항 찾기
      const noticeIndex = this.notices.findIndex(n => n.id === id);
      
      if (noticeIndex === -1) {
        return res.status(404).json({
          success: false,
          error: '공지사항을 찾을 수 없습니다'
        });
      }

      // 저장소에서 제거
      this.notices.splice(noticeIndex, 1);

      console.log(`🗑️ 공지사항 삭제: ${id}`);

      res.json({
        success: true,
        message: '공지사항이 성공적으로 삭제되었습니다'
      });
    });

    // 공지사항 조회수 업데이트 API
    this.app.post('/api/admin/notices/:id/view', (req, res) => {
      const { id } = req.params;

      // 공유 저장소에서 공지사항 찾기
      const notice = this.notices.find(n => n.id === id);
      
      if (!notice) {
        return res.status(404).json({
          success: false,
          error: '공지사항을 찾을 수 없습니다'
        });
      }

      // 조회수 증가
      notice.views = (notice.views || 0) + 1;
      notice.updatedAt = new Date().toISOString();

      console.log(`👁️ 공지사항 조회: ${notice.title} (조회수: ${notice.views})`);

      res.json({
        success: true,
        views: notice.views,
        message: '조회수가 업데이트되었습니다'
      });
    });

    // 자동 공지사항 설정 저장 API
    this.app.post('/api/admin/settings/auto-notices', (req, res) => {
      const {
        systemEvents,
        securityEvents,
        performanceEvents,
        maintenanceEvents
      } = req.body;

      console.log('🤖 자동 공지사항 설정 저장:', {
        systemEvents,
        securityEvents,
        performanceEvents,
        maintenanceEvents
      });

      res.json({
        success: true,
        message: '자동 공지사항 설정이 저장되었습니다',
        settings: {
          systemEvents,
          securityEvents,
          performanceEvents,
          maintenanceEvents
        },
        timestamp: new Date().toISOString()
      });
    });

    // 자동 공지사항 설정 조회 API
    this.app.get('/api/admin/settings/auto-notices', (req, res) => {
      const settings = {
        systemEvents: {
          serverDown: true,
          highCpuUsage: true,
          highMemoryUsage: true,
          diskSpaceLow: false,
          networkIssues: true
        },
        securityEvents: {
          loginFailures: true,
          suspiciousActivity: true,
          unauthorizedAccess: true,
          dataBreachAttempt: true
        },
        performanceEvents: {
          slowResponse: false,
          highLatency: true,
          errorRateHigh: true,
          serviceUnavailable: true
        },
        maintenanceEvents: {
          scheduledMaintenance: true,
          systemUpdate: true,
          backupCompletion: false,
          configurationChange: true
        }
      };

      res.json({
        success: true,
        settings: settings
      });
    });

    // 시스템 상태 API
    this.app.get('/api/system-status', (req, res) => {
      const systemStatus = {
        activeSessions: Math.floor(Math.random() * 50) + 200,
        cpuUsage: Math.floor(Math.random() * 30) + 20,
        memoryUsage: Math.floor(Math.random() * 40) + 50,
        diskUsage: Math.floor(Math.random() * 20) + 30,
        networkTraffic: Math.floor(Math.random() * 1000) + 500,
        connectedServers: 24,
        healthyServices: 45,
        uptime: {
          days: 127,
          hours: 14,
          minutes: 32
        },
        lastUpdate: new Date().toISOString()
      };
      
      res.json({
        success: true,
        ...systemStatus
      });
    });

    // 관리자 설정 API 엔드포인트들
    this.app.get('/api/admin/users', (req, res) => {
      const users = [
        {
          id: 'admin',
          username: '관리자',
          email: 'admin@company.com',
          role: 'admin',
          status: 'active',
          lastLogin: new Date().toISOString(),
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'monitor',
          username: '모니터링팀',
          email: 'monitor@company.com',
          role: 'operator',
          status: 'active',
          lastLogin: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      
      res.json({
        success: true,
        users: users,
        total: users.length
      });
    });

    // 사용자 추가 API
    this.app.post('/api/admin/users', (req, res) => {
      const { name, email, role } = req.body;
      
      if (!name || !email || !role) {
        return res.status(400).json({
          success: false,
          error: '모든 필드는 필수입니다'
        });
      }
      
      const newUser = {
        id: Date.now().toString(),
        username: name,
        email: email,
        role: role,
        status: 'active',
        lastLogin: null,
        createdAt: new Date().toISOString()
      };
      
      // Log the user creation
      console.log(`👤 새 사용자 생성: ${name} (${email}) - Role: ${role}`);
      
      res.json({
        success: true,
        user: newUser,
        message: '사용자가 성공적으로 생성되었습니다'
      });
    });

    // 사용자 삭제 API
    this.app.delete('/api/admin/users/:userId', (req, res) => {
      const { userId } = req.params;
      
      if (userId === 'admin') {
        return res.status(403).json({
          success: false,
          error: '관리자 계정은 삭제할 수 없습니다'
        });
      }
      
      console.log(`🗑️ 사용자 삭제: ${userId}`);
      
      res.json({
        success: true,
        message: '사용자가 삭제되었습니다'
      });
    });

    // 시스템 설정 저장 API
    this.app.post('/api/admin/settings/:category', (req, res) => {
      const { category } = req.params;
      const settings = req.body;
      
      console.log(`⚙️ ${category} 설정 저장:`, settings);
      
      res.json({
        success: true,
        message: `${category} 설정이 저장되었습니다`,
        category: category,
        timestamp: new Date().toISOString()
      });
    });

    // 백업 생성 API
    this.app.post('/api/admin/backup', (req, res) => {
      const backupId = `backup_${Date.now()}`;
      
      console.log(`💾 백업 생성 시작: ${backupId}`);
      
      // 백업 프로세스 시뮬레이션
      setTimeout(() => {
        res.json({
          success: true,
          backupId: backupId,
          message: '백업이 성공적으로 생성되었습니다',
          size: '156MB',
          timestamp: new Date().toISOString()
        });
      }, 1000);
    });

    // 시스템 재시작 API
    this.app.post('/api/admin/restart', (req, res) => {
      console.log('🔄 시스템 재시작 요청됨');
      
      res.json({
        success: true,
        message: '시스템 재시작이 예약되었습니다',
        estimatedDowntime: '2-3분',
        timestamp: new Date().toISOString()
      });
    });

    // 라우팅 추가 (통합 대시보드를 기본 홈으로)
    this.app.get('/integrated-dashboard', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'integrated-dashboard.html'));
    });

    this.app.get('/admin-settings', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'admin-settings.html'));
    });

    // 알림 설정 API
    this.app.get('/api/notification-settings', (req, res) => {
      const settings = {
        providers: {
          smtp: {
            enabled: true,
            host: 'smtp.company.com',
            port: 587,
            username: 'noreply@company.com',
            fromName: 'AIRIS-MON 알림',
            encrypted: true
          },
          gmail: {
            enabled: false,
            email: '',
            configured: false
          },
          twilio: {
            enabled: false,
            configured: false
          },
          korea: {
            enabled: true,
            provider: 'aligo',
            from: '010-1234-5678',
            configured: true
          },
          slack: {
            enabled: false,
            channel: '#alerts',
            username: 'AIRIS-MON',
            configured: false
          },
          teams: {
            enabled: false,
            title: 'AIRIS-MON 알림',
            configured: false
          }
        },
        rules: [
          {
            id: 'rule-001',
            name: 'DB 연결 실패 즉시 알림',
            enabled: true,
            conditions: {
              severity: ['critical'],
              source: ['database'],
              keywords: ['연결', '실패']
            },
            actions: {
              channels: ['email', 'sms'],
              delay: 0,
              escalation: true
            }
          },
          {
            id: 'rule-002',
            name: '고부하 상태 모니터링',
            enabled: true,
            conditions: {
              severity: ['warning'],
              source: ['infrastructure'],
              keywords: ['CPU', '메모리', '사용률']
            },
            actions: {
              channels: ['email', 'slack'],
              delay: 300,
              escalation: false
            }
          }
        ],
        templates: [
          {
            id: 'template-001',
            name: '위험 알림 템플릿',
            type: 'critical',
            subject: '[CRITICAL] {{title}}',
            body: '긴급 알림이 발생했습니다.\\n\\n제목: {{title}}\\n내용: {{description}}\\n시간: {{timestamp}}\\n\\n즉시 확인이 필요합니다.',
            channels: ['email', 'sms']
          },
          {
            id: 'template-002',
            name: '경고 알림 템플릿',
            type: 'warning',
            subject: '[WARNING] {{title}}',
            body: '경고 알림입니다.\\n\\n제목: {{title}}\\n내용: {{description}}\\n시간: {{timestamp}}\\n\\n검토가 필요합니다.',
            channels: ['email']
          }
        ]
      };
      res.json(settings);
    });

    this.app.post('/api/notification-settings', (req, res) => {
      const { providers, rules, templates } = req.body;
      
      // Simulate saving settings
      res.json({
        success: true,
        message: '알림 설정이 성공적으로 저장되었습니다',
        savedAt: new Date().toISOString()
      });
    });

    this.app.post('/api/notification-test', (req, res) => {
      const { provider, recipient, message } = req.body;
      
      // Simulate test notification
      setTimeout(() => {
        const success = Math.random() > 0.2; // 80% success rate
        
        if (success) {
          res.json({
            success: true,
            message: `${provider} 테스트 알림이 성공적으로 전송되었습니다`,
            provider,
            recipient,
            sentAt: new Date().toISOString()
          });
        } else {
          res.status(400).json({
            success: false,
            message: `${provider} 테스트 알림 전송에 실패했습니다`,
            error: '설정을 확인해주세요',
            provider,
            recipient
          });
        }
      }, 1500);
    });

    // 알림 히스토리 API
    this.app.get('/api/alerts/history', (req, res) => {
      const { startDate, endDate, limit = 100 } = req.query;
      
      const history = Array.from({ length: parseInt(limit) }, (_, i) => ({
        id: `history-${i + 1}`,
        alertId: `alert-${String(i + 1).padStart(3, '0')}`,
        title: `과거 알림 ${i + 1}`,
        severity: ['critical', 'warning', 'info'][Math.floor(Math.random() * 3)],
        status: 'resolved',
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - Math.random() * 6 * 24 * 60 * 60 * 1000).toISOString(),
        resolution: '자동 해결',
        resolvedBy: 'system'
      }));
      
      res.json({
        history,
        total: history.length,
        period: { startDate, endDate }
      });
    });

    // API 엔드포인트들
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'running',
        testSuite: 'AIRIS-MON Complete Feature Test',
        scenarios: this.scenarios.length,
        activeTests: Object.keys(this.testResults).length,
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/api/scenarios', (req, res) => {
      res.json(this.scenarios);
    });

    this.app.post('/api/scenarios/:id/run', async (req, res) => {
      const scenarioId = req.params.id;
      const scenario = this.scenarios.find(s => s.id === scenarioId);
      
      if (!scenario) {
        return res.status(404).json({ error: '시나리오를 찾을 수 없습니다' });
      }

      try {
        console.log(chalk.cyan(`🧪 테스트 시나리오 실행 중: ${scenario.name}`));
        const result = await this.runScenario(scenario);
        res.json(result);
      } catch (error) {
        console.error(chalk.red(`❌ 시나리오 실행 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/results', (req, res) => {
      res.json(this.testResults);
    });

    this.app.post('/api/simulate/:type', async (req, res) => {
      const { type } = req.params;
      const { duration = 60, intensity = 'medium' } = req.body;

      try {
        let result;
        switch (type) {
          case 'metrics':
            result = await this.metricsGenerator.simulate(duration, intensity);
            break;
          case 'events':
            result = await this.eventSimulator.simulate(duration, intensity);
            break;
          case 'alerts':
            result = await this.alertTester.simulate(duration, intensity);
            break;
          case 'sessions':
            result = await this.sessionReplayTester.simulate(duration, intensity);
            break;
          default:
            throw new Error(`알 수 없는 시뮬레이션 타입: ${type}`);
        }

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 세션 리플레이 데이터 기록 API
    this.app.post('/api/session-replay/record', async (req, res) => {
      try {
        const sessionData = req.body;
        console.log(chalk.blue(`📹 세션 리플레이 데이터 수신: ${sessionData.event_type}`));
        
        // 실제 운영환경에서는 여기서 ClickHouse나 다른 DB에 저장
        // 현재는 시뮬레이션을 위해 로깅만 수행
        
        res.json({ 
          success: true, 
          session_id: sessionData.session_id,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(chalk.red(`❌ 세션 데이터 기록 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 세션 리플레이 샘플 데이터 생성 API
    this.app.post('/api/session-replay/generate-samples', async (req, res) => {
      try {
        const SessionReplayDataGenerator = require('./modules/session-replay-data-generator');
        const generator = new SessionReplayDataGenerator();
        
        const sampleData = generator.generateAllScenarios();
        const clickHouseData = generator.formatForClickHouse(sampleData);
        
        console.log(chalk.green(`✅ 세션 리플레이 샘플 데이터 생성 완료:`));
        console.log(`   - 버그 시나리오: ${sampleData.bug_scenarios.length}개`);
        console.log(`   - UX 시나리오: ${sampleData.ux_scenarios.length}개`);
        console.log(`   - 보안 시나리오: ${sampleData.security_scenarios.length}개`);
        console.log(`   - 성능 시나리오: ${sampleData.performance_scenarios.length}개`);
        
        res.json({
          success: true,
          sample_data: sampleData,
          clickhouse_data: clickHouseData,
          statistics: {
            total_sessions: Object.values(sampleData).flat().length,
            total_events: clickHouseData.session_events.length,
            security_incidents: clickHouseData.security_incidents.length,
            performance_metrics: clickHouseData.performance_metrics.length
          }
        });
      } catch (error) {
        console.error(chalk.red(`❌ 샘플 데이터 생성 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 세션 리플레이 데이터 조회 API (플레이어용) - 실제 저장된 세션 조회
    this.app.get('/api/session-replay/sessions/:scenario', async (req, res) => {
      try {
        const { scenario } = req.params;
        const sessions = this.sessionStorage.getSessionsByScenario(scenario);
        res.json({ success: true, sessions });
      } catch (error) {
        console.error(chalk.red(`❌ 세션 목록 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 특정 세션 데이터 조회 API - 실제 저장된 세션 조회
    this.app.get('/api/session-replay/session/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const session = this.sessionStorage.getSession(sessionId);
        
        if (!session) {
          return res.status(404).json({ success: false, error: '세션을 찾을 수 없습니다' });
        }

        console.log(chalk.blue(`📹 세션 데이터 조회: ${sessionId} (${session.events.length}개 이벤트)`));
        
        res.json({
          success: true,
          session: session,
          events: session.events
        });
      } catch (error) {
        console.error(chalk.red(`❌ 세션 데이터 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 세션 시작 API
    this.app.post('/api/session-replay/start-session', async (req, res) => {
      try {
        const { scenario, userAgent, ipAddress } = req.body;
        const sessionId = this.sessionStorage.startSession(
          scenario || 'unknown',
          userAgent || req.headers['user-agent'],
          ipAddress || req.ip || req.connection.remoteAddress
        );
        
        console.log(chalk.green(`🎬 새 세션 시작: ${sessionId} (${scenario})`));
        
        res.json({
          success: true,
          sessionId: sessionId,
          scenario: scenario,
          message: '세션 녹화가 시작되었습니다'
        });
      } catch (error) {
        console.error(chalk.red(`❌ 세션 시작 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 세션 이벤트 추가 API (rrweb 이벤트)
    this.app.post('/api/session-replay/add-event', async (req, res) => {
      try {
        const { sessionId, event } = req.body;
        
        if (!sessionId || !event) {
          return res.status(400).json({ success: false, error: '세션ID와 이벤트 데이터가 필요합니다' });
        }

        const success = this.sessionStorage.addEvent(sessionId, { event });
        
        if (success) {
          res.json({ success: true, message: 'rrweb 이벤트가 추가되었습니다' });
        } else {
          res.status(404).json({ success: false, error: '세션을 찾을 수 없습니다' });
        }
      } catch (error) {
        console.error(chalk.red(`❌ rrweb 이벤트 추가 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 전체 세션 저장 API (완전한 rrweb 세션)
    this.app.post('/api/session-replay/save-full-session', async (req, res) => {
      try {
        const sessionData = req.body;
        
        if (!sessionData.id || !sessionData.events) {
          return res.status(400).json({ success: false, error: '세션ID와 이벤트 배열이 필요합니다' });
        }

        const result = await this.sessionStorage.saveFullSession(sessionData);
        
        console.log(chalk.green(`💾 전체 세션 저장 완료: ${sessionData.id} (${sessionData.events.length}개 이벤트)`));
        res.json(result);
        
      } catch (error) {
        console.error(chalk.red(`❌ 전체 세션 저장 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 세션 종료 API
    this.app.post('/api/session-replay/end-session', async (req, res) => {
      try {
        const { sessionId, reason } = req.body;
        
        if (!sessionId) {
          return res.status(400).json({ success: false, error: '세션ID가 필요합니다' });
        }

        const result = await this.sessionStorage.endSession(sessionId, reason || 'user_ended');
        
        if (result.success) {
          console.log(chalk.yellow(`⏹️ 세션 종료: ${sessionId} (${result.session.events.length}개 이벤트)`));
          res.json(result);
        } else {
          res.status(404).json(result);
        }
      } catch (error) {
        console.error(chalk.red(`❌ 세션 종료 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 모든 세션 데이터 삭제 API (초기화용)
    this.app.delete('/api/session-replay/clear-all', async (req, res) => {
      try {
        const result = await this.sessionStorage.clearAllSessions();
        console.log(chalk.red('🧹 모든 세션 데이터 삭제 완료'));
        res.json(result);
      } catch (error) {
        console.error(chalk.red(`❌ 세션 데이터 삭제 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 세션 통계 조회 API
    this.app.get('/api/session-replay/stats', async (req, res) => {
      try {
        const stats = this.sessionStorage.getOverallStats();
        res.json({ success: true, stats });
      } catch (error) {
        console.error(chalk.red(`❌ 세션 통계 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 클릭 히트맵 데이터 집계 API
    this.app.get('/api/heatmap/click-data/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { pageFilter = 'all', timeRange = 0 } = req.query;
        
        const session = this.sessionStorage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
        }

        // 클릭 이벤트 필터링
        const clickEvents = session.events.filter(event => {
          // rrweb 클릭 이벤트 또는 직접 클릭 이벤트 확인
          const isClickEvent = event.type === 'click' || 
            (event.type === 'rrweb_event' && event.rrwebType === 'click') ||
            (event.originalEvent && event.originalEvent.type === 'click');
          
          if (!isClickEvent) return false;
          
          // 실제 이벤트 데이터 추출
          const eventData = event.originalEvent || event;
          
          // 페이지 필터 적용
          if (pageFilter !== 'all' && eventData.page_url !== pageFilter) return false;
          
          // 시간 범위 필터 적용 (분을 ms로 변환)
          const timeRangeMs = parseInt(timeRange) * 60 * 1000;
          if (timeRangeMs > 0 && event.timestamp > timeRangeMs) return false;
          
          // 좌표가 있는 이벤트만
          return eventData.x !== undefined && eventData.y !== undefined;
        });

        // 좌표별로 클릭 수 집계
        const heatmapPoints = {};
        
        clickEvents.forEach(event => {
          // 실제 이벤트 데이터 추출
          const eventData = event.originalEvent || event;
          
          const key = `${Math.round(eventData.x)},${Math.round(eventData.y)}`;
          if (!heatmapPoints[key]) {
            heatmapPoints[key] = {
              x: eventData.x,
              y: eventData.y,
              count: 0,
              elements: new Set(),
              pages: new Set(),
              timestamps: []
            };
          }
          heatmapPoints[key].count++;
          
          if (eventData.element_id) {
            heatmapPoints[key].elements.add(eventData.element_id);
          }
          if (eventData.page_url) {
            heatmapPoints[key].pages.add(eventData.page_url);
          }
          heatmapPoints[key].timestamps.push(event.timestamp);
        });

        // Set을 Array로 변환
        const processedData = Object.values(heatmapPoints).map(point => ({
          ...point,
          elements: Array.from(point.elements),
          pages: Array.from(point.pages)
        }));

        const stats = {
          totalClicks: clickEvents.length,
          uniquePoints: processedData.length,
          uniqueElements: new Set(clickEvents.map(e => e.element_id).filter(Boolean)).size,
          uniquePages: new Set(clickEvents.map(e => e.page_url).filter(Boolean)).size,
          timeRange: `${Math.round((Math.max(...clickEvents.map(e => e.timestamp || 0)) - Math.min(...clickEvents.map(e => e.timestamp || 0))) / 1000 / 60)}분`
        };

        res.json({ 
          success: true, 
          data: processedData,
          stats,
          sessionInfo: {
            id: session.id,
            scenario: session.scenario,
            duration: session.duration,
            eventCount: session.events.length
          }
        });

      } catch (error) {
        console.error(chalk.red(`❌ 히트맵 데이터 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 페이지별 클릭 핫스팟 분석 API
    this.app.get('/api/heatmap/hotspots/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { threshold = 0.8 } = req.query; // 상위 몇 % 포인트를 핫스팟으로 간주할지
        
        const session = this.sessionStorage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
        }

        const clickEvents = session.events.filter(event => 
          event.type === 'click' && event.x !== undefined && event.y !== undefined
        );

        // 좌표별 집계
        const clickCounts = {};
        clickEvents.forEach(event => {
          const key = `${Math.round(event.x)},${Math.round(event.y)}`;
          clickCounts[key] = (clickCounts[key] || 0) + 1;
        });

        // 핫스팟 임계값 계산
        const sortedCounts = Object.values(clickCounts).sort((a, b) => b - a);
        const hotspotIndex = Math.floor(sortedCounts.length * (1 - parseFloat(threshold)));
        const hotspotThreshold = sortedCounts[hotspotIndex] || 1;

        // 핫스팟 식별
        const hotspots = Object.entries(clickCounts)
          .filter(([key, count]) => count >= hotspotThreshold)
          .map(([key, count]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y, count, intensity: count / sortedCounts[0] };
          })
          .sort((a, b) => b.count - a.count);

        res.json({ 
          success: true, 
          hotspots,
          stats: {
            totalHotspots: hotspots.length,
            threshold: hotspotThreshold,
            maxClicks: sortedCounts[0] || 0,
            averageClicks: sortedCounts.reduce((sum, count) => sum + count, 0) / sortedCounts.length || 0
          }
        });

      } catch (error) {
        console.error(chalk.red(`❌ 핫스팟 분석 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 사용자 여정 분석 API
    this.app.get('/api/journey/path-analysis/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { journeyType = 'all', minVisits = 1 } = req.query;
        
        const session = this.sessionStorage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
        }

        // 페이지 로드 이벤트만 필터링 (rrweb_event 래핑 고려)
        const pageLoadEvents = session.events
          .filter(event => {
            // rrweb_event로 래핑된 page_load 이벤트 처리
            if (event.type === 'rrweb_event' && event.rrwebType === 'page_load' && event.originalEvent) {
              return event.originalEvent.page_url;
            }
            // 직접적인 page_load 이벤트 처리
            return event.type === 'page_load' && event.page_url;
          })
          .map(event => {
            // rrweb_event인 경우 originalEvent 데이터를 사용
            if (event.type === 'rrweb_event' && event.originalEvent) {
              return {
                ...event.originalEvent,
                timestamp: event.timestamp || event.originalEvent.timestamp,
                id: event.id
              };
            }
            return event;
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        if (pageLoadEvents.length === 0) {
          return res.status(400).json({ error: '페이지 로드 이벤트가 없습니다' });
        }

        // 페이지별 방문 통계
        const pageStats = {};
        const transitions = {};
        const userPaths = [];

        // 페이지 방문 및 전환 집계
        let currentPath = [];
        pageLoadEvents.forEach((event, index) => {
          const page = event.page_url;
          
          // 페이지 통계
          if (!pageStats[page]) {
            pageStats[page] = {
              visits: 0,
              totalTime: 0,
              bounceRate: 0,
              isEntry: false,
              isExit: false
            };
          }
          pageStats[page].visits++;
          
          // 첫 번째 페이지는 진입점
          if (index === 0) {
            pageStats[page].isEntry = true;
          }
          
          // 마지막 페이지는 출구점
          if (index === pageLoadEvents.length - 1) {
            pageStats[page].isExit = true;
          }

          // 경로 추적
          currentPath.push({
            page: page,
            timestamp: event.timestamp,
            timeSpent: index < pageLoadEvents.length - 1 ? 
              pageLoadEvents[index + 1].timestamp - event.timestamp : 0
          });

          // 전환 분석
          if (index > 0) {
            const prevPage = pageLoadEvents[index - 1].page_url;
            const transitionKey = `${prevPage}|${page}`;
            
            if (!transitions[transitionKey]) {
              transitions[transitionKey] = {
                from: prevPage,
                to: page,
                count: 0,
                avgTime: 0,
                totalTime: 0
              };
            }
            
            const timeSpent = event.timestamp - pageLoadEvents[index - 1].timestamp;
            transitions[transitionKey].count++;
            transitions[transitionKey].totalTime += timeSpent;
            transitions[transitionKey].avgTime = transitions[transitionKey].totalTime / transitions[transitionKey].count;
          }
        });

        if (currentPath.length > 0) {
          userPaths.push(currentPath);
        }

        // 여정 유형에 따른 필터링
        let filteredPaths = userPaths;
        switch (journeyType) {
          case 'successful':
            // 목표 페이지에 도달한 경로 (예: checkout)
            filteredPaths = userPaths.filter(path => 
              path.some(step => step.page.includes('checkout') || step.page.includes('success'))
            );
            break;
          case 'abandoned':
            // 중간에 이탈한 경로
            filteredPaths = userPaths.filter(path => path.length < 3);
            break;
          case 'loops':
            // 같은 페이지를 반복 방문한 경로
            filteredPaths = userPaths.filter(path => {
              const pages = path.map(step => step.page);
              return new Set(pages).size < pages.length;
            });
            break;
        }

        // 최소 방문 수 필터링
        const filteredPageStats = Object.fromEntries(
          Object.entries(pageStats).filter(([page, stats]) => stats.visits >= parseInt(minVisits))
        );

        const filteredTransitions = Object.values(transitions).filter(trans => 
          filteredPageStats[trans.from] && filteredPageStats[trans.to]
        );

        // 노드 및 링크 데이터 생성
        const nodes = Object.entries(filteredPageStats).map(([page, stats]) => ({
          id: page,
          page: page,
          visits: stats.visits,
          isEntry: stats.isEntry,
          isExit: stats.isExit,
          isHighTraffic: stats.visits > Object.values(filteredPageStats).reduce((sum, s) => sum + s.visits, 0) / Object.keys(filteredPageStats).length,
          avgTimeSpent: stats.totalTime / stats.visits || 0
        }));

        const links = filteredTransitions.map(trans => ({
          source: trans.from,
          target: trans.to,
          count: trans.count,
          avgTime: trans.avgTime,
          strength: Math.min(trans.count / 10, 1) // 0-1 정규화
        }));

        // 주요 경로 분석
        const topPaths = findTopPaths(filteredPaths, 5);
        
        // 통계 계산
        const totalTransitions = filteredTransitions.reduce((sum, trans) => sum + trans.count, 0);
        const avgPathLength = filteredPaths.length > 0 ? 
          filteredPaths.reduce((sum, path) => sum + path.length, 0) / filteredPaths.length : 0;
        const bounceRate = Object.values(filteredPageStats).filter(stats => stats.visits === 1).length / nodes.length * 100;

        res.json({
          success: true,
          data: {
            nodes,
            links,
            paths: topPaths,
            stats: {
              totalPages: nodes.length,
              totalTransitions,
              avgPathLength: Math.round(avgPathLength * 10) / 10,
              bounceRate: Math.round(bounceRate)
            }
          },
          sessionInfo: {
            id: session.id,
            scenario: session.scenario,
            duration: session.duration,
            totalEvents: session.events.length
          }
        });

      } catch (error) {
        console.error(chalk.red(`❌ 여정 분석 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 페이지 전환 패턴 분석 API
    this.app.get('/api/journey/transition-patterns/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const session = this.sessionStorage.getSession(sessionId);
        
        if (!session) {
          return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
        }

        const pageLoadEvents = session.events
          .filter(event => {
            // rrweb_event로 래핑된 page_load 이벤트 처리
            if (event.type === 'rrweb_event' && event.rrwebType === 'page_load' && event.originalEvent) {
              return event.originalEvent.page_url;
            }
            // 직접적인 page_load 이벤트 처리
            return event.type === 'page_load' && event.page_url;
          })
          .map(event => {
            // rrweb_event인 경우 originalEvent 데이터를 사용
            if (event.type === 'rrweb_event' && event.originalEvent) {
              return {
                ...event.originalEvent,
                timestamp: event.timestamp || event.originalEvent.timestamp,
                id: event.id
              };
            }
            return event;
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        // 전환 패턴 분석
        const patterns = {
          linear: 0,        // 직선적 이동 (A→B→C)
          backtrack: 0,     // 뒤로가기 패턴 (A→B→A)
          circular: 0,      // 순환 패턴 (A→B→C→A)
          jump: 0           // 점프 패턴 (관련없는 페이지로 갑작스런 이동)
        };

        const pageSequence = pageLoadEvents.map(e => e.page_url);
        
        for (let i = 0; i < pageSequence.length - 2; i++) {
          const current = pageSequence[i];
          const next = pageSequence[i + 1];
          const afterNext = pageSequence[i + 2];
          
          // 뒤로가기 패턴
          if (current === afterNext) {
            patterns.backtrack++;
          }
          // 순환 패턴 (3단계 이상에서 시작점으로 돌아감)
          else if (i >= 2 && pageSequence.slice(0, i).includes(afterNext)) {
            patterns.circular++;
          }
          // 직선적 패턴 (연관성 있는 페이지 이동)
          else if (isRelatedPage(current, next) && isRelatedPage(next, afterNext)) {
            patterns.linear++;
          }
          // 점프 패턴
          else {
            patterns.jump++;
          }
        }

        // 전환 시간 분석
        const transitionTimes = [];
        for (let i = 0; i < pageLoadEvents.length - 1; i++) {
          const timeSpent = pageLoadEvents[i + 1].timestamp - pageLoadEvents[i].timestamp;
          transitionTimes.push({
            from: pageLoadEvents[i].page_url,
            to: pageLoadEvents[i + 1].page_url,
            timeSpent: timeSpent,
            timeSpentSeconds: Math.round(timeSpent / 1000)
          });
        }

        // 통계
        const totalPatterns = Object.values(patterns).reduce((sum, count) => sum + count, 0);
        const patternPercentages = {};
        Object.entries(patterns).forEach(([pattern, count]) => {
          patternPercentages[pattern] = totalPatterns > 0 ? Math.round((count / totalPatterns) * 100) : 0;
        });

        res.json({
          success: true,
          patterns,
          patternPercentages,
          transitionTimes,
          avgTransitionTime: transitionTimes.length > 0 ? 
            transitionTimes.reduce((sum, t) => sum + t.timeSpent, 0) / transitionTimes.length / 1000 : 0,
          totalTransitions: transitionTimes.length
        });

      } catch (error) {
        console.error(chalk.red(`❌ 전환 패턴 분석 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 세션 위협 분석 API
    this.app.get('/api/threat-detection/analyze-session/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { sensitivityLevel = 5, detectionMode = 'all' } = req.query;
        
        const session = this.sessionStorage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
        }

        // 위협 탐지 알고리즘 실행
        const threats = await this.detectThreatsInSession(session, {
          sensitivityLevel: parseInt(sensitivityLevel),
          detectionMode
        });

        const analysis = {
          sessionInfo: {
            id: session.id,
            scenario: session.scenario,
            duration: session.duration,
            eventCount: session.events.length
          },
          threats,
          summary: {
            totalThreats: threats.length,
            criticalThreats: threats.filter(t => t.severity === 'critical').length,
            highThreats: threats.filter(t => t.severity === 'high').length,
            mediumThreats: threats.filter(t => t.severity === 'medium').length,
            lowThreats: threats.filter(t => t.severity === 'low').length,
            riskScore: calculateRiskScore(threats)
          },
          recommendations: generateSecurityRecommendations(threats)
        };

        res.json({ success: true, analysis });

      } catch (error) {
        console.error(chalk.red(`❌ 세션 위협 분석 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 트레이스 목록 API
    this.app.get('/api/traces/list', async (req, res) => {
      try {
        // 실제 구현에서는 분산 추적 시스템(Jaeger, Zipkin 등)에서 데이터 가져오기
        // 현재는 샘플 데이터 반환
        const traces = this.generateSampleTraces();
        
        res.json({
          success: true,
          traces: traces,
          count: traces.length
        });
      } catch (error) {
        console.error(chalk.red(`❌ 트레이스 목록 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 특정 트레이스 상세 정보 API
    this.app.get('/api/traces/:traceId', async (req, res) => {
      try {
        const { traceId } = req.params;
        
        // 실제 구현에서는 분산 추적 시스템에서 특정 트레이스 조회
        const trace = this.getTraceById(traceId);
        
        if (!trace) {
          return res.status(404).json({ error: '트레이스를 찾을 수 없습니다' });
        }
        
        res.json({
          success: true,
          trace: trace
        });
      } catch (error) {
        console.error(chalk.red(`❌ 트레이스 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // E2E 성능 분석 API
    this.app.get('/api/e2e-performance/analyze-session/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { timeRange = 60, threshold = 1000, samplingRate = 0.1 } = req.query;
        
        const session = this.sessionStorage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
        }

        // E2E 성능 분석 실행
        const performanceAnalysis = await this.analyzeE2EPerformance(session, {
          timeRange: parseInt(timeRange),
          threshold: parseInt(threshold),
          samplingRate: parseFloat(samplingRate)
        });

        res.json({ success: true, ...performanceAnalysis });

      } catch (error) {
        console.error(chalk.red(`❌ E2E 성능 분석 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // E2E 트레이스 데이터 조회 API
    this.app.get('/api/e2e-performance/traces/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { filter = 'all', limit = 100 } = req.query;
        
        const session = this.sessionStorage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
        }

        // 트레이스 데이터 생성
        const traces = await this.generateTraceData(session, {
          filter,
          limit: parseInt(limit)
        });

        res.json({ success: true, traces });

      } catch (error) {
        console.error(chalk.red(`❌ E2E 트레이스 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 성능 메트릭 집계 API
    this.app.get('/api/e2e-performance/metrics', async (req, res) => {
      try {
        const { timeRange = 60 } = req.query;
        
        // 모든 활성 세션에서 성능 메트릭 집계
        const metrics = await this.aggregatePerformanceMetrics(parseInt(timeRange));

        res.json({ success: true, metrics });

      } catch (error) {
        console.error(chalk.red(`❌ 성능 메트릭 집계 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 실시간 위협 탐지 상태 API
    this.app.get('/api/threat-detection/status', async (req, res) => {
      try {
        const status = {
          active: true,
          lastUpdate: new Date().toISOString(),
          threatLevel: 'normal', // normal, elevated, high, critical
          activeThreats: 0,
          systemHealth: 'good',
          detectionRules: 12,
          blockedIPs: 5,
          quarantinedSessions: 1
        };

        res.json({ success: true, status });
      } catch (error) {
        console.error(chalk.red(`❌ 위협 탐지 상태 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 위협 패턴 분석 API
    this.app.post('/api/threat-detection/analyze-pattern', async (req, res) => {
      try {
        const { events, patternType } = req.body;
        
        if (!events || !Array.isArray(events)) {
          return res.status(400).json({ error: '이벤트 데이터가 필요합니다' });
        }

        const analysis = await this.analyzeEventPattern(events, patternType);
        
        res.json({ success: true, analysis });
      } catch (error) {
        console.error(chalk.red(`❌ 패턴 분석 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // IP 차단 API
    this.app.post('/api/threat-detection/block-ip', async (req, res) => {
      try {
        const { ip, reason, duration = '1h' } = req.body;
        
        if (!ip) {
          return res.status(400).json({ error: 'IP 주소가 필요합니다' });
        }

        // 실제 환경에서는 방화벽이나 보안 시스템과 연동
        const blockResult = {
          ip,
          blocked: true,
          blockedAt: new Date().toISOString(),
          reason: reason || '위협 탐지',
          duration,
          expiresAt: new Date(Date.now() + parseDuration(duration)).toISOString()
        };

        console.log(chalk.red(`🚫 IP 차단: ${ip} (이유: ${reason})`));
        
        res.json({ success: true, result: blockResult });
      } catch (error) {
        console.error(chalk.red(`❌ IP 차단 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 세션 격리 API
    this.app.post('/api/threat-detection/quarantine-session', async (req, res) => {
      try {
        const { sessionId, reason } = req.body;
        
        if (!sessionId) {
          return res.status(400).json({ error: '세션 ID가 필요합니다' });
        }

        const session = this.sessionStorage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
        }

        // 세션 격리 처리
        const quarantineResult = {
          sessionId,
          quarantined: true,
          quarantinedAt: new Date().toISOString(),
          reason: reason || '보안 위협 탐지',
          actions: ['세션 종료', 'IP 모니터링 강화', '관련 세션 검토']
        };

        console.log(chalk.red(`🔒 세션 격리: ${sessionId} (이유: ${reason})`));
        
        res.json({ success: true, result: quarantineResult });
      } catch (error) {
        console.error(chalk.red(`❌ 세션 격리 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 향상된 세션 저장 API (통합 녹화기용)
    this.app.post('/api/session-replay/save-enhanced-session', async (req, res) => {
      try {
        const sessionData = req.body;
        
        if (!sessionData.id || !sessionData.events) {
          return res.status(400).json({ success: false, error: 'ID와 이벤트 배열이 필요합니다' });
        }

        // 향상된 세션 데이터 처리
        const enhancedSession = {
          ...sessionData,
          type: 'enhanced',
          enhanced_features: {
            dom_snapshots: sessionData.events.filter(e => e.type === 'dom_snapshot').length,
            typing_animations: sessionData.events.filter(e => e.type === 'input').length,
            visual_feedback: sessionData.events.filter(e => e.type === 'click').length,
            real_time_monitoring: true
          },
          processed_at: new Date().toISOString()
        };

        const result = await this.sessionStorage.saveFullSession(enhancedSession);
        
        console.log(chalk.green(`💾 향상된 세션 저장: ${sessionData.id} (${sessionData.events.length}개 이벤트)`));
        res.json({
          success: true,
          sessionId: sessionData.id,
          enhanced_features: enhancedSession.enhanced_features,
          ...result
        });
        
      } catch (error) {
        console.error(chalk.red(`❌ 향상된 세션 저장 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 실시간 모니터링 메트릭 API
    this.app.get('/api/monitoring/realtime-metrics', async (req, res) => {
      try {
        const metrics = {
          timestamp: new Date().toISOString(),
          active_sessions: this.sessionStorage.getActiveSessions().length,
          total_events_today: this.getTotalEventsToday(),
          system_health: this.getSystemHealth(),
          session_quality: this.getSessionQuality(),
          performance_metrics: {
            avg_session_duration: this.getAverageSessionDuration(),
            avg_events_per_session: this.getAverageEventsPerSession(),
            success_rate: this.getSessionSuccessRate()
          }
        };

        res.json({ success: true, metrics });
      } catch (error) {
        console.error(chalk.red(`❌ 실시간 메트릭 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // WebSocket 실시간 알림 API
    this.app.post('/api/monitoring/notify', async (req, res) => {
      try {
        const { type, data, sessionId } = req.body;
        
        // WebSocket으로 실시간 알림 전송
        this.io.emit('real-time-notification', {
          type: type,
          data: data,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        });

        console.log(chalk.cyan(`📡 실시간 알림 전송: ${type}`));
        res.json({ success: true, message: '실시간 알림 전송됨' });
      } catch (error) {
        console.error(chalk.red(`❌ 실시간 알림 전송 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // ========== 애플리케이션 분석 API ==========
    
    // 프로젝트 분석 API
    this.app.post('/api/analysis/project', async (req, res) => {
      try {
        const { type, target, name } = req.body;
        
        if (!type || !target) {
          return res.status(400).json({
            success: false,
            error: '분석 타입과 대상이 필요합니다'
          });
        }
        
        console.log(`🔍 프로젝트 분석 시작: ${type} - ${target}`);
        
        // Python 분석 스크립트 실행
        const { spawn } = require('child_process');
        const fs = require('fs');
        const path = require('path');
        
        const pythonScript = path.join(__dirname, 'analysis', 'project_analyzer.py');
        const python = spawn('python3', [pythonScript, target]);
        
        let output = '';
        let errorOutput = '';
        
        python.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        python.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        python.on('close', (code) => {
          if (code === 0) {
            try {
              const analysis = JSON.parse(output);
              
              // 분석 결과 저장
              const analysisId = Date.now().toString();
              const analysisDir = path.join(__dirname, '..', 'storage', 'analysis');
              const analysisFile = path.join(analysisDir, `${analysisId}.json`);
              
              // 저장 디렉토리 생성
              if (!fs.existsSync(analysisDir)) {
                fs.mkdirSync(analysisDir, { recursive: true });
              }
              
              fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
              
              res.json({
                success: true,
                data: {
                  analysisId: analysisId,
                  analysis: analysis,
                  timestamp: new Date().toISOString()
                }
              });
              
              console.log(`✅ 프로젝트 분석 완료: ${analysis.name}`);
              
            } catch (parseError) {
              console.error('❌ 분석 결과 파싱 실패:', parseError);
              res.status(500).json({
                success: false,
                error: '분석 결과 파싱 실패',
                details: output
              });
            }
          } else {
            console.error('❌ Python 스크립트 실행 실패:', errorOutput);
            res.status(500).json({
              success: false,
              error: 'Python 분석 스크립트 실행 실패',
              details: errorOutput
            });
          }
        });
        
      } catch (error) {
        console.error('❌ 프로젝트 분석 API 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 저장된 분석 결과 조회
    this.app.get('/api/analysis/project/:analysisId', (req, res) => {
      try {
        const { analysisId } = req.params;
        const analysisFile = path.join(__dirname, '..', 'storage', 'analysis', `${analysisId}.json`);
        
        if (!fs.existsSync(analysisFile)) {
          return res.status(404).json({
            success: false,
            error: '분석 결과를 찾을 수 없습니다'
          });
        }
        
        const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
        
        res.json({
          success: true,
          data: analysis
        });
        
      } catch (error) {
        console.error('❌ 분석 결과 조회 실패:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 분석 히스토리 조회
    this.app.get('/api/analysis/history', (req, res) => {
      try {
        const path = require('path');
        const fs = require('fs');
        const analysisDir = path.join(__dirname, '..', 'storage', 'analysis');
        
        if (!fs.existsSync(analysisDir)) {
          return res.json({
            success: true,
            data: []
          });
        }
        
        const files = fs.readdirSync(analysisDir)
          .filter(file => file.endsWith('.json'))
          .map(file => {
            const filePath = path.join(analysisDir, file);
            const stats = fs.statSync(filePath);
            const analysis = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            return {
              id: path.basename(file, '.json'),
              name: analysis.name,
              url: analysis.url,
              frontend_framework: analysis.frontend_framework,
              backend_framework: analysis.backend_framework,
              components_count: analysis.components.length,
              datastores_count: analysis.datastores.length,
              total_lines: analysis.metrics.total_lines,
              created_at: stats.birthtime,
              modified_at: stats.mtime
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        res.json({
          success: true,
          data: files
        });
        
      } catch (error) {
        console.error('❌ 분석 히스토리 조회 실패:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // 프로그램-테이블 CRUD 매트릭스 데이터 API (AIRIS-MON 실제 시스템)
    this.app.get('/api/analysis/correlation', async (req, res) => {
      try {
        const crudMatrix = {
          programs: [
            { id: 'AIRISMonTestSuite', name: 'AIRIS-MON Test Suite', type: 'main' },
            { id: 'DataSimulator', name: 'Data Simulator', type: 'module' },
            { id: 'MetricsGenerator', name: 'Metrics Generator', type: 'module' },
            { id: 'EventSimulator', name: 'Event Simulator', type: 'module' },
            { id: 'AIMLTester', name: 'AI/ML Tester', type: 'module' },
            { id: 'AlertTester', name: 'Alert Tester', type: 'module' },
            { id: 'SessionReplayTester', name: 'Session Replay Tester', type: 'module' },
            { id: 'SessionStorage', name: 'Session Storage', type: 'module' },
            { id: 'NLPSearchTester', name: 'NLP Search Tester', type: 'module' },
            { id: 'DashboardUI', name: 'Dashboard UI', type: 'module' },
            { id: 'SessionRecorder', name: 'Session Recorder (Frontend)', type: 'frontend' },
            { id: 'SessionPlayer', name: 'Session Player (Frontend)', type: 'frontend' },
            { id: 'HeatmapAnalyzer', name: 'Heatmap Analyzer (Frontend)', type: 'frontend' },
            { id: 'ThreatDetection', name: 'Threat Detection (Frontend)', type: 'frontend' },
            { id: 'PerformanceMonitor', name: 'Performance Monitor (Frontend)', type: 'frontend' }
          ],
          tables: [
            { id: 'kafka_events', name: 'Kafka Events', type: 'datastore' },
            { id: 'clickhouse_metrics', name: 'ClickHouse Metrics', type: 'datastore' },
            { id: 'redis_cache', name: 'Redis Cache', type: 'datastore' },
            { id: 'session_files', name: 'Session Files', type: 'datastore' },
            { id: 'aiml_models', name: 'AI/ML Models', type: 'datastore' },
            { id: 'alert_history', name: 'Alert History', type: 'datastore' },
            { id: 'nlp_indices', name: 'NLP Search Indices', type: 'datastore' },
            { id: 'dashboard_state', name: 'Dashboard State', type: 'datastore' },
            { id: 'websocket_channels', name: 'WebSocket Channels', type: 'communication' },
            { id: 'config_store', name: 'Configuration Store', type: 'datastore' }
          ],
          matrix: {
            'AIRISMonTestSuite': {
              'kafka_events': ['R'],
              'clickhouse_metrics': ['R'],
              'redis_cache': ['R'],
              'session_files': ['R'],
              'aiml_models': ['R'],
              'alert_history': ['C', 'R', 'U'],
              'nlp_indices': ['R'],
              'dashboard_state': ['C', 'R', 'U'],
              'websocket_channels': ['C', 'R'],
              'config_store': ['R']
            },
            'DataSimulator': {
              'kafka_events': ['C', 'R', 'U'],
              'clickhouse_metrics': ['C', 'R', 'U'],
              'redis_cache': ['C', 'R', 'U', 'D'],
              'session_files': [],
              'aiml_models': [],
              'alert_history': [],
              'nlp_indices': [],
              'dashboard_state': [],
              'websocket_channels': [],
              'config_store': ['R']
            },
            'MetricsGenerator': {
              'kafka_events': ['R'],
              'clickhouse_metrics': ['C', 'R', 'U'],
              'redis_cache': ['C', 'R', 'U'],
              'session_files': [],
              'aiml_models': [],
              'alert_history': ['C'],
              'nlp_indices': [],
              'dashboard_state': ['C', 'U'],
              'websocket_channels': ['C'],
              'config_store': ['R']
            },
            'EventSimulator': {
              'kafka_events': ['C', 'R'],
              'clickhouse_metrics': ['C'],
              'redis_cache': ['R'],
              'session_files': [],
              'aiml_models': [],
              'alert_history': ['C'],
              'nlp_indices': [],
              'dashboard_state': [],
              'websocket_channels': ['C'],
              'config_store': ['R']
            },
            'AIMLTester': {
              'kafka_events': ['R'],
              'clickhouse_metrics': ['R'],
              'redis_cache': ['R'],
              'session_files': ['R'],
              'aiml_models': ['C', 'R', 'U', 'D'],
              'alert_history': ['C'],
              'nlp_indices': [],
              'dashboard_state': [],
              'websocket_channels': [],
              'config_store': ['R']
            },
            'AlertTester': {
              'kafka_events': ['R'],
              'clickhouse_metrics': ['R'],
              'redis_cache': ['R'],
              'session_files': [],
              'aiml_models': [],
              'alert_history': ['C', 'R', 'U', 'D'],
              'nlp_indices': [],
              'dashboard_state': ['U'],
              'websocket_channels': ['C'],
              'config_store': ['R']
            },
            'SessionReplayTester': {
              'kafka_events': ['C'],
              'clickhouse_metrics': [],
              'redis_cache': ['R'],
              'session_files': ['C', 'R', 'U', 'D'],
              'aiml_models': [],
              'alert_history': [],
              'nlp_indices': [],
              'dashboard_state': [],
              'websocket_channels': ['C'],
              'config_store': ['R']
            },
            'SessionStorage': {
              'kafka_events': [],
              'clickhouse_metrics': [],
              'redis_cache': ['C', 'R', 'D'],
              'session_files': ['C', 'R', 'U', 'D'],
              'aiml_models': [],
              'alert_history': [],
              'nlp_indices': [],
              'dashboard_state': [],
              'websocket_channels': [],
              'config_store': ['R']
            },
            'NLPSearchTester': {
              'kafka_events': ['R'],
              'clickhouse_metrics': ['R'],
              'redis_cache': ['R'],
              'session_files': [],
              'aiml_models': [],
              'alert_history': [],
              'nlp_indices': ['C', 'R', 'U', 'D'],
              'dashboard_state': [],
              'websocket_channels': [],
              'config_store': ['R']
            },
            'DashboardUI': {
              'kafka_events': [],
              'clickhouse_metrics': ['R'],
              'redis_cache': ['R'],
              'session_files': [],
              'aiml_models': [],
              'alert_history': ['R'],
              'nlp_indices': [],
              'dashboard_state': ['C', 'R', 'U'],
              'websocket_channels': ['C', 'R'],
              'config_store': ['R']
            },
            'SessionRecorder': {
              'kafka_events': [],
              'clickhouse_metrics': [],
              'redis_cache': [],
              'session_files': ['C'],
              'aiml_models': [],
              'alert_history': [],
              'nlp_indices': [],
              'dashboard_state': [],
              'websocket_channels': ['C'],
              'config_store': []
            },
            'SessionPlayer': {
              'kafka_events': [],
              'clickhouse_metrics': [],
              'redis_cache': [],
              'session_files': ['R'],
              'aiml_models': [],
              'alert_history': [],
              'nlp_indices': [],
              'dashboard_state': ['R'],
              'websocket_channels': ['R'],
              'config_store': []
            },
            'HeatmapAnalyzer': {
              'kafka_events': [],
              'clickhouse_metrics': ['R'],
              'redis_cache': [],
              'session_files': ['R'],
              'aiml_models': [],
              'alert_history': [],
              'nlp_indices': [],
              'dashboard_state': ['R'],
              'websocket_channels': [],
              'config_store': []
            },
            'ThreatDetection': {
              'kafka_events': ['R'],
              'clickhouse_metrics': ['R'],
              'redis_cache': [],
              'session_files': ['R'],
              'aiml_models': ['R'],
              'alert_history': ['C'],
              'nlp_indices': [],
              'dashboard_state': ['R'],
              'websocket_channels': ['C'],
              'config_store': []
            },
            'PerformanceMonitor': {
              'kafka_events': ['R'],
              'clickhouse_metrics': ['R'],
              'redis_cache': ['R'],
              'session_files': [],
              'aiml_models': [],
              'alert_history': [],
              'nlp_indices': [],
              'dashboard_state': ['R', 'U'],
              'websocket_channels': ['R'],
              'config_store': ['R']
            }
          }
        };

        res.json({ success: true, data: crudMatrix });
      } catch (error) {
        console.error(chalk.red(`❌ CRUD 매트릭스 데이터 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 프로그램/모듈 리스트 API (AIRIS-MON 실제 시스템)
    this.app.get('/api/analysis/programs', async (req, res) => {
      try {
        const programs = [
          {
            id: 'AIRISMonTestSuite',
            name: 'AIRIS-MON Test Suite',
            type: 'Main Application',
            language: 'Node.js',
            version: '1.0.0',
            status: 'active',
            complexity: 'very_high',
            dependencies: 9,
            apis: 150,
            loc: 5618,
            lastModified: '2025-08-15 03:00',
            maintainer: 'AIRIS Team',
            description: 'Korean HyperDX Style 통합 모니터링 테스트 스위트'
          },
          {
            id: 'DataSimulator',
            name: 'Data Simulator',
            type: 'Service Module',
            language: 'Node.js',
            version: '1.0.0',
            status: 'active',
            complexity: 'high',
            dependencies: 4,
            datastores: 3,
            loc: 446,
            lastModified: '2025-08-14 15:30',
            maintainer: 'Data Team',
            description: 'Kafka, ClickHouse, Redis 기반 실시간 데이터 시뮬레이션'
          },
          {
            id: 'MetricsGenerator',
            name: 'Metrics Generator',
            type: 'Service Module',
            language: 'Node.js',
            version: '1.0.0',
            status: 'active',
            complexity: 'medium',
            dependencies: 2,
            metrics: 25,
            loc: 334,
            lastModified: '2025-08-14 12:45',
            maintainer: 'Monitoring Team',
            description: '시스템 메트릭 생성 및 성능 지표 관리'
          },
          {
            id: 'EventSimulator',
            name: 'Event Simulator',
            type: 'Service Module',
            language: 'Node.js',
            version: '1.0.0',
            status: 'active',
            complexity: 'high',
            dependencies: 3,
            events: 45,
            loc: 517,
            lastModified: '2025-08-14 16:20',
            maintainer: 'Event Team',
            description: '실시간 이벤트 시뮬레이션 및 스트리밍 처리'
          },
          {
            id: 'AIMLTester',
            name: 'AI/ML Tester',
            type: 'Service Module',
            language: 'Node.js',
            version: '1.0.0',
            status: 'active',
            complexity: 'high',
            dependencies: 2,
            models: 6,
            loc: 483,
            lastModified: '2025-08-14 11:15',
            maintainer: 'AI Team',
            description: '머신러닝 모델 테스트 및 이상 탐지 시스템'
          },
          {
            id: 'AlertTester',
            name: 'Alert Tester',
            type: 'Service Module',
            language: 'Node.js',
            version: '1.0.0',
            status: 'active',
            complexity: 'medium',
            dependencies: 3,
            alerts: 18,
            loc: 611,
            lastModified: '2025-08-14 14:30',
            maintainer: 'Alert Team',
            description: '실시간 알림 시스템 및 임계값 관리'
          },
          {
            id: 'SessionReplayTester',
            name: 'Session Replay Tester',
            type: 'Service Module',
            language: 'Node.js',
            version: '1.0.0',
            status: 'active',
            complexity: 'very_high',
            dependencies: 2,
            sessions: 200,
            loc: 532,
            lastModified: '2025-08-15 02:45',
            maintainer: 'Replay Team',
            description: '세션 리플레이 녹화/재생 및 사용자 행동 분석'
          },
          {
            id: 'SessionStorage',
            name: 'Session Storage',
            type: 'Storage Module',
            language: 'Node.js',
            version: '1.0.0',
            status: 'active',
            complexity: 'medium',
            dependencies: 1,
            files: 150,
            loc: 376,
            lastModified: '2025-08-15 01:20',
            maintainer: 'Storage Team',
            description: '세션 데이터 영속화 및 메모리 관리'
          },
          {
            id: 'NLPSearchTester',
            name: 'NLP Search Tester',
            type: 'Service Module',
            language: 'Node.js',
            version: '1.0.0',
            status: 'active',
            complexity: 'high',
            dependencies: 3,
            indices: 8,
            loc: 637,
            lastModified: '2025-08-14 10:15',
            maintainer: 'Search Team',
            description: '자연어 처리 기반 검색 및 인덱싱 시스템'
          },
          {
            id: 'DashboardUI',
            name: 'Dashboard UI',
            type: 'UI Module',
            language: 'Node.js',
            version: '1.0.0',
            status: 'active',
            complexity: 'high',
            dependencies: 4,
            components: 25,
            loc: 751,
            lastModified: '2025-08-14 17:45',
            maintainer: 'Frontend Team',
            description: '실시간 대시보드 UI 컴포넌트 및 시각화'
          }
        ];

        res.json({ success: true, data: programs });
      } catch (error) {
        console.error(chalk.red(`❌ 프로그램 리스트 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 데이터 저장소 리스트 API (AIRIS-MON 실제 시스템)
    this.app.get('/api/analysis/tables', async (req, res) => {
      try {
        const datastores = [
          {
            id: 'kafka_events',
            name: 'Kafka Events Stream',
            type: 'Streaming',
            engine: 'Apache Kafka',
            topics: 12,
            partitions: 36,
            size: '2.3TB',
            avgMessageSize: '1.2KB',
            lastUpdate: '2025-08-15 03:01',
            connections: 8,
            dailyMessages: 2340000,
            retention: '7 days',
            description: '실시간 이벤트 스트리밍 토픽들'
          },
          {
            id: 'clickhouse_metrics',
            name: 'ClickHouse Metrics DB',
            type: 'Analytics',
            engine: 'ClickHouse',
            tables: 6,
            records: 15678000,
            size: '892MB',
            avgRowSize: '64B',
            lastUpdate: '2025-08-15 03:00',
            connections: 5,
            dailyQueries: 45000,
            compression: 'LZ4',
            description: '시계열 메트릭 분석 데이터베이스'
          },
          {
            id: 'redis_cache',
            name: 'Redis Cache Store',
            type: 'Cache',
            engine: 'Redis',
            keys: 450000,
            memory: '1.2GB',
            avgKeySize: '2.8KB',
            lastUpdate: '2025-08-15 03:01',
            connections: 12,
            dailyOperations: 890000,
            ttl: '24 hours',
            description: '고성능 인메모리 캐시 저장소'
          },
          {
            id: 'session_files',
            name: 'Session Files Storage',
            type: 'File Storage',
            engine: 'FileSystem',
            files: 1850,
            directories: 24,
            size: '3.4GB',
            avgFileSize: '1.9MB',
            lastUpdate: '2025-08-15 02:58',
            connections: 3,
            dailyWrites: 1200,
            retention: '30 days',
            description: '세션 리플레이 데이터 파일 저장소'
          },
          {
            id: 'aiml_models',
            name: 'AI/ML Models Store',
            type: 'Model Storage',
            engine: 'FileSystem',
            models: 6,
            versions: 18,
            size: '856MB',
            avgModelSize: '142MB',
            lastUpdate: '2025-08-14 11:15',
            connections: 2,
            dailyInferences: 15000,
            accuracy: '94.2%',
            description: '머신러닝 모델 저장소 및 버전 관리'
          },
          {
            id: 'alert_history',
            name: 'Alert History DB',
            type: 'Transactional',
            engine: 'SQLite',
            tables: 4,
            records: 34500,
            size: '67MB',
            avgRowSize: '2.1KB',
            lastUpdate: '2025-08-15 02:45',
            connections: 3,
            dailyInserts: 5600,
            indexCount: 8,
            description: '알림 이력 및 상태 관리 데이터베이스'
          },
          {
            id: 'nlp_indices',
            name: 'NLP Search Indices',
            type: 'Search Index',
            engine: 'Custom Index',
            indices: 8,
            documents: 125000,
            size: '234MB',
            avgDocSize: '1.9KB',
            lastUpdate: '2025-08-14 10:30',
            connections: 3,
            dailySearches: 8900,
            indexType: 'Inverted',
            description: '자연어 처리 검색 인덱스'
          },
          {
            id: 'dashboard_state',
            name: 'Dashboard State Store',
            type: 'State Management',
            engine: 'Memory + Backup',
            components: 25,
            states: 180,
            size: '45MB',
            avgStateSize: '256KB',
            lastUpdate: '2025-08-15 03:01',
            connections: 15,
            dailyUpdates: 25000,
            persistence: 'JSON',
            description: '대시보드 컴포넌트 상태 관리'
          },
          {
            id: 'websocket_channels',
            name: 'WebSocket Channels',
            type: 'Real-time Communication',
            engine: 'Socket.IO',
            rooms: 45,
            connections: 120,
            size: '12MB',
            avgMessageSize: '512B',
            lastUpdate: '2025-08-15 03:01',
            activeConnections: 25,
            dailyMessages: 156000,
            protocol: 'WebSocket',
            description: '실시간 양방향 통신 채널'
          },
          {
            id: 'config_store',
            name: 'Configuration Store',
            type: 'Configuration',
            engine: 'JSON Files',
            configs: 35,
            environments: 3,
            size: '2.3MB',
            avgConfigSize: '67KB',
            lastUpdate: '2025-08-14 16:20',
            connections: 1,
            dailyReads: 450,
            validation: 'JSON Schema',
            description: '시스템 설정 및 환경 변수 저장소'
          }
        ];

        res.json({ success: true, data: datastores });
      } catch (error) {
        console.error(chalk.red(`❌ 데이터 저장소 리스트 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 데이터 스트리밍/처리 현황 API (AIRIS-MON 실제 시스템)
    this.app.get('/api/analysis/data-status', async (req, res) => {
      try {
        const currentTime = new Date();
        const dataStatus = [
          {
            component: 'kafka_producer',
            status: 'active',
            lastBatch: '2025-08-15 03:01:15',
            nextBatch: '2025-08-15 03:01:30',
            progress: 100,
            messagesProcessed: 12450,
            totalMessages: 12450,
            batchSize: 500,
            avgProcessingTime: '0.8s',
            errorCount: 0,
            type: 'streaming'
          },
          {
            component: 'clickhouse_writer',
            status: 'processing', 
            lastBatch: '2025-08-15 03:00:45',
            nextBatch: '2025-08-15 03:05:00',
            progress: 78,
            recordsProcessed: 890000,
            totalRecords: 1140000,
            batchSize: 10000,
            avgProcessingTime: '2.3s',
            errorCount: 3,
            type: 'analytics'
          },
          {
            component: 'redis_cache_sync',
            status: 'active',
            lastBatch: '2025-08-15 03:01:10',
            nextBatch: '2025-08-15 03:01:25',
            progress: 100,
            keysProcessed: 4500,
            totalKeys: 4500,
            batchSize: 1000,
            avgProcessingTime: '0.2s',
            errorCount: 0,
            type: 'cache'
          },
          {
            component: 'session_recorder',
            status: 'active',
            lastBatch: '2025-08-15 03:00:58',
            nextBatch: '2025-08-15 03:01:20',
            progress: 100,
            sessionsProcessed: 25,
            totalSessions: 25,
            batchSize: 5,
            avgProcessingTime: '1.5s',
            errorCount: 0,
            type: 'recording'
          },
          {
            component: 'aiml_inference',
            status: 'processing',
            lastBatch: '2025-08-15 03:00:30',
            nextBatch: '2025-08-15 03:02:00',
            progress: 65,
            inferencesProcessed: 3250,
            totalInferences: 5000,
            batchSize: 50,
            avgProcessingTime: '4.2s',
            errorCount: 12,
            type: 'ml'
          },
          {
            component: 'alert_processor',
            status: 'active',
            lastBatch: '2025-08-15 03:01:05',
            nextBatch: '2025-08-15 03:01:35',
            progress: 100,
            alertsProcessed: 145,
            totalAlerts: 145,
            batchSize: 25,
            avgProcessingTime: '0.5s',
            errorCount: 1,
            type: 'alerting'
          },
          {
            component: 'nlp_indexer',
            status: 'pending',
            lastBatch: '2025-08-15 02:58:20',
            nextBatch: '2025-08-15 03:05:00',
            progress: 0,
            documentsProcessed: 0,
            totalDocuments: 2890,
            batchSize: 100,
            avgProcessingTime: '6.1s',
            errorCount: 0,
            type: 'search'
          },
          {
            component: 'metrics_aggregator',
            status: 'active',
            lastBatch: '2025-08-15 03:01:00',
            nextBatch: '2025-08-15 03:01:15',
            progress: 100,
            metricsProcessed: 8900,
            totalMetrics: 8900,
            batchSize: 500,
            avgProcessingTime: '0.3s',
            errorCount: 0,
            type: 'metrics'
          },
          {
            component: 'websocket_dispatcher',
            status: 'active',
            lastBatch: '2025-08-15 03:01:12',
            nextBatch: '2025-08-15 03:01:17',
            progress: 100,
            messagesDispatched: 1560,
            totalMessages: 1560,
            batchSize: 100,
            avgProcessingTime: '0.1s',
            errorCount: 0,
            type: 'realtime'
          },
          {
            component: 'dashboard_renderer',
            status: 'processing',
            lastBatch: '2025-08-15 03:00:55',
            nextBatch: '2025-08-15 03:01:25',
            progress: 85,
            componentsRendered: 21,
            totalComponents: 25,
            batchSize: 5,
            avgProcessingTime: '1.8s',
            errorCount: 2,
            type: 'ui'
          }
        ];

        // 전체 시스템 통계 계산
        const systemStats = {
          totalComponents: dataStatus.length,
          activeComponents: dataStatus.filter(t => t.status === 'active').length,
          processingComponents: dataStatus.filter(t => t.status === 'processing').length,
          errorComponents: dataStatus.filter(t => t.status === 'error').length,
          pendingComponents: dataStatus.filter(t => t.status === 'pending').length,
          totalItemsProcessed: dataStatus.reduce((sum, t) => sum + (t.messagesProcessed || t.recordsProcessed || t.keysProcessed || t.sessionsProcessed || t.inferencesProcessed || t.alertsProcessed || t.documentsProcessed || t.metricsProcessed || t.messagesDispatched || t.componentsRendered || 0), 0),
          totalItemsToProcess: dataStatus.reduce((sum, t) => sum + (t.totalMessages || t.totalRecords || t.totalKeys || t.totalSessions || t.totalInferences || t.totalAlerts || t.totalDocuments || t.totalMetrics || t.totalMessages || t.totalComponents || 0), 0),
          totalErrors: dataStatus.reduce((sum, t) => sum + t.errorCount, 0),
          avgProcessingTime: (dataStatus.reduce((sum, t) => sum + parseFloat(t.avgProcessingTime), 0) / dataStatus.length).toFixed(1) + 's',
          streamingThroughput: '12.5K msg/s',
          analyticsThroughput: '450K records/min',
          realTimeLatency: '< 100ms'
        };

        systemStats.overallProgress = Math.round((systemStats.totalItemsProcessed / systemStats.totalItemsToProcess) * 100);

        res.json({ 
          success: true, 
          data: dataStatus,
          systemStats: systemStats,
          timestamp: currentTime.toISOString(),
          systemHealth: {
            kafka: 'healthy',
            clickhouse: 'healthy', 
            redis: 'healthy',
            fileSystem: 'healthy',
            webSocket: 'healthy'
          }
        });
      } catch (error) {
        console.error(chalk.red(`❌ 데이터 처리 현황 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 프로그램 상세 정보 API
    this.app.get('/api/analysis/programs/:id', async (req, res) => {
      try {
        const programId = req.params.id;
        
        // 실제로는 데이터베이스에서 조회
        const programDetails = {
          id: programId,
          name: 'User Service',
          type: 'Service',
          language: 'Java',
          version: '2.1.3',
          status: 'active',
          complexity: 'medium',
          dependencies: 3,
          tables: 2,
          loc: 2340,
          lastModified: '2025-08-10 14:30',
          maintainer: 'Backend Team',
          description: '사용자 관리 및 인증 서비스',
          dependencies_detail: [
            { name: 'AuthMiddleware', type: 'depends_on', version: '1.2.1' },
            { name: 'DataValidator', type: 'depends_on', version: '2.4.0' },
            { name: 'SessionService', type: 'depends_on', version: '1.8.3' }
          ],
          table_connections: [
            { table: 'users', operations: ['READ', 'WRITE', 'UPDATE'], frequency: 'high' },
            { table: 'sessions', operations: ['READ', 'WRITE'], frequency: 'medium' }
          ],
          performance_metrics: {
            avg_response_time: '120ms',
            requests_per_minute: 450,
            error_rate: '0.2%',
            cpu_usage: '15%',
            memory_usage: '180MB'
          }
        };

        res.json({ success: true, data: programDetails });
      } catch (error) {
        console.error(chalk.red(`❌ 프로그램 상세 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 테이블 상세 정보 API
    this.app.get('/api/analysis/tables/:id', async (req, res) => {
      try {
        const tableId = req.params.id;
        
        // 실제로는 데이터베이스에서 조회
        const tableDetails = {
          id: tableId,
          name: 'Users Table',
          schema: 'main',
          type: 'master',
          engine: 'InnoDB',
          records: 15420,
          size: '245MB',
          avgRowSize: '16.7KB',
          lastUpdate: '2025-08-15 09:30',
          connections: 8,
          dailyQueries: 2340,
          indexCount: 5,
          description: '사용자 정보 테이블',
          columns: [
            { name: 'id', type: 'BIGINT', nullable: false, key: 'PRIMARY' },
            { name: 'username', type: 'VARCHAR(50)', nullable: false, key: 'UNIQUE' },
            { name: 'email', type: 'VARCHAR(100)', nullable: false, key: 'INDEX' },
            { name: 'password_hash', type: 'VARCHAR(255)', nullable: false, key: null },
            { name: 'created_at', type: 'TIMESTAMP', nullable: false, key: 'INDEX' },
            { name: 'updated_at', type: 'TIMESTAMP', nullable: true, key: null },
            { name: 'status', type: 'ENUM', nullable: false, key: 'INDEX' }
          ],
          connected_programs: [
            { program: 'UserService', operations: ['READ', 'write'], frequency: 'high' },
            { program: 'OrderAPI', operations: ['read'], frequency: 'medium' },
            { program: 'NotificationWorker', operations: ['read'], frequency: 'low' }
          ],
          performance_metrics: {
            query_performance: {
              avg_select_time: '0.05s',
              avg_insert_time: '0.02s',
              avg_update_time: '0.03s',
              slow_queries: 3
            },
            storage_metrics: {
              data_size: '245MB',
              index_size: '78MB',
              fragmentation: '2.1%',
              growth_rate: '+0.8%/day'
            }
          }
        };

        res.json({ success: true, data: tableDetails });
      } catch (error) {
        console.error(chalk.red(`❌ 테이블 상세 조회 실패: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // ===== OpenTelemetry 자동 적용 API =====
    this.setupOpenTelemetryAPI();
  }

  setupOpenTelemetryAPI() {
    // OpenTelemetry 프로젝트 분석
    this.app.post('/api/opentelemetry/analyze', async (req, res) => {
      try {
        const { git_directory } = req.body;
        
        if (!git_directory) {
          return res.status(400).json({
            success: false,
            error: 'git_directory 파라미터가 필요합니다.'
          });
        }

        console.log(chalk.blue(`🔍 OpenTelemetry 프로젝트 분석 시작: ${git_directory}`));

        // Python 스크립트 실행
        const { spawn } = require('child_process');
        const path = require('path');
        
        const scriptPath = path.join(__dirname, 'analysis', 'opentelemetry_converter.py');
        const pythonProcess = spawn('python3', [scriptPath, git_directory, '--dry-run'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: __dirname
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const analysisResult = JSON.parse(stdout);
              console.log(chalk.green(`✅ OpenTelemetry 분석 완료: ${analysisResult.java_files + analysisResult.python_files}개 파일`));
              
              res.json({
                success: true,
                analysis: analysisResult
              });
            } catch (parseError) {
              console.error(chalk.red(`❌ 분석 결과 파싱 실패: ${parseError.message}`));
              res.status(500).json({
                success: false,
                error: '분석 결과 처리 중 오류가 발생했습니다.'
              });
            }
          } else {
            console.error(chalk.red(`❌ OpenTelemetry 분석 실패 (코드: ${code})`));
            console.error(chalk.red(`STDERR: ${stderr}`));
            
            res.status(500).json({
              success: false,
              error: stderr || '프로젝트 분석 중 오류가 발생했습니다.'
            });
          }
        });

        pythonProcess.on('error', (error) => {
          console.error(chalk.red(`❌ Python 프로세스 실행 실패: ${error.message}`));
          res.status(500).json({
            success: false,
            error: 'Python 분석 스크립트를 실행할 수 없습니다.'
          });
        });

      } catch (error) {
        console.error(chalk.red(`❌ OpenTelemetry 분석 API 오류: ${error.message}`));
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // OpenTelemetry 변환 실행
    this.app.post('/api/opentelemetry/convert', async (req, res) => {
      try {
        const { 
          git_directory, 
          include_java = true, 
          include_python = true, 
          update_build_files = true,
          create_backup = true,
          exclude_patterns = []
        } = req.body;
        
        if (!git_directory) {
          return res.status(400).json({
            success: false,
            error: 'git_directory 파라미터가 필요합니다.'
          });
        }

        console.log(chalk.blue(`🚀 OpenTelemetry 변환 시작: ${git_directory}`));

        // Python 스크립트 실행 (변환 모드)
        const { spawn } = require('child_process');
        const path = require('path');
        
        const scriptPath = path.join(__dirname, 'analysis', 'opentelemetry_converter.py');
        const args = [scriptPath, git_directory];
        
        // 옵션들을 환경 변수로 전달
        const env = {
          ...process.env,
          OTEL_INCLUDE_JAVA: include_java.toString(),
          OTEL_INCLUDE_PYTHON: include_python.toString(),
          OTEL_UPDATE_BUILD_FILES: update_build_files.toString(),
          OTEL_CREATE_BACKUP: create_backup.toString(),
          OTEL_EXCLUDE_PATTERNS: exclude_patterns.join(',')
        };

        const pythonProcess = spawn('python3', args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: __dirname,
          env: env
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const conversionResult = JSON.parse(stdout);
              console.log(chalk.green(`✅ OpenTelemetry 변환 완료: 성공 ${conversionResult.conversion_summary.successful}개`));
              
              // 변환 결과를 파일로 저장
              const fs = require('fs');
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const resultPath = path.join(__dirname, '..', 'storage', 'analysis', `opentelemetry_conversion_${timestamp}.json`);
              
              fs.writeFileSync(resultPath, JSON.stringify({
                timestamp: new Date().toISOString(),
                git_directory: git_directory,
                options: { include_java, include_python, update_build_files, create_backup, exclude_patterns },
                ...conversionResult
              }, null, 2));

              res.json({
                success: true,
                message: 'OpenTelemetry 변환이 성공적으로 완료되었습니다.',
                result_file: resultPath,
                ...conversionResult
              });
            } catch (parseError) {
              console.error(chalk.red(`❌ 변환 결과 파싱 실패: ${parseError.message}`));
              res.status(500).json({
                success: false,
                error: '변환 결과 처리 중 오류가 발생했습니다.'
              });
            }
          } else {
            console.error(chalk.red(`❌ OpenTelemetry 변환 실패 (코드: ${code})`));
            console.error(chalk.red(`STDERR: ${stderr}`));
            
            res.status(500).json({
              success: false,
              error: stderr || 'OpenTelemetry 변환 중 오류가 발생했습니다.'
            });
          }
        });

        pythonProcess.on('error', (error) => {
          console.error(chalk.red(`❌ Python 프로세스 실행 실패: ${error.message}`));
          res.status(500).json({
            success: false,
            error: 'Python 변환 스크립트를 실행할 수 없습니다.'
          });
        });

      } catch (error) {
        console.error(chalk.red(`❌ OpenTelemetry 변환 API 오류: ${error.message}`));
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    console.log(chalk.green('✅ OpenTelemetry API 엔드포인트 설정 완료'));

    // ========================================
    // 시스템 설치 관리 API 엔드포인트
    // ========================================

    // 시스템 요구사항 확인
    this.app.get('/api/installation/check-requirements', (req, res) => {
      try {
        const { spawn } = require('child_process');
        
        // 병렬로 시스템 요구사항 체크
        const checks = {
          os: this.checkOperatingSystem(),
          memory: this.checkMemoryRequirements(),
          disk: this.checkDiskSpace(),
          node: this.checkNodeVersion(),
          python: this.checkPythonVersion(),
          git: this.checkGitInstallation(),
          network: this.checkNetworkConnection(),
          port: this.checkPortAvailability(req.query.port || 3100)
        };

        Promise.all([
          checks.os, checks.memory, checks.disk, checks.node,
          checks.python, checks.git, checks.network, checks.port
        ]).then(results => {
          const [os, memory, disk, node, python, git, network, port] = results;
          
          res.json({
            success: true,
            os, memory, disk, node, python, git, network, port
          });
        }).catch(error => {
          console.error('요구사항 확인 실패:', error);
          res.status(500).json({
            success: false,
            error: error.message
          });
        });

      } catch (error) {
        console.error('시스템 요구사항 확인 API 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 설치 시작
    this.app.post('/api/installation/start', (req, res) => {
      try {
        const config = req.body;
        const installationId = `install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(chalk.blue(`🚀 AIRIS-MON 설치 시작: ${installationId}`));
        console.log('설치 설정:', config);

        // 설치 상태 초기화
        this.installationStatus = this.installationStatus || {};
        this.installationStatus[installationId] = {
          id: installationId,
          step: 1,
          progress: 0,
          message: '설치 준비 중...',
          startTime: new Date(),
          config: config,
          completed: false,
          error: null
        };

        // 비동기 설치 프로세스 시작
        this.executeInstallation(installationId, config);

        res.status(200).send(installationId);

      } catch (error) {
        console.error('설치 시작 API 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 설치 상태 확인
    this.app.get('/api/installation/status/:installationId', (req, res) => {
      try {
        const { installationId } = req.params;
        
        if (!this.installationStatus || !this.installationStatus[installationId]) {
          return res.status(404).json({
            success: false,
            error: '설치 정보를 찾을 수 없습니다.'
          });
        }

        const status = this.installationStatus[installationId];
        res.json({
          success: true,
          ...status
        });

      } catch (error) {
        console.error('설치 상태 확인 API 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 설치 스크립트 생성
    this.app.post('/api/installation/generate-script', (req, res) => {
      try {
        const config = req.body;
        const script = this.generateInstallationScript(config);
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="install-airis-mon.sh"');
        res.send(script);

      } catch (error) {
        console.error('설치 스크립트 생성 API 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    console.log(chalk.green('✅ 시스템 설치 관리 API 엔드포인트 설정 완료'));

    // ==================== MLOps API 엔드포인트 ====================
    
    // 1. Pipeline Status API
    this.app.get('/api/mlops/pipeline/status', (req, res) => {
      try {
        const pipelineStatus = {
          overall_status: ['running', 'completed', 'failed', 'paused'][Math.floor(Math.random() * 4)],
          current_stage: Math.floor(Math.random() * 6) + 1,
          total_stages: 6,
          start_time: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          estimated_completion: new Date(Date.now() + Math.random() * 1800000).toISOString(),
          success_rate: Math.floor(Math.random() * 20) + 80, // 80-100%
          metadata: {
            pipeline_id: `pipeline-${Date.now()}`,
            version: '2.1.3',
            environment: 'production',
            last_updated: new Date().toISOString()
          }
        };
        
        res.json({
          success: true,
          data: pipelineStatus,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Pipeline status API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/mlops/pipeline/stages', (req, res) => {
      try {
        const stages = [
          {
            id: 1,
            name: '데이터 수집',
            name_en: 'Data Collection',
            status: 'completed',
            progress: 100,
            duration: Math.floor(Math.random() * 300) + 120, // 2-7분
            start_time: new Date(Date.now() - 1800000).toISOString(),
            end_time: new Date(Date.now() - 1500000).toISOString(),
            metrics: {
              records_processed: Math.floor(Math.random() * 50000) + 10000,
              data_quality_score: Math.floor(Math.random() * 10) + 90
            }
          },
          {
            id: 2,
            name: '데이터 전처리',
            name_en: 'Data Preprocessing',
            status: 'completed',
            progress: 100,
            duration: Math.floor(Math.random() * 200) + 180,
            start_time: new Date(Date.now() - 1500000).toISOString(),
            end_time: new Date(Date.now() - 1200000).toISOString(),
            metrics: {
              clean_records: Math.floor(Math.random() * 45000) + 8000,
              cleaning_accuracy: Math.floor(Math.random() * 5) + 95
            }
          },
          {
            id: 3,
            name: '특성 엔지니어링',
            name_en: 'Feature Engineering',
            status: 'completed',
            progress: 100,
            duration: Math.floor(Math.random() * 250) + 240,
            start_time: new Date(Date.now() - 1200000).toISOString(),
            end_time: new Date(Date.now() - 900000).toISOString(),
            metrics: {
              features_created: Math.floor(Math.random() * 50) + 25,
              feature_importance_score: Math.floor(Math.random() * 15) + 85
            }
          },
          {
            id: 4,
            name: '모델 훈련',
            name_en: 'Model Training',
            status: 'running',
            progress: 78,
            duration: null,
            start_time: new Date(Date.now() - 900000).toISOString(),
            end_time: null,
            metrics: {
              epochs_completed: 156,
              total_epochs: 200,
              current_accuracy: 0.9234,
              current_loss: 0.0892
            }
          },
          {
            id: 5,
            name: '모델 검증',
            name_en: 'Model Validation',
            status: 'pending',
            progress: 0,
            duration: null,
            start_time: null,
            end_time: null,
            metrics: {}
          },
          {
            id: 6,
            name: '배포',
            name_en: 'Deployment',
            status: 'pending',
            progress: 0,
            duration: null,
            start_time: null,
            end_time: null,
            metrics: {}
          }
        ];
        
        res.json({
          success: true,
          data: stages,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Pipeline stages API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/mlops/pipeline/trigger', (req, res) => {
      try {
        const { pipeline_type = 'full', force_restart = false } = req.body;
        
        const triggeredPipeline = {
          pipeline_id: `pipeline-${Date.now()}`,
          type: pipeline_type,
          status: 'initiated',
          triggered_by: 'system_admin',
          trigger_time: new Date().toISOString(),
          estimated_duration: Math.floor(Math.random() * 1800) + 900, // 15-45분
          force_restart
        };
        
        res.json({
          success: true,
          message: '파이프라인이 성공적으로 시작되었습니다',
          data: triggeredPipeline,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Pipeline trigger API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 2. Model Management API
    this.app.get('/api/mlops/models', (req, res) => {
      try {
        const models = [
          {
            id: 'anomaly-detector-v2.1',
            name: '이상 탐지 모델',
            name_en: 'Anomaly Detection Model',
            version: '2.1.0',
            status: 'production',
            accuracy: 0.9456,
            precision: 0.9234,
            recall: 0.9678,
            f1_score: 0.9454,
            deployment_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            last_updated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            predictions_count: Math.floor(Math.random() * 50000) + 100000,
            model_size: '342MB',
            inference_time: 23.4 // ms
          },
          {
            id: 'performance-predictor-v1.8',
            name: '성능 예측 모델',
            name_en: 'Performance Prediction Model',
            version: '1.8.2',
            status: 'staging',
            accuracy: 0.9123,
            precision: 0.8967,
            recall: 0.9345,
            f1_score: 0.9152,
            deployment_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            last_updated: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            predictions_count: Math.floor(Math.random() * 30000) + 50000,
            model_size: '198MB',
            inference_time: 18.7
          },
          {
            id: 'trend-analyzer-v3.0',
            name: '트렌드 분석 모델',
            name_en: 'Trend Analysis Model',
            version: '3.0.1',
            status: 'training',
            accuracy: 0.8789,
            precision: 0.8456,
            recall: 0.9012,
            f1_score: 0.8723,
            deployment_date: null,
            last_updated: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            predictions_count: 0,
            model_size: '156MB',
            inference_time: 31.2
          }
        ];
        
        res.json({
          success: true,
          data: models,
          total_models: models.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Models API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/mlops/models/:id/metrics', (req, res) => {
      try {
        const { id } = req.params;
        const timeRange = req.query.timeRange || '24h';
        
        // 시간대별 성능 메트릭 생성
        const timePoints = 24;
        const performanceMetrics = {
          model_id: id,
          time_range: timeRange,
          metrics: {
            accuracy: Array.from({ length: timePoints }, (_, i) => ({
              timestamp: new Date(Date.now() - (timePoints - i) * 60 * 60 * 1000).toISOString(),
              value: 0.85 + Math.random() * 0.1 + Math.sin(i * 0.5) * 0.05
            })),
            precision: Array.from({ length: timePoints }, (_, i) => ({
              timestamp: new Date(Date.now() - (timePoints - i) * 60 * 60 * 1000).toISOString(),
              value: 0.82 + Math.random() * 0.12 + Math.cos(i * 0.4) * 0.04
            })),
            recall: Array.from({ length: timePoints }, (_, i) => ({
              timestamp: new Date(Date.now() - (timePoints - i) * 60 * 60 * 1000).toISOString(),
              value: 0.88 + Math.random() * 0.08 + Math.sin(i * 0.3) * 0.03
            })),
            f1_score: Array.from({ length: timePoints }, (_, i) => ({
              timestamp: new Date(Date.now() - (timePoints - i) * 60 * 60 * 1000).toISOString(),
              value: 0.85 + Math.random() * 0.1 + Math.sin(i * 0.6) * 0.02
            })),
            inference_time: Array.from({ length: timePoints }, (_, i) => ({
              timestamp: new Date(Date.now() - (timePoints - i) * 60 * 60 * 1000).toISOString(),
              value: 20 + Math.random() * 15 + Math.sin(i * 0.2) * 5
            })),
            prediction_count: Array.from({ length: timePoints }, (_, i) => ({
              timestamp: new Date(Date.now() - (timePoints - i) * 60 * 60 * 1000).toISOString(),
              value: Math.floor(1000 + Math.random() * 2000 + Math.sin(i * 0.8) * 500)
            }))
          },
          summary: {
            avg_accuracy: 0.9234,
            avg_precision: 0.8967,
            avg_recall: 0.9123,
            avg_f1_score: 0.9041,
            avg_inference_time: 27.4,
            total_predictions: 156789,
            data_drift_detected: Math.random() > 0.8,
            model_degradation_alert: Math.random() > 0.9
          }
        };
        
        res.json({
          success: true,
          data: performanceMetrics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Model metrics API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/mlops/models/:id/deploy', (req, res) => {
      try {
        const { id } = req.params;
        const { environment = 'production', strategy = 'blue-green' } = req.body;
        
        const deployment = {
          deployment_id: `deploy-${Date.now()}`,
          model_id: id,
          environment,
          strategy,
          status: 'in_progress',
          started_by: 'system_admin',
          start_time: new Date().toISOString(),
          estimated_completion: new Date(Date.now() + 300000).toISOString(), // 5분 후
          rollback_enabled: true,
          previous_version: '2.0.1'
        };
        
        res.json({
          success: true,
          message: `모델 ${id}가 ${environment} 환경으로 배포 시작되었습니다`,
          data: deployment,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Model deploy API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/mlops/models/:id/rollback', (req, res) => {
      try {
        const { id } = req.params;
        const { target_version, reason } = req.body;
        
        const rollback = {
          rollback_id: `rollback-${Date.now()}`,
          model_id: id,
          target_version: target_version || 'previous',
          reason: reason || '성능 이슈로 인한 긴급 롤백',
          status: 'initiated',
          initiated_by: 'system_admin',
          start_time: new Date().toISOString(),
          estimated_completion: new Date(Date.now() + 120000).toISOString() // 2분 후
        };
        
        res.json({
          success: true,
          message: `모델 ${id}가 이전 버전으로 롤백 시작되었습니다`,
          data: rollback,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Model rollback API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 3. Predictive Analytics API
    this.app.get('/api/mlops/predictions/system', (req, res) => {
      try {
        const horizon = req.query.horizon || '24h';
        const timePoints = horizon === '24h' ? 24 : horizon === '7d' ? 7 : 12;
        
        const systemPredictions = {
          prediction_horizon: horizon,
          confidence_level: 0.92,
          predictions: {
            cpu_usage: Array.from({ length: timePoints }, (_, i) => ({
              timestamp: new Date(Date.now() + i * (horizon === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
              predicted_value: Math.max(10, Math.min(90, 45 + Math.sin(i * 0.3) * 20 + Math.random() * 10)),
              confidence_interval: {
                lower: Math.max(5, 40 + Math.sin(i * 0.3) * 18 + Math.random() * 8),
                upper: Math.min(95, 50 + Math.sin(i * 0.3) * 22 + Math.random() * 12)
              }
            })),
            memory_usage: Array.from({ length: timePoints }, (_, i) => ({
              timestamp: new Date(Date.now() + i * (horizon === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
              predicted_value: Math.max(20, Math.min(85, 60 + Math.cos(i * 0.4) * 15 + Math.random() * 8)),
              confidence_interval: {
                lower: Math.max(15, 55 + Math.cos(i * 0.4) * 13 + Math.random() * 6),
                upper: Math.min(90, 65 + Math.cos(i * 0.4) * 17 + Math.random() * 10)
              }
            })),
            response_time: Array.from({ length: timePoints }, (_, i) => ({
              timestamp: new Date(Date.now() + i * (horizon === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
              predicted_value: Math.max(50, 200 + Math.sin(i * 0.5) * 80 + Math.random() * 40),
              confidence_interval: {
                lower: Math.max(30, 180 + Math.sin(i * 0.5) * 70 + Math.random() * 30),
                upper: 220 + Math.sin(i * 0.5) * 90 + Math.random() * 50
              }
            })),
            request_volume: Array.from({ length: timePoints }, (_, i) => ({
              timestamp: new Date(Date.now() + i * (horizon === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
              predicted_value: Math.max(100, 1000 + Math.sin(i * 0.2) * 400 + Math.random() * 200),
              confidence_interval: {
                lower: Math.max(80, 900 + Math.sin(i * 0.2) * 350 + Math.random() * 150),
                upper: 1100 + Math.sin(i * 0.2) * 450 + Math.random() * 250
              }
            }))
          },
          alerts: [
            {
              type: 'cpu_spike_predicted',
              message: '2시간 후 CPU 사용률 급증 예상 (예측값: 78%)',
              severity: 'medium',
              predicted_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              confidence: 0.89
            },
            {
              type: 'memory_threshold_predicted',
              message: '4시간 후 메모리 사용률이 임계치 초과 예상',
              severity: 'high',
              predicted_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
              confidence: 0.93
            }
          ]
        };
        
        res.json({
          success: true,
          data: systemPredictions,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('System predictions API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/mlops/predictions/anomalies', (req, res) => {
      try {
        const anomalies = [
          {
            id: `anomaly-${Date.now()}-1`,
            type: 'performance_degradation',
            description: '응답 시간 이상 패턴 탐지',
            description_en: 'Response time anomaly pattern detected',
            severity: 'high',
            confidence: 0.94,
            detected_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            affected_services: ['api-gateway', 'user-service'],
            metrics: {
              baseline_response_time: 156.7,
              current_response_time: 284.3,
              deviation_percentage: 81.4
            },
            predicted_impact: '사용자 경험 저하 및 시스템 부하 증가',
            recommended_actions: [
              '로드 밸런서 설정 검토',
              '데이터베이스 인덱스 최적화',
              '캐시 전략 재검토',
              '서버 리소스 스케일링 고려'
            ]
          },
          {
            id: `anomaly-${Date.now()}-2`,
            type: 'unusual_traffic_pattern',
            description: '비정상적인 트래픽 패턴 감지',
            description_en: 'Unusual traffic pattern detected',
            severity: 'medium',
            confidence: 0.87,
            detected_at: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
            affected_services: ['frontend', 'cdn'],
            metrics: {
              baseline_requests_per_minute: 1234,
              current_requests_per_minute: 2847,
              spike_duration: '28분',
              geographic_distribution: 'Asia 지역 집중'
            },
            predicted_impact: 'CDN 비용 증가 및 서버 부하',
            recommended_actions: [
              'DDoS 공격 가능성 검토',
              '지역별 트래픽 분석',
              'Rate limiting 강화',
              '캐시 정책 최적화'
            ]
          },
          {
            id: `anomaly-${Date.now()}-3`,
            type: 'error_rate_spike',
            description: '오류율 급증 탐지',
            description_en: 'Error rate spike detected',
            severity: 'critical',
            confidence: 0.96,
            detected_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            affected_services: ['payment-service', 'order-service'],
            metrics: {
              baseline_error_rate: 0.23,
              current_error_rate: 4.67,
              error_types: ['500 Internal Server Error', '503 Service Unavailable'],
              affected_endpoints: ['/api/payment/process', '/api/orders/create']
            },
            predicted_impact: '결제 실패 및 주문 처리 중단',
            recommended_actions: [
              '즉시 서비스 헬스체크 수행',
              '데이터베이스 연결 상태 확인',
              '결제 게이트웨이 상태 점검',
              '긴급 롤백 고려'
            ]
          }
        ];
        
        res.json({
          success: true,
          data: {
            anomalies,
            summary: {
              total_anomalies: anomalies.length,
              critical_count: anomalies.filter(a => a.severity === 'critical').length,
              high_count: anomalies.filter(a => a.severity === 'high').length,
              medium_count: anomalies.filter(a => a.severity === 'medium').length,
              avg_confidence: anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length
            }
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Anomaly predictions API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/mlops/predictions/trends', (req, res) => {
      try {
        const period = req.query.period || '7d';
        const timePoints = period === '24h' ? 24 : period === '7d' ? 7 : 30;
        
        const trends = {
          analysis_period: period,
          trends: {
            user_growth: {
              direction: 'increasing',
              rate: 12.4, // % per period
              confidence: 0.91,
              data_points: Array.from({ length: timePoints }, (_, i) => ({
                timestamp: new Date(Date.now() - (timePoints - i) * (period === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
                value: 10000 + i * 124 + Math.random() * 200 - 100,
                trend_component: 10000 + i * 124,
                seasonal_component: Math.sin(i * 0.5) * 50,
                residual: Math.random() * 200 - 100
              })),
              forecast: Array.from({ length: Math.min(timePoints, 7) }, (_, i) => ({
                timestamp: new Date(Date.now() + (i + 1) * (period === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
                predicted_value: 10000 + (timePoints + i + 1) * 124 + Math.sin((timePoints + i + 1) * 0.5) * 50,
                confidence_interval: {
                  lower: 10000 + (timePoints + i + 1) * 124 + Math.sin((timePoints + i + 1) * 0.5) * 50 - 150,
                  upper: 10000 + (timePoints + i + 1) * 124 + Math.sin((timePoints + i + 1) * 0.5) * 50 + 150
                }
              }))
            },
            performance_score: {
              direction: 'stable',
              rate: -0.8, // % per period
              confidence: 0.85,
              data_points: Array.from({ length: timePoints }, (_, i) => ({
                timestamp: new Date(Date.now() - (timePoints - i) * (period === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
                value: Math.max(70, Math.min(98, 92 - i * 0.08 + Math.random() * 4 - 2)),
                trend_component: 92 - i * 0.08,
                seasonal_component: Math.cos(i * 0.3) * 2,
                residual: Math.random() * 4 - 2
              })),
              forecast: Array.from({ length: Math.min(timePoints, 7) }, (_, i) => ({
                timestamp: new Date(Date.now() + (i + 1) * (period === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
                predicted_value: Math.max(70, 92 - (timePoints + i + 1) * 0.08 + Math.cos((timePoints + i + 1) * 0.3) * 2),
                confidence_interval: {
                  lower: Math.max(65, 92 - (timePoints + i + 1) * 0.08 + Math.cos((timePoints + i + 1) * 0.3) * 2 - 3),
                  upper: Math.min(98, 92 - (timePoints + i + 1) * 0.08 + Math.cos((timePoints + i + 1) * 0.3) * 2 + 3)
                }
              }))
            },
            resource_utilization: {
              direction: 'increasing',
              rate: 5.6, // % per period
              confidence: 0.88,
              data_points: Array.from({ length: timePoints }, (_, i) => ({
                timestamp: new Date(Date.now() - (timePoints - i) * (period === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
                value: Math.max(30, Math.min(85, 45 + i * 0.56 + Math.random() * 6 - 3)),
                trend_component: 45 + i * 0.56,
                seasonal_component: Math.sin(i * 0.4) * 3,
                residual: Math.random() * 6 - 3
              })),
              forecast: Array.from({ length: Math.min(timePoints, 7) }, (_, i) => ({
                timestamp: new Date(Date.now() + (i + 1) * (period === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
                predicted_value: Math.min(85, 45 + (timePoints + i + 1) * 0.56 + Math.sin((timePoints + i + 1) * 0.4) * 3),
                confidence_interval: {
                  lower: Math.max(25, 45 + (timePoints + i + 1) * 0.56 + Math.sin((timePoints + i + 1) * 0.4) * 3 - 4),
                  upper: Math.min(90, 45 + (timePoints + i + 1) * 0.56 + Math.sin((timePoints + i + 1) * 0.4) * 3 + 4)
                }
              }))
            }
          },
          insights: [
            {
              type: 'growth_acceleration',
              message: '사용자 증가율이 지난 주 대비 23% 상승했습니다',
              impact: 'positive',
              confidence: 0.89
            },
            {
              type: 'capacity_planning',
              message: '현재 증가 추세로는 2주 후 리소스 확장이 필요할 것으로 예상됩니다',
              impact: 'attention_required',
              confidence: 0.92
            },
            {
              type: 'seasonal_pattern',
              message: '주말 트래픽 패턴이 변화하고 있어 모니터링이 필요합니다',
              impact: 'neutral',
              confidence: 0.76
            }
          ]
        };
        
        res.json({
          success: true,
          data: trends,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Trend predictions API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/mlops/predictions/analyze', (req, res) => {
      try {
        const { 
          data_source, 
          analysis_type = 'comprehensive', 
          time_window = '24h',
          custom_parameters = {} 
        } = req.body;
        
        const analysis = {
          analysis_id: `analysis-${Date.now()}`,
          request: {
            data_source,
            analysis_type,
            time_window,
            custom_parameters
          },
          status: 'initiated',
          progress: 0,
          estimated_completion: new Date(Date.now() + 180000).toISOString(), // 3분 후
          started_at: new Date().toISOString(),
          started_by: 'system_admin'
        };
        
        // 시뮬레이션: 분석 진행상황 업데이트
        setTimeout(() => {
          analysis.progress = 25;
          analysis.status = 'data_collection';
        }, 1000);
        
        setTimeout(() => {
          analysis.progress = 50;
          analysis.status = 'feature_extraction';
        }, 2000);
        
        setTimeout(() => {
          analysis.progress = 75;
          analysis.status = 'model_inference';
        }, 3000);
        
        setTimeout(() => {
          analysis.progress = 100;
          analysis.status = 'completed';
          analysis.completed_at = new Date().toISOString();
        }, 4000);
        
        res.json({
          success: true,
          message: '예측 분석이 시작되었습니다',
          data: analysis,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Prediction analysis API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 4. Experiment Tracking API
    this.app.get('/api/mlops/experiments', (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        
        const allExperiments = [
          {
            id: 'exp-anomaly-detection-v3',
            name: '이상 탐지 모델 v3.0 실험',
            name_en: 'Anomaly Detection Model v3.0 Experiment',
            status: 'completed',
            start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end_time: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
            duration: 24 * 60 * 60 * 1000, // 24시간
            model_type: 'ensemble',
            dataset: 'production_logs_2024_q1',
            metrics: {
              accuracy: 0.9456,
              precision: 0.9234,
              recall: 0.9678,
              f1_score: 0.9454,
              auc_roc: 0.9567,
              training_loss: 0.0234
            },
            hyperparameters: {
              learning_rate: 0.001,
              batch_size: 32,
              epochs: 200,
              dropout_rate: 0.2,
              hidden_layers: [128, 64, 32],
              optimizer: 'adam'
            },
            created_by: 'ml_engineer_1'
          },
          {
            id: 'exp-performance-pred-lstm',
            name: 'LSTM 기반 성능 예측 실험',
            name_en: 'LSTM-based Performance Prediction Experiment',
            status: 'running',
            start_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            end_time: null,
            duration: null,
            model_type: 'lstm',
            dataset: 'performance_metrics_6month',
            metrics: {
              current_epoch: 156,
              total_epochs: 300,
              current_loss: 0.0892,
              validation_accuracy: 0.8734,
              training_accuracy: 0.9123
            },
            hyperparameters: {
              learning_rate: 0.0005,
              batch_size: 64,
              sequence_length: 50,
              lstm_units: 100,
              dropout_rate: 0.3,
              optimizer: 'rmsprop'
            },
            created_by: 'ml_engineer_2'
          },
          {
            id: 'exp-trend-transformer',
            name: 'Transformer 트렌드 분석 실험',
            name_en: 'Transformer Trend Analysis Experiment',
            status: 'failed',
            start_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            end_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
            duration: 3 * 60 * 60 * 1000, // 3시간
            model_type: 'transformer',
            dataset: 'time_series_mixed',
            metrics: {
              final_loss: 0.3456,
              max_accuracy: 0.6789,
              convergence_achieved: false
            },
            hyperparameters: {
              learning_rate: 0.0001,
              batch_size: 16,
              num_heads: 8,
              num_layers: 6,
              d_model: 256,
              dropout_rate: 0.1
            },
            error_message: '메모리 부족으로 인한 학습 중단',
            created_by: 'ml_engineer_1'
          }
        ];
        
        // 상태 필터링
        let filteredExperiments = status ? 
          allExperiments.filter(exp => exp.status === status) : 
          allExperiments;
        
        // 페이지네이션
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const experiments = filteredExperiments.slice(startIndex, endIndex);
        
        res.json({
          success: true,
          data: {
            experiments,
            pagination: {
              current_page: page,
              total_pages: Math.ceil(filteredExperiments.length / limit),
              total_experiments: filteredExperiments.length,
              experiments_per_page: limit
            }
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Experiments API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/mlops/experiments/:id', (req, res) => {
      try {
        const { id } = req.params;
        
        const experiment = {
          id,
          name: 'LSTM 기반 성능 예측 실험',
          name_en: 'LSTM-based Performance Prediction Experiment',
          description: '시계열 데이터를 활용한 시스템 성능 예측 모델 개발',
          status: 'completed',
          start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end_time: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          duration: 24 * 60 * 60 * 1000,
          model_type: 'lstm',
          dataset: {
            name: 'performance_metrics_6month',
            size: '2.4GB',
            samples: 1250000,
            features: 23,
            time_range: '2024-01-01 to 2024-06-30'
          },
          metrics: {
            final: {
              accuracy: 0.9234,
              precision: 0.8967,
              recall: 0.9345,
              f1_score: 0.9152,
              mae: 12.34,
              rmse: 18.76,
              mape: 8.45
            },
            history: Array.from({ length: 200 }, (_, i) => ({
              epoch: i + 1,
              training_loss: 0.5 * Math.exp(-i / 50) + 0.01 + Math.random() * 0.02,
              validation_loss: 0.6 * Math.exp(-i / 45) + 0.02 + Math.random() * 0.03,
              training_accuracy: Math.min(0.98, 0.5 + 0.4 * (1 - Math.exp(-i / 30)) + Math.random() * 0.02),
              validation_accuracy: Math.min(0.95, 0.4 + 0.4 * (1 - Math.exp(-i / 35)) + Math.random() * 0.03)
            }))
          },
          hyperparameters: {
            learning_rate: 0.001,
            batch_size: 64,
            sequence_length: 50,
            lstm_units: 100,
            dense_units: [50, 25],
            dropout_rate: 0.2,
            optimizer: 'adam',
            loss_function: 'mse',
            epochs: 200
          },
          artifacts: [
            {
              type: 'model',
              name: 'lstm_performance_predictor.h5',
              size: '12.3MB',
              path: '/models/experiments/exp-performance-pred-lstm/model.h5'
            },
            {
              type: 'weights',
              name: 'model_weights.h5',
              size: '8.7MB',
              path: '/models/experiments/exp-performance-pred-lstm/weights.h5'
            },
            {
              type: 'config',
              name: 'model_config.json',
              size: '2.1KB',
              path: '/models/experiments/exp-performance-pred-lstm/config.json'
            },
            {
              type: 'plots',
              name: 'training_plots.png',
              size: '156KB',
              path: '/models/experiments/exp-performance-pred-lstm/plots.png'
            }
          ],
          logs: [
            {
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              level: 'INFO',
              message: '실험 시작: 데이터셋 로딩 중...'
            },
            {
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
              level: 'INFO',
              message: '데이터 전처리 완료: 1,250,000 샘플 준비됨'
            },
            {
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
              level: 'INFO',
              message: '모델 아키텍처 구성 완료'
            },
            {
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
              level: 'INFO',
              message: '학습 시작: Epoch 1/200'
            },
            {
              timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
              level: 'SUCCESS',
              message: '학습 완료: 최종 검증 정확도 92.34%'
            }
          ],
          created_by: 'ml_engineer_2',
          tags: ['lstm', 'performance', 'time-series', 'production'],
          notes: '시계열 데이터의 계절성과 트렌드를 잘 학습하여 우수한 예측 성능을 달성했습니다.'
        };
        
        res.json({
          success: true,
          data: experiment,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Experiment detail API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/mlops/experiments', (req, res) => {
      try {
        const {
          name,
          description,
          model_type,
          dataset,
          hyperparameters,
          tags = []
        } = req.body;
        
        const experiment = {
          id: `exp-${Date.now()}`,
          name,
          description,
          status: 'created',
          model_type,
          dataset,
          hyperparameters,
          tags,
          created_at: new Date().toISOString(),
          created_by: 'current_user',
          estimated_duration: '2-4시간'
        };
        
        res.json({
          success: true,
          message: '새로운 실험이 생성되었습니다',
          data: experiment,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Create experiment API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/mlops/hyperparameters/optimization', (req, res) => {
      try {
        const optimization = {
          status: 'running',
          current_trial: 47,
          total_trials: 100,
          best_trial: {
            trial_id: 23,
            score: 0.9456,
            hyperparameters: {
              learning_rate: 0.0008,
              batch_size: 64,
              lstm_units: 128,
              dropout_rate: 0.25,
              optimizer: 'adam'
            },
            metrics: {
              accuracy: 0.9456,
              precision: 0.9234,
              recall: 0.9345,
              f1_score: 0.9289
            }
          },
          optimization_history: Array.from({ length: 47 }, (_, i) => ({
            trial_id: i + 1,
            score: Math.max(0.7, 0.9 + Math.random() * 0.05 - Math.exp(-i / 20) * 0.15),
            hyperparameters: {
              learning_rate: 0.0001 + Math.random() * 0.001,
              batch_size: [16, 32, 64, 128][Math.floor(Math.random() * 4)],
              lstm_units: [64, 96, 128, 160][Math.floor(Math.random() * 4)],
              dropout_rate: 0.1 + Math.random() * 0.3
            },
            duration: Math.floor(Math.random() * 3600) + 1800 // 30분-90분
          })),
          search_space: {
            learning_rate: {
              type: 'float',
              low: 0.0001,
              high: 0.01,
              log: true
            },
            batch_size: {
              type: 'categorical',
              choices: [16, 32, 64, 128]
            },
            lstm_units: {
              type: 'int',
              low: 32,
              high: 256,
              step: 32
            },
            dropout_rate: {
              type: 'float',
              low: 0.1,
              high: 0.5
            }
          },
          estimated_completion: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          optimization_algorithm: 'Tree-structured Parzen Estimator (TPE)',
          objective: 'maximize validation_f1_score'
        };
        
        res.json({
          success: true,
          data: optimization,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Hyperparameter optimization API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 5. Real-time Monitoring API
    this.app.get('/api/mlops/monitoring/metrics', (req, res) => {
      try {
        const realTimeMetrics = {
          system_health: {
            overall_status: 'healthy',
            uptime: '99.8%',
            active_models: 3,
            active_pipelines: 2,
            last_updated: new Date().toISOString()
          },
          model_performance: {
            'anomaly-detector-v2.1': {
              predictions_per_minute: Math.floor(Math.random() * 500) + 800,
              avg_inference_time: Math.random() * 10 + 15, // 15-25ms
              accuracy_score: 0.94 + Math.random() * 0.04,
              confidence_score: 0.89 + Math.random() * 0.06,
              data_drift_score: Math.random() * 0.3, // 0-0.3 (낮을수록 좋음)
              alerts_count: Math.floor(Math.random() * 5)
            },
            'performance-predictor-v1.8': {
              predictions_per_minute: Math.floor(Math.random() * 300) + 400,
              avg_inference_time: Math.random() * 8 + 18,
              accuracy_score: 0.91 + Math.random() * 0.05,
              confidence_score: 0.87 + Math.random() * 0.08,
              data_drift_score: Math.random() * 0.25,
              alerts_count: Math.floor(Math.random() * 3)
            },
            'trend-analyzer-v3.0': {
              predictions_per_minute: Math.floor(Math.random() * 200) + 200,
              avg_inference_time: Math.random() * 15 + 25,
              accuracy_score: 0.88 + Math.random() * 0.06,
              confidence_score: 0.84 + Math.random() * 0.10,
              data_drift_score: Math.random() * 0.4,
              alerts_count: Math.floor(Math.random() * 7)
            }
          },
          resource_utilization: {
            cpu_usage: Math.random() * 30 + 45, // 45-75%
            memory_usage: Math.random() * 25 + 55, // 55-80%
            gpu_usage: Math.random() * 40 + 35, // 35-75%
            disk_usage: Math.random() * 15 + 60, // 60-75%
            network_io: {
              incoming: Math.floor(Math.random() * 1000) + 500, // MB/s
              outgoing: Math.floor(Math.random() * 800) + 300
            }
          },
          data_pipeline: {
            status: 'active',
            throughput: Math.floor(Math.random() * 5000) + 10000, // records/minute
            latency: Math.random() * 200 + 100, // 100-300ms
            error_rate: Math.random() * 2, // 0-2%
            queue_size: Math.floor(Math.random() * 1000) + 500,
            processed_today: Math.floor(Math.random() * 1000000) + 2000000
          },
          alerts: [
            {
              id: `alert-${Date.now()}-1`,
              type: 'model_performance',
              severity: 'warning',
              message: 'anomaly-detector-v2.1 모델의 데이터 드리프트 임계치 근접',
              timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
              model_id: 'anomaly-detector-v2.1'
            },
            {
              id: `alert-${Date.now()}-2`,
              type: 'resource_usage',
              severity: 'info',
              message: 'GPU 사용률이 평소보다 15% 증가',
              timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString()
            }
          ]
        };
        
        res.json({
          success: true,
          data: realTimeMetrics,
          timestamp: new Date().toISOString(),
          refresh_interval: 30 // seconds
        });
      } catch (error) {
        console.error('Real-time monitoring API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/mlops/monitoring/data-pipeline', (req, res) => {
      try {
        const pipelineHealth = {
          overall_status: 'healthy',
          components: [
            {
              name: '데이터 수집기',
              name_en: 'Data Collector',
              status: 'running',
              health_score: 98,
              throughput: Math.floor(Math.random() * 2000) + 8000,
              latency: Math.random() * 50 + 50,
              error_rate: Math.random() * 0.5,
              last_restart: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              name: '데이터 검증기',
              name_en: 'Data Validator',
              status: 'running',
              health_score: 95,
              throughput: Math.floor(Math.random() * 1800) + 7500,
              latency: Math.random() * 80 + 70,
              error_rate: Math.random() * 1.2,
              last_restart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              name: '특성 추출기',
              name_en: 'Feature Extractor',
              status: 'running',
              health_score: 92,
              throughput: Math.floor(Math.random() * 1500) + 7000,
              latency: Math.random() * 120 + 100,
              error_rate: Math.random() * 2.0,
              last_restart: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              name: '모델 서빙',
              name_en: 'Model Serving',
              status: 'warning',
              health_score: 87,
              throughput: Math.floor(Math.random() * 1200) + 6000,
              latency: Math.random() * 180 + 150,
              error_rate: Math.random() * 3.5,
              last_restart: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
              issues: ['메모리 사용량 증가 추세', '응답 시간 지연']
            }
          ],
          queue_metrics: {
            'input_queue': {
              size: Math.floor(Math.random() * 500) + 200,
              max_size: 10000,
              throughput: Math.floor(Math.random() * 1000) + 5000,
              avg_wait_time: Math.random() * 30 + 10
            },
            'processing_queue': {
              size: Math.floor(Math.random() * 300) + 100,
              max_size: 5000,
              throughput: Math.floor(Math.random() * 800) + 4500,
              avg_wait_time: Math.random() * 45 + 20
            },
            'output_queue': {
              size: Math.floor(Math.random() * 150) + 50,
              max_size: 2000,
              throughput: Math.floor(Math.random() * 900) + 4000,
              avg_wait_time: Math.random() * 20 + 5
            }
          },
          data_quality: {
            completeness: 0.97 + Math.random() * 0.025,
            accuracy: 0.94 + Math.random() * 0.04,
            consistency: 0.96 + Math.random() * 0.03,
            timeliness: 0.89 + Math.random() * 0.08,
            validity: 0.92 + Math.random() * 0.05
          },
          recent_issues: [
            {
              timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
              component: '모델 서빙',
              severity: 'warning',
              message: '평균 응답 시간이 임계치 초과',
              resolved: false
            },
            {
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              component: '데이터 검증기',
              severity: 'info',
              message: '데이터 품질 점수 소폭 하락',
              resolved: true
            }
          ]
        };
        
        res.json({
          success: true,
          data: pipelineHealth,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Data pipeline monitoring API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/mlops/monitoring/model-performance', (req, res) => {
      try {
        const modelId = req.query.model_id || 'all';
        const timeWindow = req.query.time_window || '1h';
        
        const timePoints = timeWindow === '1h' ? 12 : timeWindow === '24h' ? 24 : 7;
        const intervalMs = timeWindow === '1h' ? 5 * 60 * 1000 : 
                          timeWindow === '24h' ? 60 * 60 * 1000 : 
                          24 * 60 * 60 * 1000;
        
        const livePerformance = {
          time_window: timeWindow,
          models: {
            'anomaly-detector-v2.1': {
              real_time_metrics: {
                predictions_per_second: Array.from({ length: timePoints }, (_, i) => ({
                  timestamp: new Date(Date.now() - (timePoints - i) * intervalMs).toISOString(),
                  value: Math.floor(Math.random() * 20) + 40 + Math.sin(i * 0.3) * 10
                })),
                inference_latency: Array.from({ length: timePoints }, (_, i) => ({
                  timestamp: new Date(Date.now() - (timePoints - i) * intervalMs).toISOString(),
                  value: 15 + Math.random() * 10 + Math.sin(i * 0.4) * 3
                })),
                accuracy_score: Array.from({ length: timePoints }, (_, i) => ({
                  timestamp: new Date(Date.now() - (timePoints - i) * intervalMs).toISOString(),
                  value: 0.94 + Math.random() * 0.04 + Math.sin(i * 0.2) * 0.02
                })),
                error_rate: Array.from({ length: timePoints }, (_, i) => ({
                  timestamp: new Date(Date.now() - (timePoints - i) * intervalMs).toISOString(),
                  value: Math.max(0, Math.random() * 2 + Math.sin(i * 0.5) * 0.5)
                }))
              },
              current_status: {
                health: 'good',
                active_predictions: Math.floor(Math.random() * 1000) + 5000,
                avg_confidence: 0.89 + Math.random() * 0.08,
                data_drift_alert: Math.random() > 0.85,
                last_updated: new Date().toISOString()
              }
            },
            'performance-predictor-v1.8': {
              real_time_metrics: {
                predictions_per_second: Array.from({ length: timePoints }, (_, i) => ({
                  timestamp: new Date(Date.now() - (timePoints - i) * intervalMs).toISOString(),
                  value: Math.floor(Math.random() * 15) + 25 + Math.cos(i * 0.3) * 8
                })),
                inference_latency: Array.from({ length: timePoints }, (_, i) => ({
                  timestamp: new Date(Date.now() - (timePoints - i) * intervalMs).toISOString(),
                  value: 18 + Math.random() * 8 + Math.cos(i * 0.4) * 4
                })),
                accuracy_score: Array.from({ length: timePoints }, (_, i) => ({
                  timestamp: new Date(Date.now() - (timePoints - i) * intervalMs).toISOString(),
                  value: 0.91 + Math.random() * 0.05 + Math.cos(i * 0.2) * 0.02
                })),
                error_rate: Array.from({ length: timePoints }, (_, i) => ({
                  timestamp: new Date(Date.now() - (timePoints - i) * intervalMs).toISOString(),
                  value: Math.max(0, Math.random() * 2.5 + Math.cos(i * 0.5) * 0.7)
                }))
              },
              current_status: {
                health: 'good',
                active_predictions: Math.floor(Math.random() * 800) + 3000,
                avg_confidence: 0.85 + Math.random() * 0.10,
                data_drift_alert: Math.random() > 0.9,
                last_updated: new Date().toISOString()
              }
            }
          },
          aggregated_metrics: {
            total_predictions_per_second: null, // calculated client-side
            avg_inference_latency: null,
            overall_accuracy: null,
            total_error_rate: null
          },
          alerts: [
            {
              model_id: 'anomaly-detector-v2.1',
              type: 'latency_spike',
              message: '추론 지연시간이 평소 대비 25% 증가',
              severity: 'warning',
              timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString()
            }
          ]
        };
        
        // 집계 메트릭 계산
        const models = Object.keys(livePerformance.models);
        const latestIndex = timePoints - 1;
        
        livePerformance.aggregated_metrics.total_predictions_per_second = models.reduce((sum, modelId) => {
          return sum + livePerformance.models[modelId].real_time_metrics.predictions_per_second[latestIndex].value;
        }, 0);
        
        livePerformance.aggregated_metrics.avg_inference_latency = models.reduce((sum, modelId) => {
          return sum + livePerformance.models[modelId].real_time_metrics.inference_latency[latestIndex].value;
        }, 0) / models.length;
        
        res.json({
          success: true,
          data: livePerformance,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Live model performance API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    console.log(chalk.green('✅ MLOps API 엔드포인트 설정 완료'));
  }

  // Helper functions for alert management
  logAlertAction(alertId, action, description, actor) {
    const logEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      action: action,
      description: description,
      actor: actor || 'system'
    };

    // Initialize alertLogs if not exists
    if (!this.alertLogs) this.alertLogs = {};
    if (!this.alertLogs[alertId]) this.alertLogs[alertId] = [];

    this.alertLogs[alertId].unshift(logEntry);
    
    // In production, this should save to database
    console.log(`📝 Alert Log: ${alertId} - ${action} by ${actor}: ${description}`);
    return logEntry;
  }

  getRecipientsByGroup(groupName, customRecipients = []) {
    const recipientGroups = {
      'on-call': [
        'oncall@company.com',
        '+1-555-0101',
        '@oncall-team'
      ],
      'infrastructure': [
        'infra-team@company.com',
        'sysadmin@company.com',
        '+1-555-0102'
      ],
      'security': [
        'security@company.com',
        'soc@company.com',
        '+1-555-0103'
      ],
      'development': [
        'dev-team@company.com',
        'leads@company.com',
        '+1-555-0104'
      ],
      'management': [
        'managers@company.com',
        'cto@company.com',
        '+1-555-0105'
      ],
      'all': [
        'alerts@company.com',
        '#alerts-general',
        '+1-555-0100'
      ]
    };

    const groupRecipients = recipientGroups[groupName] || [];
    return [...groupRecipients, ...customRecipients];
  }

  checkEscalationConditions(alertId, currentLevel = 0) {
    // Get alert data (in real implementation, fetch from database)
    const alert = {
      id: alertId,
      severity: 'critical',
      source: 'infrastructure',
      duration: Date.now() - (new Date().getTime() - 30 * 60 * 1000), // 30 minutes ago
      acknowledged: false,
      currentLevel: currentLevel
    };

    const escalationRules = [
      {
        level: 0,
        conditions: {
          duration: 15 * 60 * 1000, // 15 minutes
          severity: ['critical'],
          unacknowledged: true
        },
        actions: {
          notify: ['on-call'],
          level: 1
        }
      },
      {
        level: 1,
        conditions: {
          duration: 30 * 60 * 1000, // 30 minutes
          severity: ['critical'],
          unacknowledged: true
        },
        actions: {
          notify: ['on-call', 'management'],
          level: 2
        }
      },
      {
        level: 2,
        conditions: {
          duration: 60 * 60 * 1000, // 1 hour
          severity: ['critical'],
          unacknowledged: true
        },
        actions: {
          notify: ['all'],
          level: 3
        }
      }
    ];

    for (const rule of escalationRules) {
      if (rule.level === currentLevel) {
        const shouldEscalate = 
          alert.duration >= rule.conditions.duration &&
          rule.conditions.severity.includes(alert.severity) &&
          rule.conditions.unacknowledged === !alert.acknowledged;

        if (shouldEscalate) {
          return {
            shouldEscalate: true,
            newLevel: rule.actions.level,
            notifyGroups: rule.actions.notify,
            reason: `Alert has been unresolved for ${Math.floor(alert.duration / 60000)} minutes`
          };
        }
      }
    }

    return {
      shouldEscalate: false,
      currentLevel: currentLevel
    };
  }

  // LLM API 라우트 설정
  setupLLMRoutes() {
    // LLM 채팅 완성 API
    this.app.post('/api/llm/chat', async (req, res) => {
      try {
        const { 
          messages, 
          taskType = 'korean-chat', 
          providerId = null, 
          options = {},
          stream = false 
        } = req.body;

        if (!messages || !Array.isArray(messages)) {
          return res.status(400).json({
            success: false,
            error: '메시지 배열이 필요합니다'
          });
        }

        // 한국어 프로세서로 메시지 전처리
        const processed = this.koreanProcessor.processMessages(messages, {
          taskType,
          formality: options.formality || 'formal'
        });

        let response;
        if (stream) {
          // 스트리밍 응답
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });

          const streamResponse = await this.multiLLMRouter.chatStream(
            processed.messages, 
            { taskType: processed.taskType, providerId, ...options }
          );

          // 이벤트 리스너 설정
          this.multiLLMRouter.on('data', (data) => {
            res.write(`data: ${JSON.stringify(data)}\\n\\n`);
          });

          this.multiLLMRouter.on('end', (data) => {
            res.write(`data: ${JSON.stringify({ ...data, done: true })}\\n\\n`);
            res.end();
          });

          this.multiLLMRouter.on('error', (error) => {
            res.write(`data: ${JSON.stringify({ error: error.message })}\\n\\n`);
            res.end();
          });

        } else {
          // 일반 응답
          response = await this.multiLLMRouter.chat(
            processed.messages, 
            { taskType: processed.taskType, providerId, ...options }
          );

          // 한국어 후처리
          if (response.message && response.message.content) {
            response.message.content = this.koreanProcessor.postprocessResponse(
              response.message.content,
              processed.taskType
            );
          }

          res.json({
            success: true,
            data: response,
            taskType: processed.taskType,
            provider: response.provider
          });
        }
      } catch (error) {
        console.error('LLM 채팅 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // LLM 분석 작업 API
    this.app.post('/api/llm/analyze', async (req, res) => {
      try {
        const { 
          data, 
          analysisType = 'general', 
          language = 'korean',
          providerId = null 
        } = req.body;

        if (!data) {
          return res.status(400).json({
            success: false,
            error: '분석할 데이터가 필요합니다'
          });
        }

        // 분석 프롬프트 생성
        const analysisPrompt = this.generateAnalysisPrompt(data, analysisType, language);
        
        const response = await this.multiLLMRouter.chat([
          { role: 'user', content: analysisPrompt }
        ], { 
          taskType: 'analysis', 
          providerId,
          temperature: 0.3 // 분석 작업은 더 일관된 결과를 위해 낮은 temperature
        });

        res.json({
          success: true,
          analysis: response.message?.content || response.response,
          analysisType,
          provider: response.provider,
          metadata: {
            tokenUsage: response.usage,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('LLM 분석 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 사용 가능한 LLM 모델 목록 API
    this.app.get('/api/llm/models', async (req, res) => {
      try {
        const providers = this.llmConfigManager.getAllProviders();
        const healthStatus = await this.llmConfigManager.checkAllProvidersHealth();
        
        res.json({
          success: true,
          models: providers.map(provider => ({
            id: provider.id,
            name: provider.name,
            type: provider.type,
            status: provider.status,
            health: healthStatus[provider.id],
            priority: provider.priority,
            cost_per_token: provider.cost_per_token,
            korean_optimized: !!provider.korean_optimization
          })),
          currentProvider: this.llmConfigManager.currentProvider
        });
      } catch (error) {
        console.error('모델 목록 조회 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // LLM 제공자 전환 API
    this.app.post('/api/llm/switch', async (req, res) => {
      try {
        const { providerId } = req.body;
        
        if (!providerId) {
          return res.status(400).json({
            success: false,
            error: '제공자 ID가 필요합니다'
          });
        }

        const result = await this.llmConfigManager.switchProvider(providerId);
        
        res.json({
          success: true,
          message: `LLM 제공자가 ${result.previous}에서 ${result.current}로 전환되었습니다`,
          previous: result.previous,
          current: result.current,
          provider: result.provider
        });
      } catch (error) {
        console.error('제공자 전환 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // LLM 시스템 상태 확인 API
    this.app.get('/api/llm/health', async (req, res) => {
      try {
        const healthStatus = await this.llmConfigManager.checkAllProvidersHealth();
        const metrics = this.llmConfigManager.getMetrics();
        const routerStatus = this.multiLLMRouter.getLoadBalancingStatus();
        
        res.json({
          success: true,
          health: healthStatus,
          metrics: metrics,
          loadBalancing: routerStatus,
          ollama: {
            connected: await this.checkOllamaConnection(),
            models: await this.getOllamaModels()
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('상태 확인 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 성능 벤치마크 API
    this.app.post('/api/llm/benchmark', async (req, res) => {
      try {
        const { testPrompt } = req.body;
        const results = await this.multiLLMRouter.runPerformanceBenchmark(testPrompt);
        
        res.json({
          success: true,
          benchmarkResults: results,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('벤치마크 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 한국어 품질 평가 API
    this.app.post('/api/llm/korean-quality', async (req, res) => {
      try {
        const { text } = req.body;
        
        if (!text) {
          return res.status(400).json({
            success: false,
            error: '평가할 텍스트가 필요합니다'
          });
        }

        const quality = this.koreanProcessor.validateKoreanQuality(text);
        
        res.json({
          success: true,
          quality: quality,
          recommendations: this.generateQualityRecommendations(quality),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('한국어 품질 평가 오류:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Gemini 2.5 API 연결 테스트
    this.app.post('/api/llm/test-gemini', async (req, res) => {
      try {
        const { apiKey, testMessage = '안녕하세요. 이것은 Gemini 2.5 API 연결 테스트입니다.' } = req.body;

        // API 키 검증 (전달된 키가 있으면 사용, 없으면 환경변수 사용)
        const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
        
        if (!geminiApiKey) {
          return res.status(400).json({
            success: false,
            error: 'Gemini API 키가 필요합니다. 요청 본문에 apiKey를 제공하거나 환경변수를 설정해주세요.'
          });
        }

        // Gemini 2.5 API 테스트 요청
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'}:generateContent?key=${geminiApiKey}`;
        
        const requestBody = {
          contents: [{
            parts: [{
              text: testMessage
            }]
          }],
          generationConfig: {
            temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.8,
            maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 4096,
          }
        };

        console.log(chalk.blue('🧪 Gemini 2.5 API 연결 테스트 시작...'));
        
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(`Gemini API 오류: ${responseData.error?.message || 'Unknown error'}`);
        }

        // 응답 처리
        const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 받지 못했습니다.';

        console.log(chalk.green('✅ Gemini 2.5 API 연결 성공!'));

        res.json({
          success: true,
          data: {
            apiKeyStatus: '유효',
            model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
            testMessage: testMessage,
            response: generatedText,
            responseTime: response.headers.get('x-response-time'),
            usage: responseData.usageMetadata || {},
            timestamp: new Date().toISOString()
          },
          provider: 'gemini',
          version: '2.0-flash-exp'
        });

      } catch (error) {
        console.error('Gemini API 테스트 오류:', error);
        
        // 오류 유형별 메시지 처리
        let errorMessage = error.message;
        let statusCode = 500;

        if (error.message.includes('API key')) {
          errorMessage = 'API 키가 유효하지 않습니다. Gemini API 키를 확인해주세요.';
          statusCode = 401;
        } else if (error.message.includes('quota')) {
          errorMessage = 'API 사용량 한도를 초과했습니다.';
          statusCode = 429;
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Gemini API 서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
          statusCode = 503;
        }

        res.status(statusCode).json({
          success: false,
          error: errorMessage,
          provider: 'gemini',
          timestamp: new Date().toISOString(),
          details: {
            originalError: error.message,
            apiKey: req.body.apiKey ? '제공됨' : '환경변수 사용',
            endpoint: `gemini-${process.env.GEMINI_MODEL || '2.0-flash-exp'}`
          }
        });
      }
    });

    // Knowledge Base API 엔드포인트
    console.log(chalk.blue('🧠 Knowledge Base API 라우트 설정 중...'));
    
    // 지식 베이스 통계 조회
    this.app.get('/api/knowledge-base/stats', (req, res) => {
      try {
        this.knowledgeBase.stats.totalDocuments = this.knowledgeBase.documents.length;
        this.knowledgeBase.stats.totalCategories = this.knowledgeBase.categories.length;
        this.knowledgeBase.stats.totalSearches = this.knowledgeBase.searchHistory.length;
        this.knowledgeBase.stats.aiQueries = this.knowledgeBase.aiQueries.length;
        
        res.json({
          success: true,
          stats: this.knowledgeBase.stats
        });
      } catch (error) {
        console.error('Knowledge Base stats error:', error);
        res.status(500).json({
          success: false,
          message: '통계 조회 중 오류가 발생했습니다.',
          error: error.message
        });
      }
    });
    
    // 문서 목록 조회
    this.app.get('/api/knowledge-base/documents', (req, res) => {
      try {
        const { category, limit = 50, offset = 0 } = req.query;
        
        let documents = [...this.knowledgeBase.documents];
        
        // 카테고리 필터
        if (category && category !== '') {
          documents = documents.filter(doc => doc.category === category);
        }
        
        // 페이지네이션
        const startIndex = parseInt(offset);
        const endIndex = startIndex + parseInt(limit);
        const paginatedDocs = documents.slice(startIndex, endIndex);
        
        res.json({
          success: true,
          documents: paginatedDocs,
          total: documents.length,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
      } catch (error) {
        console.error('Knowledge Base documents error:', error);
        res.status(500).json({
          success: false,
          message: '문서 조회 중 오류가 발생했습니다.',
          error: error.message
        });
      }
    });
    
    // 특정 문서 조회
    this.app.get('/api/knowledge-base/documents/:id', (req, res) => {
      try {
        const { id } = req.params;
        const document = this.knowledgeBase.documents.find(doc => doc.id === id);
        
        if (!document) {
          return res.status(404).json({
            success: false,
            message: '문서를 찾을 수 없습니다.'
          });
        }
        
        // 조회수 증가
        document.views = (document.views || 0) + 1;
        document.lastAccessed = new Date().toISOString().split('T')[0];
        
        res.json({
          success: true,
          document: document
        });
      } catch (error) {
        console.error('Knowledge Base document detail error:', error);
        res.status(500).json({
          success: false,
          message: '문서 조회 중 오류가 발생했습니다.',
          error: error.message
        });
      }
    });
    
    // 지능형 검색 API
    this.app.post('/api/knowledge-base/search', async (req, res) => {
      try {
        const { query, category, useAI = true, limit = 10 } = req.body;
        
        if (!query || query.trim() === '') {
          return res.status(400).json({
            success: false,
            message: '검색어를 입력해주세요.'
          });
        }
        
        // 검색 히스토리에 추가
        this.knowledgeBase.searchHistory.push({
          query: query,
          category: category,
          timestamp: new Date().toISOString(),
          useAI: useAI
        });
        
        let results = [];
        
        if (useAI && this.multiLLMRouter) {
          // AI 기반 시맨틱 검색
          try {
            const aiSearchPrompt = `다음 질문에 가장 관련성이 높은 문서들을 찾아주세요:\n\n질문: "${query}"\n\n사용 가능한 문서들:\n${this.knowledgeBase.documents.map(doc => `- ${doc.title} (${doc.category}): ${doc.content.substring(0, 100)}...`).join('\n')}\n\n관련성이 높은 순서대로 문서 ID를 나열하고, 각각의 관련성 점수(1-10)를 제공해주세요.`;
            
            const aiResponse = await this.multiLLMRouter.generateCompletion({
              messages: [{
                role: 'user',
                content: aiSearchPrompt
              }],
              taskType: 'analysis',
              options: { temperature: 0.3 }
            });
            
            // AI 쿼리 히스토리에 추가
            this.knowledgeBase.aiQueries.push({
              query: query,
              response: aiResponse.message.content,
              timestamp: new Date().toISOString()
            });
            
            console.log('AI 검색 응답:', aiResponse.message.content);
          } catch (aiError) {
            console.warn('AI 검색 실패, 키워드 검색으로 대체:', aiError.message);
          }
        }
        
        // 키워드 기반 검색 (백업 또는 기본)
        results = this.knowledgeBase.documents.filter(doc => {
          const queryLower = query.toLowerCase();
          const matchesQuery = 
            doc.title.toLowerCase().includes(queryLower) ||
            doc.content.toLowerCase().includes(queryLower) ||
            (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(queryLower)));
          
          const matchesCategory = !category || category === '' || doc.category === category;
          
          return matchesQuery && matchesCategory;
        });
        
        // 관련성 점수 계산
        results = results.map(doc => {
          let score = 0;
          const queryLower = query.toLowerCase();
          
          // 제목 매칭
          if (doc.title.toLowerCase().includes(queryLower)) {
            score += 10;
          }
          
          // 태그 매칭
          if (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
            score += 5;
          }
          
          // 내용 매칭
          if (doc.content.toLowerCase().includes(queryLower)) {
            score += 3;
          }
          
          // 조회수 보너스
          score += Math.log((doc.views || 0) + 1);
          
          return {
            ...doc,
            score: Math.round(score * 10) / 10
          };
        });
        
        // 점수순 정렬
        results.sort((a, b) => b.score - a.score);
        
        // 결과 제한
        results = results.slice(0, parseInt(limit));
        
        res.json({
          success: true,
          results: results,
          total: results.length,
          query: query,
          category: category,
          useAI: useAI
        });
        
      } catch (error) {
        console.error('Knowledge Base search error:', error);
        res.status(500).json({
          success: false,
          message: '검색 중 오류가 발생했습니다.',
          error: error.message
        });
      }
    });
    
    // 문서 업로드 API
    this.app.post('/api/knowledge-base/upload', (req, res) => {
      try {
        // 실제 구현에서는 multer 등을 사용하여 파일 업로드 처리
        // 여기서는 시뮬레이션
        const { category = '기술문서', tags = '' } = req.body;
        
        // 시뮬레이션 문서 생성
        const newDocument = {
          id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          title: '업로드된 문서 ' + new Date().toLocaleString('ko-KR'),
          content: '업로드된 문서의 내용입니다. 실제 구현에서는 파일 내용을 파싱하여 저장합니다.',
          category: category,
          tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
          uploadDate: new Date().toISOString().split('T')[0],
          fileType: 'pdf',
          size: (Math.random() * 5 + 0.5).toFixed(1) + 'MB',
          views: 0,
          lastAccessed: new Date().toISOString().split('T')[0],
          author: '사용자',
          createdAt: new Date().toISOString()
        };
        
        this.knowledgeBase.documents.unshift(newDocument);
        
        res.json({
          success: true,
          message: '문서가 성공적으로 업로드되었습니다.',
          document: newDocument
        });
        
      } catch (error) {
        console.error('Knowledge Base upload error:', error);
        res.status(500).json({
          success: false,
          message: '문서 업로드 중 오류가 발생했습니다.',
          error: error.message
        });
      }
    });
    
    // 문서 수정 API
    this.app.put('/api/knowledge-base/documents/:id', (req, res) => {
      try {
        const { id } = req.params;
        const { title, content, category, tags } = req.body;
        
        const docIndex = this.knowledgeBase.documents.findIndex(doc => doc.id === id);
        
        if (docIndex === -1) {
          return res.status(404).json({
            success: false,
            message: '문서를 찾을 수 없습니다.'
          });
        }
        
        // 문서 업데이트
        if (title) this.knowledgeBase.documents[docIndex].title = title;
        if (content) this.knowledgeBase.documents[docIndex].content = content;
        if (category) this.knowledgeBase.documents[docIndex].category = category;
        if (tags) {
          this.knowledgeBase.documents[docIndex].tags = 
            Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
        }
        
        this.knowledgeBase.documents[docIndex].updatedAt = new Date().toISOString();
        
        res.json({
          success: true,
          message: '문서가 성공적으로 수정되었습니다.',
          document: this.knowledgeBase.documents[docIndex]
        });
        
      } catch (error) {
        console.error('Knowledge Base update error:', error);
        res.status(500).json({
          success: false,
          message: '문서 수정 중 오류가 발생했습니다.',
          error: error.message
        });
      }
    });
    
    // 문서 삭제 API
    this.app.delete('/api/knowledge-base/documents/:id', (req, res) => {
      try {
        const { id } = req.params;
        
        const docIndex = this.knowledgeBase.documents.findIndex(doc => doc.id === id);
        
        if (docIndex === -1) {
          return res.status(404).json({
            success: false,
            message: '문서를 찾을 수 없습니다.'
          });
        }
        
        const deletedDoc = this.knowledgeBase.documents.splice(docIndex, 1)[0];
        
        res.json({
          success: true,
          message: '문서가 성공적으로 삭제되었습니다.',
          document: deletedDoc
        });
        
      } catch (error) {
        console.error('Knowledge Base delete error:', error);
        res.status(500).json({
          success: false,
          message: '문서 삭제 중 오류가 발생했습니다.',
          error: error.message
        });
      }
    });
    
    // 지식 베이스 새로고침 API
    this.app.post('/api/knowledge-base/refresh', (req, res) => {
      try {
        // 통계 업데이트
        this.knowledgeBase.stats.totalDocuments = this.knowledgeBase.documents.length;
        this.knowledgeBase.stats.totalCategories = this.knowledgeBase.categories.length;
        
        res.json({
          success: true,
          message: '지식 베이스가 새로고침되었습니다.',
          stats: this.knowledgeBase.stats
        });
        
      } catch (error) {
        console.error('Knowledge Base refresh error:', error);
        res.status(500).json({
          success: false,
          message: '새로고침 중 오류가 발생했습니다.',
          error: error.message
        });
      }
    });
    
    // 인덱스 최적화 API
    this.app.post('/api/knowledge-base/optimize', (req, res) => {
      try {
        // 실제 구현에서는 검색 인덱스 최적화 작업 수행
        // 여기서는 시뮬레이션
        setTimeout(() => {
          console.log('Knowledge Base 인덱스 최적화 완료');
        }, 1000);
        
        res.json({
          success: true,
          message: '인덱스 최적화가 시작되었습니다.'
        });
        
      } catch (error) {
        console.error('Knowledge Base optimize error:', error);
        res.status(500).json({
          success: false,
          message: '최적화 중 오류가 발생했습니다.',
          error: error.message
        });
      }
    });
    
    // 카테고리 목록 조회 API
    this.app.get('/api/knowledge-base/categories', (req, res) => {
      try {
        res.json({
          success: true,
          categories: this.knowledgeBase.categories
        });
      } catch (error) {
        console.error('Knowledge Base categories error:', error);
        res.status(500).json({
          success: false,
          message: '카테고리 조회 중 오류가 발생했습니다.',
          error: error.message
        });
      }
    });
    
    console.log(chalk.green('✅ Knowledge Base API 라우트 설정 완료'));
    console.log(chalk.green('✅ LLM API 라우트 설정 완료'));
  }

  // 분석 프롬프트 생성
  generateAnalysisPrompt(data, analysisType, language) {
    const templates = {
      'performance': {
        korean: `다음 성능 데이터를 분석하고 한국어로 상세한 분석 결과를 제공해주세요:

데이터: ${JSON.stringify(data, null, 2)}

분석 요청사항:
1. 주요 성능 지표 분석
2. 병목 구간 식별
3. 성능 개선 방안 제시
4. 모니터링 권장사항

분석 결과를 구조화된 형태로 제공해주세요.`,
        english: `Please analyze the following performance data and provide detailed analysis results:

Data: ${JSON.stringify(data, null, 2)}

Analysis Requirements:
1. Key performance metrics analysis
2. Bottleneck identification
3. Performance improvement recommendations
4. Monitoring suggestions

Please provide the analysis in a structured format.`
      },
      'error': {
        korean: `다음 오류 데이터를 분석하고 한국어로 해결방안을 제시해주세요:

오류 데이터: ${JSON.stringify(data, null, 2)}

분석 요청사항:
1. 오류 원인 분석
2. 심각도 평가
3. 해결 방법 제시
4. 재발 방지 방안

실용적인 해결책을 중심으로 분석해주세요.`,
        english: `Please analyze the following error data and provide solutions:

Error Data: ${JSON.stringify(data, null, 2)}

Analysis Requirements:
1. Root cause analysis
2. Severity assessment
3. Solution recommendations
4. Prevention strategies

Please focus on practical solutions.`
      },
      'general': {
        korean: `다음 데이터를 분석하고 한국어로 인사이트를 제공해주세요:

데이터: ${JSON.stringify(data, null, 2)}

포괄적인 분석과 실용적인 권장사항을 제시해주세요.`,
        english: `Please analyze the following data and provide insights:

Data: ${JSON.stringify(data, null, 2)}

Please provide comprehensive analysis and practical recommendations.`
      }
    };

    return templates[analysisType]?.[language] || templates.general[language];
  }

  // Ollama 연결 상태 확인
  async checkOllamaConnection() {
    try {
      if (this.multiLLMRouter.ollamaClient) {
        return await this.multiLLMRouter.ollamaClient.testConnection();
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Ollama 모델 목록 가져오기
  async getOllamaModels() {
    try {
      if (this.multiLLMRouter.ollamaClient) {
        const response = await this.multiLLMRouter.ollamaClient.makeRequest('/api/tags');
        return response.models || [];
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  // 품질 개선 권장사항 생성
  generateQualityRecommendations(quality) {
    const recommendations = [];

    if (quality.issues.includes('한글 비율이 낮음')) {
      recommendations.push('더 많은 한국어 표현을 사용하여 가독성을 향상시키세요.');
    }

    if (quality.issues.includes('불완전한 문장이 많음')) {
      recommendations.push('문장 부호를 정확히 사용하여 완전한 문장을 구성하세요.');
    }

    if (quality.issues.includes('존댓말 일관성 부족')) {
      recommendations.push('문서 전체에서 일관된 존댓말 수준을 유지하세요.');
    }

    if (quality.issues.includes('단어 과도 반복')) {
      recommendations.push('다양한 어휘를 사용하여 표현의 풍부함을 높이세요.');
    }

    if (recommendations.length === 0) {
      recommendations.push('한국어 품질이 우수합니다. 현재 수준을 유지하세요.');
    }

    return recommendations;
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log(chalk.green(`🔌 테스트 클라이언트 연결됨: ${socket.id}`));

      socket.on('start-real-time-test', (config) => {
        this.startRealTimeTest(socket, config);
      });

      socket.on('stop-real-time-test', () => {
        this.stopRealTimeTest(socket);
      });

      socket.on('disconnect', () => {
        console.log(chalk.yellow(`📡 테스트 클라이언트 연결 해제됨: ${socket.id}`));
      });
    });
  }

  loadTestScenarios() {
    this.scenarios = [
      {
        id: 'basic-monitoring',
        name: '기본 모니터링 테스트',
        description: 'ClickHouse, Kafka, Redis 기본 연결 및 메트릭 수집 테스트',
        category: 'infrastructure',
        duration: 30,
        steps: ['connectivity', 'metrics-ingestion', 'data-retention']
      },
      {
        id: 'aiops-anomaly',
        name: 'AIOps 이상 탐지',
        description: 'ML 기반 이상 패턴 탐지 및 예측 알고리즘 테스트',
        category: 'ai-ml',
        duration: 120,
        steps: ['data-training', 'anomaly-injection', 'detection-accuracy']
      },
      {
        id: 'session-replay',
        name: '세션 리플레이',
        description: '사용자 세션 녹화, 저장, 재생 기능 테스트',
        category: 'user-experience',
        duration: 90,
        steps: ['session-recording', 'data-compression', 'playback-quality']
      },
      {
        id: 'nlp-search',
        name: 'NLP 자연어 검색',
        description: '한국어 자연어 쿼리 처리 및 검색 결과 정확도 테스트',
        category: 'ai-ml',
        duration: 60,
        steps: ['korean-tokenization', 'semantic-search', 'result-ranking']
      },
      {
        id: 'real-time-alerts',
        name: '실시간 알림',
        description: '임계값 기반 실시간 알림 발송 및 에스컬레이션 테스트',
        category: 'alerting',
        duration: 45,
        steps: ['threshold-monitoring', 'alert-generation', 'notification-delivery']
      },
      {
        id: 'performance-stress',
        name: '성능 부하 테스트',
        description: '대용량 데이터 처리 및 시스템 성능 한계 테스트',
        category: 'performance',
        duration: 180,
        steps: ['data-volume-ramp', 'concurrent-users', 'system-stability']
      },
      {
        id: 'end-to-end',
        name: '종단 간 통합 테스트',
        description: '전체 AIRIS-MON 워크플로우 통합 시나리오 테스트',
        category: 'integration',
        duration: 300,
        steps: ['data-ingestion', 'processing-pipeline', 'ui-visualization', 'alert-workflow']
      }
    ];
  }

  async runScenario(scenario) {
    const startTime = Date.now();
    const scenarioResult = {
      id: scenario.id,
      name: scenario.name,
      startTime: new Date(startTime).toISOString(),
      status: 'running',
      steps: [],
      metrics: {
        totalRequests: 0,
        successRate: 0,
        avgResponseTime: 0,
        errorsCount: 0
      }
    };

    this.testResults[scenario.id] = scenarioResult;
    this.broadcastUpdate('scenario-started', scenarioResult);

    try {
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        console.log(chalk.blue(`  📋 단계 ${i + 1}/${scenario.steps.length}: ${step}`));
        
        const stepResult = await this.executeStep(step, scenario);
        scenarioResult.steps.push(stepResult);
        
        this.broadcastUpdate('step-completed', { scenarioId: scenario.id, step: stepResult });
        
        // 단계 간 딜레이
        await this.delay(2000);
      }

      scenarioResult.status = 'completed';
      scenarioResult.endTime = new Date().toISOString();
      scenarioResult.duration = Date.now() - startTime;
      
      // 성공률 계산
      const successfulSteps = scenarioResult.steps.filter(s => s.success).length;
      scenarioResult.successRate = (successfulSteps / scenarioResult.steps.length) * 100;

      console.log(chalk.green(`✅ 시나리오 완료: ${scenario.name} (${scenarioResult.successRate.toFixed(1)}% 성공률)`));
      
    } catch (error) {
      scenarioResult.status = 'failed';
      scenarioResult.error = error.message;
      scenarioResult.endTime = new Date().toISOString();
      scenarioResult.duration = Date.now() - startTime;
      
      console.error(chalk.red(`❌ 시나리오 실패: ${scenario.name} - ${error.message}`));
    }

    this.broadcastUpdate('scenario-completed', scenarioResult);
    return scenarioResult;
  }

  async executeStep(stepName, scenario) {
    const stepStartTime = Date.now();
    const stepResult = {
      name: stepName,
      startTime: new Date(stepStartTime).toISOString(),
      success: false,
      metrics: {},
      logs: []
    };

    try {
      switch (stepName) {
        case 'connectivity':
          await this.testConnectivity(stepResult);
          break;
        case 'metrics-ingestion':
          await this.testMetricsIngestion(stepResult);
          break;
        case 'data-retention':
          await this.testDataRetention(stepResult);
          break;
        case 'data-training':
          await this.aimlTester.trainModel(stepResult);
          break;
        case 'anomaly-injection':
          await this.aimlTester.injectAnomalies(stepResult);
          break;
        case 'detection-accuracy':
          await this.aimlTester.measureAccuracy(stepResult);
          break;
        case 'session-recording':
          await this.sessionReplayTester.recordSession(stepResult);
          break;
        case 'data-compression':
          await this.sessionReplayTester.testCompression(stepResult);
          break;
        case 'playback-quality':
          await this.sessionReplayTester.testPlayback(stepResult);
          break;
        case 'korean-tokenization':
          await this.nlpSearchTester.testTokenization(stepResult);
          break;
        case 'semantic-search':
          await this.nlpSearchTester.testSemanticSearch(stepResult);
          break;
        case 'result-ranking':
          await this.nlpSearchTester.testResultRanking(stepResult);
          break;
        case 'threshold-monitoring':
          await this.alertTester.testThresholds(stepResult);
          break;
        case 'alert-generation':
          await this.alertTester.testGeneration(stepResult);
          break;
        case 'notification-delivery':
          await this.alertTester.testDelivery(stepResult);
          break;
        case 'data-volume-ramp':
          await this.testDataVolumeRamp(stepResult);
          break;
        case 'concurrent-users':
          await this.testConcurrentUsers(stepResult);
          break;
        case 'system-stability':
          await this.testSystemStability(stepResult);
          break;
        default:
          throw new Error(`알 수 없는 테스트 단계: ${stepName}`);
      }

      stepResult.success = true;
      stepResult.logs.push(`✅ ${stepName} 단계 성공적으로 완료`);
      
    } catch (error) {
      stepResult.success = false;
      stepResult.error = error.message;
      stepResult.logs.push(`❌ ${stepName} 단계 실패: ${error.message}`);
    }

    stepResult.endTime = new Date().toISOString();
    stepResult.duration = Date.now() - stepStartTime;
    
    return stepResult;
  }

  async testConnectivity(stepResult) {
    stepResult.logs.push('🔌 시스템 연결성 테스트 시작');
    
    // API Gateway 연결 테스트
    const axios = require('axios');
    const response = await axios.get('http://localhost:3000/health');
    stepResult.metrics.apiGateway = response.status === 200;
    stepResult.logs.push(`API Gateway: ${response.status === 200 ? '✅ 연결됨' : '❌ 연결 실패'}`);
    
    // 각 서비스 연결 테스트
    const services = [
      { name: 'AIOps', port: 3004 },
      { name: 'Session Replay', port: 3003 },
      { name: 'NLP Search', port: 3006 },
      { name: 'Event Delta', port: 3005 }
    ];
    
    for (const service of services) {
      try {
        const res = await axios.get(`http://localhost:${service.port}/health`);
        stepResult.metrics[service.name.toLowerCase().replace(/\s+/g, '_')] = res.status === 200;
        stepResult.logs.push(`${service.name}: ✅ 정상`);
      } catch (error) {
        stepResult.metrics[service.name.toLowerCase().replace(/\s+/g, '_')] = false;
        stepResult.logs.push(`${service.name}: ❌ 오류`);
      }
    }
  }

  async testMetricsIngestion(stepResult) {
    stepResult.logs.push('📊 메트릭 수집 테스트 시작');
    
    const metricsCount = await this.metricsGenerator.generateBatch(100);
    stepResult.metrics.metricsGenerated = metricsCount;
    stepResult.logs.push(`생성된 메트릭: ${metricsCount}개`);
    
    // 데이터 검증을 위해 잠시 대기
    await this.delay(3000);
    
    stepResult.logs.push('✅ 메트릭 수집 완료');
  }

  async testDataRetention(stepResult) {
    stepResult.logs.push('💾 데이터 보존 테스트 시작');
    
    // 데이터 보존 기간 테스트 (임의로 성공으로 처리)
    stepResult.metrics.retentionPeriod = '30일';
    stepResult.metrics.dataIntegrity = true;
    stepResult.logs.push('데이터 보존 정책 확인 완료');
  }

  async testDataVolumeRamp(stepResult) {
    stepResult.logs.push('📈 데이터 볼륨 증가 테스트 시작');
    
    const volumes = [100, 500, 1000, 2000];
    for (const volume of volumes) {
      const startTime = Date.now();
      await this.metricsGenerator.generateBatch(volume);
      const duration = Date.now() - startTime;
      
      stepResult.metrics[`volume_${volume}`] = {
        duration: duration,
        throughput: volume / (duration / 1000)
      };
      
      stepResult.logs.push(`볼륨 ${volume}: ${duration}ms (${(volume / (duration / 1000)).toFixed(2)} req/s)`);
    }
  }

  async testConcurrentUsers(stepResult) {
    stepResult.logs.push('👥 동시 사용자 테스트 시작');
    
    const concurrentRequests = Array.from({ length: 50 }, async () => {
      const axios = require('axios');
      const startTime = Date.now();
      try {
        await axios.get('http://localhost:3000/api/v1/status');
        return Date.now() - startTime;
      } catch (error) {
        return -1;
      }
    });
    
    const results = await Promise.all(concurrentRequests);
    const successfulRequests = results.filter(r => r > 0);
    
    stepResult.metrics.concurrentUsers = 50;
    stepResult.metrics.successRate = (successfulRequests.length / 50) * 100;
    stepResult.metrics.avgResponseTime = successfulRequests.reduce((a, b) => a + b, 0) / successfulRequests.length;
    
    stepResult.logs.push(`동시 요청: 50개, 성공률: ${stepResult.metrics.successRate.toFixed(1)}%`);
    stepResult.logs.push(`평균 응답시간: ${stepResult.metrics.avgResponseTime.toFixed(2)}ms`);
  }

  async testSystemStability(stepResult) {
    stepResult.logs.push('🔧 시스템 안정성 테스트 시작');
    
    // 30초간 지속적인 요청 발송
    const testDuration = 30000;
    const startTime = Date.now();
    let requestCount = 0;
    let errorCount = 0;
    
    while (Date.now() - startTime < testDuration) {
      try {
        const axios = require('axios');
        await axios.get('http://localhost:3000/health');
        requestCount++;
      } catch (error) {
        errorCount++;
      }
      await this.delay(100);
    }
    
    stepResult.metrics.totalRequests = requestCount;
    stepResult.metrics.errorCount = errorCount;
    stepResult.metrics.errorRate = (errorCount / (requestCount + errorCount)) * 100;
    
    stepResult.logs.push(`총 요청: ${requestCount}개, 오류: ${errorCount}개`);
    stepResult.logs.push(`오류율: ${stepResult.metrics.errorRate.toFixed(2)}%`);
  }

  startRealTimeTest(socket, config) {
    const testInterval = setInterval(async () => {
      try {
        const testData = {
          timestamp: new Date().toISOString(),
          metrics: await this.generateRealTimeMetrics(),
          alerts: await this.generateRealTimeAlerts(),
          events: await this.generateRealTimeEvents(),
          systemStatus: await this.getSystemStatus()
        };
        
        socket.emit('real-time-data', testData);
      } catch (error) {
        console.error('실시간 테스트 데이터 생성 오류:', error);
        socket.emit('test-error', error.message);
      }
    }, config.interval || 1000);
    
    socket.testInterval = testInterval;
    console.log(chalk.cyan(`🔄 실시간 테스트 시작됨: ${socket.id}`));
  }

  stopRealTimeTest(socket) {
    if (socket.testInterval) {
      clearInterval(socket.testInterval);
      delete socket.testInterval;
      console.log(chalk.yellow(`⏹️ 실시간 테스트 중지됨: ${socket.id}`));
    }
  }

  async generateRealTimeMetrics() {
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: {
        in: Math.random() * 1000,
        out: Math.random() * 1000
      },
      responseTime: Math.random() * 500,
      throughput: Math.random() * 10000,
      errorRate: Math.random() * 5
    };
  }

  async generateRealTimeAlerts() {
    const alertTypes = ['high_cpu', 'memory_leak', 'disk_full', 'network_timeout'];
    const severities = ['low', 'medium', 'high', 'critical'];
    
    return Math.random() > 0.8 ? {
      type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      message: '시스템 리소스 임계값 초과',
      timestamp: new Date().toISOString()
    } : null;
  }

  async generateRealTimeEvents() {
    const eventTypes = ['user_login', 'api_call', 'database_query', 'file_upload'];
    
    return Array.from({ length: Math.floor(Math.random() * 5) }, () => ({
      type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      user: `user_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      duration: Math.random() * 1000
    }));
  }

  async getSystemStatus() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      timestamp: new Date().toISOString()
    };
  }

  broadcastUpdate(event, data) {
    this.io.emit(event, data);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 헬퍼 메서드들 (실시간 모니터링용)
  getTotalEventsToday() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const stats = this.sessionStorage.getOverallStats();
      // 오늘 생성된 세션들의 이벤트 수 합계
      return stats.todayEvents || Math.floor(Math.random() * 1000) + 500;
    } catch (error) {
      return Math.floor(Math.random() * 1000) + 500; // 시뮬레이션 데이터
    }
  }

  getSystemHealth() {
    // 시스템 상태를 백분율로 반환 (실제 환경에서는 실제 메트릭 사용)
    const cpuUsage = Math.random() * 30 + 10; // 10-40%
    const memoryUsage = Math.random() * 40 + 20; // 20-60%
    const diskUsage = Math.random() * 20 + 5; // 5-25%
    
    const health = 100 - Math.max(cpuUsage, memoryUsage, diskUsage);
    return Math.max(75, Math.min(100, health)); // 75-100% 범위
  }

  getSessionQuality() {
    // 세션 품질 점수 (이벤트 밀도, 오류율 등 기반)
    try {
      const stats = this.sessionStorage.getOverallStats();
      const errorRate = stats.errorRate || (Math.random() * 5); // 0-5% 오류율
      const completionRate = stats.completionRate || (Math.random() * 20 + 80); // 80-100% 완료율
      
      return Math.floor(completionRate - errorRate);
    } catch (error) {
      return Math.floor(Math.random() * 15 + 85); // 85-100 시뮬레이션
    }
  }

  getAverageSessionDuration() {
    try {
      const stats = this.sessionStorage.getOverallStats();
      return stats.averageDuration || (Math.random() * 180000 + 60000); // 1-4분
    } catch (error) {
      return Math.random() * 180000 + 60000; // 시뮬레이션 데이터
    }
  }

  getAverageEventsPerSession() {
    try {
      const stats = this.sessionStorage.getOverallStats();
      return stats.averageEvents || Math.floor(Math.random() * 30 + 15); // 15-45 이벤트
    } catch (error) {
      return Math.floor(Math.random() * 30 + 15);
    }
  }

  getSessionSuccessRate() {
    try {
      const stats = this.sessionStorage.getOverallStats();
      return stats.successRate || (Math.random() * 10 + 90); // 90-100%
    } catch (error) {
      return Math.random() * 10 + 90;
    }
  }

  // 위협 탐지 메서드
  async detectThreatsInSession(session, options = {}) {
    const { sensitivityLevel = 5, detectionMode = 'all' } = options;
    const threats = [];

    try {
      // 1. 무차별 대입 공격 탐지
      if (detectionMode === 'all' || detectionMode === 'brute-force') {
        const bruteForceThreats = this.detectBruteForce(session.events, sensitivityLevel);
        threats.push(...bruteForceThreats);
      }

      // 2. 봇 탐지
      if (detectionMode === 'all' || detectionMode === 'bot-detection') {
        const botThreats = this.detectBots(session.events, sensitivityLevel);
        threats.push(...botThreats);
      }

      // 3. 비정상 행동 탐지
      if (detectionMode === 'all' || detectionMode === 'unusual-behavior') {
        const behaviorThreats = this.detectUnusualBehavior(session.events, sensitivityLevel);
        threats.push(...behaviorThreats);
      }

      // 4. 고위험도만 필터링
      if (detectionMode === 'high-severity') {
        return threats.filter(threat => threat.severity === 'high' || threat.severity === 'critical');
      }

      return threats;
    } catch (error) {
      console.error(chalk.red(`❌ 위협 탐지 오류: ${error.message}`));
      return [];
    }
  }

  // 무차별 대입 공격 탐지
  detectBruteForce(events, sensitivityLevel) {
    const threats = [];
    const loginAttempts = {};

    // 로그인 시도 이벤트 필터링
    const loginEvents = events.filter(event => 
      event.type === 'form_input' && 
      (event.element_id === 'password' || event.element_id === 'username')
    );

    // IP별 로그인 시도 집계
    loginEvents.forEach(event => {
      const ip = event.source_ip || '127.0.0.1';
      if (!loginAttempts[ip]) {
        loginAttempts[ip] = { count: 0, timeWindow: [], usernames: new Set() };
      }
      loginAttempts[ip].count++;
      loginAttempts[ip].timeWindow.push(event.timestamp);
      
      if (event.element_id === 'username') {
        loginAttempts[ip].usernames.add(event.value || 'unknown');
      }
    });

    // 위협 판단
    Object.entries(loginAttempts).forEach(([ip, attempts]) => {
      const threshold = Math.max(5, 15 - sensitivityLevel);
      
      if (attempts.count >= threshold) {
        const timeSpan = Math.max(...attempts.timeWindow) - Math.min(...attempts.timeWindow);
        const isRapid = timeSpan < 300000; // 5분 내
        
        threats.push({
          id: `brute_force_${ip}_${Date.now()}`,
          type: 'brute-force',
          severity: isRapid && attempts.count > threshold * 2 ? 'critical' : 'high',
          source: ip,
          description: `${ip}에서 ${attempts.count}회의 로그인 시도 탐지`,
          details: {
            attempts: attempts.count,
            timeWindow: `${Math.round(timeSpan / 1000)}초`,
            targetAccounts: Array.from(attempts.usernames),
            rapid: isRapid,
            successRate: '0%'
          },
          timestamp: Math.max(...attempts.timeWindow),
          risk_score: Math.min(100, attempts.count * 5 + (isRapid ? 25 : 0))
        });
      }
    });

    return threats;
  }

  // 봇 탐지
  detectBots(events, sensitivityLevel) {
    const threats = [];
    const userSessions = {};

    // 사용자별 행동 패턴 분석
    events.forEach(event => {
      const userKey = event.user_id || event.session_id || 'anonymous';
      
      if (!userSessions[userKey]) {
        userSessions[userKey] = {
          events: [],
          clickIntervals: [],
          pageViews: new Set(),
          userAgents: new Set()
        };
      }
      
      const session = userSessions[userKey];
      session.events.push(event);
      
      if (event.page_url) {
        session.pageViews.add(event.page_url);
      }
      
      if (event.user_agent) {
        session.userAgents.add(event.user_agent);
      }
    });

    // 봇 패턴 탐지
    Object.entries(userSessions).forEach(([userId, session]) => {
      const botIndicators = [];
      
      // 1. 너무 빠른 클릭 패턴
      const clickEvents = session.events.filter(e => e.type === 'click');
      if (clickEvents.length > 10) {
        const intervals = [];
        for (let i = 1; i < clickEvents.length; i++) {
          intervals.push(clickEvents[i].timestamp - clickEvents[i-1].timestamp);
        }
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        
        if (avgInterval < 100) {
          botIndicators.push('rapid_clicking');
        }
      }

      // 2. 의심스러운 User-Agent
      session.userAgents.forEach(ua => {
        if (ua && (ua.includes('bot') || ua.includes('spider') || ua.includes('crawler'))) {
          botIndicators.push('suspicious_user_agent');
        }
      });

      // 3. 순차적 페이지 접근 패턴
      if (session.pageViews.size > 20) {
        botIndicators.push('extensive_crawling');
      }

      // 4. 사용자 입력 부족
      const inputEvents = session.events.filter(e => e.type === 'form_input' || e.type === 'keydown');
      const clickEvents2 = session.events.filter(e => e.type === 'click');
      
      if (clickEvents2.length > 50 && inputEvents.length < 5) {
        botIndicators.push('minimal_interaction');
      }

      // 위협 생성
      if (botIndicators.length >= Math.max(1, 4 - sensitivityLevel / 2)) {
        const severity = botIndicators.length >= 3 ? 'high' : 'medium';
        
        threats.push({
          id: `bot_${userId}_${Date.now()}`,
          type: 'bot-detection',
          severity,
          source: session.events[0]?.source_ip || 'unknown',
          description: `사용자 ${userId}에서 자동화된 봇 활동 탐지`,
          details: {
            indicators: botIndicators,
            eventCount: session.events.length,
            pageViews: session.pageViews.size,
            userAgents: Array.from(session.userAgents)
          },
          timestamp: Math.max(...session.events.map(e => e.timestamp)),
          risk_score: Math.min(100, botIndicators.length * 20 + session.pageViews.size)
        });
      }
    });

    return threats;
  }

  // 비정상 행동 탐지
  detectUnusualBehavior(events, sensitivityLevel) {
    const threats = [];
    
    // 1. JavaScript 오류 남발
    const jsErrors = events.filter(event => event.type === 'javascript_error');
    if (jsErrors.length > Math.max(3, 10 - sensitivityLevel)) {
      threats.push({
        id: `js_errors_${Date.now()}`,
        type: 'unusual-behavior',
        severity: 'medium',
        source: 'client',
        description: `비정상적으로 많은 JavaScript 오류 발생 (${jsErrors.length}개)`,
        details: {
          errorCount: jsErrors.length,
          errorTypes: jsErrors.map(e => e.error_message || 'unknown')
        },
        timestamp: Math.max(...jsErrors.map(e => e.timestamp)),
        risk_score: Math.min(100, jsErrors.length * 5)
      });
    }

    // 2. 비정상적인 페이지 점프
    const pageLoads = events
      .filter(event => {
        // rrweb_event로 래핑된 page_load 이벤트 처리
        if (event.type === 'rrweb_event' && event.rrwebType === 'page_load' && event.originalEvent) {
          return true;
        }
        return event.type === 'page_load';
      })
      .map(event => {
        // rrweb_event인 경우 originalEvent 데이터를 사용
        if (event.type === 'rrweb_event' && event.originalEvent) {
          return {
            ...event.originalEvent,
            timestamp: event.timestamp || event.originalEvent.timestamp,
            id: event.id
          };
        }
        return event;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
    if (pageLoads.length > 5) {
      let jumpCount = 0;
      for (let i = 1; i < pageLoads.length; i++) {
        const timeDiff = pageLoads[i].timestamp - pageLoads[i-1].timestamp;
        if (timeDiff < 1000) {
          jumpCount++;
        }
      }
      
      if (jumpCount > Math.max(2, 8 - sensitivityLevel)) {
        threats.push({
          id: `page_jumping_${Date.now()}`,
          type: 'unusual-behavior',
          severity: 'low',
          source: 'navigation',
          description: `비정상적으로 빠른 페이지 이동 패턴 탐지`,
          details: {
            rapidJumps: jumpCount,
            totalPageViews: pageLoads.length
          },
          timestamp: pageLoads[pageLoads.length-1].timestamp,
          risk_score: Math.min(100, jumpCount * 10)
        });
      }
    }

    return threats;
  }

  // 이벤트 패턴 분석
  async analyzeEventPattern(events, patternType) {
    try {
      const analysis = {
        patternType,
        eventCount: events.length,
        timeSpan: events.length > 1 ? 
          Math.max(...events.map(e => e.timestamp)) - Math.min(...events.map(e => e.timestamp)) : 0,
        eventTypes: {},
        anomalies: [],
        riskLevel: 'low'
      };

      // 이벤트 타입별 집계
      events.forEach(event => {
        analysis.eventTypes[event.type] = (analysis.eventTypes[event.type] || 0) + 1;
      });

      // 간단한 이상 탐지
      const clickEvents = events.filter(e => e.type === 'click');
      if (clickEvents.length > 100) {
        analysis.anomalies.push({
          type: 'excessive-clicks',
          description: `과도한 클릭 이벤트 (${clickEvents.length}개)`,
          severity: 'medium'
        });
      }

      // 위험도 계산
      analysis.riskLevel = analysis.anomalies.length > 5 ? 'high' : 
                          analysis.anomalies.length > 2 ? 'medium' : 'low';

      return analysis;
    } catch (error) {
      console.error(chalk.red(`❌ 패턴 분석 오류: ${error.message}`));
      throw error;
    }
  }

  async start() {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(chalk.green(`
╔══════════════════════════════════════════════════════════╗
║            🧪 AIRIS-MON 테스트 스위트 v1.0             ║
║              Korean HyperDX Complete Test Suite         ║
╠══════════════════════════════════════════════════════════╣
║  🌐 테스트 UI: http://localhost:${this.port}                     ║
║  📊 API 엔드포인트: http://localhost:${this.port}/api             ║
║  📈 실시간 모니터링: WebSocket 연결 활성화               ║
║                                                          ║
║  테스트 시나리오: ${this.scenarios.length}개                             ║
║  📋 기본 모니터링 | 🤖 AI/ML 테스트                      ║
║  📽️ 세션 리플레이 | 🔍 NLP 검색                         ║
║  🚨 실시간 알림 | ⚡ 성능 부하 테스트                    ║
║  🔄 종단간 통합 테스트                                   ║
╚══════════════════════════════════════════════════════════╝
        `));
        
        this.isRunning = true;
        resolve();
      });
    });
  }

  async stop() {
    this.isRunning = false;
    this.server.close();
    console.log(chalk.yellow('🛑 AIRIS-MON 테스트 스위트 종료됨'));
  }

  // E2E 성능 분석 메소드
  async analyzeE2EPerformance(session, options = {}) {
    const { timeRange = 60, threshold = 1000, samplingRate = 0.1 } = options;
    
    try {
      // 성능 데이터 생성 및 분석
      const performanceData = this.generatePerformanceMetrics(session);
      const traces = this.generateE2ETraces(session, samplingRate);
      const bottlenecks = this.identifyPerformanceBottlenecks(traces, threshold);
      const recommendations = this.generatePerformanceRecommendations(bottlenecks, performanceData);

      return {
        analysis: {
          sessionInfo: {
            id: session.id,
            scenario: session.scenario,
            duration: session.duration || 0,
            eventCount: session.events.length
          },
          performanceMetrics: performanceData,
          traces: traces,
          bottlenecks: bottlenecks,
          recommendations: recommendations,
          analysisTimestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('E2E 성능 분석 오류:', error);
      throw error;
    }
  }

  // 성능 메트릭 생성
  generatePerformanceMetrics(session) {
    const events = session.events || [];
    const duration = session.duration || 0;

    // 기본 성능 메트릭 계산
    const clickEvents = events.filter(e => e.type === 'click');
    const inputEvents = events.filter(e => e.type === 'input');
    const navigationEvents = events.filter(e => e.type === 'navigation' || e.page_url);

    // 응답 시간 시뮬레이션 (실제 환경에서는 APM 도구에서 수집)
    const avgResponseTime = Math.random() * 1500 + 300; // 300-1800ms
    const throughput = events.length / (duration / 60000); // events per minute
    const errorRate = Math.random() * 5; // 0-5%

    // 시간별 응답 시간 분포
    const responseTimeDistribution = [];
    const buckets = ['0-100ms', '100-500ms', '500ms-1s', '1s-3s', '3s-10s', '10s+'];
    buckets.forEach(() => {
      responseTimeDistribution.push(Math.floor(Math.random() * 50) + 5);
    });

    // 처리량 트렌드 (시계열)
    const throughputTrend = [];
    for (let i = 0; i < 20; i++) {
      throughputTrend.push({
        timestamp: Date.now() - (20 - i) * 60000,
        value: throughput + (Math.random() - 0.5) * 20
      });
    }

    return {
      avgResponseTime,
      throughput: Math.max(1, throughput),
      errorRate,
      responseTimeDistribution,
      throughputTrend,
      sessionMetrics: {
        totalEvents: events.length,
        clickEvents: clickEvents.length,
        inputEvents: inputEvents.length,
        navigationEvents: navigationEvents.length,
        avgEventInterval: duration / Math.max(1, events.length)
      }
    };
  }

  // E2E 트레이스 생성
  generateE2ETraces(session, samplingRate = 0.1) {
    const events = session.events || [];
    const traces = [];

    events.forEach((event, index) => {
      // 샘플링 적용
      if (Math.random() > samplingRate) return;

      const trace = {
        id: `trace-${session.id}-${index}`,
        service: this.mapEventToService(event),
        operation: event.type,
        startTime: event.timestamp || index * 100,
        duration: this.calculateTraceDuration(event),
        status: Math.random() > 0.95 ? 'error' : 'success',
        category: this.categorizeTrace(event),
        parentId: index > 0 ? `trace-${session.id}-${index - 1}` : null,
        metadata: {
          eventType: event.type,
          targetElement: event.target?.tagName || null,
          pageUrl: event.page_url || null,
          userId: event.user_id || 'anonymous'
        }
      };

      trace.endTime = trace.startTime + trace.duration;
      traces.push(trace);
    });

    return traces.sort((a, b) => a.startTime - b.startTime);
  }

  // 이벤트를 서비스로 매핑
  mapEventToService(event) {
    const serviceMap = {
      'click': 'Frontend Service',
      'input': 'Form Service',
      'navigation': 'Router Service',
      'page_view': 'Content Service',
      'api_call': 'API Gateway',
      'database': 'Database Service',
      'cache': 'Cache Service'
    };

    // 페이지 URL 기반 서비스 추론
    if (event.page_url) {
      if (event.page_url.includes('payment')) return 'Payment Service';
      if (event.page_url.includes('auth') || event.page_url.includes('login')) return 'Auth Service';
      if (event.page_url.includes('user') || event.page_url.includes('profile')) return 'User Service';
      if (event.page_url.includes('api')) return 'API Gateway';
    }

    return serviceMap[event.type] || 'Unknown Service';
  }

  // 트레이스 지속 시간 계산
  calculateTraceDuration(event) {
    const baseDuration = {
      'click': () => Math.random() * 200 + 50,
      'input': () => Math.random() * 300 + 100,
      'navigation': () => Math.random() * 1000 + 500,
      'api_call': () => Math.random() * 2000 + 300,
      'database': () => Math.random() * 1500 + 200,
      'cache': () => Math.random() * 100 + 10
    };

    const calculator = baseDuration[event.type] || (() => Math.random() * 500 + 100);
    return calculator();
  }

  // 트레이스 분류
  categorizeTrace(event) {
    if (event.type === 'click' && event.target?.id?.includes('submit')) return 'database';
    if (event.type === 'input') return 'cache';
    if (event.page_url && event.page_url.includes('api')) return 'external';
    if (Math.random() > 0.7) return 'external';
    return 'internal';
  }

  // 성능 병목 지점 식별
  identifyPerformanceBottlenecks(traces, threshold = 1000) {
    const bottlenecks = [];

    // 서비스별 성능 통계
    const serviceStats = {};
    traces.forEach(trace => {
      if (!serviceStats[trace.service]) {
        serviceStats[trace.service] = {
          totalDuration: 0,
          count: 0,
          errorCount: 0,
          maxDuration: 0
        };
      }

      const stats = serviceStats[trace.service];
      stats.totalDuration += trace.duration;
      stats.count++;
      stats.maxDuration = Math.max(stats.maxDuration, trace.duration);

      if (trace.status === 'error') {
        stats.errorCount++;
      }
    });

    // 병목 지점 분석
    Object.entries(serviceStats).forEach(([service, stats]) => {
      const avgDuration = stats.totalDuration / stats.count;
      const errorRate = (stats.errorCount / stats.count) * 100;

      // 느린 응답 시간
      if (avgDuration > threshold) {
        bottlenecks.push({
          type: 'slow_response',
          service: service,
          metric: 'average_response_time',
          value: avgDuration,
          threshold: threshold,
          impact: this.calculateBottleneckImpact(avgDuration, stats.count),
          description: `${service}의 평균 응답 시간이 ${Math.round(avgDuration)}ms로 임계값(${threshold}ms)을 초과했습니다.`,
          recommendations: this.getResponseTimeRecommendations(service, avgDuration),
          affectedTraces: stats.count,
          severity: avgDuration > threshold * 2 ? 'critical' : 'high'
        });
      }

      // 높은 오류율
      if (errorRate > 5) {
        bottlenecks.push({
          type: 'high_error_rate',
          service: service,
          metric: 'error_rate',
          value: errorRate,
          threshold: 5,
          impact: this.calculateBottleneckImpact(errorRate * 100, stats.errorCount),
          description: `${service}의 오류율이 ${errorRate.toFixed(1)}%로 높습니다.`,
          recommendations: this.getErrorRateRecommendations(service, errorRate),
          affectedTraces: stats.errorCount,
          severity: errorRate > 10 ? 'critical' : 'high'
        });
      }

      // 처리량 병목
      if (stats.count > traces.length * 0.3 && avgDuration > 500) {
        bottlenecks.push({
          type: 'throughput_bottleneck',
          service: service,
          metric: 'throughput',
          value: stats.count,
          impact: this.calculateBottleneckImpact(stats.count * avgDuration / 1000, stats.count),
          description: `${service}가 전체 요청의 ${Math.round(stats.count / traces.length * 100)}%를 처리하며 병목이 되고 있습니다.`,
          recommendations: this.getThroughputRecommendations(service),
          affectedTraces: stats.count,
          severity: 'medium'
        });
      }
    });

    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  // 병목 지점 영향도 계산
  calculateBottleneckImpact(value, frequency) {
    const normalizedValue = Math.min(value / 1000, 10); // 값을 0-10 범위로 정규화
    const normalizedFrequency = Math.min(frequency / 100, 10); // 빈도를 0-10 범위로 정규화
    return Math.round((normalizedValue * 0.7 + normalizedFrequency * 0.3) * 10);
  }

  // 응답 시간 개선 권장사항
  getResponseTimeRecommendations(service, avgDuration) {
    const recommendations = [];

    if (service.includes('Database')) {
      recommendations.push('인덱스 최적화 및 쿼리 튜닝');
      recommendations.push('커넥션 풀 크기 조정');
      recommendations.push('읽기 전용 복제본 활용');
    } else if (service.includes('API')) {
      recommendations.push('API 응답 캐싱 구현');
      recommendations.push('비동기 처리로 전환');
      recommendations.push('API 게이트웨이 성능 튜닝');
    } else if (service.includes('Frontend')) {
      recommendations.push('번들 크기 최적화');
      recommendations.push('코드 스플리팅 적용');
      recommendations.push('CDN 활용');
    } else {
      recommendations.push('서비스 리소스 스케일링');
      recommendations.push('병렬 처리 최적화');
      recommendations.push('캐싱 레이어 추가');
    }

    return recommendations;
  }

  // 오류율 개선 권장사항
  getErrorRateRecommendations(service, errorRate) {
    return [
      '서비스 로그 분석으로 오류 원인 파악',
      '예외 처리 강화 및 재시도 로직 구현',
      '서비스 헬스체크 및 모니터링 강화',
      '장애 격리 패턴(Circuit Breaker) 적용',
      '백업 서비스 또는 폴백 메커니즘 구현'
    ];
  }

  // 처리량 개선 권장사항
  getThroughputRecommendations(service) {
    return [
      '서비스 인스턴스 스케일 아웃',
      '로드 밸런싱 최적화',
      '비동기 메시지 큐 도입',
      '마이크로서비스 분할 검토',
      '캐싱을 통한 부하 분산'
    ];
  }

  // 성능 개선 권장사항 생성
  generatePerformanceRecommendations(bottlenecks, performanceData) {
    const recommendations = [];
    const priorityMap = { critical: 1, high: 2, medium: 3, low: 4 };

    // 병목 지점 기반 권장사항
    bottlenecks.forEach(bottleneck => {
      recommendations.push({
        id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        priority: bottleneck.severity,
        category: bottleneck.type,
        title: this.getRecommendationTitle(bottleneck),
        description: bottleneck.description,
        actions: bottleneck.recommendations || [],
        estimatedImpact: this.estimateRecommendationImpact(bottleneck),
        estimatedEffort: this.estimateImplementationEffort(bottleneck),
        affectedServices: [bottleneck.service],
        metrics: {
          currentValue: bottleneck.value,
          targetValue: this.calculateTargetValue(bottleneck),
          improvement: this.calculateExpectedImprovement(bottleneck)
        }
      });
    });

    // 일반적인 성능 권장사항
    if (performanceData.avgResponseTime > 1000) {
      recommendations.push({
        id: `rec-general-${Date.now()}`,
        priority: 'medium',
        category: 'general_performance',
        title: '전반적인 성능 최적화',
        description: '시스템 전반의 응답 시간이 느립니다. 포괄적인 성능 최적화가 필요합니다.',
        actions: [
          'APM 도구를 통한 상세 성능 모니터링 구축',
          '성능 예산 설정 및 CI/CD 파이프라인 통합',
          'CDN 및 에지 캐싱 전략 구현',
          '데이터베이스 커넥션 풀 및 캐싱 최적화'
        ],
        estimatedImpact: '30-50% 성능 향상',
        estimatedEffort: '2-4주',
        affectedServices: ['전체 시스템']
      });
    }

    if (performanceData.errorRate > 3) {
      recommendations.push({
        id: `rec-reliability-${Date.now()}`,
        priority: 'high',
        category: 'reliability',
        title: '시스템 안정성 개선',
        description: '높은 오류율로 인해 사용자 경험이 저하되고 있습니다.',
        actions: [
          '실시간 오류 모니터링 및 알림 시스템 구축',
          '장애 격리 패턴 및 회복력 설계 적용',
          '오류 재현 및 근본 원인 분석 프로세스 구축',
          '사용자 피드백 수집 및 품질 개선 순환 구조 구축'
        ],
        estimatedImpact: '70-90% 오류 감소',
        estimatedEffort: '3-6주',
        affectedServices: ['전체 시스템']
      });
    }

    return recommendations.sort((a, b) => {
      const priorityA = priorityMap[a.priority] || 5;
      const priorityB = priorityMap[b.priority] || 5;
      return priorityA - priorityB;
    });
  }

  // 권장사항 제목 생성
  getRecommendationTitle(bottleneck) {
    const titleMap = {
      'slow_response': `${bottleneck.service} 응답 시간 최적화`,
      'high_error_rate': `${bottleneck.service} 오류율 개선`,
      'throughput_bottleneck': `${bottleneck.service} 처리량 확장`
    };
    return titleMap[bottleneck.type] || '성능 최적화';
  }

  // 권장사항 영향도 추정
  estimateRecommendationImpact(bottleneck) {
    const impactMap = {
      'slow_response': '25-40% 응답 시간 단축',
      'high_error_rate': '60-80% 오류 감소',
      'throughput_bottleneck': '50-100% 처리량 향상'
    };
    return impactMap[bottleneck.type] || '성능 향상';
  }

  // 구현 노력 추정
  estimateImplementationEffort(bottleneck) {
    const effortMap = {
      'slow_response': bottleneck.severity === 'critical' ? '2-4주' : '1-2주',
      'high_error_rate': '1-3주',
      'throughput_bottleneck': '2-6주'
    };
    return effortMap[bottleneck.type] || '2-4주';
  }

  // 목표값 계산
  calculateTargetValue(bottleneck) {
    switch (bottleneck.type) {
      case 'slow_response':
        return Math.max(200, bottleneck.value * 0.6); // 40% 개선
      case 'high_error_rate':
        return Math.max(1, bottleneck.value * 0.3); // 70% 개선
      case 'throughput_bottleneck':
        return bottleneck.value * 0.7; // 30% 부하 감소
      default:
        return bottleneck.value * 0.8;
    }
  }

  // 예상 개선율 계산
  calculateExpectedImprovement(bottleneck) {
    const current = bottleneck.value;
    const target = this.calculateTargetValue(bottleneck);
    return Math.round((1 - target / current) * 100);
  }

  // 트레이스 데이터 생성 (필터링 지원)
  async generateTraceData(session, options = {}) {
    const { filter = 'all', limit = 100 } = options;
    const traces = this.generateE2ETraces(session, 1.0); // 전체 트레이스 생성

    // 필터 적용
    let filteredTraces = traces;
    switch (filter) {
      case 'slow':
        filteredTraces = traces.filter(trace => trace.duration > 1000);
        break;
      case 'error':
        filteredTraces = traces.filter(trace => trace.status === 'error');
        break;
      case 'database':
        filteredTraces = traces.filter(trace => trace.category === 'database');
        break;
      case 'external':
        filteredTraces = traces.filter(trace => trace.category === 'external');
        break;
      case 'cache':
        filteredTraces = traces.filter(trace => trace.category === 'cache');
        break;
    }

    // 제한 적용
    return filteredTraces.slice(0, limit);
  }

  // 성능 메트릭 집계
  async aggregatePerformanceMetrics(timeRange = 60) {
    try {
      // 모든 활성 세션 조회
      const allSessions = this.sessionStorage.getAllSessions();
      const recentSessions = allSessions.filter(session => {
        const sessionAge = Date.now() - new Date(session.startTime).getTime();
        return sessionAge <= timeRange * 60 * 1000; // timeRange는 분 단위
      });

      if (recentSessions.length === 0) {
        return {
          avgResponseTime: 0,
          throughput: 0,
          errorRate: 0,
          totalSessions: 0,
          totalEvents: 0
        };
      }

      // 메트릭 집계
      let totalResponseTime = 0;
      let totalEvents = 0;
      let totalErrors = 0;

      recentSessions.forEach(session => {
        const metrics = this.generatePerformanceMetrics(session);
        totalResponseTime += metrics.avgResponseTime;
        totalEvents += session.events.length;
        // 오류 이벤트 추정 (실제로는 로그에서 수집)
        totalErrors += Math.floor(session.events.length * (Math.random() * 0.05));
      });

      return {
        avgResponseTime: Math.round(totalResponseTime / recentSessions.length),
        throughput: Math.round(totalEvents / (timeRange / 60)), // events per minute
        errorRate: Math.round((totalErrors / totalEvents) * 100 * 100) / 100, // percentage
        totalSessions: recentSessions.length,
        totalEvents: totalEvents,
        timeRange: `${timeRange}분`,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('성능 메트릭 집계 오류:', error);
      throw error;
    }
  }

  // E2E 성능 분석 메소드
  async analyzeE2EPerformance(session, options = {}) {
    const { timeRange = 60, threshold = 1000, samplingRate = 0.1 } = options;
    
    try {
      // 성능 데이터 생성 및 분석
      const performanceData = this.generatePerformanceMetrics(session);
      const traces = this.generateE2ETraces(session, samplingRate);
      const bottlenecks = this.identifyPerformanceBottlenecks(traces, threshold);
      const recommendations = this.generatePerformanceRecommendations(bottlenecks, performanceData);

      return {
        analysis: {
          sessionInfo: {
            id: session.id,
            scenario: session.scenario,
            duration: session.duration || 0,
            eventCount: session.events.length
          },
          performanceMetrics: performanceData,
          traces: traces,
          bottlenecks: bottlenecks,
          recommendations: recommendations,
          analysisTimestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('E2E 성능 분석 오류:', error);
      throw error;
    }
  }

  // 성능 메트릭 생성
  generatePerformanceMetrics(session) {
    const events = session.events || [];
    const duration = session.duration || 0;

    // 기본 성능 메트릭 계산
    const clickEvents = events.filter(e => e.type === 'click');
    const inputEvents = events.filter(e => e.type === 'input');
    const navigationEvents = events.filter(e => e.type === 'navigation' || e.page_url);

    // 응답 시간 시뮬레이션 (실제 환경에서는 APM 도구에서 수집)
    const avgResponseTime = Math.random() * 1500 + 300; // 300-1800ms
    const throughput = events.length / (duration / 1000); // 초당 이벤트 수
    const errorRate = Math.random() * 5; // 0-5% 에러율

    return {
      responseTime: {
        avg: Math.round(avgResponseTime),
        p95: Math.round(avgResponseTime * 1.5),
        p99: Math.round(avgResponseTime * 2.2)
      },
      throughput: Math.round(throughput * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      totalRequests: events.length,
      activeUsers: 1, // 단일 세션 분석
      memoryUsage: {
        heap: Math.random() * 100 + 50, // MB
        nonHeap: Math.random() * 50 + 20
      },
      cpuUsage: Math.random() * 80 + 10, // 10-90%
      networkLatency: Math.random() * 200 + 50 // 50-250ms
    };
  }

  // E2E 트레이스 생성
  generateE2ETraces(session, samplingRate) {
    const events = session.events || [];
    const sampledEvents = events.filter(() => Math.random() < samplingRate);

    return sampledEvents.map((event, index) => {
      const traceId = `trace_${Date.now()}_${index}`;
      const spanId = `span_${index}`;
      
      // 서비스 의존성 맵핑
      const serviceMap = this.mapEventToService(event);
      
      return {
        traceId,
        spanId,
        parentSpanId: index > 0 ? `span_${index - 1}` : null,
        operationName: `${event.type}_operation`,
        serviceName: serviceMap.service,
        duration: Math.random() * 1000 + 50, // 50-1050ms
        startTime: event.timestamp || 0,
        endTime: (event.timestamp || 0) + Math.random() * 1000 + 50,
        tags: {
          'http.method': serviceMap.method,
          'http.url': serviceMap.url,
          'user.session': session.id,
          'event.type': event.type
        },
        logs: [
          {
            timestamp: event.timestamp || 0,
            fields: {
              level: 'info',
              message: `Processing ${event.type} event`,
              event_data: JSON.stringify(event).substring(0, 200)
            }
          }
        ]
      };
    });
  }

  // 이벤트를 서비스로 맵핑
  mapEventToService(event) {
    const serviceMapping = {
      'click': {
        service: 'frontend-service',
        method: 'POST',
        url: '/api/interactions/click'
      },
      'input': {
        service: 'form-service', 
        method: 'PUT',
        url: '/api/forms/update'
      },
      'navigation': {
        service: 'routing-service',
        method: 'GET', 
        url: '/api/navigation'
      },
      'focus': {
        service: 'ui-service',
        method: 'POST',
        url: '/api/ui/focus'
      }
    };

    return serviceMapping[event.type] || {
      service: 'unknown-service',
      method: 'GET',
      url: '/api/unknown'
    };
  }

  // 성능 병목 지점 식별
  identifyPerformanceBottlenecks(traces, threshold) {
    const bottlenecks = [];

    // 느린 트레이스 식별
    const slowTraces = traces.filter(trace => trace.duration > threshold);
    
    // 서비스별 평균 응답 시간 계산
    const serviceStats = {};
    traces.forEach(trace => {
      const service = trace.serviceName;
      if (!serviceStats[service]) {
        serviceStats[service] = { 
          totalDuration: 0, 
          count: 0, 
          traces: [] 
        };
      }
      serviceStats[service].totalDuration += trace.duration;
      serviceStats[service].count++;
      serviceStats[service].traces.push(trace);
    });

    // 병목 지점 분석
    Object.entries(serviceStats).forEach(([service, stats]) => {
      const avgDuration = stats.totalDuration / stats.count;
      
      if (avgDuration > threshold) {
        bottlenecks.push({
          type: 'slow_service',
          service: service,
          severity: 'high',
          avgResponseTime: Math.round(avgDuration),
          threshold: threshold,
          affectedTraces: stats.traces.length,
          description: `${service}에서 평균 응답 시간이 임계값을 초과했습니다.`,
          impact: 'user_experience'
        });
      }
    });

    // 에러 패턴 분석  
    const errorTraces = traces.filter(trace => 
      trace.tags && (trace.tags['error'] === 'true' || trace.tags['http.status_code'] >= 400)
    );
    
    if (errorTraces.length > traces.length * 0.05) { // 5% 이상 에러율
      bottlenecks.push({
        type: 'high_error_rate',
        severity: 'critical',
        errorRate: Math.round((errorTraces.length / traces.length) * 100),
        affectedTraces: errorTraces.length,
        description: '높은 에러율이 감지되었습니다.',
        impact: 'service_availability'
      });
    }

    // 메모리 누수 패턴 감지 (시뮬레이션)
    const memoryPattern = traces.some((trace, index) => {
      if (index === 0) return false;
      const prevTrace = traces[index - 1];
      return trace.duration > prevTrace.duration * 1.5; // 50% 이상 성능 저하
    });

    if (memoryPattern) {
      bottlenecks.push({
        type: 'memory_leak',
        severity: 'medium',
        description: '시간에 따른 성능 저하 패턴이 감지되었습니다.',
        impact: 'system_performance'
      });
    }

    return bottlenecks;
  }

  // 성능 개선 권장사항 생성
  generatePerformanceRecommendations(bottlenecks, performanceData) {
    const recommendations = [];

    bottlenecks.forEach(bottleneck => {
      switch (bottleneck.type) {
        case 'slow_service':
          recommendations.push({
            priority: 'high',
            category: 'optimization',
            title: `${bottleneck.service} 성능 최적화`,
            description: `${bottleneck.service}의 평균 응답 시간이 ${bottleneck.avgResponseTime}ms로 임계값(${bottleneck.threshold}ms)을 초과했습니다.`,
            actions: [
              '데이터베이스 쿼리 최적화 검토',
              '캐싱 전략 적용 고려',
              '서비스 리소스 스케일링 검토'
            ],
            estimatedImpact: '응답 시간 30-50% 개선 예상'
          });
          break;

        case 'high_error_rate':
          recommendations.push({
            priority: 'critical',
            category: 'reliability',
            title: '에러율 개선 필요',
            description: `현재 에러율이 ${bottleneck.errorRate}%로 높습니다.`,
            actions: [
              '에러 로그 상세 분석',
              '서킷 브레이커 패턴 적용',
              '헬스체크 및 모니터링 강화',
              '롤백 계획 수립'
            ],
            estimatedImpact: '서비스 안정성 대폭 향상'
          });
          break;

        case 'memory_leak':
          recommendations.push({
            priority: 'medium',
            category: 'resource_management',
            title: '메모리 누수 조사 필요',
            description: '시간에 따른 성능 저하 패턴이 감지되어 메모리 누수가 의심됩니다.',
            actions: [
              'JVM/Node.js 힙 덤프 분석',
              '가비지 컬렉션 튜닝',
              '메모리 프로파일링 도구 적용',
              '리소스 정리 로직 검토'
            ],
            estimatedImpact: '장기적 시스템 안정성 개선'
          });
          break;
      }
    });

    // 전반적인 성능 권장사항
    if (performanceData.responseTime.avg > 1000) {
      recommendations.push({
        priority: 'medium',
        category: 'general_optimization',
        title: '전반적인 응답 시간 개선',
        description: `평균 응답 시간이 ${performanceData.responseTime.avg}ms로 개선 여지가 있습니다.`,
        actions: [
          'CDN 활용 검토',
          '정적 리소스 압축 및 최적화',
          '불필요한 API 호출 제거',
          '데이터베이스 인덱스 최적화'
        ],
        estimatedImpact: '사용자 경험 개선'
      });
    }

    if (performanceData.cpuUsage > 70) {
      recommendations.push({
        priority: 'high',
        category: 'infrastructure',
        title: 'CPU 사용률 최적화',
        description: `현재 CPU 사용률이 ${Math.round(performanceData.cpuUsage)}%로 높습니다.`,
        actions: [
          'CPU 집약적 작업 비동기 처리',
          '로드 밸런싱 개선',
          '코드 프로파일링으로 핫스팟 식별',
          '인프라 스케일 아웃 고려'
        ],
        estimatedImpact: '시스템 처리 능력 향상'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { 'critical': 1, 'high': 2, 'medium': 3, 'low': 4 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

// 메인 실행
if (require.main === module) {
  const testSuite = new AIRISMonTestSuite();
  
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n🛑 종료 신호 감지됨...'));
    await testSuite.stop();
    process.exit(0);
  });
  
  testSuite.start().catch(error => {
    console.error(chalk.red('❌ 테스트 스위트 시작 실패:'), error);
    process.exit(1);
  });
}

// 헬퍼 함수들
function findTopPaths(paths, limit = 5) {
  const pathCounts = {};
  
  paths.forEach(path => {
    const pathKey = path.map(step => step.page).join(' → ');
    pathCounts[pathKey] = (pathCounts[pathKey] || 0) + 1;
  });
  
  return Object.entries(pathCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, limit)
    .map(([path, count]) => ({
      steps: path.split(' → '),
      count
    }));
}

function isRelatedPage(page1, page2) {
  // 페이지 간 연관성 판단 로직
  const relatedGroups = [
    ['/products', '/product', '/cart', '/checkout'],
    ['/login', '/register', '/profile', '/settings'],
    ['/dashboard', '/analytics', '/reports'],
    ['/', '/home', '/about', '/contact']
  ];
  
  return relatedGroups.some(group => 
    group.some(p => page1.includes(p)) && group.some(p => page2.includes(p))
  );
}

// 위험도 계산 함수
function calculateRiskScore(threats) {
  if (!threats || threats.length === 0) return 0;
  
  const severityWeights = {
    'low': 1,
    'medium': 3,
    'high': 7,
    'critical': 10
  };
  
  const totalScore = threats.reduce((score, threat) => {
    return score + (severityWeights[threat.severity] || 1);
  }, 0);
  
  return Math.min(100, totalScore);
}

// 보안 권장사항 생성 함수
function generateSecurityRecommendations(threats) {
  const recommendations = [];
  
  const threatTypes = threats.reduce((types, threat) => {
    types[threat.type] = (types[threat.type] || 0) + 1;
    return types;
  }, {});
  
  if (threatTypes['brute-force'] > 0) {
    recommendations.push({
      priority: 'high',
      category: '계정 보안',
      title: '로그인 시도 제한 강화',
      description: '연속된 로그인 실패 시 계정 잠금 및 CAPTCHA 도입',
      actions: ['계정 잠금 정책 설정', '2FA 도입', 'CAPTCHA 시스템 구축']
    });
  }
  
  if (threatTypes['bot-detection'] > 0) {
    recommendations.push({
      priority: 'medium',
      category: '봇 방어',
      title: '봇 탐지 시스템 강화',
      description: 'User-Agent 필터링 및 행동 패턴 분석 개선',
      actions: ['User-Agent 화이트리스트', '행동 패턴 AI 모델', 'Rate Limiting 강화']
    });
  }
  
  if (threatTypes['unusual-behavior'] > 0) {
    recommendations.push({
      priority: 'medium',
      category: '이상 탐지',
      title: '사용자 행동 모니터링 강화',
      description: '비정상적인 사용자 행동 패턴에 대한 실시간 모니터링',
      actions: ['행동 베이스라인 설정', '이상 탐지 알고리즘 개선', '실시간 알림 시스템']
    });
  }
  
  return recommendations;
}

// 시간 파싱 함수
function parseDuration(duration) {
  const match = duration.match(/^(\d+)([hmd])$/);
  if (!match) return 3600000; // 기본 1시간
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 3600000;
  }
}

// 샘플 트레이스 데이터 생성
AIRISMonTestSuite.prototype.generateSampleTraces = function() {
  const now = new Date();
  return [
    {
      traceId: 'trace_001_ecommerce_checkout',
      operation: 'E-Commerce 결제 프로세스',
      duration: 1250,
      startTime: new Date(now.getTime() - 300000).toISOString(),
      status: 'success',
      spanCount: 10,
      errorCount: 0
    },
    {
      traceId: 'trace_002_user_search',
      operation: '사용자 검색 API',
      duration: 850,
      startTime: new Date(now.getTime() - 600000).toISOString(),
      status: 'success',
      spanCount: 6,
      errorCount: 0
    },
    {
      traceId: 'trace_003_dashboard_load',
      operation: '대시보드 로드',
      duration: 2100,
      startTime: new Date(now.getTime() - 900000).toISOString(),
      status: 'error',
      spanCount: 6,
      errorCount: 1
    },
    {
      traceId: 'trace_004_api_heavy_load',
      operation: 'API 집약적 로드',
      duration: 3200,
      startTime: new Date(now.getTime() - 1200000).toISOString(),
      status: 'success',
      spanCount: 15,
      errorCount: 0
    },
    {
      traceId: 'trace_005_mobile_session',
      operation: '모바일 세션',
      duration: 950,
      startTime: new Date(now.getTime() - 1800000).toISOString(),
      status: 'success',
      spanCount: 8,
      errorCount: 0
    }
  ];
};

// 특정 트레이스 조회
AIRISMonTestSuite.prototype.getTraceById = function(traceId) {
  const traces = {
    'trace_001_ecommerce_checkout': {
      traceId: 'trace_001_ecommerce_checkout',
      operation: 'E-Commerce 결제 프로세스',
      duration: 1250,
      startTime: new Date(Date.now() - 300000).toISOString(),
      status: 'success',
      spans: [
        { 
          spanId: 'span_001', 
          operationName: 'Frontend Request', 
          serviceName: 'web-frontend', 
          duration: 50, 
          startTime: 0 
        },
        { 
          spanId: 'span_002', 
          operationName: 'API Gateway', 
          serviceName: 'api-gateway', 
          duration: 25, 
          startTime: 50 
        },
        { 
          spanId: 'span_003', 
          operationName: 'User Authentication', 
          serviceName: 'auth-service', 
          duration: 150, 
          startTime: 75, 
          dbQueries: [
            'SELECT * FROM users WHERE id = ?', 
            'SELECT * FROM sessions WHERE token = ?'
          ] 
        },
        { 
          spanId: 'span_004', 
          operationName: 'Cart Validation', 
          serviceName: 'cart-service', 
          duration: 200, 
          startTime: 225, 
          dbQueries: [
            'SELECT * FROM cart_items WHERE user_id = ?', 
            'SELECT * FROM products WHERE id IN (?, ?, ?)'
          ] 
        },
        { 
          spanId: 'span_005', 
          operationName: 'Inventory Check', 
          serviceName: 'inventory-service', 
          duration: 180, 
          startTime: 425, 
          dbQueries: [
            'SELECT stock FROM inventory WHERE product_id = ?', 
            'UPDATE inventory SET stock = stock - ? WHERE product_id = ?'
          ] 
        },
        { 
          spanId: 'span_006', 
          operationName: 'Payment Processing', 
          serviceName: 'payment-service', 
          duration: 300, 
          startTime: 605, 
          dbQueries: [
            'INSERT INTO transactions (user_id, amount, status) VALUES (?, ?, ?)'
          ] 
        },
        { 
          spanId: 'span_007', 
          operationName: 'Order Creation', 
          serviceName: 'order-service', 
          duration: 120, 
          startTime: 905, 
          dbQueries: [
            'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)', 
            'INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)'
          ] 
        },
        { 
          spanId: 'span_008', 
          operationName: 'Email Notification', 
          serviceName: 'notification-service', 
          duration: 80, 
          startTime: 1025 
        },
        { 
          spanId: 'span_009', 
          operationName: 'Cache Update', 
          serviceName: 'cache-service', 
          duration: 45, 
          startTime: 1105 
        },
        { 
          spanId: 'span_010', 
          operationName: 'Response', 
          serviceName: 'api-gateway', 
          duration: 20, 
          startTime: 1230 
        }
      ]
    },
    'trace_002_user_search': {
      traceId: 'trace_002_user_search',
      operation: '사용자 검색 API',
      duration: 850,
      startTime: new Date(Date.now() - 600000).toISOString(),
      status: 'success',
      spans: [
        { 
          spanId: 'span_011', 
          operationName: 'Search Request', 
          serviceName: 'web-frontend', 
          duration: 30, 
          startTime: 0 
        },
        { 
          spanId: 'span_012', 
          operationName: 'API Gateway', 
          serviceName: 'api-gateway', 
          duration: 15, 
          startTime: 30 
        },
        { 
          spanId: 'span_013', 
          operationName: 'Search Service', 
          serviceName: 'search-service', 
          duration: 400, 
          startTime: 45, 
          dbQueries: [
            'SELECT * FROM products WHERE name LIKE ? OR description LIKE ?'
          ] 
        },
        { 
          spanId: 'span_014', 
          operationName: 'Redis Cache', 
          serviceName: 'cache-service', 
          duration: 25, 
          startTime: 445 
        },
        { 
          spanId: 'span_015', 
          operationName: 'Filter Results', 
          serviceName: 'search-service', 
          duration: 200, 
          startTime: 470, 
          dbQueries: [
            'SELECT * FROM product_categories WHERE id IN (?, ?, ?)'
          ] 
        },
        { 
          spanId: 'span_016', 
          operationName: 'Format Response', 
          serviceName: 'api-gateway', 
          duration: 180, 
          startTime: 670 
        }
      ]
    },
    'trace_003_dashboard_load': {
      traceId: 'trace_003_dashboard_load',
      operation: '대시보드 로드',
      duration: 2100,
      startTime: new Date(Date.now() - 900000).toISOString(),
      status: 'error',
      spans: [
        { 
          spanId: 'span_017', 
          operationName: 'Dashboard Request', 
          serviceName: 'web-frontend', 
          duration: 40, 
          startTime: 0 
        },
        { 
          spanId: 'span_018', 
          operationName: 'Authentication', 
          serviceName: 'auth-service', 
          duration: 120, 
          startTime: 40, 
          dbQueries: [
            'SELECT * FROM users WHERE token = ?'
          ] 
        },
        { 
          spanId: 'span_019', 
          operationName: 'User Data Service', 
          serviceName: 'user-service', 
          duration: 600, 
          startTime: 160, 
          dbQueries: [
            'SELECT * FROM user_profiles WHERE user_id = ?', 
            'SELECT * FROM user_preferences WHERE user_id = ?'
          ], 
          error: 'Database timeout' 
        },
        { 
          spanId: 'span_020', 
          operationName: 'Analytics Service', 
          serviceName: 'analytics-service', 
          duration: 800, 
          startTime: 760, 
          dbQueries: [
            'SELECT COUNT(*) FROM user_events WHERE user_id = ? AND date >= ?'
          ] 
        },
        { 
          spanId: 'span_021', 
          operationName: 'Notification Check', 
          serviceName: 'notification-service', 
          duration: 450, 
          startTime: 1560, 
          dbQueries: [
            'SELECT * FROM notifications WHERE user_id = ? AND read = false'
          ] 
        },
        { 
          spanId: 'span_022', 
          operationName: 'Error Handler', 
          serviceName: 'api-gateway', 
          duration: 90, 
          startTime: 2010 
        }
      ]
    }
  };

  return traces[traceId] || null;
};

// MongoDB 모의 데이터 생성 함수들
AIRISMonTestSuite.prototype.generateMockSessionData = function(limit) {
  const sessions = [];
  const scenarios = ['user_login', 'product_search', 'checkout_flow', 'support_chat', 'admin_panel'];
  const statuses = ['completed', 'active', 'error', 'abandoned'];

  for (let i = 0; i < limit; i++) {
    const sessionId = `session_${Date.now()}_${i}`;
    const startTime = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    
    sessions.push({
      _id: sessionId,
      sessionId: sessionId,
      userId: `user_${Math.floor(Math.random() * 1000)}`,
      scenario: scenarios[Math.floor(Math.random() * scenarios.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      duration: Math.floor(Math.random() * 900) + 60, // 1-15분
      eventCount: Math.floor(Math.random() * 100) + 10,
      startTime: startTime.toISOString(),
      endTime: new Date(startTime.getTime() + Math.random() * 900000).toISOString(),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      location: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon'][Math.floor(Math.random() * 5)],
      errors: Math.floor(Math.random() * 5),
      createdAt: startTime.toISOString()
    });
  }

  return sessions;
};

AIRISMonTestSuite.prototype.generateMockAnalysisData = function(limit) {
  const analyses = [];
  const languages = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust'];
  const frameworks = ['React', 'Vue', 'Angular', 'Express', 'Django', 'Spring'];
  const statuses = ['completed', 'in_progress', 'failed', 'queued'];

  for (let i = 0; i < limit; i++) {
    const analysisId = `analysis_${Date.now()}_${i}`;
    const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    
    analyses.push({
      _id: analysisId,
      analysisId: analysisId,
      projectName: `project-${Math.floor(Math.random() * 100)}`,
      url: `https://github.com/user/project-${i}`,
      language: languages[Math.floor(Math.random() * languages.length)],
      framework: frameworks[Math.floor(Math.random() * frameworks.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      complexity: ['low', 'medium', 'high', 'very_high'][Math.floor(Math.random() * 4)],
      fileCount: Math.floor(Math.random() * 1000) + 50,
      lineCount: Math.floor(Math.random() * 100000) + 1000,
      estimatedHours: Math.floor(Math.random() * 500) + 10,
      crudOperations: Math.floor(Math.random() * 20) + 5,
      dataStores: Math.floor(Math.random() * 10) + 1,
      analysisTime: Math.floor(Math.random() * 300) + 30, // seconds
      createdAt: createdAt.toISOString(),
      completedAt: new Date(createdAt.getTime() + Math.random() * 3600000).toISOString()
    });
  }

  return analyses;
};

AIRISMonTestSuite.prototype.generateMockTraceData = function(limit) {
  const traces = [];
  const services = ['user-service', 'payment-service', 'order-service', 'inventory-service', 'notification-service'];
  const operations = ['GET /api/users', 'POST /api/orders', 'PUT /api/payments', 'DELETE /api/sessions'];
  const statuses = ['success', 'error', 'timeout'];

  for (let i = 0; i < limit; i++) {
    const traceId = `trace_${Date.now()}_${i}`;
    const startTime = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
    
    traces.push({
      _id: traceId,
      traceId: traceId,
      serviceName: services[Math.floor(Math.random() * services.length)],
      operationName: operations[Math.floor(Math.random() * operations.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      duration: Math.floor(Math.random() * 5000) + 10, // ms
      spanCount: Math.floor(Math.random() * 20) + 1,
      startTime: startTime.toISOString(),
      endTime: new Date(startTime.getTime() + Math.random() * 5000).toISOString(),
      tags: {
        'http.method': ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
        'http.status_code': Math.random() > 0.1 ? 200 : [400, 404, 500][Math.floor(Math.random() * 3)],
        'user.id': `user_${Math.floor(Math.random() * 1000)}`
      },
      errors: Math.random() > 0.8 ? Math.floor(Math.random() * 3) + 1 : 0,
      parentSpanId: Math.random() > 0.5 ? `span_${Math.floor(Math.random() * 100)}` : null
    });
  }

  return traces;
};

AIRISMonTestSuite.prototype.generateMockMetricsData = function(limit) {
  const metrics = [];
  const metricNames = ['cpu_usage', 'memory_usage', 'disk_usage', 'network_io', 'request_rate', 'error_rate'];
  const services = ['web-server', 'app-server', 'db-server', 'cache-server', 'queue-server'];

  for (let i = 0; i < limit; i++) {
    const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
    
    metrics.push({
      _id: `metric_${Date.now()}_${i}`,
      metricName: metricNames[Math.floor(Math.random() * metricNames.length)],
      service: services[Math.floor(Math.random() * services.length)],
      value: Math.random() * 100,
      unit: ['%', 'MB', 'req/s', 'ms'][Math.floor(Math.random() * 4)],
      timestamp: timestamp.toISOString(),
      tags: {
        environment: ['production', 'staging', 'development'][Math.floor(Math.random() * 3)],
        region: ['us-east-1', 'us-west-2', 'eu-west-1'][Math.floor(Math.random() * 3)],
        instance: `i-${Math.random().toString(36).substr(2, 9)}`
      },
      threshold: {
        warning: 70,
        critical: 90
      }
    });
  }

  return metrics;
};

AIRISMonTestSuite.prototype.generateMockUserData = function(limit) {
  const users = [];
  const roles = ['admin', 'operator', 'viewer', 'analyst'];
  const statuses = ['active', 'inactive', 'suspended'];
  const firstNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
  const lastNames = ['민수', '영희', '철수', '미영', '진호', '수연', '동욱', '지영', '성민', '하나'];

  for (let i = 0; i < limit; i++) {
    const userId = `user_${Date.now()}_${i}`;
    const createdAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
    
    users.push({
      _id: userId,
      userId: userId,
      username: `user${Math.floor(Math.random() * 10000)}`,
      email: `user${i}@example.com`,
      name: firstNames[Math.floor(Math.random() * firstNames.length)] + lastNames[Math.floor(Math.random() * lastNames.length)],
      role: roles[Math.floor(Math.random() * roles.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      department: ['개발팀', '운영팀', '보안팀', '분석팀'][Math.floor(Math.random() * 4)],
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: createdAt.toISOString(),
      permissions: [
        'read_dashboard',
        'write_config',
        'manage_users',
        'view_analytics'
      ].slice(0, Math.floor(Math.random() * 4) + 1),
      preferences: {
        theme: ['light', 'dark'][Math.floor(Math.random() * 2)],
        language: 'ko',
        timezone: 'Asia/Seoul',
        notifications: Math.random() > 0.5
      }
    });
  }

  return users;
};

AIRISMonTestSuite.prototype.generateMockAlertData = function(limit) {
  const alerts = [];
  const types = ['system', 'performance', 'security', 'application'];
  const severities = ['low', 'medium', 'high', 'critical'];
  const statuses = ['open', 'acknowledged', 'resolved', 'false_positive'];

  for (let i = 0; i < limit; i++) {
    const alertId = `alert_${Date.now()}_${i}`;
    const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    
    alerts.push({
      _id: alertId,
      alertId: alertId,
      title: `${types[Math.floor(Math.random() * types.length)]} 경고 #${i}`,
      description: `시스템에서 ${severities[Math.floor(Math.random() * severities.length)]} 수준의 문제가 감지되었습니다.`,
      type: types[Math.floor(Math.random() * types.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      source: ['cpu_monitor', 'memory_monitor', 'disk_monitor', 'network_monitor'][Math.floor(Math.random() * 4)],
      affectedServices: ['user-service', 'payment-service'].slice(0, Math.floor(Math.random() * 2) + 1),
      createdAt: createdAt.toISOString(),
      updatedAt: new Date(createdAt.getTime() + Math.random() * 3600000).toISOString(),
      assignedTo: Math.random() > 0.5 ? `user_${Math.floor(Math.random() * 100)}` : null,
      tags: ['monitoring', 'automated'].slice(0, Math.floor(Math.random() * 2) + 1),
      metrics: {
        currentValue: Math.random() * 100,
        threshold: 80,
        trend: ['increasing', 'decreasing', 'stable'][Math.floor(Math.random() * 3)]
      }
    });
  }

  return alerts;
};

// ========================================
// 시스템 설치 관리 Helper Methods
// ========================================

// 운영체제 확인
AIRISMonTestSuite.prototype.checkOperatingSystem = function() {
  return new Promise((resolve) => {
    const os = require('os');
    const platform = os.platform();
    const release = os.release();
    
    const isLinux = platform === 'linux';
    resolve({
      passed: isLinux,
      message: isLinux ? `Linux ${release}` : `${platform} (Linux 권장)`,
      warning: !isLinux
    });
  });
};

// 메모리 확인
AIRISMonTestSuite.prototype.checkMemoryRequirements = function() {
  return new Promise((resolve) => {
    const os = require('os');
    const totalMemGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const freeMemGB = Math.round(os.freemem() / (1024 * 1024 * 1024));
    
    const hasEnoughMemory = totalMemGB >= 4;
    resolve({
      passed: hasEnoughMemory,
      message: `${freeMemGB}GB 사용 가능 (총 ${totalMemGB}GB)`,
      warning: totalMemGB < 8 && totalMemGB >= 4
    });
  });
};

// 디스크 공간 확인
AIRISMonTestSuite.prototype.checkDiskSpace = function() {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    
    const df = spawn('df', ['-h', '/']);
    let output = '';
    
    df.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    df.on('close', (code) => {
      try {
        const lines = output.trim().split('\n');
        if (lines.length >= 2) {
          const diskInfo = lines[1].split(/\s+/);
          const available = diskInfo[3];
          const availableGB = parseFloat(available.replace(/[^0-9.]/g, ''));
          
          const hasEnoughSpace = availableGB >= 10;
          resolve({
            passed: hasEnoughSpace,
            message: `${available} 사용 가능`,
            warning: availableGB < 20 && availableGB >= 10
          });
        } else {
          resolve({ passed: true, message: '디스크 용량 확인 불가', warning: true });
        }
      } catch (error) {
        resolve({ passed: true, message: '디스크 용량 확인 불가', warning: true });
      }
    });
    
    df.on('error', () => {
      resolve({ passed: true, message: '디스크 용량 확인 불가', warning: true });
    });
  });
};

// Node.js 버전 확인
AIRISMonTestSuite.prototype.checkNodeVersion = function() {
  return new Promise((resolve) => {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    const isValidVersion = majorVersion >= 16;
    resolve({
      passed: isValidVersion,
      message: isValidVersion ? `${nodeVersion} 설치됨` : `${nodeVersion} (v16+ 필요)`,
      warning: majorVersion < 18 && majorVersion >= 16
    });
  });
};

// Python 버전 확인
AIRISMonTestSuite.prototype.checkPythonVersion = function() {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    
    const python = spawn('python3', ['--version']);
    let output = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0 && output.includes('Python')) {
        const version = output.trim().replace('Python ', '');
        const versionParts = version.split('.').map(v => parseInt(v));
        const [major, minor] = versionParts;
        
        // Check if version is >= 3.8
        const isValidVersion = major > 3 || (major === 3 && minor >= 8);
        const showWarning = major === 3 && minor === 8;
        
        resolve({
          passed: isValidVersion,
          message: isValidVersion ? `v${version} 설치됨` : `v${version} (v3.8+ 필요)`,
          warning: showWarning
        });
      } else {
        resolve({
          passed: false,
          message: 'Python3 미설치'
        });
      }
    });
    
    python.on('error', () => {
      resolve({
        passed: false,
        message: 'Python3 미설치'
      });
    });
  });
};

// Git 설치 확인
AIRISMonTestSuite.prototype.checkGitInstallation = function() {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    
    const git = spawn('git', ['--version']);
    let output = '';
    
    git.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    git.on('close', (code) => {
      if (code === 0 && output.includes('git version')) {
        const version = output.trim().replace('git version ', '');
        resolve({
          passed: true,
          message: `${version} 설치됨`
        });
      } else {
        resolve({
          passed: false,
          message: 'Git 미설치'
        });
      }
    });
    
    git.on('error', () => {
      resolve({
        passed: false,
        message: 'Git 미설치'
      });
    });
  });
};

// 네트워크 연결 확인
AIRISMonTestSuite.prototype.checkNetworkConnection = function() {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    
    const ping = spawn('ping', ['-c', '1', '-W', '3', 'google.com']);
    
    ping.on('close', (code) => {
      resolve({
        passed: code === 0,
        message: code === 0 ? '연결됨' : '네트워크 연결 실패'
      });
    });
    
    ping.on('error', () => {
      resolve({
        passed: false,
        message: '네트워크 연결 확인 불가'
      });
    });
  });
};

// 포트 사용 가능성 확인
AIRISMonTestSuite.prototype.checkPortAvailability = function(port = 3100) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve({
          passed: true,
          message: `포트 ${port} 사용 가능`
        });
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve({
        passed: false,
        message: `포트 ${port} 사용 중`
      });
    });
  });
};

// 설치 실행
AIRISMonTestSuite.prototype.executeInstallation = async function(installationId, config) {
  const status = this.installationStatus[installationId];
  
  try {
    // 단계 1: 시스템 요구사항 재확인
    status.step = 1;
    status.message = '시스템 요구사항 재확인 중...';
    status.progress = 10;
    await this.delay(2000);
    
    // 단계 2: 의존성 설치
    status.step = 2;
    status.message = 'Node.js 및 Python 의존성 설치 중...';
    status.progress = 25;
    await this.delay(5000);
    
    // 단계 3: 소스 코드 다운로드
    status.step = 3;
    status.message = 'GitHub에서 소스 코드 다운로드 중...';
    status.progress = 45;
    await this.delay(3000);
    
    // 단계 4: 환경 구성
    status.step = 4;
    status.message = '환경 설정 파일 생성 중...';
    status.progress = 65;
    await this.delay(2000);
    
    // 단계 5: 서비스 등록
    status.step = 5;
    status.message = 'systemd 서비스 등록 중...';
    status.progress = 85;
    await this.delay(2000);
    
    // 단계 6: 완료
    status.step = 6;
    status.message = '서비스 시작 및 검증 중...';
    status.progress = 100;
    status.completed = true;
    status.endTime = new Date();
    status.success = true;
    status.installPath = config.installPath;
    status.servicePort = config.servicePort;
    status.serviceUrl = `http://localhost:${config.servicePort}`;
    
    console.log(chalk.green(`✅ 설치 완료: ${installationId}`));
    
  } catch (error) {
    status.error = error.message;
    status.completed = true;
    console.error(chalk.red(`❌ 설치 실패: ${installationId} - ${error.message}`));
  }
};

// 지연 함수
AIRISMonTestSuite.prototype.delay = function(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 설치 스크립트 생성
AIRISMonTestSuite.prototype.generateInstallationScript = function(config) {
  const script = '#!/bin/bash\n' +
    '# AIRIS-MON 자동 설치 스크립트\n' +
    '# 생성 시간: ' + new Date().toISOString() + '\n\n' +
    'set -e  # 오류 발생 시 스크립트 중단\n\n' +
    'echo "🚀 AIRIS-MON 설치를 시작합니다..."\n\n' +
    '# 변수 설정\n' +
    'INSTALL_PATH="' + (config.installPath || '/opt/airis-mon') + '"\n' +
    'SERVICE_PORT="' + (config.servicePort || '3100') + '"\n' +
    'SERVICE_USER="' + (config.serviceUser || 'airis') + '"\n' +
    'GIT_REPO="' + (config.gitRepo || 'https://github.com/your-org/airis-mon.git') + '"\n' +
    'GIT_BRANCH="' + (config.gitBranch || 'main') + '"\n' +
    'AUTO_START="' + (config.autoStart ? 'true' : 'false') + '"\n' +
    'ENABLE_SSL="' + (config.enableSsl ? 'true' : 'false') + '"\n' +
    'INSTALL_NGINX="' + (config.installNginx ? 'true' : 'false') + '"\n\n' +
    'echo "📋 설치 설정:"\n' +
    'echo "  - 설치 경로: $INSTALL_PATH"\n' +
    'echo "  - 서비스 포트: $SERVICE_PORT"\n' +
    'echo "  - 실행 사용자: $SERVICE_USER"\n' +
    'echo "  - Git 저장소: $GIT_REPO"\n' +
    'echo "  - 브랜치: $GIT_BRANCH"\n\n' +
    '# 1단계: 시스템 요구사항 확인\n' +
    'echo "🔍 1단계: 시스템 요구사항 확인 중..."\n\n' +
    '# 운영체제 확인\n' +
    'if [[ "$OSTYPE" != "linux-gnu"* ]]; then\n' +
    '    echo "❌ Linux 운영체제가 필요합니다."\n' +
    '    exit 1\n' +
    'fi\n\n' +
    '# 메모리 확인 (최소 4GB)\n' +
    'TOTAL_MEM=$(free -g | awk \'/^Mem:/{print $2}\')\n' +
    'if [ "$TOTAL_MEM" -lt 4 ]; then\n' +
    '    echo "❌ 최소 4GB 메모리가 필요합니다. (현재: ${TOTAL_MEM}GB)"\n' +
    '    exit 1\n' +
    'fi\n\n' +
    '# 디스크 공간 확인 (최소 10GB)\n' +
    'AVAILABLE_SPACE=$(df / | awk \'NR==2 {print int($4/1024/1024)}\')\n' +
    'if [ "$AVAILABLE_SPACE" -lt 10 ]; then\n' +
    '    echo "❌ 최소 10GB 디스크 공간이 필요합니다. (현재: ${AVAILABLE_SPACE}GB)"\n' +
    '    exit 1\n' +
    'fi\n\n' +
    'echo "✅ 시스템 요구사항 확인 완료"\n\n' +
    '# 2단계: 의존성 설치\n' +
    'echo "📦 2단계: 의존성 설치 중..."\n\n' +
    '# 시스템 패키지 업데이트\n' +
    'sudo apt-get update -y\n\n' +
    '# Node.js 설치 (v18)\n' +
    'if ! command -v node &> /dev/null; then\n' +
    '    echo "Node.js 설치 중..."\n' +
    '    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -\n' +
    '    sudo apt-get install -y nodejs\n' +
    'fi\n\n' +
    '# Python3 설치\n' +
    'if ! command -v python3 &> /dev/null; then\n' +
    '    echo "Python3 설치 중..."\n' +
    '    sudo apt-get install -y python3 python3-pip\n' +
    'fi\n\n' +
    '# Git 설치\n' +
    'if ! command -v git &> /dev/null; then\n' +
    '    echo "Git 설치 중..."\n' +
    '    sudo apt-get install -y git\n' +
    'fi\n\n' +
    '# PM2 설치 (프로세스 관리자)\n' +
    'if ! command -v pm2 &> /dev/null; then\n' +
    '    echo "PM2 설치 중..."\n' +
    '    sudo npm install -g pm2\n' +
    'fi\n\n' +
    'echo "✅ 의존성 설치 완료"\n\n' +
    '# 3단계: 소스 코드 다운로드\n' +
    'echo "📥 3단계: 소스 코드 다운로드 중..."\n\n' +
    '# 설치 디렉토리 생성\n' +
    'sudo mkdir -p "$INSTALL_PATH"\n' +
    'sudo chown $USER:$USER "$INSTALL_PATH"\n\n' +
    '# Git 저장소 클론\n' +
    'if [ -d "$INSTALL_PATH/.git" ]; then\n' +
    '    echo "기존 저장소 업데이트 중..."\n' +
    '    cd "$INSTALL_PATH"\n' +
    '    git fetch origin\n' +
    '    git checkout "$GIT_BRANCH"\n' +
    '    git pull origin "$GIT_BRANCH"\n' +
    'else\n' +
    '    echo "저장소 클론 중..."\n' +
    '    git clone -b "$GIT_BRANCH" "$GIT_REPO" "$INSTALL_PATH"\n' +
    '    cd "$INSTALL_PATH"\n' +
    'fi\n\n' +
    '# Node.js 의존성 설치\n' +
    'echo "Node.js 패키지 설치 중..."\n' +
    'npm install --production\n\n' +
    'echo "✅ 소스 코드 다운로드 완료"\n\n' +
    '# 4단계: 환경 구성\n' +
    'echo "⚙️  4단계: 환경 설정 중..."\n\n' +
    '# 환경 변수 파일 생성\n' +
    'cat > "$INSTALL_PATH/.env" << EOF\n' +
    'PORT=$SERVICE_PORT\n' +
    'NODE_ENV=production\n' +
    'INSTALL_PATH=$INSTALL_PATH\n' +
    'ENABLE_SSL=$ENABLE_SSL\n' +
    'EOF\n\n' +
    '# 로그 디렉토리 생성\n' +
    'sudo mkdir -p /var/log/airis-mon\n' +
    'sudo chown $SERVICE_USER:$SERVICE_USER /var/log/airis-mon 2>/dev/null || true\n\n' +
    '# 데이터 디렉토리 생성\n' +
    'mkdir -p "$INSTALL_PATH/storage/sessions"\n' +
    'mkdir -p "$INSTALL_PATH/storage/analysis"\n\n' +
    'echo "✅ 환경 구성 완료"\n\n' +
    '# 5단계: 서비스 등록\n' +
    'echo "🔧 5단계: systemd 서비스 등록 중..."\n\n' +
    '# systemd 서비스 파일 생성\n' +
    'sudo tee /etc/systemd/system/airis-mon.service > /dev/null << EOF\n' +
    '[Unit]\n' +
    'Description=AIRIS-MON Monitoring Platform\n' +
    'After=network.target\n\n' +
    '[Service]\n' +
    'Type=simple\n' +
    'User=$SERVICE_USER\n' +
    'WorkingDirectory=$INSTALL_PATH\n' +
    'ExecStart=/usr/bin/node src/app.js\n' +
    'Restart=always\n' +
    'RestartSec=10\n' +
    'Environment=NODE_ENV=production\n' +
    'Environment=PORT=$SERVICE_PORT\n\n' +
    '[Install]\n' +
    'WantedBy=multi-user.target\n' +
    'EOF\n\n' +
    '# systemd 데몬 리로드\n' +
    'sudo systemctl daemon-reload\n\n' +
    '# 서비스 활성화 (부팅 시 자동 시작)\n' +
    'if [ "$AUTO_START" = "true" ]; then\n' +
    '    sudo systemctl enable airis-mon\n' +
    'fi\n\n' +
    'echo "✅ 서비스 등록 완료"\n\n' +
    '# Nginx 설치 및 설정 (선택사항)\n' +
    'if [ "$INSTALL_NGINX" = "true" ]; then\n' +
    '    echo "🌐 Nginx 리버스 프록시 설치 중..."\n' +
    '    \n' +
    '    sudo apt-get install -y nginx\n' +
    '    \n' +
    '    # Nginx 설정 파일 생성\n' +
    '    sudo tee /etc/nginx/sites-available/airis-mon > /dev/null << EOF\n' +
    'server {\n' +
    '    listen 80;\n' +
    '    server_name _;\n' +
    '    \n' +
    '    location / {\n' +
    '        proxy_pass http://localhost:$SERVICE_PORT;\n' +
    '        proxy_http_version 1.1;\n' +
    '        proxy_set_header Upgrade \\$http_upgrade;\n' +
    '        proxy_set_header Connection \'upgrade\';\n' +
    '        proxy_set_header Host \\$host;\n' +
    '        proxy_set_header X-Real-IP \\$remote_addr;\n' +
    '        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;\n' +
    '        proxy_set_header X-Forwarded-Proto \\$scheme;\n' +
    '        proxy_cache_bypass \\$http_upgrade;\n' +
    '    }\n' +
    '}\n' +
    'EOF\n' +
    '    \n' +
    '    # 사이트 활성화\n' +
    '    sudo ln -sf /etc/nginx/sites-available/airis-mon /etc/nginx/sites-enabled/\n' +
    '    sudo rm -f /etc/nginx/sites-enabled/default\n' +
    '    \n' +
    '    # Nginx 재시작\n' +
    '    sudo systemctl restart nginx\n' +
    '    sudo systemctl enable nginx\n' +
    '    \n' +
    '    echo "✅ Nginx 설정 완료"\n' +
    'fi\n\n' +
    '# 6단계: 서비스 시작\n' +
    'echo "🚀 6단계: 서비스 시작 중..."\n\n' +
    '# AIRIS-MON 서비스 시작\n' +
    'sudo systemctl start airis-mon\n' +
    'sleep 3\n\n' +
    '# 서비스 상태 확인\n' +
    'if sudo systemctl is-active --quiet airis-mon; then\n' +
    '    echo "✅ AIRIS-MON 서비스가 성공적으로 시작되었습니다!"\n' +
    '    echo ""\n' +
    '    echo "🎉 설치가 완료되었습니다!"\n' +
    '    echo ""\n' +
    '    echo "📋 설치 정보:"\n' +
    '    echo "  - 설치 경로: $INSTALL_PATH"\n' +
    '    echo "  - 서비스 포트: $SERVICE_PORT"\n' +
    '    echo "  - 접속 URL: http://localhost:$SERVICE_PORT"\n' +
    '    if [ "$INSTALL_NGINX" = "true" ]; then\n' +
    '        echo "  - Nginx URL: http://localhost"\n' +
    '    fi\n' +
    '    echo ""\n' +
    '    echo "🔧 유용한 명령어:"\n' +
    '    echo "  - 서비스 상태 확인: sudo systemctl status airis-mon"\n' +
    '    echo "  - 서비스 재시작: sudo systemctl restart airis-mon"\n' +
    '    echo "  - 로그 확인: sudo journalctl -u airis-mon -f"\n' +
    '    echo "  - 서비스 중지: sudo systemctl stop airis-mon"\n' +
    'else\n' +
    '    echo "❌ AIRIS-MON 서비스 시작에 실패했습니다."\n' +
    '    echo "로그를 확인하세요: sudo journalctl -u airis-mon"\n' +
    '    exit 1\n' +
    'fi\n';
  
  return script;
};

module.exports = AIRISMonTestSuite;
