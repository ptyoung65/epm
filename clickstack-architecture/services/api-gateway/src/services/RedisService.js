const Redis = require('redis');
const logger = require('../utils/logger');

class RedisService {
  constructor() {
    this.client = null;
    this.connected = false;
    
    this.config = {
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || 'airis_redis_2024',
      db: 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    };
  }

  async connect() {
    try {
      this.client = Redis.createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
          connectTimeout: 10000,
          lazyConnect: true
        },
        password: this.config.password,
        database: this.config.db
      });

      this.client.on('error', (err) => {
        logger.error('Redis 오류', { error: err.message });
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis 연결 시도 중...');
      });

      this.client.on('ready', () => {
        logger.info('Redis 연결 성공');
        this.connected = true;
      });

      await this.client.connect();

    } catch (error) {
      logger.error('Redis 연결 실패', { error: error.message });
      this.connected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.disconnect();
      }
      this.connected = false;
      logger.info('Redis 연결 해제 완료');
    } catch (error) {
      logger.error('Redis 연결 해제 실패', { error: error.message });
    }
  }

  async get(key) {
    if (!this.connected) {
      throw new Error('Redis 연결되지 않음');
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET 실패', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, expireInSeconds = null) {
    if (!this.connected) {
      throw new Error('Redis 연결되지 않음');
    }

    try {
      const serialized = JSON.stringify(value);
      if (expireInSeconds) {
        await this.client.setEx(key, expireInSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      logger.debug('Redis SET 성공', { key });
    } catch (error) {
      logger.error('Redis SET 실패', { key, error: error.message });
      throw error;
    }
  }

  async del(key) {
    if (!this.connected) {
      throw new Error('Redis 연결되지 않음');
    }

    try {
      await this.client.del(key);
      logger.debug('Redis DELETE 성공', { key });
    } catch (error) {
      logger.error('Redis DELETE 실패', { key, error: error.message });
      throw error;
    }
  }

  async exists(key) {
    if (!this.connected) {
      return false;
    }

    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error('Redis EXISTS 실패', { key, error: error.message });
      return false;
    }
  }

  async increment(key, by = 1) {
    if (!this.connected) {
      throw new Error('Redis 연결되지 않음');
    }

    try {
      return await this.client.incrBy(key, by);
    } catch (error) {
      logger.error('Redis INCR 실패', { key, error: error.message });
      throw error;
    }
  }

  async setHash(key, field, value) {
    if (!this.connected) {
      throw new Error('Redis 연결되지 않음');
    }

    try {
      await this.client.hSet(key, field, JSON.stringify(value));
      logger.debug('Redis HSET 성공', { key, field });
    } catch (error) {
      logger.error('Redis HSET 실패', { key, field, error: error.message });
      throw error;
    }
  }

  async getHash(key, field) {
    if (!this.connected) {
      throw new Error('Redis 연결되지 않음');
    }

    try {
      const value = await this.client.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis HGET 실패', { key, field, error: error.message });
      return null;
    }
  }

  isConnected() {
    return this.connected;
  }
}

module.exports = RedisService;