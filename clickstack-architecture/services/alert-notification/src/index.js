/**
 * Alert and Notification Service
 * 통합 알림 및 경보 관리 시스템
 * 
 * 기능:
 * - 임계치 기반 알림
 * - 다중 채널 알림 (이메일, SMS, Slack, 웹훅)
 * - 알림 그룹핑 및 중복 제거
 * - 알림 레벨별 에스컬레이션
 * - 알림 히스토리 관리
 * - 실시간 알림 대시보드
 */

const express = require('express');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('./utils/logger');

class AlertNotificationService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 3011,
      host: config.host || 'localhost',
      dbConfig: config.dbConfig || {},
      notificationChannels: config.notificationChannels || {},
      thresholds: config.thresholds || {},
      escalationRules: config.escalationRules || [],
      groupingRules: config.groupingRules || {},
      ...config
    };

    // 알림 저장소
    this.alerts = new Map();
    this.notifications = new Map();
    this.alertGroups = new Map();
    this.suppressedAlerts = new Set();
    
    // 임계치 설정
    this.thresholds = new Map();
    this.initializeDefaultThresholds();
    
    // 알림 규칙
    this.escalationRules = new Map();
    this.notificationRules = new Map();
    
    // 통계 데이터
    this.stats = {
      alertsTotal: 0,
      alertsActive: 0,
      notificationsSent: 0,
      escalationsTriggered: 0,
      suppressedCount: 0
    };

    // Express 앱 초기화
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    logger.info('Alert and Notification Service 초기화 완료', {
      port: this.config.port,
      channels: Object.keys(this.config.notificationChannels)
    });
  }

  /**
   * 기본 임계치 설정 초기화
   */
  initializeDefaultThresholds() {
    const defaultThresholds = {
      // CPU 사용률
      'cpu_usage': {
        warning: 70,
        critical: 85,
        unit: '%',
        checkInterval: 60000,
        enabled: true
      },
      // 메모리 사용률
      'memory_usage': {
        warning: 75,
        critical: 90,
        unit: '%',
        checkInterval: 60000,
        enabled: true
      },
      // 응답 시간
      'response_time': {
        warning: 1000,
        critical: 3000,
        unit: 'ms',
        checkInterval: 30000,
        enabled: true
      },
      // 에러율
      'error_rate': {
        warning: 5,
        critical: 10,
        unit: '%',
        checkInterval: 60000,
        enabled: true
      },
      // 트랜잭션 처리량
      'transaction_rate': {
        warning: 100,
        critical: 50,
        unit: 'tps',
        direction: 'below',
        checkInterval: 60000,
        enabled: true
      },
      // GC 시간
      'gc_time': {
        warning: 100,
        critical: 500,
        unit: 'ms',
        checkInterval: 60000,
        enabled: true
      },
      // DB 연결 풀
      'db_pool_usage': {
        warning: 80,
        critical: 95,
        unit: '%',
        checkInterval: 30000,
        enabled: true
      },
      // 디스크 사용률
      'disk_usage': {
        warning: 80,
        critical: 90,
        unit: '%',
        checkInterval: 300000,
        enabled: true
      }
    };

    Object.entries(defaultThresholds).forEach(([key, threshold]) => {
      this.thresholds.set(key, threshold);
    });
  }

  /**
   * Express 미들웨어 설정
   */
  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS 설정
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // 요청 로깅
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.apiRequest(req.method, req.path, res.statusCode, duration);
      });
      next();
    });
  }

  /**
   * API 라우트 설정
   */
  setupRoutes() {
    // 헬스 체크
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'alert-notification',
        timestamp: new Date().toISOString(),
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        stats: this.stats
      });
    });

    // 알림 발생 API
    this.app.post('/api/v1/alerts', (req, res) => {
      try {
        const alertData = req.body;
        const alert = this.createAlert(alertData);
        res.json({ success: true, alertId: alert.id });
      } catch (error) {
        logger.error('알림 생성 실패', { error: error.message });
        res.status(500).json({ error: '알림 생성 실패' });
      }
    });

    // 알림 목록 조회
    this.app.get('/api/v1/alerts', (req, res) => {
      try {
        const { status, severity, limit = 100, offset = 0 } = req.query;
        const alerts = this.getAlerts({ status, severity, limit: parseInt(limit), offset: parseInt(offset) });
        res.json({ alerts, total: alerts.length });
      } catch (error) {
        logger.error('알림 목록 조회 실패', { error: error.message });
        res.status(500).json({ error: '알림 목록 조회 실패' });
      }
    });

    // 알림 상세 조회
    this.app.get('/api/v1/alerts/:id', (req, res) => {
      try {
        const alert = this.alerts.get(req.params.id);
        if (!alert) {
          return res.status(404).json({ error: '알림을 찾을 수 없습니다' });
        }
        res.json(alert);
      } catch (error) {
        logger.error('알림 상세 조회 실패', { error: error.message });
        res.status(500).json({ error: '알림 상세 조회 실패' });
      }
    });

    // 알림 해결 처리
    this.app.put('/api/v1/alerts/:id/resolve', (req, res) => {
      try {
        const result = this.resolveAlert(req.params.id, req.body);
        res.json(result);
      } catch (error) {
        logger.error('알림 해결 처리 실패', { error: error.message });
        res.status(500).json({ error: '알림 해결 처리 실패' });
      }
    });

    // 임계치 설정 조회
    this.app.get('/api/v1/thresholds', (req, res) => {
      try {
        const thresholds = Array.from(this.thresholds.entries()).map(([key, value]) => ({
          metric: key,
          ...value
        }));
        res.json({ thresholds });
      } catch (error) {
        logger.error('임계치 설정 조회 실패', { error: error.message });
        res.status(500).json({ error: '임계치 설정 조회 실패' });
      }
    });

    // 임계치 설정 업데이트
    this.app.put('/api/v1/thresholds/:metric', (req, res) => {
      try {
        const result = this.updateThreshold(req.params.metric, req.body);
        res.json(result);
      } catch (error) {
        logger.error('임계치 설정 업데이트 실패', { error: error.message });
        res.status(500).json({ error: '임계치 설정 업데이트 실패' });
      }
    });

    // 알림 채널 설정 조회
    this.app.get('/api/v1/notification-channels', (req, res) => {
      try {
        const channels = Object.keys(this.config.notificationChannels).map(channel => ({
          name: channel,
          enabled: this.config.notificationChannels[channel].enabled || false,
          type: this.config.notificationChannels[channel].type
        }));
        res.json({ channels });
      } catch (error) {
        logger.error('알림 채널 설정 조회 실패', { error: error.message });
        res.status(500).json({ error: '알림 채널 설정 조회 실패' });
      }
    });

    // 알림 통계 조회
    this.app.get('/api/v1/alerts/stats', (req, res) => {
      try {
        const stats = this.getAlertStats();
        res.json(stats);
      } catch (error) {
        logger.error('알림 통계 조회 실패', { error: error.message });
        res.status(500).json({ error: '알림 통계 조회 실패' });
      }
    });

    // 에스컬레이션 규칙 조회
    this.app.get('/api/v1/escalation-rules', (req, res) => {
      try {
        const rules = Array.from(this.escalationRules.entries()).map(([id, rule]) => ({
          id,
          ...rule
        }));
        res.json({ rules });
      } catch (error) {
        logger.error('에스컬레이션 규칙 조회 실패', { error: error.message });
        res.status(500).json({ error: '에스컬레이션 규칙 조회 실패' });
      }
    });

    // 테스트 알림 전송
    this.app.post('/api/v1/alerts/test', (req, res) => {
      try {
        const { channel, message } = req.body;
        this.sendTestNotification(channel, message);
        res.json({ success: true, message: '테스트 알림이 전송되었습니다' });
      } catch (error) {
        logger.error('테스트 알림 전송 실패', { error: error.message });
        res.status(500).json({ error: '테스트 알림 전송 실패' });
      }
    });
  }

  /**
   * 알림 생성
   */
  createAlert(alertData) {
    const alertId = uuidv4();
    const now = new Date();
    
    const alert = {
      id: alertId,
      title: alertData.title || '알림',
      description: alertData.description || '',
      severity: alertData.severity || 'warning', // info, warning, critical
      status: 'active',
      source: alertData.source || 'unknown',
      metric: alertData.metric || '',
      value: alertData.value || 0,
      threshold: alertData.threshold || 0,
      tags: alertData.tags || [],
      metadata: alertData.metadata || {},
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      notificationsSent: 0,
      escalationLevel: 0,
      korean_time: now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };

    this.alerts.set(alertId, alert);
    this.stats.alertsTotal++;
    this.stats.alertsActive++;

    logger.alert('알림 생성', {
      alert_id: alertId,
      title: alert.title,
      severity: alert.severity,
      source: alert.source,
      metric: alert.metric,
      value: alert.value
    });

    // 알림 그룹핑 처리
    this.processAlertGrouping(alert);
    
    // 알림 전송 처리
    this.processNotifications(alert);
    
    // 이벤트 발생
    this.emit('alertCreated', alert);

    return alert;
  }

  /**
   * 알림 그룹핑 처리
   */
  processAlertGrouping(alert) {
    const groupKey = this.generateGroupKey(alert);
    
    if (!this.alertGroups.has(groupKey)) {
      this.alertGroups.set(groupKey, {
        id: uuidv4(),
        key: groupKey,
        alerts: [],
        count: 0,
        firstOccurrence: alert.createdAt,
        lastOccurrence: alert.createdAt,
        severity: alert.severity,
        status: 'active'
      });
    }

    const group = this.alertGroups.get(groupKey);
    group.alerts.push(alert.id);
    group.count++;
    group.lastOccurrence = alert.createdAt;
    
    // 심각도 업데이트 (더 높은 심각도로)
    if (this.getSeverityLevel(alert.severity) > this.getSeverityLevel(group.severity)) {
      group.severity = alert.severity;
    }

    logger.grouping('알림 그룹 추가', {
      group_key: groupKey,
      alert_id: alert.id,
      group_count: group.count
    });
  }

  /**
   * 그룹 키 생성
   */
  generateGroupKey(alert) {
    // 소스, 메트릭, 심각도를 기반으로 그룹 키 생성
    const components = [
      alert.source,
      alert.metric,
      alert.severity
    ].filter(Boolean);
    
    return components.join(':');
  }

  /**
   * 심각도 레벨 반환 (숫자)
   */
  getSeverityLevel(severity) {
    const levels = {
      'info': 1,
      'warning': 2,
      'critical': 3
    };
    return levels[severity] || 1;
  }

  /**
   * 알림 전송 처리
   */
  async processNotifications(alert) {
    try {
      // 억제된 알림 확인
      if (this.isAlertSuppressed(alert)) {
        this.stats.suppressedCount++;
        logger.info('알림 억제됨', { alert_id: alert.id });
        return;
      }

      // 알림 채널별 전송
      const channels = this.getNotificationChannels(alert);
      
      for (const channel of channels) {
        try {
          await this.sendNotification(channel, alert);
          alert.notificationsSent++;
          this.stats.notificationsSent++;
        } catch (error) {
          logger.error('알림 전송 실패', {
            alert_id: alert.id,
            channel: channel.name,
            error: error.message
          });
        }
      }

      logger.info('알림 전송 완료', {
        alert_id: alert.id,
        channels: channels.map(c => c.name),
        notifications_sent: alert.notificationsSent
      });

    } catch (error) {
      logger.error('알림 처리 실패', {
        alert_id: alert.id,
        error: error.message
      });
    }
  }

  /**
   * 알림 채널 결정
   */
  getNotificationChannels(alert) {
    const channels = [];
    
    // 심각도별 채널 결정
    switch (alert.severity) {
      case 'critical':
        channels.push(...this.getCriticalChannels());
        break;
      case 'warning':
        channels.push(...this.getWarningChannels());
        break;
      case 'info':
        channels.push(...this.getInfoChannels());
        break;
    }

    return channels.filter(channel => channel.enabled);
  }

  getCriticalChannels() {
    return [
      { name: 'email', type: 'email', enabled: true },
      { name: 'sms', type: 'sms', enabled: true },
      { name: 'slack', type: 'slack', enabled: true },
      { name: 'webhook', type: 'webhook', enabled: true }
    ];
  }

  getWarningChannels() {
    return [
      { name: 'email', type: 'email', enabled: true },
      { name: 'slack', type: 'slack', enabled: true }
    ];
  }

  getInfoChannels() {
    return [
      { name: 'slack', type: 'slack', enabled: true }
    ];
  }

  /**
   * 알림 전송
   */
  async sendNotification(channel, alert) {
    const message = this.formatNotificationMessage(alert, channel.type);
    
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(alert, message);
        break;
      case 'sms':
        await this.sendSMSNotification(alert, message);
        break;
      case 'slack':
        await this.sendSlackNotification(alert, message);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, message);
        break;
      default:
        logger.warn('지원되지 않는 알림 채널', { channel: channel.type });
    }

    logger.notification('알림 전송됨', {
      alert_id: alert.id,
      channel: channel.name,
      type: channel.type
    });
  }

  /**
   * 알림 메시지 포맷팅
   */
  formatNotificationMessage(alert, channelType) {
    const koreanTime = alert.korean_time;
    
    switch (channelType) {
      case 'email':
        return {
          subject: `[AIRIS-APM] ${alert.severity.toUpperCase()} 알림: ${alert.title}`,
          html: `
            <h2>AIRIS APM 시스템 알림</h2>
            <p><strong>제목:</strong> ${alert.title}</p>
            <p><strong>심각도:</strong> ${alert.severity.toUpperCase()}</p>
            <p><strong>설명:</strong> ${alert.description}</p>
            <p><strong>소스:</strong> ${alert.source}</p>
            <p><strong>메트릭:</strong> ${alert.metric}</p>
            <p><strong>현재값:</strong> ${alert.value}</p>
            <p><strong>임계치:</strong> ${alert.threshold}</p>
            <p><strong>발생시간:</strong> ${koreanTime}</p>
          `
        };
      case 'sms':
        return `[AIRIS-APM] ${alert.severity.toUpperCase()}: ${alert.title} - ${alert.source} (${koreanTime})`;
      case 'slack':
        return {
          text: `AIRIS APM 알림: ${alert.title}`,
          attachments: [{
            color: this.getSeverityColor(alert.severity),
            fields: [
              { title: '심각도', value: alert.severity.toUpperCase(), short: true },
              { title: '소스', value: alert.source, short: true },
              { title: '메트릭', value: alert.metric, short: true },
              { title: '현재값', value: `${alert.value}`, short: true },
              { title: '설명', value: alert.description, short: false },
              { title: '발생시간', value: koreanTime, short: false }
            ]
          }]
        };
      case 'webhook':
        return {
          alert_id: alert.id,
          title: alert.title,
          description: alert.description,
          severity: alert.severity,
          source: alert.source,
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold,
          timestamp: alert.createdAt.toISOString(),
          korean_time: koreanTime
        };
      default:
        return alert;
    }
  }

  getSeverityColor(severity) {
    const colors = {
      'info': 'good',
      'warning': 'warning',
      'critical': 'danger'
    };
    return colors[severity] || 'good';
  }

  /**
   * 이메일 알림 전송 (모킹)
   */
  async sendEmailNotification(alert, message) {
    // 실제 구현에서는 nodemailer나 다른 이메일 서비스 사용
    logger.info('이메일 알림 전송 (모킹)', {
      alert_id: alert.id,
      subject: message.subject
    });
  }

  /**
   * SMS 알림 전송 (모킹)
   */
  async sendSMSNotification(alert, message) {
    // 실제 구현에서는 SMS 서비스 API 사용
    logger.info('SMS 알림 전송 (모킹)', {
      alert_id: alert.id,
      message: message.substring(0, 100)
    });
  }

  /**
   * Slack 알림 전송 (모킹)
   */
  async sendSlackNotification(alert, message) {
    // 실제 구현에서는 Slack API 사용
    logger.info('Slack 알림 전송 (모킹)', {
      alert_id: alert.id,
      text: message.text
    });
  }

  /**
   * 웹훅 알림 전송 (모킹)
   */
  async sendWebhookNotification(alert, message) {
    // 실제 구현에서는 HTTP POST 요청 전송
    logger.info('웹훅 알림 전송 (모킹)', {
      alert_id: alert.id,
      payload_size: JSON.stringify(message).length
    });
  }

  /**
   * 알림 억제 여부 확인
   */
  isAlertSuppressed(alert) {
    // 중복 알림 억제 로직
    const suppressionKey = `${alert.source}:${alert.metric}:${alert.severity}`;
    return this.suppressedAlerts.has(suppressionKey);
  }

  /**
   * 알림 해결 처리
   */
  resolveAlert(alertId, resolutionData = {}) {
    const alert = this.alerts.get(alertId);
    
    if (!alert) {
      throw new Error('알림을 찾을 수 없습니다');
    }

    if (alert.status === 'resolved') {
      return { success: true, message: '이미 해결된 알림입니다' };
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.updatedAt = new Date();
    alert.resolution = {
      resolvedBy: resolutionData.resolvedBy || 'system',
      reason: resolutionData.reason || 'manual_resolution',
      notes: resolutionData.notes || '',
      ...resolutionData
    };

    this.stats.alertsActive--;

    logger.resolution(alertId, {
      status: 'resolved',
      resolved_by: alert.resolution.resolvedBy,
      reason: alert.resolution.reason
    });

    this.emit('alertResolved', alert);

    return { success: true, alert };
  }

  /**
   * 알림 목록 조회
   */
  getAlerts(filters = {}) {
    let alerts = Array.from(this.alerts.values());

    // 필터링
    if (filters.status) {
      alerts = alerts.filter(alert => alert.status === filters.status);
    }

    if (filters.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }

    // 정렬 (최신 순)
    alerts.sort((a, b) => b.createdAt - a.createdAt);

    // 페이징
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    
    return alerts.slice(offset, offset + limit);
  }

  /**
   * 임계치 업데이트
   */
  updateThreshold(metric, thresholdData) {
    const existing = this.thresholds.get(metric) || {};
    const updated = {
      ...existing,
      ...thresholdData,
      updatedAt: new Date()
    };

    this.thresholds.set(metric, updated);

    logger.info('임계치 업데이트', {
      metric,
      threshold: updated
    });

    return { success: true, threshold: updated };
  }

  /**
   * 알림 통계 조회
   */
  getAlertStats() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const alerts = Array.from(this.alerts.values());
    
    const recentAlerts = alerts.filter(alert => alert.createdAt >= oneDayAgo);
    const hourlyAlerts = alerts.filter(alert => alert.createdAt >= oneHourAgo);

    const severityStats = {
      info: alerts.filter(alert => alert.severity === 'info').length,
      warning: alerts.filter(alert => alert.severity === 'warning').length,
      critical: alerts.filter(alert => alert.severity === 'critical').length
    };

    const statusStats = {
      active: alerts.filter(alert => alert.status === 'active').length,
      resolved: alerts.filter(alert => alert.status === 'resolved').length
    };

    return {
      ...this.stats,
      recentStats: {
        last24Hours: recentAlerts.length,
        lastHour: hourlyAlerts.length
      },
      severityBreakdown: severityStats,
      statusBreakdown: statusStats,
      alertGroups: this.alertGroups.size,
      thresholds: this.thresholds.size,
      generatedAt: now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };
  }

  /**
   * 테스트 알림 전송
   */
  sendTestNotification(channel, message) {
    const testAlert = {
      id: 'test-' + uuidv4(),
      title: '테스트 알림',
      description: message || '이것은 테스트 알림입니다.',
      severity: 'info',
      source: 'alert-notification-service',
      metric: 'test_metric',
      value: 100,
      threshold: 80,
      createdAt: new Date(),
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };

    const channelConfig = { name: channel, type: channel, enabled: true };
    this.sendNotification(channelConfig, testAlert);

    logger.info('테스트 알림 전송', {
      channel,
      message: message || '기본 테스트 메시지'
    });
  }

  /**
   * 정리 작업 실행
   */
  cleanup() {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7일 전
    let cleanedCount = 0;

    // 해결된 오래된 알림 정리
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.status === 'resolved' && alert.resolvedAt < cutoffTime) {
        this.alerts.delete(alertId);
        cleanedCount++;
      }
    }

    logger.cleanup('오래된 알림 정리', {
      cleaned_count: cleanedCount,
      cutoff_date: cutoffTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    });

    return cleanedCount;
  }

  /**
   * 서비스 시작
   */
  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        logger.info('Alert and Notification Service 시작됨', {
          host: this.config.host,
          port: this.config.port
        });

        // 주기적 정리 작업 시작
        this.cleanupInterval = setInterval(() => {
          this.cleanup();
        }, 60 * 60 * 1000); // 1시간마다

        resolve();
      });
    });
  }

  /**
   * 서비스 종료
   */
  stop() {
    return new Promise((resolve) => {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      if (this.server) {
        this.server.close(() => {
          logger.info('Alert and Notification Service 종료됨');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// 서비스 인스턴스 생성
const service = new AlertNotificationService({
  port: process.env.PORT || 3011,
  host: process.env.HOST || 'localhost'
});

// 프로세스 종료 핸들링
process.on('SIGTERM', async () => {
  logger.info('SIGTERM 신호 수신, 서비스 종료 중...');
  await service.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT 신호 수신, 서비스 종료 중...');
  await service.stop();
  process.exit(0);
});

// 에러 핸들링
process.on('uncaughtException', (error) => {
  logger.error('처리되지 않은 예외 발생', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('처리되지 않은 Promise 거부', { reason, promise });
});

module.exports = { AlertNotificationService, service };

// 서비스 시작
if (require.main === module) {
  service.start().catch(error => {
    logger.error('서비스 시작 실패', { error: error.message });
    process.exit(1);
  });
}