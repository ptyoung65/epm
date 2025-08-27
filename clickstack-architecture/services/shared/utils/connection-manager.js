/**
 * Connection Manager with Retry Logic
 * Handles database and service connections with exponential backoff
 */

const logger = require('./logger');

class ConnectionManager {
  constructor(config = {}) {
    this.config = {
      maxRetries: config.maxRetries || 10,
      initialDelay: config.initialDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      backoffMultiplier: config.backoffMultiplier || 2,
      jitterMax: config.jitterMax || 1000,
      ...config
    };
    
    this.connections = new Map();
    this.retryAttempts = new Map();
  }

  /**
   * Connect with exponential backoff and jitter
   */
  async connectWithRetry(serviceName, connectFunction, healthCheckFunction = null) {
    const maxRetries = this.config.maxRetries;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        logger.info(`${serviceName} 연결 시도 ${attempt + 1}/${maxRetries}`);
        
        const connection = await connectFunction();
        
        // Health check if provided
        if (healthCheckFunction) {
          await healthCheckFunction(connection);
        }
        
        this.connections.set(serviceName, connection);
        this.retryAttempts.delete(serviceName);
        
        logger.info(`✅ ${serviceName} 연결 성공`);
        return connection;
        
      } catch (error) {
        attempt++;
        this.retryAttempts.set(serviceName, attempt);
        
        if (attempt >= maxRetries) {
          logger.error(`❌ ${serviceName} 연결 최종 실패 (${maxRetries}회 시도 후):`, error.message);
          throw new Error(`${serviceName} 연결 실패: ${error.message}`);
        }
        
        const delay = this.calculateDelay(attempt);
        logger.warn(`⚠️ ${serviceName} 연결 실패 (시도 ${attempt}/${maxRetries}), ${delay}ms 후 재시도: ${error.message}`);
        
        await this.sleep(delay);
      }
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  calculateDelay(attempt) {
    const exponentialDelay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
      this.config.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterMax;
    
    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get connection
   */
  getConnection(serviceName) {
    return this.connections.get(serviceName);
  }

  /**
   * Check if service is connected
   */
  isConnected(serviceName) {
    return this.connections.has(serviceName);
  }

  /**
   * Get retry attempts for service
   */
  getRetryAttempts(serviceName) {
    return this.retryAttempts.get(serviceName) || 0;
  }

  /**
   * Disconnect service
   */
  async disconnect(serviceName) {
    const connection = this.connections.get(serviceName);
    if (connection && typeof connection.close === 'function') {
      await connection.close();
    }
    this.connections.delete(serviceName);
    this.retryAttempts.delete(serviceName);
  }

  /**
   * Disconnect all services
   */
  async disconnectAll() {
    const disconnectPromises = Array.from(this.connections.keys())
      .map(serviceName => this.disconnect(serviceName));
    
    await Promise.allSettled(disconnectPromises);
  }

  /**
   * Get connection status for all services
   */
  getStatus() {
    const status = {};
    
    for (const [serviceName, connection] of this.connections) {
      status[serviceName] = {
        connected: true,
        retryAttempts: this.getRetryAttempts(serviceName),
        connection: !!connection
      };
    }
    
    for (const [serviceName, attempts] of this.retryAttempts) {
      if (!status[serviceName]) {
        status[serviceName] = {
          connected: false,
          retryAttempts: attempts,
          connection: false
        };
      }
    }
    
    return status;
  }
}

module.exports = ConnectionManager;