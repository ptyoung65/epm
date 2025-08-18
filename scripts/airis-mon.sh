#!/bin/bash

# AIRIS-MON 통합 모니터링 플랫폼 - 메인 실행 스크립트
# 작성자: AIRIS-MON Development Team
# 버전: 1.0.0
# 설명: AIRIS-MON 플랫폼의 메인 실행 및 관리 스크립트

set -euo pipefail  # 엄격한 오류 처리

# =============================================================================
# 상수 및 설정
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly LOG_DIR="$PROJECT_ROOT/logs"
readonly PID_FILE="$LOG_DIR/airis-mon.pid"
readonly CONFIG_FILE="$PROJECT_ROOT/.env"
readonly DEFAULT_PORT=3100
readonly SERVICE_NAME="AIRIS-MON"

# 색상 코드
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m' # No Color

# =============================================================================
# 유틸리티 함수
# =============================================================================

# 로그 함수들
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_debug() {
    if [[ "${AIRIS_DEBUG:-false}" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
    fi
}

# 배너 출력
print_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
   ┌─────────────────────────────────────────────────────────────┐
   │                                                             │
   │     █████╗ ██╗██████╗ ██╗███████╗      ███╗   ███╗ ██████╗ ███╗   ██╗    │
   │    ██╔══██╗██║██╔══██╗██║██╔════╝      ████╗ ████║██╔═══██╗████╗  ██║    │
   │    ███████║██║██████╔╝██║███████╗█████╗██╔████╔██║██║   ██║██╔██╗ ██║    │
   │    ██╔══██║██║██╔══██╗██║╚════██║╚════╝██║╚██╔╝██║██║   ██║██║╚██╗██║    │
   │    ██║  ██║██║██║  ██║██║███████║      ██║ ╚═╝ ██║╚██████╔╝██║ ╚████║    │
   │    ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝╚══════╝      ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝    │
   │                                                             │
   │        AI-driven Real-time Intelligent System Monitoring   │
   │                     통합 모니터링 플랫폼                      │
   │                                                             │
   └─────────────────────────────────────────────────────────────┘
EOF
    echo -e "${NC}"
}

# 진행률 표시
show_progress() {
    local current=$1
    local total=$2
    local message=$3
    local width=50
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r${CYAN}[%3d%%]${NC} [%s%s] %s" \
        "$percentage" \
        "$(printf "%*s" "$filled" | tr ' ' '█')" \
        "$(printf "%*s" "$empty")" \
        "$message"
    
    if [[ $current -eq $total ]]; then
        echo
    fi
}

# =============================================================================
# 환경 검증 함수
# =============================================================================

check_prerequisites() {
    log_info "시스템 요구사항 확인 중..."
    
    local errors=0
    
    # Node.js 확인
    if ! command -v node &> /dev/null; then
        log_error "Node.js가 설치되지 않았습니다. (최소 v16 필요)"
        ((errors++))
    else
        local node_version=$(node --version | cut -d'.' -f1 | tr -d 'v')
        if [[ $node_version -lt 16 ]]; then
            log_error "Node.js 버전이 너무 낮습니다. 현재: $(node --version), 최소: v16"
            ((errors++))
        else
            log_info "Node.js 버전: $(node --version) ✓"
        fi
    fi
    
    # Python 확인
    if ! command -v python3 &> /dev/null; then
        log_error "Python3가 설치되지 않았습니다. (최소 v3.8 필요)"
        ((errors++))
    else
        local python_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1-2)
        if [[ $(echo "$python_version < 3.8" | bc -l) -eq 1 ]]; then
            log_error "Python 버전이 너무 낮습니다. 현재: $python_version, 최소: 3.8"
            ((errors++))
        else
            log_info "Python 버전: $(python3 --version) ✓"
        fi
    fi
    
    # Git 확인
    if ! command -v git &> /dev/null; then
        log_warn "Git이 설치되지 않았습니다. (프로젝트 분석 기능 제한)"
    else
        log_info "Git 버전: $(git --version) ✓"
    fi
    
    # 메모리 확인
    local memory_gb=$(free -g | awk '/^Mem:/{print $2}')
    if [[ $memory_gb -lt 2 ]]; then
        log_warn "메모리가 부족할 수 있습니다. 현재: ${memory_gb}GB, 권장: 4GB+"
    else
        log_info "메모리: ${memory_gb}GB ✓"
    fi
    
    # 디스크 공간 확인
    local disk_gb=$(df "$PROJECT_ROOT" | awk 'NR==2 {print int($4/1024/1024)}')
    if [[ $disk_gb -lt 5 ]]; then
        log_warn "디스크 공간이 부족할 수 있습니다. 현재: ${disk_gb}GB, 권장: 10GB+"
    else
        log_info "디스크 공간: ${disk_gb}GB 사용 가능 ✓"
    fi
    
    return $errors
}

check_port_availability() {
    local port=${1:-$DEFAULT_PORT}
    
    if command -v lsof &> /dev/null; then
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            log_error "포트 $port이 이미 사용 중입니다."
            return 1
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$port "; then
            log_error "포트 $port이 이미 사용 중입니다."
            return 1
        fi
    else
        log_warn "포트 확인 도구가 없습니다. (lsof 또는 netstat 필요)"
    fi
    
    log_info "포트 $port 사용 가능 ✓"
    return 0
}

# =============================================================================
# 환경 설정 함수
# =============================================================================

setup_environment() {
    log_info "환경 설정 중..."
    
    # 로그 디렉토리 생성
    mkdir -p "$LOG_DIR"
    
    # .env 파일 확인 및 생성
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_info ".env 파일을 생성합니다..."
        cat > "$CONFIG_FILE" << EOF
# AIRIS-MON 환경 설정
NODE_ENV=development
PORT=$DEFAULT_PORT
LOG_LEVEL=info
LOG_DIR=$LOG_DIR

# 세션 리플레이 설정
SESSION_STORAGE_PATH=$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/sessions
ANALYSIS_STORAGE_PATH=$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/analysis

# Python 분석 엔진 설정
PYTHON_ANALYZER_PATH=$PROJECT_ROOT/clickstack-architecture/test-suite/src/analysis/project_analyzer.py

# 디버그 모드
AIRIS_DEBUG=false

# 보안 설정
SESSION_SECRET=airis-mon-$(date +%s)-$(openssl rand -hex 16)
EOF
        log_success ".env 파일이 생성되었습니다."
    else
        log_info ".env 파일이 이미 존재합니다. ✓"
    fi
    
    # 저장소 디렉토리 생성
    mkdir -p "$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/sessions"
    mkdir -p "$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/analysis"
    
    log_success "환경 설정 완료"
}

install_dependencies() {
    log_info "의존성 설치 확인 중..."
    
    local test_suite_dir="$PROJECT_ROOT/clickstack-architecture/test-suite"
    
    if [[ ! -d "$test_suite_dir/node_modules" ]]; then
        log_info "Node.js 의존성을 설치합니다..."
        cd "$test_suite_dir"
        
        if command -v npm &> /dev/null; then
            npm install
        elif command -v yarn &> /dev/null; then
            yarn install
        else
            log_error "npm 또는 yarn이 필요합니다."
            return 1
        fi
        
        log_success "Node.js 의존성 설치 완료"
    else
        log_info "Node.js 의존성이 이미 설치되어 있습니다. ✓"
    fi
    
    # Python 의존성 확인
    if ! python3 -c "import requests" &> /dev/null; then
        log_info "Python requests 라이브러리를 설치합니다..."
        python3 -m pip install requests --user
        log_success "Python 의존성 설치 완료"
    else
        log_info "Python 의존성이 이미 설치되어 있습니다. ✓"
    fi
}

# =============================================================================
# 서비스 관리 함수
# =============================================================================

is_running() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

get_service_status() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        local port=$(get_service_port)
        echo -e "${GREEN}실행 중${NC} (PID: $pid, Port: $port)"
        return 0
    else
        echo -e "${RED}중지됨${NC}"
        return 1
    fi
}

get_service_port() {
    if [[ -f "$CONFIG_FILE" ]]; then
        grep "^PORT=" "$CONFIG_FILE" | cut -d'=' -f2 | tr -d ' '
    else
        echo "$DEFAULT_PORT"
    fi
}

start_service() {
    log_info "$SERVICE_NAME 서비스를 시작합니다..."
    
    if is_running; then
        log_warn "서비스가 이미 실행 중입니다. (PID: $(cat "$PID_FILE"))"
        return 0
    fi
    
    # 환경 설정
    setup_environment
    
    # 의존성 설치
    install_dependencies
    
    # 포트 확인
    local port=$(get_service_port)
    if ! check_port_availability "$port"; then
        log_error "포트 $port을 사용할 수 없습니다."
        return 1
    fi
    
    # 서비스 시작
    local test_suite_dir="$PROJECT_ROOT/clickstack-architecture/test-suite"
    cd "$test_suite_dir"
    
    log_info "서버를 시작합니다... (포트: $port)"
    
    # 백그라운드에서 실행
    nohup node src/app.js > "$LOG_DIR/airis-mon.log" 2>&1 &
    local pid=$!
    
    # PID 저장
    echo "$pid" > "$PID_FILE"
    
    # 시작 확인 (최대 30초 대기)
    local wait_time=0
    local max_wait=30
    
    while [[ $wait_time -lt $max_wait ]]; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            break
        fi
        
        show_progress $wait_time $max_wait "서버 시작 대기 중..."
        sleep 1
        ((wait_time++))
    done
    
    if [[ $wait_time -ge $max_wait ]]; then
        log_error "서버 시작에 실패했습니다. (타임아웃)"
        kill "$pid" 2>/dev/null || true
        rm -f "$PID_FILE"
        return 1
    fi
    
    log_success "$SERVICE_NAME 서비스가 시작되었습니다!"
    echo
    echo -e "${WHITE}📍 접속 정보:${NC}"
    echo -e "   🌐 메인 대시보드: ${CYAN}http://localhost:$port${NC}"
    echo -e "   📊 시스템 설치 관리: ${CYAN}http://localhost:$port/system-installation.html${NC}"
    echo -e "   🎬 세션 리플레이: ${CYAN}http://localhost:$port/enhanced-recorder${NC}"
    echo -e "   🐍 프로젝트 분석: ${CYAN}http://localhost:$port/project-analysis.html${NC}"
    echo -e "   📈 실시간 모니터링: ${CYAN}http://localhost:$port/integrated-dashboard.html${NC}"
    echo
    echo -e "${WHITE}🔧 관리 명령어:${NC}"
    echo -e "   중지: ${YELLOW}$0 stop${NC}"
    echo -e "   재시작: ${YELLOW}$0 restart${NC}"
    echo -e "   상태 확인: ${YELLOW}$0 status${NC}"
    echo -e "   로그 보기: ${YELLOW}$0 logs${NC}"
    echo
}

stop_service() {
    log_info "$SERVICE_NAME 서비스를 중지합니다..."
    
    if ! is_running; then
        log_warn "서비스가 실행되지 않고 있습니다."
        return 0
    fi
    
    local pid=$(cat "$PID_FILE")
    
    # 정상 종료 시도
    kill "$pid" 2>/dev/null || true
    
    # 종료 확인 (최대 10초 대기)
    local wait_time=0
    local max_wait=10
    
    while [[ $wait_time -lt $max_wait ]] && kill -0 "$pid" 2>/dev/null; do
        show_progress $wait_time $max_wait "서비스 종료 대기 중..."
        sleep 1
        ((wait_time++))
    done
    
    # 강제 종료
    if kill -0 "$pid" 2>/dev/null; then
        log_warn "강제 종료를 시도합니다..."
        kill -9 "$pid" 2>/dev/null || true
        sleep 2
    fi
    
    # PID 파일 제거
    rm -f "$PID_FILE"
    
    log_success "$SERVICE_NAME 서비스가 중지되었습니다."
}

restart_service() {
    log_info "$SERVICE_NAME 서비스를 재시작합니다..."
    stop_service
    sleep 2
    start_service
}

