import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { CustomError } from './errorHandler';

/**
 * User interface from JWT payload
 */
export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  tenantId?: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

/**
 * Extended Request interface with user
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
  isAuthenticated: boolean;
}

/**
 * Authentication middleware
 */
export const authentication = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;
  authReq.isAuthenticated = false;

  // Skip authentication for public endpoints
  if (isPublicEndpoint(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    logger.warn('No authorization header provided', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      requestId: (req as any).requestId,
    });
    return next(createAuthError('No authorization header provided'));
  }

  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Invalid authorization header format', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      requestId: (req as any).requestId,
    });
    return next(createAuthError('Invalid authorization header format'));
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as User;
    
    // Validate token payload
    if (!decoded.id || !decoded.username || !decoded.roles) {
      logger.warn('Invalid token payload', {
        path: req.path,
        method: req.method,
        userId: decoded.id,
        requestId: (req as any).requestId,
      });
      return next(createAuthError('Invalid token payload'));
    }

    // Check token expiration (additional check)
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      logger.warn('Token expired', {
        path: req.path,
        method: req.method,
        userId: decoded.id,
        expiredAt: new Date(decoded.exp * 1000).toISOString(),
        requestId: (req as any).requestId,
      });
      return next(createAuthError('Token expired'));
    }

    // Attach user to request
    authReq.user = decoded;
    authReq.isAuthenticated = true;

    logger.debug('Authentication successful', {
      path: req.path,
      method: req.method,
      userId: decoded.id,
      username: decoded.username,
      roles: decoded.roles,
      tenantId: decoded.tenantId,
      requestId: (req as any).requestId,
    });

    next();
  } catch (error) {
    logger.warn('Token verification failed', {
      path: req.path,
      method: req.method,
      error: error.message,
      ip: req.ip,
      requestId: (req as any).requestId,
    });
    
    if (error.name === 'TokenExpiredError') {
      return next(createAuthError('Token expired'));
    } else if (error.name === 'JsonWebTokenError') {
      return next(createAuthError('Invalid token'));
    } else {
      return next(createAuthError('Authentication failed'));
    }
  }
};

/**
 * Optional authentication middleware (won't fail if no token)
 */
export const optionalAuthentication = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;
  authReq.isAuthenticated = false;

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as User;
    authReq.user = decoded;
    authReq.isAuthenticated = true;
    
    logger.debug('Optional authentication successful', {
      path: req.path,
      userId: decoded.id,
      requestId: (req as any).requestId,
    });
  } catch (error) {
    logger.debug('Optional authentication failed', {
      path: req.path,
      error: error.message,
      requestId: (req as any).requestId,
    });
  }

  next();
};

/**
 * Role-based authorization middleware
 */
export const requireRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.isAuthenticated || !authReq.user) {
      return next(createAuthError('Authentication required'));
    }

    const userRoles = authReq.user.roles || [];
    const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      logger.warn('Insufficient permissions', {
        path: req.path,
        method: req.method,
        userId: authReq.user.id,
        userRoles,
        requiredRoles: allowedRoles,
        requestId: (req as any).requestId,
      });
      
      const error: CustomError = new Error('Insufficient permissions');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      return next(error);
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermissions = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.isAuthenticated || !authReq.user) {
      return next(createAuthError('Authentication required'));
    }

    const userPermissions = authReq.user.permissions || [];
    const hasAllPermissions = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );
    
    if (!hasAllPermissions) {
      logger.warn('Missing permissions', {
        path: req.path,
        method: req.method,
        userId: authReq.user.id,
        userPermissions,
        requiredPermissions,
        requestId: (req as any).requestId,
      });
      
      const error: CustomError = new Error('Missing required permissions');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      return next(error);
    }

    next();
  };
};

/**
 * Tenant isolation middleware
 */
export const requireTenant = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.isAuthenticated || !authReq.user) {
    return next(createAuthError('Authentication required'));
  }

  const tenantId = req.headers['x-tenant-id'] as string || authReq.user.tenantId;
  
  if (!tenantId) {
    logger.warn('No tenant ID provided', {
      path: req.path,
      method: req.method,
      userId: authReq.user.id,
      requestId: (req as any).requestId,
    });
    
    const error: CustomError = new Error('Tenant ID required');
    error.statusCode = 400;
    error.code = 'TENANT_REQUIRED';
    return next(error);
  }

  // Validate tenant access
  if (authReq.user.tenantId && authReq.user.tenantId !== tenantId) {
    logger.warn('Tenant access denied', {
      path: req.path,
      method: req.method,
      userId: authReq.user.id,
      userTenantId: authReq.user.tenantId,
      requestedTenantId: tenantId,
      requestId: (req as any).requestId,
    });
    
    const error: CustomError = new Error('Access denied to tenant');
    error.statusCode = 403;
    error.code = 'TENANT_ACCESS_DENIED';
    return next(error);
  }

  next();
};

/**
 * Check if endpoint is public (doesn't require authentication)
 */
function isPublicEndpoint(path: string): boolean {
  const publicPaths = [
    '/health',
    '/docs',
    '/api-docs',
    '/swagger',
    '/favicon.ico',
    '/robots.txt',
  ];
  
  const publicPatterns = [
    /^\/docs\//,
    /^\/swagger\//,
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i,
  ];
  
  return publicPaths.includes(path) || 
         publicPatterns.some(pattern => pattern.test(path));
}

/**
 * Create authentication error
 */
function createAuthError(message: string): CustomError {
  const error: CustomError = new Error(message);
  error.statusCode = 401;
  error.code = 'UNAUTHORIZED';
  return error;
}
