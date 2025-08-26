# AIRIS EPM 마이크로서비스 시스템 사용 매뉴얼

## 📚 목차

1. [시스템 개요](#시스템-개요)
2. [환경 구성](#환경-구성)
3. [서비스 시작 및 중지](#서비스-시작-및-중지)
4. [각 서비스 사용법](#각-서비스-사용법)
5. [API 사용 가이드](#api-사용-가이드)
6. [모니터링 및 디버깅](#모니터링-및-디버깅)
7. [문제 해결](#문제-해결)
8. [운영 가이드](#운영-가이드)

## 🎯 시스템 개요

AIRIS EPM(Enterprise Performance Monitoring)은 대규모 분산 환경에서 실시간 성능 모니터링을 제공하는 마이크로서비스 기반 플랫폼입니다.

### 주요 구성 요소

```
┌─────────────────────────────────────────────────────────────────┐
│                    Service Discovery (Consul)                   │
│                         Port: 8500                              │
└──────┬──────────────┬──────────────┬──────────────┬────────────┘
       │              │              │              │
   ┌───▼───┐     ┌───▼───┐     ┌───▼───┐     ┌───▼───┐
   │Metrics│     │  Log  │     │ Trace │     │ Alert │
   │Service│     │Service│     │Service│     │Service│
   │ :8001 │     │ :8002 │     │ :8003 │     │ :8004 │
   └───────┘     └───────┘     └───────┘     └───────┘
```

### 서비스별 역할

| 서비스 | 포트 | 역할 | 데이터 저장소 |
|--------|------|------|--------------|
| **Metrics Service** | 8001 | 시계열 메트릭 수집/집계 | ClickHouse |
| **Log Service** | 8002 | 구조화된 로그 처리/검색 | Elasticsearch |
| **Trace Service** | 8003 | 분산 트레이싱 수집/분석 | Jaeger |
| **Alert Service** | 8004 | 알림 규칙 관리/전송 | Redis |

## 🔧 환경 구성

### 1. 사전 요구사항

```bash
# Docker & Docker Compose
docker --version    # >= 20.10.0
docker-compose --version  # >= 2.0.0

# Node.js (개발시)
node --version      # >= 18.0.0
npm --version       # >= 8.0.0
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일 생성:

```bash
# 복사하여 .env 파일로 저장
cp .env.example .env

# 필수 환경 변수 설정
cat > .env << 'EOF'
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

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
API_RATE_LIMIT=1000

# Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CHANNEL=#alerts

# Feature Flags
ENABLE_DISTRIBUTED_TRACING=true
ENABLE_SERVICE_MESH=false
ENABLE_AUTO_SCALING=true
EOF
```

### 3. 디렉토리 구조 확인

```bash
AIRIS_EPM/
├── services/
│   ├── shared/                 # 공통 라이브러리
│   ├── metrics-service/        # 메트릭 서비스
│   ├── log-service/           # 로그 서비스
│   ├── trace-service/         # 트레이싱 서비스
│   ├── alert-service/         # 알림 서비스
│   └── service-registry/      # 서비스 레지스트리
├── docker-compose.yml         # 컨테이너 오케스트레이션
├── .env                       # 환경 변수
└── scripts/                   # 운영 스크립트
    ├── start-all.sh
    ├── stop-all.sh
    └── health-check.sh
```

## 🚀 서비스 시작 및 중지

### 1. 전체 시스템 시작

```bash
# 모든 서비스 시작
docker-compose up -d

# 또는 스크립트 사용
./scripts/start-all.sh
```

### 2. 개별 서비스 시작

```bash
# 특정 서비스만 시작
docker-compose up -d consul redis clickhouse elasticsearch kafka jaeger
docker-compose up -d metrics-service
docker-compose up -d log-service
docker-compose up -d trace-service
docker-compose up -d alert-service
```

### 3. 서비스 상태 확인

```bash
# 컨테이너 상태 확인
docker-compose ps

# 서비스 로그 확인
docker-compose logs -f metrics-service

# 헬스 체크
./scripts/health-check.sh

# 또는 개별 헬스 체크
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health
```

### 4. 서비스 중지

```bash
# 모든 서비스 중지
docker-compose down

# 데이터까지 완전 삭제
docker-compose down -v

# 또는 스크립트 사용
./scripts/stop-all.sh
```

## 🔍 각 서비스 사용법

### 1. Metrics Service (포트: 8001)

#### 메트릭 데이터 전송

```bash
# 단일 메트릭 전송
curl -X POST http://localhost:8001/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cpu.usage",
    "value": 75.5,
    "timestamp": "2024-01-15T10:30:00Z",
    "labels": {
      "host": "web-server-01",
      "region": "us-east-1"
    }
  }'

# 배치 메트릭 전송
curl -X POST http://localhost:8001/metrics/batch \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "name": "memory.usage",
        "value": 85.2,
        "labels": {"host": "web-server-01"}
      },
      {
        "name": "disk.usage",
        "value": 45.8,
        "labels": {"host": "web-server-01", "mount": "/"}
      }
    ]
  }'
```

#### 메트릭 조회

```bash
# 시계열 데이터 조회
curl "http://localhost:8001/metrics/query?name=cpu.usage&from=2024-01-15T10:00:00Z&to=2024-01-15T11:00:00Z"

# 집계 데이터 조회 (1분 간격)
curl "http://localhost:8001/metrics/query?name=cpu.usage&from=2024-01-15T10:00:00Z&to=2024-01-15T11:00:00Z&interval=1m"

# 라벨 필터링
curl "http://localhost:8001/metrics/query?name=cpu.usage&labels=host:web-server-01"
```

### 2. Log Service (포트: 8002)

#### 로그 데이터 전송

```bash
# 구조화된 로그 전송
curl -X POST http://localhost:8002/logs \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "ERROR",
    "message": "Database connection failed",
    "service": "user-api",
    "trace_id": "abc123def456",
    "span_id": "789ghi012jkl",
    "labels": {
      "component": "database",
      "operation": "connect"
    },
    "stack_trace": "Error: Connection timeout\n  at Database.connect()\n  at UserService.init()",
    "user_id": "user_12345",
    "request_id": "req_67890"
  }'

# 플레인 텍스트 로그
curl -X POST http://localhost:8002/logs/plain \
  -H "Content-Type: text/plain" \
  -d "2024-01-15 10:30:00 ERROR [user-api] Database connection failed"
```

#### 로그 검색

```bash
# 키워드 검색
curl "http://localhost:8002/logs/search?q=database&from=2024-01-15T10:00:00Z&to=2024-01-15T11:00:00Z"

# 로그 레벨 필터링
curl "http://localhost:8002/logs/search?level=ERROR&from=2024-01-15T10:00:00Z&to=2024-01-15T11:00:00Z"

# 서비스별 로그 조회
curl "http://localhost:8002/logs/search?service=user-api&limit=100"

# 복합 검색
curl "http://localhost:8002/logs/search?q=database%20AND%20error&service=user-api&level=ERROR"
```

### 3. Trace Service (포트: 8003)

#### 트레이스 데이터 전송

```bash
# 스팬 데이터 전송
curl -X POST http://localhost:8003/traces \
  -H "Content-Type: application/json" \
  -d '{
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
      "component": "http"
    },
    "logs": [
      {
        "timestamp": "2024-01-15T10:30:00.050Z",
        "message": "Query database for users"
      }
    ]
  }'
```

#### 트레이스 조회

```bash
# 트레이스 ID로 조회
curl "http://localhost:8003/traces/abc123def456ghi789"

# 서비스별 트레이스 조회
curl "http://localhost:8003/traces/search?service=user-api&from=2024-01-15T10:00:00Z&to=2024-01-15T11:00:00Z"

# 느린 트레이스 조회 (500ms 이상)
curl "http://localhost:8003/traces/search?min_duration=500ms"

# 오류 트레이스 조회
curl "http://localhost:8003/traces/search?tags=error:true"
```

### 4. Alert Service (포트: 8004)

#### 알림 규칙 생성

```bash
# 메트릭 기반 알림 규칙
curl -X POST http://localhost:8004/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High CPU Usage",
    "description": "Alert when CPU usage exceeds 80%",
    "conditions": {
      "metric": "cpu.usage",
      "operator": "gt",
      "threshold": 80,
      "duration": "5m"
    },
    "severity": "warning",
    "channels": ["email", "slack"],
    "enabled": true,
    "labels": {
      "team": "infrastructure",
      "environment": "production"
    }
  }'

