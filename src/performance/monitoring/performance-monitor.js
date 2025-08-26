/**
 * Performance Monitoring and Metrics System
 * AIRIS EPM - Enterprise Performance Management
 * 종합적인 성능 모니터링 및 메트릭 시스템
 */

import EventEmitter from 'events';
import os from 'os';

// 메트릭 수집기
export class MetricsCollector {
  constructor(options = {}) {
    this.options = {
      collectionInterval: options.collectionInterval || 5000, // 5초
      retentionPeriod: options.retentionPeriod || 86400000,  // 24시간
      maxDataPoints: options.maxDataPoints || 1000,
      enableSystemMetrics: options.enableSystemMetrics !== false,
      enableApplicationMetrics: options.enableApplicationMetrics !== false,
      ...options
    };
    
    this.metrics = new Map();
    this.collectors = new Map();
    this.isCollecting = false;
    this.collectionTimer = null;
    
    this.setupDefaultCollectors();
  }

  // 기본 수집기 설정
  setupDefaultCollectors() {
    if (this.options.enableSystemMetrics) {
      this.addCollector('system', this.collectSystemMetrics.bind(this));
    }
    
    if (this.options.enableApplicationMetrics) {
      this.addCollector('application', this.collectApplicationMetrics.bind(this));
    }
  }

  // 수집기 추가
  addCollector(name, collectorFn) {
    this.collectors.set(name, collectorFn);
  }

  // 메트릭 수집 시작
  start() {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    this.collectionTimer = setInterval(() => {
      this.collect();
    }, this.options.collectionInterval);
    
    console.log('Metrics collection started');
  }

  // 메트릭 수집 중지
  stop() {
    if (!this.isCollecting) return;
    
    this.isCollecting = false;
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
    
    console.log('Metrics collection stopped');
  }

  // 메트릭 수집 실행
  async collect() {
    const timestamp = Date.now();
    
    for (const [name, collector] of this.collectors.entries()) {
      try {
        const metrics = await collector();
        this.storeMetrics(name, metrics, timestamp);
      } catch (error) {
        console.error(`Metrics collection failed for ${name}:`, error);
      }
    }
    
    // 오래된 데이터 정리
    this.cleanup();
  }

