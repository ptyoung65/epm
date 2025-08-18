#!/bin/bash

# AIRIS-MON 개발 환경 실행 스크립트
# 작성자: AIRIS-MON Development Team
# 버전: 1.0.0
# 설명: 개발자를 위한 편의 기능이 포함된 실행 스크립트

set -euo pipefail

# =============================================================================
# 상수 및 설정
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly TEST_SUITE_DIR="$PROJECT_ROOT/clickstack-architecture/test-suite"
readonly LOG_DIR="$PROJECT_ROOT/logs"

# 색상 코드
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m'

# =============================================================================
# 유틸리티 함수
# =============================================================================

log_info() {
    echo -e "${GREEN}[DEV]${NC} $(date '+%H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[DEV]${NC} $(date '+%H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[DEV]${NC} $(date '+%H:%M:%S') - $1" >&2
}

print_dev_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║   🔧 AIRIS-MON 개발 환경 🔧                              ║
    ║                                                          ║
    ║   • Hot Reload 지원                                     ║
    ║   • 실시간 로그 모니터링                                 ║
    ║   • 자동 브라우저 열기                                   ║
    ║   • 디버깅 도구 활성화                                   ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# =============================================================================
# 개발 환경 설정
# =============================================================================

setup_dev_environment() {
    log_info "개발 환경을 설정합니다..."
    
    # 개발용 환경 변수 설정
    export NODE_ENV=development
    export AIRIS_DEBUG=true
    export LOG_LEVEL=debug
    
    # 로그 디렉토리 생성
    mkdir -p "$LOG_DIR"
    
    # 개발용 .env 파일 생성/업데이트
    local dev_env_file="$PROJECT_ROOT/.env.development"
    cat > "$dev_env_file" << EOF
# AIRIS-MON 개발 환경 설정
NODE_ENV=development
PORT=3100
LOG_LEVEL=debug
LOG_DIR=$LOG_DIR

# 디버깅 활성화
AIRIS_DEBUG=true
DEBUG=*

# 개발용 설정
HOT_RELOAD=true
WATCH_FILES=true
AUTO_RESTART=true

# 세션 리플레이 설정
SESSION_STORAGE_PATH=$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/sessions
ANALYSIS_STORAGE_PATH=$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/analysis

# Python 분석 엔진 설정
PYTHON_ANALYZER_PATH=$PROJECT_ROOT/clickstack-architecture/test-suite/src/analysis/project_analyzer.py

# 개발용 보안 설정 (실제 프로덕션에서는 변경 필요)
SESSION_SECRET=dev-secret-key-$(date +%s)

# CORS 설정 (개발 환경용)
CORS_ORIGIN=*
CORS_CREDENTIALS=true
EOF
    
    log_info "개발 환경 설정 완료"
}

install_dev_dependencies() {
    log_info "개발 의존성을 확인합니다..."
    
    cd "$TEST_SUITE_DIR"
    
    # nodemon 확인 및 설치
    if ! command -v nodemon &> /dev/null; then
        log_info "nodemon을 설치합니다..."
        if command -v npm &> /dev/null; then
            npm install -g nodemon
        else
            log_error "npm이 설치되지 않았습니다."
            return 1
        fi
    fi
    
    # concurrently 확인 (동시 실행용)
    if ! npm list concurrently &> /dev/null; then
        log_info "concurrently를 설치합니다..."
        npm install --save-dev concurrently
    fi
    
    # wait-on 확인 (서버 대기용)
    if ! npm list wait-on &> /dev/null; then
        log_info "wait-on을 설치합니다..."
        npm install --save-dev wait-on
    fi
    
    log_info "개발 의존성 확인 완료"
}

# =============================================================================
# 개발 서버 실행 함수
# =============================================================================

