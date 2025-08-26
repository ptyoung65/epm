import React, { useState, useEffect } from 'react';
import { AdvancedChart, ChartSeries } from './AdvancedChart';
import { RealTimeMetricsGrid } from './RealTimeMetricsGrid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Activity,
  BarChart3,
  TrendingUp,
  Users,
  Server,
  Database,
  Network,
  Cpu,
  HardDrive,
  Clock,
  Zap,
  AlertCircle
} from 'lucide-react';

// 시스템 성능 데이터 타입
interface SystemPerformance {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

interface ApplicationMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  activeConnections: number;
}

interface BusinessMetrics {
  activeUsers: number;
  revenue: number;
  conversionRate: number;
  satisfaction: number;
}

// 샘플 데이터 생성 함수
const generateSystemData = (hours: number = 24): SystemPerformance[] => {
  const data: SystemPerformance[] = [];
  const now = new Date();
  
  for (let i = hours; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
    data.push({
      timestamp: timestamp.toISOString(),
      cpu: 30 + Math.random() * 40 + Math.sin(i * 0.5) * 15,
      memory: 40 + Math.random() * 30 + Math.sin(i * 0.3) * 20,
      disk: 20 + Math.random() * 20 + Math.sin(i * 0.2) * 10,
      network: 10 + Math.random() * 30 + Math.sin(i * 0.4) * 25
    });
  }
  
  return data;
};

