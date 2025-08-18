#!/bin/bash

# AIRIS-MON 프로덕션 환경 실행 스크립트
# 작성자: AIRIS-MON Development Team
# 버전: 1.0.0
# 설명: 프로덕션 환경에서 안정적인 서비스 운영을 위한 스크립트

set -euo pipefail

# =============================================================================
# 상수 및 설정
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly TEST_SUITE_DIR="$PROJECT_ROOT/clickstack-architecture/test-suite"
readonly LOG_DIR="$PROJECT_ROOT/logs"
readonly BACKUP_DIR="$PROJECT_ROOT/backups"
readonly PID_FILE="$LOG_DIR/airis-mon.pid"
readonly SERVICE_NAME="airis-mon"

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
    echo -e "${GREEN}[PROD]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$LOG_DIR/production.log"
}

log_warn() {
    echo -e "${YELLOW}[PROD]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARN] $1" >> "$LOG_DIR/production.log"
}

log_error() {
    echo -e "${RED}[PROD]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$LOG_DIR/production.log"
}

log_success() {
    echo -e "${GREEN}[PROD]${NC} $(date '+%Y-%m-%d %H:%M:%S') - ✅ $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" >> "$LOG_DIR/production.log"
}

print_prod_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║   🏭 AIRIS-MON 프로덕션 환경 🏭                          ║
    ║                                                          ║
    ║   • PM2 프로세스 관리                                    ║
    ║   • 자동 로그 순환                                       ║
    ║   • 성능 모니터링                                        ║
    ║   • 자동 백업 시스템                                     ║
    ║   • 무중단 배포 지원                                     ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# =============================================================================
# 프로덕션 환경 설정
# =============================================================================

setup_production_environment() {
    log_info "프로덕션 환경을 설정합니다..."
    
    # 디렉토리 생성
    mkdir -p "$LOG_DIR" "$BACKUP_DIR"
    
    # 프로덕션용 환경 변수 설정
    export NODE_ENV=production
    export AIRIS_DEBUG=false
    export LOG_LEVEL=info
    
    # 프로덕션용 .env 파일 생성/업데이트
    local prod_env_file="$PROJECT_ROOT/.env.production"
    cat > "$prod_env_file" << EOF
# AIRIS-MON 프로덕션 환경 설정
NODE_ENV=production
PORT=3100
LOG_LEVEL=info
LOG_DIR=$LOG_DIR

# 프로덕션 보안 설정
AIRIS_DEBUG=false
DEBUG=

# 성능 최적화
NODE_OPTIONS=--max-old-space-size=4096
UV_THREADPOOL_SIZE=128

# 세션 리플레이 설정
SESSION_STORAGE_PATH=$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/sessions
ANALYSIS_STORAGE_PATH=$PROJECT_ROOT/clickstack-architecture/test-suite/src/storage/analysis

# Python 분석 엔진 설정
PYTHON_ANALYZER_PATH=$PROJECT_ROOT/clickstack-architecture/test-suite/src/analysis/project_analyzer.py

# 보안 설정 (프로덕션용 - 실제 환경에서는 안전한 값으로 변경)
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

# CORS 설정 (프로덕션용)
CORS_ORIGIN=https://your-domain.com
CORS_CREDENTIALS=true

# 로그 설정
LOG_ROTATION=true
LOG_MAX_SIZE=100M
LOG_MAX_FILES=10

# 백업 설정
AUTO_BACKUP=true
BACKUP_INTERVAL=daily
BACKUP_RETENTION=30

# 모니터링 설정
HEALTH_CHECK_INTERVAL=30
PERFORMANCE_MONITORING=true
ERROR_REPORTING=true
EOF
    
    # 시스템 사용자 확인 및 생성
    if ! id "airis" &>/dev/null; then
        log_warn "airis 사용자가 존재하지 않습니다. 수동으로 생성해야 할 수 있습니다."
    fi
    
    # 디렉토리 권한 설정
    chmod 755 "$PROJECT_ROOT"
    chmod 755 "$LOG_DIR"
    chmod 755 "$BACKUP_DIR"
    
    log_success "프로덕션 환경 설정 완료"
}

