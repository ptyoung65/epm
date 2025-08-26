import { EventEmitter } from 'events';
import { Logger } from 'winston';

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
  interval?: number;
  timeout?: number;
  critical?: boolean;
  tags?: string[];
  dependencies?: string[];
}

export interface HealthCheckResult {
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';
  details?: any;
  error?: string;
  timestamp?: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  timestamp: Date;
  duration: number;
  checks: Record<string, HealthCheckResult>;
  summary: {
    total: number;
    up: number;
    down: number;
    degraded: number;
    unknown: number;
    critical: {
      total: number;
      up: number;
      down: number;
    };
  };
  version?: string;
  instanceId?: string;
}

export interface HealthCheckerConfig {
  serviceName: string;
  instanceId?: string;
  version?: string;
  logger?: Logger;
  defaultTimeout?: number;
  defaultInterval?: number;
  gracefulShutdownTimeout?: number;
}

/**
 * Comprehensive health checker with support for multiple health checks
 */
export class HealthChecker extends EventEmitter {
  private config: HealthCheckerConfig;
  private checks: Map<string, HealthCheck> = new Map();
  private lastResults: Map<string, HealthCheckResult> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isShuttingDown = false;
  private checkCounter = 0;

  constructor(config: HealthCheckerConfig) {
    super();
    this.config = {
      defaultTimeout: 5000,
      defaultInterval: 30000,
      gracefulShutdownTimeout: 10000,
      ...config
    };
  }

  /**
   * Add a health check
   */
  addCheck(name: string, check: () => Promise<HealthCheckResult>, options: {
    interval?: number;
    timeout?: number;
    critical?: boolean;
    tags?: string[];
    dependencies?: string[];
    autoStart?: boolean;
  } = {}): void {
    if (this.checks.has(name)) {
      throw new Error(`Health check '${name}' already exists`);
    }

    const healthCheck: HealthCheck = {
      name,
      check,
      interval: options.interval ?? this.config.defaultInterval,
      timeout: options.timeout ?? this.config.defaultTimeout,
      critical: options.critical ?? false,
      tags: options.tags ?? [],
      dependencies: options.dependencies ?? []
    };

    this.checks.set(name, healthCheck);

    // Initialize with UNKNOWN status
    this.lastResults.set(name, {
      status: 'UNKNOWN',
      timestamp: new Date(),
      details: { message: 'Health check not yet executed' }
    });

    this.emit('check.added', {
      name,
      check: healthCheck
    });

    if (this.config.logger) {
      this.config.logger.info(`Health check '${name}' added`, {
        critical: healthCheck.critical,
        interval: healthCheck.interval,
        timeout: healthCheck.timeout
      });
    }

    // Start periodic checking if autoStart is not false
    if (options.autoStart !== false) {
      this.startPeriodicCheck(name);
    }
  }

  /**
   * Remove a health check
   */
  removeCheck(name: string): void {
    if (!this.checks.has(name)) {
      throw new Error(`Health check '${name}' does not exist`);
    }

    // Stop periodic checking
    this.stopPeriodicCheck(name);

    // Remove from collections
    this.checks.delete(name);
    this.lastResults.delete(name);

    this.emit('check.removed', { name });

    if (this.config.logger) {
      this.config.logger.info(`Health check '${name}' removed`);
    }
  }

