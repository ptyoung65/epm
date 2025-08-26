# AIRIS EPM 마이크로서비스 아키텍처 설계 문서

## 📋 아키텍처 개요

AIRIS EPM(Enterprise Performance Monitoring)은 현대적인 마이크로서비스 아키텍처 패턴을 적용하여 확장 가능하고 복원력 있는 성능 모니터링 플랫폼을 구현합니다.

### 핵심 아키텍처 원칙

1. **단일 책임 원칙(Single Responsibility)**: 각 서비스는 하나의 비즈니스 도메인을 담당
2. **느슨한 결합(Loose Coupling)**: 서비스 간 독립성 보장
3. **높은 응집도(High Cohesion)**: 관련 기능들의 밀접한 그룹화
4. **장애 격리(Failure Isolation)**: 한 서비스의 장애가 다른 서비스에 전파되지 않도록 격리
5. **자율적 팀(Autonomous Teams)**: 각 서비스별로 독립적인 개발/배포 가능

## 🏗️ 시스템 아키텍처

### 전체 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                            │
│                      (NGINX/HAProxy)                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                    API Gateway                                  │
│                 (GraphQL Federation)                            │
│                     Port: 4000                                  │
└──────┬──────────────┬──────────────┬──────────────┬────────────┘
       │              │              │              │
   ┌───▼───┐     ┌───▼───┐     ┌───▼───┐     ┌───▼───┐
   │Metrics│     │  Log  │     │ Trace │     │ Alert │
   │Service│     │Service│     │Service│     │Service│
   │ :8001 │     │ :8002 │     │ :8003 │     │ :8004 │
   └───┬───┘     └───┬───┘     └───┬───┘     └───┬───┘
       │              │              │              │
   ┌───▼──────────────▼──────────────▼──────────────▼───┐
   │           Service Discovery (Consul)                │
   │                    Port: 8500                       │
   └──────────────────────┬───────────────────────────┘
                          │
   ┌──────────────────────▼───────────────────────────┐
   │         Message Bus (Kafka/RabbitMQ)             │
   │              Port: 9092/5672                     │
   └──────────────────────┬───────────────────────────┘
                          │
   ┌──────────────────────▼───────────────────────────┐
   │              Data Layer                          │
   │  ClickHouse │ Elasticsearch │ Redis │ PostgreSQL │
   │    :8123    │     :9200     │ :6379 │   :5432    │
   └──────────────────────────────────────────────────┘
```

### 네트워크 토폴로지

```
Internet
    │
    ▼
┌─────────┐
│   WAF   │ (Web Application Firewall)
└────┬────┘
     │
     ▼
┌─────────┐
│ Load    │ (NGINX/HAProxy)
│Balancer │
└────┬────┘
     │
     ▼
┌─────────┐    ┌─────────────────────────┐
│   API   │◄──►│     Service Mesh        │
│ Gateway │    │   (Istio/Linkerd)       │
└────┬────┘    └─────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────┐
│             Internal Network              │
│  ┌────────┐ ┌────────┐ ┌────────┐       │
│  │Service1│ │Service2│ │Service3│ ...   │
│  └────────┘ └────────┘ └────────┘       │
└──────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────┐
│           Data Persistence Layer         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │Database1│ │Database2│ │ Cache   │    │
│  └─────────┘ └─────────┘ └─────────┘    │
└──────────────────────────────────────────┘
```

## 🎯 서비스 도메인 분리

### 1. Metrics Service (메트릭 도메인)

#### 비즈니스 책임
- 시계열 메트릭 데이터 수집
- 실시간 집계 및 다운샘플링
- 메트릭 기반 알림 트리거
- 성능 지표 계산 및 분석

#### 기술 스택
```yaml
Language: TypeScript/Node.js
Framework: Express.js
Database: ClickHouse (시계열 DB)
Cache: Redis
Queue: Bull (Redis 기반)
Protocol: HTTP/gRPC, Kafka
```

#### 데이터 모델
```typescript
interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
  metadata?: Record<string, any>;
}

