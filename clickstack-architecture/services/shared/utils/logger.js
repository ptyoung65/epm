/**
 * Shared Logger Configuration
 * Provides consistent logging across all services
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: process.env.SERVICE_NAME || 'airis-service',
    version: process.env.SERVICE_VERSION || '1.0.0'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          let metaStr = '';
          if (Object.keys(meta).length > 0) {
            metaStr = ' ' + JSON.stringify(meta);
          }
          return `${timestamp} [${level}] ${service}: ${message}${metaStr}`;
        })
      )
    }),
    new winston.transports.File({ 
      filename: '/app/logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: '/app/logs/combined.log' 
    })
  ],
});

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({ filename: '/app/logs/exceptions.log' })
);

module.exports = logger;