import React, { useState, useEffect } from 'react';
import { AdvancedChart, ChartSeries } from '../components/charts/AdvancedChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import PageLayout from '../components/layout/PageLayout';
import { 
  AlertTriangle,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  Activity,
  Users,
  Settings,
  Filter,
  Search,
  Phone,
  Mail,
  MessageSquare,
  ExternalLink,
  TrendingUp,
  BarChart3
} from 'lucide-react';

// 알림 데이터 타입 정의
interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'acknowledged' | 'resolved' | 'closed';
  category: 'performance' | 'security' | 'business' | 'system' | 'user';
  source: string;
  timestamp: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  assignedTo?: string;
  tags: string[];
  impact: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  escalationLevel: number;
  relatedIncidents: string[];
  actions: Array<{
    type: 'email' | 'sms' | 'slack' | 'webhook';
    status: 'sent' | 'failed' | 'pending';
    timestamp: string;
    recipient: string;
  }>;
}

interface IncidentStats {
  total: number;
  active: number;
  resolved: number;
  mttr: number; // Mean Time to Resolution
  mtbf: number; // Mean Time Between Failures
}

interface NotificationRule {
  id: string;
  name: string;
  conditions: {
    severity: string[];
    category: string[];
    source: string[];
  };
  actions: {
    type: 'email' | 'sms' | 'slack' | 'webhook';
    recipients: string[];
    template: string;
  }[];
  enabled: boolean;
}

// 샘플 알림 데이터 생성
const generateSampleAlerts = (): Alert[] => {
  const severities: Alert['severity'][] = ['critical', 'high', 'medium', 'low', 'info'];
  const categories: Alert['category'][] = ['performance', 'security', 'business', 'system', 'user'];
  const statuses: Alert['status'][] = ['active', 'acknowledged', 'resolved', 'closed'];
  const impacts: Alert['impact'][] = ['high', 'medium', 'low'];
  
  const sampleTitles = [
    'CPU 사용률 임계치 초과',
    '메모리 부족 경고',
    '데이터베이스 연결 실패',
    '비정상적인 로그인 시도 감지',
    '응답 시간 지연 발생',
    '디스크 공간 부족',
    '네트워크 지연 증가',
    'API 오류율 상승',
    '예약된 백업 실패',
    '보안 스캔 이상 탐지',
    '사용자 세션 급증',
    '매출 목표 달성률 저조'
  ];

  return Array.from({ length: 50 }, (_, index) => {
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const title = sampleTitles[Math.floor(Math.random() * sampleTitles.length)];
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // 지난 7일 내

    return {
      id: `alert-${index + 1}`,
      title,
      description: `${title}에 대한 상세 설명입니다. 즉시 확인이 필요합니다.`,
      severity,
      status,
      category,
      source: `${category}-monitor`,
      timestamp: timestamp.toISOString(),
      acknowledgedBy: status !== 'active' ? '관리자' : undefined,
      acknowledgedAt: status !== 'active' ? new Date(timestamp.getTime() + 1800000).toISOString() : undefined,
      resolvedAt: status === 'resolved' || status === 'closed' ? new Date(timestamp.getTime() + 3600000).toISOString() : undefined,
      assignedTo: Math.random() > 0.5 ? '시스템 관리팀' : '개발팀',
      tags: [`${category}`, severity, status],
      impact: impacts[Math.floor(Math.random() * impacts.length)],
      urgency: impacts[Math.floor(Math.random() * impacts.length)],
      escalationLevel: Math.floor(Math.random() * 3),
      relatedIncidents: [],
      actions: [
        {
          type: 'email',
          status: 'sent',
          timestamp: new Date(timestamp.getTime() + 60000).toISOString(),
          recipient: 'admin@company.com'
        },
        {
          type: 'slack',
          status: Math.random() > 0.8 ? 'failed' : 'sent',
          timestamp: new Date(timestamp.getTime() + 120000).toISOString(),
          recipient: '#alerts'
        }
      ]
    };
  });
};

// 샘플 알림 규칙
const sampleNotificationRules: NotificationRule[] = [
  {
    id: 'critical-alerts',
    name: '긴급 알림 규칙',
    conditions: {
      severity: ['critical'],
      category: ['performance', 'security', 'system'],
      source: ['*']
    },
    actions: [
      {
        type: 'email',
        recipients: ['admin@company.com', 'manager@company.com'],
        template: 'critical-alert'
      },
      {
        type: 'sms',
        recipients: ['+82-10-1234-5678'],
        template: 'sms-critical'
      },
      {
        type: 'slack',
        recipients: ['#critical-alerts'],
        template: 'slack-critical'
      }
    ],
    enabled: true
  },
  {
    id: 'business-alerts',
    name: '비즈니스 알림 규칙',
    conditions: {
      severity: ['high', 'medium'],
      category: ['business'],
      source: ['*']
    },
    actions: [
      {
        type: 'email',
        recipients: ['business@company.com'],
        template: 'business-alert'
      },
      {
        type: 'slack',
        recipients: ['#business-alerts'],
        template: 'slack-business'
      }
    ],
    enabled: true
  }
];

const AlertsDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>(generateSampleAlerts());
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 실시간 알림 시뮬레이션
  useEffect(() => {
    const interval = setInterval(() => {
      // 새 알림 생성 (10% 확률)
      if (Math.random() < 0.1) {
        const newAlert = generateSampleAlerts()[0];
        newAlert.id = `alert-${Date.now()}`;
        newAlert.timestamp = new Date().toISOString();
        newAlert.status = 'active';
        
        setAlerts(prevAlerts => [newAlert, ...prevAlerts.slice(0, 49)]);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // 필터링된 알림
  const filteredAlerts = alerts.filter(alert => {
    const matchesSeverity = selectedSeverity === 'all' || alert.severity === selectedSeverity;
    const matchesCategory = selectedCategory === 'all' || alert.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || alert.status === selectedStatus;
    const matchesSearch = searchTerm === '' || 
      alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.description.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSeverity && matchesCategory && matchesStatus && matchesSearch;
  });

  // 통계 계산
  const stats: IncidentStats = {
    total: alerts.length,
    active: alerts.filter(a => a.status === 'active').length,
    resolved: alerts.filter(a => a.status === 'resolved' || a.status === 'closed').length,
    mttr: 2.5, // hours
    mtbf: 48   // hours
  };

  // 심각도별 아이콘
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case 'info':
        return <Activity className="h-4 w-4 text-gray-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  // 상태별 배지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="destructive">활성</Badge>;
      case 'acknowledged':
        return <Badge variant="secondary">확인됨</Badge>;
      case 'resolved':
        return <Badge variant="default">해결됨</Badge>;
      case 'closed':
        return <Badge variant="outline">종료</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // 심각도별 색상
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-300';
      case 'high': return 'bg-red-50 border-red-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'low': return 'bg-blue-50 border-blue-200';
      case 'info': return 'bg-gray-50 border-gray-200';
      default: return 'bg-white border-gray-200';
    }
  };

  // 알림 확인 처리
  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prevAlerts =>
      prevAlerts.map(alert =>
        alert.id === alertId
          ? {
              ...alert,
              status: 'acknowledged',
              acknowledgedBy: '현재 사용자',
              acknowledgedAt: new Date().toISOString()
            }
          : alert
      )
    );
  };

  // 알림 해결 처리
  const resolveAlert = (alertId: string) => {
    setAlerts(prevAlerts =>
      prevAlerts.map(alert =>
        alert.id === alertId
          ? {
              ...alert,
              status: 'resolved',
              resolvedAt: new Date().toISOString()
            }
          : alert
      )
    );
  };

  // 심각도별 차트 데이터
  const severityChartData: ChartSeries[] = [{
    label: '심각도별 알림',
    data: [
      { label: 'Critical', value: alerts.filter(a => a.severity === 'critical').length },
      { label: 'High', value: alerts.filter(a => a.severity === 'high').length },
      { label: 'Medium', value: alerts.filter(a => a.severity === 'medium').length },
      { label: 'Low', value: alerts.filter(a => a.severity === 'low').length },
      { label: 'Info', value: alerts.filter(a => a.severity === 'info').length }
    ]
  }];

  // 시간대별 알림 발생 추이
  const timeSeriesData: ChartSeries[] = [{
    label: '시간별 알림 발생',
    data: Array.from({ length: 24 }, (_, hour) => ({
      x: `${hour}:00`,
      y: alerts.filter(alert => {
        const alertHour = new Date(alert.timestamp).getHours();
        return alertHour === hour;
      }).length,
      value: alerts.filter(alert => {
        const alertHour = new Date(alert.timestamp).getHours();
        return alertHour === hour;
      }).length
    }))
  }];

  return (
    <PageLayout
      title="알림 및 인시던트 관리"
      subtitle="시스템 알림, 인시던트 추적 및 대응 상황 모니터링"
      breadcrumbs={[
        { label: '홈', href: '/' },
        { label: '알림 관리' }
      ]}
    >
      {/* 알림 요약 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 알림</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">지난 7일</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 알림</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">즉시 조치 필요</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">해결된 알림</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">처리 완료</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 해결 시간</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mttr}h</div>
            <p className="text-xs text-muted-foreground">MTTR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">장애 간격</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mtbf}h</div>
            <p className="text-xs text-muted-foreground">MTBF</p>
          </CardContent>
        </Card>
      </div>

      {/* 차트 분석 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdvancedChart
          type="doughnut"
          title="심각도별 알림 분포"
          description="현재 활성 알림의 심각도 분포"
          series={severityChartData}
          height={300}
          showLegend={true}
        />

        <AdvancedChart
          type="bar"
          title="시간대별 알림 발생 현황"
          description="24시간 동안의 알림 발생 패턴"
          series={timeSeriesData}
          height={300}
          showGrid={true}
          threshold={{
            value: 5,
            label: '평균 발생률',
            color: '#F59E0B'
          }}
        />
      </div>

      {/* 알림 관리 탭 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>알림 관리</CardTitle>
              <CardDescription>시스템 알림 모니터링 및 대응 관리</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                설정
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                필터
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="alerts" className="space-y-4">
            <TabsList>
              <TabsTrigger value="alerts">활성 알림</TabsTrigger>
              <TabsTrigger value="history">알림 이력</TabsTrigger>
              <TabsTrigger value="rules">알림 규칙</TabsTrigger>
              <TabsTrigger value="analytics">분석</TabsTrigger>
            </TabsList>

            <TabsContent value="alerts" className="space-y-4">
              {/* 필터 컨트롤 */}
              <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">심각도:</span>
                  <select 
                    value={selectedSeverity} 
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="all">전체</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="info">Info</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">카테고리:</span>
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="all">전체</option>
                    <option value="performance">성능</option>
                    <option value="security">보안</option>
                    <option value="business">비즈니스</option>
                    <option value="system">시스템</option>
                    <option value="user">사용자</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">상태:</span>
                  <select 
                    value={selectedStatus} 
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="all">전체</option>
                    <option value="active">활성</option>
                    <option value="acknowledged">확인됨</option>
                    <option value="resolved">해결됨</option>
                    <option value="closed">종료</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="알림 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="text-sm border rounded px-2 py-1 w-48"
                  />
                </div>
              </div>

              {/* 알림 목록 */}
              <div className="space-y-2">
                {filteredAlerts.slice(0, 20).map((alert) => (
                  <Card key={alert.id} className={`${getSeverityColor(alert.severity)} border-l-4`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getSeverityIcon(alert.severity)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm truncate">{alert.title}</h4>
                              {getStatusBadge(alert.status)}
                              <Badge variant="outline" className="text-xs">
                                {alert.category}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {alert.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>발생: {new Date(alert.timestamp).toLocaleString('ko-KR')}</span>
                              <span>소스: {alert.source}</span>
                              {alert.assignedTo && <span>담당: {alert.assignedTo}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {alert.status === 'active' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => acknowledgeAlert(alert.id)}
                              >
                                확인
                              </Button>
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={() => resolveAlert(alert.id)}
                              >
                                해결
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredAlerts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  조건에 맞는 알림이 없습니다.
                </div>
              )}
            </TabsContent>

            <TabsContent value="rules" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">알림 규칙 관리</h3>
                  <Button size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    새 규칙 추가
                  </Button>
                </div>

                {sampleNotificationRules.map((rule) => (
                  <Card key={rule.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{rule.name}</CardTitle>
                        <Badge variant={rule.enabled ? "default" : "secondary"}>
                          {rule.enabled ? '활성' : '비활성'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium mb-2">조건</h4>
                          <ul className="space-y-1 text-muted-foreground">
                            <li>심각도: {rule.conditions.severity.join(', ')}</li>
                            <li>카테고리: {rule.conditions.category.join(', ')}</li>
                            <li>소스: {rule.conditions.source.join(', ')}</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">액션</h4>
                          <div className="flex gap-2">
                            {rule.actions.map((action, index) => (
                              <Badge key={index} variant="outline" className="gap-1">
                                {action.type === 'email' && <Mail className="h-3 w-3" />}
                                {action.type === 'sms' && <Phone className="h-3 w-3" />}
                                {action.type === 'slack' && <MessageSquare className="h-3 w-3" />}
                                {action.type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>알림 트렌드 분석</CardTitle>
                    <CardDescription>지난 30일간 알림 발생 추이</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AdvancedChart
                      type="line"
                      title=""
                      series={[{
                        label: '일별 알림 수',
                        data: Array.from({ length: 30 }, (_, day) => ({
                          x: `${day + 1}일`,
                          y: 5 + Math.random() * 20 + Math.sin(day * 0.2) * 10,
                          value: 5 + Math.random() * 20 + Math.sin(day * 0.2) * 10
                        }))
                      }]}
                      height={250}
                      showGrid={true}
                      gradient={true}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>해결 시간 분석</CardTitle>
                    <CardDescription>심각도별 평균 해결 시간</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AdvancedChart
                      type="bar"
                      title=""
                      series={[{
                        label: '평균 해결 시간 (시간)',
                        data: [
                          { label: 'Critical', value: 0.5 },
                          { label: 'High', value: 2.1 },
                          { label: 'Medium', value: 4.8 },
                          { label: 'Low', value: 12.5 },
                          { label: 'Info', value: 24.2 }
                        ]
                      }]}
                      height={250}
                      showGrid={true}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </PageLayout>
  );
};

export default AlertsDashboard;