start_dev_server() {
    log_info "개발 서버를 시작합니다..."
    
    cd "$TEST_SUITE_DIR"
    
    # nodemon 설정 파일 생성
    if [[ ! -f "nodemon.json" ]]; then
        cat > "nodemon.json" << 'EOF'
{
  "watch": ["src/**/*"],
  "ext": "js,json,html,css",
  "ignore": ["src/storage/**/*", "logs/**/*", "node_modules/**/*"],
  "delay": "1000",
  "env": {
    "NODE_ENV": "development",
    "AIRIS_DEBUG": "true"
  },
  "verbose": true
}
EOF
    fi
    
    # 개발 서버 시작
    log_info "📍 개발 서버가 시작되었습니다!"
    echo -e "${WHITE}🔧 개발 모드 기능:${NC}"
    echo -e "   • 파일 변경 시 자동 재시작"
    echo -e "   • 디버그 로그 활성화"
    echo -e "   • 실시간 에러 표시"
    echo
    echo -e "${WHITE}📍 접속 URL:${NC}"
    echo -e "   🌐 메인 대시보드: ${CYAN}http://localhost:3100${NC}"
    echo -e "   📊 시스템 설치: ${CYAN}http://localhost:3100/system-installation.html${NC}"
    echo -e "   🎬 세션 리플레이: ${CYAN}http://localhost:3100/enhanced-recorder${NC}"
    echo
    echo -e "${YELLOW}Ctrl+C로 종료${NC}"
    echo
    
    # nodemon으로 실행
    nodemon src/app.js
}

start_with_browser() {
    log_info "브라우저와 함께 개발 서버를 시작합니다..."
    
    # 백그라운드에서 서버 시작
    start_dev_server &
    local server_pid=$!
    
    # 서버가 시작될 때까지 대기
    log_info "서버 시작을 대기합니다..."
    
    local wait_count=0
    local max_wait=30
    
    while [[ $wait_count -lt $max_wait ]]; do
        if curl -s "http://localhost:3100" > /dev/null 2>&1; then
            break
        fi
        sleep 1
        ((wait_count++))
        echo -n "."
    done
    echo
    
    if [[ $wait_count -ge $max_wait ]]; then
        log_error "서버 시작 타임아웃"
        kill $server_pid 2>/dev/null || true
        return 1
    fi
    
    log_info "브라우저를 엽니다..."
    
    # 운영체제별 브라우저 열기
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3100"
    elif command -v open &> /dev/null; then
        open "http://localhost:3100"
    elif command -v start &> /dev/null; then
        start "http://localhost:3100"
    else
        log_warn "브라우저를 자동으로 열 수 없습니다. 수동으로 http://localhost:3100에 접속하세요."
    fi
    
    # 포그라운드로 서버 프로세스 가져오기
    wait $server_pid
}

# =============================================================================
# 테스트 및 린팅 함수
# =============================================================================

run_tests_watch() {
    log_info "테스트를 감시 모드로 실행합니다..."
    
    cd "$TEST_SUITE_DIR"
    
    if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
        # Jest watch mode가 있으면 사용
        if npm list jest &> /dev/null; then
            npm test -- --watch
        else
            # 일반 테스트 실행
            npm test
        fi
    else
        log_warn "테스트 스크립트가 정의되지 않았습니다."
        return 1
    fi
}

run_lint_fix() {
    log_info "코드 린팅 및 자동 수정을 실행합니다..."
    
    cd "$TEST_SUITE_DIR"
    
    if [[ -f "package.json" ]] && grep -q '"lint"' package.json; then
        npm run lint -- --fix
    else
        log_warn "린트 스크립트가 정의되지 않았습니다."
        return 1
    fi
}

# =============================================================================
# 개발 도구 함수
# =============================================================================

show_dev_logs() {
    log_info "개발 로그를 실시간으로 표시합니다..."
    
    local log_file="$LOG_DIR/airis-mon.log"
    
    if [[ ! -f "$log_file" ]]; then
        log_warn "로그 파일이 없습니다. 서버를 먼저 시작하세요."
        return 1
    fi
    
    # 색상화된 로그 출력
    tail -f "$log_file" | while IFS= read -r line; do
        if [[ "$line" =~ ERROR ]]; then
            echo -e "${RED}$line${NC}"
        elif [[ "$line" =~ WARN ]]; then
            echo -e "${YELLOW}$line${NC}"
        elif [[ "$line" =~ INFO ]]; then
            echo -e "${GREEN}$line${NC}"
        elif [[ "$line" =~ DEBUG ]]; then
            echo -e "${CYAN}$line${NC}"
        else
            echo "$line"
        fi
    done
}