show_status() {
    echo -e "${WHITE}=== $SERVICE_NAME 서비스 상태 ===${NC}"
    echo
    echo -e "상태: $(get_service_status)"
    
    if is_running; then
        local pid=$(cat "$PID_FILE")
        local port=$(get_service_port)
        local uptime=$(ps -o etime= -p "$pid" | tr -d ' ')
        local memory=$(ps -o rss= -p "$pid" | awk '{printf "%.1f MB", $1/1024}')
        local cpu=$(ps -o %cpu= -p "$pid" | tr -d ' ')
        
        echo -e "PID: ${CYAN}$pid${NC}"
        echo -e "포트: ${CYAN}$port${NC}"
        echo -e "업타임: ${CYAN}$uptime${NC}"
        echo -e "메모리 사용량: ${CYAN}$memory${NC}"
        echo -e "CPU 사용률: ${CYAN}$cpu%${NC}"
        echo
        echo -e "로그 파일: ${CYAN}$LOG_DIR/airis-mon.log${NC}"
        echo -e "설정 파일: ${CYAN}$CONFIG_FILE${NC}"
        echo -e "PID 파일: ${CYAN}$PID_FILE${NC}"
        
        # 최근 로그 표시
        if [[ -f "$LOG_DIR/airis-mon.log" ]]; then
            echo
            echo -e "${WHITE}=== 최근 로그 (마지막 5줄) ===${NC}"
            tail -n 5 "$LOG_DIR/airis-mon.log" | while IFS= read -r line; do
                echo -e "${CYAN}$line${NC}"
            done
        fi
    fi
    echo
}

show_logs() {
    local log_file="$LOG_DIR/airis-mon.log"
    
    if [[ ! -f "$log_file" ]]; then
        log_error "로그 파일이 존재하지 않습니다: $log_file"
        return 1
    fi
    
    echo -e "${WHITE}=== $SERVICE_NAME 실시간 로그 ===${NC}"
    echo -e "${YELLOW}Ctrl+C로 종료${NC}"
    echo
    
    tail -f "$log_file"
}

# =============================================================================
# 개발자 도구 함수
# =============================================================================

run_tests() {
    log_info "테스트를 실행합니다..."
    
    local test_suite_dir="$PROJECT_ROOT/clickstack-architecture/test-suite"
    cd "$test_suite_dir"
    
    if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
        npm test
    else
        log_warn "테스트 스크립트가 정의되지 않았습니다."
        return 1
    fi
}

run_linter() {
    log_info "코드 린팅을 실행합니다..."
    
    local test_suite_dir="$PROJECT_ROOT/clickstack-architecture/test-suite"
    cd "$test_suite_dir"
    
    if [[ -f "package.json" ]] && grep -q '"lint"' package.json; then
        npm run lint
    else
        log_warn "린트 스크립트가 정의되지 않았습니다."
        return 1
    fi
}

run_dev_mode() {
    log_info "개발 모드로 실행합니다..."
    
    # 개발 환경 설정
    export NODE_ENV=development
    export AIRIS_DEBUG=true
    
    local test_suite_dir="$PROJECT_ROOT/clickstack-architecture/test-suite"
    cd "$test_suite_dir"
    
    # nodemon이 있으면 사용, 없으면 일반 실행
    if command -v nodemon &> /dev/null; then
        nodemon src/app.js
    else
        node src/app.js
    fi
}

# =============================================================================
# 헬프 및 유틸리티 함수
# =============================================================================

show_help() {
    echo -e "${WHITE}AIRIS-MON 통합 모니터링 플랫폼 관리 스크립트${NC}"
    echo
    echo -e "${YELLOW}사용법:${NC}"
    echo -e "  $0 <command> [options]"
    echo
    echo -e "${YELLOW}주요 명령어:${NC}"
    echo -e "  ${GREEN}start${NC}     서비스 시작"
    echo -e "  ${GREEN}stop${NC}      서비스 중지"
    echo -e "  ${GREEN}restart${NC}   서비스 재시작"
    echo -e "  ${GREEN}status${NC}    서비스 상태 확인"
    echo -e "  ${GREEN}logs${NC}      실시간 로그 보기"
    echo
    echo -e "${YELLOW}개발자 명령어:${NC}"
    echo -e "  ${GREEN}dev${NC}       개발 모드로 실행 (hot reload)"
    echo -e "  ${GREEN}test${NC}      테스트 실행"
    echo -e "  ${GREEN}lint${NC}      코드 린팅"
    echo -e "  ${GREEN}check${NC}     시스템 요구사항 확인"
    echo
    echo -e "${YELLOW}유틸리티 명령어:${NC}"
    echo -e "  ${GREEN}install${NC}   의존성 설치"
    echo -e "  ${GREEN}setup${NC}     환경 설정"
    echo -e "  ${GREEN}clean${NC}     로그 및 임시 파일 정리"
    echo -e "  ${GREEN}backup${NC}    데이터 백업"
    echo -e "  ${GREEN}version${NC}   버전 정보"
    echo -e "  ${GREEN}help${NC}      이 도움말 표시"
    echo
    echo -e "${YELLOW}예시:${NC}"
    echo -e "  $0 start           # 서비스 시작"
    echo -e "  $0 status          # 상태 확인"
    echo -e "  $0 logs            # 로그 모니터링"
    echo -e "  $0 dev             # 개발 모드 실행"
    echo
}

