import React, { useState, useEffect } from 'react';
import { AdvancedChart, ChartSeries } from './AdvancedChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Maximize2,
  Settings
} from 'lucide-react';

interface MetricData {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  threshold: {
    warning: number;
    critical: number;
  };
  status: 'healthy' | 'warning' | 'critical';
  historical: Array<{
    timestamp: string;
    value: number;
  }>;
}

interface MetricsGridProps {
  metrics: MetricData[];
  refreshInterval?: number;
  showControls?: boolean;
  onMetricClick?: (metric: MetricData) => void;
}

// 실시간 데이터 시뮬레이션
const generateRealtimeData = (baseValue: number, volatility: number = 0.1) => {
  const variation = (Math.random() - 0.5) * 2 * volatility;
  return Math.max(0, baseValue * (1 + variation));
};

// 시간 시리즈 데이터 생성
const generateTimeSeries = (hours: number = 24, baseValue: number = 100) => {
  const data = [];
  const now = new Date();
  
  for (let i = hours; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
    const value = generateRealtimeData(baseValue, 0.2);
    data.push({
      timestamp: timestamp.toISOString(),
      value: Math.round(value * 100) / 100
    });
  }
  
  return data;
};

// 기본 메트릭 데이터
const defaultMetrics: MetricData[] = [
  {
    id: 'response_time',
    name: '응답 시간',
    value: 245,
    unit: 'ms',
    trend: 'up',
    changePercent: 8.5,
    threshold: { warning: 300, critical: 500 },
    status: 'healthy',
    historical: generateTimeSeries(24, 245)
  },
  {
    id: 'throughput',
    name: '처리량',
    value: 1250,
    unit: 'req/min',
    trend: 'up',
    changePercent: 15.2,
    threshold: { warning: 1000, critical: 800 },
    status: 'healthy',
    historical: generateTimeSeries(24, 1250)
  },
  {
    id: 'error_rate',
    name: '오류율',
    value: 2.3,
    unit: '%',
    trend: 'down',
    changePercent: -12.4,
    threshold: { warning: 3, critical: 5 },
    status: 'healthy',
    historical: generateTimeSeries(24, 2.3)
  },
  {
    id: 'cpu_usage',
    name: 'CPU 사용률',
    value: 68.4,
    unit: '%',
    trend: 'up',
    changePercent: 5.7,
    threshold: { warning: 70, critical: 85 },
    status: 'warning',
    historical: generateTimeSeries(24, 68.4)
  },
  {
    id: 'memory_usage',
    name: '메모리 사용률',
    value: 81.2,
    unit: '%',
    trend: 'stable',
    changePercent: 0.8,
    threshold: { warning: 80, critical: 90 },
    status: 'warning',
    historical: generateTimeSeries(24, 81.2)
  },
  {
    id: 'active_users',
    name: '활성 사용자',
    value: 3420,
    unit: '명',
    trend: 'up',
    changePercent: 23.1,
    threshold: { warning: 5000, critical: 6000 },
    status: 'healthy',
    historical: generateTimeSeries(24, 3420)
  }
];

