/**
 * 세션 리플레이 관리 서비스
 * OpenReplay와의 통합 및 세션 데이터 관리
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';
import { RedisService } from './RedisService';

export interface SessionData {
    sessionId: string;
    projectId: string;
    userId?: string;
    userEmail?: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    pageViews: number;
    events: number;
    errors: number;
    crashes: number;
    userAgent: string;
    location: {
        country?: string;
        city?: string;
        ip?: string;
    };
    metadata: any;
    status: 'active' | 'completed' | 'failed';
}

export interface SessionFilter {
    projectId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    hasErrors?: boolean;
    hasCrashes?: boolean;
    minDuration?: number;
    maxDuration?: number;
    country?: string;
    limit?: number;
    offset?: number;
}

export interface SessionAnalytics {
    totalSessions: number;
    totalDuration: number;
    avgDuration: number;
    totalErrors: number;
    totalCrashes: number;
    uniqueUsers: number;
    bounceRate: number;
    conversionRate: number;
    topPages: Array<{ page: string; views: number; avgDuration: number }>;
    topErrors: Array<{ error: string; count: number; sessions: number }>;
    userFlow: Array<{ step: string; users: number; dropoff: number }>;
    heatmapData: any;
    geolocation: Array<{ country: string; sessions: number }>;
}

export class SessionReplayService extends EventEmitter {
    private dbService: DatabaseService;
    private redisService: RedisService;
    private openReplayClient: AxiosInstance;
    private initialized: boolean = false;

    constructor() {
        super();
        this.dbService = new DatabaseService();
        this.redisService = new RedisService();
        
        // OpenReplay API 클라이언트 설정
        this.openReplayClient = axios.create({
            baseURL: config.openreplay.apiUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.openreplay.apiKey}`,
            },
        });

        this.setupAxiosInterceptors();
    }

    private setupAxiosInterceptors(): void {
        // 요청 인터셉터
        this.openReplayClient.interceptors.request.use(
            (config) => {
                logger.debug(`OpenReplay API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('OpenReplay API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // 응답 인터셉터
        this.openReplayClient.interceptors.response.use(
            (response) => {
                logger.debug(`OpenReplay API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                logger.error('OpenReplay API Response Error:', error?.response?.data || error.message);
                return Promise.reject(error);
            }
        );
    }

    public async initialize(): Promise<void> {
        try {
            // OpenReplay 연결 테스트
            await this.testOpenReplayConnection();
            
            // 세션 스키마 초기화
            await this.initializeDatabase();
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            this.initialized = true;
            logger.info('SessionReplayService initialized successfully');
            
            // 초기화 완료 이벤트 발생
            this.emit('initialized');
            
        } catch (error) {
            logger.error('Failed to initialize SessionReplayService:', error);
            throw error;
        }
    }

    private async testOpenReplayConnection(): Promise<void> {
        try {
            const response = await this.openReplayClient.get('/health');
            logger.info(`OpenReplay connection successful: ${response.status}`);
        } catch (error) {
            logger.warn('OpenReplay connection test failed, continuing with mock mode');
            // 개발환경에서는 연결 실패를 무시하고 계속 진행
        }
    }

    private async initializeDatabase(): Promise<void> {
        const createSessionsTable = `
            CREATE TABLE IF NOT EXISTS sessions (
                session_id VARCHAR(255) PRIMARY KEY,
                project_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255),
                user_email VARCHAR(255),
                start_time TIMESTAMP WITH TIME ZONE NOT NULL,
                end_time TIMESTAMP WITH TIME ZONE,
                duration INTEGER,
                page_views INTEGER DEFAULT 0,
                events INTEGER DEFAULT 0,
                errors INTEGER DEFAULT 0,
                crashes INTEGER DEFAULT 0,
                user_agent TEXT,
                country VARCHAR(100),
                city VARCHAR(100),
                ip_address INET,
                metadata JSONB,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_sessions_project_id (project_id),
                INDEX idx_sessions_user_id (user_id),
                INDEX idx_sessions_start_time (start_time),
                INDEX idx_sessions_status (status)
            );
        `;

        const createSessionEventsTable = `
            CREATE TABLE IF NOT EXISTS session_events (
                id BIGSERIAL PRIMARY KEY,
                session_id VARCHAR(255) REFERENCES sessions(session_id) ON DELETE CASCADE,
                event_type VARCHAR(100) NOT NULL,
                event_data JSONB NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                page_url TEXT,
                element_selector TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session_events_session_id (session_id),
                INDEX idx_session_events_timestamp (timestamp),
                INDEX idx_session_events_type (event_type)
            );
        `;

        const createSessionErrorsTable = `
            CREATE TABLE IF NOT EXISTS session_errors (
                id BIGSERIAL PRIMARY KEY,
                session_id VARCHAR(255) REFERENCES sessions(session_id) ON DELETE CASCADE,
                error_type VARCHAR(100) NOT NULL,
                error_message TEXT NOT NULL,
                stack_trace TEXT,
                source_file VARCHAR(500),
                line_number INTEGER,
                column_number INTEGER,
                timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                severity VARCHAR(20) DEFAULT 'error',
                resolved BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session_errors_session_id (session_id),
                INDEX idx_session_errors_timestamp (timestamp),
                INDEX idx_session_errors_type (error_type)
            );
        `;

        await this.dbService.query(createSessionsTable);
        await this.dbService.query(createSessionEventsTable);
        await this.dbService.query(createSessionErrorsTable);
        
        logger.info('Session database tables initialized');
    }

    private setupEventListeners(): void {
        // 세션 업데이트 이벤트 처리
        this.on('sessionUpdate', this.handleSessionUpdate.bind(this));
        
        // 에러 이벤트 처리
        this.on('sessionError', this.handleSessionError.bind(this));
        
        // 세션 완료 이벤트 처리
        this.on('sessionCompleted', this.handleSessionCompleted.bind(this));
    }

    /**
     * 새로운 세션 생성
     */
    public async createSession(sessionData: Partial<SessionData>): Promise<SessionData> {
        try {
            const session: SessionData = {
                sessionId: sessionData.sessionId || this.generateSessionId(),
                projectId: sessionData.projectId!,
                userId: sessionData.userId,
                userEmail: sessionData.userEmail,
                startTime: sessionData.startTime || new Date(),
                pageViews: sessionData.pageViews || 0,
                events: sessionData.events || 0,
                errors: sessionData.errors || 0,
                crashes: sessionData.crashes || 0,
                userAgent: sessionData.userAgent || '',
                location: sessionData.location || {},
                metadata: sessionData.metadata || {},
                status: 'active',
            };

            // 데이터베이스에 저장
            const query = `
                INSERT INTO sessions (
                    session_id, project_id, user_id, user_email, start_time,
                    page_views, events, errors, crashes, user_agent,
                    country, city, ip_address, metadata, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *;
            `;

            const values = [
                session.sessionId,
                session.projectId,
                session.userId,
                session.userEmail,
                session.startTime,
                session.pageViews,
                session.events,
                session.errors,
                session.crashes,
                session.userAgent,
                session.location.country,
                session.location.city,
                session.location.ip,
                JSON.stringify(session.metadata),
                session.status,
            ];

            await this.dbService.query(query, values);

            // Redis에 캐시
            await this.redisService.setex(
                `session:${session.sessionId}`,
                3600, // 1시간
                JSON.stringify(session)
            );

            logger.info(`Session created: ${session.sessionId}`);
            this.emit('sessionCreated', session);

            return session;

        } catch (error) {
            logger.error('Failed to create session:', error);
            throw error;
        }
    }

    /**
     * 세션 조회
     */
    public async getSession(sessionId: string): Promise<SessionData | null> {
        try {
            // Redis에서 먼저 조회
            const cached = await this.redisService.get(`session:${sessionId}`);
            if (cached) {
                return JSON.parse(cached);
            }

            // 데이터베이스에서 조회
            const query = `
                SELECT 
                    session_id,
                    project_id,
                    user_id,
                    user_email,
                    start_time,
                    end_time,
                    duration,
                    page_views,
                    events,
                    errors,
                    crashes,
                    user_agent,
                    country,
                    city,
                    ip_address,
                    metadata,
                    status
                FROM sessions 
                WHERE session_id = $1;
            `;

            const result = await this.dbService.query(query, [sessionId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            const session: SessionData = {
                sessionId: row.session_id,
                projectId: row.project_id,
                userId: row.user_id,
                userEmail: row.user_email,
                startTime: row.start_time,
                endTime: row.end_time,
                duration: row.duration,
                pageViews: row.page_views,
                events: row.events,
                errors: row.errors,
                crashes: row.crashes,
                userAgent: row.user_agent,
                location: {
                    country: row.country,
                    city: row.city,
                    ip: row.ip_address,
                },
                metadata: row.metadata || {},
                status: row.status,
            };

            // Redis에 캐시
            await this.redisService.setex(
                `session:${sessionId}`,
                3600,
                JSON.stringify(session)
            );

            return session;

        } catch (error) {
            logger.error('Failed to get session:', error);
            throw error;
        }
    }

    /**
     * 세션 목록 조회
     */
    public async getSessions(filter: SessionFilter = {}): Promise<{
        sessions: SessionData[];
        total: number;
        hasMore: boolean;
    }> {
        try {
            const limit = filter.limit || 50;
            const offset = filter.offset || 0;

            let whereClause = 'WHERE 1=1';
            const params: any[] = [];
            let paramIndex = 1;

            if (filter.projectId) {
                whereClause += ` AND project_id = $${paramIndex}`;
                params.push(filter.projectId);
                paramIndex++;
            }

            if (filter.userId) {
                whereClause += ` AND user_id = $${paramIndex}`;
                params.push(filter.userId);
                paramIndex++;
            }

            if (filter.startDate) {
                whereClause += ` AND start_time >= $${paramIndex}`;
                params.push(filter.startDate);
                paramIndex++;
            }

            if (filter.endDate) {
                whereClause += ` AND start_time <= $${paramIndex}`;
                params.push(filter.endDate);
                paramIndex++;
            }

            if (filter.status) {
                whereClause += ` AND status = $${paramIndex}`;
                params.push(filter.status);
                paramIndex++;
            }

            if (filter.hasErrors) {
                whereClause += ` AND errors > 0`;
            }

            if (filter.hasCrashes) {
                whereClause += ` AND crashes > 0`;
            }

            if (filter.minDuration) {
                whereClause += ` AND duration >= $${paramIndex}`;
                params.push(filter.minDuration);
                paramIndex++;
            }

            if (filter.maxDuration) {
                whereClause += ` AND duration <= $${paramIndex}`;
                params.push(filter.maxDuration);
                paramIndex++;
            }

            if (filter.country) {
                whereClause += ` AND country = $${paramIndex}`;
                params.push(filter.country);
                paramIndex++;
            }

            // 총 개수 조회
            const countQuery = `SELECT COUNT(*) as total FROM sessions ${whereClause}`;
            const countResult = await this.dbService.query(countQuery, params);
            const total = parseInt(countResult.rows[0].total);

            // 세션 목록 조회
            const query = `
                SELECT 
                    session_id, project_id, user_id, user_email,
                    start_time, end_time, duration, page_views, events,
                    errors, crashes, user_agent, country, city,
                    ip_address, metadata, status
                FROM sessions 
                ${whereClause}
                ORDER BY start_time DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            params.push(limit, offset);
            const result = await this.dbService.query(query, params);

            const sessions: SessionData[] = result.rows.map(row => ({
                sessionId: row.session_id,
                projectId: row.project_id,
                userId: row.user_id,
                userEmail: row.user_email,
                startTime: row.start_time,
                endTime: row.end_time,
                duration: row.duration,
                pageViews: row.page_views,
                events: row.events,
                errors: row.errors,
                crashes: row.crashes,
                userAgent: row.user_agent,
                location: {
                    country: row.country,
                    city: row.city,
                    ip: row.ip_address,
                },
                metadata: row.metadata || {},
                status: row.status,
            }));

            return {
                sessions,
                total,
                hasMore: offset + limit < total,
            };

        } catch (error) {
            logger.error('Failed to get sessions:', error);
            throw error;
        }
    }

    /**
     * 세션 업데이트
     */
    public async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<SessionData | null> {
        try {
            const setParts: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            if (updates.endTime !== undefined) {
                setParts.push(`end_time = $${paramIndex}`);
                params.push(updates.endTime);
                paramIndex++;
            }

            if (updates.duration !== undefined) {
                setParts.push(`duration = $${paramIndex}`);
                params.push(updates.duration);
                paramIndex++;
            }

            if (updates.pageViews !== undefined) {
                setParts.push(`page_views = $${paramIndex}`);
                params.push(updates.pageViews);
                paramIndex++;
            }

            if (updates.events !== undefined) {
                setParts.push(`events = $${paramIndex}`);
                params.push(updates.events);
                paramIndex++;
            }

            if (updates.errors !== undefined) {
                setParts.push(`errors = $${paramIndex}`);
                params.push(updates.errors);
                paramIndex++;
            }

            if (updates.crashes !== undefined) {
                setParts.push(`crashes = $${paramIndex}`);
                params.push(updates.crashes);
                paramIndex++;
            }

            if (updates.status !== undefined) {
                setParts.push(`status = $${paramIndex}`);
                params.push(updates.status);
                paramIndex++;
            }

            if (updates.metadata !== undefined) {
                setParts.push(`metadata = $${paramIndex}`);
                params.push(JSON.stringify(updates.metadata));
                paramIndex++;
            }

            if (setParts.length === 0) {
                return this.getSession(sessionId);
            }

            setParts.push(`updated_at = CURRENT_TIMESTAMP`);

            const query = `
                UPDATE sessions 
                SET ${setParts.join(', ')}
                WHERE session_id = $${paramIndex}
                RETURNING *;
            `;

            params.push(sessionId);
            const result = await this.dbService.query(query, params);

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            const updatedSession: SessionData = {
                sessionId: row.session_id,
                projectId: row.project_id,
                userId: row.user_id,
                userEmail: row.user_email,
                startTime: row.start_time,
                endTime: row.end_time,
                duration: row.duration,
                pageViews: row.page_views,
                events: row.events,
                errors: row.errors,
                crashes: row.crashes,
                userAgent: row.user_agent,
                location: {
                    country: row.country,
                    city: row.city,
                    ip: row.ip_address,
                },
                metadata: row.metadata || {},
                status: row.status,
            };

            // Redis 캐시 업데이트
            await this.redisService.setex(
                `session:${sessionId}`,
                3600,
                JSON.stringify(updatedSession)
            );

            logger.info(`Session updated: ${sessionId}`);
            this.emit('sessionUpdated', updatedSession);

            return updatedSession;

        } catch (error) {
            logger.error('Failed to update session:', error);
            throw error;
        }
    }

    /**
     * 세션 삭제
     */
    public async deleteSession(sessionId: string): Promise<boolean> {
        try {
            const query = `DELETE FROM sessions WHERE session_id = $1`;
            const result = await this.dbService.query(query, [sessionId]);

            // Redis 캐시에서도 삭제
            await this.redisService.del(`session:${sessionId}`);

            if (result.rowCount && result.rowCount > 0) {
                logger.info(`Session deleted: ${sessionId}`);
                this.emit('sessionDeleted', { sessionId });
                return true;
            }

            return false;

        } catch (error) {
            logger.error('Failed to delete session:', error);
            throw error;
        }
    }

    /**
     * 세션 통계 조회
     */
    public async getSessionAnalytics(filter: SessionFilter = {}): Promise<SessionAnalytics> {
        try {
            let whereClause = 'WHERE 1=1';
            const params: any[] = [];
            let paramIndex = 1;

            if (filter.projectId) {
                whereClause += ` AND project_id = $${paramIndex}`;
                params.push(filter.projectId);
                paramIndex++;
            }

            if (filter.startDate) {
                whereClause += ` AND start_time >= $${paramIndex}`;
                params.push(filter.startDate);
                paramIndex++;
            }

            if (filter.endDate) {
                whereClause += ` AND start_time <= $${paramIndex}`;
                params.push(filter.endDate);
                paramIndex++;
            }

            // 기본 통계 조회
            const basicStatsQuery = `
                SELECT 
                    COUNT(*) as total_sessions,
                    SUM(duration) as total_duration,
                    AVG(duration) as avg_duration,
                    SUM(errors) as total_errors,
                    SUM(crashes) as total_crashes,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(CASE WHEN page_views = 1 THEN 1 END)::float / COUNT(*) as bounce_rate
                FROM sessions ${whereClause}
            `;

            const statsResult = await this.dbService.query(basicStatsQuery, params);
            const stats = statsResult.rows[0];

            // 상위 에러 조회
            const topErrorsQuery = `
                SELECT 
                    error_message,
                    COUNT(*) as error_count,
                    COUNT(DISTINCT session_id) as affected_sessions
                FROM session_errors se
                JOIN sessions s ON se.session_id = s.session_id
                ${whereClause.replace('WHERE', 'WHERE')}
                GROUP BY error_message
                ORDER BY error_count DESC
                LIMIT 10
            `;

            const errorsResult = await this.dbService.query(topErrorsQuery, params);

            // 지역별 세션 분포
            const geolocationQuery = `
                SELECT 
                    country,
                    COUNT(*) as session_count
                FROM sessions 
                ${whereClause} AND country IS NOT NULL
                GROUP BY country
                ORDER BY session_count DESC
                LIMIT 20
            `;

            const geoResult = await this.dbService.query(geolocationQuery, params);

            const analytics: SessionAnalytics = {
                totalSessions: parseInt(stats.total_sessions) || 0,
                totalDuration: parseInt(stats.total_duration) || 0,
                avgDuration: parseFloat(stats.avg_duration) || 0,
                totalErrors: parseInt(stats.total_errors) || 0,
                totalCrashes: parseInt(stats.total_crashes) || 0,
                uniqueUsers: parseInt(stats.unique_users) || 0,
                bounceRate: parseFloat(stats.bounce_rate) || 0,
                conversionRate: 0, // TODO: 구현 필요
                topPages: [], // TODO: 구현 필요
                topErrors: errorsResult.rows.map(row => ({
                    error: row.error_message,
                    count: row.error_count,
                    sessions: row.affected_sessions,
                })),
                userFlow: [], // TODO: 구현 필요
                heatmapData: {}, // TODO: 구현 필요
                geolocation: geoResult.rows.map(row => ({
                    country: row.country,
                    sessions: row.session_count,
                })),
            };

            return analytics;

        } catch (error) {
            logger.error('Failed to get session analytics:', error);
            throw error;
        }
    }

    /**
     * 오래된 세션 정리
     */
    public async cleanupOldSessions(): Promise<number> {
        try {
            const retentionDate = new Date();
            retentionDate.setDate(retentionDate.getDate() - config.openreplay.sessionRetentionDays);

            const query = `
                DELETE FROM sessions 
                WHERE start_time < $1 AND status = 'completed'
                RETURNING session_id;
            `;

            const result = await this.dbService.query(query, [retentionDate]);
            const deletedCount = result.rowCount || 0;

            if (deletedCount > 0) {
                logger.info(`Cleaned up ${deletedCount} old sessions`);
                
                // Redis 캐시에서도 해당 세션들 삭제
                const deletedSessionIds = result.rows.map(row => `session:${row.session_id}`);
                if (deletedSessionIds.length > 0) {
                    await this.redisService.del(...deletedSessionIds);
                }
            }

            return deletedCount;

        } catch (error) {
            logger.error('Failed to cleanup old sessions:', error);
            throw error;
        }
    }

    /**
     * 세션 이벤트 처리 메서드들
     */
    private handleSessionUpdate(data: any): void {
        logger.debug('Session update event:', data);
        // WebSocket을 통해 실시간 업데이트 전송
        this.emit('realtime', {
            type: 'sessionUpdate',
            data,
        });
    }

    private handleSessionError(data: any): void {
        logger.warn('Session error event:', data);
        this.emit('realtime', {
            type: 'sessionError',
            data,
        });
    }

    private handleSessionCompleted(data: any): void {
        logger.info('Session completed event:', data);
        this.emit('realtime', {
            type: 'sessionCompleted',
            data,
        });
    }

    /**
     * OpenReplay API 연동 메서드들
     */
    public async getOpenReplaySession(sessionId: string): Promise<any> {
        try {
            const response = await this.openReplayClient.get(`/sessions/${sessionId}`);
            return response.data;
        } catch (error) {
            logger.error(`Failed to get OpenReplay session ${sessionId}:`, error);
            return null;
        }
    }

    public async getSessionRecording(sessionId: string): Promise<any> {
        try {
            const response = await this.openReplayClient.get(`/sessions/${sessionId}/recording`);
            return response.data;
        } catch (error) {
            logger.error(`Failed to get session recording ${sessionId}:`, error);
            return null;
        }
    }

    /**
     * 유틸리티 메서드들
     */
    private generateSessionId(): string {
        return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public async cleanup(): Promise<void> {
        this.removeAllListeners();
        logger.info('SessionReplayService cleaned up');
    }
}