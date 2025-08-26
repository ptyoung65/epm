import React, { useEffect, useState } from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { 
  Activity, 
  Users, 
  Server, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Database,
  Shield,
  Zap,
  BarChart3,
  Monitor,
  RefreshCw
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle, MetricCard, StatusCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GridLayout, PageLayout, Section } from '@/components/layout/Layout'
import { apiClient, type DashboardOverview, type RealtimeData } from '@/lib/api-client'

interface SystemMetric {
  label: string
  value: string | number
  change: {
    value: string | number
    type: 'increase' | 'decrease' | 'neutral'
  }
  icon: React.ComponentType<{ className?: string }>
}

interface RecentActivity {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  description: string
  timestamp: string
  source?: string
}

const Dashboard: React.FC = () => {
  // Fetch real-time data from integration API
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery(
    'dashboard-overview',
    () => apiClient.getDashboardOverview(),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
      retry: 2
    }
  )

  const { data: realtimeData, isLoading: isRealtimeLoading } = useQuery(
    'realtime-data', 
    () => apiClient.getRealtimeData(),
    {
      refetchInterval: 5000, // Refresh every 5 seconds
      retry: 1
    }
  )

  // Build system metrics from API data
  const systemMetrics: SystemMetric[] = realtimeData?.data ? [
    {
      label: '시스템 상태',
      value: dashboardData?.data?.system?.status || '확인 중...',
      change: { value: dashboardData?.data?.system?.completion || '0%', type: 'neutral' },
      icon: Server
    },
    {
      label: 'CPU 사용률',
      value: realtimeData.data.metrics.find(m => m.name === 'CPU Usage')?.value + '%' || '0%',
      change: { value: '+3.1%', type: 'increase' },
      icon: Monitor
    },
    {
      label: '메모리 사용률',
      value: realtimeData.data.metrics.find(m => m.name === 'Memory Usage')?.value + '%' || '0%',
      change: { value: '-2.3%', type: 'decrease' },
      icon: Database
    },
    {
      label: '응답 시간',
      value: realtimeData.data.metrics.find(m => m.name === 'Response Time')?.value + 'ms' || '0ms',
      change: { value: '-15ms', type: 'decrease' },
      icon: Zap
    },
    {
      label: '처리량',
      value: realtimeData.data.metrics.find(m => m.name === 'Throughput')?.value + ' req/min' || '0',
      change: { value: '+350', type: 'increase' },
      icon: BarChart3
    },
    {
      label: '에러율',
      value: realtimeData.data.metrics.find(m => m.name === 'Error Rate')?.value + '%' || '0%',
      change: { value: '-0.02%', type: 'decrease' },
      icon: AlertCircle
    },
    {
      label: '활성 서비스',
      value: dashboardData?.data?.services?.healthy || 0,
      change: { value: `${dashboardData?.data?.services?.total || 0}개 중`, type: 'neutral' },
      icon: Activity
    },
    {
      label: '시스템 가동률',
      value: '99.9%',
      change: { value: '+0.1%', type: 'increase' },
      icon: Shield
    }
  ] : [
    {
      label: '총 사용자',
      value: '1,247',
      change: { value: '+12%', type: 'increase' },
      icon: Users
    },
    {
      label: '활성 세션',
      value: '89',
      change: { value: '+5', type: 'increase' },
      icon: Activity
    },
    {
      label: '서버 상태',
      value: '98.9%',
      change: { value: '+0.2%', type: 'increase' },
      icon: Server
    },
    {
      label: '알림',
      value: '23',
      change: { value: '-8', type: 'decrease' },
      icon: AlertCircle
    },
    {
      label: 'CPU 사용률',
      value: '45.2%',
      change: { value: '+3.1%', type: 'increase' },
      icon: Monitor
    },
    {
      label: '메모리 사용률',
      value: '67.8%',
      change: { value: '-2.3%', type: 'decrease' },
      icon: Database
    },
    {
      label: '응답 시간',
      value: '124ms',
      change: { value: '-15ms', type: 'decrease' },
      icon: Zap
    },
    {
      label: '처리량',
      value: '2.3K req/s',
      change: { value: '+350', type: 'increase' },
      icon: BarChart3
    }
  ]

  const recentActivities: RecentActivity[] = [
    {
      id: '1',
      type: 'warning',
      title: 'CPU 사용률 경고',
      description: 'WAS-01 서버의 CPU 사용률이 80%를 초과했습니다.',
      timestamp: '2분 전',
      source: 'System Monitor'
    },
    {
      id: '2',
      type: 'success',
      title: '사용자 로그인',
      description: 'john.doe@company.com이 로그인했습니다.',
      timestamp: '5분 전',
      source: 'Authentication'
    },
    {
      id: '3',
      type: 'info',
      title: '백업 완료',
      description: '데이터베이스 일일 백업이 성공적으로 완료되었습니다.',
      timestamp: '1시간 전',
      source: 'Database'
    },
    {
      id: '4',
      type: 'error',
      title: '로그인 실패',
      description: '5회 연속 로그인 실패가 감지되었습니다.',
      timestamp: '2시간 전',
      source: 'Security'
    },
    {
      id: '5',
      type: 'info',
      title: '시스템 업데이트',
      description: '모니터링 에이전트가 v1.2.3으로 업데이트되었습니다.',
      timestamp: '3시간 전',
      source: 'System'
    }
  ]

  // Build system status from API data
  const systemStatus = {
    overall: dashboardData?.data?.system?.status === '정상' ? 'healthy' : 'warning',
    components: dashboardData?.data?.services?.details ? 
      Object.entries(dashboardData.data.services.details).map(([name, status]) => ({
        name,
        status: status.includes('✅') ? 'healthy' : 'warning',
        uptime: '99.9%' // Mock uptime - would be fetched from API in production
      })) : [
        { name: 'API 게이트웨이', status: 'healthy', uptime: '99.9%' },
        { name: 'WAS 서버', status: 'warning', uptime: '98.1%' },
        { name: '데이터베이스', status: 'healthy', uptime: '99.8%' },
        { name: '인증 서비스', status: 'healthy', uptime: '99.9%' },
        { name: '모니터링', status: 'healthy', uptime: '99.7%' }
      ]
  }

  const quickActions = [
    { label: 'J2EE 모니터링', href: '/apm/j2ee', icon: Server },
    { label: '사용자 관리', href: '/auth/users', icon: Users },
    { label: '알림 설정', href: '/apm/alerts', icon: AlertCircle },
    { label: '성능 보고서', href: '/analytics/reports', icon: BarChart3 }
  ]

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'warning': return '⚠️'
      case 'error': return '❌'  
      case 'success': return '✅'
      default: return 'ℹ️'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success'
      case 'warning': return 'warning'
      case 'error': return 'error'
      default: return 'info'
    }
  }

  return (
    <PageLayout
      title="대시보드"
      subtitle="AIRIS EPM 시스템 현황을 한눈에 확인하세요"
      breadcrumbs={[{ label: '대시보드' }]}
      actions={
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetchDashboard()}
            disabled={isDashboardLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isDashboardLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button size="sm">
            <BarChart3 className="w-4 h-4 mr-2" />
            상세 보고서
          </Button>
        </div>
      }
    >
      {/* System Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <StatusCard
          title="시스템 전체 상태"
          status="success"
          description="모든 주요 서비스가 정상적으로 운영 중입니다."
          actions={
            <div className="flex space-x-2">
              <Badge variant="success" className="animate-pulse">실시간</Badge>
              <Button variant="ghost" size="sm">상세 보기</Button>
            </div>
          }
        />
      </motion.div>

      {/* System Metrics */}
      <Section title="시스템 메트릭" className="mb-8">
        {isDashboardLoading || isRealtimeLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>실시간 데이터를 불러오는 중...</span>
            </div>
          </div>
        ) : (
          <GridLayout>
            {systemMetrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <MetricCard
                  title={metric.label}
                  value={metric.value}
                  change={metric.change}
                  icon={<metric.icon className="h-6 w-6" />}
                  className="hover-lift"
                />
              </motion.div>
            ))}
          </GridLayout>
        )}
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* System Components Status */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                시스템 구성요소 상태
              </CardTitle>
              <CardDescription>
                각 시스템 구성요소의 상태와 가용성을 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemStatus.components.map((component) => (
                  <div key={component.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        component.status === 'healthy' ? 'bg-green-500' :
                        component.status === 'warning' ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`} />
                      <span className="font-medium">{component.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusColor(component.status) as any}>
                        {component.status === 'healthy' ? '정상' :
                         component.status === 'warning' ? '경고' : '오류'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {component.uptime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activities */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  최근 활동
                </div>
                <Button variant="ghost" size="sm">
                  모두 보기
                </Button>
              </CardTitle>
              <CardDescription>
                시스템에서 발생한 최근 이벤트와 활동 내역
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-80 overflow-y-auto scrollbar-thin">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex space-x-3">
                    <div className="text-lg">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{activity.title}</h4>
                        <span className="text-xs text-muted-foreground">
                          {activity.timestamp}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {activity.description}
                      </p>
                      {activity.source && (
                        <Badge variant="outline" size="sm">
                          {activity.source}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <Section title="빠른 작업" description="자주 사용하는 기능에 빠르게 접근하세요">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, index) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <Card className="hover-lift cursor-pointer transition-all duration-200">
                  <CardContent className="p-6 text-center">
                    <action.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                    <h3 className="font-medium">{action.label}</h3>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </Section>
      </motion.div>
    </PageLayout>
  )
}

export default Dashboard