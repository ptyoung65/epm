# AIRIS EPM API 참조 문서

## 📚 목차

1. [API 개요](#api-개요)
2. [인증 및 인가](#인증-및-인가)
3. [공통 응답 형식](#공통-응답-형식)
4. [Metrics Service API](#metrics-service-api)
5. [Log Service API](#log-service-api)
6. [Trace Service API](#trace-service-api)
7. [Alert Service API](#alert-service-api)
8. [서비스 간 통신](#서비스-간-통신)
9. [GraphQL API](#graphql-api)
10. [오류 코드](#오류-코드)

## 🎯 API 개요

AIRIS EPM은 RESTful API와 GraphQL API를 모두 제공하며, 각 마이크로서비스별로 독립적인 API 엔드포인트를 가집니다.

### Base URLs

```
API Gateway:     https://api.airis-epm.com/v1
Metrics Service: http://localhost:8001 (Direct)
Log Service:     http://localhost:8002 (Direct)  
Trace Service:   http://localhost:8003 (Direct)
Alert Service:   http://localhost:8004 (Direct)
GraphQL:         https://api.airis-epm.com/graphql
```

### API 버전

- **현재 버전**: v1
- **지원 형식**: JSON, GraphQL
- **문자 인코딩**: UTF-8
- **요청 한도**: 1000 requests/minute (기본)

## 🔐 인증 및 인가

### JWT 토큰 기반 인증

모든 API 요청에는 Bearer Token이 필요합니다:

```http
Authorization: Bearer <JWT_TOKEN>
```

#### 토큰 발급

```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

**응답:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "refresh_token": "refresh_token_here",
    "user": {
      "id": "user_123",
      "username": "admin",
      "roles": ["admin", "metrics_read", "logs_write"]
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### 토큰 갱신

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "refresh_token_here"
}
```

### 권한 체계 (RBAC)

| Role | Permissions |
|------|-------------|
| `admin` | 모든 리소스에 대한 전체 권한 |
| `metrics_read` | 메트릭 데이터 조회 권한 |
| `metrics_write` | 메트릭 데이터 생성/수정 권한 |
| `logs_read` | 로그 데이터 조회 권한 |
| `logs_write` | 로그 데이터 생성/수정 권한 |
| `traces_read` | 트레이스 데이터 조회 권한 |
| `alerts_manage` | 알림 규칙 관리 권한 |

## 📋 공통 응답 형식

### 성공 응답

```json
{
  "success": true,
  "data": {
    // 실제 데이터
  },
  "message": "Request processed successfully",
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_123456789",
  "pagination": {
    "page": 1,
    "size": 50,
    "total": 1000,
    "has_next": true
  }
}
```

### 오류 응답

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "value",
      "constraint": "must be greater than 0"
    },
    "trace_id": "trace_abc123"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_123456789"
}
```

### HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| `200` | OK - 요청 성공 |
| `201` | Created - 리소스 생성 성공 |
| `202` | Accepted - 비동기 처리 요청 접수 |
| `400` | Bad Request - 잘못된 요청 |
| `401` | Unauthorized - 인증 필요 |
| `403` | Forbidden - 권한 없음 |
| `404` | Not Found - 리소스 없음 |
| `429` | Too Many Requests - 요청 한도 초과 |
| `500` | Internal Server Error - 서버 오류 |
| `503` | Service Unavailable - 서비스 사용 불가 |

## 📊 Metrics Service API

**Base URL**: `/api/v1/metrics`

### 메트릭 데이터 전송

#### 단일 메트릭 전송

```http
POST /metrics
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "cpu.usage",
  "value": 75.5,
  "timestamp": "2024-01-15T10:30:00Z",
  "labels": {
    "host": "web-server-01",
    "region": "us-east-1",
    "environment": "production"
  },
  "metadata": {
    "source": "node_exporter",
    "version": "1.0.0"
  }
}
```

**응답:**

```json
{
  "success": true,
  "data": {
    "id": "metric_123456",
    "queued": true,
    "estimated_processing_time": "2s"
  },
  "message": "Metric accepted for processing"
}
```

#### 배치 메트릭 전송

```http
POST /metrics/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "metrics": [
    {
      "name": "cpu.usage",
      "value": 75.5,
      "timestamp": "2024-01-15T10:30:00Z",
      "labels": {"host": "web-server-01"}
    },
    {
      "name": "memory.usage", 
      "value": 85.2,
      "timestamp": "2024-01-15T10:30:00Z",
      "labels": {"host": "web-server-01"}
    }
  ]
}
```

**응답:**

```json
{
  "success": true,
  "data": {
    "accepted": 2,
    "rejected": 0,
    "batch_id": "batch_789012"
  }
}
```

### 메트릭 데이터 조회

#### 시계열 데이터 조회

```http
GET /metrics/query?name=cpu.usage&from=2024-01-15T10:00:00Z&to=2024-01-15T11:00:00Z&labels=host:web-server-01
Authorization: Bearer <token>
```

**Query Parameters:**

| 매개변수 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `name` | string | Y | 메트릭 이름 |
| `from` | string | Y | 시작 시간 (ISO 8601) |
| `to` | string | Y | 종료 시간 (ISO 8601) |
| `labels` | string | N | 라벨 필터 (`key:value,key2:value2`) |
| `interval` | string | N | 집계 간격 (`1m`, `5m`, `1h`, `1d`) |
| `aggregation` | string | N | 집계 함수 (`avg`, `sum`, `min`, `max`) |

**응답:**

```json
{
  "success": true,
  "data": {
    "metric_name": "cpu.usage",
    "time_range": {
      "from": "2024-01-15T10:00:00Z",
      "to": "2024-01-15T11:00:00Z"
    },
    "data_points": [
      {
        "timestamp": "2024-01-15T10:00:00Z",
        "value": 75.5,
        "labels": {"host": "web-server-01"}
      },
      {
        "timestamp": "2024-01-15T10:01:00Z", 
        "value": 78.2,
        "labels": {"host": "web-server-01"}
      }
    ],
    "aggregation": "raw",
    "total_points": 60
  }
}
```

#### 집계 데이터 조회

```http
GET /metrics/aggregate?name=cpu.usage&from=2024-01-15T00:00:00Z&to=2024-01-15T23:59:59Z&interval=1h&aggregation=avg
Authorization: Bearer <token>
```

**응답:**

```json
{
  "success": true,
  "data": {
    "metric_name": "cpu.usage",
    "aggregation": "avg",
    "interval": "1h",
    "data_points": [
      {
        "timestamp": "2024-01-15T10:00:00Z",
        "value": 75.8,
        "count": 60
      },
      {
        "timestamp": "2024-01-15T11:00:00Z",
        "value": 72.1,
        "count": 60
      }
    ]
  }
}
```

### 메트릭 관리

#### 메트릭 목록 조회

```http
GET /metrics?page=1&size=50&sort=name:asc
Authorization: Bearer <token>
```

#### 메트릭 삭제

```http
DELETE /metrics?name=cpu.usage&from=2024-01-15T00:00:00Z&to=2024-01-15T23:59:59Z
Authorization: Bearer <token>
```

## 📝 Log Service API

**Base URL**: `/api/v1/logs`

### 로그 데이터 전송

#### 구조화된 로그 전송

```http
POST /logs
Content-Type: application/json
Authorization: Bearer <token>

{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "ERROR",
  "message": "Database connection failed: timeout after 30s",
  "service": "user-api",
  "trace_id": "abc123def456ghi789",
  "span_id": "span_001_xyz",
  "labels": {
    "component": "database",
    "operation": "connect",
    "database": "users_db"
  },
  "stack_trace": "Error: Connection timeout\\n  at Database.connect()\\n  at UserService.init()",
  "user_id": "user_12345",
  "request_id": "req_67890",
  "duration_ms": 30000,
  "status_code": 500,
  "url": "/api/users/profile",
  "method": "GET"
}
```

#### 플레인 텍스트 로그 전송

```http
POST /logs/plain
Content-Type: text/plain
Authorization: Bearer <token>

2024-01-15 10:30:00.123 ERROR [user-api] Database connection failed: timeout after 30s
```

#### 배치 로그 전송

```http
POST /logs/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "level": "INFO", 
      "message": "Server started successfully",
      "service": "user-api"
    },
    {
      "timestamp": "2024-01-15T10:30:01Z",
      "level": "WARN",
      "message": "High memory usage detected",
      "service": "user-api"
    }
  ]
}
```

### 로그 검색 및 조회

#### 텍스트 검색

```http
GET /logs/search?q=database%20connection&from=2024-01-15T10:00:00Z&to=2024-01-15T11:00:00Z&size=100
Authorization: Bearer <token>
```

**Query Parameters:**

| 매개변수 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `q` | string | N | 검색 키워드 (Lucene 쿼리 문법 지원) |
| `from` | string | N | 시작 시간 |
| `to` | string | N | 종료 시간 |
| `level` | string | N | 로그 레벨 필터 |
| `service` | string | N | 서비스 필터 |
| `trace_id` | string | N | 트레이스 ID 필터 |
| `labels` | string | N | 라벨 필터 |
| `page` | number | N | 페이지 번호 (기본값: 1) |
| `size` | number | N | 페이지 크기 (기본값: 50, 최대: 1000) |
| `sort` | string | N | 정렬 (`timestamp:asc/desc`) |

**응답:**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log_123456",
        "timestamp": "2024-01-15T10:30:00.123Z",
        "level": "ERROR",
        "message": "Database connection failed: timeout after 30s",
        "service": "user-api",
        "trace_id": "abc123def456ghi789",
        "labels": {
          "component": "database"
        },
        "highlighted": {
          "message": ["<em>Database connection</em> failed: timeout after 30s"]
        }
      }
    ],
    "aggregations": {
      "levels": {
        "ERROR": 25,
        "WARN": 150,
        "INFO": 800,
        "DEBUG": 50
      },
      "services": {
        "user-api": 500,
        "auth-service": 300,
        "payment-service": 225
      }
    }
  },
  "pagination": {
    "page": 1,
    "size": 100,
    "total": 1025,
    "has_next": true
  }
}
```

#### 고급 쿼리 검색

```http
POST /logs/search/advanced
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "message": "database connection"
          }
        },
        {
          "term": {
            "level": "ERROR"
          }
        }
      ],
      "filter": [
        {
          "range": {
            "timestamp": {
              "gte": "2024-01-15T10:00:00Z",
              "lte": "2024-01-15T11:00:00Z"
            }
          }
        }
      ]
    }
  },
  "sort": [
    {
      "timestamp": {
        "order": "desc"
      }
    }
  ],
  "size": 100,
  "from": 0
}
```

### 로그 스트리밍

#### WebSocket 연결

```javascript
const ws = new WebSocket('ws://localhost:8002/logs/stream?token=<JWT_TOKEN>');

// 필터 설정
ws.send(JSON.stringify({
  type: 'subscribe',
  filters: {
    service: 'user-api',
    level: ['ERROR', 'WARN'],
    labels: {
      environment: 'production'
    }
  }
}));

// 실시간 로그 수신
ws.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log('새 로그:', log);
};
```

#### Server-Sent Events

```http
GET /logs/stream/sse?service=user-api&level=ERROR&token=<JWT_TOKEN>
Accept: text/event-stream
```

## 🔍 Trace Service API

**Base URL**: `/api/v1/traces`

### 트레이스 데이터 전송

#### 스팬 데이터 전송

```http
POST /traces
Content-Type: application/json
Authorization: Bearer <token>

{
  "trace_id": "abc123def456ghi789",
  "span_id": "span_001",
  "parent_span_id": null,
  "operation_name": "GET /api/users",
  "start_time": "2024-01-15T10:30:00.000Z",
  "end_time": "2024-01-15T10:30:00.250Z", 
  "duration_ms": 250,
  "service_name": "user-api",
  "tags": {
    "http.method": "GET",
    "http.url": "/api/users",
    "http.status_code": 200,
    "component": "http",
    "span.kind": "server"
  },
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:00.050Z",
      "message": "Querying database for users",
      "level": "info"
    },
    {
      "timestamp": "2024-01-15T10:30:00.200Z", 
      "message": "Query completed successfully",
      "level": "info"
    }
  ],
  "references": [
    {
      "type": "child_of",
      "trace_id": "abc123def456ghi789",
      "span_id": "parent_span_001"
    }
  ]
}
```

#### 배치 스팬 전송

```http
POST /traces/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "spans": [
    {
      "trace_id": "abc123def456ghi789",
      "span_id": "span_001",
      "operation_name": "GET /api/users",
      "start_time": "2024-01-15T10:30:00.000Z",
      "end_time": "2024-01-15T10:30:00.250Z",
      "service_name": "user-api"
    }
  ]
}
```

### 트레이스 조회

#### 트레이스 ID로 조회

```http
GET /traces/abc123def456ghi789
Authorization: Bearer <token>
```

**응답:**

```json
{
  "success": true,
  "data": {
    "trace_id": "abc123def456ghi789",
    "root_span": {
      "span_id": "span_001",
      "operation_name": "GET /api/users",
      "service_name": "user-api",
      "start_time": "2024-01-15T10:30:00.000Z",
      "end_time": "2024-01-15T10:30:00.250Z",
      "duration_ms": 250,
      "status": "OK"
    },
    "spans": [
      {
        "span_id": "span_001",
        "parent_span_id": null,
        "operation_name": "GET /api/users",
        "service_name": "user-api",
        "start_time": "2024-01-15T10:30:00.000Z",
        "end_time": "2024-01-15T10:30:00.250Z",
        "duration_ms": 250,
        "tags": {
          "http.method": "GET",
          "http.status_code": 200
        },
        "children": ["span_002", "span_003"]
      }
    ],
    "services": [
      {
        "name": "user-api",
        "span_count": 3,
        "operation_count": 2
      }
    ],
    "total_duration_ms": 250,
    "span_count": 3,
    "error_count": 0
  }
}
```

#### 트레이스 검색

```http
GET /traces/search?service=user-api&from=2024-01-15T10:00:00Z&to=2024-01-15T11:00:00Z&min_duration=100ms
Authorization: Bearer <token>
```

**Query Parameters:**

| 매개변수 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `service` | string | N | 서비스명 필터 |
| `operation` | string | N | 오퍼레이션명 필터 |
| `from` | string | N | 시작 시간 |
| `to` | string | N | 종료 시간 |
| `min_duration` | string | N | 최소 지속 시간 |
| `max_duration` | string | N | 최대 지속 시간 |
| `tags` | string | N | 태그 필터 (`key:value,key2:value2`) |
| `error` | boolean | N | 에러 포함 여부 |
| `limit` | number | N | 결과 제한 (기본값: 100) |

### 서비스 의존성 맵

#### 서비스 맵 조회

```http
GET /traces/services/dependencies?from=2024-01-15T00:00:00Z&to=2024-01-15T23:59:59Z
Authorization: Bearer <token>
```

**응답:**

```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "service": "user-api",
        "operation_count": 1500,
        "error_rate": 0.02,
        "avg_duration_ms": 125.5
      },
      {
        "service": "auth-service", 
        "operation_count": 800,
        "error_rate": 0.01,
        "avg_duration_ms": 50.2
      }
    ],
    "edges": [
      {
        "from": "user-api",
        "to": "auth-service",
        "call_count": 800,
        "avg_duration_ms": 45.3,
        "error_rate": 0.005
      }
    ]
  }
}
```

## 🚨 Alert Service API

**Base URL**: `/api/v1/alerts`

### 알림 규칙 관리

#### 알림 규칙 생성

```http
POST /rules
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "High CPU Usage Alert",
  "description": "Alert when CPU usage exceeds 80% for more than 5 minutes",
  "enabled": true,
  "conditions": {
    "type": "metric",
    "metric": "cpu.usage",
    "operator": "gt",
    "threshold": 80,
    "duration": "5m",
    "labels": {
      "environment": "production"
    }
  },
  "severity": "warning",
  "channels": ["email", "slack"],
  "labels": {
    "team": "infrastructure",
    "priority": "high"
  },
  "annotations": {
    "summary": "High CPU usage detected on {{ $labels.host }}",
    "description": "CPU usage is {{ $value }}% which is above the threshold of 80%"
  }
}
```

**응답:**

```json
{
  "success": true,
  "data": {
    "id": "rule_123456",
    "name": "High CPU Usage Alert",
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "last_evaluated": null,
    "next_evaluation": "2024-01-15T10:31:00Z"
  }
}
```

#### 복합 조건 알림 규칙

```http
POST /rules
Content-Type: application/json 
Authorization: Bearer <token>

{
  "name": "Service Health Check",
  "description": "Alert on service failure patterns",
  "enabled": true,
  "conditions": {
    "type": "composite",
    "logic": "AND",
    "conditions": [
      {
        "type": "metric", 
        "metric": "http.request.error_rate",
        "operator": "gt",
        "threshold": 0.1,
        "duration": "2m"
      },
      {
        "type": "log",
        "query": "level:ERROR AND service:user-api",
        "count": 10,
        "duration": "1m"
      }
    ]
  },
  "severity": "critical",
  "channels": ["email", "slack", "pagerduty"]
}
```

### 알림 규칙 조회 및 관리

#### 알림 규칙 목록

```http
GET /rules?page=1&size=50&status=active&severity=critical
Authorization: Bearer <token>
```

#### 알림 규칙 상세 조회

```http
GET /rules/rule_123456
Authorization: Bearer <token>
```

#### 알림 규칙 수정

```http
PUT /rules/rule_123456
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Updated High CPU Alert",
  "threshold": 85,
  "enabled": true
}
```

#### 알림 규칙 삭제

```http
DELETE /rules/rule_123456
Authorization: Bearer <token>
```

### 알림 채널 관리

#### 이메일 채널 생성

```http
POST /channels
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "ops-email",
  "type": "email",
  "enabled": true,
  "config": {
    "recipients": ["ops@company.com", "admin@company.com"],
    "subject_template": "[{{.Severity}}] {{.RuleName}} - {{.Timestamp}}",
    "body_template": "Alert: {{.Description}}\\nTime: {{.Timestamp}}\\nValue: {{.Value}}\\nLabels: {{.Labels}}"
  }
}
```

#### Slack 채널 생성

```http
POST /channels
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "ops-slack",
  "type": "slack",
  "enabled": true,
  "config": {
    "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
    "channel": "#alerts",
    "username": "AIRIS-EPM-Bot",
    "icon_emoji": ":rotating_light:",
    "message_template": {
      "text": "{{.Severity}} Alert: {{.RuleName}}",
      "attachments": [
        {
          "color": "{{if eq .Severity \"critical\"}}danger{{else if eq .Severity \"warning\"}}warning{{else}}good{{end}}",
          "fields": [
            {
              "title": "Description",
              "value": "{{.Description}}",
              "short": false
            }
          ]
        }
      ]
    }
  }
}
```

### 알림 이벤트 조회

#### 알림 이벤트 목록

```http
GET /events?from=2024-01-15T00:00:00Z&to=2024-01-15T23:59:59Z&severity=critical
Authorization: Bearer <token>
```

**응답:**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event_789012",
        "rule_id": "rule_123456",
        "rule_name": "High CPU Usage Alert",
        "severity": "warning",
        "status": "firing",
        "started_at": "2024-01-15T10:30:00Z",
        "resolved_at": null,
        "labels": {
          "host": "web-server-01",
          "region": "us-east-1"
        },
        "annotations": {
          "summary": "High CPU usage detected on web-server-01",
          "value": "85.5"
        },
        "channels_notified": ["email", "slack"],
        "notification_count": 3
      }
    ]
  }
}
```

## 🔗 서비스 간 통신

### gRPC 서비스 정의

#### Metrics Service gRPC

```protobuf
// metrics.proto
syntax = "proto3";

