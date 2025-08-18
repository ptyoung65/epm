/**
 * Event Delta Analyzer for AIRIS-MON
 * Analyzes differences between baseline and anomaly events for root cause investigation
 */

const EventEmitter = require('events');
const logger = require('./utils/logger');

class EventDeltaAnalyzer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      baselineWindow: config.baselineWindow || 24, // hours
      comparisonWindow: config.comparisonWindow || 1, // hours
      significanceThreshold: config.significanceThreshold || 0.05,
      correlationThreshold: config.correlationThreshold || 0.7,
      maxDeltas: config.maxDeltas || 100,
      koreanBusinessHours: {
        start: config.businessStart || 9,
        end: config.businessEnd || 18,
        weekdays: [1, 2, 3, 4, 5]
      },
      ...config
    };

    this.clickhouseService = null;
    this.redisService = null;
    
    this.metrics = {
      totalAnalyses: 0,
      totalDeltas: 0,
      significantDeltas: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.isRunning = false;
    this.baselineCache = new Map();
  }

  /**
   * Initialize with required services
   */
  async initialize(services) {
    this.clickhouseService = services.clickhouse;
    this.redisService = services.redis;

    if (!this.clickhouseService) {
      throw new Error('ClickHouse 서비스가 필요합니다');
    }

    logger.info('이벤트 델타 분석기 초기화됨', {
      service: 'event-delta-analyzer',
      baselineWindow: `${this.config.baselineWindow}시간`,
      significanceThreshold: this.config.significanceThreshold
    });
  }

  async start() {
    try {
      logger.info('이벤트 델타 분석기 시작 중...', { service: 'event-delta-analyzer' });
      
      this.isRunning = true;
      
      // Start baseline data collection
      this.startBaselineCollection();
      
      logger.info('이벤트 델타 분석기가 시작되었습니다', { 
        service: 'event-delta-analyzer',
        config: this.config
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('이벤트 델타 분석기 시작 실패', {
        error: error.message,
        service: 'event-delta-analyzer'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('이벤트 델타 분석기 종료 중...', { service: 'event-delta-analyzer' });
      
      this.isRunning = false;
      
      // Clear intervals
      if (this.baselineInterval) {
        clearInterval(this.baselineInterval);
      }

      logger.info('이벤트 델타 분석기가 종료되었습니다', { service: 'event-delta-analyzer' });

    } catch (error) {
      this.metrics.errors++;
      logger.error('이벤트 델타 분석기 종료 중 오류', {
        error: error.message,
        service: 'event-delta-analyzer'
      });
    }
  }

  /**
   * Analyze delta between baseline and anomaly period
   */
  async analyzeDelta(anomalyEvent, options = {}) {
    try {
      const startTime = Date.now();
      
      logger.info('델타 분석 시작', {
        anomalyId: anomalyEvent.id,
        anomalyTime: anomalyEvent.timestamp,
        service: 'event-delta-analyzer'
      });

      // Get baseline data
      const baseline = await this.getBaseline(anomalyEvent, options);
      
      // Get anomaly period data
      const anomalyPeriod = await this.getAnomalyPeriodData(anomalyEvent, options);

      // Perform delta analysis
      const deltaAnalysis = await this.performDeltaAnalysis(baseline, anomalyPeriod, anomalyEvent);

      // Enrich with Korean business context
      deltaAnalysis.korean_context = this.addKoreanContext(anomalyEvent, deltaAnalysis);

      const result = {
        analysis_id: `delta_${Date.now()}`,
        anomaly_event: anomalyEvent,
        timestamp: Date.now(),
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        processing_time_ms: Date.now() - startTime,
        baseline_period: baseline.period,
        anomaly_period: anomalyPeriod.period,
        delta_analysis: deltaAnalysis,
        recommendations: this.generateRecommendations(deltaAnalysis),
        confidence_score: this.calculateConfidenceScore(deltaAnalysis)
      };

      this.metrics.totalAnalyses++;
      this.metrics.totalDeltas += deltaAnalysis.significant_changes.length;
      this.metrics.significantDeltas += deltaAnalysis.significant_changes.filter(c => c.significance < this.config.significanceThreshold).length;

      // Store analysis result
      await this.storeAnalysis(result);

      // Emit analysis event
      this.emit('delta-analysis-complete', result);

      logger.info('델타 분석 완료', {
        analysisId: result.analysis_id,
        significantChanges: deltaAnalysis.significant_changes.length,
        confidence: result.confidence_score,
        processingTime: result.processing_time_ms,
        service: 'event-delta-analyzer'
      });

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('델타 분석 실패', {
        anomalyId: anomalyEvent.id,
        error: error.message,
        service: 'event-delta-analyzer'
      });
      throw error;
    }
  }

  /**
   * Get baseline data for comparison
   */
  async getBaseline(anomalyEvent, options) {
    try {
      const cacheKey = this.generateBaselineCacheKey(anomalyEvent, options);
      
      // Check cache first
      if (this.baselineCache.has(cacheKey)) {
        const cached = this.baselineCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
          return cached.data;
        }
      }

      const baselineEndTime = new Date(anomalyEvent.timestamp - (this.config.comparisonWindow * 60 * 60 * 1000));
      const baselineStartTime = new Date(baselineEndTime.getTime() - (this.config.baselineWindow * 60 * 60 * 1000));

      const query = `
        SELECT 
          service_name,
          event_type,
          COUNT(*) as event_count,
          AVG(metric_value) as avg_metric,
          MAX(metric_value) as max_metric,
          MIN(metric_value) as min_metric,
          STDDEV(metric_value) as stddev_metric,
          AVG(response_time) as avg_response_time,
          AVG(error_rate) as avg_error_rate,
          COUNT(DISTINCT user_id) as unique_users,
          korean_business_hours
        FROM wide_events
        WHERE timestamp BETWEEN '${baselineStartTime.toISOString()}' AND '${baselineEndTime.toISOString()}'
          AND service_name = '${anomalyEvent.service_name || 'unknown'}'
        GROUP BY service_name, event_type, korean_business_hours
        ORDER BY event_count DESC
      `;

      const result = await this.clickhouseService.query(query);

      const baselineData = {
        period: {
          start: baselineStartTime,
          end: baselineEndTime,
          duration_hours: this.config.baselineWindow
        },
        events: result.data,
        statistics: this.calculateBaselineStatistics(result.data),
        korean_patterns: this.extractKoreanPatterns(result.data)
      };

      // Cache the baseline
      this.baselineCache.set(cacheKey, {
        data: baselineData,
        timestamp: Date.now()
      });

      return baselineData;

    } catch (error) {
      logger.error('베이스라인 데이터 조회 실패', {
        error: error.message,
        service: 'event-delta-analyzer'
      });
      throw error;
    }
  }

  /**
   * Get anomaly period data
   */
  async getAnomalyPeriodData(anomalyEvent, options) {
    try {
      const anomalyStartTime = new Date(anomalyEvent.timestamp - (this.config.comparisonWindow * 60 * 60 * 1000));
      const anomalyEndTime = new Date(anomalyEvent.timestamp);

      const query = `
        SELECT 
          service_name,
          event_type,
          COUNT(*) as event_count,
          AVG(metric_value) as avg_metric,
          MAX(metric_value) as max_metric,
          MIN(metric_value) as min_metric,
          STDDEV(metric_value) as stddev_metric,
          AVG(response_time) as avg_response_time,
          AVG(error_rate) as avg_error_rate,
          COUNT(DISTINCT user_id) as unique_users,
          korean_business_hours,
          array_agg(alert_severity) as alert_severities
        FROM wide_events
        WHERE timestamp BETWEEN '${anomalyStartTime.toISOString()}' AND '${anomalyEndTime.toISOString()}'
          AND service_name = '${anomalyEvent.service_name || 'unknown'}'
        GROUP BY service_name, event_type, korean_business_hours
        ORDER BY event_count DESC
      `;

      const result = await this.clickhouseService.query(query);

      return {
        period: {
          start: anomalyStartTime,
          end: anomalyEndTime,
          duration_hours: this.config.comparisonWindow
        },
        events: result.data,
        statistics: this.calculateAnomalyStatistics(result.data),
        korean_patterns: this.extractKoreanPatterns(result.data)
      };

    } catch (error) {
      logger.error('이상 기간 데이터 조회 실패', {
        error: error.message,
        service: 'event-delta-analyzer'
      });
      throw error;
    }
  }

  /**
   * Perform detailed delta analysis
   */
  async performDeltaAnalysis(baseline, anomalyPeriod, anomalyEvent) {
    const analysis = {
      significant_changes: [],
      metric_deltas: {},
      pattern_changes: {},
      correlations: [],
      change_vectors: {},
      impact_assessment: {}
    };

    // Compare metrics between baseline and anomaly period
    const baselineMap = this.createEventMap(baseline.events);
    const anomalyMap = this.createEventMap(anomalyPeriod.events);

    // Analyze each metric category
    for (const [key, baselineEvent] of baselineMap) {
      const anomalyEvent = anomalyMap.get(key) || { event_count: 0, avg_metric: 0 };
      
      const delta = this.calculateMetricDelta(baselineEvent, anomalyEvent);
      
      if (delta.significance < this.config.significanceThreshold) {
        analysis.significant_changes.push({
          event_key: key,
          change_type: delta.change_type,
          magnitude: delta.magnitude,
          significance: delta.significance,
          baseline_value: delta.baseline_value,
          anomaly_value: delta.anomaly_value,
          percent_change: delta.percent_change,
          korean_description: this.getKoreanDescription(delta)
        });
      }

      analysis.metric_deltas[key] = delta;
    }

    // Analyze pattern changes
    analysis.pattern_changes = this.analyzePatternChanges(baseline, anomalyPeriod);

    // Calculate correlations
    analysis.correlations = this.calculateCorrelations(baseline, anomalyPeriod);

    // Generate change vectors
    analysis.change_vectors = this.generateChangeVectors(analysis.significant_changes);

    // Assess impact
    analysis.impact_assessment = this.assessImpact(analysis, anomalyEvent);

    return analysis;
  }

  /**
   * Calculate delta between baseline and anomaly metrics
   */
  calculateMetricDelta(baseline, anomaly) {
    const baselineValue = baseline.avg_metric || baseline.event_count || 0;
    const anomalyValue = anomaly.avg_metric || anomaly.event_count || 0;
    
    const absoluteChange = anomalyValue - baselineValue;
    const percentChange = baselineValue > 0 ? (absoluteChange / baselineValue) * 100 : 0;
    const magnitude = Math.abs(percentChange);
    
    // Statistical significance test (simplified)
    const baselineStddev = baseline.stddev_metric || Math.sqrt(baselineValue);
    const zScore = baselineStddev > 0 ? Math.abs(absoluteChange) / baselineStddev : 0;
    const significance = this.calculatePValue(zScore);
    
    const changeType = this.determineChangeType(absoluteChange, magnitude);

    return {
      baseline_value: baselineValue,
      anomaly_value: anomalyValue,
      absolute_change: absoluteChange,
      percent_change: percentChange,
      magnitude,
      significance,
      z_score: zScore,
      change_type: changeType
    };
  }

  /**
   * Analyze pattern changes between baseline and anomaly
   */
  analyzePatternChanges(baseline, anomalyPeriod) {
    const changes = {
      temporal_patterns: {},
      volume_patterns: {},
      service_patterns: {},
      korean_patterns: {}
    };

    // Compare Korean business hours patterns
    const baselineBusinessHours = baseline.events.filter(e => e.korean_business_hours);
    const anomalyBusinessHours = anomalyPeriod.events.filter(e => e.korean_business_hours);
    
    changes.korean_patterns.business_hours_impact = {
      baseline_percentage: (baselineBusinessHours.length / baseline.events.length) * 100,
      anomaly_percentage: (anomalyBusinessHours.length / anomalyPeriod.events.length) * 100
    };

    // Service distribution changes
    const baselineServices = this.groupBy(baseline.events, 'service_name');
    const anomalyServices = this.groupBy(anomalyPeriod.events, 'service_name');

    for (const [service, baselineData] of Object.entries(baselineServices)) {
      const anomalyData = anomalyServices[service] || [];
      changes.service_patterns[service] = {
        baseline_count: baselineData.length,
        anomaly_count: anomalyData.length,
        change_ratio: baselineData.length > 0 ? anomalyData.length / baselineData.length : 0
      };
    }

    return changes;
  }

  /**
   * Calculate correlations between different metrics
   */
  calculateCorrelations(baseline, anomalyPeriod) {
    const correlations = [];
    const metrics = ['avg_metric', 'avg_response_time', 'avg_error_rate', 'event_count'];
    
    // Calculate correlation matrix
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const correlation = this.pearsonCorrelation(
          baseline.events.map(e => e[metrics[i]] || 0),
          anomalyPeriod.events.map(e => e[metrics[j]] || 0)
        );

        if (Math.abs(correlation) > this.config.correlationThreshold) {
          correlations.push({
            metric_a: metrics[i],
            metric_b: metrics[j],
            correlation_coefficient: correlation,
            strength: this.getCorrelationStrength(correlation),
            korean_interpretation: this.getKoreanCorrelationInterpretation(metrics[i], metrics[j], correlation)
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Generate change vectors for visualization
   */
  generateChangeVectors(significantChanges) {
    const vectors = {};
    
    const categories = ['performance', 'errors', 'volume', 'latency'];
    
    categories.forEach(category => {
      const categoryChanges = significantChanges.filter(change => 
        this.categorizeChange(change.event_key).includes(category)
      );

      vectors[category] = {
        magnitude: this.calculateVectorMagnitude(categoryChanges),
        direction: this.calculateVectorDirection(categoryChanges),
        impact_level: this.calculateImpactLevel(categoryChanges)
      };
    });

    return vectors;
  }

  /**
   * Assess overall impact of changes
   */
  assessImpact(analysis, anomalyEvent) {
    const impact = {
      overall_severity: 'low',
      affected_services: new Set(),
      business_impact: 'minimal',
      user_impact: 'minimal',
      korean_business_context: {}
    };

    // Calculate severity based on significant changes
    const criticalChanges = analysis.significant_changes.filter(c => c.magnitude > 50);
    const highChanges = analysis.significant_changes.filter(c => c.magnitude > 20);
    
    if (criticalChanges.length > 0) {
      impact.overall_severity = 'critical';
    } else if (highChanges.length > 0) {
      impact.overall_severity = 'high';
    } else if (analysis.significant_changes.length > 0) {
      impact.overall_severity = 'medium';
    }

    // Korean business context
    impact.korean_business_context = {
      occurred_during_business_hours: this.isKoreanBusinessHours(anomalyEvent.timestamp),
      lunch_time_impact: this.isKoreanLunchTime(anomalyEvent.timestamp),
      end_of_day_impact: this.isEndOfKoreanBusinessDay(anomalyEvent.timestamp),
      estimated_affected_users: this.estimateAffectedKoreanUsers(analysis, anomalyEvent)
    };

    return impact;
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(deltaAnalysis) {
    const recommendations = [];

    // Performance recommendations
    const performanceIssues = deltaAnalysis.significant_changes.filter(c => 
      c.event_key.includes('response_time') && c.change_type === 'increase'
    );

    if (performanceIssues.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        korean_title: '성능 최적화 필요',
        action: '응답 시간 증가에 대한 즉시 조치가 필요합니다',
        steps: [
          '서버 리소스 사용량 확인',
          '데이터베이스 쿼리 최적화',
          '캐시 히트율 점검',
          '네트워크 지연 분석'
        ]
      });
    }

    // Error rate recommendations
    const errorIssues = deltaAnalysis.significant_changes.filter(c =>
      c.event_key.includes('error_rate') && c.change_type === 'increase'
    );

    if (errorIssues.length > 0) {
      recommendations.push({
        type: 'reliability',
        priority: 'critical',
        korean_title: '오류율 증가 대응',
        action: '오류율 급증에 대한 긴급 대응이 필요합니다',
        steps: [
          '최근 배포 롤백 검토',
          '에러 로그 상세 분석',
          '의존성 서비스 상태 확인',
          '모니터링 알림 강화'
        ]
      });
    }

    // Korean business hours specific recommendations
    if (deltaAnalysis.pattern_changes.korean_patterns?.business_hours_impact) {
      const businessHoursImpact = deltaAnalysis.pattern_changes.korean_patterns.business_hours_impact;
      
      if (Math.abs(businessHoursImpact.anomaly_percentage - businessHoursImpact.baseline_percentage) > 20) {
        recommendations.push({
          type: 'korean_business',
          priority: 'medium',
          korean_title: '업무시간 패턴 변화',
          action: '한국 업무시간 중 트래픽 패턴 변화를 모니터링해야 합니다',
          steps: [
            '업무시간 중 사용자 행동 패턴 분석',
            '점심시간 (12-13시) 트래픽 패턴 확인',
            '퇴근시간 (17-19시) 부하 분산 최적화'
          ]
        });
      }
    }

    return recommendations;
  }

  /**
   * Utility methods
   */
  calculateBaselineStatistics(events) {
    return {
      total_events: events.length,
      avg_event_count: events.reduce((sum, e) => sum + e.event_count, 0) / events.length,
      unique_services: new Set(events.map(e => e.service_name)).size
    };
  }

  calculateAnomalyStatistics(events) {
    return {
      total_events: events.length,
      avg_event_count: events.reduce((sum, e) => sum + e.event_count, 0) / events.length,
      unique_services: new Set(events.map(e => e.service_name)).size,
      alert_distribution: this.analyzeAlertDistribution(events)
    };
  }

  createEventMap(events) {
    const map = new Map();
    events.forEach(event => {
      const key = `${event.service_name}_${event.event_type}_${event.korean_business_hours}`;
      map.set(key, event);
    });
    return map;
  }

  generateBaselineCacheKey(anomalyEvent, options) {
    return `baseline_${anomalyEvent.service_name}_${Math.floor(anomalyEvent.timestamp / 3600000)}_${this.config.baselineWindow}`;
  }

  calculatePValue(zScore) {
    // Simplified p-value calculation
    return Math.max(0.001, 2 * (1 - this.normalCDF(Math.abs(zScore))));
  }

  normalCDF(x) {
    // Approximation of normal cumulative distribution function
    return (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI))) / 2;
  }

  determineChangeType(absoluteChange, magnitude) {
    if (Math.abs(absoluteChange) < 0.01) return 'no_change';
    if (absoluteChange > 0) {
      return magnitude > 50 ? 'spike' : 'increase';
    } else {
      return magnitude > 50 ? 'drop' : 'decrease';
    }
  }

  pearsonCorrelation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.map((xi, i) => xi * y[i]).reduce((a, b) => a + b, 0);
    const sumXX = x.map(xi => xi * xi).reduce((a, b) => a + b, 0);
    const sumYY = y.map(yi => yi * yi).reduce((a, b) => a + b, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  getCorrelationStrength(correlation) {
    const abs = Math.abs(correlation);
    if (abs > 0.9) return 'very_strong';
    if (abs > 0.7) return 'strong';
    if (abs > 0.5) return 'moderate';
    return 'weak';
  }

  groupBy(array, key) {
    return array.reduce((result, item) => {
      (result[item[key]] = result[item[key]] || []).push(item);
      return result;
    }, {});
  }

  calculateConfidenceScore(deltaAnalysis) {
    const significantChanges = deltaAnalysis.significant_changes.length;
    const strongCorrelations = deltaAnalysis.correlations.filter(c => Math.abs(c.correlation_coefficient) > 0.8).length;
    
    let confidence = 0.5; // Base confidence
    confidence += Math.min(0.3, significantChanges * 0.1);
    confidence += Math.min(0.2, strongCorrelations * 0.1);
    
    return Math.min(1.0, confidence);
  }

  isKoreanBusinessHours(timestamp) {
    const date = new Date(timestamp);
    const koreanTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const hour = koreanTime.getHours();
    const day = koreanTime.getDay();
    
    return this.config.koreanBusinessHours.weekdays.includes(day) &&
           hour >= this.config.koreanBusinessHours.start &&
           hour < this.config.koreanBusinessHours.end;
  }

  addKoreanContext(anomalyEvent, deltaAnalysis) {
    return {
      business_hours_context: this.isKoreanBusinessHours(anomalyEvent.timestamp) ? '업무시간' : '업무외시간',
      estimated_user_impact: this.estimateKoreanUserImpact(deltaAnalysis),
      cultural_considerations: this.getKoreanCulturalConsiderations(anomalyEvent.timestamp)
    };
  }

  getKoreanDescription(delta) {
    const changeMap = {
      'spike': '급증',
      'increase': '증가',
      'decrease': '감소',
      'drop': '급감',
      'no_change': '변화없음'
    };

    return `${delta.baseline_value.toFixed(2)}에서 ${delta.anomaly_value.toFixed(2)}로 ${changeMap[delta.change_type]} (${delta.percent_change.toFixed(1)}%)`;
  }

  async storeAnalysis(result) {
    try {
      if (this.clickhouseService) {
        await this.clickhouseService.insertWideEvent({
          event_type: 'delta_analysis',
          service_name: 'event-delta-analyzer',
          analysis_id: result.analysis_id,
          anomaly_id: result.anomaly_event.id,
          significant_changes_count: result.delta_analysis.significant_changes.length,
          confidence_score: result.confidence_score,
          processing_time_ms: result.processing_time_ms,
          korean_business_hours: this.isKoreanBusinessHours(result.timestamp)
        });
      }

      if (this.redisService) {
        await this.redisService.set(`delta_analysis:${result.analysis_id}`, result, 86400); // 24 hours
      }
    } catch (error) {
      logger.error('델타 분석 결과 저장 실패', {
        analysisId: result.analysis_id,
        error: error.message,
        service: 'event-delta-analyzer'
      });
    }
  }

  startBaselineCollection() {
    // Update baseline cache periodically
    this.baselineInterval = setInterval(() => {
      this.cleanupBaselineCache();
    }, 300000); // Every 5 minutes
  }

  cleanupBaselineCache() {
    const now = Date.now();
    for (const [key, value] of this.baselineCache.entries()) {
      if (now - value.timestamp > 900000) { // 15 minutes
        this.baselineCache.delete(key);
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      return {
        status: this.isRunning ? 'healthy' : 'stopped',
        running: this.isRunning,
        metrics: this.getMetrics(),
        cache_size: this.baselineCache.size,
        services: {
          clickhouse: !!this.clickhouseService,
          redis: !!this.redisService
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        error: error.message
      };
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      analysis_rate: this.metrics.totalAnalyses / ((Date.now() - this.metrics.startTime) / 1000) || 0,
      significant_delta_ratio: this.metrics.totalDeltas > 0 ? this.metrics.significantDeltas / this.metrics.totalDeltas : 0
    };
  }
}

module.exports = EventDeltaAnalyzer;