/**
 * AIRIS EPM - 통합 테스트 스위트
 * 전체 시스템 통합 테스트 자동화
 */

const axios = require('axios');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

// 테스트 설정
const TEST_CONFIG = {
  services: {
    realtimeHub: 'http://localhost:3300',
    aiPrediction: 'http://localhost:3500',
    dashboard: 'http://localhost:3002'
  },
  timeouts: {
    service: 30000,
    websocket: 10000,
    prediction: 60000
  },
  retries: 3
};

class IntegrationTestSuite {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
    this.services = new Map();
  }

  // 테스트 실행기
  async runAllTests() {
    console.log('🚀 AIRIS EPM 통합 테스트 시작...');
    const startTime = performance.now();

    try {
      // 1. 서비스 헬스체크
      await this.testServiceHealth();
      
      // 2. 실시간 데이터 허브 테스트
      await this.testRealtimeDataHub();
      
      // 3. AI 예측 시스템 테스트
      await this.testAIPredictionSystem();
      
      // 4. 대시보드 통합 테스트
      await this.testDashboardIntegration();
      
      // 5. 엔드투엔드 워크플로우 테스트
      await this.testEndToEndWorkflow();
      
      // 6. 성능 테스트
      await this.testPerformance();
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      this.generateTestReport(duration);
      
    } catch (error) {
      console.error('❌  통합 테스트 실행 중 오류:', error);
      this.results.errors.push({
        test: 'Test Suite',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // 1. 서비스 헬스체크
  async testServiceHealth() {
    console.log('\n📋 서비스 헬스체크 테스트...');
    
    const healthChecks = [
      { name: 'Realtime Hub', url: `${TEST_CONFIG.services.realtimeHub}/health` },
      { name: 'AI Prediction', url: `${TEST_CONFIG.services.aiPrediction}/health` },
      { name: 'Dashboard', url: `${TEST_CONFIG.services.dashboard}/health` }
    ];

    for (const check of healthChecks) {
      await this.runTest(`Health Check: ${check.name}`, async () => {
        const response = await axios.get(check.url, {
          timeout: TEST_CONFIG.timeouts.service
        });
        
        if (response.status !== 200) {
          throw new Error(`Service unhealthy: ${response.status}`);
        }
        
        const health = response.data;
        if (health.status !== 'healthy') {
          throw new Error(`Service status: ${health.status}`);
        }
        
        this.services.set(check.name, {
          status: 'healthy',
          uptime: health.uptime,
          version: health.version
        });
      });
    }
  }

  // 2. 실시간 데이터 허브 테스트
  async testRealtimeDataHub() {
    console.log('\n🔌 실시간 데이터 허브 테스트...');

    // WebSocket 연결 테스트
    await this.runTest('WebSocket Connection', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3300');
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, TEST_CONFIG.timeouts.websocket);

        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    // 실시간 데이터 수신 테스트
    await this.runTest('Real-time Data Reception', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3300');
        let messageReceived = false;
        
        const timeout = setTimeout(() => {
          ws.close();
          if (!messageReceived) {
            reject(new Error('No real-time data received'));
          }
        }, TEST_CONFIG.timeouts.websocket);

        ws.on('open', () => {
          // 데이터 구독 요청
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'system-metrics'
          }));
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'data' && message.channel === 'system-metrics') {
              messageReceived = true;
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    // 데이터 소스 통합 테스트
    await this.runTest('Data Source Integration', async () => {
      const response = await axios.get(`${TEST_CONFIG.services.realtimeHub}/api/sources`);
      const sources = response.data;
      
      const expectedSources = ['airis-apm', 'business-metrics', 'system-metrics', 'alerts'];
      for (const source of expectedSources) {
        if (!sources.find(s => s.name === source && s.status === 'active')) {
          throw new Error(`Data source not active: ${source}`);
        }
      }
    });
  }

  // 3. AI 예측 시스템 테스트
  async testAIPredictionSystem() {
    console.log('\n🤖 AI 예측 시스템 테스트...');

    // 모델 상태 확인
    await this.runTest('AI Models Status', async () => {
      const response = await axios.get(`${TEST_CONFIG.services.aiPrediction}/api/models`);
      const models = response.data;
      
      const expectedModels = ['revenue-lstm', 'performance-feedforward', 'anomaly-autoencoder', 'trend-cnn-lstm'];
      for (const modelId of expectedModels) {
        const model = models.find(m => m.id === modelId);
        if (!model || model.status !== 'ready') {
          throw new Error(`Model not ready: ${modelId}`);
        }
      }
    });

    // 예측 요청 테스트
    await this.runTest('Prediction Request', async () => {
      const testData = {
        features: [
          [100, 85, 12.5, 0.02, 95, 78, 1024, 2048],
          [110, 88, 13.2, 0.018, 97, 80, 1100, 2200],
          [105, 90, 11.8, 0.022, 96, 82, 1050, 2100]
        ]
      };

      const response = await axios.post(
        `${TEST_CONFIG.services.aiPrediction}/api/predict/revenue-lstm`,
        testData,
        { timeout: TEST_CONFIG.timeouts.prediction }
      );

      const result = response.data;
      if (!result.predictions || !Array.isArray(result.predictions)) {
        throw new Error('Invalid prediction response format');
      }
      
      if (result.predictions.length !== testData.features.length) {
        throw new Error('Prediction count mismatch');
      }
    });

    // 모델 평가 메트릭 테스트
    await this.runTest('Model Evaluation Metrics', async () => {
      const response = await axios.get(`${TEST_CONFIG.services.aiPrediction}/api/evaluation/revenue-lstm`);
      const evaluation = response.data;
      
      const requiredMetrics = ['mse', 'mae', 'rmse', 'mape', 'r2'];
      for (const metric of requiredMetrics) {
        if (evaluation.metrics[metric] === undefined) {
          throw new Error(`Missing evaluation metric: ${metric}`);
        }
      }
      
      // 성능 임계값 검사
      if (evaluation.metrics.r2 < 0.8) {
        console.warn(`⚠️ Low R² score: ${evaluation.metrics.r2}`);
      }
    });

    // 데이터 드리프트 감지 테스트
    await this.runTest('Data Drift Detection', async () => {
      const response = await axios.get(`${TEST_CONFIG.services.aiPrediction}/api/drift/revenue-lstm`);
      const drift = response.data;
      
      if (typeof drift.driftScore !== 'number' || drift.driftScore < 0) {
        throw new Error('Invalid drift score');
      }
      
      if (drift.driftScore > 0.3) {
        console.warn(`⚠️ High data drift detected: ${drift.driftScore}`);
      }
    });
  }

  // 4. 대시보드 통합 테스트
  async testDashboardIntegration() {
    console.log('\n📊 대시보드 통합 테스트...');

    // 대시보드 페이지 접근 테스트
    const dashboards = [
      'executive-dashboard',
      'ai-prediction-dashboard', 
      'strategic-kpi-dashboard',
      'alerts-dashboard'
    ];

    for (const dashboard of dashboards) {
      await this.runTest(`Dashboard Access: ${dashboard}`, async () => {
        const response = await axios.get(`${TEST_CONFIG.services.dashboard}/${dashboard}`);
        if (response.status !== 200) {
          throw new Error(`Dashboard not accessible: ${response.status}`);
        }
      });
    }

    // API 엔드포인트 테스트
    await this.runTest('Dashboard API Endpoints', async () => {
      const endpoints = [
        '/api/executive-kpis',
        '/api/strategic-kpis',
        '/api/alerts',
        '/api/performance-metrics'
      ];

      for (const endpoint of endpoints) {
        const response = await axios.get(`${TEST_CONFIG.services.dashboard}${endpoint}`);
        if (response.status !== 200) {
          throw new Error(`API endpoint error: ${endpoint} - ${response.status}`);
        }
      }
    });
  }

  // 5. 엔드투엔드 워크플로우 테스트
  async testEndToEndWorkflow() {
    console.log('\n🔄 엔드투엔드 워크플로우 테스트...');

    await this.runTest('Complete Data Flow Pipeline', async () => {
      // 1. 실시간 데이터 생성 및 수집
      const testMetrics = {
        timestamp: Date.now(),
        cpu_usage: 75.5,
        memory_usage: 68.2,
        response_time: 120,
        throughput: 1500,
        error_rate: 0.02
      };

      // 실시간 허브에 데이터 전송
      await axios.post(`${TEST_CONFIG.services.realtimeHub}/api/ingest`, testMetrics);

      // 2. AI 예측 트리거
      const predictionResponse = await axios.post(
        `${TEST_CONFIG.services.aiPrediction}/api/predict/performance-feedforward`,
        {
          features: [[testMetrics.cpu_usage, testMetrics.memory_usage, testMetrics.response_time, testMetrics.throughput]]
        }
      );

      // 3. 대시보드 데이터 업데이트 확인
      await new Promise(resolve => setTimeout(resolve, 2000)); // 데이터 전파 대기
      
      const dashboardResponse = await axios.get(`${TEST_CONFIG.services.dashboard}/api/executive-kpis`);
      const kpis = dashboardResponse.data;
      
      // KPI 데이터 존재 확인
      if (!kpis.find(kpi => kpi.id === 'system-performance')) {
        throw new Error('System performance KPI not updated');
      }
    });

    // 알림 시스템 워크플로우 테스트
    await this.runTest('Alert System Workflow', async () => {
      // 임계값 초과 시뮬레이션
      const criticalMetrics = {
        timestamp: Date.now(),
        cpu_usage: 95.0, // 임계값 초과
        memory_usage: 88.5, // 임계값 초과
        response_time: 5000, // 임계값 초과
        error_rate: 0.1 // 임계값 초과
      };

      await axios.post(`${TEST_CONFIG.services.realtimeHub}/api/ingest`, criticalMetrics);
      
      // 알림 생성 확인 (2초 대기)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const alertsResponse = await axios.get(`${TEST_CONFIG.services.dashboard}/api/alerts`);
      const alerts = alertsResponse.data;
      
      const criticalAlerts = alerts.filter(alert => 
        alert.severity === 'critical' && 
        alert.status === 'active' &&
        alert.timestamp > Date.now() - 10000
      );
      
      if (criticalAlerts.length === 0) {
        throw new Error('Critical alerts not generated');
      }
    });
  }

  // 6. 성능 테스트
  async testPerformance() {
    console.log('\n⚡ 성능 테스트...');

    // API 응답 시간 테스트
    await this.runTest('API Response Times', async () => {
      const endpoints = [
        `${TEST_CONFIG.services.realtimeHub}/api/sources`,
        `${TEST_CONFIG.services.aiPrediction}/api/models`,
        `${TEST_CONFIG.services.dashboard}/api/executive-kpis`
      ];

      for (const endpoint of endpoints) {
        const startTime = performance.now();
        await axios.get(endpoint);
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        if (responseTime > 1000) { // 1초 초과
          throw new Error(`Slow API response: ${endpoint} - ${responseTime}ms`);
        }
      }
    });

    // 동시 요청 처리 테스트
    await this.runTest('Concurrent Request Handling', async () => {
      const concurrentRequests = 20;
      const requests = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          axios.get(`${TEST_CONFIG.services.dashboard}/api/executive-kpis`)
        );
      }
      
      const startTime = performance.now();
      const results = await Promise.allSettled(requests);
      const endTime = performance.now();
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const throughput = successful / ((endTime - startTime) / 1000);
      
      if (successful < concurrentRequests * 0.95) { // 95% 성공률
        throw new Error(`Low success rate: ${successful}/${concurrentRequests}`);
      }
      
      if (throughput < 10) { // 초당 10 요청 미만
        throw new Error(`Low throughput: ${throughput} req/s`);
      }
    });

    // 메모리 사용량 테스트 (Node.js 프로세스)
    await this.runTest('Memory Usage Check', async () => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      
      console.log(`📊 메모리 사용량: ${heapUsedMB}MB / ${heapTotalMB}MB`);
      
      if (heapUsedMB > 512) { // 512MB 초과
        console.warn(`⚠️ High memory usage: ${heapUsedMB}MB`);
      }
    });
  }

  // 테스트 실행 헬퍼
  async runTest(testName, testFunction) {
    this.results.total++;
    
    try {
      console.log(`  ✓ ${testName}...`);
      await testFunction();
      this.results.passed++;
      console.log(`    ✅ 성공`);
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({
        test: testName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.log(`    ❌ 실패: ${error.message}`);
    }
  }

  // 테스트 리포트 생성
  generateTestReport(duration) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 AIRIS EPM 통합 테스트 결과');
    console.log('='.repeat(60));
    console.log(`실행 시간: ${duration}ms`);
    console.log(`전체 테스트: ${this.results.total}`);
    console.log(`성공: ${this.results.passed} ✅`);
    console.log(`실패: ${this.results.failed} ❌`);
    console.log(`성공률: ${Math.round((this.results.passed / this.results.total) * 100)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ 실패한 테스트:');
      this.results.errors.forEach(error => {
        console.log(`  - ${error.test}: ${error.error}`);
      });
    }
    
    // 서비스 상태 요약
    if (this.services.size > 0) {
      console.log('\n📊 서비스 상태:');
      this.services.forEach((status, name) => {
        console.log(`  - ${name}: ${status.status} (${status.uptime}s uptime)`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    // 결과를 파일로 저장
    const report = {
      timestamp: new Date().toISOString(),
      duration,
      results: this.results,
      services: Object.fromEntries(this.services)
    };
    
    require('fs').writeFileSync(
      '/home/ptyoung/work/AIRIS_EPM/tests/reports/integration-test-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('📄 테스트 리포트 저장: tests/reports/integration-test-report.json');
  }
}

// 테스트 실행
if (require.main === module) {
  const testSuite = new IntegrationTestSuite();
  testSuite.runAllTests().then(() => {
    process.exit(testSuite.results.failed === 0 ? 0 : 1);
  });
}

module.exports = IntegrationTestSuite;