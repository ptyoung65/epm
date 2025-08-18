# AIRIS_APM (Application Performance Monitoring)

Java 기반 실시간 애플리케이션 성능 모니터링 시스템

## 🎯 개요

AIRIS_APM은 Java/J2EE 애플리케이션의 성능을 실시간으로 모니터링하고 분석하는 전문 APM 시스템입니다. Byte Code Instrumentation 기술과 JNI 모듈을 활용하여 애플리케이션의 성능 데이터를 동적으로 수집하고 분석합니다.

### 🏗️ 기술 아키텍처

- **Byte Code Instrumentation**: 동적 성능 데이터 추출
- **JNI Module Integration**: CPU 프로파일링 및 JVM 힙 덤프 분석  
- **J2EE Call Stack Tracer**: 호출 스택 추적 기술
- **UDP Communication**: 네트워크 부하 감소
- **Real-time Dashboard**: 실시간 모니터링 대시보드

## 🚀 주요 기능

### 1. 실시간 모니터링
- **Service Monitoring**: 서비스별 성능 지표 실시간 모니터링
- **User Monitoring**: 사용자별 세션 및 트랜잭션 추적
- **System Resource Monitoring**: CPU, 메모리, 네트워크, 파일시스템 모니터링

### 2. J2EE 애플리케이션 모니터링
- **Request Queue**: 요청 큐 상태 모니터링
- **Thread Pool**: 스레드 풀 상태 및 성능 분석
- **Web Container**: 웹 컨테이너 모니터링 (Servlet, Filter, JSP)
- **EJB Monitoring**: EJB 컴포넌트 성능 분석
- **Service Monitoring**: 비즈니스 서비스 레이어 모니터링

### 3. JDBC 모니터링
- **Connection Pool**: 연결 풀 상태 모니터링
- **Query Performance**: 쿼리 실행 성능 분석
- **Connection Leak Detection**: 연결 누수 감지
- **Slow Query Detection**: 느린 쿼리 식별 및 분석

### 4. JVM 프로파일링
- **CPU Profiler**: JNI 기반 CPU 사용률 분석
- **JVM Profiler**: 힙 메모리 분석 및 GC 모니터링
- **Thread Analysis**: 스레드 상태 분석 및 데드락 감지
- **Memory Leak Detection**: 메모리 누수 패턴 분석

### 5. 성능 분석 및 리포팅
- **Statistical Views**: 통계적 성능 분석
- **Trend Analysis**: 성능 트렌드 분석
- **Bottleneck Detection**: 성능 병목 지점 식별
- **Performance Reports**: 종합 성능 리포트

## 📊 대시보드 기능

### 메인 모니터링 대시보드
- 실시간 성능 지표 표시
- 서비스 상태 맵
- 알림 및 경고 표시
- 성능 트렌드 차트

### 상세 분석 뷰
- 서비스별 상세 성능 분석
- 사용자별 세션 분석  
- 데이터베이스 성능 분석
- JVM 상태 상세 분석

## 🛠️ 기술 스택

### Backend
- **Node.js** - 서버사이드 플랫폼
- **Express.js** - 웹 프레임워크
- **Socket.IO** - 실시간 통신

### Database
- **MongoDB** - 메타데이터 및 설정 저장
- **InfluxDB** - 시계열 성능 데이터 저장
- **Redis** - 실시간 데이터 캐싱
- **PostgreSQL** - 관계형 데이터 저장

### 모니터링 & 시각화
- **Grafana** - 성능 데이터 시각화
- **Prometheus** - 메트릭 수집
- **ClickHouse** - 고성능 분석 데이터베이스

### Infrastructure
- **Docker & Docker Compose** - 컨테이너화
- **Nginx** - 리버스 프록시
- **OpenTelemetry** - 분산 추적

## 🏃‍♂️ 빠른 시작

### 1. 시스템 요구사항
```bash
- Java 11 이상
- Node.js 18 이상  
- Docker & Docker Compose
- 최소 메모리: 2GB
- 최소 디스크: 10GB
```

### 2. 설치 및 실행
```bash
# 프로젝트 클론
git clone <repository-url> AIRIS_APM
cd AIRIS_APM

# 의존성 설치
npm install

# 설정 파일 확인
cp apm/config/apm-config.json.example apm/config/apm-config.json

# Docker 환경 시작
docker-compose up -d

# APM Agent 시작
npm run apm:agent

# APM Profiler 시작 (별도 터미널)
npm run apm:profiler
```

### 3. 접속 URL
- **APM 대시보드**: http://localhost:3000
- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090

## 📁 프로젝트 구조

```
AIRIS_APM/
├── src/
│   └── apm/
│       ├── agent.js              # APM Agent 메인
│       └── profiler.js           # 성능 프로파일러
├── apm/
│   ├── agents/                   # Agent 설정 파일
│   ├── profiles/                 # 프로파일링 결과
│   └── config/
│       └── apm-config.json       # APM 설정
├── clickstack-architecture/      # 마이크로서비스 아키텍처
│   ├── services/                 # 개별 서비스들
│   └── ui/                       # 사용자 인터페이스
├── config/                       # 환경 설정
├── docs/                         # 문서
├── scripts/                      # 운영 스크립트
├── docker-compose.yml            # Docker 서비스 정의
└── package.json                  # 프로젝트 설정
```

