/**
 * Alert Manager Service for AIRIS-MON ClickStack Architecture
 * Korean business-aware alert management with intelligent routing
 */

const EventEmitter = require('events');
const logger = require('../../api-gateway/src/utils/logger');

class AlertManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      koreanBusinessHours: {
        start: config.businessStart || 9,
        end: config.businessEnd || 18,
        weekdays: [1, 2, 3, 4, 5] // Monday to Friday
      },
      escalationRules: {
        critical: { businessHours: 0, afterHours: 300 }, // 0 vs 5 minutes
        high: { businessHours: 300, afterHours: 900 },   // 5 vs 15 minutes
        medium: { businessHours: 900, afterHours: 1800 }, // 15 vs 30 minutes
        low: { businessHours: 1800, afterHours: 3600 }   // 30 vs 60 minutes
      },
      notificationChannels: {
        critical: ['slack', 'sms', 'email', 'webhook'],
        high: ['slack', 'email', 'webhook'],
        medium: ['slack', 'email'],
        low: ['email']
      },
      koreanCulturalSettings: {
        urgentKeywords: ['긴급', '중요', '장애', '실패', '오류', '위험'],
        businessLanguage: 'formal', // formal vs casual Korean
        respectLevels: true, // Use appropriate honorifics
        groupNotifications: true // Group similar alerts (Korean preference)
      },
      ...config
    };

    this.clickhouseService = null;
    this.redisService = null;
    this.kafkaService = null;
    
    this.activeAlerts = new Map();
    this.alertRules = new Map();
    this.notificationQueue = [];
    
    this.metrics = {
      totalAlerts: 0,
      alertsBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      escalations: 0,
      notifications: 0,
      resolved: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.isRunning = false;
    this.processingInterval = null;
    this.escalationInterval = null;
  }

  /**
   * Initialize with required services
   */
  async initialize(services) {
    this.clickhouseService = services.clickhouse;
    this.redisService = services.redis;
    this.kafkaService = services.kafka;

    if (!this.clickhouseService) {
      throw new Error('ClickHouse 서비스가 필요합니다');
    }

    // Load alert rules
    await this.loadAlertRules();

    logger.info('알림 관리자 서비스 초기화됨', {
      service: 'alert-manager',
      rules: this.alertRules.size
    });
  }

  async start() {
    try {
      logger.info('알림 관리자 서비스 시작 중...', { service: 'alert-manager' });
      
      this.isRunning = true;
      
      // Start alert processing
      this.startAlertProcessing();
      
      // Start escalation monitoring
      this.startEscalationMonitoring();
      
      // Setup Kafka consumers
      if (this.kafkaService) {
        await this.setupKafkaConsumers();
      }

      logger.info('알림 관리자 서비스가 시작되었습니다', { 
        service: 'alert-manager',
        businessHours: this.isKoreanBusinessHours()
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('알림 관리자 서비스 시작 실패', {
        error: error.message,
        service: 'alert-manager'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('알림 관리자 서비스 종료 중...', { service: 'alert-manager' });
      
      this.isRunning = false;
      
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
      }
      
      if (this.escalationInterval) {
        clearInterval(this.escalationInterval);
      }

      // Process remaining notifications
      await this.processNotificationQueue();

      logger.info('알림 관리자 서비스가 종료되었습니다', { service: 'alert-manager' });

    } catch (error) {
      this.metrics.errors++;
      logger.error('알림 관리자 서비스 종료 중 오류', {
        error: error.message,
        service: 'alert-manager'
      });
    }
  }

  /**
   * Load alert rules from ClickHouse
   */
  async loadAlertRules() {
    try {
      // Default alert rules for AIRIS-MON
      const defaultRules = [
        {
          id: 'high-error-rate',
          name: '높은 오류율',
          description: '서비스의 오류율이 임계값을 초과했습니다',
          metric: 'error_rate',
          condition: 'greater_than',
          threshold: 5,
          severity: 'high',
          enabled: true
        },
        {
          id: 'slow-response-time',
          name: '느린 응답 시간',
          description: '평균 응답 시간이 너무 깁니다',
          metric: 'response_time',
          condition: 'greater_than',
          threshold: 1000,
          severity: 'medium',
          enabled: true
        },
        {
          id: 'high-cpu-usage',
          name: 'CPU 사용률 높음',
          description: 'CPU 사용률이 임계값을 초과했습니다',
          metric: 'cpu_usage',
          condition: 'greater_than',
          threshold: 80,
          severity: 'high',
          enabled: true
        },
        {
          id: 'service-down',
          name: '서비스 중단',
          description: '서비스가 응답하지 않습니다',
          metric: 'service_status',
          condition: 'equals',
          threshold: 'down',
          severity: 'critical',
          enabled: true
        },
        {
          id: 'memory-leak',
          name: '메모리 누수 감지',
          description: '메모리 사용량이 지속적으로 증가하고 있습니다',
          metric: 'memory_usage',
          condition: 'greater_than',
          threshold: 85,
          severity: 'high',
          enabled: true
        }
      ];

      defaultRules.forEach(rule => {
        this.alertRules.set(rule.id, rule);
      });

      logger.info('알림 규칙이 로딩되었습니다', {
        count: this.alertRules.size,
        service: 'alert-manager'
      });

    } catch (error) {
      logger.error('알림 규칙 로딩 실패', {
        error: error.message,
        service: 'alert-manager'
      });
    }
  }

  /**
   * Setup Kafka consumers for alert events
   */
  async setupKafkaConsumers() {
    const consumer = await this.kafkaService.createConsumer({
      groupId: 'alert-manager-alerts',
      consumerName: 'alert-manager'
    });

    await consumer.subscribe([
      'airis-mon-alerts',
      'airis-mon-metrics',
      'airis-mon-korean-analytics'
    ]);

    await consumer.run(async (message) => {
      await this.processIncomingMessage(message);
    });

    logger.info('Kafka 컨슈머가 설정되었습니다', { service: 'alert-manager' });
  }

  /**
   * Process incoming messages from Kafka
   */
  async processIncomingMessage(message) {
    try {
      const eventType = message.event_type;
      
      switch (eventType) {
        case 'alert':
          await this.processAlertEvent(message);
          break;
        case 'metric':
          await this.evaluateMetricAlert(message);
          break;
        case 'analytics':
          await this.processAnalyticsAlert(message);
          break;
        default:
          logger.debug(`처리되지 않은 메시지 타입: ${eventType}`, {
            service: 'alert-manager'
          });
      }

    } catch (error) {
      this.metrics.errors++;
      logger.error('메시지 처리 실패', {
        error: error.message,
        event_type: message.event_type,
        service: 'alert-manager'
      });
    }
  }

  /**
   * Process alert event
   */
  async processAlertEvent(alert) {
    const alertId = alert.alert_id || this.generateAlertId(alert);
    const severity = alert.alert_severity?.toLowerCase() || 'medium';
    
    // Check if this is a new alert or update
    if (this.activeAlerts.has(alertId)) {
      await this.updateExistingAlert(alertId, alert);
    } else {
      await this.createNewAlert(alertId, alert, severity);
    }
  }

  /**
   * Evaluate metric for alert conditions
   */
  async evaluateMetricAlert(metric) {
    const metricName = metric.metric_name;
    const metricValue = metric.metric_value;
    const serviceName = metric.service_name;

    // Check all rules for this metric
    for (const [ruleId, rule] of this.alertRules) {
      if (rule.metric === metricName && rule.enabled) {
        const shouldAlert = this.evaluateCondition(
          metricValue, 
          rule.condition, 
          rule.threshold
        );

        if (shouldAlert) {
          const alertId = `${ruleId}-${serviceName}`;
          
          if (!this.activeAlerts.has(alertId)) {
            await this.triggerAlert(alertId, rule, metric);
          }
        }
      }
    }
  }

  /**
   * Process analytics-generated alerts
   */
  async processAnalyticsAlert(analyticsResult) {
    const analysisType = analyticsResult.analysis_type;
    
    if (['anomaly', 'prediction', 'alert_pattern'].includes(analysisType)) {
      const alert = {
        alert_id: `analytics-${analysisType}-${Date.now()}`,
        alert_name: this.getAnalyticsAlertName(analysisType),
        alert_severity: this.getAnalyticsSeverity(analyticsResult),
        alert_message: this.formatAnalyticsMessage(analyticsResult),
        service_name: 'analytics-engine',
        alert_data: analyticsResult
      };

      await this.processAlertEvent(alert);
    }
  }

  /**
   * Create new alert
   */
  async createNewAlert(alertId, alert, severity) {
    const now = Date.now();
    const koreanTime = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul'
    });

    const alertData = {
      id: alertId,
      ...alert,
      severity,
      status: 'firing',
      created_at: now,
      korean_created_at: koreanTime,
      korean_business_hours: this.isKoreanBusinessHours(),
      escalation_level: 0,
      notification_sent: false,
      acknowledged: false
    };

    this.activeAlerts.set(alertId, alertData);
    this.metrics.totalAlerts++;
    this.metrics.alertsBySeverity[severity]++;

    // Store in ClickHouse
    await this.storeAlert(alertData);

    // Queue notification
    this.queueNotification(alertData);

    // Emit event for real-time updates
    this.emit('alert-created', alertData);

    logger.info('새 알림이 생성되었습니다', {
      alert_id: alertId,
      severity,
      korean_business_hours: this.isKoreanBusinessHours(),
      service: 'alert-manager'
    });
  }

  /**
   * Update existing alert
   */
  async updateExistingAlert(alertId, alert) {
    const existingAlert = this.activeAlerts.get(alertId);
    
    if (alert.alert_status === 'resolved') {
      await this.resolveAlert(alertId);
    } else {
      // Update alert data
      const updatedAlert = {
        ...existingAlert,
        ...alert,
        updated_at: Date.now(),
        korean_updated_at: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        })
      };

      this.activeAlerts.set(alertId, updatedAlert);
      await this.storeAlert(updatedAlert);

      this.emit('alert-updated', updatedAlert);
    }
  }

  /**
   * Trigger alert from rule evaluation
   */
  async triggerAlert(alertId, rule, metric) {
    const alert = {
      alert_id: alertId,
      alert_name: rule.name,
      alert_severity: rule.severity,
      alert_message: this.formatRuleMessage(rule, metric),
      service_name: metric.service_name,
      rule_id: rule.id,
      metric_data: metric
    };

    await this.createNewAlert(alertId, alert, rule.severity);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    
    if (alert) {
      alert.status = 'resolved';
      alert.resolved_at = Date.now();
      alert.korean_resolved_at = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul'
      });

      this.activeAlerts.delete(alertId);
      this.metrics.resolved++;

      await this.storeAlert(alert);
      
      // Send resolution notification
      this.queueNotification(alert);

      this.emit('alert-resolved', alert);

      logger.info('알림이 해결되었습니다', {
        alert_id: alertId,
        severity: alert.severity,
        duration: alert.resolved_at - alert.created_at,
        service: 'alert-manager'
      });
    }
  }

  /**
   * Start alert processing loop
   */
  startAlertProcessing() {
    this.processingInterval = setInterval(async () => {
      await this.processNotificationQueue();
    }, 5000); // Process every 5 seconds
  }

  /**
   * Start escalation monitoring
   */
  startEscalationMonitoring() {
    this.escalationInterval = setInterval(async () => {
      await this.checkEscalations();
    }, 60000); // Check every minute
  }

  /**
   * Process notification queue
   */
  async processNotificationQueue() {
    if (this.notificationQueue.length === 0) return;

    const notifications = [...this.notificationQueue];
    this.notificationQueue = [];

    for (const notification of notifications) {
      try {
        await this.sendNotification(notification);
        this.metrics.notifications++;
      } catch (error) {
        this.metrics.errors++;
        logger.error('알림 전송 실패', {
          alert_id: notification.id,
          error: error.message,
          service: 'alert-manager'
        });
        
        // Re-queue with delay
        setTimeout(() => {
          this.notificationQueue.push(notification);
        }, 30000); // Retry after 30 seconds
      }
    }
  }

  /**
   * Queue notification for processing
   */
  queueNotification(alert) {
    const notification = {
      ...alert,
      channels: this.getNotificationChannels(alert.severity),
      korean_formatted: this.formatKoreanNotification(alert)
    };

    this.notificationQueue.push(notification);
  }

  /**
   * Send notification through configured channels
   */
  async sendNotification(notification) {
    const channels = notification.channels;
    
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'slack':
            await this.sendSlackNotification(notification);
            break;
          case 'email':
            await this.sendEmailNotification(notification);
            break;
          case 'sms':
            await this.sendSMSNotification(notification);
            break;
          case 'webhook':
            await this.sendWebhookNotification(notification);
            break;
          default:
            logger.warn(`알 수 없는 알림 채널: ${channel}`, {
              service: 'alert-manager'
            });
        }
      } catch (error) {
        logger.error(`${channel} 알림 전송 실패`, {
          alert_id: notification.id,
          error: error.message,
          service: 'alert-manager'
        });
      }
    }

    // Mark notification as sent
    const alert = this.activeAlerts.get(notification.id);
    if (alert) {
      alert.notification_sent = true;
      alert.notification_sent_at = Date.now();
    }
  }

  /**
   * Check for escalations
   */
  async checkEscalations() {
    const now = Date.now();
    const isBusinessHours = this.isKoreanBusinessHours();

    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.status === 'firing' && !alert.acknowledged) {
        const timeSinceCreated = now - alert.created_at;
        const escalationDelay = this.config.escalationRules[alert.severity][
          isBusinessHours ? 'businessHours' : 'afterHours'
        ] * 1000;

        if (timeSinceCreated >= escalationDelay) {
          await this.escalateAlert(alertId, alert);
        }
      }
    }
  }

  /**
   * Escalate alert
   */
  async escalateAlert(alertId, alert) {
    alert.escalation_level++;
    alert.escalated_at = Date.now();
    alert.korean_escalated_at = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul'
    });

    this.metrics.escalations++;

    // Send escalated notification
    const escalatedNotification = {
      ...alert,
      escalated: true,
      escalation_message: `[에스컬레이션 ${alert.escalation_level}단계] ${alert.alert_message}`,
      korean_formatted: this.formatKoreanEscalation(alert)
    };

    this.queueNotification(escalatedNotification);

    await this.storeAlert(alert);
    this.emit('alert-escalated', alert);

    logger.warn('알림이 에스컬레이션되었습니다', {
      alert_id: alertId,
      escalation_level: alert.escalation_level,
      severity: alert.severity,
      service: 'alert-manager'
    });
  }

  /**
   * Store alert in ClickHouse
   */
  async storeAlert(alert) {
    if (!this.clickhouseService) return;

    try {
      await this.clickhouseService.insertWideEvent({
        event_type: 'alert',
        service_name: alert.service_name || 'unknown',
        alert_id: alert.id,
        alert_name: alert.alert_name,
        alert_severity: alert.severity,
        alert_status: alert.status,
        alert_message: alert.alert_message,
        alert_data: alert,
        korean_business_hours: alert.korean_business_hours
      });
    } catch (error) {
      logger.error('알림 저장 실패', {
        alert_id: alert.id,
        error: error.message,
        service: 'alert-manager'
      });
    }
  }

  /**
   * Utility methods
   */
  generateAlertId(alert) {
    const timestamp = Date.now();
    const service = alert.service_name || 'unknown';
    const type = alert.alert_name || 'alert';
    return `${service}-${type}-${timestamp}`;
  }

  evaluateCondition(value, condition, threshold) {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  getNotificationChannels(severity) {
    return this.config.notificationChannels[severity] || ['email'];
  }

  formatKoreanNotification(alert) {
    const severityMap = {
      critical: '긴급',
      high: '높음',
      medium: '보통',
      low: '낮음'
    };

    const statusMap = {
      firing: '발생',
      resolved: '해결됨'
    };

    return {
      title: `[${severityMap[alert.severity] || alert.severity}] ${alert.alert_name}`,
      message: alert.alert_message,
      status: statusMap[alert.status] || alert.status,
      time: alert.korean_created_at || alert.korean_updated_at,
      service: alert.service_name,
      formatted_message: this.applyKoreanFormatting(alert)
    };
  }

  formatKoreanEscalation(alert) {
    return {
      title: `[에스컬레이션 ${alert.escalation_level}단계] ${alert.alert_name}`,
      message: `이 알림이 ${alert.escalation_level}번째 에스컬레이션되었습니다. 즉시 확인이 필요합니다.`,
      original_message: alert.alert_message,
      escalation_time: alert.korean_escalated_at
    };
  }

  applyKoreanFormatting(alert) {
    // Apply Korean cultural formatting
    const respectLevel = this.config.koreanCulturalSettings.respectLevels;
    const urgentKeywords = this.config.koreanCulturalSettings.urgentKeywords;
    
    let message = alert.alert_message;
    
    // Add urgency markers for critical alerts
    if (alert.severity === 'critical') {
      const urgentMarker = urgentKeywords[Math.floor(Math.random() * urgentKeywords.length)];
      message = `[${urgentMarker}] ${message}`;
    }
    
    // Add formal language endings if configured
    if (respectLevel && this.config.koreanCulturalSettings.businessLanguage === 'formal') {
      if (!message.endsWith('습니다') && !message.endsWith('니다')) {
        message += '습니다';
      }
    }
    
    return message;
  }

  formatRuleMessage(rule, metric) {
    return `${rule.description} (현재값: ${metric.metric_value}, 임계값: ${rule.threshold})`;
  }

  getAnalyticsAlertName(analysisType) {
    const nameMap = {
      anomaly: '이상 현상 탐지',
      prediction: '예측 임계값 초과',
      alert_pattern: '알림 패턴 탐지'
    };
    return nameMap[analysisType] || analysisType;
  }

  getAnalyticsSeverity(result) {
    if (result.confidence > 0.9) return 'high';
    if (result.confidence > 0.7) return 'medium';
    return 'low';
  }

  formatAnalyticsMessage(result) {
    return `분석 엔진에서 ${result.analysis_type} 패턴을 감지했습니다 (신뢰도: ${Math.round(result.confidence * 100)}%)`;
  }

  isKoreanBusinessHours(time = null) {
    const targetTime = time || new Date();
    const koreanTime = new Date(targetTime.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul'
    }));
    
    const hour = koreanTime.getHours();
    const day = koreanTime.getDay();
    
    return this.config.koreanBusinessHours.weekdays.includes(day) &&
           hour >= this.config.koreanBusinessHours.start &&
           hour < this.config.koreanBusinessHours.end;
  }

  // Placeholder notification methods (would be implemented with actual services)
  async sendSlackNotification(notification) {
    logger.info('Slack 알림 전송 (시뮬레이션)', {
      alert_id: notification.id,
      channel: 'slack'
    });
  }

  async sendEmailNotification(notification) {
    logger.info('이메일 알림 전송 (시뮬레이션)', {
      alert_id: notification.id,
      channel: 'email'
    });
  }

  async sendSMSNotification(notification) {
    logger.info('SMS 알림 전송 (시뮬레이션)', {
      alert_id: notification.id,
      channel: 'sms'
    });
  }

  async sendWebhookNotification(notification) {
    logger.info('웹훅 알림 전송 (시뮬레이션)', {
      alert_id: notification.id,
      channel: 'webhook'
    });
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.activeAlerts.get(alertId);
    
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledged_by = acknowledgedBy;
      alert.acknowledged_at = Date.now();
      alert.korean_acknowledged_at = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul'
      });

      await this.storeAlert(alert);
      this.emit('alert-acknowledged', alert);

      logger.info('알림이 확인되었습니다', {
        alert_id: alertId,
        acknowledged_by: acknowledgedBy,
        service: 'alert-manager'
      });

      return true;
    }

    return false;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      return {
        status: this.isRunning ? 'healthy' : 'stopped',
        running: this.isRunning,
        active_alerts: this.activeAlerts.size,
        notification_queue: this.notificationQueue.length,
        metrics: this.getMetrics(),
        korean_business_hours: this.isKoreanBusinessHours(),
        services: {
          clickhouse: !!this.clickhouseService,
          redis: !!this.redisService,
          kafka: !!this.kafkaService
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        error: error.message
      };
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      active_alerts: this.activeAlerts.size,
      notification_queue_size: this.notificationQueue.length,
      alert_rules_count: this.alertRules.size
    };
  }
}

module.exports = AlertManager;