import React, { useState, useEffect } from 'react';
import { AdvancedChart, ChartSeries } from '../components/charts/AdvancedChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import PageLayout from '../components/layout/PageLayout';
import { 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingCart,
  Target,
  BarChart3,
  PieChart,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Star,
  Award,
  Briefcase,
  Globe
} from 'lucide-react';

// KPI 데이터 타입 정의
interface KPI {
  id: string;
  category: 'financial' | 'customer' | 'operational' | 'learning';
  name: string;
  value: number;
  unit: string;
  target: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  description: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  historical: Array<{
    period: string;
    value: number;
    target: number;
  }>;
}

interface StrategicGoal {
  id: string;
  name: string;
  progress: number;
  target: number;
  deadline: string;
  status: 'on-track' | 'at-risk' | 'off-track';
  kpis: string[];
}

// 샘플 전략적 목표 데이터
const strategicGoals: StrategicGoal[] = [
  {
    id: 'revenue-growth',
    name: '매출 성장 25% 달성',
    progress: 18.5,
    target: 25,
    deadline: '2024-12-31',
    status: 'on-track',
    kpis: ['revenue', 'customer-acquisition']
  },
  {
    id: 'customer-satisfaction',
    name: '고객 만족도 4.5/5.0 달성',
    progress: 4.2,
    target: 4.5,
    deadline: '2024-12-31',
    status: 'at-risk',
    kpis: ['nps', 'retention-rate']
  },
  {
    id: 'operational-efficiency',
    name: '운영 효율성 20% 개선',
    progress: 15.8,
    target: 20,
    deadline: '2024-12-31',
    status: 'on-track',
    kpis: ['cost-per-acquisition', 'employee-productivity']
  },
  {
    id: 'digital-transformation',
    name: '디지털 전환율 80% 달성',
    progress: 72,
    target: 80,
    deadline: '2024-12-31',
    status: 'on-track',
    kpis: ['digital-adoption', 'automation-rate']
  }
];

// 샘플 KPI 데이터
const generateKPIData = (): KPI[] => {
  const generateHistorical = (baseValue: number, periods: number = 12) => {
    const data = [];
    const now = new Date();
    
    for (let i = periods; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const variation = (Math.random() - 0.5) * 0.2;
      const value = baseValue * (1 + variation + (i * 0.02)); // 점진적 증가 추세
      const target = baseValue * 1.1; // 목표값은 기준값의 110%
      
      data.push({
        period: date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' }),
        value: Math.round(value * 100) / 100,
        target: Math.round(target * 100) / 100
      });
    }
    
    return data;
  };

  return [
    // 재무 KPI
    {
      id: 'revenue',
      category: 'financial',
      name: '월간 매출',
      value: 2450000,
      unit: '원',
      target: 2500000,
      trend: 'up',
      changePercent: 12.5,
      status: 'good',
      description: '전월 대비 매출 증가율',
      period: 'monthly',
      historical: generateHistorical(2200000)
    },
    {
      id: 'profit-margin',
      category: 'financial',
      name: '순이익률',
      value: 18.5,
      unit: '%',
      target: 20,
      trend: 'up',
      changePercent: 2.3,
      status: 'warning',
      description: '매출 대비 순이익 비율',
      period: 'monthly',
      historical: generateHistorical(16.5)
    },
    {
      id: 'roi',
      category: 'financial',
      name: '투자 수익률 (ROI)',
      value: 24.8,
      unit: '%',
      target: 25,
      trend: 'up',
      changePercent: 8.7,
      status: 'excellent',
      description: '투자 대비 수익률',
      period: 'quarterly',
      historical: generateHistorical(20.5)
    },

    // 고객 KPI
    {
      id: 'customer-acquisition',
      category: 'customer',
      name: '신규 고객 획득',
      value: 1280,
      unit: '명',
      target: 1500,
      trend: 'up',
      changePercent: 15.2,
      status: 'good',
      description: '월간 신규 고객 수',
      period: 'monthly',
      historical: generateHistorical(1050)
    },
    {
      id: 'retention-rate',
      category: 'customer',
      name: '고객 유지율',
      value: 87.3,
      unit: '%',
      target: 90,
      trend: 'stable',
      changePercent: 0.5,
      status: 'warning',
      description: '기존 고객 유지 비율',
      period: 'monthly',
      historical: generateHistorical(85.2)
    },
    {
      id: 'nps',
      category: 'customer',
      name: '순추천지수 (NPS)',
      value: 42,
      unit: '점',
      target: 50,
      trend: 'up',
      changePercent: 5.0,
      status: 'good',
      description: '고객 추천 의향 지수',
      period: 'quarterly',
      historical: generateHistorical(38)
    },

    // 운영 KPI
    {
      id: 'cost-per-acquisition',
      category: 'operational',
      name: '고객 획득 비용',
      value: 45000,
      unit: '원',
      target: 40000,
      trend: 'down',
      changePercent: -8.3,
      status: 'good',
      description: '신규 고객 1명 획득 비용',
      period: 'monthly',
      historical: generateHistorical(52000)
    },
    {
      id: 'employee-productivity',
      category: 'operational',
      name: '직원 생산성',
      value: 92.5,
      unit: '점',
      target: 95,
      trend: 'up',
      changePercent: 3.2,
      status: 'good',
      description: '직원 업무 효율성 지수',
      period: 'monthly',
      historical: generateHistorical(88.5)
    },
    {
      id: 'process-automation',
      category: 'operational',
      name: '프로세스 자동화율',
      value: 68.7,
      unit: '%',
      target: 75,
      trend: 'up',
      changePercent: 12.8,
      status: 'good',
      description: '전체 업무 중 자동화 비율',
      period: 'quarterly',
      historical: generateHistorical(58.2)
    },

    // 학습 및 성장 KPI
    {
      id: 'digital-adoption',
      category: 'learning',
      name: '디지털 도구 활용률',
      value: 78.4,
      unit: '%',
      target: 85,
      trend: 'up',
      changePercent: 9.1,
      status: 'good',
      description: '직원들의 디지털 도구 사용률',
      period: 'monthly',
      historical: generateHistorical(68.5)
    },
    {
      id: 'employee-satisfaction',
      category: 'learning',
      name: '직원 만족도',
      value: 4.1,
      unit: '/5.0',
      target: 4.3,
      trend: 'up',
      changePercent: 2.5,
      status: 'warning',
      description: '직원 만족도 설문 결과',
      period: 'quarterly',
      historical: generateHistorical(3.8)
    },
    {
      id: 'training-completion',
      category: 'learning',
      name: '교육 이수율',
      value: 89.2,
      unit: '%',
      target: 95,
      trend: 'up',
      changePercent: 6.8,
      status: 'good',
      description: '필수 교육 과정 완료율',
      period: 'quarterly',
      historical: generateHistorical(82.5)
    }
  ];
};

