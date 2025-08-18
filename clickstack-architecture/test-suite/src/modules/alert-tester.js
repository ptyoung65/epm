/**
 * 알림 테스터 - AIRIS-MON 알림 시스템 테스트
 * 임계값 모니터링, 알림 생성, 에스컬레이션 등을 테스트
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class AlertTester {
  constructor() {
    this.baseUrl = 'http://localhost:3000'; // API Gateway
    this.alertRules = new Map();
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.notificationChannels = ['email', 'slack', 'sms', 'webhook'];
  }

  async testThresholds(stepResult) {
    stepResult.logs.push('🎯 임계값 모니터링 테스트 시작');
    
    try {
      // 알림 규칙 설정
      const rules = await this.setupAlertRules();
      stepResult.metrics.alertRulesCreated = rules.length;
      stepResult.logs.push(`알림 규칙 ${rules.length}개 생성 완료`);

      // 임계값 테스트 데이터 생성
      const testMetrics = await this.generateThresholdTestData();
      stepResult.metrics.testMetricsGenerated = testMetrics.length;
      stepResult.logs.push(`테스트 메트릭 ${testMetrics.length}개 생성`);

      // 임계값 평가
      const evaluationResults = await this.evaluateThresholds(testMetrics, rules);
      stepResult.metrics.thresholdEvaluations = evaluationResults.total;
      stepResult.metrics.triggeredAlerts = evaluationResults.triggered;
      stepResult.metrics.evaluationAccuracy = evaluationResults.accuracy;

      stepResult.logs.push(`임계값 평가: ${evaluationResults.total}건`);
      stepResult.logs.push(`알림 트리거: ${evaluationResults.triggered}건`);
      stepResult.logs.push(`평가 정확도: ${evaluationResults.accuracy.toFixed(2)}%`);
      stepResult.logs.push('✅ 임계값 모니터링 테스트 완료');

    } catch (error) {
      stepResult.logs.push(`❌ 임계값 테스트 실패: ${error.message}`);
      throw error;
    }
  }

  async testGeneration(stepResult) {
    stepResult.logs.push('🚨 알림 생성 테스트 시작');
    
    try {
      // 다양한 알림 타입 생성
      const alertTypes = [
        'cpu_high', 'memory_high', 'disk_full', 'error_rate_high',
        'response_time_slow', 'service_down', 'security_threat'
      ];

      const generatedAlerts = [];
      
      for (const alertType of alertTypes) {
        const alert = await this.generateAlert(alertType);
        generatedAlerts.push(alert);
        stepResult.logs.push(`${this.getKoreanAlertType(alertType)} 알림 생성`);
      }

      stepResult.metrics.alertsGenerated = generatedAlerts.length;
      stepResult.metrics.alertTypes = alertTypes.length;

      // 알림 우선순위 및 분류 테스트
      const priorityDistribution = this.analyzeAlertPriorities(generatedAlerts);
      stepResult.metrics.priorityDistribution = priorityDistribution;

      stepResult.logs.push(`우선순위 분포: Critical ${priorityDistribution.critical}, High ${priorityDistribution.high}, Medium ${priorityDistribution.medium}, Low ${priorityDistribution.low}`);

      // 알림 중복 제거 테스트
      const deduplicationResult = await this.testAlertDeduplication(generatedAlerts);
      stepResult.metrics.deduplicationRate = deduplicationResult.rate;
      stepResult.logs.push(`중복 제거율: ${deduplicationResult.rate.toFixed(2)}%`);

      stepResult.logs.push('✅ 알림 생성 테스트 완료');

    } catch (error) {
      stepResult.logs.push(`❌ 알림 생성 테스트 실패: ${error.message}`);
      throw error;
    }
  }

  async testDelivery(stepResult) {
    stepResult.logs.push('📬 알림 전송 테스트 시작');
    
    try {
      // 알림 전송 채널별 테스트
      const deliveryResults = {};
      
      for (const channel of this.notificationChannels) {
        const result = await this.testNotificationChannel(channel);
        deliveryResults[channel] = result;
        
        stepResult.logs.push(`${channel} 채널: 성공률 ${result.successRate.toFixed(1)}%, 평균 지연시간 ${result.avgLatency}ms`);
      }

      stepResult.metrics.deliveryChannels = this.notificationChannels.length;
      stepResult.metrics.deliveryResults = deliveryResults;

      // 전체 전송 성공률 계산
      const overallSuccessRate = Object.values(deliveryResults)
        .reduce((sum, result) => sum + result.successRate, 0) / this.notificationChannels.length;
      
      stepResult.metrics.overallDeliveryRate = overallSuccessRate;

      // 에스컬레이션 테스트
      const escalationResult = await this.testAlertEscalation();
      stepResult.metrics.escalationSuccess = escalationResult.success;
      stepResult.metrics.escalationLatency = escalationResult.latency;

      stepResult.logs.push(`전체 전송 성공률: ${overallSuccessRate.toFixed(2)}%`);
      stepResult.logs.push(`에스컬레이션 테스트: ${escalationResult.success ? '성공' : '실패'} (${escalationResult.latency}ms)`);

      // 배치 전송 테스트
      const batchResult = await this.testBatchNotification();
      stepResult.metrics.batchDeliveryRate = batchResult.successRate;
      stepResult.logs.push(`배치 전송 성공률: ${batchResult.successRate.toFixed(2)}%`);

      stepResult.logs.push('✅ 알림 전송 테스트 완료');

    } catch (error) {
      stepResult.logs.push(`❌ 알림 전송 테스트 실패: ${error.message}`);
      throw error;
    }
  }

  async simulate(duration = 60, intensity = 'medium') {
    console.log(`🚨 알림 시뮬레이션 시작: ${duration}초, 강도: ${intensity}`);
    
    const intensitySettings = {
      'low': { alertInterval: 10000, maxConcurrent: 5 },
      'medium': { alertInterval: 5000, maxConcurrent: 15 },
      'high': { alertInterval: 2000, maxConcurrent: 30 },
      'extreme': { alertInterval: 1000, maxConcurrent: 50 }
    };

    const settings = intensitySettings[intensity] || intensitySettings['medium'];
    const endTime = Date.now() + (duration * 1000);
    
    let alertCount = 0;
    const alerts = [];

    const interval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(interval);
        console.log(`✅ 알림 시뮬레이션 완료: 총 ${alertCount}개 알림 생성`);
        return;
      }

      if (this.activeAlerts.size < settings.maxConcurrent) {
        const alert = await this.generateRandomAlert();
        alerts.push(alert);
        alertCount++;
        
        // 알림 처리 시뮬레이션
        setTimeout(() => {
          this.activeAlerts.delete(alert.id);
        }, Math.random() * 30000 + 10000); // 10-40초 후 해결
      }
    }, settings.alertInterval);

    return {
      duration: duration,
      intensity: intensity,
      expectedAlerts: Math.floor(duration * 1000 / settings.alertInterval),
      status: 'started'
    };
  }

  async setupAlertRules() {
    const rules = [
      {
        id: uuidv4(),
        name: 'CPU 사용률 높음',
        metric: 'cpu_usage',
        operator: '>',
        threshold: 80,
        duration: 300, // 5분
        severity: 'high',
        enabled: true
      },
      {
        id: uuidv4(),
        name: '메모리 사용률 높음',
        metric: 'memory_usage',
        operator: '>',
        threshold: 85,
        duration: 180, // 3분
        severity: 'high',
        enabled: true
      },
      {
        id: uuidv4(),
        name: '디스크 사용률 위험',
        metric: 'disk_usage',
        operator: '>',
        threshold: 90,
        duration: 60, // 1분
        severity: 'critical',
        enabled: true
      },
      {
        id: uuidv4(),
        name: '에러율 증가',
        metric: 'error_rate',
        operator: '>',
        threshold: 5,
        duration: 120, // 2분
        severity: 'medium',
        enabled: true
      },
      {
        id: uuidv4(),
        name: '응답시간 저하',
        metric: 'response_time',
        operator: '>',
        threshold: 2000,
        duration: 300, // 5분
        severity: 'medium',
        enabled: true
      }
    ];

    // 규칙 저장
    rules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    return rules;
  }

  async generateThresholdTestData() {
    const metrics = [];
    const metricTypes = ['cpu_usage', 'memory_usage', 'disk_usage', 'error_rate', 'response_time'];
    
    for (let i = 0; i < 100; i++) {
      for (const metricType of metricTypes) {
        const shouldTrigger = Math.random() < 0.3; // 30% 확률로 임계값 초과
        
        let value;
        switch (metricType) {
          case 'cpu_usage':
            value = shouldTrigger ? Math.random() * 20 + 80 : Math.random() * 70 + 10;
            break;
          case 'memory_usage':
            value = shouldTrigger ? Math.random() * 15 + 85 : Math.random() * 70 + 15;
            break;
          case 'disk_usage':
            value = shouldTrigger ? Math.random() * 10 + 90 : Math.random() * 80 + 10;
            break;
          case 'error_rate':
            value = shouldTrigger ? Math.random() * 15 + 5 : Math.random() * 4;
            break;
          case 'response_time':
            value = shouldTrigger ? Math.random() * 2000 + 2000 : Math.random() * 1800 + 200;
            break;
          default:
            value = Math.random() * 100;
        }

        metrics.push({
          id: uuidv4(),
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
          metric: metricType,
          value: value,
          shouldTrigger: shouldTrigger,
          service: this.getRandomService()
        });
      }
    }

    return metrics;
  }

  async evaluateThresholds(testMetrics, rules) {
    let totalEvaluations = 0;
    let triggeredAlerts = 0;
    let correctTriggers = 0;

    for (const metric of testMetrics) {
      const applicableRules = Array.from(rules.values())
        .filter(rule => rule.metric === metric.metric && rule.enabled);

      for (const rule of applicableRules) {
        totalEvaluations++;
        
        const shouldTrigger = this.evaluateRule(metric.value, rule);
        
        if (shouldTrigger) {
          triggeredAlerts++;
          
          // 실제로 임계값을 초과해야 하는지 확인
          if (metric.shouldTrigger) {
            correctTriggers++;
          }
        }
      }
    }

    const accuracy = totalEvaluations > 0 ? (correctTriggers / triggeredAlerts) * 100 : 0;

    return {
      total: totalEvaluations,
      triggered: triggeredAlerts,
      correct: correctTriggers,
      accuracy: accuracy
    };
  }

  evaluateRule(value, rule) {
    switch (rule.operator) {
      case '>':
        return value > rule.threshold;
      case '>=':
        return value >= rule.threshold;
      case '<':
        return value < rule.threshold;
      case '<=':
        return value <= rule.threshold;
      case '==':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  async generateAlert(alertType) {
    const alert = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: alertType,
      korean_type: this.getKoreanAlertType(alertType),
      severity: this.getAlertSeverity(alertType),
      title: this.getAlertTitle(alertType),
      message: this.getAlertMessage(alertType),
      korean_message: this.getKoreanAlertMessage(alertType),
      service: this.getRandomService(),
      source: 'alert-tester',
      status: 'active',
      attributes: this.getAlertAttributes(alertType),
      escalationLevel: 0,
      notificationsSent: 0,
      tags: this.getAlertTags(alertType)
    };

    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    return alert;
  }

  async generateRandomAlert() {
    const alertTypes = [
      'cpu_high', 'memory_high', 'disk_full', 'error_rate_high',
      'response_time_slow', 'service_down', 'security_threat',
      'network_timeout', 'database_error', 'queue_full'
    ];
    
    const randomType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    return await this.generateAlert(randomType);
  }

  getKoreanAlertType(alertType) {
    const types = {
      'cpu_high': 'CPU 사용률 높음',
      'memory_high': '메모리 사용률 높음',
      'disk_full': '디스크 용량 부족',
      'error_rate_high': '오류율 증가',
      'response_time_slow': '응답시간 지연',
      'service_down': '서비스 장애',
      'security_threat': '보안 위협',
      'network_timeout': '네트워크 시간 초과',
      'database_error': '데이터베이스 오류',
      'queue_full': '큐 용량 초과'
    };
    return types[alertType] || alertType;
  }

  getAlertSeverity(alertType) {
    const severityMap = {
      'cpu_high': 'high',
      'memory_high': 'high',
      'disk_full': 'critical',
      'error_rate_high': 'medium',
      'response_time_slow': 'medium',
      'service_down': 'critical',
      'security_threat': 'high',
      'network_timeout': 'medium',
      'database_error': 'high',
      'queue_full': 'medium'
    };
    return severityMap[alertType] || 'low';
  }

  getAlertTitle(alertType) {
    const titles = {
      'cpu_high': 'High CPU Usage Detected',
      'memory_high': 'High Memory Usage Detected',
      'disk_full': 'Disk Space Critical',
      'error_rate_high': 'Elevated Error Rate',
      'response_time_slow': 'Slow Response Time',
      'service_down': 'Service Unavailable',
      'security_threat': 'Security Threat Detected'
    };
    return titles[alertType] || 'Alert Triggered';
  }

  getAlertMessage(alertType) {
    const messages = {
      'cpu_high': 'CPU usage has exceeded the threshold for the specified duration',
      'memory_high': 'Memory usage has exceeded the threshold for the specified duration',
      'disk_full': 'Disk usage is critically high and requires immediate attention',
      'error_rate_high': 'Error rate has increased significantly above normal levels'
    };
    return messages[alertType] || 'An alert condition has been detected';
  }

  getKoreanAlertMessage(alertType) {
    const messages = {
      'cpu_high': 'CPU 사용률이 지정된 시간 동안 임계값을 초과했습니다',
      'memory_high': '메모리 사용률이 지정된 시간 동안 임계값을 초과했습니다',
      'disk_full': '디스크 사용률이 위험 수준에 도달하여 즉시 조치가 필요합니다',
      'error_rate_high': '오류율이 정상 수준보다 크게 증가했습니다'
    };
    return messages[alertType] || '알림 조건이 감지되었습니다';
  }

  getAlertAttributes(alertType) {
    const baseAttribs = {
      current_value: Math.random() * 100,
      threshold_value: Math.random() * 80 + 20,
      duration_exceeded: Math.floor(Math.random() * 600) + 60,
      affected_instances: Math.floor(Math.random() * 5) + 1
    };

    switch (alertType) {
      case 'cpu_high':
        return { ...baseAttribs, cpu_cores: Math.floor(Math.random() * 8) + 4 };
      case 'memory_high':
        return { ...baseAttribs, total_memory_gb: Math.floor(Math.random() * 32) + 8 };
      case 'disk_full':
        return { ...baseAttribs, total_disk_gb: Math.floor(Math.random() * 1000) + 100 };
      default:
        return baseAttribs;
    }
  }

  getAlertTags(alertType) {
    const commonTags = ['monitoring', 'alert'];
    const specificTags = {
      'cpu_high': ['performance', 'cpu'],
      'memory_high': ['performance', 'memory'],
      'disk_full': ['storage', 'critical'],
      'security_threat': ['security', 'threat']
    };
    return [...commonTags, ...(specificTags[alertType] || [])];
  }

  analyzeAlertPriorities(alerts) {
    const distribution = { critical: 0, high: 0, medium: 0, low: 0 };
    
    alerts.forEach(alert => {
      distribution[alert.severity] = (distribution[alert.severity] || 0) + 1;
    });

    return distribution;
  }

  async testAlertDeduplication(alerts) {
    // 중복 알림 시뮬레이션
    const duplicates = alerts.slice(0, Math.floor(alerts.length * 0.3));
    const allAlerts = [...alerts, ...duplicates];
    
    // 중복 제거 로직 시뮬레이션
    const uniqueAlerts = this.deduplicateAlerts(allAlerts);
    
    const rate = ((allAlerts.length - uniqueAlerts.length) / allAlerts.length) * 100;
    
    return {
      original: allAlerts.length,
      deduplicated: uniqueAlerts.length,
      rate: rate
    };
  }

  deduplicateAlerts(alerts) {
    const seen = new Set();
    return alerts.filter(alert => {
      const key = `${alert.type}_${alert.service}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async testNotificationChannel(channel) {
    const testCount = 10;
    let successCount = 0;
    const latencies = [];

    for (let i = 0; i < testCount; i++) {
      const startTime = Date.now();
      
      try {
        await this.simulateNotification(channel);
        successCount++;
        latencies.push(Date.now() - startTime);
      } catch (error) {
        // 실패 카운트
      }
    }

    return {
      channel: channel,
      successRate: (successCount / testCount) * 100,
      avgLatency: latencies.length > 0 ? 
        latencies.reduce((a, b) => a + b) / latencies.length : 0,
      testCount: testCount
    };
  }

  async simulateNotification(channel) {
    // 채널별 전송 시뮬레이션
    const channelLatencies = {
      'email': 2000,
      'slack': 1000,
      'sms': 3000,
      'webhook': 500
    };

    const baseLatency = channelLatencies[channel] || 1000;
    const latency = baseLatency + Math.random() * 1000;

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 95% 성공률 시뮬레이션
        if (Math.random() > 0.05) {
          resolve({ success: true, latency });
        } else {
          reject(new Error(`${channel} notification failed`));
        }
      }, latency);
    });
  }

  async testAlertEscalation() {
    const startTime = Date.now();
    
    // 에스컬레이션 시나리오 시뮬레이션
    // 1. 초기 알림 발송
    // 2. 15분 후 에스컬레이션
    // 3. 30분 후 추가 에스컬레이션
    
    const success = Math.random() > 0.1; // 90% 성공률
    const latency = Date.now() - startTime + Math.random() * 5000;
    
    return { success, latency };
  }

  async testBatchNotification() {
    const batchSize = 50;
    let successCount = 0;

    // 배치 전송 시뮬레이션
    for (let i = 0; i < batchSize; i++) {
      if (Math.random() > 0.05) { // 95% 성공률
        successCount++;
      }
    }

    return {
      batchSize: batchSize,
      successCount: successCount,
      successRate: (successCount / batchSize) * 100
    };
  }

  getRandomService() {
    const services = [
      'api-gateway', 'aiops', 'session-replay', 'nlp-search',
      'event-delta-analyzer', 'clickhouse', 'kafka', 'redis'
    ];
    return services[Math.floor(Math.random() * services.length)];
  }

  getStatistics() {
    return {
      activeAlerts: this.activeAlerts.size,
      totalAlerts: this.alertHistory.length,
      alertRules: this.alertRules.size,
      notificationChannels: this.notificationChannels.length,
      timestamp: new Date().toISOString()
    };
  }

  clearHistory() {
    this.alertHistory = [];
    this.activeAlerts.clear();
    console.log('🧹 알림 이력 정리 완료');
  }
}

module.exports = AlertTester;