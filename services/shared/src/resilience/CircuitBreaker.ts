import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  timeout?: number;              // Request timeout in ms
  errorThreshold?: number;       // Error percentage to open circuit
  volumeThreshold?: number;      // Minimum requests before calculating error percentage
  sleepWindow?: number;          // Time to wait before trying half-open
  requestVolumeThreshold?: number; // Rolling window size
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  errorPercentage: number;
  lastFailureTime?: Date;
  nextAttempt?: Date;
}

export class CircuitBreaker extends EventEmitter {
  private name: string;
  private state: CircuitState = CircuitState.CLOSED;
  private options: Required<CircuitBreakerOptions>;
  private failures: number = 0;
  private successes: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime?: Date;
  private nextAttempt?: Date;
  private requestWindow: Array<{ timestamp: number; success: boolean }> = [];

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    super();
    this.name = name;
    this.options = {
      timeout: options.timeout || 3000,
      errorThreshold: options.errorThreshold || 50,
      volumeThreshold: options.volumeThreshold || 20,
      sleepWindow: options.sleepWindow || 60000,
      requestVolumeThreshold: options.requestVolumeThreshold || 20
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.halfOpen();
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Circuit breaker timeout')), this.options.timeout)
      )
    ]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;
    this.successes++;
    this.totalRequests++;
    this.recordRequest(true);

    if (this.state === CircuitState.HALF_OPEN) {
      this.close();
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.totalRequests++;
    this.lastFailureTime = new Date();
    this.recordRequest(false);

    if (this.state === CircuitState.HALF_OPEN) {
      this.open();
    } else if (this.state === CircuitState.CLOSED) {
      const errorPercentage = this.calculateErrorPercentage();
      if (this.shouldOpen(errorPercentage)) {
        this.open();
      }
    }
  }

  /**
   * Record request in rolling window
   */
  private recordRequest(success: boolean): void {
    const now = Date.now();
    this.requestWindow.push({ timestamp: now, success });

    // Remove old requests outside the window
    const windowStart = now - (this.options.requestVolumeThreshold * 1000);
    this.requestWindow = this.requestWindow.filter(r => r.timestamp > windowStart);
  }

  /**
   * Calculate error percentage from rolling window
   */
  private calculateErrorPercentage(): number {
    if (this.requestWindow.length < this.options.volumeThreshold) {
      return 0;
    }

    const failures = this.requestWindow.filter(r => !r.success).length;
    return (failures / this.requestWindow.length) * 100;
  }

  /**
   * Check if circuit should open
   */
  private shouldOpen(errorPercentage: number): boolean {
    return this.requestWindow.length >= this.options.volumeThreshold &&
           errorPercentage >= this.options.errorThreshold;
  }

  /**
   * Check if should attempt reset
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttempt && new Date() >= this.nextAttempt;
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.options.sleepWindow);
    this.emit('open', this.name);
  }

  /**
   * Close the circuit
   */
  private close(): void {
    this.state = CircuitState.CLOSED;
    this.nextAttempt = undefined;
    this.failures = 0;
    this.emit('close', this.name);
  }

  /**
   * Half-open the circuit
   */
  private halfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.emit('halfOpen', this.name);
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      errorPercentage: this.calculateErrorPercentage(),
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.lastFailureTime = undefined;
    this.nextAttempt = undefined;
    this.requestWindow = [];
    this.emit('reset', this.name);
  }

  /**
   * Get circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }
}

/**
 * Circuit breaker factory
 */
export class CircuitBreakerFactory {
  private static breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  static getInstance(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  static getAllBreakers(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Get statistics for all breakers
   */
  static getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }

  /**
   * Clear all circuit breakers
   */
  static clear(): void {
    this.breakers.clear();
  }
}