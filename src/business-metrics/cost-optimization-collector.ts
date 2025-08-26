/**
 * AIRIS EPM 비용 최적화 메트릭 수집기
 * 인프라 비용, 운영 효율성, 자원 사용률 등을 모니터링하여 비용 최적화 기회를 식별
 */

import { MetricDataSource, MetricValue } from './metrics-engine';

export interface CostMetric {
  category: 'infrastructure' | 'operations' | 'human_resources' | 'maintenance' | 'external_services';
  costCenter: string;
  actualCost: number;
  budgetedCost: number;
  currency: 'KRW' | 'USD' | 'EUR';
  period: 'hourly' | 'daily' | 'monthly' | 'yearly';
  breakdown: CostBreakdown[];
}

export interface CostBreakdown {
  item: string;
  description: string;
  cost: number;
  percentage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  optimizationPotential: number; // 0-100%
}

export interface OptimizationOpportunity {
  id: string;
  title: string;
  description: string;
  category: string;
  potentialSavings: number;
  implementationCost: number;
  roi: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeframe: string;
  riskLevel: 'low' | 'medium' | 'high';
  actionItems: string[];
  createdAt: Date;
}

/**
 * 비용 최적화 데이터 수집기
 */
export class CostOptimizationCollector implements MetricDataSource {
  id = 'cost_optimization';
  name = 'Cost Optimization Collector';
  type = 'calculated' as const;
  config: Record<string, any>;

  private readonly COST_CATEGORIES = {
    SERVER: {
      name: '서버 비용',
      baselineCostPerCore: 50000, // 월 코어당 5만원
      utilizationThreshold: 70 // 70% 이하시 최적화 필요
    },
    STORAGE: {
      name: '스토리지 비용',
      baselineCostPerGB: 100, // 월 GB당 100원
      utilizationThreshold: 80
    },
    NETWORK: {
      name: '네트워크 비용',
      baselineCostPerGbps: 100000, // 월 Gbps당 10만원
      utilizationThreshold: 60
    },
    DATABASE: {
      name: '데이터베이스 비용',
      baselineCostPerQuery: 0.1, // 쿼리당 0.1원
      optimizationThreshold: 1000 // 1000ms 이상 쿼리 최적화 필요
    }
  };

  constructor(config: Record<string, any> = {}) {
    this.config = {
      refreshInterval: 300000, // 5분
      historicalPeriodDays: 30,
      optimizationThresholds: {
        cpu: 70,
        memory: 80,
        storage: 85,
        network: 60
      },
      ...config
    };
  }

