# AIRIS EPM Microservices Architecture

## 🏗️ Architecture Overview

### Domain-Driven Design Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                     API Gateway (GraphQL Federation)                 │
│                            (Port: 4000)                              │
└──────┬──────────────┬──────────────┬──────────────┬────────────────┘
       │              │              │              │
   ┌───▼───┐     ┌───▼───┐     ┌───▼───┐     ┌───▼───┐
   │Metrics│     │  Log  │     │ Trace │     │ Alert │
   │Service│     │Service│     │Service│     │Service│
   │ :8001 │     │ :8002 │     │ :8003 │     │ :8004 │
   └───┬───┘     └───┬───┘     └───┬───┘     └───┬───┘
       │              │              │              │
   ┌───▼──────────────▼──────────────▼──────────────▼───┐
   │           Service Discovery (Consul/Eureka)         │
   │                    (Port: 8500)                     │
   └──────────────────────┬───────────────────────────┘
                          │
   ┌──────────────────────▼───────────────────────────┐
   │         Message Bus (Kafka/RabbitMQ)             │
   │              (Port: 9092/5672)                   │
   └──────────────────────────────────────────────────┘
```

## 📦 Service Domains

### 1. Metrics Service (포트: 8001)
- **책임**: 성능 메트릭 수집, 집계, 저장
- **기술 스택**: Node.js/TypeScript, Express, ClickHouse
- **주요 기능**:
  - 실시간 메트릭 수집
  - 시계열 데이터 처리
  - 집계 및 다운샘플링
  - 메트릭 쿼리 API

### 2. Log Service (포트: 8002)
- **책임**: 로그 수집, 처리, 검색
- **기술 스택**: Node.js/TypeScript, Express, Elasticsearch
- **주요 기능**:
  - 구조화된 로그 수집
  - 로그 파싱 및 인덱싱
  - 전문 검색 기능
  - 로그 스트리밍

### 3. Trace Service (포트: 8003)
- **책임**: 분산 트레이싱, 서비스 맵
- **기술 스택**: Node.js/TypeScript, Express, Jaeger
- **주요 기능**:
  - 트레이스 수집 및 저장
  - 서비스 의존성 분석
  - 레이턴시 분석
  - Critical Path 분석

### 4. Alert Service (포트: 8004)
- **책임**: 알림 규칙 관리, 알림 전송
- **기술 스택**: Node.js/TypeScript, Express, Redis
- **주요 기능**:
  - 알림 규칙 엔진
  - 다중 채널 알림
  - 에스컬레이션 관리
  - 알림 억제 및 그룹화

## 🔧 Shared Components

### Base Microservice Framework
- Health checks
- Metrics collection
- Logging
- Configuration management
- Error handling
- Authentication/Authorization

### Service Communication
- **동기 통신**: gRPC/REST
- **비동기 통신**: Kafka/RabbitMQ
- **Service Discovery**: Consul/Eureka
- **Load Balancing**: Client-side (Ribbon)

### Resilience Patterns
- **Circuit Breaker**: Hystrix/Resilience4j
- **Retry Logic**: Exponential backoff
- **Bulkhead**: Thread pool isolation
- **Timeout**: Request timeout management
- **Rate Limiting**: Token bucket algorithm

## 🛠️ Technology Stack

### Core Technologies
- **Language**: TypeScript/Node.js
- **Framework**: Express.js / NestJS
- **Database**: 
  - ClickHouse (Metrics)
  - Elasticsearch (Logs)
  - PostgreSQL (Configuration)
  - Redis (Cache/Session)
- **Message Queue**: Kafka / RabbitMQ
- **Service Discovery**: Consul / Eureka
- **API Gateway**: Apollo Gateway (GraphQL)
- **Monitoring**: Prometheus + Grafana
- **Tracing**: Jaeger / Zipkin

### Development Tools
- **Containerization**: Docker
- **Orchestration**: Kubernetes / Docker Compose
- **CI/CD**: Jenkins / GitLab CI
- **Testing**: Jest, Supertest, K6
- **Documentation**: OpenAPI / AsyncAPI

## 📊 Data Flow

```
1. Data Ingestion
   Client → API Gateway → Service → Message Bus → Database

2. Query Processing
   Client → API Gateway → Service → Cache/Database → Response

3. Event Processing
   Event → Message Bus → Service → Processing → Storage

4. Alert Flow
   Metric/Log → Alert Service → Rule Engine → Notification
```

## 🔐 Security Considerations

- **Authentication**: JWT tokens
- **Authorization**: RBAC (Role-Based Access Control)
- **Encryption**: TLS 1.3 for all communications
- **API Security**: Rate limiting, input validation
- **Secrets Management**: HashiCorp Vault

## 📈 Scalability Strategy

- **Horizontal Scaling**: Kubernetes HPA
- **Database Sharding**: By time/tenant
- **Cache Strategy**: Redis cluster
- **Load Balancing**: NGINX/HAProxy
- **Message Partitioning**: Kafka partitions

## 🚀 Deployment Strategy

### Development
- Docker Compose for local development
- Hot reload for rapid development

### Staging/Production
- Kubernetes deployment
- Blue-green deployments
- Canary releases
- Automated rollback

## 📝 Service Contracts

### gRPC Proto Definitions
- Strongly typed service contracts
- Versioning support
- Backward compatibility

### GraphQL Schema
- Federation for unified API
- Schema stitching
- Type safety

### Event Schemas
- CloudEvents specification
- Schema registry
- Event versioning