#!/bin/bash

# AIRIS-MON Container Build and Push Script
# Usage: ./scripts/build-and-push.sh [service] [environment] [tag]

set -e

# Configuration
REGISTRY_URL="${REGISTRY_URL:-localhost:5000}"
PROJECT_NAME="airis-mon"
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Default values
SERVICE="${1:-all}"
ENVIRONMENT="${2:-development}"
TAG="${3:-${GIT_COMMIT}}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Build function for main application
build_main_app() {
    log_info "Building main application..."
    
    docker build \
        --target ${ENVIRONMENT} \
        --label "airis-mon.service=main-app" \
        --label "airis-mon.environment=${ENVIRONMENT}" \
        --label "airis-mon.version=${TAG}" \
        --label "airis-mon.build-time=${TIMESTAMP}" \
        -t ${REGISTRY_URL}/${PROJECT_NAME}/main-app:${TAG} \
        -t ${REGISTRY_URL}/${PROJECT_NAME}/main-app:latest \
        .
    
    if [ "$ENVIRONMENT" != "development" ]; then
        log_info "Pushing main application to registry..."
        docker push ${REGISTRY_URL}/${PROJECT_NAME}/main-app:${TAG}
        docker push ${REGISTRY_URL}/${PROJECT_NAME}/main-app:latest
    fi
    
    log_success "Main application build completed"
}

# Build function for clickstack services
build_clickstack_service() {
    local service_name=$1
    local service_path="clickstack-architecture/services/${service_name}"
    
    if [ ! -d "${service_path}" ]; then
        log_error "Service directory not found: ${service_path}"
        return 1
    fi
    
    log_info "Building ${service_name} service..."
    
    docker build \
        --label "airis-mon.service=${service_name}" \
        --label "airis-mon.environment=${ENVIRONMENT}" \
        --label "airis-mon.version=${TAG}" \
        --label "airis-mon.build-time=${TIMESTAMP}" \
        -t ${REGISTRY_URL}/${PROJECT_NAME}/${service_name}:${TAG} \
        -t ${REGISTRY_URL}/${PROJECT_NAME}/${service_name}:latest \
        ${service_path}
    
    if [ "$ENVIRONMENT" != "development" ]; then
        log_info "Pushing ${service_name} to registry..."
        docker push ${REGISTRY_URL}/${PROJECT_NAME}/${service_name}:${TAG}
        docker push ${REGISTRY_URL}/${PROJECT_NAME}/${service_name}:latest
    fi
    
    log_success "${service_name} build completed"
}

# Build function for UI services
build_ui_service() {
    local service_name=$1
    local service_path="clickstack-architecture/ui/${service_name}"
    
    if [ ! -d "${service_path}" ]; then
        log_error "UI service directory not found: ${service_path}"
        return 1
    fi
    
    log_info "Building ${service_name} UI service..."
    
    docker build \
        --label "airis-mon.service=${service_name}" \
        --label "airis-mon.environment=${ENVIRONMENT}" \
        --label "airis-mon.version=${TAG}" \
        --label "airis-mon.build-time=${TIMESTAMP}" \
        -t ${REGISTRY_URL}/${PROJECT_NAME}/${service_name}:${TAG} \
        -t ${REGISTRY_URL}/${PROJECT_NAME}/${service_name}:latest \
        ${service_path}
    
    if [ "$ENVIRONMENT" != "development" ]; then
        log_info "Pushing ${service_name} UI to registry..."
        docker push ${REGISTRY_URL}/${PROJECT_NAME}/${service_name}:${TAG}
        docker push ${REGISTRY_URL}/${PROJECT_NAME}/${service_name}:latest
    fi
    
    log_success "${service_name} UI build completed"
}

# Build function for test suite
build_test_suite() {
    local service_path="clickstack-architecture/test-suite"
    
    log_info "Building test-suite service..."
    
    docker build \
        --label "airis-mon.service=test-suite" \
        --label "airis-mon.environment=${ENVIRONMENT}" \
        --label "airis-mon.version=${TAG}" \
        --label "airis-mon.build-time=${TIMESTAMP}" \
        -t ${REGISTRY_URL}/${PROJECT_NAME}/test-suite:${TAG} \
        -t ${REGISTRY_URL}/${PROJECT_NAME}/test-suite:latest \
        ${service_path}
    
    if [ "$ENVIRONMENT" != "development" ]; then
        log_info "Pushing test-suite to registry..."
        docker push ${REGISTRY_URL}/${PROJECT_NAME}/test-suite:${TAG}
        docker push ${REGISTRY_URL}/${PROJECT_NAME}/test-suite:latest
    fi
    
    log_success "test-suite build completed"
}

