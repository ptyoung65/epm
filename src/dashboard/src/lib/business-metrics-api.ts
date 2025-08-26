/**
 * AIRIS EPM 비즈니스 메트릭 API 클라이언트
 */

const BUSINESS_METRICS_API_BASE = 'http://localhost:3200/api/business-metrics';

export interface BusinessOverview {
  summary: {
    totalMonthlyCost: number;
    monthlySavings: number;
    roiPercentage: number;
    slaCompliance: number;
    operationalEfficiency: number;
  };
  trends: {
    costOptimization: {
      value: number;
      trend: 'improving' | 'stable' | 'degrading';
      change: string;
    };
    efficiency: {
      value: number;
      trend: 'improving' | 'stable' | 'degrading';
      change: string;
    };
    compliance: {
      value: number;
      trend: 'improving' | 'stable' | 'degrading';
      change: string;
    };
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    potentialSavings?: number;
  }>;
}

export interface ROIData {
  currentROI: {
    percentage: number;
    totalInvestment: number;
    totalSavings: number;
    paybackPeriodMonths: number;
  };
  scenarios: {
    optimistic: { percentage: number; totalSavings: number; };
    realistic: { percentage: number; totalSavings: number; };
    pessimistic: { percentage: number; totalSavings: number; };
  };
  breakdown: {
    downtimeReduction: { savings: number; percentage: number; };
    operationalEfficiency: { savings: number; percentage: number; };
    preventiveMaintenance: { savings: number; percentage: number; };
    humanResources: { savings: number; percentage: number; };
  };
  monthlyTrend: Array<{
    month: string;
    roi: number;
    investment: number;
    savings: number;
  }>;
}

export interface CostOptimizationData {
  summary: {
    totalMonthlyCost: number;
    optimizationPotential: number;
    wastedAmount: number;
    efficiencyScore: number;
  };
  opportunities: Array<{
    id: string;
    title: string;
    category: string;
    potentialSavings: number;
    implementationCost: number;
    roi: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    timeframe: string;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  resourceUtilization: {
    cpu: { utilization: number; cost: number; wastedCost: number; };
    memory: { utilization: number; cost: number; wastedCost: number; };
    storage: { utilization: number; cost: number; wastedCost: number; };
    network: { utilization: number; cost: number; wastedCost: number; };
  };
}

export interface SLAData {
  overview: {
    totalSLAs: number;
    compliantSLAs: number;
    atRiskSLAs: number;
    violatedSLAs: number;
    overallCompliance: number;
  };
  slas: Array<{
    id: string;
    name: string;
    service: string;
    target: number;
    current: number;
    status: 'compliant' | 'at_risk' | 'violated';
    trend: 'improving' | 'stable' | 'degrading';
  }>;
  recentViolations: Array<{
    id: string;
    slaId: string;
    timestamp: string;
    severity: 'warning' | 'minor' | 'major' | 'critical';
    actualValue: number;
    expectedValue: number;
    impact: {
      affectedUsers: number;
      businessLoss: number;
    };
  }>;
}

export interface RealtimeMetrics {
  timestamp: string;
  metrics: {
    businessTransactionValue: {
      value: number;
      unit: string;
      change: string;
      trend: string;
    };
    operationalEfficiency: {
      value: number;
      unit: string;
      change: string;
      trend: string;
    };
    costPerTransaction: {
      value: number;
      unit: string;
      change: string;
      trend: string;
    };
    systemThroughput: {
      value: number;
      unit: string;
      change: string;
      trend: string;
    };
    resourceUtilization: {
      value: number;
      unit: string;
      change: string;
      trend: string;
    };
  };
}

export interface DashboardData {
  kpis: Array<{
    id: string;
    name: string;
    value: number;
    unit: string;
    change: string;
    trend: 'improving' | 'stable' | 'degrading';
    status: 'excellent' | 'good' | 'warning' | 'critical';
  }>;
  charts: {
    roiTrend: Array<{
      month: string;
      roi: number;
      investment: number;
      savings: number;
    }>;
    costBreakdown: Array<{
      category: string;
      value: number;
      percentage: number;
    }>;
    slaStatus: Array<{
      status: string;
      count: number;
      color: string;
    }>;
  };
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    timestamp: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    actionUrl: string;
  }>;
}

class BusinessMetricsAPI {
  private async fetchJSON<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${BUSINESS_METRICS_API_BASE}${endpoint}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API fetch error for ${endpoint}:`, error);
      throw error;
    }
  }

  async getBusinessOverview(): Promise<BusinessOverview> {
    return this.fetchJSON<BusinessOverview>('/overview');
  }

  async getROIData(): Promise<ROIData> {
    return this.fetchJSON<ROIData>('/roi');
  }

  async getCostOptimization(): Promise<CostOptimizationData> {
    return this.fetchJSON<CostOptimizationData>('/cost-optimization');
  }

  async getSLACompliance(): Promise<SLAData> {
    return this.fetchJSON<SLAData>('/sla-compliance');
  }

  async getRealtimeMetrics(): Promise<RealtimeMetrics> {
    return this.fetchJSON<RealtimeMetrics>('/realtime');
  }

  async getDashboardData(): Promise<DashboardData> {
    return this.fetchJSON<DashboardData>('/dashboard');
  }

  async getMetricHistory(metricId: string, from?: Date, to?: Date): Promise<{
    metricId: string;
    period: { from: string; to: string; };
    dataPoints: Array<{ timestamp: string; value: number; }>;
  }> {
    const params = new URLSearchParams();
    if (from) params.set('from', from.toISOString());
    if (to) params.set('to', to.toISOString());
    
    const query = params.toString();
    const endpoint = `/history/${metricId}${query ? `?${query}` : ''}`;
    
    return this.fetchJSON(endpoint);
  }
}

export const businessMetricsAPI = new BusinessMetricsAPI();

// React Query keys for caching
export const BUSINESS_METRICS_QUERY_KEYS = {
  overview: ['business-metrics', 'overview'],
  roi: ['business-metrics', 'roi'],
  costOptimization: ['business-metrics', 'cost-optimization'],
  slaCompliance: ['business-metrics', 'sla-compliance'],
  realtime: ['business-metrics', 'realtime'],
  dashboard: ['business-metrics', 'dashboard'],
  history: (metricId: string, from?: Date, to?: Date) => [
    'business-metrics', 
    'history', 
    metricId, 
    from?.toISOString(), 
    to?.toISOString()
  ].filter(Boolean),
} as const;

// Utility functions for formatting
export const formatCurrency = (amount: number): string => {
  if (amount >= 100000000) {
    return `${Math.round(amount / 100000000)}억원`;
  } else if (amount >= 10000) {
    return `${Math.round(amount / 10000)}만원`;
  } else {
    return `${amount.toLocaleString()}원`;
  }
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const getTrendIcon = (trend: 'improving' | 'stable' | 'degrading'): string => {
  switch (trend) {
    case 'improving':
      return '📈';
    case 'stable':
      return '➡️';
    case 'degrading':
      return '📉';
    default:
      return '➡️';
  }
};

export const getStatusColor = (status: 'excellent' | 'good' | 'warning' | 'critical'): string => {
  switch (status) {
    case 'excellent':
      return 'text-green-600';
    case 'good':
      return 'text-blue-600';
    case 'warning':
      return 'text-yellow-600';
    case 'critical':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};