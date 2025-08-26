import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { CompatibilityService } from './CompatibilityService';
import { DataTransformer } from './DataTransformer';
import { RedisCache } from './cache/RedisCache';

/**
 * Migration task interface
 */
export interface MigrationTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  estimatedDuration?: number; // in milliseconds
  actualDuration?: number; // in milliseconds
  metadata?: any;
}

/**
 * Migration batch interface
 */
export interface MigrationBatch {
  id: string;
  name: string;
  description: string;
  tasks: MigrationTask[];
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  progress: number; // 0-100
}

/**
 * Migration statistics
 */
export interface MigrationStats {
  totalMigrations: number;
  completedMigrations: number;
  failedMigrations: number;
  activeMigrations: number;
  averageMigrationTime: number;
  successRate: number;
  dataVolumeProcessed: number;
  lastMigrationTime?: Date;
}

/**
 * Migration Service
 * 
 * Handles data migration between AIRIS APM and EPM systems
 */
export class MigrationService extends EventEmitter {
  private migrationQueue: MigrationTask[] = [];
  private activeMigrations: Map<string, MigrationTask> = new Map();
  private completedMigrations: Map<string, MigrationTask> = new Map();
  private cache: RedisCache;
  private isProcessing = false;
  private batchSize = config.migration.batchSize || 1000;
  private maxConcurrentMigrations = 3;
  private migrationHistory: MigrationTask[] = [];

  constructor(
    private compatibilityService: CompatibilityService,
    private dataTransformer: DataTransformer
  ) {
    super();
    this.cache = new RedisCache(config.databases.redis);
    this.setupEventListeners();
  }

  /**
   * Initialize migration service
   */
  public async initialize(): Promise<void> {
    try {
      await this.cache.connect();
      await this.loadMigrationState();
      this.startMigrationProcessor();
      
      logger.info('Migration service initialized', {
        queueSize: this.migrationQueue.length,
        activeMigrations: this.activeMigrations.size,
        batchSize: this.batchSize,
        maxConcurrent: this.maxConcurrentMigrations,
      });
    } catch (error) {
      logger.error('Failed to initialize migration service', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Shutdown migration service
   */
  public async shutdown(): Promise<void> {
    try {
      this.isProcessing = false;
      
      // Wait for active migrations to complete or timeout after 30 seconds
      const timeout = Date.now() + 30000;
      while (this.activeMigrations.size > 0 && Date.now() < timeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Cancel remaining active migrations
      for (const [id, task] of this.activeMigrations) {
        task.status = 'cancelled';
        this.emit('migrationCancelled', task);
      }
      
      await this.saveMigrationState();
      await this.cache.disconnect();
      
      logger.info('Migration service shut down');
    } catch (error) {
      logger.error('Error shutting down migration service', {
        error: error.message,
      });
    }
  }

  /**
   * Add migration task to queue
   */
  public addMigrationTask(task: Partial<MigrationTask>): string {
    const migrationTask: MigrationTask = {
      id: task.id || this.generateTaskId(),
      name: task.name || 'Unnamed Migration',
      description: task.description || 'No description provided',
      status: 'pending',
      priority: task.priority || 'medium',
      progress: 0,
      metadata: task.metadata || {},
    };

    this.migrationQueue.push(migrationTask);
    this.sortMigrationQueue();
    
    logger.info('Migration task added to queue', {
      taskId: migrationTask.id,
      taskName: migrationTask.name,
      priority: migrationTask.priority,
      queueSize: this.migrationQueue.length,
    });

    this.emit('migrationTaskAdded', migrationTask);
    return migrationTask.id;
  }

  /**
   * Create data migration batch
   */
  public async createMigrationBatch(
    batchName: string,
    dataSource: string,
    fromVersion: string,
    toVersion: string,
    estimatedRecords: number
  ): Promise<string> {
    const batchId = this.generateBatchId();
    const numberOfTasks = Math.ceil(estimatedRecords / this.batchSize);
    
    const tasks: MigrationTask[] = [];
    
    for (let i = 0; i < numberOfTasks; i++) {
      const task: MigrationTask = {
        id: `${batchId}_task_${i + 1}`,
        name: `${batchName} - Batch ${i + 1}/${numberOfTasks}`,
        description: `Migrate ${Math.min(this.batchSize, estimatedRecords - (i * this.batchSize))} records from ${dataSource}`,
        status: 'pending',
        priority: 'medium',
        progress: 0,
        metadata: {
          batchId,
          batchIndex: i,
          totalBatches: numberOfTasks,
          dataSource,
          fromVersion,
          toVersion,
          offset: i * this.batchSize,
          limit: this.batchSize,
        },
      };
      
      tasks.push(task);
      this.addMigrationTask(task);
    }

    const batch: MigrationBatch = {
      id: batchId,
      name: batchName,
      description: `Migration of ${estimatedRecords} records from ${dataSource}`,
      tasks,
      totalTasks: numberOfTasks,
      completedTasks: 0,
      failedTasks: 0,
      status: 'pending',
      progress: 0,
    };

    // Cache batch information
    await this.cache.setex(`migration:batch:${batchId}`, 3600, JSON.stringify(batch));
    
    logger.info('Migration batch created', {
      batchId,
      batchName,
      totalTasks: numberOfTasks,
      estimatedRecords,
      dataSource,
    });

    this.emit('migrationBatchCreated', batch);
    return batchId;
  }

  /**
   * Execute data migration task
   */
  private async executeMigrationTask(task: MigrationTask): Promise<void> {
    const startTime = Date.now();
    task.status = 'running';
    task.startedAt = new Date();
    task.progress = 0;
    
    this.activeMigrations.set(task.id, task);
    this.emit('migrationStarted', task);
    
    logger.info('Starting migration task', {
      taskId: task.id,
      taskName: task.name,
      metadata: task.metadata,
    });

    try {
      const { dataSource, fromVersion, toVersion, offset, limit } = task.metadata;
      
      // Fetch data from source
      task.progress = 10;
      this.emit('migrationProgress', task);
      
      const sourceData = await this.fetchDataFromSource(dataSource, offset, limit);
      
      if (!sourceData || sourceData.length === 0) {
        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date();
        task.actualDuration = Date.now() - startTime;
        
        logger.info('Migration task completed - no data to migrate', {
          taskId: task.id,
        });
        
        this.completeMigrationTask(task);
        return;
      }
      
      task.progress = 30;
      this.emit('migrationProgress', task);
      
      // Transform data
      const transformedData = [];
      for (let i = 0; i < sourceData.length; i++) {
        const record = sourceData[i];
        const transformed = await this.dataTransformer.transformRequest(
          record,
          fromVersion,
          toVersion
        );
        transformedData.push(transformed);
        
        // Update progress
        const transformProgress = Math.floor((i / sourceData.length) * 40) + 30;
        if (transformProgress > task.progress) {
          task.progress = transformProgress;
          this.emit('migrationProgress', task);
        }
      }
      
      task.progress = 70;
      this.emit('migrationProgress', task);
      
      // Write data to destination
      await this.writeDataToDestination(transformedData, task.metadata);
      
      task.progress = 90;
      this.emit('migrationProgress', task);
      
      // Validate migration
      const isValid = await this.validateMigration(sourceData, transformedData);
      
      if (!isValid) {
        throw new Error('Migration validation failed');
      }
      
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = new Date();
      task.actualDuration = Date.now() - startTime;
      
      logger.info('Migration task completed successfully', {
        taskId: task.id,
        recordsProcessed: sourceData.length,
        duration: task.actualDuration,
      });
      
      this.completeMigrationTask(task);
      
    } catch (error) {
      task.status = 'failed';
      task.errorMessage = error.message;
      task.completedAt = new Date();
      task.actualDuration = Date.now() - startTime;
      
      logger.error('Migration task failed', {
        taskId: task.id,
        taskName: task.name,
        error: error.message,
        stack: error.stack,
        duration: task.actualDuration,
      });
      
      this.completeMigrationTask(task);
      this.emit('migrationFailed', task, error);
    }
  }

  /**
   * Fetch data from source system
   */
  private async fetchDataFromSource(
    dataSource: string,
    offset: number,
    limit: number
  ): Promise<any[]> {
    // This would integrate with the source system API
    // For now, simulate data fetching
    
    logger.debug('Fetching data from source', {
      dataSource,
      offset,
      limit,
    });
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return mock data for demonstration
    const mockData = [];
    for (let i = 0; i < Math.min(limit, 100); i++) {
      mockData.push({
        id: offset + i,
        timestamp: new Date().toISOString(),
        value: Math.random() * 100,
        status: 'active',
        user_id: `user_${offset + i}`,
        tenant_id: 'default',
      });
    }
    
    return mockData;
  }

  /**
   * Write data to destination system
   */
  private async writeDataToDestination(data: any[], metadata: any): Promise<void> {
    logger.debug('Writing data to destination', {
      recordCount: data.length,
      batchId: metadata.batchId,
      batchIndex: metadata.batchIndex,
    });
    
    // This would integrate with the destination system API
    // For now, simulate data writing
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In a real implementation, this would write to the new EPM system
    logger.debug('Data written to destination successfully');
  }

  /**
   * Validate migration results
   */
  private async validateMigration(sourceData: any[], transformedData: any[]): Promise<boolean> {
    if (sourceData.length !== transformedData.length) {
      logger.error('Migration validation failed: record count mismatch', {
        sourceCount: sourceData.length,
        transformedCount: transformedData.length,
      });
      return false;
    }
    
    // Additional validation logic would go here
    return true;
  }

  /**
   * Complete migration task
   */
  private completeMigrationTask(task: MigrationTask): void {
    this.activeMigrations.delete(task.id);
    this.completedMigrations.set(task.id, task);
    this.migrationHistory.push(task);
    
    // Keep history limited
    if (this.migrationHistory.length > 1000) {
      this.migrationHistory = this.migrationHistory.slice(-1000);
    }
    
    this.emit('migrationCompleted', task);
  }

  /**
   * Process migration queue
   */
  private startMigrationProcessor(): void {
    this.isProcessing = true;
    
    const processQueue = async () => {
      while (this.isProcessing) {
        try {
          if (this.migrationQueue.length > 0 && 
              this.activeMigrations.size < this.maxConcurrentMigrations) {
            
            const task = this.migrationQueue.shift()!;
            this.executeMigrationTask(task).catch(error => {
              logger.error('Unhandled migration task error', {
                taskId: task.id,
                error: error.message,
              });
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000)); // Check every second
        } catch (error) {
          logger.error('Migration processor error', {
            error: error.message,
            stack: error.stack,
          });
        }
      }
    };
    
    processQueue().catch(error => {
      logger.error('Migration processor crashed', {
        error: error.message,
        stack: error.stack,
      });
    });
  }

  /**
   * Get migration status
   */
  public getMigrationStatus(): {
    queueSize: number;
    activeMigrations: number;
    completedMigrations: number;
    recentTasks: MigrationTask[];
  } {
    return {
      queueSize: this.migrationQueue.length,
      activeMigrations: this.activeMigrations.size,
      completedMigrations: this.completedMigrations.size,
      recentTasks: this.migrationHistory.slice(-10),
    };
  }

  /**
   * Get migration statistics
   */
  public getMigrationStats(): MigrationStats {
    const completed = Array.from(this.completedMigrations.values());
    const successful = completed.filter(task => task.status === 'completed');
    const failed = completed.filter(task => task.status === 'failed');
    
    const totalDuration = successful.reduce((sum, task) => sum + (task.actualDuration || 0), 0);
    const averageDuration = successful.length > 0 ? totalDuration / successful.length : 0;
    
    return {
      totalMigrations: completed.length,
      completedMigrations: successful.length,
      failedMigrations: failed.length,
      activeMigrations: this.activeMigrations.size,
      averageMigrationTime: averageDuration,
      successRate: completed.length > 0 ? (successful.length / completed.length) * 100 : 0,
      dataVolumeProcessed: successful.length * this.batchSize, // Approximation
      lastMigrationTime: completed.length > 0 ? completed[completed.length - 1].completedAt : undefined,
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.on('migrationCompleted', (task: MigrationTask) => {
      logger.debug('Migration task completed event', {
        taskId: task.id,
        status: task.status,
        duration: task.actualDuration,
      });
    });
    
    this.on('migrationFailed', (task: MigrationTask, error: Error) => {
      logger.error('Migration task failed event', {
        taskId: task.id,
        error: error.message,
      });
    });
  }

  /**
   * Utility methods
   */
  private generateTaskId(): string {
    return `migration_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private sortMigrationQueue(): void {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    this.migrationQueue.sort((a, b) => {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private async loadMigrationState(): Promise<void> {
    try {
      const stateData = await this.cache.get('migration:service:state');
      if (stateData) {
        const state = JSON.parse(stateData);
        // Restore migration state if needed
        logger.info('Migration state loaded', { stateKeys: Object.keys(state) });
      }
    } catch (error) {
      logger.warn('Failed to load migration state', { error: error.message });
    }
  }

  private async saveMigrationState(): Promise<void> {
    try {
      const state = {
        queueSize: this.migrationQueue.length,
        activeMigrations: this.activeMigrations.size,
        completedMigrations: this.completedMigrations.size,
        timestamp: Date.now(),
      };
      
      await this.cache.setex('migration:service:state', 3600, JSON.stringify(state));
      logger.debug('Migration state saved');
    } catch (error) {
      logger.warn('Failed to save migration state', { error: error.message });
    }
  }
}
