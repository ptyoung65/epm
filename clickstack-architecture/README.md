# AIRIS-MON ClickStack Architecture

한국형 AI 위험 분석 시스템 모니터링 - ClickStack 엔진 기반 HyperDX 스타일 UI

## 📋 개요

AIRIS-MON은 **ClickStack 아키텍처**를 기반으로 하는 통합 관측 가능성 플랫폼으로, 한국 비즈니스 환경에 최적화된 **HyperDX 스타일 UI**를 제공합니다.

### 🏗️ 아키텍처 특징

- **ClickStack 통합 관측 가능성**: "Wide Events" 모델로 메트릭, 로그, 트레이스, 알림을 통합
- **한국형 UX**: 한국 비즈니스 문화에 맞춘 색상, 시간대, 알림 시스템
- **실시간 분석**: Kafka 기반 스트리밍과 ClickHouse 고성능 분석
- **마이크로서비스**: 확장 가능한 서비스 기반 아키텍처

## 🚀 빠른 시작

### 1. 환경 준비

```bash
# 저장소 클론
git clone <repository-url>
cd airis-mon/clickstack-architecture

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 필요한 설정 추가

# 데이터 디렉토리 생성
mkdir -p data/{clickhouse,kafka,redis,prometheus,grafana}
mkdir -p logs/{api-gateway,data-ingestion,analytics-engine,alert-manager,nginx,dashboard}
```

### 2. Docker Compose로 시작

```bash
# 개발 환경
docker-compose up -d

# 프로덕션 환경
docker-compose -f docker-compose.production.yml up -d
```

### 3. 서비스 확인

```bash
# 서비스 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f api-gateway
```

## 📊 접속 주소

| 서비스 | URL | 설명 |
|--------|-----|------|
| **Korean HyperDX Dashboard** | http://localhost:3000 | 메인 대시보드 (한국어 UI) |
| **API Gateway** | http://localhost:3002 | REST API 엔드포인트 |
| **ClickHouse** | http://localhost:8123 | 데이터베이스 웹 인터페이스 |
| **Kafka UI** | http://localhost:9092 | Kafka 관리 (개발용) |
| **Redis** | localhost:6379 | 캐싱 서버 |
| **Prometheus** | http://localhost:9090 | 메트릭 수집 |
| **Grafana** | http://localhost:3333 | 백업 대시보드 |
| **Jaeger** | http://localhost:16686 | 분산 트레이싱 |

## 🏢 한국형 비즈니스 기능

### ⏰ 한국 시간대 최적화

- **업무시간 인식**: 오전 9시~오후 6시 업무시간 자동 감지
- **한국 표준시(KST)**: 모든 시간 표시를 Asia/Seoul 기준
- **업무시간별 알림**: 업무시간/업무외시간에 따른 차별화된 알림 전략

### 🎨 한국 문화 UX

- **색상 의미 반전**: 
  - 🔴 빨강 = 긍정/성공 (한국 문화)
  - 🟢 초록 = 주의/경고 (한국 문화)
- **경어 사용**: 비즈니스 환경에 적합한 존댓말 표현
- **그룹화 선호**: 관련 알림을 그룹으로 처리

### 📱 알림 시스템

```javascript
// 업무시간별 에스컬레이션 규칙
{
  critical: { businessHours: 0, afterHours: 300 },    // 즉시 vs 5분
  high: { businessHours: 300, afterHours: 900 },      // 5분 vs 15분
  medium: { businessHours: 900, afterHours: 1800 },   // 15분 vs 30분
  low: { businessHours: 1800, afterHours: 3600 }      // 30분 vs 60분
}
```

## 🔧 서비스 구성

### Core Services

#### 1. **API Gateway** (`/services/api-gateway`)
- **포트**: 3002
- **기능**: 통합 API 엔드포인트, 한국 시간대 처리
- **기술**: Node.js, Express, ClickHouse 통합

#### 2. **ClickHouse Service** (`/services/api-gateway/src/services/clickhouse`)
- **포트**: 8123, 9000
- **기능**: Wide Events 모델 기반 통합 데이터 저장
- **특징**: 한국 시간대 필드, 비즈니스 시간 분석

#### 3. **Data Ingestion** (`/services/data-ingestion`)
- **기능**: 실시간 데이터 수집 및 배치 처리
- **처리량**: 1000개/배치, 5초 간격 플러시

