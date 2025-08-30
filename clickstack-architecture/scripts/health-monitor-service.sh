#!/bin/bash

# AIRIS EPM Health Monitor Service
# Continuously monitors container health and provides automated recovery

set -euo pipefail

# Configuration
LOG_FILE="/tmp/airis-health-monitor.log"
PID_FILE="/tmp/airis-health-monitor.pid"
CHECK_INTERVAL=30
COMPOSE_DIR="/home/ptyoung/work/AIRIS_APM/clickstack-architecture"
COMPOSE_FILE="docker-compose.yml"
NOTIFICATION_WEBHOOK=""
RESTART_THRESHOLD=3
RESTART_COOLDOWN=300

# Service configuration
CRITICAL_SERVICES=(
    "clickstack-architecture-postgres-1"
    "clickstack-architecture-redis-1"
    "clickstack-architecture-clickhouse-1"
    "clickstack-architecture-kafka-1"
    "clickstack-architecture-api-gateway-1"
    "clickstack-architecture-ui-1"
)

APPLICATION_SERVICES=(
    "clickstack-architecture-analytics-engine-1"
    "clickstack-architecture-session-replay-1"
    "clickstack-architecture-data-ingestion-1"
    "clickstack-architecture-chatbot-api-1"
    "clickstack-architecture-aiops-1"
    "clickstack-architecture-nlp-search-1"
    "clickstack-architecture-event-delta-analyzer-1"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Store PID for service management
store_pid() {
    echo $$ > "$PID_FILE"
}

# Cleanup on exit
cleanup() {
    log "INFO" "Health monitor service stopping"
    rm -f "$PID_FILE"
    exit 0
}
trap cleanup EXIT INT TERM

# Check if container is healthy
check_container_health() {
    local container="$1"
    local health_status
    
    # Check if container exists and is running
    if ! docker ps --filter "name=$container" --filter "status=running" --format "{{.Names}}" | grep -q "^$container$"; then
        echo "not_running"
        return 1
    fi
    
    # Get health status
    health_status=$(docker inspect "$container" --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-health")
    
    case "$health_status" in
        "healthy")
            echo "healthy"
            return 0
            ;;
        "unhealthy")
            echo "unhealthy"
            return 1
            ;;
        "starting")
            echo "starting"
            return 2
            ;;
        "no-health")
            # For containers without health check, just check if running
            echo "running"
            return 0
            ;;
        *)
            echo "unknown"
            return 1
            ;;
    esac
}

# Get detailed container status
get_container_status() {
    local container="$1"
    docker ps --filter "name=$container" --format "{{.Status}}" 2>/dev/null | head -1
}

# Restart unhealthy container
restart_container() {
    local container="$1"
    local reason="${2:-health check failure}"
    
    log "WARNING" "Restarting container $container (reason: $reason)"
    
    if docker restart "$container" >/dev/null 2>&1; then
        log "INFO" "Successfully restarted container $container"
        
        # Wait for container to stabilize
        sleep 20
        
        local status
        status=$(check_container_health "$container")
        case "$status" in
            "healthy"|"running")
                log "INFO" "Container $container is now healthy after restart"
                return 0
                ;;
            "starting")
                log "INFO" "Container $container is starting, will check again later"
                return 0
                ;;
            *)
                log "ERROR" "Container $container still unhealthy after restart (status: $status)"
                return 1
                ;;
        esac
    else
        log "ERROR" "Failed to restart container $container"
        return 1
    fi
}

# Send notification (if webhook configured)
send_notification() {
    local level="$1"
    local message="$2"
    local container="${3:-}"
    
    if [[ -n "$NOTIFICATION_WEBHOOK" ]]; then
        local payload
        payload=$(cat <<EOF
{
    "level": "$level",
    "message": "$message",
    "container": "$container",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
    "host": "$(hostname)",
    "service": "AIRIS EPM Health Monitor"
}
EOF
)
        
        curl -X POST "$NOTIFICATION_WEBHOOK" \
             -H "Content-Type: application/json" \
             -d "$payload" \
             --silent --max-time 10 >/dev/null 2>&1 || true
    fi
}

