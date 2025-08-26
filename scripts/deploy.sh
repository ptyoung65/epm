#!/bin/bash

# AIRIS-MON Deployment Script
# Usage: ./scripts/deploy.sh [environment] [action]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REGISTRY_URL="${REGISTRY_URL:-localhost:5000}"
PROJECT_NAME="airis-mon"

# Default values
ENVIRONMENT="${1:-development}"
ACTION="${2:-deploy}"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check if docker compose is available
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available"
        exit 1
    fi
    
    # For K8s environments, check kubectl
    if [ "$ENVIRONMENT" != "development" ]; then
        if ! command -v kubectl &> /dev/null; then
            log_error "kubectl is not installed"
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Deploy development environment
deploy_development() {
    log_info "Deploying development environment with Docker Compose..."
    
    cd "$PROJECT_ROOT"
    
    case $ACTION in
        "deploy")
            log_info "Starting development environment..."
            
            # Start the registry first
            docker compose -f docker-compose.dev.yml up -d registry
            sleep 5
            
            # Start main application
            docker compose -f docker-compose.dev.yml up -d
            
            # Start clickstack services
            cd clickstack-architecture
            docker compose -f docker-compose.dev.yml up -d
            cd ..
            
            log_success "Development environment started"
            ;;
            
        "stop")
            log_info "Stopping development environment..."
            docker compose -f docker-compose.dev.yml down
            cd clickstack-architecture
            docker compose -f docker-compose.dev.yml down
            cd ..
            log_success "Development environment stopped"
            ;;
            
        "restart")
            log_info "Restarting development environment..."
            deploy_development "stop"
            sleep 2
            deploy_development "deploy"
            ;;
            
        "build")
            log_info "Building development images..."
            "$SCRIPT_DIR/build-and-push.sh" all development
            ;;
            
        *)
            log_error "Unknown action: $ACTION"
            exit 1
            ;;
    esac
}

# Deploy test environment
deploy_test() {
    log_info "Deploying test environment to Kubernetes..."
    
    case $ACTION in
        "deploy")
            log_info "Building and pushing test images..."
            "$SCRIPT_DIR/build-and-push.sh" all test
            
            log_info "Applying Kubernetes manifests..."
            kubectl apply -f "$PROJECT_ROOT/k8s/namespaces/airis-mon-test.yaml"
            kubectl apply -f "$PROJECT_ROOT/k8s/manifests/"
            kubectl apply -f "$PROJECT_ROOT/k8s/test/"
            
            log_info "Waiting for deployments to be ready..."
            kubectl rollout status deployment/api-gateway -n airis-mon-test --timeout=300s
            kubectl rollout status deployment/ui -n airis-mon-test --timeout=300s
            
            log_success "Test environment deployed successfully"
            ;;
            
        "stop")
            log_info "Stopping test environment..."
            kubectl delete -f "$PROJECT_ROOT/k8s/test/" --ignore-not-found=true
            log_success "Test environment stopped"
            ;;
            
        "restart")
            deploy_test "stop"
            sleep 5
            deploy_test "deploy"
            ;;
            
        "scale")
            local replicas="${3:-3}"
            log_info "Scaling test environment to $replicas replicas..."
            kubectl scale deployment/api-gateway --replicas=$replicas -n airis-mon-test
            kubectl scale deployment/ui --replicas=$replicas -n airis-mon-test
            log_success "Test environment scaled to $replicas replicas"
            ;;
            
        *)
            log_error "Unknown action: $ACTION"
            exit 1
            ;;
    esac
}

