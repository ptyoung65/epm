/**
 * AIRIS EPM ROI 계산 모듈
 * 모니터링 시스템 투자 수익률 및 비즈니스 ROI 계산
 */

export interface ROIInput {
  // 투자 비용 (Investment Cost)
  initialInvestment: number;      // 초기 투자 비용
  operatingCostMonthly: number;   // 월 운영 비용
  maintenanceCostAnnual: number;  // 연 유지보수 비용
  
  // 절약된 비용 (Saved Cost)
  downtimeReductionSavings: number;     // 다운타임 감소로 인한 절약
  operationalEfficiencySavings: number;  // 운영 효율성 향상 절약
  preventiveMaintenanceSavings: number;  // 예방 정비 절약
  humanResourceSavings: number;          // 인적 자원 절약
  
  // 추가 수익 (Additional Revenue)
  improvedCustomerSatisfaction: number;  // 고객 만족도 향상으로 인한 수익
  fasterIssueResolution: number;         // 빠른 문제 해결로 인한 수익
  qualityImprovement: number;            // 품질 향상으로 인한 수익
  
  // 기간 설정
  calculationPeriodMonths: number;       // 계산 기간 (개월)
}

export interface ROICalculationResult {
  // 기본 ROI 계산
  totalInvestment: number;
  totalSavings: number;
  totalRevenue: number;
  netBenefit: number;
  roiPercentage: number;
  paybackPeriodMonths: number;
  
  // 세부 분석
  monthlyROI: number;
  annualROI: number;
  breakEvenPoint: Date;
  
  // 카테고리별 분석
  costSavingsBreakdown: {
    downtime: number;
    efficiency: number;
    maintenance: number;
    humanResources: number;
  };
  
  revenueBreakdown: {
    customerSatisfaction: number;
    issueResolution: number;
    quality: number;
  };
  
  // 위험 및 신뢰도
  riskFactor: number;
  confidenceLevel: number;
  
  // 권장 사항
  recommendations: string[];
  
  // 계산 메타데이터
  calculatedAt: Date;
  calculationPeriod: number;
}

/**
 * ROI 계산기 클래스
 */
export class ROICalculator {
  private readonly RISK_FACTORS = {
    LOW: 0.1,
    MEDIUM: 0.2,
    HIGH: 0.3
  };

  /**
   * 전체 ROI 계산
   */
  calculate(input: ROIInput): ROICalculationResult {
    // 총 투자 비용 계산
    const totalInvestment = this.calculateTotalInvestment(input);
    
    // 총 절약 비용 계산
    const totalSavings = this.calculateTotalSavings(input);
    
    // 총 추가 수익 계산
    const totalRevenue = this.calculateTotalRevenue(input);
    
    // 순 편익 계산
    const netBenefit = totalSavings + totalRevenue - totalInvestment;
    
    // ROI 백분율 계산
    const roiPercentage = (netBenefit / totalInvestment) * 100;
    
    // 투자 회수 기간 계산
    const paybackPeriodMonths = this.calculatePaybackPeriod(input);
    
    // 월별/연별 ROI 계산
    const monthlyROI = roiPercentage / input.calculationPeriodMonths;
    const annualROI = roiPercentage * (12 / input.calculationPeriodMonths);
    
    // 손익분기점 계산
    const breakEvenPoint = this.calculateBreakEvenPoint(input);
    
    // 위험 요소 평가
    const riskFactor = this.assessRiskFactor(input);
    const confidenceLevel = this.calculateConfidenceLevel(riskFactor);
    
    // 권장 사항 생성
    const recommendations = this.generateRecommendations(input, roiPercentage, paybackPeriodMonths);

    return {
      totalInvestment,
      totalSavings,
      totalRevenue,
      netBenefit,
      roiPercentage,
      paybackPeriodMonths,
      monthlyROI,
      annualROI,
      breakEvenPoint,
      costSavingsBreakdown: {
        downtime: input.downtimeReductionSavings,
        efficiency: input.operationalEfficiencySavings,
        maintenance: input.preventiveMaintenanceSavings,
        humanResources: input.humanResourceSavings
      },
      revenueBreakdown: {
        customerSatisfaction: input.improvedCustomerSatisfaction,
        issueResolution: input.fasterIssueResolution,
        quality: input.qualityImprovement
      },
      riskFactor,
      confidenceLevel,
      recommendations,
      calculatedAt: new Date(),
      calculationPeriod: input.calculationPeriodMonths
    };
  }

  /**
   * 시나리오별 ROI 분석
   */
  analyzeScenarios(baseInput: ROIInput): {
    optimistic: ROICalculationResult;
    realistic: ROICalculationResult;
    pessimistic: ROICalculationResult;
  } {
    // 낙관적 시나리오 (20% 향상)
    const optimisticInput: ROIInput = {
      ...baseInput,
      downtimeReductionSavings: baseInput.downtimeReductionSavings * 1.2,
      operationalEfficiencySavings: baseInput.operationalEfficiencySavings * 1.2,
      improvedCustomerSatisfaction: baseInput.improvedCustomerSatisfaction * 1.2
    };

    // 비관적 시나리오 (20% 감소)
    const pessimisticInput: ROIInput = {
      ...baseInput,
      downtimeReductionSavings: baseInput.downtimeReductionSavings * 0.8,
      operationalEfficiencySavings: baseInput.operationalEfficiencySavings * 0.8,
      improvedCustomerSatisfaction: baseInput.improvedCustomerSatisfaction * 0.8,
      operatingCostMonthly: baseInput.operatingCostMonthly * 1.1 // 운영비는 증가
    };

    return {
      optimistic: this.calculate(optimisticInput),
      realistic: this.calculate(baseInput),
      pessimistic: this.calculate(pessimisticInput)
    };
  }

  /**
   * 월별 ROI 트렌드 계산
   */
  calculateMonthlyTrend(input: ROIInput): Array<{
    month: number;
    cumulativeInvestment: number;
    cumulativeSavings: number;
    cumulativeRevenue: number;
    monthlyROI: number;
    cumulativeROI: number;
  }> {
    const monthlyOperatingCost = input.operatingCostMonthly;
    const monthlySavings = this.calculateTotalSavings(input) / input.calculationPeriodMonths;
    const monthlyRevenue = this.calculateTotalRevenue(input) / input.calculationPeriodMonths;

    const trend: Array<any> = [];
    let cumulativeInvestment = input.initialInvestment;
    let cumulativeSavings = 0;
    let cumulativeRevenue = 0;

    for (let month = 1; month <= input.calculationPeriodMonths; month++) {
      cumulativeInvestment += monthlyOperatingCost;
      cumulativeSavings += monthlySavings;
      cumulativeRevenue += monthlyRevenue;

      const netBenefit = cumulativeSavings + cumulativeRevenue - cumulativeInvestment;
      const cumulativeROI = (netBenefit / cumulativeInvestment) * 100;
      const monthlyROI = month === 1 ? cumulativeROI : 
        ((cumulativeSavings + cumulativeRevenue - cumulativeInvestment) / cumulativeInvestment * 100) - 
        (trend[month - 2]?.cumulativeROI || 0);

      trend.push({
        month,
        cumulativeInvestment,
        cumulativeSavings,
        cumulativeRevenue,
        monthlyROI,
        cumulativeROI
      });
    }

    return trend;
  }

  /**
   * Private 메서드들
   */

  private calculateTotalInvestment(input: ROIInput): number {
    const monthlyOperatingCost = input.operatingCostMonthly * input.calculationPeriodMonths;
    const maintenanceCost = input.maintenanceCostAnnual * (input.calculationPeriodMonths / 12);
    
    return input.initialInvestment + monthlyOperatingCost + maintenanceCost;
  }

  private calculateTotalSavings(input: ROIInput): number {
    return (
      input.downtimeReductionSavings +
      input.operationalEfficiencySavings +
      input.preventiveMaintenanceSavings +
      input.humanResourceSavings
    ) * (input.calculationPeriodMonths / 12); // 연간 기준을 기간으로 조정
  }

  private calculateTotalRevenue(input: ROIInput): number {
    return (
      input.improvedCustomerSatisfaction +
      input.fasterIssueResolution +
      input.qualityImprovement
    ) * (input.calculationPeriodMonths / 12); // 연간 기준을 기간으로 조정
  }

  private calculatePaybackPeriod(input: ROIInput): number {
    const monthlyNetBenefit = 
      (this.calculateTotalSavings(input) + this.calculateTotalRevenue(input)) / input.calculationPeriodMonths;
    
    const monthlyInvestment = input.operatingCostMonthly + (input.maintenanceCostAnnual / 12);
    
    if (monthlyNetBenefit <= monthlyInvestment) {
      return Infinity; // 투자 회수 불가능
    }

    return input.initialInvestment / (monthlyNetBenefit - monthlyInvestment);
  }

  private calculateBreakEvenPoint(input: ROIInput): Date {
    const paybackMonths = this.calculatePaybackPeriod(input);
    const breakEvenDate = new Date();
    breakEvenDate.setMonth(breakEvenDate.getMonth() + Math.ceil(paybackMonths));
    
    return breakEvenDate;
  }