const StrategicKPIDashboard: React.FC = () => {
  const [kpis, setKpis] = useState<KPI[]>(generateKPIData());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [refreshInterval, setRefreshInterval] = useState<number>(60000); // 1분

  // 실시간 데이터 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setKpis(prevKpis => 
        prevKpis.map(kpi => {
          const variation = (Math.random() - 0.5) * 0.05; // 5% 변동
          const newValue = kpi.value * (1 + variation);
          const changePercent = ((newValue - kpi.value) / kpi.value) * 100;
          
          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (Math.abs(changePercent) > 0.5) {
            trend = changePercent > 0 ? 'up' : 'down';
          }

          let status: 'excellent' | 'good' | 'warning' | 'critical' = 'good';
          const performance = newValue / kpi.target;
          if (performance >= 1.1) status = 'excellent';
          else if (performance >= 0.95) status = 'good';
          else if (performance >= 0.8) status = 'warning';
          else status = 'critical';

          return {
            ...kpi,
            value: Math.round(newValue * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
            trend,
            status
          };
        })
      );
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // 카테고리별 필터링
  const filteredKPIs = selectedCategory === 'all' 
    ? kpis 
    : kpis.filter(kpi => kpi.category === selectedCategory);

  // 상태별 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <Award className="h-5 w-5 text-green-600" />;
      case 'good':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  // 트렌드 아이콘
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  // 카테고리별 아이콘
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'financial':
        return <DollarSign className="h-5 w-5 text-green-600" />;
      case 'customer':
        return <Users className="h-5 w-5 text-blue-500" />;
      case 'operational':
        return <Briefcase className="h-5 w-5 text-purple-500" />;
      case 'learning':
        return <Star className="h-5 w-5 text-yellow-500" />;
      default:
        return <BarChart3 className="h-5 w-5 text-gray-500" />;
    }
  };

  // 상태별 배지 스타일
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'excellent':
        return <Badge className="bg-green-100 text-green-800">우수</Badge>;
      case 'good':
        return <Badge className="bg-blue-100 text-blue-800">양호</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">주의</Badge>;
      case 'critical':
        return <Badge className="bg-red-100 text-red-800">위험</Badge>;
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  // 목표 달성률 계산
  const calculateAchievement = (value: number, target: number) => {
    return Math.round((value / target) * 100);
  };

  // 카테고리별 요약 통계
  const getCategoryStats = () => {
    const stats = {
      financial: kpis.filter(k => k.category === 'financial'),
      customer: kpis.filter(k => k.category === 'customer'),
      operational: kpis.filter(k => k.category === 'operational'),
      learning: kpis.filter(k => k.category === 'learning')
    };

    return Object.entries(stats).map(([category, categoryKpis]) => {
      const avgAchievement = categoryKpis.reduce((sum, kpi) => 
        sum + calculateAchievement(kpi.value, kpi.target), 0
      ) / categoryKpis.length;

      const excellentCount = categoryKpis.filter(k => k.status === 'excellent').length;
      const warningCount = categoryKpis.filter(k => k.status === 'warning' || k.status === 'critical').length;

      return {
        category,
        avgAchievement: Math.round(avgAchievement),
        excellentCount,
        warningCount,
        totalCount: categoryKpis.length
      };
    });
  };

  const categoryStats = getCategoryStats();

  return (
    <PageLayout
      title="전략적 KPI 대시보드"
      subtitle="핵심 성과 지표를 통한 전략 목표 달성도 모니터링"
      breadcrumbs={[
        { label: '홈', href: '/' },
        { label: 'KPI 관리' }
      ]}
    >
      {/* 전략적 목표 현황 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            전략적 목표 달성 현황
          </CardTitle>
          <CardDescription>
            2024년 주요 전략 목표의 진행 상황을 확인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategicGoals.map((goal) => (
              <Card key={goal.id} className="border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{goal.name}</CardTitle>
                    <Badge variant={
                      goal.status === 'on-track' ? 'default' :
                      goal.status === 'at-risk' ? 'secondary' : 'destructive'
                    }>
                      {goal.status === 'on-track' ? '정상 진행' :
                       goal.status === 'at-risk' ? '위험' : '지연'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>진행률</span>
                      <span>{goal.progress}% / {goal.target}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${(goal.progress / goal.target) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>마감일: {new Date(goal.deadline).toLocaleDateString('ko-KR')}</span>
                      <span>{goal.kpis.length}개 KPI 연동</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 카테고리별 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {categoryStats.map(({ category, avgAchievement, excellentCount, warningCount, totalCount }) => (
          <Card key={category}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {category === 'financial' ? '재무' :
                 category === 'customer' ? '고객' :
                 category === 'operational' ? '운영' : '학습성장'}
              </CardTitle>
              {getCategoryIcon(category)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgAchievement}%</div>
              <p className="text-xs text-muted-foreground">평균 달성률</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  우수: {excellentCount}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  주의: {warningCount}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI 상세 분석 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>KPI 상세 분석</CardTitle>
              <CardDescription>
                카테고리별 핵심 성과 지표 및 추세 분석
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                전체
              </Button>
              <Button
                variant={selectedCategory === 'financial' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('financial')}
              >
                재무
              </Button>
              <Button
                variant={selectedCategory === 'customer' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('customer')}
              >
                고객
              </Button>
              <Button
                variant={selectedCategory === 'operational' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('operational')}
              >
                운영
              </Button>
              <Button
                variant={selectedCategory === 'learning' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('learning')}
              >
                학습
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredKPIs.map((kpi) => (
              <Card key={kpi.id} className="border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(kpi.category)}
                      <div>
                        <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {kpi.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusIcon(kpi.status)}
                      {getTrendIcon(kpi.trend)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold">
                        {kpi.value.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">{kpi.unit}</span>
                      </span>
                      <Badge variant={kpi.changePercent > 0 ? "default" : kpi.changePercent < 0 ? "destructive" : "secondary"} className="text-xs">
                        {kpi.changePercent > 0 ? '+' : ''}{kpi.changePercent}%
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>목표 달성률</span>
                        <span>{calculateAchievement(kpi.value, kpi.target)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            calculateAchievement(kpi.value, kpi.target) >= 100 ? 'bg-green-500' :
                            calculateAchievement(kpi.value, kpi.target) >= 80 ? 'bg-blue-500' :
                            calculateAchievement(kpi.value, kpi.target) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, calculateAchievement(kpi.value, kpi.target))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>목표: {kpi.target.toLocaleString()}{kpi.unit}</span>
                        {getStatusBadge(kpi.status)}
                      </div>
                    </div>

                    {/* 미니 트렌드 차트 */}
                    <div className="h-16">
                      <AdvancedChart
                        type="line"
                        title=""
                        series={[{
                          label: kpi.name,
                          data: kpi.historical.slice(-6).map(h => ({
                            x: h.period,
                            y: h.value,
                            value: h.value
                          }))
                        }]}
                        height={60}
                        showLegend={false}
                        showGrid={false}
                        animate={false}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 트렌드 분석 차트 */}
      {filteredKPIs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>KPI 트렌드 분석</CardTitle>
            <CardDescription>
              선택된 KPI들의 12개월 추이 및 목표 대비 성과
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdvancedChart
              type="line"
              title="12개월 KPI 트렌드"
              series={filteredKPIs.slice(0, 4).map(kpi => ({
                label: kpi.name,
                data: kpi.historical.map(h => ({
                  x: h.period,
                  y: h.value,
                  value: h.value
                }))
              }))}
              height={400}
              realTime={false}
              gradient={true}
              showGrid={true}
              showLegend={true}
              animate={true}
            />
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
};

export default StrategicKPIDashboard;