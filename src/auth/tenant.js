const crypto = require('crypto');

class MultiTenantService {
    constructor() {
        this.tenants = new Map();
        this.userTenants = new Map();
        this.tenantConfigurations = new Map();
        this.tenantResources = new Map();
        
        this.initializeDefaultTenant();
    }

    // 기본 테넌트 초기화
    initializeDefaultTenant() {
        const defaultTenant = {
            id: 'default',
            name: 'AIRIS EPM',
            displayName: 'AIRIS EPM Default',
            domain: 'default.airis.com',
            subdomain: 'default',
            status: 'active',
            plan: 'enterprise',
            maxUsers: 1000,
            maxStorage: 100 * 1024 * 1024 * 1024, // 100GB
            features: [
                'monitoring',
                'analytics',
                'alerts',
                'reports',
                'api_access',
                'sso',
                'custom_branding'
            ],
            settings: {
                timezone: 'Asia/Seoul',
                language: 'ko',
                dateFormat: 'YYYY-MM-DD',
                currency: 'KRW',
                retentionDays: 90
            },
            billing: {
                plan: 'enterprise',
                status: 'active',
                nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                monthlyLimit: 100000 // API 호출 제한
            },
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date()
        };

        this.tenants.set('default', defaultTenant);
        this.tenantConfigurations.set('default', this.getDefaultConfiguration());
        this.tenantResources.set('default', {
            usedStorage: 0,
            userCount: 0,
            apiCallsThisMonth: 0,
            lastActive: new Date()
        });
    }

    // 기본 테넌트 구성 반환
    getDefaultConfiguration() {
        return {
            database: {
                connectionString: process.env.DEFAULT_DB_URL || 'postgresql://localhost/airis_default',
                maxConnections: 10,
                ssl: true
            },
            storage: {
                provider: 's3',
                bucket: 'airis-default-storage',
                region: 'ap-northeast-2'
            },
            monitoring: {
                enabled: true,
                metricsRetention: 90,
                logsRetention: 30
            },
            security: {
                passwordPolicy: {
                    minLength: 8,
                    requireUppercase: true,
                    requireNumbers: true,
                    requireSymbols: true
                },
                sessionTimeout: 8 * 60 * 60 * 1000, // 8시간
                maxLoginAttempts: 5,
                lockoutDuration: 15 * 60 * 1000 // 15분
            },
            notifications: {
                email: true,
                slack: false,
                webhook: true,
                sms: false
            }
        };
    }

    // 새 테넌트 생성
    createTenant({
        name,
        displayName,
        domain,
        plan = 'basic',
        adminEmail,
        adminPassword,
        settings = {}
    }) {
        const tenantId = crypto.randomUUID();
        const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        // 도메인 중복 확인
        for (const tenant of this.tenants.values()) {
            if (tenant.domain === domain || tenant.subdomain === subdomain) {
                throw new Error('Domain or subdomain already exists');
            }
        }

        const planLimits = this.getPlanLimits(plan);

        const tenant = {
            id: tenantId,
            name,
            displayName,
            domain,
            subdomain,
            status: 'active',
            plan,
            maxUsers: planLimits.maxUsers,
            maxStorage: planLimits.maxStorage,
            features: planLimits.features,
            settings: {
                timezone: 'Asia/Seoul',
                language: 'ko',
                dateFormat: 'YYYY-MM-DD',
                currency: 'KRW',
                retentionDays: planLimits.retentionDays,
                ...settings
            },
            billing: {
                plan,
                status: 'trial', // 신규 테넌트는 트라이얼부터
                trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일 트라이얼
                nextBillingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                monthlyLimit: planLimits.monthlyLimit
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // 테넌트 저장
        this.tenants.set(tenantId, tenant);
        
        // 테넌트별 구성 생성
        this.tenantConfigurations.set(tenantId, {
            ...this.getDefaultConfiguration(),
            database: {
                ...this.getDefaultConfiguration().database,
                connectionString: `postgresql://localhost/airis_${tenantId.replace('-', '')}`
            },
            storage: {
                ...this.getDefaultConfiguration().storage,
                bucket: `airis-${tenantId}-storage`
            }
        });

        // 리소스 사용량 초기화
        this.tenantResources.set(tenantId, {
            usedStorage: 0,
            userCount: 1, // 관리자 계정
            apiCallsThisMonth: 0,
            lastActive: new Date()
        });

        return tenant;
    }

    // 요금제별 제한사항
    getPlanLimits(plan) {
        const plans = {
            basic: {
                maxUsers: 10,
                maxStorage: 1 * 1024 * 1024 * 1024, // 1GB
                monthlyLimit: 1000,
                retentionDays: 7,
                features: ['monitoring', 'basic_alerts']
            },
            professional: {
                maxUsers: 50,
                maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
                monthlyLimit: 10000,
                retentionDays: 30,
                features: ['monitoring', 'analytics', 'alerts', 'reports', 'api_access']
            },
            enterprise: {
                maxUsers: 1000,
                maxStorage: 100 * 1024 * 1024 * 1024, // 100GB
                monthlyLimit: 100000,
                retentionDays: 90,
                features: [
                    'monitoring', 'analytics', 'alerts', 'reports', 
                    'api_access', 'sso', 'custom_branding', 'advanced_security'
                ]
            }
        };

        return plans[plan] || plans.basic;
    }

    // 테넌트 정보 조회
    getTenant(tenantId) {
        return this.tenants.get(tenantId);
    }

    // 도메인으로 테넌트 조회
    getTenantByDomain(domain) {
        for (const tenant of this.tenants.values()) {
            if (tenant.domain === domain || tenant.subdomain === domain) {
                return tenant;
            }
        }
        return null;
    }

    // 테넌트 업데이트
    updateTenant(tenantId, updates) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        const updatedTenant = {
            ...tenant,
            ...updates,
            updatedAt: new Date()
        };

        this.tenants.set(tenantId, updatedTenant);
        return updatedTenant;
    }

    // 테넌트 비활성화
    deactivateTenant(tenantId) {
        return this.updateTenant(tenantId, { status: 'inactive' });
    }

    // 테넌트 활성화
    activateTenant(tenantId) {
        return this.updateTenant(tenantId, { status: 'active' });
    }

    // 사용자를 테넌트에 할당
    assignUserToTenant(userId, tenantId) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        if (tenant.status !== 'active') {
            throw new Error('Cannot assign user to inactive tenant');
        }

        // 현재 사용자 수 확인
        const resources = this.tenantResources.get(tenantId);
        if (resources.userCount >= tenant.maxUsers) {
            throw new Error('Tenant user limit exceeded');
        }

        this.userTenants.set(userId, tenantId);
        
        // 사용자 수 증가
        resources.userCount++;
        this.tenantResources.set(tenantId, resources);

        return true;
    }

    // 사용자의 테넌트 조회
    getUserTenant(userId) {
        const tenantId = this.userTenants.get(userId);
        return tenantId ? this.tenants.get(tenantId) : null;
    }

    // 테넌트의 사용자들 조회
    getTenantUsers(tenantId) {
        const users = [];
        for (const [userId, userTenantId] of this.userTenants.entries()) {
            if (userTenantId === tenantId) {
                users.push(userId);
            }
        }
        return users;
    }

    // 테넌트 구성 조회
    getTenantConfiguration(tenantId) {
        return this.tenantConfigurations.get(tenantId);
    }

    // 테넌트 구성 업데이트
    updateTenantConfiguration(tenantId, configuration) {
        const currentConfig = this.tenantConfigurations.get(tenantId);
        if (!currentConfig) {
            throw new Error('Tenant configuration not found');
        }

        const updatedConfig = {
            ...currentConfig,
            ...configuration,
            updatedAt: new Date()
        };

        this.tenantConfigurations.set(tenantId, updatedConfig);
        return updatedConfig;
    }

    // 리소스 사용량 업데이트
    updateResourceUsage(tenantId, usage) {
        const resources = this.tenantResources.get(tenantId);
        if (!resources) {
            throw new Error('Tenant resources not found');
        }

        const updatedResources = {
            ...resources,
            ...usage,
            lastActive: new Date()
        };

        this.tenantResources.set(tenantId, updatedResources);
        return updatedResources;
    }

    // 테넌트 리소스 사용량 조회
    getTenantResources(tenantId) {
        return this.tenantResources.get(tenantId);
    }

    // API 호출 제한 확인
    checkApiLimit(tenantId) {
        const tenant = this.tenants.get(tenantId);
        const resources = this.tenantResources.get(tenantId);
        
        if (!tenant || !resources) {
            throw new Error('Tenant not found');
        }

        return resources.apiCallsThisMonth < tenant.billing.monthlyLimit;
    }

    // API 호출 수 증가
    incrementApiCalls(tenantId) {
        const resources = this.tenantResources.get(tenantId);
        if (resources) {
            resources.apiCallsThisMonth++;
            resources.lastActive = new Date();
            this.tenantResources.set(tenantId, resources);
        }
    }

    // 스토리지 제한 확인
    checkStorageLimit(tenantId, additionalSize = 0) {
        const tenant = this.tenants.get(tenantId);
        const resources = this.tenantResources.get(tenantId);
        
        if (!tenant || !resources) {
            throw new Error('Tenant not found');
        }

        return (resources.usedStorage + additionalSize) <= tenant.maxStorage;
    }

    // 기능 사용 가능 여부 확인
    hasFeature(tenantId, featureName) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
            return false;
        }

        return tenant.features.includes(featureName);
    }

    // 테넌트 통계
    getTenantStatistics(tenantId) {
        const tenant = this.tenants.get(tenantId);
        const resources = this.tenantResources.get(tenantId);
        
        if (!tenant || !resources) {
            throw new Error('Tenant not found');
        }

        return {
            id: tenant.id,
            name: tenant.name,
            status: tenant.status,
            plan: tenant.plan,
            usage: {
                users: {
                    current: resources.userCount,
                    limit: tenant.maxUsers,
                    percentage: Math.round((resources.userCount / tenant.maxUsers) * 100)
                },
                storage: {
                    current: resources.usedStorage,
                    limit: tenant.maxStorage,
                    percentage: Math.round((resources.usedStorage / tenant.maxStorage) * 100)
                },
                apiCalls: {
                    current: resources.apiCallsThisMonth,
                    limit: tenant.billing.monthlyLimit,
                    percentage: Math.round((resources.apiCallsThisMonth / tenant.billing.monthlyLimit) * 100)
                }
            },
            billing: tenant.billing,
            lastActive: resources.lastActive,
            createdAt: tenant.createdAt
        };
    }

    // 모든 테넌트 조회
    getAllTenants() {
        return Array.from(this.tenants.values());
    }

    // 활성 테넌트만 조회
    getActiveTenants() {
        return Array.from(this.tenants.values()).filter(tenant => tenant.status === 'active');
    }

    // 테넌트 삭제 (소프트 삭제)
    deleteTenant(tenantId) {
        return this.updateTenant(tenantId, { 
            status: 'deleted',
            deletedAt: new Date()
        });
    }

    // 테넌트 완전 삭제 (하드 삭제)
    permanentlyDeleteTenant(tenantId) {
        // 사용자 할당 해제
        for (const [userId, userTenantId] of this.userTenants.entries()) {
            if (userTenantId === tenantId) {
                this.userTenants.delete(userId);
            }
        }

        // 테넌트 관련 데이터 삭제
        this.tenants.delete(tenantId);
        this.tenantConfigurations.delete(tenantId);
        this.tenantResources.delete(tenantId);

        return true;
    }

    // 월별 API 호출 수 초기화 (매월 실행)
    resetMonthlyApiCalls() {
        for (const [tenantId, resources] of this.tenantResources.entries()) {
            resources.apiCallsThisMonth = 0;
            this.tenantResources.set(tenantId, resources);
        }
    }

    // 테넌트 격리 미들웨어용 헬퍼
    extractTenantFromRequest(req) {
        // 1. 헤더에서 테넌트 ID 추출
        const tenantHeader = req.headers['x-tenant-id'];
        if (tenantHeader) {
            return tenantHeader;
        }

        // 2. 서브도메인에서 추출
        const host = req.headers.host;
        if (host) {
            const subdomain = host.split('.')[0];
            const tenant = this.getTenantByDomain(subdomain);
            if (tenant) {
                return tenant.id;
            }
        }

        // 3. JWT 토큰에서 추출 (이미 파싱된 경우)
        if (req.user && req.user.tenantId) {
            return req.user.tenantId;
        }

        // 4. 기본 테넌트 반환
        return 'default';
    }

    // 전체 시스템 통계
    getSystemStatistics() {
        const stats = {
            totalTenants: this.tenants.size,
            activeTenants: 0,
            inactiveTenants: 0,
            deletedTenants: 0,
            totalUsers: this.userTenants.size,
            totalStorage: 0,
            totalApiCalls: 0,
            planDistribution: {}
        };

        for (const tenant of this.tenants.values()) {
            if (tenant.status === 'active') stats.activeTenants++;
            else if (tenant.status === 'inactive') stats.inactiveTenants++;
            else if (tenant.status === 'deleted') stats.deletedTenants++;

            stats.planDistribution[tenant.plan] = (stats.planDistribution[tenant.plan] || 0) + 1;

            const resources = this.tenantResources.get(tenant.id);
            if (resources) {
                stats.totalStorage += resources.usedStorage;
                stats.totalApiCalls += resources.apiCallsThisMonth;
            }
        }

        return stats;
    }
}

module.exports = MultiTenantService;