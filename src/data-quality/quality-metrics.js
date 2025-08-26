/**
 * Quality Metrics Collection System
 * AIRIS EPM - Enterprise Performance Management
 * 데이터 품질 메트릭 수집 및 분석 시스템
 */

// 품질 메트릭 수집기
export class QualityMetricsCollector {
  constructor(options = {}) {
    this.options = {
      collectionInterval: options.collectionInterval || 60000, // 1분
      retentionPeriod: options.retentionPeriod || 86400000,   // 24시간
      aggregationLevels: options.aggregationLevels || ['1m', '5m', '1h', '1d'],
      ...options
    };
    
    this.metrics = new Map();
    this.aggregatedMetrics = new Map();
    this.collectionTimer = null;
    this.startTime = Date.now();
  }

  // 메트릭 수집 시작
  start() {
    if (this.collectionTimer) {
      return;
    }
    
    this.collectionTimer = setInterval(() => {
      this.aggregate();
      this.cleanup();
    }, this.options.collectionInterval);
    
    console.log('Quality metrics collection started');
  }

  // 메트릭 수집 중지
  stop() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
      console.log('Quality metrics collection stopped');
    }
  }

  // 메트릭 기록
  record(metricType, metricName, value, metadata = {}) {
    const key = `${metricType}.${metricName}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const metric = {
      timestamp: Date.now(),
      value,
      metadata
    };
    
    this.metrics.get(key).push(metric);
    
    // 실시간 알림 체크
    this.checkAlerts(metricType, metricName, value);
  }

  // 품질 점수 기록
  recordQualityScore(dataType, score, dimensions) {
    this.record('quality', `${dataType}.score`, score, { dimensions });
    
    // 차원별 점수 기록
    for (const [dimension, value] of Object.entries(dimensions)) {
      this.record('quality', `${dataType}.${dimension}`, value);
    }
  }

  // 검증 결과 기록
  recordValidation(dataType, isValid, errors = []) {
    this.record('validation', `${dataType}.result`, isValid ? 1 : 0);
    
    if (errors.length > 0) {
      this.record('validation', `${dataType}.errors`, errors.length, { errors });
    }
  }

  // 이상치 탐지 결과 기록
  recordAnomaly(metricName, isAnomaly, confidence, details = {}) {
    this.record('anomaly', metricName, isAnomaly ? 1 : 0, { confidence, ...details });
    
    if (isAnomaly) {
      this.record('anomaly', 'detection_rate', 1);
    }
  }

  // 클렌징 결과 기록
  recordCleansing(dataType, cleaned, removed, transformed) {
    this.record('cleansing', `${dataType}.cleaned`, cleaned);
    this.record('cleansing', `${dataType}.removed`, removed);
    this.record('cleansing', `${dataType}.transformed`, transformed);
  }

  // 처리 성능 기록
  recordPerformance(operation, duration, success = true) {
    this.record('performance', `${operation}.duration`, duration);
    this.record('performance', `${operation}.success`, success ? 1 : 0);
    
    // 처리량 계산
    const throughput = duration > 0 ? 1000 / duration : 0;
    this.record('performance', `${operation}.throughput`, throughput);
  }

  // 메트릭 집계
  aggregate() {
    const now = Date.now();
    
    for (const level of this.options.aggregationLevels) {
      const window = this.parseTimeWindow(level);
      const aggregationKey = `${level}_${Math.floor(now / window) * window}`;
      
      if (!this.aggregatedMetrics.has(aggregationKey)) {
        this.aggregatedMetrics.set(aggregationKey, new Map());
      }
      
      const aggregation = this.aggregatedMetrics.get(aggregationKey);
      
      for (const [metricKey, values] of this.metrics.entries()) {
        const windowValues = values.filter(v => v.timestamp >= now - window);
        
        if (windowValues.length > 0) {
          const stats = this.calculateStatistics(windowValues);
          aggregation.set(metricKey, {
            ...stats,
            window: level,
            timestamp: now
          });
        }
      }
    }
  }

  // 통계 계산
  calculateStatistics(values) {
    const numbers = values.map(v => v.value);
    const sorted = numbers.sort((a, b) => a - b);
    
    const stats = {
      count: numbers.length,
      sum: numbers.reduce((sum, n) => sum + n, 0),
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      avg: numbers.reduce((sum, n) => sum + n, 0) / numbers.length
    };
    
    // 중앙값
    stats.median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    // 백분위수
    stats.p50 = this.getPercentile(sorted, 50);
    stats.p90 = this.getPercentile(sorted, 90);
    stats.p95 = this.getPercentile(sorted, 95);
    stats.p99 = this.getPercentile(sorted, 99);
    
    // 표준편차
    const variance = numbers.reduce((sum, n) => sum + Math.pow(n - stats.avg, 2), 0) / numbers.length;
    stats.stdDev = Math.sqrt(variance);
    
    return stats;
  }

  // 백분위수 계산
  getPercentile(sortedArray, percentile) {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  // 시간 윈도우 파싱
  parseTimeWindow(window) {
    const units = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
    
    const match = window.match(/(\d+)([mhd])/);
    if (match) {
      return parseInt(match[1]) * units[match[2]];
    }
    
    return 60000; // 기본값: 1분
  }

  // 오래된 데이터 정리
  cleanup() {
    const cutoff = Date.now() - this.options.retentionPeriod;
    
    // 원시 메트릭 정리
    for (const [key, values] of this.metrics.entries()) {
      const filtered = values.filter(v => v.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filtered);
      }
    }
    
    // 집계된 메트릭 정리
    for (const [key, _] of this.aggregatedMetrics.entries()) {
      const timestamp = parseInt(key.split('_')[1]);
      if (timestamp < cutoff) {
        this.aggregatedMetrics.delete(key);
      }
    }
  }

  // 알림 체크
  checkAlerts(metricType, metricName, value) {
    // 임계값 기반 알림
    const alertThresholds = {
      'quality.score': { min: 0.7 },
      'validation.errors': { max: 10 },
      'anomaly.detection_rate': { max: 0.1 },
      'performance.duration': { max: 1000 }
    };
    
    const key = `${metricType}.${metricName}`;
    const threshold = alertThresholds[key];
    
    if (threshold) {
      if (threshold.min && value < threshold.min) {
        this.triggerAlert(key, value, 'below_minimum', threshold.min);
      }
      if (threshold.max && value > threshold.max) {
        this.triggerAlert(key, value, 'above_maximum', threshold.max);
      }
    }
  }

  // 알림 발생
  triggerAlert(metric, value, type, threshold) {
    const alert = {
      timestamp: new Date().toISOString(),
      metric,
      value,
      type,
      threshold,
      severity: this.getAlertSeverity(metric, value, threshold)
    };
    
    console.warn('Quality Alert:', alert);
    
    // 알림 기록
    this.record('alerts', metric, 1, alert);
  }

  // 알림 심각도 판단
  getAlertSeverity(metric, value, threshold) {
    const deviation = Math.abs(value - threshold) / threshold;
    
    if (deviation > 0.5) return 'critical';
    if (deviation > 0.3) return 'high';
    if (deviation > 0.1) return 'medium';
    return 'low';
  }

  // 현재 메트릭 조회
  getCurrentMetrics(metricType = null) {
    const result = {};
    
    for (const [key, values] of this.metrics.entries()) {
      if (!metricType || key.startsWith(metricType)) {
        const latest = values[values.length - 1];
        result[key] = latest ? latest.value : null;
      }
    }
    
    return result;
  }

  // 집계된 메트릭 조회
  getAggregatedMetrics(level = '1m', metricType = null) {
    const now = Date.now();
    const window = this.parseTimeWindow(level);
    const aggregationKey = `${level}_${Math.floor(now / window) * window}`;
    
    const aggregation = this.aggregatedMetrics.get(aggregationKey);
    if (!aggregation) {
      return {};
    }
    
    const result = {};
    
    for (const [key, stats] of aggregation.entries()) {
      if (!metricType || key.startsWith(metricType)) {
        result[key] = stats;
      }
    }
    
    return result;
  }

  // 품질 보고서 생성
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: {
        totalMetrics: this.metrics.size,
        totalDataPoints: Array.from(this.metrics.values()).reduce((sum, v) => sum + v.length, 0),
        aggregationLevels: this.options.aggregationLevels
      },
      currentMetrics: {},
      aggregatedMetrics: {},
      trends: {}
    };
    
    // 메트릭 타입별 현재 상태
    const metricTypes = ['quality', 'validation', 'anomaly', 'cleansing', 'performance'];
    
    for (const type of metricTypes) {
      report.currentMetrics[type] = this.getCurrentMetrics(type);
      report.aggregatedMetrics[type] = this.getAggregatedMetrics('1h', type);
      report.trends[type] = this.calculateTrends(type);
    }
    
    // 전체 품질 점수 계산
    report.overallQualityScore = this.calculateOverallQualityScore();
    
    // 권장사항 생성
    report.recommendations = this.generateRecommendations(report);
    
    return report;
  }

  // 추세 계산
  calculateTrends(metricType) {
    const trends = {};
    
    for (const [key, values] of this.metrics.entries()) {
      if (key.startsWith(metricType)) {
        if (values.length >= 2) {
          const recent = values.slice(-10);
          const older = values.slice(-20, -10);
          
          const recentAvg = recent.reduce((sum, v) => sum + v.value, 0) / recent.length;
          const olderAvg = older.length > 0
            ? older.reduce((sum, v) => sum + v.value, 0) / older.length
            : recentAvg;
          
          const change = ((recentAvg - olderAvg) / olderAvg) * 100;
          
          trends[key] = {
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
            changePercent: Math.abs(change)
          };
        }
      }
    }
    
    return trends;
  }

  // 전체 품질 점수 계산
  calculateOverallQualityScore() {
    const qualityMetrics = this.getCurrentMetrics('quality');
    const scores = Object.values(qualityMetrics).filter(v => v !== null);
    
    if (scores.length === 0) {
      return null;
    }
    
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    
    // 검증 실패율 반영
    const validationMetrics = this.getCurrentMetrics('validation');
    const validationScores = Object.values(validationMetrics).filter(v => v !== null);
    const validationRate = validationScores.length > 0
      ? validationScores.reduce((sum, s) => sum + s, 0) / validationScores.length
      : 1;
    
    // 이상치 비율 반영
    const anomalyMetrics = this.getCurrentMetrics('anomaly');
    const anomalyScores = Object.values(anomalyMetrics).filter(v => v !== null);
    const anomalyRate = anomalyScores.length > 0
      ? 1 - (anomalyScores.reduce((sum, s) => sum + s, 0) / anomalyScores.length)
      : 1;
    
    // 가중 평균
    return (avgScore * 0.5) + (validationRate * 0.3) + (anomalyRate * 0.2);
  }

  // 권장사항 생성
  generateRecommendations(report) {
    const recommendations = [];
    
    // 품질 점수 기반 권장사항
    if (report.overallQualityScore < 0.7) {
      recommendations.push({
        type: 'quality',
        priority: 'high',
        message: '전체 데이터 품질이 낮습니다. 데이터 소스와 수집 프로세스를 점검하세요.',
        score: report.overallQualityScore
      });
    }
    
    // 검증 오류 기반 권장사항
    const validationErrors = report.currentMetrics.validation;
    for (const [key, value] of Object.entries(validationErrors)) {
      if (key.includes('errors') && value > 5) {
        recommendations.push({
          type: 'validation',
          priority: 'medium',
          message: `${key}에서 검증 오류가 많이 발생하고 있습니다.`,
          errorCount: value
        });
      }
    }
    
    // 이상치 기반 권장사항
    const anomalyRates = report.currentMetrics.anomaly;
    for (const [key, value] of Object.entries(anomalyRates)) {
      if (value > 0.1) {
        recommendations.push({
          type: 'anomaly',
          priority: 'medium',
          message: `${key}에서 이상치가 자주 감지됩니다.`,
          rate: value
        });
      }
    }
    
    // 성능 기반 권장사항
    const performanceMetrics = report.aggregatedMetrics.performance;
    for (const [key, stats] of Object.entries(performanceMetrics)) {
      if (key.includes('duration') && stats.p95 > 1000) {
        recommendations.push({
          type: 'performance',
          priority: 'low',
          message: `${key} 처리 시간이 느립니다. 최적화가 필요할 수 있습니다.`,
          p95: stats.p95
        });
      }
    }
    
    return recommendations;
  }
}

// 품질 대시보드 데이터 제공자
export class QualityDashboardProvider {
  constructor(collector) {
    this.collector = collector;
  }

  // 실시간 대시보드 데이터
  getDashboardData() {
    return {
      summary: this.getSummaryStats(),
      charts: this.getChartData(),
      alerts: this.getRecentAlerts(),
      trends: this.getTrendData(),
      recommendations: this.collector.generateRecommendations(this.collector.generateReport())
    };
  }

  // 요약 통계
  getSummaryStats() {
    const report = this.collector.generateReport();
    
    return {
      overallQuality: {
        score: report.overallQualityScore,
        grade: this.getQualityGrade(report.overallQualityScore),
        trend: this.collector.calculateTrends('quality')['quality.score']?.direction || 'stable'
      },
      validation: {
        successRate: this.calculateSuccessRate('validation'),
        errorCount: this.getTotalErrors(),
        trend: this.collector.calculateTrends('validation')['validation.errors']?.direction || 'stable'
      },
      anomalies: {
        detectionRate: this.getAnomalyRate(),
        count: this.getAnomalyCount(),
        trend: this.collector.calculateTrends('anomaly')['anomaly.detection_rate']?.direction || 'stable'
      },
      performance: {
        avgDuration: this.getAveragePerformance(),
        throughput: this.getThroughput(),
        trend: this.collector.calculateTrends('performance')['performance.duration']?.direction || 'stable'
      }
    };
  }

  // 차트 데이터
  getChartData() {
    return {
      qualityTimeSeries: this.getTimeSeries('quality.score', '5m'),
      validationPieChart: this.getValidationDistribution(),
      anomalyHeatmap: this.getAnomalyHeatmap(),
      performanceHistogram: this.getPerformanceHistogram()
    };
  }

  // 시계열 데이터
  getTimeSeries(metricKey, interval) {
    const data = [];
    const aggregations = this.collector.aggregatedMetrics;
    
    for (const [key, metrics] of aggregations) {
      if (key.startsWith(interval)) {
        const metric = metrics.get(metricKey);
        if (metric) {
          data.push({
            timestamp: metric.timestamp,
            value: metric.avg,
            min: metric.min,
            max: metric.max
          });
        }
      }
    }
    
    return data.sort((a, b) => a.timestamp - b.timestamp);
  }

  // 검증 분포
  getValidationDistribution() {
    const validation = this.collector.getCurrentMetrics('validation');
    let passed = 0;
    let failed = 0;
    
    for (const [key, value] of Object.entries(validation)) {
      if (key.includes('result')) {
        if (value === 1) passed++;
        else failed++;
      }
    }
    
    return {
      passed,
      failed,
      total: passed + failed
    };
  }

  // 이상치 히트맵
  getAnomalyHeatmap() {
    const anomalies = this.collector.metrics.get('anomaly.detection_rate') || [];
    const heatmap = {};
    
    for (const anomaly of anomalies) {
      const hour = new Date(anomaly.timestamp).getHours();
      const day = new Date(anomaly.timestamp).getDay();
      
      const key = `${day}_${hour}`;
      heatmap[key] = (heatmap[key] || 0) + anomaly.value;
    }
    
    return heatmap;
  }

  // 성능 히스토그램
  getPerformanceHistogram() {
    const performance = this.collector.metrics.get('performance.duration') || [];
    const buckets = [0, 100, 200, 500, 1000, 2000, 5000, 10000];
    const histogram = {};
    
    for (let i = 0; i < buckets.length - 1; i++) {
      histogram[`${buckets[i]}-${buckets[i + 1]}`] = 0;
    }
    
    for (const perf of performance) {
      for (let i = 0; i < buckets.length - 1; i++) {
        if (perf.value >= buckets[i] && perf.value < buckets[i + 1]) {
          histogram[`${buckets[i]}-${buckets[i + 1]}`]++;
          break;
        }
      }
    }
    
    return histogram;
  }

  // 최근 알림
  getRecentAlerts() {
    const alerts = this.collector.metrics.get('alerts') || [];
    return alerts.slice(-10).map(a => a.metadata);
  }

  // 추세 데이터
  getTrendData() {
    return this.collector.calculateTrends('quality');
  }

  // 헬퍼 함수들
  getQualityGrade(score) {
    if (!score) return 'N/A';
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  }

  calculateSuccessRate(type) {
    const metrics = this.collector.getCurrentMetrics(type);
    const values = Object.values(metrics).filter(v => v !== null);
    
    if (values.length === 0) return 0;
    
    return (values.filter(v => v === 1).length / values.length) * 100;
  }

  getTotalErrors() {
    const validation = this.collector.getCurrentMetrics('validation');
    let total = 0;
    
    for (const [key, value] of Object.entries(validation)) {
      if (key.includes('errors')) {
        total += value || 0;
      }
    }
    
    return total;
  }

  getAnomalyRate() {
    const anomalies = this.collector.getCurrentMetrics('anomaly');
    const values = Object.values(anomalies).filter(v => v !== null);
    
    if (values.length === 0) return 0;
    
    return (values.reduce((sum, v) => sum + v, 0) / values.length) * 100;
  }

  getAnomalyCount() {
    const anomalies = this.collector.metrics.get('anomaly.detection_rate') || [];
    return anomalies.filter(a => a.value > 0).length;
  }

  getAveragePerformance() {
    const perf = this.collector.getAggregatedMetrics('1m', 'performance');
    const durations = [];
    
    for (const [key, stats] of Object.entries(perf)) {
      if (key.includes('duration')) {
        durations.push(stats.avg);
      }
    }
    
    if (durations.length === 0) return 0;
    
    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
  }

  getThroughput() {
    const perf = this.collector.getAggregatedMetrics('1m', 'performance');
    const throughputs = [];
    
    for (const [key, stats] of Object.entries(perf)) {
      if (key.includes('throughput')) {
        throughputs.push(stats.avg);
      }
    }
    
    if (throughputs.length === 0) return 0;
    
    return throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length;
  }
}

export default {
  QualityMetricsCollector,
  QualityDashboardProvider
};