## ⚙️ 설정

### APM Agent 설정
```json
{
  "agent": {
    "enabled": true,
    "port": 8080,
    "udpPort": 8081,
    "samplingInterval": 5000
  },
  "profiler": {
    "enabled": true,
    "cpuProfiling": {
      "enabled": true,
      "interval": 30000
    }
  }
}
```

### 모니터링 대상 설정
```json
{
  "monitoring": {
    "jvm": { "enabled": true },
    "j2ee": { "enabled": true },
    "jdbc": { "enabled": true },
    "system": { "enabled": true }
  }
}
```

## 📊 주요 메트릭

### JVM 메트릭
- Heap/Non-Heap 메모리 사용량
- GC 활동 및 성능
- 스레드 상태 및 수
- 클래스 로딩 정보

### 애플리케이션 메트릭  
- 요청 처리 시간
- 처리량 (TPS)
- 에러율
- 동시 사용자 수

### 시스템 메트릭
- CPU 사용률
- 메모리 사용률  
- 디스크 I/O
- 네트워크 I/O

### 데이터베이스 메트릭
- 연결 풀 상태
- 쿼리 실행 시간
- 슬로우 쿼리
- 연결 누수

## 🚨 알림 및 경고

### 임계값 기반 알림
- CPU 사용률 > 80%
- 메모리 사용률 > 85%  
- 응답 시간 > 5초
- 에러율 > 5%

### 알림 채널
- 콘솔 출력
- 이메일 (SMTP)
- Webhook
- Slack/Teams 연동

## 📈 성능 분석

### 프로파일링
- **CPU 프로파일링**: 메서드별 CPU 사용률 분석
- **메모리 프로파일링**: 객체별 메모리 사용량 분석  
- **스레드 분석**: 스레드 상태 및 데드락 분석
- **호출 스택 추적**: 메서드 호출 경로 분석

### 보고서 생성
- 일간/주간/월간 성능 리포트
- 성능 트렌드 분석
- 병목 지점 식별
- 개선 권장사항

## 🔧 고급 설정

### Byte Code Instrumentation
```json
{
  "bytecodeInstrumentation": {
    "enabled": true,
    "packages": ["com.example.*"],
    "excludePackages": ["java.*", "javax.*"]
  }
}
```

### 클러스터링 (Enterprise)
```json  
{
  "clustering": {
    "enabled": true,
    "mode": "cluster",
    "nodes": ["node1:8080", "node2:8080"]
  }
}
```

## 📚 API 문서

### RESTful API
- `GET /api/v1/metrics` - 실시간 메트릭 조회
- `GET /api/v1/profile` - 프로파일링 데이터 조회
- `POST /api/v1/agent/config` - Agent 설정 변경

### WebSocket API  
- `/socket.io/metrics` - 실시간 메트릭 스트림
- `/socket.io/alerts` - 실시간 알림

## 🛡️ 보안

### 인증 및 권한
- Basic/JWT 인증 지원
- Role 기반 접근 제어
- IP 화이트리스트

### 데이터 암호화
- TLS/SSL 통신 암호화
- 저장 데이터 암호화 (선택사항)

## 🔄 운영

### 백업 및 복구
- 설정 파일 백업
- 성능 데이터 백업 정책
- 재해 복구 절차

### 모니터링 자체 모니터링
- APM 시스템 상태 모니터링
- 성능 영향도 측정
- 리소스 사용량 추적

## 🤝 기여 가이드

### 개발 환경 설정
```bash
# 개발 모드 실행
npm run dev

# 테스트 실행
npm test

# 린팅
npm run lint
```

### 코드 기여
1. Fork 프로젝트
2. Feature 브랜치 생성
3. 코드 변경 및 테스트
4. Pull Request 제출

## 📞 지원

### 문제 해결
- [Troubleshooting Guide](docs/troubleshooting.md)
- [FAQ](docs/faq.md)
- [Known Issues](docs/known-issues.md)

### 커뮤니티
- GitHub Issues
- 기술 지원 이메일
- 사용자 포럼

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 🎯 로드맵

### v1.1 (다음 버전)
- [ ] Kubernetes 네이티브 지원
- [ ] Machine Learning 기반 이상 탐지
- [ ] 분산 추적 강화
- [ ] 모바일 대시보드

### v1.2 (장기 계획)
- [ ] Multi-tenancy 지원
- [ ] Cloud 네이티브 배포
- [ ] Advanced AI/ML 분석
- [ ] 실시간 최적화 권장

---

**AIRIS_APM Team** | APM 전문 솔루션으로 Java 애플리케이션의 성능을 극대화하세요.