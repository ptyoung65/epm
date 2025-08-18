/**
 * 대시보드 UI 모듈 - AIRIS-MON 테스트 대시보드 UI 컴포넌트
 * 실시간 차트, 위젯, 데이터 시각화 등을 관리
 */

const { v4: uuidv4 } = require('uuid');

class DashboardUI {
  constructor() {
    this.widgets = new Map();
    this.chartData = new Map();
    this.realtimeStreams = new Map();
    this.alertNotifications = [];
    this.themeConfig = 'korean-hyperdx';
  }

  initializeDashboard() {
    console.log('🎨 대시보드 UI 초기화 시작');
    
    // 기본 위젯 생성
    this.createDefaultWidgets();
    
    // 차트 데이터 초기화
    this.initializeChartData();
    
    // 테마 설정 적용
    this.applyThemeConfiguration();
    
    console.log('✅ 대시보드 UI 초기화 완료');
  }

  createDefaultWidgets() {
    const defaultWidgets = [
      {
        id: 'system-overview',
        type: 'metric-grid',
        title: '시스템 개요',
        korean_title: '시스템 현황',
        position: { x: 0, y: 0, width: 6, height: 4 },
        config: {
          metrics: ['cpu_usage', 'memory_usage', 'disk_usage', 'network_io']
        }
      },
      {
        id: 'performance-chart',
        type: 'line-chart',
        title: '성능 추세',
        korean_title: '성능 변화 추이',
        position: { x: 6, y: 0, width: 6, height: 4 },
        config: {
          timeRange: '24h',
          metrics: ['response_time', 'throughput', 'error_rate']
        }
      },
      {
        id: 'error-logs',
        type: 'log-viewer',
        title: '오류 로그',
        korean_title: '최근 오류',
        position: { x: 0, y: 4, width: 8, height: 3 },
        config: {
          maxEntries: 100,
          autoRefresh: true,
          filters: ['error', 'warning']
        }
      },
      {
        id: 'alert-panel',
        type: 'alert-list',
        title: '활성 알림',
        korean_title: '현재 알림',
        position: { x: 8, y: 4, width: 4, height: 3 },
        config: {
          severityFilter: ['high', 'critical'],
          maxAlerts: 10
        }
      },
      {
        id: 'user-analytics',
        type: 'pie-chart',
        title: '사용자 분석',
        korean_title: '사용자 통계',
        position: { x: 0, y: 7, width: 4, height: 3 },
        config: {
          metric: 'user_sessions',
          groupBy: 'device_type'
        }
      },
      {
        id: 'service-health',
        type: 'status-grid',
        title: '서비스 상태',
        korean_title: '서비스 현황',
        position: { x: 4, y: 7, width: 4, height: 3 },
        config: {
          services: ['api-gateway', 'aiops', 'session-replay', 'nlp-search']
        }
      },
      {
        id: 'real-time-events',
        type: 'event-stream',
        title: '실시간 이벤트',
        korean_title: '실시간 활동',
        position: { x: 8, y: 7, width: 4, height: 3 },
        config: {
          maxEvents: 50,
          autoScroll: true
        }
      }
    ];

    defaultWidgets.forEach(widget => {
      this.addWidget(widget);
    });
  }

  addWidget(widgetConfig) {
    const widget = {
      ...widgetConfig,
      id: widgetConfig.id || uuidv4(),
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      data: null,
      loading: false,
      error: null
    };

    this.widgets.set(widget.id, widget);
    console.log(`📊 위젯 추가됨: ${widget.korean_title}`);

    return widget.id;
  }

  removeWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (widget) {
      this.widgets.delete(widgetId);
      this.stopRealtimeStream(widgetId);
      console.log(`🗑️ 위젯 제거됨: ${widget.korean_title}`);
      return true;
    }
    return false;
  }

  updateWidgetData(widgetId, data) {
    const widget = this.widgets.get(widgetId);
    if (widget) {
      widget.data = data;
      widget.lastUpdated = new Date().toISOString();
      widget.loading = false;
      widget.error = null;
      
      this.widgets.set(widgetId, widget);
      return true;
    }
    return false;
  }

  setWidgetError(widgetId, error) {
    const widget = this.widgets.get(widgetId);
    if (widget) {
      widget.error = error;
      widget.loading = false;
      widget.lastUpdated = new Date().toISOString();
      
      this.widgets.set(widgetId, widget);
    }
  }

  initializeChartData() {
    const chartTypes = ['line', 'bar', 'pie', 'area', 'scatter', 'heatmap'];
    
    chartTypes.forEach(type => {
      this.chartData.set(type, {
        type: type,
        datasets: [],
        options: this.getChartOptions(type),
        korean_config: this.getKoreanChartConfig(type)
      });
    });
  }

  getChartOptions(chartType) {
    const baseOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: {
              family: 'Noto Sans KR, sans-serif'
            }
          }
        },
        title: {
          display: true,
          font: {
            family: 'Noto Sans KR, sans-serif',
            size: 16,
            weight: 'bold'
          }
        }
      },
      scales: {
        x: {
          ticks: {
            font: {
              family: 'Noto Sans KR, sans-serif'
            }
          }
        },
        y: {
          ticks: {
            font: {
              family: 'Noto Sans KR, sans-serif'
            }
          }
        }
      }
    };

    switch (chartType) {
      case 'line':
        return {
          ...baseOptions,
          elements: {
            line: {
              tension: 0.4
            },
            point: {
              radius: 4,
              hoverRadius: 8
            }
          }
        };
      case 'bar':
        return {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            tooltip: {
              mode: 'index',
              intersect: false
            }
          }
        };
      case 'pie':
        return {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.formattedValue;
                  const percentage = ((context.parsed / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        };
      default:
        return baseOptions;
    }
  }

  getKoreanChartConfig(chartType) {
    const koreanLabels = {
      'line': {
        xAxisLabel: '시간',
        yAxisLabel: '값',
        tooltipPrefix: '시각: ',
        tooltipSuffix: ''
      },
      'bar': {
        xAxisLabel: '카테고리',
        yAxisLabel: '수량',
        tooltipPrefix: '',
        tooltipSuffix: '개'
      },
      'pie': {
        tooltipPrefix: '',
        tooltipSuffix: '',
        centerText: '전체'
      }
    };

    return koreanLabels[chartType] || koreanLabels['line'];
  }

  generateMetricGridData() {
    return {
      metrics: [
        {
          name: 'cpu_usage',
          korean_name: 'CPU 사용률',
          value: Math.random() * 100,
          unit: '%',
          status: this.getMetricStatus(Math.random() * 100),
          trend: this.getRandomTrend(),
          change: (Math.random() - 0.5) * 20
        },
        {
          name: 'memory_usage',
          korean_name: '메모리 사용률',
          value: Math.random() * 100,
          unit: '%',
          status: this.getMetricStatus(Math.random() * 100),
          trend: this.getRandomTrend(),
          change: (Math.random() - 0.5) * 15
        },
        {
          name: 'disk_usage',
          korean_name: '디스크 사용률',
          value: Math.random() * 100,
          unit: '%',
          status: this.getMetricStatus(Math.random() * 100),
          trend: this.getRandomTrend(),
          change: (Math.random() - 0.5) * 10
        },
        {
          name: 'network_io',
          korean_name: '네트워크 I/O',
          value: Math.random() * 1000,
          unit: 'MB/s',
          status: 'normal',
          trend: this.getRandomTrend(),
          change: (Math.random() - 0.5) * 100
        }
      ],
      timestamp: new Date().toISOString()
    };
  }

  generateTimeSeriesData(metric, timeRange) {
    const now = Date.now();
    const intervals = {
      '1h': { points: 60, interval: 60000 },
      '24h': { points: 144, interval: 600000 },
      '7d': { points: 168, interval: 3600000 },
      '30d': { points: 720, interval: 3600000 }
    };

    const config = intervals[timeRange] || intervals['24h'];
    const data = [];

    for (let i = 0; i < config.points; i++) {
      const timestamp = now - (config.points - i) * config.interval;
      let value;

      switch (metric) {
        case 'cpu_usage':
          value = Math.random() * 80 + 20;
          break;
        case 'memory_usage':
          value = Math.random() * 70 + 30;
          break;
        case 'response_time':
          value = Math.random() * 500 + 100;
          break;
        case 'throughput':
          value = Math.random() * 1000 + 500;
          break;
        case 'error_rate':
          value = Math.random() * 5;
          break;
        default:
          value = Math.random() * 100;
      }

      data.push({
        timestamp: new Date(timestamp).toISOString(),
        value: Math.round(value * 100) / 100,
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(timestamp))
      });
    }

    return data;
  }

  generateLogEntries(count = 50) {
    const logLevels = ['info', 'warning', 'error', 'debug'];
    const services = ['api-gateway', 'aiops', 'session-replay', 'nlp-search'];
    const messages = [
      'User authentication successful',
      'Database connection timeout',
      'High memory usage detected',
      'API rate limit exceeded',
      'File processing completed',
      'Invalid request parameters',
      'Service health check passed'
    ];

    const koreanMessages = [
      '사용자 인증 성공',
      '데이터베이스 연결 시간 초과',
      '높은 메모리 사용량 감지',
      'API 요청 한도 초과',
      '파일 처리 완료',
      '잘못된 요청 매개변수',
      '서비스 상태 확인 통과'
    ];

    const logs = [];

    for (let i = 0; i < count; i++) {
      const level = logLevels[Math.floor(Math.random() * logLevels.length)];
      const messageIndex = Math.floor(Math.random() * messages.length);
      
      logs.push({
        id: uuidv4(),
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        level: level,
        service: services[Math.floor(Math.random() * services.length)],
        message: messages[messageIndex],
        korean_message: koreanMessages[messageIndex],
        trace_id: uuidv4().substring(0, 16),
        span_id: uuidv4().substring(0, 8),
        user_id: `user_${Math.floor(Math.random() * 1000)}`,
        request_id: uuidv4()
      });
    }

    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  generateAlertList(maxAlerts = 10) {
    const alertTypes = [
      'high_cpu', 'high_memory', 'disk_full', 'service_down',
      'high_error_rate', 'slow_response', 'security_threat'
    ];

    const koreanAlertTypes = {
      'high_cpu': 'CPU 사용률 높음',
      'high_memory': '메모리 사용률 높음',
      'disk_full': '디스크 용량 부족',
      'service_down': '서비스 장애',
      'high_error_rate': '오류율 증가',
      'slow_response': '응답시간 지연',
      'security_threat': '보안 위협'
    };

    const severityLevels = ['low', 'medium', 'high', 'critical'];
    const services = ['api-gateway', 'aiops', 'session-replay', 'nlp-search'];

    const alerts = [];

    for (let i = 0; i < maxAlerts; i++) {
      const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const severity = severityLevels[Math.floor(Math.random() * severityLevels.length)];

      alerts.push({
        id: uuidv4(),
        type: alertType,
        korean_type: koreanAlertTypes[alertType],
        severity: severity,
        korean_severity: this.getKoreanSeverity(severity),
        service: services[Math.floor(Math.random() * services.length)],
        message: `${alertType} detected in ${services[Math.floor(Math.random() * services.length)]}`,
        korean_message: `${koreanAlertTypes[alertType]} 감지됨`,
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        status: Math.random() > 0.3 ? 'active' : 'acknowledged',
        value: Math.random() * 100,
        threshold: Math.random() * 80 + 20
      });
    }

    return alerts.sort((a, b) => {
      const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  generateServiceHealthData() {
    const services = [
      'api-gateway', 'aiops', 'session-replay', 'nlp-search', 
      'event-delta-analyzer', 'clickhouse', 'kafka', 'redis'
    ];

    const koreanServiceNames = {
      'api-gateway': 'API 게이트웨이',
      'aiops': 'AIOps 엔진',
      'session-replay': '세션 리플레이',
      'nlp-search': 'NLP 검색',
      'event-delta-analyzer': '이벤트 분석기',
      'clickhouse': 'ClickHouse',
      'kafka': 'Kafka',
      'redis': 'Redis'
    };

    return services.map(service => {
      const isHealthy = Math.random() > 0.1; // 90% 정상 확률
      const responseTime = Math.random() * 1000 + 100;
      
      return {
        name: service,
        korean_name: koreanServiceNames[service],
        status: isHealthy ? 'healthy' : 'unhealthy',
        korean_status: isHealthy ? '정상' : '비정상',
        response_time: Math.round(responseTime),
        uptime: Math.random() * 100,
        version: `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
        last_check: new Date().toISOString(),
        endpoint: `http://${service}:${3000 + Math.floor(Math.random() * 10)}/health`
      };
    });
  }

  generateRealtimeEventStream(count = 20) {
    const eventTypes = ['user_action', 'system_event', 'error_event', 'performance_event'];
    const koreanEventTypes = {
      'user_action': '사용자 액션',
      'system_event': '시스템 이벤트',
      'error_event': '오류 이벤트',
      'performance_event': '성능 이벤트'
    };

    const events = [];

    for (let i = 0; i < count; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      
      events.push({
        id: uuidv4(),
        type: eventType,
        korean_type: koreanEventTypes[eventType],
        timestamp: new Date(Date.now() - Math.random() * 300000).toISOString(), // 지난 5분 내
        user_id: `user_${Math.floor(Math.random() * 1000)}`,
        session_id: uuidv4(),
        message: this.generateEventMessage(eventType),
        korean_message: this.generateKoreanEventMessage(eventType),
        severity: this.getRandomSeverity(),
        source: 'dashboard-simulator'
      });
    }

    return events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  generateEventMessage(eventType) {
    const messages = {
      'user_action': 'User clicked on analytics dashboard',
      'system_event': 'Service restarted successfully',
      'error_event': 'Database connection failed',
      'performance_event': 'Response time exceeded threshold'
    };
    return messages[eventType] || 'Event occurred';
  }

  generateKoreanEventMessage(eventType) {
    const messages = {
      'user_action': '사용자가 분석 대시보드를 클릭했습니다',
      'system_event': '서비스가 성공적으로 재시작되었습니다',
      'error_event': '데이터베이스 연결에 실패했습니다',
      'performance_event': '응답시간이 임계값을 초과했습니다'
    };
    return messages[eventType] || '이벤트가 발생했습니다';
  }

  getMetricStatus(value) {
    if (value > 90) return 'critical';
    if (value > 80) return 'warning';
    if (value > 70) return 'caution';
    return 'normal';
  }

  getKoreanSeverity(severity) {
    const severities = {
      'low': '낮음',
      'medium': '보통',
      'high': '높음',
      'critical': '심각'
    };
    return severities[severity] || severity;
  }

  getRandomTrend() {
    const trends = ['up', 'down', 'stable'];
    return trends[Math.floor(Math.random() * trends.length)];
  }

  getRandomSeverity() {
    const severities = ['info', 'warning', 'error'];
    return severities[Math.floor(Math.random() * severities.length)];
  }

  startRealtimeStream(widgetId, interval = 5000) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return false;

    const streamId = setInterval(() => {
      let newData;

      switch (widget.type) {
        case 'metric-grid':
          newData = this.generateMetricGridData();
          break;
        case 'line-chart':
          newData = this.generateTimeSeriesData('cpu_usage', '1h');
          break;
        case 'log-viewer':
          newData = this.generateLogEntries(10);
          break;
        case 'alert-list':
          newData = this.generateAlertList(widget.config.maxAlerts);
          break;
        case 'status-grid':
          newData = this.generateServiceHealthData();
          break;
        case 'event-stream':
          newData = this.generateRealtimeEventStream(5);
          break;
        default:
          newData = { timestamp: new Date().toISOString() };
      }

      this.updateWidgetData(widgetId, newData);
    }, interval);

    this.realtimeStreams.set(widgetId, streamId);
    console.log(`🔄 실시간 스트림 시작: ${widget.korean_title}`);
    
    return true;
  }

  stopRealtimeStream(widgetId) {
    const streamId = this.realtimeStreams.get(widgetId);
    if (streamId) {
      clearInterval(streamId);
      this.realtimeStreams.delete(widgetId);
      
      const widget = this.widgets.get(widgetId);
      if (widget) {
        console.log(`⏹️ 실시간 스트림 중지: ${widget.korean_title}`);
      }
      
      return true;
    }
    return false;
  }

  applyThemeConfiguration() {
    const themeConfigs = {
      'korean-hyperdx': {
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
        backgroundColor: '#f8fafc',
        cardColor: '#ffffff',
        textColor: '#1f2937',
        borderColor: '#e5e7eb',
        fontFamily: 'Noto Sans KR, -apple-system, BlinkMacSystemFont, sans-serif',
        borderRadius: '8px',
        shadows: {
          card: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          hover: '0 10px 25px rgba(0, 0, 0, 0.15)'
        }
      }
    };

    const config = themeConfigs[this.themeConfig];
    if (config) {
      console.log(`🎨 테마 적용: ${this.themeConfig}`);
      return config;
    }

    return themeConfigs['korean-hyperdx'];
  }

  exportDashboardConfig() {
    const config = {
      version: '1.0.0',
      theme: this.themeConfig,
      widgets: Array.from(this.widgets.values()).map(widget => ({
        id: widget.id,
        type: widget.type,
        title: widget.title,
        korean_title: widget.korean_title,
        position: widget.position,
        config: widget.config
      })),
      createdAt: new Date().toISOString()
    };

    return JSON.stringify(config, null, 2);
  }

  importDashboardConfig(configJson) {
    try {
      const config = JSON.parse(configJson);
      
      // 기존 위젯 정리
      this.widgets.clear();
      this.realtimeStreams.forEach(streamId => clearInterval(streamId));
      this.realtimeStreams.clear();

      // 새 위젯 추가
      config.widgets.forEach(widgetConfig => {
        this.addWidget(widgetConfig);
      });

      // 테마 적용
      if (config.theme) {
        this.themeConfig = config.theme;
        this.applyThemeConfiguration();
      }

      console.log(`✅ 대시보드 설정 가져오기 완료: ${config.widgets.length}개 위젯`);
      return true;

    } catch (error) {
      console.error(`❌ 대시보드 설정 가져오기 실패: ${error.message}`);
      return false;
    }
  }

  getStatistics() {
    return {
      totalWidgets: this.widgets.size,
      activeStreams: this.realtimeStreams.size,
      theme: this.themeConfig,
      widgetTypes: Array.from(this.widgets.values()).reduce((types, widget) => {
        types[widget.type] = (types[widget.type] || 0) + 1;
        return types;
      }, {}),
      timestamp: new Date().toISOString()
    };
  }

  cleanup() {
    // 모든 실시간 스트림 중지
    this.realtimeStreams.forEach(streamId => clearInterval(streamId));
    this.realtimeStreams.clear();

    // 데이터 정리
    this.widgets.clear();
    this.chartData.clear();
    this.alertNotifications = [];

    console.log('🧹 대시보드 UI 정리 완료');
  }
}

module.exports = DashboardUI;