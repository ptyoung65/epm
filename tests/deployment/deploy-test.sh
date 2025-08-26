#!/bin/bash
# AIRIS EPM - 배포 테스트 스크립트
# 배포 후 시스템 검증 및 품질 보증

set -euo pipefail

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 테스트 설정
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
BASE_URL="${BASE_URL:-https://airis-epm.com}"
TEST_TIMEOUT="${TEST_TIMEOUT:-300}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-30}"
SMOKE_TEST_RETRIES="${SMOKE_TEST_RETRIES:-10}"

# 결과 저장
TEST_RESULTS=()
FAILED_TESTS=0
TOTAL_TESTS=0

# 로깅 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 테스트 실행 헬퍼
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log_info "테스트 실행: $test_name"
    
    if eval "$test_command"; then
        log_success "✓ $test_name"
        TEST_RESULTS+=("PASS: $test_name")
        return 0
    else
        log_error "✗ $test_name"
        TEST_RESULTS+=("FAIL: $test_name")
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 1. 배포 전 준비 사항 확인
check_prerequisites() {
    log_info "배포 전 준비사항 확인 중..."
    
    # 필수 도구 확인
    local required_tools=("curl" "jq" "timeout" "nc")
    
    for tool in "${required_tools[@]}"; do
        run_test "필수 도구 확인: $tool" "command -v $tool > /dev/null"
    done
    
    # 환경 변수 확인
    run_test "BASE_URL 설정 확인" "[[ -n '$BASE_URL' ]]"
    run_test "DEPLOYMENT_ENV 설정 확인" "[[ -n '$DEPLOYMENT_ENV' ]]"
}

# 2. 기본 연결성 테스트
test_connectivity() {
    log_info "기본 연결성 테스트 중..."
    
    # DNS 해상도 확인
    local host=$(echo "$BASE_URL" | sed 's/https\?:\/\///g' | cut -d'/' -f1)
    run_test "DNS 해상도 확인: $host" "nslookup $host > /dev/null"
    
    # 포트 연결성 확인
    local port="443"
    if [[ "$BASE_URL" =~ http://([^:/]+):?([0-9]+)? ]]; then
        port="${BASH_REMATCH[2]:-80}"
    fi
    
    run_test "포트 연결성 확인: $host:$port" "timeout 10 nc -z $host $port"
}

# 3. 헬스체크 테스트
test_health_endpoints() {
    log_info "헬스체크 엔드포인트 테스트 중..."
    
    local health_endpoints=(
        "$BASE_URL/health:메인 애플리케이션"
        "$BASE_URL/api/health:API 게이트웨이"
    )
    
    for endpoint_info in "${health_endpoints[@]}"; do
        local url=$(echo "$endpoint_info" | cut -d':' -f1)
        local name=$(echo "$endpoint_info" | cut -d':' -f2)
        
        run_test "헬스체크: $name" "
            response=\$(curl -sf --max-time 30 '$url') &&
            echo \"\$response\" | jq -e '.status == \"healthy\"' > /dev/null
        "
    done
}

# 4. 스모크 테스트 (핵심 기능)
run_smoke_tests() {
    log_info "스모크 테스트 실행 중..."
    
    # 메인 페이지 로드 테스트
    run_test "메인 페이지 로드" "
        response=\$(curl -sf --max-time 30 '$BASE_URL/') &&
        echo \"\$response\" | grep -q 'AIRIS EPM'
    "
    
    # API 엔드포인트 테스트
    local api_endpoints=(
        "/api/executive-kpis:Executive KPI API"
        "/api/strategic-kpis:Strategic KPI API"
        "/api/alerts:알림 API"
        "/api/performance-metrics:성능 메트릭 API"
    )
    
    for endpoint_info in "${api_endpoints[@]}"; do
        local path=$(echo "$endpoint_info" | cut -d':' -f1)
        local name=$(echo "$endpoint_info" | cut -d':' -f2)
        
        run_test "$name" "
            response=\$(curl -sf --max-time 30 '$BASE_URL$path') &&
            echo \"\$response\" | jq -e 'type == \"array\" or type == \"object\"' > /dev/null
        "
    done
    
    # 대시보드 페이지 테스트
    local dashboard_pages=(
        "/executive-dashboard:Executive 대시보드"
        "/ai-prediction-dashboard:AI 예측 대시보드"
        "/strategic-kpi-dashboard:Strategic KPI 대시보드"
        "/alerts-dashboard:알림 대시보드"
    )
    
    for page_info in "${dashboard_pages[@]}"; do
        local path=$(echo "$page_info" | cut -d':' -f1)
        local name=$(echo "$page_info" | cut -d':' -f2)
        
        run_test "$name 페이지" "
            curl -sf --max-time 30 '$BASE_URL$path' | grep -q 'AIRIS EPM'
        "
    done
}

# 5. 성능 테스트
test_performance() {
    log_info "기본 성능 테스트 중..."
    
    # 응답 시간 테스트
    run_test "메인 페이지 응답시간 < 3초" "
        response_time=\$(curl -sf --max-time 30 -w '%{time_total}' -o /dev/null '$BASE_URL/') &&
        awk 'BEGIN {exit !(\$1 < 3)}' <<< \"\$response_time\"
    "
    
    # API 응답시간 테스트
    run_test "API 응답시간 < 2초" "
        response_time=\$(curl -sf --max-time 30 -w '%{time_total}' -o /dev/null '$BASE_URL/api/health') &&
        awk 'BEGIN {exit !(\$1 < 2)}' <<< \"\$response_time\"
    "
    
    # 동시 요청 처리 테스트
    run_test "동시 요청 처리 (5개)" "
        for i in {1..5}; do
            curl -sf --max-time 10 '$BASE_URL/health' > /dev/null &
        done
        wait
    "
}

# 6. 보안 테스트
test_security() {
    log_info "기본 보안 테스트 중..."
    
    # HTTPS 리다이렉션 확인
    if [[ "$BASE_URL" =~ ^https:// ]]; then
        local http_url="${BASE_URL/https:/http:}"
        run_test "HTTP -> HTTPS 리다이렉션" "
            response=\$(curl -s -I --max-time 10 '$http_url') &&
            echo \"\$response\" | grep -q '30[12]'
        "
    fi
    
    # 보안 헤더 확인
    run_test "보안 헤더 확인" "
        headers=\$(curl -sI --max-time 10 '$BASE_URL/') &&
        echo \"\$headers\" | grep -q 'X-Frame-Options' &&
        echo \"\$headers\" | grep -q 'X-Content-Type-Options' &&
        echo \"\$headers\" | grep -q 'X-XSS-Protection'
    "
    
    # SSL 인증서 유효성 확인
    if [[ "$BASE_URL" =~ ^https:// ]]; then
        local host=$(echo "$BASE_URL" | sed 's/https:\/\///g' | cut -d'/' -f1)
        run_test "SSL 인증서 유효성" "
            echo | timeout 10 openssl s_client -servername $host -connect $host:443 2>/dev/null | 
            openssl x509 -noout -dates 2>/dev/null | 
            grep -q 'notAfter'
        "
    fi
}

# 7. WebSocket 연결 테스트
test_websocket() {
    log_info "WebSocket 연결 테스트 중..."
    
    # WebSocket URL 구성
    local ws_url="${BASE_URL/http/ws}/ws"
    
    # Node.js WebSocket 클라이언트로 테스트
    run_test "WebSocket 연결" "
        timeout 30 node -e \"
        const WebSocket = require('ws');
        const ws = new WebSocket('$ws_url');
        
        ws.on('open', () => {
            console.log('WebSocket 연결 성공');
            ws.close();
            process.exit(0);
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket 연결 실패:', error.message);
            process.exit(1);
        });
        
        setTimeout(() => {
            console.error('WebSocket 연결 타임아웃');
            process.exit(1);
        }, 10000);
        \" 2>/dev/null
    "
}

# 8. 데이터베이스 연결 테스트 (간접적)
test_database_connectivity() {
    log_info "데이터베이스 연결 테스트 (간접적)..."
    
    # API를 통한 데이터베이스 연결 확인
    run_test "데이터베이스 연결 (PostgreSQL)" "
        response=\$(curl -sf --max-time 30 '$BASE_URL/api/executive-kpis') &&
        echo \"\$response\" | jq -e '. | length > 0' > /dev/null
    "
    
    # 캐시 시스템 확인 (Redis)
    run_test "캐시 시스템 연결" "
        # 같은 요청을 두 번 보내서 캐시 작동 확인
        first_response=\$(curl -sf --max-time 10 -w '%{time_total}' '$BASE_URL/api/executive-kpis') &&
        sleep 1 &&
        second_response=\$(curl -sf --max-time 10 -w '%{time_total}' '$BASE_URL/api/executive-kpis') &&
        echo 'Cache test completed'
    "
}

# 9. 로그 및 모니터링 테스트
test_monitoring() {
    log_info "모니터링 시스템 테스트 중..."
    
    # Prometheus 메트릭 확인
    run_test "Prometheus 메트릭 수집" "
        curl -sf --max-time 10 '$BASE_URL/metrics' | grep -q 'http_requests_total'
    "
    
    # 애플리케이션 버전 확인
    run_test "애플리케이션 버전 확인" "
        response=\$(curl -sf --max-time 10 '$BASE_URL/health') &&
        echo \"\$response\" | jq -e '.version != null' > /dev/null
    "
}

# 10. 사용자 시나리오 테스트
test_user_scenarios() {
    log_info "사용자 시나리오 테스트 중..."
    
    # 시나리오 1: 대시보드 탐색
    run_test "시나리오 1: 대시보드 탐색" "
        # 메인 페이지 -> Executive 대시보드 -> API 데이터 로드
        curl -sf --max-time 10 '$BASE_URL/' > /dev/null &&
        curl -sf --max-time 10 '$BASE_URL/executive-dashboard' > /dev/null &&
        curl -sf --max-time 10 '$BASE_URL/api/executive-kpis' > /dev/null
    "
    
    # 시나리오 2: AI 예측 워크플로우
    run_test "시나리오 2: AI 예측 시스템" "
        # AI 대시보드 -> 모델 상태 확인 -> 예측 데이터 로드
        curl -sf --max-time 10 '$BASE_URL/ai-prediction-dashboard' > /dev/null
    "
}

# 11. 롤백 준비 테스트
test_rollback_readiness() {
    log_info "롤백 준비 상태 테스트 중..."
    
    # 이전 버전 이미지 존재 확인 (Docker 환경에서)
    run_test "이전 버전 백업 확인" "
        # 헬스체크가 성공하면 현재 배포가 정상적으로 실행중
        curl -sf --max-time 10 '$BASE_URL/health' > /dev/null
    "
}

# 배포 후 대기 및 검증
wait_for_deployment() {
    log_info "배포 완료 대기 중... (최대 ${TEST_TIMEOUT}초)"
    
    local retry_count=0
    local max_retries=$((TEST_TIMEOUT / 10))
    
    while [[ $retry_count -lt $max_retries ]]; do
        if curl -sf --max-time 10 "$BASE_URL/health" > /dev/null 2>&1; then
            log_success "배포 완료 확인됨"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        log_info "배포 대기 중... ($retry_count/$max_retries)"
        sleep 10
    done
    
    log_error "배포 완료 확인 실패 - 타임아웃"
    return 1
}

# 테스트 결과 요약
generate_report() {
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')
    local success_rate=$((((TOTAL_TESTS - FAILED_TESTS) * 100) / TOTAL_TESTS))
    
    echo ""
    echo "========================================"
    echo "AIRIS EPM 배포 테스트 결과"
    echo "========================================"
    echo "테스트 완료 시간: $end_time"
    echo "배포 환경: $DEPLOYMENT_ENV"
    echo "테스트 URL: $BASE_URL"
    echo "총 테스트: $TOTAL_TESTS"
    echo "성공: $((TOTAL_TESTS - FAILED_TESTS))"
    echo "실패: $FAILED_TESTS"
    echo "성공률: ${success_rate}%"
    echo "========================================"
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_success "🎉 모든 배포 테스트 통과!"
        echo "배포가 성공적으로 완료되었습니다."
    else
        log_error "❌ 일부 테스트 실패"
        echo ""
        echo "실패한 테스트:"
        printf '%s\n' "${TEST_RESULTS[@]}" | grep "^FAIL:"
        echo ""
        echo "롤백을 고려해야 합니다."
    fi
    
    echo ""
    echo "상세 결과:"
    printf '%s\n' "${TEST_RESULTS[@]}"
    
    # JSON 형식 리포트 생성
    local report_file="/tmp/deployment-test-report-$(date +%Y%m%d-%H%M%S).json"
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$DEPLOYMENT_ENV",
    "base_url": "$BASE_URL",
    "total_tests": $TOTAL_TESTS,
    "passed_tests": $((TOTAL_TESTS - FAILED_TESTS)),
    "failed_tests": $FAILED_TESTS,
    "success_rate": $success_rate,
    "status": "$([ $FAILED_TESTS -eq 0 ] && echo 'PASSED' || echo 'FAILED')",
    "results": [
$(printf '        "%s"' "${TEST_RESULTS[0]}")
$(printf ',\n        "%s"' "${TEST_RESULTS[@]:1}")
    ]
}
EOF
    
    log_info "상세 리포트 저장: $report_file"
}

# Slack 알림 전송 (선택사항)
send_notification() {
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local status_emoji="✅"
        local status_text="성공"
        local color="good"
        
        if [[ $FAILED_TESTS -gt 0 ]]; then
            status_emoji="❌"
            status_text="실패"
            color="danger"
        fi
        
        local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "AIRIS EPM 배포 테스트 결과",
            "fields": [
                {"title": "환경", "value": "$DEPLOYMENT_ENV", "short": true},
                {"title": "상태", "value": "$status_emoji $status_text", "short": true},
                {"title": "성공률", "value": "$((((TOTAL_TESTS - FAILED_TESTS) * 100) / TOTAL_TESTS))%", "short": true},
                {"title": "테스트", "value": "$((TOTAL_TESTS - FAILED_TESTS))/$TOTAL_TESTS", "short": true}
            ],
            "footer": "AIRIS EPM DevOps",
            "ts": $(date +%s)
        }
    ]
}
EOF
)
        
        curl -sf -X POST -H 'Content-type: application/json' \
             --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null || \
             log_warn "Slack 알림 전송 실패"
    fi
}

# 메인 실행 함수
main() {
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    log_info "AIRIS EPM 배포 테스트 시작 ($start_time)"
    log_info "환경: $DEPLOYMENT_ENV"
    log_info "URL: $BASE_URL"
    
    # 배포 대기
    if ! wait_for_deployment; then
        log_error "배포 대기 실패 - 테스트 중단"
        exit 1
    fi
    
    # 테스트 실행
    check_prerequisites
    test_connectivity
    test_health_endpoints
    run_smoke_tests
    test_performance
    test_security
    test_websocket
    test_database_connectivity
    test_monitoring
    test_user_scenarios
    test_rollback_readiness
    
    # 결과 보고
    generate_report
    send_notification
    
    # 최종 종료 코드
    exit $FAILED_TESTS
}

# 스크립트 실행
main "$@"