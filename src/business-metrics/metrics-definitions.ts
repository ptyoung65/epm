/**
 * AIRIS EPM 비즈니스 메트릭 정의
 * 기술 메트릭과 비즈니스 메트릭을 통합하여 관리
 */

export interface BaseMetric {
  id: string;
  name: string;
  description: string;
  unit: string;
  category: MetricCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  frequency: 'realtime' | 'minutely' | 'hourly' | 'daily' | 'weekly';
  source: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type MetricCategory = 
  | 'financial' 
  | 'operational' 
  | 'customer' 
  | 'technical' 
  | 'compliance' 
  | 'business';

export interface FinancialMetric extends BaseMetric {
  category: 'financial';
  costCenter?: string;
  currency: string;
}

export interface OperationalMetric extends BaseMetric {
  category: 'operational';
  slaThreshold?: number;
  targetValue?: number;
}

export interface CustomerMetric extends BaseMetric {
  category: 'customer';
  userSegment?: string;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface TechnicalMetric extends BaseMetric {
  category: 'technical';
  systemComponent: string;
  alertThreshold?: number;
}

export interface ComplianceMetric extends BaseMetric {
  category: 'compliance';
  regulationRef: string;
  complianceLevel: 'compliant' | 'warning' | 'violation';
}

export interface BusinessMetric extends BaseMetric {
  category: 'business';
  kpiType: 'leading' | 'lagging';
  businessUnit: string;
}

export type AnyMetric = 
  | FinancialMetric 
  | OperationalMetric 
  | CustomerMetric 
  | TechnicalMetric 
  | ComplianceMetric 
  | BusinessMetric;

/**
 * 사전 정의된 핵심 비즈니스 메트릭들
 */
export const PREDEFINED_METRICS: Record<string, Partial<AnyMetric>> = {
  // 재무 메트릭
  INFRASTRUCTURE_COST: {
    id: 'infra_cost',
    name: '인프라 운영 비용',
    description: '서버, 네트워크, 스토리지 등 인프라 총 운영 비용',
    unit: 'KRW',
    category: 'financial',
    priority: 'high',
    frequency: 'daily',
    currency: 'KRW',
    tags: ['cost', 'infrastructure', 'opex']
  },

  COST_PER_TRANSACTION: {
    id: 'cost_per_transaction',
    name: '거래당 비용',
    description: '단일 거래 처리에 소요되는 평균 비용',
    unit: 'KRW/transaction',
    category: 'financial',
    priority: 'high',
    frequency: 'hourly',
    currency: 'KRW',
    tags: ['cost', 'efficiency', 'transaction']
  },

  ROI_MONITORING_INVESTMENT: {
    id: 'roi_monitoring',
    name: '모니터링 투자 수익률',
    description: '모니터링 시스템 투자 대비 절약된 비용의 ROI',
    unit: 'percentage',
    category: 'financial',
    priority: 'medium',
    frequency: 'weekly',
    currency: 'KRW',
    tags: ['roi', 'investment', 'monitoring']
  },

  // 운영 메트릭
  SYSTEM_AVAILABILITY: {
    id: 'system_availability',
    name: '시스템 가용성',
    description: '전체 시스템의 가용성 백분율 (SLA 기준)',
    unit: 'percentage',
    category: 'operational',
    priority: 'critical',
    frequency: 'realtime',
    slaThreshold: 99.9,
    targetValue: 99.95,
    tags: ['sla', 'availability', 'uptime']
  },

  MTTR: {
    id: 'mttr',
    name: '평균 복구 시간',
    description: '장애 발생 후 서비스 정상화까지의 평균 시간',
    unit: 'minutes',
    category: 'operational',
    priority: 'critical',
    frequency: 'realtime',
    targetValue: 15,
    tags: ['incident', 'recovery', 'sla']
  },

  MTBF: {
    id: 'mtbf',
    name: '평균 장애 간격',
    description: '장애 발생 간의 평균 시간 간격',
    unit: 'hours',
    category: 'operational',
    priority: 'high',
    frequency: 'daily',
    targetValue: 720,
    tags: ['reliability', 'incident', 'stability']
  },

  // 고객 메트릭
  USER_SATISFACTION: {
    id: 'user_satisfaction',
    name: '사용자 만족도',
    description: '시스템 성능에 대한 사용자 만족도 점수',
    unit: 'score',
    category: 'customer',
    priority: 'high',
    frequency: 'daily',
    impactLevel: 'high',
    tags: ['satisfaction', 'user experience', 'quality']
  },

  RESPONSE_TIME_SLA: {
    id: 'response_time_sla',
    name: '응답시간 SLA 준수율',
    description: 'SLA 기준 응답시간 준수 비율',
    unit: 'percentage',
    category: 'customer',
    priority: 'critical',
    frequency: 'realtime',
    impactLevel: 'critical',
    tags: ['sla', 'performance', 'response time']
  },

  ERROR_IMPACT_USERS: {
    id: 'error_impact_users',
    name: '에러 영향 사용자 수',
    description: '에러로 인해 영향받은 고유 사용자 수',
    unit: 'count',
    category: 'customer',
    priority: 'high',
    frequency: 'realtime',
    impactLevel: 'high',
    tags: ['error', 'user impact', 'quality']
  },

  // 기술 메트릭
  SYSTEM_THROUGHPUT: {
    id: 'system_throughput',
    name: '시스템 처리량',
    description: '분당 처리되는 총 트랜잭션 수',
    unit: 'transactions/minute',
    category: 'technical',
    priority: 'high',
    frequency: 'realtime',
    systemComponent: 'application_server',
    tags: ['performance', 'throughput', 'capacity']
  },

  RESOURCE_UTILIZATION: {
    id: 'resource_utilization',
    name: '자원 사용률',
    description: 'CPU, 메모리, 디스크의 평균 사용률',
    unit: 'percentage',
    category: 'technical',
    priority: 'high',
    frequency: 'minutely',
    systemComponent: 'infrastructure',
    alertThreshold: 80,
    tags: ['utilization', 'capacity', 'resources']
  },

  // 컴플라이언스 메트릭
  DATA_RETENTION_COMPLIANCE: {
    id: 'data_retention_compliance',
    name: '데이터 보존 정책 준수',
    description: '데이터 보존 정책 준수 상태',
    unit: 'percentage',
    category: 'compliance',
    priority: 'high',
    frequency: 'daily',
    regulationRef: 'PIPA_2020',
    complianceLevel: 'compliant',
    tags: ['compliance', 'data protection', 'privacy']
  },

  // 비즈니스 메트릭
  BUSINESS_TRANSACTION_VALUE: {
    id: 'business_transaction_value',
    name: '비즈니스 거래 가치',
    description: '시간당 처리되는 비즈니스 거래의 총 가치',
    unit: 'KRW/hour',
    category: 'business',
    priority: 'critical',
    frequency: 'hourly',
    kpiType: 'lagging',
    businessUnit: 'operations',
    tags: ['revenue', 'business value', 'transactions']
  },

  OPERATIONAL_EFFICIENCY: {
    id: 'operational_efficiency',
    name: '운영 효율성',
    description: '목표 대비 실제 운영 효율성 비율',
    unit: 'percentage',
    category: 'business',
    priority: 'high',
    frequency: 'daily',
    kpiType: 'leading',
    businessUnit: 'operations',
    tags: ['efficiency', 'performance', 'optimization']
  }
};

/**
 * 메트릭 수집 설정
 */
export interface MetricCollectionConfig {
  enabled: boolean;
  interval: number; // milliseconds
  batchSize: number;
  retentionPeriod: number; // days
  aggregationMethods: AggregationMethod[];
}

export type AggregationMethod = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p95' | 'p99';

export const DEFAULT_COLLECTION_CONFIG: MetricCollectionConfig = {
  enabled: true,
  interval: 60000, // 1분
  batchSize: 100,
  retentionPeriod: 90, // 90일
  aggregationMethods: ['sum', 'avg', 'min', 'max', 'p95']
};

/**
 * 메트릭 임계값 및 알림 설정
 */
export interface MetricAlert {
  metricId: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  notificationChannels: string[];
  enabled: boolean;
}

/**
 * 비즈니스 메트릭 계산 공식
 */
export const METRIC_FORMULAS = {
  // ROI 계산: (절약된 비용 - 투자 비용) / 투자 비용 * 100
  ROI: '(saved_cost - investment_cost) / investment_cost * 100',
  
  // 비용 효율성: 총 처리량 / 총 운영 비용
  COST_EFFICIENCY: 'total_throughput / total_operating_cost',
  
  // 가용성: (총 시간 - 다운타임) / 총 시간 * 100
  AVAILABILITY: '(total_time - downtime) / total_time * 100',
  
  // 사용자 영향도: 영향받은 사용자 수 / 전체 사용자 수 * 100
  USER_IMPACT: 'affected_users / total_users * 100'
};