#!/bin/bash

# AIRIS EPM Network Health Check and Recovery Script
# This script monitors Docker networks and containers for issues and automatically fixes them

set -euo pipefail

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
NETWORK_NAME="clickstack-architecture_airis_network"
PROJECT_NAME="clickstack-architecture"
LOG_FILE="/tmp/airis-network-health.log"
MAX_RETRIES=3
RETRY_DELAY=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Check if network exists and is healthy
check_network_health() {
    log "INFO" "Checking network health for ${NETWORK_NAME}"
    
    # Check if network exists
    if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
        log "ERROR" "Network ${NETWORK_NAME} does not exist"
        return 1
    fi
    
    # Check network configuration
    local subnet
    subnet=$(docker network inspect "$NETWORK_NAME" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null)
    if [[ -z "$subnet" ]]; then
        log "ERROR" "Network ${NETWORK_NAME} has no subnet configuration"
        return 1
    fi
    
    log "INFO" "Network ${NETWORK_NAME} is healthy with subnet: ${subnet}"
    return 0
}

# Check container network connectivity
check_container_connectivity() {
    local container_name="$1"
    log "INFO" "Checking connectivity for container: ${container_name}"
    
    # Check if container is running
    if ! docker ps --filter "name=${container_name}" --filter "status=running" | grep -q "$container_name"; then
        log "WARNING" "Container ${container_name} is not running"
        return 1
    fi
    
    # Check if container is connected to network
    local network_id
    network_id=$(docker inspect "$container_name" --format '{{range $net, $conf := .NetworkSettings.Networks}}{{if eq $net "'"$NETWORK_NAME"'"}}{{$conf.NetworkID}}{{end}}{{end}}' 2>/dev/null)
    
    if [[ -z "$network_id" ]]; then
        log "ERROR" "Container ${container_name} is not connected to ${NETWORK_NAME}"
        return 1
    fi
    
    log "INFO" "Container ${container_name} is properly connected to network"
    return 0
}

# Check PostgreSQL specific connectivity
check_postgres_health() {
    local postgres_container="clickstack-architecture-postgres-1"
    log "INFO" "Performing PostgreSQL health check"
    
    # Check if PostgreSQL container is running
    if ! docker ps --filter "name=${postgres_container}" --filter "status=running" | grep -q "$postgres_container"; then
        log "ERROR" "PostgreSQL container is not running"
        return 1
    fi
    
    # Test database connection
    if docker exec "$postgres_container" pg_isready -U postgres -d airis_epm -h localhost >/dev/null 2>&1; then
        log "INFO" "PostgreSQL database is healthy and accepting connections"
        return 0
    else
        log "ERROR" "PostgreSQL database is not accepting connections"
        return 1
    fi
}

# Fix network issues
fix_network_issues() {
    log "INFO" "Attempting to fix network issues"
    
    # Remove orphaned networks
    log "INFO" "Cleaning up orphaned networks"
    docker network prune -f 2>/dev/null || true
    
    # Restart Docker daemon if necessary (requires sudo)
    if command -v systemctl >/dev/null 2>&1; then
        if systemctl is-active --quiet docker; then
            log "INFO" "Docker daemon is running"
        else
            log "WARNING" "Docker daemon is not running, attempting to start"
            sudo systemctl start docker || log "ERROR" "Failed to start Docker daemon"
        fi
    fi
    
    # Recreate network if needed
    if ! check_network_health; then
        log "INFO" "Recreating Docker network"
        docker-compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
        docker network rm "$NETWORK_NAME" 2>/dev/null || true
        docker-compose -f "$COMPOSE_FILE" up -d --force-recreate
    fi
}

# Restart problematic containers
restart_container() {
    local container_name="$1"
    local retry_count=0
    
    log "INFO" "Restarting container: ${container_name}"
    
    while [[ $retry_count -lt $MAX_RETRIES ]]; do
        if docker restart "$container_name" >/dev/null 2>&1; then
            log "INFO" "Successfully restarted ${container_name}"
            
            # Wait for container to be healthy
            sleep 30
            
            if check_container_connectivity "$container_name"; then
                return 0
            fi
        fi
        
        ((retry_count++))
        log "WARNING" "Restart attempt ${retry_count} failed for ${container_name}, retrying in ${RETRY_DELAY}s"
        sleep $RETRY_DELAY
    done
    
    log "ERROR" "Failed to restart ${container_name} after ${MAX_RETRIES} attempts"
    return 1
}

# Main health check routine
perform_health_check() {
    log "INFO" "Starting AIRIS EPM network health check"
    
    local issues_found=0
    local containers_to_check=(
        "clickstack-architecture-postgres-1"
        "clickstack-architecture-redis-1"
        "clickstack-architecture-clickhouse-1"
        "clickstack-architecture-kafka-1"
        "clickstack-architecture-zookeeper-1"
        "clickstack-architecture-api-gateway-1"
        "clickstack-architecture-ui-1"
    )
    
    # Check network health
    if ! check_network_health; then
        ((issues_found++))
        log "ERROR" "Network health check failed"
    fi
    
    # Check PostgreSQL specifically
    if ! check_postgres_health; then
        ((issues_found++))
        log "ERROR" "PostgreSQL health check failed"
    fi
    
    # Check each container
    for container in "${containers_to_check[@]}"; do
        if ! check_container_connectivity "$container"; then
            ((issues_found++))
        fi
    done
    
    # Attempt fixes if issues found
    if [[ $issues_found -gt 0 ]]; then
        log "WARNING" "Found ${issues_found} issues, attempting fixes"
        fix_network_issues
        
        # Restart PostgreSQL specifically if it had issues
        if ! check_postgres_health; then
            restart_container "clickstack-architecture-postgres-1"
        fi
        
        log "INFO" "Fix attempts completed, re-running health check"
        sleep 30
        perform_health_check
    else
        log "INFO" "All network and container health checks passed"
    fi
}

# Monitoring mode
monitor_mode() {
    log "INFO" "Starting continuous monitoring mode"
    
    while true; do
        perform_health_check
        log "INFO" "Sleeping for 5 minutes before next check"
        sleep 300
    done
}

# Show usage
show_usage() {
    cat << EOF
AIRIS EPM Network Health Check Script

Usage: $0 [OPTIONS]

Options:
    --check         Perform one-time health check and fix issues
    --monitor       Run in continuous monitoring mode
    --postgres      Check PostgreSQL specifically
    --fix           Force network issue fixes
    --help          Show this help message

Examples:
    $0 --check                 # One-time health check
    $0 --monitor              # Continuous monitoring
    $0 --postgres             # PostgreSQL specific check
    $0 --fix                  # Force fix network issues

EOF
}

# Parse command line arguments
case "${1:---check}" in
    --check)
        perform_health_check
        ;;
    --monitor)
        monitor_mode
        ;;
    --postgres)
        check_postgres_health
        ;;
    --fix)
        fix_network_issues
        ;;
    --help)
        show_usage
        ;;
    *)
        log "ERROR" "Unknown option: $1"
        show_usage
        exit 1
        ;;
esac

log "INFO" "Script execution completed"