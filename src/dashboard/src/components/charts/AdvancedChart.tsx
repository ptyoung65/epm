import React, { useEffect, useRef, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from 'chart.js';
import { Line, Bar, Doughnut, Radar, Scatter } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

// Chart.js 플러그인 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale
);

export interface ChartDataPoint {
  x?: string | number;
  y?: number;
  label?: string;
  value?: number;
  timestamp?: string;
}

export interface ChartSeries {
  label: string;
  data: ChartDataPoint[];
  color?: string;
  type?: 'line' | 'bar' | 'area';
}

export interface AdvancedChartProps {
  type: 'line' | 'bar' | 'doughnut' | 'radar' | 'scatter' | 'multiaxis';
  title: string;
  description?: string;
  series: ChartSeries[];
  height?: number;
  realTime?: boolean;
  refreshInterval?: number;
  threshold?: {
    value: number;
    label: string;
    color: string;
  };
  annotations?: Array<{
    type: 'line' | 'box';
    value: number;
    label: string;
    color: string;
  }>;
  gradient?: boolean;
  stacked?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  animate?: boolean;
  onClick?: (dataPoint: ChartDataPoint) => void;
}

// 색상 팔레트
const CHART_COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#06B6D4',
  purple: '#8B5CF6',
  pink: '#EC4899',
  gray: '#6B7280'
};

const GRADIENT_COLORS = [
  ['#3B82F6', '#93C5FD'],
  ['#10B981', '#6EE7B7'],
  ['#F59E0B', '#FCD34D'],
  ['#EF4444', '#FCA5A5'],
  ['#8B5CF6', '#C4B5FD'],
  ['#EC4899', '#F9A8D4']
];

export const AdvancedChart: React.FC<AdvancedChartProps> = ({
  type,
  title,
  description,
  series,
  height = 400,
  realTime = false,
  refreshInterval = 5000,
  threshold,
  annotations = [],
  gradient = false,
  stacked = false,
  showLegend = true,
  showGrid = true,
  animate = true,
  onClick
}) => {
  const chartRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  // 실시간 데이터 업데이트
  useEffect(() => {
    if (realTime && refreshInterval) {
      intervalRef.current = setInterval(() => {
        // 차트 데이터 새로고침 로직
        if (chartRef.current) {
          chartRef.current.update('active');
        }
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [realTime, refreshInterval]);

  // 그래디언트 생성 함수
  const createGradient = (ctx: CanvasRenderingContext2D, colorPair: string[]) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, colorPair[0] + '80');
    gradient.addColorStop(1, colorPair[1] + '20');
    return gradient;
  };

  // 차트 데이터 변환
  const chartData = useMemo(() => {
    const datasets = series.map((serie, index) => {
      const colorPair = GRADIENT_COLORS[index % GRADIENT_COLORS.length];
      const baseColor = Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length];
      
      const baseDataset = {
        label: serie.label,
        data: type === 'scatter' 
          ? serie.data.map(d => ({ x: d.x, y: d.y }))
          : serie.data.map(d => d.value || d.y || 0),
        borderColor: serie.color || baseColor,
        backgroundColor: gradient 
          ? (ctx: any) => createGradient(ctx.chart.ctx, colorPair)
          : (serie.color || baseColor) + '20',
        borderWidth: 2,
        pointRadius: type === 'line' ? 4 : 0,
        pointHoverRadius: 6,
        fill: type === 'line' && serie.type === 'area',
        tension: 0.4
      };

      // 차트 타입별 추가 설정
      if (type === 'bar') {
        return {
          ...baseDataset,
          borderRadius: 4,
          borderSkipped: false
        };
      }

      if (type === 'doughnut') {
        return {
          ...baseDataset,
          backgroundColor: GRADIENT_COLORS.map(pair => pair[0]),
          borderWidth: 0,
          hoverOffset: 4
        };
      }

      return baseDataset;
    });

    // 임계값 선 추가
    if (threshold && type === 'line') {
      datasets.push({
        label: threshold.label,
        data: new Array(series[0]?.data.length || 0).fill(threshold.value),
        borderColor: threshold.color,
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0
      });
    }

    return {
      labels: type === 'doughnut' 
        ? series[0]?.data.map(d => d.label || d.x) || []
        : series[0]?.data.map(d => d.label || d.x || d.timestamp) || [],
      datasets
    };
  }, [series, type, gradient, threshold, height]);

  // 차트 옵션
  const chartOptions = useMemo(() => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: animate ? {
        duration: 1000,
        easing: 'easeInOutQuart' as const
      } : false,
      interaction: {
        intersect: false,
        mode: 'index' as const
      },
      plugins: {
        legend: {
          display: showLegend,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#374151',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              return `${label}: ${value?.toLocaleString()}`;
            }
          }
        }
      },
      onClick: (event: any, elements: any[]) => {
        if (onClick && elements.length > 0) {
          const dataIndex = elements[0].index;
          const seriesIndex = elements[0].datasetIndex;
          onClick(series[seriesIndex]?.data[dataIndex]);
        }
      }
    };

    // 축 설정 (doughnut 제외)
    if (type !== 'doughnut' && type !== 'radar') {
      return {
        ...baseOptions,
        scales: {
          x: {
            display: showGrid,
            grid: {
              display: showGrid,
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              maxRotation: 45
            }
          },
          y: {
            display: showGrid,
            grid: {
              display: showGrid,
              color: 'rgba(0, 0, 0, 0.1)'
            },
            stacked,
            beginAtZero: true,
            ticks: {
              callback: (value: any) => value.toLocaleString()
            }
          }
        }
      };
    }

    // 레이더 차트 설정
    if (type === 'radar') {
      return {
        ...baseOptions,
        scales: {
          r: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        }
      };
    }

    return baseOptions;
  }, [type, showLegend, showGrid, stacked, animate, onClick, series]);

  // 차트 컴포넌트 선택
  const renderChart = () => {
    const commonProps = {
      ref: chartRef,
      data: chartData,
      options: chartOptions,
      height
    };

    switch (type) {
      case 'line':
        return <Line {...commonProps} />;
      case 'bar':
        return <Bar {...commonProps} />;
      case 'doughnut':
        return <Doughnut {...commonProps} />;
      case 'radar':
        return <Radar {...commonProps} />;
      case 'scatter':
        return <Scatter {...commonProps} />;
      default:
        return <Line {...commonProps} />;
    }
  };

  // 통계 정보 계산
  const stats = useMemo(() => {
    if (!series.length) return null;

    const allValues = series.flatMap(s => s.data.map(d => d.value || d.y || 0));
    const total = allValues.reduce((sum, val) => sum + val, 0);
    const avg = total / allValues.length;
    const max = Math.max(...allValues);
    const min = Math.min(...allValues);

    return { total, avg, max, min };
  }, [series]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1 text-sm text-muted-foreground">
                {description}
              </CardDescription>
            )}
          </div>
          <div className="flex gap-2">
            {realTime && (
              <Badge variant="outline" className="text-xs">
                실시간
              </Badge>
            )}
            {threshold && (
              <Badge variant="secondary" className="text-xs">
                임계값: {threshold.value.toLocaleString()}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div style={{ height: `${height}px`, position: 'relative' }}>
          {renderChart()}
        </div>
        
        {/* 통계 요약 */}
        {stats && type !== 'doughnut' && (
          <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-muted-foreground">합계</div>
              <div className="text-lg font-semibold">{stats.total.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-muted-foreground">평균</div>
              <div className="text-lg font-semibold">{stats.avg.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-muted-foreground">최대</div>
              <div className="text-lg font-semibold">{stats.max.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-muted-foreground">최소</div>
              <div className="text-lg font-semibold">{stats.min.toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* 주석 정보 */}
        {annotations.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium">주석</h4>
            {annotations.map((annotation, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: annotation.color }}
                />
                <span>{annotation.label}: {annotation.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdvancedChart;