# 🧪 AIRIS-MON 테스트 스위트 사용 가이드

## 📋 테스트 내용 및 결과 확인 방법

### 1️⃣ 웹 UI를 통한 테스트 실행 및 모니터링

#### 🌐 웹 인터페이스 접속
```bash
# 브라우저에서 접속
http://localhost:3100
```

#### 🎛️ 테스트 제어판 기능
- **개별 테스트 실행**: 각 시나리오별 "실행" 버튼 클릭
- **모든 테스트 실행**: "모든 테스트 실행" 버튼으로 전체 시나리오 순차 실행
- **실시간 로그**: WebSocket을 통한 실시간 테스트 진행 상황 확인
- **결과 요약**: 테스트 완료 후 성공률 및 상세 결과 표시

#### 📊 실시간 모니터링 대시보드
- **시스템 메트릭**: CPU, 메모리, 네트워크 사용률 실시간 차트
- **테스트 진행률**: 현재 실행 중인 테스트의 단계별 진행 상황
- **성능 지표**: 응답시간, 처리량, 오류율 실시간 업데이트
- **한국어 지원**: 모든 UI 텍스트 및 메시지 한국어 표시

---

### 2️⃣ API를 통한 프로그래매틱 테스트 제어

#### 📡 기본 API 엔드포인트
```bash
# 테스트 스위트 상태 확인
curl -s http://localhost:3100/api/status

# 사용 가능한 모든 시나리오 조회
curl -s http://localhost:3100/api/scenarios | jq
```

#### 🚀 개별 시나리오 실행
```bash
# 1. 기본 모니터링 테스트
curl -X POST http://localhost:3100/api/scenarios/basic-monitoring/run

# 2. AIOps 이상 탐지
curl -X POST http://localhost:3100/api/scenarios/aiops-anomaly/run

# 3. 세션 리플레이
curl -X POST http://localhost:3100/api/scenarios/session-replay/run

# 4. NLP 자연어 검색
curl -X POST http://localhost:3100/api/scenarios/nlp-search/run

# 5. 실시간 알림
curl -X POST http://localhost:3100/api/scenarios/real-time-alerts/run

# 6. 성능 부하 테스트
curl -X POST http://localhost:3100/api/scenarios/performance-stress/run

# 7. 종단 간 통합 테스트
curl -X POST http://localhost:3100/api/scenarios/end-to-end/run
```

#### 📊 데이터 시뮬레이션 API
```bash
# 메트릭 데이터 생성
curl -X POST http://localhost:3100/api/simulate/metrics \
  -H "Content-Type: application/json" \
  -d '{"duration": 60, "intensity": "high", "count": 1000}'

# 이벤트 데이터 생성
curl -X POST http://localhost:3100/api/simulate/events \
  -H "Content-Type: application/json" \
  -d '{"count": 500, "eventTypes": ["error", "warning", "info"]}'

# 사용자 세션 생성
curl -X POST http://localhost:3100/api/simulate/sessions \
  -H "Content-Type: application/json" \
  -d '{"users": 100, "duration": 300}'

# 이상 데이터 생성
curl -X POST http://localhost:3100/api/simulate/anomalies \
  -H "Content-Type: application/json" \
  -d '{"count": 50, "severity": "high"}'
```

---

### 3️⃣ 각 테스트 시나리오 상세 내용

#### 🏗️ 1. 기본 모니터링 테스트 (30초)
**목적**: 핵심 인프라 구성 요소 연결 상태 확인

**테스트 단계**:
- `connectivity`: ClickHouse, Kafka, Redis 연결 테스트
- `metrics-ingestion`: 메트릭 데이터 수집 파이프라인 테스트
- `data-retention`: 데이터 저장 및 보관 정책 검증

**결과 확인**:
```bash
# 테스트 결과 조회
curl -s http://localhost:3100/api/scenarios/basic-monitoring/results | jq

# 예상 결과
{
  "scenario": "basic-monitoring",
  "status": "completed",
  "success_rate": 100.0,
  "duration_ms": 30000,
  "steps": {
    "connectivity": {"status": "passed", "duration": 5000},
    "metrics-ingestion": {"status": "passed", "duration": 15000},
    "data-retention": {"status": "passed", "duration": 10000}
  },
  "metrics_generated": 100,
  "timestamp": "2025-08-10T10:30:00.000Z"
}
```

#### 🤖 2. AIOps 이상 탐지 (120초)
**목적**: ML 기반 이상 패턴 탐지 알고리즘 검증

**테스트 단계**:
- `data-training`: ML 모델 훈련용 데이터셋 준비
- `anomaly-injection`: 의도적 이상 패턴 주입
- `detection-accuracy`: 탐지 정확도 및 false positive 측정

**결과 확인**:
```bash
curl -s http://localhost:3100/api/scenarios/aiops-anomaly/results | jq

# 예상 결과
{
  "scenario": "aiops-anomaly",
  "ml_metrics": {
    "accuracy": 0.95,
    "precision": 0.92,
    "recall": 0.89,
    "f1_score": 0.905
  },
  "anomalies_detected": 47,
  "false_positives": 3,
  "training_samples": 10000
}
```

#### 📽️ 3. 세션 리플레이 (90초)
**목적**: 사용자 세션 기록 및 재생 기능 검증

**테스트 단계**:
- `session-recording`: 사용자 액션 캡처 및 기록
- `data-compression`: 세션 데이터 압축 및 최적화
- `playback-quality`: 재생 품질 및 정확도 검증

**결과 확인**:
```bash
curl -s http://localhost:3100/api/scenarios/session-replay/results | jq

# 예상 결과
{
  "sessions_recorded": 20,
  "compression_ratio": 0.75,
  "playback_accuracy": 0.98,
  "average_session_duration": 180,
  "storage_efficiency": "23MB → 6MB"
}
```

#### 🔍 4. NLP 자연어 검색 (60초)
**목적**: 한국어 자연어 쿼리 처리 및 검색 정확도 검증

**테스트 단계**:
- `korean-tokenization`: 한국어 형태소 분석 및 토큰화
- `semantic-search`: 의미론적 유사도 기반 검색
- `result-ranking`: 검색 결과 순위 및 정확도 평가

**결과 확인**:
```bash
curl -s http://localhost:3100/api/scenarios/nlp-search/results | jq

# 예상 결과
{
  "korean_queries_processed": 30,
  "tokenization_accuracy": 0.94,
  "search_precision": {
    "NDCG@5": 0.87,
    "MAP": 0.82,
    "MRR": 0.91
  },
  "avg_response_time_ms": 245
}
```

#### 🚨 5. 실시간 알림 (45초)
**목적**: 임계값 모니터링 및 알림 시스템 검증

**테스트 단계**:
- `threshold-monitoring`: 메트릭 임계값 모니터링
- `alert-generation`: 알림 생성 및 우선순위 할당
- `notification-delivery`: 다중 채널 알림 전송

**결과 확인**:
```bash
curl -s http://localhost:3100/api/scenarios/real-time-alerts/results | jq

# 예상 결과
{
  "alerts_triggered": 15,
  "notification_channels": ["email", "slack", "webhook"],
  "delivery_success_rate": 0.96,
  "avg_notification_latency_ms": 150,
  "escalation_rules_tested": 5
}
```

#### ⚡ 6. 성능 부하 테스트 (180초)
**목적**: 대용량 처리 및 시스템 성능 한계 검증

**테스트 단계**:
- `data-volume-ramp`: 점진적 데이터 볼륨 증가
- `concurrent-users`: 동시 사용자 부하 테스트
- `system-stability`: 시스템 안정성 및 복구 능력

**결과 확인**:
```bash
curl -s http://localhost:3100/api/scenarios/performance-stress/results | jq

# 예상 결과
{
  "max_concurrent_users": 1000,
  "peak_throughput_rps": 5000,
  "avg_response_time_ms": 85,
  "p95_response_time_ms": 200,
  "error_rate": 0.02,
  "resource_utilization": {
    "cpu_peak": 0.78,
    "memory_peak": 0.65,
    "network_peak": "800 Mbps"
  }
}
```

#### 🔄 7. 종단 간 통합 테스트 (300초)
**목적**: 전체 AIRIS-MON 워크플로우 통합 검증

**테스트 단계**:
- `data-ingestion`: 다양한 소스로부터 데이터 수집
- `processing-pipeline`: 데이터 처리 파이프라인 전체 흐름
- `ui-visualization`: 웹 UI 시각화 및 대시보드
- `alert-workflow`: 이상 탐지부터 알림까지 전체 워크플로우

**결과 확인**:
```bash
curl -s http://localhost:3100/api/scenarios/end-to-end/results | jq

# 예상 결과
{
  "total_data_processed": "10GB",
  "pipeline_stages": 12,
  "end_to_end_latency_ms": 2500,
  "ui_components_tested": 25,
  "workflow_success_rate": 0.99,
  "data_integrity_score": 1.0
}
```

---

### 4️⃣ 로그 및 디버깅 정보 확인

#### 📝 실시간 로그 모니터링
```bash
# 터미널에서 실시간 로그 확인 (npm start 실행 중인 터미널)
# 또는 별도 터미널에서:
curl -N http://localhost:3100/api/logs/stream
```

#### 🔍 상세 디버그 정보
```bash
# 특정 시나리오의 상세 로그
curl -s http://localhost:3100/api/scenarios/basic-monitoring/logs | jq

# 시스템 성능 메트릭
curl -s http://localhost:3100/api/metrics/system | jq

# 에러 로그 조회
curl -s http://localhost:3100/api/logs/errors | jq
```

#### 📊 테스트 결과 내보내기
```bash
# JSON 형식으로 전체 결과 내보내기
curl -s http://localhost:3100/api/results/export > test_results.json

# CSV 형식으로 메트릭 데이터 내보내기
curl -s http://localhost:3100/api/metrics/export?format=csv > metrics.csv
```

---

### 5️⃣ 고급 사용법

#### 🎯 커스텀 테스트 시나리오 실행
```bash
# 사용자 정의 메트릭 시뮬레이션
curl -X POST http://localhost:3100/api/custom/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "custom-load-test",
    "duration": 300,
    "parameters": {
      "cpu_pattern": "spike",
      "memory_pattern": "gradual",
      "network_pattern": "burst"
    }
  }'
```

#### 📈 연속 모니터링 모드
```bash
# 10분간 연속 모니터링 시작
curl -X POST http://localhost:3100/api/monitoring/start \
  -H "Content-Type: application/json" \
  -d '{"duration": 600, "interval": 10}'

# 모니터링 중지
curl -X POST http://localhost:3100/api/monitoring/stop
```

#### 🔧 설정 조정
```bash
# 테스트 강도 설정
curl -X PUT http://localhost:3100/api/config \
  -H "Content-Type: application/json" \
  -d '{"intensity": "high", "mock_mode": false}'
```

---

### 6️⃣ 문제 해결 및 도움말

#### ❗ 일반적인 문제
1. **포트 충돌**: 3100 포트가 사용 중인 경우
   ```bash
   TEST_PORT=4100 npm start
   ```

2. **메모리 부족**: 대용량 테스트 시 메모리 부족
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

3. **연결 실패**: 외부 서비스 연결 실패 시 Mock 모드 사용
   ```bash
   USE_MOCK_SERVICES=true npm start
   ```

#### 📞 지원 및 문의
- **GitHub Issues**: [리포지토리 이슈 페이지]
- **문서**: `README.md` 및 `docs/` 디렉토리
- **예제**: `examples/` 디렉토리의 샘플 코드

---

## 🎯 빠른 시작 체크리스트

- [ ] 테스트 스위트 실행: `npm start`
- [ ] 웹 UI 접속: `http://localhost:3100`
- [ ] API 상태 확인: `curl http://localhost:3100/api/status`
- [ ] 기본 테스트 실행: "모든 테스트 실행" 클릭
- [ ] 결과 확인: 웹 UI 또는 API로 결과 조회
- [ ] 커스텀 테스트: 필요시 API로 특정 시나리오 실행

**모든 AIRIS-MON 기능을 완전히 테스트할 수 있습니다!** 🚀