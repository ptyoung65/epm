/**
 * AIRIS EPM Session Replay Manager 환경 설정
 * OpenReplay 통합 및 다중 데이터베이스 설정
 */

import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// .env 파일 로드
dotenvConfig();

interface DatabaseConfig {
    postgres: {
        url: string;
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
    };
    redis: {
        url: string;
        host: string;
        port: number;
    };
    mongodb: {
        url: string;
        host: string;
        port: number;
        database: string;
    };
    clickhouse: {
        url: string;
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
    };
}

interface OpenReplayConfig {
    projectKey: string;
    apiUrl: string;
    frontendUrl: string;
    s3: {
        bucket: string;
        endpoint: string;
        accessKey: string;
        secretKey: string;
    };
}

interface Config {
    env: string;
    server: {
        port: number;
        adminPort: number;
        host: string;
        maxPayloadSize: string;
    };
    database: DatabaseConfig;
    openreplay: OpenReplayConfig;
    session: {
        secret: string;
        secureCookies: boolean;
        sameSite: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    cors: {
        origin: string[];
    };
    logging: {
        level: string;
        format: string;
    };
    storage: {
        path: string;
    };
}

const parseUrl = (url: string) => {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
        username: parsed.username || '',
        password: parsed.password || '',
        database: parsed.pathname.slice(1) || '',
    };
};

const parsePostgresUrl = (url: string) => {
    const parsed = parseUrl(url);
    return {
        url,
        host: parsed.host,
        port: parsed.port || 5432,
        database: parsed.database,
        username: parsed.username,
        password: parsed.password,
    };
};

const parseRedisUrl = (url: string) => {
    const parsed = parseUrl(url);
    return {
        url,
        host: parsed.host,
        port: parsed.port || 6379,
    };
};

const parseMongoUrl = (url: string) => {
    const parsed = parseUrl(url);
    return {
        url,
        host: parsed.host,
        port: parsed.port || 27017,
        database: parsed.database || 'airis-apm',
    };
};

const parseClickHouseUrl = (url: string) => {
    const parsed = parseUrl(url);
    return {
        url,
        host: parsed.host,
        port: parsed.port || 8123,
        database: parsed.database || 'airis_apm',
        username: parsed.username || 'default',
        password: parsed.password || '',
    };
};

export const config: Config = {
    env: process.env.NODE_ENV || 'development',
    
    server: {
        port: parseInt(process.env.PORT || '3004'),
        adminPort: parseInt(process.env.ADMIN_PORT || '3024'),
        host: process.env.HOST || '0.0.0.0',
        maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '100mb',
    },
    
    database: {
        postgres: parsePostgresUrl(
            process.env.DATABASE_URL || 
            'postgresql://postgres:postgres@localhost:5432/airis_apm'
        ),
        redis: parseRedisUrl(
            process.env.REDIS_URL || 
            'redis://localhost:6379'
        ),
        mongodb: parseMongoUrl(
            process.env.MONGODB_URL || 
            'mongodb://localhost:27017/airis-apm'
        ),
        clickhouse: parseClickHouseUrl(
            process.env.CLICKHOUSE_URL || 
            'http://localhost:8123'
        ),
    },
    
    openreplay: {
        projectKey: process.env.OPENREPLAY_PROJECT_KEY || 'airis-epm',
        apiUrl: process.env.OPENREPLAY_API_URL || 'http://openreplay-chalice:8080',
        frontendUrl: process.env.OPENREPLAY_FRONTEND_URL || 'http://openreplay-frontend:8080',
        s3: {
            bucket: process.env.OPENREPLAY_S3_BUCKET || 'openreplay',
            endpoint: process.env.OPENREPLAY_S3_ENDPOINT || 'http://minio:9000',
            accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        },
    },
    
    session: {
        secret: process.env.SESSION_SECRET || 'airis-epm-session-secret-key',
        secureCookies: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
    
    jwt: {
        secret: process.env.JWT_SECRET || 'airis-epm-jwt-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    
    cors: {
        origin: process.env.CORS_ORIGIN 
            ? process.env.CORS_ORIGIN.split(',')
            : ['http://localhost:3002', 'http://localhost:3024', 'http://localhost:3030'],
    },
    
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined',
    },
    
    storage: {
        path: process.env.STORAGE_PATH || path.join(__dirname, '../../storage'),
    },
};

// 환경별 설정 검증
if (config.env === 'production') {
    const requiredEnvVars = [
        'DATABASE_URL',
        'REDIS_URL',
        'MONGODB_URL',
        'CLICKHOUSE_URL',
        'SESSION_SECRET',
        'JWT_SECRET',
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}

export default config;