package airis.epm.metrics;

service MetricsService {
  rpc IngestMetric(MetricRequest) returns (MetricResponse);
  rpc IngestMetricsBatch(MetricBatchRequest) returns (MetricBatchResponse);
  rpc QueryMetrics(MetricQueryRequest) returns (MetricQueryResponse);
  rpc GetMetricMetadata(MetricMetadataRequest) returns (MetricMetadataResponse);
}

message MetricRequest {
  string name = 1;
  double value = 2;
  int64 timestamp = 3;
  map<string, string> labels = 4;
  map<string, string> metadata = 5;
}

message MetricResponse {
  bool success = 1;
  string message = 2;
  string metric_id = 3;
}

message MetricQueryRequest {
  string name = 1;
  int64 from_timestamp = 2;
  int64 to_timestamp = 3;
  map<string, string> label_filters = 4;
  string interval = 5;
  string aggregation = 6;
}
```

### Kafka 메시지 형식

#### 메트릭 이벤트

```json
{
  "topic": "metrics.ingested",
  "key": "cpu.usage.web-server-01",
  "value": {
    "event_type": "metric.ingested",
    "timestamp": "2024-01-15T10:30:00Z",
    "source_service": "metrics-service",
    "data": {
      "metric_name": "cpu.usage",
      "value": 75.5,
      "labels": {
        "host": "web-server-01"
      }
    },
    "trace_id": "abc123def456"
  }
}
```

#### 로그 이벤트

```json
{
  "topic": "logs.ingested",
  "key": "user-api.error",
  "value": {
    "event_type": "log.ingested",
    "timestamp": "2024-01-15T10:30:00Z",
    "source_service": "log-service",
    "data": {
      "level": "ERROR",
      "message": "Database connection failed",
      "service": "user-api",
      "trace_id": "abc123def456"
    }
  }
}
```

## 🎭 GraphQL API

**Base URL**: `/graphql`

### Schema Overview

```graphql
type Query {
  # Metrics
  metrics(filter: MetricFilter): [Metric!]!
  metricsByName(name: String!): [Metric!]!
  
  # Logs  
  logs(filter: LogFilter): LogSearchResult!
  logsByService(service: String!): [LogEntry!]!
  
  # Traces
  traces(filter: TraceFilter): [Trace!]!
  trace(traceId: String!): Trace
  serviceMap(timeRange: TimeRange!): ServiceMap!
  
  # Alerts
  alertRules(filter: AlertRuleFilter): [AlertRule!]!
  alertEvents(filter: AlertEventFilter): [AlertEvent!]!
}