#### 4. **Analytics Engine** (`/services/analytics-engine`)
- **기능**: 이상 탐지, 트렌드 분석, 한국 비즈니스 패턴 분석
- **알고리즘**: 통계적 이상 탐지, 예측 분석

#### 5. **Alert Manager** (`/services/alert-manager`)
- **기능**: 지능형 알림 라우팅, 한국 문화 맞춤 알림
- **채널**: Slack, Email, SMS, Webhook

### Data Layer

#### **Kafka** (포트: 9092)
- 실시간 데이터 스트리밍
- 토픽: metrics, logs, traces, alerts, korean-analytics

#### **Redis** (포트: 6379)
- 세션 관리, 캐싱
- 한국 업무시간 기반 TTL 조정

#### **ClickHouse** (포트: 8123, 9000)
- Wide Events 스키마
- 한국 시간대 최적화된 집계

### UI Layer

#### **Korean HyperDX Dashboard** (포트: 3000)
- React 18, Material-UI
- 한국어 지역화, 다크 테마
- 실시간 WebSocket 업데이트

## 📈 Wide Events 스키마

```sql
CREATE TABLE wide_events (
    -- 핵심 필드
    timestamp DateTime64(3, 'Asia/Seoul'),
    event_type LowCardinality(String),
    service_name LowCardinality(String),
    
    -- 메트릭
    metric_name Nullable(String),
    metric_value Nullable(Float64),
    metric_unit Nullable(String),
    metric_tags Map(String, String),
    
    -- 로그
    log_level Nullable(String),
    log_message Nullable(String),
    log_context Map(String, String),
    
    -- 트레이스
    trace_id Nullable(String),
    span_id Nullable(String),
    span_duration Nullable(UInt64),
    trace_status Nullable(String),
    
    -- 알림
    alert_severity Nullable(String),
    alert_status Nullable(String),
    alert_message Nullable(String),
    
    -- 한국 시간대 컨텍스트
    korean_hour UInt8,
    korean_day_of_week String,
    korean_business_hours Bool,
    time_category String,
    
    -- 공통 필드
    environment String DEFAULT 'production',
    source String DEFAULT 'airis-mon',
    korean_timestamp String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (service_name, event_type, timestamp);
```

## 🛠️ 개발 가이드

### 로컬 개발 환경

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 타입 체크
npm run typecheck

# 린트 및 포맷
npm run lint
npm run format
```

### API 엔드포인트

#### 대시보드 API
```bash
# 대시보드 개요
GET /api/v1/dashboard/overview?timeRange=1h

# 시스템 메트릭
GET /api/v1/metrics/system?timeRange=24h

# 최근 알림
GET /api/v1/alerts/recent?limit=10

# 서비스 상태
GET /api/v1/health/services
```

#### 분석 API
```bash
# 이상 탐지
GET /api/v1/analytics/anomalies?timeRange=6h&sensitivity=medium

# 트렌드 분석
GET /api/v1/analytics/trends?timeRange=7d

# 한국 비즈니스 분석
GET /api/v1/analytics/korean-patterns?includeWeekends=true
```

### 환경 변수

```bash
# 기본 설정
NODE_ENV=production
TIMEZONE=Asia/Seoul
KOREAN_BUSINESS_HOURS_START=9
KOREAN_BUSINESS_HOURS_END=18

# ClickHouse 설정
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=admin
CLICKHOUSE_DATABASE=airis_mon

# Kafka 설정
KAFKA_BROKERS=localhost:9092

# Redis 설정
REDIS_HOST=localhost
REDIS_PORT=6379

