/**
 * AIRIS EPM 메트릭 데이터 검증 및 품질 관리 시스템
 * 데이터 무결성, 정확성, 완전성 검증 및 품질 지표 모니터링
 */

import { EventEmitter } from 'events';
import { MetricValue } from './metrics-engine';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  metricId: string;
  ruleType: 'range' | 'pattern' | 'logical' | 'statistical' | 'business';
  condition: ValidationCondition;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isActive: boolean;
  createdAt: Date;
}

export interface ValidationCondition {
  // Range validation
  minValue?: number;
  maxValue?: number;
  
  // Pattern validation
  pattern?: RegExp;
  
  // Logical validation
  expression?: string;
  dependencies?: string[]; // other metric IDs
  
  // Statistical validation
  stdDeviationThreshold?: number;
  outlierDetection?: 'zscore' | 'iqr' | 'isolation_forest';
  
  // Business validation
  businessRules?: BusinessRule[];
}

export interface BusinessRule {
  condition: string;
  expectedResult: boolean;
  message: string;
}

export interface ValidationResult {
  ruleId: string;
  metricId: string;
  timestamp: Date;
  passed: boolean;
  actualValue: any;
  expectedValue?: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  suggestion?: string;
}

export interface DataQualityMetrics {
  accuracy: number;        // 정확성 (0-100%)
  completeness: number;    // 완전성 (0-100%)
  consistency: number;     // 일관성 (0-100%)
  timeliness: number;      // 적시성 (0-100%)
  validity: number;        // 유효성 (0-100%)
  overall: number;         // 종합 품질 점수 (0-100%)
}

export interface QualityReport {
  period: { from: Date; to: Date; };
  metricsAnalyzed: number;
  totalValidations: number;
  passedValidations: number;
  failedValidations: number;
  qualityScore: DataQualityMetrics;
  topIssues: Array<{
    issue: string;
    frequency: number;
    impact: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  trendAnalysis: {
    trend: 'improving' | 'stable' | 'degrading';
    changePercentage: number;
  };
}

/**
 * 데이터 품질 검증기
 */
export class DataQualityValidator extends EventEmitter {
  private rules = new Map<string, ValidationRule>();
  private validationHistory: ValidationResult[] = [];
  private qualityMetrics: DataQualityMetrics;
  private metricHistory = new Map<string, MetricValue[]>();
  
  constructor() {
    super();
    this.qualityMetrics = {
      accuracy: 0,
      completeness: 0,
      consistency: 0,
      timeliness: 0,
      validity: 0,
      overall: 0
    };
    
    this.setupDefaultRules();
  }

  /**
   * 검증 규칙 추가
   */
  addValidationRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule:added', rule);
    console.log(`📋 Validation rule added: ${rule.name} for ${rule.metricId}`);
  }

  /**
   * 메트릭 값 검증
   */
  async validateMetric(metricValue: MetricValue): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // 메트릭 히스토리 업데이트
    this.updateMetricHistory(metricValue);
    
    // 해당 메트릭에 대한 모든 활성 규칙 검증
    for (const rule of this.rules.values()) {
      if (rule.metricId === metricValue.metricId && rule.isActive) {
        const result = await this.applyValidationRule(rule, metricValue);
        results.push(result);
        
        // 심각한 오류시 이벤트 발생
        if (!result.passed && (result.severity === 'error' || result.severity === 'critical')) {
          this.emit('validation:failed', result);
        }
      }
    }
    
    // 검증 결과 저장
    this.validationHistory.push(...results);
    
    // 품질 메트릭 업데이트
    this.updateQualityMetrics();
    
    return results;
  }

  /**
   * 배치 검증
   */
  async validateBatch(metricValues: MetricValue[]): Promise<ValidationResult[]> {
    const allResults: ValidationResult[] = [];
    
    for (const metricValue of metricValues) {
      const results = await this.validateMetric(metricValue);
      allResults.push(...results);
    }
    
    return allResults;
  }

  /**
   * 데이터 품질 메트릭 조회
   */
  getQualityMetrics(): DataQualityMetrics {
    return { ...this.qualityMetrics };
  }

  /**
   * 품질 리포트 생성
   */
  generateQualityReport(fromDate: Date, toDate: Date): QualityReport {
    const periodValidations = this.validationHistory.filter(v => 
      v.timestamp >= fromDate && v.timestamp <= toDate
    );
    
    const totalValidations = periodValidations.length;
    const passedValidations = periodValidations.filter(v => v.passed).length;
    const failedValidations = totalValidations - passedValidations;
    
    // 상위 문제들 분석
    const issueFrequency = new Map<string, number>();
    periodValidations.forEach(v => {
      if (!v.passed) {
        const count = issueFrequency.get(v.message) || 0;
        issueFrequency.set(v.message, count + 1);
      }
    });
    
    const topIssues = Array.from(issueFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, frequency]) => ({
        issue,
        frequency,
        impact: this.assessIssueImpact(issue, frequency) as 'low' | 'medium' | 'high',
        recommendation: this.getIssueRecommendation(issue)
      }));
    
    // 트렌드 분석
    const previousPeriod = this.getPreviousPeriodValidations(fromDate, toDate);
    const trendAnalysis = this.analyzeTrend(periodValidations, previousPeriod);
    
    return {
      period: { from: fromDate, to: toDate },
      metricsAnalyzed: new Set(periodValidations.map(v => v.metricId)).size,
      totalValidations,
      passedValidations,
      failedValidations,
      qualityScore: this.qualityMetrics,
      topIssues,
      trendAnalysis
    };
  }

  /**
   * 이상치 탐지
   */
  detectAnomalies(metricId: string, windowSize: number = 50): Array<{
    timestamp: Date;
    value: number;
    anomalyScore: number;
    type: 'outlier' | 'trend_change' | 'seasonal_anomaly';
  }> {
    const history = this.metricHistory.get(metricId) || [];
    if (history.length < windowSize) return [];
    
    const recentData = history.slice(-windowSize);
    const anomalies: Array<any> = [];
    
    // Z-Score 기반 이상치 탐지
    const values = recentData.map(h => h.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );
    
    recentData.forEach((item, index) => {
      const zScore = Math.abs((item.value - mean) / stdDev);
      
      if (zScore > 3) { // 3 표준편차 이상
        anomalies.push({
          timestamp: item.timestamp,
          value: item.value,
          anomalyScore: zScore,
          type: 'outlier'
        });
      }
    });
    
    return anomalies;
  }

  /**
   * 자동 수정 제안
   */
  getSuggestions(metricId: string): Array<{
    type: 'data_cleaning' | 'rule_adjustment' | 'threshold_update' | 'source_check';
    priority: 'low' | 'medium' | 'high';
    description: string;
    action: string;
  }> {
    const failedValidations = this.validationHistory
      .filter(v => v.metricId === metricId && !v.passed)
      .slice(-10); // 최근 10개
    
    const suggestions: Array<any> = [];
    
    // 빈번한 범위 오류
    const rangeErrors = failedValidations.filter(v => v.message.includes('범위'));
    if (rangeErrors.length > 5) {
      suggestions.push({
        type: 'threshold_update',
        priority: 'medium',
        description: '범위 검증 오류가 빈번합니다',
        action: `${metricId}의 허용 범위를 재검토하세요`
      });
    }
    
    // 이상치 빈발
    const anomalies = this.detectAnomalies(metricId);
    if (anomalies.length > 3) {
      suggestions.push({
        type: 'source_check',
        priority: 'high',
        description: '이상치가 빈번하게 감지됩니다',
        action: `${metricId}의 데이터 소스를 점검하세요`
      });
    }
    
    // 누락 데이터
    const history = this.metricHistory.get(metricId) || [];
    const expectedDataPoints = this.calculateExpectedDataPoints(metricId);
    if (history.length < expectedDataPoints * 0.8) {
      suggestions.push({
        type: 'data_cleaning',
        priority: 'high',
        description: '데이터 포인트가 부족합니다',
        action: `${metricId}의 데이터 수집 프로세스를 확인하세요`
      });
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Private Methods
   */

  private setupDefaultRules(): void {
    const defaultRules: ValidationRule[] = [
      {
        id: 'roi_range_check',
        name: 'ROI 범위 검증',
        description: 'ROI가 합리적 범위 내에 있는지 확인',
        metricId: 'roi_percentage',
        ruleType: 'range',
        condition: { minValue: -100, maxValue: 1000 },
        severity: 'error',
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'cost_positive_check',
        name: '비용 양수 검증',
        description: '비용이 음수가 아닌지 확인',
        metricId: 'total_monthly_cost',
        ruleType: 'range',
        condition: { minValue: 0 },
        severity: 'critical',
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'sla_percentage_check',
        name: 'SLA 백분율 검증',
        description: 'SLA 준수율이 0-100% 범위 내인지 확인',
        metricId: 'sla_compliance',
        ruleType: 'range',
        condition: { minValue: 0, maxValue: 100 },
        severity: 'error',
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'response_time_reasonableness',
        name: '응답시간 합리성 검증',
        description: '응답시간이 비현실적이지 않은지 확인',
        metricId: 'api_response_time',
        ruleType: 'range',
        condition: { minValue: 0, maxValue: 30000 }, // 최대 30초
        severity: 'warning',
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'statistical_outlier_detection',
        name: '통계적 이상치 탐지',
        description: '통계적 방법으로 이상치 감지',
        metricId: '*', // 모든 메트릭에 적용
        ruleType: 'statistical',
        condition: { 
          stdDeviationThreshold: 3,
          outlierDetection: 'zscore'
        },
        severity: 'warning',
        isActive: true,
        createdAt: new Date()
      }
    ];

    defaultRules.forEach(rule => this.addValidationRule(rule));
  }

  private async applyValidationRule(rule: ValidationRule, metricValue: MetricValue): Promise<ValidationResult> {
    const result: ValidationResult = {
      ruleId: rule.id,
      metricId: metricValue.metricId,
      timestamp: new Date(),
      passed: true,
      actualValue: metricValue.value,
      severity: rule.severity,
      message: ''
    };

    try {
      switch (rule.ruleType) {
        case 'range':
          result.passed = this.validateRange(metricValue.value, rule.condition);
          result.message = result.passed ? 
            '범위 검증 통과' : 
            `값 ${metricValue.value}이(가) 허용 범위를 벗어남`;
          break;
          
        case 'statistical':
          const outlierResult = this.validateStatistical(metricValue, rule.condition);
          result.passed = outlierResult.passed;
          result.message = outlierResult.message;
          break;
          
        case 'business':
          result.passed = this.validateBusinessRules(metricValue, rule.condition);
          result.message = result.passed ?
            '비즈니스 규칙 검증 통과' :
            '비즈니스 규칙 위반 감지';
          break;
          
        default:
          result.passed = true;
          result.message = '검증 규칙 타입이 구현되지 않음';
      }
      
    } catch (error) {
      result.passed = false;
      result.message = `검증 중 오류 발생: ${error}`;
      result.severity = 'error';
    }

    if (!result.passed) {
      result.suggestion = this.generateSuggestion(rule, metricValue);
    }

    return result;
  }

  private validateRange(value: number, condition: ValidationCondition): boolean {
    const { minValue, maxValue } = condition;
    
    if (minValue !== undefined && value < minValue) return false;
    if (maxValue !== undefined && value > maxValue) return false;
    
    return true;
  }

  private validateStatistical(metricValue: MetricValue, condition: ValidationCondition): {
    passed: boolean;
    message: string;
  } {
    const history = this.metricHistory.get(metricValue.metricId) || [];
    if (history.length < 10) {
      return { passed: true, message: '히스토리 부족으로 통계 검증 생략' };
    }

    const values = history.slice(-20).map(h => h.value); // 최근 20개
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );
    
    const zScore = Math.abs((metricValue.value - mean) / stdDev);
    const threshold = condition.stdDeviationThreshold || 3;
    
    if (zScore > threshold) {
      return {
        passed: false,
        message: `통계적 이상치 감지 (Z-Score: ${zScore.toFixed(2)})`
      };
    }
    
    return { passed: true, message: '통계적 검증 통과' };
  }

  private validateBusinessRules(metricValue: MetricValue, condition: ValidationCondition): boolean {
    const businessRules = condition.businessRules || [];
    
    return businessRules.every(rule => {
      // 간단한 비즈니스 규칙 평가 (실제로는 더 정교한 엔진 필요)
      try {
        return this.evaluateBusinessRule(rule, metricValue);
      } catch {
        return false;
      }
    });
  }

  private evaluateBusinessRule(rule: BusinessRule, metricValue: MetricValue): boolean {
    // 간단한 규칙 평가기 (실제로는 더 안전한 구현 필요)
    const context = {
      value: metricValue.value,
      timestamp: metricValue.timestamp.getTime()
    };
    
    // 여기에 실제 비즈니스 로직 구현
    return true; // 임시
  }

  private updateMetricHistory(metricValue: MetricValue): void {
    const history = this.metricHistory.get(metricValue.metricId) || [];
    history.push(metricValue);
    
    // 최근 1000개만 유지
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    this.metricHistory.set(metricValue.metricId, history);
  }

  private updateQualityMetrics(): void {
    const recentValidations = this.validationHistory.slice(-100); // 최근 100개
    if (recentValidations.length === 0) return;

    const passed = recentValidations.filter(v => v.passed).length;
    const total = recentValidations.length;
    
    // 기본 품질 점수 계산
    const accuracy = (passed / total) * 100;
    
    // 완전성 계산 (데이터 포인트 수 기준)
    const expectedDataPoints = this.calculateTotalExpectedDataPoints();
    const actualDataPoints = Array.from(this.metricHistory.values())
      .reduce((sum, history) => sum + history.length, 0);
    const completeness = Math.min((actualDataPoints / expectedDataPoints) * 100, 100);
    
    // 일관성 계산 (표준편차 기준)
    const consistency = this.calculateConsistencyScore();
    
    // 적시성 계산 (최근 업데이트 기준)
    const timeliness = this.calculateTimelinessScore();
    
    // 유효성 계산 (검증 통과율 기준)
    const validity = accuracy;
    
    // 종합 점수
    const overall = (accuracy * 0.3 + completeness * 0.2 + consistency * 0.2 + 
                    timeliness * 0.2 + validity * 0.1);

    this.qualityMetrics = {
      accuracy: Math.round(accuracy * 100) / 100,
      completeness: Math.round(completeness * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      timeliness: Math.round(timeliness * 100) / 100,
      validity: Math.round(validity * 100) / 100,
      overall: Math.round(overall * 100) / 100
    };
  }

  private calculateTotalExpectedDataPoints(): number {
    // 각 메트릭별 예상 데이터 포인트 수 계산
    return Array.from(this.metricHistory.keys())
      .reduce((sum, metricId) => sum + this.calculateExpectedDataPoints(metricId), 0);
  }

  private calculateExpectedDataPoints(metricId: string): number {
    // 메트릭 타입에 따른 예상 데이터 포인트 수 (예: 1시간에 60개)
    const metricFrequencies: Record<string, number> = {
      'roi_percentage': 1, // 1시간에 1개
      'total_monthly_cost': 24, // 1일에 24개 (시간별)
      'sla_compliance': 60, // 1시간에 60개 (분별)
      'api_response_time': 3600 // 1시간에 3600개 (초별)
    };
    
    return metricFrequencies[metricId] || 60; // 기본값
  }

  private calculateConsistencyScore(): number {
    // 메트릭 간 일관성 점수 계산
    return 85; // 임시 값
  }

  private calculateTimelinessScore(): number {
    const now = new Date();
    let totalScore = 0;
    let metricCount = 0;
    
    this.metricHistory.forEach(history => {
      if (history.length > 0) {
        const lastUpdate = history[history.length - 1].timestamp;
        const ageMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
        
        // 10분 이내는 100점, 그 이후는 감소
        const score = Math.max(0, 100 - (ageMinutes / 10) * 10);
        totalScore += score;
        metricCount++;
      }
    });
    
    return metricCount > 0 ? totalScore / metricCount : 0;
  }

  private generateSuggestion(rule: ValidationRule, metricValue: MetricValue): string {
    switch (rule.ruleType) {
      case 'range':
        return `${metricValue.metricId}의 값이 예상 범위를 벗어났습니다. 데이터 소스를 확인하세요.`;
      case 'statistical':
        return `${metricValue.metricId}에서 이상치가 감지되었습니다. 최근 시스템 변경사항을 확인하세요.`;
      default:
        return '검증 실패. 관련 설정을 점검하세요.';
    }
  }

  private assessIssueImpact(issue: string, frequency: number): string {
    if (frequency > 10) return 'high';
    if (frequency > 5) return 'medium';
    return 'low';
  }

  private getIssueRecommendation(issue: string): string {
    if (issue.includes('범위')) {
      return '허용 범위 설정을 재검토하거나 데이터 소스를 확인하세요';
    }
    if (issue.includes('이상치')) {
      return '데이터 수집 프로세스의 안정성을 점검하세요';
    }
    return '관련 설정 및 데이터 소스를 전반적으로 검토하세요';
  }

  private getPreviousPeriodValidations(fromDate: Date, toDate: Date): ValidationResult[] {
    const periodLength = toDate.getTime() - fromDate.getTime();
    const previousFrom = new Date(fromDate.getTime() - periodLength);
    const previousTo = fromDate;
    
    return this.validationHistory.filter(v => 
      v.timestamp >= previousFrom && v.timestamp < previousTo
    );
  }

  private analyzeTrend(current: ValidationResult[], previous: ValidationResult[]): {
    trend: 'improving' | 'stable' | 'degrading';
    changePercentage: number;
  } {
    if (previous.length === 0) {
      return { trend: 'stable', changePercentage: 0 };
    }
    
    const currentSuccess = current.filter(v => v.passed).length / current.length;
    const previousSuccess = previous.filter(v => v.passed).length / previous.length;
    
    const changePercentage = ((currentSuccess - previousSuccess) / previousSuccess) * 100;
    
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (Math.abs(changePercentage) > 5) {
      trend = changePercentage > 0 ? 'improving' : 'degrading';
    }
    
    return { trend, changePercentage: Math.round(changePercentage * 100) / 100 };
  }
}

/**
 * 전역 데이터 품질 검증기 인스턴스
 */
export const globalDataQualityValidator = new DataQualityValidator();