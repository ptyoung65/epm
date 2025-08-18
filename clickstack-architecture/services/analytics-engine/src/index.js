/**
 * Analytics Engine Service for AIRIS-MON ClickStack Architecture
 * Korean business-aware analytics with anomaly detection and insights
 */

const EventEmitter = require('events');
const logger = require('./utils/logger');

class AnalyticsEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      anomalyThreshold: config.anomalyThreshold || 2.5, // Standard deviations
      trendAnalysisWindow: config.trendAnalysisWindow || 24, // Hours
      koreanBusinessHours: {
        start: config.businessStart || 9,
        end: config.businessEnd || 18,
        weekdays: [1, 2, 3, 4, 5] // Monday to Friday
      },
      ...config
    };

    this.clickhouseService = null;
    this.redisService = null;
    this.kafkaService = null;
    
    this.analyticsModules = {
      anomalyDetection: new AnomalyDetectionModule(),
      trendAnalysis: new TrendAnalysisModule(),
      koreanBehaviorAnalysis: new KoreanBehaviorAnalysisModule(),
      predictiveAnalysis: new PredictiveAnalysisModule(),
      alertCorrelation: new AlertCorrelationModule()
    };
    
    this.metrics = {
      totalAnalyses: 0,
      anomaliesDetected: 0,
      trendsIdentified: 0,
      predictionsGenerated: 0,
      correlationsFound: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.isRunning = false;
    this.analysisInterval = null;
  }

  /**
   * Initialize with required services
   */
  async initialize(services) {
    this.clickhouseService = services.clickhouse;
    this.redisService = services.redis;
    this.kafkaService = services.kafka;

    if (!this.clickhouseService) {
      throw new Error('ClickHouse 서비스가 필요합니다');
    }

    // Initialize analytics modules
    for (const [name, module] of Object.entries(this.analyticsModules)) {
      await module.initialize({
        clickhouse: this.clickhouseService,
        redis: this.redisService,
        config: this.config
      });
      logger.debug(`분석 모듈 초기화됨: ${name}`, { service: 'analytics-engine' });
    }

    logger.info('분석 엔진 서비스 초기화됨', {
      service: 'analytics-engine',
      modules: Object.keys(this.analyticsModules).length
    });
  }

  async start() {
    try {
      logger.info('분석 엔진 서비스 시작 중...', { service: 'analytics-engine' });
      
      this.isRunning = true;
      
      // Start periodic analysis
      this.startPeriodicAnalysis();
      
      // Setup real-time analysis triggers
      await this.setupRealtimeAnalysis();

      logger.info('분석 엔진 서비스가 시작되었습니다', { 
        service: 'analytics-engine',
        config: this.config
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('분석 엔진 서비스 시작 실패', {
        error: error.message,
        service: 'analytics-engine'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('분석 엔진 서비스 종료 중...', { service: 'analytics-engine' });
      
      this.isRunning = false;
      
      if (this.analysisInterval) {
        clearInterval(this.analysisInterval);
      }

      // Stop all modules
      for (const module of Object.values(this.analyticsModules)) {
        await module.stop();
      }

      logger.info('분석 엔진 서비스가 종료되었습니다', { service: 'analytics-engine' });

    } catch (error) {
      this.metrics.errors++;
      logger.error('분석 엔진 서비스 종료 중 오류', {
        error: error.message,
        service: 'analytics-engine'
      });
    }
  }

  /**
   * Start periodic analysis based on Korean business patterns
   */
  startPeriodicAnalysis() {
    const analysisInterval = this.getAnalysisInterval();
    
    this.analysisInterval = setInterval(async () => {
      await this.runPeriodicAnalysis();
    }, analysisInterval);
    
    logger.info('주기적 분석이 시작되었습니다', {
      interval: analysisInterval,
      service: 'analytics-engine'
    });
  }

  /**
   * Get analysis interval based on Korean business hours
   */
  getAnalysisInterval() {
    const now = new Date();
    const koreanTime = new Date(now.toLocaleString('en-US', { 
      timeZone: 'Asia/Seoul' 
    }));
    
    const isBusinessHours = this.isKoreanBusinessHours(koreanTime);
    
    // More frequent analysis during business hours
    return isBusinessHours ? 5 * 60 * 1000 : 15 * 60 * 1000; // 5min vs 15min
  }

  /**
   * Setup real-time analysis triggers
   */
  async setupRealtimeAnalysis() {
    if (!this.kafkaService) {
      logger.warn('Kafka 서비스가 없어 실시간 분석을 설정할 수 없습니다', {
        service: 'analytics-engine'
      });
      return;
    }

    // Create consumer for real-time analysis
    const consumer = await this.kafkaService.createConsumer({
      groupId: 'analytics-engine-realtime',
      consumerName: 'analytics-realtime'
    });

    await consumer.subscribe([
      'airis-mon-metrics',
      'airis-mon-alerts',
      'airis-mon-logs'
    ]);

    await consumer.run(async (message) => {
      await this.processRealtimeEvent(message);
    });

    logger.info('실시간 분석이 설정되었습니다', { service: 'analytics-engine' });
  }

  /**
   * Process real-time events for immediate analysis
   */
  async processRealtimeEvent(event) {
    try {
      const eventType = event.event_type;
      
      switch (eventType) {
        case 'metric':
          await this.analyzeMetricEvent(event);
          break;
        case 'alert':
          await this.analyzeAlertEvent(event);
          break;
        case 'log':
          await this.analyzeLogEvent(event);
          break;
        default:
          logger.debug(`처리되지 않은 이벤트 타입: ${eventType}`, {
            service: 'analytics-engine'
          });
      }

    } catch (error) {
      this.metrics.errors++;
      logger.error('실시간 이벤트 처리 실패', {
        error: error.message,
        event_type: event.event_type,
        service: 'analytics-engine'
      });
    }
  }

  /**
   * Run periodic comprehensive analysis
   */
  async runPeriodicAnalysis() {
    if (!this.isRunning) return;

    try {
      logger.debug('주기적 분석 실행 중...', { service: 'analytics-engine' });
      
      const analyses = await Promise.allSettled([
        this.runAnomalyDetection(),
        this.runTrendAnalysis(),
        this.runKoreanBehaviorAnalysis(),
        this.runPredictiveAnalysis(),
        this.runAlertCorrelation()
      ]);

      // Process results
      let successfulAnalyses = 0;
      analyses.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulAnalyses++;
        } else {
          const moduleName = Object.keys(this.analyticsModules)[index];
          logger.error(`분석 모듈 실패: ${moduleName}`, {
            error: result.reason.message,
            service: 'analytics-engine'
          });
        }
      });

      this.metrics.totalAnalyses++;
      
      logger.info('주기적 분석 완료', {
        successful: successfulAnalyses,
        total: analyses.length,
        service: 'analytics-engine'
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('주기적 분석 실행 실패', {
        error: error.message,
        service: 'analytics-engine'
      });
    }
  }

  /**
   * Anomaly Detection Analysis
   */
  async runAnomalyDetection() {
    const timeRange = '1h';
    const sensitivity = this.isKoreanBusinessHours() ? 'high' : 'medium';
    
    const anomalies = await this.analyticsModules.anomalyDetection.detect({
      timeRange,
      sensitivity,
      koreanContext: true
    });

    if (anomalies.length > 0) {
      this.metrics.anomaliesDetected += anomalies.length;
      
      // Send critical anomalies as alerts
      const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
      for (const anomaly of criticalAnomalies) {
        await this.publishAnalysisResult('anomaly', anomaly);
      }

      logger.info('이상 현상 탐지 완료', {
        total: anomalies.length,
        critical: criticalAnomalies.length,
        service: 'analytics-engine'
      });
    }

    return anomalies;
  }

  /**
   * Trend Analysis
   */
  async runTrendAnalysis() {
    const trends = await this.analyticsModules.trendAnalysis.analyze({
      timeWindow: this.config.trendAnalysisWindow,
      koreanBusinessHours: true
    });

    if (trends.length > 0) {
      this.metrics.trendsIdentified += trends.length;
      
      // Cache important trends
      for (const trend of trends) {
        if (trend.significance > 0.7) {
          await this.cacheTrendData(trend);
        }
      }

      logger.info('트렌드 분석 완료', {
        trends: trends.length,
        significant: trends.filter(t => t.significance > 0.7).length,
        service: 'analytics-engine'
      });
    }

    return trends;
  }

  /**
   * Korean Business Behavior Analysis
   */
  async runKoreanBehaviorAnalysis() {
    const analysis = await this.analyticsModules.koreanBehaviorAnalysis.analyze({
      includeWeekendPatterns: true,
      businessHoursComparison: true,
      culturalEventImpact: true
    });

    if (analysis.insights.length > 0) {
      logger.info('한국 비즈니스 패턴 분석 완료', {
        insights: analysis.insights.length,
        businessHoursImpact: analysis.businessHoursImpact,
        service: 'analytics-engine'
      });

      // Store insights for dashboard
      await this.storeKoreanInsights(analysis);
    }

    return analysis;
  }

  /**
   * Predictive Analysis
   */
  async runPredictiveAnalysis() {
    const predictions = await this.analyticsModules.predictiveAnalysis.predict({
      horizon: '24h',
      includeKoreanPatterns: true,
      confidenceThreshold: 0.7
    });

    if (predictions.length > 0) {
      this.metrics.predictionsGenerated += predictions.length;
      
      // Alert on concerning predictions
      const concerningPredictions = predictions.filter(p => 
        p.predicted_value > p.threshold && p.confidence > 0.8
      );

      for (const prediction of concerningPredictions) {
        await this.publishAnalysisResult('prediction', prediction);
      }

      logger.info('예측 분석 완료', {
        total: predictions.length,
        concerning: concerningPredictions.length,
        service: 'analytics-engine'
      });
    }

    return predictions;
  }

  /**
   * Alert Correlation Analysis
   */
  async runAlertCorrelation() {
    const correlations = await this.analyticsModules.alertCorrelation.findCorrelations({
      timeWindow: '6h',
      minCorrelationScore: 0.6
    });

    if (correlations.length > 0) {
      this.metrics.correlationsFound += correlations.length;
      
      logger.info('알림 상관관계 분석 완료', {
        correlations: correlations.length,
        service: 'analytics-engine'
      });

      // Store high-confidence correlations
      for (const correlation of correlations) {
        if (correlation.confidence > 0.8) {
          await this.storeCorrelation(correlation);
        }
      }
    }

    return correlations;
  }

  /**
   * Analyze specific metric events
   */
  async analyzeMetricEvent(event) {
    // Real-time anomaly detection
    const isAnomaly = await this.analyticsModules.anomalyDetection.checkRealtime(event);
    
    if (isAnomaly) {
      await this.publishAnalysisResult('realtime_anomaly', {
        ...event,
        analysis_type: 'realtime_anomaly',
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        })
      });
    }
  }

  /**
   * Analyze alert events for patterns
   */
  async analyzeAlertEvent(event) {
    // Look for alert patterns
    const patterns = await this.analyticsModules.alertCorrelation.analyzeAlert(event);
    
    if (patterns.length > 0) {
      await this.publishAnalysisResult('alert_pattern', {
        alert: event,
        patterns,
        analysis_type: 'alert_pattern'
      });
    }
  }

  /**
   * Analyze log events for insights
   */
  async analyzeLogEvent(event) {
    // Only analyze ERROR and CRITICAL logs in real-time
    if (!['ERROR', 'CRITICAL'].includes(event.log_level)) {
      return;
    }

    // Check for error patterns
    const errorInsights = await this.analyticsModules.koreanBehaviorAnalysis
      .analyzeErrorLog(event);
    
    if (errorInsights.significance > 0.5) {
      await this.publishAnalysisResult('error_insight', {
        log: event,
        insights: errorInsights,
        analysis_type: 'error_insight'
      });
    }
  }

  /**
   * Publish analysis result to Kafka and cache
   */
  async publishAnalysisResult(type, result) {
    try {
      const analysisEvent = {
        analysis_type: type,
        result,
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        generated_at: Date.now(),
        korean_business_hours: this.isKoreanBusinessHours()
      };

      // Publish to Kafka
      if (this.kafkaService) {
        await this.kafkaService.sendMessage('airis-mon-korean-analytics', analysisEvent);
      }

      // Cache important results
      if (this.redisService && ['anomaly', 'prediction', 'alert_pattern'].includes(type)) {
        const cacheKey = `analysis:${type}:${Date.now()}`;
        await this.redisService.set(cacheKey, analysisEvent, 3600); // 1 hour
      }

      // Emit for local listeners
      this.emit('analysis-result', analysisEvent);

    } catch (error) {
      logger.error('분석 결과 발행 실패', {
        type,
        error: error.message,
        service: 'analytics-engine'
      });
    }
  }

  /**
   * Cache trend data for dashboard
   */
  async cacheTrendData(trend) {
    if (!this.redisService) return;

    try {
      const cacheKey = `trends:${trend.metric}:${trend.timeframe}`;
      await this.redisService.set(cacheKey, trend, 1800); // 30 minutes
    } catch (error) {
      logger.error('트렌드 데이터 캐싱 실패', {
        error: error.message,
        service: 'analytics-engine'
      });
    }
  }

  /**
   * Store Korean business insights
   */
  async storeKoreanInsights(analysis) {
    if (!this.redisService) return;

    try {
      const cacheKey = 'korean-business-insights';
      await this.redisService.set(cacheKey, analysis, 3600); // 1 hour
    } catch (error) {
      logger.error('한국 비즈니스 인사이트 저장 실패', {
        error: error.message,
        service: 'analytics-engine'
      });
    }
  }

  /**
   * Store correlation data
   */
  async storeCorrelation(correlation) {
    if (!this.clickhouseService) return;

    try {
      await this.clickhouseService.insertWideEvent({
        event_type: 'analytics',
        service_name: 'analytics-engine',
        analysis_type: 'correlation',
        analysis_data: correlation,
        korean_business_hours: this.isKoreanBusinessHours()
      });
    } catch (error) {
      logger.error('상관관계 데이터 저장 실패', {
        error: error.message,
        service: 'analytics-engine'
      });
    }
  }

  /**
   * Check if current time is Korean business hours
   */
  isKoreanBusinessHours(time = null) {
    const targetTime = time || new Date();
    const koreanTime = new Date(targetTime.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul'
    }));
    
    const hour = koreanTime.getHours();
    const day = koreanTime.getDay();
    
    return this.config.koreanBusinessHours.weekdays.includes(day) &&
           hour >= this.config.koreanBusinessHours.start &&
           hour < this.config.koreanBusinessHours.end;
  }

  /**
   * Get analysis summary
   */
  async getAnalysisSummary(timeRange = '24h') {
    try {
      const summary = {
        period: timeRange,
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        metrics: this.getMetrics(),
        modules: {}
      };

      // Get summary from each module
      for (const [name, module] of Object.entries(this.analyticsModules)) {
        try {
          summary.modules[name] = await module.getSummary(timeRange);
        } catch (error) {
          logger.error(`모듈 요약 가져오기 실패: ${name}`, {
            error: error.message,
            service: 'analytics-engine'
          });
          summary.modules[name] = { error: error.message };
        }
      }

      return summary;

    } catch (error) {
      logger.error('분석 요약 생성 실패', {
        error: error.message,
        service: 'analytics-engine'
      });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const health = {
        status: this.isRunning ? 'healthy' : 'stopped',
        running: this.isRunning,
        metrics: this.getMetrics(),
        modules: {},
        services: {
          clickhouse: !!this.clickhouseService,
          redis: !!this.redisService,
          kafka: !!this.kafkaService
        }
      };

      // Check module health
      for (const [name, module] of Object.entries(this.analyticsModules)) {
        try {
          health.modules[name] = await module.healthCheck();
        } catch (error) {
          health.modules[name] = { status: 'unhealthy', error: error.message };
        }
      }

      return health;

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        error: error.message
      };
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      analysis_rate: this.metrics.totalAnalyses / 
                    ((Date.now() - this.metrics.startTime) / 1000) || 0,
      korean_business_hours: this.isKoreanBusinessHours()
    };
  }
}

