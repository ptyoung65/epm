import React from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { 
  Server, 
  Activity, 
  AlertCircle, 
  TrendingUp,
  Clock,
  RefreshCw
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageLayout, Section, GridLayout } from '@/components/layout/Layout'
import { apiClient, type J2EEMetrics } from '@/lib/api-client'

const J2EEMonitoring: React.FC = () => {
  const { data: j2eeData, isLoading, refetch } = useQuery(
    'j2ee-metrics',
    () => apiClient.getJ2EEMetrics(),
    {
      refetchInterval: 10000, // Refresh every 10 seconds
      retry: 2
    }
  )

  const metrics = j2eeData?.data

  return (
    <PageLayout
      title="J2EE 모니터링"
      subtitle="Servlet, JSP, EJB 실시간 성능 모니터링"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: 'APM 모니터링', href: '/apm' },
        { label: 'J2EE 모니터링' }
      ]}
      actions={
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>J2EE 메트릭을 불러오는 중...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Servlets Section */}
          <Section title="Servlet 모니터링">
            <GridLayout>
              {metrics?.servlets?.map((servlet, index) => (
                <motion.div
                  key={servlet.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Server className="w-5 h-5 mr-2" />
                          {servlet.name}
                        </div>
                        <Badge variant={servlet.errors > 0 ? 'destructive' : 'success'}>
                          {servlet.errors > 0 ? '오류 발생' : '정상'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">총 요청 수</p>
                            <p className="text-2xl font-bold">{servlet.requests.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">평균 응답시간</p>
                            <p className="text-2xl font-bold">{servlet.avgResponseTime}ms</p>
                          </div>
                        </div>
                        {servlet.errors > 0 && (
                          <div className="flex items-center space-x-2 text-red-600">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">{servlet.errors}개 오류 발생</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )) || <div>Servlet 데이터가 없습니다.</div>}
            </GridLayout>
          </Section>

          {/* JSP Section */}
          <Section title="JSP 모니터링">
            <GridLayout>
              {metrics?.jsps?.map((jsp, index) => (
                <motion.div
                  key={jsp.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Activity className="w-5 h-5 mr-2" />
                          {jsp.name}
                        </div>
                        <Badge variant={jsp.errors > 0 ? 'destructive' : 'success'}>
                          {jsp.errors > 0 ? '오류 발생' : '정상'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">총 요청 수</p>
                            <p className="text-2xl font-bold">{jsp.requests.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">평균 응답시간</p>
                            <p className="text-2xl font-bold">{jsp.avgResponseTime}ms</p>
                          </div>
                        </div>
                        {jsp.errors > 0 && (
                          <div className="flex items-center space-x-2 text-red-600">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">{jsp.errors}개 오류 발생</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )) || <div>JSP 데이터가 없습니다.</div>}
            </GridLayout>
          </Section>

          {/* EJB Section */}
          <Section title="EJB 모니터링">
            <GridLayout>
              {metrics?.ejbs?.map((ejb, index) => (
                <motion.div
                  key={ejb.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <TrendingUp className="w-5 h-5 mr-2" />
                          {ejb.name}
                        </div>
                        <Badge variant={ejb.errors > 0 ? 'destructive' : 'success'}>
                          {ejb.errors > 0 ? '오류 발생' : '정상'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">총 호출 수</p>
                            <p className="text-2xl font-bold">{ejb.calls.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">평균 응답시간</p>
                            <p className="text-2xl font-bold">{ejb.avgResponseTime}ms</p>
                          </div>
                        </div>
                        {ejb.errors > 0 && (
                          <div className="flex items-center space-x-2 text-red-600">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">{ejb.errors}개 오류 발생</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )) || <div>EJB 데이터가 없습니다.</div>}
            </GridLayout>
          </Section>
        </div>
      )}
    </PageLayout>
  )
}

export default J2EEMonitoring