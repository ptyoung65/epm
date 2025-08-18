#!/bin/bash

# AIRIS-MON 시스템 서비스 관리 스크립트
# 작성자: AIRIS-MON Development Team
# 버전: 1.0.0
# 설명: systemd 서비스 생성, 관리 및 모니터링 스크립트

set -euo pipefail

# =============================================================================
# 상수 및 설정
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly SERVICE_NAME="airis-mon"
readonly SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
readonly SERVICE_USER="airis"
readonly SERVICE_GROUP="airis"
readonly WORKING_DIR="$PROJECT_ROOT/clickstack-architecture/test-suite"
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
    echo -e "${GREEN}[SERVICE]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[SERVICE]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[SERVICE]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_success() {
    echo -e "${GREEN}[SERVICE]${NC} $(date '+%Y-%m-%d %H:%M:%S') - ✅ $1"
}

print_service_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║   ⚙️  AIRIS-MON 시스템 서비스 관리 ⚙️                     ║
    ║                                                          ║
    ║   • systemd 서비스 등록                                  ║
    ║   • 자동 시작 설정                                       ║
    ║   • 서비스 상태 모니터링                                 ║
    ║   • 로그 관리                                            ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "이 스크립트는 root 권한이 필요합니다. sudo를 사용하세요."
        exit 1
    fi
}

check_systemd() {
    if ! command -v systemctl &> /dev/null; then
        log_error "systemd가 설치되지 않았습니다. 이 스크립트는 systemd 시스템에서만 작동합니다."
        exit 1
    fi
}

# =============================================================================
# 사용자 및 그룹 관리
# =============================================================================

create_service_user() {
    log_info "서비스 사용자를 생성합니다..."
    
    # 그룹 생성
    if ! getent group "$SERVICE_GROUP" > /dev/null 2>&1; then
        groupadd --system "$SERVICE_GROUP"
        log_info "그룹 '$SERVICE_GROUP'이 생성되었습니다."
    else
        log_info "그룹 '$SERVICE_GROUP'이 이미 존재합니다."
    fi
    
    # 사용자 생성
    if ! getent passwd "$SERVICE_USER" > /dev/null 2>&1; then
        useradd --system --gid "$SERVICE_GROUP" --shell /bin/false \
                --home-dir "$PROJECT_ROOT" --no-create-home \
                --comment "AIRIS-MON Service User" "$SERVICE_USER"
        log_info "사용자 '$SERVICE_USER'이 생성되었습니다."
    else
        log_info "사용자 '$SERVICE_USER'이 이미 존재합니다."
    fi
    
    # 디렉토리 권한 설정
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$PROJECT_ROOT"
    chmod 755 "$PROJECT_ROOT"
    
    # 로그 디렉토리 권한
    mkdir -p "$LOG_DIR"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$LOG_DIR"
    chmod 755 "$LOG_DIR"
    
    log_success "서비스 사용자 설정 완료"
}

remove_service_user() {
    log_info "서비스 사용자를 제거합니다..."
    
    # 서비스가 실행 중이면 중지
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl stop "$SERVICE_NAME"
    fi
    
    # 사용자 제거
    if getent passwd "$SERVICE_USER" > /dev/null 2>&1; then
        userdel "$SERVICE_USER"
        log_info "사용자 '$SERVICE_USER'이 제거되었습니다."
    fi
    
    # 그룹 제거
    if getent group "$SERVICE_GROUP" > /dev/null 2>&1; then
        groupdel "$SERVICE_GROUP"
        log_info "그룹 '$SERVICE_GROUP'이 제거되었습니다."
    fi
    
    log_success "서비스 사용자 제거 완료"
}

# =============================================================================
# systemd 서비스 생성 및 관리
# =============================================================================