# Deploy production environment
deploy_production() {
    log_info "Deploying production environment to Kubernetes..."
    
    # Production deployment requires confirmation
    if [ "$ACTION" = "deploy" ]; then
        echo -e "${YELLOW}⚠️  You are about to deploy to PRODUCTION environment!${NC}"
        echo -e "${YELLOW}   This action cannot be undone.${NC}"
        read -p "Are you sure you want to continue? (yes/no): " confirm
        
        if [ "$confirm" != "yes" ]; then
            log_warning "Production deployment cancelled"
            exit 0
        fi
    fi
    
    case $ACTION in
        "deploy")
            log_info "Building and pushing production images..."
            "$SCRIPT_DIR/build-and-push.sh" all production
            
            log_info "Applying Kubernetes manifests..."
            kubectl apply -f "$PROJECT_ROOT/k8s/namespaces/airis-mon-prod.yaml"
            kubectl apply -f "$PROJECT_ROOT/k8s/manifests/"
            kubectl apply -f "$PROJECT_ROOT/k8s/production/"
            
            log_info "Waiting for deployments to be ready..."
            kubectl rollout status deployment/api-gateway -n airis-mon-prod --timeout=600s
            kubectl rollout status deployment/ui -n airis-mon-prod --timeout=600s
            
            log_success "Production environment deployed successfully"
            ;;
            
        "rollback")
            log_warning "Rolling back production deployment..."
            kubectl rollout undo deployment/api-gateway -n airis-mon-prod
            kubectl rollout undo deployment/ui -n airis-mon-prod
            
            kubectl rollout status deployment/api-gateway -n airis-mon-prod --timeout=300s
            kubectl rollout status deployment/ui -n airis-mon-prod --timeout=300s
            
            log_success "Production rollback completed"
            ;;
            
        "scale")
            local replicas="${3:-5}"
            log_info "Scaling production environment to $replicas replicas..."
            kubectl scale deployment/api-gateway --replicas=$replicas -n airis-mon-prod
            kubectl scale deployment/ui --replicas=$replicas -n airis-mon-prod
            log_success "Production environment scaled to $replicas replicas"
            ;;
            
        *)
            log_error "Unknown action: $ACTION"
            exit 1
            ;;
    esac
}

# Status check
check_status() {
    log_info "Checking environment status..."
    
    case $ENVIRONMENT in
        "development")
            log_info "Development environment status:"
            docker compose -f "$PROJECT_ROOT/docker-compose.dev.yml" ps
            cd "$PROJECT_ROOT/clickstack-architecture"
            docker compose -f docker-compose.dev.yml ps
            cd "$PROJECT_ROOT"
            ;;
            
        "test")
            log_info "Test environment status:"
            kubectl get pods -n airis-mon-test
            kubectl get services -n airis-mon-test
            kubectl get ingress -n airis-mon-test
            ;;
            
        "production")
            log_info "Production environment status:"
            kubectl get pods -n airis-mon-prod
            kubectl get services -n airis-mon-prod
            kubectl get ingress -n airis-mon-prod
            ;;
    esac
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    case $ENVIRONMENT in
        "development")
            log_info "Checking development services..."
            curl -f http://localhost:3002/api/v1/health || log_warning "Main app health check failed"
            curl -f http://localhost:3100/health || log_warning "Test suite health check failed"
            ;;
            
        "test")
            log_info "Checking test environment services..."
            kubectl run health-check --image=curlimages/curl --rm -i --restart=Never -- \
                curl -f http://api-gateway-service.airis-mon-test.svc.cluster.local:3000/health
            ;;
            
        "production")
            log_info "Checking production environment services..."
            kubectl run health-check --image=curlimages/curl --rm -i --restart=Never -- \
                curl -f http://api-gateway-service.airis-mon-prod.svc.cluster.local:3000/health
            ;;
    esac
}

# Main execution
log_info "AIRIS-MON Deployment Script"
log_info "Environment: $ENVIRONMENT"
log_info "Action: $ACTION"

check_prerequisites

case $ENVIRONMENT in
    "development" | "dev")
        deploy_development
        ;;
        
    "test")
        deploy_test
        ;;
        
    "production" | "prod")
        deploy_production
        ;;
        
    "status")
        check_status
        ;;
        
    "health")
        health_check
        ;;
        
    *)
        log_error "Unknown environment: $ENVIRONMENT"
        log_info "Available environments: development, test, production"
        log_info "Available actions: deploy, stop, restart, build, scale, rollback, status, health"
        log_info "Usage: $0 [environment] [action] [replicas]"
        exit 1
        ;;
esac

log_success "Deployment script completed successfully!"