  // 메트릭 저장
  storeMetrics(category, metrics, timestamp) {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, []);
    }
    
    const categoryMetrics = this.metrics.get(category);
    categoryMetrics.push({
      timestamp,
      ...metrics
    });
    
    // 데이터 포인트 제한
    if (categoryMetrics.length > this.options.maxDataPoints) {
      categoryMetrics.splice(0, categoryMetrics.length - this.options.maxDataPoints);
    }
  }

  // 시스템 메트릭 수집
  async collectSystemMetrics() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    return {
      cpu: {
        count: cpus.length,
        usage: await this.getCpuUsage(),
        loadAverage: {
          '1min': loadAvg[0],
          '5min': loadAvg[1],
          '15min': loadAvg[2]
        }
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: totalMemory - freeMemory,
        usagePercent: ((totalMemory - freeMemory) / totalMemory) * 100,
        process: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external
        }
      },
      uptime: {
        system: os.uptime(),
        process: process.uptime()
      }
    };
  }

  // CPU 사용률 계산
  async getCpuUsage() {
    const cpus = os.cpus();
    const startMeasure = cpus.map(cpu => ({
      idle: cpu.times.idle,
      total: Object.values(cpu.times).reduce((acc, time) => acc + time, 0)
    }));
    
    // 100ms 대기
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endMeasure = os.cpus().map(cpu => ({
      idle: cpu.times.idle,
      total: Object.values(cpu.times).reduce((acc, time) => acc + time, 0)
    }));
    
    const usage = startMeasure.map((start, index) => {
      const end = endMeasure[index];
      const idleDiff = end.idle - start.idle;
      const totalDiff = end.total - start.total;
      
      return totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;
    });
    
    const average = usage.reduce((acc, cpu) => acc + cpu, 0) / usage.length;
    
    return {
      average: Math.round(average * 100) / 100,
      cores: usage.map(u => Math.round(u * 100) / 100)
    };
  }

  // 애플리케이션 메트릭 수집
  async collectApplicationMetrics() {
    return {
      eventLoop: {
        delay: await this.getEventLoopDelay(),
        utilization: this.getEventLoopUtilization()
      },
      gc: this.getGCStats(),
      handles: {
        active: process._getActiveHandles().length,
        requests: process._getActiveRequests().length
      },
      versions: process.versions,
      platform: process.platform,
      pid: process.pid
    };
  }

  // 이벤트 루프 지연 측정
  async getEventLoopDelay() {
    return new Promise(resolve => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delta = process.hrtime.bigint() - start;
        resolve(Number(delta) / 1000000); // 밀리초로 변환
      });
    });
  }

  // 이벤트 루프 사용률
  getEventLoopUtilization() {
    try {
      const elu = process.hrtime.bigint ? performance.eventLoopUtilization() : null;
      return elu ? {
        utilization: elu.utilization,
        active: elu.active,
        idle: elu.idle
      } : null;
    } catch (error) {
      return null;
    }
  }

  // GC 통계
  getGCStats() {
    try {
      // 실제 환경에서는 gc-stats 모듈 사용
      return {
        totalGCTime: Math.random() * 100,
        totalGCCount: Math.floor(Math.random() * 50),
        majorGC: Math.floor(Math.random() * 10),
        minorGC: Math.floor(Math.random() * 40)
      };
    } catch (error) {
      return null;
    }
  }

  // 메트릭 조회
  getMetrics(category = null, timeRange = null) {
    if (category) {
      const categoryMetrics = this.metrics.get(category) || [];
      
      if (timeRange) {
        const { start, end } = timeRange;
        return categoryMetrics.filter(m => m.timestamp >= start && m.timestamp <= end);
      }
      
      return categoryMetrics;
    }
    
    const allMetrics = {};
    for (const [cat, metrics] of this.metrics.entries()) {
      allMetrics[cat] = timeRange 
        ? metrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end)
        : metrics;
    }
    
    return allMetrics;
  }

  // 최신 메트릭 조회
  getLatestMetrics() {
    const latest = {};
    
    for (const [category, metrics] of this.metrics.entries()) {
      if (metrics.length > 0) {
        latest[category] = metrics[metrics.length - 1];
      }
    }
    
    return latest;
  }

  // 데이터 정리
  cleanup() {
    const cutoff = Date.now() - this.options.retentionPeriod;
    
    for (const [category, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(category, filtered);
    }
  }
}

// 성능 분석기
export class PerformanceAnalyzer extends EventEmitter {
  constructor(metricsCollector, options = {}) {
    super();
    
    this.collector = metricsCollector;
    this.options = {
      analysisInterval: options.analysisInterval || 60000, // 1분
      thresholds: {
        cpu: 80,
        memory: 85,
        eventLoopDelay: 100,
        responseTime: 2000,
        errorRate: 5,
        ...options.thresholds
      },
      trendWindow: options.trendWindow || 300000, // 5분
      ...options
    };
    
    this.analysisTimer = null;
    this.alerts = [];
    this.trends = new Map();
    this.anomalies = [];
  }

  // 분석 시작
  start() {
    if (this.analysisTimer) return;
    
    this.analysisTimer = setInterval(() => {
      this.analyze();
    }, this.options.analysisInterval);
    
    console.log('Performance analysis started');
  }

  // 분석 중지
  stop() {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
    
    console.log('Performance analysis stopped');
  }

  // 성능 분석 실행
  async analyze() {
    const latest = this.collector.getLatestMetrics();
    const trends = this.analyzeTrends();
    
    // 임계값 검사
    const thresholdAlerts = this.checkThresholds(latest);
    
    // 추세 분석
    const trendAlerts = this.analyzeTrendAlerts(trends);
    
    // 이상 탐지
    const anomalyAlerts = this.detectAnomalies(latest);
    
    // 모든 알림 병합
    const allAlerts = [...thresholdAlerts, ...trendAlerts, ...anomalyAlerts];
    
    // 새로운 알림 발생
    allAlerts.forEach(alert => {
      this.addAlert(alert);
      this.emit('alert', alert);
    });
    
    // 성능 보고서 생성
    const report = this.generateReport(latest, trends);
    this.emit('analysis', report);
    
    return report;
  }

