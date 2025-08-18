/**
 * Logger Utility for Alert and Notification Service
 * 알림 및 경보 관리 전용 로깅 시스템
 */

const fs = require('fs');
const path = require('path');

class AlertNotificationLogger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.enableConsole = options.console !== false;
    this.enableFile = options.file !== false;
    this.logDir = options.logDir || path.join(__dirname, '../../logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 7;
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    // 로그 디렉토리 생성
    if (this.enableFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // 알림 시스템 전용 로그 파일들
    this.logFiles = {
      general: path.join(this.logDir, 'alert-notification.log'),
      alerts: path.join(this.logDir, 'alerts.log'),
      notifications: path.join(this.logDir, 'notifications.log'),
      escalations: path.join(this.logDir, 'escalations.log'),
      thresholds: path.join(this.logDir, 'thresholds.log'),
      channels: path.join(this.logDir, 'notification-channels.log')
    };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });

    // 알림 시스템 컨텍스트 정보 추가
    const contextInfo = {
      service: 'alert-notification',
      korean_time: timestamp,
      ...meta
    };

    // 민감한 정보 마스킹
    if (contextInfo.contact_info) {
      contextInfo.contact_info = this.maskContactInfo(contextInfo.contact_info);
    }

    const metaStr = Object.keys(contextInfo).length > 0 ? 
      JSON.stringify(contextInfo, null, 2) : '';
    
    return `[${level.toUpperCase()}] ${timestamp} - ${message}${metaStr ? '\n' + metaStr : ''}`;
  }

  // 연락처 정보 마스킹
  maskContactInfo(contactInfo) {
    if (typeof contactInfo === 'string') {
      // 이메일 마스킹
      contactInfo = contactInfo.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, 
        (match, user, domain) => {
          return `${user.substring(0, 2)}***@${domain}`;
        });
      
      // 전화번호 마스킹
      contactInfo = contactInfo.replace(/(\d{3})-?(\d{4})-?(\d{4})/g, '$1-****-$3');
    }
    return contactInfo;
  }

  writeToFile(fileName, formattedMessage) {
    if (!this.enableFile) return;

    try {
      const logFile = this.logFiles[fileName] || this.logFiles.general;
      const date = new Date().toISOString().split('T')[0];
      const logEntry = `${date} ${formattedMessage}\n`;

      // 파일 크기 확인 및 로테이션
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > this.maxFileSize) {
          this.rotateLogFile(logFile);
        }
      }

      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      console.error(`로그 파일 쓰기 실패 (${fileName}):`, error);
    }
  }

  rotateLogFile(logFile) {
    try {
      const dir = path.dirname(logFile);
      const baseName = path.basename(logFile, '.log');
      
      // 기존 로그 파일들을 순서대로 이름 변경
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldFile = path.join(dir, `${baseName}.${i}.log`);
        const newFile = path.join(dir, `${baseName}.${i + 1}.log`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile); // 가장 오래된 파일 삭제
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // 현재 로그 파일을 .1로 이름 변경
      const firstRotated = path.join(dir, `${baseName}.1.log`);
      fs.renameSync(logFile, firstRotated);
      
    } catch (error) {
      console.error('로그 파일 로테이션 실패:', error);
    }
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);

    // 콘솔 출력
    if (this.enableConsole) {
      const consoleMethod = level === 'error' ? console.error :
                           level === 'warn' ? console.warn :
                           level === 'debug' ? console.debug :
                           level === 'trace' ? console.trace :
                           console.log;
      consoleMethod(formattedMessage);
    }

    // 파일 출력
    this.writeToFile('general', formattedMessage);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  trace(message, meta = {}) {
    this.log('trace', message, meta);
  }

  // 알림 시스템 특화 로깅 메서드들

  /**
   * 알림 생성 로그
   */
  alert(alertType, alertData = {}) {
    const alert = {
      component: 'alert',
      alert_type: alertType,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...alertData
    };

    const message = `알림 생성: ${alertType}`;
    this.info(message, alert);
    this.writeToFile('alerts', this.formatMessage('info', message, alert));
  }

  /**
   * 알림 전송 로그
   */
  notification(notificationType, notificationData = {}) {
    const notification = {
      component: 'notification',
      notification_type: notificationType,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...notificationData
    };

    const message = `알림 전송: ${notificationType}`;
    this.info(message, notification);
    this.writeToFile('notifications', this.formatMessage('info', message, notification));
  }

  /**
   * 에스컬레이션 로그
   */
  escalation(escalationType, escalationData = {}) {
    const escalation = {
      component: 'escalation',
      escalation_type: escalationType,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...escalationData
    };

    const message = `에스컬레이션: ${escalationType}`;
    this.warn(message, escalation);
    this.writeToFile('escalations', this.formatMessage('warn', message, escalation));
  }

  /**
   * 임계치 관련 로그
   */
  threshold(action, thresholdData = {}) {
    const threshold = {
      component: 'threshold',
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...thresholdData
    };

    const message = `임계치 ${action}`;
    this.info(message, threshold);
    this.writeToFile('thresholds', this.formatMessage('info', message, threshold));
  }

  /**
   * 알림 채널 관련 로그
   */
  channel(action, channelData = {}) {
    const channel = {
      component: 'notification-channel',
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...channelData
    };

    const message = `알림 채널 ${action}`;
    this.info(message, channel);
    this.writeToFile('channels', this.formatMessage('info', message, channel));
  }

  /**
   * 알림 억제 로그
   */
  suppression(suppressionType, suppressionData = {}) {
    const suppression = {
      component: 'alert-suppression',
      suppression_type: suppressionType,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...suppressionData
    };

    const message = `알림 억제: ${suppressionType}`;
    this.debug(message, suppression);
  }

  /**
   * 알림 그룹핑 로그
   */
  grouping(action, groupData = {}) {
    const grouping = {
      component: 'alert-grouping',
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...groupData
    };

    const message = `알림 그룹핑 ${action}`;
    this.debug(message, grouping);
  }

  /**
   * 알림 해결 로그
   */
  resolution(alertId, resolutionData = {}) {
    const resolution = {
      component: 'alert-resolution',
      alert_id: alertId,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...resolutionData
    };

    const message = `알림 해결: ${alertId}`;
    this.info(message, resolution);
    this.writeToFile('alerts', this.formatMessage('info', message, resolution));
  }

  /**
   * 알림 통계 로그
   */
  statistics(statsType, statsData = {}) {
    const statistics = {
      component: 'alert-statistics',
      stats_type: statsType,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...statsData
    };

    const message = `알림 통계: ${statsType}`;
    this.info(message, statistics);
  }

  /**
   * 테스트 알림 로그
   */
  test(testType, testData = {}) {
    const test = {
      component: 'test-notification',
      test_type: testType,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...testData
    };

    const message = `테스트 알림: ${testType}`;
    this.info(message, test);
  }

  /**
   * API 요청 추적 로그
   */
  apiRequest(method, endpoint, statusCode, responseTime, errorInfo = null) {
    const requestData = {
      component: 'api-request',
      method,
      endpoint,
      status_code: statusCode,
      response_time: responseTime,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      error_info: errorInfo
    };

    const message = `API 요청: ${method} ${endpoint} ${statusCode} ${responseTime}ms`;
    
    if (statusCode >= 500 || errorInfo) {
      this.error(message, requestData);
    } else if (statusCode >= 400) {
      this.warn(message, requestData);
    } else {
      this.debug(message, requestData);
    }
  }

  /**
   * 성능 메트릭 로그
   */
  performance(metric, value, threshold = null, status = 'normal') {
    const perfData = {
      component: 'performance',
      metric,
      value,
      threshold,
      status,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };

    const message = `성능 메트릭: ${metric} = ${value}${threshold ? ` (임계치: ${threshold})` : ''}`;
    
    if (status === 'critical' || status === 'warning') {
      this.warn(message, perfData);
    } else {
      this.debug(message, perfData);
    }
  }

  /**
   * 시스템 상태 체크 로그
   */
  healthCheck(status, healthData = {}) {
    const health = {
      component: 'health-check',
      status,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...healthData
    };

    const message = `시스템 상태 체크: ${status}`;
    
    if (status === 'unhealthy') {
      this.error(message, health);
    } else {
      this.debug(message, health);
    }
  }

  /**
   * 데이터 정리 로그
   */
  cleanup(action, cleanupData = {}) {
    const cleanup = {
      component: 'data-cleanup',
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...cleanupData
    };

    const message = `데이터 정리: ${action}`;
    this.info(message, cleanup);
  }

  /**
   * 보안 관련 로그
   */
  security(securityEvent, eventData = {}) {
    const securityInfo = {
      component: 'security',
      event: securityEvent,
      severity: eventData.severity || 'medium',
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...eventData
    };

    const message = `보안 이벤트: ${securityEvent}`;
    
    if (securityInfo.severity === 'critical' || securityInfo.severity === 'high') {
      this.error(message, securityInfo);
    } else {
      this.warn(message, securityInfo);
    }
  }

  /**
   * 로그 파일 정리 (오래된 로그 파일 삭제)
   */
  cleanupLogs(daysToKeep = 7) {
    try {
      const now = Date.now();
      const cutoffTime = now - (daysToKeep * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

      if (fs.existsSync(this.logDir)) {
        const files = fs.readdirSync(this.logDir);
        
        files.forEach(file => {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            cleanedCount++;
            this.info(`오래된 로그 파일 삭제: ${file}`);
          }
        });
      }

      this.cleanup('로그 파일 정리 완료', { 
        cleaned_files: cleanedCount, 
        retention_days: daysToKeep 
      });

    } catch (error) {
      this.error('로그 파일 정리 실패', { error: error.message });
    }
  }

  /**
   * 로그 통계 정보 조회
   */
  getLogStats() {
    try {
      const stats = {
        log_directory: this.logDir,
        log_files: {},
        total_size: 0,
        generated_at: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      };

      Object.entries(this.logFiles).forEach(([category, filePath]) => {
        if (fs.existsSync(filePath)) {
          const fileStats = fs.statSync(filePath);
          stats.log_files[category] = {
            path: filePath,
            size: fileStats.size,
            size_mb: (fileStats.size / 1024 / 1024).toFixed(2),
            modified: fileStats.mtime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
          };
          stats.total_size += fileStats.size;
        } else {
          stats.log_files[category] = {
            path: filePath,
            size: 0,
            size_mb: '0.00',
            modified: null
          };
        }
      });

      stats.total_size_mb = (stats.total_size / 1024 / 1024).toFixed(2);

      return stats;
    } catch (error) {
      this.error('로그 통계 조회 실패', { error: error.message });
      return null;
    }
  }

  /**
   * 로그 설정 정보 조회
   */
  getConfig() {
    return {
      level: this.level,
      console_enabled: this.enableConsole,
      file_enabled: this.enableFile,
      log_directory: this.logDir,
      max_file_size: this.maxFileSize,
      max_file_size_mb: (this.maxFileSize / 1024 / 1024).toFixed(2),
      max_files: this.maxFiles,
      available_levels: Object.keys(this.levels),
      log_file_categories: Object.keys(this.logFiles)
    };
  }
}

// 싱글톤 인스턴스 생성
const logger = new AlertNotificationLogger({
  level: process.env.LOG_LEVEL || 'info',
  console: process.env.LOG_CONSOLE !== 'false',
  file: process.env.LOG_FILE !== 'false'
});

module.exports = logger;