interface MetricAggregation {
  name: string;
  timeRange: TimeRange;
  aggregationType: 'sum' | 'avg' | 'min' | 'max' | 'count';
  value: number;
  labels: Record<string, string>;
}
```

### 2. Log Service (로그 도메인)

#### 비즈니스 책임
- 구조화된 로그 데이터 수집
- 로그 파싱 및 인덱싱
- 전문 검색 기능 제공
- 로그 패턴 분석 및 이상 탐지

#### 기술 스택
```yaml
Language: TypeScript/Node.js
Framework: Express.js
Database: Elasticsearch
Cache: Redis
Queue: Bull (Redis 기반)
Protocol: HTTP, Kafka
```

#### 데이터 모델
```typescript
interface LogEntry {
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  service: string;
  trace_id?: string;
  span_id?: string;
  labels: Record<string, string>;
  stack_trace?: string;
  user_id?: string;
  request_id?: string;
}
```

### 3. Trace Service (트레이싱 도메인)

#### 비즈니스 책임
- 분산 트레이싱 데이터 수집
- 서비스 의존성 맵 구축
- 성능 병목 지점 분석
- Critical Path 분석

#### 기술 스택
```yaml
Language: TypeScript/Node.js
Framework: Express.js
Tracing Backend: Jaeger
Database: BadgerDB (via Jaeger)
Protocol: OpenTelemetry, HTTP, gRPC
```

#### 데이터 모델
```typescript
interface Span {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  operation_name: string;
  start_time: Date;
  end_time: Date;
  duration_ms: number;
  service_name: string;
  tags: Record<string, any>;
  logs: SpanLog[];
}

interface SpanLog {
  timestamp: Date;
  fields: Record<string, any>;
}
```

### 4. Alert Service (알림 도메인)

#### 비즈니스 책임
- 알림 규칙 관리 및 실행
- 다중 채널 알림 전송
- 에스컬레이션 관리
- 알림 상관 관계 분석

#### 기술 스택
```yaml
Language: TypeScript/Node.js
Framework: Express.js
Database: PostgreSQL (규칙), Redis (상태)
Cache: Redis
Queue: Bull (Redis 기반)
Channels: Email, Slack, SMS, Webhook
```

#### 데이터 모델
```typescript
interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: AlertCondition[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
  enabled: boolean;
  labels: Record<string, string>;
}

interface AlertCondition {
  metric?: string;
  log_query?: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold?: number;
  duration: string;
}
```

## 🔧 공통 인프라 컴포넌트

### 1. 서비스 메시 (Service Mesh)

#### Istio 기반 구현
```yaml
# istio-config.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: airis-epm-vs
spec:
  hosts:
  - "*"
  gateways:
  - airis-epm-gateway
  http:
  - match:
    - uri:
        prefix: /metrics
    route:
    - destination:
        host: metrics-service
        port:
          number: 8001
      weight: 100
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
    retries:
      attempts: 3
      perTryTimeout: 2s
```

#### Linkerd 대안 구성
```yaml
# linkerd-config.yaml
apiVersion: linkerd.io/v1alpha2
kind: TrafficSplit
metadata:
  name: metrics-service-split
spec:
  service: metrics-service
  backends:
  - service: metrics-service-v1
    weight: 90
  - service: metrics-service-v2
    weight: 10
```

### 2. API Gateway

#### GraphQL Federation 스키마
```typescript
// gateway/schema.ts
import { buildFederatedSchema } from '@apollo/federation';

const metricsTypeDefs = `
  type Metric @key(fields: "id") {
    id: ID!
    name: String!
    value: Float!
    timestamp: DateTime!
    labels: [Label!]!
  }
  
  extend type Query {
    metrics(filter: MetricFilter): [Metric!]!
    metricsByName(name: String!): [Metric!]!
  }
`;

const logsTypeDefs = `
  type LogEntry @key(fields: "id") {
    id: ID!
    timestamp: DateTime!
    level: LogLevel!
    message: String!
    service: String!
    traceId: String
  }
  
  extend type Query {
    logs(filter: LogFilter): [LogEntry!]!
    logsByService(service: String!): [LogEntry!]!
  }
`;

