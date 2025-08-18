#!/bin/bash

# AIRIS-MON 환경 설정 검증 스크립트
# 작성자: AIRIS-MON Development Team
# 버전: 1.0.0
# 설명: 시스템 환경 및 설정 검증을 위한 종합 진단 스크립트

set -euo pipefail

# =============================================================================
# 상수 및 설정
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly TEST_SUITE_DIR="$PROJECT_ROOT/clickstack-architecture/test-suite"
readonly LOG_DIR="$PROJECT_ROOT/logs"
readonly CHECK_LOG="$LOG_DIR/environment-check.log"

# 최소 시스템 요구사항
readonly MIN_NODE_VERSION=16
readonly MIN_PYTHON_VERSION="3.8"
readonly MIN_MEMORY_GB=2
readonly MIN_DISK_GB=5
readonly REQUIRED_PORT=3100

# 색상 코드
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m'

# 체크 결과 카운터
declare -i CHECKS_TOTAL=0
declare -i CHECKS_PASSED=0
declare -i CHECKS_FAILED=0
declare -i CHECKS_WARNING=0

# =============================================================================
# 유틸리티 함수
# =============================================================================

log_info() {
    echo -e "${GREEN}[CHECK]${NC} $(date '+%H:%M:%S') - $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$CHECK_LOG"
}

log_warn() {
    echo -e "${YELLOW}[CHECK]${NC} $(date '+%H:%M:%S') - ⚠️  $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARN] $1" >> "$CHECK_LOG"
    ((CHECKS_WARNING++))
}

log_error() {
    echo -e "${RED}[CHECK]${NC} $(date '+%H:%M:%S') - ❌ $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$CHECK_LOG"
    ((CHECKS_FAILED++))
}

log_success() {
    echo -e "${GREEN}[CHECK]${NC} $(date '+%H:%M:%S') - ✅ $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" >> "$CHECK_LOG"
    ((CHECKS_PASSED++))
}

print_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║   🔍 AIRIS-MON 환경 설정 검증 🔍                          ║
    ║                                                          ║
    ║   • 시스템 요구사항 확인                                 ║
    ║   • 소프트웨어 의존성 검증                               ║
    ║   • 프로젝트 구성 검사                                   ║
    ║   • 보안 설정 점검                                       ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

print_section() {
    echo
    echo -e "${WHITE}=== $1 ===${NC}"
    echo
}

increment_total() {
    ((CHECKS_TOTAL++))
}

# 버전 비교 함수
version_compare() {
    local version1=$1
    local operator=$2
    local version2=$3
    
    # 버전을 배열로 분할
    IFS='.' read -ra VER1 <<< "$version1"
    IFS='.' read -ra VER2 <<< "$version2"
    
    # 최대 길이 확인
    local max_len=${#VER1[@]}
    if [[ ${#VER2[@]} -gt $max_len ]]; then
        max_len=${#VER2[@]}
    fi
    
    # 각 구성 요소 비교
    for ((i=0; i<max_len; i++)); do
        local v1=${VER1[i]:-0}
        local v2=${VER2[i]:-0}
        
        # 숫자가 아닌 문자 제거
        v1=$(echo "$v1" | sed 's/[^0-9]*//g')
        v2=$(echo "$v2" | sed 's/[^0-9]*//g')
        
        v1=${v1:-0}
        v2=${v2:-0}
        
        if [[ $v1 -gt $v2 ]]; then
            [[ "$operator" == ">=" ]] || [[ "$operator" == ">" ]]
            return
        elif [[ $v1 -lt $v2 ]]; then
            [[ "$operator" == "<=" ]] || [[ "$operator" == "<" ]]
            return
        fi
    done
    
    # 모든 구성 요소가 같음
    [[ "$operator" == ">=" ]] || [[ "$operator" == "<=" ]] || [[ "$operator" == "==" ]]
}

# =============================================================================
# 시스템 요구사항 검증
# =============================================================================

check_operating_system() {
    print_section "운영체제 정보"
    increment_total
    
    local os_info=""
    
    if [[ -f /etc/os-release ]]; then
        os_info=$(cat /etc/os-release | grep "PRETTY_NAME" | cut -d'"' -f2)
        log_success "운영체제: $os_info"
        
        # 지원되는 OS 확인
        if grep -q -i "ubuntu\|debian\|centos\|rhel\|fedora\|amazon linux" /etc/os-release; then
            log_success "지원되는 운영체제입니다."
        else
            log_warn "테스트되지 않은 운영체제입니다."
        fi
    else
        log_warn "운영체제 정보를 확인할 수 없습니다."
        os_info=$(uname -s)
    fi
    
    # 아키텍처 확인
    local arch=$(uname -m)
    log_info "아키텍처: $arch"
    
    if [[ "$arch" == "x86_64" ]] || [[ "$arch" == "amd64" ]]; then
        log_success "지원되는 아키텍처입니다."
    else
        log_warn "테스트되지 않은 아키텍처입니다: $arch"
    fi
}

check_system_resources() {
    print_section "시스템 리소스"
    
    # 메모리 확인
    increment_total
    if command -v free &> /dev/null; then
        local memory_gb=$(free -g | awk '/^Mem:/{print $2}')
        local memory_mb=$(free -m | awk '/^Mem:/{print $2}')
        
        log_info "총 메모리: ${memory_gb}GB (${memory_mb}MB)"
        
        if [[ $memory_gb -ge $MIN_MEMORY_GB ]]; then
            log_success "메모리 요구사항을 만족합니다. (최소: ${MIN_MEMORY_GB}GB)"
        elif [[ $memory_mb -ge $((MIN_MEMORY_GB * 1024)) ]]; then
            log_success "메모리 요구사항을 만족합니다."
        else
            log_error "메모리가 부족합니다. 현재: ${memory_gb}GB, 최소: ${MIN_MEMORY_GB}GB"
        fi
        
        # 사용 가능한 메모리 확인
        local available_gb=$(free -g | awk '/^Mem:/{print $7}')
        if [[ $available_gb -lt 1 ]]; then
            log_warn "사용 가능한 메모리가 부족할 수 있습니다: ${available_gb}GB"
        fi
    else
        log_error "메모리 정보를 확인할 수 없습니다."
    fi
    
    # 디스크 공간 확인
    increment_total
    if command -v df &> /dev/null; then
        local disk_info=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $2, $3, $4, $5}')
        local disk_available_gb=$(df -BG "$PROJECT_ROOT" | awk 'NR==2 {print $4}' | tr -d 'G')
        
        log_info "디스크 공간: $disk_info"
        
        if [[ $disk_available_gb -ge $MIN_DISK_GB ]]; then
            log_success "디스크 공간 요구사항을 만족합니다. (최소: ${MIN_DISK_GB}GB)"
        else
            log_error "디스크 공간이 부족합니다. 사용 가능: ${disk_available_gb}GB, 최소: ${MIN_DISK_GB}GB"
        fi
    else
        log_error "디스크 정보를 확인할 수 없습니다."
    fi
    
    # CPU 정보 확인
    increment_total
    if [[ -f /proc/cpuinfo ]]; then
        local cpu_cores=$(nproc)
        local cpu_model=$(grep "model name" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)
        
        log_info "CPU: $cpu_model"
        log_info "CPU 코어: $cpu_cores개"
        
        if [[ $cpu_cores -ge 2 ]]; then
            log_success "CPU 코어 수가 적절합니다."
        else
            log_warn "CPU 코어 수가 적을 수 있습니다: ${cpu_cores}개"
        fi
    else
        log_warn "CPU 정보를 확인할 수 없습니다."
    fi
}

check_network() {
    print_section "네트워크 설정"
    
    # 인터넷 연결 확인
    increment_total
    if ping -c 1 8.8.8.8 &> /dev/null; then
        log_success "인터넷 연결이 정상입니다."
    else
        log_error "인터넷 연결을 확인할 수 없습니다."
    fi
    
    # DNS 해결 확인
    increment_total
    if nslookup google.com &> /dev/null; then
        log_success "DNS 해결이 정상입니다."
    else
        log_error "DNS 해결에 문제가 있습니다."
    fi
    
    # 포트 사용 확인
    increment_total
    if command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$REQUIRED_PORT "; then
            log_error "포트 $REQUIRED_PORT이 이미 사용 중입니다."
        else
            log_success "포트 $REQUIRED_PORT이 사용 가능합니다."
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln | grep -q ":$REQUIRED_PORT "; then
            log_error "포트 $REQUIRED_PORT이 이미 사용 중입니다."
        else
            log_success "포트 $REQUIRED_PORT이 사용 가능합니다."
        fi
    else
        log_warn "포트 확인 도구를 찾을 수 없습니다."
    fi
}

# =============================================================================
# 소프트웨어 의존성 검증
# =============================================================================

check_node_js() {
    print_section "Node.js 환경"
    
    # Node.js 설치 확인
    increment_total
    if command -v node &> /dev/null; then
        local node_version=$(node --version | cut -d'v' -f2)
        log_info "Node.js 버전: v$node_version"
        
        # 버전 확인
        if version_compare "$node_version" ">=" "$MIN_NODE_VERSION.0.0"; then
            log_success "Node.js 버전이 요구사항을 만족합니다. (최소: v$MIN_NODE_VERSION)"
        else
            log_error "Node.js 버전이 너무 낮습니다. 현재: v$node_version, 최소: v$MIN_NODE_VERSION"
        fi
    else
        log_error "Node.js가 설치되지 않았습니다."
        return 1
    fi
    
    # npm 확인
    increment_total
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        log_success "npm 버전: v$npm_version"
    else
        log_error "npm이 설치되지 않았습니다."
    fi
    
    # yarn 확인 (선택사항)
    increment_total
    if command -v yarn &> /dev/null; then
        local yarn_version=$(yarn --version)
        log_info "Yarn 버전: v$yarn_version (선택사항)"
    else
        log_info "Yarn이 설치되지 않았습니다. (선택사항)"
    fi
    
    # 글로벌 패키지 확인
    increment_total
    local global_packages=("pm2" "nodemon")
    local missing_packages=()
    
    for package in "${global_packages[@]}"; do
        if npm list -g "$package" &> /dev/null; then
            log_info "글로벌 패키지 '$package'가 설치되어 있습니다."
        else
            missing_packages+=("$package")
        fi
    done
    
    if [[ ${#missing_packages[@]} -eq 0 ]]; then
        log_success "모든 권장 글로벌 패키지가 설치되어 있습니다."
    else
        log_warn "일부 글로벌 패키지가 누락되었습니다: ${missing_packages[*]}"
    fi
}

check_python() {
    print_section "Python 환경"
    
    # Python3 설치 확인
    increment_total
    if command -v python3 &> /dev/null; then
        local python_version=$(python3 --version | cut -d' ' -f2)
        log_info "Python 버전: $python_version"
        
        # 버전 확인
        if version_compare "$python_version" ">=" "$MIN_PYTHON_VERSION"; then
            log_success "Python 버전이 요구사항을 만족합니다. (최소: $MIN_PYTHON_VERSION)"
        else
            log_error "Python 버전이 너무 낮습니다. 현재: $python_version, 최소: $MIN_PYTHON_VERSION"
        fi
    else
        log_error "Python3이 설치되지 않았습니다."
        return 1
    fi
    
    # pip 확인
    increment_total
    if command -v pip3 &> /dev/null; then
        local pip_version=$(pip3 --version | cut -d' ' -f2)
        log_success "pip3 버전: $pip_version"
    else
        log_error "pip3이 설치되지 않았습니다."
    fi
    
    # Python 모듈 확인
    increment_total
    local required_modules=("requests" "json" "os" "sys")
    local missing_modules=()
    
    for module in "${required_modules[@]}"; do
        if python3 -c "import $module" &> /dev/null; then
            log_info "Python 모듈 '$module'이 사용 가능합니다."
        else
            missing_modules+=("$module")
        fi
    done
    
    if [[ ${#missing_modules[@]} -eq 0 ]]; then
        log_success "모든 필수 Python 모듈이 사용 가능합니다."
    else
        log_error "일부 Python 모듈이 누락되었습니다: ${missing_modules[*]}"
    fi
}

check_git() {
    print_section "Git 환경"
    
    # Git 설치 확인
    increment_total
    if command -v git &> /dev/null; then
        local git_version=$(git --version | cut -d' ' -f3)
        log_success "Git 버전: $git_version"
        
        # Git 설정 확인
        increment_total
        if git config --global user.name &> /dev/null && git config --global user.email &> /dev/null; then
            local git_name=$(git config --global user.name)
            local git_email=$(git config --global user.email)
            log_success "Git 사용자 설정: $git_name <$git_email>"
        else
            log_warn "Git 사용자 설정이 없습니다. 프로젝트 분석 기능에 영향을 줄 수 있습니다."
        fi
    else
        log_warn "Git이 설치되지 않았습니다. 프로젝트 분석 기능이 제한됩니다."
    fi
}

check_optional_tools() {
    print_section "선택적 도구"
    
    local optional_tools=("curl" "wget" "htop" "tree" "jq" "unzip" "tar")
    
    for tool in "${optional_tools[@]}"; do
        increment_total
        if command -v "$tool" &> /dev/null; then
            log_success "도구 '$tool'이 설치되어 있습니다."
        else
            log_info "도구 '$tool'이 설치되지 않았습니다. (선택사항)"
        fi
    done
}

# =============================================================================
# 프로젝트 구성 검증
# =============================================================================

check_project_structure() {
    print_section "프로젝트 구조"
    
    # 프로젝트 루트 확인
    increment_total
    if [[ -d "$PROJECT_ROOT" ]]; then
        log_success "프로젝트 루트 디렉토리가 존재합니다: $PROJECT_ROOT"
    else
        log_error "프로젝트 루트 디렉토리가 존재하지 않습니다: $PROJECT_ROOT"
        return 1
    fi
    
    # 핵심 디렉토리 확인
    local required_dirs=(
        "$TEST_SUITE_DIR"
        "$TEST_SUITE_DIR/src"
        "$TEST_SUITE_DIR/src/public"
        "$TEST_SUITE_DIR/src/analysis"
    )
    
    for dir in "${required_dirs[@]}"; do
        increment_total
        if [[ -d "$dir" ]]; then
            log_success "디렉토리가 존재합니다: $(basename "$dir")"
        else
            log_error "필수 디렉토리가 없습니다: $dir"
        fi
    done
    
    # 핵심 파일 확인
    local required_files=(
        "$TEST_SUITE_DIR/src/app.js"
        "$TEST_SUITE_DIR/package.json"
        "$TEST_SUITE_DIR/src/analysis/project_analyzer.py"
    )
    
    for file in "${required_files[@]}"; do
        increment_total
        if [[ -f "$file" ]]; then
            log_success "파일이 존재합니다: $(basename "$file")"
        else
            log_error "필수 파일이 없습니다: $file"
        fi
    done
}

check_project_dependencies() {
    print_section "프로젝트 의존성"
    
    # package.json 확인
    increment_total
    if [[ -f "$TEST_SUITE_DIR/package.json" ]]; then
        log_success "package.json 파일이 존재합니다."
        
        # 핵심 의존성 확인
        increment_total
        local core_deps=("express" "chalk" "uuid")
        local missing_deps=()
        
        for dep in "${core_deps[@]}"; do
            if grep -q "\"$dep\"" "$TEST_SUITE_DIR/package.json"; then
                log_info "의존성 '$dep'이 package.json에 정의되어 있습니다."
            else
                missing_deps+=("$dep")
            fi
        done
        
        if [[ ${#missing_deps[@]} -eq 0 ]]; then
            log_success "모든 핵심 의존성이 정의되어 있습니다."
        else
            log_warn "일부 핵심 의존성이 누락되었습니다: ${missing_deps[*]}"
        fi
        
        # node_modules 확인
        increment_total
        if [[ -d "$TEST_SUITE_DIR/node_modules" ]]; then
            local modules_count=$(find "$TEST_SUITE_DIR/node_modules" -mindepth 1 -maxdepth 1 -type d | wc -l)
            log_success "node_modules가 존재합니다. (${modules_count}개 모듈)"
        else
            log_warn "node_modules가 없습니다. 'npm install'을 실행해야 합니다."
        fi
    else
        log_error "package.json 파일이 없습니다."
    fi
}

check_configuration_files() {
    print_section "설정 파일"
    
    # 환경 설정 파일 확인
    local env_files=(".env" ".env.development" ".env.production")
    
    for env_file in "${env_files[@]}"; do
        increment_total
        if [[ -f "$PROJECT_ROOT/$env_file" ]]; then
            log_success "환경 파일이 존재합니다: $env_file"
            
            # 필수 환경 변수 확인
            local required_vars=("NODE_ENV" "PORT")
            for var in "${required_vars[@]}"; do
                if grep -q "^$var=" "$PROJECT_ROOT/$env_file"; then
                    log_info "환경 변수 '$var'이 $env_file에 정의되어 있습니다."
                fi
            done
        else
            log_info "환경 파일이 없습니다: $env_file (선택사항)"
        fi
    done
    
    # PM2 설정 파일 확인
    increment_total
    if [[ -f "$PROJECT_ROOT/ecosystem.config.js" ]]; then
        log_success "PM2 설정 파일이 존재합니다."
    else
        log_info "PM2 설정 파일이 없습니다. (프로덕션 환경에서 권장)"
    fi
}

# =============================================================================
# 보안 및 권한 검증
# =============================================================================

check_file_permissions() {
    print_section "파일 권한"
    
    # 프로젝트 디렉토리 권한 확인
    increment_total
    if [[ -r "$PROJECT_ROOT" ]] && [[ -x "$PROJECT_ROOT" ]]; then
        log_success "프로젝트 디렉토리 읽기/실행 권한이 있습니다."
    else
        log_error "프로젝트 디렉토리 권한이 부족합니다."
    fi
    
    # 실행 파일 권한 확인
    increment_total
    local script_files=(
        "$SCRIPT_DIR/airis-mon.sh"
        "$SCRIPT_DIR/dev.sh"
        "$SCRIPT_DIR/prod.sh"
        "$SCRIPT_DIR/service.sh"
    )
    
    local executable_count=0
    for script in "${script_files[@]}"; do
        if [[ -f "$script" ]] && [[ -x "$script" ]]; then
            ((executable_count++))
        fi
    done
    
    if [[ $executable_count -eq ${#script_files[@]} ]]; then
        log_success "모든 스크립트 파일이 실행 가능합니다."
    else
        log_warn "일부 스크립트 파일에 실행 권한이 없습니다."
    fi
    
    # 로그 디렉토리 권한 확인
    increment_total
    mkdir -p "$LOG_DIR"
    if [[ -w "$LOG_DIR" ]]; then
        log_success "로그 디렉토리 쓰기 권한이 있습니다."
    else
        log_error "로그 디렉토리 쓰기 권한이 없습니다: $LOG_DIR"
    fi
}

check_security_settings() {
    print_section "보안 설정"
    
    # 방화벽 상태 확인
    increment_total
    if command -v ufw &> /dev/null; then
        local ufw_status=$(ufw status | head -1)
        log_info "UFW 방화벽 상태: $ufw_status"
        
        if ufw status | grep -q "3100"; then
            log_info "포트 3100 방화벽 규칙이 존재합니다."
        else
            log_warn "포트 3100 방화벽 규칙이 없습니다."
        fi
    elif command -v firewall-cmd &> /dev/null; then
        local firewalld_status=$(systemctl is-active firewalld)
        log_info "firewalld 상태: $firewalld_status"
    else
        log_info "방화벽 설정을 확인할 수 없습니다."
    fi
    
    # SELinux 상태 확인
    increment_total
    if command -v getenforce &> /dev/null; then
        local selinux_status=$(getenforce)
        log_info "SELinux 상태: $selinux_status"
        
        if [[ "$selinux_status" == "Enforcing" ]]; then
            log_warn "SELinux가 활성화되어 있습니다. 추가 설정이 필요할 수 있습니다."
        fi
    else
        log_info "SELinux가 설치되지 않았습니다."
    fi
    
    # sudo 권한 확인
    increment_total
    if sudo -n true 2>/dev/null; then
        log_info "sudo 권한이 있습니다."
    else
        log_info "sudo 권한이 없습니다. (일반 사용자 실행)"
    fi
}

# =============================================================================
# 성능 및 최적화 검증
# =============================================================================

check_system_performance() {
    print_section "시스템 성능"
    
    # 로드 평균 확인
    increment_total
    if [[ -f /proc/loadavg ]]; then
        local load_avg=$(cat /proc/loadavg | cut -d' ' -f1-3)
        local cpu_cores=$(nproc)
        local load_1min=$(cat /proc/loadavg | cut -d' ' -f1)
        
        log_info "로드 평균: $load_avg (CPU 코어: $cpu_cores개)"
        
        # 로드 평균이 CPU 코어 수보다 높으면 경고
        if (( $(echo "$load_1min > $cpu_cores" | bc -l) )); then
            log_warn "시스템 로드가 높습니다. 성능에 영향을 줄 수 있습니다."
        else
            log_success "시스템 로드가 정상 범위입니다."
        fi
    else
        log_warn "로드 평균을 확인할 수 없습니다."
    fi
    
    # 스왑 사용량 확인
    increment_total
    if command -v free &> /dev/null; then
        local swap_total=$(free -m | awk '/^Swap:/{print $2}')
        local swap_used=$(free -m | awk '/^Swap:/{print $3}')
        
        if [[ $swap_total -gt 0 ]]; then
            log_info "스왑 메모리: ${swap_used}MB / ${swap_total}MB 사용 중"
            
            local swap_usage_percent=$((swap_used * 100 / swap_total))
            if [[ $swap_usage_percent -gt 50 ]]; then
                log_warn "스왑 사용량이 높습니다: ${swap_usage_percent}%"
            else
                log_success "스왑 사용량이 정상입니다: ${swap_usage_percent}%"
            fi
        else
            log_info "스왑 메모리가 설정되지 않았습니다."
        fi
    fi
    
    # 디스크 I/O 확인
    increment_total
    if command -v iostat &> /dev/null; then
        log_info "디스크 I/O 통계를 사용할 수 있습니다."
    else
        log_info "iostat를 설치하면 디스크 성능 모니터링이 가능합니다."
    fi
}

# =============================================================================
# 리포트 생성 및 요약
# =============================================================================

generate_report() {
    local report_file="$LOG_DIR/environment-check-report.txt"
    
    print_section "검증 요약"
    
    echo "=== AIRIS-MON 환경 검증 리포트 ===" > "$report_file"
    echo "생성 시간: $(date)" >> "$report_file"
    echo "시스템: $(uname -a)" >> "$report_file"
    echo "" >> "$report_file"
    
    # 결과 요약
    local total_percentage=0
    if [[ $CHECKS_TOTAL -gt 0 ]]; then
        total_percentage=$((CHECKS_PASSED * 100 / CHECKS_TOTAL))
    fi
    
    echo -e "총 검사 항목: ${CYAN}$CHECKS_TOTAL${NC}개"
    echo -e "통과: ${GREEN}$CHECKS_PASSED${NC}개"
    echo -e "실패: ${RED}$CHECKS_FAILED${NC}개"
    echo -e "경고: ${YELLOW}$CHECKS_WARNING${NC}개"
    echo -e "성공률: ${CYAN}$total_percentage%${NC}"
    echo
    
    echo "총 검사 항목: $CHECKS_TOTAL개" >> "$report_file"
    echo "통과: $CHECKS_PASSED개" >> "$report_file"
    echo "실패: $CHECKS_FAILED개" >> "$report_file"
    echo "경고: $CHECKS_WARNING개" >> "$report_file"
    echo "성공률: $total_percentage%" >> "$report_file"
    echo "" >> "$report_file"
    
    # 상태별 권장사항
    if [[ $CHECKS_FAILED -eq 0 ]] && [[ $CHECKS_WARNING -eq 0 ]]; then
        echo -e "${GREEN}🎉 모든 검사를 통과했습니다! AIRIS-MON을 실행할 준비가 되었습니다.${NC}"
        echo "✅ 시스템이 모든 요구사항을 만족합니다." >> "$report_file"
    elif [[ $CHECKS_FAILED -eq 0 ]]; then
        echo -e "${YELLOW}⚠️  일부 경고가 있지만 AIRIS-MON을 실행할 수 있습니다.${NC}"
        echo "⚠️ 경고사항이 있지만 실행 가능합니다." >> "$report_file"
    elif [[ $CHECKS_FAILED -lt 3 ]]; then
        echo -e "${YELLOW}🔧 몇 가지 문제를 해결하면 AIRIS-MON을 실행할 수 있습니다.${NC}"
        echo "🔧 일부 문제 해결이 필요합니다." >> "$report_file"
    else
        echo -e "${RED}❌ 여러 문제를 해결해야 AIRIS-MON을 정상 실행할 수 있습니다.${NC}"
        echo "❌ 다수의 문제 해결이 필요합니다." >> "$report_file"
    fi
    echo
    
    # 권장 다음 단계
    echo -e "${WHITE}권장 다음 단계:${NC}"
    
    if [[ $CHECKS_FAILED -gt 0 ]]; then
        echo "1. 실패한 항목들을 확인하고 해결하세요."
        echo "2. 상세한 로그를 확인하세요: $CHECK_LOG"
    fi
    
    if [[ ! -d "$TEST_SUITE_DIR/node_modules" ]]; then
        echo "3. Node.js 의존성을 설치하세요: cd $TEST_SUITE_DIR && npm install"
    fi
    
    if [[ $CHECKS_FAILED -eq 0 ]]; then
        echo "1. AIRIS-MON을 시작하세요: ./scripts/airis-mon.sh start"
        echo "2. 브라우저에서 http://localhost:3100에 접속하세요."
    fi
    
    echo
    echo "상세한 검사 결과: $CHECK_LOG"
    echo "검증 리포트: $report_file"
    
    # 로그 파일에 전체 로그 복사
    echo "" >> "$report_file"
    echo "=== 상세 로그 ===" >> "$report_file"
    cat "$CHECK_LOG" >> "$report_file"
}

# =============================================================================
# 수정 제안 함수
# =============================================================================

suggest_fixes() {
    print_section "문제 해결 제안"
    
    if [[ $CHECKS_FAILED -eq 0 ]] && [[ $CHECKS_WARNING -eq 0 ]]; then
        return 0
    fi
    
    echo -e "${WHITE}발견된 문제들에 대한 해결 방법:${NC}"
    echo
    
    # Node.js 관련 문제
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}Node.js 설치:${NC}"
        echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
        echo "  CentOS/RHEL: curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash - && sudo yum install -y nodejs"
        echo
    fi
    
    # Python 관련 문제
    if ! command -v python3 &> /dev/null; then
        echo -e "${YELLOW}Python3 설치:${NC}"
        echo "  Ubuntu/Debian: sudo apt-get install -y python3 python3-pip"
        echo "  CentOS/RHEL: sudo yum install -y python3 python3-pip"
        echo
    fi
    
    # Git 관련 문제
    if ! command -v git &> /dev/null; then
        echo -e "${YELLOW}Git 설치:${NC}"
        echo "  Ubuntu/Debian: sudo apt-get install -y git"
        echo "  CentOS/RHEL: sudo yum install -y git"
        echo
    fi
    
    # 권한 관련 문제
    if [[ ! -x "$SCRIPT_DIR/airis-mon.sh" ]]; then
        echo -e "${YELLOW}스크립트 실행 권한 설정:${NC}"
        echo "  chmod +x $SCRIPT_DIR/*.sh"
        echo
    fi
    
    # 의존성 설치 문제
    if [[ ! -d "$TEST_SUITE_DIR/node_modules" ]]; then
        echo -e "${YELLOW}Node.js 의존성 설치:${NC}"
        echo "  cd $TEST_SUITE_DIR && npm install"
        echo
    fi
    
    echo -e "${CYAN}모든 문제를 해결한 후 다시 검사를 실행하세요:${NC}"
    echo "  $0"
    echo
}

# =============================================================================
# 메인 실행 로직
# =============================================================================

main() {
    local quick_mode="${1:-false}"
    
    # 로그 디렉토리 생성
    mkdir -p "$LOG_DIR"
    
    # 로그 파일 초기화
    echo "=== AIRIS-MON 환경 검증 시작 ===" > "$CHECK_LOG"
    echo "시작 시간: $(date)" >> "$CHECK_LOG"
    echo "" >> "$CHECK_LOG"
    
    # 배너 출력
    print_banner
    
    log_info "AIRIS-MON 환경 검증을 시작합니다..."
    echo
    
    # 검증 실행
    check_operating_system
    check_system_resources
    check_network
    check_node_js
    check_python
    check_git
    check_optional_tools
    check_project_structure
    check_project_dependencies
    check_configuration_files
    check_file_permissions
    check_security_settings
    check_system_performance
    
    # 결과 리포트 생성
    generate_report
    
    # 문제 해결 제안 (빠른 모드가 아닌 경우)
    if [[ "$quick_mode" != "true" ]]; then
        suggest_fixes
    fi
    
    # 종료 코드 설정
    if [[ $CHECKS_FAILED -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

# 스크립트가 직접 실행되었을 때만 main 함수 호출
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi