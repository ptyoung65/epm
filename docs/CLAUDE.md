# AIRIS EPM 마이크로서비스 아키텍처 전체 시스템 문서

## 🏗️ 시스템 개요

AIRIS EPM(Enterprise Performance Monitoring)은 현대적인 마이크로서비스 아키텍처를 기반으로 구축된 통합 성능 모니터링 플랫폼입니다. 이 시스템은 대규모 분산 환경에서 안정적이고 확장 가능한 모니터링 서비스를 제공하기 위해 설계되었습니다.

### 핵심 설계 원칙

1. **도메인 주도 설계(Domain-Driven Design)**: 각 서비스는 명확한 비즈니스 도메인을 가짐
2. **마이크로서비스 패턴**: 독립적으로 배포 가능한 서비스 단위
3. **회복 탄력성(Resilience)**: 장애 전파 방지 및 자동 복구
4. **관찰 가능성(Observability)**: 모든 서비스에 대한 완전한 추적 및 모니터링
5. **수평 확장성**: 트래픽 증가에 따른 동적 확장

## 📊 서비스 아키텍처

### 서비스 포트 할당

| 서비스명 | 포트 | 설명 |
|---------|------|------|
| Service Registry | 8500 | Consul 기반 서비스 디스커버리 |
| Metrics Service | 8001 | 메트릭 수집 및 집계 |
| Log Service | 8002 | 로그 수집 및 검색 |
| Trace Service | 8003 | 분산 트레이싱 |
| Alert Service | 8004 | 알림 관리 및 전송 |

### 도메인별 서비스 구분

#### 1. Metrics Service (메트릭 서비스)
```typescript
// 위치: services/metrics-service/
// 포트: 8001
// 데이터베이스: ClickHouse
// 큐: Bull (Redis 기반)
// 캐시: Redis

주요 기능:
- 실시간 메트릭 수집 및 저장
- 시계열 데이터 최적화
- 자동 집계 및 다운샘플링
- 메트릭 기반 알림 트리거
```

#### 2. Log Service (로그 서비스)
```typescript
// 위치: services/log-service/
// 포트: 8002
// 데이터베이스: Elasticsearch
// 인덱싱: 자동 로그 파싱
// 검색: 전문 검색 지원

주요 기능:
- 구조화된 로그 수집
- 실시간 로그 파싱 및 인덱싱
- 고급 로그 검색 기능
- 로그 패턴 분석 및 이상 탐지
```

#### 3. Trace Service (트레이스 서비스)
```typescript
// 위치: services/trace-service/
// 포트: 8003
// 트레이싱 백엔드: Jaeger
// 상관 관계 분석: 자동 처리

주요 기능:
- 분산 트레이싱 데이터 수집
- 서비스 간 의존성 분석
- 성능 병목 지점 탐지
- Critical Path 분석
```

#### 4. Alert Service (알림 서비스)
```typescript
// 위치: services/alert-service/
// 포트: 8004
// 알림 채널: Email, Slack, SMS, Webhook
// 규칙 엔진: 복합 조건 처리

주요 기능:
- 다중 채널 알림 전송
- 알림 규칙 엔진
- 에스컬레이션 관리
- 알림 상관 관계 분석
```

## 🔧 기술 스택 및 의존성

### 백엔드 기술 스택

```json
{
  "runtime": "Node.js 18+",
  "language": "TypeScript 5.x",
  "framework": "Express.js 4.x",
  "databases": {
    "timeseries": "ClickHouse 23.x",
    "search": "Elasticsearch 8.x",
    "cache": "Redis 7.x",
    "relational": "PostgreSQL 15.x"
  },
  "messaging": "Apache Kafka 3.x",
  "serviceDiscovery": "Consul 1.16.x",
  "tracing": "Jaeger 1.49.x",
  "monitoring": "Prometheus 2.47.x"
}
```

### 공통 라이브러리 의존성

```typescript
// services/shared/package.json
{
  "dependencies": {
    "express": "^4.18.2",
    "winston": "^3.10.0",
    "prom-client": "^14.2.0",
    "consul": "^0.40.0",
    "kafkajs": "^2.2.4",
    "ioredis": "^5.3.2",
    "@clickhouse/client": "^0.2.5",
    "@elastic/elasticsearch": "^8.10.0",
    "jaeger-client": "^3.19.0",
    "joi": "^17.11.0",
    "bull": "^4.11.4",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.10.0",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "@types/node": "^20.8.6",
    "typescript": "^5.2.2"
  }
}
```

## 🏛️ 공통 인프라 구조

### 1. MicroserviceBase 추상 클래스

```typescript
// services/shared/src/base/MicroserviceBase.ts
export abstract class MicroserviceBase {
  protected app: Express;
  protected server: http.Server | null = null;
  protected logger: Logger;
  protected config: MicroserviceConfig;
  protected serviceRegistry: ServiceRegistry;
  protected messageBus: MessageBus;
  protected metricsCollector: MetricsCollector;
  protected tracingManager: TracingManager;
  protected healthChecker: HealthChecker;
  protected errorHandler: ErrorHandler;
  protected redisClient: Redis;

  // 추상 메소드 - 각 서비스에서 구현 필수
  protected abstract registerRoutes(): void;
  protected abstract initializeService(): Promise<void>;

  // 공통 초기화 프로세스
  public async start(): Promise<void> {
    await this.initializeRedis();
    await this.initializeServiceDiscovery();
    this.initializeTracing();
    await this.initializeMessageBus();
    await this.initializeService(); // 서비스별 초기화
    this.registerRoutes(); // 서비스별 라우팅
    this.setupMiddleware();
    this.app.use(this.errorHandler.middleware());
    
    this.server = this.app.listen(this.config.port, () => {
      this.logger.info(`${this.config.serviceName} started on port ${this.config.port}`);
    });
    
    this.setupGracefulShutdown();
  }
}
```

### 2. 서비스 디스커버리

```typescript
// services/shared/src/discovery/ServiceRegistry.ts
export class ServiceRegistry {
  private consul: Consul;
  
  // 서비스 등록
  async register(options: ServiceRegistrationOptions): Promise<void> {
    await this.consul.agent.service.register({
      name: options.serviceName,
      id: options.instanceId,
      address: options.address,
      port: options.port,
      tags: options.tags,
      meta: options.metadata,
      check: {
        http: `http://${options.address}:${options.port}/health`,
        interval: '30s',
        timeout: '10s',
        deregisterCriticalServiceAfter: '90s'
      }
    });
  }

  // 서비스 검색
  async discover(serviceName: string, onlyHealthy: boolean = true): Promise<ServiceInstance[]> {
    const result = await this.consul.agent.service.list();
    const services = Object.values(result).filter(service => 
      service.Service === serviceName && (!onlyHealthy || service.Address)
    );
    return services.map(service => ({
      id: service.ID,
      name: service.Service,
      address: service.Address,
      port: service.Port,
      tags: service.Tags,
      metadata: service.Meta
    }));
  }
}
```

### 3. 회복 탄력성 패턴

#### Circuit Breaker
```typescript
// services/shared/src/resilience/CircuitBreaker.ts
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;

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
      this.emit('open', { name: this.name, failureCount: this.failureCount });
    }
  }
}
```

#### Bulkhead Pattern
```typescript
// services/shared/src/resilience/BulkheadPattern.ts
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
      maxQueueSize: config.maxQueueSize
    });
    this.pools.set(name, pool);
  }

  async execute<T>(poolName: string, fn: () => Promise<T>): Promise<T> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    return pool.use(fn);
  }
}
```

### 4. 메시징 시스템

```typescript
// services/shared/src/messaging/MessageBus.ts
export class MessageBus {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();

  async publishMessage(topic: string, message: any): Promise<void> {
    if (!this.producer) {
      throw new Error('Producer not initialized');
    }

    await this.producer.send({
      topic,
      messages: [{
        key: message.id || uuid(),
        value: JSON.stringify(message),
        timestamp: Date.now().toString(),
        headers: {
          'correlation-id': this.tracingManager.getActiveSpan()?.context()?.toTraceId(),
          'service-name': this.config.serviceName,
          'message-type': message.type || 'generic'
        }
      }]
    });
  }

