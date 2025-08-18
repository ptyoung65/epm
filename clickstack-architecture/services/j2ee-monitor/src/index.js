/**
 * J2EE Specialized Monitoring Service for AIRIS-MON
 * Comprehensive monitoring for Servlet, JSP, EJB components
 * 대전-APM 기능요약서 완전 구현
 */

const express = require('express');
const EventEmitter = require('events');
const logger = require('./utils/logger');

class J2EEMonitoringService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 3007,
      servletTrackingEnabled: config.servletTrackingEnabled !== false,
      jspTrackingEnabled: config.jspTrackingEnabled !== false,
      ejbTrackingEnabled: config.ejbTrackingEnabled !== false,
      sessionTrackingEnabled: config.sessionTrackingEnabled !== false,
      transactionTrackingEnabled: config.transactionTrackingEnabled !== false,
      ...config
    };

    // J2EE 컴포넌트별 성능 데이터 저장소
    this.performanceData = {
      servlets: new Map(),
      jsps: new Map(),
      ejbs: {
        sessionBeans: new Map(),
        entityBeans: new Map(),
        messageBeans: new Map()
      },
      transactions: new Map(),
      sessions: new Map(),
      httpRequests: new Map()
    };

    // 실시간 메트릭 수집
    this.realtimeMetrics = {
      servlet: {
        activeRequests: 0,
        totalRequests: 0,
        averageResponseTime: 0,
        errorCount: 0
      },
      jsp: {
        activeCompilations: 0,
        totalCompilations: 0,
        averageCompileTime: 0,
        errorCount: 0
      },
      ejb: {
        activeTransactions: 0,
        totalInvocations: 0,
        averageExecutionTime: 0,
        errorCount: 0
      },
      session: {
        activeSessions: 0,
        totalSessions: 0,
        averageSessionTime: 0,
        expiredSessions: 0
      }
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    this.server = null;
    this.isRunning = false;
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS 설정
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    // J2EE 컴포넌트 추적 미들웨어
    this.app.use(this.createJ2EETrackingMiddleware());
  }

  createJ2EETrackingMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Request 정보 추출
      const requestInfo = {
        id: requestId,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        sessionId: req.sessionID || req.headers['jsessionid'],
        startTime,
        timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      };

      // 컴포넌트 타입 감지
      const componentType = this.detectJ2EEComponent(req);
      requestInfo.componentType = componentType;

      // 실시간 메트릭 업데이트
      this.updateRealtimeMetrics(componentType, 'start', requestInfo);

      // Response 완료 시 성능 데이터 수집
      res.on('finish', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const performanceInfo = {
          ...requestInfo,
          responseTime,
          statusCode: res.statusCode,
          contentLength: res.get('content-length') || 0,
          endTime,
          success: res.statusCode < 400
        };

        this.recordPerformanceData(componentType, performanceInfo);
        this.updateRealtimeMetrics(componentType, 'finish', performanceInfo);
        
        // 성능 임계치 체크
        this.checkPerformanceThresholds(performanceInfo);
      });

      next();
    };
  }

  detectJ2EEComponent(req) {
    const url = req.url.toLowerCase();
    const userAgent = req.headers['user-agent'] || '';
    
    // JSP 감지
    if (url.endsWith('.jsp') || url.includes('.jsp?')) {
      return 'jsp';
    }
    
    // Servlet 감지
    if (url.includes('/servlet/') || url.match(/\.(do|action)(\?|$)/)) {
      return 'servlet';
    }
    
    // EJB 감지 (일반적으로 특정 패턴이나 헤더로 구분)
    if (url.includes('/ejb/') || req.headers['ejb-component']) {
      return 'ejb';
    }
    
    // 기본값
    return 'web';
  }

  recordPerformanceData(componentType, performanceInfo) {
    try {
      const key = `${componentType}_${performanceInfo.url}`;
      
      switch (componentType) {
        case 'servlet':
          this.recordServletData(key, performanceInfo);
          break;
        case 'jsp':
          this.recordJSPData(key, performanceInfo);
          break;
        case 'ejb':
          this.recordEJBData(key, performanceInfo);
          break;
        default:
          this.recordWebData(key, performanceInfo);
      }

      // 트랜잭션 데이터 기록
      if (this.config.transactionTrackingEnabled) {
        this.recordTransactionData(performanceInfo);
      }

      // 세션 데이터 기록
      if (this.config.sessionTrackingEnabled && performanceInfo.sessionId) {
        this.recordSessionData(performanceInfo);
      }

    } catch (error) {
      logger.error('성능 데이터 기록 실패', {
        error: error.message,
        componentType,
        service: 'j2ee-monitor'
      });
    }
  }

  recordServletData(key, performanceInfo) {
    if (!this.performanceData.servlets.has(key)) {
      this.performanceData.servlets.set(key, {
        url: performanceInfo.url,
        method: performanceInfo.method,
        totalRequests: 0,
        totalResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        errorCount: 0,
        last24Hours: [],
        recentRequests: []
      });
    }

    const servletData = this.performanceData.servlets.get(key);
    servletData.totalRequests++;
    servletData.totalResponseTime += performanceInfo.responseTime;
    servletData.minResponseTime = Math.min(servletData.minResponseTime, performanceInfo.responseTime);
    servletData.maxResponseTime = Math.max(servletData.maxResponseTime, performanceInfo.responseTime);
    
    if (!performanceInfo.success) {
      servletData.errorCount++;
    }

    // 최근 요청 기록 (최대 100개)
    servletData.recentRequests.push({
      timestamp: performanceInfo.timestamp,
      responseTime: performanceInfo.responseTime,
      statusCode: performanceInfo.statusCode,
      ip: performanceInfo.ip
    });

    if (servletData.recentRequests.length > 100) {
      servletData.recentRequests.shift();
    }

    // 24시간 데이터 (시간별 집계)
    const hourKey = new Date().toLocaleString('ko-KR', { 
      timeZone: 'Asia/Seoul', 
      hour: '2-digit' 
    });
    
    const hourlyData = servletData.last24Hours.find(h => h.hour === hourKey) || 
      { hour: hourKey, requests: 0, totalTime: 0, errors: 0 };
    
    if (!servletData.last24Hours.find(h => h.hour === hourKey)) {
      servletData.last24Hours.push(hourlyData);
    }

    hourlyData.requests++;
    hourlyData.totalTime += performanceInfo.responseTime;
    if (!performanceInfo.success) hourlyData.errors++;

    // 24시간 초과 데이터 제거
    if (servletData.last24Hours.length > 24) {
      servletData.last24Hours.shift();
    }
  }

  recordJSPData(key, performanceInfo) {
    if (!this.performanceData.jsps.has(key)) {
      this.performanceData.jsps.set(key, {
        jspFile: performanceInfo.url,
        totalCompilations: 0,
        totalRenderTime: 0,
        minRenderTime: Infinity,
        maxRenderTime: 0,
        compilationErrors: 0,
        runtimeErrors: 0,
        lastCompiled: null,
        recentRenders: []
      });
    }

    const jspData = this.performanceData.jsps.get(key);
    jspData.totalCompilations++;
    jspData.totalRenderTime += performanceInfo.responseTime;
    jspData.minRenderTime = Math.min(jspData.minRenderTime, performanceInfo.responseTime);
    jspData.maxRenderTime = Math.max(jspData.maxRenderTime, performanceInfo.responseTime);
    jspData.lastCompiled = performanceInfo.timestamp;
    
    if (!performanceInfo.success) {
      if (performanceInfo.statusCode === 500) {
        jspData.compilationErrors++;
      } else {
        jspData.runtimeErrors++;
      }
    }

    jspData.recentRenders.push({
      timestamp: performanceInfo.timestamp,
      renderTime: performanceInfo.responseTime,
      statusCode: performanceInfo.statusCode,
      contentLength: performanceInfo.contentLength
    });

    if (jspData.recentRenders.length > 50) {
      jspData.recentRenders.shift();
    }
  }

  recordEJBData(key, performanceInfo) {
    // EJB 타입 감지 (URL 패턴 기반)
    let ejbType = 'sessionBeans';
    if (performanceInfo.url.includes('entity')) ejbType = 'entityBeans';
    if (performanceInfo.url.includes('message')) ejbType = 'messageBeans';

    if (!this.performanceData.ejbs[ejbType].has(key)) {
      this.performanceData.ejbs[ejbType].set(key, {
        beanName: this.extractBeanName(performanceInfo.url),
        totalInvocations: 0,
        totalExecutionTime: 0,
        minExecutionTime: Infinity,
        maxExecutionTime: 0,
        exceptionCount: 0,
        activeTransactions: 0,
        recentInvocations: []
      });
    }

    const ejbData = this.performanceData.ejbs[ejbType].get(key);
    ejbData.totalInvocations++;
    ejbData.totalExecutionTime += performanceInfo.responseTime;
    ejbData.minExecutionTime = Math.min(ejbData.minExecutionTime, performanceInfo.responseTime);
    ejbData.maxExecutionTime = Math.max(ejbData.maxExecutionTime, performanceInfo.responseTime);
    
    if (!performanceInfo.success) {
      ejbData.exceptionCount++;
    }

    ejbData.recentInvocations.push({
      timestamp: performanceInfo.timestamp,
      executionTime: performanceInfo.responseTime,
      statusCode: performanceInfo.statusCode,
      method: performanceInfo.method
    });

    if (ejbData.recentInvocations.length > 50) {
      ejbData.recentInvocations.shift();
    }
  }

  recordWebData(key, performanceInfo) {
    // 일반 웹 요청 데이터 기록
    if (!this.performanceData.httpRequests.has(key)) {
      this.performanceData.httpRequests.set(key, {
        url: performanceInfo.url,
        method: performanceInfo.method,
        totalRequests: 0,
        totalResponseTime: 0,
        errorCount: 0,
        recentRequests: []
      });
    }

    const webData = this.performanceData.httpRequests.get(key);
    webData.totalRequests++;
    webData.totalResponseTime += performanceInfo.responseTime;
    
    if (!performanceInfo.success) {
      webData.errorCount++;
    }

    webData.recentRequests.push({
      timestamp: performanceInfo.timestamp,
      responseTime: performanceInfo.responseTime,
      statusCode: performanceInfo.statusCode
    });

    if (webData.recentRequests.length > 50) {
      webData.recentRequests.shift();
    }
  }

  recordTransactionData(performanceInfo) {
    const transactionId = performanceInfo.id;
    
    this.performanceData.transactions.set(transactionId, {
      id: transactionId,
      startTime: performanceInfo.startTime,
      endTime: performanceInfo.endTime,
      duration: performanceInfo.responseTime,
      componentType: performanceInfo.componentType,
      url: performanceInfo.url,
      method: performanceInfo.method,
      statusCode: performanceInfo.statusCode,
      success: performanceInfo.success,
      sessionId: performanceInfo.sessionId,
      userAgent: performanceInfo.userAgent,
      ip: performanceInfo.ip
    });

    // 트랜잭션 데이터 정리 (최대 10000개 유지)
    if (this.performanceData.transactions.size > 10000) {
      const oldestKey = this.performanceData.transactions.keys().next().value;
      this.performanceData.transactions.delete(oldestKey);
    }
  }

  recordSessionData(performanceInfo) {
    const sessionId = performanceInfo.sessionId;
    
    if (!this.performanceData.sessions.has(sessionId)) {
      this.performanceData.sessions.set(sessionId, {
        sessionId,
        createdAt: performanceInfo.timestamp,
        lastAccessTime: performanceInfo.timestamp,
        requestCount: 0,
        totalTime: 0,
        userAgent: performanceInfo.userAgent,
        ip: performanceInfo.ip,
        pages: new Set(),
        active: true
      });
    }

    const sessionData = this.performanceData.sessions.get(sessionId);
    sessionData.lastAccessTime = performanceInfo.timestamp;
    sessionData.requestCount++;
    sessionData.totalTime += performanceInfo.responseTime;
    sessionData.pages.add(performanceInfo.url);
  }

  updateRealtimeMetrics(componentType, phase, info) {
    const now = Date.now();
    
    switch (componentType) {
      case 'servlet':
        if (phase === 'start') {
          this.realtimeMetrics.servlet.activeRequests++;
          this.realtimeMetrics.servlet.totalRequests++;
        } else if (phase === 'finish') {
          this.realtimeMetrics.servlet.activeRequests--;
          if (!info.success) {
            this.realtimeMetrics.servlet.errorCount++;
          }
          // 평균 응답 시간 계산
          this.realtimeMetrics.servlet.averageResponseTime = 
            this.calculateMovingAverage('servlet', 'responseTime', info.responseTime);
        }
        break;
      
      case 'jsp':
        if (phase === 'start') {
          this.realtimeMetrics.jsp.activeCompilations++;
          this.realtimeMetrics.jsp.totalCompilations++;
        } else if (phase === 'finish') {
          this.realtimeMetrics.jsp.activeCompilations--;
          if (!info.success) {
            this.realtimeMetrics.jsp.errorCount++;
          }
          this.realtimeMetrics.jsp.averageCompileTime = 
            this.calculateMovingAverage('jsp', 'compileTime', info.responseTime);
        }
        break;
      
      case 'ejb':
        if (phase === 'start') {
          this.realtimeMetrics.ejb.activeTransactions++;
          this.realtimeMetrics.ejb.totalInvocations++;
        } else if (phase === 'finish') {
          this.realtimeMetrics.ejb.activeTransactions--;
          if (!info.success) {
            this.realtimeMetrics.ejb.errorCount++;
          }
          this.realtimeMetrics.ejb.averageExecutionTime = 
            this.calculateMovingAverage('ejb', 'executionTime', info.responseTime);
        }
        break;
    }

    // 세션 메트릭 업데이트
    if (info.sessionId && phase === 'finish') {
      this.updateSessionMetrics(info);
    }
  }

  updateSessionMetrics(info) {
    // 활성 세션 수 계산
    const now = Date.now();
    let activeSessions = 0;
    
    this.performanceData.sessions.forEach((session) => {
      const lastAccessTime = new Date(session.lastAccessTime).getTime();
      const sessionTimeout = 30 * 60 * 1000; // 30분
      
      if (now - lastAccessTime < sessionTimeout) {
        activeSessions++;
      } else {
        session.active = false;
      }
    });

    this.realtimeMetrics.session.activeSessions = activeSessions;
    this.realtimeMetrics.session.totalSessions = this.performanceData.sessions.size;
  }

  calculateMovingAverage(componentType, metricType, newValue) {
    // 간단한 이동 평균 계산 (최근 100개 값 기준)
    const key = `${componentType}_${metricType}`;
    
    if (!this.movingAverages) {
      this.movingAverages = {};
    }
    
    if (!this.movingAverages[key]) {
      this.movingAverages[key] = [];
    }
    
    this.movingAverages[key].push(newValue);
    
    if (this.movingAverages[key].length > 100) {
      this.movingAverages[key].shift();
    }
    
    const sum = this.movingAverages[key].reduce((a, b) => a + b, 0);
    return Math.round(sum / this.movingAverages[key].length);
  }

  extractBeanName(url) {
    // URL에서 EJB 빈 이름 추출
    const matches = url.match(/\/ejb\/([^\/\?]+)/);
    return matches ? matches[1] : 'UnknownBean';
  }

  checkPerformanceThresholds(performanceInfo) {
    const thresholds = {
      responseTime: 5000, // 5초
      errorRate: 0.05,    // 5%
      concurrentRequests: 1000
    };

    // 응답 시간 임계치 체크
    if (performanceInfo.responseTime > thresholds.responseTime) {
      this.emit('performance-alert', {
        type: 'slow_response',
        component: performanceInfo.componentType,
        url: performanceInfo.url,
        responseTime: performanceInfo.responseTime,
        threshold: thresholds.responseTime,
        timestamp: performanceInfo.timestamp
      });
    }

    // 동시 요청 수 임계치 체크
    const activeRequests = this.realtimeMetrics[performanceInfo.componentType]?.activeRequests || 0;
    if (activeRequests > thresholds.concurrentRequests) {
      this.emit('performance-alert', {
        type: 'high_concurrency',
        component: performanceInfo.componentType,
        activeRequests,
        threshold: thresholds.concurrentRequests,
        timestamp: performanceInfo.timestamp
      });
    }
  }

  setupRoutes() {
    // 기본 상태 확인
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'j2ee-monitor',
        uptime: process.uptime(),
        timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      });
    });

    // J2EE 컴포넌트별 성능 데이터 조회
    this.app.get('/api/v1/j2ee/servlets', this.getServletMetrics.bind(this));
    this.app.get('/api/v1/j2ee/jsps', this.getJSPMetrics.bind(this));
    this.app.get('/api/v1/j2ee/ejbs', this.getEJBMetrics.bind(this));
    this.app.get('/api/v1/j2ee/sessions', this.getSessionMetrics.bind(this));
    this.app.get('/api/v1/j2ee/transactions', this.getTransactionMetrics.bind(this));

    // 실시간 메트릭 조회
    this.app.get('/api/v1/j2ee/realtime', this.getRealtimeMetrics.bind(this));
    
    // 종합 대시보드 데이터
    this.app.get('/api/v1/j2ee/dashboard', this.getDashboardData.bind(this));
    
    // 성능 분석 리포트
    this.app.get('/api/v1/j2ee/performance-report', this.getPerformanceReport.bind(this));

    // Static files for dashboard
    this.app.use('/static', express.static(__dirname + '/../public'));
    this.app.get('/', (req, res) => {
      res.sendFile(__dirname + '/../public/j2ee-dashboard.html');
    });
  }

  async getServletMetrics(req, res) {
    try {
      const servletMetrics = [];
      
      this.performanceData.servlets.forEach((data, key) => {
        const avgResponseTime = data.totalRequests > 0 ? 
          Math.round(data.totalResponseTime / data.totalRequests) : 0;
        
        const errorRate = data.totalRequests > 0 ? 
          (data.errorCount / data.totalRequests * 100).toFixed(2) : 0;

        servletMetrics.push({
          url: data.url,
          method: data.method,
          totalRequests: data.totalRequests,
          averageResponseTime: avgResponseTime,
          minResponseTime: data.minResponseTime === Infinity ? 0 : data.minResponseTime,
          maxResponseTime: data.maxResponseTime,
          errorCount: data.errorCount,
          errorRate: `${errorRate}%`,
          last24Hours: data.last24Hours,
          recentRequests: data.recentRequests.slice(-10) // 최근 10개
        });
      });

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        servlet_metrics: servletMetrics,
        total_servlets: servletMetrics.length,
        realtime_stats: this.realtimeMetrics.servlet
      });

    } catch (error) {
      logger.error('Servlet 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: 'Servlet 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getJSPMetrics(req, res) {
    try {
      const jspMetrics = [];
      
      this.performanceData.jsps.forEach((data, key) => {
        const avgRenderTime = data.totalCompilations > 0 ? 
          Math.round(data.totalRenderTime / data.totalCompilations) : 0;

        jspMetrics.push({
          jspFile: data.jspFile,
          totalCompilations: data.totalCompilations,
          averageRenderTime: avgRenderTime,
          minRenderTime: data.minRenderTime === Infinity ? 0 : data.minRenderTime,
          maxRenderTime: data.maxRenderTime,
          compilationErrors: data.compilationErrors,
          runtimeErrors: data.runtimeErrors,
          lastCompiled: data.lastCompiled,
          recentRenders: data.recentRenders.slice(-10)
        });
      });

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        jsp_metrics: jspMetrics,
        total_jsps: jspMetrics.length,
        realtime_stats: this.realtimeMetrics.jsp
      });

    } catch (error) {
      logger.error('JSP 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: 'JSP 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getEJBMetrics(req, res) {
    try {
      const ejbMetrics = {
        sessionBeans: [],
        entityBeans: [],
        messageBeans: []
      };

      // Session Beans
      this.performanceData.ejbs.sessionBeans.forEach((data, key) => {
        const avgExecutionTime = data.totalInvocations > 0 ? 
          Math.round(data.totalExecutionTime / data.totalInvocations) : 0;

        ejbMetrics.sessionBeans.push({
          beanName: data.beanName,
          totalInvocations: data.totalInvocations,
          averageExecutionTime: avgExecutionTime,
          minExecutionTime: data.minExecutionTime === Infinity ? 0 : data.minExecutionTime,
          maxExecutionTime: data.maxExecutionTime,
          exceptionCount: data.exceptionCount,
          activeTransactions: data.activeTransactions,
          recentInvocations: data.recentInvocations.slice(-10)
        });
      });

      // Entity Beans
      this.performanceData.ejbs.entityBeans.forEach((data, key) => {
        const avgExecutionTime = data.totalInvocations > 0 ? 
          Math.round(data.totalExecutionTime / data.totalInvocations) : 0;

        ejbMetrics.entityBeans.push({
          beanName: data.beanName,
          totalInvocations: data.totalInvocations,
          averageExecutionTime: avgExecutionTime,
          exceptionCount: data.exceptionCount,
          recentInvocations: data.recentInvocations.slice(-10)
        });
      });

      // Message Beans
      this.performanceData.ejbs.messageBeans.forEach((data, key) => {
        const avgExecutionTime = data.totalInvocations > 0 ? 
          Math.round(data.totalExecutionTime / data.totalInvocations) : 0;

        ejbMetrics.messageBeans.push({
          beanName: data.beanName,
          totalInvocations: data.totalInvocations,
          averageExecutionTime: avgExecutionTime,
          exceptionCount: data.exceptionCount,
          recentInvocations: data.recentInvocations.slice(-10)
        });
      });

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        ejb_metrics: ejbMetrics,
        total_ejbs: {
          sessionBeans: ejbMetrics.sessionBeans.length,
          entityBeans: ejbMetrics.entityBeans.length,
          messageBeans: ejbMetrics.messageBeans.length
        },
        realtime_stats: this.realtimeMetrics.ejb
      });

    } catch (error) {
      logger.error('EJB 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: 'EJB 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getSessionMetrics(req, res) {
    try {
      const sessionMetrics = [];
      const now = Date.now();
      
      this.performanceData.sessions.forEach((data, sessionId) => {
        const sessionAge = now - new Date(data.createdAt).getTime();
        const avgResponseTime = data.requestCount > 0 ? 
          Math.round(data.totalTime / data.requestCount) : 0;

        sessionMetrics.push({
          sessionId,
          createdAt: data.createdAt,
          lastAccessTime: data.lastAccessTime,
          sessionAge: Math.round(sessionAge / 1000), // 초 단위
          requestCount: data.requestCount,
          averageResponseTime: avgResponseTime,
          totalPages: data.pages.size,
          pages: Array.from(data.pages),
          userAgent: data.userAgent,
          ip: data.ip,
          active: data.active
        });
      });

      // 활성 세션만 필터링
      const activeSessions = sessionMetrics.filter(s => s.active);

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        session_metrics: sessionMetrics.slice(0, 100), // 최대 100개
        active_sessions: activeSessions.slice(0, 50),   // 활성 세션 50개
        session_summary: {
          totalSessions: sessionMetrics.length,
          activeSessions: activeSessions.length,
          averageSessionAge: sessionMetrics.reduce((sum, s) => sum + s.sessionAge, 0) / sessionMetrics.length || 0
        },
        realtime_stats: this.realtimeMetrics.session
      });

    } catch (error) {
      logger.error('세션 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: '세션 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getTransactionMetrics(req, res) {
    try {
      const { limit = 100, component_type, status } = req.query;
      
      let transactions = Array.from(this.performanceData.transactions.values());

      // 필터링
      if (component_type) {
        transactions = transactions.filter(t => t.componentType === component_type);
      }
      
      if (status === 'success') {
        transactions = transactions.filter(t => t.success);
      } else if (status === 'error') {
        transactions = transactions.filter(t => !t.success);
      }

      // 최신순 정렬
      transactions.sort((a, b) => b.endTime - a.endTime);
      
      // 제한
      transactions = transactions.slice(0, parseInt(limit));

      // 통계 계산
      const totalTransactions = Array.from(this.performanceData.transactions.values());
      const successfulTransactions = totalTransactions.filter(t => t.success);
      const failedTransactions = totalTransactions.filter(t => !t.success);
      
      const avgDuration = totalTransactions.length > 0 ? 
        Math.round(totalTransactions.reduce((sum, t) => sum + t.duration, 0) / totalTransactions.length) : 0;

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        transactions,
        transaction_summary: {
          totalTransactions: totalTransactions.length,
          successfulTransactions: successfulTransactions.length,
          failedTransactions: failedTransactions.length,
          successRate: totalTransactions.length > 0 ? 
            (successfulTransactions.length / totalTransactions.length * 100).toFixed(2) + '%' : '0%',
          averageDuration: avgDuration
        }
      });

    } catch (error) {
      logger.error('트랜잭션 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: '트랜잭션 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getRealtimeMetrics(req, res) {
    try {
      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        realtime_metrics: this.realtimeMetrics,
        system_info: {
          uptime: process.uptime(),
          memory_usage: process.memoryUsage(),
          node_version: process.version
        }
      });

    } catch (error) {
      logger.error('실시간 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: '실시간 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getDashboardData(req, res) {
    try {
      // 전체 대시보드용 요약 데이터
      const dashboardData = {
        overview: {
          totalComponents: {
            servlets: this.performanceData.servlets.size,
            jsps: this.performanceData.jsps.size,
            ejbs: {
              sessionBeans: this.performanceData.ejbs.sessionBeans.size,
              entityBeans: this.performanceData.ejbs.entityBeans.size,
              messageBeans: this.performanceData.ejbs.messageBeans.size
            },
            activeSessions: this.realtimeMetrics.session.activeSessions
          },
          totalRequests: this.realtimeMetrics.servlet.totalRequests + 
                        this.realtimeMetrics.jsp.totalCompilations +
                        this.realtimeMetrics.ejb.totalInvocations,
          averageResponseTime: Math.round(
            (this.realtimeMetrics.servlet.averageResponseTime +
             this.realtimeMetrics.jsp.averageCompileTime +
             this.realtimeMetrics.ejb.averageExecutionTime) / 3
          ),
          errorRate: this.calculateOverallErrorRate()
        },
        realtimeMetrics: this.realtimeMetrics,
        topPerformers: await this.getTopPerformers(),
        alerts: await this.getActiveAlerts()
      };

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        dashboard: dashboardData
      });

    } catch (error) {
      logger.error('대시보드 데이터 조회 실패', { error: error.message });
      res.status(500).json({
        error: '대시보드 데이터 조회 실패',
        message: error.message
      });
    }
  }

  async getPerformanceReport(req, res) {
    try {
      const { period = '24h', format = 'json' } = req.query;
      
      const report = {
        reportId: `j2ee_perf_${Date.now()}`,
        generatedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        period,
        summary: {
          totalRequests: this.realtimeMetrics.servlet.totalRequests,
          totalErrors: this.realtimeMetrics.servlet.errorCount + 
                      this.realtimeMetrics.jsp.errorCount + 
                      this.realtimeMetrics.ejb.errorCount,
          averageResponseTime: Math.round(
            (this.realtimeMetrics.servlet.averageResponseTime +
             this.realtimeMetrics.jsp.averageCompileTime +
             this.realtimeMetrics.ejb.averageExecutionTime) / 3
          ),
          activeSessions: this.realtimeMetrics.session.activeSessions,
          topSlowComponents: await this.getSlowComponents(),
          topErrorComponents: await this.getErrorComponents(),
          recommendations: await this.generateRecommendations()
        },
        detailedMetrics: {
          servlets: Array.from(this.performanceData.servlets.entries()).map(([key, data]) => ({
            url: data.url,
            totalRequests: data.totalRequests,
            averageResponseTime: data.totalRequests > 0 ? 
              Math.round(data.totalResponseTime / data.totalRequests) : 0,
            errorRate: data.totalRequests > 0 ? 
              (data.errorCount / data.totalRequests * 100).toFixed(2) + '%' : '0%'
          })),
          jsps: Array.from(this.performanceData.jsps.entries()).map(([key, data]) => ({
            jspFile: data.jspFile,
            totalCompilations: data.totalCompilations,
            averageRenderTime: data.totalCompilations > 0 ? 
              Math.round(data.totalRenderTime / data.totalCompilations) : 0,
            errorCount: data.compilationErrors + data.runtimeErrors
          }))
        }
      };

      if (format === 'html') {
        // HTML 리포트 생성 (간단한 템플릿)
        const htmlReport = this.generateHTMLReport(report);
        res.setHeader('Content-Type', 'text/html');
        res.send(htmlReport);
      } else {
        res.json(report);
      }

    } catch (error) {
      logger.error('성능 리포트 생성 실패', { error: error.message });
      res.status(500).json({
        error: '성능 리포트 생성 실패',
        message: error.message
      });
    }
  }

  calculateOverallErrorRate() {
    const totalRequests = this.realtimeMetrics.servlet.totalRequests + 
                         this.realtimeMetrics.jsp.totalCompilations +
                         this.realtimeMetrics.ejb.totalInvocations;
    
    const totalErrors = this.realtimeMetrics.servlet.errorCount + 
                       this.realtimeMetrics.jsp.errorCount + 
                       this.realtimeMetrics.ejb.errorCount;

    return totalRequests > 0 ? (totalErrors / totalRequests * 100).toFixed(2) + '%' : '0%';
  }

  async getTopPerformers() {
    const topPerformers = {
      fastestServlets: [],
      mostUsedJSPs: [],
      efficientEJBs: []
    };

    // 가장 빠른 Servlet들 (상위 5개)
    const servletArray = Array.from(this.performanceData.servlets.entries());
    topPerformers.fastestServlets = servletArray
      .map(([key, data]) => ({
        url: data.url,
        averageResponseTime: data.totalRequests > 0 ? 
          Math.round(data.totalResponseTime / data.totalRequests) : 0,
        totalRequests: data.totalRequests
      }))
      .sort((a, b) => a.averageResponseTime - b.averageResponseTime)
      .slice(0, 5);

    // 가장 많이 사용된 JSP들 (상위 5개)
    const jspArray = Array.from(this.performanceData.jsps.entries());
    topPerformers.mostUsedJSPs = jspArray
      .map(([key, data]) => ({
        jspFile: data.jspFile,
        totalCompilations: data.totalCompilations,
        averageRenderTime: data.totalCompilations > 0 ? 
          Math.round(data.totalRenderTime / data.totalCompilations) : 0
      }))
      .sort((a, b) => b.totalCompilations - a.totalCompilations)
      .slice(0, 5);

    return topPerformers;
  }

  async getActiveAlerts() {
    // 현재 활성 알림들 (성능 임계치 초과 등)
    const alerts = [];
    
    // 느린 응답시간 알림
    this.performanceData.servlets.forEach((data, key) => {
      const avgResponseTime = data.totalRequests > 0 ? 
        Math.round(data.totalResponseTime / data.totalRequests) : 0;
      
      if (avgResponseTime > 5000) { // 5초 이상
        alerts.push({
          type: 'slow_response',
          component: 'servlet',
          url: data.url,
          value: avgResponseTime,
          threshold: 5000,
          severity: 'warning'
        });
      }
    });

    // 높은 오류율 알림
    this.performanceData.servlets.forEach((data, key) => {
      const errorRate = data.totalRequests > 0 ? 
        (data.errorCount / data.totalRequests) : 0;
      
      if (errorRate > 0.05) { // 5% 이상
        alerts.push({
          type: 'high_error_rate',
          component: 'servlet',
          url: data.url,
          value: (errorRate * 100).toFixed(2) + '%',
          threshold: '5%',
          severity: 'critical'
        });
      }
    });

    return alerts.slice(0, 10); // 최대 10개
  }

  async getSlowComponents() {
    const slowComponents = [];
    
    // 느린 Servlet들
    this.performanceData.servlets.forEach((data, key) => {
      const avgResponseTime = data.totalRequests > 0 ? 
        Math.round(data.totalResponseTime / data.totalRequests) : 0;
      
      if (avgResponseTime > 1000) { // 1초 이상
        slowComponents.push({
          type: 'servlet',
          name: data.url,
          averageResponseTime: avgResponseTime,
          totalRequests: data.totalRequests
        });
      }
    });

    // 느린 JSP들
    this.performanceData.jsps.forEach((data, key) => {
      const avgRenderTime = data.totalCompilations > 0 ? 
        Math.round(data.totalRenderTime / data.totalCompilations) : 0;
      
      if (avgRenderTime > 2000) { // 2초 이상
        slowComponents.push({
          type: 'jsp',
          name: data.jspFile,
          averageResponseTime: avgRenderTime,
          totalRequests: data.totalCompilations
        });
      }
    });

    return slowComponents.sort((a, b) => b.averageResponseTime - a.averageResponseTime).slice(0, 10);
  }

  async getErrorComponents() {
    const errorComponents = [];
    
    // 오류가 많은 Servlet들
    this.performanceData.servlets.forEach((data, key) => {
      if (data.errorCount > 0) {
        const errorRate = data.totalRequests > 0 ? 
          (data.errorCount / data.totalRequests * 100) : 0;
        
        errorComponents.push({
          type: 'servlet',
          name: data.url,
          errorCount: data.errorCount,
          totalRequests: data.totalRequests,
          errorRate: errorRate.toFixed(2) + '%'
        });
      }
    });

    return errorComponents.sort((a, b) => b.errorCount - a.errorCount).slice(0, 10);
  }

  async generateRecommendations() {
    const recommendations = [];
    
    // 성능 최적화 권장사항
    const slowComponents = await this.getSlowComponents();
    if (slowComponents.length > 0) {
      recommendations.push({
        category: '성능 최적화',
        priority: 'high',
        description: `${slowComponents.length}개의 느린 컴포넌트가 감지되었습니다. 캐싱, 쿼리 최적화, 또는 리소스 할당을 검토해보세요.`,
        components: slowComponents.slice(0, 3).map(c => c.name)
      });
    }

    // 오류 처리 권장사항
    const errorComponents = await this.getErrorComponents();
    if (errorComponents.length > 0) {
      recommendations.push({
        category: '오류 처리',
        priority: 'critical',
        description: `${errorComponents.length}개의 컴포넌트에서 오류가 발생하고 있습니다. 로그를 확인하고 예외 처리를 강화하세요.`,
        components: errorComponents.slice(0, 3).map(c => c.name)
      });
    }

    // 세션 관리 권장사항
    if (this.realtimeMetrics.session.activeSessions > 1000) {
      recommendations.push({
        category: '세션 관리',
        priority: 'medium',
        description: '활성 세션 수가 많습니다. 세션 타임아웃 설정을 검토하고 불필요한 세션을 정리하세요.',
        components: [`활성 세션: ${this.realtimeMetrics.session.activeSessions}개`]
      });
    }

    return recommendations;
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>J2EE 성능 리포트 - ${report.generatedAt}</title>
    <style>
        body { font-family: 'Noto Sans KR', Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #e9ecef; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { font-size: 14px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .recommendation { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .priority-high { border-left: 5px solid #dc3545; }
        .priority-critical { border-left: 5px solid #fd7e14; }
        .priority-medium { border-left: 5px solid #ffc107; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏢 J2EE 성능 분석 리포트</h1>
        <p><strong>생성일시:</strong> ${report.generatedAt}</p>
        <p><strong>분석 기간:</strong> ${report.period}</p>
        <p><strong>리포트 ID:</strong> ${report.reportId}</p>
    </div>

    <div class="section">
        <h2>📊 전체 요약</h2>
        <div class="metric">
            <div class="metric-value">${report.summary.totalRequests.toLocaleString()}</div>
            <div class="metric-label">총 요청 수</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.summary.totalErrors.toLocaleString()}</div>
            <div class="metric-label">총 오류 수</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.summary.averageResponseTime}ms</div>
            <div class="metric-label">평균 응답시간</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.summary.activeSessions.toLocaleString()}</div>
            <div class="metric-label">활성 세션</div>
        </div>
    </div>

    <div class="section">
        <h2>⚠️ 성능 개선 권장사항</h2>
        ${report.summary.recommendations.map(rec => `
            <div class="recommendation priority-${rec.priority}">
                <h3>${rec.category} (우선순위: ${rec.priority})</h3>
                <p>${rec.description}</p>
                <ul>
                    ${rec.components.map(comp => `<li>${comp}</li>`).join('')}
                </ul>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>🎯 상위 성능 문제 컴포넌트</h2>
        <h3>느린 컴포넌트</h3>
        <table>
            <tr><th>타입</th><th>이름</th><th>평균 응답시간</th><th>요청 수</th></tr>
            ${report.summary.topSlowComponents.map(comp => `
                <tr>
                    <td>${comp.type}</td>
                    <td>${comp.name}</td>
                    <td>${comp.averageResponseTime}ms</td>
                    <td>${comp.totalRequests.toLocaleString()}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>📈 Servlet 상세 메트릭</h2>
        <table>
            <tr><th>URL</th><th>총 요청</th><th>평균 응답시간</th><th>오류율</th></tr>
            ${report.detailedMetrics.servlets.map(servlet => `
                <tr>
                    <td>${servlet.url}</td>
                    <td>${servlet.totalRequests.toLocaleString()}</td>
                    <td>${servlet.averageResponseTime}ms</td>
                    <td>${servlet.errorRate}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>📄 JSP 상세 메트릭</h2>
        <table>
            <tr><th>JSP 파일</th><th>총 컴파일</th><th>평균 렌더시간</th><th>오류 수</th></tr>
            ${report.detailedMetrics.jsps.map(jsp => `
                <tr>
                    <td>${jsp.jspFile}</td>
                    <td>${jsp.totalCompilations.toLocaleString()}</td>
                    <td>${jsp.averageRenderTime}ms</td>
                    <td>${jsp.errorCount}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <p><small>이 리포트는 AIRIS-MON J2EE 모니터링 서비스에 의해 자동 생성되었습니다.</small></p>
    </div>
</body>
</html>
    `;
  }

  async start() {
    try {
      logger.info('J2EE 모니터링 서비스 시작 중...', { service: 'j2ee-monitor' });
      
      this.server = this.app.listen(this.config.port, () => {
        this.isRunning = true;
        logger.info(`J2EE 모니터링 서비스가 포트 ${this.config.port}에서 시작되었습니다`, {
          service: 'j2ee-monitor',
          port: this.config.port,
          config: this.config
        });
      });

      // 성능 알림 이벤트 처리
      this.on('performance-alert', (alert) => {
        logger.warn('성능 임계치 초과 감지', {
          alert,
          service: 'j2ee-monitor'
        });
        // 여기에 추가적인 알림 로직 구현 (이메일, 슬랙 등)
      });

    } catch (error) {
      logger.error('J2EE 모니터링 서비스 시작 실패', {
        error: error.message,
        service: 'j2ee-monitor'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('J2EE 모니터링 서비스 종료 중...', { service: 'j2ee-monitor' });
      
      this.isRunning = false;
      
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
      }

      logger.info('J2EE 모니터링 서비스가 종료되었습니다', { service: 'j2ee-monitor' });

    } catch (error) {
      logger.error('J2EE 모니터링 서비스 종료 중 오류', {
        error: error.message,
        service: 'j2ee-monitor'
      });
    }
  }

  async healthCheck() {
    return {
      status: this.isRunning ? 'healthy' : 'stopped',
      service: 'j2ee-monitor',
      port: this.config.port,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      componentStats: {
        servlets: this.performanceData.servlets.size,
        jsps: this.performanceData.jsps.size,
        ejbs: {
          sessionBeans: this.performanceData.ejbs.sessionBeans.size,
          entityBeans: this.performanceData.ejbs.entityBeans.size,
          messageBeans: this.performanceData.ejbs.messageBeans.size
        },
        activeSessions: this.realtimeMetrics.session.activeSessions,
        activeTransactions: this.performanceData.transactions.size
      }
    };
  }
}

// Logger 유틸리티 (간단한 구현)
const createLogger = () => {
  return {
    info: (message, meta = {}) => {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta);
    },
    warn: (message, meta = {}) => {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta);
    },
    error: (message, meta = {}) => {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta);
    },
    debug: (message, meta = {}) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta);
      }
    }
  };
};

// 모듈이 직접 실행될 때
if (require.main === module) {
  const service = new J2EEMonitoringService({
    port: process.env.J2EE_MONITOR_PORT || 3007
  });

  service.start().catch(error => {
    console.error('서비스 시작 실패:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => service.stop());
  process.on('SIGINT', () => service.stop());
}

module.exports = J2EEMonitoringService;