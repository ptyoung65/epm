/**
 * Logger utility for AIRIS-MON session replay manager
 */

const winston = require('winston');

// 로그 레벨 정의
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// 커스텀 로그 형식
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// 개발 환경용 간단한 형식
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    let logMessage = `${timestamp} [${level}]`;
    
    if (service) {
      logMessage += ` [${service}]`;
    }
    
    logMessage += `: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// 환경에 따른 로그 레벨 결정
const getLogLevel = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return 'info';
    case 'test':
      return 'warn';
    case 'development':
    default:
      return 'debug';
  }
};

// Winston 로거 설정
const logger = winston.createLogger({
  level: getLogLevel(),
  levels: LOG_LEVELS,
  format: process.env.NODE_ENV === 'production' ? logFormat : devFormat,
  defaultMeta: { 
    service: 'session-replay-manager',
    timestamp: new Date().toISOString()
  },
  transports: [
    // 콘솔 출력
    new winston.transports.Console({
      handleExceptions: true
    }),
    
    // 파일 출력 (운영 환경)
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: '/app/logs/error.log',
        level: 'error',
        handleExceptions: true
      }),
      new winston.transports.File({
        filename: '/app/logs/combined.log',
        handleExceptions: true
      })
    ] : [])
  ],
  exitOnError: false
});

// 스트림 인터페이스 (Morgan과 함께 사용)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// 에러 로깅 헬퍼
logger.logError = (error, context = {}) => {
  logger.error('오류 발생', {
    error: error.message,
    stack: error.stack,
    ...context
  });
};

// 성능 측정 헬퍼
logger.logPerformance = (operation, startTime, context = {}) => {
  const duration = Date.now() - startTime;
  logger.info(`성능 측정: ${operation}`, {
    duration: `${duration}ms`,
    ...context
  });
};

// 세션 관련 로깅 헬퍼
logger.logSession = (action, sessionId, data = {}) => {
  logger.info(`세션 ${action}`, {
    sessionId,
    service: 'session-replay',
    ...data
  });
};

module.exports = logger;