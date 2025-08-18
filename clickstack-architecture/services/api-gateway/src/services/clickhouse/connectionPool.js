/**
 * ClickHouse Connection Pool Manager
 * Optimized for high-throughput operations with failover support
 */

const { createClient } = require('@clickhouse/client');
const EventEmitter = require('events');
const logger = require('../../../utils/logger');

class ClickHouseConnectionPool extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      hosts: config.hosts || [
        { host: process.env.CLICKHOUSE_HOST || 'localhost', port: process.env.CLICKHOUSE_PORT || 8123 }
      ],
      username: config.username || process.env.CLICKHOUSE_USER || 'default',
      password: config.password || process.env.CLICKHOUSE_PASSWORD || '',
      database: config.database || process.env.CLICKHOUSE_DATABASE || 'airis_mon',
      maxConnections: config.maxConnections || 20,
      minConnections: config.minConnections || 5,
      acquireTimeout: config.acquireTimeout || 10000,
      idleTimeout: config.idleTimeout || 30000,
      connectionTimeout: config.connectionTimeout || 5000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      healthCheckInterval: config.healthCheckInterval || 30000,
      timezone: config.timezone || 'Asia/Seoul'
    };

    this.connections = [];
    this.availableConnections = [];
    this.busyConnections = new Set();
    this.waitingQueue = [];
    this.currentHostIndex = 0;
    this.isInitialized = false;
    this.isShuttingDown = false;
    this.healthCheckTimer = null;
    
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      waitingRequests: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalAcquireTime: 0,
      connectionErrors: 0,
      hostFailovers: 0
    };
  }

  /**
   * Initialize the connection pool
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create minimum number of connections
      for (let i = 0; i < this.config.minConnections; i++) {
        await this.createConnection();
      }

      this.startHealthCheck();
      this.isInitialized = true;
      
      logger.info('ClickHouse connection pool initialized', {
        minConnections: this.config.minConnections,
        maxConnections: this.config.maxConnections,
        hosts: this.config.hosts.length
      });

      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize ClickHouse connection pool', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a new connection with failover support
   */
  async createConnection() {
    let lastError;
    
    // Try each host in round-robin fashion
    for (let attempt = 0; attempt < this.config.hosts.length; attempt++) {
      const hostConfig = this.config.hosts[this.currentHostIndex];
      this.currentHostIndex = (this.currentHostIndex + 1) % this.config.hosts.length;
      
      try {
        const client = createClient({
          host: `http://${hostConfig.host}:${hostConfig.port}`,
          username: this.config.username,
          password: this.config.password,
          database: this.config.database,
          request_timeout: this.config.connectionTimeout,
          compression: {
            request: true,
            response: true
          },
          keep_alive: {
            enabled: true,
            idle_socket_ttl: this.config.idleTimeout
          },
          clickhouse_settings: {
            date_time_input_format: 'best_effort',
            date_time_output_format: 'iso',
            timezone: this.config.timezone,
            max_memory_usage: '10000000000',
            max_execution_time: 300
          }
        });

        // Test the connection
        await client.ping();

        const connection = {
          id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          client,
          host: hostConfig,
          createdAt: new Date(),
          lastUsed: new Date(),
          isHealthy: true,
          queryCount: 0
        };

        this.connections.push(connection);
        this.availableConnections.push(connection);
        this.stats.totalConnections++;

        logger.debug('Created ClickHouse connection', {
          connectionId: connection.id,
          host: `${hostConfig.host}:${hostConfig.port}`,
          totalConnections: this.connections.length
        });

        return connection;
      } catch (error) {
        lastError = error;
        this.stats.connectionErrors++;
        
        logger.warn('Failed to connect to ClickHouse host', {
          host: `${hostConfig.host}:${hostConfig.port}`,
          error: error.message,
          attempt: attempt + 1
        });
      }
    }

    // All hosts failed
    this.stats.hostFailovers++;
    throw new Error(`Failed to connect to any ClickHouse host: ${lastError?.message}`);
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire() {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeout);

      const attemptAcquire = async () => {
        try {
          // Check for available connections
          if (this.availableConnections.length > 0) {
            const connection = this.availableConnections.pop();
            this.busyConnections.add(connection);
            connection.lastUsed = new Date();
            this.stats.activeConnections++;
            this.stats.totalAcquireTime += Date.now() - startTime;
            
            clearTimeout(timeoutId);
            resolve(connection);
            return;
          }

          // Try to create new connection if under max limit
          if (this.connections.length < this.config.maxConnections) {
            try {
              const connection = await this.createConnection();
              this.busyConnections.add(connection);
              connection.lastUsed = new Date();
              this.stats.activeConnections++;
              this.stats.totalAcquireTime += Date.now() - startTime;
              
              // Remove from available since we're using it immediately
              const index = this.availableConnections.indexOf(connection);
              if (index > -1) {
                this.availableConnections.splice(index, 1);
              }
              
              clearTimeout(timeoutId);
              resolve(connection);
              return;
            } catch (error) {
              logger.error('Failed to create new connection during acquire', { error: error.message });
            }
          }

          // Add to waiting queue
          this.waitingQueue.push({
            resolve,
            reject,
            startTime,
            timeoutId
          });
          this.stats.waitingRequests = this.waitingQueue.length;

        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      };

      attemptAcquire();
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(connection) {
    if (!connection || !this.busyConnections.has(connection)) {
      logger.warn('Attempted to release invalid or already released connection');
      return;
    }

    this.busyConnections.delete(connection);
    this.stats.activeConnections--;

    // Process waiting queue first
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift();
      this.stats.waitingRequests = this.waitingQueue.length;
      
      clearTimeout(waiter.timeoutId);
      this.busyConnections.add(connection);
      connection.lastUsed = new Date();
      this.stats.activeConnections++;
      this.stats.totalAcquireTime += Date.now() - waiter.startTime;
      
      waiter.resolve(connection);
      return;
    }

    // Check if connection is still healthy
    if (!connection.isHealthy) {
      this.removeConnection(connection);
      return;
    }

    // Return to available pool
    this.availableConnections.push(connection);
  }

  /**
   * Execute query with automatic connection management
   */
  async query(queryString, params = {}, options = {}) {
    const connection = await this.acquire();
    
    try {
      const startTime = Date.now();
      
      const result = await connection.client.query({
        query: queryString,
        query_params: params,
        format: options.format || 'JSON',
        ...options
      });
      
      connection.queryCount++;
      this.stats.successfulQueries++;
      
      const executionTime = Date.now() - startTime;
      logger.debug('ClickHouse query executed', {
        connectionId: connection.id,
        executionTime,
        queryLength: queryString.length
      });

      this.release(connection);
      return result;
    } catch (error) {
      this.stats.failedQueries++;
      
      // Mark connection as unhealthy if it's a connection issue
      if (this.isConnectionError(error)) {
        connection.isHealthy = false;
      }
      
      this.release(connection);
      throw error;
    }
  }

  /**
   * Execute query and return stream
   */
  async stream(queryString, params = {}, options = {}) {
    const connection = await this.acquire();
    
    try {
      const result = await connection.client.query({
        query: queryString,
        query_params: params,
        format: options.format || 'JSONEachRow',
        ...options
      });
      
      connection.queryCount++;
      this.stats.successfulQueries++;
      
      const stream = result.stream();
      
      // Release connection when stream ends
      stream.on('end', () => {
        this.release(connection);
      });
      
      stream.on('error', () => {
        connection.isHealthy = false;
        this.release(connection);
      });

      return stream;
    } catch (error) {
      this.stats.failedQueries++;
      
      if (this.isConnectionError(error)) {
        connection.isHealthy = false;
      }
      
      this.release(connection);
      throw error;
    }
  }

  /**
   * Batch insert with connection pooling
   */
  async insert(table, values, options = {}) {
    const connection = await this.acquire();
    
    try {
      const result = await connection.client.insert({
        table,
        values,
        format: options.format || 'JSONEachRow',
        ...options
      });
      
      connection.queryCount++;
      this.stats.successfulQueries++;
      
      this.release(connection);
      return result;
    } catch (error) {
      this.stats.failedQueries++;
      
      if (this.isConnectionError(error)) {
        connection.isHealthy = false;
      }
      
      this.release(connection);
      throw error;
    }
  }

  /**
   * Remove unhealthy connection
   */
  removeConnection(connection) {
    const connectionIndex = this.connections.indexOf(connection);
    if (connectionIndex > -1) {
      this.connections.splice(connectionIndex, 1);
    }

    const availableIndex = this.availableConnections.indexOf(connection);
    if (availableIndex > -1) {
      this.availableConnections.splice(availableIndex, 1);
    }

    this.busyConnections.delete(connection);
    this.stats.totalConnections--;

    try {
      connection.client.close();
    } catch (error) {
      logger.debug('Error closing unhealthy connection', { error: error.message });
    }

    logger.debug('Removed unhealthy connection', {
      connectionId: connection.id,
      totalConnections: this.connections.length
    });
  }

  /**
   * Start health check timer
   */
  startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on all connections
   */
  async performHealthCheck() {
    const healthyConnections = [];
    const unhealthyConnections = [];

    for (const connection of this.connections) {
      if (this.busyConnections.has(connection)) {
        continue; // Skip busy connections
      }

      try {
        await connection.client.ping();
        connection.isHealthy = true;
        healthyConnections.push(connection);
      } catch (error) {
        connection.isHealthy = false;
        unhealthyConnections.push(connection);
      }
    }

    // Remove unhealthy connections
    for (const connection of unhealthyConnections) {
      this.removeConnection(connection);
    }

    // Ensure minimum connections
    const currentHealthy = this.connections.length;
    if (currentHealthy < this.config.minConnections) {
      const needed = this.config.minConnections - currentHealthy;
      for (let i = 0; i < needed; i++) {
        try {
          await this.createConnection();
        } catch (error) {
          logger.error('Failed to create replacement connection during health check', {
            error: error.message
          });
        }
      }
    }

    logger.debug('Health check completed', {
      healthy: healthyConnections.length,
      unhealthy: unhealthyConnections.length,
      total: this.connections.length
    });
  }

  /**
   * Check if error is connection-related
   */
  isConnectionError(error) {
    const connectionErrorCodes = [
      'ECONNREFUSED',
      'ENOTFOUND', 
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE'
    ];
    
    return connectionErrorCodes.some(code => error.code === code || error.message.includes(code));
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalConnections: this.connections.length,
      availableConnections: this.availableConnections.length,
      busyConnections: this.busyConnections.size,
      waitingRequests: this.waitingQueue.length,
      avgAcquireTime: this.stats.successfulQueries > 0 ? 
        this.stats.totalAcquireTime / this.stats.successfulQueries : 0
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new Error('Connection pool is shutting down'));
    }
    this.waitingQueue = [];

    // Close all connections
    const closePromises = this.connections.map(async (connection) => {
      try {
        await connection.client.close();
      } catch (error) {
        logger.debug('Error closing connection during shutdown', { error: error.message });
      }
    });

    await Promise.all(closePromises);

    this.connections = [];
    this.availableConnections = [];
    this.busyConnections.clear();

    logger.info('ClickHouse connection pool shutdown complete');
    this.emit('shutdown');
  }
}

module.exports = ClickHouseConnectionPool;