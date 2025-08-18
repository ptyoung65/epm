/**
 * Redis Service for AIRIS-MON ClickStack Architecture
 * Korean-optimized caching and session management
 */

const Redis = require('redis');
const logger = require('../../api-gateway/src/utils/logger');

class RedisService {
  constructor(config = {}) {
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password || null,
      db: config.db || 0,
      ttl: config.ttl || 3600, // 1 hour default TTL
      keyPrefix: config.keyPrefix || 'airis-mon:',
      ...config
    };

    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.isConnected = false;
    
    this.metrics = {
      operations: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  async start() {
    try {
      logger.info('Redis 서비스 시작 중...', { service: 'redis' });

      // Main client for caching operations
      this.client = Redis.createClient({
        socket: {
          host: this.config.host,
          port: this.config.port
        },
        password: this.config.password,
        database: this.config.db
      });

      // Subscriber client for pub/sub
      this.subscriber = this.client.duplicate();
      
      // Publisher client for pub/sub
      this.publisher = this.client.duplicate();

      // Error handling
      this.client.on('error', (error) => {
        this.metrics.errors++;
        logger.error('Redis 클라이언트 오류', { 
          error: error.message, 
          service: 'redis' 
        });
      });

      this.client.on('connect', () => {
        logger.info('Redis 클라이언트 연결됨', { service: 'redis' });
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        logger.info('Redis 클라이언트 준비됨', { service: 'redis' });
      });

      // Connect all clients
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);

      // Initialize Korean timezone data structures
      await this.initializeKoreanStructures();

      logger.info('Redis 서비스가 성공적으로 시작되었습니다', {
        service: 'redis',
        host: this.config.host,
        port: this.config.port
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('Redis 서비스 시작 실패', {
        error: error.message,
        service: 'redis'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('Redis 서비스 종료 중...', { service: 'redis' });

      if (this.client) await this.client.disconnect();
      if (this.subscriber) await this.subscriber.disconnect();
      if (this.publisher) await this.publisher.disconnect();

      this.isConnected = false;
      logger.info('Redis 서비스가 종료되었습니다', { service: 'redis' });

    } catch (error) {
      this.metrics.errors++;
      logger.error('Redis 서비스 종료 중 오류 발생', {
        error: error.message,
        service: 'redis'
      });
    }
  }

  async initializeKoreanStructures() {
    const koreanBusinessHours = {
      weekdays: [1, 2, 3, 4, 5], // Monday to Friday
      startHour: 9,
      endHour: 18,
      timezone: 'Asia/Seoul'
    };

    await this.client.hSet(
      `${this.config.keyPrefix}config:korean-business-hours`,
      koreanBusinessHours
    );

    logger.debug('한국 시간대 설정이 초기화되었습니다', { service: 'redis' });
  }

  /**
   * Generate cache key with Korean context
   */
  generateKey(namespace, key, koreanContext = true) {
    let fullKey = `${this.config.keyPrefix}${namespace}:${key}`;
    
    if (koreanContext) {
      const koreanTime = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul'
      });
      const koreanHour = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        hour12: false
      });
      
      // Add Korean time context for time-sensitive caches
      if (namespace.includes('dashboard') || namespace.includes('metrics')) {
        fullKey += `:korean-hour:${koreanHour}`;
      }
    }
    
    return fullKey;
  }

  /**
   * Set cache with Korean timezone awareness
   */
  async set(key, value, ttl = null) {
    if (!this.isConnected) {
      throw new Error('Redis 클라이언트가 연결되지 않았습니다');
    }

    try {
      this.metrics.operations++;
      
      const serializedValue = JSON.stringify({
        data: value,
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        created_at: Date.now()
      });

      const effectiveTtl = ttl || this.config.ttl;
      const result = await this.client.setEx(key, effectiveTtl, serializedValue);

      logger.debug('캐시 설정 완료', {
        key,
        ttl: effectiveTtl,
        service: 'redis'
      });

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('캐시 설정 실패', {
        key,
        error: error.message,
        service: 'redis'
      });
      throw error;
    }
  }

