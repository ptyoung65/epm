/**
 * Redis-based Multi-layer Caching System
 * AIRIS EPM - Enterprise Performance Management
 * 고성능 다층 캐싱 아키텍처
 */

import Redis from 'ioredis';
import LRU from 'lru-cache';

// Redis 캐시 클래스
export class RedisCache {
  constructor(options = {}) {
    this.options = {
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || process.env.REDIS_PORT || 6379,
      password: options.password || process.env.REDIS_PASSWORD,
      db: options.db || 0,
      retryDelayOnFailover: options.retryDelayOnFailover || 100,
      maxRetriesPerRequest: options.maxRetriesPerRequest || 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      ...options.redis
    };
    
    this.defaultTTL = options.defaultTTL || 3600; // 1시간
    this.keyPrefix = options.keyPrefix || 'airis:epm:';
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB
    
    this.redis = null;
    this.isConnected = false;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
    
    this.compressionEnabled = options.compression !== false;
  }

  // Redis 연결 초기화
  async connect() {
    if (this.isConnected) return;
    
    try {
      this.redis = new Redis(this.options);
      
      this.redis.on('connect', () => {
        console.log('Redis connected successfully');
        this.isConnected = true;
      });
      
      this.redis.on('error', (error) => {
        console.error('Redis connection error:', error);
        this.stats.errors++;
        this.isConnected = false;
      });
      
      this.redis.on('close', () => {
        console.log('Redis connection closed');
        this.isConnected = false;
      });
      
      await this.redis.ping();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  // 데이터 압축
  compress(data) {
    if (!this.compressionEnabled) return data;
    
    const serialized = JSON.stringify(data);
    if (serialized.length < this.compressionThreshold) {
      return serialized;
    }
    
    // 간단한 압축 (실제로는 gzip/zlib 사용 권장)
    return JSON.stringify(data);
  }

  // 데이터 압축 해제
  decompress(data) {
    if (!this.compressionEnabled) return data;
    
    try {
      return JSON.parse(data);
    } catch (error) {
      return data;
    }
  }

  // 키 생성
  makeKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  // 단일 값 가져오기
  async get(key, options = {}) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const fullKey = this.makeKey(key);
      const result = await this.redis.get(fullKey);
      
      if (result === null) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      return this.decompress(result);
    } catch (error) {
      console.error('Redis GET error:', error);
      this.stats.errors++;
      return null;
    }
  }

  // 여러 값 가져오기
  async mget(keys) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const fullKeys = keys.map(key => this.makeKey(key));
      const results = await this.redis.mget(...fullKeys);
      
      const output = {};
      keys.forEach((key, index) => {
        const result = results[index];
        if (result !== null) {
          output[key] = this.decompress(result);
          this.stats.hits++;
        } else {
          this.stats.misses++;
        }
      });
      