show_version() {
    echo -e "${WHITE}AIRIS-MON 통합 모니터링 플랫폼${NC}"
    echo -e "버전: ${CYAN}1.0.0${NC}"
    echo -e "빌드: $(date '+%Y-%m-%d')"
    echo -e "Node.js: $(node --version 2>/dev/null || echo 'Not installed')"
    echo -e "Python: $(python3 --version 2>/dev/null || echo 'Not installed')"
    echo -e "Git: $(git --version 2>/dev/null || echo 'Not installed')"
    echo
}

clean_files() {
    log_info "로그 및 임시 파일을 정리합니다..."
    
    # 로그 파일 정리 (7일 이상 된 파일)
    find "$LOG_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # 임시 분석 파일 정리
    find "$PROJECT_ROOT" -name "analysis_*" -type d -mtime +1 -exec rm -rf {} + 2>/dev/null || true
    
    # 세션 스토리지 정리 (30일 이상)
    local session_dir="$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/sessions"
    if [[ -d "$session_dir" ]]; then
        find "$session_dir" -name "*.json" -mtime +30 -delete 2>/dev/null || true
    fi
    
    log_success "파일 정리 완료"
}

backup_data() {
    log_info "데이터를 백업합니다..."
    
    local backup_dir="$PROJECT_ROOT/backups/$(date '+%Y%m%d_%H%M%S')"
    mkdir -p "$backup_dir"
    
    # 세션 데이터 백업
    local session_dir="$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/sessions"
    if [[ -d "$session_dir" ]]; then
        cp -r "$session_dir" "$backup_dir/sessions"
    fi
    
    # 분석 결과 백업
    local analysis_dir="$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/analysis"
    if [[ -d "$analysis_dir" ]]; then
        cp -r "$analysis_dir" "$backup_dir/analysis"
    fi
    
    # 설정 파일 백업
    if [[ -f "$CONFIG_FILE" ]]; then
        cp "$CONFIG_FILE" "$backup_dir/"
    fi
    
    # 압축
    cd "$PROJECT_ROOT/backups"
    tar -czf "$(basename "$backup_dir").tar.gz" "$(basename "$backup_dir")"
    rm -rf "$backup_dir"
    
    log_success "백업 완료: $PROJECT_ROOT/backups/$(basename "$backup_dir").tar.gz"
}

# =============================================================================
# 메인 실행 로직
# =============================================================================

main() {
    local command="${1:-help}"
    
    # 배너 출력 (help가 아닌 경우)
    if [[ "$command" != "help" && "$command" != "version" ]]; then
        print_banner
    fi
    
    case "$command" in
        "start")
            start_service
            ;;
        "stop")
            stop_service
            ;;
        "restart")
            restart_service
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "dev")
            run_dev_mode
            ;;
        "test")
            run_tests
            ;;
        "lint")
            run_linter
            ;;
        "check")
            check_prerequisites
            ;;
        "install")
            install_dependencies
            ;;
        "setup")
            setup_environment
            ;;
        "clean")
            clean_files
            ;;
        "backup")
            backup_data
            ;;
        "version")
            show_version
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "알 수 없는 명령어: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# 스크립트가 직접 실행되었을 때만 main 함수 호출
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi