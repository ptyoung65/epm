/**
 * 관리자 모니터링 서비스
 * OpenReplay 시스템 상태 모니터링 및 관리자 기능 제공
 */

import { EventEmitter } from 'events';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';
import { RedisService } from './RedisService';
import axios from 'axios';

export interface SystemHealth {
    status: 'healthy' | 'warning' | 'critical';
    components: {
        openreplay: ComponentStatus;
        database: ComponentStatus;
        redis: ComponentStatus;
        storage: ComponentStatus;
        services: ComponentStatus[];
    };
    metrics: SystemMetrics;
    alerts: Alert[];
    lastCheck: Date;
}

export interface ComponentStatus {
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime: number;
    uptime: number;
    lastError?: string;
    version?: string;
    metadata?: any;
}

export interface SystemMetrics {
    sessions: {
        total: number;
        active: number;
        completed: number;
        failed: number;
        avgDuration: number;
    };
    errors: {
        total: number;
        rate: number;
        criticalErrors: number;
    };
    performance: {
        cpuUsage: number;
        memoryUsage: number;
        diskUsage: number;
        networkIO: number;
    };
    users: {
        totalUsers: number;
        activeUsers: number;
        newUsers: number;
    };
    projects: {
        totalProjects: number;
        activeProjects: number;
    };
    storage: {
        usedSpace: number;
        totalSpace: number;
        compressionRatio: number;
    };
}

export interface Alert {
    id: string;
    type: 'error' | 'warning' | 'info' | 'critical';
    title: string;
    message: string;
    component: string;
    timestamp: Date;
    acknowledged: boolean;
    resolved: boolean;
    metadata?: any;
}

export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'admin' | 'viewer';
    permissions: string[];
    lastLogin: Date;
    isActive: boolean;
    createdAt: Date;
}

export interface ProjectInfo {
    id: string;
    name: string;
    description: string;
    owner: string;
    createdAt: Date;
    lastActivity: Date;
    status: 'active' | 'inactive' | 'archived';
    settings: {
        sessionRetention: number;
        recordingEnabled: boolean;
        errorTracking: boolean;
        performanceMonitoring: boolean;
    };
    stats: {
        totalSessions: number;
        totalUsers: number;
        totalErrors: number;
        avgSessionDuration: number;
    };
}

export class AdminMonitoringService extends EventEmitter {
    private dbService: DatabaseService;
    private redisService: RedisService;
    private initialized: boolean = false;
    private healthCheckInterval?: NodeJS.Timeout;
    private metricsCollectionInterval?: NodeJS.Timeout;
    private currentSystemHealth?: SystemHealth;

    constructor() {
        super();
        this.dbService = new DatabaseService();
        this.redisService = new RedisService();
    }

    public async initialize(): Promise<void> {
        try {
            // 관리자 데이터베이스 스키마 초기화
            await this.initializeDatabase();
            
            // 시스템 헬스 체크 시작
            await this.startHealthChecks();
            
            // 메트릭 수집 시작
            this.startMetricsCollection();
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            this.initialized = true;
            logger.info('AdminMonitoringService initialized successfully');
            
            this.emit('initialized');
            
        } catch (error) {
            logger.error('Failed to initialize AdminMonitoringService:', error);
            throw error;
        }
    }