const PerformanceDashboard: React.FC = () => {
  const [systemData, setSystemData] = useState<SystemPerformance[]>(generateSystemData());
  const [currentMetrics, setCurrentMetrics] = useState<ApplicationMetrics>({
    responseTime: 245,
    throughput: 1250,
    errorRate: 2.3,
    activeConnections: 180
  });
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetrics>({
    activeUsers: 3420,
    revenue: 125000,
    conversionRate: 3.4,
    satisfaction: 4.7
  });

  // 실시간 데이터 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      // 시스템 데이터 업데이트
      setSystemData(prevData => {
        const newPoint = {
          timestamp: new Date().toISOString(),
          cpu: 30 + Math.random() * 40,
          memory: 40 + Math.random() * 30,
          disk: 20 + Math.random() * 20,
          network: 10 + Math.random() * 30
        };
        return [...prevData.slice(-23), newPoint];
      });

      // 애플리케이션 메트릭 업데이트
      setCurrentMetrics(prev => ({
        responseTime: prev.responseTime + (Math.random() - 0.5) * 20,
        throughput: prev.throughput + (Math.random() - 0.5) * 100,
        errorRate: Math.max(0, prev.errorRate + (Math.random() - 0.5) * 0.5),
        activeConnections: Math.max(0, prev.activeConnections + (Math.random() - 0.5) * 10)
      }));

      // 비즈니스 메트릭 업데이트
      setBusinessMetrics(prev => ({
        activeUsers: Math.max(0, prev.activeUsers + (Math.random() - 0.5) * 100),
        revenue: prev.revenue + Math.random() * 1000,
        conversionRate: Math.max(0, prev.conversionRate + (Math.random() - 0.5) * 0.2),
        satisfaction: Math.max(0, Math.min(5, prev.satisfaction + (Math.random() - 0.5) * 0.1))
      }));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // 시스템 리소스 차트 데이터
  const systemChartSeries: ChartSeries[] = [
    {
      label: 'CPU 사용률',
      data: systemData.map(d => ({
        x: new Date(d.timestamp).toLocaleTimeString(),
        y: Math.round(d.cpu),
        timestamp: d.timestamp,
        value: Math.round(d.cpu)
      })),
      color: '#3B82F6'
    },
    {
      label: '메모리 사용률',
      data: systemData.map(d => ({
        x: new Date(d.timestamp).toLocaleTimeString(),
        y: Math.round(d.memory),
        timestamp: d.timestamp,
        value: Math.round(d.memory)
      })),
      color: '#10B981'
    },
    {
      label: '디스크 사용률',
      data: systemData.map(d => ({
        x: new Date(d.timestamp).toLocaleTimeString(),
        y: Math.round(d.disk),
        timestamp: d.timestamp,
        value: Math.round(d.disk)
      })),
      color: '#F59E0B'
    },
    {
      label: '네트워크 사용률',
      data: systemData.map(d => ({
        x: new Date(d.timestamp).toLocaleTimeString(),
        y: Math.round(d.network),
        timestamp: d.timestamp,
        value: Math.round(d.network)
      })),
      color: '#EF4444'
    }
  ];

  // 응답시간 분포 차트 데이터
  const responseTimeDistribution: ChartSeries[] = [{
    label: '응답시간 분포',
    data: [
      { label: '< 100ms', value: 45 },
      { label: '100-300ms', value: 35 },
      { label: '300-500ms', value: 15 },
      { label: '500ms-1s', value: 4 },
      { label: '> 1s', value: 1 }
    ]
  }];

  // 처리량 시간대별 분석
  const hourlyThroughput: ChartSeries[] = [{
    label: '시간대별 처리량',
    data: Array.from({ length: 24 }, (_, i) => ({
      label: `${i}:00`,
      value: 800 + Math.random() * 600 + Math.sin(i * 0.5) * 200,
      x: `${i}:00`,
      y: 800 + Math.random() * 600 + Math.sin(i * 0.5) * 200
    }))
  }];

  return (
    <div className="space-y-6">
      {/* 헤더 및 요약 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">응답 시간</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(currentMetrics.responseTime)}ms</div>
            <p className="text-xs text-muted-foreground">
              평균 응답 시간
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">처리량</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(currentMetrics.throughput)}</div>
            <p className="text-xs text-muted-foreground">
              req/min
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오류율</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMetrics.errorRate.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">
              전체 요청 대비
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(businessMetrics.activeUsers).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              현재 접속자
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 실시간 메트릭 그리드 */}
      <RealTimeMetricsGrid 
        refreshInterval={30000}
        showControls={true}
        onMetricClick={(metric) => console.log('Metric clicked:', metric)}
      />

      {/* 상세 성능 분석 탭 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">상세 성능 분석</CardTitle>
          <CardDescription>
            시스템 리소스, 애플리케이션 성능, 비즈니스 메트릭을 종합 분석합니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="system" className="space-y-4">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="system">시스템 리소스</TabsTrigger>
              <TabsTrigger value="application">애플리케이션</TabsTrigger>
              <TabsTrigger value="performance">성능 분석</TabsTrigger>
              <TabsTrigger value="business">비즈니스 메트릭</TabsTrigger>
            </TabsList>

            {/* 시스템 리소스 탭 */}
            <TabsContent value="system" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AdvancedChart
                  type="line"
                  title="시스템 리소스 사용률"
                  description="CPU, 메모리, 디스크, 네트워크 사용률 추이"
                  series={systemChartSeries}
                  height={350}
                  realTime={true}
                  refreshInterval={30000}
                  gradient={true}
                  showGrid={true}
                  showLegend={true}
                  threshold={{
                    value: 80,
                    label: '경고 임계값',
                    color: '#F59E0B'
                  }}
                />

                <div className="space-y-4">
                  <AdvancedChart
                    type="doughnut"
                    title="현재 리소스 분포"
                    description="실시간 시스템 리소스 사용률"
                    series={[{
                      label: '리소스 사용률',
                      data: [
                        { label: 'CPU', value: systemData[systemData.length - 1]?.cpu || 0 },
                        { label: '메모리', value: systemData[systemData.length - 1]?.memory || 0 },
                        { label: '디스크', value: systemData[systemData.length - 1]?.disk || 0 },
                        { label: '네트워크', value: systemData[systemData.length - 1]?.network || 0 }
                      ]
                    }]}
                    height={200}
                    showLegend={true}
                  />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <span>CPU: {Math.round(systemData[systemData.length - 1]?.cpu || 0)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-green-500" />
                      <span>메모리: {Math.round(systemData[systemData.length - 1]?.memory || 0)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-yellow-500" />
                      <span>디스크: {Math.round(systemData[systemData.length - 1]?.disk || 0)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-red-500" />
                      <span>네트워크: {Math.round(systemData[systemData.length - 1]?.network || 0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 애플리케이션 탭 */}
            <TabsContent value="application" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AdvancedChart
                  type="bar"
                  title="시간대별 처리량"
                  description="24시간 동안의 요청 처리량 분석"
                  series={hourlyThroughput}
                  height={350}
                  showGrid={true}
                  threshold={{
                    value: 1000,
                    label: '목표 처리량',
                    color: '#10B981'
                  }}
                />

                <AdvancedChart
                  type="doughnut"
                  title="응답시간 분포"
                  description="전체 요청의 응답시간 분포 현황"
                  series={responseTimeDistribution}
                  height={350}
                  showLegend={true}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">연결 상태</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{Math.round(currentMetrics.activeConnections)}</div>
                    <Badge variant="outline" className="text-xs">활성 연결</Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">가용성</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">99.95%</div>
                    <Badge variant="default" className="text-xs">SLA 목표 달성</Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">성능 점수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">87/100</div>
                    <Badge variant="secondary" className="text-xs">양호</Badge>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 성능 분석 탭 */}
            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>성능 최적화 권장사항</CardTitle>
                    <CardDescription>
                      현재 시스템 상태 기반 최적화 제안
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">CPU 사용률 최적화</h4>
                          <p className="text-sm text-blue-700">
                            현재 CPU 사용률이 68%입니다. 부하 분산을 통해 성능을 개선할 수 있습니다.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">메모리 사용량 주의</h4>
                          <p className="text-sm text-yellow-700">
                            메모리 사용률이 81%에 도달했습니다. 메모리 확장을 고려해보세요.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                        <Zap className="h-5 w-5 text-green-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">응답시간 우수</h4>
                          <p className="text-sm text-green-700">
                            평균 응답시간 245ms로 목표치 이내입니다. 현재 설정을 유지하세요.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 비즈니스 메트릭 탭 */}
            <TabsContent value="business" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">수익</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">₩{Math.round(businessMetrics.revenue).toLocaleString()}</div>
                    <Badge variant="default" className="text-xs">일일 수익</Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">전환율</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{businessMetrics.conversionRate.toFixed(2)}%</div>
                    <Badge variant="secondary" className="text-xs">목표: 3.5%</Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">고객 만족도</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{businessMetrics.satisfaction.toFixed(1)}/5.0</div>
                    <Badge variant="default" className="text-xs">우수</Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">비용 효율성</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">92%</div>
                    <Badge variant="default" className="text-xs">최적화됨</Badge>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceDashboard;