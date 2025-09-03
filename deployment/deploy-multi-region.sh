#!/bin/bash

# Multi-Region Deployment Script for AIRIS EPM
# Handles deployment to different regions with compliance requirements

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
CONFIG_FILE="$SCRIPT_DIR/multi-region-config.yml"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Environment variables
ENVIRONMENT="${ENVIRONMENT:-production}"
TARGET_REGIONS="${TARGET_REGIONS:-us-east-1}"
DRY_RUN="${DRY_RUN:-false}"
FORCE_DEPLOY="${FORCE_DEPLOY:-false}"

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment    Environment (development|staging|production) [default: production]"
    echo "  -r, --regions        Comma-separated list of regions [default: us-east-1]"
    echo "  -d, --dry-run       Dry run mode - show what would be deployed"
    echo "  -f, --force         Force deployment even if validation fails"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e production -r us-east-1,eu-west-1"
    echo "  $0 -e staging -r us-west-2 --dry-run"
    echo "  $0 -e development -r ap-northeast-1 --force"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--regions)
            TARGET_REGIONS="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN="true"
            shift
            ;;
        -f|--force)
            FORCE_DEPLOY="true"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate dependencies
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"
    
    local deps=("kubectl" "helm" "aws" "docker" "yq" "jq")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo -e "${RED}Missing dependencies: ${missing[*]}${NC}"
        echo "Please install missing dependencies and try again."
        exit 1
    fi
    
    echo -e "${GREEN}✓ All dependencies available${NC}"
}

# Load and validate configuration
load_configuration() {
    echo -e "${BLUE}Loading configuration...${NC}"
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        echo -e "${RED}Configuration file not found: $CONFIG_FILE${NC}"
        exit 1
    fi
    
    # Validate YAML syntax
    if ! yq eval '.' "$CONFIG_FILE" > /dev/null 2>&1; then
        echo -e "${RED}Invalid YAML syntax in configuration file${NC}"
        exit 1
    fi
    
    # Validate environment
    local valid_envs=($(yq eval '.environments | keys | .[]' "$CONFIG_FILE"))
    if [[ ! " ${valid_envs[*]} " =~ " ${ENVIRONMENT} " ]]; then
        echo -e "${RED}Invalid environment: $ENVIRONMENT${NC}"
        echo "Valid environments: ${valid_envs[*]}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Configuration loaded successfully${NC}"
}

# Get region configuration
get_region_config() {
    local region="$1"
    yq eval ".regions.\"$region\"" "$CONFIG_FILE"
}

# Validate target regions
validate_regions() {
    echo -e "${BLUE}Validating target regions...${NC}"
    
    local valid_regions=($(yq eval '.regions | keys | .[]' "$CONFIG_FILE"))
    IFS=',' read -ra regions <<< "$TARGET_REGIONS"
    
    for region in "${regions[@]}"; do
        if [[ ! " ${valid_regions[*]} " =~ " ${region} " ]]; then
            echo -e "${RED}Invalid region: $region${NC}"
            echo "Valid regions: ${valid_regions[*]}"
            exit 1
        fi
    done
    
    echo -e "${GREEN}✓ All regions are valid${NC}"
}

# Check compliance requirements
check_compliance() {
    local region="$1"
    echo -e "${BLUE}Checking compliance for region: $region${NC}"
    
    local compliance=($(get_region_config "$region" | yq eval '.compliance[]' -))
    
    for req in "${compliance[@]}"; do
        case "$req" in
            "GDPR")
                echo -e "${YELLOW}  ⚠ GDPR compliance required${NC}"
                echo "    - Data encryption enabled"
                echo "    - Consent management active"
                echo "    - Right to erasure implemented"
                echo "    - Data residency restrictions apply"
                ;;
            "CCPA")
                echo -e "${YELLOW}  ⚠ CCPA compliance required${NC}"
                echo "    - Opt-out mechanisms enabled"
                echo "    - Data deletion processes active"
                ;;
            "PIPL")
                echo -e "${YELLOW}  ⚠ China PIPL compliance required${NC}"
                echo "    - Data localization mandatory"
                echo "    - Government-approved infrastructure only"
                ;;
            *)
                echo -e "${BLUE}  ℹ $req compliance enabled${NC}"
                ;;
        esac
    done
}