# Check all containers and track issues
check_all_containers() {
    local unhealthy_critical=0
    local unhealthy_application=0
    local total_issues=0
    
    log "DEBUG" "Starting health check cycle"
    
    # Check critical services first
    for container in "${CRITICAL_SERVICES[@]}"; do
        local status
        status=$(check_container_health "$container")
        
        case "$status" in
            "healthy"|"running")
                log "DEBUG" "Critical service $container: healthy"
                ;;
            "starting")
                log "INFO" "Critical service $container: starting (will check again)"
                ;;
            "unhealthy")
                log "ERROR" "Critical service $container: unhealthy - attempting restart"
                if restart_container "$container" "critical service unhealthy"; then
                    send_notification "WARNING" "Critical service restarted successfully" "$container"
                else
                    send_notification "CRITICAL" "Failed to restart critical service" "$container"
                fi
                ((unhealthy_critical++))
                ((total_issues++))
                ;;
            "not_running")
                log "CRITICAL" "Critical service $container: not running - attempting restart"
                if restart_container "$container" "critical service not running"; then
                    send_notification "CRITICAL" "Critical service was down and restarted" "$container"
                else
                    send_notification "CRITICAL" "Critical service down and restart failed" "$container"
                fi
                ((unhealthy_critical++))
                ((total_issues++))
                ;;
            *)
                log "WARNING" "Critical service $container: unknown status ($status)"
                ((unhealthy_critical++))
                ((total_issues++))
                ;;
        esac
    done
    
    # Check application services
    for container in "${APPLICATION_SERVICES[@]}"; do
        local status
        status=$(check_container_health "$container")
        
        case "$status" in
            "healthy"|"running")
                log "DEBUG" "Application service $container: healthy"
                ;;
            "starting")
                log "INFO" "Application service $container: starting"
                ;;
            "unhealthy")
                log "WARNING" "Application service $container: unhealthy - attempting restart"
                if restart_container "$container" "application service unhealthy"; then
                    send_notification "INFO" "Application service restarted" "$container"
                fi
                ((unhealthy_application++))
                ((total_issues++))
                ;;
            "not_running")
                log "ERROR" "Application service $container: not running - attempting restart"
                if restart_container "$container" "application service not running"; then
                    send_notification "WARNING" "Application service was down and restarted" "$container"
                fi
                ((unhealthy_application++))
                ((total_issues++))
                ;;
        esac
    done
    
    # Summary report
    if [[ $total_issues -eq 0 ]]; then
        log "INFO" "Health check completed: All services healthy"
    else
        log "WARNING" "Health check completed: $total_issues issues found (Critical: $unhealthy_critical, Application: $unhealthy_application)"
        
        if [[ $unhealthy_critical -gt 0 ]]; then
            send_notification "CRITICAL" "$unhealthy_critical critical services had issues"
        fi
    fi
}

# Generate health report
generate_health_report() {
    local report_file="/tmp/airis-health-report.json"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
    
    cat > "$report_file" << EOF
{
    "timestamp": "$timestamp",
    "system": "AIRIS EPM",
    "monitoring_service": "running",
    "critical_services": [
EOF

    local first=true
    for container in "${CRITICAL_SERVICES[@]}"; do
        if [[ "$first" == "false" ]]; then
            echo "        ," >> "$report_file"
        fi
        
        local status detailed_status
        status=$(check_container_health "$container")
        detailed_status=$(get_container_status "$container")
        
        cat >> "$report_file" << EOF
        {
            "name": "$container",
            "health_status": "$status",
            "detailed_status": "$detailed_status"
        }
EOF
        first=false
    done
    
    cat >> "$report_file" << EOF
    ],
    "application_services": [
EOF

    first=true
    for container in "${APPLICATION_SERVICES[@]}"; do
        if [[ "$first" == "false" ]]; then
            echo "        ," >> "$report_file"
        fi
        
        local status detailed_status
        status=$(check_container_health "$container")
        detailed_status=$(get_container_status "$container")
        
        cat >> "$report_file" << EOF
        {
            "name": "$container",
            "health_status": "$status",
            "detailed_status": "$detailed_status"
        }
EOF
        first=false
    done
    
    cat >> "$report_file" << EOF
    ]
}
EOF
    
    echo "$report_file"
}

# Main monitoring loop
monitor_services() {
    log "INFO" "AIRIS EPM Health Monitor starting (PID: $$)"
    store_pid
    
    while true; do
        check_all_containers
        
        # Generate periodic health report (every 10 minutes)
        if (( $(date +%M) % 10 == 0 )); then
            local report_file
            report_file=$(generate_health_report)
            log "INFO" "Health report generated: $report_file"
        fi
        
        log "DEBUG" "Waiting $CHECK_INTERVAL seconds before next check"
        sleep "$CHECK_INTERVAL"
    done
}

# Service management functions
start_service() {
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Health monitor is already running (PID: $(cat "$PID_FILE"))"
        exit 1
    fi
    
    cd "$COMPOSE_DIR"
    monitor_services
}

stop_service() {
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        local pid
        pid=$(cat "$PID_FILE")
        log "INFO" "Stopping health monitor (PID: $pid)"
        kill "$pid"
        rm -f "$PID_FILE"
        echo "Health monitor stopped"
    else
        echo "Health monitor is not running"
    fi
}

status_service() {
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Health monitor is running (PID: $(cat "$PID_FILE"))"
        return 0
    else
        echo "Health monitor is not running"
        return 1
    fi
}

# Show usage
show_usage() {
    cat << EOF
AIRIS EPM Health Monitor Service

Usage: $0 {start|stop|restart|status|check|report}

Commands:
    start       Start the health monitoring service
    stop        Stop the health monitoring service
    restart     Restart the health monitoring service
    status      Show service status
    check       Perform one-time health check
    report      Generate current health report

Configuration:
    Log file:           $LOG_FILE
    PID file:           $PID_FILE
    Check interval:     $CHECK_INTERVAL seconds
    Compose directory:  $COMPOSE_DIR

EOF
}

# Command line interface
case "${1:-}" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        stop_service
        sleep 2
        start_service
        ;;
    status)
        status_service
        ;;
    check)
        log "INFO" "Performing one-time health check"
        cd "$COMPOSE_DIR"
        check_all_containers
        ;;
    report)
        cd "$COMPOSE_DIR"
        report_file=$(generate_health_report)
        echo "Health report generated: $report_file"
        cat "$report_file"
        ;;
    *)
        show_usage
        exit 1
        ;;
esac