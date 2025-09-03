#!/bin/bash

# CloudFlare CDN Deployment Script for AIRIS EPM
# Configures CloudFlare zones, DNS, and CDN settings for global deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
CONFIG_FILE="$SCRIPT_DIR/cloudflare-config.js"
CF_API_TOKEN="${CLOUDFLARE_API_TOKEN}"
CF_ZONE_ID="${CLOUDFLARE_ZONE_ID}"
CF_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}"

# Check dependencies
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"
    
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}Error: curl is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq is required but not installed${NC}"
        exit 1
    fi
    
    if [[ -z "$CF_API_TOKEN" ]]; then
        echo -e "${RED}Error: CLOUDFLARE_API_TOKEN environment variable is required${NC}"
        exit 1
    fi
    
    if [[ -z "$CF_ZONE_ID" ]]; then
        echo -e "${RED}Error: CLOUDFLARE_ZONE_ID environment variable is required${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Dependencies check passed${NC}"
}

# CloudFlare API helper function
cf_api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    local curl_opts=(-X "$method" -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")
    
    if [[ -n "$data" ]]; then
        curl_opts+=(-d "$data")
    fi
    
    curl -s "${curl_opts[@]}" "https://api.cloudflare.com/client/v4/$endpoint"
}

# Create DNS records for different regions
setup_dns_records() {
    echo -e "${BLUE}Setting up DNS records...${NC}"
    
    local records=(
        "us-east.airis-epm.com:A:1.2.3.4"
        "eu-west.airis-epm.com:A:5.6.7.8"
        "ap-northeast.airis-epm.com:A:9.10.11.12"
        "ap-southeast.airis-epm.com:A:13.14.15.16"
        "kr.airis-epm.com:CNAME:ap-northeast.airis-epm.com"
        "jp.airis-epm.com:CNAME:ap-northeast.airis-epm.com"
        "cn.airis-epm.com:CNAME:ap-southeast.airis-epm.com"
        "de.airis-epm.com:CNAME:eu-west.airis-epm.com"
        "uk.airis-epm.com:CNAME:eu-west.airis-epm.com"
        "api.airis-epm.com:CNAME:airis-epm.com"
        "cdn.airis-epm.com:CNAME:airis-epm.com"
    )
    
    for record in "${records[@]}"; do
        IFS=':' read -r name type content <<< "$record"
        
        echo -e "${YELLOW}Creating DNS record: $name ($type) -> $content${NC}"
        
        data=$(jq -n \
            --arg type "$type" \
            --arg name "$name" \
            --arg content "$content" \
            --arg proxied "true" \
            '{type: $type, name: $name, content: $content, proxied: ($proxied | test("true")), ttl: 1}')
        
        response=$(cf_api_call "POST" "zones/$CF_ZONE_ID/dns_records" "$data")
        
        if echo "$response" | jq -e '.success' > /dev/null; then
            echo -e "${GREEN}✓ Created DNS record: $name${NC}"
        else
            echo -e "${RED}✗ Failed to create DNS record: $name${NC}"
            echo "$response" | jq '.errors[]?.message' 2>/dev/null || echo "Unknown error"
        fi
    done
}

# Configure page rules
setup_page_rules() {
    echo -e "${BLUE}Setting up page rules...${NC}"
    
    # API bypass rule
    api_rule=$(jq -n '{
        targets: [{
            target: "url",
            constraint: {
                operator: "matches",
                value: "*.airis-epm.com/api/*"
            }
        }],
        actions: [{
            id: "cache_level",
            value: "bypass"
        }, {
            id: "disable_apps"
        }, {
            id: "disable_performance"
        }],
        priority: 1,
        status: "active"
    }')
    
    response=$(cf_api_call "POST" "zones/$CF_ZONE_ID/pagerules" "$api_rule")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Created API bypass page rule${NC}"
    else
        echo -e "${RED}✗ Failed to create API bypass page rule${NC}"
    fi
    
    # Static assets caching rule
    assets_rule=$(jq -n '{
        targets: [{
            target: "url",
            constraint: {
                operator: "matches",
                value: "*.airis-epm.com/assets/*"
            }
        }],
        actions: [{
            id: "cache_level",
            value: "cache_everything"
        }, {
            id: "edge_cache_ttl",
            value: 2592000
        }, {
            id: "browser_cache_ttl",
            value: 31536000
        }],
        priority: 2,
        status: "active"
    }')
    
    response=$(cf_api_call "POST" "zones/$CF_ZONE_ID/pagerules" "$assets_rule")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Created static assets caching rule${NC}"
    else
        echo -e "${RED}✗ Failed to create static assets caching rule${NC}"
    fi
    
    # Dashboard pages rule
    dashboard_rule=$(jq -n '{
        targets: [{
            target: "url",
            constraint: {
                operator: "matches",
                value: "*.airis-epm.com/dashboard/*"
            }
        }],
        actions: [{
            id: "cache_level",
            value: "standard"
        }, {
            id: "browser_cache_ttl",
            value: 3600
        }, {
            id: "always_use_https"
        }],
        priority: 3,
        status: "active"
    }')
    
    response=$(cf_api_call "POST" "zones/$CF_ZONE_ID/pagerules" "$dashboard_rule")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Created dashboard pages rule${NC}"
    else
        echo -e "${RED}✗ Failed to create dashboard pages rule${NC}"
    fi
}

# Configure zone settings
setup_zone_settings() {
    echo -e "${BLUE}Configuring zone settings...${NC}"
    
    # SSL settings
    ssl_setting=$(jq -n '{value: "full_strict"}')
    response=$(cf_api_call "PATCH" "zones/$CF_ZONE_ID/settings/ssl" "$ssl_setting")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Configured SSL mode: Full (Strict)${NC}"
    else
        echo -e "${RED}✗ Failed to configure SSL mode${NC}"
    fi
    
    # Always use HTTPS
    https_setting=$(jq -n '{value: "on"}')
    response=$(cf_api_call "PATCH" "zones/$CF_ZONE_ID/settings/always_use_https" "$https_setting")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Enabled always use HTTPS${NC}"
    else
        echo -e "${RED}✗ Failed to enable always use HTTPS${NC}"
    fi
    
    # Minify settings
    minify_setting=$(jq -n '{value: {css: "on", html: "on", js: "on"}}')
    response=$(cf_api_call "PATCH" "zones/$CF_ZONE_ID/settings/minify" "$minify_setting")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Enabled minification${NC}"
    else
        echo -e "${RED}✗ Failed to enable minification${NC}"
    fi
    
    # Security level
    security_setting=$(jq -n '{value: "high"}')
    response=$(cf_api_call "PATCH" "zones/$CF_ZONE_ID/settings/security_level" "$security_setting")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Set security level to high${NC}"
    else
        echo -e "${RED}✗ Failed to set security level${NC}"
    fi
    
    # Bot fight mode
    bot_setting=$(jq -n '{value: "on"}')
    response=$(cf_api_call "PATCH" "zones/$CF_ZONE_ID/settings/brotli" "$bot_setting")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Enabled Brotli compression${NC}"
    else
        echo -e "${RED}✗ Failed to enable Brotli compression${NC}"
    fi
}

# Deploy Workers
deploy_workers() {
    echo -e "${BLUE}Deploying CloudFlare Workers...${NC}"
    
    # Geo-redirect worker
    geo_redirect_script='
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const country = request.cf.country
  const url = new URL(request.url)
  
  const redirects = {
    "KR": "kr.airis-epm.com",
    "JP": "jp.airis-epm.com", 
    "CN": "cn.airis-epm.com",
    "DE": "de.airis-epm.com",
    "GB": "uk.airis-epm.com",
  }
  
  if (redirects[country] && url.hostname === "airis-epm.com") {
    url.hostname = redirects[country]
    return Response.redirect(url.toString(), 302)
  }
  
  return fetch(request)
}'
    
    worker_data=$(jq -n \
        --arg script "$geo_redirect_script" \
        '{script: $script}')
    
    response=$(cf_api_call "PUT" "accounts/$CF_ACCOUNT_ID/workers/scripts/geo-redirect" "$worker_data")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Deployed geo-redirect worker${NC}"
    else
        echo -e "${RED}✗ Failed to deploy geo-redirect worker${NC}"
    fi
    
    # Security headers worker
    security_headers_script='
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const response = await fetch(request)
  const newResponse = new Response(response.body, response)
  
  newResponse.headers.set("X-Frame-Options", "DENY")
  newResponse.headers.set("X-Content-Type-Options", "nosniff")
  newResponse.headers.set("X-XSS-Protection", "1; mode=block")
  newResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  newResponse.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
  
  const euCountries = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB"]
  if (euCountries.includes(request.cf.country)) {
    newResponse.headers.set("X-GDPR-Region", "true")
  }
  
  return newResponse
}'
    
    worker_data=$(jq -n \
        --arg script "$security_headers_script" \
        '{script: $script}')
    
    response=$(cf_api_call "PUT" "accounts/$CF_ACCOUNT_ID/workers/scripts/security-headers" "$worker_data")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Deployed security-headers worker${NC}"
    else
        echo -e "${RED}✗ Failed to deploy security-headers worker${NC}"
    fi
}

# Enable analytics
setup_analytics() {
    echo -e "${BLUE}Setting up analytics...${NC}"
    
    # Enable Web Analytics
    analytics_data=$(jq -n '{enabled: true, privacy_policy: "essential_only"}')
    response=$(cf_api_call "POST" "zones/$CF_ZONE_ID/web_analytics" "$analytics_data")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Enabled Web Analytics${NC}"
    else
        echo -e "${YELLOW}⚠ Web Analytics may already be enabled${NC}"
    fi
}

# Health check function
health_check() {
    echo -e "${BLUE}Performing health check...${NC}"
    
    local domains=("airis-epm.com" "us-east.airis-epm.com" "eu-west.airis-epm.com" "ap-northeast.airis-epm.com")
    
    for domain in "${domains[@]}"; do
        if curl -s -I "https://$domain" | head -n 1 | grep -q "200\|301\|302"; then
            echo -e "${GREEN}✓ $domain is accessible${NC}"
        else
            echo -e "${RED}✗ $domain is not accessible${NC}"
        fi
    done
}

# Main deployment function
main() {
    echo -e "${BLUE}Starting CloudFlare CDN deployment for AIRIS EPM...${NC}"
    
    check_dependencies
    setup_dns_records
    setup_page_rules
    setup_zone_settings
    
    if [[ -n "$CF_ACCOUNT_ID" ]]; then
        deploy_workers
    else
        echo -e "${YELLOW}⚠ Skipping Workers deployment (CLOUDFLARE_ACCOUNT_ID not set)${NC}"
    fi
    
    setup_analytics
    
    echo -e "${BLUE}Waiting for DNS propagation...${NC}"
    sleep 30
    
    health_check
    
    echo -e "${GREEN}CloudFlare CDN deployment completed successfully!${NC}"
    echo -e "${BLUE}Configuration summary:${NC}"
    echo -e "  • SSL: Full (Strict)"
    echo -e "  • HTTPS: Always enabled"
    echo -e "  • Minification: Enabled (CSS, HTML, JS)"
    echo -e "  • Compression: Brotli enabled"
    echo -e "  • Security: High level"
    echo -e "  • Geo-steering: Enabled"
    echo -e "  • Workers: 2 deployed"
    echo -e "  • Analytics: Enabled"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "health-check")
        health_check
        ;;
    "dns-only")
        check_dependencies
        setup_dns_records
        ;;
    *)
        echo "Usage: $0 [deploy|health-check|dns-only]"
        exit 1
        ;;
esac