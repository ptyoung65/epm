import { Request, Response, NextFunction } from 'express';
import { logger, securityLogger } from '@/utils/logger';

/**
 * User roles hierarchy
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ANALYST = 'ANALYST',
  VIEWER = 'VIEWER',
  USER = 'USER',
}

/**
 * Role hierarchy levels
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.ADMIN]: 5,
  [UserRole.MANAGER]: 4,
  [UserRole.ANALYST]: 3,
  [UserRole.VIEWER]: 2,
  [UserRole.USER]: 1,
};

/**
 * Permission definitions
 */
export enum Permission {
  // User management
  MANAGE_USERS = 'manage_users',
  VIEW_USERS = 'view_users',
  
  // Dashboard management
  MANAGE_DASHBOARDS = 'manage_dashboards',
  VIEW_DASHBOARDS = 'view_dashboards',
  SHARE_DASHBOARDS = 'share_dashboards',
  
  // Metrics and monitoring
  VIEW_METRICS = 'view_metrics',
  MANAGE_ALERTS = 'manage_alerts',
  VIEW_ALERTS = 'view_alerts',
  
  // System administration
  SYSTEM_ADMIN = 'system_admin',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_TENANTS = 'manage_tenants',
  
  // Data access
  VIEW_SENSITIVE_DATA = 'view_sensitive_data',
  EXPORT_DATA = 'export_data',
  
  // API access
  GRAPHQL_INTROSPECTION = 'graphql_introspection',
  REST_API_ACCESS = 'rest_api_access',
}

/**
 * Default permissions by role
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.MANAGER]: [
    Permission.VIEW_USERS,
    Permission.MANAGE_DASHBOARDS,
    Permission.VIEW_DASHBOARDS,
    Permission.SHARE_DASHBOARDS,
    Permission.VIEW_METRICS,
    Permission.MANAGE_ALERTS,
    Permission.VIEW_ALERTS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_DATA,
    Permission.GRAPHQL_INTROSPECTION,
    Permission.REST_API_ACCESS,
  ],
  [UserRole.ANALYST]: [
    Permission.VIEW_DASHBOARDS,
    Permission.SHARE_DASHBOARDS,
    Permission.VIEW_METRICS,
    Permission.VIEW_ALERTS,
    Permission.EXPORT_DATA,
    Permission.GRAPHQL_INTROSPECTION,
    Permission.REST_API_ACCESS,
  ],
  [UserRole.VIEWER]: [
    Permission.VIEW_DASHBOARDS,
    Permission.VIEW_METRICS,
    Permission.VIEW_ALERTS,
    Permission.REST_API_ACCESS,
  ],
  [UserRole.USER]: [
    Permission.VIEW_DASHBOARDS,
    Permission.VIEW_METRICS,
    Permission.REST_API_ACCESS,
  ],
};

/**
 * Check if user has required role
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user has specific permission
 */
export function hasPermission(userRole: UserRole, userPermissions: string[] = [], requiredPermission: Permission): boolean {
  // Admin has all permissions
  if (userRole === UserRole.ADMIN) {
    return true;
  }

  // Check explicit user permissions
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(requiredPermission);
}

/**
 * Authorization middleware
 */
export function authorization(req: Request, res: Response, next: NextFunction): void {
  // Skip authorization for health check and docs
  if (req.path === '/health' || req.path.startsWith('/docs')) {
    return next();
  }

  // Skip authorization for unauthenticated GraphQL introspection in development
  if (req.path === '/graphql' && process.env.NODE_ENV === 'development') {
    const body = req.body;
    if (body?.query?.includes('__schema') || body?.query?.includes('IntrospectionQuery')) {
      return next();
    }
  }

  // Check if user is authenticated
  if (!req.user) {
    securityLogger.authz('Unauthorized access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please authenticate to access this resource',
    });
  }

  // Check tenant isolation
  if (req.user.tenantId) {
    // Add tenant filter to query parameters for multi-tenant isolation
    req.query.tenantId = req.user.tenantId;
  }

  // Log authorized access
  logger.debug('User authorized', {
    userId: req.user.id,
    role: req.user.role,
    tenantId: req.user.tenantId,
    path: req.path,
    method: req.method,
  });

  next();
}

/**
 * Role-based authorization middleware factory
 */
export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      securityLogger.authz('Role check failed - no user', {
        requiredRole,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate to access this resource',
      });
    }

    if (!hasRole(req.user.role as UserRole, requiredRole)) {
      securityLogger.authz('Insufficient role privileges', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRole,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      
      return res.status(403).json({
        error: 'Insufficient privileges',
        message: `Required role: ${requiredRole}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
}

/**
 * Permission-based authorization middleware factory
 */
export function requirePermission(requiredPermission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      securityLogger.authz('Permission check failed - no user', {
        requiredPermission,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate to access this resource',
      });
    }

    const userRole = req.user.role as UserRole;
    const userPermissions = req.user.permissions || [];

    if (!hasPermission(userRole, userPermissions, requiredPermission)) {
      securityLogger.authz('Insufficient permission privileges', {
        userId: req.user.id,
        userRole,
        userPermissions,
        requiredPermission,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      
      return res.status(403).json({
        error: 'Insufficient privileges',
        message: `Required permission: ${requiredPermission}`,
      });
    }

    next();
  };
}

/**
 * Tenant isolation middleware
 */
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please authenticate to access this resource',
    });
  }

  if (!req.user.tenantId) {
    securityLogger.authz('Tenant access required but user has no tenant', {
      userId: req.user.id,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    
    return res.status(403).json({
      error: 'Tenant access required',
      message: 'This resource requires tenant membership',
    });
  }

  next();
}

/**
 * Admin-only middleware
 */
export const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * Manager or higher middleware
 */
export const requireManager = requireRole(UserRole.MANAGER);

/**
 * System administration permission middleware
 */
export const requireSystemAdmin = requirePermission(Permission.SYSTEM_ADMIN);

/**
 * Data export permission middleware
 */
export const requireDataExport = requirePermission(Permission.EXPORT_DATA);

/**
 * Get user permissions
 */
export function getUserPermissions(userRole: UserRole, userPermissions: string[] = []): Permission[] {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  const explicitPermissions = userPermissions.filter(p => 
    Object.values(Permission).includes(p as Permission)
  ) as Permission[];
  
  // Combine and deduplicate permissions
  const allPermissions = [...new Set([...rolePermissions, ...explicitPermissions])];
  
  return allPermissions;
}

/**
 * Check resource ownership
 */
export function checkResourceOwnership(req: Request, resourceUserId: string): boolean {
  if (!req.user) {
    return false;
  }

  // Admin can access any resource
  if (req.user.role === UserRole.ADMIN) {
    return true;
  }

  // Managers can access resources in their tenant
  if (req.user.role === UserRole.MANAGER && req.user.tenantId) {
    // Additional logic would check if resourceUserId belongs to same tenant
    return true;
  }

  // Users can only access their own resources
  return req.user.id === resourceUserId;
}