  private assessRiskFactor(input: ROIInput): number {
    let risk = 0;

    // 초기 투자가 클수록 위험 증가
    if (input.initialInvestment > 100000000) risk += this.RISK_FACTORS.HIGH;
    else if (input.initialInvestment > 50000000) risk += this.RISK_FACTORS.MEDIUM;
    else risk += this.RISK_FACTORS.LOW;

    // 추정 절약액이 클수록 불확실성 증가
    const totalEstimatedBenefits = this.calculateTotalSavings(input) + this.calculateTotalRevenue(input);
    if (totalEstimatedBenefits > input.initialInvestment * 3) {
      risk += this.RISK_FACTORS.HIGH;
    } else if (totalEstimatedBenefits > input.initialInvestment * 2) {
      risk += this.RISK_FACTORS.MEDIUM;
    } else {
      risk += this.RISK_FACTORS.LOW;
    }

    return Math.min(risk, 1.0); // 최대 100%로 제한
  }

  private calculateConfidenceLevel(riskFactor: number): number {
    return Math.max(0.5, 1.0 - riskFactor); // 최소 50% 신뢰도
  }

  private generateRecommendations(input: ROIInput, roiPercentage: number, paybackMonths: number): string[] {
    const recommendations: string[] = [];

    if (roiPercentage < 10) {
      recommendations.push('ROI가 낮습니다. 투자 대비 효과를 재검토하세요.');
      recommendations.push('비용 절약 방안을 더 구체적으로 식별하세요.');
    } else if (roiPercentage > 50) {
      recommendations.push('매우 높은 ROI입니다. 추정치의 현실성을 재검토하세요.');
    } else {
      recommendations.push('적절한 수준의 ROI입니다. 투자를 진행하세요.');
    }

    if (paybackMonths > 24) {
      recommendations.push('투자 회수 기간이 깁니다. 단계적 도입을 고려하세요.');
    } else if (paybackMonths < 12) {
      recommendations.push('빠른 투자 회수가 예상됩니다. 적극적인 투자를 권장합니다.');
    }

    if (input.downtimeReductionSavings > (input.operationalEfficiencySavings + input.humanResourceSavings)) {
      recommendations.push('다운타임 감소 효과가 큽니다. 고가용성 솔루션에 집중하세요.');
    }

    if (input.improvedCustomerSatisfaction > 0) {
      recommendations.push('고객 만족도 향상 효과를 지속적으로 모니터링하세요.');
    }

    return recommendations;
  }
}

/**
 * 기본 ROI 계산 시나리오들
 */
export const ROI_SCENARIOS = {
  // 소규모 스타트업
  SMALL_STARTUP: {
    initialInvestment: 10000000, // 1천만원
    operatingCostMonthly: 500000, // 월 50만원
    maintenanceCostAnnual: 2000000, // 연 200만원
    downtimeReductionSavings: 5000000, // 연 500만원
    operationalEfficiencySavings: 3000000, // 연 300만원
    preventiveMaintenanceSavings: 1000000, // 연 100만원
    humanResourceSavings: 2000000, // 연 200만원
    improvedCustomerSatisfaction: 1000000, // 연 100만원
    fasterIssueResolution: 500000, // 연 50만원
    qualityImprovement: 500000, // 연 50만원
    calculationPeriodMonths: 36
  },

  // 중견 기업
  MEDIUM_ENTERPRISE: {
    initialInvestment: 100000000, // 1억원
    operatingCostMonthly: 5000000, // 월 500만원
    maintenanceCostAnnual: 20000000, // 연 2천만원
    downtimeReductionSavings: 80000000, // 연 8천만원
    operationalEfficiencySavings: 50000000, // 연 5천만원
    preventiveMaintenanceSavings: 20000000, // 연 2천만원
    humanResourceSavings: 30000000, // 연 3천만원
    improvedCustomerSatisfaction: 20000000, // 연 2천만원
    fasterIssueResolution: 10000000, // 연 1천만원
    qualityImprovement: 10000000, // 연 1천만원
    calculationPeriodMonths: 36
  },

  // 대기업
  LARGE_ENTERPRISE: {
    initialInvestment: 500000000, // 5억원
    operatingCostMonthly: 20000000, // 월 2천만원
    maintenanceCostAnnual: 100000000, // 연 1억원
    downtimeReductionSavings: 500000000, // 연 5억원
    operationalEfficiencySavings: 300000000, // 연 3억원
    preventiveMaintenanceSavings: 100000000, // 연 1억원
    humanResourceSavings: 200000000, // 연 2억원
    improvedCustomerSatisfaction: 150000000, // 연 1.5억원
    fasterIssueResolution: 100000000, // 연 1억원
    qualityImprovement: 100000000, // 연 1억원
    calculationPeriodMonths: 36
  }
} as const;

/**
 * 간편 ROI 계산 함수
 */
export function calculateQuickROI(scenario: keyof typeof ROI_SCENARIOS): ROICalculationResult {
  const calculator = new ROICalculator();
  return calculator.calculate(ROI_SCENARIOS[scenario]);
}

/**
 * 커스텀 ROI 계산 함수
 */
export function calculateCustomROI(input: ROIInput): ROICalculationResult {
  const calculator = new ROICalculator();
  return calculator.calculate(input);
}