# 로그 기반 알림 규칙
curl -X POST http://localhost:8004/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Database Errors",
    "description": "Alert on database connection errors",
    "conditions": {
      "log_query": "level:ERROR AND message:database",
      "count": 10,
      "duration": "1m"
    },
    "severity": "critical",
    "channels": ["email", "slack", "sms"],
    "enabled": true
  }'
```

#### 알림 채널 설정

```bash
# 이메일 채널 설정
curl -X POST http://localhost:8004/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "email",
    "type": "email",
    "config": {
      "recipients": ["admin@company.com", "ops@company.com"],
      "subject_template": "[ALERT] {{.RuleName}} - {{.Severity}}",
      "body_template": "Alert: {{.Description}}\nTime: {{.Timestamp}}\nValue: {{.Value}}"
    },
    "enabled": true
  }'

# Slack 채널 설정
curl -X POST http://localhost:8004/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "slack",
    "type": "slack",
    "config": {
      "webhook_url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
      "channel": "#alerts",
      "username": "AIRIS-EPM",
      "icon_emoji": ":warning:"
    },
    "enabled": true
  }'
```

## 📡 API 사용 가이드

### 1. 인증

모든 API 요청에는 JWT 토큰이 필요합니다:

```bash
# 토큰 발급
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password"
  }'

# 응답
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}

# API 요청시 토큰 사용
curl -X GET http://localhost:8001/metrics \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. 공통 응답 형식

```json
{
  "success": true,
  "data": {},
  "message": "Success",
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_12345"
}

// 오류 응답
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "value"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_12345"
}
```

### 3. 페이징 및 필터링

```bash
# 페이징
curl "http://localhost:8002/logs?page=1&size=50"

# 정렬
curl "http://localhost:8002/logs?sort=timestamp:desc"

# 시간 범위 필터링
curl "http://localhost:8001/metrics?from=2024-01-15T00:00:00Z&to=2024-01-15T23:59:59Z"

# 복합 필터링
curl "http://localhost:8002/logs?level=ERROR&service=user-api&from=2024-01-15T10:00:00Z&limit=100"
```

### 4. 배치 처리

```bash
# 메트릭 배치 전송
curl -X POST http://localhost:8001/metrics/batch \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {"name": "cpu.usage", "value": 75.5, "labels": {"host": "server-01"}},
      {"name": "memory.usage", "value": 85.2, "labels": {"host": "server-01"}},
      {"name": "disk.usage", "value": 45.8, "labels": {"host": "server-01"}}
    ]
  }'

# 로그 배치 전송
curl -X POST http://localhost:8002/logs/batch \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      {"level": "INFO", "message": "Server started", "service": "user-api"},
      {"level": "WARN", "message": "High memory usage", "service": "user-api"},
      {"level": "ERROR", "message": "Database error", "service": "user-api"}
    ]
  }'
```

## 🔍 모니터링 및 디버깅

### 1. 시스템 상태 모니터링