    private async initializeDatabase(): Promise<void> {
        // 관리자 사용자 테이블
        const createAdminUsersTable = `
            CREATE TABLE IF NOT EXISTS admin_users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'viewer',
                permissions JSONB DEFAULT '[]',
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 프로젝트 테이블
        const createProjectsTable = `
            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                owner_id UUID REFERENCES admin_users(id),
                status VARCHAR(50) DEFAULT 'active',
                settings JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 시스템 메트릭 테이블
        const createSystemMetricsTable = `
            CREATE TABLE IF NOT EXISTS system_metrics (
                id BIGSERIAL PRIMARY KEY,
                metric_type VARCHAR(100) NOT NULL,
                metric_name VARCHAR(200) NOT NULL,
                metric_value DECIMAL(15,2) NOT NULL,
                labels JSONB,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_system_metrics_type_time (metric_type, timestamp),
                INDEX idx_system_metrics_name_time (metric_name, timestamp)
            );
        `;

        // 알림 테이블
        const createAlertsTable = `
            CREATE TABLE IF NOT EXISTS alerts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                component VARCHAR(100) NOT NULL,
                severity VARCHAR(20) DEFAULT 'info',
                acknowledged BOOLEAN DEFAULT false,
                acknowledged_by UUID REFERENCES admin_users(id),
                acknowledged_at TIMESTAMP WITH TIME ZONE,
                resolved BOOLEAN DEFAULT false,
                resolved_by UUID REFERENCES admin_users(id),
                resolved_at TIMESTAMP WITH TIME ZONE,
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_alerts_type_time (type, created_at),
                INDEX idx_alerts_component (component),
                INDEX idx_alerts_resolved (resolved, created_at)
            );
        `;

        // 감사 로그 테이블
        const createAuditLogsTable = `
            CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGSERIAL PRIMARY KEY,
                user_id UUID REFERENCES admin_users(id),
                action VARCHAR(100) NOT NULL,
                resource_type VARCHAR(100) NOT NULL,
                resource_id VARCHAR(255),
                details JSONB,
                ip_address INET,
                user_agent TEXT,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_logs_user_time (user_id, timestamp),
                INDEX idx_audit_logs_action_time (action, timestamp)
            );
        `;

        await this.dbService.query(createAdminUsersTable);
        await this.dbService.query(createProjectsTable);
        await this.dbService.query(createSystemMetricsTable);
        await this.dbService.query(createAlertsTable);
        await this.dbService.query(createAuditLogsTable);

        // 기본 관리자 사용자 생성 (환경변수로 설정된 경우)
        await this.createDefaultAdminUser();
        
        logger.info('Admin monitoring database tables initialized');
    }

    private async createDefaultAdminUser(): Promise<void> {
        if (!config.admin.email || !config.admin.password) {
            return;
        }

        try {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(config.admin.password, 12);

            const query = `
                INSERT INTO admin_users (email, name, password_hash, role, permissions)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (email) DO NOTHING;
            `;

            const permissions = [
                'sessions:read', 'sessions:write', 'sessions:delete',
                'projects:read', 'projects:write', 'projects:delete',
                'users:read', 'users:write', 'users:delete',
                'system:monitor', 'system:configure',
                'alerts:read', 'alerts:acknowledge', 'alerts:resolve'
            ];

            await this.dbService.query(query, [
                config.admin.email,
                'System Administrator',
                hashedPassword,
                'super_admin',
                JSON.stringify(permissions)
            ]);

            logger.info('Default admin user created/updated');

        } catch (error) {
            logger.error('Failed to create default admin user:', error);
        }
    }

    private setupEventListeners(): void {
        this.on('alertCreated', this.handleAlertCreated.bind(this));
        this.on('systemCritical', this.handleSystemCritical.bind(this));
        this.on('performanceDegraded', this.handlePerformanceDegraded.bind(this));
    }