export const RealTimeMetricsGrid: React.FC<MetricsGridProps> = ({
  metrics = defaultMetrics,
  refreshInterval = 30000,
  showControls = true,
  onMetricClick
}) => {
  const [currentMetrics, setCurrentMetrics] = useState<MetricData[]>(metrics);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedMetric, setSelectedMetric] = useState<string>('all');

  // 실시간 데이터 업데이트
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      setCurrentMetrics(prevMetrics => 
        prevMetrics.map(metric => {
          const newValue = generateRealtimeData(metric.value, 0.1);
          const changePercent = ((newValue - metric.value) / metric.value) * 100;
          
          // 상태 결정
          let status: 'healthy' | 'warning' | 'critical' = 'healthy';
          if (newValue >= metric.threshold.critical) status = 'critical';
          else if (newValue >= metric.threshold.warning) status = 'warning';
          
          // 트렌드 결정
          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (Math.abs(changePercent) > 1) {
            trend = changePercent > 0 ? 'up' : 'down';
          }

          // 히스토리 업데이트
          const newHistoricalPoint = {
            timestamp: new Date().toISOString(),
            value: Math.round(newValue * 100) / 100
          };
          
          const updatedHistorical = [
            ...metric.historical.slice(-23), // 최근 23개 유지
            newHistoricalPoint
          ];

          return {
            ...metric,
            value: Math.round(newValue * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
            trend,
            status,
            historical: updatedHistorical
          };
        })
      );
      setLastUpdate(new Date());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isAutoRefresh, refreshInterval]);

  // 수동 새로고침
  const handleManualRefresh = () => {
    setLastUpdate(new Date());
    // 실제 구현에서는 API 호출로 대체
  };

  // 메트릭 상태별 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  // 트렌드 아이콘
  const getTrendIcon = (trend: string, changePercent: number) => {
    const color = changePercent > 0 ? 'text-green-500' : changePercent < 0 ? 'text-red-500' : 'text-gray-500';
    
    switch (trend) {
      case 'up':
        return <TrendingUp className={`h-4 w-4 ${color}`} />;
      case 'down':
        return <TrendingDown className={`h-4 w-4 ${color}`} />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  // 차트 데이터 변환
  const getChartSeries = (metric: MetricData): ChartSeries[] => {
    return [{
      label: metric.name,
      data: metric.historical.map(h => ({
        x: new Date(h.timestamp).toLocaleTimeString(),
        y: h.value,
        timestamp: h.timestamp,
        value: h.value
      })),
      type: 'line' as const
    }];
  };

  // 필터링된 메트릭
  const filteredMetrics = selectedMetric === 'all' 
    ? currentMetrics 
    : currentMetrics.filter(m => m.id === selectedMetric);

  return (
    <div className="space-y-6">
      {/* 컨트롤 패널 */}
      {showControls && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">실시간 메트릭 모니터링</CardTitle>
                <CardDescription>
                  마지막 업데이트: {lastUpdate.toLocaleTimeString()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRefresh}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  새로고침
                </Button>
                <Button
                  variant={isAutoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  자동 새로고침
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* 메트릭 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentMetrics.map((metric) => (
          <Card 
            key={metric.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onMetricClick?.(metric)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(metric.status)}
                  <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
                </div>
                {getTrendIcon(metric.trend, metric.changePercent)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{metric.value.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">{metric.unit}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={metric.changePercent > 0 ? "default" : metric.changePercent < 0 ? "destructive" : "secondary"} className="text-xs">
                    {metric.changePercent > 0 ? '+' : ''}{metric.changePercent}%
                  </Badge>
                  <Badge variant={
                    metric.status === 'healthy' ? 'default' : 
                    metric.status === 'warning' ? 'secondary' : 'destructive'
                  } className="text-xs">
                    {metric.status === 'healthy' ? '정상' : 
                     metric.status === 'warning' ? '경고' : '위험'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 상세 차트 뷰 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">상세 메트릭 차트</CardTitle>
          <CardDescription>
            실시간 메트릭 변화 추이를 확인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedMetric} onValueChange={setSelectedMetric}>
            <TabsList className="grid grid-cols-4 lg:grid-cols-7">
              <TabsTrigger value="all">전체</TabsTrigger>
              {currentMetrics.map(metric => (
                <TabsTrigger key={metric.id} value={metric.id} className="text-xs">
                  {metric.name.slice(0, 4)}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {currentMetrics.map(metric => (
                  <AdvancedChart
                    key={metric.id}
                    type="line"
                    title={metric.name}
                    description={`현재값: ${metric.value} ${metric.unit}`}
                    series={getChartSeries(metric)}
                    height={250}
                    realTime={isAutoRefresh}
                    refreshInterval={refreshInterval}
                    threshold={{
                      value: metric.threshold.warning,
                      label: '경고 임계값',
                      color: '#F59E0B'
                    }}
                    annotations={[
                      {
                        type: 'line',
                        value: metric.threshold.critical,
                        label: '위험 임계값',
                        color: '#EF4444'
                      }
                    ]}
                    gradient
                    showGrid
                    onClick={(dataPoint) => console.log('Data point clicked:', dataPoint)}
                  />
                ))}
              </div>
            </TabsContent>

            {currentMetrics.map(metric => (
              <TabsContent key={metric.id} value={metric.id}>
                <AdvancedChart
                  type="line"
                  title={metric.name}
                  description={`현재값: ${metric.value} ${metric.unit} | 변화율: ${metric.changePercent > 0 ? '+' : ''}${metric.changePercent}%`}
                  series={getChartSeries(metric)}
                  height={400}
                  realTime={isAutoRefresh}
                  refreshInterval={refreshInterval}
                  threshold={{
                    value: metric.threshold.warning,
                    label: '경고 임계값',
                    color: '#F59E0B'
                  }}
                  annotations={[
                    {
                      type: 'line',
                      value: metric.threshold.critical,
                      label: '위험 임계값',
                      color: '#EF4444'
                    }
                  ]}
                  gradient
                  showGrid
                  showLegend
                  animate
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealTimeMetricsGrid;