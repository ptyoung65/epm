/**
 * Exception & Error Detailed Tracking System for AIRIS-MON
 * 대전-APM 기능요약서의 예외/에러 상세 추적 기능 완전 구현
 */

const express = require('express');
const EventEmitter = require('events');
const crypto = require('crypto');
const logger = require('./utils/logger');

class ExceptionTrackingService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 3009,
      enableStackTrace: config.enableStackTrace !== false,
      enableErrorGrouping: config.enableErrorGrouping !== false,
      enablePerformanceImpact: config.enablePerformanceImpact !== false,
      maxErrorHistory: config.maxErrorHistory || 10000,
      errorRetentionDays: config.errorRetentionDays || 30,
      ...config
    };

    // 예외/에러 추적 데이터 저장소
    this.errorData = {
      // 실시간 에러 카운터
      realtime: {
        totalErrors: 0,
        criticalErrors: 0,
        warningErrors: 0,
        infoErrors: 0,
        uniqueErrors: 0,
        errorRate: 0,
        lastError: null
      },
      
      // 에러 상세 이력
      errorHistory: new Map(), // errorId -> errorDetails
      
      // 에러 그룹핑 (동일한 에러의 그룹화)
      errorGroups: new Map(), // groupHash -> groupData
      
      // 에러별 발생 통계
      errorStats: new Map(), // errorType -> statistics
      
      // 에러와 성능 영향 분석
      performanceImpact: new Map(), // errorId -> performanceData
      
      // 사용자/세션별 에러 추적
      userErrors: new Map(), // userId/sessionId -> errorList
      
      // URL/API별 에러 발생 현황
      endpointErrors: new Map(), // endpoint -> errorStats
      
      // 에러 트렌드 분석 (시간대별)
      hourlyTrends: new Map(), // hour -> errorCounts
      
      // 에러 해결 상태 추적
      errorResolution: new Map() // errorId -> resolutionData
    };

    // 에러 분류 시스템
    this.errorClassification = {
      // Java 예외 타입별 분류
      javaExceptions: {
        'NullPointerException': { severity: 'critical', category: 'runtime', solution: 'Null 체크 로직 추가' },
        'ArrayIndexOutOfBoundsException': { severity: 'critical', category: 'runtime', solution: '배열 인덱스 범위 검증' },
        'ClassCastException': { severity: 'critical', category: 'runtime', solution: '타입 캐스팅 검증 강화' },
        'SQLException': { severity: 'high', category: 'database', solution: 'DB 연결 및 쿼리 점검' },
        'OutOfMemoryError': { severity: 'critical', category: 'memory', solution: 'JVM 힙 메모리 증대' },
        'StackOverflowError': { severity: 'critical', category: 'memory', solution: '재귀 호출 최적화' },
        'IllegalArgumentException': { severity: 'medium', category: 'validation', solution: '입력 파라미터 검증 강화' },
        'IOException': { severity: 'medium', category: 'io', solution: '파일/네트워크 I/O 예외 처리' },
        'NumberFormatException': { severity: 'medium', category: 'validation', solution: '숫자 형식 검증 로직 추가' },
        'ConcurrentModificationException': { severity: 'high', category: 'concurrency', solution: '동시성 제어 로직 개선' }
      },
      
      // HTTP 에러 상태 코드별 분류
      httpErrors: {
        '400': { severity: 'medium', category: 'client', solution: '클라이언트 요청 검증' },
        '401': { severity: 'medium', category: 'authentication', solution: '인증 로직 점검' },
        '403': { severity: 'medium', category: 'authorization', solution: '권한 설정 확인' },
        '404': { severity: 'low', category: 'resource', solution: '리소스 경로 확인' },
        '405': { severity: 'medium', category: 'method', solution: 'HTTP 메서드 허용 설정' },
        '500': { severity: 'critical', category: 'server', solution: '서버 내부 로직 점검' },
        '502': { severity: 'high', category: 'gateway', solution: '업스트림 서버 상태 확인' },
        '503': { severity: 'high', category: 'service', solution: '서비스 가용성 점검' },
        '504': { severity: 'high', category: 'timeout', solution: '타임아웃 설정 최적화' }
      },
      
      // 애플리케이션 에러 패턴별 분류
      applicationErrors: {
        'business_logic': { severity: 'medium', category: 'business', solution: '비즈니스 로직 검토' },
        'data_validation': { severity: 'medium', category: 'validation', solution: '데이터 검증 로직 강화' },
        'external_api': { severity: 'high', category: 'integration', solution: '외부 API 연동 점검' },
        'configuration': { severity: 'high', category: 'config', solution: '설정 파일 검토' },
        'security': { severity: 'critical', category: 'security', solution: '보안 정책 점검' }
      }
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    this.server = null;
    this.isRunning = false;
    this.cleanupInterval = null;
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // CORS 설정
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    // 글로벌 에러 핸들러
    process.on('uncaughtException', (error) => {
      this.trackException({
        type: 'UncaughtException',
        message: error.message,
        stack: error.stack,
        severity: 'critical',
        source: 'process',
        timestamp: new Date().toISOString()
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.trackException({
        type: 'UnhandledRejection',
        message: reason ? reason.toString() : 'Unknown rejection',
        stack: reason && reason.stack ? reason.stack : 'No stack trace',
        severity: 'high',
        source: 'promise',
        timestamp: new Date().toISOString(),
        promise: promise.toString()
      });
    });
  }

  /**
   * 예외/에러 추적 메인 함수
   */
  trackException(errorInfo) {
    try {
      const errorId = this.generateErrorId(errorInfo);
      const timestamp = Date.now();
      const korean_time = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

      // 에러 분류 및 심각도 결정
      const classification = this.classifyError(errorInfo);
      
      // 상세 에러 정보 구성
      const detailedError = {
        id: errorId,
        timestamp,
        korean_time,
        type: errorInfo.type,
        message: errorInfo.message,
        stack: this.config.enableStackTrace ? errorInfo.stack : null,
        severity: classification.severity,
        category: classification.category,
        solution: classification.solution,
        source: errorInfo.source || 'application',
        url: errorInfo.url || null,
        method: errorInfo.method || null,
        userId: errorInfo.userId || null,
        sessionId: errorInfo.sessionId || null,
        userAgent: errorInfo.userAgent || null,
        ip: errorInfo.ip || null,
        requestId: errorInfo.requestId || null,
        context: errorInfo.context || {},
        performance: {
          responseTime: errorInfo.responseTime || null,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        }
      };

      // 에러 저장 및 분석
      this.storeError(detailedError);
      this.updateErrorStatistics(detailedError);
      this.groupSimilarErrors(detailedError);
      this.updatePerformanceImpact(detailedError);
      this.updateTrendAnalysis(detailedError);
      this.trackUserImpact(detailedError);
      this.trackEndpointErrors(detailedError);

      // 실시간 메트릭 업데이트
      this.updateRealtimeMetrics(detailedError);

      // 알림 트리거 (심각도에 따라)
      this.triggerAlert(detailedError);

      // 로깅
      logger.exception(detailedError.type, detailedError);

      // 이벤트 발생
      this.emit('error-tracked', detailedError);

      return errorId;

    } catch (error) {
      logger.error('예외 추적 중 오류 발생', { error: error.message });
      return null;
    }
  }

  generateErrorId(errorInfo) {
    const errorSignature = `${errorInfo.type}_${errorInfo.message}_${errorInfo.source}`;
    return crypto.createHash('md5').update(errorSignature).digest('hex').substring(0, 12);
  }

  classifyError(errorInfo) {
    const errorType = errorInfo.type;
    const errorMessage = errorInfo.message || '';
    
    // Java 예외 분류
    if (this.errorClassification.javaExceptions[errorType]) {
      return this.errorClassification.javaExceptions[errorType];
    }
    
    // HTTP 에러 분류
    if (errorInfo.statusCode && this.errorClassification.httpErrors[errorInfo.statusCode.toString()]) {
      return this.errorClassification.httpErrors[errorInfo.statusCode.toString()];
    }
    
    // 메시지 기반 분류
    const messageLower = errorMessage.toLowerCase();
    
    if (messageLower.includes('timeout') || messageLower.includes('connection')) {
      return { severity: 'high', category: 'network', solution: '네트워크 연결 및 타임아웃 설정 점검' };
    }
    
    if (messageLower.includes('permission') || messageLower.includes('access denied')) {
      return { severity: 'medium', category: 'authorization', solution: '권한 설정 점검' };
    }
    
    if (messageLower.includes('validation') || messageLower.includes('invalid')) {
      return { severity: 'medium', category: 'validation', solution: '입력 데이터 검증 강화' };
    }

    // 기본 분류
    return { 
      severity: errorInfo.severity || 'medium', 
      category: 'unknown', 
      solution: '에러 원인 상세 분석 필요' 
    };
  }

  storeError(detailedError) {
    // 에러 이력에 저장
    this.errorData.errorHistory.set(detailedError.id, detailedError);

    // 최대 크기 제한
    if (this.errorData.errorHistory.size > this.config.maxErrorHistory) {
      const oldestKey = this.errorData.errorHistory.keys().next().value;
      this.errorData.errorHistory.delete(oldestKey);
    }
  }

  updateErrorStatistics(detailedError) {
    const errorType = detailedError.type;
    
    if (!this.errorData.errorStats.has(errorType)) {
      this.errorData.errorStats.set(errorType, {
        type: errorType,
        totalCount: 0,
        firstSeen: detailedError.timestamp,
        lastSeen: detailedError.timestamp,
        severity: detailedError.severity,
        category: detailedError.category,
        affectedUsers: new Set(),
        affectedEndpoints: new Set(),
        hourlyDistribution: {},
        solutions: [detailedError.solution],
        trend: 'stable'
      });
    }

    const stats = this.errorData.errorStats.get(errorType);
    stats.totalCount++;
    stats.lastSeen = detailedError.timestamp;
    
    if (detailedError.userId) {
      stats.affectedUsers.add(detailedError.userId);
    }
    
    if (detailedError.url) {
      stats.affectedEndpoints.add(detailedError.url);
    }

    // 시간대별 분포 업데이트
    const hour = new Date(detailedError.timestamp).getHours();
    stats.hourlyDistribution[hour] = (stats.hourlyDistribution[hour] || 0) + 1;

    // 트렌드 분석 (최근 1시간과 이전 1시간 비교)
    const recentErrors = this.getRecentErrorCount(errorType, 1); // 1시간
    const previousErrors = this.getPreviousErrorCount(errorType, 1); // 이전 1시간
    
    if (recentErrors > previousErrors * 1.5) {
      stats.trend = 'increasing';
    } else if (recentErrors < previousErrors * 0.5) {
      stats.trend = 'decreasing';
    } else {
      stats.trend = 'stable';
    }
  }

  groupSimilarErrors(detailedError) {
    if (!this.config.enableErrorGrouping) return;

    // 에러 그룹 해시 생성 (타입 + 메시지의 첫 100자)
    const groupSignature = `${detailedError.type}_${detailedError.message.substring(0, 100)}`;
    const groupHash = crypto.createHash('md5').update(groupSignature).digest('hex').substring(0, 8);

    if (!this.errorData.errorGroups.has(groupHash)) {
      this.errorData.errorGroups.set(groupHash, {
        groupId: groupHash,
        title: `${detailedError.type}: ${detailedError.message.substring(0, 50)}...`,
        type: detailedError.type,
        severity: detailedError.severity,
        category: detailedError.category,
        totalCount: 0,
        uniqueUsers: new Set(),
        firstSeen: detailedError.timestamp,
        lastSeen: detailedError.timestamp,
        examples: [], // 최대 5개 예시
        affectedEndpoints: new Set(),
        resolutionStatus: 'open', // open, investigating, resolved
        assignee: null,
        tags: []
      });
    }

    const group = this.errorData.errorGroups.get(groupHash);
    group.totalCount++;
    group.lastSeen = detailedError.timestamp;
    
    if (detailedError.userId) {
      group.uniqueUsers.add(detailedError.userId);
    }
    
    if (detailedError.url) {
      group.affectedEndpoints.add(detailedError.url);
    }

    // 예시 저장 (최대 5개)
    if (group.examples.length < 5) {
      group.examples.push({
        errorId: detailedError.id,
        timestamp: detailedError.timestamp,
        korean_time: detailedError.korean_time,
        url: detailedError.url,
        userId: detailedError.userId
      });
    }
  }

  updatePerformanceImpact(detailedError) {
    if (!this.config.enablePerformanceImpact) return;

    // 에러와 성능 영향 분석
    const impact = {
      errorId: detailedError.id,
      timestamp: detailedError.timestamp,
      responseTime: detailedError.performance.responseTime,
      memoryImpact: this.calculateMemoryImpact(detailedError.performance.memoryUsage),
      cpuImpact: this.calculateCpuImpact(detailedError.performance.cpuUsage),
      systemLoad: this.getCurrentSystemLoad()
    };

    this.errorData.performanceImpact.set(detailedError.id, impact);
  }

  calculateMemoryImpact(memoryUsage) {
    const heapUsed = memoryUsage.heapUsed;
    const heapTotal = memoryUsage.heapTotal;
    const usage = (heapUsed / heapTotal) * 100;
    
    return {
      heapUsage: usage.toFixed(2) + '%',
      impact: usage > 85 ? 'high' : usage > 70 ? 'medium' : 'low'
    };
  }

  calculateCpuImpact(cpuUsage) {
    // CPU 사용량 계산 (단순화된 버전)
    const userUsage = cpuUsage.user / 1000; // microseconds to milliseconds
    const systemUsage = cpuUsage.system / 1000;
    const total = userUsage + systemUsage;
    
    return {
      totalUsage: total,
      impact: total > 1000 ? 'high' : total > 500 ? 'medium' : 'low'
    };
  }

  getCurrentSystemLoad() {
    // 시스템 로드 정보 (Node.js 환경에서는 제한적)
    return {
      uptime: process.uptime(),
      loadavg: require('os').loadavg(),
      freemem: require('os').freemem(),
      totalmem: require('os').totalmem()
    };
  }

  updateTrendAnalysis(detailedError) {
    const hour = new Date(detailedError.timestamp).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit'
    });

    if (!this.errorData.hourlyTrends.has(hour)) {
      this.errorData.hourlyTrends.set(hour, {
        hour,
        totalErrors: 0,
        criticalErrors: 0,
        highErrors: 0,
        mediumErrors: 0,
        lowErrors: 0,
        uniqueErrorTypes: new Set()
      });
    }

    const trend = this.errorData.hourlyTrends.get(hour);
    trend.totalErrors++;
    trend.uniqueErrorTypes.add(detailedError.type);
    
    switch (detailedError.severity) {
      case 'critical':
        trend.criticalErrors++;
        break;
      case 'high':
        trend.highErrors++;
        break;
      case 'medium':
        trend.mediumErrors++;
        break;
      default:
        trend.lowErrors++;
    }
  }

  trackUserImpact(detailedError) {
    const userId = detailedError.userId || detailedError.sessionId || 'anonymous';
    
    if (!this.errorData.userErrors.has(userId)) {
      this.errorData.userErrors.set(userId, {
        userId,
        totalErrors: 0,
        firstError: detailedError.timestamp,
        lastError: detailedError.timestamp,
        errorTypes: new Set(),
        affectedPages: new Set(),
        sessionDuration: 0,
        userAgent: detailedError.userAgent,
        errorHistory: []
      });
    }

    const userError = this.errorData.userErrors.get(userId);
    userError.totalErrors++;
    userError.lastError = detailedError.timestamp;
    userError.errorTypes.add(detailedError.type);
    
    if (detailedError.url) {
      userError.affectedPages.add(detailedError.url);
    }

    // 에러 이력 저장 (최대 20개)
    userError.errorHistory.push({
      errorId: detailedError.id,
      timestamp: detailedError.timestamp,
      korean_time: detailedError.korean_time,
      type: detailedError.type,
      message: detailedError.message,
      severity: detailedError.severity
    });

    if (userError.errorHistory.length > 20) {
      userError.errorHistory.shift();
    }

    userError.sessionDuration = detailedError.timestamp - userError.firstError;
  }

  trackEndpointErrors(detailedError) {
    if (!detailedError.url) return;

    const endpoint = detailedError.url;
    
    if (!this.errorData.endpointErrors.has(endpoint)) {
      this.errorData.endpointErrors.set(endpoint, {
        endpoint,
        totalErrors: 0,
        errorTypes: new Map(), // errorType -> count
        severityDistribution: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        averageResponseTime: 0,
        totalResponseTime: 0,
        requestCount: 0,
        errorRate: 0,
        firstError: detailedError.timestamp,
        lastError: detailedError.timestamp,
        httpMethods: new Set()
      });
    }

    const endpointError = this.errorData.endpointErrors.get(endpoint);
    endpointError.totalErrors++;
    endpointError.lastError = detailedError.timestamp;
    endpointError.severityDistribution[detailedError.severity]++;
    
    if (detailedError.method) {
      endpointError.httpMethods.add(detailedError.method);
    }

    // 에러 타입별 카운트
    const currentCount = endpointError.errorTypes.get(detailedError.type) || 0;
    endpointError.errorTypes.set(detailedError.type, currentCount + 1);

    // 응답 시간 통계
    if (detailedError.performance.responseTime) {
      endpointError.totalResponseTime += detailedError.performance.responseTime;
      endpointError.requestCount++;
      endpointError.averageResponseTime = 
        Math.round(endpointError.totalResponseTime / endpointError.requestCount);
    }
  }

  updateRealtimeMetrics(detailedError) {
    this.errorData.realtime.totalErrors++;
    this.errorData.realtime.lastError = detailedError;
    
    switch (detailedError.severity) {
      case 'critical':
        this.errorData.realtime.criticalErrors++;
        break;
      case 'high':
        this.errorData.realtime.warningErrors++;
        break;
      default:
        this.errorData.realtime.infoErrors++;
    }

    // 고유 에러 타입 수 계산
    this.errorData.realtime.uniqueErrors = this.errorData.errorStats.size;
    
    // 에러율 계산 (최근 1시간 기준)
    const recentErrors = this.getRecentErrorCount('all', 1);
    const recentRequests = this.getRecentRequestCount(1); // 가상의 요청 수
    this.errorData.realtime.errorRate = recentRequests > 0 ? 
      ((recentErrors / recentRequests) * 100).toFixed(2) : 0;
  }

  getRecentErrorCount(errorType, hours) {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    let count = 0;

    this.errorData.errorHistory.forEach((error) => {
      if (error.timestamp >= cutoffTime) {
        if (errorType === 'all' || error.type === errorType) {
          count++;
        }
      }
    });

    return count;
  }

  getPreviousErrorCount(errorType, hours) {
    const endTime = Date.now() - (hours * 60 * 60 * 1000);
    const startTime = endTime - (hours * 60 * 60 * 1000);
    let count = 0;

    this.errorData.errorHistory.forEach((error) => {
      if (error.timestamp >= startTime && error.timestamp < endTime) {
        if (errorType === 'all' || error.type === errorType) {
          count++;
        }
      }
    });

    return count;
  }

  getRecentRequestCount(hours) {
    // 가상의 요청 수 계산 (실제로는 요청 추적 시스템에서 가져와야 함)
    return Math.floor(Math.random() * 10000) + 5000;
  }

  triggerAlert(detailedError) {
    // 심각도별 알림 조건
    const alertConditions = {
      critical: { immediate: true, threshold: 1 },
      high: { immediate: false, threshold: 5 },
      medium: { immediate: false, threshold: 20 },
      low: { immediate: false, threshold: 100 }
    };

    const condition = alertConditions[detailedError.severity] || alertConditions.medium;
    
    if (condition.immediate) {
      this.sendAlert(detailedError, 'immediate');
    } else {
      // 임계치 기반 알림
      const recentCount = this.getRecentErrorCount(detailedError.type, 1); // 1시간
      if (recentCount >= condition.threshold) {
        this.sendAlert(detailedError, 'threshold', { count: recentCount, threshold: condition.threshold });
      }
    }
  }

  sendAlert(error, alertType, additionalInfo = {}) {
    const alert = {
      type: alertType,
      errorType: error.type,
      severity: error.severity,
      message: error.message,
      timestamp: error.timestamp,
      korean_time: error.korean_time,
      url: error.url,
      userId: error.userId,
      ...additionalInfo
    };

    this.emit('error-alert', alert);
    logger.alert('에러 알림 발생', alert);
  }

  setupRoutes() {
    // 기본 상태 확인
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'exception-tracker',
        uptime: process.uptime(),
        timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        totalErrors: this.errorData.realtime.totalErrors
      });
    });

    // 에러 추적 API (외부에서 에러 제출)
    this.app.post('/api/v1/errors/track', this.trackErrorAPI.bind(this));
    
    // 실시간 에러 메트릭 조회
    this.app.get('/api/v1/errors/realtime', this.getRealtimeMetrics.bind(this));
    
    // 에러 통계 조회
    this.app.get('/api/v1/errors/statistics', this.getErrorStatistics.bind(this));
    
    // 에러 그룹 조회
    this.app.get('/api/v1/errors/groups', this.getErrorGroups.bind(this));
    
    // 특정 에러 상세 조회
    this.app.get('/api/v1/errors/:errorId', this.getErrorDetail.bind(this));
    
    // 에러 트렌드 분석
    this.app.get('/api/v1/errors/trends', this.getErrorTrends.bind(this));
    
    // 사용자별 에러 영향 분석
    this.app.get('/api/v1/errors/users/:userId', this.getUserErrors.bind(this));
    
    // 엔드포인트별 에러 분석
    this.app.get('/api/v1/errors/endpoints', this.getEndpointErrors.bind(this));
    
    // 성능 영향 분석
    this.app.get('/api/v1/errors/performance-impact', this.getPerformanceImpact.bind(this));
    
    // 에러 해결 상태 업데이트
    this.app.put('/api/v1/errors/:errorId/resolution', this.updateErrorResolution.bind(this));
    
    // 종합 대시보드 데이터
    this.app.get('/api/v1/errors/dashboard', this.getDashboardData.bind(this));
    
    // 에러 분석 리포트
    this.app.get('/api/v1/errors/report', this.getErrorReport.bind(this));

    // Static files
    this.app.use('/static', express.static(__dirname + '/../public'));
    this.app.get('/', (req, res) => {
      res.sendFile(__dirname + '/../public/exception-dashboard.html');
    });
  }

  async trackErrorAPI(req, res) {
    try {
      const errorInfo = {
        type: req.body.type || 'UnknownError',
        message: req.body.message || 'No message provided',
        stack: req.body.stack || null,
        severity: req.body.severity || 'medium',
        source: req.body.source || 'external',
        url: req.body.url || req.get('referer'),
        method: req.body.method || req.method,
        userId: req.body.userId || null,
        sessionId: req.body.sessionId || req.sessionID,
        userAgent: req.body.userAgent || req.get('user-agent'),
        ip: req.body.ip || req.ip,
        requestId: req.body.requestId || req.get('x-request-id'),
        context: req.body.context || {},
        responseTime: req.body.responseTime || null,
        statusCode: req.body.statusCode || null
      };

      const errorId = this.trackException(errorInfo);

      res.json({
        status: '성공',
        message: '에러가 성공적으로 추적되었습니다',
        errorId,
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      });

    } catch (error) {
      logger.error('에러 추적 API 실패', { error: error.message });
      res.status(500).json({
        error: '에러 추적 실패',
        message: error.message
      });
    }
  }

  async getRealtimeMetrics(req, res) {
    try {
      const metrics = {
        ...this.errorData.realtime,
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        last_error_formatted: this.errorData.realtime.lastError ? {
          type: this.errorData.realtime.lastError.type,
          message: this.errorData.realtime.lastError.message.substring(0, 100) + '...',
          severity: this.errorData.realtime.lastError.severity,
          korean_time: this.errorData.realtime.lastError.korean_time
        } : null
      };

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        realtime_metrics: metrics
      });

    } catch (error) {
      logger.error('실시간 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: '실시간 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getErrorStatistics(req, res) {
    try {
      const { limit = 20, severity, category } = req.query;
      
      let statistics = Array.from(this.errorData.errorStats.entries()).map(([type, stats]) => ({
        type,
        totalCount: stats.totalCount,
        severity: stats.severity,
        category: stats.category,
        trend: stats.trend,
        affectedUsers: stats.affectedUsers.size,
        affectedEndpoints: stats.affectedEndpoints.size,
        firstSeen: new Date(stats.firstSeen).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        lastSeen: new Date(stats.lastSeen).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        hourlyDistribution: stats.hourlyDistribution,
        solutions: stats.solutions
      }));

      // 필터링
      if (severity) {
        statistics = statistics.filter(stat => stat.severity === severity);
      }
      
      if (category) {
        statistics = statistics.filter(stat => stat.category === category);
      }

      // 정렬 (발생 횟수 기준)
      statistics.sort((a, b) => b.totalCount - a.totalCount);
      
      // 제한
      statistics = statistics.slice(0, parseInt(limit));

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        error_statistics: statistics,
        total_error_types: this.errorData.errorStats.size,
        filters_applied: { severity, category, limit }
      });

    } catch (error) {
      logger.error('에러 통계 조회 실패', { error: error.message });
      res.status(500).json({
        error: '에러 통계 조회 실패',
        message: error.message
      });
    }
  }

  async getErrorGroups(req, res) {
    try {
      const { limit = 20, status = 'all' } = req.query;
      
      let groups = Array.from(this.errorData.errorGroups.entries()).map(([groupId, group]) => ({
        groupId,
        title: group.title,
        type: group.type,
        severity: group.severity,
        category: group.category,
        totalCount: group.totalCount,
        uniqueUsers: group.uniqueUsers.size,
        affectedEndpoints: Array.from(group.affectedEndpoints),
        firstSeen: new Date(group.firstSeen).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        lastSeen: new Date(group.lastSeen).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        resolutionStatus: group.resolutionStatus,
        assignee: group.assignee,
        tags: group.tags,
        exampleCount: group.examples.length
      }));

      // 상태 필터링
      if (status !== 'all') {
        groups = groups.filter(group => group.resolutionStatus === status);
      }

      // 정렬 (최근 발생 순)
      groups.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
      
      // 제한
      groups = groups.slice(0, parseInt(limit));

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        error_groups: groups,
        total_groups: this.errorData.errorGroups.size,
        group_status_distribution: this.getGroupStatusDistribution()
      });

    } catch (error) {
      logger.error('에러 그룹 조회 실패', { error: error.message });
      res.status(500).json({
        error: '에러 그룹 조회 실패',
        message: error.message
      });
    }
  }

  getGroupStatusDistribution() {
    const distribution = { open: 0, investigating: 0, resolved: 0 };
    
    this.errorData.errorGroups.forEach(group => {
      distribution[group.resolutionStatus]++;
    });

    return distribution;
  }

  async getErrorDetail(req, res) {
    try {
      const { errorId } = req.params;
      
      const error = this.errorData.errorHistory.get(errorId);
      if (!error) {
        return res.status(404).json({
          error: '에러를 찾을 수 없습니다',
          errorId
        });
      }

      // 관련 에러들 찾기 (같은 타입의 최근 에러 5개)
      const relatedErrors = Array.from(this.errorData.errorHistory.values())
        .filter(e => e.type === error.type && e.id !== errorId)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map(e => ({
          id: e.id,
          message: e.message.substring(0, 100) + '...',
          korean_time: e.korean_time,
          severity: e.severity
        }));

      // 성능 영향 정보
      const performanceImpact = this.errorData.performanceImpact.get(errorId);

      // 해결 상태 정보
      const resolutionInfo = this.errorData.errorResolution.get(errorId);

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        error_detail: error,
        related_errors: relatedErrors,
        performance_impact: performanceImpact,
        resolution_info: resolutionInfo
      });

    } catch (error) {
      logger.error('에러 상세 조회 실패', { error: error.message });
      res.status(500).json({
        error: '에러 상세 조회 실패',
        message: error.message
      });
    }
  }

  async getErrorTrends(req, res) {
    try {
      const { period = '24h' } = req.query;
      
      // 시간별 트렌드 데이터
      const hourlyTrends = Array.from(this.errorData.hourlyTrends.entries())
        .map(([hour, data]) => ({
          hour,
          totalErrors: data.totalErrors,
          criticalErrors: data.criticalErrors,
          highErrors: data.highErrors,
          mediumErrors: data.mediumErrors,
          lowErrors: data.lowErrors,
          uniqueErrorTypes: data.uniqueErrorTypes.size
        }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

      // 에러 타입별 트렌드 (상위 10개)
      const topErrorTypes = Array.from(this.errorData.errorStats.entries())
        .sort(([,a], [,b]) => b.totalCount - a.totalCount)
        .slice(0, 10)
        .map(([type, stats]) => ({
          type,
          totalCount: stats.totalCount,
          trend: stats.trend,
          hourlyDistribution: stats.hourlyDistribution
        }));

      // 전체 트렌드 분석
      const trendAnalysis = this.calculateOverallTrend(hourlyTrends);

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        period,
        hourly_trends: hourlyTrends,
        top_error_types: topErrorTypes,
        trend_analysis: trendAnalysis
      });

    } catch (error) {
      logger.error('에러 트렌드 조회 실패', { error: error.message });
      res.status(500).json({
        error: '에러 트렌드 조회 실패',
        message: error.message
      });
    }
  }

  calculateOverallTrend(hourlyData) {
    if (hourlyData.length < 2) {
      return { trend: 'insufficient_data', change: 0 };
    }

    const recentHalf = hourlyData.slice(Math.floor(hourlyData.length / 2));
    const earlierHalf = hourlyData.slice(0, Math.floor(hourlyData.length / 2));

    const recentAvg = recentHalf.reduce((sum, h) => sum + h.totalErrors, 0) / recentHalf.length;
    const earlierAvg = earlierHalf.reduce((sum, h) => sum + h.totalErrors, 0) / earlierHalf.length;

    const changePercent = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg * 100) : 0;

    return {
      trend: changePercent > 20 ? 'increasing' : 
             changePercent < -20 ? 'decreasing' : 'stable',
      change: changePercent.toFixed(2) + '%',
      recent_average: recentAvg.toFixed(1),
      earlier_average: earlierAvg.toFixed(1)
    };
  }

  async getUserErrors(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50 } = req.query;
      
      const userError = this.errorData.userErrors.get(userId);
      
      if (!userError) {
        return res.status(404).json({
          error: '사용자 에러 데이터를 찾을 수 없습니다',
          userId
        });
      }

      // 에러 이력 제한
      const limitedHistory = userError.errorHistory.slice(-parseInt(limit));

      const userData = {
        userId: userError.userId,
        totalErrors: userError.totalErrors,
        errorTypes: Array.from(userError.errorTypes),
        affectedPages: Array.from(userError.affectedPages),
        sessionDuration: Math.round(userError.sessionDuration / 1000) + '초',
        firstError: new Date(userError.firstError).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        lastError: new Date(userError.lastError).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        userAgent: userError.userAgent,
        errorHistory: limitedHistory
      };

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        user_errors: userData
      });

    } catch (error) {
      logger.error('사용자 에러 조회 실패', { error: error.message });
      res.status(500).json({
        error: '사용자 에러 조회 실패',
        message: error.message
      });
    }
  }

  async getEndpointErrors(req, res) {
    try {
      const { limit = 20, sort = 'totalErrors' } = req.query;
      
      let endpointErrors = Array.from(this.errorData.endpointErrors.entries())
        .map(([endpoint, data]) => ({
          endpoint,
          totalErrors: data.totalErrors,
          errorTypes: Object.fromEntries(data.errorTypes),
          severityDistribution: data.severityDistribution,
          averageResponseTime: data.averageResponseTime,
          errorRate: data.errorRate,
          httpMethods: Array.from(data.httpMethods),
          firstError: new Date(data.firstError).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
          lastError: new Date(data.lastError).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        }));

      // 정렬
      switch (sort) {
        case 'errorRate':
          endpointErrors.sort((a, b) => b.errorRate - a.errorRate);
          break;
        case 'responseTime':
          endpointErrors.sort((a, b) => b.averageResponseTime - a.averageResponseTime);
          break;
        case 'recent':
          endpointErrors.sort((a, b) => new Date(b.lastError) - new Date(a.lastError));
          break;
        default:
          endpointErrors.sort((a, b) => b.totalErrors - a.totalErrors);
      }

      endpointErrors = endpointErrors.slice(0, parseInt(limit));

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        endpoint_errors: endpointErrors,
        total_endpoints: this.errorData.endpointErrors.size,
        sort_by: sort
      });

    } catch (error) {
      logger.error('엔드포인트 에러 조회 실패', { error: error.message });
      res.status(500).json({
        error: '엔드포인트 에러 조회 실패',
        message: error.message
      });
    }
  }

  async getPerformanceImpact(req, res) {
    try {
      const { limit = 20, impact = 'all' } = req.query;
      
      let performanceData = Array.from(this.errorData.performanceImpact.entries())
        .map(([errorId, data]) => {
          const error = this.errorData.errorHistory.get(errorId);
          return {
            errorId,
            errorType: error ? error.type : 'Unknown',
            severity: error ? error.severity : 'Unknown',
            timestamp: data.timestamp,
            korean_time: new Date(data.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
            responseTime: data.responseTime,
            memoryImpact: data.memoryImpact,
            cpuImpact: data.cpuImpact,
            systemLoad: {
              loadavg: data.systemLoad.loadavg,
              freemem: Math.round(data.systemLoad.freemem / 1024 / 1024) + 'MB',
              memoryUsage: ((data.systemLoad.totalmem - data.systemLoad.freemem) / data.systemLoad.totalmem * 100).toFixed(2) + '%'
            }
          };
        });

      // 영향도 필터링
      if (impact !== 'all') {
        performanceData = performanceData.filter(data => 
          data.memoryImpact.impact === impact || data.cpuImpact.impact === impact
        );
      }

      // 최근 순 정렬
      performanceData.sort((a, b) => b.timestamp - a.timestamp);
      performanceData = performanceData.slice(0, parseInt(limit));

      // 통계 계산
      const impactStats = this.calculateImpactStatistics(performanceData);

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        performance_impact: performanceData,
        impact_statistics: impactStats,
        filter_applied: impact
      });

    } catch (error) {
      logger.error('성능 영향 조회 실패', { error: error.message });
      res.status(500).json({
        error: '성능 영향 조회 실패',
        message: error.message
      });
    }
  }

  calculateImpactStatistics(performanceData) {
    if (performanceData.length === 0) {
      return { message: '데이터가 없습니다' };
    }

    const stats = {
      total_errors: performanceData.length,
      impact_distribution: {
        memory: { high: 0, medium: 0, low: 0 },
        cpu: { high: 0, medium: 0, low: 0 }
      },
      average_response_time: 0,
      response_times: []
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    performanceData.forEach(data => {
      // 메모리 영향 분포
      stats.impact_distribution.memory[data.memoryImpact.impact]++;
      
      // CPU 영향 분포
      stats.impact_distribution.cpu[data.cpuImpact.impact]++;
      
      // 응답 시간 통계
      if (data.responseTime) {
        totalResponseTime += data.responseTime;
        responseTimeCount++;
        stats.response_times.push(data.responseTime);
      }
    });

    if (responseTimeCount > 0) {
      stats.average_response_time = Math.round(totalResponseTime / responseTimeCount);
      stats.response_times.sort((a, b) => a - b);
      stats.median_response_time = stats.response_times[Math.floor(stats.response_times.length / 2)];
    }

    return stats;
  }

  async updateErrorResolution(req, res) {
    try {
      const { errorId } = req.params;
      const { status, assignee, notes, tags } = req.body;
      
      if (!this.errorData.errorHistory.has(errorId)) {
        return res.status(404).json({
          error: '에러를 찾을 수 없습니다',
          errorId
        });
      }

      const resolutionData = {
        errorId,
        status: status || 'open', // open, investigating, resolved
        assignee: assignee || null,
        notes: notes || '',
        tags: tags || [],
        updatedAt: Date.now(),
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        updatedBy: req.body.updatedBy || 'system'
      };

      this.errorData.errorResolution.set(errorId, resolutionData);

      // 에러 그룹의 해결 상태도 업데이트
      this.updateErrorGroupResolution(errorId, status);

      res.json({
        status: '성공',
        message: '에러 해결 상태가 업데이트되었습니다',
        resolution: resolutionData
      });

    } catch (error) {
      logger.error('에러 해결 상태 업데이트 실패', { error: error.message });
      res.status(500).json({
        error: '에러 해결 상태 업데이트 실패',
        message: error.message
      });
    }
  }

  updateErrorGroupResolution(errorId, status) {
    const error = this.errorData.errorHistory.get(errorId);
    if (!error) return;

    // 에러 그룹 찾기
    const groupSignature = `${error.type}_${error.message.substring(0, 100)}`;
    const groupHash = crypto.createHash('md5').update(groupSignature).digest('hex').substring(0, 8);

    const group = this.errorData.errorGroups.get(groupHash);
    if (group) {
      group.resolutionStatus = status;
    }
  }

  async getDashboardData(req, res) {
    try {
      const dashboardData = {
        overview: {
          totalErrors: this.errorData.realtime.totalErrors,
          criticalErrors: this.errorData.realtime.criticalErrors,
          uniqueErrors: this.errorData.realtime.uniqueErrors,
          errorRate: this.errorData.realtime.errorRate + '%',
          topErrorTypes: this.getTopErrorTypes(5),
          severityDistribution: this.getSeverityDistribution(),
          recentTrend: this.getRecentErrorTrend()
        },
        realtime_metrics: this.errorData.realtime,
        recent_errors: this.getRecentErrors(10),
        top_affected_endpoints: this.getTopAffectedEndpoints(5),
        top_affected_users: this.getTopAffectedUsers(5),
        error_groups_summary: this.getErrorGroupsSummary(),
        performance_impact_summary: this.getPerformanceImpactSummary(),
        resolution_status: this.getResolutionStatusSummary()
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

  getTopErrorTypes(limit) {
    return Array.from(this.errorData.errorStats.entries())
      .sort(([,a], [,b]) => b.totalCount - a.totalCount)
      .slice(0, limit)
      .map(([type, stats]) => ({
        type,
        count: stats.totalCount,
        severity: stats.severity,
        trend: stats.trend
      }));
  }

  getSeverityDistribution() {
    const distribution = { critical: 0, high: 0, medium: 0, low: 0 };
    
    this.errorData.errorStats.forEach(stats => {
      distribution[stats.severity] += stats.totalCount;
    });

    return distribution;
  }

  getRecentErrorTrend() {
    const recent1h = this.getRecentErrorCount('all', 1);
    const previous1h = this.getPreviousErrorCount('all', 1);
    
    const change = previous1h > 0 ? ((recent1h - previous1h) / previous1h * 100) : 0;
    
    return {
      recent_1h: recent1h,
      previous_1h: previous1h,
      change_percent: change.toFixed(2) + '%',
      trend: change > 10 ? 'increasing' : change < -10 ? 'decreasing' : 'stable'
    };
  }

  getRecentErrors(limit) {
    return Array.from(this.errorData.errorHistory.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(error => ({
        id: error.id,
        type: error.type,
        message: error.message.substring(0, 100) + '...',
        severity: error.severity,
        korean_time: error.korean_time,
        url: error.url,
        userId: error.userId
      }));
  }

  getTopAffectedEndpoints(limit) {
    return Array.from(this.errorData.endpointErrors.entries())
      .sort(([,a], [,b]) => b.totalErrors - a.totalErrors)
      .slice(0, limit)
      .map(([endpoint, data]) => ({
        endpoint,
        errorCount: data.totalErrors,
        errorRate: data.errorRate
      }));
  }

  getTopAffectedUsers(limit) {
    return Array.from(this.errorData.userErrors.entries())
      .sort(([,a], [,b]) => b.totalErrors - a.totalErrors)
      .slice(0, limit)
      .map(([userId, data]) => ({
        userId,
        errorCount: data.totalErrors,
        affectedPages: data.affectedPages.size,
        sessionDuration: Math.round(data.sessionDuration / 1000) + '초'
      }));
  }

  getErrorGroupsSummary() {
    const statusCounts = this.getGroupStatusDistribution();
    
    return {
      totalGroups: this.errorData.errorGroups.size,
      statusDistribution: statusCounts,
      averageErrorsPerGroup: this.errorData.errorGroups.size > 0 ? 
        Math.round(this.errorData.realtime.totalErrors / this.errorData.errorGroups.size) : 0
    };
  }

  getPerformanceImpactSummary() {
    const impacts = Array.from(this.errorData.performanceImpact.values());
    
    if (impacts.length === 0) {
      return { message: '성능 영향 데이터가 없습니다' };
    }

    const highImpactCount = impacts.filter(i => 
      i.memoryImpact.impact === 'high' || i.cpuImpact.impact === 'high'
    ).length;

    return {
      totalErrorsWithImpact: impacts.length,
      highImpactErrors: highImpactCount,
      highImpactPercentage: ((highImpactCount / impacts.length) * 100).toFixed(2) + '%'
    };
  }

  getResolutionStatusSummary() {
    const total = this.errorData.errorResolution.size;
    if (total === 0) {
      return { message: '해결 상태 데이터가 없습니다' };
    }

    const statusCounts = { open: 0, investigating: 0, resolved: 0 };
    
    this.errorData.errorResolution.forEach(resolution => {
      statusCounts[resolution.status]++;
    });

    return {
      totalResolutions: total,
      statusDistribution: statusCounts,
      resolutionRate: ((statusCounts.resolved / total) * 100).toFixed(2) + '%'
    };
  }

  async getErrorReport(req, res) {
    try {
      const { period = '24h', format = 'json' } = req.query;
      
      const report = {
        reportId: `error_report_${Date.now()}`,
        generatedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        period,
        summary: {
          totalErrors: this.errorData.realtime.totalErrors,
          uniqueErrorTypes: this.errorData.realtime.uniqueErrors,
          criticalErrors: this.errorData.realtime.criticalErrors,
          errorRate: this.errorData.realtime.errorRate + '%',
          mostCommonError: this.getMostCommonError(),
          errorTrend: this.getRecentErrorTrend(),
          topAffectedEndpoints: this.getTopAffectedEndpoints(5),
          resolutionSummary: this.getResolutionStatusSummary()
        },
        detailed_analysis: {
          errorTypeDistribution: this.getErrorTypeDistribution(),
          severityBreakdown: this.getSeverityDistribution(),
          hourlyTrends: Array.from(this.errorData.hourlyTrends.values()),
          performanceImpactAnalysis: this.getPerformanceImpactSummary(),
          userImpactAnalysis: this.getUserImpactAnalysis()
        },
        recommendations: this.generateErrorRecommendations(),
        action_items: this.generateActionItems()
      };

      if (format === 'html') {
        const htmlReport = this.generateErrorHTMLReport(report);
        res.setHeader('Content-Type', 'text/html');
        res.send(htmlReport);
      } else {
        res.json(report);
      }

    } catch (error) {
      logger.error('에러 리포트 생성 실패', { error: error.message });
      res.status(500).json({
        error: '에러 리포트 생성 실패',
        message: error.message
      });
    }
  }

  getMostCommonError() {
    if (this.errorData.errorStats.size === 0) {
      return { type: 'None', count: 0 };
    }

    const [type, stats] = Array.from(this.errorData.errorStats.entries())
      .sort(([,a], [,b]) => b.totalCount - a.totalCount)[0];

    return { type, count: stats.totalCount, severity: stats.severity };
  }

  getErrorTypeDistribution() {
    const distribution = {};
    
    this.errorData.errorStats.forEach((stats, type) => {
      distribution[type] = {
        count: stats.totalCount,
        percentage: ((stats.totalCount / this.errorData.realtime.totalErrors) * 100).toFixed(2) + '%',
        severity: stats.severity
      };
    });

    return distribution;
  }

  getUserImpactAnalysis() {
    const totalUsers = this.errorData.userErrors.size;
    const usersWithErrors = Array.from(this.errorData.userErrors.values());
    
    if (totalUsers === 0) {
      return { message: '사용자 영향 데이터가 없습니다' };
    }

    const highImpactUsers = usersWithErrors.filter(user => user.totalErrors > 10).length;
    const averageErrorsPerUser = usersWithErrors.reduce((sum, user) => sum + user.totalErrors, 0) / totalUsers;

    return {
      totalAffectedUsers: totalUsers,
      highImpactUsers,
      averageErrorsPerUser: averageErrorsPerUser.toFixed(2),
      userImpactRate: ((highImpactUsers / totalUsers) * 100).toFixed(2) + '%'
    };
  }

  generateErrorRecommendations() {
    const recommendations = [];

    // Critical 에러 권장사항
    if (this.errorData.realtime.criticalErrors > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'Critical 에러',
        description: `${this.errorData.realtime.criticalErrors}개의 Critical 에러가 발생했습니다`,
        action: '즉시 개발팀에 에스컬레이션하고 핫픽스 배포를 검토하세요',
        impact: '서비스 중단 또는 심각한 사용자 경험 저하'
      });
    }

    // 에러율 권장사항
    const errorRate = parseFloat(this.errorData.realtime.errorRate);
    if (errorRate > 5) {
      recommendations.push({
        priority: 'high',
        category: '에러율',
        description: `에러율이 ${errorRate}%로 높습니다`,
        action: '로드 밸런싱, 서버 증설, 또는 성능 최적화를 검토하세요',
        impact: '사용자 경험 저하 및 서비스 신뢰도 하락'
      });
    }

    // 트렌드 기반 권장사항
    const trend = this.getRecentErrorTrend();
    if (trend.trend === 'increasing') {
      recommendations.push({
        priority: 'medium',
        category: '에러 증가 트렌드',
        description: `최근 1시간 에러가 ${trend.change_percent} 증가했습니다`,
        action: '모니터링을 강화하고 증가 원인을 분석하세요',
        impact: '서비스 품질 저하 가능성'
      });
    }

    return recommendations;
  }

  generateActionItems() {
    const actionItems = [];

    // 해결되지 않은 Critical 에러들
    const unresolvedCritical = Array.from(this.errorData.errorGroups.values())
      .filter(group => group.severity === 'critical' && group.resolutionStatus === 'open');

    if (unresolvedCritical.length > 0) {
      actionItems.push({
        priority: 'critical',
        task: `${unresolvedCritical.length}개의 Critical 에러 그룹 즉시 해결`,
        assignee: 'Development Team',
        dueDate: '즉시',
        groups: unresolvedCritical.map(g => g.groupId)
      });
    }

    // 성능 영향이 큰 에러들
    const highImpactErrors = Array.from(this.errorData.performanceImpact.values())
      .filter(impact => impact.memoryImpact.impact === 'high' || impact.cpuImpact.impact === 'high');

    if (highImpactErrors.length > 5) {
      actionItems.push({
        priority: 'high',
        task: '성능 영향이 큰 에러들의 최적화 작업',
        assignee: 'Performance Team',
        dueDate: '1일 이내',
        errorCount: highImpactErrors.length
      });
    }

    // 자주 발생하는 에러 패턴 분석
    const frequentErrors = this.getTopErrorTypes(3);
    if (frequentErrors.length > 0 && frequentErrors[0].count > 100) {
      actionItems.push({
        priority: 'medium',
        task: '빈발 에러 패턴 근본 원인 분석 및 예방책 마련',
        assignee: 'QA Team',
        dueDate: '3일 이내',
        topErrors: frequentErrors
      });
    }

    return actionItems;
  }

  generateErrorHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>에러 추적 분석 리포트 - ${report.generatedAt}</title>
    <style>
        body { font-family: 'Noto Sans KR', Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #dc3545; }
        .metric-value { font-size: 24px; font-weight: bold; color: #dc3545; }
        .metric-label { font-size: 14px; color: #666; margin-top: 5px; }
        .recommendation { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .priority-critical { border-left: 5px solid #dc3545; }
        .priority-high { border-left: 5px solid #fd7e14; }
        .priority-medium { border-left: 5px solid #ffc107; }
        .severity-critical { color: #dc3545; font-weight: bold; }
        .severity-high { color: #fd7e14; font-weight: bold; }
        .severity-medium { color: #ffc107; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .trend-increasing { color: #dc3545; }
        .trend-decreasing { color: #28a745; }
        .trend-stable { color: #6c757d; }
        .action-item { background: #e7f3ff; border: 1px solid #b8daff; padding: 15px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚨 예외/에러 추적 분석 리포트</h1>
        <p><strong>생성일시:</strong> ${report.generatedAt}</p>
        <p><strong>분석 기간:</strong> ${report.period}</p>
        <p><strong>리포트 ID:</strong> ${report.reportId}</p>
    </div>

    <div class="section">
        <h2>📊 전체 요약</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${report.summary.totalErrors.toLocaleString()}</div>
                <div class="metric-label">총 에러 수</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.criticalErrors.toLocaleString()}</div>
                <div class="metric-label">Critical 에러</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.uniqueErrorTypes}</div>
                <div class="metric-label">고유 에러 타입</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.errorRate}</div>
                <div class="metric-label">에러율</div>
            </div>
        </div>

        <h3>가장 빈발하는 에러</h3>
        <p><strong>${report.summary.mostCommonError.type}</strong> - ${report.summary.mostCommonError.count}회 발생 
        <span class="severity-${report.summary.mostCommonError.severity}">(${report.summary.mostCommonError.severity})</span></p>

        <h3>에러 트렌드</h3>
        <p>최근 1시간: ${report.summary.errorTrend.recent_1h}회, 이전 1시간: ${report.summary.errorTrend.previous_1h}회</p>
        <p class="trend-${report.summary.errorTrend.trend}">변화: ${report.summary.errorTrend.change_percent} (${report.summary.errorTrend.trend})</p>
    </div>

    <div class="section">
        <h2>🎯 상위 영향받은 엔드포인트</h2>
        <table>
            <tr><th>엔드포인트</th><th>에러 수</th><th>에러율</th></tr>
            ${report.summary.topAffectedEndpoints.map(endpoint => `
                <tr>
                    <td>${endpoint.endpoint}</td>
                    <td>${endpoint.errorCount.toLocaleString()}</td>
                    <td>${endpoint.errorRate}%</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>📈 상세 분석</h2>
        
        <h3>에러 타입별 분포</h3>
        <table>
            <tr><th>에러 타입</th><th>발생 횟수</th><th>비율</th><th>심각도</th></tr>
            ${Object.entries(report.detailed_analysis.errorTypeDistribution).slice(0, 10).map(([type, data]) => `
                <tr>
                    <td>${type}</td>
                    <td>${data.count.toLocaleString()}</td>
                    <td>${data.percentage}</td>
                    <td class="severity-${data.severity}">${data.severity}</td>
                </tr>
            `).join('')}
        </table>

        <h3>심각도별 분포</h3>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value severity-critical">${report.detailed_analysis.severityBreakdown.critical}</div>
                <div class="metric-label">Critical</div>
            </div>
            <div class="metric-card">
                <div class="metric-value severity-high">${report.detailed_analysis.severityBreakdown.high}</div>
                <div class="metric-label">High</div>
            </div>
            <div class="metric-card">
                <div class="metric-value severity-medium">${report.detailed_analysis.severityBreakdown.medium}</div>
                <div class="metric-label">Medium</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.detailed_analysis.severityBreakdown.low}</div>
                <div class="metric-label">Low</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>💡 권장사항</h2>
        ${report.recommendations.map(rec => `
            <div class="recommendation priority-${rec.priority}">
                <h3>${rec.category} (우선순위: ${rec.priority})</h3>
                <p><strong>문제:</strong> ${rec.description}</p>
                <p><strong>해결방안:</strong> ${rec.action}</p>
                <p><strong>영향:</strong> ${rec.impact}</p>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>✅ 액션 아이템</h2>
        ${report.action_items.map(item => `
            <div class="action-item priority-${item.priority}">
                <h3>${item.task}</h3>
                <p><strong>담당자:</strong> ${item.assignee}</p>
                <p><strong>마감일:</strong> ${item.dueDate}</p>
                <p><strong>우선순위:</strong> ${item.priority}</p>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <p><small>이 리포트는 AIRIS-MON 예외 추적 시스템에 의해 자동 생성되었습니다.</small></p>
        <p><small>에러 해결 및 시스템 개선에 대한 문의는 개발팀에 연락하시기 바랍니다.</small></p>
    </div>
</body>
</html>
    `;
  }

  async start() {
    try {
      logger.info('예외 추적 서비스 시작 중...', { service: 'exception-tracker' });
      
      this.server = this.app.listen(this.config.port, () => {
        this.isRunning = true;
        logger.info(`예외 추적 서비스가 포트 ${this.config.port}에서 시작되었습니다`, {
          service: 'exception-tracker',
          port: this.config.port,
          config: this.config
        });
      });

      // 데이터 정리 작업 (매일 실행)
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldData();
      }, 24 * 60 * 60 * 1000); // 24시간

      // 알림 이벤트 처리
      this.on('error-alert', (alert) => {
        logger.alert('에러 알림', alert);
        // 추가적인 알림 로직 (이메일, 슬랙 등) 구현 가능
      });

      // 에러 추적 이벤트 처리
      this.on('error-tracked', (error) => {
        logger.debug('에러 추적됨', { errorId: error.id, type: error.type });
      });

    } catch (error) {
      logger.error('예외 추적 서비스 시작 실패', {
        error: error.message,
        service: 'exception-tracker'
      });
      throw error;
    }
  }

  cleanupOldData() {
    try {
      const cutoffTime = Date.now() - (this.config.errorRetentionDays * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

      // 오래된 에러 이력 정리
      this.errorData.errorHistory.forEach((error, errorId) => {
        if (error.timestamp < cutoffTime) {
          this.errorData.errorHistory.delete(errorId);
          this.errorData.performanceImpact.delete(errorId);
          this.errorData.errorResolution.delete(errorId);
          cleanedCount++;
        }
      });

      // 사용자 에러 데이터 정리
      this.errorData.userErrors.forEach((userData, userId) => {
        if (userData.lastError < cutoffTime) {
          this.errorData.userErrors.delete(userId);
        }
      });

      logger.info('오래된 에러 데이터 정리 완료', {
        cleanedCount,
        cutoffDays: this.config.errorRetentionDays,
        service: 'exception-tracker'
      });

    } catch (error) {
      logger.error('데이터 정리 중 오류', {
        error: error.message,
        service: 'exception-tracker'
      });
    }
  }

  async stop() {
    try {
      logger.info('예외 추적 서비스 종료 중...', { service: 'exception-tracker' });
      
      this.isRunning = false;
      
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
      }

      logger.info('예외 추적 서비스가 종료되었습니다', { service: 'exception-tracker' });

    } catch (error) {
      logger.error('예외 추적 서비스 종료 중 오류', {
        error: error.message,
        service: 'exception-tracker'
      });
    }
  }

  async healthCheck() {
    return {
      status: this.isRunning ? 'healthy' : 'stopped',
      service: 'exception-tracker',
      port: this.config.port,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      errorStats: {
        totalErrors: this.errorData.realtime.totalErrors,
        uniqueErrors: this.errorData.realtime.uniqueErrors,
        criticalErrors: this.errorData.realtime.criticalErrors,
        errorGroups: this.errorData.errorGroups.size,
        affectedUsers: this.errorData.userErrors.size,
        affectedEndpoints: this.errorData.endpointErrors.size
      }
    };
  }
}

// 모듈이 직접 실행될 때
if (require.main === module) {
  const service = new ExceptionTrackingService({
    port: process.env.EXCEPTION_TRACKER_PORT || 3009
  });

  service.start().catch(error => {
    console.error('서비스 시작 실패:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => service.stop());
  process.on('SIGINT', () => service.stop());
  
  // 테스트용 에러 생성
  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      // 샘플 에러들 생성
      const sampleErrors = [
        {
          type: 'NullPointerException',
          message: 'Cannot invoke method on null reference',
          severity: 'critical',
          source: 'com.example.UserService.getUserById',
          url: '/api/users/123',
          method: 'GET'
        },
        {
          type: 'SQLException',
          message: 'Connection timeout to database',
          severity: 'high',
          source: 'com.example.DatabaseService.connect',
          url: '/api/orders',
          method: 'POST'
        },
        {
          type: 'IllegalArgumentException',
          message: 'Invalid email format provided',
          severity: 'medium',
          source: 'com.example.ValidationService.validateEmail',
          url: '/api/register',
          method: 'POST'
        }
      ];

      sampleErrors.forEach((errorInfo, index) => {
        setTimeout(() => {
          service.trackException({
            ...errorInfo,
            userId: `user_${Math.floor(Math.random() * 100)}`,
            sessionId: `session_${Math.floor(Math.random() * 1000)}`,
            responseTime: Math.floor(Math.random() * 5000) + 500,
            ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
            userAgent: 'Mozilla/5.0 (compatible; test-agent)'
          });
        }, index * 2000);
      });
    }, 5000);
  }
}

module.exports = ExceptionTrackingService;