  /**
   * Get cache with Korean timezone context
   */
  async get(key) {
    if (!this.isConnected) {
      throw new Error('Redis 클라이언트가 연결되지 않았습니다');
    }

    try {
      this.metrics.operations++;
      const result = await this.client.get(key);

      if (result === null) {
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;
      const parsed = JSON.parse(result);

      logger.debug('캐시 조회 완료', {
        key,
        hit: true,
        korean_timestamp: parsed.korean_timestamp,
        service: 'redis'
      });

      return parsed.data;

    } catch (error) {
      this.metrics.errors++;
      logger.error('캐시 조회 실패', {
        key,
        error: error.message,
        service: 'redis'
      });
      return null;
    }
  }

  /**
   * Delete cache
   */
  async del(key) {
    if (!this.isConnected) {
      throw new Error('Redis 클라이언트가 연결되지 않았습니다');
    }

    try {
      this.metrics.operations++;
      const result = await this.client.del(key);

      logger.debug('캐시 삭제 완료', {
        key,
        deleted: result > 0,
        service: 'redis'
      });

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('캐시 삭제 실패', {
        key,
        error: error.message,
        service: 'redis'
      });
      throw error;
    }
  }

  /**
   * Cache dashboard data with Korean business hours context
   */
  async cacheDashboardData(dashboardType, data, options = {}) {
    const now = new Date();
    const koreanHour = new Date(now.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul'
    })).getHours();
    const koreanDay = new Date(now.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul'
    })).getDay();

    const isBusinessHours = koreanDay >= 1 && koreanDay <= 5 && 
                           koreanHour >= 9 && koreanHour <= 18;

    const cacheKey = this.generateKey('dashboard', dashboardType);
    const ttl = isBusinessHours ? 300 : 900; // 5 min during business, 15 min after

    const enrichedData = {
      ...data,
      korean_business_hours: isBusinessHours,
      korean_hour: koreanHour,
      korean_day: ['일', '월', '화', '수', '목', '금', '토'][koreanDay],
      cache_strategy: isBusinessHours ? 'high-frequency' : 'low-frequency'
    };

    return this.set(cacheKey, enrichedData, ttl);
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(dashboardType) {
    const cacheKey = this.generateKey('dashboard', dashboardType);
    return this.get(cacheKey);
  }

  /**
   * Cache metrics with time-based partitioning
   */
  async cacheMetrics(metricName, timeRange, data) {
    const cacheKey = this.generateKey('metrics', `${metricName}:${timeRange}`);
    const ttl = this.getMetricsTTL(timeRange);
    
    return this.set(cacheKey, data, ttl);
  }

  /**
   * Get metrics from cache
   */
  async getMetrics(metricName, timeRange) {
    const cacheKey = this.generateKey('metrics', `${metricName}:${timeRange}`);
    return this.get(cacheKey);
  }

  /**
   * Determine TTL based on time range
   */
  getMetricsTTL(timeRange) {
    const ttlMap = {
      '1m': 30,    // 30 seconds
      '5m': 60,    // 1 minute
      '1h': 300,   // 5 minutes
      '24h': 900,  // 15 minutes
      '7d': 3600,  // 1 hour
      '30d': 7200  // 2 hours
    };
    
    return ttlMap[timeRange] || this.config.ttl;
  }

  /**
   * Store session data
   */
  async setSession(sessionId, sessionData, ttl = 86400) { // 24 hours default
    const sessionKey = this.generateKey('session', sessionId, false);
    
    const enrichedSession = {
      ...sessionData,
      korean_login_time: new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul'
      }),
      last_activity: Date.now()
    };

    return this.set(sessionKey, enrichedSession, ttl);
  }

  /**
   * Get session data
   */
  async getSession(sessionId) {
    const sessionKey = this.generateKey('session', sessionId, false);
    return this.get(sessionKey);
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId) {
    const sessionData = await this.getSession(sessionId);
    if (sessionData) {
      sessionData.last_activity = Date.now();
      sessionData.korean_last_activity = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul'
      });
      
      const sessionKey = this.generateKey('session', sessionId, false);
      await this.set(sessionKey, sessionData);
    }
  }

  /**
   * Store query results cache
   */
  async cacheQueryResult(queryHash, result, ttl = 1800) { // 30 minutes default
    const cacheKey = this.generateKey('query', queryHash);
    return this.set(cacheKey, result, ttl);
  }

  /**
   * Get cached query result
   */
  async getCachedQuery(queryHash) {
    const cacheKey = this.generateKey('query', queryHash);
    return this.get(cacheKey);
  }

  /**
   * Publish real-time update
   */
  async publishUpdate(channel, data) {
    if (!this.publisher) {
      throw new Error('Redis 퍼블리셔가 초기화되지 않았습니다');
    }

    try {
      const enrichedData = {
        ...data,
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        published_at: Date.now()
      };

      const result = await this.publisher.publish(
        `${this.config.keyPrefix}${channel}`,
        JSON.stringify(enrichedData)
      );

      logger.debug('실시간 업데이트 발행', {
        channel,
        subscribers: result,
        service: 'redis'
      });

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('실시간 업데이트 발행 실패', {
        channel,
        error: error.message,
        service: 'redis'
      });
      throw error;
    }
  }

  /**
   * Subscribe to real-time updates
   */
  async subscribe(channel, handler) {
    if (!this.subscriber) {
      throw new Error('Redis 구독자가 초기화되지 않았습니다');
    }

    try {
      const fullChannel = `${this.config.keyPrefix}${channel}`;
      
      this.subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === fullChannel) {
          try {
            const data = JSON.parse(message);
            handler(data);
          } catch (error) {
            logger.error('실시간 메시지 처리 실패', {
              channel: receivedChannel,
              error: error.message,
              service: 'redis'
            });
          }
        }
      });

      await this.subscriber.subscribe(fullChannel);
      
      logger.info('실시간 채널 구독 완료', {
        channel: fullChannel,
        service: 'redis'
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('채널 구독 실패', {
        channel,
        error: error.message,
        service: 'redis'
      });
      throw error;
    }
  }

  /**
   * Increment counter (useful for metrics)
   */
  async incr(key, amount = 1) {
    if (!this.isConnected) {
      throw new Error('Redis 클라이언트가 연결되지 않았습니다');
    }

    try {
      this.metrics.operations++;
      const result = await this.client.incrBy(key, amount);
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error('카운터 증가 실패', {
        key,
        error: error.message,
        service: 'redis'
      });
      throw error;
    }
  }

  /**
   * Get multiple keys
   */
  async mget(keys) {
    if (!this.isConnected) {
      throw new Error('Redis 클라이언트가 연결되지 않았습니다');
    }

    try {
      this.metrics.operations++;
      const results = await this.client.mGet(keys);
      
      return results.map((result, index) => {
        if (result === null) {
          this.metrics.misses++;
          return null;
        }
        
        this.metrics.hits++;
        try {
          const parsed = JSON.parse(result);
          return parsed.data;
        } catch {
          return result;
        }
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('다중 캐시 조회 실패', {
        keys: keys.length,
        error: error.message,
        service: 'redis'
      });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          message: 'Redis 서비스에 연결되지 않음',
          connected: false
        };
      }

      const startTime = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        connected: true,
        response_time_ms: responseTime,
        metrics: this.getMetrics(),
        config: {
          host: this.config.host,
          port: this.config.port,
          db: this.config.db
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      hit_rate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0,
      connected: this.isConnected
    };
  }

  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern) {
    if (!this.isConnected) {
      throw new Error('Redis 클라이언트가 연결되지 않았습니다');
    }

    try {
      const keys = await this.client.keys(`${this.config.keyPrefix}${pattern}`);
      if (keys.length > 0) {
        const result = await this.client.del(keys);
        logger.info('패턴별 캐시 정리 완료', {
          pattern,
          deleted: result,
          service: 'redis'
        });
        return result;
      }
      return 0;

    } catch (error) {
      this.metrics.errors++;
      logger.error('패턴별 캐시 정리 실패', {
        pattern,
        error: error.message,
        service: 'redis'
      });
      throw error;
    }
  }

  /**
   * Get Korean business hours cache strategy
   */
  getKoreanCacheStrategy() {
    const now = new Date();
    const koreanHour = new Date(now.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul'
    })).getHours();
    const koreanDay = new Date(now.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul'
    })).getDay();

    const isBusinessHours = koreanDay >= 1 && koreanDay <= 5 && 
                           koreanHour >= 9 && koreanHour <= 18;

    return {
      is_business_hours: isBusinessHours,
      ttl_multiplier: isBusinessHours ? 0.5 : 2, // Shorter cache during business hours
      refresh_strategy: isBusinessHours ? 'aggressive' : 'conservative'
    };
  }
}

module.exports = RedisService;