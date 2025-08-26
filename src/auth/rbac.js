class RBACService {
    constructor() {
        this.roles = new Map();
        this.permissions = new Map();
        this.userRoles = new Map();
        this.rolePermissions = new Map();
        
        this.initializeDefaultRoles();
        this.initializeDefaultPermissions();
    }

    // 기본 역할 초기화
    initializeDefaultRoles() {
        const defaultRoles = [
            {
                name: 'admin',
                displayName: '관리자',
                description: '시스템 전체 관리 권한',
                level: 100,
                isSystemRole: true
            },
            {
                name: 'manager',
                displayName: '매니저',
                description: '부서/팀 관리 권한',
                level: 80,
                isSystemRole: true
            },
            {
                name: 'analyst',
                displayName: '분석가',
                description: '데이터 분석 및 보고서 생성',
                level: 60,
                isSystemRole: true
            },
            {
                name: 'user',
                displayName: '사용자',
                description: '기본 사용자 권한',
                level: 40,
                isSystemRole: true
            },
            {
                name: 'viewer',
                displayName: '조회자',
                description: '읽기 전용 권한',
                level: 20,
                isSystemRole: true
            },
            {
                name: 'guest',
                displayName: '게스트',
                description: '제한된 조회 권한',
                level: 10,
                isSystemRole: true
            }
        ];

        defaultRoles.forEach(role => {
            this.roles.set(role.name, {
                ...role,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        });
    }

    // 기본 권한 초기화
    initializeDefaultPermissions() {
        const defaultPermissions = [
            // 시스템 관리
            { name: 'system:admin', category: 'system', description: '시스템 관리 권한' },
            { name: 'system:config', category: 'system', description: '시스템 설정 권한' },
            { name: 'system:backup', category: 'system', description: '백업 관리 권한' },
            
            // 사용자 관리
            { name: 'user:create', category: 'user', description: '사용자 생성 권한' },
            { name: 'user:read', category: 'user', description: '사용자 조회 권한' },
            { name: 'user:update', category: 'user', description: '사용자 수정 권한' },
            { name: 'user:delete', category: 'user', description: '사용자 삭제 권한' },
            { name: 'user:manage_roles', category: 'user', description: '사용자 역할 관리 권한' },
            
            // 역할 및 권한 관리
            { name: 'role:create', category: 'role', description: '역할 생성 권한' },
            { name: 'role:read', category: 'role', description: '역할 조회 권한' },
            { name: 'role:update', category: 'role', description: '역할 수정 권한' },
            { name: 'role:delete', category: 'role', description: '역할 삭제 권한' },
            { name: 'role:assign', category: 'role', description: '역할 할당 권한' },
            
            // 모니터링 및 분석
            { name: 'monitor:view', category: 'monitor', description: '모니터링 조회 권한' },
            { name: 'monitor:manage', category: 'monitor', description: '모니터링 관리 권한' },
            { name: 'analytics:view', category: 'analytics', description: '분석 데이터 조회 권한' },
            { name: 'analytics:export', category: 'analytics', description: '분석 데이터 내보내기 권한' },
            
            // 알림 및 경보
            { name: 'alert:view', category: 'alert', description: '알림 조회 권한' },
            { name: 'alert:manage', category: 'alert', description: '알림 관리 권한' },
            { name: 'alert:create', category: 'alert', description: '알림 규칙 생성 권한' },
            
            // 데이터 관리
            { name: 'data:read', category: 'data', description: '데이터 읽기 권한' },
            { name: 'data:write', category: 'data', description: '데이터 쓰기 권한' },
            { name: 'data:delete', category: 'data', description: '데이터 삭제 권한' },
            { name: 'data:export', category: 'data', description: '데이터 내보내기 권한' },
            
            // 보고서
            { name: 'report:view', category: 'report', description: '보고서 조회 권한' },
            { name: 'report:create', category: 'report', description: '보고서 생성 권한' },
            { name: 'report:export', category: 'report', description: '보고서 내보내기 권한' },
            
            // API 접근
            { name: 'api:read', category: 'api', description: 'API 읽기 권한' },
            { name: 'api:write', category: 'api', description: 'API 쓰기 권한' },
            { name: 'api:admin', category: 'api', description: 'API 관리 권한' }
        ];

        defaultPermissions.forEach(permission => {
            this.permissions.set(permission.name, {
                ...permission,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        });

        // 역할별 권한 할당
        this.assignDefaultPermissions();
    }

    // 기본 역할별 권한 할당
    assignDefaultPermissions() {
        // 관리자: 모든 권한
        const adminPermissions = Array.from(this.permissions.keys());
        this.rolePermissions.set('admin', adminPermissions);

        // 매니저: 사용자 관리 + 모니터링 + 분석 + 보고서
        const managerPermissions = [
            'user:read', 'user:update', 'user:manage_roles',
            'role:read', 'role:assign',
            'monitor:view', 'monitor:manage',
            'analytics:view', 'analytics:export',
            'alert:view', 'alert:manage', 'alert:create',
            'data:read', 'data:write', 'data:export',
            'report:view', 'report:create', 'report:export',
            'api:read', 'api:write'
        ];
        this.rolePermissions.set('manager', managerPermissions);

        // 분석가: 데이터 분석 + 보고서 + 모니터링 조회
        const analystPermissions = [
            'monitor:view',
            'analytics:view', 'analytics:export',
            'alert:view',
            'data:read', 'data:export',
            'report:view', 'report:create', 'report:export',
            'api:read'
        ];
        this.rolePermissions.set('analyst', analystPermissions);

        // 사용자: 기본 조회 + 자신의 데이터 관리
        const userPermissions = [
            'monitor:view',
            'analytics:view',
            'alert:view',
            'data:read',
            'report:view',
            'api:read'
        ];
        this.rolePermissions.set('user', userPermissions);

        // 조회자: 읽기 전용
        const viewerPermissions = [
            'monitor:view',
            'analytics:view',
            'data:read',
            'report:view'
        ];
        this.rolePermissions.set('viewer', viewerPermissions);

        // 게스트: 매우 제한적
        const guestPermissions = [
            'monitor:view',
            'report:view'
        ];
        this.rolePermissions.set('guest', guestPermissions);
    }

    // 역할 생성
    createRole({ name, displayName, description, level = 50, permissions = [] }) {
        if (this.roles.has(name)) {
            throw new Error(`Role ${name} already exists`);
        }

        const role = {
            name,
            displayName,
            description,
            level,
            isSystemRole: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.roles.set(name, role);
        this.rolePermissions.set(name, permissions);

        return role;
    }

    // 권한 생성
    createPermission({ name, category, description }) {
        if (this.permissions.has(name)) {
            throw new Error(`Permission ${name} already exists`);
        }

        const permission = {
            name,
            category,
            description,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.permissions.set(name, permission);
        return permission;
    }

    // 사용자에게 역할 할당
    assignRoleToUser(userId, roleName) {
        if (!this.roles.has(roleName)) {
            throw new Error(`Role ${roleName} does not exist`);
        }

        let userRoleList = this.userRoles.get(userId) || [];
        if (!userRoleList.includes(roleName)) {
            userRoleList.push(roleName);
            this.userRoles.set(userId, userRoleList);
        }

        return true;
    }

    // 사용자에서 역할 제거
    removeRoleFromUser(userId, roleName) {
        let userRoleList = this.userRoles.get(userId) || [];
        userRoleList = userRoleList.filter(role => role !== roleName);
        this.userRoles.set(userId, userRoleList);

        return true;
    }

    // 역할에 권한 추가
    addPermissionToRole(roleName, permissionName) {
        if (!this.roles.has(roleName)) {
            throw new Error(`Role ${roleName} does not exist`);
        }

        if (!this.permissions.has(permissionName)) {
            throw new Error(`Permission ${permissionName} does not exist`);
        }

        let rolePermissionList = this.rolePermissions.get(roleName) || [];
        if (!rolePermissionList.includes(permissionName)) {
            rolePermissionList.push(permissionName);
            this.rolePermissions.set(roleName, rolePermissionList);
        }

        return true;
    }

    // 역할에서 권한 제거
    removePermissionFromRole(roleName, permissionName) {
        let rolePermissionList = this.rolePermissions.get(roleName) || [];
        rolePermissionList = rolePermissionList.filter(perm => perm !== permissionName);
        this.rolePermissions.set(roleName, rolePermissionList);

        return true;
    }

    // 사용자 권한 확인
    hasPermission(userId, permissionName) {
        const userRoleList = this.userRoles.get(userId) || [];
        
        for (const roleName of userRoleList) {
            const rolePermissions = this.rolePermissions.get(roleName) || [];
            if (rolePermissions.includes(permissionName) || rolePermissions.includes('*')) {
                return true;
            }
        }

        return false;
    }

    // 사용자 역할 확인
    hasRole(userId, roleName) {
        const userRoleList = this.userRoles.get(userId) || [];
        return userRoleList.includes(roleName);
    }

    // 사용자의 모든 권한 조회
    getUserPermissions(userId) {
        const userRoleList = this.userRoles.get(userId) || [];
        const allPermissions = new Set();

        for (const roleName of userRoleList) {
            const rolePermissions = this.rolePermissions.get(roleName) || [];
            rolePermissions.forEach(perm => allPermissions.add(perm));
        }

        return Array.from(allPermissions);
    }

    // 사용자 역할 조회
    getUserRoles(userId) {
        return this.userRoles.get(userId) || [];
    }

    // 역할 정보 조회
    getRole(roleName) {
        return this.roles.get(roleName);
    }

    // 모든 역할 조회
    getAllRoles() {
        return Array.from(this.roles.values());
    }

    // 권한 정보 조회
    getPermission(permissionName) {
        return this.permissions.get(permissionName);
    }

    // 모든 권한 조회
    getAllPermissions() {
        return Array.from(this.permissions.values());
    }

    // 카테고리별 권한 조회
    getPermissionsByCategory(category) {
        return Array.from(this.permissions.values()).filter(perm => perm.category === category);
    }

    // 역할의 권한 조회
    getRolePermissions(roleName) {
        const permissionNames = this.rolePermissions.get(roleName) || [];
        return permissionNames.map(name => this.permissions.get(name)).filter(Boolean);
    }

    // 역할 수정
    updateRole(roleName, updates) {
        const role = this.roles.get(roleName);
        if (!role) {
            throw new Error(`Role ${roleName} does not exist`);
        }

        if (role.isSystemRole && (updates.name || updates.level !== undefined)) {
            throw new Error('Cannot modify system role name or level');
        }

        const updatedRole = {
            ...role,
            ...updates,
            updatedAt: new Date()
        };

        this.roles.set(roleName, updatedRole);
        return updatedRole;
    }

    // 역할 삭제
    deleteRole(roleName) {
        const role = this.roles.get(roleName);
        if (!role) {
            throw new Error(`Role ${roleName} does not exist`);
        }

        if (role.isSystemRole) {
            throw new Error('Cannot delete system role');
        }

        // 사용자들에서 해당 역할 제거
        for (const [userId, userRoleList] of this.userRoles.entries()) {
            const filteredRoles = userRoleList.filter(role => role !== roleName);
            this.userRoles.set(userId, filteredRoles);
        }

        // 역할 및 권한 관계 제거
        this.roles.delete(roleName);
        this.rolePermissions.delete(roleName);

        return true;
    }

    // 계층적 권한 확인 (상위 역할이 하위 역할의 권한을 포함)
    hasHierarchicalPermission(userId, permissionName, targetUserId = null) {
        const userRoleList = this.userRoles.get(userId) || [];
        const userMaxLevel = Math.max(0, ...userRoleList.map(roleName => {
            const role = this.roles.get(roleName);
            return role ? role.level : 0;
        }));

        // 직접 권한 확인
        if (this.hasPermission(userId, permissionName)) {
            // 대상 사용자가 있는 경우 레벨 확인
            if (targetUserId) {
                const targetRoleList = this.userRoles.get(targetUserId) || [];
                const targetMaxLevel = Math.max(0, ...targetRoleList.map(roleName => {
                    const role = this.roles.get(roleName);
                    return role ? role.level : 0;
                }));

                return userMaxLevel >= targetMaxLevel;
            }
            return true;
        }

        return false;
    }

    // 통계 정보
    getStatistics() {
        const roleStats = {};
        for (const [roleName, role] of this.roles.entries()) {
            const userCount = Array.from(this.userRoles.values())
                .filter(userRoleList => userRoleList.includes(roleName)).length;
            
            roleStats[roleName] = {
                ...role,
                userCount,
                permissionCount: (this.rolePermissions.get(roleName) || []).length
            };
        }

        return {
            totalRoles: this.roles.size,
            totalPermissions: this.permissions.size,
            totalUsers: this.userRoles.size,
            roleStatistics: roleStats
        };
    }

    // 권한 매트릭스 생성
    generatePermissionMatrix() {
        const matrix = {};
        
        for (const [roleName] of this.roles.entries()) {
            matrix[roleName] = {};
            const rolePermissions = this.rolePermissions.get(roleName) || [];
            
            for (const [permissionName] of this.permissions.entries()) {
                matrix[roleName][permissionName] = rolePermissions.includes(permissionName);
            }
        }

        return matrix;
    }
}

module.exports = RBACService;