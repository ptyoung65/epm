# 🚀 AIRIS-MON 테스트 스위트 빠른 시작 가이드

## 1분 만에 시작하기

### 방법 1: 최소 구성으로 빠르게 시작 (권장)

```bash
# 테스트 스위트만 실행 (외부 의존성 없음)
docker-compose -f docker-compose.test.yml up -d

# 브라우저에서 접속
open http://localhost:3100
```

### 방법 2: 전체 스택 실행

```bash
# 모든 서비스 실행 (ClickHouse, Kafka, Redis 포함)
docker-compose up -d

# 서비스 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f test-suite
```

### 방법 3: 로컬 개발 환경

```bash
# 의존성 설치
npm install

# 애플리케이션 실행
npm start

# 개발 모드 (자동 재시작)
npm run dev
```

## 📋 빌드 문제 해결

### "npm run build" 에러 발생 시

이 프로젝트는 빌드가 필요 없는 런타임 애플리케이션입니다.
`package.json`의 build 스크립트는 단순히 메시지만 출력합니다:

```json
"build": "echo 'No build required - this is a runtime test suite'"
```

### Docker 빌드 실패 시

```bash
# 이미지 정리
docker system prune -f

# 캐시 없이 재빌드
docker-compose build --no-cache

# 테스트 빌드
./build-test.sh
```

### 포트 충돌 시

기본 포트:
- 3100: 테스트 스위트 UI
- 3000-3006: Mock 서비스들
- 8123: ClickHouse
- 9092: Kafka
- 6379: Redis
- 3001: Grafana

포트 변경:
```bash
# 환경 변수로 포트 변경
TEST_PORT=4100 docker-compose up -d
```

## 🧪 테스트 실행

### 웹 UI에서 테스트

1. http://localhost:3100 접속
2. "테스트 제어판"에서 시나리오 선택
3. "모든 테스트 실행" 클릭

### CLI에서 테스트

```bash
# 특정 시나리오 실행
curl -X POST http://localhost:3100/api/scenarios/basic-monitoring/run

# 데이터 시뮬레이션
curl -X POST http://localhost:3100/api/simulate/metrics \
  -H "Content-Type: application/json" \
  -d '{"duration": 60, "intensity": "medium"}'
```

## 🔍 문제 해결 명령어

```bash
# 컨테이너 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs test-suite
docker-compose logs -f --tail=100 test-suite

# 컨테이너 재시작
docker-compose restart test-suite

# 전체 스택 중지 및 정리
docker-compose down -v

# 네트워크 문제 확인
docker network ls
docker network inspect test-suite_airis-test-network
```

## 📊 모니터링

### 서비스 상태 확인
```bash
# API 상태
curl http://localhost:3100/api/status

# 헬스체크
curl http://localhost:3100/health

# 시나리오 목록
curl http://localhost:3100/api/scenarios
```

### 실시간 로그 모니터링
```bash
# 모든 서비스 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f test-suite
```

## 💡 유용한 팁

1. **Mock 서비스 사용**: 외부 의존성 없이 테스트하려면 `USE_MOCK_SERVICES=true` 설정

2. **데이터 생성기만 실행**:
   ```bash
   docker-compose --profile data-generation up -d
   ```

3. **Grafana 대시보드 포함**:
   ```bash
   docker-compose --profile monitoring up -d
   ```

4. **빠른 정리**:
   ```bash
   docker-compose down -v --remove-orphans
   ```

## 🆘 도움말

- GitHub Issues: 버그 리포트 및 기능 요청
- README.md: 상세한 문서
- .env.example: 환경 변수 설정 가이드

---

**빠른 시작을 위한 3단계:**

1️⃣ `docker-compose -f docker-compose.test.yml up -d`
2️⃣ http://localhost:3100 접속
3️⃣ "모든 테스트 실행" 클릭

완료! 🎉