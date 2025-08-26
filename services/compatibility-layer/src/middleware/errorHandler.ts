import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

/**
 * Custom error interface
 */
export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    statusCode: error.statusCode || 500,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: (req as any).requestId,
  });

  // Determine error status code
  const statusCode = error.statusCode || 500;
  
  // Determine error message (hide internal errors in production)
  const message = config.isProduction && statusCode === 500 
    ? 'Internal Server Error' 
    : error.message;

  // Create error response
  const errorResponse = {
    error: getErrorType(statusCode),
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    requestId: (req as any).requestId || 'unknown',
    ...(config.isDevelopment && { stack: error.stack }),
    ...(error.details && { details: error.details }),
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Get error type from status code
 */
function getErrorType(statusCode: number): string {
  switch (true) {
    case statusCode >= 400 && statusCode < 500:
      return 'Client Error';
    case statusCode >= 500:
      return 'Server Error';
    default:
      return 'Unknown Error';
  }
}

/**
 * Not found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error: CustomError = new Error(`Route ${req.method} ${req.path} not found`);
  error.statusCode = 404;
  next(error);
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
export const validationErrorHandler = (
  errors: any[],
  req: Request
): CustomError => {
  const error: CustomError = new Error('Validation Error');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = errors.map(err => ({
    field: err.param || err.field,
    message: err.msg || err.message,
    value: err.value,
  }));
  return error;
};
