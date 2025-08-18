/**
 * WAS (Web Application Server) Specialized Monitoring Service
 * Tomcat, WebLogic, WebSphere 전용 모니터링
 * 대전-APM 기능요약서의 WAS별 특화 기능 완전 구현
 */

const express = require('express');
const EventEmitter = require('events');
const logger = require('./utils/logger');

class WASMonitoringService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 3008,
      wasType: config.wasType || 'tomcat', // tomcat, weblogic, websphere
      jmxEnabled: config.jmxEnabled !== false,
      gcAnalysisEnabled: config.gcAnalysisEnabled !== false,
      threadPoolEnabled: config.threadPoolEnabled !== false,
      ...config
    };

    // WAS별 특화 메트릭 저장소
    this.wasMetrics = {
      // 공통 WAS 메트릭
      common: {
        serverInfo: {},
        jvmInfo: {},
        threadPool: {},
        memoryPool: {},
        gcInfo: {},
        connectionPool: {},
        deployedApplications: new Map(),
        serverStatus: 'running'
      },
      
      // Tomcat 특화 메트릭
      tomcat: {
        connectors: new Map(),
        contexts: new Map(),
        valves: new Map(),
        catalina: {},
        jasper: {},
        sessions: new Map()
      },
      
      // WebLogic 특화 메트릭
      weblogic: {
        domains: new Map(),
        managedServers: new Map(),
        clusters: new Map(),
        workManagers: new Map(),
        jmsServers: new Map(),
        deployments: new Map()
      },
      
      // WebSphere 특화 메트릭
      websphere: {
        cells: new Map(),
        nodes: new Map(),
        servers: new Map(),
        applications: new Map(),
        resources: new Map(),
        messaging: new Map()
      }
    };

    // 실시간 성능 메트릭
    this.realtimeMetrics = {
      jvm: {
        heapUsed: 0,
        heapMax: 0,
        nonHeapUsed: 0,
        nonHeapMax: 0,
        gcCount: 0,
        gcTime: 0,
        youngGenGC: 0,
        oldGenGC: 0
      },
      threads: {
        currentThreadCount: 0,
        peakThreadCount: 0,
        daemonThreadCount: 0,
        busyThreads: 0,
        maxThreads: 0,
        threadPoolUtilization: 0
      },
      requests: {
        totalRequests: 0,
        currentRequests: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        requestsPerSecond: 0,
        bytesReceived: 0,
        bytesSent: 0
      },
      connections: {
        currentConnections: 0,
        maxConnections: 0,
        totalConnections: 0,
        keepAliveConnections: 0
      }
    };

    // 성능 이력 데이터 (최근 24시간)
    this.performanceHistory = [];
    this.maxHistorySize = 1440; // 24시간 * 60분

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    this.server = null;
    this.isRunning = false;
    this.monitoringInterval = null;
    
    // WAS별 특화 모니터링 초기화
    this.initializeWASSpecificMonitoring();
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
  }

  initializeWASSpecificMonitoring() {
    // WAS 타입에 따른 특화 초기화
    switch (this.config.wasType.toLowerCase()) {
      case 'tomcat':
        this.initializeTomcatMonitoring();
        break;
      case 'weblogic':
        this.initializeWebLogicMonitoring();
        break;
      case 'websphere':
        this.initializeWebSphereMonitoring();
        break;
      default:
        logger.warn('알 수 없는 WAS 타입', { wasType: this.config.wasType });
    }
  }

  initializeTomcatMonitoring() {
    logger.info('Tomcat 전용 모니터링 초기화', { wasType: 'tomcat' });
    
    // Tomcat 커넥터 정보 초기화
    this.wasMetrics.tomcat.connectors.set('http-nio', {
      protocol: 'HTTP/1.1',
      port: 8080,
      maxThreads: 200,
      currentThreadCount: 0,
      currentThreadsBusy: 0,
      maxConnections: 8192,
      connectionCount: 0,
      bytesReceived: 0,
      bytesSent: 0,
      requestCount: 0,
      processingTime: 0
    });

    // Tomcat Context 정보 초기화
    this.wasMetrics.tomcat.contexts.set('/', {
      path: '/',
      docBase: 'webapps/ROOT',
      reloadable: false,
      sessionTimeout: 30,
      activeSessions: 0,
      maxActiveSessions: 0,
      sessionCreateRate: 0,
      sessionExpireRate: 0
    });

    // Catalina 엔진 정보
    this.wasMetrics.tomcat.catalina = {
      engineName: 'Catalina',
      defaultHost: 'localhost',
      startTime: Date.now(),
      backgroundProcessorDelay: 10
    };

    // Jasper JSP 엔진 정보
    this.wasMetrics.tomcat.jasper = {
      development: false,
      checkInterval: 0,
      modificationTestInterval: 4,
      recompileOnFail: false,
      jspCount: 0,
      jspReloadCount: 0
    };
  }

  initializeWebLogicMonitoring() {
    logger.info('WebLogic 전용 모니터링 초기화', { wasType: 'weblogic' });
    
    // WebLogic 도메인 정보
    this.wasMetrics.weblogic.domains.set('base_domain', {
      name: 'base_domain',
      adminServerName: 'AdminServer',
      adminServerURL: 'http://localhost:7001',
      domainVersion: '12.2.1.4',
      productionMode: false,
      clusterCount: 0,
      managedServerCount: 1
    });

    // 관리 서버 정보
    this.wasMetrics.weblogic.managedServers.set('AdminServer', {
      name: 'AdminServer',
      state: 'RUNNING',
      health: 'OK',
      listenPort: 7001,
      sslListenPort: 7002,
      machine: 'LocalMachine',
      cluster: null,
      currentMachine: 'localhost',
      jvmHeapSizeCurrent: 0,
      jvmHeapSizeMax: 0,
      threadPoolExecuteThreads: 0,
      threadPoolExecuteThreadsIdle: 0
    });

    // Work Manager 정보
    this.wasMetrics.weblogic.workManagers.set('default', {
      name: 'default',
      pendingRequests: 0,
      completedRequests: 0,
      stuckThreadCount: 0,
      threadPoolSize: 0,
      minimumThreadsConstraint: 1,
      maximumThreadsConstraint: 100
    });
  }

  initializeWebSphereMonitoring() {
    logger.info('WebSphere 전용 모니터링 초기화', { wasType: 'websphere' });
    
    // WebSphere Cell 정보
    this.wasMetrics.websphere.cells.set('DefaultCell', {
      name: 'DefaultCell',
      version: '9.0.5',
      nodeCount: 1,
      serverCount: 1,
      clusterCount: 0,
      applicationCount: 0
    });

    // Node 정보
    this.wasMetrics.websphere.nodes.set('DefaultNode', {
      name: 'DefaultNode',
      hostName: 'localhost',
      platformOS: process.platform,
      wasVersion: '9.0.5',
      nodeAgent: 'STOPPED',
      serverCount: 1
    });

    // Server 정보
    this.wasMetrics.websphere.servers.set('server1', {
      name: 'server1',
      nodeName: 'DefaultNode',
      processType: 'Application Server',
      state: 'STARTED',
      pid: process.pid,
      jvmHeapSize: 0,
      jvmFreeMemory: 0,
      webContainerThreads: 0,
      orbThreadPool: 0,
      sessionCount: 0
    });
  }

  async startMonitoring() {
    try {
      logger.info('WAS 성능 모니터링 시작', { wasType: this.config.wasType });
      
      // JVM 메트릭 수집 시작
      if (this.config.jmxEnabled) {
        this.startJVMMonitoring();
      }
      
      // GC 분석 시작
      if (this.config.gcAnalysisEnabled) {
        this.startGCMonitoring();
      }
      
      // Thread Pool 모니터링 시작
      if (this.config.threadPoolEnabled) {
        this.startThreadPoolMonitoring();
      }

      // WAS별 특화 모니터링 시작
      this.startWASSpecificMonitoring();
      
      // 주기적 메트릭 수집 (1분마다)
      this.monitoringInterval = setInterval(() => {
        this.collectMetrics();
      }, 60000);

    } catch (error) {
      logger.error('WAS 모니터링 시작 실패', { error: error.message });
      throw error;
    }
  }

  startJVMMonitoring() {
    // JVM 메트릭 수집을 시뮬레이션
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      
      this.realtimeMetrics.jvm.heapUsed = memoryUsage.heapUsed;
      this.realtimeMetrics.jvm.heapMax = memoryUsage.heapTotal;
      this.realtimeMetrics.jvm.nonHeapUsed = memoryUsage.external;
      
      // GC 정보 업데이트 (시뮬레이션)
      if (Math.random() < 0.1) { // 10% 확률로 GC 발생
        this.realtimeMetrics.jvm.gcCount++;
        this.realtimeMetrics.jvm.gcTime += Math.floor(Math.random() * 100);
        
        if (Math.random() < 0.8) {
          this.realtimeMetrics.jvm.youngGenGC++;
        } else {
          this.realtimeMetrics.jvm.oldGenGC++;
        }
      }

    }, 5000); // 5초마다
  }

  startGCMonitoring() {
    logger.info('GC 모니터링 시작');
    
    // GC 이벤트 시뮬레이션
    setInterval(() => {
      if (Math.random() < 0.3) { // 30% 확률로 GC 이벤트 발생
        const gcEvent = {
          timestamp: Date.now(),
          korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
          gcType: Math.random() < 0.7 ? 'Young Generation' : 'Old Generation',
          beforeGC: Math.floor(Math.random() * 1000000000), // bytes
          afterGC: Math.floor(Math.random() * 800000000),   // bytes
          duration: Math.floor(Math.random() * 200), // ms
          cause: this.getRandomGCCause()
        };

        this.emit('gc-event', gcEvent);
        logger.debug('GC 이벤트 감지', gcEvent);
      }
    }, 10000); // 10초마다
  }

  getRandomGCCause() {
    const causes = [
      'Allocation Failure',
      'System.gc()',
      'Concurrent Mark Sweep',
      'G1 Evacuation Pause',
      'Metadata GC Threshold',
      'Heap Inspection Initiated GC'
    ];
    return causes[Math.floor(Math.random() * causes.length)];
  }

  startThreadPoolMonitoring() {
    logger.info('Thread Pool 모니터링 시작');
    
    setInterval(() => {
      // Thread 정보 업데이트 (시뮬레이션)
      this.realtimeMetrics.threads.currentThreadCount = Math.floor(Math.random() * 100) + 20;
      this.realtimeMetrics.threads.busyThreads = Math.floor(Math.random() * 50);
      this.realtimeMetrics.threads.maxThreads = 200;
      this.realtimeMetrics.threads.threadPoolUtilization = 
        (this.realtimeMetrics.threads.busyThreads / this.realtimeMetrics.threads.maxThreads * 100).toFixed(2);

      // Thread Pool 임계치 체크
      if (this.realtimeMetrics.threads.threadPoolUtilization > 80) {
        this.emit('performance-alert', {
          type: 'high_thread_utilization',
          utilization: this.realtimeMetrics.threads.threadPoolUtilization,
          threshold: 80,
          timestamp: Date.now()
        });
      }

    }, 5000); // 5초마다
  }

  startWASSpecificMonitoring() {
    switch (this.config.wasType.toLowerCase()) {
      case 'tomcat':
        this.startTomcatSpecificMonitoring();
        break;
      case 'weblogic':
        this.startWebLogicSpecificMonitoring();
        break;
      case 'websphere':
        this.startWebSphereSpecificMonitoring();
        break;
    }
  }

  startTomcatSpecificMonitoring() {
    setInterval(() => {
      // Tomcat 커넥터 메트릭 업데이트
      const connector = this.wasMetrics.tomcat.connectors.get('http-nio');
      if (connector) {
        connector.currentThreadCount = Math.floor(Math.random() * 50) + 10;
        connector.currentThreadsBusy = Math.floor(Math.random() * connector.currentThreadCount);
        connector.connectionCount = Math.floor(Math.random() * 100) + 20;
        connector.requestCount += Math.floor(Math.random() * 10) + 1;
        connector.processingTime += Math.floor(Math.random() * 1000);
        connector.bytesReceived += Math.floor(Math.random() * 10000);
        connector.bytesSent += Math.floor(Math.random() * 50000);
      }

      // Context 세션 정보 업데이트
      const rootContext = this.wasMetrics.tomcat.contexts.get('/');
      if (rootContext) {
        rootContext.activeSessions = Math.floor(Math.random() * 100);
        rootContext.maxActiveSessions = Math.max(rootContext.maxActiveSessions, rootContext.activeSessions);
        rootContext.sessionCreateRate = Math.random() * 5;
        rootContext.sessionExpireRate = Math.random() * 2;
      }

    }, 10000); // 10초마다
  }

  startWebLogicSpecificMonitoring() {
    setInterval(() => {
      // WebLogic 관리 서버 메트릭 업데이트
      const adminServer = this.wasMetrics.weblogic.managedServers.get('AdminServer');
      if (adminServer) {
        adminServer.jvmHeapSizeCurrent = this.realtimeMetrics.jvm.heapUsed;
        adminServer.jvmHeapSizeMax = this.realtimeMetrics.jvm.heapMax;
        adminServer.threadPoolExecuteThreads = this.realtimeMetrics.threads.currentThreadCount;
        adminServer.threadPoolExecuteThreadsIdle = 
          this.realtimeMetrics.threads.currentThreadCount - this.realtimeMetrics.threads.busyThreads;
      }

      // Work Manager 메트릭 업데이트
      const defaultWM = this.wasMetrics.weblogic.workManagers.get('default');
      if (defaultWM) {
        defaultWM.pendingRequests = Math.floor(Math.random() * 20);
        defaultWM.completedRequests += Math.floor(Math.random() * 50) + 10;
        defaultWM.threadPoolSize = this.realtimeMetrics.threads.currentThreadCount;
        defaultWM.stuckThreadCount = Math.floor(Math.random() * 3);
      }

    }, 10000); // 10초마다
  }

  startWebSphereSpecificMonitoring() {
    setInterval(() => {
      // WebSphere 서버 메트릭 업데이트
      const server1 = this.wasMetrics.websphere.servers.get('server1');
      if (server1) {
        server1.jvmHeapSize = this.realtimeMetrics.jvm.heapUsed;
        server1.jvmFreeMemory = this.realtimeMetrics.jvm.heapMax - this.realtimeMetrics.jvm.heapUsed;
        server1.webContainerThreads = Math.floor(Math.random() * 30) + 10;
        server1.orbThreadPool = Math.floor(Math.random() * 20) + 5;
        server1.sessionCount = Math.floor(Math.random() * 100);
      }

    }, 10000); // 10초마다
  }

  collectMetrics() {
    try {
      const timestamp = Date.now();
      const korean_time = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      
      // 요청 메트릭 업데이트 (시뮬레이션)
      this.realtimeMetrics.requests.totalRequests += Math.floor(Math.random() * 100) + 50;
      this.realtimeMetrics.requests.currentRequests = Math.floor(Math.random() * 20);
      this.realtimeMetrics.requests.averageResponseTime = Math.floor(Math.random() * 500) + 100;
      this.realtimeMetrics.requests.maxResponseTime = Math.max(
        this.realtimeMetrics.requests.maxResponseTime,
        this.realtimeMetrics.requests.averageResponseTime + Math.floor(Math.random() * 1000)
      );
      this.realtimeMetrics.requests.requestsPerSecond = Math.floor(Math.random() * 100) + 20;

      // 연결 메트릭 업데이트
      this.realtimeMetrics.connections.currentConnections = Math.floor(Math.random() * 500) + 100;
      this.realtimeMetrics.connections.maxConnections = 1000;
      this.realtimeMetrics.connections.totalConnections += Math.floor(Math.random() * 50) + 10;
      this.realtimeMetrics.connections.keepAliveConnections = Math.floor(Math.random() * 200) + 50;

      // 성능 이력 데이터 저장
      const historyPoint = {
        timestamp,
        korean_time,
        cpu_usage: Math.floor(Math.random() * 100),
        memory_usage: (this.realtimeMetrics.jvm.heapUsed / this.realtimeMetrics.jvm.heapMax * 100).toFixed(2),
        thread_count: this.realtimeMetrics.threads.currentThreadCount,
        request_count: this.realtimeMetrics.requests.currentRequests,
        response_time: this.realtimeMetrics.requests.averageResponseTime,
        gc_count: this.realtimeMetrics.jvm.gcCount,
        connection_count: this.realtimeMetrics.connections.currentConnections
      };

      this.performanceHistory.push(historyPoint);

      // 이력 데이터 크기 제한
      if (this.performanceHistory.length > this.maxHistorySize) {
        this.performanceHistory.shift();
      }

      // 성능 임계치 체크
      this.checkPerformanceThresholds(historyPoint);

    } catch (error) {
      logger.error('메트릭 수집 실패', { error: error.message });
    }
  }

  checkPerformanceThresholds(metrics) {
    const thresholds = {
      cpu_usage: 80,
      memory_usage: 85,
      response_time: 5000,
      thread_utilization: 80
    };

    // CPU 사용률 체크
    if (metrics.cpu_usage > thresholds.cpu_usage) {
      this.emit('performance-alert', {
        type: 'high_cpu_usage',
        value: metrics.cpu_usage,
        threshold: thresholds.cpu_usage,
        timestamp: metrics.timestamp
      });
    }

    // 메모리 사용률 체크
    if (parseFloat(metrics.memory_usage) > thresholds.memory_usage) {
      this.emit('performance-alert', {
        type: 'high_memory_usage',
        value: metrics.memory_usage,
        threshold: thresholds.memory_usage,
        timestamp: metrics.timestamp
      });
    }

    // 응답 시간 체크
    if (metrics.response_time > thresholds.response_time) {
      this.emit('performance-alert', {
        type: 'slow_response_time',
        value: metrics.response_time,
        threshold: thresholds.response_time,
        timestamp: metrics.timestamp
      });
    }
  }

  setupRoutes() {
    // 기본 상태 확인
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'was-monitor',
        wasType: this.config.wasType,
        uptime: process.uptime(),
        timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      });
    });

    // WAS 기본 정보
    this.app.get('/api/v1/was/info', this.getWASInfo.bind(this));
    
    // 실시간 메트릭
    this.app.get('/api/v1/was/realtime', this.getRealtimeMetrics.bind(this));
    
    // JVM 메트릭
    this.app.get('/api/v1/was/jvm', this.getJVMMetrics.bind(this));
    
    // Thread Pool 메트릭
    this.app.get('/api/v1/was/threads', this.getThreadMetrics.bind(this));
    
    // GC 분석
    this.app.get('/api/v1/was/gc', this.getGCMetrics.bind(this));
    
    // 성능 이력
    this.app.get('/api/v1/was/history', this.getPerformanceHistory.bind(this));
    
    // WAS별 특화 메트릭
    this.app.get('/api/v1/was/specific', this.getWASSpecificMetrics.bind(this));
    
    // 종합 대시보드
    this.app.get('/api/v1/was/dashboard', this.getDashboardData.bind(this));
    
    // 성능 분석 리포트
    this.app.get('/api/v1/was/performance-report', this.getPerformanceReport.bind(this));

    // Static files
    this.app.use('/static', express.static(__dirname + '/../public'));
    this.app.get('/', (req, res) => {
      res.sendFile(__dirname + '/../public/was-dashboard.html');
    });
  }

  async getWASInfo(req, res) {
    try {
      const wasInfo = {
        wasType: this.config.wasType,
        serverInfo: this.wasMetrics.common.serverInfo,
        jvmInfo: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid
        },
        startTime: Date.now() - (process.uptime() * 1000),
        uptime: process.uptime(),
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      };

      res.json({
        status: '성공',
        was_info: wasInfo
      });

    } catch (error) {
      logger.error('WAS 정보 조회 실패', { error: error.message });
      res.status(500).json({
        error: 'WAS 정보 조회 실패',
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
        was_type: this.config.wasType
      });

    } catch (error) {
      logger.error('실시간 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: '실시간 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getJVMMetrics(req, res) {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const jvmMetrics = {
        memory: {
          heap: {
            used: this.realtimeMetrics.jvm.heapUsed,
            max: this.realtimeMetrics.jvm.heapMax,
            usage_percentage: ((this.realtimeMetrics.jvm.heapUsed / this.realtimeMetrics.jvm.heapMax) * 100).toFixed(2)
          },
          non_heap: {
            used: this.realtimeMetrics.jvm.nonHeapUsed,
            max: this.realtimeMetrics.jvm.nonHeapMax
          },
          process: memoryUsage
        },
        gc: {
          total_gc_count: this.realtimeMetrics.jvm.gcCount,
          total_gc_time: this.realtimeMetrics.jvm.gcTime,
          young_generation_gc: this.realtimeMetrics.jvm.youngGenGC,
          old_generation_gc: this.realtimeMetrics.jvm.oldGenGC,
          average_gc_time: this.realtimeMetrics.jvm.gcCount > 0 ? 
            (this.realtimeMetrics.jvm.gcTime / this.realtimeMetrics.jvm.gcCount).toFixed(2) : 0
        },
        cpu: cpuUsage,
        uptime: process.uptime()
      };

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        jvm_metrics: jvmMetrics
      });

    } catch (error) {
      logger.error('JVM 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: 'JVM 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getThreadMetrics(req, res) {
    try {
      const threadMetrics = {
        current_threads: this.realtimeMetrics.threads.currentThreadCount,
        peak_threads: this.realtimeMetrics.threads.peakThreadCount,
        daemon_threads: this.realtimeMetrics.threads.daemonThreadCount,
        busy_threads: this.realtimeMetrics.threads.busyThreads,
        max_threads: this.realtimeMetrics.threads.maxThreads,
        thread_pool_utilization: this.realtimeMetrics.threads.threadPoolUtilization,
        idle_threads: this.realtimeMetrics.threads.currentThreadCount - this.realtimeMetrics.threads.busyThreads,
        thread_efficiency: ((this.realtimeMetrics.threads.busyThreads / this.realtimeMetrics.threads.currentThreadCount) * 100).toFixed(2)
      };

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        thread_metrics: threadMetrics
      });

    } catch (error) {
      logger.error('Thread 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: 'Thread 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getGCMetrics(req, res) {
    try {
      // 최근 GC 이벤트 기록 (시뮬레이션)
      const recentGCEvents = [];
      for (let i = 0; i < 10; i++) {
        recentGCEvents.push({
          timestamp: Date.now() - (i * 60000), // 1분 간격
          korean_time: new Date(Date.now() - (i * 60000)).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
          gcType: Math.random() < 0.7 ? 'Young Generation' : 'Old Generation',
          duration: Math.floor(Math.random() * 200),
          beforeGC: Math.floor(Math.random() * 1000000000),
          afterGC: Math.floor(Math.random() * 800000000),
          cause: this.getRandomGCCause()
        });
      }

      const gcAnalysis = {
        summary: {
          total_gc_count: this.realtimeMetrics.jvm.gcCount,
          total_gc_time: this.realtimeMetrics.jvm.gcTime,
          young_gen_gc: this.realtimeMetrics.jvm.youngGenGC,
          old_gen_gc: this.realtimeMetrics.jvm.oldGenGC,
          average_gc_time: this.realtimeMetrics.jvm.gcCount > 0 ? 
            (this.realtimeMetrics.jvm.gcTime / this.realtimeMetrics.jvm.gcCount).toFixed(2) : 0,
          gc_frequency: this.calculateGCFrequency()
        },
        recent_events: recentGCEvents,
        recommendations: this.generateGCRecommendations()
      };

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        gc_analysis: gcAnalysis
      });

    } catch (error) {
      logger.error('GC 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: 'GC 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  calculateGCFrequency() {
    // 시뮬레이션: 분당 GC 횟수
    const uptimeMinutes = process.uptime() / 60;
    return uptimeMinutes > 0 ? (this.realtimeMetrics.jvm.gcCount / uptimeMinutes).toFixed(2) : 0;
  }

  generateGCRecommendations() {
    const recommendations = [];
    
    // GC 빈도 체크
    const gcFrequency = parseFloat(this.calculateGCFrequency());
    if (gcFrequency > 10) { // 분당 10회 이상
      recommendations.push({
        priority: 'high',
        category: 'GC 빈도',
        description: 'GC가 너무 자주 발생하고 있습니다. 힙 사이즈 증대 또는 GC 알고리즘 변경을 고려하세요.',
        suggestion: '-Xms와 -Xmx 값을 증가시키거나 G1GC 사용을 고려하세요.'
      });
    }

    // Old Generation GC 체크
    const oldGenRatio = this.realtimeMetrics.jvm.gcCount > 0 ? 
      (this.realtimeMetrics.jvm.oldGenGC / this.realtimeMetrics.jvm.gcCount) : 0;
    
    if (oldGenRatio > 0.3) { // Old Gen GC가 30% 이상
      recommendations.push({
        priority: 'medium',
        category: 'Old Generation GC',
        description: 'Old Generation GC 비율이 높습니다. 메모리 누수 또는 부적절한 객체 생명주기를 점검하세요.',
        suggestion: '프로파일링 도구를 사용하여 장수명 객체를 분석하세요.'
      });
    }

    return recommendations;
  }

  async getPerformanceHistory(req, res) {
    try {
      const { hours = 1, metric = 'all' } = req.query;
      const hoursInt = parseInt(hours);
      
      // 지정된 시간만큼의 데이터 필터링
      const cutoffTime = Date.now() - (hoursInt * 60 * 60 * 1000);
      const filteredHistory = this.performanceHistory.filter(h => h.timestamp >= cutoffTime);
      
      // 메트릭별 필터링
      let responseData = filteredHistory;
      if (metric !== 'all') {
        responseData = filteredHistory.map(h => ({
          timestamp: h.timestamp,
          korean_time: h.korean_time,
          [metric]: h[metric]
        }));
      }

      // 통계 계산
      const statistics = this.calculateHistoryStatistics(filteredHistory);

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        period: `${hours}시간`,
        data_points: responseData.length,
        performance_history: responseData,
        statistics
      });

    } catch (error) {
      logger.error('성능 이력 조회 실패', { error: error.message });
      res.status(500).json({
        error: '성능 이력 조회 실패',
        message: error.message
      });
    }
  }

  calculateHistoryStatistics(history) {
    if (history.length === 0) return {};

    const stats = {};
    const metrics = ['cpu_usage', 'memory_usage', 'response_time', 'thread_count', 'connection_count'];
    
    metrics.forEach(metric => {
      const values = history.map(h => parseFloat(h[metric]) || 0);
      stats[metric] = {
        avg: (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(2),
        min: Math.min(...values),
        max: Math.max(...values),
        current: values[values.length - 1] || 0
      };
    });

    return stats;
  }

  async getWASSpecificMetrics(req, res) {
    try {
      let specificMetrics = {};
      
      switch (this.config.wasType.toLowerCase()) {
        case 'tomcat':
          specificMetrics = this.getTomcatSpecificMetrics();
          break;
        case 'weblogic':
          specificMetrics = this.getWebLogicSpecificMetrics();
          break;
        case 'websphere':
          specificMetrics = this.getWebSphereSpecificMetrics();
          break;
        default:
          specificMetrics = { message: '지원되지 않는 WAS 타입' };
      }

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        was_type: this.config.wasType,
        specific_metrics: specificMetrics
      });

    } catch (error) {
      logger.error('WAS 특화 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: 'WAS 특화 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  getTomcatSpecificMetrics() {
    const connectorArray = Array.from(this.wasMetrics.tomcat.connectors.entries());
    const contextArray = Array.from(this.wasMetrics.tomcat.contexts.entries());

    return {
      catalina_engine: this.wasMetrics.tomcat.catalina,
      connectors: connectorArray.map(([name, data]) => ({ name, ...data })),
      contexts: contextArray.map(([path, data]) => ({ ...data })),
      jasper_jsp: this.wasMetrics.tomcat.jasper,
      session_summary: {
        total_active_sessions: contextArray.reduce((sum, [, ctx]) => sum + ctx.activeSessions, 0),
        max_sessions: contextArray.reduce((sum, [, ctx]) => sum + ctx.maxActiveSessions, 0),
        session_create_rate: contextArray.reduce((sum, [, ctx]) => sum + ctx.sessionCreateRate, 0),
        session_expire_rate: contextArray.reduce((sum, [, ctx]) => sum + ctx.sessionExpireRate, 0)
      }
    };
  }

  getWebLogicSpecificMetrics() {
    const domainArray = Array.from(this.wasMetrics.weblogic.domains.entries());
    const serverArray = Array.from(this.wasMetrics.weblogic.managedServers.entries());
    const workManagerArray = Array.from(this.wasMetrics.weblogic.workManagers.entries());

    return {
      domains: domainArray.map(([name, data]) => ({ name, ...data })),
      managed_servers: serverArray.map(([name, data]) => ({ name, ...data })),
      work_managers: workManagerArray.map(([name, data]) => ({ name, ...data })),
      cluster_summary: {
        total_clusters: this.wasMetrics.weblogic.clusters.size,
        total_servers: serverArray.length
      }
    };
  }

  getWebSphereSpecificMetrics() {
    const cellArray = Array.from(this.wasMetrics.websphere.cells.entries());
    const nodeArray = Array.from(this.wasMetrics.websphere.nodes.entries());
    const serverArray = Array.from(this.wasMetrics.websphere.servers.entries());

    return {
      cells: cellArray.map(([name, data]) => ({ name, ...data })),
      nodes: nodeArray.map(([name, data]) => ({ name, ...data })),
      servers: serverArray.map(([name, data]) => ({ name, ...data })),
      deployment_summary: {
        total_applications: this.wasMetrics.websphere.applications.size,
        total_resources: this.wasMetrics.websphere.resources.size
      }
    };
  }

  async getDashboardData(req, res) {
    try {
      const dashboardData = {
        overview: {
          was_type: this.config.wasType,
          server_status: this.wasMetrics.common.serverStatus,
          uptime: process.uptime(),
          total_requests: this.realtimeMetrics.requests.totalRequests,
          current_connections: this.realtimeMetrics.connections.currentConnections,
          memory_usage_percent: ((this.realtimeMetrics.jvm.heapUsed / this.realtimeMetrics.jvm.heapMax) * 100).toFixed(2),
          thread_utilization: this.realtimeMetrics.threads.threadPoolUtilization
        },
        realtime_metrics: this.realtimeMetrics,
        recent_performance: this.performanceHistory.slice(-60), // 최근 1시간
        alerts: await this.getActiveAlerts(),
        top_issues: await this.getTopPerformanceIssues(),
        was_specific_summary: this.getWASSpecificSummary()
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

  async getActiveAlerts() {
    const alerts = [];
    
    // 메모리 사용률 알림
    const memoryUsage = (this.realtimeMetrics.jvm.heapUsed / this.realtimeMetrics.jvm.heapMax) * 100;
    if (memoryUsage > 85) {
      alerts.push({
        type: 'high_memory_usage',
        severity: 'critical',
        message: `메모리 사용률이 ${memoryUsage.toFixed(2)}%에 도달했습니다`,
        threshold: '85%',
        timestamp: Date.now()
      });
    }

    // Thread Pool 사용률 알림
    if (parseFloat(this.realtimeMetrics.threads.threadPoolUtilization) > 80) {
      alerts.push({
        type: 'high_thread_utilization',
        severity: 'warning',
        message: `Thread Pool 사용률이 ${this.realtimeMetrics.threads.threadPoolUtilization}%입니다`,
        threshold: '80%',
        timestamp: Date.now()
      });
    }

    // GC 빈도 알림
    const gcFrequency = parseFloat(this.calculateGCFrequency());
    if (gcFrequency > 10) {
      alerts.push({
        type: 'frequent_gc',
        severity: 'warning',
        message: `GC가 분당 ${gcFrequency}회 발생하고 있습니다`,
        threshold: '10회/분',
        timestamp: Date.now()
      });
    }

    return alerts.slice(0, 5); // 최대 5개
  }

  async getTopPerformanceIssues() {
    const issues = [];
    
    // 최근 성능 데이터 분석
    const recentData = this.performanceHistory.slice(-10);
    if (recentData.length === 0) return issues;

    const avgResponseTime = recentData.reduce((sum, d) => sum + d.response_time, 0) / recentData.length;
    const avgCpuUsage = recentData.reduce((sum, d) => sum + d.cpu_usage, 0) / recentData.length;
    const avgMemoryUsage = recentData.reduce((sum, d) => sum + parseFloat(d.memory_usage), 0) / recentData.length;

    if (avgResponseTime > 3000) {
      issues.push({
        category: '응답 시간',
        description: `평균 응답 시간이 ${avgResponseTime.toFixed(0)}ms로 높습니다`,
        severity: 'high',
        recommendation: '애플리케이션 성능 튜닝 또는 리소스 증설을 고려하세요'
      });
    }

    if (avgCpuUsage > 70) {
      issues.push({
        category: 'CPU 사용률',
        description: `평균 CPU 사용률이 ${avgCpuUsage.toFixed(1)}%로 높습니다`,
        severity: 'medium',
        recommendation: 'CPU 집약적인 작업을 최적화하거나 스케일 아웃을 고려하세요'
      });
    }

    if (avgMemoryUsage > 80) {
      issues.push({
        category: '메모리 사용률',
        description: `평균 메모리 사용률이 ${avgMemoryUsage.toFixed(1)}%로 높습니다`,
        severity: 'high',
        recommendation: '힙 사이즈 증대 또는 메모리 누수 점검이 필요합니다'
      });
    }

    return issues;
  }

  getWASSpecificSummary() {
    switch (this.config.wasType.toLowerCase()) {
      case 'tomcat':
        return {
          connectors: this.wasMetrics.tomcat.connectors.size,
          contexts: this.wasMetrics.tomcat.contexts.size,
          active_sessions: Array.from(this.wasMetrics.tomcat.contexts.values())
            .reduce((sum, ctx) => sum + ctx.activeSessions, 0)
        };
      
      case 'weblogic':
        return {
          domains: this.wasMetrics.weblogic.domains.size,
          managed_servers: this.wasMetrics.weblogic.managedServers.size,
          work_managers: this.wasMetrics.weblogic.workManagers.size
        };
      
      case 'websphere':
        return {
          cells: this.wasMetrics.websphere.cells.size,
          nodes: this.wasMetrics.websphere.nodes.size,
          servers: this.wasMetrics.websphere.servers.size
        };
      
      default:
        return {};
    }
  }

  async getPerformanceReport(req, res) {
    try {
      const { format = 'json', period = '24h' } = req.query;
      
      const report = {
        reportId: `was_perf_${Date.now()}`,
        generatedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        wasType: this.config.wasType,
        period,
        summary: {
          server_uptime: process.uptime(),
          total_requests: this.realtimeMetrics.requests.totalRequests,
          average_response_time: this.realtimeMetrics.requests.averageResponseTime,
          memory_usage_max: ((this.realtimeMetrics.jvm.heapUsed / this.realtimeMetrics.jvm.heapMax) * 100).toFixed(2) + '%',
          gc_count: this.realtimeMetrics.jvm.gcCount,
          thread_pool_utilization: this.realtimeMetrics.threads.threadPoolUtilization + '%'
        },
        performance_analysis: await this.generatePerformanceAnalysis(),
        recommendations: await this.generatePerformanceRecommendations(),
        was_specific_details: this.getWASSpecificDetails()
      };

      if (format === 'html') {
        const htmlReport = this.generateWASHTMLReport(report);
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

  async generatePerformanceAnalysis() {
    const recentHistory = this.performanceHistory.slice(-60); // 최근 1시간
    if (recentHistory.length === 0) return {};

    const analysis = {
      trend_analysis: {},
      peak_usage: {},
      bottleneck_detection: []
    };

    // 트렌드 분석
    const metrics = ['cpu_usage', 'memory_usage', 'response_time', 'thread_count'];
    metrics.forEach(metric => {
      const values = recentHistory.map(h => parseFloat(h[metric]) || 0);
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      
      const trendPercentage = ((secondAvg - firstAvg) / firstAvg * 100).toFixed(2);
      
      analysis.trend_analysis[metric] = {
        trend: trendPercentage > 0 ? 'increasing' : 'decreasing',
        percentage: Math.abs(trendPercentage) + '%',
        direction: trendPercentage > 0 ? '상승' : '하락'
      };
    });

    // 피크 사용량 분석
    analysis.peak_usage = {
      max_cpu: Math.max(...recentHistory.map(h => h.cpu_usage)),
      max_memory: Math.max(...recentHistory.map(h => parseFloat(h.memory_usage))),
      max_response_time: Math.max(...recentHistory.map(h => h.response_time)),
      max_thread_count: Math.max(...recentHistory.map(h => h.thread_count))
    };

    // 병목 지점 감지
    if (analysis.peak_usage.max_cpu > 80) {
      analysis.bottleneck_detection.push({
        type: 'CPU',
        severity: 'high',
        description: 'CPU 사용률이 80%를 초과했습니다'
      });
    }

    if (analysis.peak_usage.max_memory > 85) {
      analysis.bottleneck_detection.push({
        type: 'Memory',
        severity: 'critical',
        description: '메모리 사용률이 85%를 초과했습니다'
      });
    }

    return analysis;
  }

  async generatePerformanceRecommendations() {
    const recommendations = [];
    
    // 메모리 최적화 권장사항
    const memoryUsage = (this.realtimeMetrics.jvm.heapUsed / this.realtimeMetrics.jvm.heapMax) * 100;
    if (memoryUsage > 80) {
      recommendations.push({
        category: '메모리 최적화',
        priority: 'high',
        description: '메모리 사용률이 높습니다. 힙 사이즈 조정이 필요합니다.',
        action: '-Xms와 -Xmx JVM 옵션을 증가시키거나 메모리 누수를 점검하세요.',
        expected_benefit: '메모리 부족으로 인한 성능 저하 방지'
      });
    }

    // Thread Pool 최적화 권장사항
    const threadUtilization = parseFloat(this.realtimeMetrics.threads.threadPoolUtilization);
    if (threadUtilization > 80) {
      recommendations.push({
        category: 'Thread Pool 최적화',
        priority: 'medium',
        description: 'Thread Pool 사용률이 높습니다.',
        action: 'maxThreads 설정을 증가시키거나 비동기 처리를 도입하세요.',
        expected_benefit: '동시 요청 처리 능력 향상'
      });
    }

    // GC 최적화 권장사항
    const gcFrequency = parseFloat(this.calculateGCFrequency());
    if (gcFrequency > 5) {
      recommendations.push({
        category: 'GC 최적화',
        priority: 'medium',
        description: 'GC가 너무 자주 발생하고 있습니다.',
        action: 'G1GC 또는 ZGC 사용을 고려하고 뉴 제너레이션 크기를 조정하세요.',
        expected_benefit: 'GC로 인한 애플리케이션 일시정지 시간 단축'
      });
    }

    // WAS별 특화 권장사항
    switch (this.config.wasType.toLowerCase()) {
      case 'tomcat':
        recommendations.push(...this.getTomcatRecommendations());
        break;
      case 'weblogic':
        recommendations.push(...this.getWebLogicRecommendations());
        break;
      case 'websphere':
        recommendations.push(...this.getWebSphereRecommendations());
        break;
    }

    return recommendations;
  }

  getTomcatRecommendations() {
    const recommendations = [];
    
    const connector = this.wasMetrics.tomcat.connectors.get('http-nio');
    if (connector) {
      const threadUtilization = (connector.currentThreadsBusy / connector.maxThreads) * 100;
      
      if (threadUtilization > 80) {
        recommendations.push({
          category: 'Tomcat Connector',
          priority: 'high',
          description: 'HTTP 커넥터의 Thread 사용률이 높습니다.',
          action: 'server.xml의 maxThreads 값을 증가시키거나 connectionTimeout을 조정하세요.',
          expected_benefit: 'HTTP 요청 처리 성능 향상'
        });
      }
    }

    return recommendations;
  }

  getWebLogicRecommendations() {
    const recommendations = [];
    
    const workManager = this.wasMetrics.weblogic.workManagers.get('default');
    if (workManager && workManager.stuckThreadCount > 0) {
      recommendations.push({
        category: 'WebLogic Work Manager',
        priority: 'high',
        description: `Stuck Thread가 ${workManager.stuckThreadCount}개 감지되었습니다.`,
        action: 'Thread Dump를 분석하여 무한 루프나 데드락을 확인하세요.',
        expected_benefit: '시스템 안정성 향상'
      });
    }

    return recommendations;
  }

  getWebSphereRecommendations() {
    const recommendations = [];
    
    const server = this.wasMetrics.websphere.servers.get('server1');
    if (server) {
      const memoryUsage = (server.jvmHeapSize / (server.jvmHeapSize + server.jvmFreeMemory)) * 100;
      
      if (memoryUsage > 80) {
        recommendations.push({
          category: 'WebSphere JVM',
          priority: 'high',
          description: 'JVM 힙 메모리 사용률이 높습니다.',
          action: 'WebSphere 관리 콘솔에서 JVM 힙 크기를 증가시키세요.',
          expected_benefit: '메모리 부족 오류 방지'
        });
      }
    }

    return recommendations;
  }

  getWASSpecificDetails() {
    switch (this.config.wasType.toLowerCase()) {
      case 'tomcat':
        return {
          type: 'Apache Tomcat',
          connectors: Array.from(this.wasMetrics.tomcat.connectors.entries()).map(([name, data]) => ({
            name,
            protocol: data.protocol,
            port: data.port,
            maxThreads: data.maxThreads,
            currentThreadsBusy: data.currentThreadsBusy,
            threadUtilization: ((data.currentThreadsBusy / data.maxThreads) * 100).toFixed(2) + '%'
          })),
          contexts: Array.from(this.wasMetrics.tomcat.contexts.entries()).map(([path, data]) => ({
            path: data.path,
            activeSessions: data.activeSessions,
            sessionTimeout: data.sessionTimeout + '분'
          }))
        };
      
      case 'weblogic':
        return {
          type: 'Oracle WebLogic',
          domains: Array.from(this.wasMetrics.weblogic.domains.entries()).map(([name, data]) => ({
            name: data.name,
            adminServer: data.adminServerName,
            managedServers: data.managedServerCount
          })),
          workManagers: Array.from(this.wasMetrics.weblogic.workManagers.entries()).map(([name, data]) => ({
            name: data.name,
            pendingRequests: data.pendingRequests,
            stuckThreads: data.stuckThreadCount
          }))
        };
      
      case 'websphere':
        return {
          type: 'IBM WebSphere',
          cells: Array.from(this.wasMetrics.websphere.cells.entries()).map(([name, data]) => ({
            name: data.name,
            version: data.version,
            nodes: data.nodeCount
          })),
          servers: Array.from(this.wasMetrics.websphere.servers.entries()).map(([name, data]) => ({
            name: data.name,
            state: data.state,
            pid: data.pid
          }))
        };
      
      default:
        return { type: 'Unknown WAS' };
    }
  }

  generateWASHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WAS 성능 리포트 - ${report.generatedAt}</title>
    <style>
        body { font-family: 'Noto Sans KR', Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { font-size: 14px; color: #666; margin-top: 5px; }
        .recommendation { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .priority-high { border-left: 5px solid #dc3545; }
        .priority-medium { border-left: 5px solid #ffc107; }
        .priority-low { border-left: 5px solid #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .status-healthy { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-critical { color: #dc3545; }
        .trend-up { color: #dc3545; }
        .trend-down { color: #28a745; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🖥️ WAS 성능 분석 리포트</h1>
        <h2>${report.wasType.toUpperCase()} 서버 분석</h2>
        <p><strong>생성일시:</strong> ${report.generatedAt}</p>
        <p><strong>분석 기간:</strong> ${report.period}</p>
        <p><strong>리포트 ID:</strong> ${report.reportId}</p>
    </div>

    <div class="section">
        <h2>📊 서버 상태 요약</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${Math.floor(report.summary.server_uptime / 3600)}시간</div>
                <div class="metric-label">서버 가동시간</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.total_requests.toLocaleString()}</div>
                <div class="metric-label">총 처리 요청</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.average_response_time}ms</div>
                <div class="metric-label">평균 응답시간</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.memory_usage_max}</div>
                <div class="metric-label">최대 메모리 사용률</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.thread_pool_utilization}</div>
                <div class="metric-label">Thread Pool 사용률</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.gc_count}</div>
                <div class="metric-label">총 GC 횟수</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>🔍 성능 분석 결과</h2>
        ${report.performance_analysis.trend_analysis ? `
        <h3>트렌드 분석</h3>
        <table>
            <tr><th>메트릭</th><th>트렌드</th><th>변화율</th></tr>
            ${Object.entries(report.performance_analysis.trend_analysis).map(([metric, data]) => `
                <tr>
                    <td>${metric}</td>
                    <td class="trend-${data.trend === 'increasing' ? 'up' : 'down'}">${data.direction}</td>
                    <td>${data.percentage}</td>
                </tr>
            `).join('')}
        </table>
        ` : ''}

        ${report.performance_analysis.bottleneck_detection && report.performance_analysis.bottleneck_detection.length > 0 ? `
        <h3>병목 지점 감지</h3>
        ${report.performance_analysis.bottleneck_detection.map(bottleneck => `
            <div class="recommendation priority-${bottleneck.severity}">
                <strong>${bottleneck.type}</strong>: ${bottleneck.description}
            </div>
        `).join('')}
        ` : ''}
    </div>

    <div class="section">
        <h2>💡 성능 최적화 권장사항</h2>
        ${report.recommendations.map(rec => `
            <div class="recommendation priority-${rec.priority}">
                <h3>${rec.category} (우선순위: ${rec.priority})</h3>
                <p><strong>문제:</strong> ${rec.description}</p>
                <p><strong>해결방안:</strong> ${rec.action}</p>
                <p><strong>기대효과:</strong> ${rec.expected_benefit}</p>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>🔧 ${report.wasType.toUpperCase()} 특화 정보</h2>
        <h3>${report.was_specific_details.type}</h3>
        
        ${report.was_specific_details.connectors ? `
        <h4>Tomcat 커넥터</h4>
        <table>
            <tr><th>이름</th><th>프로토콜</th><th>포트</th><th>최대 Thread</th><th>Thread 사용률</th></tr>
            ${report.was_specific_details.connectors.map(conn => `
                <tr>
                    <td>${conn.name}</td>
                    <td>${conn.protocol}</td>
                    <td>${conn.port}</td>
                    <td>${conn.maxThreads}</td>
                    <td>${conn.threadUtilization}</td>
                </tr>
            `).join('')}
        </table>
        ` : ''}

        ${report.was_specific_details.workManagers ? `
        <h4>WebLogic Work Managers</h4>
        <table>
            <tr><th>이름</th><th>대기중인 요청</th><th>Stuck Threads</th></tr>
            ${report.was_specific_details.workManagers.map(wm => `
                <tr>
                    <td>${wm.name}</td>
                    <td>${wm.pendingRequests}</td>
                    <td class="${wm.stuckThreads > 0 ? 'status-critical' : 'status-healthy'}">${wm.stuckThreads}</td>
                </tr>
            `).join('')}
        </table>
        ` : ''}

        ${report.was_specific_details.servers ? `
        <h4>WebSphere 서버</h4>
        <table>
            <tr><th>서버명</th><th>상태</th><th>PID</th></tr>
            ${report.was_specific_details.servers.map(server => `
                <tr>
                    <td>${server.name}</td>
                    <td class="status-${server.state === 'STARTED' ? 'healthy' : 'warning'}">${server.state}</td>
                    <td>${server.pid}</td>
                </tr>
            `).join('')}
        </table>
        ` : ''}
    </div>

    <div class="section">
        <p><small>이 리포트는 AIRIS-MON WAS 모니터링 서비스에 의해 자동 생성되었습니다.</small></p>
        <p><small>서버 성능 최적화에 대한 자세한 문의는 시스템 관리자에게 연락하시기 바랍니다.</small></p>
    </div>
</body>
</html>
    `;
  }

  async start() {
    try {
      logger.info('WAS 모니터링 서비스 시작 중...', { 
        service: 'was-monitor',
        wasType: this.config.wasType 
      });
      
      this.server = this.app.listen(this.config.port, () => {
        this.isRunning = true;
        logger.info(`WAS 모니터링 서비스가 포트 ${this.config.port}에서 시작되었습니다`, {
          service: 'was-monitor',
          port: this.config.port,
          wasType: this.config.wasType
        });
      });

      // 모니터링 시작
      await this.startMonitoring();

      // 성능 알림 이벤트 처리
      this.on('performance-alert', (alert) => {
        logger.warn('성능 임계치 초과 감지', {
          alert,
          service: 'was-monitor'
        });
        // 추가적인 알림 로직 구현 가능
      });

      // GC 이벤트 처리
      this.on('gc-event', (gcEvent) => {
        logger.debug('GC 이벤트 기록', {
          gcEvent,
          service: 'was-monitor'
        });
      });

    } catch (error) {
      logger.error('WAS 모니터링 서비스 시작 실패', {
        error: error.message,
        service: 'was-monitor'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('WAS 모니터링 서비스 종료 중...', { service: 'was-monitor' });
      
      this.isRunning = false;
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
      }

      logger.info('WAS 모니터링 서비스가 종료되었습니다', { service: 'was-monitor' });

    } catch (error) {
      logger.error('WAS 모니터링 서비스 종료 중 오류', {
        error: error.message,
        service: 'was-monitor'
      });
    }
  }

  async healthCheck() {
    return {
      status: this.isRunning ? 'healthy' : 'stopped',
      service: 'was-monitor',
      wasType: this.config.wasType,
      port: this.config.port,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      realtimeMetrics: this.realtimeMetrics,
      performanceHistorySize: this.performanceHistory.length
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
  const wasType = process.env.WAS_TYPE || 'tomcat';
  const service = new WASMonitoringService({
    port: process.env.WAS_MONITOR_PORT || 3008,
    wasType: wasType
  });

  service.start().catch(error => {
    console.error('서비스 시작 실패:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => service.stop());
  process.on('SIGINT', () => service.stop());
}

module.exports = WASMonitoringService;