/**
 * AIRIS EPM 비즈니스 메트릭 수집 엔진
 * 실시간 메트릭 수집, 계산, 저장 및 알림 처리
 */

import { EventEmitter } from 'events';
import {
  AnyMetric,
  MetricCollectionConfig,
  MetricAlert,
  DEFAULT_COLLECTION_CONFIG,
  AggregationMethod
} from './metrics-definitions';

export interface MetricValue {
  metricId: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface AggregatedMetricValue extends MetricValue {
  aggregationMethod: AggregationMethod;
  period: string; // '1m', '5m', '1h', '1d' etc.
  sampleCount: number;
}

export interface MetricCollectionResult {
  success: boolean;
  metricId: string;
  value?: MetricValue;
  error?: string;
  collectionTime: number; // ms
}

/**
 * 메트릭 데이터 소스 인터페이스
 */
export interface MetricDataSource {
  id: string;
  name: string;
  type: 'database' | 'api' | 'file' | 'stream' | 'calculated';
  endpoint?: string;
  config: Record<string, any>;
  authenticate?(): Promise<boolean>;
  collect(metricId: string, config: any): Promise<MetricValue>;
  isHealthy(): Promise<boolean>;
}

/**
 * 메트릭 저장소 인터페이스
 */
export interface MetricStorage {
  store(values: MetricValue[]): Promise<boolean>;
  retrieve(metricId: string, from: Date, to: Date): Promise<MetricValue[]>;
  aggregate(metricId: string, method: AggregationMethod, period: string, from: Date, to: Date): Promise<AggregatedMetricValue[]>;
  cleanup(olderThan: Date): Promise<number>;
}

/**
 * 메트릭 수집 엔진 메인 클래스
 */
export class BusinessMetricsEngine extends EventEmitter {
  private metrics: Map<string, AnyMetric> = new Map();
  private dataSources: Map<string, MetricDataSource> = new Map();
  private storage: MetricStorage | null = null;
  private collectionIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: MetricCollectionConfig;
  private alerts: Map<string, MetricAlert[]> = new Map();
  private isRunning = false;

  constructor(config: Partial<MetricCollectionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_COLLECTION_CONFIG, ...config };
  }

  /**
   * 엔진 시작
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Metrics engine is already running');
    }

    this.emit('engine:starting');
    
    try {
      // 데이터 소스 상태 확인
      await this.validateDataSources();
      
      // 메트릭 수집 스케줄 시작
      this.startMetricCollection();
      
      // 정리 작업 스케줄 시작
      this.startMaintenanceTasks();
      
      this.isRunning = true;
      this.emit('engine:started');
      
      console.log(`✅ Business Metrics Engine started with ${this.metrics.size} metrics`);
    } catch (error) {
      this.emit('engine:error', error);
      throw error;
    }
  }

  /**
   * 엔진 중지
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.emit('engine:stopping');
    
    // 모든 수집 인터벌 정리
    this.collectionIntervals.forEach(interval => clearInterval(interval));
    this.collectionIntervals.clear();
    
    this.isRunning = false;
    this.emit('engine:stopped');
    
    console.log('🛑 Business Metrics Engine stopped');
  }

  /**
   * 메트릭 등록
   */
  registerMetric(metric: AnyMetric): void {
    this.metrics.set(metric.id, metric);
    
    // 메트릭별 수집 스케줄 설정
    if (this.isRunning) {
      this.scheduleMetricCollection(metric);
    }
    
    this.emit('metric:registered', metric);
    console.log(`📊 Registered metric: ${metric.name} (${metric.id})`);
  }

  /**
   * 데이터 소스 등록
   */
  registerDataSource(dataSource: MetricDataSource): void {
    this.dataSources.set(dataSource.id, dataSource);
    this.emit('datasource:registered', dataSource);
    console.log(`🔌 Registered data source: ${dataSource.name} (${dataSource.id})`);
  }

  /**
   * 저장소 설정
   */
  setStorage(storage: MetricStorage): void {
    this.storage = storage;
    this.emit('storage:configured', storage);
    console.log('💾 Storage configured');
  }

  /**
   * 알림 규칙 등록
   */
  registerAlert(alert: MetricAlert): void {
    if (!this.alerts.has(alert.metricId)) {
      this.alerts.set(alert.metricId, []);
    }
    this.alerts.get(alert.metricId)!.push(alert);
    this.emit('alert:registered', alert);
  }

  /**
   * 실시간 메트릭 값 수집
   */
  async collectMetric(metricId: string): Promise<MetricCollectionResult> {
    const startTime = Date.now();
    
    try {
      const metric = this.metrics.get(metricId);
      if (!metric) {
        return {
          success: false,
          metricId,
          error: 'Metric not found',
          collectionTime: Date.now() - startTime
        };
      }

      // 데이터 소스에서 값 수집
      const dataSource = this.dataSources.get(metric.source);
      if (!dataSource) {
        return {
          success: false,
          metricId,
          error: 'Data source not found',
          collectionTime: Date.now() - startTime
        };
      }

      const value = await dataSource.collect(metricId, {});
      
      // 저장소에 저장
      if (this.storage) {
        await this.storage.store([value]);
      }

      // 알림 규칙 확인
      await this.checkAlerts(metricId, value.value);

      const result: MetricCollectionResult = {
        success: true,
        metricId,
        value,
        collectionTime: Date.now() - startTime
      };

      this.emit('metric:collected', result);
      return result;

    } catch (error) {
      const result: MetricCollectionResult = {
        success: false,
        metricId,
        error: error instanceof Error ? error.message : 'Unknown error',
        collectionTime: Date.now() - startTime
      };

      this.emit('metric:error', result);
      return result;
    }
  }

