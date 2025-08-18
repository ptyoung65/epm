# 🎬 AIRIS-MON 세션 리플레이 시스템 상세 가이드

## 📋 세션 리플레이란?

세션 리플레이는 **사용자의 웹 애플리케이션 사용 과정을 실시간으로 녹화하여 나중에 재생할 수 있는 기능**입니다. 마치 사용자의 행동을 영상으로 녹화하는 것처럼, 모든 클릭, 스크롤, 입력, 페이지 이동을 기록합니다.

---

## 🎯 어떤 세션을 녹화하나요?

### 1. **웹 애플리케이션 사용자 세션**
```json
{
  "session_id": "12345678-abcd-1234-5678-123456789abc",
  "user_id": "user_789",
  "start_time": "2025-08-10T10:30:00Z",
  "duration": 1800000,
  
  "사용자_행동": {
    "마우스_이벤트": [
      {
        "type": "click",
        "timestamp": "2025-08-10T10:30:15Z",
        "x": 150,
        "y": 200,
        "element": "login-button",
        "page": "/login"
      },
      {
        "type": "scroll",
        "timestamp": "2025-08-10T10:31:00Z",
        "scrollY": 300,
        "page": "/dashboard"
      }
    ],
    
    "키보드_입력": [
      {
        "type": "keypress",
        "timestamp": "2025-08-10T10:30:20Z",
        "element": "#username-input",
        "value": "[보안상 마스킹됨]"
      }
    ],
    
    "페이지_이동": [
      {
        "url": "/login",
        "timestamp": "2025-08-10T10:30:00Z",
        "duration": 30000,
        "title": "로그인 페이지"
      },
      {
        "url": "/dashboard",
        "timestamp": "2025-08-10T10:30:30Z", 
        "duration": 120000,
        "title": "대시보드"
      }
    ],
    
    "상호작용": [
      {
        "type": "button_click",
        "target": "#submit-form",
        "success": true,
        "response_time": 250
      },
      {
        "type": "modal_open",
        "modal_id": "settings-modal",
        "trigger": "user_click"
      }
    ]
  },
  
  "환경_정보": {
    "viewport": {"width": 1920, "height": 1080},
    "user_agent": "Chrome 91.0.4472.124",
    "device": "desktop",
    "os": "Windows 10",
    "ip_address": "192.168.1.100"
  }
}
```

### 2. **시스템 이벤트 및 오류**
- 🌐 **API 호출**: 모든 AJAX/Fetch 요청과 응답
- ❌ **JavaScript 오류**: 콘솔 에러, 예외 상황
- 📡 **네트워크 실패**: 타임아웃, 연결 실패
- ⏱️ **성능 지연**: 느린 로딩, 렌더링 지연
- 🔄 **상태 변화**: 로그인/로그아웃, 권한 변경

### 3. **비즈니스 이벤트**
```json
{
  "업무_이벤트": [
    {
      "type": "order_completed",
      "order_id": "ORD-12345",
      "amount": 50000,
      "payment_method": "card"
    },
    {
      "type": "search_performed", 
      "query": "노트북",
      "results_count": 45,
      "click_position": 3
    },
    {
      "type": "form_abandoned",
      "form_id": "checkout-form",
      "completion_rate": 75,
      "exit_field": "credit-card"
    }
  ]
}
```

---

## 🔧 3단계 테스트 프로세스

### 📹 **1단계: 세션 녹화 테스트**

#### 테스트 내용:
- **이벤트 캡처 정확도**: 모든 사용자 행동이 누락 없이 기록되는가?
- **타이밍 정확도**: 각 이벤트의 시간 정보가 정확한가?
- **성능 영향도**: 녹화 과정이 사용자 경험에 미치는 영향
- **데이터 무결성**: 녹화된 데이터가 손실되지 않는가?

#### 결과 확인:
```bash
# 세션 녹화 결과 조회
curl -s http://localhost:3100/api/scenarios/session-replay/results | jq '.steps.recording'

# 예상 결과:
{
  "recordedSessions": 5,           # 녹화된 세션 수
  "totalEvents": 247,              # 총 이벤트 수
  "avgSessionDuration": 1245000,   # 평균 세션 길이 (20분)
  "avgEventsPerSession": 49.4,     # 세션당 평균 이벤트 수
  "recordingQuality": 94.2,        # 녹화 품질 점수
  "dataIntegrity": true,           # 데이터 무결성
  "performanceImpact": "minimal"   # 성능 영향도
}
```

#### 품질 평가 기준:
- ✅ **우수 (90-100%)**: 모든 이벤트 정확 캡처
- ✅ **양호 (80-89%)**: 대부분 이벤트 캡처, 일부 누락
- ⚠️ **보통 (70-79%)**: 주요 이벤트 캡처, 개선 필요
- ❌ **불량 (70% 미만)**: 심각한 데이터 손실

---