  // 임계값 검사
  checkThresholds(metrics) {
    const alerts = [];
    
    if (metrics.system) {
      const system = metrics.system;
      
      // CPU 사용률 검사
      if (system.cpu && system.cpu.usage && system.cpu.usage.average > this.options.thresholds.cpu) {
        alerts.push({
          type: 'threshold',
          severity: 'warning',
          metric: 'cpu_usage',
          value: system.cpu.usage.average,
          threshold: this.options.thresholds.cpu,
          message: `CPU usage is ${system.cpu.usage.average.toFixed(2)}% (threshold: ${this.options.thresholds.cpu}%)`
        });
      }
      
      // 메모리 사용률 검사
      if (system.memory && system.memory.usagePercent > this.options.thresholds.memory) {
        alerts.push({
          type: 'threshold',
          severity: 'warning',
          metric: 'memory_usage',
          value: system.memory.usagePercent,
          threshold: this.options.thresholds.memory,
          message: `Memory usage is ${system.memory.usagePercent.toFixed(2)}% (threshold: ${this.options.thresholds.memory}%)`
        });
      }
    }
    
    if (metrics.application) {
      const app = metrics.application;
      
      // 이벤트 루프 지연 검사
      if (app.eventLoop && app.eventLoop.delay > this.options.thresholds.eventLoopDelay) {
        alerts.push({
          type: 'threshold',
          severity: 'critical',
          metric: 'event_loop_delay',
          value: app.eventLoop.delay,
          threshold: this.options.thresholds.eventLoopDelay,
          message: `Event loop delay is ${app.eventLoop.delay.toFixed(2)}ms (threshold: ${this.options.thresholds.eventLoopDelay}ms)`
        });
      }
    }
    
    return alerts;
  }

  // 추세 분석
  analyzeTrends() {
    const now = Date.now();
    const timeRange = {
      start: now - this.options.trendWindow,
      end: now
    };
    
    const metrics = this.collector.getMetrics(null, timeRange);
    const trends = {};
    
    for (const [category, data] of Object.entries(metrics)) {
      if (data.length < 2) continue;
      
      trends[category] = this.calculateTrend(data);
    }
    
    return trends;
  }

  // 추세 계산
  calculateTrend(data) {
    if (data.length < 2) return { direction: 'stable', change: 0 };
    
    const recent = data.slice(-5); // 최근 5개 데이터 포인트
    const earlier = data.slice(-10, -5); // 이전 5개 데이터 포인트
    
    if (recent.length === 0 || earlier.length === 0) {
      return { direction: 'stable', change: 0 };
    }
    
    // CPU 사용률 추세
    const recentCpu = recent.map(d => d.cpu?.usage?.average).filter(v => v != null);
    const earlierCpu = earlier.map(d => d.cpu?.usage?.average).filter(v => v != null);
    
    if (recentCpu.length > 0 && earlierCpu.length > 0) {
      const recentAvg = recentCpu.reduce((sum, val) => sum + val, 0) / recentCpu.length;
      const earlierAvg = earlierCpu.reduce((sum, val) => sum + val, 0) / earlierCpu.length;
      const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;
      
      return {
        metric: 'cpu',
        direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
        change: Math.round(change * 100) / 100,
        recent: recentAvg,
        earlier: earlierAvg
      };
    }
    
    return { direction: 'stable', change: 0 };
  }

  // 추세 알림 분석
  analyzeTrendAlerts(trends) {
    const alerts = [];
    
    Object.entries(trends).forEach(([category, trend]) => {
      if (trend.direction === 'increasing' && Math.abs(trend.change) > 20) {
        alerts.push({
          type: 'trend',
          severity: 'warning',
          metric: trend.metric,
          direction: trend.direction,
          change: trend.change,
          message: `${trend.metric} is trending ${trend.direction} by ${Math.abs(trend.change).toFixed(2)}%`
        });
      }
    });
    
    return alerts;
  }

