/**
 * 세션 리플레이 데이터 생성기 - 실제 사용자 시나리오 기반 데이터 생성
 */

const { v4: uuidv4 } = require('uuid');
const { faker } = require('@faker-js/faker');

class SessionReplayDataGenerator {
  constructor() {
    this.scenarios = {
      'bug_payment': this.generateBugScenarioData,
      'ux_navigation': this.generateUXScenarioData, 
      'security_attack': this.generateSecurityScenarioData,
      'performance_slow': this.generatePerformanceScenarioData
    };
  }

  // 1. 버그 재현 시나리오 데이터
  generateBugScenarioData() {
    const sessionId = uuidv4();
    const userId = `user_${Math.floor(Math.random() * 10000)}`;
    const startTime = new Date();
    
    const events = [
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 1000).toISOString(),
        event_type: 'page_load',
        page_url: '/checkout',
        page_title: '결제 페이지',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: { width: 1920, height: 1080 },
        load_time: 2300
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 15000).toISOString(),
        event_type: 'form_input',
        element_id: 'cardNumber',
        element_type: 'input',
        value_masked: '****-****-****-1234',
        x: 450,
        y: 320
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 25000).toISOString(),
        event_type: 'form_input',
        element_id: 'expiry',
        element_type: 'input',
        value_masked: '12/25',
        x: 600,
        y: 320
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 32000).toISOString(),
        event_type: 'form_input',
        element_id: 'cvv',
        element_type: 'input', 
        value_masked: '***',
        x: 750,
        y: 320
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 45000).toISOString(),
        event_type: 'click',
        element_id: 'paymentButton',
        element_type: 'button',
        element_text: '결제하기',
        x: 550,
        y: 420,
        button: 'left'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 45100).toISOString(),
        event_type: 'javascript_error',
        error_message: 'Cannot read property validate of undefined',
        error_stack: 'at PaymentValidator.validate (payment.js:245:12)',
        error_line: 245,
        error_file: '/static/js/payment.js'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 50000).toISOString(),
        event_type: 'click',
        element_id: 'paymentButton', 
        element_type: 'button',
        element_text: '결제하기',
        x: 550,
        y: 420,
        button: 'left',
        notes: '두 번째 클릭 시도'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 55000).toISOString(),
        event_type: 'click',
        element_id: 'paymentButton',
        element_type: 'button', 
        element_text: '결제하기',
        x: 550,
        y: 420,
        button: 'left',
        notes: '세 번째 클릭 시도'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 65000).toISOString(),
        event_type: 'page_unload',
        page_url: '/checkout',
        reason: 'user_frustration',
        session_duration: 65000
      }
    ];

    const sessionSummary = {
      session_id: sessionId,
      user_id: userId,
      scenario: 'payment_bug_reproduction',
      start_time: startTime.toISOString(),
      end_time: new Date(startTime.getTime() + 65000).toISOString(),
      duration: 65000,
      page_views: [
        {
          url: '/checkout',
          title: '결제 페이지',
          duration: 65000,
          events_count: events.length
        }
      ],
      user_actions: [
        { type: 'form_fill', count: 3, success: true },
        { type: 'button_click', count: 3, success: false },
        { type: 'page_exit', count: 1, reason: 'frustration' }
      ],
      errors: [
        {
          type: 'javascript_error',
          message: 'Payment validation failed',
          file: 'payment.js',
          line: 245,
          impact: 'payment_failure'
        }
      ],
      conversion_funnel: {
        page_loaded: true,
        form_started: true,
        form_completed: true,
        payment_attempted: true,
        payment_completed: false,
        exit_reason: 'technical_error'
      },
      device_info: {
        type: 'desktop',
        os: 'Windows 10',
        browser: 'Chrome',
        version: '91.0.4472.124',
        screen_resolution: '1920x1080'
      },
      quality_metrics: {
        recording_quality: 98.5,
        fps: 30,
        compression_ratio: 0.72,
        data_integrity: true
      }
    };

    return { events, sessionSummary };
  }

  // 2. UX/UI 개선 시나리오 데이터
  generateUXScenarioData() {
    const sessionId = uuidv4();
    const userId = `user_${Math.floor(Math.random() * 10000)}`;
    const startTime = new Date();

    const events = [
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 1000).toISOString(),
        event_type: 'page_load',
        page_url: '/products',
        page_title: '상품 목록',
        load_time: 1800
      },
      // 사용자가 헤매는 패턴 - 여러 메뉴 클릭
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 5000).toISOString(),
        event_type: 'click',
        element_id: 'nav-categories',
        element_text: '카테고리',
        x: 200, y: 100,
        user_intent: 'find_specific_product'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 8000).toISOString(),
        event_type: 'click',
        element_id: 'nav-brands',
        element_text: '브랜드',
        x: 300, y: 100,
        user_intent: 'find_specific_product'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 12000).toISOString(),
        event_type: 'click',
        element_id: 'nav-deals',
        element_text: '특가',
        x: 400, y: 100,
        user_intent: 'find_specific_product'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 15000).toISOString(),
        event_type: 'click',
        element_id: 'nav-products',
        element_text: '상품',
        x: 150, y: 100,
        user_intent: 'find_specific_product'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 20000).toISOString(),
        event_type: 'scroll',
        direction: 'down',
        scroll_depth: 45,
        page_height: 2000
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 25000).toISOString(),
        event_type: 'click',
        element_id: 'nav-support',
        element_text: '고객지원',
        x: 500, y: 100,
        user_intent: 'find_help'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 28000).toISOString(),
        event_type: 'click',
        element_id: 'nav-account',
        element_text: '내 계정',
        x: 600, y: 100,
        user_intent: 'find_specific_product'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 35000).toISOString(),
        event_type: 'page_unload',
        page_url: '/products',
        reason: 'user_confusion',
        session_duration: 35000
      }
    ];

    const sessionSummary = {
      session_id: sessionId,
      user_id: userId,
      scenario: 'ux_navigation_confusion',
      start_time: startTime.toISOString(),
      end_time: new Date(startTime.getTime() + 35000).toISOString(),
      duration: 35000,
      navigation_pattern: {
        total_clicks: 7,
        unique_menu_items: 7,
        back_and_forth: 2,
        goal_achievement: false,
        confusion_indicators: ['multiple_menu_clicks', 'no_final_action', 'quick_exit']
      },
      user_journey: [
        { step: 1, action: 'land_on_products', success: true },
        { step: 2, action: 'explore_categories', success: false },
        { step: 3, action: 'try_brands', success: false },
        { step: 4, action: 'check_deals', success: false },
        { step: 5, action: 'return_to_products', success: false },
        { step: 6, action: 'seek_help', success: false },
        { step: 7, action: 'check_account', success: false },
        { step: 8, action: 'exit', success: false }
      ],
      ux_metrics: {
        click_efficiency: 0.14, // 1/7 clicks were productive
        time_to_confusion: 8000, // 8 seconds
        bounce_probability: 0.85,
        satisfaction_score: 2.1, // out of 10
        navigation_clarity: 'poor'
      },
      improvement_suggestions: [
        'Group related menu items together',
        'Add search functionality prominence',
        'Implement breadcrumb navigation',
        'Add contextual help hints'
      ]
    };

    return { events, sessionSummary };
  }

  // 3. 보안 사고 분석 시나리오 데이터
  generateSecurityScenarioData() {
    const sessionId = uuidv4();
    const attackerIP = '192.168.1.100';
    const startTime = new Date();

    const events = [];
    const commonPasswords = ['123456', 'password', 'admin', '123456789', 'qwerty', 'password123', 'admin123', '12345678', '123456789', 'welcome'];
    const usernames = ['admin', 'root', 'user', 'test', 'administrator'];

    // 무차별 대입 공격 시뮬레이션
    for (let i = 0; i < 20; i++) {
      const attemptTime = new Date(startTime.getTime() + (i * 2000));
      
      events.push({
        id: uuidv4(),
        session_id: sessionId,
        timestamp: attemptTime.toISOString(),
        event_type: 'login_attempt',
        username: usernames[Math.floor(Math.random() * usernames.length)],
        password_hash: '[MASKED]',
        ip_address: attackerIP,
        user_agent: 'python-requests/2.25.1',
        attempt_number: i + 1,
        success: false,
        failure_reason: 'invalid_credentials',
        response_time: Math.floor(Math.random() * 500) + 200,
        security_flags: {
          automated_behavior: true,
          suspicious_user_agent: true,
          high_frequency: true,
          geo_location_mismatch: true
        }
      });

      // 3회마다 다른 IP에서 시도 (분산 공격)
      if (i % 3 === 0 && i > 0) {
        events.push({
          id: uuidv4(),
          session_id: sessionId,
          timestamp: new Date(attemptTime.getTime() + 500).toISOString(),
          event_type: 'ip_change',
          old_ip: attackerIP,
          new_ip: `192.168.1.${100 + Math.floor(Math.random() * 50)}`,
          change_reason: 'evasion_attempt'
        });
      }
    }

    // 계정 잠금 이벤트
    events.push({
      id: uuidv4(),
      session_id: sessionId,
      timestamp: new Date(startTime.getTime() + 42000).toISOString(),
      event_type: 'account_lockout',
      username: 'admin',
      lockout_reason: 'excessive_failed_attempts',
      attempts_count: 10,
      lockout_duration: 3600, // 1시간
      automatic_action: true
    });

    const sessionSummary = {
      session_id: sessionId,
      scenario: 'brute_force_attack',
      attack_type: 'credential_brute_force',
      start_time: startTime.toISOString(),
      end_time: new Date(startTime.getTime() + 42000).toISOString(),
      duration: 42000,
      attack_metrics: {
        total_attempts: 20,
        success_rate: 0,
        average_attempt_interval: 2000, // 2초
        unique_ips: 7,
        unique_usernames: usernames.length,
        unique_passwords: commonPasswords.length,
        detection_time: 20000, // 20초 후 탐지
        mitigation_time: 22000 // 22초 후 차단
      },
      attack_pattern: {
        method: 'dictionary_attack',
        tools_detected: ['automated_script', 'proxy_rotation'],
        evasion_techniques: ['ip_rotation', 'user_agent_spoofing'],
        target_accounts: ['admin', 'root'],
        success_probability: 0.001
      },
      security_response: {
        detection_triggered: true,
        automatic_blocking: true,
        alert_sent: true,
        incident_created: true,
        response_time: 2000,
        mitigation_effectiveness: 100
      },
      threat_intelligence: {
        ip_reputation: 'malicious',
        geo_location: 'Unknown/VPN',
        attack_source: 'botnet',
        severity: 'high',
        confidence: 0.95
      }
    };

    return { events, sessionSummary };
  }

  // 4. 성능 문제 진단 시나리오 데이터
  generatePerformanceScenarioData() {
    const sessionId = uuidv4();
    const userId = `user_${Math.floor(Math.random() * 10000)}`;
    const startTime = new Date();

    const events = [
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 1000).toISOString(),
        event_type: 'page_load_start',
        page_url: '/dashboard',
        page_title: '대시보드',
        navigation_type: 'navigate'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 8500).toISOString(),
        event_type: 'page_load_complete',
        page_url: '/dashboard',
        total_load_time: 7500,
        dom_ready_time: 3200,
        first_paint: 2800,
        first_contentful_paint: 4100,
        largest_contentful_paint: 6800,
        cumulative_layout_shift: 0.15,
        first_input_delay: 250
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 15000).toISOString(),
        event_type: 'api_request',
        endpoint: '/api/dashboard/sales-data',
        method: 'GET',
        response_time: 5200,
        status_code: 200,
        payload_size: 2048576, // 2MB
        slow_query: true
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 18000).toISOString(),
        event_type: 'click',
        element_id: 'sales-chart',
        element_text: '매출 차트',
        x: 300, y: 200,
        expected_response_time: 500,
        actual_response_time: 3200
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 21200).toISOString(),
        event_type: 'chart_render_start',
        chart_type: 'sales_chart',
        data_points: 10000,
        chart_complexity: 'high'
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 26400).toISOString(),
        event_type: 'chart_render_complete',
        chart_type: 'sales_chart',
        render_time: 5200,
        memory_usage: 156 * 1024 * 1024, // 156MB
        cpu_usage: 0.89
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 30000).toISOString(),
        event_type: 'user_frustration',
        indicator: 'rapid_clicking',
        element_id: 'users-chart',
        click_count: 5,
        time_span: 2000
      },
      {
        id: uuidv4(),
        session_id: sessionId,
        timestamp: new Date(startTime.getTime() + 35000).toISOString(),
        event_type: 'page_unload',
        page_url: '/dashboard',
        reason: 'performance_timeout',
        session_duration: 35000,
        incomplete_actions: ['users_chart', 'performance_metrics', 'traffic_analysis']
      }
    ];

    const sessionSummary = {
      session_id: sessionId,
      user_id: userId,
      scenario: 'performance_degradation',
      start_time: startTime.toISOString(),
      end_time: new Date(startTime.getTime() + 35000).toISOString(),
      duration: 35000,
      performance_metrics: {
        page_load_time: 7500,
        total_blocking_time: 3200,
        api_response_times: {
          avg: 5200,
          p95: 8900,
          p99: 12000
        },
        chart_render_times: {
          sales_chart: 5200,
          users_chart: 'timeout',
          performance_chart: 'not_loaded'
        },
        resource_usage: {
          memory_peak: 156 * 1024 * 1024,
          cpu_peak: 0.89,
          network_usage: 2.1 * 1024 * 1024 // 2.1MB
        }
      },
      bottlenecks: [
        {
          type: 'database_query',
          location: '/api/dashboard/sales-data',
          impact: 'high',
          duration: 5200,
          recommendation: 'Add database indexing'
        },
        {
          type: 'frontend_rendering',
          location: 'sales-chart component',
          impact: 'high', 
          duration: 5200,
          recommendation: 'Implement virtualization'
        },
        {
          type: 'memory_usage',
          location: 'chart rendering',
          impact: 'medium',
          value: '156MB',
          recommendation: 'Optimize data structures'
        }
      ],
      user_experience: {
        satisfaction_score: 2.5, // out of 10
        task_completion_rate: 0.3, // 30%
        abandonment_point: 'chart_loading',
        frustration_indicators: ['rapid_clicking', 'early_exit'],
        tolerance_exceeded: true
      },
      optimization_suggestions: [
        'Implement database query caching',
        'Add progressive loading for charts', 
        'Optimize bundle size',
        'Implement lazy loading',
        'Add loading skeletons',
        'Compress API responses'
      ]
    };

    return { events, sessionSummary };
  }

  // 모든 시나리오의 샘플 데이터 생성
  generateAllScenarios() {
    const allData = {
      bug_scenarios: [],
      ux_scenarios: [],
      security_scenarios: [],
      performance_scenarios: []
    };

    // 각 시나리오별로 5개씩 생성
    for (let i = 0; i < 5; i++) {
      allData.bug_scenarios.push(this.generateBugScenarioData());
      allData.ux_scenarios.push(this.generateUXScenarioData());
      allData.security_scenarios.push(this.generateSecurityScenarioData());
      allData.performance_scenarios.push(this.generatePerformanceScenarioData());
    }

    return allData;
  }

  // ClickHouse에 저장할 수 있는 형태로 데이터 변환
  formatForClickHouse(allData) {
    const clickHouseData = {
      session_events: [],
      session_summaries: [],
      security_incidents: [],
      performance_metrics: [],
      user_interactions: []
    };

    // 모든 시나리오 데이터를 ClickHouse 형태로 변환
    Object.values(allData).flat().forEach(scenarioData => {
      const { events, sessionSummary } = scenarioData;
      
      // 이벤트 데이터
      events.forEach(event => {
        clickHouseData.session_events.push({
          id: event.id,
          session_id: event.session_id,
          timestamp: event.timestamp,
          event_type: event.event_type,
          page_url: event.page_url || null,
          element_id: event.element_id || null,
          element_type: event.element_type || null,
          x_coordinate: event.x || null,
          y_coordinate: event.y || null,
          value_masked: event.value_masked || null,
          error_message: event.error_message || null,
          response_time: event.response_time || null,
          ip_address: event.ip_address || null,
          user_agent: event.user_agent || null,
          metadata: JSON.stringify(event)
        });
      });

      // 세션 요약 데이터
      clickHouseData.session_summaries.push({
        session_id: sessionSummary.session_id,
        user_id: sessionSummary.user_id,
        scenario: sessionSummary.scenario,
        start_time: sessionSummary.start_time,
        end_time: sessionSummary.end_time,
        duration: sessionSummary.duration,
        page_views_count: sessionSummary.page_views ? sessionSummary.page_views.length : 0,
        user_actions_count: events.length,
        errors_count: events.filter(e => e.event_type.includes('error')).length,
        conversion_completed: sessionSummary.conversion_funnel ? sessionSummary.conversion_funnel.payment_completed || false : false,
        device_type: sessionSummary.device_info ? sessionSummary.device_info.type : 'unknown',
        os: sessionSummary.device_info ? sessionSummary.device_info.os : 'unknown',
        browser: sessionSummary.device_info ? sessionSummary.device_info.browser : 'unknown',
        quality_score: sessionSummary.quality_metrics ? sessionSummary.quality_metrics.recording_quality : 0,
        metadata: JSON.stringify(sessionSummary)
      });

      // 보안 인시던트 데이터
      if (sessionSummary.scenario.includes('security') || sessionSummary.scenario.includes('attack')) {
        clickHouseData.security_incidents.push({
          incident_id: uuidv4(),
          session_id: sessionSummary.session_id,
          incident_type: sessionSummary.attack_type || 'unknown',
          severity: sessionSummary.threat_intelligence ? sessionSummary.threat_intelligence.severity : 'medium',
          source_ip: events.find(e => e.ip_address)?.ip_address || 'unknown',
          attack_attempts: sessionSummary.attack_metrics ? sessionSummary.attack_metrics.total_attempts : 0,
          detection_time: sessionSummary.attack_metrics ? sessionSummary.attack_metrics.detection_time : 0,
          mitigation_time: sessionSummary.attack_metrics ? sessionSummary.attack_metrics.mitigation_time : 0,
          blocked: sessionSummary.security_response ? sessionSummary.security_response.automatic_blocking : false,
          timestamp: sessionSummary.start_time,
          metadata: JSON.stringify(sessionSummary)
        });
      }

      // 성능 메트릭 데이터
      if (sessionSummary.scenario.includes('performance')) {
        clickHouseData.performance_metrics.push({
          metric_id: uuidv4(),
          session_id: sessionSummary.session_id,
          page_url: events[0]?.page_url || '',
          load_time: sessionSummary.performance_metrics?.page_load_time || 0,
          first_paint: events.find(e => e.first_paint)?.first_paint || 0,
          largest_contentful_paint: events.find(e => e.largest_contentful_paint)?.largest_contentful_paint || 0,
          cumulative_layout_shift: events.find(e => e.cumulative_layout_shift)?.cumulative_layout_shift || 0,
          memory_usage: sessionSummary.performance_metrics?.resource_usage?.memory_peak || 0,
          cpu_usage: sessionSummary.performance_metrics?.resource_usage?.cpu_peak || 0,
          api_response_time: sessionSummary.performance_metrics?.api_response_times?.avg || 0,
          user_satisfaction: sessionSummary.user_experience?.satisfaction_score || 0,
          timestamp: sessionSummary.start_time,
          metadata: JSON.stringify(sessionSummary)
        });
      }
    });

    return clickHouseData;
  }
}

module.exports = SessionReplayDataGenerator;