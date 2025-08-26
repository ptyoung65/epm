import { EventEmitter } from 'events';
import { Logger } from 'winston';

export interface BulkheadConfig {
  name: string;
  maxConcurrentCalls: number;
  maxQueueSize: number;
  timeout?: number;
  logger?: Logger;
}

export interface BulkheadStats {
  name: string;
  activeCalls: number;
  queuedCalls: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  maxConcurrentCalls: number;
  maxQueueSize: number;
  averageExecutionTime: number;
}

export interface QueuedCall {
  id: string;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  startTime: number;
  timeout?: NodeJS.Timeout;
}

/**
 * Bulkhead pattern implementation to isolate resources and prevent cascade failures
 */
export class BulkheadPattern extends EventEmitter {
  private config: BulkheadConfig;
  private activeCalls: Set<string> = new Set();
  private callQueue: QueuedCall[] = [];
  private stats: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    rejectedCalls: number;
    executionTimes: number[];
  } = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    rejectedCalls: 0,
    executionTimes: []
  };
  private callIdCounter = 0;

  constructor(config: BulkheadConfig) {
    super();
    this.config = {
      timeout: 30000,
      ...config
    };

    this.validateConfig();
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.maxConcurrentCalls <= 0) {
      throw new Error('maxConcurrentCalls must be greater than 0');
    }
    
    if (this.config.maxQueueSize < 0) {
      throw new Error('maxQueueSize must be greater than or equal to 0');
    }
    
    if (this.config.timeout && this.config.timeout <= 0) {
      throw new Error('timeout must be greater than 0');
    }
  }

  /**
   * Execute function with bulkhead protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const callId = this.generateCallId();
      const startTime = Date.now();
      
      this.stats.totalCalls++;
      
      // Check if we can execute immediately
      if (this.activeCalls.size < this.config.maxConcurrentCalls) {
        this.executeCall(callId, fn, resolve, reject, startTime);
      } else {
        // Check if queue has space
        if (this.callQueue.length >= this.config.maxQueueSize) {
          this.stats.rejectedCalls++;
          const error = new Error(`Bulkhead queue is full (${this.config.maxQueueSize}). Call rejected.`);
          
          this.emit('call.rejected', {
            bulkhead: this.config.name,
            callId,
            queueSize: this.callQueue.length,
            activeCalls: this.activeCalls.size,
            error
          });
          
          if (this.config.logger) {
            this.config.logger.warn(`Bulkhead ${this.config.name} queue full, rejecting call`, {
              queueSize: this.callQueue.length,
              activeCalls: this.activeCalls.size
            });
          }
          
          reject(error);
          return;
        }
        
        // Add to queue
        const queuedCall: QueuedCall = {
          id: callId,
          fn,
          resolve,
          reject,
          startTime
        };
        
        // Set timeout for queued call if configured
        if (this.config.timeout) {
          queuedCall.timeout = setTimeout(() => {
            this.removeFromQueue(callId);
            this.stats.failedCalls++;
            
            const error = new Error(`Bulkhead call timeout after ${this.config.timeout}ms while queued`);
            
            this.emit('call.timeout', {
              bulkhead: this.config.name,
              callId,
              queueTime: Date.now() - startTime,
              error
            });
            
            reject(error);
          }, this.config.timeout);
        }
        
        this.callQueue.push(queuedCall);
        
        this.emit('call.queued', {
          bulkhead: this.config.name,
          callId,
          queueSize: this.callQueue.length,
          activeCalls: this.activeCalls.size
        });
        
        if (this.config.logger) {
          this.config.logger.debug(`Call queued in bulkhead ${this.config.name}`, {
            callId,
            queueSize: this.callQueue.length,
            activeCalls: this.activeCalls.size
          });
        }
      }
    });
  }

  /**
   * Execute a call immediately
   */
  private async executeCall<T>(
    callId: string,
    fn: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (error: any) => void,
    startTime: number
  ): Promise<void> {
    this.activeCalls.add(callId);
    
    this.emit('call.started', {
      bulkhead: this.config.name,
      callId,
      activeCalls: this.activeCalls.size
    });
    
    if (this.config.logger) {
      this.config.logger.debug(`Executing call in bulkhead ${this.config.name}`, {
        callId,
        activeCalls: this.activeCalls.size
      });
    }
    
    let timeoutHandle: NodeJS.Timeout | undefined;
    
    try {
      // Set execution timeout if configured
      if (this.config.timeout) {
        timeoutHandle = setTimeout(() => {
          const error = new Error(`Bulkhead call timeout after ${this.config.timeout}ms during execution`);
          
          this.emit('call.timeout', {
            bulkhead: this.config.name,
            callId,
            executionTime: Date.now() - startTime,
            error
          });
          
          reject(error);
        }, this.config.timeout);
      }
      
      const result = await fn();
      
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      
      const executionTime = Date.now() - startTime;
      this.stats.successfulCalls++;
      this.stats.executionTimes.push(executionTime);
      
      // Keep only last 1000 execution times for memory efficiency
      if (this.stats.executionTimes.length > 1000) {
        this.stats.executionTimes = this.stats.executionTimes.slice(-1000);
      }
      
      this.emit('call.success', {
        bulkhead: this.config.name,
        callId,
        executionTime,
        activeCalls: this.activeCalls.size - 1
      });
      
      if (this.config.logger) {
        this.config.logger.debug(`Call completed successfully in bulkhead ${this.config.name}`, {
          callId,
          executionTime
        });
      }
      
      resolve(result);
      
    } catch (error) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      
      const executionTime = Date.now() - startTime;
      this.stats.failedCalls++;
      
      this.emit('call.error', {
        bulkhead: this.config.name,
        callId,
        executionTime,
        activeCalls: this.activeCalls.size - 1,
        error
      });
      
      if (this.config.logger) {
        this.config.logger.warn(`Call failed in bulkhead ${this.config.name}`, {
          callId,
          executionTime,
          error: error.message
        });
      }
      
      reject(error);
      
    } finally {
      this.activeCalls.delete(callId);
      
      // Process next call in queue
      this.processQueue();
    }
  }

  /**
   * Process next call in queue
   */
  private processQueue(): void {
    if (this.callQueue.length > 0 && this.activeCalls.size < this.config.maxConcurrentCalls) {
      const queuedCall = this.callQueue.shift()!;
      
      // Clear timeout since we're executing now
      if (queuedCall.timeout) {
        clearTimeout(queuedCall.timeout);
      }
      
      this.emit('call.dequeued', {
        bulkhead: this.config.name,
        callId: queuedCall.id,
        queueTime: Date.now() - queuedCall.startTime,
        remainingInQueue: this.callQueue.length
      });
      
      this.executeCall(
        queuedCall.id,
        queuedCall.fn,
        queuedCall.resolve,
        queuedCall.reject,
        queuedCall.startTime
      );
    }
  }

  /**
   * Remove call from queue
   */
  private removeFromQueue(callId: string): void {
    const index = this.callQueue.findIndex(call => call.id === callId);
    if (index > -1) {
      const queuedCall = this.callQueue.splice(index, 1)[0];
      if (queuedCall.timeout) {
        clearTimeout(queuedCall.timeout);
      }
    }
  }

  /**
   * Generate unique call ID
   */
  private generateCallId(): string {
    return `${this.config.name}-${++this.callIdCounter}-${Date.now()}`;
  }

  /**
   * Get current statistics
   */
  getStats(): BulkheadStats {
    const averageExecutionTime = this.stats.executionTimes.length > 0
      ? this.stats.executionTimes.reduce((sum, time) => sum + time, 0) / this.stats.executionTimes.length
      : 0;
    
    return {
      name: this.config.name,
      activeCalls: this.activeCalls.size,
      queuedCalls: this.callQueue.length,
      totalCalls: this.stats.totalCalls,
      successfulCalls: this.stats.successfulCalls,
      failedCalls: this.stats.failedCalls,
      rejectedCalls: this.stats.rejectedCalls,
      maxConcurrentCalls: this.config.maxConcurrentCalls,
      maxQueueSize: this.config.maxQueueSize,
      averageExecutionTime: Math.round(averageExecutionTime)
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): BulkheadConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (some properties)
   */
  updateConfig(updates: Partial<Pick<BulkheadConfig, 'timeout'>>): void {
    if (updates.timeout !== undefined) {
      if (updates.timeout <= 0) {
        throw new Error('timeout must be greater than 0');
      }
      this.config.timeout = updates.timeout;
    }
  }

  /**
   * Check if bulkhead is healthy
   */
  isHealthy(): boolean {
    const stats = this.getStats();
    const queueUtilization = stats.queuedCalls / Math.max(stats.maxQueueSize, 1);
    const activeUtilization = stats.activeCalls / stats.maxConcurrentCalls;
    
    // Consider unhealthy if queue is more than 80% full or active calls are at max
    return queueUtilization < 0.8 && activeUtilization < 1.0;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      executionTimes: []
    };
    
    this.emit('stats.reset', {
      bulkhead: this.config.name
    });
  }

  /**
   * Clear all queued calls
   */
  clearQueue(): void {
    const clearedCalls = this.callQueue.length;
    
    // Reject all queued calls
    this.callQueue.forEach(queuedCall => {
      if (queuedCall.timeout) {
        clearTimeout(queuedCall.timeout);
      }
      
      const error = new Error('Bulkhead queue cleared');
      queuedCall.reject(error);
    });
    
    this.callQueue = [];
    this.stats.rejectedCalls += clearedCalls;
    
    this.emit('queue.cleared', {
      bulkhead: this.config.name,
      clearedCalls
    });
    
    if (this.config.logger) {
      this.config.logger.info(`Cleared ${clearedCalls} calls from bulkhead ${this.config.name} queue`);
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    details: {
      queueUtilization: number;
      activeUtilization: number;
      successRate: number;
      avgExecutionTime: number;
    };
  } {
    const stats = this.getStats();
    const queueUtilization = stats.queuedCalls / Math.max(stats.maxQueueSize, 1);
    const activeUtilization = stats.activeCalls / stats.maxConcurrentCalls;
    const successRate = stats.totalCalls > 0 
      ? stats.successfulCalls / stats.totalCalls 
      : 1;
    
    return {
      healthy: this.isHealthy(),
      details: {
        queueUtilization: Math.round(queueUtilization * 100) / 100,
        activeUtilization: Math.round(activeUtilization * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        avgExecutionTime: stats.averageExecutionTime
      }
    };
  }
}