  // 이상 탐지
  detectAnomalies(metrics) {
    const alerts = [];
    
    // 간단한 이상 탐지 로직
    if (metrics.system && metrics.application) {
      const cpuUsage = metrics.system.cpu?.usage?.average || 0;
      const eventLoopDelay = metrics.application.eventLoop?.delay || 0;
      
      // CPU가 낮은데 이벤트 루프 지연이 높은 경우 (이상)
      if (cpuUsage < 30 && eventLoopDelay > 50) {
        alerts.push({
          type: 'anomaly',
          severity: 'warning',
          message: 'Low CPU usage but high event loop delay detected',
          metrics: { cpuUsage, eventLoopDelay }
        });
      }
    }
    
    return alerts;
  }

  // 알림 추가
  addAlert(alert) {
    alert.timestamp = Date.now();
    alert.id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.alerts.push(alert);
    
    // 알림 개수 제한
    if (this.alerts.length > 1000) {
      this.alerts.splice(0, this.alerts.length - 1000);
    }
  }

  // 성능 보고서 생성
  generateReport(metrics, trends) {
    const report = {
      timestamp: Date.now(),
      summary: this.generateSummary(metrics),
      metrics,
      trends,
      alerts: this.alerts.slice(-50), // 최근 50개 알림
      recommendations: this.generateRecommendations(metrics, trends)
    };
    
    return report;
  }

  // 요약 생성
  generateSummary(metrics) {
    const summary = {
      status: 'healthy',
      issues: []
    };
    
    if (metrics.system) {
      const cpuUsage = metrics.system.cpu?.usage?.average || 0;
      const memoryUsage = metrics.system.memory?.usagePercent || 0;
      
      if (cpuUsage > 80) {
        summary.status = 'warning';
        summary.issues.push('High CPU usage');
      }
      
      if (memoryUsage > 85) {
        summary.status = 'critical';
        summary.issues.push('High memory usage');
      }
    }
    
    if (metrics.application) {
      const eventLoopDelay = metrics.application.eventLoop?.delay || 0;
      
      if (eventLoopDelay > 100) {
        summary.status = 'critical';
        summary.issues.push('High event loop delay');
      }
    }
    
    return summary;
  }

  // 권장사항 생성
  generateRecommendations(metrics, trends) {
    const recommendations = [];
    
    if (metrics.system) {
      const cpuUsage = metrics.system.cpu?.usage?.average || 0;
      const memoryUsage = metrics.system.memory?.usagePercent || 0;
      
      if (cpuUsage > 70) {
        recommendations.push({
          type: 'cpu',
          priority: 'medium',
          message: 'Consider optimizing CPU-intensive operations or scaling horizontally'
        });
      }
      
      if (memoryUsage > 80) {
        recommendations.push({
          type: 'memory',
          priority: 'high',
          message: 'Memory usage is high. Check for memory leaks and optimize memory allocation'
        });
      }
    }
    
    // 추세 기반 권장사항
    Object.entries(trends).forEach(([category, trend]) => {
      if (trend.direction === 'increasing' && trend.change > 15) {
        recommendations.push({
          type: 'trend',
          priority: 'medium',
          message: `${trend.metric} is consistently increasing. Monitor closely and prepare for scaling`
        });
      }
    });
    
    return recommendations;
  }

  // 알림 조회
  getAlerts(severity = null, limit = 100) {
    let filtered = this.alerts;
    
    if (severity) {
      filtered = filtered.filter(alert => alert.severity === severity);
    }
    
    return filtered.slice(-limit);
  }

  // 알림 통계
  getAlertStats() {
    const stats = {
      total: this.alerts.length,
      critical: 0,
      warning: 0,
      info: 0
    };
    
    this.alerts.forEach(alert => {
      stats[alert.severity] = (stats[alert.severity] || 0) + 1;
    });
    
    return stats;
  }
}

// 성능 대시보드 데이터 제공자
export class PerformanceDashboardProvider {
  constructor(collector, analyzer) {
    this.collector = collector;
    this.analyzer = analyzer;
  }

