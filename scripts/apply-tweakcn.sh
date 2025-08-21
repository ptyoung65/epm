#!/bin/bash

# Apply TweakCN to all AIRIS APM dashboards
echo "🎨 Applying TweakCN theme system to all dashboards..."

# Dashboard directory
DASHBOARD_DIR="/home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/public"

# List of dashboard HTML files to update
DASHBOARDS=(
    "index.html"
    "j2ee-dashboard.html"
    "was-dashboard.html"
    "exception-dashboard.html"
    "topology-dashboard.html"
    "alert-dashboard.html"
    "deployment-manager.html"
)

# Function to add TweakCN loader to HTML file
add_tweakcn_to_dashboard() {
    local file="$1"
    local filepath="$DASHBOARD_DIR/$file"
    
    if [ -f "$filepath" ]; then
        echo "  📝 Updating $file..."
        
        # Check if TweakCN is already added
        if grep -q "tweakcn-loader.js" "$filepath"; then
            echo "    ✅ TweakCN already integrated"
        else
            # Add TweakCN loader script before closing body tag
            sed -i '/<\/body>/i\  <!-- TweakCN Theme System -->\n  <script src="/js/tweakcn-loader.js"></script>' "$filepath"
            echo "    ✅ TweakCN loader added"
        fi
    else
        echo "  ⚠️  $file not found"
    fi
}

# Apply TweakCN to all dashboards
echo ""
echo "📋 Processing dashboards..."
for dashboard in "${DASHBOARDS[@]}"; do
    add_tweakcn_to_dashboard "$dashboard"
done

# Copy TweakCN theme CSS to public directory
echo ""
echo "📁 Copying TweakCN theme files..."
cp -f /home/ptyoung/work/AIRIS_APM/src/styles/tweakcn-theme.css "$DASHBOARD_DIR/css/" 2>/dev/null || {
    mkdir -p "$DASHBOARD_DIR/css"
    cp /home/ptyoung/work/AIRIS_APM/src/styles/tweakcn-theme.css "$DASHBOARD_DIR/css/"
}
echo "  ✅ Theme CSS copied"

# Copy TweakCN config to public directory
cp -f /home/ptyoung/work/AIRIS_APM/src/config/tweakcn.config.js "$DASHBOARD_DIR/js/" 2>/dev/null || {
    mkdir -p "$DASHBOARD_DIR/js"
    cp /home/ptyoung/work/AIRIS_APM/src/config/tweakcn.config.js "$DASHBOARD_DIR/js/"
}
echo "  ✅ Config JS copied"

# Copy theme switcher component
cp -f /home/ptyoung/work/AIRIS_APM/src/components/theme-switcher.html "$DASHBOARD_DIR/" 2>/dev/null
echo "  ✅ Theme switcher component copied"

echo ""
echo "🎉 TweakCN integration complete!"
echo ""
echo "📌 Usage:"
echo "  • Press Ctrl+Shift+T to open theme panel"
echo "  • Press Ctrl+Shift+D to toggle dark mode"
echo "  • Click the theme button (bottom-left) to open settings"
echo "  • Visit http://localhost:3002/theme-switcher.html for advanced settings"
echo ""
echo "🔗 TweakCN Editor: https://tweakcn.com"
echo ""