  async subscribeToTopic(
    topic: string, 
    groupId: string, 
    handler: MessageHandler
  ): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const span = this.tracingManager.startSpan(`kafka-consume-${topic}`);
        
        try {
          const messageData = JSON.parse(message.value?.toString() || '{}');
          await handler(messageData, {
            topic,
            partition,
            offset: message.offset,
            headers: message.headers
          });
        } catch (error) {
          this.logger.error('Message processing failed', { error, topic });
          span.setTag('error', true);
          span.log({ error: error.message });
          throw error;
        } finally {
          span.finish();
        }
      }
    });

    this.consumers.set(`${topic}-${groupId}`, consumer);
  }
}
```

## 🔍 모니터링 및 관찰성

### 1. 헬스 체크 시스템

```typescript
// services/shared/src/monitoring/HealthChecker.ts
export class HealthChecker extends EventEmitter {
  private checks: Map<string, HealthCheck> = new Map();
  private lastResults: Map<string, HealthCheckResult> = new Map();

  addCheck(name: string, check: () => Promise<HealthCheckResult>): void {
    const healthCheck: HealthCheck = {
      name,
      check,
      interval: 30000, // 30초마다 체크
      timeout: 5000,   // 5초 타임아웃
      critical: false
    };

    this.checks.set(name, healthCheck);
    this.startPeriodicCheck(name);
  }

  async checkAll(): Promise<SystemHealth> {
    const checkPromises = Array.from(this.checks.keys()).map(async (name) => {
      try {
        return await this.executeCheck(name);
      } catch (error) {
        return this.lastResults.get(name)!;
      }
    });

    await Promise.allSettled(checkPromises);
    return this.getSystemHealth();
  }

  private async executeCheck(name: string): Promise<HealthCheckResult> {
    const healthCheck = this.checks.get(name)!;
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(
        healthCheck.check,
        healthCheck.timeout
      );

      const finalResult: HealthCheckResult = {
        ...result,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };

      this.lastResults.set(name, finalResult);
      return finalResult;
    } catch (error: any) {
      const errorResult: HealthCheckResult = {
        status: 'DOWN',
        error: error.message,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };

      this.lastResults.set(name, errorResult);
      return errorResult;
    }
  }
}
```

### 2. 메트릭 수집

```typescript
// services/shared/src/monitoring/MetricsCollector.ts
export class MetricsCollector {
  private registry: Registry;
  private httpRequestDuration: Histogram<string>;
  private httpRequestTotal: Counter<string>;
  private activeConnections: Gauge<string>;