type Mutation {
  # Metrics
  ingestMetric(input: MetricInput!): MetricResponse!
  
  # Logs
  ingestLog(input: LogInput!): LogResponse!
  
  # Alerts
  createAlertRule(input: AlertRuleInput!): AlertRule!
  updateAlertRule(id: String!, input: AlertRuleUpdateInput!): AlertRule!
  deleteAlertRule(id: String!): Boolean!
}
```

### 예시 쿼리

#### 메트릭 조회

```graphql
query GetCPUMetrics($filter: MetricFilter!) {
  metrics(filter: $filter) {
    name
    value
    timestamp
    labels {
      key
      value
    }
  }
}
```

**Variables:**

```json
{
  "filter": {
    "name": "cpu.usage",
    "timeRange": {
      "from": "2024-01-15T10:00:00Z",
      "to": "2024-01-15T11:00:00Z"
    },
    "labels": [
      {"key": "host", "value": "web-server-01"}
    ]
  }
}
```

#### 통합 대시보드 쿼리

```graphql
query DashboardData($timeRange: TimeRange!) {
  # CPU 메트릭
  cpuMetrics: metrics(filter: {
    name: "cpu.usage"
    timeRange: $timeRange
  }) {
    value
    timestamp
    labels { key value }
  }
  
  # 에러 로그
  errorLogs: logs(filter: {
    level: ERROR
    timeRange: $timeRange
  }) {
    entries {
      message
      timestamp
      service
    }
    total
  }
  
  # 활성 알림
  activeAlerts: alertEvents(filter: {
    status: FIRING
    timeRange: $timeRange
  }) {
    ruleName
    severity
    startedAt
    labels
  }
  
  # 서비스 맵
  serviceMap(timeRange: $timeRange) {
    nodes {
      service
      operationCount
      errorRate
    }
    edges {
      from
      to
      callCount
    }
  }
}
```

## ⚠️ 오류 코드

### 공통 오류 코드

| 코드 | HTTP 상태 | 설명 |
|------|-----------|------|
| `INVALID_REQUEST` | 400 | 잘못된 요청 형식 |
| `VALIDATION_ERROR` | 400 | 입력 데이터 검증 실패 |
| `AUTHENTICATION_REQUIRED` | 401 | 인증 토큰 필요 |
| `INVALID_TOKEN` | 401 | 유효하지 않은 토큰 |
| `TOKEN_EXPIRED` | 401 | 만료된 토큰 |
| `INSUFFICIENT_PERMISSIONS` | 403 | 권한 부족 |
| `RESOURCE_NOT_FOUND` | 404 | 리소스 없음 |
| `METHOD_NOT_ALLOWED` | 405 | 허용되지 않은 HTTP 메소드 |
| `CONFLICT` | 409 | 리소스 충돌 |
| `RATE_LIMIT_EXCEEDED` | 429 | 요청 한도 초과 |
| `INTERNAL_SERVER_ERROR` | 500 | 내부 서버 오류 |
| `SERVICE_UNAVAILABLE` | 503 | 서비스 사용 불가 |

### 서비스별 오류 코드

#### Metrics Service

| 코드 | 설명 |
|------|------|
| `INVALID_METRIC_NAME` | 유효하지 않은 메트릭 이름 |
| `INVALID_METRIC_VALUE` | 유효하지 않은 메트릭 값 |
| `INVALID_TIMESTAMP` | 유효하지 않은 타임스탬프 |
| `INVALID_LABELS` | 유효하지 않은 라벨 형식 |
| `METRIC_NOT_FOUND` | 메트릭 데이터 없음 |
| `CLICKHOUSE_CONNECTION_ERROR` | ClickHouse 연결 오류 |

#### Log Service

| 코드 | 설명 |
|------|------|
| `INVALID_LOG_LEVEL` | 유효하지 않은 로그 레벨 |
| `INVALID_LOG_FORMAT` | 유효하지 않은 로그 형식 |
| `ELASTICSEARCH_CONNECTION_ERROR` | Elasticsearch 연결 오류 |
| `SEARCH_QUERY_ERROR` | 검색 쿼리 오류 |

#### Alert Service

| 코드 | 설명 |
|------|------|
| `INVALID_ALERT_RULE` | 유효하지 않은 알림 규칙 |
| `RULE_NOT_FOUND` | 알림 규칙 없음 |
| `CHANNEL_NOT_FOUND` | 알림 채널 없음 |
| `NOTIFICATION_FAILED` | 알림 전송 실패 |

이 API 참조 문서는 AIRIS EPM 마이크로서비스 시스템의 모든 API 엔드포인트와 통신 방식을 상세하게 설명하고 있습니다. 각 API는 RESTful 원칙을 따르며, GraphQL을 통한 통합 쿼리도 지원합니다.