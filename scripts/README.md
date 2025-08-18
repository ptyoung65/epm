# AIRIS-MON 실행 스크립트 모음

AIRIS-MON 통합 모니터링 플랫폼을 위한 완전한 실행 및 관리 스크립트 세트입니다.

## 📋 스크립트 개요

### 1. **airis-mon.sh** - 메인 실행 스크립트
통합 서비스 관리를 위한 메인 스크립트입니다.

```bash
# 기본 사용법
./scripts/airis-mon.sh <command>

# 주요 명령어
./scripts/airis-mon.sh start     # 서비스 시작
./scripts/airis-mon.sh stop      # 서비스 중지
./scripts/airis-mon.sh restart   # 서비스 재시작
./scripts/airis-mon.sh status    # 서비스 상태 확인
./scripts/airis-mon.sh logs      # 실시간 로그 보기
```

**주요 기능:**
- ✅ 환경 요구사항 자동 검증
- ✅ 의존성 자동 설치
- ✅ 실시간 서비스 모니터링
- ✅ 자동 백업 및 복구
- ✅ 성능 지표 수집

### 2. **dev.sh** - 개발 환경 스크립트
개발자를 위한 편의 기능이 포함된 실행 스크립트입니다.

```bash
# 개발 모드 실행
./scripts/dev.sh start          # nodemon 기반 개발 서버
./scripts/dev.sh browser        # 브라우저와 함께 시작
./scripts/dev.sh logs           # 색상화된 실시간 로그
./scripts/dev.sh sample         # 테스트 데이터 생성
./scripts/dev.sh clean          # 개발 데이터 정리
```

**개발 기능:**
- 🔄 Hot Reload (nodemon)
- 🌐 자동 브라우저 열기
- 🎨 색상화된 로그
- 📊 샘플 데이터 생성
- 🧪 테스트 감시 모드

### 3. **prod.sh** - 프로덕션 환경 스크립트
PM2 기반 프로덕션 환경 관리 스크립트입니다.

```bash
# 프로덕션 관리 (sudo 권한 필요)
sudo ./scripts/prod.sh start    # PM2 클러스터 시작
sudo ./scripts/prod.sh backup   # 자동 백업 생성
sudo ./scripts/prod.sh deploy   # Git 기반 무중단 배포
sudo ./scripts/prod.sh metrics  # 성능 지표 확인
```

**프로덕션 기능:**
- 🏭 PM2 클러스터 모드
- 🔄 무중단 배포
- 💾 자동 백업/복구
- 📈 성능 모니터링
- 🔒 보안 강화

### 4. **service.sh** - 시스템 서비스 관리
systemd 서비스 등록 및 관리 스크립트입니다.

```bash
# 시스템 서비스 관리 (sudo 권한 필요)
sudo ./scripts/service.sh install    # systemd 서비스 설치
sudo ./scripts/service.sh start      # 시스템 서비스 시작
sudo ./scripts/service.sh enable     # 부팅 시 자동 시작
sudo ./scripts/service.sh monitor    # 실시간 모니터링
```

**서비스 기능:**
- ⚙️ systemd 서비스 등록
- 🔄 자동 시작 설정
- 👤 전용 사용자 생성
- 🛡️ 보안 정책 적용
- 📊 실시간 상태 모니터링

### 5. **check-env.sh** - 환경 검증 스크립트
시스템 환경 및 설정을 종합적으로 검증하는 스크립트입니다.

```bash
# 환경 검증 실행
./scripts/check-env.sh           # 전체 환경 검증
./scripts/check-env.sh true      # 빠른 검증 모드
```

**검증 항목:**
- 🖥️ 운영체제 및 아키텍처
- 💾 시스템 리소스 (CPU, 메모리, 디스크)
- 🌐 네트워크 연결성
- 📦 소프트웨어 의존성 (Node.js, Python, Git)
- 📁 프로젝트 구조 및 파일
- 🔒 보안 설정 및 권한
- ⚡ 시스템 성능 지표

## 🚀 빠른 시작 가이드

### 1단계: 환경 검증
```bash
# 시스템이 AIRIS-MON 요구사항을 만족하는지 확인
./scripts/check-env.sh
```

### 2단계: 개발 환경에서 테스트
```bash
# 개발 모드로 시작 (브라우저 자동 열기)
./scripts/dev.sh browser
```

### 3단계: 프로덕션 배포 (선택사항)
```bash
# 시스템 서비스로 설치
sudo ./scripts/service.sh install

# 프로덕션 모드로 시작
sudo ./scripts/prod.sh start
```

## 📊 사용 시나리오별 가이드

### 🧑‍💻 개발자 시나리오
```bash
# 1. 환경 확인
./scripts/check-env.sh

# 2. 개발 환경 설정
./scripts/dev.sh setup

# 3. 테스트 데이터 생성
./scripts/dev.sh sample

# 4. 개발 서버 시작
./scripts/dev.sh start
```

### 🏭 운영자 시나리오
```bash
# 1. 시스템 서비스 설치
sudo ./scripts/service.sh install

# 2. 프로덕션 환경 설정
sudo ./scripts/prod.sh setup

# 3. 서비스 시작 및 활성화
sudo ./scripts/service.sh start
sudo ./scripts/service.sh enable

# 4. 모니터링 설정
sudo ./scripts/prod.sh monitor
```

### 🔧 관리자 시나리오
```bash
# 1. 정기 백업 생성
sudo ./scripts/prod.sh backup

# 2. 성능 지표 확인
sudo ./scripts/prod.sh metrics

# 3. 로그 모니터링
./scripts/airis-mon.sh logs

# 4. 서비스 상태 점검
sudo ./scripts/service.sh status
```

## 🛠️ 고급 기능

### 자동화 스크립트 작성
```bash
#!/bin/bash
# 일일 유지보수 스크립트 예시

# 환경 검증
./scripts/check-env.sh true

# 백업 생성
sudo ./scripts/prod.sh backup

# 성능 지표 수집
sudo ./scripts/prod.sh metrics > daily-metrics.txt

# 로그 순환
sudo ./scripts/service.sh logs 1000 false > daily-logs.txt
```

### 모니터링 대시보드 연동
```bash
# 성능 데이터 JSON 형태로 출력
sudo ./scripts/prod.sh metrics | jq '.'

# 서비스 상태를 외부 모니터링 시스템에 전송
./scripts/airis-mon.sh status | curl -X POST -d @- http://monitoring-server/api/status
```

## 📁 파일 구조

```
scripts/
├── airis-mon.sh        # 메인 실행 스크립트
├── dev.sh              # 개발 환경 스크립트  
├── prod.sh             # 프로덕션 환경 스크립트
├── service.sh          # 시스템 서비스 관리
├── check-env.sh        # 환경 검증 스크립트
└── README.md           # 이 문서
```

## 🔒 보안 고려사항

### 권한 설정
- 모든 스크립트는 `chmod +x` 권한이 필요합니다
- `service.sh`, `prod.sh`는 `sudo` 권한이 필요합니다
- 프로덕션 환경에서는 전용 사용자(`airis`) 생성을 권장합니다

### 환경 변수 보안
- `.env` 파일에 민감한 정보 저장 시 권한 제한 (`chmod 600`)
- 프로덕션 환경에서는 안전한 시크릿 키 사용
- 로그 파일에 민감한 정보 노출 방지

### 네트워크 보안
- 방화벽 설정으로 필요한 포트만 개방 (기본: 3100)
- SSL/TLS 인증서 설정 (프로덕션 환경)
- 리버스 프록시 사용 권장 (Nginx)

## 📞 문제 해결

### 일반적인 문제

**Q: 스크립트 실행 권한 오류**
```bash
# A: 실행 권한 부여
chmod +x ./scripts/*.sh
```

**Q: Node.js 버전 호환성 문제**
```bash
# A: Node.js 16+ 설치
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Q: 포트 3100 사용 중 오류**
```bash
# A: 포트 사용 프로세스 확인 및 종료
sudo lsof -ti:3100 | xargs sudo kill -9
```

**Q: PM2 클러스터 모드 오류**
```bash
# A: PM2 재설치 및 초기화
sudo npm uninstall -g pm2
sudo npm install -g pm2
pm2 kill
```

### 로그 확인
```bash
# 환경 검증 로그
cat logs/environment-check.log

# 서비스 로그
sudo journalctl -u airis-mon -f

# PM2 로그
pm2 logs airis-mon

# 애플리케이션 로그
tail -f logs/airis-mon.log
```

## 🔄 업데이트 및 유지보수

### 정기 업데이트
```bash
# Git에서 최신 코드 가져오기
git pull origin main

# 의존성 업데이트
cd clickstack-architecture/test-suite
npm update

# 서비스 재시작
sudo ./scripts/prod.sh reload
```

### 백업 및 복구
```bash
# 수동 백업 생성
sudo ./scripts/prod.sh backup

# 백업 목록 확인
sudo ./scripts/prod.sh list-backups

# 백업에서 복구
sudo ./scripts/prod.sh restore /path/to/backup.tar.gz
```

---

## 📚 추가 정보

- **프로젝트 홈**: [AIRIS-MON Repository]
- **문서**: `CLAUDE.md`
- **이슈 리포트**: GitHub Issues
- **기여 가이드**: `CONTRIBUTING.md`

**🌟 AIRIS-MON 스크립트 세트로 효율적인 모니터링 플랫폼 운영을 시작하세요! 🌟**