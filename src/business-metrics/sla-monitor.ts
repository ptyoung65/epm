/**
 * AIRIS EPM SLA 메트릭 모니터링 시스템
 * 서비스 수준 계약(SLA) 준수 상태 실시간 모니터링 및 알림
 */

import { EventEmitter } from 'events';
import { MetricDataSource, MetricValue } from './metrics-engine';

export interface SLADefinition {
  id: string;
  name: string;
  description: string;
  service: string;
  metricType: 'availability' | 'response_time' | 'throughput' | 'error_rate' | 'resolution_time';
  threshold: number;
  unit: string;
  operator: 'less_than' | 'greater_than' | 'equals' | 'less_than_or_equal' | 'greater_than_or_equal';
  measurementPeriod: 'minute' | 'hour' | 'day' | 'week' | 'month';
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  penalties?: SLAPenalty[];
  stakeholders: string[];
  createdAt: Date;
  isActive: boolean;
}

export interface SLAPenalty {
  violationLevel: 'minor' | 'major' | 'critical';
  condition: string;
  penalty: number;
  currency: string;
}

export interface SLAViolation {
  id: string;
  slaId: string;
  timestamp: Date;
  actualValue: number;
  expectedValue: number;
  severity: 'warning' | 'minor' | 'major' | 'critical';
  duration: number; // minutes
  impact: {
    affectedUsers: number;
    businessLoss: number;
    reputationalRisk: 'low' | 'medium' | 'high';
  };
  rootCause?: string;
  resolution?: {
    action: string;
    resolvedAt: Date;
    resolvedBy: string;
  };
}

export interface SLAReport {
  period: {
    from: Date;
    to: Date;
  };
  sla: SLADefinition;
  compliance: {
    percentage: number;
    target: number;
    status: 'compliant' | 'at_risk' | 'violated';
  };
  violations: SLAViolation[];
  trends: {
    trend: 'improving' | 'stable' | 'degrading';
    changePercentage: number;
  };
  recommendations: string[];
}

export interface SLADashboardData {
  totalSLAs: number;
  compliantSLAs: number;
  atRiskSLAs: number;
  violatedSLAs: number;
  overallCompliance: number;
  recentViolations: SLAViolation[];
  criticalServices: string[];
  upcomingRisks: Array<{
    slaId: string;
    service: string;
    riskLevel: number;
    estimatedTimeToViolation: number;
  }>;
}

/**
 * SLA 모니터링 시스템
 */
export class SLAMonitor extends EventEmitter implements MetricDataSource {
  id = 'sla_monitor';
  name = 'SLA Monitoring System';
  type = 'stream' as const;
  config: Record<string, any>;

  private slaDefinitions = new Map<string, SLADefinition>();
  private violations = new Map<string, SLAViolation[]>();
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private isRunning = false;

  constructor(config: Record<string, any> = {}) {
    super();
    this.config = {
      checkInterval: 60000, // 1분마다 체크
      violationRetentionDays: 90,
      alertThresholds: {
        warning: 95, // 95% 미만시 경고
        critical: 90  // 90% 미만시 심각
      },
      ...config
    };

    this.setupDefaultSLAs();
  }

  async authenticate(): Promise<boolean> {
    return true;
  }

  async isHealthy(): Promise<boolean> {
    return this.isRunning;
  }

  async collect(metricId: string, config: any): Promise<MetricValue> {
    switch (metricId) {
      case 'sla_compliance_overall':
        return this.collectOverallCompliance();
      
      case 'sla_violations_count':
        return this.collectViolationsCount();
      
      case 'sla_availability_score':
        return this.collectAvailabilityScore();
      
      case 'sla_response_time_compliance':
        return this.collectResponseTimeCompliance();
      
      default:
        throw new Error(`Unknown SLA metric: ${metricId}`);
    }
  }

  /**
   * SLA 정의 추가
   */
  addSLA(sla: SLADefinition): void {
    this.slaDefinitions.set(sla.id, sla);
    this.violations.set(sla.id, []);
    
    if (this.isRunning) {
      this.startMonitoringForSLA(sla);
    }
    
    this.emit('sla:added', sla);
    console.log(`📋 SLA added: ${sla.name} for ${sla.service}`);
  }

  /**
   * SLA 모니터링 시작
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // 모든 SLA에 대해 모니터링 시작
    for (const sla of this.slaDefinitions.values()) {
      if (sla.isActive) {
        this.startMonitoringForSLA(sla);
      }
    }
    
    this.emit('monitor:started');
    console.log(`🎯 SLA Monitor started for ${this.slaDefinitions.size} SLAs`);
  }

  /**
   * SLA 모니터링 중지
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    // 모든 모니터링 인터벌 정리
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals.clear();
    
    this.isRunning = false;
    this.emit('monitor:stopped');
    console.log('⏹️ SLA Monitor stopped');
  }

  /**
   * SLA 준수 상태 확인
   */
  async checkSLACompliance(slaId: string): Promise<{
    isCompliant: boolean;
    currentValue: number;
    targetValue: number;
    compliancePercentage: number;
  }> {
    const sla = this.slaDefinitions.get(slaId);
    if (!sla) {
      throw new Error(`SLA not found: ${slaId}`);
    }

    // 실제 메트릭 값 수집 (모의 데이터)
    const currentValue = await this.getCurrentMetricValue(sla);
    const isCompliant = this.evaluateCompliance(sla, currentValue);
    
    // 최근 기간의 준수율 계산
    const compliancePercentage = await this.calculateCompliancePercentage(slaId);

    return {
      isCompliant,
      currentValue,
      targetValue: sla.threshold,
      compliancePercentage
    };
  }

  /**
   * SLA 위반 기록
   */
  recordViolation(slaId: string, actualValue: number): void {
    const sla = this.slaDefinitions.get(slaId);
    if (!sla) return;

    const violation: SLAViolation = {
      id: `violation_${Date.now()}`,
      slaId,
      timestamp: new Date(),
      actualValue,
      expectedValue: sla.threshold,
      severity: this.calculateViolationSeverity(sla, actualValue),
      duration: 0, // 실시간으로 업데이트
      impact: this.estimateImpact(sla, actualValue),
      rootCause: undefined
    };

    const violations = this.violations.get(slaId) || [];
    violations.push(violation);
    this.violations.set(slaId, violations);

    this.emit('violation:detected', violation);
    console.log(`🚨 SLA Violation: ${sla.name} - ${actualValue} vs ${sla.threshold}`);

    // 심각한 위반의 경우 즉시 알림
    if (violation.severity === 'critical' || violation.severity === 'major') {
      this.triggerAlert(violation);
    }
  }

  /**
   * SLA 리포트 생성
   */
  async generateReport(slaId: string, fromDate: Date, toDate: Date): Promise<SLAReport> {
    const sla = this.slaDefinitions.get(slaId);
    if (!sla) {
      throw new Error(`SLA not found: ${slaId}`);
    }

    const violations = this.getViolationsInPeriod(slaId, fromDate, toDate);
    const compliancePercentage = await this.calculateCompliancePercentageForPeriod(slaId, fromDate, toDate);
    
    const report: SLAReport = {
      period: { from: fromDate, to: toDate },
      sla,
      compliance: {
        percentage: compliancePercentage,
        target: sla.threshold,
        status: compliancePercentage >= 99 ? 'compliant' : 
                compliancePercentage >= 95 ? 'at_risk' : 'violated'
      },
      violations,
      trends: {
        trend: this.analyzeTrend(violations),
        changePercentage: this.calculateTrendChange(slaId, fromDate, toDate)
      },
      recommendations: this.generateRecommendations(sla, violations, compliancePercentage)
    };

    return report;
  }

  /**
   * SLA 대시보드 데이터 생성
   */
  async getDashboardData(): Promise<SLADashboardData> {
    const totalSLAs = this.slaDefinitions.size;
    let compliantSLAs = 0;
    let atRiskSLAs = 0;
    let violatedSLAs = 0;

    const recentViolations: SLAViolation[] = [];
    const criticalServices: string[] = [];
    const upcomingRisks: Array<any> = [];

    for (const [slaId, sla] of this.slaDefinitions.entries()) {
      if (!sla.isActive) continue;

      const compliance = await this.checkSLACompliance(slaId);
      
      if (compliance.compliancePercentage >= 99) {
        compliantSLAs++;
      } else if (compliance.compliancePercentage >= 95) {
        atRiskSLAs++;
      } else {
        violatedSLAs++;
        if (sla.businessImpact === 'critical') {
          criticalServices.push(sla.service);
        }
      }

      // 최근 위반 사항 수집
      const violations = this.violations.get(slaId) || [];
      const recentSLAViolations = violations.filter(v => 
        v.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) // 24시간 이내
      );
      recentViolations.push(...recentSLAViolations);

      // 위험 예측
      if (compliance.compliancePercentage < 98 && compliance.compliancePercentage >= 95) {
        upcomingRisks.push({
          slaId,
          service: sla.service,
          riskLevel: Math.round((98 - compliance.compliancePercentage) * 10),
          estimatedTimeToViolation: this.estimateTimeToViolation(compliance.compliancePercentage)
        });
      }
    }

    const overallCompliance = totalSLAs > 0 ? 
      Math.round(((compliantSLAs + atRiskSLAs * 0.7) / totalSLAs) * 100) : 100;

