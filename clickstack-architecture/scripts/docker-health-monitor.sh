#!/bin/bash

# AIRIS EPM Docker Health Monitor Service
# Automatically monitors and restarts unhealthy containers

set -euo pipefail

# Configuration
COMPOSE_DIR="/home/ptyoung/work/AIRIS_APM/clickstack-architecture"
COMPOSE_FILE="docker-compose.yml"
LOG_FILE="/var/log/airis-health-monitor.log"
PID_FILE="/var/run/airis-health-monitor.pid"
CHECK_INTERVAL=60
MAX_RESTART_ATTEMPTS=3
RESTART_COOLDOWN=300  # 5 minutes

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Store PID
echo $$ > "$PID_FILE"

# Cleanup on exit
cleanup() {
    rm -f "$PID_FILE"
    exit 0
}
trap cleanup EXIT INT TERM

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" >> "$LOG_FILE"
    if [[ "$level" == "ERROR" ]]; then
        echo "[${timestamp}] [${level}] ${message}" >&2
    fi
}

# Check container health
check_container_health() {
    local container_name="$1"
    local health_status
    
    # Get container health status
    health_status=$(docker inspect "$container_name" --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
    
    case "$health_status" in
        "healthy")
            return 0
            ;;
        "unhealthy")
            log "WARNING" "Container $container_name is unhealthy"
            return 1
            ;;
        "starting")
            log "INFO" "Container $container_name is starting, health check in progress"
            return 2
            ;;
        "no-healthcheck")
            # For containers without healthcheck, check if running
            if docker ps --filter "name=$container_name" --filter "status=running" | grep -q "$container_name"; then
                return 0
            else
                log "WARNING" "Container $container_name is not running"
                return 1
            fi
            ;;
        *)
            log "ERROR" "Unknown health status for $container_name: $health_status"
            return 1
            ;;
    esac
}

# Restart container with retry logic
restart_container() {
    local container_name="$1"
    local attempts=0
    
    log "INFO" "Attempting to restart container: $container_name"
    
    while [[ $attempts -lt $MAX_RESTART_ATTEMPTS ]]; do
        ((attempts++))
        
        if docker restart "$container_name" >/dev/null 2>&1; then
            log "INFO" "Successfully restarted $container_name (attempt $attempts)"
            
            # Wait for container to stabilize
            sleep 30
            
            # Check if restart was successful
            if check_container_health "$container_name"; then
                log "INFO" "Container $container_name is now healthy after restart"
                return 0
            fi
        else
            log "ERROR" "Failed to restart $container_name (attempt $attempts)"
        fi
        
        if [[ $attempts -lt $MAX_RESTART_ATTEMPTS ]]; then
            log "INFO" "Waiting 30 seconds before retry..."
            sleep 30
        fi
    done
    
    log "ERROR" "Failed to restart $container_name after $MAX_RESTART_ATTEMPTS attempts"
    return 1
}

# Handle critical PostgreSQL issues
handle_postgres_issues() {
    local postgres_container="clickstack-architecture-postgres-1"
    
    log "INFO" "Handling PostgreSQL specific issues"
    
    # Check for network connectivity issues
    if ! docker exec "$postgres_container" pg_isready -U postgres -d airis_epm -h localhost >/dev/null 2>&1; then
        log "WARNING" "PostgreSQL is not accepting connections, checking network"
        
        # Run network health check
        if [[ -f "$COMPOSE_DIR/scripts/network-health-check.sh" ]]; then
            log "INFO" "Running network health check"
            "$COMPOSE_DIR/scripts/network-health-check.sh" --postgres
        fi
        
        # If still failing, force restart
        if ! docker exec "$postgres_container" pg_isready -U postgres -d airis_epm -h localhost >/dev/null 2>&1; then
            log "WARNING" "Network check didn't resolve issue, forcing PostgreSQL restart"
            restart_container "$postgres_container"
        fi
    fi
}

