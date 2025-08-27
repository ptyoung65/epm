# 🔄 AIRIS APM 시스템 재시작 가이드

> **새로운 Claude 세션에서 이 지점부터 다시 시작하기 위한 완전 가이드**

## 📍 현재 프로젝트 상태 (2025-08-25 23:45)

### 🎯 최종 완성된 기능
- **APM 시스템**: 100% 완성된 J2EE/WAS 전문 모니터링
- **온톨로지 시스템**: 4탭 인터랙티브 지식 체계 완료
- **세션 리플레이**: 접혀진 카드 UI 완전 구현 완료 ✅

### 📱 **방금 완성된 세션 리플레이 기능**
- **접혀진 카드**: 기본적으로 세션 내용 접힘
- **클릭 펼치기**: 헤더 클릭시 상세 내용 표시
- **플레이/삭제 버튼**: 펼쳐진 영역에만 표시
- **애니메이션**: 부드러운 전환 효과
- **확인 다이얼로그**: 안전한 삭제 절차

---

## 🚀 시스템 재시작 절차

### 1️⃣ **빠른 시작 (추천)**
```bash
# 작업 디렉터리 이동
cd /home/ptyoung/work/AIRIS_APM/clickstack-architecture

# 원클릭 시작
./scripts/start-all.sh

# 즉시 접속 확인
echo "✅ 시스템 접속: http://localhost:3001/"
```

### 2️⃣ **완전 초기화 후 시작**
```bash
# 기존 컨테이너 완전 정리
docker stop $(docker ps -q) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker system prune -f

# 전체 시스템 재시작
cd /home/ptyoung/work/AIRIS_APM/clickstack-architecture
docker compose up -d

# 상태 확인
docker ps
```

### 3️⃣ **개별 서비스 재시작**
```bash
# UI만 재시작
docker compose restart ui

# 세션 리플레이만 재시작  
docker compose restart session-replay

# API 게이트웨이만 재시작
docker compose restart api-gateway
```

---

## 🌐 주요 접속 URL

### **📊 메인 시스템**
- **통합 대시보드**: http://localhost:3001/
- **API 게이트웨이**: http://localhost:3000/

### **📱 새로 완성된 세션 리플레이**
- **세션 관리**: http://localhost:3001/session-replay.html ⭐ **방금 완성**
- **세션 기록**: http://localhost:3001/test-recorder.html
- **리플레이 API**: http://localhost:3003/

### **📊 전문 모니터링 대시보드**
- **J2EE 모니터링**: http://localhost:3001/j2ee-dashboard.html
- **WAS 모니터링**: http://localhost:3001/was-dashboard.html
- **예외 추적**: http://localhost:3001/exception-dashboard.html
- **서비스 토폴로지**: http://localhost:3001/topology-dashboard.html
- **알림 관리**: http://localhost:3001/alert-dashboard.html

### **🧠 온톨로지 시스템**
- **지식 체계**: http://localhost:3001/ontology.html

---

## 🔧 핵심 파일 위치

### **세션 리플레이 UI (방금 수정 완료)**
```
📁 /home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/public/
├── session-replay.html ⭐ 방금 완성된 접혀진 카드 UI
├── test-recorder.html
└── index.html (메인 대시보드)
```

### **핵심 구현 함수들 (방금 추가)**
- `toggleSessionRecord()` - 세션 펼침/접힘 토글
- `deleteSession()` - 세션 삭제 및 localStorage 처리
- `showDeleteSuccessNotification()` - 삭제 성공 알림

### **백엔드 서비스**
```
📁 /home/ptyoung/work/AIRIS_APM/clickstack-architecture/services/
├── session-replay/     ⭐ 세션 리플레이 서비스 (포트 3003)
├── api-gateway/        📊 API 게이트웨이 (포트 3000)
└── [기타 13개 마이크로서비스]
```

### **Docker 설정**
```
📁 /home/ptyoung/work/AIRIS_APM/clickstack-architecture/
├── docker-compose.yml   ⭐ 메인 컴포즈 파일
├── scripts/start-all.sh ⭐ 전체 시작 스크립트
└── [개별 Dockerfile들]
```

---

## 🐛 트러블슈팅

### **❌ 포트 충돌**
```bash
# 포트 3001 충돌 해결
sudo lsof -ti:3001 | xargs kill -9 2>/dev/null || true
docker compose restart ui
```

### **❌ UI 변경사항 반영 안됨**
```bash
# UI 컨테이너 강제 재빌드
docker compose stop ui
docker compose rm -f ui  
docker compose build --no-cache ui
docker compose up -d ui
```

### **❌ 세션 데이터 문제**
```bash
# 브라우저 개발자도구 Console에서
localStorage.clear()
location.reload()
```

### **❌ 전체 시스템 리셋**
```bash
# ⚠️ 주의: 모든 데이터 삭제
docker system prune -af --volumes
cd /home/ptyoung/work/AIRIS_APM/clickstack-architecture
./scripts/start-all.sh
```

---

## 📋 시스템 상태 확인 명령어

### **🔍 컨테이너 상태**
```bash
# 실행 중인 컨테이너 확인
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 헬스체크 상태
docker compose ps
```

### **🌐 서비스 접근성 확인**
```bash
# UI 서비스 확인
curl -I http://localhost:3001/ 

# 세션 리플레이 확인 ⭐
curl -I http://localhost:3001/session-replay.html

# API 게이트웨이 확인  
curl -I http://localhost:3000/
```

### **📊 로그 확인**
```bash
# UI 컨테이너 로그
docker logs clickstack-architecture-ui-1

# 세션 리플레이 로그
docker logs clickstack-architecture-session-replay-1

# 전체 서비스 로그
docker compose logs --tail=100
```

---

## 🎯 다음 작업 시 참고사항

### **✅ 완성된 기능 (건드리지 말것)**
- 세션 리플레이 접혀진 카드 UI ⭐
- J2EE/WAS 모니터링 대시보드
- 온톨로지 4탭 시스템  
- shadcn/ui 디자인 시스템

### **🔧 개선 가능 영역**
- 세션 리플레이 성능 최적화
- 추가 세션 필터링 기능
- 실시간 세션 모니터링
- 세션 분석 리포트 기능

### **🚨 주의사항**
- **절대 건드리지 말것**: `session-replay.html`의 접혀진 카드 UI
- **포트 고정**: UI(3001), 리플레이(3003), API(3000)
- **Docker 우선**: 항상 컨테이너 환경에서 작업
- **백업 필수**: 중요 변경 전 Git 커밋

---

## 📞 긴급 복구 절차

### **🆘 시스템 완전 복구**
```bash
# 1단계: 완전 정리
cd /home/ptyoung/work/AIRIS_APM/clickstack-architecture
docker stop $(docker ps -q) 2>/dev/null || true
docker system prune -af

# 2단계: 새로 시작
./scripts/start-all.sh

# 3단계: 확인
curl http://localhost:3001/session-replay.html | grep -c "toggleSessionRecord"
# 결과가 2 이상이면 성공
```

### **🔧 세션 리플레이만 복구**
```bash
# 세션 리플레이 서비스만 재시작
docker compose restart session-replay ui
sleep 10
curl -I http://localhost:3001/session-replay.html
```

---

**🎯 이 문서로 새로운 Claude 세션에서 바로 시작 가능!**

**마지막 작업**: 세션 리플레이 접혀진 카드 UI 완성 ✅  
**다음 접속**: http://localhost:3001/session-replay.html 에서 접혀진 카드 확인  
**시작 명령**: `./scripts/start-all.sh`