    return {
      totalSLAs,
      compliantSLAs,
      atRiskSLAs,
      violatedSLAs,
      overallCompliance,
      recentViolations: recentViolations.slice(0, 10), // 최근 10개
      criticalServices: [...new Set(criticalServices)],
      upcomingRisks: upcomingRisks.sort((a, b) => b.riskLevel - a.riskLevel).slice(0, 5)
    };
  }

  /**
   * Private Methods
   */

  private setupDefaultSLAs(): void {
    const defaultSLAs: SLADefinition[] = [
      {
        id: 'system_availability',
        name: '시스템 가용성',
        description: '전체 시스템 월간 가용성 99.9% 이상 유지',
        service: 'AIRIS_EPM',
        metricType: 'availability',
        threshold: 99.9,
        unit: 'percentage',
        operator: 'greater_than_or_equal',
        measurementPeriod: 'month',
        businessImpact: 'critical',
        penalties: [
          {
            violationLevel: 'minor',
            condition: '99.5% - 99.9%',
            penalty: 1000000,
            currency: 'KRW'
          },
          {
            violationLevel: 'major',
            condition: '99.0% - 99.5%',
            penalty: 5000000,
            currency: 'KRW'
          },
          {
            violationLevel: 'critical',
            condition: '< 99.0%',
            penalty: 10000000,
            currency: 'KRW'
          }
        ],
        stakeholders: ['CTO', 'Operations Manager', 'Business Owner'],
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'api_response_time',
        name: 'API 응답 시간',
        description: 'API 평균 응답시간 100ms 이하 유지',
        service: 'API_Gateway',
        metricType: 'response_time',
        threshold: 100,
        unit: 'milliseconds',
        operator: 'less_than_or_equal',
        measurementPeriod: 'hour',
        businessImpact: 'high',
        stakeholders: ['Development Team', 'Operations Manager'],
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'incident_resolution_time',
        name: '장애 해결 시간',
        description: '심각한 장애 발생시 30분 이내 해결',
        service: 'Support',
        metricType: 'resolution_time',
        threshold: 30,
        unit: 'minutes',
        operator: 'less_than_or_equal',
        measurementPeriod: 'day',
        businessImpact: 'critical',
        stakeholders: ['Support Manager', 'CTO'],
        createdAt: new Date(),
        isActive: true
      }
    ];

    defaultSLAs.forEach(sla => this.addSLA(sla));
  }

  private startMonitoringForSLA(sla: SLADefinition): void {
    const interval = setInterval(async () => {
      try {
        const compliance = await this.checkSLACompliance(sla.id);
        
        if (!compliance.isCompliant) {
          this.recordViolation(sla.id, compliance.currentValue);
        }

        this.emit('compliance:checked', {
          slaId: sla.id,
          compliance
        });

      } catch (error) {
        this.emit('error', { slaId: sla.id, error });
      }
    }, this.config.checkInterval);

    this.monitoringIntervals.set(sla.id, interval);
  }

  private async getCurrentMetricValue(sla: SLADefinition): Promise<number> {
    // 실제로는 AIRIS APM 시스템에서 메트릭 수집
    // 여기서는 시뮬레이션 데이터 생성
    switch (sla.metricType) {
      case 'availability':
        return Math.random() > 0.05 ? 99.95 : 98.5; // 95% 확률로 정상
      case 'response_time':
        return 50 + Math.random() * 100; // 50-150ms
      case 'throughput':
        return 800 + Math.random() * 400; // 800-1200 TPS
      case 'error_rate':
        return Math.random() * 5; // 0-5%
      case 'resolution_time':
        return 10 + Math.random() * 50; // 10-60분
      default:
        return 0;
    }
  }

  private evaluateCompliance(sla: SLADefinition, currentValue: number): boolean {
    switch (sla.operator) {
      case 'greater_than':
        return currentValue > sla.threshold;
      case 'greater_than_or_equal':
        return currentValue >= sla.threshold;
      case 'less_than':
        return currentValue < sla.threshold;
      case 'less_than_or_equal':
        return currentValue <= sla.threshold;
      case 'equals':
        return currentValue === sla.threshold;
      default:
        return false;
    }
  }

  private calculateViolationSeverity(sla: SLADefinition, actualValue: number): 'warning' | 'minor' | 'major' | 'critical' {
    const deviation = Math.abs(actualValue - sla.threshold) / sla.threshold * 100;
    
    if (sla.businessImpact === 'critical' && deviation > 10) return 'critical';
    if (deviation > 20) return 'major';
    if (deviation > 10) return 'minor';
    return 'warning';
  }

  private estimateImpact(sla: SLADefinition, actualValue: number) {
    const deviation = Math.abs(actualValue - sla.threshold) / sla.threshold;
    
    return {
      affectedUsers: Math.round(1000 * deviation), // 추정
      businessLoss: Math.round(100000 * deviation), // 추정 비즈니스 손실
      reputationalRisk: deviation > 0.1 ? 'high' : deviation > 0.05 ? 'medium' : 'low' as const
    };
  }

  private async calculateCompliancePercentage(slaId: string): Promise<number> {
    // 최근 24시간 기준 준수율 계산 (시뮬레이션)
    return 95 + Math.random() * 5; // 95-100%
  }

  private async calculateCompliancePercentageForPeriod(slaId: string, from: Date, to: Date): Promise<number> {
    // 지정된 기간의 준수율 계산
    const violations = this.getViolationsInPeriod(slaId, from, to);
    const totalHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
    const violationHours = violations.reduce((sum, v) => sum + (v.duration / 60), 0);
    
    return Math.max(0, ((totalHours - violationHours) / totalHours) * 100);
  }

  private getViolationsInPeriod(slaId: string, from: Date, to: Date): SLAViolation[] {
    const violations = this.violations.get(slaId) || [];
    return violations.filter(v => v.timestamp >= from && v.timestamp <= to);
  }

  private analyzeTrend(violations: SLAViolation[]): 'improving' | 'stable' | 'degrading' {
    if (violations.length < 2) return 'stable';
    
    const recent = violations.slice(-10);
    const older = violations.slice(-20, -10);
    
    if (recent.length > older.length) return 'degrading';
    if (recent.length < older.length) return 'improving';
    return 'stable';
  }

  private calculateTrendChange(slaId: string, from: Date, to: Date): number {
    // 트렌드 변화율 계산 (시뮬레이션)
    return (Math.random() - 0.5) * 10; // -5% ~ +5%
  }

  private generateRecommendations(sla: SLADefinition, violations: SLAViolation[], compliance: number): string[] {
    const recommendations: string[] = [];

    if (compliance < 95) {
      recommendations.push('즉시 근본 원인 분석 및 개선 조치 필요');
      recommendations.push('모니터링 주기 단축 및 알림 강화');
    } else if (compliance < 98) {
      recommendations.push('예방적 유지보수 계획 수립');
      recommendations.push('성능 최적화 검토');
    }

    if (violations.length > 5) {
      recommendations.push('반복적 문제에 대한 구조적 개선 필요');
    }

    if (sla.businessImpact === 'critical') {
      recommendations.push('백업 시스템 및 장애 복구 절차 점검');
    }

    return recommendations;
  }

  private estimateTimeToViolation(compliancePercentage: number): number {
    // 위반까지 예상 시간 (시간 단위)
    const riskLevel = 98 - compliancePercentage;
    return Math.max(1, 48 / (riskLevel + 1)); // 1-48시간
  }

  private triggerAlert(violation: SLAViolation): void {
    this.emit('alert:triggered', {
      type: 'sla_violation',
      severity: violation.severity,
      violation,
      timestamp: new Date()
    });
  }

  private async collectOverallCompliance(): Promise<MetricValue> {
    const dashboardData = await this.getDashboardData();
    
    return {
      metricId: 'sla_compliance_overall',
      value: dashboardData.overallCompliance,
      timestamp: new Date(),
      tags: { category: 'compliance' },
      metadata: {
        compliantSLAs: dashboardData.compliantSLAs,
        atRiskSLAs: dashboardData.atRiskSLAs,
        violatedSLAs: dashboardData.violatedSLAs
      }
    };
  }

  private async collectViolationsCount(): Promise<MetricValue> {
    const recentViolations = Array.from(this.violations.values())
      .flat()
      .filter(v => v.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000));
    
    return {
      metricId: 'sla_violations_count',
      value: recentViolations.length,
      timestamp: new Date(),
      tags: { category: 'violations', period: '24h' },
      metadata: {
        critical: recentViolations.filter(v => v.severity === 'critical').length,
        major: recentViolations.filter(v => v.severity === 'major').length,
        minor: recentViolations.filter(v => v.severity === 'minor').length
      }
    };
  }

  private async collectAvailabilityScore(): Promise<MetricValue> {
    const availabilitySLA = this.slaDefinitions.get('system_availability');
    if (!availabilitySLA) {
      throw new Error('System availability SLA not found');
    }

    const currentValue = await this.getCurrentMetricValue(availabilitySLA);
    
    return {
      metricId: 'sla_availability_score',
      value: currentValue,
      timestamp: new Date(),
      tags: { category: 'availability', service: 'AIRIS_EPM' },
      metadata: {
        threshold: availabilitySLA.threshold,
        isCompliant: this.evaluateCompliance(availabilitySLA, currentValue)
      }
    };
  }

  private async collectResponseTimeCompliance(): Promise<MetricValue> {
    const responseTimeSLA = this.slaDefinitions.get('api_response_time');
    if (!responseTimeSLA) {
      throw new Error('API response time SLA not found');
    }

    const compliance = await this.checkSLACompliance('api_response_time');
    
    return {
      metricId: 'sla_response_time_compliance',
      value: compliance.compliancePercentage,
      timestamp: new Date(),
      tags: { category: 'performance', service: 'API_Gateway' },
      metadata: {
        currentResponseTime: compliance.currentValue,
        threshold: compliance.targetValue,
        isCompliant: compliance.isCompliant
      }
    };
  }
}