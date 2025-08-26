import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '@/config/environment';

/**
 * Custom log format with colors for development
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

/**
 * JSON format for production
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp', 'label']
  })
);

/**
 * Create transports based on environment
 */
const createTransports = (): winston.transport[] => {
  const transports: winston.transport[] = [];

  // Console transport
  transports.push(
    new winston.transports.Console({
      format: config.isDevelopment ? developmentFormat : productionFormat,
      level: config.logging.level,
    })
  );

  // File transport for non-development environments
  if (!config.isDevelopment) {
    // General log file
    transports.push(
      new DailyRotateFile({
        filename: 'logs/app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: productionFormat,
        level: config.logging.level,
      })
    );

    // Error log file
    transports.push(
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: productionFormat,
        level: 'error',
      })
    );

    // Security log file for authentication/authorization events
    transports.push(
      new DailyRotateFile({
        filename: 'logs/security-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '90d',
        format: productionFormat,
        level: 'warn',
      })
    );
  }

  return transports;
};

/**
 * Create Winston logger instance
 */
export const logger = winston.createLogger({
  level: config.logging.level,
  format: config.isDevelopment ? developmentFormat : productionFormat,
  defaultMeta: {
    service: 'airis-epm-api-gateway',
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: createTransports(),
  exitOnError: false,
});

/**
 * Custom logger methods for specific use cases
 */
export const securityLogger = {
  /**
   * Log authentication events
   */
  auth: (message: string, meta: Record<string, any> = {}) => {
    logger.info(`[AUTH] ${message}`, {
      ...meta,
      category: 'authentication',
      severity: 'info',
    });
  },

  /**
   * Log authorization events
   */
  authz: (message: string, meta: Record<string, any> = {}) => {
    logger.warn(`[AUTHZ] ${message}`, {
      ...meta,
      category: 'authorization',
      severity: 'warn',
    });
  },

  /**
   * Log security violations
   */
  violation: (message: string, meta: Record<string, any> = {}) => {
    logger.error(`[SECURITY] ${message}`, {
      ...meta,
      category: 'security_violation',
      severity: 'high',
    });
  },

  /**
   * Log suspicious activities
   */
  suspicious: (message: string, meta: Record<string, any> = {}) => {
    logger.warn(`[SUSPICIOUS] ${message}`, {
      ...meta,
      category: 'suspicious_activity',
      severity: 'medium',
    });
  },
};

/**
 * Performance logger for tracking API performance
 */
export const performanceLogger = {
  /**
   * Log API request performance
   */
  api: (message: string, meta: {
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    userId?: string;
    requestId: string;
  }) => {
    logger.info(`[PERFORMANCE] ${message}`, {
      ...meta,
      category: 'api_performance',
    });
  },

  /**
   * Log database query performance
   */
  database: (message: string, meta: {
    query: string;
    duration: number;
    database: string;
    userId?: string;
    requestId: string;
  }) => {
    logger.info(`[DB_PERFORMANCE] ${message}`, {
      ...meta,
      category: 'database_performance',
    });
  },

  /**
   * Log GraphQL query performance
   */
  graphql: (message: string, meta: {
    operationName?: string;
    query: string;
    variables: Record<string, any>;
    duration: number;
    complexity: number;
    userId?: string;
    requestId: string;
  }) => {
    logger.info(`[GRAPHQL_PERFORMANCE] ${message}`, {
      ...meta,
      category: 'graphql_performance',
    });
  },

  /**
   * Log cache performance
   */
  cache: (message: string, meta: {
    operation: 'hit' | 'miss' | 'set' | 'del';
    key: string;
    duration: number;
    requestId: string;
  }) => {
    logger.debug(`[CACHE_PERFORMANCE] ${message}`, {
      ...meta,
      category: 'cache_performance',
    });
  },
};

/**
 * Business logic logger
 */
export const businessLogger = {
  /**
   * Log user actions
   */
  userAction: (message: string, meta: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    tenantId?: string;
    requestId: string;
    metadata?: Record<string, any>;
  }) => {
    logger.info(`[USER_ACTION] ${message}`, {
      ...meta,
      category: 'user_action',
    });
  },

  /**
   * Log system events
   */
  systemEvent: (message: string, meta: {
    event: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
  }) => {
    const logLevel = meta.severity === 'critical' ? 'error' : 
                    meta.severity === 'high' ? 'warn' : 'info';
    
    logger[logLevel](`[SYSTEM_EVENT] ${message}`, {
      ...meta,
      category: 'system_event',
    });
  },

  /**
   * Log data changes
   */
  dataChange: (message: string, meta: {
    userId: string;
    table: string;
    operation: 'insert' | 'update' | 'delete';
    recordId: string;
    changes?: Record<string, any>;
    tenantId?: string;
    requestId: string;
  }) => {
    logger.info(`[DATA_CHANGE] ${message}`, {
      ...meta,
      category: 'data_change',
    });
  },
};

/**
 * Stream for Morgan HTTP request logging
 */
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

/**
 * Log unhandled promise rejections and uncaught exceptions
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  
  // Give Winston time to write logs before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});