```bash
# 전체 시스템 헬스 체크
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health

# 상세 헬스 체크
curl http://localhost:8001/health/detailed

# 메트릭 엔드포인트 (Prometheus 형식)
curl http://localhost:8001/metrics/prometheus
curl http://localhost:8002/metrics/prometheus
curl http://localhost:8003/metrics/prometheus
curl http://localhost:8004/metrics/prometheus
```

### 2. 서비스 디스커버리 상태

```bash
# Consul UI 접속
open http://localhost:8500

# 등록된 서비스 확인
curl http://localhost:8500/v1/agent/services

# 서비스 헬스 상태 확인
curl http://localhost:8500/v1/health/service/metrics-service
```

### 3. 로그 분석

```bash
# 컨테이너 로그 확인
docker-compose logs -f metrics-service
docker-compose logs -f log-service
docker-compose logs -f trace-service
docker-compose logs -f alert-service

# 특정 시간 범위 로그
docker-compose logs --since="2024-01-15T10:00:00" --until="2024-01-15T11:00:00" metrics-service

# 로그 패턴 검색
docker-compose logs metrics-service | grep ERROR
docker-compose logs metrics-service | grep "Database connection"
```

### 4. 성능 모니터링

```bash
# 컨테이너 리소스 사용량
docker stats

# 특정 컨테이너 모니터링
docker stats airis_metrics-service_1 airis_log-service_1

# 네트워크 연결 상태
netstat -tulnp | grep :8001
netstat -tulnp | grep :8002
netstat -tulnp | grep :8003
netstat -tulnp | grep :8004
```

### 5. Jaeger 트레이싱 UI

```bash
# Jaeger UI 접속
open http://localhost:16686

# 트레이스 검색 예시
# 1. Service: metrics-service
# 2. Operation: POST /metrics
# 3. Time Range: Last Hour
```

## 🛠️ 문제 해결

### 1. 일반적인 문제

#### 서비스가 시작되지 않을 때

```bash
# 포트 충돌 확인
sudo lsof -i :8001
sudo lsof -i :8002
sudo lsof -i :8003
sudo lsof -i :8004

# 포트 사용 중인 프로세스 종료
sudo kill -9 $(lsof -t -i:8001)

# 디스크 공간 확인
df -h

# 메모리 사용량 확인
free -h

# Docker 리소스 확인
docker system df
docker system prune -f  # 불필요한 리소스 정리
```

#### 데이터베이스 연결 실패

```bash
# ClickHouse 연결 테스트
curl "http://localhost:8123/?query=SELECT%201"

# Elasticsearch 연결 테스트
curl http://localhost:9200/_cluster/health

# Redis 연결 테스트
docker exec -it airis_redis_1 redis-cli ping

# Kafka 연결 테스트
docker exec -it airis_kafka_1 kafka-topics --list --bootstrap-server localhost:9092
```

#### 서비스 디스커버리 문제

```bash
# Consul 상태 확인
curl http://localhost:8500/v1/status/leader

# 서비스 등록 상태 확인
curl http://localhost:8500/v1/agent/services

# 수동 서비스 등록
curl -X PUT http://localhost:8500/v1/agent/service/register \
  -d '{
    "ID": "metrics-service-1",
    "Name": "metrics-service",
    "Address": "localhost",
    "Port": 8001,
    "Check": {
      "HTTP": "http://localhost:8001/health",
      "Interval": "30s"
    }
  }'
```

### 2. 성능 문제

#### 높은 메모리 사용량

```bash
# 컨테이너별 메모리 사용량 확인
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# 메모리 제한 설정 (docker-compose.yml)
services:
  metrics-service:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

#### 높은 CPU 사용량

```bash
# CPU 사용률 모니터링
top -p $(pgrep -d, -f "metrics-service")

# 프로파일링 활성화
curl -X POST http://localhost:8001/debug/profile/start
# ... 부하 테스트 실행 ...
curl -X POST http://localhost:8001/debug/profile/stop
```

#### 느린 응답 시간

```bash
# 응답 시간 측정
time curl http://localhost:8001/health

