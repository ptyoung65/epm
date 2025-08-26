class RBACManager {
  constructor() {
    // Resource definitions
    this.resources = {
      metrics: {
        actions: ['read', 'write', 'delete', 'admin'],
        endpoints: ['/api/metrics/**']
      },
      logs: {
        actions: ['read', 'write', 'delete', 'admin'],
        endpoints: ['/api/logs/**']
      },
      traces: {
        actions: ['read', 'write', 'delete', 'admin'],
        endpoints: ['/api/traces/**']
      },
      alerts: {
        actions: ['read', 'write', 'delete', 'admin'],
        endpoints: ['/api/alerts/**']
      },
      etl: {
        actions: ['read', 'write', 'admin'],
        endpoints: ['/api/etl/**']
      },
      gateway: {
        actions: ['read', 'admin'],
        endpoints: ['/gateway/**']
      },
      registry: {
        actions: ['read', 'admin'],
        endpoints: ['/registry/**']
      }
    };

    // Role definitions with hierarchical inheritance
    this.roles = {
      // Super admin - full system access
      superadmin: {
        inherits: [],
        permissions: ['*:*'],
        level: 1000,
        description: 'Full system administrator access'
      },

      // System admin - full operational access
      admin: {
        inherits: [],
        permissions: [
          'metrics:*', 'logs:*', 'traces:*', 'alerts:*',
          'etl:*', 'gateway:*', 'registry:*'
        ],
        level: 100,
        description: 'System administrator with full operational access'
      },

      // Operations team - monitoring and maintenance
      operator: {
        inherits: [],
        permissions: [
          'metrics:read', 'metrics:write',
          'logs:read', 'logs:write',
          'traces:read', 'traces:write',
          'alerts:read', 'alerts:write',
          'etl:read', 'gateway:read'
        ],
        level: 50,
        description: 'Operations team member with monitoring access'
      },

      // Development team - development environment access
      developer: {
        inherits: [],
        permissions: [
          'metrics:read', 'metrics:write',
          'logs:read', 'logs:write',
          'traces:read', 'traces:write',
          'alerts:read',
          'etl:read'
        ],
        level: 30,
        description: 'Developer with read/write access to observability data'
      },

      // Analyst - read-only access to data
      analyst: {
        inherits: [],
        permissions: [
          'metrics:read',
          'logs:read',
          'traces:read',
          'alerts:read',
          'etl:read'
        ],
        level: 20,
        description: 'Data analyst with read-only access'
      },

      // Viewer - basic monitoring access
      viewer: {
        inherits: [],
        permissions: [
          'metrics:read',
          'logs:read',
          'alerts:read'
        ],
        level: 10,
        description: 'Basic monitoring viewer access'
      },

      // Guest - minimal access
      guest: {
        inherits: [],
        permissions: [
          'metrics:read'
        ],
        level: 1,
        description: 'Guest access with minimal permissions'
      }
    };

    // Service-specific permissions
    this.servicePermissions = {
      'metrics-service': {
        requiredLevel: 10,
        readPermissions: ['metrics:read'],
        writePermissions: ['metrics:write'],
        adminPermissions: ['metrics:admin']
      },
      'logs-service': {
        requiredLevel: 10,
        readPermissions: ['logs:read'],
        writePermissions: ['logs:write'],
        adminPermissions: ['logs:admin']
      },
      'traces-service': {
        requiredLevel: 10,
        readPermissions: ['traces:read'],
        writePermissions: ['traces:write'],
        adminPermissions: ['traces:admin']
      },
      'alerts-service': {
        requiredLevel: 10,
        readPermissions: ['alerts:read'],
        writePermissions: ['alerts:write'],
        adminPermissions: ['alerts:admin']
      },
      'etl-pipeline': {
        requiredLevel: 20,
        readPermissions: ['etl:read'],
        writePermissions: ['etl:write'],
        adminPermissions: ['etl:admin']
      }
    };
  }

  // Get role definition
  getRole(roleName) {
    return this.roles[roleName];
  }

  // Get all permissions for a role (including inherited)
  getRolePermissions(roleName) {
    const role = this.roles[roleName];
    if (!role) return [];

    let permissions = [...role.permissions];

    // Add inherited permissions
    if (role.inherits && role.inherits.length > 0) {
      for (const inheritedRole of role.inherits) {
        const inheritedPermissions = this.getRolePermissions(inheritedRole);
        permissions = [...permissions, ...inheritedPermissions];
      }
    }

    // Remove duplicates
    return [...new Set(permissions)];
  }

  // Check if user has specific permission
  hasPermission(userRole, userPermissions, requiredPermission) {
    // Super admin override
    if (userRole === 'superadmin' || userPermissions.includes('*:*')) {
      return true;
    }

    // Check exact permission
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Check wildcard permissions
    const [resource, action] = requiredPermission.split(':');
    
    // Check resource-level wildcards
    if (userPermissions.includes(`${resource}:*`)) {
      return true;
    }

    // Check action-level wildcards
    if (userPermissions.includes(`*:${action}`)) {
      return true;
    }

    return false;
  }

  // Check if user has minimum role level
  hasMinimumLevel(userLevel, requiredLevel) {
    return userLevel >= requiredLevel;
  }

  // Get required permissions for endpoint
  getEndpointPermissions(method, path) {
    // Map HTTP methods to actions
    const methodActionMap = {
      GET: 'read',
      POST: 'write', 
      PUT: 'write',
      PATCH: 'write',
      DELETE: 'delete'
    };

    const action = methodActionMap[method] || 'read';

    // Determine resource from path
    let resource = null;
    for (const [resourceName, resourceDef] of Object.entries(this.resources)) {
      for (const endpoint of resourceDef.endpoints) {
        const pattern = endpoint.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(path)) {
          resource = resourceName;
          break;
        }
      }
      if (resource) break;
    }

    if (!resource) {
      return null; // Unknown endpoint
    }

    return {
      resource,
      action,
      permission: `${resource}:${action}`,
      requiredLevel: this.getResourceRequiredLevel(resource, action)
    };
  }

  // Get required level for resource and action
  getResourceRequiredLevel(resource, action) {
    const baseLevels = {
      'read': 1,
      'write': 10,
      'delete': 50,
      'admin': 100
    };

    // Special cases for sensitive resources
    const resourceMultipliers = {
      'gateway': 5,
      'registry': 5,
      'etl': 2,
      'alerts': 1.5
    };

    const baseLevel = baseLevels[action] || 1;
    const multiplier = resourceMultipliers[resource] || 1;
    
    return Math.floor(baseLevel * multiplier);
  }

  // Validate role assignment
  canAssignRole(assignerRole, assignerLevel, targetRole) {
    const targetRoleData = this.roles[targetRole];
    if (!targetRoleData) {
      return { allowed: false, reason: 'Invalid target role' };
    }

    // Super admin can assign any role
    if (assignerRole === 'superadmin') {
      return { allowed: true };
    }

    // Can't assign role with higher or equal level
    if (targetRoleData.level >= assignerLevel) {
      return { 
        allowed: false, 
        reason: 'Cannot assign role with higher or equal privilege level' 
      };
    }

    // Admin can assign any role below their level
    if (assignerRole === 'admin' && assignerLevel > targetRoleData.level) {
      return { allowed: true };
    }

    return { 
      allowed: false, 
      reason: 'Insufficient privileges to assign this role' 
    };
  }

  // Get role hierarchy for display
  getRoleHierarchy() {
    const hierarchy = Object.entries(this.roles)
      .map(([name, data]) => ({
        name,
        level: data.level,
        description: data.description,
        permissions: data.permissions.length
      }))
      .sort((a, b) => b.level - a.level);

    return hierarchy;
  }

  // Audit permission check
  auditPermissionCheck(userId, username, role, permissions, requiredPermission, granted) {
    return {
      timestamp: new Date().toISOString(),
      userId,
      username,
      role,
      permissions: permissions.slice(0, 5), // Limit for logging
      requiredPermission,
      granted,
      level: this.roles[role]?.level || 0
    };
  }

  // Generate role-based API key
  generateRoleApiKey(role) {
    const roleData = this.roles[role];
    if (!roleData) {
      throw new Error('Invalid role for API key generation');
    }

    const prefix = this.getRolePrefix(role);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    
    return `${prefix}_${timestamp}_${random}`;
  }

  // Get role prefix for API keys
  getRolePrefix(role) {
    const prefixes = {
      superadmin: 'sa',
      admin: 'ad',
      operator: 'op',
      developer: 'dv',
      analyst: 'an',
      viewer: 'vw',
      guest: 'gt'
    };

    return prefixes[role] || 'uk';
  }
}

module.exports = RBACManager;