### 🗜️ **2단계: 데이터 압축 테스트**

#### 테스트 내용:
- **압축률 효율성**: 저장 공간을 얼마나 절약하는가?
- **압축 속도**: 실시간으로 압축 가능한가?
- **압축 품질**: 압축 후 데이터 손실이 있는가?
- **압축 알고리즘**: 최적의 압축 방식 선택

#### 결과 확인:
```bash
# 압축 테스트 결과 조회
curl -s http://localhost:3100/api/scenarios/session-replay/results | jq '.steps.compression'

# 예상 결과:
{
  "sessionsCompressed": 5,
  "avgCompressionRatio": 76.3,     # 76% 압축률
  "totalOriginalSize": 2048000,    # 원본 크기: 2MB
  "totalCompressedSize": 485000,   # 압축 크기: 485KB  
  "spaceSaved": 1563000,           # 절약 공간: 1.5MB
  "compressionTime": 245,          # 압축 시간: 245ms
  "compressionQuality": 92.1,      # 압축 품질
  "dataIntegrity": true,           # 데이터 무결성
  "algorithm": "brotli+gzip"       # 사용된 압축 알고리즘
}
```

#### 압축률 기준:
- 🏆 **매우 우수 (80%+)**: 뛰어난 공간 절약
- ✅ **우수 (70-79%)**: 좋은 압축 효율
- ✅ **양호 (60-69%)**: 적절한 압축률
- ⚠️ **개선 필요 (60% 미만)**: 압축 최적화 필요

---

### ▶️ **3단계: 재생 품질 테스트**

#### 테스트 내용:
- **재생 성공률**: 세션이 정상적으로 재생되는가?
- **로딩 속도**: 재생 시작까지 걸리는 시간
- **재생 품질**: FPS, 해상도, 동기화 정확도
- **사용자 경험**: 실제 사용과 동일한 경험 제공

#### 결과 확인:
```bash
# 재생 품질 결과 조회
curl -s http://localhost:3100/api/scenarios/session-replay/results | jq '.steps.playback'

# 예상 결과:
{
  "playbackTests": 5,
  "successfulPlaybacks": 5,
  "playbackSuccessRate": 100.0,    # 재생 성공률
  "avgLoadTime": 1247,             # 평균 로드 시간: 1.2초
  "avgFps": 45.8,                  # 평균 FPS
  "visualQuality": 88.5,           # 시각 품질
  "syncAccuracy": 94.2,            # 동기화 정확도
  "bufferingTime": 150,            # 버퍼링 시간: 150ms
  "userExperience": "excellent"    # 사용자 경험 평가
}
```

#### 재생 품질 기준:
- 🏆 **30+ FPS**: 부드러운 재생
- ✅ **20-29 FPS**: 양호한 재생
- ⚠️ **15-19 FPS**: 약간 버벅임
- ❌ **15 FPS 미만**: 재생 품질 불량

---

## 🌟 실제 활용 사례

### 🐛 **1. 버그 재현 및 디버깅**
```
시나리오: 사용자가 "결제 버튼을 눌렀는데 아무 반응이 없어요"라고 신고

1. 세션 리플레이에서 해당 사용자 세션 검색
   → session_id: "abc123..." 발견

2. 세션 재생으로 정확한 사용자 행동 확인
   → 사용자가 결제 폼을 90% 채우고 "결제하기" 버튼 클릭
   → 버튼 클릭 후 JavaScript 오류 발생 확인
   → 오류 위치: payment-validation.js:245

3. 버그 원인 파악
   → 특정 브라우저에서 결제 검증 로직 오류
   → 해당 조건에서만 발생하는 엣지 케이스

4. 수정 후 동일 조건으로 재테스트
   → 버그 해결 확인
```

### 📊 **2. UX/UI 개선**
```
분석: 사용자가 "상품 검색" 페이지에서 이탈률이 높음

1. 세션 리플레이 분석
   → 사용자들이 검색 필터를 찾지 못해 헤맴
   → 평균 7번의 클릭 후 페이지 이탈
   → 검색 결과를 스크롤하다가 포기

2. 개선 방향 도출
   → 검색 필터를 더 눈에 띄는 위치로 이동
   → 검색 결과 정렬 옵션 추가
   → 로딩 인디케이터 개선

3. A/B 테스트로 효과 측정
   → 개선 후 이탈률 35% 감소
   → 검색 성공률 28% 증가
```

### 🚨 **3. 보안 사고 분석**
```
알림: 의심스러운 로그인 시도 감지

1. 세션 리플레이로 공격 패턴 분석
   → 자동화된 로그인 시도 확인
   → 다양한 사용자명/패스워드 조합 시도
   → 봇 특성의 행동 패턴 발견

2. 공격 차단 방법 결정
   → CAPTCHA 도입
   → 로그인 시도 횟수 제한 강화
   → 의심스러운 IP 차단

3. 효과 검증
   → 공격 시도 95% 감소
   → 정상 사용자 영향 최소화
```

### ⚡ **4. 성능 문제 진단**
```
신고: "대시보드 페이지가 너무 느려요"

1. 세션 리플레이에서 로딩 과정 분석
   → 페이지 로드 시간: 8.5초
   → 차트 렌더링 지연: 5.2초
   → API 응답 지연: 3.8초

2. 병목 지점 식별
   → 대용량 데이터 쿼리가 주요 원인
   → 불필요한 API 호출 중복 발견
   → 프론트엔드 렌더링 비효율성

3. 성능 개선
   → 데이터 페이지네이션 도입
   → API 응답 캐싱
   → 차트 레이지 로딩

4. 개선 효과
   → 페이지 로드 시간: 2.1초 (75% 개선)
   → 사용자 만족도 향상
```

---

## 🛡️ 프라이버시 및 보안

### 🔒 **민감 정보 보호**
```json
{
  "데이터_마스킹": {
    "password_fields": "[PASSWORD_MASKED]",
    "credit_card": "****-****-****-1234",
    "personal_info": "[PII_REDACTED]",
    "api_keys": "[SECRET_MASKED]"
  },
  
  "수집_제외_요소": [
    "input[type='password']",
    ".sensitive-data",
    "[data-private='true']"
  ]
}
```

### 🛡️ **데이터 보관 정책**
- **보관 기간**: 30일 (설정 가능)
- **암호화**: AES-256으로 저장 시 암호화
- **접근 권한**: 권한이 있는 관리자만 접근
- **GDPR 준수**: 사용자 요청 시 데이터 삭제

---

## 🔧 API 사용법

### 📹 **세션 녹화 시작**
```bash
# 실시간 세션 녹화 시뮬레이션
curl -X POST http://localhost:3100/api/simulate/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "users": 10,
    "duration": 300,
    "behavior_pattern": "normal"
  }'
```

### 🔍 **세션 검색 및 조회**
```bash
# 특정 사용자의 세션 검색
curl -s http://localhost:3100/api/sessions/search \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_789",
    "date_range": "2025-08-10",
    "page": "/dashboard"
  }' | jq

# 세션 상세 정보 조회
curl -s http://localhost:3100/api/sessions/abc123.../details | jq
```

### ▶️ **세션 재생**
```bash
# 세션 재생 URL 생성
curl -s http://localhost:3100/api/sessions/abc123.../playback | jq

# 재생 품질 설정
curl -X POST http://localhost:3100/api/sessions/abc123.../playback \
  -H "Content-Type: application/json" \
  -d '{
    "quality": "high",
    "fps": 30,
    "skip_idle": true
  }'
```

### 📊 **통계 및 분석**
```bash
# 세션 리플레이 통계
curl -s http://localhost:3100/api/sessions/stats | jq

# 사용자 행동 패턴 분석
curl -s http://localhost:3100/api/analytics/user-behavior \
  -d '{"time_range": "7d", "page": "/dashboard"}' | jq
```

---

## 🚀 실제 테스트 실행

### 1️⃣ **웹 UI에서 테스트**
```
1. http://localhost:3100 접속
2. "세션 리플레이" 시나리오 선택
3. "실행" 버튼 클릭
4. 실시간으로 테스트 진행 상황 확인
```

### 2️⃣ **API로 직접 테스트**
```bash
# 세션 리플레이 테스트 실행
curl -X POST http://localhost:3100/api/scenarios/session-replay/run

# 테스트 결과 확인
curl -s http://localhost:3100/api/scenarios/session-replay/results | jq
```

### 3️⃣ **커스텀 시뮬레이션**
```bash
# 대규모 사용자 세션 시뮬레이션
curl -X POST http://localhost:3100/api/simulate/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "users": 100,
    "duration": 1800,
    "intensity": "high",
    "scenarios": ["shopping", "browsing", "search"]
  }'
```

---

## 📈 성능 벤치마크

### 💾 **저장 공간 효율성**
- **원본 세션 데이터**: ~400KB/세션 (30분)
- **압축 후 크기**: ~100KB/세션 (75% 압축률)
- **1000 세션/일**: 약 100MB 저장 공간

### ⚡ **실시간 처리 성능**
- **녹화 오버헤드**: <2% CPU 사용률 증가
- **압축 처리 시간**: 평균 250ms/세션
- **재생 로딩 시간**: 평균 1.2초

### 🌐 **확장성**
- **동시 녹화**: 최대 1000 세션
- **동시 재생**: 최대 100 세션
- **데이터 처리량**: 10MB/초

---

이제 AIRIS-MON의 세션 리플레이가 어떤 세션을 어떻게 녹화하고 활용하는지 완전히 이해하셨을 것입니다! 🎉

실제 운영 환경에서는 이 기능을 통해 사용자 경험 개선, 버그 해결, 성능 최적화에 큰 도움이 됩니다.