# 부하 테스트
ab -n 1000 -c 10 http://localhost:8001/health

# 또는 wrk 사용
wrk -t12 -c400 -d30s http://localhost:8001/metrics
```

### 3. 데이터 무결성 문제

#### ClickHouse 데이터 확인

```bash
# ClickHouse 클라이언트 접속
docker exec -it airis_clickhouse_1 clickhouse-client

# 테이블 확인
SHOW TABLES;

# 메트릭 데이터 확인
SELECT name, count() as total, min(timestamp), max(timestamp)
FROM metrics
GROUP BY name
ORDER BY total DESC
LIMIT 10;

# 인덱스 상태 확인
SELECT table, name, type, key
FROM system.data_skipping_indices
WHERE database = 'airis';
```

#### Elasticsearch 인덱스 상태

```bash
# 인덱스 목록 확인
curl http://localhost:9200/_cat/indices?v

# 인덱스 헬스 상태
curl http://localhost:9200/_cluster/health?level=indices

# 로그 데이터 확인
curl "http://localhost:9200/logs-*/_search?size=10&sort=@timestamp:desc"

# 인덱스 설정 확인
curl http://localhost:9200/logs-2024.01/_settings?pretty
```

## 🚁 운영 가이드

### 1. 정기 점검

#### 일일 점검 스크립트

```bash
#!/bin/bash
# scripts/daily-check.sh

echo "=== AIRIS EPM Daily Health Check ==="
echo "Date: $(date)"

# 서비스 상태 확인
echo "\n=== Service Status ==="
docker-compose ps

# 디스크 사용량 확인
echo "\n=== Disk Usage ==="
df -h

# 메모리 사용량 확인
echo "\n=== Memory Usage ==="
free -h

# 로그 에러 확인 (최근 24시간)
echo "\n=== Recent Errors ==="
docker-compose logs --since="24h" | grep -i error | wc -l

# 데이터베이스 상태 확인
echo "\n=== Database Health ==="
curl -s http://localhost:8123/?query=SELECT%201 && echo "ClickHouse: OK" || echo "ClickHouse: ERROR"
curl -s http://localhost:9200/_cluster/health | jq -r '.status' | sed 's/^/Elasticsearch: /'
docker exec -it airis_redis_1 redis-cli ping | sed 's/^/Redis: /'

echo "\n=== Check Complete ==="
```

#### 주간 점검

```bash
#!/bin/bash
# scripts/weekly-check.sh

echo "=== AIRIS EPM Weekly Maintenance ==="

# 로그 로테이션
docker-compose logs --since="7d" > logs/weekly-$(date +%Y%m%d).log
docker-compose logs --no-log-prefix | head -1000 > logs/recent.log

# 데이터 정리
echo "Cleaning old data..."
docker exec -it airis_clickhouse_1 clickhouse-client -q "
  OPTIMIZE TABLE metrics FINAL;
  ALTER TABLE metrics DELETE WHERE date < today() - INTERVAL 30 DAY;
"

# 인덱스 최적화
curl -X POST "http://localhost:9200/logs-*/_forcemerge?max_num_segments=1"

# 컨테이너 이미지 업데이트 확인
docker-compose pull

echo "Weekly maintenance complete"
```

### 2. 백업 및 복구

#### 데이터 백업

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backup/airis-$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# ClickHouse 백업
echo "Backing up ClickHouse..."
docker exec airis_clickhouse_1 clickhouse-client -q "
  CREATE TABLE metrics_backup AS metrics;
  INSERT INTO metrics_backup SELECT * FROM metrics;
"

# Elasticsearch 스냅숏
echo "Creating Elasticsearch snapshot..."
curl -X PUT "localhost:9200/_snapshot/backup/$(date +%Y%m%d)" -H 'Content-Type: application/json' -d'
{
  "indices": "logs-*",
  "ignore_unavailable": true,
  "include_global_state": false
}
'

# 설정 파일 백업
cp docker-compose.yml $BACKUP_DIR/
cp .env $BACKUP_DIR/
cp -r services/*/src/config $BACKUP_DIR/configs/

echo "Backup completed: $BACKUP_DIR"
```