# List of available services
CLICKSTACK_SERVICES=(
    "api-gateway"
    "data-ingestion"
    "analytics-engine"
    "session-replay"
    "aiops"
    "event-delta-analyzer"
    "nlp-search"
)

UI_SERVICES=(
    "korean-hyperdx-dashboard"
)

# Main execution
log_info "Starting build process..."
log_info "Service: ${SERVICE}"
log_info "Environment: ${ENVIRONMENT}"
log_info "Tag: ${TAG}"
log_info "Registry: ${REGISTRY_URL}"

case ${SERVICE} in
    "all")
        log_info "Building all services..."
        
        # Build main application
        build_main_app
        
        # Build all clickstack services
        for service in "${CLICKSTACK_SERVICES[@]}"; do
            build_clickstack_service "$service"
        done
        
        # Build UI services
        for service in "${UI_SERVICES[@]}"; do
            build_ui_service "$service"
        done
        
        # Build test suite
        build_test_suite
        
        log_success "All services build completed"
        ;;
    
    "main-app")
        build_main_app
        ;;
    
    "test-suite")
        build_test_suite
        ;;
    
    *)
        # Check if it's a clickstack service
        if [[ " ${CLICKSTACK_SERVICES[@]} " =~ " ${SERVICE} " ]]; then
            build_clickstack_service "$SERVICE"
        # Check if it's a UI service
        elif [[ " ${UI_SERVICES[@]} " =~ " ${SERVICE} " ]]; then
            build_ui_service "$SERVICE"
        else
            log_error "Unknown service: ${SERVICE}"
            log_info "Available services:"
            log_info "  main-app"
            log_info "  test-suite"
            log_info "  all"
            for service in "${CLICKSTACK_SERVICES[@]}"; do
                log_info "  $service"
            done
            for service in "${UI_SERVICES[@]}"; do
                log_info "  $service (UI)"
            done
            exit 1
        fi
        ;;
esac

# Generate image manifest
log_info "Generating image manifest..."
cat > image-manifest.json << EOF
{
  "build_info": {
    "timestamp": "${TIMESTAMP}",
    "git_commit": "${GIT_COMMIT}",
    "environment": "${ENVIRONMENT}",
    "registry": "${REGISTRY_URL}",
    "tag": "${TAG}"
  },
  "images": {
EOF

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "main-app" ]; then
cat >> image-manifest.json << EOF
    "main-app": "${REGISTRY_URL}/${PROJECT_NAME}/main-app:${TAG}",
EOF
fi

for service in "${CLICKSTACK_SERVICES[@]}"; do
    if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "$service" ]; then
cat >> image-manifest.json << EOF
    "${service}": "${REGISTRY_URL}/${PROJECT_NAME}/${service}:${TAG}",
EOF
    fi
done

for service in "${UI_SERVICES[@]}"; do
    if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "$service" ]; then
cat >> image-manifest.json << EOF
    "${service}": "${REGISTRY_URL}/${PROJECT_NAME}/${service}:${TAG}",
EOF
    fi
done

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "test-suite" ]; then
cat >> image-manifest.json << EOF
    "test-suite": "${REGISTRY_URL}/${PROJECT_NAME}/test-suite:${TAG}"
EOF
else
    # Remove trailing comma
    sed -i '$ s/,$//' image-manifest.json
fi

cat >> image-manifest.json << EOF
  }
}
EOF

log_success "Build process completed successfully!"
log_info "Image manifest saved to: image-manifest.json"

# Show next steps
if [ "$ENVIRONMENT" != "development" ]; then
    log_info "Next steps for deployment:"
    log_info "  Test environment: kubectl apply -f k8s/test/"
    log_info "  Production environment: kubectl apply -f k8s/production/"
fi