  constructor(config: MetricsConfig) {
    this.registry = new Registry();
    
    // HTTP 요청 지연시간 히스토그램
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    // HTTP 요청 총 수 카운터
    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    // 활성 연결 수 게이지
    this.activeConnections = new Gauge({
      name: 'active_connections_total',
      help: 'Total number of active connections',
      labelNames: ['service']
    });
  }

  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    const labels = { method, route, status_code: statusCode.toString() };
    this.httpRequestDuration.observe(labels, duration / 1000);
    this.httpRequestTotal.inc(labels);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

### 3. 분산 트레이싱

```typescript
// services/shared/src/tracing/TracingManager.ts
export class TracingManager {
  private tracer: Tracer;

  constructor(config: TracingConfig) {
    const jaegerConfig = {
      serviceName: config.serviceName,
      sampler: {
        type: 'const',
        param: config.samplingRate || 0.1
      },
      reporter: {
        logSpans: config.logSpans || false,
        agentHost: config.jaegerHost || 'localhost',
        agentPort: config.jaegerPort || 6832,
        collectorEndpoint: config.collectorEndpoint
      }
    };

    this.tracer = jaegerClient.createTracer(jaegerConfig);
    opentracing.initGlobalTracer(this.tracer);
  }

  startSpan(operationName: string, parentContext?: SpanContext): Span {
    const spanOptions: any = { operationName };
    
    if (parentContext) {
      spanOptions.childOf = parentContext;
    }

    const span = this.tracer.startSpan(operationName, spanOptions);
    span.setTag('service.name', this.config.serviceName);
    span.setTag('service.version', this.config.version);
    
    return span;
  }

  injectToHttpHeaders(span: Span): Record<string, string> {
    const headers: Record<string, string> = {};
    this.tracer.inject(span, FORMAT_HTTP_HEADERS, headers);
    return headers;
  }

  extractFromHttpHeaders(headers: Record<string, string>): SpanContext | null {
    return this.tracer.extract(FORMAT_HTTP_HEADERS, headers);
  }
}
```

## 🗄️ 데이터 저장 최적화

### 1. ClickHouse 메트릭 스키마

```sql
-- services/metrics-service/src/repositories/clickhouse-schema.sql
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
TTL date + INTERVAL 90 DAY;

-- 1분 집계 테이블
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

-- 1시간 집계 테이블
CREATE MATERIALIZED VIEW metrics_1h_mv TO metrics_1h
AS SELECT
    name,
    toStartOfHour(timestamp) as timestamp,
    toDate(timestamp) as date,
    labels,
    avg(avg_value) as avg_value,
    min(min_value) as min_value,
    max(max_value) as max_value,
    sum(count_value) as count_value
FROM metrics_1m
GROUP BY name, toStartOfHour(timestamp), labels;
```

### 2. Elasticsearch 로그 매핑

```json
// services/log-service/src/mappings/log-mapping.json
{
  "mappings": {
    "properties": {
      "timestamp": {
        "type": "date",
        "format": "strict_date_optional_time||epoch_millis"
      },
      "level": {
        "type": "keyword"
      },
      "message": {
        "type": "text",
        "analyzer": "korean",
        "fields": {
          "keyword": {
            "type": "keyword"
          }
        }
      },
      "service": {
        "type": "keyword"
      },
      "trace_id": {
        "type": "keyword"
      },
      "span_id": {
        "type": "keyword"
      },
      "labels": {
        "type": "object",
        "dynamic": true
      },
      "stack_trace": {
        "type": "text"
      },
      "user_id": {
        "type": "keyword"
      },
      "request_id": {
        "type": "keyword"
      },
      "duration_ms": {
        "type": "long"
      },
      "status_code": {
        "type": "integer"
      },
      "url": {
        "type": "keyword"
      },
      "method": {
        "type": "keyword"
      }
    }
  },
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "index.lifecycle.name": "logs-policy",
    "index.lifecycle.rollover_alias": "logs"
  }
}
```

## 🚀 배포 및 운영

### Docker 컨테이너 설정

```dockerfile
# services/metrics-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY dist ./dist
COPY src ./src

# 사용자 생성 및 권한 설정
RUN addgroup -g 1001 -S nodejs && \
    adduser -S airis -u 1001 -G nodejs

USER airis

EXPOSE 8001

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["node", "dist/index.js"]
```

### Docker Compose 설정

```yaml
# docker-compose.yml
version: '3.8'

services:
  consul:
    image: consul:1.16
    ports:
      - "8500:8500"
    command: agent -server -bootstrap-expect=1 -ui -bind=0.0.0.0 -client=0.0.0.0

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  clickhouse:
    image: clickhouse/clickhouse-server:23
    ports:
      - "8123:8123"
      - "9000:9000"
    environment:
      CLICKHOUSE_DB: airis
      CLICKHOUSE_USER: admin
      CLICKHOUSE_PASSWORD: admin123

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  jaeger:
    image: jaegertracing/all-in-one:1.49
    ports:
      - "16686:16686"
      - "14268:14268"
    environment:
      COLLECTOR_OTLP_ENABLED: true

  metrics-service:
    build: ./services/metrics-service
    ports:
      - "8001:8001"
    environment:
      - NODE_ENV=production
      - CONSUL_HOST=consul
      - REDIS_HOST=redis
      - CLICKHOUSE_HOST=clickhouse
      - KAFKA_BROKERS=kafka:9092
      - JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      - consul
      - redis
      - clickhouse
      - kafka
      - jaeger

  log-service:
    build: ./services/log-service
    ports:
      - "8002:8002"
    environment:
      - NODE_ENV=production
      - CONSUL_HOST=consul
      - REDIS_HOST=redis
      - ELASTICSEARCH_HOST=elasticsearch
      - KAFKA_BROKERS=kafka:9092
      - JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      - consul
      - redis
      - elasticsearch
      - kafka
      - jaeger

  trace-service:
    build: ./services/trace-service
    ports:
      - "8003:8003"
    environment:
      - NODE_ENV=production
      - CONSUL_HOST=consul
      - REDIS_HOST=redis
      - JAEGER_ENDPOINT=http://jaeger:14268/api/traces
      - KAFKA_BROKERS=kafka:9092
    depends_on:
      - consul
      - redis
      - jaeger
      - kafka

  alert-service:
    build: ./services/alert-service
    ports:
      - "8004:8004"
    environment:
      - NODE_ENV=production
      - CONSUL_HOST=consul
      - REDIS_HOST=redis
      - KAFKA_BROKERS=kafka:9092
      - JAEGER_ENDPOINT=http://jaeger:14268/api/traces
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
    depends_on:
      - consul
      - redis
      - kafka
      - jaeger
```

### 환경 변수 설정

```bash
# .env
NODE_ENV=production

# Service Discovery
CONSUL_HOST=localhost
CONSUL_PORT=8500

# Cache & Queue
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Databases
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=airis
CLICKHOUSE_USERNAME=admin
CLICKHOUSE_PASSWORD=admin123

ELASTICSEARCH_HOST=localhost
ELASTICSEARCH_PORT=9200
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=

# Message Bus
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=airis-epm
KAFKA_GROUP_ID=airis-consumers

# Tracing
JAEGER_ENDPOINT=http://localhost:14268/api/traces
JAEGER_SAMPLING_RATE=0.1

# Monitoring
PROMETHEUS_GATEWAY=localhost:9091

# Security
JWT_SECRET=your-super-secret-jwt-key
API_RATE_LIMIT=1000

# Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#alerts

# Feature Flags
ENABLE_DISTRIBUTED_TRACING=true
ENABLE_SERVICE_MESH=false
ENABLE_AUTO_SCALING=true
```

## 🔧 개발 및 빌드 도구

### NPM Scripts

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "typecheck": "tsc --noEmit",
    "docker:build": "docker build -t airis-epm-metrics .",
    "docker:run": "docker run -p 8001:8001 airis-epm-metrics"
  }
}
```

### TypeScript 설정

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "commonjs",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}
```