  /**
   * 배치 메트릭 수집
   */
  async collectBatchMetrics(metricIds: string[]): Promise<MetricCollectionResult[]> {
    const promises = metricIds.map(id => this.collectMetric(id));
    return Promise.all(promises);
  }

  /**
   * 메트릭 값 계산 (공식 기반)
   */
  async calculateMetric(metricId: string, formula: string, inputs: Record<string, number>): Promise<MetricValue> {
    try {
      // 간단한 공식 계산 (실제로는 더 정교한 파서 필요)
      let calculatedValue = this.evaluateFormula(formula, inputs);
      
      return {
        metricId,
        value: calculatedValue,
        timestamp: new Date(),
        tags: { type: 'calculated' },
        metadata: { formula, inputs }
      };
    } catch (error) {
      throw new Error(`Failed to calculate metric ${metricId}: ${error}`);
    }
  }

  /**
   * 메트릭 히스토리 조회
   */
  async getMetricHistory(metricId: string, from: Date, to: Date): Promise<MetricValue[]> {
    if (!this.storage) {
      throw new Error('Storage not configured');
    }
    
    return this.storage.retrieve(metricId, from, to);
  }

  /**
   * 집계된 메트릭 조회
   */
  async getAggregatedMetrics(
    metricId: string, 
    method: AggregationMethod, 
    period: string, 
    from: Date, 
    to: Date
  ): Promise<AggregatedMetricValue[]> {
    if (!this.storage) {
      throw new Error('Storage not configured');
    }
    
    return this.storage.aggregate(metricId, method, period, from, to);
  }

  /**
   * 엔진 상태 조회
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      metricsCount: this.metrics.size,
      dataSourcesCount: this.dataSources.size,
      activeCollections: this.collectionIntervals.size,
      alertsCount: Array.from(this.alerts.values()).reduce((sum, alerts) => sum + alerts.length, 0),
      config: this.config
    };
  }

  /**
   * Private Methods
   */

  private async validateDataSources(): Promise<void> {
    const healthChecks = Array.from(this.dataSources.values()).map(async ds => {
      const isHealthy = await ds.isHealthy();
      if (!isHealthy) {
        throw new Error(`Data source ${ds.name} is not healthy`);
      }
    });

    await Promise.all(healthChecks);
  }

  private startMetricCollection(): void {
    this.metrics.forEach(metric => {
      this.scheduleMetricCollection(metric);
    });
  }

  private scheduleMetricCollection(metric: AnyMetric): void {
    const interval = this.getCollectionInterval(metric.frequency);
    
    const timer = setInterval(async () => {
      try {
        await this.collectMetric(metric.id);
      } catch (error) {
        this.emit('collection:error', { metricId: metric.id, error });
      }
    }, interval);

    this.collectionIntervals.set(metric.id, timer);
  }

  private getCollectionInterval(frequency: string): number {
    const intervals: Record<string, number> = {
      'realtime': 5000,    // 5초
      'minutely': 60000,   // 1분
      'hourly': 3600000,   // 1시간
      'daily': 86400000,   // 1일
      'weekly': 604800000  // 1주
    };

    return intervals[frequency] || 60000; // 기본 1분
  }

  private startMaintenanceTasks(): void {
    // 매일 자정에 오래된 데이터 정리
    const cleanupInterval = setInterval(async () => {
      if (this.storage) {
        const cutoffDate = new Date(Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000));
        const cleanedCount = await this.storage.cleanup(cutoffDate);
        console.log(`🧹 Cleaned up ${cleanedCount} old metric records`);
      }
    }, 24 * 60 * 60 * 1000); // 24시간

    // 엔진 종료시 정리
    this.once('engine:stopping', () => {
      clearInterval(cleanupInterval);
    });
  }

  private async checkAlerts(metricId: string, value: number): Promise<void> {
    const alertRules = this.alerts.get(metricId) || [];
    
    for (const alert of alertRules) {
      if (!alert.enabled) continue;

      let triggered = false;
      
      switch (alert.condition) {
        case 'greater_than':
          triggered = value > alert.threshold;
          break;
        case 'less_than':
          triggered = value < alert.threshold;
          break;
        case 'equals':
          triggered = value === alert.threshold;
          break;
        case 'not_equals':
          triggered = value !== alert.threshold;
          break;
      }

      if (triggered) {
        this.emit('alert:triggered', {
          alert,
          metricId,
          value,
          timestamp: new Date()
        });
      }
    }
  }

  private evaluateFormula(formula: string, inputs: Record<string, number>): number {
    // 간단한 공식 평가기 (실제로는 더 안전한 구현 필요)
    let expression = formula;
    
    Object.entries(inputs).forEach(([key, value]) => {
      expression = expression.replace(new RegExp(key, 'g'), value.toString());
    });

    // 기본적인 수학 연산만 허용
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      throw new Error('Invalid formula expression');
    }

    return eval(expression);
  }
}

/**
 * 기본 메트릭 엔진 인스턴스 생성 함수
 */
export function createMetricsEngine(config?: Partial<MetricCollectionConfig>): BusinessMetricsEngine {
  return new BusinessMetricsEngine(config);
}