#!/bin/bash

# AIRIS APM Complete System Startup Script
# Starts all services and ensures proper configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting AIRIS APM Complete System..."
echo "📁 Project root: $PROJECT_ROOT"

# Function to wait for container to be ready
wait_for_container() {
    local container_name="$1"
    local max_wait=60
    local count=0
    
    echo "⏳ Waiting for $container_name to be ready..."
    
    while [ $count -lt $max_wait ]; do
        if docker ps --format '{{.Names}}' | grep -q "$container_name" && \
           docker exec "$container_name" test -f /usr/share/nginx/html/index.html 2>/dev/null; then
            echo "✅ $container_name is ready!"
            return 0
        fi
        sleep 2
        count=$((count + 1))
        echo -n "."
    done
    
    echo "❌ Timeout waiting for $container_name"
    return 1
}

# Step 1: Stop existing containers
echo "🛑 Stopping existing containers..."
cd "$PROJECT_ROOT"
docker compose down --remove-orphans || true

# Step 2: Clean up system
echo "🧹 Cleaning up Docker system..."
docker system prune -f --volumes || true

# Step 3: Start services
echo "🐳 Starting Docker services..."
docker compose up -d

# Step 4: Wait for UI container to be ready
wait_for_container "clickstack-architecture-ui-1"

# Step 5: Fix file permissions automatically
echo "🔧 Fixing file permissions..."
if [ -f "$SCRIPT_DIR/fix-file-permissions.sh" ]; then
    "$SCRIPT_DIR/fix-file-permissions.sh"
else
    echo "⚠️  File permissions script not found, fixing manually..."
    
    # Manual fix as fallback
    UI_CONTAINER="clickstack-architecture-ui-1"
    if docker ps --format '{{.Names}}' | grep -q "$UI_CONTAINER"; then
        docker exec "$UI_CONTAINER" find /usr/share/nginx/html -name "*.html" -type f -exec chmod 644 {} \; 2>/dev/null || true
        docker exec "$UI_CONTAINER" find /usr/share/nginx/html -name "*.css" -type f -exec chmod 644 {} \; 2>/dev/null || true  
        docker exec "$UI_CONTAINER" find /usr/share/nginx/html -name "*.js" -type f -exec chmod 644 {} \; 2>/dev/null || true
        docker exec "$UI_CONTAINER" find /usr/share/nginx/html -type d -exec chmod 755 {} \; 2>/dev/null || true
        docker exec "$UI_CONTAINER" nginx -s reload 2>/dev/null || true
    fi
fi

# Step 6: Display status
echo "📊 System Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep clickstack-architecture || echo "No containers found"

# Step 7: Test main endpoints
echo "🧪 Testing main endpoints..."
sleep 3

endpoints=(
    "http://localhost:3001/"
    "http://localhost:3001/j2ee-dashboard.html"
    "http://localhost:3001/was-dashboard.html"
    "http://localhost:3001/exception-dashboard.html"
    "http://localhost:3001/topology-dashboard.html"
    "http://localhost:3001/alert-dashboard.html"
    "http://localhost:3001/session-analysis.html"
)

failed_endpoints=0
for endpoint in "${endpoints[@]}"; do
    echo -n "  Testing $endpoint... "
    if curl -s -f -o /dev/null "$endpoint"; then
        echo "✅ OK"
    else
        echo "❌ FAILED"
        failed_endpoints=$((failed_endpoints + 1))
    fi
done

echo ""
if [ $failed_endpoints -eq 0 ]; then
    echo "🎉 AIRIS APM System started successfully!"
    echo "🌐 Access the main dashboard at: http://localhost:3001/"
    echo ""
    echo "📊 Available Dashboards:"
    echo "  • Main Dashboard: http://localhost:3001/"
    echo "  • J2EE Monitoring: http://localhost:3001/j2ee-dashboard.html"
    echo "  • WAS Monitoring: http://localhost:3001/was-dashboard.html"  
    echo "  • Exception Tracking: http://localhost:3001/exception-dashboard.html"
    echo "  • Service Topology: http://localhost:3001/topology-dashboard.html"
    echo "  • Alert Management: http://localhost:3001/alert-dashboard.html"
    echo "  • Session Analysis: http://localhost:3001/session-analysis.html"
else
    echo "⚠️  $failed_endpoints endpoint(s) failed. System may not be fully ready."
    echo "💡 Try running the fix-file-permissions.sh script manually:"
    echo "   $SCRIPT_DIR/fix-file-permissions.sh"
    exit 1
fi

echo "🏁 Startup completed!"