  async authenticate(): Promise<boolean> {
    return true; // 내부 계산 메트릭이므로 인증 불필요
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async collect(metricId: string, config: any): Promise<MetricValue> {
    const timestamp = new Date();

    switch (metricId) {
      case 'infrastructure_cost_optimization':
        return this.collectInfrastructureCostMetrics(timestamp);
      
      case 'operational_cost_efficiency':
        return this.collectOperationalEfficiencyMetrics(timestamp);
      
      case 'resource_utilization_cost':
        return this.collectResourceUtilizationCosts(timestamp);
      
      case 'cost_optimization_opportunities':
        return this.identifyOptimizationOpportunities(timestamp);
      
      default:
        throw new Error(`Unknown metric: ${metricId}`);
    }
  }

  /**
   * 인프라 비용 메트릭 수집
   */
  private async collectInfrastructureCostMetrics(timestamp: Date): Promise<MetricValue> {
    const infrastructureCosts = await this.calculateInfrastructureCosts();
    
    return {
      metricId: 'infrastructure_cost_optimization',
      value: infrastructureCosts.totalCost,
      timestamp,
      tags: {
        category: 'financial',
        type: 'infrastructure'
      },
      metadata: {
        breakdown: infrastructureCosts.breakdown,
        optimizationPotential: infrastructureCosts.optimizationPotential,
        recommendations: infrastructureCosts.recommendations
      }
    };
  }

  /**
   * 운영 효율성 메트릭 수집
   */
  private async collectOperationalEfficiencyMetrics(timestamp: Date): Promise<MetricValue> {
    const efficiency = await this.calculateOperationalEfficiency();
    
    return {
      metricId: 'operational_cost_efficiency',
      value: efficiency.score,
      timestamp,
      tags: {
        category: 'operational',
        type: 'efficiency'
      },
      metadata: {
        factors: efficiency.factors,
        improvements: efficiency.improvements,
        benchmarks: efficiency.benchmarks
      }
    };
  }

  /**
   * 자원 사용률 비용 분석
   */
  private async collectResourceUtilizationCosts(timestamp: Date): Promise<MetricValue> {
    const utilizationCosts = await this.analyzeResourceUtilizationCosts();
    
    return {
      metricId: 'resource_utilization_cost',
      value: utilizationCosts.wastedCostPercentage,
      timestamp,
      tags: {
        category: 'technical',
        type: 'utilization'
      },
      metadata: {
        resources: utilizationCosts.resources,
        wastedAmount: utilizationCosts.wastedAmount,
        optimizationActions: utilizationCosts.optimizationActions
      }
    };
  }

  /**
   * 최적화 기회 식별
   */
  private async identifyOptimizationOpportunities(timestamp: Date): Promise<MetricValue> {
    const opportunities = await this.findOptimizationOpportunities();
    
    const totalPotentialSavings = opportunities.reduce((sum, opp) => sum + opp.potentialSavings, 0);
    
    return {
      metricId: 'cost_optimization_opportunities',
      value: totalPotentialSavings,
      timestamp,
      tags: {
        category: 'business',
        type: 'optimization'
      },
      metadata: {
        opportunities,
        count: opportunities.length,
        highPriorityCount: opportunities.filter(o => o.priority === 'high' || o.priority === 'critical').length
      }
    };
  }

  /**
   * Private Methods - 비용 계산 로직
   */

  private async calculateInfrastructureCosts() {
    // 실제로는 클라우드 제공업체 API나 모니터링 시스템에서 데이터 수집
    const mockData = {
      servers: {
        count: 12,
        totalCores: 96,
        averageUtilization: 65,
        monthlyCost: 4800000 // 480만원
      },
      storage: {
        totalGB: 5000,
        utilizationPercentage: 78,
        monthlyCost: 500000 // 50만원
      },
      network: {
        bandwidthGbps: 10,
        averageUtilization: 45,
        monthlyCost: 1000000 // 100만원
      },
      databases: {
        instances: 3,
        averageQueryTime: 150,
        monthlyCost: 600000 // 60만원
      }
    };

    const totalCost = mockData.servers.monthlyCost + 
                     mockData.storage.monthlyCost + 
                     mockData.network.monthlyCost + 
                     mockData.databases.monthlyCost;

    const breakdown = [
      {
        item: 'servers',
        cost: mockData.servers.monthlyCost,
        utilization: mockData.servers.averageUtilization,
        optimizationPotential: mockData.servers.averageUtilization < 70 ? 25 : 10
      },
      {
        item: 'storage',
        cost: mockData.storage.monthlyCost,
        utilization: mockData.storage.utilizationPercentage,
        optimizationPotential: mockData.storage.utilizationPercentage < 80 ? 15 : 5
      },
      {
        item: 'network',
        cost: mockData.network.monthlyCost,
        utilization: mockData.network.averageUtilization,
        optimizationPotential: mockData.network.averageUtilization < 60 ? 30 : 10
      },
      {
        item: 'databases',
        cost: mockData.databases.monthlyCost,
        utilization: 85, // 가정값
        optimizationPotential: mockData.databases.averageQueryTime > 100 ? 20 : 5
      }
    ];

    const optimizationPotential = breakdown.reduce((sum, item) => 
      sum + (item.cost * item.optimizationPotential / 100), 0);

    const recommendations = this.generateCostRecommendations(breakdown);

    return {
      totalCost,
      breakdown,
      optimizationPotential,
      recommendations
    };
  }

  private async calculateOperationalEfficiency() {
    // 운영 효율성 지표들
    const factors = {
      automationLevel: 75, // 75% 자동화
      incidentResolutionTime: 25, // 평균 25분
      preventiveMaintenanceRatio: 60, // 60% 예방 정비
      humanErrorRate: 2.5, // 2.5% 인적 오류율
      processStandardization: 80 // 80% 표준화
    };

    // 효율성 점수 계산 (0-100)
    const score = (
      (factors.automationLevel * 0.3) +
      (Math.max(0, 100 - factors.incidentResolutionTime * 2) * 0.2) +
      (factors.preventiveMaintenanceRatio * 0.2) +
      (Math.max(0, 100 - factors.humanErrorRate * 20) * 0.15) +
      (factors.processStandardization * 0.15)
    );

    const improvements = [
      {
        area: 'automation',
        current: factors.automationLevel,
        target: 90,
        impact: 'high',
        timeframe: '3-6 months'
      },
      {
        area: 'incident_resolution',
        current: factors.incidentResolutionTime,
        target: 15,
        impact: 'medium',
        timeframe: '1-3 months'
      }
    ];

    const benchmarks = {
      industryAverage: 72,
      bestInClass: 85,
      currentScore: Math.round(score)
    };

    return { score: Math.round(score), factors, improvements, benchmarks };
  }

  private async analyzeResourceUtilizationCosts() {
    const resources = {
      cpu: { utilization: 65, cost: 2000000, threshold: 70 },
      memory: { utilization: 78, cost: 1500000, threshold: 80 },
      storage: { utilization: 82, cost: 500000, threshold: 85 },
      network: { utilization: 45, cost: 1000000, threshold: 60 }
    };

    let totalCost = 0;
    let wastedAmount = 0;
    const optimizationActions = [];

    for (const [resource, data] of Object.entries(resources)) {
      totalCost += data.cost;
      
      if (data.utilization < data.threshold) {
        const wastedPercentage = data.threshold - data.utilization;
        const wastedCost = data.cost * (wastedPercentage / 100);
        wastedAmount += wastedCost;
        
        optimizationActions.push({
          resource,
          currentUtilization: data.utilization,
          targetUtilization: data.threshold,
          wastedCost,
          action: this.getOptimizationAction(resource, data.utilization, data.threshold)
        });
      }
    }

    const wastedCostPercentage = (wastedAmount / totalCost) * 100;

    return {
      resources,
      wastedAmount,
      wastedCostPercentage: Math.round(wastedCostPercentage * 100) / 100,
      optimizationActions
    };
  }

  private async findOptimizationOpportunities(): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = [
      {
        id: 'rightsizing_servers',
        title: '서버 크기 최적화',
        description: '사용률이 낮은 서버들의 크기를 적절히 조정하여 비용 절약',
        category: 'infrastructure',
        potentialSavings: 1200000, // 월 120만원
        implementationCost: 500000, // 50만원
        roi: 240, // 240%
        priority: 'high',
        timeframe: '2-4주',
        riskLevel: 'low',
        actionItems: [
          '서버별 사용률 상세 분석',
          '워크로드 패턴 분석',
          '단계적 크기 조정 계획 수립',
          '성능 모니터링 강화'
        ],
        createdAt: new Date()
      },
      {
        id: 'database_optimization',
        title: '데이터베이스 쿼리 최적화',
        description: '비효율적인 쿼리를 최적화하여 처리 시간 및 비용 절감',
        category: 'operations',
        potentialSavings: 800000, // 월 80만원
        implementationCost: 300000, // 30만원
        roi: 267,
        priority: 'medium',
        timeframe: '1-2주',
        riskLevel: 'low',
        actionItems: [
          '느린 쿼리 식별 및 분석',
          '인덱스 최적화',
          '쿼리 구조 개선',
          '캐싱 전략 도입'
        ],
        createdAt: new Date()
      },
      {
        id: 'storage_tiering',
        title: '스토리지 계층화',
        description: '자주 사용하지 않는 데이터를 저렴한 스토리지로 이동',
        category: 'infrastructure',
        potentialSavings: 400000, // 월 40만원
        implementationCost: 200000, // 20만원
        roi: 200,
        priority: 'medium',
        timeframe: '3-4주',
        riskLevel: 'medium',
        actionItems: [
          '데이터 접근 패턴 분석',
          '아카이빙 정책 수립',
          '자동화 도구 구현',
          '복원 프로세스 테스트'
        ],
        createdAt: new Date()
      },
      {
        id: 'automation_expansion',
        title: '자동화 확대',
        description: '수동 작업을 자동화하여 운영 비용 절감',
        category: 'operations',
        potentialSavings: 2000000, // 월 200만원
        implementationCost: 1000000, // 100만원
        roi: 200,
        priority: 'high',
        timeframe: '2-3개월',
        riskLevel: 'medium',
        actionItems: [
          '수동 작업 목록 작성',
          '자동화 우선순위 결정',
          '자동화 도구 선정',
          '단계적 구현 및 테스트'
        ],
        createdAt: new Date()
      }
    ];

    // 우선순위별 정렬
    return opportunities.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private generateCostRecommendations(breakdown: any[]): string[] {
    const recommendations: string[] = [];

    breakdown.forEach(item => {
      if (item.optimizationPotential > 20) {
        recommendations.push(`${item.item} 최적화를 통해 월 ${Math.round(item.cost * item.optimizationPotential / 100).toLocaleString()}원 절약 가능`);
      }
    });

    return recommendations;
  }

  private getOptimizationAction(resource: string, current: number, target: number): string {
    const actions: Record<string, string> = {
      cpu: '서버 통합 또는 스케일 다운',
      memory: '메모리 사용량 최적화 또는 인스턴스 크기 조정',
      storage: '데이터 정리 및 압축',
      network: '대역폭 조정 또는 트래픽 라우팅 최적화'
    };

    return actions[resource] || '사용률 최적화 필요';
  }

  /**
   * 비용 최적화 리포트 생성
   */
  async generateOptimizationReport(): Promise<{
    summary: any;
    opportunities: OptimizationOpportunity[];
    projections: any;
  }> {
    const infrastructureCosts = await this.calculateInfrastructureCosts();
    const efficiency = await this.calculateOperationalEfficiency();
    const utilizationCosts = await this.analyzeResourceUtilizationCosts();
    const opportunities = await this.findOptimizationOpportunities();

    const summary = {
      totalMonthlyCost: infrastructureCosts.totalCost,
      optimizationPotential: infrastructureCosts.optimizationPotential,
      wastedAmount: utilizationCosts.wastedAmount,
      efficiencyScore: efficiency.score,
      opportunitiesCount: opportunities.length,
      potentialMonthlySavings: opportunities.reduce((sum, opp) => sum + opp.potentialSavings, 0)
    };

    const projections = {
      sixMonthSavings: summary.potentialMonthlySavings * 6,
      yearSavings: summary.potentialMonthlySavings * 12,
      roi: summary.potentialMonthlySavings > 0 ? 
        (summary.potentialMonthlySavings * 12 / opportunities.reduce((sum, opp) => sum + opp.implementationCost, 0)) * 100 : 0
    };

    return {
      summary,
      opportunities,
      projections
    };
  }
}