install_production_dependencies() {
    log_info "프로덕션 의존성을 설치합니다..."
    
    cd "$TEST_SUITE_DIR"
    
    # PM2 확인 및 설치
    if ! command -v pm2 &> /dev/null; then
        log_info "PM2를 설치합니다..."
        if command -v npm &> /dev/null; then
            npm install -g pm2
        else
            log_error "npm이 설치되지 않았습니다."
            return 1
        fi
    fi
    
    # 프로덕션 의존성만 설치
    log_info "Node.js 프로덕션 의존성을 설치합니다..."
    npm ci --only=production
    
    # Python 의존성 확인
    if ! python3 -c "import requests" &> /dev/null; then
        log_info "Python requests 라이브러리를 설치합니다..."
        python3 -m pip install requests --user
    fi
    
    log_success "프로덕션 의존성 설치 완료"
}

create_pm2_config() {
    log_info "PM2 설정 파일을 생성합니다..."
    
    local pm2_config="$PROJECT_ROOT/ecosystem.config.js"
    
    cat > "$pm2_config" << 'EOF'
module.exports = {
  apps: [{
    name: 'airis-mon',
    script: 'src/app.js',
    cwd: './clickstack-architecture/test-suite',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3100
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3100,
      LOG_LEVEL: 'info'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 8000,
    shutdown_with_message: true,
    source_map_support: true,
    instance_var: 'INSTANCE_ID',
    merge_logs: true,
    log_type: 'json'
  }],

  deploy: {
    production: {
      user: 'airis',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/your-org/airis-mon.git',
      path: '/opt/airis-mon',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm ci --only=production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt-get update && apt-get install -y git'
    }
  }
};
EOF
    
    log_success "PM2 설정 파일 생성 완료"
}

# =============================================================================
# 서비스 관리 함수 (PM2 기반)
# =============================================================================

start_production_service() {
    log_info "프로덕션 서비스를 시작합니다..."
    
    # PM2 설정 파일 생성
    create_pm2_config
    
    cd "$PROJECT_ROOT"
    
    # PM2로 서비스 시작
    if pm2 list | grep -q "airis-mon"; then
        log_info "기존 서비스를 재시작합니다..."
        pm2 restart ecosystem.config.js --env production
    else
        log_info "새로운 서비스를 시작합니다..."
        pm2 start ecosystem.config.js --env production
    fi
    
    # PM2 저장 (재부팅 시 자동 시작)
    pm2 save
    pm2 startup
    
    # 서비스 상태 확인
    sleep 5
    if pm2 list | grep -q "online.*airis-mon"; then
        log_success "프로덕션 서비스가 성공적으로 시작되었습니다!"
        show_production_status
    else
        log_error "서비스 시작에 실패했습니다."
        pm2 logs airis-mon --lines 20
        return 1
    fi
}

stop_production_service() {
    log_info "프로덕션 서비스를 중지합니다..."
    
    if pm2 list | grep -q "airis-mon"; then
        pm2 stop airis-mon
        pm2 delete airis-mon
        log_success "프로덕션 서비스가 중지되었습니다."
    else
        log_warn "실행 중인 서비스가 없습니다."
    fi
}

restart_production_service() {
    log_info "프로덕션 서비스를 재시작합니다..."
    
    if pm2 list | grep -q "airis-mon"; then
        pm2 restart airis-mon
        log_success "프로덕션 서비스가 재시작되었습니다."
    else
        log_warn "실행 중인 서비스가 없습니다. 새로 시작합니다..."
        start_production_service
    fi
}

reload_production_service() {
    log_info "프로덕션 서비스를 무중단 재로드합니다..."
    
    if pm2 list | grep -q "airis-mon"; then
        pm2 reload airis-mon
        log_success "프로덕션 서비스가 무중단 재로드되었습니다."
    else
        log_error "실행 중인 서비스가 없습니다."
        return 1
    fi
}

show_production_status() {
    echo -e "${WHITE}=== AIRIS-MON 프로덕션 서비스 상태 ===${NC}"
    echo
    
    if pm2 list | grep -q "airis-mon"; then
        pm2 describe airis-mon
        echo
        echo -e "${WHITE}=== 시스템 리소스 사용량 ===${NC}"
        pm2 monit --no-interaction 2>/dev/null || pm2 list
        echo
        echo -e "${WHITE}=== 접속 정보 ===${NC}"
        echo -e "🌐 메인 대시보드: ${CYAN}http://localhost:3100${NC}"
        echo -e "📊 시스템 설치: ${CYAN}http://localhost:3100/system-installation.html${NC}"
        echo -e "🎬 세션 리플레이: ${CYAN}http://localhost:3100/enhanced-recorder${NC}"
        echo -e "🐍 프로젝트 분석: ${CYAN}http://localhost:3100/project-analysis.html${NC}"
    else
        echo -e "${RED}서비스가 실행되지 않고 있습니다.${NC}"
    fi
    echo
}

show_production_logs() {
    local log_type="${1:-all}"
    
    case "$log_type" in
        "error")
            pm2 logs airis-mon --err --lines 50
            ;;
        "out")
            pm2 logs airis-mon --out --lines 50
            ;;
        "all"|*)
            pm2 logs airis-mon --lines 50
            ;;
    esac
}

# =============================================================================
# 백업 및 복구 함수
# =============================================================================

create_backup() {
    log_info "시스템 백업을 생성합니다..."
    
    local backup_name="airis-mon-backup-$(date '+%Y%m%d_%H%M%S')"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$backup_path"
    
    # 세션 데이터 백업
    if [[ -d "$TEST_SUITE_DIR/src/storage/sessions" ]]; then
        cp -r "$TEST_SUITE_DIR/src/storage/sessions" "$backup_path/"
        log_info "세션 데이터 백업 완료"
    fi
    
    # 분석 결과 백업
    if [[ -d "$TEST_SUITE_DIR/src/storage/analysis" ]]; then
        cp -r "$TEST_SUITE_DIR/src/storage/analysis" "$backup_path/"
        log_info "분석 결과 백업 완료"
    fi
    
    # 설정 파일 백업
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        cp "$PROJECT_ROOT/.env.production" "$backup_path/"
    fi
    
    if [[ -f "$PROJECT_ROOT/ecosystem.config.js" ]]; then
        cp "$PROJECT_ROOT/ecosystem.config.js" "$backup_path/"
    fi
    
    # 로그 파일 백업 (최근 7일)
    find "$LOG_DIR" -name "*.log" -mtime -7 -exec cp {} "$backup_path/" \;
    
    # 백업 파일 압축
    cd "$BACKUP_DIR"
    tar -czf "$backup_name.tar.gz" "$backup_name"
    rm -rf "$backup_path"
    
    log_success "백업 완료: $BACKUP_DIR/$backup_name.tar.gz"
    
    # 오래된 백업 정리 (30일 이상)
    find "$BACKUP_DIR" -name "airis-mon-backup-*.tar.gz" -mtime +30 -delete
}

