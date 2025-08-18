/**
 * Logger Utility for J2EE Monitor Service
 * 한국어 로깅 및 다양한 로그 레벨 지원
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.enableConsole = options.console !== false;
    this.enableFile = options.file !== false;
    this.logDir = options.logDir || path.join(__dirname, '../../logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    // 로그 디렉토리 생성
    if (this.enableFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
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
      second: '2-digit'
    });

    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
    
    return `[${level.toUpperCase()}] ${timestamp} - ${message}${metaStr ? '\n' + metaStr : ''}`;
  }

  writeToFile(level, formattedMessage) {
    if (!this.enableFile) return;

    try {
      const logFile = path.join(this.logDir, `j2ee-monitor-${level}.log`);
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
      console.error('로그 파일 쓰기 실패:', error);
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
      switch (level) {
        case 'error':
          console.error(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'debug':
          console.debug(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }

    // 파일 출력
    this.writeToFile(level, formattedMessage);
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

  // J2EE 특화 로깅 메서드들
  servlet(action, data = {}) {
    this.info(`Servlet ${action}`, { 
      component: 'servlet', 
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data 
    });
  }

  jsp(action, data = {}) {
    this.info(`JSP ${action}`, { 
      component: 'jsp', 
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data 
    });
  }

  ejb(action, data = {}) {
    this.info(`EJB ${action}`, { 
      component: 'ejb', 
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data 
    });
  }

  session(action, data = {}) {
    this.info(`Session ${action}`, { 
      component: 'session', 
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data 
    });
  }

  transaction(action, data = {}) {
    this.info(`Transaction ${action}`, { 
      component: 'transaction', 
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ...data 
    });
  }

  performance(message, metrics = {}) {
    this.info(`성능: ${message}`, {
      type: 'performance',
      metrics,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    });
  }

  alert(message, alertData = {}) {
    this.warn(`알림: ${message}`, {
      type: 'alert',
      ...alertData,
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    });
  }
}

// 싱글톤 인스턴스 생성
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  console: process.env.LOG_CONSOLE !== 'false',
  file: process.env.LOG_FILE !== 'false'
});

module.exports = logger;