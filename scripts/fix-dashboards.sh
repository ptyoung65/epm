#!/bin/bash

# Fix dashboard navigation and remove TweakCN

DASHBOARD_DIR="/home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/public"

echo "🔧 Fixing dashboard navigation and removing TweakCN..."

# List of dashboard files to fix
DASHBOARDS=(
    "index.html"
    "j2ee-dashboard.html"
    "was-dashboard.html"
    "exception-dashboard.html"
    "topology-dashboard.html"
    "alert-dashboard.html"
)

for dashboard in "${DASHBOARDS[@]}"; do
    FILE="$DASHBOARD_DIR/$dashboard"
    if [ -f "$FILE" ]; then
        echo "Processing $dashboard..."
        
        # Remove TweakCN loader script tag
        sed -i '/<script src="\/js\/tweakcn-loader\.js"><\/script>/d' "$FILE"
        
        # Remove TweakCN comments
        sed -i '/<!-- TweakCN Theme System -->/d' "$FILE"
        
        # Fix navigation links - remove /src/dashboards/ prefix
        sed -i 's|href="/src/dashboards/index.html"|href="/"|g' "$FILE"
        sed -i 's|href="/src/dashboards/j2ee-dashboard.html"|href="/j2ee-dashboard.html"|g' "$FILE"
        sed -i 's|href="/src/dashboards/was-dashboard.html"|href="/was-dashboard.html"|g' "$FILE"
        sed -i 's|href="/src/dashboards/exception-dashboard.html"|href="/exception-dashboard.html"|g' "$FILE"
        sed -i 's|href="/src/dashboards/topology-dashboard.html"|href="/topology-dashboard.html"|g' "$FILE"
        sed -i 's|href="/src/dashboards/alert-dashboard.html"|href="/alert-dashboard.html"|g' "$FILE"
        
        # Also fix relative links
        sed -i 's|href="index.html"|href="/"|g' "$FILE"
        
        echo "✅ Fixed $dashboard"
    fi
done

echo "🎉 All dashboards fixed!"