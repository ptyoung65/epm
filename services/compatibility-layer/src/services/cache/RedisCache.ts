import { createClient, RedisClientType } from 'redis';
import { logger } from '../../utils/logger';

/**
 * Redis cache configuration interface
 */
interface RedisCacheConfig {
  url: string;
  keyPrefix?: string;
  ttl?: number;
}

/**
 * Redis Cache Service
 * 
 * Provides caching functionality for the compatibility layer
 */
export class RedisCache {
  private client: RedisClientType;
  private isConnected = false;
  private connectionRetries = 0;
  private readonly maxRetries = 5;
  private readonly retryDelay = 1000; // milliseconds
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;

  constructor(private config: RedisCacheConfig) {
    this.keyPrefix = config.keyPrefix || 'airis:compat:';
    this.defaultTTL = config.ttl || 3600; // 1 hour default
    
    this.client = createClient({
      url: config.url,
      socket: {
        connectTimeout: 10000,
        lazyConnect: true,
      },
      retryDelayOnFailover: 1000,
      retryDelayOnClusterDown: 1000,
    });

    this.setupEventHandlers();
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.client.connect();
      this.isConnected = true;
      this.connectionRetries = 0;
      
      logger.info('Redis cache connected', {
        url: this.config.url.replace(/\/\/.*@/, '//**:**@'), // Mask credentials
        keyPrefix: this.keyPrefix,
        defaultTTL: this.defaultTTL,
      });
    } catch (error) {
      this.connectionRetries++;
      logger.error('Failed to connect to Redis cache', {
        error: error.message,
        retries: this.connectionRetries,
        maxRetries: this.maxRetries,
      });

      if (this.connectionRetries < this.maxRetries) {
        logger.info(`Retrying Redis connection in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      } else {
        throw new Error(`Failed to connect to Redis after ${this.maxRetries} attempts`);
      }
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis cache disconnected');
    } catch (error) {
      logger.warn('Error disconnecting from Redis cache', {
        error: error.message,
      });
    }
  }

  /**
   * Set a key-value pair with optional TTL
   */
  public async set(key: string, value: string, ttl?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const expiry = ttl || this.defaultTTL;

    try {
      if (expiry > 0) {
        await this.client.setEx(fullKey, expiry, value);
      } else {
        await this.client.set(fullKey, value);
      }
      
      logger.debug('Cache SET operation completed', {
        key: fullKey,
        valueLength: value.length,
        ttl: expiry,
      });
    } catch (error) {
      logger.error('Cache SET operation failed', {
        key: fullKey,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Set a key-value pair with expiration time
   */
  public async setex(key: string, seconds: number, value: string): Promise<void> {
    return this.set(key, value, seconds);
  }

  /**
   * Get a value by key
   */
  public async get(key: string): Promise<string | null> {
    const fullKey = this.getFullKey(key);

    try {
      const value = await this.client.get(fullKey);
      
      logger.debug('Cache GET operation completed', {
        key: fullKey,
        found: value !== null,
        valueLength: value?.length || 0,
      });
      
      return value;
    } catch (error) {
      logger.error('Cache GET operation failed', {
        key: fullKey,
        error: error.message,
      });
      return null; // Return null on error to allow fallback behavior
    }
  }

  /**
   * Delete a key
   */
  public async del(key: string): Promise<number> {
    const fullKey = this.getFullKey(key);

    try {
      const result = await this.client.del(fullKey);
      
      logger.debug('Cache DELETE operation completed', {
        key: fullKey,
        deleted: result > 0,
      });
      
      return result;
    } catch (error) {
      logger.error('Cache DELETE operation failed', {
        key: fullKey,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    try {
      const result = await this.client.exists(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Cache EXISTS operation failed', {
        key: fullKey,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    try {
      const result = await this.client.expire(fullKey, seconds);
      return result;
    } catch (error) {
      logger.error('Cache EXPIRE operation failed', {
        key: fullKey,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get time to live for a key
   */
  public async ttl(key: string): Promise<number> {
    const fullKey = this.getFullKey(key);

    try {
      return await this.client.ttl(fullKey);
    } catch (error) {
      logger.error('Cache TTL operation failed', {
        key: fullKey,
        error: error.message,
      });
      return -1;
    }
  }

  /**
   * Increment a numeric value
   */
  public async incr(key: string): Promise<number> {
    const fullKey = this.getFullKey(key);

    try {
      return await this.client.incr(fullKey);
    } catch (error) {
      logger.error('Cache INCR operation failed', {
        key: fullKey,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Increment a numeric value by a specific amount
   */
  public async incrby(key: string, increment: number): Promise<number> {
    const fullKey = this.getFullKey(key);

    try {
      return await this.client.incrBy(fullKey, increment);
    } catch (error) {
      logger.error('Cache INCRBY operation failed', {
        key: fullKey,
        increment,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add members to a set
   */
  public async sadd(key: string, ...members: string[]): Promise<number> {
    const fullKey = this.getFullKey(key);

    try {
      return await this.client.sAdd(fullKey, members);
    } catch (error) {
      logger.error('Cache SADD operation failed', {
        key: fullKey,
        memberCount: members.length,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all members of a set
   */
  public async smembers(key: string): Promise<string[]> {
    const fullKey = this.getFullKey(key);

    try {
      return await this.client.sMembers(fullKey);
    } catch (error) {
      logger.error('Cache SMEMBERS operation failed', {
        key: fullKey,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Remove members from a set
   */
  public async srem(key: string, ...members: string[]): Promise<number> {
    const fullKey = this.getFullKey(key);

    try {
      return await this.client.sRem(fullKey, members);
    } catch (error) {
      logger.error('Cache SREM operation failed', {
        key: fullKey,
        memberCount: members.length,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get hash field value
   */
  public async hget(key: string, field: string): Promise<string | null> {
    const fullKey = this.getFullKey(key);

    try {
      return await this.client.hGet(fullKey, field);
    } catch (error) {
      logger.error('Cache HGET operation failed', {
        key: fullKey,
        field,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Set hash field value
   */
  public async hset(key: string, field: string, value: string): Promise<number> {
    const fullKey = this.getFullKey(key);

    try {
      return await this.client.hSet(fullKey, field, value);
    } catch (error) {
      logger.error('Cache HSET operation failed', {
        key: fullKey,
        field,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get all hash fields and values
   */
  public async hgetall(key: string): Promise<Record<string, string>> {
    const fullKey = this.getFullKey(key);

    try {
      return await this.client.hGetAll(fullKey);
    } catch (error) {
      logger.error('Cache HGETALL operation failed', {
        key: fullKey,
        error: error.message,
      });
      return {};
    }
  }

  /**
   * Clear all keys matching a pattern
   */
  public async clear(pattern?: string): Promise<number> {
    try {
      const searchPattern = pattern ? this.getFullKey(pattern) : `${this.keyPrefix}*`;
      const keys = await this.client.keys(searchPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await this.client.del(keys);
      
      logger.info('Cache cleared', {
        pattern: searchPattern,
        keysDeleted: result,
      });
      
      return result;
    } catch (error) {
      logger.error('Cache CLEAR operation failed', {
        pattern,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    connected: boolean;
    keys: number;
    memory: any;
    info: any;
  }> {
    try {
      const keys = await this.client.keys(`${this.keyPrefix}*`);
      const info = await this.client.info('memory');
      
      return {
        connected: this.isConnected,
        keys: keys.length,
        memory: this.parseMemoryInfo(info),
        info: {
          keyPrefix: this.keyPrefix,
          defaultTTL: this.defaultTTL,
        },
      };
    } catch (error) {
      logger.error('Failed to get cache statistics', {
        error: error.message,
      });
      
      return {
        connected: this.isConnected,
        keys: 0,
        memory: {},
        info: {
          error: error.message,
        },
      };
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    connected: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        connected: this.isConnected,
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
      };
    }
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('error', (error) => {
      logger.error('Redis client error', {
        error: error.message,
        stack: error.stack,
      });
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.debug('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.debug('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      logger.debug('Redis client disconnected');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });
  }

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Parse Redis memory info
   */
  private parseMemoryInfo(info: string): any {
    const lines = info.split('\r\n');
    const memory: any = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.startsWith('used_memory')) {
          memory[key] = parseInt(value, 10) || value;
        }
      }
    });
    
    return memory;
  }

  /**
   * Get connection status
   */
  public get connected(): boolean {
    return this.isConnected;
  }
}
