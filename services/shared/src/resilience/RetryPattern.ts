import { EventEmitter } from 'events';
import { Logger } from 'winston';

export interface RetryConfig {
  name: string;
  maxRetries: number;
  initialDelay: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryCondition?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number, delay: number) => void;
  logger?: Logger;
}

export interface RetryStats {
  name: string;
  totalAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  totalExecutions: number;
  averageAttempts: number;
  maxAttemptsUsed: number;
}

export interface RetryExecution {
  id: string;
  startTime: number;
  attempts: number;
  delays: number[];
  errors: any[];
}

/**
 * Retry pattern implementation with configurable backoff strategies
 */
export class RetryPattern extends EventEmitter {
  private config: RetryConfig;
  private stats: {
    totalAttempts: number;
    successfulRetries: number;
    failedRetries: number;
    totalExecutions: number;
    attempts: number[];
  } = {
    totalAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0,
    totalExecutions: 0,
    attempts: []
  };
  private executionIdCounter = 0;

  constructor(config: RetryConfig) {
    super();
    this.config = {
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryCondition: (error: any) => this.defaultRetryCondition(error),
      ...config
    };

    this.validateConfig();
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.maxRetries < 0) {
      throw new Error('maxRetries must be greater than or equal to 0');
    }
    
    if (this.config.initialDelay <= 0) {
      throw new Error('initialDelay must be greater than 0');
    }
    
    if (this.config.maxDelay && this.config.maxDelay <= 0) {
      throw new Error('maxDelay must be greater than 0');
    }
    
    if (this.config.backoffMultiplier && this.config.backoffMultiplier <= 0) {
      throw new Error('backoffMultiplier must be greater than 0');
    }
  }

  /**
   * Default retry condition - retry on network and temporary errors
   */
  private defaultRetryCondition(error: any): boolean {
    // Retry on network errors
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Retry on HTTP 5xx errors and 429 (rate limited)
    if (error.response?.status >= 500 || error.response?.status === 429) {
      return true;
    }
    
    // Retry on specific error messages
    if (error.message?.includes('timeout') || 
        error.message?.includes('connection') ||
        error.message?.includes('network')) {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate delay for next retry
   */
  private calculateDelay(attempt: number): number {
    let delay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier!, attempt);
    
    // Apply maximum delay limit
    if (this.config.maxDelay) {
      delay = Math.min(delay, this.config.maxDelay);
    }
    
    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.round(delay);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `${this.config.name}-${++this.executionIdCounter}-${Date.now()}`;
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();
    let attempt = 0;
    const delays: number[] = [];
    const errors: any[] = [];
    
    this.stats.totalExecutions++;
    
    const execution: RetryExecution = {
      id: executionId,
      startTime,
      attempts: 0,
      delays,
      errors
    };
    
    this.emit('execution.started', {
      retry: this.config.name,
      executionId,
      maxRetries: this.config.maxRetries
    });
    
    if (this.config.logger) {
      this.config.logger.debug(`Starting retry execution ${executionId}`, {
        maxRetries: this.config.maxRetries
      });
    }
    
    while (attempt <= this.config.maxRetries) {
      execution.attempts = attempt + 1;
      this.stats.totalAttempts++;
      
      try {
        this.emit('attempt.started', {
          retry: this.config.name,
          executionId,
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries + 1
        });
        
        const result = await fn();
        
        // Success
        const executionTime = Date.now() - startTime;
        this.stats.attempts.push(attempt + 1);
        
        // Keep only last 1000 attempts for memory efficiency
        if (this.stats.attempts.length > 1000) {
          this.stats.attempts = this.stats.attempts.slice(-1000);
        }
        
        if (attempt > 0) {
          this.stats.successfulRetries++;
        }
        
        this.emit('execution.success', {
          retry: this.config.name,
          executionId,
          attempts: attempt + 1,
          executionTime,
          totalDelays: delays.reduce((sum, delay) => sum + delay, 0)
        });
        
        if (this.config.logger) {
          this.config.logger.debug(`Retry execution ${executionId} succeeded`, {
            attempts: attempt + 1,
            executionTime,
            totalDelays: delays.reduce((sum, delay) => sum + delay, 0)
          });
        }
        
        return result;
        
      } catch (error) {
        errors.push(error);
        
        this.emit('attempt.failed', {
          retry: this.config.name,
          executionId,
          attempt: attempt + 1,
          error,
          willRetry: attempt < this.config.maxRetries && this.config.retryCondition!(error, attempt + 1)
        });
        
        // Check if we should retry
        if (attempt >= this.config.maxRetries || !this.config.retryCondition!(error, attempt + 1)) {
          // No more retries or condition not met
          const executionTime = Date.now() - startTime;
          this.stats.failedRetries++;
          this.stats.attempts.push(attempt + 1);
          
          // Keep only last 1000 attempts for memory efficiency
          if (this.stats.attempts.length > 1000) {
            this.stats.attempts = this.stats.attempts.slice(-1000);
          }
          
          this.emit('execution.failed', {
            retry: this.config.name,
            executionId,
            attempts: attempt + 1,
            executionTime,
            totalDelays: delays.reduce((sum, delay) => sum + delay, 0),
            finalError: error,
            allErrors: errors
          });
          
          if (this.config.logger) {
            this.config.logger.warn(`Retry execution ${executionId} failed permanently`, {
              attempts: attempt + 1,
              executionTime,
              error: error.message,
              retryConditionMet: this.config.retryCondition!(error, attempt + 1)
            });
          }
          
          throw error;
        }
        
        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);
        delays.push(delay);
        
        // Call onRetry callback if provided
        if (this.config.onRetry) {
          this.config.onRetry(error, attempt + 1, delay);
        }
        
        this.emit('retry.scheduled', {
          retry: this.config.name,
          executionId,
          attempt: attempt + 1,
          delay,
          error,
          nextAttempt: attempt + 2
        });
        
        if (this.config.logger) {
          this.config.logger.debug(`Retry execution ${executionId} scheduled`, {
            attempt: attempt + 1,
            delay,
            error: error.message,
            nextAttempt: attempt + 2
          });
        }
        
        await this.sleep(delay);
        
        this.emit('retry.started', {
          retry: this.config.name,
          executionId,
          attempt: attempt + 2,
          previousError: error
        });
        
        attempt++;
      }
    }
    
    // This should never be reached, but just in case
    throw new Error('Retry execution completed without result');
  }

  /**
   * Execute with custom retry condition
   */
  async executeWithCondition<T>(
    fn: () => Promise<T>,
    retryCondition: (error: any, attempt: number) => boolean
  ): Promise<T> {
    const originalCondition = this.config.retryCondition;
    this.config.retryCondition = retryCondition;
    
    try {
      return await this.execute(fn);
    } finally {
      this.config.retryCondition = originalCondition;
    }
  }

  /**
   * Execute with custom max retries
   */
  async executeWithMaxRetries<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
    const originalMaxRetries = this.config.maxRetries;
    this.config.maxRetries = maxRetries;
    
    try {
      return await this.execute(fn);
    } finally {
      this.config.maxRetries = originalMaxRetries;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): RetryStats {
    const averageAttempts = this.stats.attempts.length > 0
      ? this.stats.attempts.reduce((sum, attempts) => sum + attempts, 0) / this.stats.attempts.length
      : 0;
    
    const maxAttemptsUsed = this.stats.attempts.length > 0
      ? Math.max(...this.stats.attempts)
      : 0;
    
    return {
      name: this.config.name,
      totalAttempts: this.stats.totalAttempts,
      successfulRetries: this.stats.successfulRetries,
      failedRetries: this.stats.failedRetries,
      totalExecutions: this.stats.totalExecutions,
      averageAttempts: Math.round(averageAttempts * 100) / 100,
      maxAttemptsUsed
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RetryConfig>): void {
    const newConfig = { ...this.config, ...updates };
    
    // Re-validate with new config
    const tempConfig = this.config;
    this.config = newConfig;
    
    try {
      this.validateConfig();
    } catch (error) {
      // Revert on validation error
      this.config = tempConfig;
      throw error;
    }
    
    this.emit('config.updated', {
      retry: this.config.name,
      oldConfig: tempConfig,
      newConfig: this.config
    });
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      totalExecutions: 0,
      attempts: []
    };
    
    this.emit('stats.reset', {
      retry: this.config.name
    });
  }

  /**
   * Check if retry mechanism is healthy
   */
  isHealthy(): boolean {
    const stats = this.getStats();
    
    // Consider healthy if:
    // - Success rate is above 50% (including first attempts)
    // - Average attempts is reasonable (less than 75% of max)
    if (stats.totalExecutions === 0) {
      return true; // No data yet, assume healthy
    }
    
    const successRate = (stats.totalExecutions - stats.failedRetries) / stats.totalExecutions;
    const attemptsRatio = stats.averageAttempts / (this.config.maxRetries + 1);
    
    return successRate >= 0.5 && attemptsRatio < 0.75;
  }

  /**
   * Get health status with details
   */
  getHealthStatus(): {
    healthy: boolean;
    details: {
      successRate: number;
      averageAttempts: number;
      attemptsRatio: number;
      recentFailures: number;
    };
  } {
    const stats = this.getStats();
    const successRate = stats.totalExecutions > 0 
      ? (stats.totalExecutions - stats.failedRetries) / stats.totalExecutions 
      : 1;
    const attemptsRatio = stats.averageAttempts / (this.config.maxRetries + 1);
    
    // Calculate recent failures (last 10 executions)
    const recentAttempts = this.stats.attempts.slice(-10);
    const recentFailures = recentAttempts.filter(attempts => attempts > this.config.maxRetries).length;
    
    return {
      healthy: this.isHealthy(),
      details: {
        successRate: Math.round(successRate * 100) / 100,
        averageAttempts: stats.averageAttempts,
        attemptsRatio: Math.round(attemptsRatio * 100) / 100,
        recentFailures
      }
    };
  }
}