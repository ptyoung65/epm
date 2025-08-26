/**
 * AIRIS EPM 프로젝트 관리자 서비스
 * OpenReplay 세션 리플레이와 프로젝트 관리 통합
 */

import { EventEmitter } from 'events';
import { getPostgreSQLPool, getMongoDatabase, getClickHouseClient } from '../config/database';
import { getCache, setCache, deleteCache } from '../config/redis';
import { logger } from '../utils/logger';

export interface Project {
    id: string;
    name: string;
    description: string;
    owner_id: string;
    status: 'active' | 'inactive' | 'archived';
    openreplay_project_id?: string;
    settings: {
        session_replay_enabled: boolean;
        auto_recording: boolean;
        retention_days: number;
        sampling_rate: number;
        privacy_settings: {
            mask_inputs: boolean;
            mask_text: boolean;
            block_domains: string[];
        };
    };
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}

export interface ProjectMember {
    project_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'viewer';
    permissions: string[];
    joined_at: Date;
}

export interface ProjectStats {
    total_sessions: number;
    active_sessions: number;
    total_events: number;
    total_users: number;
    avg_session_duration: number;
    bounce_rate: number;
    last_activity: Date;
}

export interface ProjectActivity {
    id: string;
    project_id: string;
    user_id: string;
    action: string;
    description: string;
    metadata: Record<string, any>;
    timestamp: Date;
}

export class ProjectManagerService extends EventEmitter {
    private pgPool: any;
    private mongoDB: any;
    private clickhouseClient: any;

    constructor() {
        super();
    }

    async initialize(): Promise<void> {
        try {
            this.pgPool = getPostgreSQLPool();
            this.mongoDB = getMongoDatabase();
            this.clickhouseClient = getClickHouseClient();

            await this.createTables();
            logger.info('ProjectManagerService initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize ProjectManagerService:', error);
            throw error;
        }
    }

    /**
     * 필요한 테이블 생성
     */
    private async createTables(): Promise<void> {
        // 프로젝트 테이블
        await this.pgPool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                owner_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'active',
                openreplay_project_id VARCHAR(255),
                settings JSONB DEFAULT '{}',
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // 프로젝트 멤버 테이블
        await this.pgPool.query(`
            CREATE TABLE IF NOT EXISTS project_members (
                project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
                user_id VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'viewer',
                permissions JSONB DEFAULT '[]',
                joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                PRIMARY KEY (project_id, user_id)
            );
        `);

        // 프로젝트 활동 로그 테이블
        await this.pgPool.query(`
            CREATE TABLE IF NOT EXISTS project_activities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
                user_id VARCHAR(255) NOT NULL,
                action VARCHAR(100) NOT NULL,
                description TEXT,
                metadata JSONB DEFAULT '{}',
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // 인덱스 생성
        await this.pgPool.query(`
            CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
            CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
            CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
            CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);
            CREATE INDEX IF NOT EXISTS idx_project_activities_timestamp ON project_activities(timestamp);
        `);

        logger.info('Project tables created successfully');
    }

    /**
     * 새 프로젝트 생성
     */
    async createProject(projectData: Partial<Project>, ownerId: string): Promise<Project> {
        const client = await this.pgPool.connect();
        
        try {
            await client.query('BEGIN');

            // 기본 설정
            const defaultSettings = {
                session_replay_enabled: true,
                auto_recording: true,
                retention_days: 30,
                sampling_rate: 1.0,
                privacy_settings: {
                    mask_inputs: true,
                    mask_text: false,
                    block_domains: [],
                },
            };

            // 프로젝트 생성
            const projectResult = await client.query(`
                INSERT INTO projects (name, description, owner_id, settings, metadata)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [
                projectData.name,
                projectData.description || '',
                ownerId,
                { ...defaultSettings, ...projectData.settings },
                projectData.metadata || {},
            ]);

            const project = projectResult.rows[0];

            // 소유자를 멤버로 추가
            await client.query(`
                INSERT INTO project_members (project_id, user_id, role, permissions)
                VALUES ($1, $2, 'owner', $3)
            `, [
                project.id,
                ownerId,
                JSON.stringify(['read', 'write', 'admin', 'delete']),
            ]);

            // 활동 로그 기록
            await this.logActivity(client, {
                project_id: project.id,
                user_id: ownerId,
                action: 'project_created',
                description: `프로젝트 "${project.name}" 생성`,
                metadata: { project_name: project.name },
            });

            await client.query('COMMIT');

            // 캐시 무효화
            await deleteCache(`project:${project.id}`);
            await deleteCache(`user_projects:${ownerId}`);

            this.emit('projectCreated', { project, user_id: ownerId });

            logger.info(`Project created: ${project.name} (ID: ${project.id})`);
            return project;

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to create project:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 프로젝트 조회
     */
    async getProject(projectId: string): Promise<Project | null> {
        try {
            // 캐시 확인
            const cached = await getCache(`project:${projectId}`);
            if (cached) {
                return cached;
            }

            const result = await this.pgPool.query(
                'SELECT * FROM projects WHERE id = $1',
                [projectId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const project = result.rows[0];

            // 캐시 저장
            await setCache(`project:${projectId}`, project, 300);

            return project;
        } catch (error) {
            logger.error('Failed to get project:', error);
            throw error;
        }
    }

    /**
     * 사용자 프로젝트 목록 조회
     */
    async getUserProjects(userId: string): Promise<Project[]> {
        try {
            // 캐시 확인
            const cached = await getCache(`user_projects:${userId}`);
            if (cached) {
                return cached;
            }

            const result = await this.pgPool.query(`
                SELECT p.* FROM projects p
                JOIN project_members pm ON p.id = pm.project_id
                WHERE pm.user_id = $1
                ORDER BY p.updated_at DESC
            `, [userId]);

            const projects = result.rows;

            // 캐시 저장
            await setCache(`user_projects:${userId}`, projects, 300);

            return projects;
        } catch (error) {
            logger.error('Failed to get user projects:', error);
            throw error;
        }
    }

    /**
     * 프로젝트 업데이트
     */
    async updateProject(projectId: string, updates: Partial<Project>, userId: string): Promise<Project> {
        const client = await this.pgPool.connect();

        try {
            await client.query('BEGIN');

            // 권한 확인
            const hasPermission = await this.checkPermission(projectId, userId, 'write');
            if (!hasPermission) {
                throw new Error('Insufficient permissions to update project');
            }

            // 프로젝트 업데이트
            const updateFields = [];
            const updateValues = [];
            let paramIndex = 1;

            if (updates.name) {
                updateFields.push(`name = $${paramIndex++}`);
                updateValues.push(updates.name);
            }
            if (updates.description !== undefined) {
                updateFields.push(`description = $${paramIndex++}`);
                updateValues.push(updates.description);
            }
            if (updates.status) {
                updateFields.push(`status = $${paramIndex++}`);
                updateValues.push(updates.status);
            }
            if (updates.settings) {
                updateFields.push(`settings = $${paramIndex++}`);
                updateValues.push(JSON.stringify(updates.settings));
            }
            if (updates.metadata) {
                updateFields.push(`metadata = $${paramIndex++}`);
                updateValues.push(JSON.stringify(updates.metadata));
            }

            updateFields.push(`updated_at = NOW()`);
            updateValues.push(projectId);

            const result = await client.query(`
                UPDATE projects 
                SET ${updateFields.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `, updateValues);

            const project = result.rows[0];

            // 활동 로그 기록
            await this.logActivity(client, {
                project_id: projectId,
                user_id: userId,
                action: 'project_updated',
                description: `프로젝트 업데이트`,
                metadata: updates,
            });

            await client.query('COMMIT');

            // 캐시 무효화
            await deleteCache(`project:${projectId}`);

            this.emit('projectUpdated', { project, user_id: userId });

            logger.info(`Project updated: ${projectId}`);
            return project;

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to update project:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 프로젝트 삭제
     */
    async deleteProject(projectId: string, userId: string): Promise<void> {
        const client = await this.pgPool.connect();

        try {
            await client.query('BEGIN');

            // 권한 확인 (소유자만 가능)
            const memberResult = await client.query(
                'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
                [projectId, userId]
            );

            if (memberResult.rows.length === 0 || memberResult.rows[0].role !== 'owner') {
                throw new Error('Only project owner can delete project');
            }

            // 프로젝트 정보 조회 (로깅용)
            const projectResult = await client.query(
                'SELECT * FROM projects WHERE id = $1',
                [projectId]
            );

            if (projectResult.rows.length === 0) {
                throw new Error('Project not found');
            }

            const project = projectResult.rows[0];

            // 관련 세션 데이터 삭제 (ClickHouse)
            await this.clickhouseClient.command(`
                DELETE FROM session_metrics WHERE project_id = '${projectId}'
            `);

            // MongoDB에서 관련 컬렉션 데이터 삭제
            await this.mongoDB.collection('session_recordings').deleteMany({ project_id: projectId });
            await this.mongoDB.collection('session_events').deleteMany({ project_id: projectId });

            // PostgreSQL에서 프로젝트 삭제 (CASCADE로 관련 데이터 자동 삭제)
            await client.query('DELETE FROM projects WHERE id = $1', [projectId]);

            await client.query('COMMIT');

            // 캐시 무효화
            await deleteCache(`project:${projectId}`);
            await deleteCache(`user_projects:${userId}`);

            this.emit('projectDeleted', { project, user_id: userId });

            logger.info(`Project deleted: ${project.name} (ID: ${projectId})`);

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to delete project:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 프로젝트 통계 조회
     */
    async getProjectStats(projectId: string): Promise<ProjectStats> {
        try {
            // 캐시 확인
            const cached = await getCache(`project_stats:${projectId}`);
            if (cached) {
                return cached;
            }

            // PostgreSQL에서 기본 통계
            const sessionResult = await this.pgPool.query(`
                SELECT 
                    COUNT(*) as total_sessions,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
                    SUM(events_count) as total_events,
                    COUNT(DISTINCT user_id) as total_users,
                    AVG(duration) as avg_session_duration,
                    COUNT(CASE WHEN duration < 10 THEN 1 END)::float / COUNT(*)::float as bounce_rate,
                    MAX(start_time) as last_activity
                FROM sessions 
                WHERE project_id = $1
            `, [projectId]);

            const stats = sessionResult.rows[0];

            const projectStats: ProjectStats = {
                total_sessions: parseInt(stats.total_sessions || 0),
                active_sessions: parseInt(stats.active_sessions || 0),
                total_events: parseInt(stats.total_events || 0),
                total_users: parseInt(stats.total_users || 0),
                avg_session_duration: parseFloat(stats.avg_session_duration || 0),
                bounce_rate: parseFloat(stats.bounce_rate || 0),
                last_activity: stats.last_activity,
            };

            // 캐시 저장 (5분)
            await setCache(`project_stats:${projectId}`, projectStats, 300);

            return projectStats;

        } catch (error) {
            logger.error('Failed to get project stats:', error);
            throw error;
        }
    }

    /**
     * 프로젝트 멤버 추가
     */
    async addProjectMember(projectId: string, userId: string, targetUserId: string, role: string = 'viewer'): Promise<void> {
        const client = await this.pgPool.connect();

        try {
            await client.query('BEGIN');

            // 권한 확인
            const hasPermission = await this.checkPermission(projectId, userId, 'admin');
            if (!hasPermission) {
                throw new Error('Insufficient permissions to add members');
            }

            // 기본 권한 설정
            const permissions = {
                viewer: ['read'],
                admin: ['read', 'write', 'admin'],
                owner: ['read', 'write', 'admin', 'delete'],
            };

            await client.query(`
                INSERT INTO project_members (project_id, user_id, role, permissions)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (project_id, user_id) 
                DO UPDATE SET role = $3, permissions = $4
            `, [
                projectId,
                targetUserId,
                role,
                JSON.stringify(permissions[role] || permissions.viewer),
            ]);

            // 활동 로그 기록
            await this.logActivity(client, {
                project_id: projectId,
                user_id: userId,
                action: 'member_added',
                description: `멤버 추가: ${targetUserId} (역할: ${role})`,
                metadata: { target_user_id: targetUserId, role },
            });

            await client.query('COMMIT');

            this.emit('memberAdded', { project_id: projectId, user_id: userId, target_user_id: targetUserId, role });

            logger.info(`Member added to project ${projectId}: ${targetUserId} (${role})`);

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to add project member:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 권한 확인
     */
    private async checkPermission(projectId: string, userId: string, permission: string): Promise<boolean> {
        try {
            const result = await this.pgPool.query(`
                SELECT permissions FROM project_members 
                WHERE project_id = $1 AND user_id = $2
            `, [projectId, userId]);

            if (result.rows.length === 0) {
                return false;
            }

            const permissions = result.rows[0].permissions;
            return permissions.includes(permission);

        } catch (error) {
            logger.error('Failed to check permission:', error);
            return false;
        }
    }

    /**
     * 활동 로그 기록
     */
    private async logActivity(client: any, activity: Partial<ProjectActivity>): Promise<void> {
        await client.query(`
            INSERT INTO project_activities (project_id, user_id, action, description, metadata)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            activity.project_id,
            activity.user_id,
            activity.action,
            activity.description,
            JSON.stringify(activity.metadata || {}),
        ]);
    }

    /**
     * 정리
     */
    async cleanup(): Promise<void> {
        logger.info('ProjectManagerService cleanup completed');
    }
}