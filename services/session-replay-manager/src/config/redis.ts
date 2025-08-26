/**
 * AIRIS EPM Redis 클라이언트 설정
 * 세션 저장, 캐싱, 실시간 데이터 관리
 */

import Redis from 'ioredis';
import { config } from './environment';
import { logger } from '../utils/logger';

let redisClient: Redis;

/**
 * Redis 연결 초기화
 */
export async function connectRedis(): Promise<Redis> {
    try {
        redisClient = new Redis(config.database.redis.url, {
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            showFriendlyErrorStack: true,
            lazyConnect: true,
        });

        redisClient.on('connect', () => {
            logger.info('Redis connected successfully');
        });

        redisClient.on('error', (error) => {
            logger.error('Redis connection error:', error);
        });

        redisClient.on('close', () => {
            logger.warn('Redis connection closed');
        });

        // 연결 테스트
        await redisClient.ping();
        logger.info('Redis ping successful');

        return redisClient;
    } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        throw error;
    }
}

/**
 * Redis 연결 해제
 */
export async function disconnectRedis(): Promise<void> {
    if (redisClient) {
        redisClient.disconnect();
        logger.info('Redis disconnected');
    }
}

/**
 * Redis 클라이언트 반환
 */
export function getRedisClient(): Redis {
    if (!redisClient) {
        throw new Error('Redis client not initialized');
    }
    return redisClient;
}

/**
 * 세션 데이터 저장
 */
export async function setSessionData(sessionId: string, data: any, ttl: number = 3600): Promise<void> {
    const client = getRedisClient();
    const key = `session:${sessionId}`;
    await client.setex(key, ttl, JSON.stringify(data));
}

/**
 * 세션 데이터 조회
 */
export async function getSessionData(sessionId: string): Promise<any> {
    const client = getRedisClient();
    const key = `session:${sessionId}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
}

/**
 * 세션 데이터 삭제
 */
export async function deleteSessionData(sessionId: string): Promise<void> {
    const client = getRedisClient();
    const key = `session:${sessionId}`;
    await client.del(key);
}

/**
 * 캐시 데이터 저장
 */
export async function setCache(key: string, data: any, ttl: number = 300): Promise<void> {
    const client = getRedisClient();
    const cacheKey = `cache:${key}`;
    await client.setex(cacheKey, ttl, JSON.stringify(data));
}

/**
 * 캐시 데이터 조회
 */
export async function getCache(key: string): Promise<any> {
    const client = getRedisClient();
    const cacheKey = `cache:${key}`;
    const data = await client.get(cacheKey);
    return data ? JSON.parse(data) : null;
}

/**
 * 캐시 데이터 삭제
 */
export async function deleteCache(key: string): Promise<void> {
    const client = getRedisClient();
    const cacheKey = `cache:${key}`;
    await client.del(cacheKey);
}

/**
 * 실시간 메트릭 저장
 */
export async function setRealTimeMetric(metric: string, value: number, ttl: number = 60): Promise<void> {
    const client = getRedisClient();
    const key = `metric:${metric}:${Date.now()}`;
    await client.setex(key, ttl, value.toString());
}

/**
 * 실시간 메트릭 조회
 */
export async function getRealTimeMetrics(metric: string, since: number = Date.now() - 60000): Promise<Array<{timestamp: number, value: number}>> {
    const client = getRedisClient();
    const pattern = `metric:${metric}:*`;
    const keys = await client.keys(pattern);
    
    const metrics = [];
    for (const key of keys) {
        const timestamp = parseInt(key.split(':')[2]);
        if (timestamp >= since) {
            const value = await client.get(key);
            metrics.push({
                timestamp,
                value: parseFloat(value || '0'),
            });
        }
    }
    
    return metrics.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * 사용자 활성 세션 관리
 */
export async function addActiveSession(userId: string, sessionId: string): Promise<void> {
    const client = getRedisClient();
    const key = `active_sessions:${userId}`;
    await client.sadd(key, sessionId);
    await client.expire(key, 3600); // 1시간 후 만료
}

/**
 * 사용자 활성 세션 조회
 */
export async function getActiveSessions(userId: string): Promise<string[]> {
    const client = getRedisClient();
    const key = `active_sessions:${userId}`;
    return await client.smembers(key);
}

/**
 * 사용자 활성 세션 제거
 */
export async function removeActiveSession(userId: string, sessionId: string): Promise<void> {
    const client = getRedisClient();
    const key = `active_sessions:${userId}`;
    await client.srem(key, sessionId);
}

export default redisClient;