// Analytics modules (simplified implementations)
class AnomalyDetectionModule {
  async initialize(services) {
    this.clickhouse = services.clickhouse;
    this.config = services.config;
  }

  async detect(options) {
    // Implementation would use statistical methods for anomaly detection
    return [];
  }

  async checkRealtime(event) {
    // Implementation would check if single event is anomalous
    return false;
  }

  async getSummary(timeRange) {
    return { detected: 0, timeRange };
  }

  async healthCheck() {
    return { status: 'healthy' };
  }

  async stop() {}
}

class TrendAnalysisModule {
  async initialize(services) {
    this.clickhouse = services.clickhouse;
  }

  async analyze(options) {
    return [];
  }

  async getSummary(timeRange) {
    return { trends: 0, timeRange };
  }

  async healthCheck() {
    return { status: 'healthy' };
  }

  async stop() {}
}

class KoreanBehaviorAnalysisModule {
  async initialize(services) {
    this.clickhouse = services.clickhouse;
  }

  async analyze(options) {
    return { insights: [] };
  }

  async analyzeErrorLog(event) {
    return { significance: 0 };
  }

  async getSummary(timeRange) {
    return { insights: 0, timeRange };
  }

  async healthCheck() {
    return { status: 'healthy' };
  }

  async stop() {}
}

class PredictiveAnalysisModule {
  async initialize(services) {
    this.clickhouse = services.clickhouse;
  }

  async predict(options) {
    return [];
  }

  async getSummary(timeRange) {
    return { predictions: 0, timeRange };
  }

  async healthCheck() {
    return { status: 'healthy' };
  }

  async stop() {}
}

class AlertCorrelationModule {
  async initialize(services) {
    this.clickhouse = services.clickhouse;
  }

  async findCorrelations(options) {
    return [];
  }

  async analyzeAlert(event) {
    return [];
  }

  async getSummary(timeRange) {
    return { correlations: 0, timeRange };
  }

  async healthCheck() {
    return { status: 'healthy' };
  }

  async stop() {}
}

module.exports = AnalyticsEngine;