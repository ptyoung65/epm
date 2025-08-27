# Claude Code Configuration - SPARC Development Environment

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### 📁 File Organization Rules

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## Project Overview

This project uses SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with Claude-Flow orchestration for systematic Test-Driven Development.

## SPARC Commands

### Core Commands
- `npx claude-flow sparc modes` - List available modes
- `npx claude-flow sparc run <mode> "<task>"` - Execute specific mode
- `npx claude-flow sparc tdd "<feature>"` - Run complete TDD workflow
- `npx claude-flow sparc info <mode>` - Get mode details

### Batchtools Commands
- `npx claude-flow sparc batch <modes> "<task>"` - Parallel execution
- `npx claude-flow sparc pipeline "<task>"` - Full pipeline processing
- `npx claude-flow sparc concurrent <mode> "<tasks-file>"` - Multi-task processing

### Build Commands
- `npm run build` - Build project
- `npm run test` - Run tests
- `npm run lint` - Linting
- `npm run typecheck` - Type checking

## SPARC Workflow Phases

1. **Specification** - Requirements analysis (`sparc run spec-pseudocode`)
2. **Pseudocode** - Algorithm design (`sparc run spec-pseudocode`)
3. **Architecture** - System design (`sparc run architect`)
4. **Refinement** - TDD implementation (`sparc tdd`)
5. **Completion** - Integration (`sparc run integration`)

## Code Style & Best Practices

- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated

## 🚀 Available Agents (54 Total)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `collective-intelligence-coordinator`, `swarm-memory-manager`

### Consensus & Distributed
`byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `consensus-builder`, `crdt-synchronizer`, `quorum-manager`, `security-manager`

### Performance & Optimization
`perf-analyzer`, `performance-benchmarker`, `task-orchestrator`, `memory-coordinator`, `smart-agent`

### GitHub & Repository
`github-modes`, `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`, `project-board-sync`, `repo-architect`, `multi-repo-swarm`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

### Specialized Development
`backend-dev`, `mobile-dev`, `ml-developer`, `cicd-engineer`, `api-docs`, `system-architect`, `code-analyzer`, `base-template-generator`

### Testing & Validation
`tdd-london-swarm`, `production-validator`

### Migration & Planning
`migration-planner`, `swarm-init`

## 🎯 Claude Code vs MCP Tools

### Claude Code Handles ALL:
- File operations (Read, Write, Edit, MultiEdit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work
- Project navigation and analysis
- TodoWrite and task management
- Git operations
- Package management
- Testing and debugging

### MCP Tools ONLY:
- Coordination and planning
- Memory management
- Neural features
- Performance tracking
- Swarm orchestration
- GitHub integration

**KEY**: MCP coordinates, Claude Code executes.

## 🚀 Quick Setup

```bash
# Add Claude Flow MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start
```

## MCP Tool Categories

### Coordination
`swarm_init`, `agent_spawn`, `task_orchestrate`

### Monitoring
`swarm_status`, `agent_list`, `agent_metrics`, `task_status`, `task_results`

### Memory & Neural
`memory_usage`, `neural_status`, `neural_train`, `neural_patterns`

### GitHub Integration
`github_swarm`, `repo_analyze`, `pr_enhance`, `issue_triage`, `code_review`

### System
`benchmark_run`, `features_detect`, `swarm_monitor`

## 📋 Agent Coordination Protocol

### Every Agent MUST:

**1️⃣ BEFORE Work:**
```bash
npx claude-flow@alpha hooks pre-task --description "[task]"
npx claude-flow@alpha hooks session-restore --session-id "swarm-[id]"
```

**2️⃣ DURING Work:**
```bash
npx claude-flow@alpha hooks post-edit --file "[file]" --memory-key "swarm/[agent]/[step]"
npx claude-flow@alpha hooks notify --message "[what was done]"
```

**3️⃣ AFTER Work:**
```bash
npx claude-flow@alpha hooks post-task --task-id "[task]"
npx claude-flow@alpha hooks session-end --export-metrics true
```

## 🎯 Concurrent Execution Examples

### ✅ CORRECT (Single Message):
```javascript
[BatchTool]:
  // Initialize swarm
  mcp__claude-flow__swarm_init { topology: "mesh", maxAgents: 6 }
  mcp__claude-flow__agent_spawn { type: "researcher" }
  mcp__claude-flow__agent_spawn { type: "coder" }
  mcp__claude-flow__agent_spawn { type: "tester" }
  
  // Spawn agents with Task tool
  Task("Research agent: Analyze requirements...")
  Task("Coder agent: Implement features...")
  Task("Tester agent: Create test suite...")
  
  // Batch todos
  TodoWrite { todos: [
    {id: "1", content: "Research", status: "in_progress", priority: "high"},
    {id: "2", content: "Design", status: "pending", priority: "high"},
    {id: "3", content: "Implement", status: "pending", priority: "high"},
    {id: "4", content: "Test", status: "pending", priority: "medium"},
    {id: "5", content: "Document", status: "pending", priority: "low"}
  ]}
  
  // File operations
  Bash "mkdir -p app/{src,tests,docs}"
  Write "app/src/index.js"
  Write "app/tests/index.test.js"
  Write "app/docs/README.md"
