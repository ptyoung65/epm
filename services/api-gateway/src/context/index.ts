import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { RedisCache } from '@/services/cache';
import { v4 as uuidv4 } from 'uuid';

/**
 * User information from JWT token
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  permissions?: string[];
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ANALYST = 'ANALYST',
  VIEWER = 'VIEWER',
  USER = 'USER',
}

/**
 * GraphQL context interface
 */
export interface GraphQLContext {
  user?: User;
  requestId: string;
  startTime: number;
  cache: RedisCache;
  dataSources: {
    metrics: any;
    logs: any;
    traces: any;
    alerts: any;
    users: any;
    dashboards: any;
  };
  req: Request;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  hasPermission: (permission: string) => boolean;
  tenant?: {
    id: string;
    name: string;
    settings: Record<string, any>;
  };
}

/**
 * Create GraphQL context for each request
 */
export async function createContext({ req }: { req: Request }): Promise<GraphQLContext> {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const startTime = Date.now();
  const cache = new RedisCache(config.redis);

  // Extract user from JWT token
  let user: User | undefined;
  let isAuthenticated = false;
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      // Check if token is blacklisted
      const isBlacklisted = await cache.get(`blacklist:${token}`);
      if (isBlacklisted) {
        logger.warn('Blacklisted token used', { token: token.substring(0, 10), requestId });
      } else {
        const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
        
        // Check if user session is still valid
        const sessionKey = `session:${decoded.userId}:${decoded.sessionId}`;
        const sessionData = await cache.get(sessionKey);
        
        if (sessionData) {
          user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role as UserRole,
            tenantId: decoded.tenantId,
            permissions: decoded.permissions || [],
          };
          isAuthenticated = true;
          
          // Update session activity
          await cache.setex(sessionKey, 3600, JSON.stringify({
            ...sessionData,
            lastActivity: new Date().toISOString(),
          }));
        }
      }
    } catch (error) {
      logger.error('JWT verification failed', { 
        error: error.message, 
        token: token.substring(0, 10),
        requestId 
      });
    }
  }

  // Get tenant information if user belongs to one
  let tenant: GraphQLContext['tenant'];
  if (user?.tenantId) {
    try {
      const tenantData = await cache.get(`tenant:${user.tenantId}`);
      if (tenantData) {
        tenant = JSON.parse(tenantData);
      }
    } catch (error) {
      logger.error('Failed to fetch tenant data', { 
        tenantId: user.tenantId, 
        userId: user.id,
        requestId 
      });
    }
  }

  // Helper functions
  const hasRole = (requiredRole: UserRole): boolean => {
    if (!user) return false;
    
    const roleHierarchy = {
      [UserRole.ADMIN]: 5,
      [UserRole.MANAGER]: 4,
      [UserRole.ANALYST]: 3,
      [UserRole.VIEWER]: 2,
      [UserRole.USER]: 1,
    };
    
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === UserRole.ADMIN) return true;
    return user.permissions?.includes(permission) || false;
  };

  // Data sources (will be injected by subgraph services)
  const dataSources = {
    metrics: null,
    logs: null,
    traces: null,
    alerts: null,
    users: null,
    dashboards: null,
  };

  return {
    user,
    requestId,
    startTime,
    cache,
    dataSources,
    req,
    isAuthenticated,
    hasRole,
    hasPermission,
    tenant,
  };
}

/**
 * Authentication directive implementation
 */
export function requireAuth(context: GraphQLContext, requiredRole?: UserRole): void {
  if (!context.isAuthenticated) {
    throw new Error('Authentication required');
  }

  if (requiredRole && !context.hasRole(requiredRole)) {
    throw new Error(`Insufficient privileges. Required role: ${requiredRole}`);
  }
}

/**
 * Permission check implementation
 */
export function requirePermission(context: GraphQLContext, permission: string): void {
  if (!context.isAuthenticated) {
    throw new Error('Authentication required');
  }

  if (!context.hasPermission(permission)) {
    throw new Error(`Insufficient privileges. Required permission: ${permission}`);
  }
}

/**
 * Multi-tenant context filtering
 */
export function getTenantFilter(context: GraphQLContext): Record<string, any> {
  if (!context.user?.tenantId) {
    return {};
  }

  return {
    tenantId: context.user.tenantId,
  };
}