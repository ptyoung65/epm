import React from 'react'
import { useQuery } from 'react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { businessMetricsAPI, BUSINESS_METRICS_QUERY_KEYS, formatCurrency, formatPercentage, getTrendIcon, getStatusColor } from '@/lib/business-metrics-api'
import { TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle, Activity } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'

const BusinessMetrics: React.FC = () => {
  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: BUSINESS_METRICS_QUERY_KEYS.dashboard,
    queryFn: () => businessMetricsAPI.getDashboardData(),
    refetchInterval: 30000, // 30초마다 새로고침
  })

  const { data: roiData, isLoading: isROILoading } = useQuery({
    queryKey: BUSINESS_METRICS_QUERY_KEYS.roi,
    queryFn: () => businessMetricsAPI.getROIData(),
    refetchInterval: 60000, // 1분마다 새로고침
  })

  const { data: costOptimization, isLoading: isCostLoading } = useQuery({
    queryKey: BUSINESS_METRICS_QUERY_KEYS.costOptimization,
    queryFn: () => businessMetricsAPI.getCostOptimization(),
    refetchInterval: 60000,
  })

  const { data: slaData, isLoading: isSLALoading } = useQuery({
    queryKey: BUSINESS_METRICS_QUERY_KEYS.slaCompliance,
    queryFn: () => businessMetricsAPI.getSLACompliance(),
    refetchInterval: 30000,
  })

  const { data: realtimeMetrics } = useQuery({
    queryKey: BUSINESS_METRICS_QUERY_KEYS.realtime,
    queryFn: () => businessMetricsAPI.getRealtimeMetrics(),
    refetchInterval: 10000, // 10초마다 새로고침
  })

  if (isDashboardLoading) {
    return (
      <PageLayout 
        title="비즈니스 메트릭"
        breadcrumbs={[
          { label: '대시보드', href: '/' },
          { label: '성능 분석', href: '/analytics' },
          { label: '비즈니스 메트릭' }
        ]}
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">비즈니스 메트릭 로딩 중...</span>
        </div>
      </PageLayout>
    )
  }

  if (dashboardError) {
    return (
      <PageLayout 
        title="비즈니스 메트릭"
        breadcrumbs={[
          { label: '대시보드', href: '/' },
          { label: '성능 분석', href: '/analytics' },
          { label: '비즈니스 메트릭' }
        ]}
      >
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>데이터 로딩 오류</AlertTitle>
          <AlertDescription>
            비즈니스 메트릭 데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.
          </AlertDescription>
        </Alert>
      </PageLayout>
    )
  }

  return (
    <PageLayout 
      title="비즈니스 메트릭"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '성능 분석', href: '/analytics' },
        { label: '비즈니스 메트릭' }
      ]}
    >
      <div className="space-y-6">
        {/* KPI 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {dashboardData?.kpis.map((kpi) => (
            <Card key={kpi.id} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                <Badge variant={kpi.status === 'excellent' ? 'default' : kpi.status === 'good' ? 'secondary' : kpi.status === 'warning' ? 'outline' : 'destructive'}>
                  {kpi.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {kpi.unit === 'KRW' ? formatCurrency(kpi.value) : 
                   kpi.unit === '%' ? formatPercentage(kpi.value) : 
                   kpi.value.toLocaleString()}{kpi.unit !== 'KRW' && kpi.unit !== '%' ? kpi.unit : ''}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {getTrendIcon(kpi.trend)}
                  <span className={kpi.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
                    {kpi.change}
                  </span>
                  <span className="ml-1">vs 이전 기간</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 알림 및 권장사항 */}
        {dashboardData?.notifications && dashboardData.notifications.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dashboardData.notifications.slice(0, 2).map((notification) => (
              <Alert key={notification.id} variant={notification.priority === 'high' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{notification.title}</AlertTitle>
                <AlertDescription className="mt-2">
                  <div>{notification.message}</div>
                  <Button variant="outline" size="sm" className="mt-2">
                    자세히 보기
                  </Button>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* 탭 컨텐츠 */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="roi">ROI 분석</TabsTrigger>
            <TabsTrigger value="cost">비용 최적화</TabsTrigger>
            <TabsTrigger value="sla">SLA 모니터링</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 실시간 메트릭 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    실시간 비즈니스 메트릭
                  </CardTitle>
                  <CardDescription>
                    {realtimeMetrics ? new Date(realtimeMetrics.timestamp).toLocaleString() : '데이터 로딩 중...'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {realtimeMetrics ? (
                    <div className="space-y-4">
                      {Object.entries(realtimeMetrics.metrics).map(([key, metric]) => (
                        <div key={key} className="flex items-center justify-between">
                          <div className="text-sm font-medium">
                            {key === 'businessTransactionValue' ? '비즈니스 거래 가치' :
                             key === 'operationalEfficiency' ? '운영 효율성' :
                             key === 'costPerTransaction' ? '거래당 비용' :
                             key === 'systemThroughput' ? '시스템 처리량' :
                             key === 'resourceUtilization' ? '자원 사용률' : key}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">
                              {metric.unit === 'KRW/hour' || metric.unit === 'KRW/transaction' ? 
                                formatCurrency(metric.value) : 
                                `${metric.value.toLocaleString()}${metric.unit === 'percentage' ? '%' : metric.unit.replace('KRW/hour', '').replace('KRW/transaction', '').replace('transactions/minute', ' TPS').replace('percentage', '%')}`}
                            </div>
                            <div className={`text-xs ${metric.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                              {metric.change}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>실시간 데이터 로딩 중...</div>
                  )}
                </CardContent>
              </Card>

              {/* 비용 분해 차트 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    월간 비용 분해
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData?.charts.costBreakdown ? (
                    <div className="space-y-3">
                      {dashboardData.charts.costBreakdown.map((item, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{item.category}</span>
                            <span className="font-semibold">{formatCurrency(item.value)}</span>
                          </div>
                          <Progress value={item.percentage} className="h-2" />
                          <div className="text-xs text-muted-foreground text-right">
                            {item.percentage.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>차트 데이터 로딩 중...</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="roi" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    현재 ROI 현황
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {roiData ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">
                          {formatPercentage(roiData.currentROI.percentage)}
                        </div>
                        <div className="text-sm text-muted-foreground">전체 ROI</div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-lg font-semibold">{formatCurrency(roiData.currentROI.totalInvestment)}</div>
                          <div className="text-xs text-muted-foreground">총 투자 금액</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold">{formatCurrency(roiData.currentROI.totalSavings)}</div>
                          <div className="text-xs text-muted-foreground">총 절약 금액</div>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-medium">{roiData.currentROI.paybackPeriodMonths.toFixed(1)}개월</div>
                        <div className="text-xs text-muted-foreground">투자 회수 기간</div>
                      </div>
                    </div>
                  ) : (
                    <div>ROI 데이터 로딩 중...</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ROI 분해 분석</CardTitle>
                </CardHeader>
                <CardContent>
                  {roiData ? (
                    <div className="space-y-3">
                      {Object.entries(roiData.breakdown).map(([key, item]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>
                              {key === 'downtimeReduction' ? '다운타임 감소' :
                               key === 'operationalEfficiency' ? '운영 효율성' :
                               key === 'preventiveMaintenance' ? '예방 정비' :
                               key === 'humanResources' ? '인적 자원' : key}
                            </span>
                            <span className="font-semibold">{formatCurrency(item.savings)}</span>
                          </div>
                          <Progress value={item.percentage} className="h-2" />
                          <div className="text-xs text-muted-foreground text-right">
                            {item.percentage.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>분해 데이터 로딩 중...</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cost" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>비용 최적화 기회</CardTitle>
                  <CardDescription>
                    {costOptimization ? `총 ${formatCurrency(costOptimization.summary.optimizationPotential)} 절약 가능` : '데이터 로딩 중...'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {costOptimization ? (
                    <div className="space-y-4">
                      {costOptimization.opportunities.slice(0, 3).map((opportunity) => (
                        <div key={opportunity.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{opportunity.title}</h4>
                            <Badge variant={opportunity.priority === 'high' ? 'default' : 'secondary'}>
                              {opportunity.priority}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <div className="text-muted-foreground">절약 가능</div>
                              <div className="font-medium">{formatCurrency(opportunity.potentialSavings)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">ROI</div>
                              <div className="font-medium">{opportunity.roi}%</div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            {opportunity.timeframe} | {opportunity.riskLevel} 위험
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>최적화 기회 로딩 중...</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>자원 사용률 현황</CardTitle>
                </CardHeader>
                <CardContent>
                  {costOptimization ? (
                    <div className="space-y-4">
                      {Object.entries(costOptimization.resourceUtilization).map(([resource, data]) => (
                        <div key={resource} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">
                              {resource === 'cpu' ? 'CPU' : 
                               resource === 'memory' ? '메모리' :
                               resource === 'storage' ? '스토리지' :
                               resource === 'network' ? '네트워크' : resource}
                            </span>
                            <span>{data.utilization}%</span>
                          </div>
                          <Progress value={data.utilization} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>월 비용: {formatCurrency(data.cost)}</span>
                            <span className="text-red-600">낭비: {formatCurrency(data.wastedCost)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>자원 사용률 로딩 중...</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sla" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    SLA 준수 현황
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {slaData ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold">
                          {formatPercentage(slaData.overview.overallCompliance)}
                        </div>
                        <div className="text-sm text-muted-foreground">전체 SLA 준수율</div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-semibold text-green-600">{slaData.overview.compliantSLAs}</div>
                          <div className="text-xs text-muted-foreground">준수</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-yellow-600">{slaData.overview.atRiskSLAs}</div>
                          <div className="text-xs text-muted-foreground">위험</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-red-600">{slaData.overview.violatedSLAs}</div>
                          <div className="text-xs text-muted-foreground">위반</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>SLA 데이터 로딩 중...</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SLA 세부 현황</CardTitle>
                </CardHeader>
                <CardContent>
                  {slaData ? (
                    <div className="space-y-3">
                      {slaData.slas.map((sla) => (
                        <div key={sla.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{sla.name}</h4>
                            <Badge variant={sla.status === 'compliant' ? 'default' : sla.status === 'at_risk' ? 'secondary' : 'destructive'}>
                              {sla.status === 'compliant' ? '준수' : sla.status === 'at_risk' ? '위험' : '위반'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <div className="text-muted-foreground">현재값</div>
                              <div className="font-medium">{sla.current}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">목표값</div>
                              <div className="font-medium">{sla.target}</div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            {sla.service} | 트렌드: {getTrendIcon(sla.trend)} {sla.trend}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>SLA 세부 현황 로딩 중...</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  )
}

export default BusinessMetrics