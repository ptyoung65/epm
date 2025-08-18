import winston from 'winston';
import appConfig from './app';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

// Custom format for console logging
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
    }`;
  })
);

// Format for file logging
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// Create the logger
const logger = winston.createLogger({
  level: appConfig.logging.level,
  defaultMeta: {
    service: 'airis-mon',
    environment: appConfig.env,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: appConfig.env === 'production' ? fileFormat : consoleFormat,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: appConfig.logging.file,
      format: fileFormat,
      maxsize: appConfig.logging.maxSize,
      maxFiles: appConfig.logging.maxFiles,
    }),
    
    // Separate file for error logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: appConfig.logging.maxSize,
      maxFiles: appConfig.logging.maxFiles,
    }),
  ],
});

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({ filename: 'logs/exceptions.log' })
);

logger.rejections.handle(
  new winston.transports.File({ filename: 'logs/rejections.log' })
);

export default logger;

// Export a structured logger for specific use cases
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// Database query logger
export const dbLogger = createModuleLogger('database');

// Security event logger
export const securityLogger = createModuleLogger('security');

// Performance logger
export const performanceLogger = createModuleLogger('performance');

// API request logger
export const apiLogger = createModuleLogger('api');