/**
 * AIRIS EPM 통합 데이터베이스 연결 설정
 * PostgreSQL, Redis, MongoDB, ClickHouse 통합 관리
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { MongoClient } from 'mongodb';
import { createClient } from '@clickhouse/client';
import { config } from './environment';
import { logger } from '../utils/logger';

// PostgreSQL 연결 풀
export let pgPool: Pool;

// Redis 클라이언트
export let redisClient: Redis;

// MongoDB 클라이언트
export let mongoClient: MongoClient;
export let mongoDB: any;

// ClickHouse 클라이언트
export let clickhouseClient: any;

/**
 * 모든 데이터베이스 연결 초기화
 */
export async function connectDatabase(): Promise<void> {
    try {
        // PostgreSQL 연결
        pgPool = new Pool({
            connectionString: config.database.postgres.url,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // 연결 테스트
        const pgClient = await pgPool.connect();
        await pgClient.query('SELECT NOW()');
        pgClient.release();
        logger.info('PostgreSQL connected successfully');

        // Redis 연결
        redisClient = new Redis(config.database.redis.url, {
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            showFriendlyErrorStack: true,
        });

        redisClient.on('error', (error) => {
            logger.error('Redis connection error:', error);
        });

        redisClient.on('connect', () => {
            logger.info('Redis connected successfully');
        });

        // MongoDB 연결
        mongoClient = new MongoClient(config.database.mongodb.url, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        await mongoClient.connect();
        mongoDB = mongoClient.db('airis-apm');
        logger.info('MongoDB connected successfully');

        // ClickHouse 연결
        clickhouseClient = createClient({
            host: config.database.clickhouse.url,
            username: config.database.clickhouse.username || 'default',
            password: config.database.clickhouse.password || '',
            database: config.database.clickhouse.database || 'airis_apm',
        });

        // ClickHouse 연결 테스트
        await clickhouseClient.query({
            query: 'SELECT version()',
        });
        logger.info('ClickHouse connected successfully');

        // 테이블 초기화
        await initializeTables();

    } catch (error) {
        logger.error('Database connection failed:', error);
        throw error;
    }
}

/**
 * 필요한 테이블 및 컬렉션 초기화
 */
async function initializeTables(): Promise<void> {
    try {
        // PostgreSQL 테이블 생성
        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id VARCHAR(255) UNIQUE NOT NULL,
                user_id VARCHAR(255),
                project_id VARCHAR(255) NOT NULL,
                start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                end_time TIMESTAMP WITH TIME ZONE,
                duration INTEGER DEFAULT 0,
                events_count INTEGER DEFAULT 0,
                pages_count INTEGER DEFAULT 0,
                clicks_count INTEGER DEFAULT 0,
                inputs_count INTEGER DEFAULT 0,
                user_agent TEXT,
                ip_address INET,
                country VARCHAR(100),
                city VARCHAR(100),
                browser VARCHAR(100),
                os VARCHAR(100),
                device_type VARCHAR(50),
                viewport_width INTEGER,
                viewport_height INTEGER,
                status VARCHAR(50) DEFAULT 'active',
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS session_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id VARCHAR(255) REFERENCES sessions(session_id),
                event_type VARCHAR(100) NOT NULL,
                timestamp BIGINT NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        await pgPool.query(`
            CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
            CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
            CREATE INDEX IF NOT EXISTS idx_session_events_timestamp ON session_events(timestamp);
        `);

        // ClickHouse 테이블 생성 (메트릭 데이터용)
        await clickhouseClient.command(`
            CREATE TABLE IF NOT EXISTS session_metrics (
                timestamp DateTime,
                session_id String,
                metric_name String,
                metric_value Float64,
                tags Map(String, String),
                project_id String
            ) ENGINE = MergeTree()
            PARTITION BY toYYYYMM(timestamp)
            ORDER BY (timestamp, session_id, metric_name)
        `);

        logger.info('Database tables initialized successfully');

    } catch (error) {
        logger.error('Failed to initialize database tables:', error);
        throw error;
    }
}

/**
 * 모든 데이터베이스 연결 해제
 */
export async function disconnectDatabase(): Promise<void> {
    try {
        if (pgPool) {
            await pgPool.end();
            logger.info('PostgreSQL disconnected');
        }

        if (redisClient) {
            redisClient.disconnect();
            logger.info('Redis disconnected');
        }

        if (mongoClient) {
            await mongoClient.close();
            logger.info('MongoDB disconnected');
        }

        if (clickhouseClient) {
            await clickhouseClient.close();
            logger.info('ClickHouse disconnected');
        }

    } catch (error) {
        logger.error('Error disconnecting databases:', error);
    }
}

/**
 * Redis 연결 반환
 */
export function getRedisClient(): Redis {
    if (!redisClient) {
        throw new Error('Redis client not initialized');
    }
    return redisClient;
}

/**
 * MongoDB 데이터베이스 반환
 */
export function getMongoDatabase() {
    if (!mongoDB) {
        throw new Error('MongoDB not initialized');
    }
    return mongoDB;
}

/**
 * PostgreSQL 풀 반환
 */
export function getPostgreSQLPool(): Pool {
    if (!pgPool) {
        throw new Error('PostgreSQL pool not initialized');
    }
    return pgPool;
}

/**
 * ClickHouse 클라이언트 반환
 */
export function getClickHouseClient() {
    if (!clickhouseClient) {
        throw new Error('ClickHouse client not initialized');
    }
    return clickhouseClient;
}