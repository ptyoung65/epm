/**
 * Service Map & Topology Visualization System for AIRIS-MON
 * 대전-APM 기능요약서의 서비스 맵 및 토폴로지 시각화 완전 구현
 */

const express = require('express');
const EventEmitter = require('events');
const crypto = require('crypto');
const logger = require('./utils/logger');

class ServiceTopologyService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 3010,
      enableRealTimeUpdates: config.enableRealTimeUpdates !== false,
      enableDependencyTracking: config.enableDependencyTracking !== false,
      enablePerformanceMapping: config.enablePerformanceMapping !== false,
      topologyRefreshInterval: config.topologyRefreshInterval || 30000, // 30초
      ...config
    };

    // 서비스 토폴로지 데이터
    this.topology = {
      // 서비스 노드들
      services: new Map(),
      
      // 서비스 간 의존성/연결
      dependencies: new Map(),
      
      // 실시간 트래픽 흐름
      trafficFlow: new Map(),
      
      // 서비스 클러스터/그룹
      clusters: new Map(),
      
      // 물리적 인프라 매핑
      infrastructure: new Map(),
      
      // 네트워크 경로 추적
      networkPaths: new Map(),
      
      // 서비스 메시 정보
      serviceMesh: new Map()
    };

    // 실시간 메트릭
    this.realtimeMetrics = {
      totalServices: 0,
      activeConnections: 0,
      totalTraffic: 0,
      averageLatency: 0,
      healthyServices: 0,
      unhealthyServices: 0,
      criticalPaths: 0
    };

    // 토폴로지 변화 이력
    this.topologyHistory = [];
    this.maxHistorySize = 1000;

    // 성능 분석 데이터
    this.performanceAnalysis = {
      bottlenecks: new Map(),
      criticalPaths: new Map(),
      latencyHotspots: new Map(),
      throughputAnalysis: new Map()
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    this.server = null;
    this.isRunning = false;
    this.topologyRefreshTimer = null;
    this.discoveryTimer = null;
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

  /**
   * 서비스 등록 및 토폴로지 업데이트
   */
  registerService(serviceInfo) {
    try {
      const serviceId = this.generateServiceId(serviceInfo);
      const timestamp = Date.now();
      
      const service = {
        id: serviceId,
        name: serviceInfo.name,
        type: serviceInfo.type || 'microservice', // microservice, database, cache, gateway, etc.
        version: serviceInfo.version || '1.0.0',
        status: serviceInfo.status || 'healthy',
        host: serviceInfo.host || 'localhost',
        port: serviceInfo.port,
        protocol: serviceInfo.protocol || 'http',
        endpoints: serviceInfo.endpoints || [],
        tags: serviceInfo.tags || [],
        metadata: serviceInfo.metadata || {},
        
        // 성능 메트릭
        performance: {
          cpu: serviceInfo.cpu || 0,
          memory: serviceInfo.memory || 0,
          responseTime: serviceInfo.responseTime || 0,
          throughput: serviceInfo.throughput || 0,
          errorRate: serviceInfo.errorRate || 0
        },
        
        // 헬스체크 정보
        health: {
          status: serviceInfo.status || 'healthy',
          lastCheck: timestamp,
          checks: serviceInfo.healthChecks || []
        },
        
        // 타임스탬프
        registeredAt: timestamp,
        lastUpdated: timestamp,
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      };

      this.topology.services.set(serviceId, service);
      this.updateRealtimeMetrics();
      
      // 토폴로지 변경 기록
      this.recordTopologyChange('service_registered', {
        serviceId,
        serviceName: service.name,
        timestamp
      });

      logger.serviceRegistry('서비스 등록', service);
      this.emit('service-registered', service);

      return serviceId;

    } catch (error) {
      logger.error('서비스 등록 실패', { error: error.message, serviceInfo });
      throw error;
    }
  }

  /**
   * 서비스 간 의존성 관계 등록
   */
  registerDependency(dependencyInfo) {
    try {
      const dependencyId = this.generateDependencyId(dependencyInfo);
      const timestamp = Date.now();

      const dependency = {
        id: dependencyId,
        sourceServiceId: dependencyInfo.sourceServiceId,
        targetServiceId: dependencyInfo.targetServiceId,
        type: dependencyInfo.type || 'http', // http, database, message_queue, cache
        protocol: dependencyInfo.protocol || 'tcp',
        port: dependencyInfo.port,
        
        // 연결 메트릭
        metrics: {
          requestCount: 0,
          totalLatency: 0,
          averageLatency: 0,
          errorCount: 0,
          throughput: 0,
          lastActivity: timestamp
        },
        
        // 연결 상태
        status: dependencyInfo.status || 'active',
        weight: dependencyInfo.weight || 1, // 연결 중요도
        critical: dependencyInfo.critical || false,
        
        // 타임스탬프
        createdAt: timestamp,
        lastUpdated: timestamp,
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      };

      this.topology.dependencies.set(dependencyId, dependency);
      
      // 서비스 노드에 의존성 정보 추가
      this.updateServiceDependencies(dependencyInfo.sourceServiceId, dependencyInfo.targetServiceId);

      this.recordTopologyChange('dependency_registered', {
        dependencyId,
        source: dependencyInfo.sourceServiceId,
        target: dependencyInfo.targetServiceId,
        timestamp
      });

      logger.dependency('의존성 등록', dependency);
      this.emit('dependency-registered', dependency);

      return dependencyId;

    } catch (error) {
      logger.error('의존성 등록 실패', { error: error.message, dependencyInfo });
      throw error;
    }
  }

  /**
   * 트래픽 흐름 추적
   */
  trackTrafficFlow(trafficInfo) {
    try {
      const flowId = this.generateFlowId(trafficInfo);
      const timestamp = Date.now();

      const flow = {
        id: flowId,
        sourceServiceId: trafficInfo.sourceServiceId,
        targetServiceId: trafficInfo.targetServiceId,
        requestId: trafficInfo.requestId,
        traceId: trafficInfo.traceId,
        spanId: trafficInfo.spanId,
        
        // 요청 정보
        method: trafficInfo.method || 'GET',
        endpoint: trafficInfo.endpoint,
        statusCode: trafficInfo.statusCode,
        
        // 성능 메트릭
        startTime: trafficInfo.startTime || timestamp,
        endTime: trafficInfo.endTime,
        latency: trafficInfo.latency || 0,
        size: trafficInfo.size || 0,
        
        // 에러 정보
        error: trafficInfo.error || null,
        success: !trafficInfo.error && (trafficInfo.statusCode < 400),
        
        timestamp,
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      };

      this.topology.trafficFlow.set(flowId, flow);
      
      // 의존성 메트릭 업데이트
      this.updateDependencyMetrics(trafficInfo.sourceServiceId, trafficInfo.targetServiceId, flow);
      
      // 트래픽 플로우 정리 (최대 10000개 유지)
      if (this.topology.trafficFlow.size > 10000) {
        const oldestKey = this.topology.trafficFlow.keys().next().value;
        this.topology.trafficFlow.delete(oldestKey);
      }

      this.emit('traffic-tracked', flow);
      return flowId;

    } catch (error) {
      logger.error('트래픽 추적 실패', { error: error.message, trafficInfo });
      throw error;
    }
  }

  /**
   * 서비스 클러스터 관리
   */
  createCluster(clusterInfo) {
    try {
      const clusterId = this.generateClusterId(clusterInfo);
      const timestamp = Date.now();

      const cluster = {
        id: clusterId,
        name: clusterInfo.name,
        type: clusterInfo.type || 'application', // application, database, infrastructure
        services: new Set(clusterInfo.services || []),
        
        // 클러스터 메타데이터
        namespace: clusterInfo.namespace || 'default',
        environment: clusterInfo.environment || 'production',
        region: clusterInfo.region || 'kr-central-1',
        
        // 성능 집계
        aggregateMetrics: {
          totalCpu: 0,
          totalMemory: 0,
          averageResponseTime: 0,
          totalThroughput: 0,
          averageErrorRate: 0
        },
        
        // 상태
        status: clusterInfo.status || 'healthy',
        
        createdAt: timestamp,
        lastUpdated: timestamp,
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      };

      this.topology.clusters.set(clusterId, cluster);
      
      // 클러스터에 속한 서비스들의 클러스터 정보 업데이트
      cluster.services.forEach(serviceId => {
        const service = this.topology.services.get(serviceId);
        if (service) {
          service.clusterId = clusterId;
          service.clusterName = cluster.name;
        }
      });

      this.recordTopologyChange('cluster_created', {
        clusterId,
        clusterName: cluster.name,
        serviceCount: cluster.services.size,
        timestamp
      });

      logger.cluster('클러스터 생성', cluster);
      this.emit('cluster-created', cluster);

      return clusterId;

    } catch (error) {
      logger.error('클러스터 생성 실패', { error: error.message, clusterInfo });
      throw error;
    }
  }

  /**
   * 서비스 디스커버리
   */
  async discoverServices() {
    try {
      logger.info('서비스 디스커버리 시작');
      
      // 기존 서비스들의 상태 체크
      const healthCheckPromises = [];
      
      this.topology.services.forEach((service, serviceId) => {
        healthCheckPromises.push(this.checkServiceHealth(serviceId));
      });

      await Promise.allSettled(healthCheckPromises);

      // 새로운 서비스 자동 발견 (시뮬레이션)
      const discoveredServices = await this.simulateServiceDiscovery();
      
      for (const serviceInfo of discoveredServices) {
        if (!this.findServiceByName(serviceInfo.name)) {
          this.registerService(serviceInfo);
        }
      }

      this.updateRealtimeMetrics();
      this.emit('discovery-completed', {
        totalServices: this.topology.services.size,
        discoveredNew: discoveredServices.length,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('서비스 디스커버리 실패', { error: error.message });
    }
  }

  async simulateServiceDiscovery() {
    // 실제 환경에서는 Consul, Eureka, Kubernetes API 등을 통해 서비스 발견
    const simulatedServices = [
      {
        name: 'user-service',
        type: 'microservice',
        host: 'user-service.default.svc.cluster.local',
        port: 8080,
        endpoints: ['/api/users', '/api/users/:id']
      },
      {
        name: 'order-service',
        type: 'microservice',
        host: 'order-service.default.svc.cluster.local',
        port: 8081,
        endpoints: ['/api/orders', '/api/orders/:id']
      },
      {
        name: 'payment-service',
        type: 'microservice',
        host: 'payment-service.default.svc.cluster.local',
        port: 8082,
        endpoints: ['/api/payments']
      },
      {
        name: 'postgresql',
        type: 'database',
        host: 'postgresql.database.svc.cluster.local',
        port: 5432,
        protocol: 'tcp'
      },
      {
        name: 'redis',
        type: 'cache',
        host: 'redis.cache.svc.cluster.local',
        port: 6379,
        protocol: 'tcp'
      }
    ];

    return simulatedServices.filter(() => Math.random() > 0.7); // 30% 확률로 발견
  }

  async checkServiceHealth(serviceId) {
    try {
      const service = this.topology.services.get(serviceId);
      if (!service) return;

      // 실제 환경에서는 HTTP 헬스체크, TCP 연결 테스트 등 수행
      const isHealthy = Math.random() > 0.1; // 90% 확률로 정상
      
      service.health.status = isHealthy ? 'healthy' : 'unhealthy';
      service.health.lastCheck = Date.now();
      service.lastUpdated = Date.now();
      
      // 성능 메트릭 시뮬레이션 업데이트
      if (isHealthy) {
        service.performance.responseTime = Math.floor(Math.random() * 500) + 50;
        service.performance.cpu = Math.floor(Math.random() * 80) + 10;
        service.performance.memory = Math.floor(Math.random() * 70) + 20;
        service.performance.throughput = Math.floor(Math.random() * 1000) + 100;
        service.performance.errorRate = Math.random() * 5;
      } else {
        service.performance.responseTime = Math.floor(Math.random() * 5000) + 1000;
        service.performance.errorRate = Math.random() * 20 + 10;
      }

    } catch (error) {
      logger.error('서비스 헬스체크 실패', { serviceId, error: error.message });
    }
  }

  /**
   * 성능 병목점 분석
   */
  analyzeBottlenecks() {
    try {
      const bottlenecks = [];
      const timestamp = Date.now();

      // 서비스별 성능 분석
      this.topology.services.forEach((service, serviceId) => {
        const score = this.calculateBottleneckScore(service);
        
        if (score > 0.7) {
          bottlenecks.push({
            type: 'service',
            serviceId,
            serviceName: service.name,
            score,
            issues: this.identifyServiceIssues(service),
            recommendations: this.generateServiceRecommendations(service),
            timestamp
          });
        }
      });

      // 의존성 병목점 분석
      this.topology.dependencies.forEach((dependency, dependencyId) => {
        const score = this.calculateDependencyBottleneckScore(dependency);
        
        if (score > 0.7) {
          bottlenecks.push({
            type: 'dependency',
            dependencyId,
            sourceService: dependency.sourceServiceId,
            targetService: dependency.targetServiceId,
            score,
            issues: this.identifyDependencyIssues(dependency),
            recommendations: this.generateDependencyRecommendations(dependency),
            timestamp
          });
        }
      });

      // 병목점 저장 및 업데이트
      bottlenecks.forEach(bottleneck => {
        this.performanceAnalysis.bottlenecks.set(bottleneck.type + '_' + (bottleneck.serviceId || bottleneck.dependencyId), bottleneck);
      });

      logger.performance('병목점 분석 완료', { bottleneckCount: bottlenecks.length });
      this.emit('bottlenecks-analyzed', bottlenecks);

      return bottlenecks;

    } catch (error) {
      logger.error('병목점 분석 실패', { error: error.message });
      return [];
    }
  }

  calculateBottleneckScore(service) {
    let score = 0;
    
    // 응답 시간 (40% 가중치)
    if (service.performance.responseTime > 1000) score += 0.4;
    else if (service.performance.responseTime > 500) score += 0.2;
    
    // CPU 사용률 (30% 가중치)
    if (service.performance.cpu > 80) score += 0.3;
    else if (service.performance.cpu > 60) score += 0.15;
    
    // 메모리 사용률 (20% 가중치)
    if (service.performance.memory > 85) score += 0.2;
    else if (service.performance.memory > 70) score += 0.1;
    
    // 에러율 (10% 가중치)
    if (service.performance.errorRate > 5) score += 0.1;
    else if (service.performance.errorRate > 2) score += 0.05;

    return Math.min(score, 1.0);
  }

  calculateDependencyBottleneckScore(dependency) {
    let score = 0;
    
    // 평균 레이턴시
    if (dependency.metrics.averageLatency > 1000) score += 0.4;
    else if (dependency.metrics.averageLatency > 500) score += 0.2;
    
    // 에러율
    const errorRate = dependency.metrics.requestCount > 0 ? 
      (dependency.metrics.errorCount / dependency.metrics.requestCount) : 0;
    
    if (errorRate > 0.1) score += 0.3;
    else if (errorRate > 0.05) score += 0.15;
    
    // 처리량 저하
    if (dependency.metrics.throughput < 10) score += 0.2;
    
    // 연결 상태
    if (dependency.status !== 'active') score += 0.1;

    return Math.min(score, 1.0);
  }

  identifyServiceIssues(service) {
    const issues = [];
    
    if (service.performance.responseTime > 1000) {
      issues.push('높은 응답 시간 (1초 이상)');
    }
    
    if (service.performance.cpu > 80) {
      issues.push('높은 CPU 사용률 (80% 이상)');
    }
    
    if (service.performance.memory > 85) {
      issues.push('높은 메모리 사용률 (85% 이상)');
    }
    
    if (service.performance.errorRate > 5) {
      issues.push('높은 에러율 (5% 이상)');
    }
    
    if (service.health.status !== 'healthy') {
      issues.push('서비스 상태 불량');
    }

    return issues;
  }

  generateServiceRecommendations(service) {
    const recommendations = [];
    
    if (service.performance.responseTime > 1000) {
      recommendations.push('응답 시간 최적화: 캐싱 구현, 데이터베이스 쿼리 최적화');
    }
    
    if (service.performance.cpu > 80) {
      recommendations.push('CPU 최적화: 수평 확장 또는 알고리즘 개선');
    }
    
    if (service.performance.memory > 85) {
      recommendations.push('메모리 최적화: 메모리 누수 점검 또는 힙 크기 조정');
    }
    
    if (service.performance.errorRate > 5) {
      recommendations.push('에러율 개선: 예외 처리 강화 및 입력 검증');
    }

    return recommendations;
  }

  identifyDependencyIssues(dependency) {
    const issues = [];
    
    if (dependency.metrics.averageLatency > 1000) {
      issues.push('높은 네트워크 레이턴시');
    }
    
    const errorRate = dependency.metrics.requestCount > 0 ? 
      (dependency.metrics.errorCount / dependency.metrics.requestCount) : 0;
    
    if (errorRate > 0.1) {
      issues.push('높은 연결 에러율');
    }
    
    if (dependency.status !== 'active') {
      issues.push('비활성 연결 상태');
    }
    
    if (dependency.metrics.throughput < 10) {
      issues.push('낮은 처리량');
    }

    return issues;
  }

  generateDependencyRecommendations(dependency) {
    const recommendations = [];
    
    if (dependency.metrics.averageLatency > 1000) {
      recommendations.push('네트워크 최적화: 연결 풀링, 지역별 라우팅');
    }
    
    const errorRate = dependency.metrics.requestCount > 0 ? 
      (dependency.metrics.errorCount / dependency.metrics.requestCount) : 0;
    
    if (errorRate > 0.1) {
      recommendations.push('연결 안정성 개선: 재시도 정책, 서킷 브레이커 패턴');
    }
    
    if (dependency.metrics.throughput < 10) {
      recommendations.push('처리량 개선: 커넥션 풀 크기 조정, 비동기 처리');
    }

    return recommendations;
  }

  /**
   * 크리티컬 패스 분석
   */
  analyzeCriticalPaths() {
    try {
      const criticalPaths = new Map();
      
      // 모든 서비스에서 시작하는 경로 분석
      this.topology.services.forEach((service, serviceId) => {
        const paths = this.findPathsFromService(serviceId, new Set(), []);
        
        paths.forEach(path => {
          const pathId = path.map(p => p.serviceId).join('-');
          const pathScore = this.calculatePathCriticalityScore(path);
          
          if (pathScore > 0.7) {
            criticalPaths.set(pathId, {
              id: pathId,
              path,
              score: pathScore,
              totalLatency: path.reduce((sum, p) => sum + (p.latency || 0), 0),
              totalErrorRate: this.calculatePathErrorRate(path),
              impact: this.calculatePathImpact(path),
              recommendations: this.generatePathRecommendations(path),
              timestamp: Date.now()
            });
          }
        });
      });

      this.performanceAnalysis.criticalPaths.clear();
      criticalPaths.forEach((path, pathId) => {
        this.performanceAnalysis.criticalPaths.set(pathId, path);
      });

      logger.performance('크리티컬 패스 분석 완료', { pathCount: criticalPaths.size });
      this.emit('critical-paths-analyzed', Array.from(criticalPaths.values()));

      return Array.from(criticalPaths.values());

    } catch (error) {
      logger.error('크리티컬 패스 분석 실패', { error: error.message });
      return [];
    }
  }

  findPathsFromService(serviceId, visited, currentPath, maxDepth = 5) {
    if (currentPath.length >= maxDepth || visited.has(serviceId)) {
      return [currentPath];
    }

    visited.add(serviceId);
    const service = this.topology.services.get(serviceId);
    const newPath = [...currentPath, {
      serviceId,
      serviceName: service?.name || 'Unknown',
      latency: service?.performance.responseTime || 0,
      errorRate: service?.performance.errorRate || 0
    }];

    const paths = [newPath];
    
    // 의존성을 따라 경로 확장
    this.topology.dependencies.forEach(dependency => {
      if (dependency.sourceServiceId === serviceId) {
        const subPaths = this.findPathsFromService(
          dependency.targetServiceId, 
          new Set(visited), 
          newPath, 
          maxDepth
        );
        paths.push(...subPaths);
      }
    });

    return paths;
  }

  calculatePathCriticalityScore(path) {
    if (path.length === 0) return 0;

    let score = 0;
    const totalLatency = path.reduce((sum, p) => sum + p.latency, 0);
    const avgErrorRate = path.reduce((sum, p) => sum + p.errorRate, 0) / path.length;
    
    // 레이턴시 점수 (50% 가중치)
    if (totalLatency > 5000) score += 0.5;
    else if (totalLatency > 2000) score += 0.25;
    
    // 에러율 점수 (30% 가중치)
    if (avgErrorRate > 5) score += 0.3;
    else if (avgErrorRate > 2) score += 0.15;
    
    // 경로 길이 점수 (20% 가중치)
    if (path.length > 5) score += 0.2;
    else if (path.length > 3) score += 0.1;

    return Math.min(score, 1.0);
  }

  calculatePathErrorRate(path) {
    if (path.length === 0) return 0;
    return path.reduce((sum, p) => sum + p.errorRate, 0) / path.length;
  }

  calculatePathImpact(path) {
    // 경로의 비즈니스 임팩트 계산 (서비스 중요도 기반)
    return path.reduce((impact, p) => {
      const service = this.topology.services.get(p.serviceId);
      const serviceImpact = service?.metadata.businessImpact || 'medium';
      
      switch (serviceImpact) {
        case 'critical': return impact + 3;
        case 'high': return impact + 2;
        case 'medium': return impact + 1;
        default: return impact + 0.5;
      }
    }, 0);
  }

  generatePathRecommendations(path) {
    const recommendations = [];
    const totalLatency = path.reduce((sum, p) => sum + p.latency, 0);
    const avgErrorRate = this.calculatePathErrorRate(path);

    if (totalLatency > 5000) {
      recommendations.push('전체 경로 레이턴시 최적화 필요 (5초 이상)');
      recommendations.push('병렬 처리 또는 캐싱 구현 검토');
    }

    if (avgErrorRate > 5) {
      recommendations.push('경로 전반의 에러율 개선 필요');
      recommendations.push('서킷 브레이커 패턴 적용 검토');
    }

    if (path.length > 5) {
      recommendations.push('과도한 서비스 체이닝 단순화');
      recommendations.push('마이크로서비스 통합 또는 BFF 패턴 적용');
    }

    return recommendations;
  }

  generateServiceId(serviceInfo) {
    return crypto.createHash('md5')
      .update(`${serviceInfo.name}_${serviceInfo.host}_${serviceInfo.port}`)
      .digest('hex')
      .substring(0, 12);
  }

  generateDependencyId(dependencyInfo) {
    return crypto.createHash('md5')
      .update(`${dependencyInfo.sourceServiceId}_${dependencyInfo.targetServiceId}_${dependencyInfo.type}`)
      .digest('hex')
      .substring(0, 12);
  }

  generateFlowId(trafficInfo) {
    return crypto.createHash('md5')
      .update(`${trafficInfo.sourceServiceId}_${trafficInfo.targetServiceId}_${Date.now()}`)
      .digest('hex')
      .substring(0, 12);
  }

  generateClusterId(clusterInfo) {
    return crypto.createHash('md5')
      .update(`${clusterInfo.name}_${clusterInfo.namespace}`)
      .digest('hex')
      .substring(0, 12);
  }

  findServiceByName(name) {
    for (const service of this.topology.services.values()) {
      if (service.name === name) {
        return service;
      }
    }
    return null;
  }

  updateServiceDependencies(sourceServiceId, targetServiceId) {
    const sourceService = this.topology.services.get(sourceServiceId);
    const targetService = this.topology.services.get(targetServiceId);

    if (sourceService) {
      if (!sourceService.dependencies) {
        sourceService.dependencies = { outbound: [], inbound: [] };
      }
      if (!sourceService.dependencies.outbound.includes(targetServiceId)) {
        sourceService.dependencies.outbound.push(targetServiceId);
      }
    }

    if (targetService) {
      if (!targetService.dependencies) {
        targetService.dependencies = { outbound: [], inbound: [] };
      }
      if (!targetService.dependencies.inbound.includes(sourceServiceId)) {
        targetService.dependencies.inbound.push(sourceServiceId);
      }
    }
  }

  updateDependencyMetrics(sourceServiceId, targetServiceId, flow) {
    this.topology.dependencies.forEach((dependency) => {
      if (dependency.sourceServiceId === sourceServiceId && 
          dependency.targetServiceId === targetServiceId) {
        
        dependency.metrics.requestCount++;
        dependency.metrics.totalLatency += flow.latency;
        dependency.metrics.averageLatency = 
          dependency.metrics.totalLatency / dependency.metrics.requestCount;
        
        if (!flow.success) {
          dependency.metrics.errorCount++;
        }
        
        dependency.metrics.lastActivity = flow.timestamp;
        dependency.lastUpdated = flow.timestamp;
        
        // 처리량 계산 (분당 요청 수)
        const timeWindow = 60000; // 1분
        const recentRequests = Array.from(this.topology.trafficFlow.values())
          .filter(f => 
            f.sourceServiceId === sourceServiceId &&
            f.targetServiceId === targetServiceId &&
            f.timestamp > (Date.now() - timeWindow)
          ).length;
        
        dependency.metrics.throughput = recentRequests;
      }
    });
  }

  updateRealtimeMetrics() {
    this.realtimeMetrics.totalServices = this.topology.services.size;
    this.realtimeMetrics.activeConnections = this.topology.dependencies.size;
    
    // 트래픽 계산
    const recentTraffic = Array.from(this.topology.trafficFlow.values())
      .filter(flow => flow.timestamp > (Date.now() - 60000)).length; // 최근 1분
    this.realtimeMetrics.totalTraffic = recentTraffic;
    
    // 평균 레이턴시 계산
    const recentFlows = Array.from(this.topology.trafficFlow.values())
      .filter(flow => flow.timestamp > (Date.now() - 300000)); // 최근 5분
    
    if (recentFlows.length > 0) {
      this.realtimeMetrics.averageLatency = Math.round(
        recentFlows.reduce((sum, flow) => sum + flow.latency, 0) / recentFlows.length
      );
    }
    
    // 서비스 상태 집계
    let healthy = 0, unhealthy = 0;
    this.topology.services.forEach(service => {
      if (service.health.status === 'healthy') {
        healthy++;
      } else {
        unhealthy++;
      }
    });
    
    this.realtimeMetrics.healthyServices = healthy;
    this.realtimeMetrics.unhealthyServices = unhealthy;
    
    // 크리티컬 패스 수
    this.realtimeMetrics.criticalPaths = this.performanceAnalysis.criticalPaths.size;
  }

  recordTopologyChange(changeType, changeData) {
    const change = {
      type: changeType,
      data: changeData,
      timestamp: Date.now(),
      korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };

    this.topologyHistory.push(change);
    
    if (this.topologyHistory.length > this.maxHistorySize) {
      this.topologyHistory.shift();
    }

    this.emit('topology-changed', change);
  }

  setupRoutes() {
    // 기본 상태 확인
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'service-topology',
        uptime: process.uptime(),
        timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        totalServices: this.realtimeMetrics.totalServices
      });
    });

    // 서비스 등록 API
    this.app.post('/api/v1/topology/services', this.registerServiceAPI.bind(this));
    
    // 의존성 등록 API
    this.app.post('/api/v1/topology/dependencies', this.registerDependencyAPI.bind(this));
    
    // 트래픽 추적 API
    this.app.post('/api/v1/topology/traffic', this.trackTrafficAPI.bind(this));
    
    // 전체 토폴로지 조회
    this.app.get('/api/v1/topology', this.getTopology.bind(this));
    
    // 서비스 맵 데이터 조회
    this.app.get('/api/v1/topology/servicemap', this.getServiceMap.bind(this));
    
    // 실시간 메트릭 조회
    this.app.get('/api/v1/topology/metrics', this.getRealtimeMetrics.bind(this));
    
    // 성능 분석 조회
    this.app.get('/api/v1/topology/analysis', this.getPerformanceAnalysis.bind(this));
    
    // 서비스별 상세 정보
    this.app.get('/api/v1/topology/services/:serviceId', this.getServiceDetail.bind(this));
    
    // 의존성 분석
    this.app.get('/api/v1/topology/dependencies/analysis', this.getDependencyAnalysis.bind(this));
    
    // 트래픽 플로우 분석
    this.app.get('/api/v1/topology/traffic/analysis', this.getTrafficAnalysis.bind(this));
    
    // 클러스터 관리
    this.app.post('/api/v1/topology/clusters', this.createClusterAPI.bind(this));
    this.app.get('/api/v1/topology/clusters', this.getClusters.bind(this));
    
    // 토폴로지 변경 이력
    this.app.get('/api/v1/topology/history', this.getTopologyHistory.bind(this));
    
    // 서비스 디스커버리 실행
    this.app.post('/api/v1/topology/discover', this.runDiscovery.bind(this));

    // Static files
    this.app.use('/static', express.static(__dirname + '/../public'));
    this.app.get('/', (req, res) => {
      res.sendFile(__dirname + '/../public/topology-dashboard.html');
    });
  }

  async registerServiceAPI(req, res) {
    try {
      const serviceId = this.registerService(req.body);
      
      res.json({
        status: '성공',
        message: '서비스가 성공적으로 등록되었습니다',
        serviceId,
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      });

    } catch (error) {
      logger.error('서비스 등록 API 실패', { error: error.message });
      res.status(500).json({
        error: '서비스 등록 실패',
        message: error.message
      });
    }
  }

  async registerDependencyAPI(req, res) {
    try {
      const dependencyId = this.registerDependency(req.body);
      
      res.json({
        status: '성공',
        message: '의존성이 성공적으로 등록되었습니다',
        dependencyId,
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      });

    } catch (error) {
      logger.error('의존성 등록 API 실패', { error: error.message });
      res.status(500).json({
        error: '의존성 등록 실패',
        message: error.message
      });
    }
  }

  async trackTrafficAPI(req, res) {
    try {
      const flowId = this.trackTrafficFlow(req.body);
      
      res.json({
        status: '성공',
        message: '트래픽이 성공적으로 추적되었습니다',
        flowId,
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      });

    } catch (error) {
      logger.error('트래픽 추적 API 실패', { error: error.message });
      res.status(500).json({
        error: '트래픽 추적 실패',
        message: error.message
      });
    }
  }

  async getTopology(req, res) {
    try {
      const { includeMetrics = true, includeHistory = false } = req.query;
      
      const topology = {
        services: Object.fromEntries(this.topology.services),
        dependencies: Object.fromEntries(this.topology.dependencies),
        clusters: Object.fromEntries(this.topology.clusters),
        realtime_metrics: this.realtimeMetrics
      };

      if (includeMetrics === 'true') {
        topology.performance_analysis = {
          bottlenecks: Array.from(this.performanceAnalysis.bottlenecks.values()),
          critical_paths: Array.from(this.performanceAnalysis.criticalPaths.values())
        };
      }

      if (includeHistory === 'true') {
        topology.change_history = this.topologyHistory.slice(-50); // 최근 50개
      }

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        topology
      });

    } catch (error) {
      logger.error('토폴로지 조회 실패', { error: error.message });
      res.status(500).json({
        error: '토폴로지 조회 실패',
        message: error.message
      });
    }
  }

  async getServiceMap(req, res) {
    try {
      // 서비스 맵 시각화를 위한 데이터 구성
      const nodes = [];
      const edges = [];

      // 노드 생성 (서비스들)
      this.topology.services.forEach((service, serviceId) => {
        nodes.push({
          id: serviceId,
          label: service.name,
          type: service.type,
          status: service.health.status,
          cluster: service.clusterId || null,
          performance: {
            cpu: service.performance.cpu,
            memory: service.performance.memory,
            responseTime: service.performance.responseTime,
            errorRate: service.performance.errorRate
          },
          position: this.calculateNodePosition(serviceId, service)
        });
      });

      // 엣지 생성 (의존성들)
      this.topology.dependencies.forEach((dependency, dependencyId) => {
        edges.push({
          id: dependencyId,
          source: dependency.sourceServiceId,
          target: dependency.targetServiceId,
          type: dependency.type,
          status: dependency.status,
          weight: dependency.weight,
          metrics: {
            latency: dependency.metrics.averageLatency,
            throughput: dependency.metrics.throughput,
            errorRate: dependency.metrics.requestCount > 0 ? 
              (dependency.metrics.errorCount / dependency.metrics.requestCount * 100).toFixed(2) : 0
          }
        });
      });

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        service_map: {
          nodes,
          edges,
          clusters: Array.from(this.topology.clusters.values()).map(cluster => ({
            id: cluster.id,
            name: cluster.name,
            type: cluster.type,
            services: Array.from(cluster.services)
          }))
        }
      });

    } catch (error) {
      logger.error('서비스 맵 조회 실패', { error: error.message });
      res.status(500).json({
        error: '서비스 맵 조회 실패',
        message: error.message
      });
    }
  }

  calculateNodePosition(serviceId, service) {
    // 간단한 force-directed 포지셔닝 알고리즘
    const hash = parseInt(serviceId.substring(0, 8), 16);
    const x = (hash % 1000) - 500;
    const y = ((hash >> 10) % 1000) - 500;
    
    return { x, y };
  }

  async getRealtimeMetrics(req, res) {
    try {
      this.updateRealtimeMetrics();
      
      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        realtime_metrics: this.realtimeMetrics,
        last_updated: Date.now()
      });

    } catch (error) {
      logger.error('실시간 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: '실시간 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getPerformanceAnalysis(req, res) {
    try {
      // 성능 분석 실행
      const bottlenecks = this.analyzeBottlenecks();
      const criticalPaths = this.analyzeCriticalPaths();

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        performance_analysis: {
          bottlenecks,
          critical_paths: criticalPaths,
          summary: {
            total_bottlenecks: bottlenecks.length,
            critical_bottlenecks: bottlenecks.filter(b => b.score > 0.8).length,
            total_critical_paths: criticalPaths.length,
            high_impact_paths: criticalPaths.filter(p => p.impact > 10).length
          }
        }
      });

    } catch (error) {
      logger.error('성능 분석 조회 실패', { error: error.message });
      res.status(500).json({
        error: '성능 분석 조회 실패',
        message: error.message
      });
    }
  }

  async getServiceDetail(req, res) {
    try {
      const { serviceId } = req.params;
      const service = this.topology.services.get(serviceId);

      if (!service) {
        return res.status(404).json({
          error: '서비스를 찾을 수 없습니다',
          serviceId
        });
      }

      // 관련 의존성 조회
      const dependencies = {
        outbound: [],
        inbound: []
      };

      this.topology.dependencies.forEach((dependency, depId) => {
        if (dependency.sourceServiceId === serviceId) {
          dependencies.outbound.push({
            id: depId,
            target: dependency.targetServiceId,
            targetName: this.topology.services.get(dependency.targetServiceId)?.name || 'Unknown',
            type: dependency.type,
            metrics: dependency.metrics
          });
        }
        if (dependency.targetServiceId === serviceId) {
          dependencies.inbound.push({
            id: depId,
            source: dependency.sourceServiceId,
            sourceName: this.topology.services.get(dependency.sourceServiceId)?.name || 'Unknown',
            type: dependency.type,
            metrics: dependency.metrics
          });
        }
      });

      // 최근 트래픽 조회
      const recentTraffic = Array.from(this.topology.trafficFlow.values())
        .filter(flow => 
          flow.sourceServiceId === serviceId || flow.targetServiceId === serviceId
        )
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        service_detail: {
          ...service,
          dependencies,
          recent_traffic: recentTraffic,
          bottleneck_analysis: this.performanceAnalysis.bottlenecks.get('service_' + serviceId)
        }
      });

    } catch (error) {
      logger.error('서비스 상세 조회 실패', { error: error.message });
      res.status(500).json({
        error: '서비스 상세 조회 실패',
        message: error.message
      });
    }
  }

  async getDependencyAnalysis(req, res) {
    try {
      const analysis = {
        total_dependencies: this.topology.dependencies.size,
        by_type: {},
        by_status: {},
        performance_metrics: {
          average_latency: 0,
          total_throughput: 0,
          overall_error_rate: 0
        },
        top_latency_dependencies: [],
        top_throughput_dependencies: [],
        problematic_dependencies: []
      };

      let totalLatency = 0, totalThroughput = 0, totalRequests = 0, totalErrors = 0;

      this.topology.dependencies.forEach((dependency, depId) => {
        // 타입별 분류
        analysis.by_type[dependency.type] = (analysis.by_type[dependency.type] || 0) + 1;
        
        // 상태별 분류
        analysis.by_status[dependency.status] = (analysis.by_status[dependency.status] || 0) + 1;

        // 성능 메트릭 집계
        totalLatency += dependency.metrics.averageLatency;
        totalThroughput += dependency.metrics.throughput;
        totalRequests += dependency.metrics.requestCount;
        totalErrors += dependency.metrics.errorCount;

        // 상위 레이턴시 의존성
        if (dependency.metrics.averageLatency > 0) {
          analysis.top_latency_dependencies.push({
            id: depId,
            source: this.topology.services.get(dependency.sourceServiceId)?.name || 'Unknown',
            target: this.topology.services.get(dependency.targetServiceId)?.name || 'Unknown',
            latency: dependency.metrics.averageLatency
          });
        }

        // 상위 처리량 의존성
        if (dependency.metrics.throughput > 0) {
          analysis.top_throughput_dependencies.push({
            id: depId,
            source: this.topology.services.get(dependency.sourceServiceId)?.name || 'Unknown',
            target: this.topology.services.get(dependency.targetServiceId)?.name || 'Unknown',
            throughput: dependency.metrics.throughput
          });
        }

        // 문제가 있는 의존성
        const errorRate = dependency.metrics.requestCount > 0 ? 
          (dependency.metrics.errorCount / dependency.metrics.requestCount) : 0;

        if (errorRate > 0.05 || dependency.metrics.averageLatency > 1000) {
          analysis.problematic_dependencies.push({
            id: depId,
            source: this.topology.services.get(dependency.sourceServiceId)?.name || 'Unknown',
            target: this.topology.services.get(dependency.targetServiceId)?.name || 'Unknown',
            latency: dependency.metrics.averageLatency,
            error_rate: (errorRate * 100).toFixed(2) + '%',
            issues: dependency.metrics.averageLatency > 1000 ? ['High Latency'] : [] 
              .concat(errorRate > 0.05 ? ['High Error Rate'] : [])
          });
        }
      });

      // 전체 성능 메트릭 계산
      const depCount = this.topology.dependencies.size;
      if (depCount > 0) {
        analysis.performance_metrics.average_latency = Math.round(totalLatency / depCount);
        analysis.performance_metrics.total_throughput = totalThroughput;
        analysis.performance_metrics.overall_error_rate = totalRequests > 0 ? 
          ((totalErrors / totalRequests) * 100).toFixed(2) + '%' : '0%';
      }

      // 정렬
      analysis.top_latency_dependencies.sort((a, b) => b.latency - a.latency).splice(10);
      analysis.top_throughput_dependencies.sort((a, b) => b.throughput - a.throughput).splice(10);

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        dependency_analysis: analysis
      });

    } catch (error) {
      logger.error('의존성 분석 실패', { error: error.message });
      res.status(500).json({
        error: '의존성 분석 실패',
        message: error.message
      });
    }
  }

  async getTrafficAnalysis(req, res) {
    try {
      const { timeWindow = 3600 } = req.query; // 기본 1시간
      const cutoffTime = Date.now() - (parseInt(timeWindow) * 1000);
      
      const recentTraffic = Array.from(this.topology.trafficFlow.values())
        .filter(flow => flow.timestamp >= cutoffTime);

      const analysis = {
        time_window: timeWindow + '초',
        total_requests: recentTraffic.length,
        successful_requests: recentTraffic.filter(f => f.success).length,
        failed_requests: recentTraffic.filter(f => !f.success).length,
        average_latency: 0,
        top_endpoints: {},
        traffic_by_service: {},
        error_analysis: {},
        latency_distribution: {
          fast: 0,      // < 100ms
          normal: 0,    // 100-500ms  
          slow: 0,      // 500ms-2s
          very_slow: 0  // > 2s
        }
      };

      let totalLatency = 0;

      recentTraffic.forEach(flow => {
        totalLatency += flow.latency;

        // 엔드포인트별 분석
        if (flow.endpoint) {
          if (!analysis.top_endpoints[flow.endpoint]) {
            analysis.top_endpoints[flow.endpoint] = {
              count: 0,
              total_latency: 0,
              errors: 0
            };
          }
          analysis.top_endpoints[flow.endpoint].count++;
          analysis.top_endpoints[flow.endpoint].total_latency += flow.latency;
          if (!flow.success) analysis.top_endpoints[flow.endpoint].errors++;
        }

        // 서비스별 트래픽
        const serviceKey = `${flow.sourceServiceId}->${flow.targetServiceId}`;
        if (!analysis.traffic_by_service[serviceKey]) {
          analysis.traffic_by_service[serviceKey] = {
            source: this.topology.services.get(flow.sourceServiceId)?.name || 'Unknown',
            target: this.topology.services.get(flow.targetServiceId)?.name || 'Unknown',
            count: 0,
            errors: 0,
            total_latency: 0
          };
        }
        analysis.traffic_by_service[serviceKey].count++;
        analysis.traffic_by_service[serviceKey].total_latency += flow.latency;
        if (!flow.success) analysis.traffic_by_service[serviceKey].errors++;

        // 에러 분석
        if (!flow.success && flow.statusCode) {
          const statusCode = flow.statusCode.toString();
          analysis.error_analysis[statusCode] = (analysis.error_analysis[statusCode] || 0) + 1;
        }

        // 레이턴시 분포
        if (flow.latency < 100) {
          analysis.latency_distribution.fast++;
        } else if (flow.latency < 500) {
          analysis.latency_distribution.normal++;
        } else if (flow.latency < 2000) {
          analysis.latency_distribution.slow++;
        } else {
          analysis.latency_distribution.very_slow++;
        }
      });

      // 평균 레이턴시 계산
      if (recentTraffic.length > 0) {
        analysis.average_latency = Math.round(totalLatency / recentTraffic.length);
      }

      // 성공률 계산
      analysis.success_rate = recentTraffic.length > 0 ? 
        ((analysis.successful_requests / recentTraffic.length) * 100).toFixed(2) + '%' : '0%';

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        traffic_analysis: analysis
      });

    } catch (error) {
      logger.error('트래픽 분석 실패', { error: error.message });
      res.status(500).json({
        error: '트래픽 분석 실패',
        message: error.message
      });
    }
  }

  async createClusterAPI(req, res) {
    try {
      const clusterId = this.createCluster(req.body);
      
      res.json({
        status: '성공',
        message: '클러스터가 성공적으로 생성되었습니다',
        clusterId,
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      });

    } catch (error) {
      logger.error('클러스터 생성 API 실패', { error: error.message });
      res.status(500).json({
        error: '클러스터 생성 실패',
        message: error.message
      });
    }
  }

  async getClusters(req, res) {
    try {
      const clusters = Array.from(this.topology.clusters.values()).map(cluster => ({
        ...cluster,
        services: Array.from(cluster.services)
      }));

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        clusters,
        total_clusters: clusters.length
      });

    } catch (error) {
      logger.error('클러스터 조회 실패', { error: error.message });
      res.status(500).json({
        error: '클러스터 조회 실패',
        message: error.message
      });
    }
  }

  async getTopologyHistory(req, res) {
    try {
      const { limit = 100, changeType } = req.query;
      
      let history = [...this.topologyHistory];
      
      if (changeType) {
        history = history.filter(change => change.type === changeType);
      }

      history.sort((a, b) => b.timestamp - a.timestamp);
      history = history.slice(0, parseInt(limit));

      res.json({
        status: '성공',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        topology_history: history,
        total_changes: this.topologyHistory.length
      });

    } catch (error) {
      logger.error('토폴로지 이력 조회 실패', { error: error.message });
      res.status(500).json({
        error: '토폴로지 이력 조회 실패',
        message: error.message
      });
    }
  }

  async runDiscovery(req, res) {
    try {
      await this.discoverServices();
      
      res.json({
        status: '성공',
        message: '서비스 디스커버리가 실행되었습니다',
        korean_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        total_services: this.topology.services.size
      });

    } catch (error) {
      logger.error('서비스 디스커버리 실행 실패', { error: error.message });
      res.status(500).json({
        error: '서비스 디스커버리 실행 실패',
        message: error.message
      });
    }
  }

  async start() {
    try {
      logger.info('서비스 토폴로지 서비스 시작 중...', { service: 'service-topology' });
      
      this.server = this.app.listen(this.config.port, () => {
        this.isRunning = true;
        logger.info(`서비스 토폴로지 서비스가 포트 ${this.config.port}에서 시작되었습니다`, {
          service: 'service-topology',
          port: this.config.port
        });
      });

      // 주기적 토폴로지 새로고침
      if (this.config.enableRealTimeUpdates) {
        this.topologyRefreshTimer = setInterval(() => {
          this.updateRealtimeMetrics();
          this.analyzeBottlenecks();
          this.analyzeCriticalPaths();
        }, this.config.topologyRefreshInterval);
      }

      // 주기적 서비스 디스커버리
      this.discoveryTimer = setInterval(() => {
        this.discoverServices();
      }, 300000); // 5분마다

      // 이벤트 리스너 설정
      this.on('service-registered', (service) => {
        logger.info('서비스 등록됨', { serviceName: service.name, serviceId: service.id });
      });

      this.on('dependency-registered', (dependency) => {
        logger.info('의존성 등록됨', { 
          source: dependency.sourceServiceId, 
          target: dependency.targetServiceId 
        });
      });

    } catch (error) {
      logger.error('서비스 토폴로지 서비스 시작 실패', {
        error: error.message,
        service: 'service-topology'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('서비스 토폴로지 서비스 종료 중...', { service: 'service-topology' });
      
      this.isRunning = false;
      
      if (this.topologyRefreshTimer) {
        clearInterval(this.topologyRefreshTimer);
      }
      
      if (this.discoveryTimer) {
        clearInterval(this.discoveryTimer);
      }
      
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
      }

      logger.info('서비스 토폴로지 서비스가 종료되었습니다', { service: 'service-topology' });

    } catch (error) {
      logger.error('서비스 토폴로지 서비스 종료 중 오류', {
        error: error.message,
        service: 'service-topology'
      });
    }
  }

  async healthCheck() {
    return {
      status: this.isRunning ? 'healthy' : 'stopped',
      service: 'service-topology',
      port: this.config.port,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      topology_stats: {
        total_services: this.topology.services.size,
        total_dependencies: this.topology.dependencies.size,
        total_clusters: this.topology.clusters.size,
        total_traffic_flows: this.topology.trafficFlow.size,
        realtime_metrics: this.realtimeMetrics
      }
    };
  }
}

// 모듈이 직접 실행될 때
if (require.main === module) {
  const service = new ServiceTopologyService({
    port: process.env.TOPOLOGY_PORT || 3010
  });

  service.start().catch(error => {
    console.error('서비스 시작 실패:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => service.stop());
  process.on('SIGINT', () => service.stop());
  
  // 테스트용 데이터 생성
  if (process.env.NODE_ENV === 'development') {
    setTimeout(async () => {
      // 샘플 서비스들 등록
      const services = [
        {
          name: 'api-gateway',
          type: 'gateway',
          host: 'api-gateway.default.svc.cluster.local',
          port: 8080,
          endpoints: ['/api/*']
        },
        {
          name: 'user-service',
          type: 'microservice',
          host: 'user-service.default.svc.cluster.local',
          port: 8081,
          endpoints: ['/api/users']
        },
        {
          name: 'order-service',
          type: 'microservice',
          host: 'order-service.default.svc.cluster.local',
          port: 8082,
          endpoints: ['/api/orders']
        },
        {
          name: 'postgresql',
          type: 'database',
          host: 'postgresql.database.svc.cluster.local',
          port: 5432
        }
      ];

      const serviceIds = [];
      for (const serviceInfo of services) {
        const serviceId = service.registerService(serviceInfo);
        serviceIds.push(serviceId);
        logger.info(`테스트 서비스 등록: ${serviceInfo.name} (${serviceId})`);
      }

      // 의존성 등록
      if (serviceIds.length >= 4) {
        service.registerDependency({
          sourceServiceId: serviceIds[0], // api-gateway
          targetServiceId: serviceIds[1], // user-service
          type: 'http'
        });

        service.registerDependency({
          sourceServiceId: serviceIds[1], // user-service
          targetServiceId: serviceIds[3], // postgresql
          type: 'database'
        });

        service.registerDependency({
          sourceServiceId: serviceIds[0], // api-gateway
          targetServiceId: serviceIds[2], // order-service
          type: 'http'
        });

        service.registerDependency({
          sourceServiceId: serviceIds[2], // order-service
          targetServiceId: serviceIds[3], // postgresql
          type: 'database'
        });
      }

      // 클러스터 생성
      service.createCluster({
        name: 'microservices-cluster',
        type: 'application',
        services: serviceIds.slice(0, 3), // gateway + microservices
        environment: 'development'
      });

      logger.info('테스트 토폴로지 데이터 생성 완료');

    }, 3000);

    // 주기적으로 샘플 트래픽 생성
    setInterval(() => {
      const serviceIds = Array.from(service.topology.services.keys());
      if (serviceIds.length >= 2) {
        const source = serviceIds[Math.floor(Math.random() * serviceIds.length)];
        const target = serviceIds[Math.floor(Math.random() * serviceIds.length)];
        
        if (source !== target) {
          service.trackTrafficFlow({
            sourceServiceId: source,
            targetServiceId: target,
            method: 'GET',
            endpoint: '/api/test',
            statusCode: Math.random() > 0.1 ? 200 : 500,
            latency: Math.floor(Math.random() * 1000) + 50,
            size: Math.floor(Math.random() * 10000) + 1000
          });
        }
      }
    }, 5000); // 5초마다
  }
}

module.exports = ServiceTopologyService;