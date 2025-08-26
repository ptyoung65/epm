/**
 * AIRIS EPM - K6 성능 및 부하 테스트
 * 시스템의 성능 한계와 안정성 검증
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// 커스텀 메트릭 정의
const errorRate = new Rate('error_rate');
const responseTimeAPI = new Trend('response_time_api');
const responseTimeDashboard = new Trend('response_time_dashboard');
const websocketConnections = new Counter('websocket_connections');
const websocketMessages = new Counter('websocket_messages');

// 테스트 설정
export const options = {
  scenarios: {
    // 시나리오 1: API 엔드포인트 부하 테스트
    api_load_test: {
      executor: 'ramping-vus',
      exec: 'apiLoadTest',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },   // 2분 동안 20명까지 증가
        { duration: '5m', target: 20 },   // 5분 동안 20명 유지
        { duration: '2m', target: 50 },   // 2분 동안 50명까지 증가
        { duration: '5m', target: 50 },   // 5분 동안 50명 유지
        { duration: '2m', target: 0 },    // 2분 동안 0명까지 감소
      ],
    },

    // 시나리오 2: 대시보드 동시 사용자 테스트
    dashboard_concurrent_users: {
      executor: 'constant-vus',
      exec: 'dashboardTest',
      vus: 30,
      duration: '10m',
    },

    // 시나리오 3: WebSocket 실시간 연결 테스트
    websocket_stress_test: {
      executor: 'ramping-vus',
      exec: 'websocketTest',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '2m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },

    // 시나리오 4: AI 예측 스트레스 테스트
    ai_prediction_stress: {
      executor: 'constant-arrival-rate',
      exec: 'aiPredictionTest',
      rate: 5,          // 초당 5개 요청
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  
  thresholds: {
    // 성능 임계값 설정
    http_req_duration: ['p(95)<2000'],        // 95%의 요청이 2초 이내
    http_req_failed: ['rate<0.05'],           // 에러율 5% 이하
    response_time_api: ['p(90)<1000'],        // API 응답시간 90%가 1초 이내
    response_time_dashboard: ['p(95)<3000'],   // 대시보드 로딩 95%가 3초 이내
    error_rate: ['rate<0.02'],                // 전체 에러율 2% 이하
  },
};

// 기본 설정
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';
const API_BASE = `${BASE_URL.replace('3002', '3300')}`; // 실시간 허브
const AI_API_BASE = `${BASE_URL.replace('3002', '3500')}`; // AI 예측 서비스

// 1. API 엔드포인트 부하 테스트
export function apiLoadTest() {
  const endpoints = [
    '/api/executive-kpis',
    '/api/strategic-kpis',
    '/api/performance-metrics',
    '/api/alerts',
    '/health'
  ];

  // 랜덤 엔드포인트 선택
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const startTime = Date.now();
  
  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'k6-load-test',
    },
    timeout: '30s',
  });

  const duration = Date.now() - startTime;
  responseTimeAPI.add(duration);

  // 응답 검증
  const success = check(response, {
    'API status is 200': (r) => r.status === 200,
    'API response time < 3s': (r) => r.timings.duration < 3000,
    'API response has data': (r) => r.body && r.body.length > 0,
    'API content-type is JSON': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('application/json'),
  });

  if (!success) {
    errorRate.add(1);
    console.log(`API test failed for ${endpoint}: Status ${response.status}`);
  } else {
    errorRate.add(0);
  }

  sleep(Math.random() * 2 + 1); // 1-3초 대기
}

// 2. 대시보드 동시 사용자 테스트
export function dashboardTest() {
  const dashboardPages = [
    '/',
    '/executive-dashboard',
    '/ai-prediction-dashboard',
    '/strategic-kpi-dashboard',
    '/alerts-dashboard'
  ];

  for (const page of dashboardPages) {
    const startTime = Date.now();
    
    const response = http.get(`${BASE_URL}${page}`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: '60s',
    });

    const duration = Date.now() - startTime;
    responseTimeDashboard.add(duration);

    const success = check(response, {
      'Dashboard loads successfully': (r) => r.status === 200,
      'Dashboard load time < 5s': (r) => r.timings.duration < 5000,
      'Dashboard has content': (r) => r.body && r.body.includes('AIRIS EPM'),
      'Dashboard has no JS errors': (r) => !r.body.includes('error') && !r.body.includes('Error'),
    });

    if (!success) {
      errorRate.add(1);
      console.log(`Dashboard test failed for ${page}: Status ${response.status}`);
    } else {
      errorRate.add(0);
    }

    // 정적 리소스 로딩 시뮬레이션
    const staticResources = [
      '/static/css/main.css',
      '/static/js/main.js',
      '/favicon.ico'
    ];

    for (const resource of staticResources) {
      http.get(`${BASE_URL}${resource}`, {
        timeout: '10s',
      });
    }

    sleep(Math.random() * 3 + 2); // 2-5초 페이지 탐색 시간
  }
}

// 3. WebSocket 실시간 연결 테스트
export function websocketTest() {
  const wsUrl = BASE_URL.replace('http', 'ws').replace('3002', '3300');
  
  const response = ws.connect(wsUrl, {}, function (socket) {
    websocketConnections.add(1);
    
    socket.on('open', () => {
      console.log('WebSocket connection established');
      
      // 데이터 구독 요청
      const subscriptions = [
        { type: 'subscribe', channel: 'system-metrics' },
        { type: 'subscribe', channel: 'business-metrics' },
        { type: 'subscribe', channel: 'alerts' },
        { type: 'subscribe', channel: 'ai-predictions' }
      ];

      subscriptions.forEach(sub => {
        socket.send(JSON.stringify(sub));
      });
    });

    socket.on('message', (data) => {
      websocketMessages.add(1);
      
      try {
        const message = JSON.parse(data);
        check(message, {
          'WebSocket message has type': (msg) => msg.type !== undefined,
          'WebSocket message has data': (msg) => msg.data !== undefined,
          'WebSocket message timestamp is recent': (msg) => {
            const msgTime = new Date(msg.timestamp);
            const now = new Date();
            return (now - msgTime) < 60000; // 1분 이내
          }
        });
      } catch (e) {
        console.log('Invalid WebSocket message format');
        errorRate.add(1);
      }
    });

    socket.on('error', (e) => {
      console.log('WebSocket error:', e);
      errorRate.add(1);
    });

    // 연결 유지 (30초 ~ 3분)
    const connectionDuration = Math.random() * 150 + 30;
    socket.setTimeout(() => {
      socket.close();
    }, connectionDuration * 1000);
  });

  check(response, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });

  sleep(1);
}

// 4. AI 예측 스트레스 테스트
export function aiPredictionTest() {
  const models = [
    'revenue-lstm',
    'performance-feedforward',
    'anomaly-autoencoder',
    'trend-cnn-lstm'
  ];

  const model = models[Math.floor(Math.random() * models.length)];
  
  // 테스트 데이터 생성
  const testData = {
    features: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () =>
      Array.from({ length: 8 }, () => Math.random() * 100)
    )
  };

  const startTime = Date.now();
  
  const response = http.post(`${AI_API_BASE}/api/predict/${model}`, 
    JSON.stringify(testData), {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: '30s',
  });

  const duration = Date.now() - startTime;

  const success = check(response, {
    'AI prediction status is 200': (r) => r.status === 200,
    'AI prediction response time < 10s': (r) => r.timings.duration < 10000,
    'AI prediction has results': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.predictions && data.predictions.length > 0;
      } catch (e) {
        return false;
      }
    },
    'AI prediction confidence > 0.5': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.confidence === undefined || data.confidence > 0.5;
      } catch (e) {
        return false;
      }
    },
  });

  if (!success) {
    errorRate.add(1);
    console.log(`AI prediction test failed for model ${model}: Status ${response.status}`);
  } else {
    errorRate.add(0);
  }

  // 모델 상태 확인 (25% 확률)
  if (Math.random() < 0.25) {
    const statusResponse = http.get(`${AI_API_BASE}/api/models`);
    check(statusResponse, {
      'AI models status accessible': (r) => r.status === 200,
      'AI models are ready': (r) => {
        try {
          const models = JSON.parse(r.body);
          return models.every(m => m.status === 'ready');
        } catch (e) {
          return false;
        }
      }
    });
  }

  sleep(Math.random() + 0.5); // 0.5-1.5초 대기
}

// 테스트 시작 시 실행
export function setup() {
  console.log('Starting AIRIS EPM performance tests...');
  console.log(`Target: ${BASE_URL}`);
  
  // 기본 헬스체크
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    console.error('Health check failed! Application may be down.');
    return null;
  }

  console.log('Health check passed. Starting load tests...');
  return {};
}

// 테스트 완료 시 실행
export function teardown(data) {
  console.log('Performance tests completed.');
  console.log(`Total WebSocket connections: ${websocketConnections.count}`);
  console.log(`Total WebSocket messages: ${websocketMessages.count}`);
  
  // 최종 헬스체크
  const finalHealthCheck = http.get(`${BASE_URL}/health`);
  if (finalHealthCheck.status !== 200) {
    console.warn('Final health check failed! System may be degraded after load test.');
  } else {
    console.log('Final health check passed. System is stable after load test.');
  }
}

// 기본 테스트 (단일 시나리오 실행시)
export default function() {
  apiLoadTest();
}