# 알림 설정 (선택사항)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
EMAIL_SMTP_HOST=smtp.gmail.com
SMS_API_KEY=your_sms_api_key
```

## 🔍 모니터링 및 관찰 가능성

### 메트릭 수집

- **시스템 메트릭**: CPU, 메모리, 디스크, 네트워크
- **애플리케이션 메트릭**: 요청 수, 응답 시간, 에러율
- **비즈니스 메트릭**: 한국 업무시간별 사용 패턴

### 로그 관리

- **구조화된 로그**: JSON 형식의 일관된 로그
- **한국 시간대**: 모든 로그에 KST 타임스탬프
- **로그 레벨**: ERROR, WARN, INFO, DEBUG

### 분산 트레이싱

- **Jaeger 통합**: 마이크로서비스 간 요청 추적
- **성능 분석**: 병목 지점 식별
- **의존성 맵**: 서비스 간 의존 관계 시각화

## 🚨 알림 및 에스컬레이션

### 알림 규칙

```javascript
// 기본 알림 규칙
const alertRules = [
  {
    name: '높은 오류율',
    metric: 'error_rate',
    threshold: 5, // 5%
    severity: 'high'
  },
  {
    name: '느린 응답 시간',
    metric: 'response_time',
    threshold: 1000, // 1000ms
    severity: 'medium'
  },
  {
    name: 'CPU 사용률 높음',
    metric: 'cpu_usage',
    threshold: 80, // 80%
    severity: 'high'
  }
];
```

### 에스컬레이션 규칙

- **업무시간**: 더 빠른 에스컬레이션
- **업무외시간**: 조금 더 관대한 에스컬레이션
- **한국 문화**: 그룹 알림 선호, 존댓말 사용

## 🔐 보안

### 인증 및 권한

- **API 키 기반**: 서비스 간 인증
- **세션 관리**: Redis 기반 세션 저장
- **권한 제어**: 역할 기반 접근 제어

### 데이터 보안

- **암호화**: 민감한 데이터 암호화
- **감사 로그**: 모든 접근 기록
- **네트워크 보안**: Docker 네트워크 격리

## 📊 성능 최적화

### ClickHouse 최적화

- **파티셔닝**: 월별 파티션
- **압축**: ZSTD 압축 사용
- **인덱스**: 서비스 이름, 이벤트 타입별 인덱스

### 캐싱 전략

- **Redis 캐싱**: 대시보드 데이터, 메트릭
- **TTL 조정**: 한국 업무시간별 TTL 차별화
- **캐시 워밍**: 주요 대시보드 데이터 사전 로딩

### 배치 처리

- **Kafka 배치**: 높은 처리량을 위한 배치 처리
- **ClickHouse 배치**: 1000개 단위 배치 삽입
- **백프레셰 처리**: 실패한 배치 재시도 로직

## 🧪 테스트

### 단위 테스트

```bash
# 전체 테스트
npm test

# 특정 서비스 테스트
cd services/api-gateway && npm test

# 커버리지 리포트
npm run test:coverage
```

### 통합 테스트

```bash
# Docker 환경 테스트
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# API 테스트
curl -X GET http://localhost:3002/api/v1/health
```

### 성능 테스트

```bash
# 부하 테스트 (k6)
k6 run tests/performance/load-test.js

# 스트레스 테스트
k6 run --vus 100 --duration 30s tests/performance/stress-test.js
```

## 🚀 배포

### Docker Compose 배포

```bash
# 프로덕션 환경 시작
docker-compose -f docker-compose.production.yml up -d

# 서비스 스케일링
docker-compose -f docker-compose.production.yml up -d --scale api-gateway=3

# 롤링 업데이트
docker-compose -f docker-compose.production.yml up -d --no-deps --force-recreate api-gateway
```

### Kubernetes 배포 (향후)

```bash
# Kubernetes 매니페스트 적용
kubectl apply -f k8s/

# 서비스 상태 확인
kubectl get pods -n airis-mon
```

## 📚 추가 리소스

### 문서

- [API 문서](./docs/api.md)
- [운영 가이드](./docs/operations.md)
- [트러블슈팅](./docs/troubleshooting.md)
- [한국화 가이드](./docs/korean-localization.md)

### 참고 자료

- [ClickStack 아키텍처](https://github.com/askadityapandey/ClickStack)
- [HyperDX UI 패턴](https://hyperdx.io)
- [한국 비즈니스 UX 가이드](./docs/korean-business-ux.md)

## 🤝 기여

1. Fork the repository
2. Create feature branch (`git checkout -b feature/korean-analytics`)
3. Commit changes (`git commit -am 'Add Korean business analytics'`)
4. Push to branch (`git push origin feature/korean-analytics`)
5. Create Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📞 지원

- **이슈**: GitHub Issues에서 버그 리포트 및 기능 요청
- **이메일**: support@airis-mon.com
- **문서**: [공식 문서 사이트](https://docs.airis-mon.com)

---

**AIRIS-MON** - 한국형 AI 위험 분석 시스템 모니터링 🇰🇷