    /**
     * 시스템 헬스 체크 시작
     */
    private async startHealthChecks(): Promise<void> {
        // 즉시 한 번 실행
        await this.performHealthCheck();

        // 주기적 헬스 체크 (5분마다)
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                logger.error('Health check failed:', error);
            }
        }, 5 * 60 * 1000);

        logger.info('Health checks started (5min interval)');
    }

    public async performHealthCheck(): Promise<SystemHealth> {
        try {
            const health: SystemHealth = {
                status: 'healthy',
                components: {
                    openreplay: await this.checkOpenReplayHealth(),
                    database: await this.checkDatabaseHealth(),
                    redis: await this.checkRedisHealth(),
                    storage: await this.checkStorageHealth(),
                    services: await this.checkServicesHealth(),
                },
                metrics: await this.getCurrentMetrics(),
                alerts: await this.getActiveAlerts(),
                lastCheck: new Date(),
            };

            // 전체 시스템 상태 결정
            health.status = this.determineOverallStatus(health.components);

            // Redis에 캐시
            await this.redisService.setex(
                'system:health',
                300, // 5분
                JSON.stringify(health)
            );

            this.currentSystemHealth = health;
            this.emit('healthCheckCompleted', health);

            return health;

        } catch (error) {
            logger.error('Health check failed:', error);
            throw error;
        }
    }

    private async checkOpenReplayHealth(): Promise<ComponentStatus> {
        const start = Date.now();
        
        try {
            const response = await axios.get(`${config.openreplay.frontendUrl}/health`, {
                timeout: 5000
            });

            return {
                name: 'OpenReplay Frontend',
                status: response.status === 200 ? 'up' : 'degraded',
                responseTime: Date.now() - start,
                uptime: 0, // TODO: 실제 uptime 계산
                version: response.data?.version,
                metadata: response.data,
            };

        } catch (error) {
            logger.warn('OpenReplay health check failed:', error);
            return {
                name: 'OpenReplay Frontend',
                status: 'down',
                responseTime: Date.now() - start,
                uptime: 0,
                lastError: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    private async checkDatabaseHealth(): Promise<ComponentStatus> {
        const start = Date.now();
        
        try {
            await this.dbService.query('SELECT 1');
            
            return {
                name: 'PostgreSQL Database',
                status: 'up',
                responseTime: Date.now() - start,
                uptime: 0, // TODO: 실제 uptime 계산
            };

        } catch (error) {
            logger.warn('Database health check failed:', error);
            return {
                name: 'PostgreSQL Database',
                status: 'down',
                responseTime: Date.now() - start,
                uptime: 0,
                lastError: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    private async checkRedisHealth(): Promise<ComponentStatus> {
        const start = Date.now();
        
        try {
            await this.redisService.ping();
            
            return {
                name: 'Redis Cache',
                status: 'up',
                responseTime: Date.now() - start,
                uptime: 0, // TODO: 실제 uptime 계산
            };

        } catch (error) {
            logger.warn('Redis health check failed:', error);
            return {
                name: 'Redis Cache',
                status: 'down',
                responseTime: Date.now() - start,
                uptime: 0,
                lastError: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    private async checkStorageHealth(): Promise<ComponentStatus> {
        const start = Date.now();
        
        try {
            // MinIO 헬스 체크 (개발환경에서는 모킹)
            const response = await axios.get(`${config.storage.minioEndpoint}/minio/health/live`, {
                timeout: 5000
            });

            return {
                name: 'MinIO Storage',
                status: response.status === 200 ? 'up' : 'degraded',
                responseTime: Date.now() - start,
                uptime: 0,
            };

        } catch (error) {
            // 개발환경에서는 스토리지 오류를 경고로만 처리
            return {
                name: 'MinIO Storage',
                status: config.env === 'development' ? 'degraded' : 'down',
                responseTime: Date.now() - start,
                uptime: 0,
                lastError: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    private async checkServicesHealth(): Promise<ComponentStatus[]> {
        const services = [
            { name: 'Chalice API', url: `${config.openreplay.apiUrl}/health` },
            { name: 'HTTP Service', url: 'http://openreplay-http:9000/health' },
            { name: 'Sink Service', url: 'http://openreplay-sink:8080/health' },
        ];

        const results: ComponentStatus[] = [];

        for (const service of services) {
            const start = Date.now();
            
            try {
                const response = await axios.get(service.url, { timeout: 5000 });
                
                results.push({
                    name: service.name,
                    status: response.status === 200 ? 'up' : 'degraded',
                    responseTime: Date.now() - start,
                    uptime: 0,
                    metadata: response.data,
                });

            } catch (error) {
                results.push({
                    name: service.name,
                    status: 'down',
                    responseTime: Date.now() - start,
                    uptime: 0,
                    lastError: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return results;
    }

    private determineOverallStatus(components: SystemHealth['components']): 'healthy' | 'warning' | 'critical' {
        const allComponents = [
            components.openreplay,
            components.database,
            components.redis,
            components.storage,
            ...components.services
        ];

        const downComponents = allComponents.filter(c => c.status === 'down').length;
        const degradedComponents = allComponents.filter(c => c.status === 'degraded').length;

        if (downComponents > 0) {
            return downComponents >= 2 ? 'critical' : 'warning';
        }

        if (degradedComponents > 2) {
            return 'warning';
        }

        return 'healthy';
    }

    /**
     * 메트릭 수집 시작
     */
    private startMetricsCollection(): void {
        // 즉시 한 번 실행
        this.collectMetrics();

        // 주기적 메트릭 수집 (1분마다)
        this.metricsCollectionInterval = setInterval(async () => {
            try {
                await this.collectMetrics();
            } catch (error) {
                logger.error('Metrics collection failed:', error);
            }
        }, 60 * 1000);

        logger.info('Metrics collection started (1min interval)');
    }

    private async collectMetrics(): Promise<void> {
        try {
            const metrics = await this.getCurrentMetrics();
            
            // 메트릭을 데이터베이스에 저장
            await this.saveMetrics(metrics);
            
            // Redis에 최신 메트릭 캐시
            await this.redisService.setex(
                'system:metrics',
                120, // 2분
                JSON.stringify(metrics)
            );

            this.emit('metricsCollected', metrics);

        } catch (error) {
            logger.error('Failed to collect metrics:', error);
        }
    }

    private async getCurrentMetrics(): Promise<SystemMetrics> {
        try {
            // 세션 메트릭
            const sessionStats = await this.getSessionMetrics();
            
            // 에러 메트릭
            const errorStats = await this.getErrorMetrics();
            
            // 사용자 메트릭
            const userStats = await this.getUserMetrics();
            
            // 프로젝트 메트릭
            const projectStats = await this.getProjectMetrics();
            
            // 시스템 성능 메트릭 (모킹 - 실제 구현시 시스템 정보 수집)
            const performanceStats = {
                cpuUsage: Math.random() * 100,
                memoryUsage: Math.random() * 100,
                diskUsage: Math.random() * 100,
                networkIO: Math.random() * 1000,
            };
            
            // 스토리지 메트릭 (모킹)
            const storageStats = {
                usedSpace: Math.random() * 1000000000, // bytes
                totalSpace: 1000000000, // bytes
                compressionRatio: 0.7,
            };

            return {
                sessions: sessionStats,
                errors: errorStats,
                performance: performanceStats,
                users: userStats,
                projects: projectStats,
                storage: storageStats,
            };

        } catch (error) {
            logger.error('Failed to get current metrics:', error);
            throw error;
        }
    }

    private async getSessionMetrics(): Promise<SystemMetrics['sessions']> {
        const query = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
                AVG(duration) as avg_duration
            FROM sessions
            WHERE start_time > NOW() - INTERVAL '24 hours'
        `;

        const result = await this.dbService.query(query);
        const row = result.rows[0];

        return {
            total: parseInt(row.total) || 0,
            active: parseInt(row.active) || 0,
            completed: parseInt(row.completed) || 0,
            failed: parseInt(row.failed) || 0,
            avgDuration: parseFloat(row.avg_duration) || 0,
        };
    }

    private async getErrorMetrics(): Promise<SystemMetrics['errors']> {
        const query = `
            SELECT 
                COUNT(*) as total_errors,
                COUNT(*)::float / NULLIF(
                    (SELECT COUNT(*) FROM sessions WHERE start_time > NOW() - INTERVAL '24 hours'), 0
                ) as error_rate,
                COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_errors
            FROM session_errors
            WHERE timestamp > NOW() - INTERVAL '24 hours'
        `;

        const result = await this.dbService.query(query);
        const row = result.rows[0];

        return {
            total: parseInt(row.total_errors) || 0,
            rate: parseFloat(row.error_rate) || 0,
            criticalErrors: parseInt(row.critical_errors) || 0,
        };
    }

    private async getUserMetrics(): Promise<SystemMetrics['users']> {
        const query = `
            SELECT 
                COUNT(DISTINCT user_id) as total_users,
                COUNT(DISTINCT CASE WHEN start_time > NOW() - INTERVAL '24 hours' THEN user_id END) as active_users,
                COUNT(DISTINCT CASE WHEN start_time > NOW() - INTERVAL '24 hours' 
                    AND NOT EXISTS (
                        SELECT 1 FROM sessions s2 
                        WHERE s2.user_id = sessions.user_id 
                        AND s2.start_time < NOW() - INTERVAL '24 hours'
                    ) THEN user_id END) as new_users
            FROM sessions
            WHERE user_id IS NOT NULL
        `;

        const result = await this.dbService.query(query);
        const row = result.rows[0];

        return {
            totalUsers: parseInt(row.total_users) || 0,
            activeUsers: parseInt(row.active_users) || 0,
            newUsers: parseInt(row.new_users) || 0,
        };
    }

    private async getProjectMetrics(): Promise<SystemMetrics['projects']> {
        const query = `
            SELECT 
                COUNT(*) as total_projects,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects
            FROM projects
        `;

        const result = await this.dbService.query(query);
        const row = result.rows[0];

        return {
            totalProjects: parseInt(row.total_projects) || 0,
            activeProjects: parseInt(row.active_projects) || 0,
        };
    }

    private async saveMetrics(metrics: SystemMetrics): Promise<void> {
        const timestamp = new Date();
        const queries: Promise<any>[] = [];

        // 세션 메트릭 저장
        queries.push(this.saveMetric('sessions', 'total', metrics.sessions.total, timestamp));
        queries.push(this.saveMetric('sessions', 'active', metrics.sessions.active, timestamp));
        queries.push(this.saveMetric('sessions', 'avg_duration', metrics.sessions.avgDuration, timestamp));

        // 에러 메트릭 저장
        queries.push(this.saveMetric('errors', 'total', metrics.errors.total, timestamp));
        queries.push(this.saveMetric('errors', 'rate', metrics.errors.rate, timestamp));
        queries.push(this.saveMetric('errors', 'critical', metrics.errors.criticalErrors, timestamp));

        // 성능 메트릭 저장
        queries.push(this.saveMetric('performance', 'cpu_usage', metrics.performance.cpuUsage, timestamp));
        queries.push(this.saveMetric('performance', 'memory_usage', metrics.performance.memoryUsage, timestamp));
        queries.push(this.saveMetric('performance', 'disk_usage', metrics.performance.diskUsage, timestamp));

        // 사용자 메트릭 저장
        queries.push(this.saveMetric('users', 'total', metrics.users.totalUsers, timestamp));
        queries.push(this.saveMetric('users', 'active', metrics.users.activeUsers, timestamp));
        queries.push(this.saveMetric('users', 'new', metrics.users.newUsers, timestamp));

        await Promise.all(queries);
    }

    private async saveMetric(type: string, name: string, value: number, timestamp: Date): Promise<void> {
        const query = `
            INSERT INTO system_metrics (metric_type, metric_name, metric_value, timestamp)
            VALUES ($1, $2, $3, $4)
        `;

        await this.dbService.query(query, [type, name, value, timestamp]);
    }

    /**
     * 알림 관리
     */
    public async createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): Promise<Alert> {
        try {
            const query = `
                INSERT INTO alerts (type, title, message, component, severity, metadata)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING 
                    id, type, title, message, component, severity,
                    acknowledged, resolved, metadata, created_at as timestamp
            `;

            const result = await this.dbService.query(query, [
                alert.type,
                alert.title,
                alert.message,
                alert.component,
                alert.type, // severity와 type을 같게 설정
                JSON.stringify(alert.metadata || {}),
            ]);

            const newAlert: Alert = {
                id: result.rows[0].id,
                type: result.rows[0].type,
                title: result.rows[0].title,
                message: result.rows[0].message,
                component: result.rows[0].component,
                timestamp: result.rows[0].timestamp,
                acknowledged: result.rows[0].acknowledged,
                resolved: result.rows[0].resolved,
                metadata: result.rows[0].metadata,
            };

            logger.info(`Alert created: ${newAlert.title}`);
            this.emit('alertCreated', newAlert);

            return newAlert;

        } catch (error) {
            logger.error('Failed to create alert:', error);
            throw error;
        }
    }

    public async getActiveAlerts(): Promise<Alert[]> {
        try {
            const query = `
                SELECT 
                    id, type, title, message, component, severity,
                    acknowledged, resolved, metadata, created_at as timestamp
                FROM alerts 
                WHERE resolved = false 
                ORDER BY created_at DESC
                LIMIT 50
            `;

            const result = await this.dbService.query(query);

            return result.rows.map(row => ({
                id: row.id,
                type: row.type,
                title: row.title,
                message: row.message,
                component: row.component,
                timestamp: row.timestamp,
                acknowledged: row.acknowledged,
                resolved: row.resolved,
                metadata: row.metadata || {},
            }));

        } catch (error) {
            logger.error('Failed to get active alerts:', error);
            throw error;
        }
    }

    public async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
        try {
            const query = `
                UPDATE alerts 
                SET acknowledged = true, acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
                WHERE id = $2 AND acknowledged = false
            `;

            const result = await this.dbService.query(query, [userId, alertId]);
            return (result.rowCount || 0) > 0;

        } catch (error) {
            logger.error('Failed to acknowledge alert:', error);
            throw error;
        }
    }

    public async resolveAlert(alertId: string, userId: string): Promise<boolean> {
        try {
            const query = `
                UPDATE alerts 
                SET resolved = true, resolved_by = $1, resolved_at = CURRENT_TIMESTAMP
                WHERE id = $2 AND resolved = false
            `;

            const result = await this.dbService.query(query, [userId, alertId]);
            return (result.rowCount || 0) > 0;

        } catch (error) {
            logger.error('Failed to resolve alert:', error);
            throw error;
        }
    }

    /**
     * 시간별 메트릭 집계
     */
    public async aggregateHourlyMetrics(): Promise<void> {
        try {
            const oneHourAgo = new Date();
            oneHourAgo.setHours(oneHourAgo.getHours() - 1);

            // 세션 집계
            await this.aggregateSessionMetrics(oneHourAgo);
            
            // 에러 집계
            await this.aggregateErrorMetrics(oneHourAgo);
            
            logger.info('Hourly metrics aggregation completed');

        } catch (error) {
            logger.error('Failed to aggregate hourly metrics:', error);
            throw error;
        }
    }

    private async aggregateSessionMetrics(timestamp: Date): Promise<void> {
        // 구현 필요: 시간별 세션 통계 집계
        // 예: 시간별 세션 수, 평균 지속시간, 에러율 등
    }

    private async aggregateErrorMetrics(timestamp: Date): Promise<void> {
        // 구현 필요: 시간별 에러 통계 집계
        // 예: 시간별 에러 수, 에러 유형별 통계 등
    }

    /**
     * 이벤트 핸들러들
     */
    private handleAlertCreated(alert: Alert): void {
        // 실시간 알림 전송
        this.emit('realtime', {
            type: 'alertCreated',
            data: alert,
        });
    }

    private handleSystemCritical(data: any): void {
        // 긴급 알림 생성
        this.createAlert({
            type: 'critical',
            title: 'System Critical Alert',
            message: 'Critical system issue detected',
            component: data.component || 'system',
            metadata: data,
        });
    }

    private handlePerformanceDegraded(data: any): void {
        // 성능 저하 알림 생성
        this.createAlert({
            type: 'warning',
            title: 'Performance Degraded',
            message: 'System performance is below threshold',
            component: data.component || 'performance',
            metadata: data,
        });
    }

    /**
     * 유틸리티 메서드들
     */
    public getCurrentSystemHealth(): SystemHealth | null {
        return this.currentSystemHealth || null;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public async cleanup(): Promise<void> {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        if (this.metricsCollectionInterval) {
            clearInterval(this.metricsCollectionInterval);
        }

        this.removeAllListeners();
        logger.info('AdminMonitoringService cleaned up');
    }
}