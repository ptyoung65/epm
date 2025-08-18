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

## 📋 AIRIS-MON 프로젝트 현재 상태 (2024-08-18)

### 🎯 완성된 주요 시스템

#### 1. 컨테이너 배포 관리 시스템 ✅
- **위치**: `clickstack-architecture/ui/korean-hyperdx-dashboard/public/deployment-manager.html`
- **기능**: 
  - 환경별 배포 관리 (개발/테스트/운영)
  - 실시간 컨테이너 이미지 목록 조회
  - 배포 설정 및 검증
  - 롤백 기능
  - 실시간 배포 로그 모니터링

#### 2. API Gateway 백엔드 시스템 ✅
- **위치**: `clickstack-architecture/services/api-gateway/`
- **포트**: 3000
- **주요 엔드포인트**:
  - `/api/v1/deployment/registry/status` - 레지스트리 상태
  - `/api/v1/deployment/registry/images` - 이미지 목록
  - `/api/v1/deployment/deploy` - 배포 실행
  - `/api/v1/deployment/validate` - 설정 검증
  - `/api/v1/deployment/rollback` - 롤백

#### 3. 컨테이너 레지스트리 ✅
- **URL**: http://localhost:5000
- **상태**: 8개 서비스 이미지 저장 완료
- **총 크기**: ~1.4GB
- **이미지 목록**:
  ```
  airis-mon/api-gateway:latest
  airis-mon/data-ingestion:latest
  airis-mon/analytics-engine:latest
  airis-mon/session-replay:latest
  airis-mon/aiops:latest
  airis-mon/event-delta-analyzer:latest
  airis-mon/nlp-search:latest
  airis-mon/ui:latest
  ```

#### 4. 통합 대시보드 UI ✅
- **URL**: http://localhost:3002
- **기능**:
  - 메인 모니터링 대시보드
  - 배포 관리 화면 연동
  - 실시간 서비스 상태 모니터링
  - 한국어 인터페이스

### 🔧 핵심 구현 파일들

#### Frontend
- `clickstack-architecture/ui/korean-hyperdx-dashboard/public/index.html` - 메인 대시보드
- `clickstack-architecture/ui/korean-hyperdx-dashboard/public/deployment-manager.html` - 배포 관리

#### Backend
- `clickstack-architecture/services/api-gateway/src/index.js` - 메인 API 서버
- `clickstack-architecture/services/api-gateway/src/routes/deployment.js` - 배포 관리 API

#### Scripts & Utils
- `scripts/check-registry.sh` - 레지스트리 상태 확인 스크립트
- `container-registry-info.md` - 레지스트리 접근 방법 문서

### 🚀 사용 방법

#### 1. 시스템 시작
```bash
# 레지스트리 시작
docker run -d -p 5000:5000 --name registry registry:2

# 컨테이너 빌드 & 푸시
./scripts/build-all.sh

# 서비스 시작
docker-compose up -d
```

#### 2. 접속 URL
- **메인 대시보드**: http://localhost:3002
- **배포 관리**: http://localhost:3002/deployment-manager.html
- **API 문서**: http://localhost:3000/api/docs
- **레지스트리**: http://localhost:5000/v2/_catalog

#### 3. 배포 워크플로우
1. 대시보드 접속 → 배포관리 메뉴 클릭
2. 환경 선택 (개발/테스트/운영)
3. 컨테이너 이미지 선택 (다중 선택 가능)
4. 배포 설정 (전략, 리소스, 레플리카)
5. 배포 실행 또는 설정 검증
6. 실시간 로그 모니터링

### 🎨 특징

#### 한국어 현지화
- 모든 UI 메시지 한국어
- 한국 시간대 자동 표시
- 한국형 UX/UI 디자인

#### 실시간 기능
- 30초마다 자동 상태 새로고침
- WebSocket 기반 실시간 로그
- 즉시 배포 상태 업데이트

#### 보안 & 안정성
- Helmet.js 보안 헤더
- Rate limiting (분당 2000회)
- 에러 처리 및 로깅
- 헬스 체크 자동화

### 📊 성능 지표
- **응답 시간**: < 100ms 목표
- **동시 연결**: WebSocket 지원
- **확장성**: Docker/Kubernetes 준비
- **가용성**: 자동 재시작 및 복구

### 🔄 다음 단계 (향후 개발)
- [ ] Kubernetes 클러스터 연동
- [ ] 물리 서버 배포 자동화
- [ ] 모니터링 알림 시스템
- [ ] 성능 최적화 및 캐싱
- [ ] 사용자 권한 관리

---

**마지막 업데이트**: 2024-08-18 15:35 KST  
**상태**: 배포 관리 시스템 완전 구현 완료 ✅

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Never save working files, text/mds and tests to the root folder.
