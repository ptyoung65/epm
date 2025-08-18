/**
 * AIRIS-MON Korean HyperDX Style Dashboard
 * Main application component with Korean UX patterns
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Helmet } from 'react-helmet';

// Themes
import { koreanTheme, globalStyles } from './styles/theme';

// Components
import Navigation from './components/Navigation/Navigation';
import Sidebar from './components/Navigation/Sidebar';
import LoadingScreen from './components/Common/LoadingScreen';
import ErrorBoundary from './components/Common/ErrorBoundary';
import NotificationCenter from './components/Common/NotificationCenter';

// Pages
import Dashboard from './pages/Dashboard/Dashboard';
import Metrics from './pages/Metrics/Metrics';
import Logs from './pages/Logs/Logs';
import Traces from './pages/Traces/Traces';
import Alerts from './pages/Alerts/Alerts';
import Analytics from './pages/Analytics/Analytics';
import Settings from './pages/Settings/Settings';

// Hooks and Services
import { useWebSocket } from './hooks/useWebSocket';
import { useKoreanTime } from './hooks/useKoreanTime';
import { ApiService } from './services/ApiService';
import { KoreanLocalization } from './services/KoreanLocalization';

// Stores
import { useAppStore } from './stores/appStore';

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 30000,
      refetchOnWindowFocus: false,
      onError: (error) => {
        console.error('쿼리 오류:', error);
      }
    }
  }
});

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Global stores
  const { 
    initialized, 
    initialize, 
    theme, 
    language,
    notifications,
    addNotification,
    clearNotification
  } = useAppStore();

  // Korean time management
  const { koreanTime, isBusinessHours, timeCategory } = useKoreanTime();

  // WebSocket connection for real-time updates
  const { 
    connected, 
    connectionStatus, 
    lastMessage,
    sendMessage 
  } = useWebSocket('ws://localhost:3002/ws', {
    onMessage: (message) => {
      handleRealtimeUpdate(message);
    },
    onError: (error) => {
      addNotification({
        type: 'error',
        title: '실시간 연결 오류',
        message: '서버와의 실시간 연결이 끊어졌습니다.',
        korean: true
      });
    }
  });

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize localization
        await KoreanLocalization.initialize();
        
        // Initialize API service
        await ApiService.initialize();
        
        // Initialize app store
        await initialize();
        
        // Load initial data
        await loadInitialData();
        
        setIsLoading(false);
        
        // Success notification
        addNotification({
          type: 'success',
          title: 'AIRIS-MON 초기화 완료',
          message: `한국 시간: ${koreanTime.format}`,
          korean: true,
          duration: 3000
        });

      } catch (error) {
        console.error('앱 초기화 실패:', error);
        addNotification({
          type: 'error',
          title: '초기화 실패',
          message: error.message,
          korean: true
        });
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Handle real-time updates
  const handleRealtimeUpdate = (message) => {
    const { type, data } = message;
    
    switch (type) {
      case 'alert':
        handleAlertUpdate(data);
        break;
      case 'metric':
        handleMetricUpdate(data);
        break;
      case 'log':
        handleLogUpdate(data);
        break;
      case 'trace':
        handleTraceUpdate(data);
        break;
      case 'system':
        handleSystemUpdate(data);
        break;
      default:
        console.log('알 수 없는 실시간 업데이트:', type, data);
    }
  };

  const handleAlertUpdate = (alert) => {
    // Add alert notification based on Korean UX patterns
    const severity = alert.alert_severity?.toLowerCase() || 'info';
    const koreanSeverity = {
      'critical': '긴급',
      'high': '높음', 
      'medium': '보통',
      'low': '낮음',
      'info': '정보'
    }[severity] || severity;

    addNotification({
      type: severity === 'critical' ? 'error' : 
            severity === 'high' ? 'warning' : 'info',
      title: `${koreanSeverity} 알림`,
      message: alert.alert_message,
      korean: true,
      priority: severity === 'critical' ? 'high' : 'normal',
      actions: severity === 'critical' ? [
        { label: '확인', action: () => navigateToAlert(alert.id) }
      ] : undefined
    });
  };

  const handleMetricUpdate = (metric) => {
    // Handle metric updates for dashboard refresh
    if (metric.korean_business_hours && isBusinessHours) {
      // Higher priority during business hours
      useAppStore.getState().updateMetric(metric);
    }
  };

  const handleLogUpdate = (log) => {
    // Handle critical logs
    if (['ERROR', 'CRITICAL'].includes(log.log_level)) {
      addNotification({
        type: 'warning',
        title: `${log.log_level} 로그`,
        message: `${log.service_name}: ${log.log_message?.substring(0, 100)}...`,
        korean: true
      });
    }
  };

  const handleTraceUpdate = (trace) => {
    // Handle slow traces during business hours
    if (trace.span_duration > 5000 && isBusinessHours) {
      addNotification({
        type: 'warning',
        title: '느린 응답 감지',
        message: `${trace.service_name}: ${trace.span_duration}ms`,
        korean: true
      });
    }
  };

  const handleSystemUpdate = (system) => {
    if (system.status === 'unhealthy') {
      addNotification({
        type: 'error',
        title: '시스템 상태 이상',
        message: `${system.service}: ${system.message}`,
        korean: true,
        priority: 'high'
      });
    }
  };

  const loadInitialData = async () => {
    try {
      // Load dashboard data
      const dashboardData = await ApiService.getDashboardOverview();
      useAppStore.getState().setDashboardData(dashboardData);

      // Load system status
      const systemStatus = await ApiService.getSystemStatus();
      useAppStore.getState().setSystemStatus(systemStatus);

      // Load recent alerts
      const recentAlerts = await ApiService.getRecentAlerts();
      useAppStore.getState().setAlerts(recentAlerts);

    } catch (error) {
      console.error('초기 데이터 로딩 실패:', error);
      throw error;
    }
  };

  const navigateToAlert = (alertId) => {
    // Navigate to specific alert
    window.location.href = `/alerts/${alertId}`;
  };

  // Toggle sidebar
  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Loading screen
  if (isLoading) {
    return (
      <ThemeProvider theme={koreanTheme}>
        <CssBaseline />
        {globalStyles}
        <LoadingScreen 
          message="AIRIS-MON 초기화 중..."
          korean={true}
        />
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={koreanTheme}>
        <CssBaseline />
        {globalStyles}
        <ErrorBoundary>
          <Router>
            <Helmet>
              <title>AIRIS-MON - AI 위험 분석 시스템</title>
              <meta name="description" content="한국형 AI 위험 인텔리전스 시스템 모니터링" />
              <meta name="korean-time" content={koreanTime.format} />
              <meta name="business-hours" content={isBusinessHours.toString()} />
              <meta name="time-category" content={timeCategory} />
            </Helmet>

            <Box sx={{ display: 'flex', height: '100vh', backgroundColor: 'background.default' }}>
              {/* Sidebar */}
              <Sidebar 
                open={sidebarOpen}
                onToggle={handleSidebarToggle}
                koreanTime={koreanTime}
                connectionStatus={connectionStatus}
              />

              {/* Main Content */}
              <Box sx={{ 
                flexGrow: 1, 
                display: 'flex', 
                flexDirection: 'column',
                overflow: 'hidden',
                marginLeft: sidebarOpen ? '280px' : '80px',
                transition: theme.transitions.create(['margin'], {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.leavingScreen,
                })
              }}>
                {/* Top Navigation */}
                <Navigation 
                  onSidebarToggle={handleSidebarToggle}
                  sidebarOpen={sidebarOpen}
                  koreanTime={koreanTime}
                  connectionStatus={connectionStatus}
                />

                {/* Page Content */}
                <Box sx={{ 
                  flexGrow: 1, 
                  overflow: 'auto',
                  padding: 3,
                  backgroundColor: 'background.paper'
                }}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/metrics" element={<Metrics />} />
                    <Route path="/logs" element={<Logs />} />
                    <Route path="/traces" element={<Traces />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/alerts/:id" element={<Alerts />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/settings" element={<Settings />} />
                    
                    {/* 404 Page */}
                    <Route path="*" element={
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        gap: 2
                      }}>
                        <Typography variant="h4" color="error">
                          404 - 페이지를 찾을 수 없습니다
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          요청하신 페이지가 존재하지 않습니다.
                        </Typography>
                      </Box>
                    } />
                  </Routes>
                </Box>
              </Box>
            </Box>

            {/* Notification Center */}
            <NotificationCenter 
              notifications={notifications}
              onClear={clearNotification}
              korean={language === 'ko'}
            />
          </Router>
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;