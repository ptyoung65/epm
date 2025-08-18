/**
 * 데이터 시뮬레이터 - AIRIS-MON 테스트용 실제 데이터 생성
 */

const { Kafka } = require('kafkajs');
const { ClickHouseClient } = require('@clickhouse/client');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const { faker } = require('@faker-js/faker');

class DataSimulator {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'airis-mon-test-simulator',
      brokers: ['localhost:9092']
    });
    
    this.producer = null;
    this.clickhouse = null;
    this.redis = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Kafka Producer 초기화
      this.producer = this.kafka.producer({
        transactionTimeout: 30000
      });
      await this.producer.connect();

      // ClickHouse 클라이언트 초기화
      this.clickhouse = new ClickHouseClient({
        host: 'http://localhost:8123',
        database: 'airis_mon'
      });

      // Redis 클라이언트 초기화
      this.redis = new Redis({
        host: 'localhost',
        port: 6379,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false
      });

      this.isInitialized = true;
      console.log('✅ DataSimulator 초기화 완료');
    } catch (error) {
      console.error('❌ DataSimulator 초기화 실패:', error.message);
      throw error;
    }
  }

  async generateMetrics(count = 100) {
    await this.initialize();
    
    const metrics = [];
    const timestamp = new Date();

    for (let i = 0; i < count; i++) {
      const metric = {
        id: uuidv4(),
        timestamp: new Date(timestamp.getTime() + i * 1000).toISOString(),
        metric_type: this.getRandomMetricType(),
        metric_name: this.getRandomMetricName(),
        value: this.generateMetricValue(),
        labels: this.generateLabels(),
        source: 'test-simulator',
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      };

      metrics.push(metric);
    }

    // Kafka로 전송
    await this.sendToKafka('metrics', metrics);
    
    // ClickHouse에 직접 저장도 시도
    await this.saveToClickHouse(metrics);

    return metrics.length;
  }

  async generateEvents(count = 50) {
    await this.initialize();
    
    const events = [];
    const eventTypes = [
      'user_action', 'system_error', 'performance_alert', 
      'security_event', 'data_processing', 'api_call'
    ];

    for (let i = 0; i < count; i++) {
      const event = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        severity: this.getRandomSeverity(),
        message: this.generateEventMessage(),
        user_id: `user_${Math.floor(Math.random() * 1000)}`,
        session_id: uuidv4(),
        trace_id: uuidv4(),
        span_id: uuidv4(),
        attributes: this.generateEventAttributes(),
        korean_description: this.generateKoreanDescription()
      };

      events.push(event);
    }

    await this.sendToKafka('events', events);
    return events.length;
  }

  async generateUserSessions(count = 20) {
    await this.initialize();
    
    const sessions = [];
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    const devices = ['Desktop', 'Mobile', 'Tablet'];
    const pages = [
      '/dashboard', '/analytics', '/settings', '/profile',
      '/reports', '/admin', '/api/docs', '/monitoring'
    ];

    for (let i = 0; i < count; i++) {
      const sessionStart = new Date(Date.now() - Math.random() * 3600000);
      const sessionDuration = Math.random() * 1800000; // 최대 30분

      const session = {
        session_id: uuidv4(),
        user_id: `user_${Math.floor(Math.random() * 500)}`,
        start_time: sessionStart.toISOString(),
        end_time: new Date(sessionStart.getTime() + sessionDuration).toISOString(),
        duration_ms: sessionDuration,
        browser: browsers[Math.floor(Math.random() * browsers.length)],
        device: devices[Math.floor(Math.random() * devices.length)],
        ip_address: faker.internet.ip(),
        user_agent: faker.internet.userAgent(),
        pages_visited: this.generatePageVisits(pages),
        actions_count: Math.floor(Math.random() * 50) + 1,
        events: this.generateSessionEvents(),
        location: {
          country: '대한민국',
          city: faker.address.city(),
          region: faker.address.state()
        }
      };

      sessions.push(session);
    }

    await this.sendToKafka('user_sessions', sessions);
    return sessions.length;
  }

  async generateAnomalies(count = 10) {
    await this.initialize();
    
    const anomalies = [];
    const anomalyTypes = [
      'cpu_spike', 'memory_leak', 'disk_full', 'network_timeout',
      'unusual_traffic', 'error_rate_high', 'response_time_slow'
    ];

    for (let i = 0; i < count; i++) {
      const anomaly = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        type: anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)],
        severity: this.getRandomSeverity(),
        confidence: Math.random() * 0.4 + 0.6, // 60-100%
        affected_service: this.getRandomService(),
        baseline_value: Math.random() * 100,
        actual_value: Math.random() * 100 + 150,
        deviation: Math.random() * 300,
        description: this.generateAnomalyDescription(),
        korean_analysis: this.generateKoreanAnalysis(),
        recommended_action: this.generateRecommendedAction()
      };

      anomalies.push(anomaly);
    }

    await this.sendToKafka('anomalies', anomalies);
    return anomalies.length;
  }

  async generateKoreanNLPQueries(count = 30) {
    await this.initialize();
    
    const queries = [];
    const koreanQueries = [
      "오늘 오류가 가장 많이 발생한 서비스는?",
      "지난 1시간 동안 응답시간이 느린 API 찾아줘",
      "메모리 사용량이 80% 이상인 서버 보여줘",
      "사용자 로그인 실패 횟수 급증한 시간대는?",
      "데이터베이스 연결 오류 패턴 분석해줘",
      "CPU 사용률 이상치 탐지 결과는?",
      "트래픽이 가장 많은 페이지 순위",
      "세션 지속시간 평균과 이상값은?",
      "API 호출 빈도가 높은 클라이언트 찾기",
      "시스템 성능 저하 원인 분석"
    ];

    for (let i = 0; i < count; i++) {
      const query = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        query_text: koreanQueries[Math.floor(Math.random() * koreanQueries.length)],
        user_id: `user_${Math.floor(Math.random() * 100)}`,
        query_type: 'natural_language',
        language: 'ko',
        intent: this.detectQueryIntent(),
        entities: this.extractEntities(),
        confidence: Math.random() * 0.3 + 0.7,
        result_count: Math.floor(Math.random() * 100),
        execution_time_ms: Math.random() * 1000,
        success: Math.random() > 0.1
      };

      queries.push(query);
    }

    await this.sendToKafka('nlp_queries', queries);
    return queries.length;
  }

  async sendToKafka(topic, data) {
    try {
      const messages = data.map(item => ({
        key: item.id || uuidv4(),
        value: JSON.stringify(item),
        timestamp: Date.now().toString()
      }));

      await this.producer.send({
        topic: topic,
        messages: messages
      });

      console.log(`📤 Kafka로 ${data.length}개 ${topic} 메시지 전송 완료`);
    } catch (error) {
      console.error(`❌ Kafka 전송 실패 (${topic}):`, error.message);
    }
  }

  async saveToClickHouse(metrics) {
    try {
      const insertQuery = `
        INSERT INTO metrics (
          id, timestamp, metric_type, metric_name, value, 
          labels, source, korean_time
        ) VALUES
      `;

      const values = metrics.map(m => 
        `('${m.id}', '${m.timestamp}', '${m.metric_type}', '${m.metric_name}', ${m.value}, '${JSON.stringify(m.labels)}', '${m.source}', '${m.korean_time}')`
      ).join(',');

      await this.clickhouse.query({
        query: insertQuery + values,
        format: 'JSON'
      });

      console.log(`💾 ClickHouse에 ${metrics.length}개 메트릭 저장 완료`);
    } catch (error) {
      console.error('❌ ClickHouse 저장 실패:', error.message);
    }
  }

  getRandomMetricType() {
    const types = [
      'system', 'application', 'business', 'security', 
      'performance', 'error', 'user_behavior'
    ];
    return types[Math.floor(Math.random() * types.length)];
  }

  getRandomMetricName() {
    const names = [
      'cpu_usage', 'memory_usage', 'disk_usage', 'network_latency',
      'response_time', 'error_rate', 'throughput', 'concurrent_users',
      'db_connections', 'queue_length', 'cache_hit_rate'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  generateMetricValue() {
    return Math.random() * 100;
  }

  generateLabels() {
    const environments = ['production', 'staging', 'development'];
    const services = ['api-gateway', 'aiops', 'session-replay', 'nlp-search'];
    const regions = ['seoul', 'busan', 'incheon'];
    
    return {
      environment: environments[Math.floor(Math.random() * environments.length)],
      service: services[Math.floor(Math.random() * services.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      instance: `instance-${Math.floor(Math.random() * 10) + 1}`
    };
  }

  getRandomSeverity() {
    const severities = ['low', 'medium', 'high', 'critical'];
    return severities[Math.floor(Math.random() * severities.length)];
  }

  getRandomService() {
    const services = [
      'api-gateway', 'aiops', 'session-replay', 'nlp-search',
      'event-delta-analyzer', 'clickhouse', 'kafka', 'redis'
    ];
    return services[Math.floor(Math.random() * services.length)];
  }

  generateEventMessage() {
    const messages = [
      'User authentication successful',
      'Database connection timeout',
      'High memory usage detected',
      'API rate limit exceeded',
      'File processing completed',
      'Security scan initiated',
      'Backup process started'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  generateKoreanDescription() {
    const descriptions = [
      '사용자 로그인 성공',
      '데이터베이스 연결 시간 초과',
      '높은 메모리 사용률 감지',
      'API 요청 한도 초과',
      '파일 처리 완료',
      '보안 검사 시작',
      '백업 프로세스 시작됨'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  generateEventAttributes() {
    return {
      http_method: 'GET',
      status_code: 200 + Math.floor(Math.random() * 300),
      duration_ms: Math.floor(Math.random() * 1000),
      endpoint: '/api/v1/data',
      client_ip: faker.internet.ip()
    };
  }

  generatePageVisits(pages) {
    const visitCount = Math.floor(Math.random() * 10) + 1;
    return Array.from({ length: visitCount }, () => ({
      page: pages[Math.floor(Math.random() * pages.length)],
      timestamp: new Date().toISOString(),
      duration_ms: Math.random() * 60000
    }));
  }

  generateSessionEvents() {
    const eventTypes = ['click', 'scroll', 'input', 'navigation', 'error'];
    const eventCount = Math.floor(Math.random() * 20) + 5;
    
    return Array.from({ length: eventCount }, () => ({
      type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      timestamp: new Date().toISOString(),
      element: `button-${Math.floor(Math.random() * 100)}`,
      coordinates: {
        x: Math.floor(Math.random() * 1920),
        y: Math.floor(Math.random() * 1080)
      }
    }));
  }

  generateAnomalyDescription() {
    const descriptions = [
      'Sudden spike in CPU usage detected across multiple instances',
      'Memory consumption exceeding normal baseline by 200%',
      'Network latency increased significantly in Seoul region',
      'Database query response time above acceptable threshold'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  generateKoreanAnalysis() {
    const analyses = [
      'CPU 사용률이 평소 대비 급격히 증가했습니다.',
      '메모리 사용량이 기준선을 200% 초과했습니다.',
      '서울 지역 네트워크 지연시간이 크게 증가했습니다.',
      '데이터베이스 쿼리 응답시간이 허용 임계값을 초과했습니다.'
    ];
    return analyses[Math.floor(Math.random() * analyses.length)];
  }

  generateRecommendedAction() {
    const actions = [
      '서버 인스턴스 추가 확장 검토 필요',
      '메모리 누수 원인 조사 및 재시작 고려',
      '네트워크 인프라 상태 점검 필요',
      '데이터베이스 인덱스 최적화 및 쿼리 튜닝 필요'
    ];
    return actions[Math.floor(Math.random() * actions.length)];
  }

  detectQueryIntent() {
    const intents = [
      'search_errors', 'performance_analysis', 'user_behavior',
      'system_status', 'anomaly_detection', 'trend_analysis'
    ];
    return intents[Math.floor(Math.random() * intents.length)];
  }

  extractEntities() {
    const entities = [
      { type: 'service', value: 'api-gateway' },
      { type: 'metric', value: 'cpu_usage' },
      { type: 'time', value: '1시간' },
      { type: 'threshold', value: '80%' }
    ];
    return entities.slice(0, Math.floor(Math.random() * entities.length) + 1);
  }

  async cleanup() {
    try {
      if (this.producer) {
        await this.producer.disconnect();
      }
      if (this.redis) {
        await this.redis.disconnect();
      }
      console.log('🧹 DataSimulator 정리 완료');
    } catch (error) {
      console.error('❌ DataSimulator 정리 실패:', error.message);
    }
  }
}

module.exports = DataSimulator;