/**
 * 메트릭 생성기 - AIRIS-MON 시스템 성능 테스트용 메트릭 데이터 생성
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class MetricsGenerator {
  constructor() {
    this.baseUrl = 'http://localhost:3100';
    this.isRunning = false;
    this.generatedCount = 0;
    this.aggregationBuffer = [];
    this.lastAggregation = Date.now();
    this.aggregationInterval = 60000; // 1분마다 집계
  }

  async generateBatch(count = 100) {
    const metrics = [];
    const timestamp = Date.now();

    for (let i = 0; i < count; i++) {
      const metric = this.generateSingleMetric(timestamp + i * 1000);
      metrics.push(metric);
    }

    // API Gateway를 통해 메트릭 전송 시뮬레이션
    await this.sendMetricsToSystem(metrics);
    
    this.generatedCount += count;
    return count;
  }

  generateSingleMetric(timestamp = Date.now()) {
    const metricTypes = {
      'system.cpu.usage': () => Math.random() * 100,
      'system.memory.usage': () => Math.random() * 100,
      'system.disk.usage': () => Math.random() * 100,
      'network.latency': () => Math.random() * 500,
      'http.response_time': () => Math.random() * 2000,
      'http.requests_per_second': () => Math.random() * 1000,
      'http.error_rate': () => Math.random() * 10,
      'database.connections': () => Math.floor(Math.random() * 100),
      'database.query_time': () => Math.random() * 1000,
      'cache.hit_rate': () => Math.random() * 100,
      'queue.length': () => Math.floor(Math.random() * 1000),
      'user.active_sessions': () => Math.floor(Math.random() * 5000)
    };

    const metricName = Object.keys(metricTypes)[Math.floor(Math.random() * Object.keys(metricTypes).length)];
    const value = metricTypes[metricName]();

    return {
      id: uuidv4(),
      timestamp: new Date(timestamp).toISOString(),
      name: metricName,
      value: Math.round(value * 100) / 100,
      unit: this.getMetricUnit(metricName),
      tags: this.generateTags(metricName),
      source: 'metrics-generator',
      korean_name: this.getKoreanName(metricName),
      category: this.getCategory(metricName)
    };
  }

  getMetricUnit(metricName) {
    const units = {
      'system.cpu.usage': 'percent',
      'system.memory.usage': 'percent',
      'system.disk.usage': 'percent',
      'network.latency': 'milliseconds',
      'http.response_time': 'milliseconds',
      'http.requests_per_second': 'requests/sec',
      'http.error_rate': 'percent',
      'database.connections': 'count',
      'database.query_time': 'milliseconds',
      'cache.hit_rate': 'percent',
      'queue.length': 'count',
      'user.active_sessions': 'count'
    };
    return units[metricName] || 'count';
  }

  getKoreanName(metricName) {
    const koreanNames = {
      'system.cpu.usage': 'CPU 사용률',
      'system.memory.usage': '메모리 사용률',
      'system.disk.usage': '디스크 사용률',
      'network.latency': '네트워크 지연시간',
      'http.response_time': 'HTTP 응답시간',
      'http.requests_per_second': 'HTTP 초당 요청수',
      'http.error_rate': 'HTTP 에러율',
      'database.connections': '데이터베이스 연결 수',
      'database.query_time': '데이터베이스 쿼리 시간',
      'cache.hit_rate': '캐시 적중률',
      'queue.length': '큐 길이',
      'user.active_sessions': '활성 사용자 세션'
    };
    return koreanNames[metricName] || metricName;
  }

  getCategory(metricName) {
    if (metricName.startsWith('system.')) return 'system';
    if (metricName.startsWith('network.')) return 'network';
    if (metricName.startsWith('http.')) return 'application';
    if (metricName.startsWith('database.')) return 'database';
    if (metricName.startsWith('cache.')) return 'cache';
    if (metricName.startsWith('queue.')) return 'messaging';
    if (metricName.startsWith('user.')) return 'business';
    return 'other';
  }

  generateTags(metricName) {
    const environments = ['production', 'staging', 'development'];
    const services = ['api-gateway', 'aiops', 'session-replay', 'nlp-search', 'event-delta-analyzer'];
    const regions = ['seoul-1', 'seoul-2', 'busan-1'];
    const instances = Array.from({ length: 10 }, (_, i) => `instance-${i + 1}`);

    return {
      environment: environments[Math.floor(Math.random() * environments.length)],
      service: services[Math.floor(Math.random() * services.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      instance: instances[Math.floor(Math.random() * instances.length)],
      version: `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`
    };
  }

  async sendMetricsToSystem(metrics) {
    try {
      // 1단계: ClickHouse에 실시간 메트릭 저장
      await this.sendToClickHouse(metrics);
      
      // 2단계: 집계 버퍼에 추가
      this.aggregationBuffer.push(...metrics);
      
      // 3단계: 집계 조건 확인 및 MongoDB 저장
      if (this.shouldAggregate()) {
        await this.aggregateAndSendToMongoDB();
      }
      
      console.log(`📊 ${metrics.length}개 메트릭 → ClickHouse 저장 완료`);
    } catch (error) {
      console.log(`📊 ${metrics.length}개 메트릭 생성 완료 (시뮬레이션 모드)`);
    }
  }

  async simulate(duration = 60, intensity = 'medium') {
    console.log(`🚀 메트릭 시뮬레이션 시작: ${duration}초, 강도: ${intensity}`);
    
    const intensitySettings = {
      'low': { interval: 5000, batchSize: 50 },
      'medium': { interval: 2000, batchSize: 100 },
      'high': { interval: 1000, batchSize: 200 },
      'extreme': { interval: 500, batchSize: 500 }
    };

    const settings = intensitySettings[intensity] || intensitySettings['medium'];
    const endTime = Date.now() + (duration * 1000);
    
    this.isRunning = true;
    this.generatedCount = 0;

    const interval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(interval);
        this.isRunning = false;
        console.log(`✅ 메트릭 시뮬레이션 완료: 총 ${this.generatedCount}개 메트릭 생성`);
        return;
      }

      if (this.isRunning) {
        await this.generateBatch(settings.batchSize);
      }
    }, settings.interval);

    // 즉시 첫 번째 배치 생성
    await this.generateBatch(settings.batchSize);

    return {
      duration: duration,
      intensity: intensity,
      settings: settings,
      status: 'started'
    };
  }

  async generatePerformanceTestData() {
    console.log('🏃‍♂️ 성능 테스트용 메트릭 데이터 생성 시작');
    
    const scenarios = [
      { name: '정상 부하', duration: 30, intensity: 'medium' },
      { name: '고부하', duration: 60, intensity: 'high' },
      { name: '극한 부하', duration: 30, intensity: 'extreme' },
      { name: '부하 감소', duration: 30, intensity: 'low' }
    ];

    const results = [];

    for (const scenario of scenarios) {
      console.log(`📈 시나리오 실행: ${scenario.name}`);
      const startTime = Date.now();
      
      const result = await this.simulate(scenario.duration, scenario.intensity);
      result.scenarioName = scenario.name;
      result.actualDuration = Date.now() - startTime;
      result.metricsGenerated = this.generatedCount;
      
      results.push(result);
      
      // 시나리오 간 휴식
      await this.delay(5000);
      this.generatedCount = 0;
    }

    return results;
  }

  async generateAnomalyData() {
    console.log('🔍 이상 탐지용 메트릭 데이터 생성');
    
    const anomalies = [];
    
    // 정상 데이터 생성 (기준선)
    for (let i = 0; i < 100; i++) {
      const normalMetric = this.generateNormalMetric();
      anomalies.push(normalMetric);
    }
    
    // 이상 데이터 생성
    for (let i = 0; i < 20; i++) {
      const anomalyMetric = this.generateAnomalyMetric();
      anomalies.push(anomalyMetric);
    }
    
    // 섞어서 실제 상황 시뮬레이션
    const shuffled = anomalies.sort(() => Math.random() - 0.5);
    
    await this.sendMetricsToSystem(shuffled);
    
    return {
      total: anomalies.length,
      normal: 100,
      anomalies: 20,
      message: '이상 탐지 테스트용 데이터 생성 완료'
    };
  }

  generateNormalMetric() {
    const metric = this.generateSingleMetric();
    
    // 정상 범위로 값 조정
    if (metric.name.includes('usage') || metric.name.includes('rate')) {
      metric.value = Math.random() * 60 + 10; // 10-70% 범위
    } else if (metric.name.includes('time') || metric.name.includes('latency')) {
      metric.value = Math.random() * 200 + 50; // 50-250ms 범위
    }
    
    metric.anomaly_score = Math.random() * 0.3; // 낮은 이상 점수
    metric.is_normal = true;
    
    return metric;
  }

  generateAnomalyMetric() {
    const metric = this.generateSingleMetric();
    
    // 이상 범위로 값 조정
    if (metric.name.includes('usage') || metric.name.includes('rate')) {
      metric.value = Math.random() * 30 + 80; // 80-110% 범위 (이상)
    } else if (metric.name.includes('time') || metric.name.includes('latency')) {
      metric.value = Math.random() * 2000 + 1000; // 1000-3000ms 범위 (이상)
    }
    
    metric.anomaly_score = Math.random() * 0.4 + 0.6; // 높은 이상 점수
    metric.is_normal = false;
    metric.anomaly_type = this.getRandomAnomalyType();
    
    return metric;
  }

  getRandomAnomalyType() {
    const types = [
      'spike', 'drop', 'plateau', 'oscillation', 
      'trend_change', 'outlier', 'pattern_break'
    ];
    return types[Math.floor(Math.random() * types.length)];
  }

  async generateRealTimeStream(callback, interval = 1000) {
    console.log('🌊 실시간 메트릭 스트림 시작');
    
    this.isRunning = true;
    
    const streamInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(streamInterval);
        return;
      }
      
      const metric = this.generateSingleMetric();
      
      if (callback) {
        callback(metric);
      }
      
      // 실제 시스템으로 전송도 시도
      await this.sendMetricsToSystem([metric]);
      
    }, interval);
    
    return streamInterval;
  }

  stopRealTimeStream(streamInterval) {
    if (streamInterval) {
      clearInterval(streamInterval);
      this.isRunning = false;
      console.log('⏹️ 실시간 메트릭 스트림 중지');
    }
  }

  async sendToClickHouse(metrics) {
    try {
      // ClickHouse 실시간 저장 API 호출
      const response = await axios.post(`${this.baseUrl}/api/clickhouse/metrics`, {
        metrics: metrics,
        source: 'metrics-generator',
        timestamp: new Date().toISOString(),
        storage_type: 'realtime'
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`🔍 ClickHouse: ${metrics.length}개 실시간 메트릭 저장`);
    } catch (error) {
      console.log(`🔍 ClickHouse 저장 시뮬레이션: ${metrics.length}개 메트릭`);
    }
  }

  shouldAggregate() {
    const now = Date.now();
    const timeSinceLastAggregation = now - this.lastAggregation;
    const bufferSize = this.aggregationBuffer.length;
    
    // 시간 기준 (1분) 또는 버퍼 크기 기준 (1000개)
    return timeSinceLastAggregation >= this.aggregationInterval || bufferSize >= 1000;
  }

  async aggregateAndSendToMongoDB() {
    if (this.aggregationBuffer.length === 0) return;
    
    console.log(`📊 집계 시작: ${this.aggregationBuffer.length}개 메트릭`);
    
    try {
      // 메트릭 집계 처리
      const aggregatedMetrics = this.aggregateMetrics(this.aggregationBuffer);
      
      // MongoDB에 집계된 요약본 저장
      await this.sendToMongoDB(aggregatedMetrics);
      
      // 버퍼 초기화
      this.aggregationBuffer = [];
      this.lastAggregation = Date.now();
      
      console.log(`🍃 MongoDB: ${aggregatedMetrics.length}개 집계 메트릭 저장 완료`);
    } catch (error) {
      console.error('집계 처리 오류:', error.message);
    }
  }

  aggregateMetrics(metrics) {
    const aggregated = new Map();
    const timeWindow = 60000; // 1분 단위 집계
    
    metrics.forEach(metric => {
      // 시간 윈도우로 그룹화 (1분 단위)
      const timeKey = Math.floor(new Date(metric.timestamp).getTime() / timeWindow) * timeWindow;
      const groupKey = `${metric.name}_${metric.tags.service}_${metric.tags.environment}_${timeKey}`;
      
      if (!aggregated.has(groupKey)) {
        aggregated.set(groupKey, {
          metric_name: metric.name,
          korean_name: metric.korean_name,
          category: metric.category,
          unit: metric.unit,
          service: metric.tags.service,
          environment: metric.tags.environment,
          time_window: new Date(timeKey).toISOString(),
          values: [],
          tags: metric.tags
        });
      }
      
      aggregated.get(groupKey).values.push(metric.value);
    });
    
    // 통계 계산
    return Array.from(aggregated.values()).map(group => {
      const values = group.values;
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const count = values.length;
      
      // 표준편차 계산
      const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count;
      const stdDev = Math.sqrt(variance);
      
      return {
        id: `agg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        metric_name: group.metric_name,
        korean_name: group.korean_name,
        category: group.category,
        unit: group.unit,
        service: group.service,
        environment: group.environment,
        time_window: group.time_window,
        statistics: {
          count: count,
          sum: Math.round(sum * 100) / 100,
          avg: Math.round(avg * 100) / 100,
          min: Math.round(min * 100) / 100,
          max: Math.round(max * 100) / 100,
          stddev: Math.round(stdDev * 100) / 100
        },
        tags: group.tags,
        aggregated_at: new Date().toISOString(),
        source: 'metrics-aggregator'
      };
    });
  }

  async sendToMongoDB(aggregatedMetrics) {
    try {
      // MongoDB 집계 저장 API 호출
      const response = await axios.post(`${this.baseUrl}/api/mongodb/metrics/aggregated`, {
        aggregated_metrics: aggregatedMetrics,
        aggregation_window: '1m',
        timestamp: new Date().toISOString()
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`🍃 MongoDB 집계 저장 완료: ${aggregatedMetrics.length}개`);
    } catch (error) {
      console.log(`🍃 MongoDB 집계 저장 시뮬레이션: ${aggregatedMetrics.length}개`);
    }
  }

  getStatistics() {
    return {
      totalGenerated: this.generatedCount,
      isRunning: this.isRunning,
      bufferSize: this.aggregationBuffer.length,
      lastAggregation: new Date(this.lastAggregation).toISOString(),
      timestamp: new Date().toISOString()
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MetricsGenerator;