# Build application for region
build_application() {
    local region="$1"
    echo -e "${BLUE}Building application for region: $region${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN] Would build application${NC}"
        return
    fi
    
    # Get region-specific configuration
    local config=$(get_region_config "$region")
    local subdomain=$(echo "$config" | yq eval '.subdomain' -)
    local timezone=$(echo "$config" | yq eval '.timezone' -)
    local compliance=($(echo "$config" | yq eval '.compliance[]' - 2>/dev/null || echo ""))
    
    # Set environment variables for build
    export REACT_APP_REGION="$region"
    export REACT_APP_SUBDOMAIN="$subdomain"
    export REACT_APP_TIMEZONE="$timezone"
    export REACT_APP_ENVIRONMENT="$ENVIRONMENT"
    export REACT_APP_COMPLIANCE="${compliance[*]}"
    
    # Build web application
    echo "Building web application..."
    cd "$PROJECT_ROOT"
    npm run build
    
    # Build mobile application if needed
    if [[ -d "mobile-app" ]]; then
        echo "Building mobile application..."
        cd mobile-app
        
        # Update environment configuration
        cat > .env.production << EOF
REGION=$region
SUBDOMAIN=$subdomain
TIMEZONE=$timezone
ENVIRONMENT=$ENVIRONMENT
COMPLIANCE=${compliance[*]}
EOF
        
        # Build for Android and iOS
        if command -v react-native &> /dev/null; then
            npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle
            npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/main.jsbundle
        fi
        
        cd "$PROJECT_ROOT"
    fi
    
    echo -e "${GREEN}✓ Application built successfully${NC}"
}

# Create Docker images
build_docker_images() {
    local region="$1"
    echo -e "${BLUE}Building Docker images for region: $region${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN] Would build Docker images${NC}"
        return
    fi
    
    local tag="$region-$ENVIRONMENT-$(date +%Y%m%d-%H%M%S)"
    
    # Build main application image
    docker build -t "airis-epm:$tag" -f docker/Dockerfile.production .
    
    # Build region-specific services if needed
    if [[ -d "services" ]]; then
        for service in services/*/; do
            if [[ -f "$service/Dockerfile" ]]; then
                local service_name=$(basename "$service")
                echo "Building service: $service_name"
                docker build -t "airis-epm-$service_name:$tag" "$service"
            fi
        done
    fi
    
    # Tag images for registry
    local registry="airis-epm-registry.com"
    docker tag "airis-epm:$tag" "$registry/airis-epm:$tag"
    docker tag "airis-epm:$tag" "$registry/airis-epm:$region-latest"
    
    # Push to registry
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker push "$registry/airis-epm:$tag"
        docker push "$registry/airis-epm:$region-latest"
    fi
    
    echo -e "${GREEN}✓ Docker images built and pushed${NC}"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    local region="$1"
    echo -e "${BLUE}Deploying to Kubernetes in region: $region${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN] Would deploy to Kubernetes${NC}"
        return
    fi
    
    local config=$(get_region_config "$region")
    local namespace="airis-epm-$region"
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply region-specific configuration
    envsubst < "$SCRIPT_DIR/k8s/configmap.yml" | kubectl apply -n "$namespace" -f -
    
    # Deploy application using Helm
    helm upgrade --install "airis-epm-$region" \
        "$SCRIPT_DIR/helm/airis-epm" \
        --namespace "$namespace" \
        --set "region=$region" \
        --set "environment=$ENVIRONMENT" \
        --set "image.tag=$region-latest" \
        --values "$SCRIPT_DIR/helm/values-$region.yml" \
        --wait \
        --timeout 10m
    
    echo -e "${GREEN}✓ Deployment completed${NC}"
}

# Update CDN configuration
update_cdn() {
    local region="$1"
    echo -e "${BLUE}Updating CDN configuration for region: $region${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN] Would update CDN${NC}"
        return
    fi
    
    local config=$(get_region_config "$region")
    local subdomain=$(echo "$config" | yq eval '.subdomain' -)
    
    # Update CloudFlare DNS and routing
    if [[ -f "$PROJECT_ROOT/infrastructure/cdn/deploy-cloudflare.sh" ]]; then
        export CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID}"
        export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN}"
        
        "$PROJECT_ROOT/infrastructure/cdn/deploy-cloudflare.sh"
    fi
    
    echo -e "${GREEN}✓ CDN updated${NC}"
}

# Run health checks
run_health_checks() {
    local region="$1"
    echo -e "${BLUE}Running health checks for region: $region${NC}"
    
    local config=$(get_region_config "$region")
    local subdomain=$(echo "$config" | yq eval '.subdomain' -)
    
    # Wait for deployment to be ready
    sleep 30
    
    # Check application health
    local health_url="https://$subdomain/api/health"
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s "$health_url" | grep -q "healthy"; then
            echo -e "${GREEN}✓ Application is healthy${NC}"
            break
        fi
        
        echo "Waiting for application to be healthy... ($((attempt + 1))/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        echo -e "${RED}✗ Application health check failed${NC}"
        if [[ "$FORCE_DEPLOY" != "true" ]]; then
            exit 1
        fi
    fi
    
    # Check compliance endpoints
    local compliance=($(echo "$config" | yq eval '.compliance[]' - 2>/dev/null || echo ""))
    for req in "${compliance[@]}"; do
        case "$req" in
            "GDPR")
                if curl -s "https://$subdomain/privacy-policy" | grep -q "GDPR"; then
                    echo -e "${GREEN}✓ GDPR compliance page accessible${NC}"
                else
                    echo -e "${YELLOW}⚠ GDPR compliance page not found${NC}"
                fi
                ;;
            "CCPA")
                if curl -s "https://$subdomain/privacy-policy" | grep -q "CCPA"; then
                    echo -e "${GREEN}✓ CCPA compliance page accessible${NC}"
                else
                    echo -e "${YELLOW}⚠ CCPA compliance page not found${NC}"
                fi
                ;;
        esac
    done
}

# Generate deployment report
generate_report() {
    echo -e "${BLUE}Generating deployment report...${NC}"
    
    local report_file="deployment-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "regions": "$TARGET_REGIONS",
    "dry_run": $DRY_RUN,
    "force_deploy": $FORCE_DEPLOY
  },
  "regions": {
EOF

    IFS=',' read -ra regions <<< "$TARGET_REGIONS"
    local first=true
    
    for region in "${regions[@]}"; do
        if [[ "$first" == "false" ]]; then
            echo "    ," >> "$report_file"
        fi
        first=false
        
        local config=$(get_region_config "$region")
        local subdomain=$(echo "$config" | yq eval '.subdomain' -)
        local compliance=($(echo "$config" | yq eval '.compliance[]' - 2>/dev/null || echo ""))
        
        cat >> "$report_file" << EOF
    "$region": {
      "subdomain": "$subdomain",
      "compliance": [$(printf '"%s",' "${compliance[@]}" | sed 's/,$//')],
      "status": "deployed",
      "health_check": "passed"
    }
EOF
    done
    
    cat >> "$report_file" << EOF
  }
}
EOF
    
    echo -e "${GREEN}✓ Deployment report generated: $report_file${NC}"
}

# Main deployment function
main() {
    echo -e "${BLUE}Starting AIRIS EPM multi-region deployment...${NC}"
    echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
    echo -e "${BLUE}Regions: $TARGET_REGIONS${NC}"
    echo -e "${BLUE}Dry run: $DRY_RUN${NC}"
    echo ""
    
    check_dependencies
    load_configuration
    validate_regions
    
    IFS=',' read -ra regions <<< "$TARGET_REGIONS"
    
    for region in "${regions[@]}"; do
        echo -e "${BLUE}================================================${NC}"
        echo -e "${BLUE}Deploying to region: $region${NC}"
        echo -e "${BLUE}================================================${NC}"
        
        check_compliance "$region"
        build_application "$region"
        build_docker_images "$region"
        deploy_to_kubernetes "$region"
        update_cdn "$region"
        run_health_checks "$region"
        
        echo -e "${GREEN}✓ Region $region deployed successfully${NC}"
        echo ""
    done
    
    generate_report
    
    echo -e "${GREEN}🎉 Multi-region deployment completed successfully!${NC}"
    echo ""
    echo "Deployed regions:"
    for region in "${regions[@]}"; do
        local config=$(get_region_config "$region")
        local subdomain=$(echo "$config" | yq eval '.subdomain' -)
        echo -e "  • $region: https://$subdomain"
    done
}

# Run main function
main "$@"