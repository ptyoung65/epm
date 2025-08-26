import React, { useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { businessMetricsAPI, BUSINESS_METRICS_QUERY_KEYS, formatCurrency, formatPercentage } from '@/lib/business-metrics-api'
import { apiClient } from '@/lib/api-client'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  AlertTriangle, 
  Activity,
  Users,
  Zap,
  BarChart3,
  PieChart,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  Shield
} from 'lucide-react'

interface ExecutiveKPI {
  id: string;
  category: 'financial' | 'operational' | 'strategic' | 'risk';
  name: string;
  value: string;
  rawValue: number;
  unit: string;
  target: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  change: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
  actionable: boolean;
}

interface CriticalAlert {
  id: string;
  type: 'business_impact' | 'system_failure' | 'security' | 'compliance';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  message: string;
  timestamp: Date;
  affectedMetrics: string[];
  businessImpact: string;
  recommendedAction: string;
  estimatedResolution: string;
}

const ExecutiveDashboard: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);

  // 비즈니스 메트릭 데이터
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: [...BUSINESS_METRICS_QUERY_KEYS.dashboard, selectedTimeframe],
    queryFn: () => businessMetricsAPI.getDashboardData(),
    refetchInterval: 30000, // 30초마다 새로고침
  });

  const { data: realtimeMetrics } = useQuery({
    queryKey: [...BUSINESS_METRICS_QUERY_KEYS.realtime, selectedTimeframe],
    queryFn: () => businessMetricsAPI.getRealtimeMetrics(),
    refetchInterval: 10000, // 10초마다 새로고침
  });

  // AIRIS APM 시스템 데이터
  const { data: systemOverview } = useQuery({
    queryKey: ['apm', 'overview', selectedTimeframe],
    queryFn: () => apiClient.get('/dashboard/overview'),
    refetchInterval: 15000,
  });

  // Executive KPI 데이터 생성
  const executiveKPIs: ExecutiveKPI[] = React.useMemo(() => {
    if (!dashboardData || !realtimeMetrics || !systemOverview) return [];

    return [
      {
        id: 'revenue_impact',
        category: 'financial',
        name: '시스템 가용성 수익 영향',
        value: formatCurrency(156000000), // 월간 1.56억원
        rawValue: 156000000,
        unit: 'KRW/월',
        target: 150000000,
        status: 'excellent',
        trend: 'up',
        change: '+8.3%',
        impact: 'high',
        description: '시스템 가용성이 비즈니스 수익에 미치는 영향',
        actionable: true
      },
      {
        id: 'total_roi',
        category: 'financial',
        name: '총 투자 수익률',
        value: formatPercentage(142.5),
        rawValue: 142.5,
        unit: '%',
        target: 120,
        status: 'excellent',
        trend: 'up',
        change: '+12.8%',
        impact: 'high',
        description: 'AIRIS EPM 투자 대비 총 수익률',
        actionable: false
      },
      {
        id: 'operational_efficiency',
        category: 'operational',
        name: '운영 효율성',
        value: `${87.5}점`,
        rawValue: 87.5,
        unit: '/100',
        target: 85,
        status: 'good',
        trend: 'up',
        change: '+3.2%',
        impact: 'high',
        description: '전체 운영 프로세스 효율성 지표',
        actionable: true
      },
      {
        id: 'customer_satisfaction',
        category: 'operational',
        name: '고객 만족도',
        value: `${94.2}점`,
        rawValue: 94.2,
        unit: '/100',
        target: 90,
        status: 'excellent',
        trend: 'up',
        change: '+2.1%',
        impact: 'high',
        description: '서비스 성능 기반 고객 만족도',
        actionable: false
      },
      {
        id: 'system_reliability',
        category: 'operational',
        name: '시스템 신뢰성',
        value: formatPercentage(99.95),
        rawValue: 99.95,
        unit: '%',
        target: 99.9,
        status: 'excellent',
        trend: 'stable',
        change: '+0.05%',
        impact: 'high',
        description: '전체 시스템 가용성 및 안정성',
        actionable: false
      },
      {
        id: 'cost_optimization',
        category: 'financial',
        name: '비용 최적화 효과',
        value: formatCurrency(32000000), // 월간 3200만원
        rawValue: 32000000,
        unit: 'KRW/월',
        target: 25000000,
        status: 'excellent',
        trend: 'up',
        change: '+28%',
        impact: 'high',
        description: '운영 비용 최적화를 통한 절약 효과',
        actionable: true
      },
      {
        id: 'security_score',
        category: 'risk',
        name: '보안 점수',
        value: `${92}점`,
        rawValue: 92,
        unit: '/100',
        target: 90,
        status: 'good',
        trend: 'up',
        change: '+1.8%',
        impact: 'high',
        description: '전체 시스템 보안 수준',
        actionable: true
      },
      {
        id: 'compliance_rate',
        category: 'risk',
        name: '컴플라이언스 준수율',
        value: formatPercentage(97.8),
        rawValue: 97.8,
        unit: '%',
        target: 95,
        status: 'good',
        trend: 'stable',
        change: '-0.2%',
        impact: 'medium',
        description: '규정 및 정책 준수 비율',
        actionable: true
      },
      {
        id: 'innovation_index',
        category: 'strategic',
        name: '혁신 지수',
        value: `${78}점`,
        rawValue: 78,
        unit: '/100',
        target: 75,
        status: 'good',
        trend: 'up',
        change: '+5.4%',
        impact: 'medium',
        description: '기술 혁신 및 개선 활동 지표',
        actionable: true
      },
      {
        id: 'market_competitiveness',
        category: 'strategic',
        name: '시장 경쟁력',
        value: `${85}점`,
        rawValue: 85,
        unit: '/100',
        target: 80,
        status: 'excellent',
        trend: 'up',
        change: '+6.3%',
        impact: 'high',
        description: '업계 대비 기술적 경쟁 우위',
        actionable: false
      }
    ];
  }, [dashboardData, realtimeMetrics, systemOverview]);

  // 중요 알림 생성
  useEffect(() => {
    const alerts: CriticalAlert[] = [
      {
        id: 'revenue_risk_001',
        type: 'business_impact',
        severity: 'high',
        title: '수익 영향 위험 감지',
        message: 'API 응답 지연으로 인한 잠재적 수익 손실이 예상됩니다',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15분 전
        affectedMetrics: ['revenue_impact', 'customer_satisfaction'],
        businessImpact: '시간당 약 650만원의 수익 손실 가능성',
        recommendedAction: 'API 서버 확장 및 성능 최적화',
        estimatedResolution: '2-4시간'
      },
      {
        id: 'compliance_001',
        type: 'compliance',
        severity: 'medium',
        title: '컴플라이언스 주의 필요',
        message: '개인정보 처리 로그 보존 기간이 규정에 근접했습니다',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2시간 전
        affectedMetrics: ['compliance_rate'],
        businessImpact: '규제 위반 시 최대 1억원 과태료 가능성',
        recommendedAction: '데이터 정리 정책 실행 및 아카이빙',
        estimatedResolution: '1-2일'
      }
    ];

    setCriticalAlerts(alerts);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'good': return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTrendIcon = (trend: string, change: string) => {
    const isPositive = change.startsWith('+');
    if (trend === 'up') return <TrendingUp className={`h-4 w-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />;
    if (trend === 'down') return <TrendingDown className={`h-4 w-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'financial': return <DollarSign className="h-5 w-5" />;
      case 'operational': return <Zap className="h-5 w-5" />;
      case 'strategic': return <Target className="h-5 w-5" />;
      case 'risk': return <Shield className="h-5 w-5" />;
      default: return <BarChart3 className="h-5 w-5" />;
    }
  };

  if (isDashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">임원진 대시보드 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            임원진 대시보드
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            핵심 비즈니스 지표 및 전략적 KPI 실시간 모니터링
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
            {(['1h', '24h', '7d', '30d'] as const).map((timeframe) => (
              <Button
                key={timeframe}
                variant={selectedTimeframe === timeframe ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTimeframe(timeframe)}
                className="h-8"
              >
                {timeframe}
              </Button>
            ))}
          </div>
          
          <div className="text-right">
            <div className="text-sm text-muted-foreground">마지막 업데이트</div>
            <div className="text-sm font-medium">{new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      </div>

      {/* 중요 알림 */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-3">
          {criticalAlerts.map((alert) => (
            <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'} 
                   className="border-l-4 border-l-red-500">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                {alert.title}
                <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                  {alert.severity}
                </Badge>
              </AlertTitle>
              <AlertDescription className="mt-2">
                <div className="space-y-2">
                  <p>{alert.message}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <strong>비즈니스 영향:</strong> {alert.businessImpact}
                    </div>
                    <div>
                      <strong>권장 조치:</strong> {alert.recommendedAction}
                    </div>
                    <div>
                      <strong>예상 해결시간:</strong> {alert.estimatedResolution}
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* 핵심 KPI 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {executiveKPIs
          .filter(kpi => kpi.impact === 'high')
          .slice(0, 5)
          .map((kpi) => (
            <Card key={kpi.id} className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg ${getStatusColor(kpi.status)} border-2`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getCategoryIcon(kpi.category)}
                    <Badge variant="outline" className="text-xs">
                      {kpi.category}
                    </Badge>
                  </div>
                  {getStatusIcon(kpi.status)}
                </div>
                <CardTitle className="text-sm font-medium line-clamp-2">
                  {kpi.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-1">
                  {kpi.value}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1">
                    {getTrendIcon(kpi.trend, kpi.change)}
                    <span className={kpi.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
                      {kpi.change}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    목표: {kpi.target}{kpi.unit === 'KRW/월' ? '' : kpi.unit.replace('/100', '점')}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {kpi.description}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* 카테고리별 상세 KPI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 재무 지표 */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span>재무 성과</span>
            </CardTitle>
            <CardDescription>수익성 및 비용 효율성 지표</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {executiveKPIs
                .filter(kpi => kpi.category === 'financial')
                .map((kpi) => (
                  <div key={kpi.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{kpi.name}</div>
                      <div className="text-sm text-muted-foreground">{kpi.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{kpi.value}</div>
                      <div className="flex items-center space-x-1 text-xs">
                        {getTrendIcon(kpi.trend, kpi.change)}
                        <span>{kpi.change}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* 운영 지표 */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <span>운영 성과</span>
            </CardTitle>
            <CardDescription>효율성 및 서비스 품질 지표</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {executiveKPIs
                .filter(kpi => kpi.category === 'operational')
                .map((kpi) => (
                  <div key={kpi.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{kpi.name}</div>
                      <div className="text-sm text-muted-foreground">{kpi.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{kpi.value}</div>
                      <div className="flex items-center space-x-1 text-xs">
                        {getTrendIcon(kpi.trend, kpi.change)}
                        <span>{kpi.change}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* 전략 지표 */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-purple-600" />
              <span>전략 지표</span>
            </CardTitle>
            <CardDescription>혁신 및 경쟁력 지표</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {executiveKPIs
                .filter(kpi => kpi.category === 'strategic')
                .map((kpi) => (
                  <div key={kpi.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{kpi.name}</div>
                      <div className="text-sm text-muted-foreground">{kpi.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{kpi.value}</div>
                      <div className="flex items-center space-x-1 text-xs">
                        {getTrendIcon(kpi.trend, kpi.change)}
                        <span>{kpi.change}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* 위험 관리 */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-orange-600" />
              <span>위험 관리</span>
            </CardTitle>
            <CardDescription>보안 및 컴플라이언스 지표</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {executiveKPIs
                .filter(kpi => kpi.category === 'risk')
                .map((kpi) => (
                  <div key={kpi.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{kpi.name}</div>
                      <div className="text-sm text-muted-foreground">{kpi.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{kpi.value}</div>
                      <div className="flex items-center space-x-1 text-xs">
                        {getTrendIcon(kpi.trend, kpi.change)}
                        <span>{kpi.change}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 액션 가능한 인사이트 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Briefcase className="h-5 w-5 text-indigo-600" />
            <span>액션 권장사항</span>
          </CardTitle>
          <CardDescription>즉시 조치가 필요한 항목들</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {executiveKPIs
              .filter(kpi => kpi.actionable && (kpi.status === 'warning' || kpi.rawValue > kpi.target * 1.2))
              .map((kpi) => (
                <div key={kpi.id} className="p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{kpi.name}</div>
                    <Badge variant="secondary">액션 필요</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    현재 성과가 목표를 {Math.round(((kpi.rawValue - kpi.target) / kpi.target) * 100)}% 초과했습니다.
                  </div>
                  <Button size="sm" className="w-full">
                    자세한 분석 보기
                  </Button>
                </div>
              ))}
            
            {executiveKPIs.filter(kpi => kpi.actionable && kpi.status === 'warning').length === 0 && (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                🎉 현재 모든 지표가 목표 범위 내에서 운영되고 있습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutiveDashboard;