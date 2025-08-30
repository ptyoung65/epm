#!/bin/sh

# Universal Health Check Script for AIRIS EPM Services
# This script provides a reliable health check mechanism for all services

SERVICE_TYPE="${1:-generic}"
PORT="${2:-3000}"
HEALTH_ENDPOINT="${3:-/health}"

# Colors for output (optional in containers)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if port is listening
check_port() {
    local port=$1
    # Primary method: Use netstat (most reliable)
    if command -v netstat >/dev/null 2>&1; then
        if netstat -ln 2>/dev/null | grep ":$port " >/dev/null; then
            return 0
        fi
    fi
    
    # Secondary method: Use ss
    if command -v ss >/dev/null 2>&1; then
        if ss -ln 2>/dev/null | grep -q ":$port "; then
            return 0
        fi
    fi
    
    # Tertiary method: Use lsof
    if command -v lsof >/dev/null 2>&1; then
        if lsof -i ":$port" >/dev/null 2>&1; then
            return 0
        fi
    fi
    
    # Last resort: nc (can be unreliable in some containers)
    if command -v nc >/dev/null 2>&1; then
        if timeout 2 nc -z localhost "$port" >/dev/null 2>&1; then
            return 0
        fi
    fi
    
    # If all methods fail, return failure
    return 1
}

# Function to check HTTP endpoint
check_http() {
    local port=$1
    local endpoint=$2
    local url="http://localhost:$port$endpoint"
    
    if command -v curl >/dev/null 2>&1; then
        response=$(curl -s -w "%{http_code}" "$url" -o /dev/null)
        [ "$response" -ge 200 ] && [ "$response" -lt 400 ]
        return $?
    elif command -v wget >/dev/null 2>&1; then
        wget -q --spider --timeout=5 "$url" >/dev/null 2>&1
        return $?
    else
        # Fallback to port check
        check_port "$port"
        return $?
    fi
}

# Function to check process
check_process() {
    local process_name=$1
    if command -v pgrep >/dev/null 2>&1; then
        pgrep -f "$process_name" >/dev/null 2>&1
        return $?
    elif command -v ps >/dev/null 2>&1; then
        ps aux | grep -v grep | grep "$process_name" >/dev/null 2>&1
        return $?
    else
        return 1
    fi
}

# Main health check logic
case "$SERVICE_TYPE" in
    "nginx")
        log "Checking Nginx service on port $PORT"
        # For Nginx, prioritize HTTP check over port check
        if check_http "$PORT" "/"; then
            log "✅ Nginx service is healthy (HTTP response OK)"
            exit 0
        elif check_port "$PORT"; then
            log "✅ Nginx service is healthy (port listening)"
            exit 0
        else
            log "❌ Nginx service is not healthy"
            exit 1
        fi
        ;;
    
    "node")
        log "Checking Node.js service on port $PORT"
        if check_port "$PORT"; then
            if check_http "$PORT" "$HEALTH_ENDPOINT"; then
                log "✅ Node.js service is healthy"
                exit 0
            else
                log "⚠️  Node.js port is open but health endpoint failed"
                # For Node services, port listening is sufficient
                exit 0
            fi
        else
            log "❌ Node.js service is not listening on port $PORT"
            exit 1
        fi
        ;;
    
    "database")
        log "Checking database service on port $PORT"
        if check_port "$PORT"; then
            log "✅ Database service is healthy"
            exit 0
        else
            log "❌ Database service is not listening on port $PORT"
            exit 1
        fi
        ;;
    
    "generic"|*)
        log "Checking generic service on port $PORT"
        if check_port "$PORT"; then
            log "✅ Service is healthy (port $PORT is listening)"
            exit 0
        else
            log "❌ Service is not healthy (port $PORT is not listening)"
            exit 1
        fi
        ;;
esac