create_systemd_service() {
    log_info "systemd 서비스 파일을 생성합니다..."
    
    # Node.js 경로 찾기
    local node_path=$(which node)
    if [[ -z "$node_path" ]]; then
        log_error "Node.js가 설치되지 않았습니다."
        return 1
    fi
    
    # 환경 파일 경로
    local env_file="$PROJECT_ROOT/.env.production"
    
    # systemd 서비스 파일 생성
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=AIRIS-MON Integrated Monitoring Platform
Documentation=https://github.com/your-org/airis-mon
After=network.target network-online.target
Wants=network-online.target
RequiresMountsFor=$PROJECT_ROOT

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$WORKING_DIR
ExecStart=$node_path src/app.js
ExecReload=/bin/kill -HUP \$MAINPID
ExecStop=/bin/kill -TERM \$MAINPID

# 환경 설정
Environment=NODE_ENV=production
Environment=PORT=3100
Environment=LOG_LEVEL=info
EnvironmentFile=-$env_file

# 재시작 설정
Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=3

# 리소스 제한
LimitNOFILE=65536
LimitNPROC=32768

# 보안 설정
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$PROJECT_ROOT $LOG_DIR
RemoveIPC=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true
MemoryDenyWriteExecute=false
RestrictNamespaces=true
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM

# 프로세스 관리
KillMode=mixed
KillSignal=SIGTERM
TimeoutStartSec=60
TimeoutStopSec=30

# 로그 설정
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF
    
    log_success "systemd 서비스 파일이 생성되었습니다: $SERVICE_FILE"
}

remove_systemd_service() {
    log_info "systemd 서비스를 제거합니다..."
    
    # 서비스 중지 및 비활성화
    if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl disable "$SERVICE_NAME"
        log_info "서비스 자동 시작이 비활성화되었습니다."
    fi
    
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl stop "$SERVICE_NAME"
        log_info "서비스가 중지되었습니다."
    fi
    
    # 서비스 파일 제거
    if [[ -f "$SERVICE_FILE" ]]; then
        rm -f "$SERVICE_FILE"
        systemctl daemon-reload
        log_info "서비스 파일이 제거되었습니다."
    fi
    
    log_success "systemd 서비스 제거 완료"
}

install_service() {
    log_info "AIRIS-MON 서비스를 설치합니다..."
    
    # 사용자 생성
    create_service_user
    
    # systemd 서비스 생성
    create_systemd_service
    
    # systemd 데몬 리로드
    systemctl daemon-reload
    
    # 서비스 활성화
    systemctl enable "$SERVICE_NAME"
    
    # 방화벽 설정 (ufw가 있는 경우)
    if command -v ufw &> /dev/null; then
        ufw allow 3100/tcp comment "AIRIS-MON HTTP"
        log_info "방화벽 규칙이 추가되었습니다 (포트 3100)."
    fi
    
    log_success "AIRIS-MON 서비스 설치 완료"
    echo
    echo -e "${WHITE}다음 명령어로 서비스를 관리할 수 있습니다:${NC}"
    echo -e "  시작: ${CYAN}sudo systemctl start $SERVICE_NAME${NC}"
    echo -e "  중지: ${CYAN}sudo systemctl stop $SERVICE_NAME${NC}"
    echo -e "  상태: ${CYAN}sudo systemctl status $SERVICE_NAME${NC}"
    echo -e "  로그: ${CYAN}sudo journalctl -u $SERVICE_NAME -f${NC}"
    echo
}

uninstall_service() {
    log_info "AIRIS-MON 서비스를 제거합니다..."
    
    # systemd 서비스 제거
    remove_systemd_service
    
    # 사용자 제거 확인
    read -p "서비스 사용자도 제거하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        remove_service_user
    fi
    
    # 방화벽 규칙 제거 (ufw가 있는 경우)
    if command -v ufw &> /dev/null; then
        ufw delete allow 3100/tcp 2>/dev/null || true
        log_info "방화벽 규칙이 제거되었습니다."
    fi
    
    log_success "AIRIS-MON 서비스 제거 완료"
}

# =============================================================================
# 서비스 관리 함수
# =============================================================================

start_service() {
    log_info "AIRIS-MON 서비스를 시작합니다..."
    
    if ! systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        log_error "서비스가 설치되지 않았습니다. 먼저 'install' 명령을 실행하세요."
        return 1
    fi
    
    systemctl start "$SERVICE_NAME"
    
    # 시작 확인
    sleep 3
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_success "서비스가 성공적으로 시작되었습니다."
        show_service_status
    else
        log_error "서비스 시작에 실패했습니다."
        systemctl status "$SERVICE_NAME" --no-pager
        return 1
    fi
}

stop_service() {
    log_info "AIRIS-MON 서비스를 중지합니다..."
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl stop "$SERVICE_NAME"
        log_success "서비스가 중지되었습니다."
    else
        log_warn "서비스가 실행되지 않고 있습니다."
    fi
}

restart_service() {
    log_info "AIRIS-MON 서비스를 재시작합니다..."
    
    systemctl restart "$SERVICE_NAME"
    
    # 재시작 확인
    sleep 3
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_success "서비스가 성공적으로 재시작되었습니다."
        show_service_status
    else
        log_error "서비스 재시작에 실패했습니다."
        systemctl status "$SERVICE_NAME" --no-pager
        return 1
    fi
}

reload_service() {
    log_info "AIRIS-MON 서비스 설정을 다시 로드합니다..."
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl reload "$SERVICE_NAME"
        log_success "서비스 설정이 다시 로드되었습니다."
    else
        log_warn "서비스가 실행되지 않고 있습니다."
        return 1
    fi
}

enable_service() {
    log_info "AIRIS-MON 서비스 자동 시작을 활성화합니다..."
    
    systemctl enable "$SERVICE_NAME"
    log_success "서비스 자동 시작이 활성화되었습니다."
}

disable_service() {
    log_info "AIRIS-MON 서비스 자동 시작을 비활성화합니다..."
    
    systemctl disable "$SERVICE_NAME"
    log_success "서비스 자동 시작이 비활성화되었습니다."
}

show_service_status() {
    echo -e "${WHITE}=== AIRIS-MON 서비스 상태 ===${NC}"
    echo
    
    # systemctl 상태
    systemctl status "$SERVICE_NAME" --no-pager --lines=0 || true
    echo
    
    # 추가 정보
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        local pid=$(systemctl show "$SERVICE_NAME" --property MainPID --value)
        local memory=$(systemctl show "$SERVICE_NAME" --property MemoryCurrent --value)
        local uptime=$(systemctl show "$SERVICE_NAME" --property ActiveEnterTimestamp --value)
        
        echo -e "${YELLOW}추가 정보:${NC}"
        echo -e "  PID: ${CYAN}$pid${NC}"
        if [[ "$memory" != "18446744073709551615" ]] && [[ "$memory" -gt 0 ]]; then
            echo -e "  메모리 사용량: ${CYAN}$(numfmt --to=iec $memory)${NC}"
        fi
        echo -e "  시작 시간: ${CYAN}$uptime${NC}"
        echo
        
        # 네트워크 포트 확인
        if netstat -tuln 2>/dev/null | grep -q ':3100'; then
            echo -e "  🌐 서비스 URL: ${CYAN}http://localhost:3100${NC}"
        else
            echo -e "  ⚠️  포트 3100에서 수신 대기하지 않음"
        fi
        echo
    fi
    
    # 자동 시작 상태
    if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo -e "  🔄 자동 시작: ${GREEN}활성화${NC}"
    else
        echo -e "  🔄 자동 시작: ${RED}비활성화${NC}"
    fi
    echo
}

show_service_logs() {
    local lines="${1:-50}"
    local follow="${2:-false}"
    
    echo -e "${WHITE}=== AIRIS-MON 서비스 로그 ===${NC}"
    echo -e "${YELLOW}마지막 $lines줄 (Ctrl+C로 종료)${NC}"
    echo
    
    if [[ "$follow" == "true" ]]; then
        journalctl -u "$SERVICE_NAME" -n "$lines" -f --no-pager
    else
        journalctl -u "$SERVICE_NAME" -n "$lines" --no-pager
    fi
}

# =============================================================================
# 서비스 검증 및 테스트
# =============================================================================

test_service() {
    log_info "AIRIS-MON 서비스를 테스트합니다..."
    
    # 서비스 상태 확인
    if ! systemctl is-active --quiet "$SERVICE_NAME"; then
        log_error "서비스가 실행되지 않고 있습니다."
        return 1
    fi
    
    # HTTP 응답 테스트
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s -o /dev/null --connect-timeout 2 http://localhost:3100/; then
            log_success "HTTP 응답 테스트 통과 (시도 $attempt/$max_attempts)"
            break
        fi
        
        log_info "HTTP 응답 대기 중... ($attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        log_error "HTTP 응답 테스트 실패"
        return 1
    fi
    
    # API 엔드포인트 테스트
    local endpoints=(
        "/api/session-replay/stats"
        "/api/analysis/history"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f -s -o /dev/null "http://localhost:3100$endpoint"; then
            log_info "API 엔드포인트 테스트 통과: $endpoint"
        else
            log_warn "API 엔드포인트 테스트 실패: $endpoint"
        fi
    done
    
    log_success "서비스 테스트 완료"
}

validate_service() {
    log_info "서비스 설정을 검증합니다..."
    
    local errors=0
    
    # 서비스 파일 존재 확인
    if [[ ! -f "$SERVICE_FILE" ]]; then
        log_error "서비스 파일이 존재하지 않습니다: $SERVICE_FILE"
        ((errors++))
    fi
    
    # 사용자 존재 확인
    if ! getent passwd "$SERVICE_USER" > /dev/null 2>&1; then
        log_error "서비스 사용자가 존재하지 않습니다: $SERVICE_USER"
        ((errors++))
    fi
    
    # 프로젝트 디렉토리 권한 확인
    if [[ ! -d "$PROJECT_ROOT" ]]; then
        log_error "프로젝트 디렉토리가 존재하지 않습니다: $PROJECT_ROOT"
        ((errors++))
    elif [[ ! -r "$PROJECT_ROOT" ]]; then
        log_error "프로젝트 디렉토리 읽기 권한이 없습니다: $PROJECT_ROOT"
        ((errors++))
    fi
    
    # Node.js 앱 파일 확인
    if [[ ! -f "$WORKING_DIR/src/app.js" ]]; then
        log_error "애플리케이션 파일이 존재하지 않습니다: $WORKING_DIR/src/app.js"
        ((errors++))
    fi
    
    # systemd 서비스 유효성 확인
    if ! systemctl cat "$SERVICE_NAME" &> /dev/null; then
        log_error "systemd 서비스 정의가 유효하지 않습니다."
        ((errors++))
    fi
    
    if [[ $errors -eq 0 ]]; then
        log_success "서비스 설정 검증 통과"
        return 0
    else
        log_error "서비스 설정 검증 실패 ($errors개 오류)"
        return 1
    fi
}

# =============================================================================
# 성능 모니터링
# =============================================================================

monitor_service() {
    echo -e "${WHITE}=== AIRIS-MON 서비스 실시간 모니터링 ===${NC}"
    echo -e "${YELLOW}Ctrl+C로 종료${NC}"
    echo
    
    while true; do
        clear
        echo -e "${WHITE}=== $(date '+%Y-%m-%d %H:%M:%S') ===${NC}"
        echo
        
        # 서비스 상태
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            echo -e "서비스 상태: ${GREEN}실행 중${NC}"
            
            # PID 및 메모리
            local pid=$(systemctl show "$SERVICE_NAME" --property MainPID --value)
            local memory=$(systemctl show "$SERVICE_NAME" --property MemoryCurrent --value)
            
            echo -e "PID: ${CYAN}$pid${NC}"
            
            if [[ "$memory" != "18446744073709551615" ]] && [[ "$memory" -gt 0 ]]; then
                echo -e "메모리: ${CYAN}$(numfmt --to=iec $memory)${NC}"
            fi
            
            # CPU 사용률 (top에서 가져오기)
            if [[ -n "$pid" ]] && [[ "$pid" != "0" ]]; then
                local cpu=$(top -bn1 -p "$pid" | tail -1 | awk '{print $9}')
                echo -e "CPU: ${CYAN}$cpu%${NC}"
            fi
            
            # 연결 상태
            if netstat -tuln 2>/dev/null | grep -q ':3100'; then
                echo -e "포트 3100: ${GREEN}수신 대기 중${NC}"
            else
                echo -e "포트 3100: ${RED}수신 대기하지 않음${NC}"
            fi
            
        else
            echo -e "서비스 상태: ${RED}중지됨${NC}"
        fi
        
        echo
        echo -e "${WHITE}=== 최근 로그 (마지막 5줄) ===${NC}"
        journalctl -u "$SERVICE_NAME" -n 5 --no-pager --output=short 2>/dev/null || echo "로그 없음"
        
        sleep 5
    done
}

# =============================================================================
# 헬프 함수
# =============================================================================

show_service_help() {
    echo -e "${WHITE}AIRIS-MON 시스템 서비스 관리 스크립트${NC}"
    echo
    echo -e "${YELLOW}사용법:${NC}"
    echo -e "  sudo $0 <command> [options]"
    echo
    echo -e "${YELLOW}설치 및 제거:${NC}"
    echo -e "  ${GREEN}install${NC}      시스템 서비스 설치"
    echo -e "  ${GREEN}uninstall${NC}    시스템 서비스 제거"
    echo
    echo -e "${YELLOW}서비스 제어:${NC}"
    echo -e "  ${GREEN}start${NC}        서비스 시작"
    echo -e "  ${GREEN}stop${NC}         서비스 중지"
    echo -e "  ${GREEN}restart${NC}      서비스 재시작"
    echo -e "  ${GREEN}reload${NC}       서비스 설정 다시 로드"
    echo -e "  ${GREEN}status${NC}       서비스 상태 확인"
    echo
    echo -e "${YELLOW}자동 시작 설정:${NC}"
    echo -e "  ${GREEN}enable${NC}       자동 시작 활성화"
    echo -e "  ${GREEN}disable${NC}      자동 시작 비활성화"
    echo
    echo -e "${YELLOW}로그 및 모니터링:${NC}"
    echo -e "  ${GREEN}logs${NC}         로그 보기 [lines] [follow]"
    echo -e "  ${GREEN}monitor${NC}      실시간 모니터링"
    echo
    echo -e "${YELLOW}검증 및 테스트:${NC}"
    echo -e "  ${GREEN}validate${NC}     서비스 설정 검증"
    echo -e "  ${GREEN}test${NC}         서비스 기능 테스트"
    echo
    echo -e "${YELLOW}사용자 관리:${NC}"
    echo -e "  ${GREEN}create-user${NC}  서비스 사용자 생성"
    echo -e "  ${GREEN}remove-user${NC}  서비스 사용자 제거"
    echo
    echo -e "${YELLOW}예시:${NC}"
    echo -e "  sudo $0 install       # 서비스 설치"
    echo -e "  sudo $0 start         # 서비스 시작"
    echo -e "  sudo $0 logs 100 true # 100줄 로그를 실시간으로 보기"
    echo -e "  sudo $0 monitor       # 실시간 모니터링"
    echo
    echo -e "${YELLOW}주의사항:${NC}"
    echo -e "  • 모든 명령어는 root 권한(sudo)이 필요합니다"
    echo -e "  • 서비스는 '$SERVICE_USER' 사용자로 실행됩니다"
    echo -e "  • 로그는 journalctl로 관리됩니다"
    echo
}

# =============================================================================
# 메인 실행 로직
# =============================================================================

main() {
    local command="${1:-help}"
    local option1="${2:-}"
    local option2="${3:-}"
    
    # systemd 확인
    check_systemd
    
    # 배너 출력
    if [[ "$command" != "help" ]]; then
        print_service_banner
    fi
    
    case "$command" in
        "install")
            check_root
            install_service
            ;;
        "uninstall")
            check_root
            uninstall_service
            ;;
        "start")
            check_root
            start_service
            ;;
        "stop")
            check_root
            stop_service
            ;;
        "restart")
            check_root
            restart_service
            ;;
        "reload")
            check_root
            reload_service
            ;;
        "status")
            show_service_status
            ;;
        "enable")
            check_root
            enable_service
            ;;
        "disable")
            check_root
            disable_service
            ;;
        "logs")
            local lines="${option1:-50}"
            local follow="${option2:-false}"
            show_service_logs "$lines" "$follow"
            ;;
        "monitor")
            monitor_service
            ;;
        "validate")
            validate_service
            ;;
        "test")
            test_service
            ;;
        "create-user")
            check_root
            create_service_user
            ;;
        "remove-user")
            check_root
            remove_service_user
            ;;
        "help"|"-h"|"--help")
            show_service_help
            ;;
        *)
            log_error "알 수 없는 명령어: $command"
            echo
            show_service_help
            exit 1
            ;;
    esac
}

# 스크립트가 직접 실행되었을 때만 main 함수 호출
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi