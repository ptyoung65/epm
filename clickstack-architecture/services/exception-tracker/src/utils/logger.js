/**
 * Logger Utility for Exception Tracking Service
 * 예외/에러 추적 전용 로깅 시스템
 */

const fs = require('fs');
const path = require('path');

class ExceptionLogger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.enableConsole = options.console !== false;
    this.enableFile = options.file !== false;
    this.logDir = options.logDir || path.join(__dirname, '../../logs');
    this.maxFileSize = options.maxFileSize || 20 * 1024 * 1024; // 20MB (에러 로그는 용량이 클 수 있음)
    this.maxFiles = options.maxFiles || 10;
    
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

    // 예외 추적 전용 로그 파일들
    this.logFiles = {
      general: path.join(this.logDir, 'exception-tracker.log'),
      exceptions: path.join(this.logDir, 'tracked-exceptions.log'),
      alerts: path.join(this.logDir, 'exception-alerts.log'),
      performance: path.join(this.logDir, 'exception-performance.log'),
      resolution: path.join(this.logDir, 'exception-resolution.log'),
      trends: path.join(this.logDir, 'exception-trends.log')
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

    // 예외 추적 서비스 컨텍스트 정보 추가
    const contextInfo = {
      service: 'exception-tracker',
      korean_time: timestamp,
      ...meta
    };

    // 민감한 정보 마스킹
    if (contextInfo.stack) {
      contextInfo.stack = this.maskSensitiveInfo(contextInfo.stack);
    }
    
    if (contextInfo.message) {
      contextInfo.message = this.maskSensitiveInfo(contextInfo.message);
    }

    const metaStr = Object.keys(contextInfo).length > 0 ? 
      JSON.stringify(contextInfo, this.jsonReplacer, 2) : '';
    
    return `[${level.toUpperCase()}] ${timestamp} - ${message}${metaStr ? '\n' + metaStr : ''}`;
  }

  // JSON 직렬화 시 Set 등의 특수 객체 처리
  jsonReplacer(key, value) {
    if (value instanceof Set) {
      return Array.from(value);
    }
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }
    return value;
  }

  // 민감한 정보 마스킹 (패스워드, 토큰 등)
  maskSensitiveInfo(text) {
    if (typeof text !== 'string') return text;
    
    // 패스워드 마스킹
    text = text.replace(/password["\s]*[:=]["\s]*[^"\s,}]+/gi, 'password: "***"');
    text = text.replace(/pwd["\s]*[:=]["\s]*[^"\s,}]+/gi, 'pwd: "***"');
    
    // 토큰 마스킹
    text = text.replace(/token["\s]*[:=]["\s]*[^"\s,}]+/gi, 'token: "***"');
    text = text.replace(/authorization["\s]*[:=]["\s]*[^"\s,}]+/gi, 'authorization: "***"');
    
    // API 키 마스킹
    text = text.replace(/api[_-]?key["\s]*[:=]["\s]*[^"\s,}]+/gi, 'api_key: "***"');
    
    // 신용카드 번호 패턴 마스킹
    text = text.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '****-****-****-****');
    
    // 이메일 부분 마스킹
    text = text.replace(/(\w+)@(\w+\.\w+)/g, (match, user, domain) => {
      return `${user.substring(0, 2)}***@${domain}`;
    });

    return text;
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

  // 예외 추적 특화 로깅 메서드들

  /**
   * 예외/에러 추적 로그
   */
  exception(errorType, errorData = {}) {
    const exceptionInfo = {
      component: 'exception-tracking',
      error_type: errorType,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...errorData
    };
    
    const message = `예외 추적: ${errorType}`;
    this.info(message, exceptionInfo);
    this.writeToFile('exceptions', this.formatMessage('info', message, exceptionInfo));
  }

  /**
   * 에러 분류 로그
   */
  classification(errorType, classification, originalError = {}) {
    const classificationData = {
      component: 'error-classification',
      error_type: errorType,
      severity: classification.severity,
      category: classification.category,
      solution: classification.solution,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      original_error: {
        message: originalError.message ? originalError.message.substring(0, 200) : '',
        source: originalError.source || 'unknown'
      }
    };

    const message = `에러 분류: ${errorType} -> ${classification.category} (${classification.severity})`;
    this.debug(message, classificationData);
  }

  /**
   * 에러 그룹핑 로그
   */
  grouping(action, groupData = {}) {
    const groupingInfo = {
      component: 'error-grouping',
      action,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...groupData
    };

    const message = `에러 그룹핑 ${action}`;
    this.debug(message, groupingInfo);
  }

  /**
   * 성능 영향 분석 로그
   */
  performanceImpact(errorId, impact = {}) {
    const impactData = {
      component: 'performance-impact',
      error_id: errorId,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...impact
    };

    const message = `성능 영향 분석: ${errorId}`;
    this.info(message, impactData);
    this.writeToFile('performance', this.formatMessage('info', message, impactData));
  }

  /**
   * 에러 알림 로그
   */
  alert(alertType, alertData = {}) {
    const alert = {
      component: 'exception-alert',
      alert_type: alertType,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...alertData
    };

    const message = `예외 알림: ${alertType}`;
    this.warn(message, alert);
    this.writeToFile('alerts', this.formatMessage('warn', message, alert));
  }

  /**
   * 트렌드 분석 로그
   */
  trend(analysis, trendData = {}) {
    const trend = {
      component: 'trend-analysis',
      analysis,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...trendData
    };

    const message = `트렌드 분석: ${analysis}`;
    this.info(message, trend);
    this.writeToFile('trends', this.formatMessage('info', message, trend));
  }

  /**
   * 사용자 영향 분석 로그
   */
  userImpact(userId, impactData = {}) {
    const userImpactInfo = {
      component: 'user-impact',
      user_id: userId,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...impactData
    };

    const message = `사용자 영향 분석: ${userId}`;
    this.debug(message, userImpactInfo);
  }

  /**
   * 엔드포인트 에러 분석 로그
   */
  endpointError(endpoint, errorData = {}) {
    const endpointErrorInfo = {
      component: 'endpoint-error',
      endpoint,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...errorData
    };

    const message = `엔드포인트 에러: ${endpoint}`;
    this.debug(message, endpointErrorInfo);
  }

  /**
   * 해결 상태 업데이트 로그
   */
  resolution(errorId, resolutionData = {}) {
    const resolution = {
      component: 'error-resolution',
      error_id: errorId,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...resolutionData
    };

    const message = `에러 해결 상태: ${errorId} -> ${resolutionData.status || 'unknown'}`;
    this.info(message, resolution);
    this.writeToFile('resolution', this.formatMessage('info', message, resolution));
  }

  /**
   * 시스템 메트릭 로그
   */
  metrics(metricType, value, context = {}) {
    const metricsData = {
      component: 'system-metrics',
      metric_type: metricType,
      value,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...context
    };

    const message = `시스템 메트릭: ${metricType} = ${value}`;
    this.debug(message, metricsData);
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
   * 보안 관련 에러 로그
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

    // 보안 로그는 별도 파일에도 기록
    this.writeToFile('alerts', this.formatMessage('warn', message, securityInfo));
  }

  /**
   * 통계 정보 로그
   */
  statistics(statsType, statsData = {}) {
    const statistics = {
      component: 'statistics',
      stats_type: statsType,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...statsData
    };

    const message = `통계 정보: ${statsType}`;
    this.info(message, statistics);
  }

  /**
   * 리포트 생성 로그
   */
  report(reportType, reportData = {}) {
    const report = {
      component: 'report-generation',
      report_type: reportType,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...reportData
    };

    const message = `리포트 생성: ${reportType}`;
    this.info(message, report);
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
   * 데이터베이스 관련 로그
   */
  database(operation, dbData = {}) {
    const databaseInfo = {
      component: 'database',
      operation,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...dbData
    };

    const message = `데이터베이스 ${operation}`;
    
    if (dbData.error) {
      this.error(message, databaseInfo);
    } else {
      this.debug(message, databaseInfo);
    }
  }

  /**
   * 로그 파일 정리 (오래된 로그 파일 삭제)
   */
  cleanupLogs(daysToKeep = 30) {
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
            modified: fileStats.mtime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
            line_count: this.getFileLineCount(filePath)
          };
          stats.total_size += fileStats.size;
        } else {
          stats.log_files[category] = {
            path: filePath,
            size: 0,
            size_mb: '0.00',
            modified: null,
            line_count: 0
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
   * 파일의 라인 수 계산 (샘플링 방식으로 추정)
   */
  getFileLineCount(filePath) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) return 0;

      // 작은 파일은 전체 카운트
      if (stats.size < 1024 * 1024) { // 1MB 미만
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').length - 1;
      }

      // 큰 파일은 샘플링으로 추정
      const sampleSize = 1024; // 1KB 샘플
      const buffer = Buffer.alloc(sampleSize);
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, sampleSize, 0);
      fs.closeSync(fd);

      const sample = buffer.toString('utf8', 0, bytesRead);
      const linesInSample = sample.split('\n').length - 1;
      const estimatedLines = Math.round((linesInSample / bytesRead) * stats.size);

      return estimatedLines;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 로그 레벨 동적 변경
   */
  setLogLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.level = level;
      this.info(`로그 레벨 변경: ${level}`);
      return true;
    }
    return false;
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
const logger = new ExceptionLogger({
  level: process.env.LOG_LEVEL || 'info',
  console: process.env.LOG_CONSOLE !== 'false',
  file: process.env.LOG_FILE !== 'false'
});

module.exports = logger;