generate_sample_data() {
    log_info "샘플 데이터를 생성합니다..."
    
    cd "$TEST_SUITE_DIR"
    
    # Python으로 샘플 세션 데이터 생성
    python3 << 'EOF'
import json
import os
import random
from datetime import datetime, timedelta

# 세션 저장 경로
session_dir = "src/storage/sessions"
os.makedirs(session_dir, exist_ok=True)

# 샘플 시나리오들
scenarios = [
    "bug_reproduction",
    "user_journey",
    "performance_test",
    "security_analysis",
    "mobile_testing"
]

print("🔄 샘플 세션 데이터 생성 중...")

for i in range(10):
    session_id = f"dev_sample_{i+1}_{int(datetime.now().timestamp())}"
    scenario = random.choice(scenarios)
    
    # 랜덤 이벤트 생성
    events = []
    event_count = random.randint(10, 50)
    
    for j in range(event_count):
        event = {
            "type": random.choice(["click", "input", "keydown", "scroll", "focus"]),
            "timestamp": j * 1000 + random.randint(0, 999),
            "target": {
                "tagName": random.choice(["BUTTON", "INPUT", "DIV", "SPAN", "A"]),
                "className": f"test-element-{j}",
                "textContent": f"Sample element {j}"
            },
            "position": {
                "x": random.randint(0, 1920),
                "y": random.randint(0, 1080)
            }
        }
        events.append(event)
    
    # 세션 데이터 구조
    session_data = {
        "id": session_id,
        "scenario": scenario,
        "startTime": (datetime.now() - timedelta(hours=random.randint(1, 24))).isoformat(),
        "endTime": (datetime.now() - timedelta(hours=random.randint(0, 23))).isoformat(),
        "duration": len(events) * 1000,
        "events": events,
        "eventCount": len(events),
        "clickCount": len([e for e in events if e["type"] == "click"]),
        "metadata": {
            "userAgent": "Mozilla/5.0 (Development Mode)",
            "viewport": "1920x1080",
            "timestamp": datetime.now().isoformat()
        }
    }
    
    # 파일 저장
    filename = f"{session_dir}/{session_id}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(session_data, f, ensure_ascii=False, indent=2)

print(f"✅ 10개의 샘플 세션 데이터가 생성되었습니다.")
EOF
    
    log_info "샘플 분석 데이터를 생성합니다..."
    
    # 샘플 프로젝트 분석 결과 생성
    python3 << 'EOF'
import json
import os
from datetime import datetime

# 분석 결과 저장 경로
analysis_dir = "src/storage/analysis"
os.makedirs(analysis_dir, exist_ok=True)

print("🔄 샘플 분석 데이터 생성 중...")

# 샘플 분석 결과
sample_analysis = {
    "name": "sample-react-project",
    "url": "https://github.com/sample/react-project",
    "analysisId": f"analysis_{int(datetime.now().timestamp())}",
    "timestamp": datetime.now().isoformat(),
    "frontend_framework": "react",
    "backend_framework": "express",
    "components": [
        {
            "id": "javascript_component_Header",
            "name": "Header",
            "type": "component",
            "language": "javascript",
            "complexity": "low",
            "crud_operations": {
                "mysql": ["R"],
                "redis": ["R"]
            }
        },
        {
            "id": "javascript_component_UserProfile",
            "name": "UserProfile", 
            "type": "component",
            "language": "javascript",
            "complexity": "medium",
            "crud_operations": {
                "mysql": ["C", "R", "U"],
                "redis": ["R", "U", "D"]
            }
        }
    ],
    "datastores": [
        {
            "id": "mysql",
            "name": "MySQL Database",
            "type": "Relational Database"
        },
        {
            "id": "redis", 
            "name": "Redis Cache",
            "type": "Key-Value Store"
        }
    ],
    "metrics": {
        "total_files": 150,
        "total_lines": 25000,
        "language_distribution": {
            "javascript": {"files": 120, "lines": 20000},
            "css": {"files": 20, "lines": 3000},
            "html": {"files": 10, "lines": 2000}
        },
        "complexity_distribution": {
            "low": 100,
            "medium": 40,
            "high": 8,
            "very_high": 2
        },
        "estimated_effort_hours": 500
    }
}

# 파일 저장
filename = f"{analysis_dir}/sample_analysis_{int(datetime.now().timestamp())}.json"
with open(filename, 'w', encoding='utf-8') as f:
    json.dump(sample_analysis, f, ensure_ascii=False, indent=2)

print(f"✅ 샘플 분석 데이터가 생성되었습니다.")
EOF
    
    log_info "✅ 모든 샘플 데이터 생성 완료"
}

clean_dev_data() {
    log_info "개발 데이터를 정리합니다..."
    
    # 개발용 세션 데이터 삭제
    find "$TEST_SUITE_DIR/src/storage/sessions" -name "dev_sample_*.json" -delete 2>/dev/null || true
    
    # 개발용 분석 데이터 삭제
    find "$TEST_SUITE_DIR/src/storage/analysis" -name "sample_analysis_*.json" -delete 2>/dev/null || true
    
    # 로그 파일 초기화
    > "$LOG_DIR/airis-mon.log" 2>/dev/null || true
    
    log_info "개발 데이터 정리 완료"
}

# =============================================================================
# 헬프 함수
# =============================================================================

show_dev_help() {
    echo -e "${WHITE}AIRIS-MON 개발 환경 스크립트${NC}"
    echo
    echo -e "${YELLOW}사용법:${NC}"
    echo -e "  $0 <command>"
    echo
    echo -e "${YELLOW}개발 명령어:${NC}"
    echo -e "  ${GREEN}start${NC}        개발 서버 시작 (nodemon)"
    echo -e "  ${GREEN}browser${NC}      브라우저와 함께 서버 시작"
    echo -e "  ${GREEN}logs${NC}         실시간 로그 보기 (색상화)"
    echo -e "  ${GREEN}test${NC}         테스트 감시 모드"
    echo -e "  ${GREEN}lint${NC}         린팅 및 자동 수정"
    echo
    echo -e "${YELLOW}데이터 관리:${NC}"
    echo -e "  ${GREEN}sample${NC}       샘플 데이터 생성"
    echo -e "  ${GREEN}clean${NC}        개발 데이터 정리"
    echo
    echo -e "${YELLOW}환경 설정:${NC}"
    echo -e "  ${GREEN}setup${NC}        개발 환경 설정"
    echo -e "  ${GREEN}deps${NC}         개발 의존성 설치"
    echo
    echo -e "${YELLOW}예시:${NC}"
    echo -e "  $0 start          # 개발 서버 시작"
    echo -e "  $0 browser        # 브라우저와 함께 시작"
    echo -e "  $0 sample         # 테스트용 데이터 생성"
    echo
}

# =============================================================================
# 메인 실행 로직
# =============================================================================

main() {
    local command="${1:-help}"
    
    # 배너 출력
    if [[ "$command" != "help" ]]; then
        print_dev_banner
    fi
    
    case "$command" in
        "start")
            setup_dev_environment
            install_dev_dependencies
            start_dev_server
            ;;
        "browser")
            setup_dev_environment
            install_dev_dependencies
            start_with_browser
            ;;
        "logs")
            show_dev_logs
            ;;
        "test")
            run_tests_watch
            ;;
        "lint")
            run_lint_fix
            ;;
        "sample")
            generate_sample_data
            ;;
        "clean")
            clean_dev_data
            ;;
        "setup")
            setup_dev_environment
            ;;
        "deps")
            install_dev_dependencies
            ;;
        "help"|"-h"|"--help")
            show_dev_help
            ;;
        *)
            log_error "알 수 없는 명령어: $command"
            echo
            show_dev_help
            exit 1
            ;;
    esac
}

# 스크립트가 직접 실행되었을 때만 main 함수 호출
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi