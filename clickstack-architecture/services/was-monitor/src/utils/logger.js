/**
 * Logger Utility for WAS Monitor Service
 * WAS별 특화 로깅 및 성능 메트릭 로깅
 */

const fs = require('fs');
const path = require('path');

class WASLogger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.enableConsole = options.console !== false;
    this.enableFile = options.file !== false;
    this.logDir = options.logDir || path.join(__dirname, '../../logs');
    this.wasType = options.wasType || 'unknown';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 7; // 일주일치
    
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

    // WAS별 특화 로그 파일들
    this.logFiles = {
      general: path.join(this.logDir, `was-monitor-${this.wasType}.log`),
      performance: path.join(this.logDir, `was-performance-${this.wasType}.log`),
      gc: path.join(this.logDir, `was-gc-${this.wasType}.log`),
      threads: path.join(this.logDir, `was-threads-${this.wasType}.log`),
      alerts: path.join(this.logDir, `was-alerts-${this.wasType}.log`)
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

    // WAS 타입과 서비스 정보 추가
    const contextInfo = {
      was_type: this.wasType,
      service: 'was-monitor',
      korean_time: timestamp,
      ...meta
    };

    const metaStr = Object.keys(contextInfo).length > 0 ? 
      JSON.stringify(contextInfo, null, 2) : '';
    
    return `[${level.toUpperCase()}] ${timestamp} - ${message}${metaStr ? '\n' + metaStr : ''}`;
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

  // WAS 특화 로깅 메서드들
  
  /**
   * JVM 관련 로그
   */
  jvm(action, data = {}) {
    const jvmData = {
      component: 'jvm',
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data
    };
    
    this.info(`JVM ${action}`, jvmData);
    this.writeToFile('performance', this.formatMessage('info', `JVM ${action}`, jvmData));
  }

  /**
   * GC 이벤트 로그
   */
  gc(gcEvent) {
    const gcData = {
      component: 'gc',
      type: 'event',
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...gcEvent
    };
    
    this.info('GC 이벤트', gcData);
    this.writeToFile('gc', this.formatMessage('info', 'GC 이벤트', gcData));
  }

  /**
   * Thread Pool 관련 로그
   */
  threadPool(action, data = {}) {
    const threadData = {
      component: 'thread-pool',
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data
    };
    
    this.info(`Thread Pool ${action}`, threadData);
    this.writeToFile('threads', this.formatMessage('info', `Thread Pool ${action}`, threadData));
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
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      was_type: this.wasType
    };

    const message = `성능 메트릭: ${metric} = ${value}${threshold ? ` (임계치: ${threshold})` : ''}`;
    
    if (status === 'critical' || status === 'warning') {
      this.warn(message, perfData);
    } else {
      this.info(message, perfData);
    }
    
    this.writeToFile('performance', this.formatMessage('info', message, perfData));
  }

  /**
   * 성능 알림 로그
   */
  alert(alertType, alertData = {}) {
    const alert = {
      component: 'alert',
      type: alertType,
      severity: alertData.severity || 'warning',
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      was_type: this.wasType,
      ...alertData
    };

    const message = `성능 알림: ${alertType}`;
    this.warn(message, alert);
    this.writeToFile('alerts', this.formatMessage('warn', message, alert));
  }

  /**
   * WAS별 특화 로그
   */
  wasSpecific(action, data = {}) {
    const wasData = {
      component: 'was-specific',
      was_type: this.wasType,
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data
    };

    this.info(`${this.wasType.toUpperCase()} ${action}`, wasData);
  }

  /**
   * Tomcat 특화 로그
   */
  tomcat(component, action, data = {}) {
    if (this.wasType !== 'tomcat') return;
    
    const tomcatData = {
      component: `tomcat-${component}`,
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data
    };

    this.info(`Tomcat ${component} ${action}`, tomcatData);
  }

  /**
   * WebLogic 특화 로그
   */
  weblogic(component, action, data = {}) {
    if (this.wasType !== 'weblogic') return;
    
    const weblogicData = {
      component: `weblogic-${component}`,
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data
    };

    this.info(`WebLogic ${component} ${action}`, weblogicData);
  }

  /**
   * WebSphere 특화 로그
   */
  websphere(component, action, data = {}) {
    if (this.wasType !== 'websphere') return;
    
    const websphereData = {
      component: `websphere-${component}`,
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data
    };

    this.info(`WebSphere ${component} ${action}`, websphereData);
  }

  /**
   * HTTP 요청/응답 로그
   */
  http(method, url, statusCode, responseTime, data = {}) {
    const httpData = {
      component: 'http',
      method,
      url,
      status_code: statusCode,
      response_time: responseTime,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data
    };

    const message = `HTTP ${method} ${url} ${statusCode} ${responseTime}ms`;
    
    if (statusCode >= 500) {
      this.error(message, httpData);
    } else if (statusCode >= 400) {
      this.warn(message, httpData);
    } else {
      this.info(message, httpData);
    }
  }

  /**
   * 세션 관련 로그
   */
  session(action, sessionData = {}) {
    const sessionInfo = {
      component: 'session',
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...sessionData
    };

    this.info(`Session ${action}`, sessionInfo);
  }

  /**
   * 데이터베이스 연결 로그
   */
  database(action, dbData = {}) {
    const databaseInfo = {
      component: 'database',
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...dbData
    };

    this.info(`Database ${action}`, databaseInfo);
  }

  /**
   * 배포 관련 로그
   */
  deployment(action, deployData = {}) {
    const deploymentInfo = {
      component: 'deployment',
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...deployData
    };

    this.info(`Deployment ${action}`, deploymentInfo);
  }

  /**
   * 보안 관련 로그
   */
  security(action, securityData = {}) {
    const securityInfo = {
      component: 'security',
      action,
      severity: securityData.severity || 'medium',
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...securityData
    };

    const message = `Security ${action}`;
    
    if (securityInfo.severity === 'high' || securityInfo.severity === 'critical') {
      this.error(message, securityInfo);
    } else if (securityInfo.severity === 'medium') {
      this.warn(message, securityInfo);
    } else {
      this.info(message, securityInfo);
    }
  }

  /**
   * 시스템 리소스 로그
   */
  resource(resourceType, usage, limit = null) {
    const resourceData = {
      component: 'resource',
      type: resourceType,
      usage,
      limit,
      usage_percent: limit ? ((usage / limit) * 100).toFixed(2) : null,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };

    const message = `Resource ${resourceType}: ${usage}${limit ? `/${limit}` : ''}`;
    
    if (resourceData.usage_percent && parseFloat(resourceData.usage_percent) > 90) {
      this.error(message, resourceData);
    } else if (resourceData.usage_percent && parseFloat(resourceData.usage_percent) > 80) {
      this.warn(message, resourceData);
    } else {
      this.debug(message, resourceData);
    }
  }

  /**
   * 로그 파일 정리 (오래된 로그 파일 삭제)
   */
  cleanup(daysToKeep = 7) {
    try {
      const now = Date.now();
      const cutoffTime = now - (daysToKeep * 24 * 60 * 60 * 1000);

      if (fs.existsSync(this.logDir)) {
        const files = fs.readdirSync(this.logDir);
        
        files.forEach(file => {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            this.info(`오래된 로그 파일 삭제: ${file}`);
          }
        });
      }
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
        was_type: this.wasType,
        log_files: {},
        total_size: 0
      };

      Object.entries(this.logFiles).forEach(([category, filePath]) => {
        if (fs.existsSync(filePath)) {
          const fileStats = fs.statSync(filePath);
          stats.log_files[category] = {
            path: filePath,
            size: fileStats.size,
            modified: fileStats.mtime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
          };
          stats.total_size += fileStats.size;
        } else {
          stats.log_files[category] = {
            path: filePath,
            size: 0,
            modified: null
          };
        }
      });

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
      was_type: this.wasType,
      console_enabled: this.enableConsole,
      file_enabled: this.enableFile,
      log_directory: this.logDir,
      max_file_size: this.maxFileSize,
      max_files: this.maxFiles,
      log_files: Object.keys(this.logFiles)
    };
  }
}

// 싱글톤 인스턴스 생성
const logger = new WASLogger({
  level: process.env.LOG_LEVEL || 'info',
  console: process.env.LOG_CONSOLE !== 'false',
  file: process.env.LOG_FILE !== 'false',
  wasType: process.env.WAS_TYPE || 'unknown'
});

module.exports = logger;