  /**
   * Start periodic checking for a specific health check
   */
  private startPeriodicCheck(name: string): void {
    const healthCheck = this.checks.get(name);
    if (!healthCheck || !healthCheck.interval) {
      return;
    }

    // Stop existing interval if any
    this.stopPeriodicCheck(name);

    // Start new interval
    const intervalId = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.executeCheck(name);
      }
    }, healthCheck.interval);

    this.intervals.set(name, intervalId);

    // Execute initial check
    setImmediate(() => {
      if (!this.isShuttingDown) {
        this.executeCheck(name);
      }
    });
  }

  /**
   * Stop periodic checking for a specific health check
   */
  private stopPeriodicCheck(name: string): void {
    const intervalId = this.intervals.get(name);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(name);
    }
  }

  /**
   * Execute a single health check
   */
  private async executeCheck(name: string): Promise<HealthCheckResult> {
    const healthCheck = this.checks.get(name);
    if (!healthCheck) {
      throw new Error(`Health check '${name}' does not exist`);
    }

    const checkId = `${name}-${++this.checkCounter}-${Date.now()}`;
    const startTime = Date.now();

    this.emit('check.started', {
      name,
      checkId,
      critical: healthCheck.critical
    });

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        healthCheck.check,
        healthCheck.timeout!
      );

      const duration = Date.now() - startTime;
      const finalResult: HealthCheckResult = {
        ...result,
        timestamp: new Date(),
        duration,
        metadata: {
          ...result.metadata,
          checkId,
          tags: healthCheck.tags,
          dependencies: healthCheck.dependencies
        }
      };

      // Store result
      this.lastResults.set(name, finalResult);

      this.emit('check.completed', {
        name,
        checkId,
        result: finalResult,
        duration,
        critical: healthCheck.critical
      });

      if (this.config.logger) {
        const logLevel = finalResult.status === 'UP' ? 'debug' : 'warn';
        this.config.logger[logLevel](`Health check '${name}' completed`, {
          status: finalResult.status,
          duration,
          critical: healthCheck.critical
        });
      }

      return finalResult;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorResult: HealthCheckResult = {
        status: 'DOWN',
        error: error.message,
        timestamp: new Date(),
        duration,
        metadata: {
          checkId,
          tags: healthCheck.tags,
          dependencies: healthCheck.dependencies,
          errorType: error.constructor.name
        }
      };

      // Store result
      this.lastResults.set(name, errorResult);

      this.emit('check.failed', {
        name,
        checkId,
        error,
        result: errorResult,
        duration,
        critical: healthCheck.critical
      });

      if (this.config.logger) {
        this.config.logger.error(`Health check '${name}' failed`, {
          error: error.message,
          duration,
          critical: healthCheck.critical
        });
      }

      return errorResult;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Execute all health checks
   */
  async checkAll(): Promise<SystemHealth> {
    const startTime = Date.now();

    this.emit('system.check.started', {
      checksCount: this.checks.size
    });

    // Execute all checks in parallel
    const checkPromises = Array.from(this.checks.keys()).map(async (name) => {
      try {
        return await this.executeCheck(name);
      } catch (error) {
        // Error is already handled in executeCheck
        return this.lastResults.get(name)!;
      }
    });

    await Promise.allSettled(checkPromises);

    const systemHealth = this.getSystemHealth();
    systemHealth.duration = Date.now() - startTime;

    this.emit('system.check.completed', {
      systemHealth,
      duration: systemHealth.duration
    });

    return systemHealth;
  }

  /**
   * Execute a specific health check
   */
  async check(name: string): Promise<HealthCheckResult> {
    if (!this.checks.has(name)) {
      throw new Error(`Health check '${name}' does not exist`);
    }

    return await this.executeCheck(name);
  }

  /**
   * Get current system health status
   */
  getSystemHealth(): SystemHealth {
    const checks: Record<string, HealthCheckResult> = {};
    const summary = {
      total: 0,
      up: 0,
      down: 0,
      degraded: 0,
      unknown: 0,
      critical: {
        total: 0,
        up: 0,
        down: 0
      }
    };

    // Collect all results
    for (const [name, result] of this.lastResults) {
      checks[name] = result;
      summary.total++;

      const healthCheck = this.checks.get(name)!;
      if (healthCheck.critical) {
        summary.critical.total++;
        if (result.status === 'UP') {
          summary.critical.up++;
        } else if (result.status === 'DOWN') {
          summary.critical.down++;
        }
      }

      switch (result.status) {
        case 'UP':
          summary.up++;
          break;
        case 'DOWN':
          summary.down++;
          break;
        case 'DEGRADED':
          summary.degraded++;
          break;
        case 'UNKNOWN':
          summary.unknown++;
          break;
      }
    }

    // Determine overall system status
    let systemStatus: 'UP' | 'DOWN' | 'DEGRADED';

    if (summary.critical.down > 0) {
      // Any critical check down means system is down
      systemStatus = 'DOWN';
    } else if (summary.down > 0 || summary.degraded > 0 || summary.unknown > 0) {
      // Any non-critical issues mean degraded
      systemStatus = 'DEGRADED';
    } else {
      // All checks are up
      systemStatus = 'UP';
    }

    return {
      status: systemStatus,
      timestamp: new Date(),
      duration: 0, // Will be set by caller if needed
      checks,
      summary,
      version: this.config.version,
      instanceId: this.config.instanceId
    };
  }

  /**
   * Get health check by name
   */
  getCheck(name: string): HealthCheck | undefined {
    return this.checks.get(name);
  }

  /**
   * Get all health checks
   */
  getChecks(): HealthCheck[] {
    return Array.from(this.checks.values());
  }

  /**
   * Get check result by name
   */
  getResult(name: string): HealthCheckResult | undefined {
    return this.lastResults.get(name);
  }

  /**
   * Get all check results
   */
  getResults(): Record<string, HealthCheckResult> {
    const results: Record<string, HealthCheckResult> = {};
    for (const [name, result] of this.lastResults) {
      results[name] = result;
    }
    return results;
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    const systemHealth = this.getSystemHealth();
    return systemHealth.status === 'UP';
  }

  /**
   * Check if specific check is healthy
   */
  isCheckHealthy(name: string): boolean {
    const result = this.lastResults.get(name);
    return result?.status === 'UP';
  }

  /**
   * Start all periodic health checks
   */
  start(): void {
    if (this.isShuttingDown) {
      throw new Error('Health checker is shutting down');
    }

    for (const name of this.checks.keys()) {
      this.startPeriodicCheck(name);
    }

    this.emit('started', {
      checksCount: this.checks.size
    });

    if (this.config.logger) {
      this.config.logger.info('Health checker started', {
        checksCount: this.checks.size
      });
    }
  }

  /**
   * Stop all periodic health checks
   */
  stop(): void {
    this.isShuttingDown = true;

    for (const name of this.checks.keys()) {
      this.stopPeriodicCheck(name);
    }

    this.emit('stopped');

    if (this.config.logger) {
      this.config.logger.info('Health checker stopped');
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    this.emit('shutdown.started');

    if (this.config.logger) {
      this.config.logger.info('Health checker shutdown initiated');
    }

    // Stop all periodic checks
    for (const name of this.checks.keys()) {
      this.stopPeriodicCheck(name);
    }

    // Wait for any ongoing checks to complete (with timeout)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, this.config.gracefulShutdownTimeout!);
      
      // If no active checks, resolve immediately
      if (this.intervals.size === 0) {
        clearTimeout(timeout);
        resolve();
      }
    });

    this.emit('shutdown.completed');

    if (this.config.logger) {
      this.config.logger.info('Health checker shutdown completed');
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    checksCount: number;
    activeIntervals: number;
    lastCheckCount: number;
    uptime: number;
  } {
    return {
      checksCount: this.checks.size,
      activeIntervals: this.intervals.size,
      lastCheckCount: this.checkCounter,
      uptime: process.uptime() * 1000
    };
  }

  /**
   * Clear all health check results
   */
  clearResults(): void {
    this.lastResults.clear();
    this.checkCounter = 0;

    // Reset all results to UNKNOWN
    for (const name of this.checks.keys()) {
      this.lastResults.set(name, {
        status: 'UNKNOWN',
        timestamp: new Date(),
        details: { message: 'Results cleared' }
      });
    }

    this.emit('results.cleared');

    if (this.config.logger) {
      this.config.logger.info('Health check results cleared');
    }
  }
}