const schema = buildFederatedSchema([
  { typeDefs: metricsTypeDefs, resolvers: metricsResolvers },
  { typeDefs: logsTypeDefs, resolvers: logsResolvers },
]);
```

#### REST API Gateway (Express.js 기반)
```typescript
// gateway/routes.ts
import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = Router();

// Metrics Service Proxy
router.use('/api/v1/metrics', createProxyMiddleware({
  target: 'http://metrics-service:8001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/metrics': '/metrics'
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add authentication headers
    proxyReq.setHeader('X-Service-Auth', process.env.SERVICE_AUTH_TOKEN);
  },
  onError: (err, req, res) => {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Metrics service is temporarily unavailable'
    });
  }
}));

// Circuit Breaker Integration
router.use('/api/v1/logs', circuitBreaker.express({
  target: 'http://log-service:8002',
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
}));
```

### 3. 서비스 디스커버리

#### Consul 기반 구현
```typescript
// shared/src/discovery/ServiceRegistry.ts
export class ServiceRegistry {
  private consul: Consul;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: ConsulConfig) {
    this.consul = new Consul({
      host: config.host,
      port: config.port,
      secure: config.secure,
      defaults: {
        token: config.token
      }
    });
  }

  async register(options: ServiceRegistrationOptions): Promise<void> {
    const serviceDefinition = {
      name: options.serviceName,
      id: options.instanceId,
      address: options.address,
      port: options.port,
      tags: options.tags || [],
      meta: options.metadata || {},
      check: {
        http: `http://${options.address}:${options.port}/health`,
        interval: '30s',
        timeout: '10s',
        deregisterCriticalServiceAfter: '90s'
      }
    };

    await this.consul.agent.service.register(serviceDefinition);
    this.startHealthCheck(options.instanceId);
  }

  async discover(serviceName: string, onlyHealthy: boolean = true): Promise<ServiceInstance[]> {
    const services = await this.consul.health.service({
      service: serviceName,
      passing: onlyHealthy
    });

    return services[0].map(entry => ({
      id: entry.Service.ID,
      name: entry.Service.Service,
      address: entry.Service.Address,
      port: entry.Service.Port,
      tags: entry.Service.Tags,
      metadata: entry.Service.Meta,
      healthy: entry.Checks.every(check => check.Status === 'passing')
    }));
  }

  async getServiceInstance(serviceName: string): Promise<ServiceInstance | null> {
    const instances = await this.discover(serviceName, true);
    if (instances.length === 0) return null;

    // Load balancing: round-robin selection
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }
}
```

#### Eureka 대안 구현
```typescript
// shared/src/discovery/EurekaRegistry.ts
export class EurekaRegistry {
  private eureka: Eureka;

  constructor(config: EurekaConfig) {
    this.eureka = new Eureka({
      instance: {
        app: config.serviceName,
        instanceId: config.instanceId,
        hostName: config.hostname,
        ipAddr: config.ipAddress,
        port: { '$': config.port, '@enabled': true },
        vipAddress: config.serviceName,
        dataCenterInfo: {
          '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
          name: 'MyOwn'
        }
      },
      eureka: {
        host: config.eurekaHost,
        port: config.eurekaPort,
        servicePath: '/eureka/apps/',
        maxRetries: 3,
        requestRetryDelay: 2000
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eureka.start(error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
```

## 🛡️ 복원력 패턴 (Resilience Patterns)

### 1. Circuit Breaker 패턴

#### 구현 세부사항
```typescript
// shared/src/resilience/CircuitBreaker.ts
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private nextAttempt: number = 0;

  constructor(private config: CircuitBreakerConfig) {
    super();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.halfOpen();
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
      )
    ]);
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
    this.emit('success', { name: this.name });
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.resetTimeout;
      this.emit('open', { 
        name: this.name, 
        failureCount: this.failureCount 
      });
    }
  }
}
```

### 2. Retry 패턴

#### 지수 백오프 구현
```typescript
// shared/src/resilience/RetryPattern.ts
export class RetryPattern {
  constructor(private config: RetryConfig) {}

  async execute<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: Error;
    let delay = this.config.initialDelay;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.config.maxAttempts) {
          break;
        }

        if (!this.shouldRetry(error)) {
          throw error;
        }

        // Exponential backoff with jitter
        const jitter = Math.random() * 0.1 * delay;
        const actualDelay = delay + jitter;
        
        await this.sleep(actualDelay);
        delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelay);
      }
    }

    throw lastError!;
  }

  private shouldRetry(error: any): boolean {
    if (this.config.retryCondition) {
      return this.config.retryCondition(error);
    }

    // Default retry conditions
    if (error.code === 'ECONNRESET' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED') {
      return true;
    }

    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Bulkhead 패턴

#### 리소스 격리 구현
```typescript
// shared/src/resilience/BulkheadPattern.ts
export class BulkheadPattern {
  private pools: Map<string, ResourcePool> = new Map();

  createPool(name: string, config: BulkheadConfig): void {
    const pool = new ResourcePool({
      min: config.minResources,
      max: config.maxResources,
      acquireTimeoutMillis: config.acquireTimeout,
      createTimeoutMillis: config.createTimeout,
      destroyTimeoutMillis: config.destroyTimeout,
      idleTimeoutMillis: config.idleTimeout,
      reapIntervalMillis: config.reapInterval,
      maxQueueSize: config.maxQueueSize,
      
      create: async () => {
        return {
          id: uuid(),
          createdAt: new Date(),
          inUse: false
        };
      },
      
      destroy: async (resource) => {
        // Cleanup logic here
      },
      
      validate: (resource) => {
        const age = Date.now() - resource.createdAt.getTime();
        return age < config.maxResourceAge;
      }
    });

    this.pools.set(name, pool);
  }

  async execute<T>(poolName: string, fn: () => Promise<T>): Promise<T> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    return pool.use(async (resource) => {
      resource.inUse = true;
      try {
        return await fn();
      } finally {
        resource.inUse = false;
      }
    });
  }
}
```

## 📊 데이터 저장소 최적화

### 1. ClickHouse 스키마 설계

#### 파티셔닝 전략
```sql
-- 메트릭 테이블 (월별 파티셔닝)
CREATE TABLE metrics (
    name String,
    value Float64,
    timestamp DateTime64(3),
    date Date DEFAULT toDate(timestamp),
    labels Map(String, String),
    metadata String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (name, timestamp)
TTL date + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- 1분 집계 테이블
CREATE TABLE metrics_1m (
    name String,
    timestamp DateTime,
    date Date DEFAULT toDate(timestamp),
    labels Map(String, String),
    avg_value Float64,
    min_value Float64,
    max_value Float64,
    count_value UInt64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (name, timestamp)
TTL date + INTERVAL 180 DAY;

-- Materialized View for 1분 집계
CREATE MATERIALIZED VIEW metrics_1m_mv TO metrics_1m
AS SELECT
    name,
    toStartOfMinute(timestamp) as timestamp,
    toDate(timestamp) as date,
    labels,
    avg(value) as avg_value,
    min(value) as min_value,
    max(value) as max_value,
    count() as count_value
FROM metrics
GROUP BY name, toStartOfMinute(timestamp), labels;
```

#### 인덱스 최적화
```sql
-- Bloom Filter 인덱스 (고cardinality 필드용)
ALTER TABLE metrics ADD INDEX bloom_labels labels TYPE bloom_filter(0.01) GRANULARITY 1;

-- MinMax 인덱스 (범위 검색 최적화)
ALTER TABLE metrics ADD INDEX minmax_value value TYPE minmax GRANULARITY 3;

-- Set 인덱스 (특정 값 검색 최적화)
ALTER TABLE metrics ADD INDEX set_name name TYPE set(1000) GRANULARITY 1;
```

### 2. Elasticsearch 매핑 최적화

#### 동적 매핑 설정
```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "5s",
    "index.codec": "best_compression",
    "index.lifecycle.name": "logs-policy",
    "index.lifecycle.rollover_alias": "logs",
    "analysis": {
      "analyzer": {
        "korean_analyzer": {
          "type": "custom",
          "tokenizer": "nori_tokenizer",
          "filter": ["nori_part_of_speech"]
        }
      }
    }
  },
  "mappings": {
    "dynamic_templates": [
      {
        "labels": {
          "path_match": "labels.*",
          "mapping": {
            "type": "keyword",
            "index": true,
            "doc_values": true
          }
        }
      },
      {
        "metadata": {
          "path_match": "metadata.*",
          "mapping": {
            "type": "object",
            "enabled": false
          }
        }
      }
    ],
    "properties": {
      "timestamp": {
        "type": "date",
        "format": "strict_date_optional_time||epoch_millis"
      },
      "level": {
        "type": "keyword",
        "index": true
      },
      "message": {
        "type": "text",
        "analyzer": "korean_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      }
    }
  }
}
```

## 🔐 보안 아키텍처

### 1. 인증 및 인가

#### JWT 기반 인증
```typescript
// shared/src/auth/JWTAuthenticator.ts
export class JWTAuthenticator {
  private publicKey: string;
  private privateKey: string;

  constructor(config: JWTConfig) {
    this.publicKey = fs.readFileSync(config.publicKeyPath, 'utf8');
    this.privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
  }

  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: '1h',
      issuer: 'airis-epm',
      audience: 'airis-services'
    });
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.publicKey, {
      algorithms: ['RS256'],
      issuer: 'airis-epm',
      audience: 'airis-services'
    }) as TokenPayload;
  }

  middleware(): RequestHandler {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      try {
        const token = authHeader.substring(7);
        const payload = this.verifyToken(token);
        req.user = payload;
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    };
  }
}
```

#### RBAC 구현
```typescript
// shared/src/auth/RBACAuthorizer.ts
export class RBACAuthorizer {
  private permissions: Map<string, Permission[]> = new Map();

  addRole(role: string, permissions: Permission[]): void {
    this.permissions.set(role, permissions);
  }

  hasPermission(userRoles: string[], requiredPermissions: Permission[]): boolean {
    const userPermissions = userRoles.flatMap(role => 
      this.permissions.get(role) || []
    );

    return requiredPermissions.every(required =>
      userPermissions.some(permission =>
        this.matchPermission(permission, required)
      )
    );
  }

  middleware(requiredPermissions: Permission[]): RequestHandler {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!this.hasPermission(req.user.roles, requiredPermissions)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }

  private matchPermission(user: Permission, required: Permission): boolean {
    if (required.resource !== '*' && user.resource !== required.resource) {
      return false;
    }

    if (required.action !== '*' && user.action !== required.action) {
      return false;
    }

    return true;
  }
}
```

### 2. 서비스 간 통신 보안

#### mTLS 구현
```typescript
// shared/src/security/MTLSClient.ts
export class MTLSClient {
  private agent: https.Agent;

  constructor(config: MTLSConfig) {
    this.agent = new https.Agent({
      cert: fs.readFileSync(config.clientCertPath),
      key: fs.readFileSync(config.clientKeyPath),
      ca: fs.readFileSync(config.caPath),
      rejectUnauthorized: true,
      checkServerIdentity: (hostname, cert) => {
        // Custom certificate validation logic
        return undefined; // Return undefined if valid
      }
    });
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const response = await fetch(options.url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      agent: this.agent
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}
```

## 📈 성능 최적화 전략

### 1. 캐싱 계층

#### Multi-Level 캐싱
```typescript
// shared/src/cache/MultiLevelCache.ts
export class MultiLevelCache {
  private l1Cache: LRUCache<string, any>; // 메모리 캐시
  private l2Cache: Redis; // Redis 캐시
  private l3Cache: any; // 데이터베이스 캐시

  constructor(config: CacheConfig) {
    this.l1Cache = new LRUCache({
      max: config.l1MaxItems,
      ttl: config.l1TTL
    });
    
    this.l2Cache = new Redis(config.redisConfig);
  }

  async get<T>(key: string): Promise<T | null> {
    // L1 캐시 확인
    let value = this.l1Cache.get(key);
    if (value !== undefined) {
      return value as T;
    }

    // L2 캐시 확인
    const l2Value = await this.l2Cache.get(key);
    if (l2Value) {
      const parsed = JSON.parse(l2Value);
      this.l1Cache.set(key, parsed); // L1에 캐시
      return parsed as T;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // L1 캐시 저장
    this.l1Cache.set(key, value, { ttl: ttl || 60000 });

    // L2 캐시 저장
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.l2Cache.setex(key, Math.floor(ttl / 1000), serialized);
    } else {
      await this.l2Cache.set(key, serialized);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    // L1 캐시 무효화
    this.l1Cache.clear();

    // L2 캐시 무효화
    const keys = await this.l2Cache.keys(pattern);
    if (keys.length > 0) {
      await this.l2Cache.del(...keys);
    }
  }
}
```

### 2. 연결 풀링

#### 데이터베이스 연결 풀
```typescript
// shared/src/database/ConnectionPool.ts
export class ConnectionPool {
  private pools: Map<string, Pool> = new Map();

  createPool(name: string, config: PoolConfig): void {
    const pool = createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit: config.maxConnections,
      acquireTimeout: config.acquireTimeout,
      timeout: config.queryTimeout,
      reconnect: true,
      idleTimeout: config.idleTimeout,
      
      // Connection validation
      validateConnection: (connection) => {
        return connection.ping();
      },
      
      // Pool events
      onConnection: (connection) => {
        console.log('New connection established:', connection.threadId);
      },
      
      onEnqueue: () => {
        console.log('Waiting for available connection slot');
      }
    });

    this.pools.set(name, pool);
  }

  async execute<T>(
    poolName: string, 
    query: string, 
    params?: any[]
  ): Promise<T> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    const connection = await pool.getConnection();
    try {
      const results = await connection.query(query, params);
      return results as T;
    } finally {
      connection.release();
    }
  }
}
```

## 🚀 배포 전략

### 1. Blue-Green 배포

#### Kubernetes 매니페스트
```yaml
# blue-green-deployment.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: metrics-service
spec:
  replicas: 3
  strategy:
    blueGreen:
      activeService: metrics-service-active
      previewService: metrics-service-preview
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 30
      prePromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: metrics-service-preview
  selector:
    matchLabels:
      app: metrics-service
  template:
    metadata:
      labels:
        app: metrics-service
    spec:
      containers:
      - name: metrics-service
        image: airis-epm/metrics-service:v1.0.0
        ports:
        - containerPort: 8001
        env:
        - name: NODE_ENV
          value: production
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        readinessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 10
```

### 2. Canary 배포

```yaml
# canary-deployment.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: log-service
spec:
  replicas: 5
  strategy:
    canary:
      steps:
      - setWeight: 20
      - pause: {}
      - setWeight: 40
      - pause: {duration: 10}
      - setWeight: 60
      - pause: {duration: 10}
      - setWeight: 80
      - pause: {duration: 10}
      canaryService: log-service-canary
      stableService: log-service-stable
      trafficRouting:
        istio:
          virtualService:
            name: log-service-vs
          destinationRule:
            name: log-service-dr
            canarySubsetName: canary
            stableSubsetName: stable
  selector:
    matchLabels:
      app: log-service
  template:
    metadata:
      labels:
        app: log-service
    spec:
      containers:
      - name: log-service
        image: airis-epm/log-service:v1.0.0
        ports:
        - containerPort: 8002
```

이 아키텍처 문서는 AIRIS EPM 마이크로서비스 시스템의 전체적인 설계 철학과 기술적 구현 세부사항을 포괄적으로 다루고 있습니다. 각 컴포넌트는 확장성, 안정성, 보안성을 고려하여 설계되었으며, 현대적인 클라우드 네이티브 패턴을 적용하였습니다.