#### 데이터 복구

```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_DATE=$1
if [ -z "$BACKUP_DATE" ]; then
  echo "Usage: $0 <backup_date> (e.g., 20240115)"
  exit 1
fi

BACKUP_DIR="/backup/airis-$BACKUP_DATE"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory not found: $BACKUP_DIR"
  exit 1
fi

echo "Restoring from backup: $BACKUP_DATE"

# 서비스 중지
docker-compose down

# 설정 파일 복원
cp $BACKUP_DIR/docker-compose.yml ./
cp $BACKUP_DIR/.env ./

# 서비스 시작
docker-compose up -d

# 데이터 복원 대기
sleep 30

# Elasticsearch 복원
curl -X POST "localhost:9200/_snapshot/backup/$BACKUP_DATE/_restore" -H 'Content-Type: application/json' -d'
{
  "indices": "logs-*",
  "ignore_unavailable": true
}
'

echo "Restore completed"
```

### 3. 확장성 관리

#### 자동 스케일링 설정

```yaml
# docker-compose.override.yml (프로덕션용)
version: '3.8'

services:
  metrics-service:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: any
        delay: 5s
        max_attempts: 3
        window: 120s
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        monitor: 60s
        max_failure_ratio: 0.3

  log-service:
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

#### 로드밸런싱 설정

```bash
# nginx.conf
upstream metrics_backend {
    server localhost:8001;
    server localhost:8011;  # 추가 인스턴스
    server localhost:8021;  # 추가 인스턴스
}

server {
    listen 80;
    location /metrics {
        proxy_pass http://metrics_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 4. 보안 관리

#### SSL/TLS 설정

```bash
# Let's Encrypt 인증서 생성
certbot certonly --standalone -d airis.yourdomain.com

# nginx SSL 설정
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/airis.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/airis.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8001;
        proxy_ssl_verify off;
    }
}
```

#### 방화벽 설정

```bash
# UFW 방화벽 설정
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 8500/tcp    # Consul (내부 네트워크만)
sudo ufw enable
```

### 5. 성능 튜닝

#### ClickHouse 최적화

```sql
-- clickhouse-config.xml 설정
<clickhouse>
    <max_connections>1000</max_connections>
    <max_concurrent_queries>100</max_concurrent_queries>
    <uncompressed_cache_size>8589934592</uncompressed_cache_size>
    <mark_cache_size>5368709120</mark_cache_size>
    
    <merge_tree>
        <max_suspicious_broken_parts>100</max_suspicious_broken_parts>
        <parts_to_delay_insert>150</parts_to_delay_insert>
        <parts_to_throw_insert>300</parts_to_throw_insert>
        <max_delay_to_insert>1</max_delay_to_insert>
    </merge_tree>
</clickhouse>
```

#### Elasticsearch 최적화

```json
{
  "persistent": {
    "cluster.routing.allocation.disk.threshold.enabled": true,
    "cluster.routing.allocation.disk.watermark.low": "85%",
    "cluster.routing.allocation.disk.watermark.high": "90%",
    "cluster.routing.allocation.disk.watermark.flood_stage": "95%",
    "indices.fielddata.cache.size": "40%",
    "indices.queries.cache.size": "10%",
    "indices.requests.cache.size": "2%"
  }
}
```

이 매뉴얼은 AIRIS EPM 마이크로서비스 시스템의 완전한 사용법과 운영 가이드를 제공합니다. 각 섹션을 참조하여 시스템을 효율적으로 운영하고 관리하실 수 있습니다.