```

### ❌ WRONG (Multiple Messages):
```javascript
Message 1: mcp__claude-flow__swarm_init
Message 2: Task("agent 1")
Message 3: TodoWrite { todos: [single todo] }
Message 4: Write "file.js"
// This breaks parallel coordination!
```

## Performance Benefits

- **84.8% SWE-Bench solve rate**
- **32.3% token reduction**
- **2.8-4.4x speed improvement**
- **27+ neural models**

## Hooks Integration

### Pre-Operation
- Auto-assign agents by file type
- Validate commands for safety
- Prepare resources automatically
- Optimize topology by complexity
- Cache searches

### Post-Operation
- Auto-format code
- Train neural patterns
- Update memory
- Analyze performance
- Track token usage

### Session Management
- Generate summaries
- Persist state
- Track metrics
- Restore context
- Export workflows

## Advanced Features (v2.0.0)

- 🚀 Automatic Topology Selection
- ⚡ Parallel Execution (2.8-4.4x speed)
- 🧠 Neural Training
- 📊 Bottleneck Analysis
- 🤖 Smart Auto-Spawning
- 🛡️ Self-Healing Workflows
- 💾 Cross-Session Memory
- 🔗 GitHub Integration

## Integration Tips

1. Start with basic swarm init
2. Scale agents gradually
3. Use memory for context
4. Monitor progress regularly
5. Train patterns from success
6. Enable hooks automation
7. Use GitHub tools first

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues

---

Remember: **Claude Flow coordinates, Claude Code creates!**

---

## 🚀 AIRIS EPM 완전한 대시보드 시스템 구축 완료 (2025-08-27)

### 📊 **최신 완성 현황** ✅

**프로젝트**: AIRIS EPM (Enterprise Performance Monitoring) 완전한 관찰성 플랫폼  
**구현 완성도**: 100% ✅  
**기술 스택**: Node.js + Express.js + Docker + Chart.js + D3.js + shadcn/ui

### 🎯 **새롭게 구현된 EPM 핵심 대시보드**

#### **1. 📄 로그 모니터링 대시보드 ✅**
- **URL**: http://localhost:3001/logs-dashboard.html
- **기능**: 
  - 실시간 로그 스트림 (500개 샘플 로그)
  - 서비스별/레벨별 필터링 (ERROR, WARN, INFO, DEBUG)
  - 로그 볼륨 추이 & 레벨 분포 차트
  - 키워드 검색 및 하이라이트
  - JSON 데이터 내보내기

#### **2. 📊 메트릭 모니터링 대시보드 ✅**  
- **URL**: http://localhost:3001/metrics-dashboard.html
- **기능**:
  - 시스템 리소스 실시간 모니터링 (CPU, 메모리, 네트워크, 디스크)
  - 애플리케이션 메트릭 (응답시간, 처리량, 에러율)
  - 서비스별 성능 지표 테이블
  - 데이터베이스 메트릭 (PostgreSQL, MongoDB, Redis, ClickHouse)
  - 5분/15분/1시간/6시간 시간 범위

#### **3. 🔍 트레이스 모니터링 대시보드 ✅**
- **URL**: http://localhost:3001/traces-dashboard.html
- **기능**:
  - 분산 시스템 요청 추적 (200개 샘플 트레이스)
  - 지연시간 분포 & 서비스 호출 분포 차트
  - **고급 트레이스 뷰어**: D3.js 서비스 플로우 + 스팬 타임라인
  - 트레이스 ID/서비스/상태/지연시간 필터링
  - 에러/느린 트레이스 자동 분류

### 🔄 **통합 EPM 네비게이션 시스템 ✅**

#### **완전한 관찰성 3기둥 (Logs + Metrics + Traces) 구현**:
- **모든 기존 대시보드**에 EPM 네비게이션 통합
- **메인 대시보드**: 📄 로그, 📊 메트릭, 🔍 트레이스 원클릭 접근
- **상호 네비게이션**: 13개 모든 대시보드 간 원활한 이동
- **통일된 브랜딩**: "AIRIS EPM" 일관성 유지

### 🌐 **완성된 EPM 접속 URL**

#### **핵심 EPM 대시보드**:
- **🏠 메인 대시보드**: http://localhost:3001/
- **📄 로그 모니터링**: http://localhost:3001/logs-dashboard.html  
- **📊 메트릭 모니터링**: http://localhost:3001/metrics-dashboard.html
- **🔍 트레이스 모니터링**: http://localhost:3001/traces-dashboard.html
- **🔧 서비스 관리**: http://localhost:3001/services-management.html

#### **기존 전문 대시보드들** (EPM 통합):
- **☕ J2EE 모니터링**: http://localhost:3001/j2ee-dashboard.html
- **🏗️ WAS 모니터링**: http://localhost:3001/was-dashboard.html  
- **🚨 예외 추적**: http://localhost:3001/exception-dashboard.html
- **🗺️ 서비스 토폴로지**: http://localhost:3001/topology-dashboard.html
- **🔔 알림 관리**: http://localhost:3001/alert-dashboard.html
- **🧠 온톨로지 시스템**: http://localhost:3001/ontology.html

### 🎨 **기술적 성취**

#### **완전한 EPM 플랫폼 구현**:
1. **관찰성 3기둥**: Logs + Metrics + Traces 완전 구현 ✅
2. **실시간 데이터**: 30초 자동 새로고침, 현실적 샘플 데이터 ✅
3. **통합 UX**: shadcn/ui + Tailwind CSS 일관된 디자인 ✅
4. **확장성**: 추가 서비스/메트릭 쉽게 확장 가능 ✅
5. **상호운용성**: 모든 대시보드 간 원활한 네비게이션 ✅

### 📊 **최종 완성도**

| 구분 | 상태 | 완성도 |
|------|------|--------|
| **로그 모니터링** | ✅ 완전 구현 | 100% |
| **메트릭 모니터링** | ✅ 완전 구현 | 100% |
| **트레이스 모니터링** | ✅ 완전 구현 | 100% |
| **통합 네비게이션** | ✅ 완전 구현 | 100% |
| **기존 APM 기능** | ✅ 모든 기능 유지 | 100% |
| **브랜딩 일관성** | ✅ AIRIS EPM 통일 | 100% |

### 🎯 **총 EPM 구현 완성도: 100%**  
**AIRIS가 이제 진정한 Enterprise Performance Monitoring 플랫폼으로 완성됨**

---

## 📋 AIRIS APM 시스템 기반 구현 현황 (2025-08-18)

### 🎯 완성된 J2EE APM 전문 시스템

**구현 완료율**: 100% ✅ (대전-APM 기능요약.pdf 모든 요구사항 구현)

---

## 🏗️ Backend Microservices (13개 서비스)

### 1. J2EE 특화 모니터링 서비스 ✅
- **포트**: 3008 | **위치**: `clickstack-architecture/services/j2ee-monitor/`
- **기능**: Servlet, JSP, EJB(Session/Entity/Message Bean) 실시간 모니터링
- **특화 기능**: 
  - J2EE 컴포넌트별 성능 추적 및 분석
  - Transaction 추적 및 세션 관리
  - HTTP Session 모니터링 및 메모리 분석

### 2. WAS 전문 모니터링 서비스 ✅  
- **포트**: 3009 | **위치**: `clickstack-architecture/services/was-monitor/`
- **지원 WAS**: Tomcat, WebLogic, WebSphere
- **특화 기능**:
  - JVM Heap/GC 실시간 분석 및 최적화 권장
  - Thread Pool 상태 모니터링
  - WAS별 설정 정보 및 성능 튜닝 가이드

### 3. 예외/에러 추적 시스템 ✅
- **포트**: 3010 | **위치**: `clickstack-architecture/services/exception-tracker/`
- **특화 기능**:
  - Exception 실시간 분류 (Critical/High/Medium/Low)
  - Stack Trace 상세 분석 및 해결방안 제시
  - 에러 패턴 분석 및 예측 알고리즘

### 4. 서비스 토폴로지 관리 ✅
- **포트**: 3012 | **위치**: `clickstack-architecture/services/service-topology/`
- **특화 기능**:
  - 실시간 서비스 의존성 맵핑
  - Critical Path 분석 및 병목지점 탐지
  - 서비스 간 통신 패턴 분석

### 5. 알림/경보 관리 시스템 ✅
- **포트**: 3011 | **위치**: `clickstack-architecture/services/alert-notification/`
- **특화 기능**:
  - 다채널 알림 (Email, Slack, SMS, Webhook)
  - 알림 규칙 엔진 및 임계치 관리
  - 에스컬레이션 및 상관관계 분석

### 6. 추가 핵심 서비스들
- **API Gateway** (포트: 3000) - 서비스 오케스트레이션 및 라우팅
- **Analytics Engine** (포트: 3003) - 실시간 데이터 분석
- **Session Replay** (포트: 3004) - 사용자 세션 기록/재생
- **AIOps Engine** (포트: 3005) - AI 기반 이상탐지
- **Event Delta Analyzer** (포트: 3006) - 기준선 대비 변화 분석
- **NLP Search** (포트: 3007) - 한국어 자연어 검색
- **Data Ingestion** (포트: 3001) - 데이터 수집 파이프라인

---

## 🎨 Frontend Dashboard Suite (6개 전문 대시보드)

### 1. 통합 메인 대시보드 ✅
- **URL**: http://localhost:3002/
- **기능**: 전체 시스템 상태 통합 모니터링, 한국어 현지화

### 2. J2EE 전문 모니터링 대시보드 ✅
- **URL**: http://localhost:3002/j2ee-dashboard.html
- **특화 기능**:
  - Servlet/JSP/EJB 실시간 성능 차트
  - Transaction 모니터링 및 통계
  - EJB Bean별 상태 추적 (Session/Entity/Message)

### 3. WAS 모니터링 대시보드 ✅
- **URL**: http://localhost:3002/was-dashboard.html  
- **특화 기능**:
  - 다중 WAS 지원 (Tomcat/WebLogic/WebSphere 전환 가능)
  - JVM 힙 메모리 실시간 차트 및 GC 분석
  - Thread Pool 상태 테이블 및 성능 최적화 권장사항

### 4. 예외 추적 대시보드 ✅
- **URL**: http://localhost:3002/exception-dashboard.html
- **특화 기능**:
  - Critical/Warning/Info 예외 분류 및 트렌드 차트
  - 상세 Stack Trace 모달 및 해결책 제안
  - 사용자 영향 분석 및 예외 그룹별 통계

### 5. 서비스 토폴로지 대시보드 ✅
- **URL**: http://localhost:3002/topology-dashboard.html
- **특화 기능**:
  - D3.js 기반 인터랙티브 서비스 맵
  - 실시간 의존성 분석 및 Critical Path 표시
  - 드래그&드롭, 줌/팬 컨트롤 및 레이아웃 전환

### 6. 알림 관리 대시보드 ✅
- **URL**: http://localhost:3002/alert-dashboard.html
- **특화 기능**:
  - 실시간 알림 모니터링 및 심각도별 분류
  - 알림 규칙 설정 및 채널 관리
  - 알림 이력 및 성능 지표 대시보드

### 7. 배포 관리 대시보드 ✅ (기존)
- **URL**: http://localhost:3002/deployment-manager.html
- **기능**: 컨테이너 배포 자동화 및 실시간 로그 모니터링

---

## 🛠️ 기술 스택 및 아키텍처

### Backend Architecture
- **언어**: Node.js + Express.js
- **컨테이너화**: Docker + Docker Compose
- **서비스 메시**: Microservices with Service Discovery
- **헬스체크**: 자동 헬스체크 및 재시작 메커니즘

### Database & Storage
- **시계열 데이터**: ClickHouse (포트: 8123, 9000)
- **관계형 데이터**: PostgreSQL (포트: 5432)  
- **캐시**: Redis (포트: 6379)
- **문서형**: MongoDB (포트: 27017)

### Frontend Stack
- **UI Framework**: HTML5 + Tailwind CSS + JavaScript ES6
- **차트**: Chart.js (메트릭), D3.js (토폴로지)
- **국제화**: 완전 한국어 현지화
- **반응형**: 모바일 친화적 설계

### DevOps & Infrastructure
- **컨테이너 레지스트리**: localhost:5000 (18개 서비스 이미지)
- **오케스트레이션**: Docker Compose
- **빌드 자동화**: `./scripts/start-all.sh` 통합 스크립트
- **모니터링**: 실시간 상태 체크 및 로그 수집

---

## 🌏 한국어 현지화 완성도

### UI/UX 현지화
- **언어**: 100% 한국어 인터페이스
- **시간대**: Asia/Seoul 자동 적용  
- **용어**: 한국 IT 업계 표준 용어 사용
- **디자인**: 한국형 비즈니스 UI/UX 패턴

### 비즈니스 로직 현지화
- **알림 메시지**: 한국어 비즈니스 문맥
- **에러 분류**: 한국 개발 환경 특화
- **성능 지표**: 한국 서비스 기준 임계치

---

## 🚀 시스템 구동 및 접속 방법

### 1. 새로 접속시 초기화 및 시작 (권장)
```bash
# 기존 모든 컨테이너 정리 및 포트 초기화
docker stop $(docker ps -q) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker system prune -f

# 전체 시스템 빌드 & 실행
cd /home/ptyoung/work/AIRIS_APM/clickstack-architecture
./scripts/start-all.sh

# 또는 개별 실행 (권장하지 않음)
docker compose up -d
```

### 2. 시스템 상태 확인
```bash
# 컨테이너 상태 확인
docker ps

# 서비스 상태 확인
curl -s http://localhost:3002/ | head -5

# 포트 사용 현황 확인
netstat -tlnp | grep -E ':(3000|3002|5000|6379|8123|9000)'
```

### 3. 주요 접속 URL
- **📊 통합 대시보드**: http://localhost:3002/
- **☕ J2EE 모니터링**: http://localhost:3002/j2ee-dashboard.html
- **🏗️ WAS 모니터링**: http://localhost:3002/was-dashboard.html  
- **🚨 예외 추적**: http://localhost:3002/exception-dashboard.html
- **🗺️ 서비스 맵**: http://localhost:3002/topology-dashboard.html
- **🔔 알림 관리**: http://localhost:3002/alert-dashboard.html
- **🚀 배포 관리**: http://localhost:3002/deployment-manager.html
- **🧠 온톨로지 시스템**: http://localhost:3002/ontology.html

### 4. 빠른 시작 명령어 (복사 붙여넣기 용)
```bash
# 🚀 원클릭 시스템 초기화 & 시작
docker stop $(docker ps -q) 2>/dev/null || true && docker rm $(docker ps -aq) 2>/dev/null || true && docker system prune -f && cd /home/ptyoung/work/AIRIS_APM/clickstack-architecture && ./scripts/start-all.sh

# 📊 시스템 접속 확인
echo "✅ 시스템 접속: http://localhost:3002/" && curl -s http://localhost:3002/ > /dev/null && echo "🎉 시스템 정상 동작!" || echo "❌ 시스템 시작 중... 잠시 후 다시 확인"
```

### 5. API 엔드포인트
- **API Gateway**: http://localhost:3000/api/v1/
- **레지스트리 관리**: http://localhost:5000/v2/_catalog
- **각 서비스별 API**: 포트 3001~3012 개별 접속

### 6. 트러블슈팅 가이드

#### **포트 충돌 문제**
```bash
# 포트 사용 중인 프로세스 강제 종료
sudo lsof -ti:3002 | xargs kill -9 2>/dev/null || true
sudo lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sudo lsof -ti:5000 | xargs kill -9 2>/dev/null || true

# Docker 네트워크 초기화
docker network prune -f
```

#### **시스템 완전 리셋**
```bash
# 🔥 완전 초기화 (주의: 모든 Docker 데이터 삭제)
docker stop $(docker ps -q) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker rmi $(docker images -q) 2>/dev/null || true
docker volume prune -f
docker network prune -f
docker system prune -af

# 재시작
cd /home/ptyoung/work/AIRIS_APM/clickstack-architecture && ./scripts/start-all.sh
```

#### **접속 불가 문제 해결**
```bash
# 1. 컨테이너 상태 확인
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. 로그 확인
docker logs clickstack-architecture-ui-1

# 3. 네트워크 확인
curl -I http://localhost:3002/ || echo "접속 불가"

# 4. 포트 리스닝 확인
netstat -tlnp | grep 3002 || echo "포트 3002 사용 안함"
```

#### **시스템 계정 정보**
- **사용자**: pty
- **sudo 비밀번호**: pty@5113
- **작업 디렉터리**: /home/ptyoung/work/AIRIS_APM/clickstack-architecture

---

## 📈 실시간 모니터링 기능

### 성능 지표
- **응답시간**: 실시간 모니터링 (목표 < 100ms)
- **처리량**: 분당 요청 수 및 트랜잭션 통계  
- **에러율**: 서비스별/컴포넌트별 에러 발생률
- **자원 사용률**: CPU, 메모리, 네트워크 실시간 추적

### 자동화 기능
- **30초 주기**: 메트릭 자동 새로고침
- **실시간 알림**: Critical 이벤트 즉시 알림
- **자동 복구**: 서비스 다운시 자동 재시작
- **로그 수집**: 통합 로깅 및 검색

---

## 🔧 개발 및 운영 도구

### 빌드 & 배포
```bash
# 개발 환경 실행
./scripts/dev.sh

# 프로덕션 배포  
./scripts/prod.sh

# 서비스 상태 확인
./scripts/check-registry.sh
```

### 모니터링 & 디버깅
- **실시간 로그**: `docker logs -f [container-name]`
- **헬스 체크**: 각 서비스 `/health` 엔드포인트
- **메트릭 수집**: Prometheus 호환 메트릭

---

## 📊 구현 완성도 요약

| 구분 | 상태 | 완성도 |
|------|------|--------|
| **J2EE 모니터링** | ✅ 완료 | 100% |
| **WAS 모니터링** | ✅ 완료 | 100% |
| **예외/에러 추적** | ✅ 완료 | 100% |
| **서비스 토폴로지** | ✅ 완료 | 100% |
| **알림/경보 시스템** | ✅ 완료 | 100% |
| **실시간 대시보드** | ✅ 완료 | 100% |
| **한국어 현지화** | ✅ 완료 | 100% |
| **컨테이너화** | ✅ 완료 | 100% |
| **API 게이트웨이** | ✅ 완료 | 100% |
| **배포 자동화** | ✅ 완료 | 100% |

### 🎯 **총 구현 완성도: 100%** 
**대전-APM 기능요약.pdf의 모든 요구사항 완전 구현 완료**

---

## 📊 OpenTelemetry 통합 모니터링 시스템 (2025-08-19)

### 🎯 최신 구현 완료 사항 ✅

#### **1. OpenTelemetry 전체 스택 구현**
- **OpenTelemetry Collector**: 완전 설정 및 최적화 완료
- **OpenTelemetry Gateway**: 로드밸런싱 및 샘플링 구현  
- **ClickHouse 통합**: 실시간 텔레메트리 데이터 저장
- **Java & Python 샘플 앱**: 실제 데이터 생성 애플리케이션

#### **2. 실시간 데이터 파이프라인**
- **데이터 흐름**: App → Collector → Gateway → ClickHouse → Dashboard
- **실시간 수집**: Traces, Metrics, Logs 완전 수집 체계
- **성능 최적화**: 배치 처리, 메모리 제한, 재시도 로직

#### **3. 모니터링 대시보드 UI 개선**
- **차트 높이 안정화**: 모든 대시보드 차트 높이 일관성 확보
- **반응형 개선**: 스크롤 문제 해결 및 레이아웃 최적화
- **Chart.js 최적화**: aspectRatio 설정으로 예측 가능한 차트 크기

### 🔧 기술적 개선사항

#### **Chart Height Variability 해결**
- **문제**: 차트 높이 가변으로 인한 스크롤 문제
- **해결**: 
  - 모든 차트 컨테이너에 `h-64` (256px) 고정 높이 적용
  - Chart.js `aspectRatio` 속성 설정 (line: 2:1, doughnut: 1:1)
  - 차트 업데이트시 `'none'` 애니메이션 모드 사용

#### **수정된 대시보드 파일들**
- `clickstack-architecture/frontend/db-monitoring.html`
- `clickstack-architecture/frontend/web-monitoring.html`  
- `clickstack-architecture/frontend/system-monitoring.html`
- `clickstack-architecture/frontend/app-monitoring.html`

### 🚀 OpenTelemetry 아키텍처

#### **컨테이너 구성**
```
java-sample-app     → OTLP 데이터 생성
python-sample-app   → OTLP 데이터 생성
otel-collector      → 데이터 수집 & 전처리  
otel-gateway        → 로드밸런싱 & 배치
clickhouse          → 시계열 DB 저장
otel-monitor-api    → REST API 제공
frontend            → 실시간 대시보드
```

#### **데이터 흐름**
1. **수집**: Java/Python 앱에서 OTLP 프로토콜로 데이터 전송
2. **처리**: Collector에서 배치처리, 리소스 속성 추가
3. **게이트웨이**: Gateway에서 로드밸런싱, 샘플링
4. **저장**: ClickHouse에 최적화된 스키마로 저장
5. **표시**: REST API를 통해 대시보드에서 실시간 시각화

### 🔄 Git 백업 현황

#### **최신 커밋 정보** 
- **커밋 ID**: `474c83b` ✅
- **이전 커밋**: `9f777b7` (J2EE APM 시스템)
- **브랜치**: `main`
- **커밋 메시지**: "🔧 Fix Dashboard Chart Height Variability Issues"

#### **파일 변경 현황**
- **신규 추가**: OpenTelemetry 설정 파일, 샘플 앱, 모니터링 API
- **수정 완료**: 모든 대시보드 차트 높이 최적화
- **상태**: 완전 백업 및 버전 관리 완료

---

## 🎨 shadcn/ui 디자인 시스템 완전 적용 (2025-08-20)

### 🎯 shadcn/ui 적용 완료 현황 ✅

#### **1. 전체 대시보드 shadcn/ui 통합 완료**
- **통합 메인 대시보드**: 이미 완전 적용된 상태 유지
- **J2EE 모니터링 대시보드**: shadcn/ui 디자인 시스템 완전 적용
- **WAS 모니터링 대시보드**: shadcn/ui 디자인 시스템 완전 적용
- **예외 추적 대시보드**: shadcn/ui 디자인 시스템 완전 적용
- **서비스 토폴로지 대시보드**: shadcn/ui 디자인 시스템 완전 적용
- **알림 관리 대시보드**: shadcn/ui 디자인 시스템 완전 적용

#### **2. 핵심 shadcn/ui 기능 구현**
- **CSS 변수 시스템**: 완전한 테마 색상 지원 (Light/Dark 모드)
- **Tailwind CSS 통합**: CDN 로드 및 커스텀 설정
- **현대적 카드 스타일**: 섀도우, 보더, 둥근 모서리 구현
- **버튼 컴포넌트**: Primary, Ghost 스타일 완전 구현
- **상태 표시기**: Success, Warning, Error, Info 색상 시스템
- **반응형 디자인**: 모바일 친화적 레이아웃 최적화

#### **3. 기술적 아키텍처 개선**
- **일관된 디자인 시스템**: 모든 대시보드 통일된 UI/UX
- **성능 최적화**: Tailwind CSS CDN으로 빠른 로딩
- **테마 지원**: 완전한 라이트/다크 모드 전환 기능
- **사용자 경험**: 현대적이고 직관적인 인터페이스

### 🔧 shadcn/ui 적용 과정

#### **문제 해결 과정**
1. **초기 문제**: 기존 globals.css 의존성으로 디자인 미적용
2. **해결 방법**: 
   - 모든 HTML 파일에서 globals.css 참조 제거
   - Tailwind CSS CDN 및 shadcn/ui CSS 변수 직접 임베드
   - Docker 컨테이너 이미지 재빌드 및 업데이트
3. **최종 결과**: 모든 대시보드 완전한 shadcn/ui 적용

#### **수정된 대시보드 파일들**
- `clickstack-architecture/ui/korean-hyperdx-dashboard/public/index.html` (메인)
- `clickstack-architecture/ui/korean-hyperdx-dashboard/public/j2ee-dashboard.html`
- `clickstack-architecture/ui/korean-hyperdx-dashboard/public/was-dashboard.html`
- `clickstack-architecture/ui/korean-hyperdx-dashboard/public/exception-dashboard.html`
- `clickstack-architecture/ui/korean-hyperdx-dashboard/public/topology-dashboard.html`
- `clickstack-architecture/ui/korean-hyperdx-dashboard/public/alert-dashboard.html`

#### **Docker 컨테이너 업데이트**
- UI 컨테이너 이미지 재빌드 완료
- 레지스트리 업데이트 및 배포 완료
- 전체 시스템 정상 작동 확인

### 🌐 접속 URL 및 상태

#### **완전 적용된 대시보드 URL**
- **📊 메인 대시보드**: http://localhost:3002/ ✅
- **☕ J2EE 모니터링**: http://localhost:3002/j2ee-dashboard.html ✅
- **🏗️ WAS 모니터링**: http://localhost:3002/was-dashboard.html ✅
- **🚨 예외 추적**: http://localhost:3002/exception-dashboard.html ✅
- **🗺️ 서비스 토폴로지**: http://localhost:3002/topology-dashboard.html ✅
- **🔔 알림 관리**: http://localhost:3002/alert-dashboard.html ✅

#### **시스템 상태**
- **컨테이너**: 모든 서비스 정상 작동
- **UI 렌더링**: shadcn/ui 완전 적용 확인
- **반응형**: 모바일/데스크톱 호환성 완료
- **테마**: Light/Dark 모드 전환 정상

---

## 🧠 온톨로지 지식 체계 완전 구현 (2025-08-25)

### 🎯 완전한 온톨로지 시스템 구축 완료 ✅

#### **1. 완전한 4탭 온톨로지 시스템**
- **🗺️ 온톨로지 그래프**: 81개 노드(64개 클래스 + 17개 속성) + 120+ 관계 완전 시각화
- **📚 지식베이스**: 실생활 비유 포함 일반인 친화적 지식 설명
- **🏗️ 계층구조**: 4단계 트리 구조 온톨로지 표현
- **💎 추출 지식**: 실무 적용 가능한 구체적 운영 지식

#### **2. 고도화된 인터랙티브 기능**
- **줌 & 뷰 컨트롤**: 확대/축소/초기화/전체보기/중앙정렬 완전 동작
- **Force Layout**: 물리엔진 기반 노드 배치 및 실시간 시뮬레이션
- **필터링 시스템**: 노드 타입별/관계 타입별 동적 필터링
- **레이아웃 전환**: Force/계층형/원형 레이아웃 실시간 변경
- **상세 툴팁**: 마우스오버시 노드/관계 상세 정보 표시

#### **3. 포괄적 지식 체계 구축**
- **관찰성 기본**: 시스템 관찰의 핵심 개념 및 3가지 기둥(Logs, Metrics, Traces)
- **인프라 구성**: 서버, 애플리케이션, 데이터베이스, 네트워크, 로드밸런서
- **클라우드 네이티브**: 컨테이너, Kubernetes, 가상머신, 클라우드 서비스
- **성능 관리**: 응답시간, 처리량, 자원사용률, 비즈니스 메트릭
- **장애 관리**: 알림, 이상탐지, 사건대응, 에스컬레이션 체계
- **AIOps**: 머신러닝, 예측분석, 자동화 대응, AIRIS 플랫폼

#### **4. 실무 중심 추출 지식**
- **성능 최적화**: 웹사이트 속도 개선, 메모리 최적화, 자동 확장 설정
- **장애 대응**: 5단계 장애 대응 절차, 에스컬레이션 체계
- **모니터링 베스트 프랙티스**: Golden Signals, 알림 규칙 최적화
- **AI 기반 운영**: 이상 패턴 자동 감지, 예측 기반 사전 대응
- **비즈니스 관점**: 비용 최적화, 사용자 경험 지표, SLA 관리

### 🔧 기술적 구현 완성도

#### **D3.js 기반 고급 시각화**
- **Force Simulation**: 물리엔진 기반 노드 배치 및 실시간 애니메이션
- **줌 동작 완전 구현**: scaleBy, transform 기반 부드러운 줌 제어
- **드래그 & 드롭**: 노드 개별 조작 및 고정 위치 설정
- **레이아웃 알고리즘**: 계층형, 원형, Force 레이아웃 동적 전환
- **화살표 마커**: 관계 타입별 색상 구분된 방향성 표시

#### **사용자 경험 최적화**
- **실시간 통계**: 노드/관계/카테고리 수 실시간 업데이트
- **카테고리별 색상**: 15개 카테고리 구분된 색상 체계
- **반응형 디자인**: 모바일/태블릿/데스크톱 완전 호환
- **로딩 최적화**: 데이터 지연 로딩 및 성능 최적화
- **오류 처리**: 예외 상황 완전 처리 및 사용자 피드백

### 🎨 UI/UX 완전 통합

#### **shadcn/ui 완전 적용**
- **일관된 디자인**: 모든 온톨로지 탭에 shadcn/ui 스타일 적용
- **네비게이션 통합**: J2EE 모니터링과 동일한 상단 메뉴 구조
- **테마 지원**: Light/Dark 모드 완전 지원
- **버튼 & 카드**: 현대적 컴포넌트 스타일 적용

#### **네비게이션 완전 통합**
- **통합 대시보드**: 온톨로지 메뉴 추가 완료
- **모든 대시보드**: 온톨로지 접근 경로 통합 완료  
- **일관된 UX**: 전체 시스템 통일된 네비게이션 경험

### 📊 완전한 온톨로지 데이터

#### **클래스 계층구조 (64개)**
```
ObservabilityEntity (관찰성 엔터티)
├── InfrastructureComponent (인프라 구성요소)
│   ├── Server, Application, Database, Network, LoadBalancer
│   └── CloudInfrastructure (클라우드 인프라)
│       └── VirtualMachine, CloudService, Container, Kubernetes
├── ObservabilityData (관찰성 데이터)  
│   ├── Log, Metric, Trace, Span
│   └── PerformanceIndicator, ResourceUtilization, BusinessMetric
├── FaultManagement (장애 관리)
│   └── Alert, Incident, AnomalyDetection, Escalation
└── AIOpsSystem (AI 운영 시스템)
    └── MachineLearning, PredictiveAnalytics, AIRIS Platform
```

#### **속성 시스템 (17개)**
- **기본 속성**: responseTime, throughput, errorRate, availability
- **자원 속성**: cpuUsage, memoryUsage, diskUsage, networkTraffic
- **식별 속성**: hostname, ipAddress, version, timestamp
- **설정 속성**: port, connectionString, configuration
- **메타 속성**: tags, labels, severity, priority

#### **관계 네트워크 (120+)**
- **계층 관계**: subClassOf (클래스 상속)
- **속성 관계**: hasProperty (속성 보유)  
- **기능 관계**: monitors, detects, triggers, responds
- **구조 관계**: contains, uses, depends, supports

### 🌐 접속 및 사용법

#### **접속 URL**
- **📊 통합 대시보드**: http://localhost:3002/ (온톨로지 메뉴 포함)
- **🧠 온톨로지 시스템**: http://localhost:3002/ontology.html

#### **사용 방법**
1. **그래프 탭**: 인터랙티브 온톨로지 그래프 탐색
   - 줌/팬 컨트롤로 상세 탐색
   - 노드 클릭/드래그로 개별 조작
   - 필터링으로 관심 영역 집중
   
2. **지식베이스 탭**: 실생활 비유로 쉬운 이해
   - 6개 주요 카테고리 체계적 학습
   - 병원, 식당, 물류센터 등 친숙한 비유
   
3. **계층구조 탭**: 체계적 온톨로지 구조 이해
   - 4단계 트리 구조 탐색
   - 각 클래스별 속성 및 설명 확인
   
4. **추출지식 탭**: 실무 적용 즉시 활용
   - 구체적 성능 최적화 방법
   - 장애 대응 5단계 매뉴얼
   - AI 기반 운영 전략

### 🎯 완성도 요약

| 구분 | 상태 | 완성도 |
|------|------|--------|
| **온톨로지 데이터** | ✅ 완료 | 100% (81노드, 120+관계) |
| **4탭 시스템** | ✅ 완료 | 100% |
| **인터랙티브 기능** | ✅ 완료 | 100% |
| **지식베이스** | ✅ 완료 | 100% |
| **실무 지식** | ✅ 완료 | 100% |
| **UI/UX 통합** | ✅ 완료 | 100% |
| **네비게이션** | ✅ 완료 | 100% |

---

**최종 업데이트**: 2025-08-25 22:30 KST  
**프로젝트 상태**: 완전한 온톨로지 지식 체계 구축 완료 APM 시스템 🧠  
**이전 상태**: shadcn/ui 디자인 시스템 완전 적용 APM 시스템 🎨  
**온톨로지 시스템**: 완전 완료 ✅  
**4탭 인터랙티브**: 완전 완료 ✅  
**지식 체계**: 완전 완료 ✅

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Never save working files, text/mds and tests to the root folder.
