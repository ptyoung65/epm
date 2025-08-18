/**
 * 이벤트 시뮬레이터 - AIRIS-MON 시스템 이벤트 생성 및 테스트
 * 사용자 액션, 시스템 이벤트, 오류 상황 등을 시뮬레이션
 */

const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

class EventSimulator {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.isRunning = false;
    this.generatedCount = 0;
    this.eventTypes = {
      user_action: {
        weight: 40,
        subTypes: ['login', 'logout', 'page_view', 'button_click', 'form_submit', 'file_upload']
      },
      system_event: {
        weight: 30,
        subTypes: ['service_start', 'service_stop', 'backup_complete', 'maintenance_mode', 'config_update']
      },
      error_event: {
        weight: 20,
        subTypes: ['http_error', 'database_error', 'network_timeout', 'auth_failure', 'validation_error']
      },
      security_event: {
        weight: 10,
        subTypes: ['suspicious_login', 'rate_limit_exceeded', 'unauthorized_access', 'security_scan']
      }
    };
  }

  async simulate(duration = 60, intensity = 'medium') {
    console.log(`🎯 이벤트 시뮬레이션 시작: ${duration}초, 강도: ${intensity}`);
    
    const intensitySettings = {
      'low': { interval: 3000, batchSize: 10 },
      'medium': { interval: 1500, batchSize: 25 },
      'high': { interval: 800, batchSize: 50 },
      'extreme': { interval: 400, batchSize: 100 }
    };

    const settings = intensitySettings[intensity] || intensitySettings['medium'];
    const endTime = Date.now() + (duration * 1000);
    
    this.isRunning = true;
    this.generatedCount = 0;

    const interval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(interval);
        this.isRunning = false;
        console.log(`✅ 이벤트 시뮬레이션 완료: 총 ${this.generatedCount}개 이벤트 생성`);
        return;
      }

      if (this.isRunning) {
        await this.generateEventBatch(settings.batchSize);
      }
    }, settings.interval);

    // 즉시 첫 번째 배치 생성
    await this.generateEventBatch(settings.batchSize);

    return {
      duration: duration,
      intensity: intensity,
      settings: settings,
      status: 'started'
    };
  }

  async generateEventBatch(count = 25) {
    const events = [];
    const timestamp = Date.now();

    for (let i = 0; i < count; i++) {
      const event = this.generateSingleEvent(timestamp + i * 100);
      events.push(event);
    }

    await this.sendEventsToSystem(events);
    this.generatedCount += count;
    
    return count;
  }

  generateSingleEvent(timestamp = Date.now()) {
    const eventType = this.selectEventType();
    const subType = this.selectSubType(eventType);
    
    const baseEvent = {
      id: uuidv4(),
      timestamp: new Date(timestamp).toISOString(),
      event_type: eventType,
      sub_type: subType,
      source: 'event-simulator',
      trace_id: uuidv4(),
      span_id: uuidv4().substring(0, 16),
      korean_time: new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date(timestamp))
    };

    // 이벤트 타입별 세부 정보 추가
    switch (eventType) {
      case 'user_action':
        return this.enrichUserActionEvent(baseEvent, subType);
      case 'system_event':
        return this.enrichSystemEvent(baseEvent, subType);
      case 'error_event':
        return this.enrichErrorEvent(baseEvent, subType);
      case 'security_event':
        return this.enrichSecurityEvent(baseEvent, subType);
      default:
        return baseEvent;
    }
  }

  selectEventType() {
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (const [type, config] of Object.entries(this.eventTypes)) {
      cumulative += config.weight;
      if (rand <= cumulative) {
        return type;
      }
    }
    
    return 'user_action'; // 기본값
  }

  selectSubType(eventType) {
    const subTypes = this.eventTypes[eventType]?.subTypes || [];
    return subTypes[Math.floor(Math.random() * subTypes.length)];
  }

  enrichUserActionEvent(event, subType) {
    const userIds = Array.from({ length: 500 }, (_, i) => `user_${i + 1}`);
    const pages = ['/dashboard', '/analytics', '/settings', '/profile', '/reports', '/admin'];
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    const devices = ['Desktop', 'Mobile', 'Tablet'];

    return {
      ...event,
      user_id: userIds[Math.floor(Math.random() * userIds.length)],
      session_id: uuidv4(),
      severity: 'info',
      attributes: {
        page_url: pages[Math.floor(Math.random() * pages.length)],
        browser: browsers[Math.floor(Math.random() * browsers.length)],
        device: devices[Math.floor(Math.random() * devices.length)],
        ip_address: this.generateRandomIP(),
        user_agent: this.generateUserAgent(),
        duration_ms: Math.random() * 5000,
        success: Math.random() > 0.05 // 95% 성공률
      },
      message: this.getUserActionMessage(subType),
      korean_description: this.getKoreanUserActionDescription(subType),
      tags: ['user', 'frontend', 'interaction']
    };
  }

  enrichSystemEvent(event, subType) {
    const services = ['api-gateway', 'aiops', 'session-replay', 'nlp-search', 'event-delta-analyzer'];
    const environments = ['production', 'staging', 'development'];
    const regions = ['seoul-1', 'seoul-2', 'busan-1'];

    return {
      ...event,
      severity: subType.includes('error') ? 'error' : 'info',
      service: services[Math.floor(Math.random() * services.length)],
      attributes: {
        environment: environments[Math.floor(Math.random() * environments.length)],
        region: regions[Math.floor(Math.random() * regions.length)],
        instance_id: `instance-${Math.floor(Math.random() * 10) + 1}`,
        version: `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
        memory_usage: Math.random() * 100,
        cpu_usage: Math.random() * 100,
        disk_usage: Math.random() * 100
      },
      message: this.getSystemEventMessage(subType),
      korean_description: this.getKoreanSystemEventDescription(subType),
      tags: ['system', 'backend', 'infrastructure']
    };
  }

  enrichErrorEvent(event, subType) {
    const errorCodes = [400, 401, 403, 404, 422, 500, 502, 503, 504];
    const services = ['api-gateway', 'aiops', 'session-replay', 'nlp-search'];

    return {
      ...event,
      severity: 'error',
      service: services[Math.floor(Math.random() * services.length)],
      attributes: {
        error_code: errorCodes[Math.floor(Math.random() * errorCodes.length)],
        error_message: this.getErrorMessage(subType),
        stack_trace: this.generateStackTrace(),
        request_id: uuidv4(),
        endpoint: this.getRandomEndpoint(),
        method: this.getRandomHttpMethod(),
        response_time: Math.random() * 10000,
        retry_count: Math.floor(Math.random() * 3)
      },
      message: this.getErrorEventMessage(subType),
      korean_description: this.getKoreanErrorDescription(subType),
      tags: ['error', 'failure', 'alert']
    };
  }

  enrichSecurityEvent(event, subType) {
    const severityLevels = ['medium', 'high', 'critical'];
    const locations = ['서울', '부산', '인천', '대구', '광주', '대전', '울산'];

    return {
      ...event,
      severity: severityLevels[Math.floor(Math.random() * severityLevels.length)],
      attributes: {
        source_ip: this.generateRandomIP(),
        target_user: `user_${Math.floor(Math.random() * 1000)}`,
        attempt_count: Math.floor(Math.random() * 10) + 1,
        location: locations[Math.floor(Math.random() * locations.length)],
        user_agent: this.generateUserAgent(),
        blocked: Math.random() > 0.3, // 70% 차단률
        risk_score: Math.random() * 100,
        threat_type: this.getThreatType(subType)
      },
      message: this.getSecurityEventMessage(subType),
      korean_description: this.getKoreanSecurityDescription(subType),
      tags: ['security', 'threat', 'monitoring']
    };
  }

  getUserActionMessage(subType) {
    const messages = {
      login: 'User successfully logged in',
      logout: 'User logged out',
      page_view: 'User viewed page',
      button_click: 'User clicked button',
      form_submit: 'User submitted form',
      file_upload: 'User uploaded file'
    };
    return messages[subType] || 'User action performed';
  }

  getKoreanUserActionDescription(subType) {
    const descriptions = {
      login: '사용자 로그인 성공',
      logout: '사용자 로그아웃',
      page_view: '페이지 조회',
      button_click: '버튼 클릭',
      form_submit: '폼 제출',
      file_upload: '파일 업로드'
    };
    return descriptions[subType] || '사용자 액션 수행됨';
  }

  getSystemEventMessage(subType) {
    const messages = {
      service_start: 'Service started successfully',
      service_stop: 'Service stopped gracefully',
      backup_complete: 'Backup operation completed',
      maintenance_mode: 'Maintenance mode activated',
      config_update: 'Configuration updated'
    };
    return messages[subType] || 'System event occurred';
  }

  getKoreanSystemEventDescription(subType) {
    const descriptions = {
      service_start: '서비스 시작됨',
      service_stop: '서비스 정상 종료됨',
      backup_complete: '백업 작업 완료',
      maintenance_mode: '유지보수 모드 활성화',
      config_update: '설정 업데이트됨'
    };
    return descriptions[subType] || '시스템 이벤트 발생';
  }

  getErrorEventMessage(subType) {
    const messages = {
      http_error: 'HTTP request failed',
      database_error: 'Database operation failed',
      network_timeout: 'Network request timed out',
      auth_failure: 'Authentication failed',
      validation_error: 'Input validation failed'
    };
    return messages[subType] || 'Error occurred';
  }

  getKoreanErrorDescription(subType) {
    const descriptions = {
      http_error: 'HTTP 요청 실패',
      database_error: '데이터베이스 작업 실패',
      network_timeout: '네트워크 요청 시간 초과',
      auth_failure: '인증 실패',
      validation_error: '입력 검증 실패'
    };
    return descriptions[subType] || '오류 발생';
  }

  getSecurityEventMessage(subType) {
    const messages = {
      suspicious_login: 'Suspicious login attempt detected',
      rate_limit_exceeded: 'Rate limit exceeded',
      unauthorized_access: 'Unauthorized access attempt',
      security_scan: 'Security scan detected'
    };
    return messages[subType] || 'Security event detected';
  }

  getKoreanSecurityDescription(subType) {
    const descriptions = {
      suspicious_login: '의심스러운 로그인 시도 감지',
      rate_limit_exceeded: '요청 한도 초과',
      unauthorized_access: '무단 접근 시도',
      security_scan: '보안 스캔 감지'
    };
    return descriptions[subType] || '보안 이벤트 감지';
  }

  generateRandomIP() {
    return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
  }

  generateUserAgent() {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  getErrorMessage(subType) {
    const messages = {
      http_error: 'Request failed with status 500',
      database_error: 'Connection to database lost',
      network_timeout: 'Request timeout after 30 seconds',
      auth_failure: 'Invalid credentials provided',
      validation_error: 'Required field missing'
    };
    return messages[subType] || 'Unknown error';
  }

  generateStackTrace() {
    const traces = [
      'at Object.exports.runInNewContext (vm.js:74:16)',
      'at processTicksAndRejections (internal/process/task_queues.js:95:5)',
      'at async Server.<anonymous> (/app/server.js:45:3)',
      'at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)'
    ];
    return traces.slice(0, Math.floor(Math.random() * traces.length) + 1);
  }

  getRandomEndpoint() {
    const endpoints = [
      '/api/v1/metrics', '/api/v1/events', '/api/v1/users', '/api/v1/sessions',
      '/api/v1/alerts', '/api/v1/analytics', '/health', '/status'
    ];
    return endpoints[Math.floor(Math.random() * endpoints.length)];
  }

  getRandomHttpMethod() {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    return methods[Math.floor(Math.random() * methods.length)];
  }

  getThreatType(subType) {
    const threats = {
      suspicious_login: 'brute_force',
      rate_limit_exceeded: 'ddos_attempt',
      unauthorized_access: 'privilege_escalation',
      security_scan: 'reconnaissance'
    };
    return threats[subType] || 'unknown';
  }

  async sendEventsToSystem(events) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/events`, {
        events: events,
        source: 'test-event-simulator',
        timestamp: new Date().toISOString()
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`📤 ${events.length}개 이벤트 전송 완료 (응답: ${response.status})`);
    } catch (error) {
      console.log(`📤 ${events.length}개 이벤트 생성 완료 (시뮬레이션 모드)`);
    }
  }

  async generateScenarioBasedEvents(scenario = 'user_journey') {
    console.log(`🎬 시나리오 기반 이벤트 생성: ${scenario}`);
    
    const scenarios = {
      user_journey: () => this.generateUserJourneyEvents(),
      system_failure: () => this.generateSystemFailureEvents(),
      security_incident: () => this.generateSecurityIncidentEvents(),
      performance_degradation: () => this.generatePerformanceDegradationEvents()
    };

    const generator = scenarios[scenario] || scenarios['user_journey'];
    return await generator();
  }

  async generateUserJourneyEvents() {
    const events = [];
    const userId = `user_${Math.floor(Math.random() * 1000)}`;
    const sessionId = uuidv4();
    let timestamp = Date.now();

    // 1. 로그인
    events.push(this.createUserJourneyEvent('login', userId, sessionId, timestamp));
    timestamp += 1000;

    // 2. 대시보드 조회
    events.push(this.createUserJourneyEvent('page_view', userId, sessionId, timestamp, '/dashboard'));
    timestamp += 3000;

    // 3. 여러 페이지 탐색
    const pages = ['/analytics', '/reports', '/settings'];
    for (const page of pages) {
      events.push(this.createUserJourneyEvent('page_view', userId, sessionId, timestamp, page));
      timestamp += Math.random() * 10000 + 2000;
    }

    // 4. 액션 수행
    events.push(this.createUserJourneyEvent('form_submit', userId, sessionId, timestamp));
    timestamp += 2000;

    // 5. 로그아웃
    events.push(this.createUserJourneyEvent('logout', userId, sessionId, timestamp));

    await this.sendEventsToSystem(events);
    return events.length;
  }

  createUserJourneyEvent(action, userId, sessionId, timestamp, page = null) {
    return {
      id: uuidv4(),
      timestamp: new Date(timestamp).toISOString(),
      event_type: 'user_action',
      sub_type: action,
      user_id: userId,
      session_id: sessionId,
      attributes: {
        page_url: page || '/dashboard',
        duration_ms: Math.random() * 5000,
        success: true
      },
      message: `User ${action} performed`,
      korean_description: this.getKoreanUserActionDescription(action),
      source: 'scenario-generator'
    };
  }

  async generateSystemFailureEvents() {
    const events = [];
    const timestamp = Date.now();
    const serviceId = 'aiops';

    // 시스템 오류 시나리오
    events.push(this.createSystemFailureEvent('high_memory', serviceId, timestamp));
    events.push(this.createSystemFailureEvent('database_timeout', serviceId, timestamp + 1000));
    events.push(this.createSystemFailureEvent('service_restart', serviceId, timestamp + 5000));
    events.push(this.createSystemFailureEvent('recovery', serviceId, timestamp + 10000));

    await this.sendEventsToSystem(events);
    return events.length;
  }

  createSystemFailureEvent(failureType, serviceId, timestamp) {
    return {
      id: uuidv4(),
      timestamp: new Date(timestamp).toISOString(),
      event_type: failureType === 'recovery' ? 'system_event' : 'error_event',
      sub_type: failureType,
      service: serviceId,
      severity: failureType === 'recovery' ? 'info' : 'error',
      message: `System ${failureType} event`,
      korean_description: `시스템 ${failureType} 이벤트`,
      source: 'scenario-generator'
    };
  }

  getStatistics() {
    return {
      totalGenerated: this.generatedCount,
      isRunning: this.isRunning,
      eventTypes: Object.keys(this.eventTypes),
      timestamp: new Date().toISOString()
    };
  }

  stop() {
    this.isRunning = false;
    console.log('⏹️ 이벤트 시뮬레이터 중지됨');
  }
}

module.exports = EventSimulator;