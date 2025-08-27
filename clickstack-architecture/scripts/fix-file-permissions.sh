#!/bin/bash

# AIRIS APM File Permissions Fix Script
# Fixes 403 Forbidden issues caused by incorrect file permissions

set -e

echo "🔧 AIRIS APM: Fixing file permissions..."

# Function to fix permissions
fix_permissions() {
    local container_name="$1"
    local html_dir="/usr/share/nginx/html"
    
    echo "📁 Checking container: $container_name"
    
    if docker ps --format '{{.Names}}' | grep -q "$container_name"; then
        echo "✅ Container $container_name is running"
        
        # Fix all HTML files permissions
        echo "📝 Setting HTML files permissions to 644..."
        docker exec "$container_name" find "$html_dir" -name "*.html" -type f -exec chmod 644 {} \; 2>/dev/null || true
        
        # Fix specific problematic files
        echo "🎯 Fixing specific dashboard files..."
        docker exec "$container_name" chmod 644 \
            "$html_dir/exception-dashboard.html" \
            "$html_dir/topology-dashboard.html" \
            "$html_dir/alert-dashboard.html" \
            "$html_dir/j2ee-dashboard.html" \
            "$html_dir/was-dashboard.html" \
            "$html_dir/session-analysis.html" \
            "$html_dir/ontology.html" \
            2>/dev/null || true
        
        # Fix CSS and JS files
        echo "🎨 Fixing CSS and JS files permissions..."
        docker exec "$container_name" find "$html_dir" -name "*.css" -type f -exec chmod 644 {} \; 2>/dev/null || true
        docker exec "$container_name" find "$html_dir" -name "*.js" -type f -exec chmod 644 {} \; 2>/dev/null || true
        
        # Ensure nginx can read all files
        echo "🔒 Setting directory permissions..."
        docker exec "$container_name" find "$html_dir" -type d -exec chmod 755 {} \; 2>/dev/null || true
        
        # Reload nginx to ensure changes take effect
        echo "🔄 Reloading nginx configuration..."
        docker exec "$container_name" nginx -s reload 2>/dev/null || true
        
        echo "✅ Permissions fixed for $container_name"
    else
        echo "⚠️  Container $container_name is not running"
        return 1
    fi
}

# Fix permissions for UI container
UI_CONTAINER="clickstack-architecture-ui-1"
fix_permissions "$UI_CONTAINER"

# Test access to problematic pages
echo "🧪 Testing access to dashboard pages..."
test_urls=(
    "http://localhost:3001/exception-dashboard.html"
    "http://localhost:3001/topology-dashboard.html" 
    "http://localhost:3001/alert-dashboard.html"
    "http://localhost:3001/j2ee-dashboard.html"
    "http://localhost:3001/was-dashboard.html"
)

failed_tests=0
for url in "${test_urls[@]}"; do
    echo -n "  Testing $url... "
    if curl -s -f -o /dev/null "$url"; then
        echo "✅ OK"
    else
        echo "❌ FAILED"
        failed_tests=$((failed_tests + 1))
    fi
done

if [ $failed_tests -eq 0 ]; then
    echo "🎉 All tests passed! File permissions are correctly set."
else
    echo "⚠️  $failed_tests test(s) failed. Please check the logs above."
    exit 1
fi

echo "🏁 File permissions fix completed successfully!"