  // 대시보드 데이터 생성
  getDashboardData() {
    const latest = this.collector.getLatestMetrics();
    const alerts = this.analyzer.getAlerts(null, 20);
    const alertStats = this.analyzer.getAlertStats();
    
    return {
      timestamp: Date.now(),
      summary: this.generateDashboardSummary(latest),
      charts: this.generateChartData(),
      alerts,
      alertStats,
      health: this.getOverallHealth(latest, alertStats)
    };
  }

  // 대시보드 요약 생성
  generateDashboardSummary(metrics) {
    const summary = {};
    
    if (metrics.system) {
      summary.system = {
        cpu: {
          usage: metrics.system.cpu?.usage?.average || 0,
          status: this.getStatusColor(metrics.system.cpu?.usage?.average || 0, 70, 85)
        },
        memory: {
          usage: metrics.system.memory?.usagePercent || 0,
          status: this.getStatusColor(metrics.system.memory?.usagePercent || 0, 70, 85)
        },
        uptime: {
          system: metrics.system.uptime?.system || 0,
          process: metrics.system.uptime?.process || 0
        }
      };
    }
    
    if (metrics.application) {
      summary.application = {
        eventLoop: {
          delay: metrics.application.eventLoop?.delay || 0,
          status: this.getStatusColor(metrics.application.eventLoop?.delay || 0, 50, 100, true)
        },
        handles: metrics.application.handles || { active: 0, requests: 0 },
        gc: metrics.application.gc
      };
    }
    
    return summary;
  }

  // 상태 색상 결정
  getStatusColor(value, warningThreshold, criticalThreshold, reverse = false) {
    if (reverse) {
      if (value > criticalThreshold) return 'red';
      if (value > warningThreshold) return 'yellow';
      return 'green';
    } else {
      if (value > criticalThreshold) return 'red';
      if (value > warningThreshold) return 'yellow';
      return 'green';
    }
  }

  // 차트 데이터 생성
  generateChartData() {
    const timeRange = {
      start: Date.now() - 300000, // 5분
      end: Date.now()
    };
    
    const systemMetrics = this.collector.getMetrics('system', timeRange);
    const appMetrics = this.collector.getMetrics('application', timeRange);
    
    return {
      cpu: this.extractTimeSeriesData(systemMetrics, 'cpu.usage.average'),
      memory: this.extractTimeSeriesData(systemMetrics, 'memory.usagePercent'),
      eventLoop: this.extractTimeSeriesData(appMetrics, 'eventLoop.delay'),
      gc: this.extractTimeSeriesData(appMetrics, 'gc.totalGCTime')
    };
  }

  // 시계열 데이터 추출
  extractTimeSeriesData(metrics, path) {
    return metrics.map(metric => ({
      timestamp: metric.timestamp,
      value: this.getNestedValue(metric, path) || 0
    }));
  }

  // 중첩된 객체 값 가져오기
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // 전체 상태 평가
  getOverallHealth(metrics, alertStats) {
    let status = 'healthy';
    
    if (alertStats.critical > 0) {
      status = 'critical';
    } else if (alertStats.warning > 3) {
      status = 'warning';
    }
    
    return {
      status,
      score: this.calculateHealthScore(metrics, alertStats),
      lastUpdate: Date.now()
    };
  }

  // 건강도 점수 계산
  calculateHealthScore(metrics, alertStats) {
    let score = 100;
    
    // 알림 기반 감점
    score -= alertStats.critical * 20;
    score -= alertStats.warning * 5;
    
    // 메트릭 기반 감점
    if (metrics.system) {
      const cpuUsage = metrics.system.cpu?.usage?.average || 0;
      const memoryUsage = metrics.system.memory?.usagePercent || 0;
      
      if (cpuUsage > 80) score -= 15;
      else if (cpuUsage > 70) score -= 10;
      
      if (memoryUsage > 85) score -= 15;
      else if (memoryUsage > 70) score -= 10;
    }
    
    if (metrics.application) {
      const eventLoopDelay = metrics.application.eventLoop?.delay || 0;
      
      if (eventLoopDelay > 100) score -= 20;
      else if (eventLoopDelay > 50) score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }
}

export default {
  MetricsCollector,
  PerformanceAnalyzer,
  PerformanceDashboardProvider
};