restore_backup() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "백업 파일을 찾을 수 없습니다: $backup_file"
        return 1
    fi
    
    log_info "백업을 복원합니다: $backup_file"
    
    # 현재 데이터 백업
    log_info "현재 데이터를 임시 백업합니다..."
    create_backup
    
    # 백업 파일 압축 해제
    local temp_dir="$BACKUP_DIR/temp_restore"
    mkdir -p "$temp_dir"
    cd "$temp_dir"
    tar -xzf "$backup_file"
    
    local backup_dir=$(find . -maxdepth 1 -type d -name "airis-mon-backup-*" | head -1)
    
    if [[ -z "$backup_dir" ]]; then
        log_error "유효하지 않은 백업 파일입니다."
        rm -rf "$temp_dir"
        return 1
    fi
    
    # 서비스 중지
    stop_production_service
    
    # 데이터 복원
    if [[ -d "$backup_dir/sessions" ]]; then
        rm -rf "$TEST_SUITE_DIR/src/storage/sessions"
        cp -r "$backup_dir/sessions" "$TEST_SUITE_DIR/src/storage/"
        log_info "세션 데이터 복원 완료"
    fi
    
    if [[ -d "$backup_dir/analysis" ]]; then
        rm -rf "$TEST_SUITE_DIR/src/storage/analysis"
        cp -r "$backup_dir/analysis" "$TEST_SUITE_DIR/src/storage/"
        log_info "분석 결과 복원 완료"
    fi
    
    # 설정 파일 복원
    if [[ -f "$backup_dir/.env.production" ]]; then
        cp "$backup_dir/.env.production" "$PROJECT_ROOT/"
    fi
    
    if [[ -f "$backup_dir/ecosystem.config.js" ]]; then
        cp "$backup_dir/ecosystem.config.js" "$PROJECT_ROOT/"
    fi
    
    # 임시 디렉토리 정리
    rm -rf "$temp_dir"
    
    # 서비스 재시작
    start_production_service
    
    log_success "백업 복원 완료"
}

list_backups() {
    echo -e "${WHITE}=== 사용 가능한 백업 파일 ===${NC}"
    echo
    
    if ls "$BACKUP_DIR"/airis-mon-backup-*.tar.gz &>/dev/null; then
        ls -lh "$BACKUP_DIR"/airis-mon-backup-*.tar.gz | while read -r line; do
            echo -e "${CYAN}$line${NC}"
        done
    else
        echo -e "${YELLOW}백업 파일이 없습니다.${NC}"
    fi
    echo
}

# =============================================================================
# 모니터링 및 성능 함수
# =============================================================================

setup_monitoring() {
    log_info "모니터링 시스템을 설정합니다..."
    
    # PM2 모니터링 설정
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 100M
    pm2 set pm2-logrotate:retain 10
    pm2 set pm2-logrotate:compress true
    
    # 시스템 모니터링 스크립트 생성
    cat > "$PROJECT_ROOT/scripts/health-check.sh" << 'EOF'
#!/bin/bash

LOG_FILE="/opt/airis-mon/logs/health-check.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# 서비스 상태 확인
if pm2 list | grep -q "online.*airis-mon"; then
    echo "$DATE [OK] Service is running" >> "$LOG_FILE"
    
    # 메모리 사용량 확인
    MEMORY_USAGE=$(pm2 show airis-mon | grep "memory usage" | awk '{print $4}' | tr -d 'M')
    if [[ $MEMORY_USAGE -gt 1024 ]]; then
        echo "$DATE [WARN] High memory usage: ${MEMORY_USAGE}MB" >> "$LOG_FILE"
    fi
    
    # CPU 사용량 확인
    CPU_USAGE=$(pm2 show airis-mon | grep "cpu usage" | awk '{print $4}' | tr -d '%')
    if [[ $CPU_USAGE -gt 80 ]]; then
        echo "$DATE [WARN] High CPU usage: ${CPU_USAGE}%" >> "$LOG_FILE"
    fi
    
    # HTTP 응답 확인
    if ! curl -f -s -o /dev/null http://localhost:3100/; then
        echo "$DATE [ERROR] HTTP health check failed" >> "$LOG_FILE"
    fi
else
    echo "$DATE [ERROR] Service is not running" >> "$LOG_FILE"
fi
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/health-check.sh"
    
    # cron 작업 추가 (5분마다 헬스체크)
    (crontab -l 2>/dev/null; echo "*/5 * * * * $PROJECT_ROOT/scripts/health-check.sh") | crontab -
    
    log_success "모니터링 시스템 설정 완료"
}

show_performance_metrics() {
    echo -e "${WHITE}=== AIRIS-MON 성능 지표 ===${NC}"
    echo
    
    if pm2 list | grep -q "airis-mon"; then
        # PM2 메트릭스
        echo -e "${YELLOW}PM2 프로세스 정보:${NC}"
        pm2 describe airis-mon | grep -E "(pid|memory|cpu|uptime|restarts)" || true
        echo
        
        # 시스템 리소스
        echo -e "${YELLOW}시스템 리소스:${NC}"
        echo -e "메모리 사용량: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
        echo -e "디스크 사용량: $(df -h $PROJECT_ROOT | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
        echo -e "로드 평균: $(uptime | awk -F'load average:' '{print $2}')"
        echo
        
        # 네트워크 연결
        echo -e "${YELLOW}네트워크 연결:${NC}"
        netstat -tln | grep ':3100' || echo "포트 3100에서 수신 대기 중이지 않습니다."
        echo
        
        # 로그 요약
        echo -e "${YELLOW}최근 로그 요약:${NC}"
        if [[ -f "$LOG_DIR/pm2-combined.log" ]]; then
            tail -n 5 "$LOG_DIR/pm2-combined.log"
        else
            echo "로그 파일이 없습니다."
        fi
    else
        echo -e "${RED}서비스가 실행되지 않고 있습니다.${NC}"
    fi
    echo
}

# =============================================================================
# 배포 및 업데이트 함수
# =============================================================================

deploy_update() {
    local git_ref="${1:-main}"
    
    log_info "프로덕션 업데이트를 배포합니다... (브랜치: $git_ref)"
    
    # 백업 생성
    create_backup
    
    # Git 업데이트
    cd "$PROJECT_ROOT"
    
    if [[ -d ".git" ]]; then
        log_info "Git 저장소를 업데이트합니다..."
        git fetch --all
        git checkout "$git_ref"
        git pull origin "$git_ref"
    else
        log_warn "Git 저장소가 아닙니다. 수동 배포를 진행하세요."
        return 1
    fi
    
    # 의존성 업데이트
    cd "$TEST_SUITE_DIR"
    npm ci --only=production
    
    # 무중단 재배포
    if pm2 list | grep -q "airis-mon"; then
        log_info "무중단 재배포를 수행합니다..."
        pm2 reload airis-mon
    else
        log_info "새로운 배포를 시작합니다..."
        start_production_service
    fi
    
    # 배포 확인
    sleep 10
    if curl -f -s -o /dev/null http://localhost:3100/; then
        log_success "배포가 성공적으로 완료되었습니다!"
    else
        log_error "배포 검증에 실패했습니다. 롤백을 고려하세요."
        return 1
    fi
}

rollback_deployment() {
    log_info "이전 버전으로 롤백합니다..."
    
    # 최신 백업 찾기
    local latest_backup=$(ls -t "$BACKUP_DIR"/airis-mon-backup-*.tar.gz 2>/dev/null | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        log_error "롤백할 백업이 없습니다."
        return 1
    fi
    
    log_info "백업을 사용하여 롤백합니다: $latest_backup"
    restore_backup "$latest_backup"
    
    log_success "롤백이 완료되었습니다."
}

# =============================================================================
# 헬프 함수
# =============================================================================

show_production_help() {
    echo -e "${WHITE}AIRIS-MON 프로덕션 환경 스크립트${NC}"
    echo
    echo -e "${YELLOW}사용법:${NC}"
    echo -e "  $0 <command> [options]"
    echo
    echo -e "${YELLOW}서비스 관리:${NC}"
    echo -e "  ${GREEN}start${NC}        프로덕션 서비스 시작 (PM2)"
    echo -e "  ${GREEN}stop${NC}         프로덕션 서비스 중지"
    echo -e "  ${GREEN}restart${NC}      프로덕션 서비스 재시작"
    echo -e "  ${GREEN}reload${NC}       무중단 재로드"
    echo -e "  ${GREEN}status${NC}       서비스 상태 확인"
    echo -e "  ${GREEN}logs${NC}         로그 보기 [error|out|all]"
    echo
    echo -e "${YELLOW}백업 및 복구:${NC}"
    echo -e "  ${GREEN}backup${NC}       시스템 백업 생성"
    echo -e "  ${GREEN}restore${NC}      백업 복원 <backup-file>"
    echo -e "  ${GREEN}list-backups${NC} 백업 파일 목록"
    echo
    echo -e "${YELLOW}배포 및 업데이트:${NC}"
    echo -e "  ${GREEN}deploy${NC}       프로덕션 배포 [branch]"
    echo -e "  ${GREEN}rollback${NC}     이전 버전으로 롤백"
    echo
    echo -e "${YELLOW}모니터링:${NC}"
    echo -e "  ${GREEN}monitor${NC}      모니터링 설정"
    echo -e "  ${GREEN}metrics${NC}      성능 지표 보기"
    echo -e "  ${GREEN}health${NC}       헬스체크 실행"
    echo
    echo -e "${YELLOW}환경 관리:${NC}"
    echo -e "  ${GREEN}setup${NC}        프로덕션 환경 설정"
    echo -e "  ${GREEN}deps${NC}         프로덕션 의존성 설치"
    echo
    echo -e "${YELLOW}예시:${NC}"
    echo -e "  $0 start          # 프로덕션 서비스 시작"
    echo -e "  $0 backup         # 백업 생성"
    echo -e "  $0 deploy main    # main 브랜치 배포"
    echo -e "  $0 logs error     # 에러 로그만 보기"
    echo
}

# =============================================================================
# 메인 실행 로직
# =============================================================================

main() {
    local command="${1:-help}"
    local option="${2:-}"
    
    # 루트 권한 확인 (일부 명령어)
    if [[ "$command" =~ ^(setup|monitor)$ ]] && [[ $EUID -ne 0 ]]; then
        log_error "이 명령어는 root 권한이 필요합니다. sudo를 사용하세요."
        exit 1
    fi
    
    # 배너 출력
    if [[ "$command" != "help" ]]; then
        print_prod_banner
    fi
    
    case "$command" in
        "start")
            setup_production_environment
            install_production_dependencies
            start_production_service
            ;;
        "stop")
            stop_production_service
            ;;
        "restart")
            restart_production_service
            ;;
        "reload")
            reload_production_service
            ;;
        "status")
            show_production_status
            ;;
        "logs")
            show_production_logs "$option"
            ;;
        "backup")
            create_backup
            ;;
        "restore")
            if [[ -z "$option" ]]; then
                log_error "백업 파일을 지정해주세요."
                list_backups
                exit 1
            fi
            restore_backup "$option"
            ;;
        "list-backups")
            list_backups
            ;;
        "deploy")
            deploy_update "$option"
            ;;
        "rollback")
            rollback_deployment
            ;;
        "monitor")
            setup_monitoring
            ;;
        "metrics")
            show_performance_metrics
            ;;
        "health")
            "$PROJECT_ROOT/scripts/health-check.sh"
            ;;
        "setup")
            setup_production_environment
            ;;
        "deps")
            install_production_dependencies
            ;;
        "help"|"-h"|"--help")
            show_production_help
            ;;
        *)
            log_error "알 수 없는 명령어: $command"
            echo
            show_production_help
            exit 1
            ;;
    esac
}

# 스크립트가 직접 실행되었을 때만 main 함수 호출
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi