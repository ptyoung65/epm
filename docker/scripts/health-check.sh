#!/bin/bash
# AIRIS EPM - 헬스체크 스크립트
# Docker 컨테이너의 헬스체크를 위한 종합 검사

set -euo pipefail

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 헬스체크 결과 저장
HEALTH_STATUS="healthy"
HEALTH_DETAILS=()

# 로깅 함수
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> /app/logs/health-check.log
}

add_detail() {
    HEALTH_DETAILS+=("$1")
    log "$1"
}

# 서비스 포트 확인
check_service_ports() {
    local services=(
        "3002:Dashboard"
        "3300:Realtime Hub" 
        "3500:AI Prediction"
    )
    
    for service in "${services[@]}"; do
        local port=$(echo $service | cut -d':' -f1)
        local name=$(echo $service | cut -d':' -f2)
        
        if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            add_detail "✓ $name (포트 $port) - 리스닝 중"
        else
            HEALTH_STATUS="unhealthy"
            add_detail "✗ $name (포트 $port) - 리스닝 없음"
        fi
    done
}

# HTTP 엔드포인트 헬스체크
check_http_endpoints() {
    local endpoints=(
        "http://localhost:3002/health:Dashboard"
        "http://localhost:3300/health:Realtime Hub"
        "http://localhost:3500/health:AI Prediction"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local url=$(echo $endpoint | cut -d':' -f1-2)
        local name=$(echo $endpoint | cut -d':' -f3)
        
        if curl -sf --max-time 10 "$url" > /dev/null 2>&1; then
            # 응답 시간 측정
            local response_time=$(curl -sf --max-time 10 -w "%{time_total}" -o /dev/null "$url" 2>/dev/null || echo "timeout")
            if [[ "$response_time" != "timeout" ]] && (( $(echo "$response_time < 2.0" | bc -l) )); then
                add_detail "✓ $name HTTP - 응답 정상 (${response_time}s)"
            else
                HEALTH_STATUS="degraded"
                add_detail "⚠ $name HTTP - 응답 느림 (${response_time}s)"
            fi
        else
            HEALTH_STATUS="unhealthy"
            add_detail "✗ $name HTTP - 응답 없음"
        fi
    done
}

# WebSocket 연결 테스트
check_websocket() {
    # Node.js 스크립트를 사용한 WebSocket 테스트
    cat > /tmp/websocket_test.js << 'EOF'
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3300');

ws.on('open', () => {
    console.log('WebSocket connection successful');
    ws.close();
    process.exit(0);
});

ws.on('error', (error) => {
    console.error('WebSocket connection failed:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    process.exit(0);
});

// 타임아웃 설정
setTimeout(() => {
    console.error('WebSocket connection timeout');
    ws.close();
    process.exit(1);
}, 5000);
EOF

    if timeout 10 node /tmp/websocket_test.js > /dev/null 2>&1; then
        add_detail "✓ WebSocket - 연결 정상"
    else
        HEALTH_STATUS="degraded"
        add_detail "⚠ WebSocket - 연결 실패"
    fi
    
    rm -f /tmp/websocket_test.js
}

# 메모리 사용량 확인
check_memory_usage() {
    local memory_info=$(cat /proc/meminfo)
    local mem_total=$(echo "$memory_info" | grep MemTotal | awk '{print $2}')
    local mem_available=$(echo "$memory_info" | grep MemAvailable | awk '{print $2}')
    
    local mem_used=$((mem_total - mem_available))
    local mem_usage_percent=$((mem_used * 100 / mem_total))
    
    if [[ $mem_usage_percent -lt 80 ]]; then
        add_detail "✓ 메모리 사용률 - ${mem_usage_percent}% (정상)"
    elif [[ $mem_usage_percent -lt 90 ]]; then
        HEALTH_STATUS="degraded"
        add_detail "⚠ 메모리 사용률 - ${mem_usage_percent}% (주의)"
    else
        HEALTH_STATUS="unhealthy"
        add_detail "✗ 메모리 사용률 - ${mem_usage_percent}% (위험)"
    fi
}

# CPU 사용률 확인
check_cpu_usage() {
    # 1초 간격으로 2번 측정하여 평균 CPU 사용률 계산
    local cpu_usage=$(top -bn2 -d1 | grep "Cpu(s)" | tail -1 | awk '{print $2}' | sed 's/%us,//')
    
    # CPU 사용률을 정수로 변환
    cpu_usage=${cpu_usage%.*}
    
    if [[ $cpu_usage -lt 70 ]]; then
        add_detail "✓ CPU 사용률 - ${cpu_usage}% (정상)"
    elif [[ $cpu_usage -lt 85 ]]; then
        HEALTH_STATUS="degraded"
        add_detail "⚠ CPU 사용률 - ${cpu_usage}% (주의)"
    else
        HEALTH_STATUS="unhealthy"
        add_detail "✗ CPU 사용률 - ${cpu_usage}% (위험)"
    fi
}

# 디스크 사용량 확인
check_disk_usage() {
    local disk_usage=$(df /app | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [[ $disk_usage -lt 80 ]]; then
        add_detail "✓ 디스크 사용률 - ${disk_usage}% (정상)"
    elif [[ $disk_usage -lt 90 ]]; then
        HEALTH_STATUS="degraded"  
        add_detail "⚠ 디스크 사용률 - ${disk_usage}% (주의)"
    else
        HEALTH_STATUS="unhealthy"
        add_detail "✗ 디스크 사용률 - ${disk_usage}% (위험)"
    fi
}

# 프로세스 상태 확인
check_processes() {
    if command -v pm2 > /dev/null; then
        # PM2 사용 시
        local pm2_status=$(pm2 jlist 2>/dev/null | jq -r '.[].pm2_env.status' 2>/dev/null || echo "error")
        if [[ "$pm2_status" == "online" ]] || echo "$pm2_status" | grep -q "online"; then
            add_detail "✓ PM2 프로세스 - 정상 실행 중"
        else
            HEALTH_STATUS="unhealthy"
            add_detail "✗ PM2 프로세스 - 비정상 상태"
        fi
    else
        # PID 파일 확인
        local pid_files=(
            "/app/tmp/dashboard.pid:Dashboard"
            "/app/tmp/realtime-hub.pid:Realtime Hub"
            "/app/tmp/ai-prediction.pid:AI Prediction"
        )
        
        for pid_file in "${pid_files[@]}"; do
            local file=$(echo $pid_file | cut -d':' -f1)
            local name=$(echo $pid_file | cut -d':' -f2)
            
            if [[ -f "$file" ]]; then
                local pid=$(cat "$file")
                if kill -0 "$pid" 2>/dev/null; then
                    add_detail "✓ $name 프로세스 - 실행 중 (PID: $pid)"
                else
                    HEALTH_STATUS="unhealthy"
                    add_detail "✗ $name 프로세스 - 종료됨 (PID: $pid)"
                fi
            else
                HEALTH_STATUS="unhealthy" 
                add_detail "✗ $name 프로세스 - PID 파일 없음"
            fi
        done
    fi
}

# 로그 파일 확인
check_log_files() {
    local log_files=(
        "/app/logs/dashboard.log"
        "/app/logs/realtime-hub.log"
        "/app/logs/ai-prediction.log"
    )
    
    for log_file in "${log_files[@]}"; do
        if [[ -f "$log_file" ]]; then
            # 최근 5분간 에러 로그 확인
            local error_count=$(grep -c -i "error\|exception\|fail" "$log_file" 2>/dev/null | tail -100 | wc -l || echo 0)
            
            if [[ $error_count -gt 10 ]]; then
                HEALTH_STATUS="degraded"
                add_detail "⚠ 로그 에러 발견 - $log_file ($error_count 개)"
            else
                add_detail "✓ 로그 파일 정상 - $(basename $log_file)"
            fi
        else
            add_detail "⚠ 로그 파일 없음 - $log_file"
        fi
    done
}

# 외부 의존성 연결 확인
check_external_dependencies() {
    local dependencies=(
        "${REDIS_URL:-redis://localhost:6379}:Redis"
        "${POSTGRES_URL:-postgresql://localhost:5432}:PostgreSQL"
        "${MONGODB_URL:-mongodb://localhost:27017}:MongoDB"
        "${CLICKHOUSE_URL:-http://localhost:8123}:ClickHouse"
    )
    
    for dependency in "${dependencies[@]}"; do
        local url=$(echo $dependency | cut -d':' -f1-2)
        local name=$(echo $dependency | cut -d':' -f3)
        
        # URL에서 호스트와 포트 추출
        local host_port=""
        if [[ "$url" =~ redis://([^:/]+):?([0-9]+)? ]]; then
            host_port="${BASH_REMATCH[1]}:${BASH_REMATCH[2]:-6379}"
        elif [[ "$url" =~ postgresql://[^@]+@([^:/]+):?([0-9]+)? ]]; then
            host_port="${BASH_REMATCH[1]}:${BASH_REMATCH[2]:-5432}"
        elif [[ "$url" =~ mongodb://([^:/]+):?([0-9]+)? ]]; then
            host_port="${BASH_REMATCH[1]}:${BASH_REMATCH[2]:-27017}"
        elif [[ "$url" =~ http://([^:/]+):?([0-9]+)? ]]; then
            host_port="${BASH_REMATCH[1]}:${BASH_REMATCH[2]:-8123}"
        fi
        
        if [[ -n "$host_port" ]]; then
            local host=$(echo $host_port | cut -d':' -f1)
            local port=$(echo $host_port | cut -d':' -f2)
            
            if nc -z "$host" "$port" 2>/dev/null; then
                add_detail "✓ $name - 연결 가능 ($host:$port)"
            else
                HEALTH_STATUS="degraded"
                add_detail "⚠ $name - 연결 실패 ($host:$port)"
            fi
        else
            add_detail "⚠ $name - URL 형식 불명 ($url)"
        fi
    done
}

# 전체 헬스체크 실행
run_health_check() {
    log "헬스체크 시작"
    
    # 각 항목별 헬스체크 실행
    check_service_ports
    check_http_endpoints
    check_websocket
    check_memory_usage
    check_cpu_usage
    check_disk_usage
    check_processes
    check_log_files
    check_external_dependencies
    
    log "헬스체크 완료 - 상태: $HEALTH_STATUS"
}

# 결과 출력
output_result() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    # JSON 형식으로 결과 생성
    local result_json=$(cat <<EOF
{
    "status": "$HEALTH_STATUS",
    "timestamp": "$timestamp",
    "uptime": $(cat /proc/uptime | cut -d' ' -f1),
    "details": [
$(printf '        "%s"' "${HEALTH_DETAILS[0]}")
$(printf ',\n        "%s"' "${HEALTH_DETAILS[@]:1}")
    ]
}
EOF
)
    
    # 콘솔 출력 (Docker 헬스체크용)
    case "$HEALTH_STATUS" in
        "healthy")
            echo -e "${GREEN}✓ HEALTHY${NC}"
            ;;
        "degraded")
            echo -e "${YELLOW}⚠ DEGRADED${NC}"
            ;;
        "unhealthy")
            echo -e "${RED}✗ UNHEALTHY${NC}"
            ;;
    esac
    
    # 상세 정보 출력 (verbose 모드)
    if [[ "${1:-}" == "-v" ]] || [[ "${1:-}" == "--verbose" ]]; then
        echo "헬스체크 상세 결과:"
        printf '%s\n' "${HEALTH_DETAILS[@]}"
        echo ""
        echo "JSON 결과:"
        echo "$result_json" | jq . 2>/dev/null || echo "$result_json"
    fi
    
    # 결과를 파일에 저장
    echo "$result_json" > /app/tmp/health-status.json
    
    # 상태에 따라 exit code 설정
    case "$HEALTH_STATUS" in
        "healthy") exit 0 ;;
        "degraded") exit 0 ;;  # Docker에서는 degraded도 정상으로 처리
        "unhealthy") exit 1 ;;
    esac
}

# 메인 실행
main() {
    # 필수 도구 확인
    if ! command -v curl > /dev/null; then
        echo "curl이 설치되지 않음"
        exit 1
    fi
    
    if ! command -v nc > /dev/null; then
        echo "netcat이 설치되지 않음"
        exit 1
    fi
    
    # 헬스체크 실행
    run_health_check
    
    # 결과 출력
    output_result "$@"
}

# 스크립트 실행
main "$@"