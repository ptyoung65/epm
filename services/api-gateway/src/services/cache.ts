import Redis from 'ioredis';
import { logger } from '@/utils/logger';

/**
 * Redis cache service with advanced features
 */
export class RedisCache {
  private client: Redis;
  private keyPrefix: string;
  private defaultTTL: number;
  private isConnected: boolean = false;

  constructor(config: {
    url: string;
    keyPrefix?: string;
    ttl?: number;
  }) {
    this.keyPrefix = config.keyPrefix || 'airis:epm:';
    this.defaultTTL = config.ttl || 3600;

    this.client = new Redis(config.url, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      commandTimeout: 5000,
      lazyConnect: true,
      keyPrefix: this.keyPrefix,
    });

    this.setupEventHandlers();
    this.connect();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis ready');
    });

    this.client.on('error', (error) => {
      logger.error('Redis error', { error: error.message });
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting');
    });
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', { error: error.message });
      throw error;
    }
  }

  /**
   * Get value by key
   */
  public async get<T = string>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        logger.warn('Redis not connected, skipping get operation');
        return null;
      }

      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }

      // Try to parse JSON, fallback to string
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    } catch (error) {
      logger.error('Redis get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value with optional TTL
   */
  public async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        logger.warn('Redis not connected, skipping set operation');
        return false;
      }

      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      const expirationTime = ttl || this.defaultTTL;

      await this.client.setex(key, expirationTime, serializedValue);
      return true;
    } catch (error) {
      logger.error('Redis set error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Set value with expiration time
   */
  public async setex(key: string, seconds: number, value: any): Promise<boolean> {
    return this.set(key, value, seconds);
  }

  /**
   * Delete key
   */
  public async del(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        logger.warn('Redis not connected, skipping delete operation');
        return false;
      }

      const result = await this.client.del(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis delete error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logger.error('Redis expire error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get multiple keys
   */
  public async mget<T = string>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (!this.isConnected || keys.length === 0) {
        return keys.map(() => null);
      }

      const values = await this.client.mget(...keys);
      return values.map(value => {
        if (value === null) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      logger.error('Redis mget error', { keys, error: error.message });
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  public async mset(keyValues: Record<string, any>, ttl?: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const pipeline = this.client.pipeline();
      
      Object.entries(keyValues).forEach(([key, value]) => {
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttl) {
          pipeline.setex(key, ttl, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Redis mset error', { error: error.message });
      return false;
    }
  }

  /**
   * Increment counter
   */
  public async incr(key: string, ttl?: number): Promise<number> {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const pipeline = this.client.pipeline();
      pipeline.incr(key);
      
      if (ttl) {
        pipeline.expire(key, ttl);
      }

      const results = await pipeline.exec();
      return results?.[0]?.[1] as number || 0;
    } catch (error) {
      logger.error('Redis incr error', { key, error: error.message });
      return 0;
    }
  }

  /**
   * Get keys by pattern
   */
  public async keys(pattern: string): Promise<string[]> {
    try {
      if (!this.isConnected) {
        return [];
      }

      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis keys error', { pattern, error: error.message });
      return [];
    }
  }

  /**
   * Flush all data
   */
  public async flushall(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.flushall();
      return true;
    } catch (error) {
      logger.error('Redis flushall error', { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
    uptime: number;
  }> {
    try {
      if (!this.isConnected) {
        return {
          connected: false,
          keyCount: 0,
          memoryUsage: '0B',
          uptime: 0,
        };
      }

      const info = await this.client.info('server,memory,keyspace');
      const lines = info.split('\r\n');
      
      let keyCount = 0;
      let memoryUsage = '0B';
      let uptime = 0;

      lines.forEach(line => {
        if (line.startsWith('db0:')) {
          const match = line.match(/keys=(\d+)/);
          if (match) keyCount = parseInt(match[1]);
        } else if (line.startsWith('used_memory_human:')) {
          memoryUsage = line.split(':')[1];
        } else if (line.startsWith('uptime_in_seconds:')) {
          uptime = parseInt(line.split(':')[1]);
        }
      });

      return {
        connected: this.isConnected,
        keyCount,
        memoryUsage,
        uptime,
      };
    } catch (error) {
      logger.error('Redis stats error', { error: error.message });
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: '0B',
        uptime: 0,
      };
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Redis disconnect error', { error: error.message });
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed', { error: error.message });
      return false;
    }
  }
}