# Main monitoring loop
monitor_containers() {
    local containers=(
        "clickstack-architecture-postgres-1"
        "clickstack-architecture-redis-1"
        "clickstack-architecture-clickhouse-1"
        "clickstack-architecture-kafka-1"
        "clickstack-architecture-zookeeper-1"
        "clickstack-architecture-api-gateway-1"
        "clickstack-architecture-ui-1"
        "clickstack-architecture-session-replay-1"
        "clickstack-architecture-analytics-engine-1"
        "clickstack-architecture-data-ingestion-1"
        "clickstack-architecture-aiops-1"
        "clickstack-architecture-event-delta-analyzer-1"
        "clickstack-architecture-nlp-search-1"
    )
    
    local restart_timestamps=()
    
    log "INFO" "Starting health monitoring for ${#containers[@]} containers"
    
    while true; do
        local unhealthy_containers=()
        local current_time=$(date +%s)
        
        # Check each container
        for container in "${containers[@]}"; do
            if ! docker ps --filter "name=$container" --format "{{.Names}}" | grep -q "$container"; then
                log "WARNING" "Container $container is not running"
                unhealthy_containers+=("$container")
            elif ! check_container_health "$container"; then
                case $? in
                    1)  # Unhealthy
                        unhealthy_containers+=("$container")
                        ;;
                    2)  # Starting
                        log "INFO" "Container $container is starting, will check again next cycle"
                        ;;
                esac
            fi
        done
        
        # Handle unhealthy containers
        for container in "${unhealthy_containers[@]}"; do
            local restart_key="$container"
            local last_restart=${restart_timestamps[$restart_key]:-0}
            
            # Check if enough time has passed since last restart
            if [[ $((current_time - last_restart)) -gt $RESTART_COOLDOWN ]]; then
                # Special handling for PostgreSQL
                if [[ "$container" == "clickstack-architecture-postgres-1" ]]; then
                    handle_postgres_issues
                else
                    restart_container "$container"
                fi
                
                restart_timestamps[$restart_key]=$current_time
            else
                local wait_time=$((RESTART_COOLDOWN - (current_time - last_restart)))
                log "INFO" "Container $container in cooldown period, $wait_time seconds remaining"
            fi
        done
        
        # Log status summary
        if [[ ${#unhealthy_containers[@]} -eq 0 ]]; then
            log "INFO" "All ${#containers[@]} containers are healthy"
        else
            log "WARNING" "Found ${#unhealthy_containers[@]} unhealthy containers: ${unhealthy_containers[*]}"
        fi
        
        # Wait for next check
        sleep $CHECK_INTERVAL
    done
}

# Service management functions
start_service() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Health monitor is already running (PID: $pid)"
            exit 1
        else
            rm -f "$PID_FILE"
        fi
    fi
    
    log "INFO" "Starting AIRIS EPM Health Monitor service"
    cd "$COMPOSE_DIR"
    monitor_containers
}

stop_service() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "INFO" "Stopping AIRIS EPM Health Monitor service (PID: $pid)"
            kill "$pid"
            rm -f "$PID_FILE"
            echo "Health monitor stopped"
        else
            echo "Health monitor is not running"
            rm -f "$PID_FILE"
        fi
    else
        echo "Health monitor is not running"
    fi
}

status_service() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Health monitor is running (PID: $pid)"
            return 0
        else
            echo "Health monitor is not running (stale PID file)"
            rm -f "$PID_FILE"
            return 1
        fi
    else
        echo "Health monitor is not running"
        return 1
    fi
}

# Show usage
show_usage() {
    cat << EOF
AIRIS EPM Docker Health Monitor

Usage: $0 {start|stop|restart|status|check}

Commands:
    start       Start the health monitoring service
    stop        Stop the health monitoring service  
    restart     Restart the health monitoring service
    status      Show service status
    check       Perform one-time health check

Files:
    Log file:   $LOG_FILE
    PID file:   $PID_FILE

EOF
}

# Parse command
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
        cd "$COMPOSE_DIR"
        log "INFO" "Performing one-time health check"
        # Perform single check iteration
        monitor_containers &
        local monitor_pid=$!
        sleep $((CHECK_INTERVAL + 10))
        kill $monitor_pid 2>/dev/null || true
        ;;
    *)
        show_usage
        exit 1
        ;;
esac