import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { RedisCache } from '@/services/cache';

const cache = new RedisCache(config.redis);

/**
 * Authentication middleware
 * Verifies JWT tokens and sets user information on request
 */
export async function authentication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    // Skip authentication for health check and docs
    if (req.path === '/health' || req.path.startsWith('/docs')) {
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Allow unauthenticated requests to GraphQL for introspection
      if (req.path === '/graphql' && req.method === 'POST') {
        const body = req.body;
        if (body?.query?.includes('__schema') || body?.query?.includes('IntrospectionQuery')) {
          return next();
        }
      }
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token',
      });
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted
    const isBlacklisted = await cache.get(`blacklist:${token}`);
    if (isBlacklisted) {
      logger.warn('Blacklisted token used', { 
        token: token.substring(0, 10),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        error: 'Token revoked',
        message: 'This token has been revoked',
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
    
    // Check if user session is still valid
    const sessionKey = `session:${decoded.userId}:${decoded.sessionId}`;
    const sessionData = await cache.get(sessionKey);
    
    if (!sessionData) {
      logger.warn('Invalid session', { 
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        ip: req.ip
      });
      
      return res.status(401).json({
        error: 'Session expired',
        message: 'Please login again',
      });
    }

    // Set user information on request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId,
      permissions: decoded.permissions || [],
      sessionId: decoded.sessionId,
    };

    // Update session activity
    const session = JSON.parse(sessionData);
    await cache.setex(sessionKey, 3600, JSON.stringify({
      ...session,
      lastActivity: new Date().toISOString(),
    }));

    // Log successful authentication
    logger.debug('User authenticated', {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      tenantId: req.user.tenantId,
      ip: req.ip,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', { 
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid',
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('JWT token expired', { 
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        error: 'Token expired',
        message: 'The provided token has expired',
      });
    }

    logger.error('Authentication error', { 
      error: error.message,
      stack: error.stack,
      ip: req.ip 
    });
    
    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * Optional authentication middleware
 * Same as authentication but doesn't reject unauthenticated requests
 */
export async function optionalAuthentication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted
    const isBlacklisted = await cache.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
    
    // Check if user session is still valid
    const sessionKey = `session:${decoded.userId}:${decoded.sessionId}`;
    const sessionData = await cache.get(sessionKey);
    
    if (sessionData) {
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId,
        permissions: decoded.permissions || [],
        sessionId: decoded.sessionId,
      };

      // Update session activity
      const session = JSON.parse(sessionData);
      await cache.setex(sessionKey, 3600, JSON.stringify({
        ...session,
        lastActivity: new Date().toISOString(),
      }));
    }

    next();
  } catch (error) {
    // Log error but continue without authentication
    logger.debug('Optional authentication failed', { 
      error: error.message,
      ip: req.ip 
    });
    next();
  }
}