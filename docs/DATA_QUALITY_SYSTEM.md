# 데이터 품질 및 검증 시스템

## 개요

AIRIS EPM의 데이터 품질 및 검증 시스템은 엔터프라이즈급 데이터 품질 관리를 위한 종합적인 솔루션입니다. 실시간 데이터 검증, 이상치 탐지, 데이터 클렌징, 품질 메트릭 수집을 통해 데이터의 신뢰성과 정확성을 보장합니다.

## 주요 기능

### 1. 데이터 검증 스키마 시스템
- **Joi 기반 스키마 검증**: 강력한 타입 검증 및 유효성 검사
- **다양한 데이터 타입 지원**: 메트릭, 로그, 트레이스, 비즈니스 메트릭, 성능 데이터
- **배치 검증**: 대량 데이터 동시 검증
- **커스텀 규칙 추가**: 비즈니스 요구사항에 맞는 검증 규칙 확장

### 2. 이상치 탐지 엔진
- **통계 기반 탐지**: Z-Score, IQR, 이동 평균, 계절성 분석
- **머신러닝 탐지**: Isolation Forest, LOF, One-Class SVM (시뮬레이션)
- **하이브리드 접근**: 통계 및 ML 방법 조합으로 정확도 향상
- **적응형 임계값**: 데이터 특성에 따른 자동 임계값 조정

### 3. 데이터 클렌징 파이프라인
- **자동 정제**: Null 값 제거, 중복 제거, 값 정규화
- **데이터 변환**: 단위 변환, 형식 변환, 집계 함수
- **데이터 농축**: 지리 정보, 비즈니스 컨텍스트, 시계열 컨텍스트 추가
- **타입 검증 및 변환**: 자동 타입 감지 및 변환

### 4. 품질 메트릭 수집 시스템
- **실시간 메트릭 수집**: 품질 점수, 검증 결과, 이상치, 성능 지표
- **시계열 집계**: 1분, 5분, 1시간, 1일 단위 집계
- **통계 분석**: 평균, 중앙값, 백분위수, 표준편차
- **품질 보고서**: 종합적인 품질 현황 및 권장사항

### 5. 실시간 모니터링 대시보드
- **WebSocket 기반 실시간 업데이트**: 5초 간격 자동 새로고침
- **품질 점수 시각화**: A-F 등급 시스템
- **다양한 차트**: 시계열, 파이 차트, 히트맵, 히스토그램
- **알림 및 권장사항**: 실시간 이상치 알림, 개선 권장사항

## 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    클라이언트 애플리케이션                   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                          │
│                   /api/quality/*                        │
└─────────────────────────────────────────────────────────┘
                              │
        ┌──────────────┬──────┴────────┬──────────────┐
        ▼              ▼               ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   검증 엔진    │ │  이상치 탐지   │ │  클렌징 파이프 │ │  메트릭 수집   │
│  Validation  │ │   Anomaly    │ │   Cleansing  │ │   Metrics    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        │              │               │              │
        └──────────────┴───────────────┴──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   데이터 저장소                          │
│              (메트릭, 로그, 이상치 기록)                   │
└─────────────────────────────────────────────────────────┘
```

## API 엔드포인트

### 검증 API
- `POST /api/quality/validate` - 단일 데이터 검증
- `POST /api/quality/validate-batch` - 배치 데이터 검증
- `POST /api/quality/score` - 품질 점수 계산

### 이상치 탐지 API
- `POST /api/quality/detect-anomaly` - 이상치 탐지
- `GET /api/quality/anomalies` - 최근 이상치 조회
- `POST /api/quality/train-model` - ML 모델 학습

### 클렌징 API
- `POST /api/quality/cleanse` - 단일 데이터 클렌징
- `POST /api/quality/cleanse-batch` - 배치 데이터 클렌징
- `POST /api/quality/transform` - 데이터 변환
- `POST /api/quality/enrich` - 데이터 농축

### 모니터링 API
- `GET /api/quality/metrics` - 품질 메트릭 조회
- `GET /api/quality/report` - 품질 보고서 생성
- `GET /api/quality/dashboard` - 대시보드 데이터
- `GET /api/quality/validation-stats` - 검증 통계
- `POST /api/quality/reset-stats` - 통계 초기화

## 사용 예제

### 1. 데이터 검증

```javascript
// 메트릭 데이터 검증
const response = await fetch('/api/quality/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: {
      timestamp: new Date().toISOString(),
      metricType: 'counter',
      name: 'request_count',
      value: 100,
      source: 'api-server'
    },
    schemaType: 'metric'
  })
});

const result = await response.json();
// { success: true, result: { isValid: true, value: {...} } }
```

### 2. 이상치 탐지

```javascript
// 이상치 탐지
const response = await fetch('/api/quality/detect-anomaly', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dataPoint: {
      metricName: 'cpu_usage',
      value: 95.5,
      timestamp: Date.now()
    }
  })
});

const result = await response.json();
// { success: true, result: { isAnomaly: true, confidence: 0.89, level: 'high' } }
```

### 3. 데이터 클렌징

```javascript
// 데이터 정제
const response = await fetch('/api/quality/cleanse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: {
      name: '  TEST_METRIC  ',
      value: '100',
      nullField: null,
      timestamp: '2025-08-26'
    }
  })
});

const result = await response.json();
// 정제된 데이터: { name: 'test_metric', value: 100, timestamp: '2025-08-26T00:00:00.000Z' }
```

### 4. 품질 점수 계산

```javascript
// 품질 점수 계산
const response = await fetch('/api/quality/score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: metricData,
    schemaType: 'metric'
  })
});

const result = await response.json();
// { success: true, score: { overallScore: 0.92, grade: 'A', dimensions: {...} } }
```

## 실시간 모니터링

### WebSocket 연결

```javascript
// Socket.IO 클라이언트 연결
const socket = io('/quality');

// 대시보드 업데이트 수신
socket.on('dashboard-update', (data) => {
  console.log('Dashboard data:', data);
  updateCharts(data.charts);
  updateSummary(data.summary);
});

// 이상치 알림 수신
socket.on('anomaly-detected', (anomaly) => {
  console.warn('Anomaly detected:', anomaly);
  showNotification(anomaly);
});

// 수동 새로고침
socket.emit('refresh');
```

## 설정 옵션

### DataValidator 옵션
```javascript
const validator = new DataValidator({
  abortEarly: false,    // 모든 오류 수집
  allowUnknown: false,  // 알려지지 않은 필드 거부
  stripUnknown: true    // 알려지지 않은 필드 제거
});
```

### AnomalyDetector 옵션
```javascript
const detector = new StatisticalAnomalyDetector({
  windowSize: 100,           // 슬라이딩 윈도우 크기
  zScoreThreshold: 3,        // Z-score 임계값
  iqrMultiplier: 1.5,        // IQR 곱수
  minSamples: 10,            // 최소 샘플 수
  adaptiveThreshold: true    // 적응형 임계값
});
```

### CleansingPipeline 옵션
```javascript
const pipeline = new DataCleansingPipeline({
  removeNulls: true,         // Null 값 제거
  removeDuplicates: true,    // 중복 제거
  normalizeValues: true,     // 값 정규화
  fillMissingValues: true,   // 누락 값 채우기
  transformTimestamps: true, // 타임스탬프 변환
  validateTypes: true        // 타입 검증
});
```

### MetricsCollector 옵션
```javascript
const collector = new QualityMetricsCollector({
  collectionInterval: 60000,  // 수집 간격 (1분)
  retentionPeriod: 86400000,  // 보관 기간 (24시간)
  aggregationLevels: ['1m', '5m', '1h', '1d']  // 집계 레벨
});
```

## 성능 고려사항

### 최적화 팁
1. **배치 처리**: 개별 요청보다 배치 API 사용 권장
2. **캐싱**: 자주 사용되는 검증 결과 캐싱
3. **비동기 처리**: 대량 데이터는 비동기로 처리
4. **윈도우 크기 조정**: 메모리 사용량에 따라 윈도우 크기 조정
5. **집계 레벨 최적화**: 필요한 집계 레벨만 활성화

### 리소스 사용량
- **메모리**: 윈도우 크기 × 메트릭 수 × 8 bytes
- **CPU**: O(n) for 검증, O(n log n) for 통계 계산
- **저장소**: 보관 기간 × 데이터 생성률

## 모니터링 대시보드 접속

```
http://localhost:3002/data-quality-dashboard.html
```

### 대시보드 기능
- **실시간 품질 점수**: A-F 등급 표시
- **검증 성공률**: 성공/실패 비율
- **이상치 탐지율**: 탐지된 이상치 비율
- **처리 성능**: 평균 처리 시간 및 처리량
- **시계열 차트**: 품질 점수 변화 추이
- **알림 목록**: 최근 발생한 품질 이슈
- **권장사항**: 품질 개선을 위한 제안

## 테스트 실행

```bash
# 단위 테스트 실행
npm test tests/data-quality.test.js

# 통합 테스트 실행
npm run test:integration

# 커버리지 리포트
npm run test:coverage
```

## 문제 해결

### 일반적인 문제

1. **검증 실패 많음**
   - 스키마 정의 확인
   - 입력 데이터 형식 검증
   - 필수 필드 누락 확인

2. **이상치 과다 탐지**
   - 임계값 조정 (zScoreThreshold 증가)
   - 윈도우 크기 증가
   - 적응형 임계값 활성화

3. **메모리 사용량 높음**
   - 윈도우 크기 감소
   - 보관 기간 단축
   - 집계 레벨 줄이기

4. **WebSocket 연결 실패**
   - Socket.IO 서버 상태 확인
   - 네트워크 설정 확인
   - CORS 정책 확인

## 라이센스

MIT License

## 지원

문제가 있거나 기능 요청이 있으면 이슈를 등록해주세요.