      return output;
    } catch (error) {
      console.error('Redis MGET error:', error);
      this.stats.errors++;
      return {};
    }
  }

  // 단일 값 저장
  async set(key, value, options = {}) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const fullKey = this.makeKey(key);
      const ttl = options.ttl || this.defaultTTL;
      const compressedValue = this.compress(value);
      
      const result = await this.redis.setex(fullKey, ttl, compressedValue);
      
      if (result === 'OK') {
        this.stats.sets++;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Redis SET error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // 여러 값 저장
  async mset(keyValuePairs, options = {}) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    const ttl = options.ttl || this.defaultTTL;
    const pipeline = this.redis.pipeline();
    
    try {
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        const fullKey = this.makeKey(key);
        const compressedValue = this.compress(value);
        pipeline.setex(fullKey, ttl, compressedValue);
      });
      
      const results = await pipeline.exec();
      const successCount = results.filter(([error, result]) => !error && result === 'OK').length;
      
      this.stats.sets += successCount;
      return successCount === Object.keys(keyValuePairs).length;
    } catch (error) {
      console.error('Redis MSET error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // 값 삭제
  async del(key) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const fullKey = this.makeKey(key);
      const result = await this.redis.del(fullKey);
      
      if (result > 0) {
        this.stats.deletes++;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Redis DEL error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // 여러 값 삭제
  async mdel(keys) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const fullKeys = keys.map(key => this.makeKey(key));
      const result = await this.redis.del(...fullKeys);
      
      this.stats.deletes += result;
      return result;
    } catch (error) {
      console.error('Redis MDEL error:', error);
      this.stats.errors++;
      return 0;
    }
  }

  // 키 존재 확인
  async exists(key) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const fullKey = this.makeKey(key);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // TTL 설정
  async expire(key, ttl) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const fullKey = this.makeKey(key);
      const result = await this.redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // TTL 조회
  async ttl(key) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const fullKey = this.makeKey(key);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      console.error('Redis TTL error:', error);
      this.stats.errors++;
      return -1;
    }
  }

  // 패턴으로 키 검색
  async keys(pattern) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const fullPattern = this.makeKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      return keys.map(key => key.replace(this.keyPrefix, ''));
    } catch (error) {
      console.error('Redis KEYS error:', error);
      this.stats.errors++;
      return [];
    }
  }

  // 캐시 무효화
  async invalidate(pattern) {
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        return await this.mdel(keys);
      }
      return 0;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      this.stats.errors++;
      return 0;
    }
  }

  // 통계 조회
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      missRate: total > 0 ? (this.stats.misses / total) * 100 : 0
    };
  }

  // 통계 초기화
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  // 연결 종료
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }

  // 헬스체크
  async health() {
    if (!this.isConnected) {
      return { status: 'disconnected', message: 'Redis not connected' };
    }
    
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        stats: this.getStats()
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

// L1 인메모리 캐시 클래스
export class MemoryCache {
  constructor(options = {}) {
    this.options = {
      max: options.max || 1000,           // 최대 항목 수
      maxSize: options.maxSize || 50 * 1024 * 1024,  // 50MB
      maxAge: options.maxAge || 3600 * 1000,         // 1시간 (ms)
      updateAgeOnGet: options.updateAgeOnGet !== false,
      stale: options.stale !== false,
      ...options
    };
    
    this.cache = new LRU({
      ...this.options,
      length: (value) => JSON.stringify(value).length
    });
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
    
    // LRU 이벤트 리스너
    this.cache.on('evict', () => {
      this.stats.evictions++;
    });
  }

  // 값 가져오기
  get(key) {
    const result = this.cache.get(key);
    
    if (result !== undefined) {
      this.stats.hits++;
      return result;
    }
    
    this.stats.misses++;
    return null;
  }

  // 값 저장
  set(key, value, maxAge) {
    this.cache.set(key, value, maxAge);
    this.stats.sets++;
    return true;
  }

  // 값 삭제
  del(key) {
    const existed = this.cache.has(key);
    this.cache.del(key);
    
    if (existed) {
      this.stats.deletes++;
      return true;
    }
    return false;
  }

  // 키 존재 확인
  has(key) {
    return this.cache.has(key);
  }

  // 모든 키 조회
  keys() {
    return this.cache.keys();
  }

  // 캐시 초기화
  clear() {
    this.cache.clear();
  }

  // 통계 조회
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.length,
      maxSize: this.options.max,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      missRate: total > 0 ? (this.stats.misses / total) * 100 : 0,
      evictionRate: this.stats.sets > 0 ? (this.stats.evictions / this.stats.sets) * 100 : 0
    };
  }

  // 통계 초기화
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }
}

