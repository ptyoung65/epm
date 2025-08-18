/**
 * Korean HyperDX-style Dashboard for AIRIS-MON
 * Real-time monitoring dashboard with Korean UX patterns
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkIcon,
  Timer as TimerIcon,
  BusinessCenter as BusinessIcon
} from '@mui/icons-material';
import { useQuery, useQueryClient } from 'react-query';

// Components
import MetricCard from '../../components/Dashboard/MetricCard';
import TimeSeriesChart from '../../components/Dashboard/TimeSeriesChart';
import StatusOverview from '../../components/Dashboard/StatusOverview';
import RecentAlerts from '../../components/Dashboard/RecentAlerts';
import ServiceHealth from '../../components/Dashboard/ServiceHealth';
import KoreanTimeIndicator from '../../components/Common/KoreanTimeIndicator';
import QuickActions from '../../components/Dashboard/QuickActions';

// Services and Hooks
import { ApiService } from '../../services/ApiService';
import { useKoreanTime } from '../../hooks/useKoreanTime';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAppStore } from '../../stores/appStore';

// Utils
import { formatKoreanNumber, formatKoreanPercent } from '../../utils/formatters';
import { koreanThemeUtils } from '../../styles/theme';

const Dashboard = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const queryClient = useQueryClient();
  
  // Korean time management
  const { koreanTime, isBusinessHours, timeCategory, formatTime } = useKoreanTime();
  
  // Global state
  const { addNotification } = useAppStore();

  // Real-time data updates
  const { connected, lastMessage } = useWebSocket('ws://localhost:3002/ws', {
    onMessage: (data) => {
      if (data.type === 'dashboard_update') {
        queryClient.invalidateQueries(['dashboard']);
      }
    }
  });

  // Dashboard overview data
  const { 
    data: dashboardData, 
    isLoading, 
    error, 
    refetch: refetchDashboard 
  } = useQuery(
    ['dashboard', selectedTimeRange],
    () => ApiService.getDashboardOverview(selectedTimeRange),
    {
      refetchInterval: isBusinessHours ? 30000 : 60000, // More frequent during business hours
      onError: (error) => {
        addNotification({
          type: 'error',
          title: '대시보드 데이터 로딩 실패',
          message: error.message,
          korean: true
        });
      }
    }
  );

  // System metrics
  const { data: systemMetrics } = useQuery(
    ['system-metrics', selectedTimeRange],
    () => ApiService.getSystemMetrics(selectedTimeRange),
    {
      refetchInterval: 30000,
      enabled: !!dashboardData
    }
  );

  // Recent alerts
  const { data: recentAlerts } = useQuery(
    ['recent-alerts'],
    () => ApiService.getRecentAlerts(10),
    {
      refetchInterval: 15000,
      enabled: !!dashboardData
    }
  );

  // Service health status
  const { data: serviceHealth } = useQuery(
    ['service-health'],
    () => ApiService.getServiceHealth(),
    {
      refetchInterval: 20000,
      enabled: !!dashboardData
    }
  );

  // Time range options
  const timeRangeOptions = [
    { value: '15m', label: '15분' },
    { value: '1h', label: '1시간' },
    { value: '6h', label: '6시간' },
    { value: '24h', label: '24시간' },
    { value: '7d', label: '7일' },
    { value: '30d', label: '30일' }
  ];

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchDashboard(),
        queryClient.invalidateQueries(['system-metrics']),
        queryClient.invalidateQueries(['recent-alerts']),
        queryClient.invalidateQueries(['service-health'])
      ]);
      
      addNotification({
        type: 'success',
        title: '대시보드 새로고침 완료',
        message: `업데이트 시간: ${formatTime(new Date())}`,
        korean: true,
        duration: 2000
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: '새로고침 실패',
        message: error.message,
        korean: true
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    if (!dashboardData || !systemMetrics) return null;

    return {
      totalEvents: dashboardData.totalEvents || 0,
      errorRate: dashboardData.errorRate || 0,
      avgResponseTime: dashboardData.avgResponseTime || 0,
      throughput: dashboardData.throughput || 0,
      cpuUsage: systemMetrics.cpu?.usage || 0,
      memoryUsage: systemMetrics.memory?.usage || 0,
      diskUsage: systemMetrics.disk?.usage || 0,
      networkLatency: systemMetrics.network?.latency || 0,
      activeUsers: dashboardData.activeUsers || 0,
      alertCount: recentAlerts?.length || 0
    };
  }, [dashboardData, systemMetrics, recentAlerts]);

  // Loading state
  if (isLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100%"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          대시보드 데이터 로딩 중...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box p={3}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              다시 시도
            </Button>
          }
        >
          <Typography variant="h6">대시보드 로딩 실패</Typography>
          <Typography variant="body2">{error.message}</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="dashboard-container">
      {/* Header */}
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center" 
        mb={3}
        flexWrap="wrap"
        gap={2}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <DashboardIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight={600}>
            AIRIS-MON 대시보드
          </Typography>
          <KoreanTimeIndicator 
            time={koreanTime}
            isBusinessHours={isBusinessHours}
            timeCategory={timeCategory}
          />
        </Box>
        
        <Box display="flex" alignItems="center" gap={2}>
          {/* Connection Status */}
          <Chip
            icon={<NetworkIcon />}
            label={connected ? '실시간 연결됨' : '연결 끊김'}
            color={connected ? 'success' : 'error'}
            variant="outlined"
            size="small"
          />
          
          {/* Time Range Selector */}
          <Box display="flex" gap={1}>
            {timeRangeOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedTimeRange === option.value ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setSelectedTimeRange(option.value)}
                sx={{ minWidth: 60 }}
              >
                {option.label}
              </Button>
            ))}
          </Box>
          
          {/* Actions */}
          <Tooltip title="새로고침">
            <IconButton 
              onClick={handleRefresh} 
              disabled={refreshing}
              color="primary"
            >
              <RefreshIcon sx={{ 
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }} />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="설정">
            <IconButton color="primary">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Business Hours Alert */}
      {isBusinessHours && (
        <Alert 
          severity="info" 
          icon={<BusinessIcon />}
          sx={{ mb: 3 }}
        >
          <Typography variant="body2">
            현재 한국 업무시간입니다. 실시간 모니터링이 강화되고 있습니다.
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Key Metrics Row */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="총 이벤트"
                value={formatKoreanNumber(derivedMetrics?.totalEvents || 0)}
                icon={<TrendingUpIcon />}
                trend={dashboardData?.eventTrend}
                color="primary"
                korean={true}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="오류율"
                value={formatKoreanPercent(derivedMetrics?.errorRate || 0)}
                icon={<ErrorIcon />}
                trend={dashboardData?.errorTrend}
                color={derivedMetrics?.errorRate > 5 ? 'error' : 'success'}
                threshold={5}
                korean={true}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="평균 응답시간"
                value={`${derivedMetrics?.avgResponseTime || 0}ms`}
                icon={<TimerIcon />}
                trend={dashboardData?.responseTrend}
                color={derivedMetrics?.avgResponseTime > 1000 ? 'warning' : 'success'}
                threshold={1000}
                korean={true}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="처리량 (RPS)"
                value={formatKoreanNumber(derivedMetrics?.throughput || 0)}
                icon={<SpeedIcon />}
                trend={dashboardData?.throughputTrend}
                color="info"
                korean={true}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Charts Row */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <TrendingUpIcon />
                시계열 메트릭
                <Chip 
                  label={timeRangeOptions.find(opt => opt.value === selectedTimeRange)?.label}
                  size="small"
                  color="primary"
                />
              </Typography>
              <Divider sx={{ my: 2 }} />
              <TimeSeriesChart 
                timeRange={selectedTimeRange}
                data={dashboardData?.timeSeries}
                korean={true}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <StatusOverview 
            data={derivedMetrics}
            korean={true}
            isBusinessHours={isBusinessHours}
          />
        </Grid>

        {/* System Health Row */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <MemoryIcon />
                시스템 리소스
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <MetricCard
                    title="CPU 사용률"
                    value={formatKoreanPercent(derivedMetrics?.cpuUsage || 0)}
                    progress={derivedMetrics?.cpuUsage}
                    color={derivedMetrics?.cpuUsage > 80 ? 'error' : 'success'}
                    size="small"
                    korean={true}
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <MetricCard
                    title="메모리 사용률"
                    value={formatKoreanPercent(derivedMetrics?.memoryUsage || 0)}
                    progress={derivedMetrics?.memoryUsage}
                    color={derivedMetrics?.memoryUsage > 85 ? 'error' : 'success'}
                    size="small"
                    korean={true}
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <MetricCard
                    title="디스크 사용률"
                    value={formatKoreanPercent(derivedMetrics?.diskUsage || 0)}
                    progress={derivedMetrics?.diskUsage}
                    icon={<StorageIcon />}
                    color={derivedMetrics?.diskUsage > 90 ? 'error' : 'success'}
                    size="small"
                    korean={true}
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <MetricCard
                    title="네트워크 지연"
                    value={`${derivedMetrics?.networkLatency || 0}ms`}
                    icon={<NetworkIcon />}
                    color={derivedMetrics?.networkLatency > 100 ? 'warning' : 'success'}
                    size="small"
                    korean={true}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ServiceHealth 
            data={serviceHealth}
            korean={true}
            onServiceClick={(service) => {
              // Navigate to service details
              console.log('Navigate to service:', service);
            }}
          />
        </Grid>

        {/* Recent Alerts */}
        <Grid item xs={12} lg={8}>
          <RecentAlerts 
            alerts={recentAlerts}
            korean={true}
            onAlertClick={(alert) => {
              // Navigate to alert details
              console.log('Navigate to alert:', alert);
            }}
          />
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} lg={4}>
          <QuickActions 
            korean={true}
            isBusinessHours={isBusinessHours}
            onAction={(action) => {
              addNotification({
                type: 'info',
                title: '작업 실행',
                message: `${action} 작업이 실행되었습니다.`,
                korean: true
              });
            }}
          />
        </Grid>
      </Grid>

      {/* Footer Info */}
      <Box 
        mt={4} 
        pt={2} 
        borderTop={1} 
        borderColor="divider"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={2}
      >
        <Typography variant="caption" color="text.secondary">
          마지막 업데이트: {formatTime(new Date())} 
          {isBusinessHours && ' • 업무시간 모니터링 활성화'}
        </Typography>
        
        <Box display="flex" gap={2}>
          <Chip 
            label={`총 ${derivedMetrics?.alertCount || 0}개 알림`}
            size="small"
            color={derivedMetrics?.alertCount > 0 ? 'warning' : 'default'}
          />
          <Chip 
            label={`활성 사용자 ${formatKoreanNumber(derivedMetrics?.activeUsers || 0)}명`}
            size="small"
            color="info"
          />
          <Chip 
            label={timeCategory === 'business_hours' ? '업무시간' : '업무외시간'}
            size="small"
            sx={{ 
              color: koreanThemeUtils.getTimeColor(timeCategory),
              borderColor: koreanThemeUtils.getTimeColor(timeCategory)
            }}
            variant="outlined"
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;