## 📈 성능 최적화

### 1. 연결 풀링

```typescript
// Connection pooling for databases
const clickhouseConfig = {
  host: process.env.CLICKHOUSE_HOST,
  port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
  database: process.env.CLICKHOUSE_DATABASE,
  username: process.env.CLICKHOUSE_USERNAME,
  password: process.env.CLICKHOUSE_PASSWORD,
  clickhouse_settings: {
    max_execution_time: 30,
    max_result_rows: 10000,
    max_result_bytes: '40000000',
    result_overflow_mode: 'throw'
  },
  session_timeout: 300,
  output_format_json_quote_64bit_integers: false,
  enable_http_compression: true,
  compression: {
    response: true,
    request: false
  }
};
```

### 2. 캐싱 전략

```typescript
// Redis 기반 다층 캐싱
export class CacheManager {
  private l1Cache: Map<string, CacheEntry> = new Map(); // 메모리 캐시
  private l2Cache: Redis; // Redis 캐시

  async get<T>(key: string): Promise<T | null> {
    // L1 캐시 확인
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      return l1Entry.value as T;
    }

    // L2 캐시 확인
    const l2Value = await this.l2Cache.get(key);
    if (l2Value) {
      const parsed = JSON.parse(l2Value);
      // L1 캐시 갱신
      this.l1Cache.set(key, {
        value: parsed,
        expiry: Date.now() + 60000 // 1분
      });
      return parsed as T;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    // L1 캐시 저장
    this.l1Cache.set(key, {
      value,
      expiry: Date.now() + Math.min(ttl * 1000, 60000)
    });

    // L2 캐시 저장
    await this.l2Cache.setex(key, ttl, JSON.stringify(value));
  }
}
```