// 다층 캐시 시스템
export class MultiLayerCache {
  constructor(options = {}) {
    this.l1Cache = new MemoryCache(options.l1 || {});
    this.l2Cache = new RedisCache(options.l2 || {});
    
    this.options = {
      l1TTL: options.l1TTL || 300,        // L1 캐시 TTL (5분)
      l2TTL: options.l2TTL || 3600,       // L2 캐시 TTL (1시간)
      writeThrough: options.writeThrough !== false,  // 쓰기 관통
      writeBack: options.writeBack === true,         // 쓰기 되돌림
      readThrough: options.readThrough !== false,    // 읽기 관통
      ...options
    };
    
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      l1Promotions: 0,  // L2에서 L1으로의 승격
      totalRequests: 0
    };
  }

  // 초기화
  async init() {
    await this.l2Cache.connect();
  }

  // 값 가져오기 (L1 -> L2 -> 원본)
  async get(key, options = {}) {
    this.stats.totalRequests++;
    
    // L1 캐시 시도
    const l1Result = this.l1Cache.get(key);
    if (l1Result !== null) {
      this.stats.l1Hits++;
      return l1Result;
    }
    
    // L2 캐시 시도
    const l2Result = await this.l2Cache.get(key);
    if (l2Result !== null) {
      this.stats.l2Hits++;
      this.stats.l1Promotions++;
      
      // L1으로 승격 (자주 접근되는 데이터)
      this.l1Cache.set(key, l2Result, this.options.l1TTL * 1000);
      
      return l2Result;
    }
    
    this.stats.misses++;
    
    // 읽기 관통: 원본 데이터 소스에서 가져오기
    if (this.options.readThrough && options.fallback) {
      try {
        const originalValue = await options.fallback();
        
        if (originalValue !== null && originalValue !== undefined) {
          // 양쪽 캐시에 저장
          await this.set(key, originalValue);
          return originalValue;
        }
      } catch (error) {
        console.error('Fallback function error:', error);
      }
    }
    
    return null;
  }

  // 여러 값 가져오기
  async mget(keys, options = {}) {
    const results = {};
    const l2Keys = [];
    const fallbackKeys = [];
    
    // L1 캐시 확인
    keys.forEach(key => {
      const l1Result = this.l1Cache.get(key);
      if (l1Result !== null) {
        results[key] = l1Result;
        this.stats.l1Hits++;
      } else {
        l2Keys.push(key);
      }
    });
    
    // L2 캐시 확인
    if (l2Keys.length > 0) {
      const l2Results = await this.l2Cache.mget(l2Keys);
      
      l2Keys.forEach(key => {
        if (l2Results[key] !== undefined) {
          results[key] = l2Results[key];
          this.stats.l2Hits++;
          this.stats.l1Promotions++;
          
          // L1으로 승격
          this.l1Cache.set(key, l2Results[key], this.options.l1TTL * 1000);
        } else {
          fallbackKeys.push(key);
        }
      });
    }
    
    // 읽기 관통
    if (this.options.readThrough && options.fallback && fallbackKeys.length > 0) {
      try {
        const fallbackResults = await options.fallback(fallbackKeys);
        
        if (fallbackResults && typeof fallbackResults === 'object') {
          Object.entries(fallbackResults).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              results[key] = value;
              // 양쪽 캐시에 저장
              this.set(key, value);
            }
          });
        }
      } catch (error) {
        console.error('Batch fallback function error:', error);
      }
    }
    
    this.stats.misses += fallbackKeys.length;
    this.stats.totalRequests += keys.length;
    
    return results;
  }

  // 값 저장
  async set(key, value, options = {}) {
    const l1TTL = options.l1TTL || this.options.l1TTL;
    const l2TTL = options.l2TTL || this.options.l2TTL;
    
    // L1 캐시에 저장
    this.l1Cache.set(key, value, l1TTL * 1000);
    
    // 쓰기 관통: L2 캐시에도 즉시 저장
    if (this.options.writeThrough) {
      await this.l2Cache.set(key, value, { ttl: l2TTL });
    }
    
    return true;
  }

  // 여러 값 저장
  async mset(keyValuePairs, options = {}) {
    const l1TTL = options.l1TTL || this.options.l1TTL;
    const l2TTL = options.l2TTL || this.options.l2TTL;
    
    // L1 캐시에 저장
    Object.entries(keyValuePairs).forEach(([key, value]) => {
      this.l1Cache.set(key, value, l1TTL * 1000);
    });
    
    // 쓰기 관통
    if (this.options.writeThrough) {
      await this.l2Cache.mset(keyValuePairs, { ttl: l2TTL });
    }
    
    return true;
  }

  // 값 삭제
  async del(key) {
    const l1Deleted = this.l1Cache.del(key);
    const l2Deleted = await this.l2Cache.del(key);
    
    return l1Deleted || l2Deleted;
  }

  // 여러 값 삭제
  async mdel(keys) {
    let deletedCount = 0;
    
    keys.forEach(key => {
      if (this.l1Cache.del(key)) {
        deletedCount++;
      }
    });
    
    const l2Deleted = await this.l2Cache.mdel(keys);
    
    return Math.max(deletedCount, l2Deleted);
  }

  // 캐시 무효화
  async invalidate(pattern) {
    // L1에서 패턴 매칭 키 삭제
    const l1Keys = this.l1Cache.keys();
    const matchingKeys = l1Keys.filter(key => key.includes(pattern.replace('*', '')));
    
    matchingKeys.forEach(key => {
      this.l1Cache.del(key);
    });
    
    // L2에서 패턴 매칭 키 삭제
    const l2Deleted = await this.l2Cache.invalidate(pattern);
    
    return matchingKeys.length + l2Deleted;
  }

  // 통계 조회
  getStats() {
    const l1Stats = this.l1Cache.getStats();
    const l2Stats = this.l2Cache.getStats();
    
    return {
      overall: {
        ...this.stats,
        hitRate: this.stats.totalRequests > 0 
          ? ((this.stats.l1Hits + this.stats.l2Hits) / this.stats.totalRequests) * 100 
          : 0,
        l1HitRate: this.stats.totalRequests > 0 
          ? (this.stats.l1Hits / this.stats.totalRequests) * 100 
          : 0,
        l2HitRate: this.stats.totalRequests > 0 
          ? (this.stats.l2Hits / this.stats.totalRequests) * 100 
          : 0
      },
      l1: l1Stats,
      l2: l2Stats
    };
  }

  // 통계 초기화
  resetStats() {
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      l1Promotions: 0,
      totalRequests: 0
    };
    
    this.l1Cache.resetStats();
    this.l2Cache.resetStats();
  }

  // 헬스체크
  async health() {
    const l2Health = await this.l2Cache.health();
    
    return {
      l1: {
        status: 'healthy',
        stats: this.l1Cache.getStats()
      },
      l2: l2Health,
      overall: {
        status: l2Health.status === 'healthy' ? 'healthy' : 'degraded',
        stats: this.getStats().overall
      }
    };
  }

  // 연결 종료
  async disconnect() {
    await this.l2Cache.disconnect();
  }
}

export default {
  RedisCache,
  MemoryCache,
  MultiLayerCache
};