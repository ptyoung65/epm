import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config/environment';

/**
 * Custom log format function
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]`;
    
    // Add service name
    logMessage += ' [compatibility-layer]';
    
    // Add message
    logMessage += `: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 0)}`;
    }
    
    return logMessage;
  })
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} ${level}: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

/**
 * Create transports based on environment
 */
const transports: winston.transport[] = [];

// Console transport
if (config.isDevelopment) {
  transports.push(
    new winston.transports.Console({
      level: config.logging.level,
      format: consoleFormat,
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      level: config.logging.level,
      format: logFormat,
    })
  );
}

// File transport with rotation
if (config.isProduction) {
  // Application logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/compatibility-layer-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
      level: config.logging.level,
    })
  );
  
  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/compatibility-layer-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
      level: 'error',
    })
  );
}

/**
 * Main logger instance
 */
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test',
});

/**
 * Performance logger for API metrics
 */
export const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/performance.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
  silent: process.env.NODE_ENV === 'test',
});

// Add specific methods for performance logging
performanceLogger.api = (message: string, metadata: any) => {
  performanceLogger.info(message, {
    ...metadata,
    type: 'api_performance',
    timestamp: Date.now(),
  });
};

performanceLogger.database = (message: string, metadata: any) => {
  performanceLogger.info(message, {
    ...metadata,
    type: 'database_performance',
    timestamp: Date.now(),
  });
};

performanceLogger.cache = (message: string, metadata: any) => {
  performanceLogger.info(message, {
    ...metadata,
    type: 'cache_performance',
    timestamp: Date.now(),
  });
};

/**
 * Security logger for audit events
 */
export const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/security.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
  silent: process.env.NODE_ENV === 'test',
});

// Add specific methods for security logging
securityLogger.auth = (message: string, metadata: any) => {
  securityLogger.info(message, {
    ...metadata,
    type: 'authentication',
    timestamp: Date.now(),
  });
};

securityLogger.authz = (message: string, metadata: any) => {
  securityLogger.info(message, {
    ...metadata,
    type: 'authorization',
    timestamp: Date.now(),
  });
};

securityLogger.access = (message: string, metadata: any) => {
  securityLogger.info(message, {
    ...metadata,
    type: 'access_attempt',
    timestamp: Date.now(),
  });
};

/**
 * Migration logger for data migration events
 */
export const migrationLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/migration.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
  silent: process.env.NODE_ENV === 'test',
});

// Add specific methods for migration logging
migrationLogger.task = (message: string, metadata: any) => {
  migrationLogger.info(message, {
    ...metadata,
    type: 'migration_task',
    timestamp: Date.now(),
  });
};

migrationLogger.batch = (message: string, metadata: any) => {
  migrationLogger.info(message, {
    ...metadata,
    type: 'migration_batch',
    timestamp: Date.now(),
  });
};

migrationLogger.transform = (message: string, metadata: any) => {
  migrationLogger.info(message, {
    ...metadata,
    type: 'data_transformation',
    timestamp: Date.now(),
  });
};

/**
 * Handle uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason,
    promise: promise.toString(),
  });
});

/**
 * Graceful shutdown handling for loggers
 */
process.on('SIGINT', () => {
  logger.info('Received SIGINT, closing loggers...');
  logger.end();
  performanceLogger.end();
  securityLogger.end();
  migrationLogger.end();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, closing loggers...');
  logger.end();
  performanceLogger.end();
  securityLogger.end();
  migrationLogger.end();
});

/**
 * Export log level constants for consistency
 */
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly',
} as const;

/**
 * Utility function to create child logger with consistent metadata
 */
export const createChildLogger = (component: string, metadata?: any) => {
  return logger.child({
    component,
    ...metadata,
  });
};

/**
 * Log helper functions for common patterns
 */
export const logHelpers = {
  /**
   * Log API request start
   */
  apiStart: (method: string, path: string, requestId: string, metadata?: any) => {
    logger.info(`API ${method} ${path} started`, {
      method,
      path,
      requestId,
      type: 'api_start',
      ...metadata,
    });
  },
  
  /**
   * Log API request completion
   */
  apiComplete: (
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    requestId: string,
    metadata?: any
  ) => {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger[level](`API ${method} ${path} completed`, {
      method,
      path,
      statusCode,
      responseTime,
      requestId,
      type: 'api_complete',
      ...metadata,
    });
  },
  
  /**
   * Log database query
   */
  dbQuery: (query: string, duration: number, metadata?: any) => {
    logger.debug('Database query executed', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration,
      type: 'db_query',
      ...metadata,
    });
  },
  
  /**
   * Log cache operation
   */
  cacheOperation: (operation: string, key: string, hit: boolean, metadata?: any) => {
    logger.debug(`Cache ${operation}`, {
      operation,
      key,
      hit,
      type: 'cache_operation',
      ...metadata,
    });
  },
};

// Log system startup information
logger.info('Logging system initialized', {
  level: config.logging.level,
  format: config.logging.format,
  environment: config.env,
  transports: transports.length,
});