### 3. 배치 처리 최적화

```typescript
// 배치 처리를 통한 성능 최적화
export class BatchProcessor<T> {
  private batch: T[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private batchSize: number = 100,
    private flushInterval: number = 5000,
    private processor: (batch: T[]) => Promise<void>
  ) {}

  add(item: T): void {
    this.batch.push(item);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const currentBatch = this.batch.splice(0);
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    try {
      await this.processor(currentBatch);
    } catch (error) {
      // 실패한 배치를 다시 큐에 추가
      this.batch.unshift(...currentBatch);
      throw error;
    }
  }
}
```

## 🛡️ 보안 고려사항

### 1. API 보안

```typescript
// JWT 인증 미들웨어
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// RBAC 인가 미들웨어
export const authorize = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !user.permissions) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const hasPermission = requiredPermissions.every(permission =>
      user.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
```

### 2. 데이터 암호화

```typescript
// 데이터 암호화/복호화
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private secretKey: Buffer;

  constructor() {
    this.secretKey = crypto.scryptSync(process.env.ENCRYPTION_PASSWORD!, 'salt', 32);
  }

  encrypt(text: string): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.secretKey);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData: EncryptedData): string {
    const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

## 🎯 성능 지표 및 SLA

### 주요 성능 지표

| 지표 | 목표 | 측정 방법 |
|-----|------|----------|
| 응답 시간 (95th percentile) | < 100ms | Prometheus histogram |
| 처리량 | > 10,000 RPS | Request counter |
| 가용성 | 99.9% | Uptime monitoring |
| 에러율 | < 0.1% | Error rate counter |
| 메모리 사용률 | < 80% | Container metrics |
| CPU 사용률 | < 70% | Container metrics |
| 디스크 사용률 | < 85% | Volume metrics |

### SLA 정의

```typescript
// SLA 모니터링 및 보고
export class SLAMonitor {
  private slaTargets = {
    availability: 99.9, // 99.9% 가용성
    responseTime: 100,  // 100ms 미만 응답 시간
    errorRate: 0.1,     // 0.1% 미만 에러율
    throughput: 10000   // 10,000 RPS 이상
  };

  async calculateSLI(metric: string, timeRange: TimeRange): Promise<number> {
    switch (metric) {
      case 'availability':
        return this.calculateAvailability(timeRange);
      case 'responseTime':
        return this.calculateP95ResponseTime(timeRange);
      case 'errorRate':
        return this.calculateErrorRate(timeRange);
      case 'throughput':
        return this.calculateThroughput(timeRange);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  async generateSLAReport(timeRange: TimeRange): Promise<SLAReport> {
    const metrics = Object.keys(this.slaTargets);
    const results: SLAResult[] = [];

    for (const metric of metrics) {
      const actual = await this.calculateSLI(metric, timeRange);
      const target = this.slaTargets[metric as keyof typeof this.slaTargets];
      const status = this.evaluateSLA(metric, actual, target);

      results.push({
        metric,
        actual,
        target,
        status,
        breach: status === 'BREACH'
      });
    }

    return {
      period: timeRange,
      results,
      overallStatus: results.every(r => r.status !== 'BREACH') ? 'MET' : 'BREACH'
    };
  }
}
```

이 문서는 AIRIS EPM 마이크로서비스 아키텍처의 전체적인 구조와 구현 세부사항을 포괄적으로 다루고 있습니다. 각 서비스는 독립적으로 운영 가능하면서도 전체 시스템으로서 통합된 모니터링 플랫폼을 제공합니다.