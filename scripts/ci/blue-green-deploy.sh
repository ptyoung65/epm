#!/bin/bash
# AIRIS EPM Blue-Green Deployment Script
# Implements zero-downtime deployment strategy

set -euo pipefail

ENVIRONMENT=${1:-staging}
IMAGE_TAG=${2:-latest}
NAMESPACE="airis-epm-${ENVIRONMENT}"

echo "🔄 Starting Blue-Green deployment for AIRIS EPM"
echo "Environment: $ENVIRONMENT"
echo "Image: $IMAGE_TAG"
echo "Namespace: $NAMESPACE"

# Check if kubectl is configured
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo "❌ kubectl is not configured or cluster is not accessible"
    exit 1
fi

# Create namespace if it doesn't exist
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Determine current active deployment (blue or green)
CURRENT_ACTIVE=$(kubectl get service airis-epm-app-service -n "$NAMESPACE" -o jsonpath='{.spec.selector.deployment}' 2>/dev/null || echo "blue")

if [[ "$CURRENT_ACTIVE" == "blue" ]]; then
    NEW_ACTIVE="green"
    OLD_ACTIVE="blue"
else
    NEW_ACTIVE="blue"
    OLD_ACTIVE="green"
fi

echo "📍 Current active: $OLD_ACTIVE"
echo "🎯 Deploying to: $NEW_ACTIVE"

# Update deployment manifest with new image and deployment label
sed -e "s|airis-epm:latest|$IMAGE_TAG|g" \
    -e "s|name: airis-epm-app|name: airis-epm-app-$NEW_ACTIVE|g" \
    -e "s|app: airis-epm|app: airis-epm\n        deployment: $NEW_ACTIVE|g" \
    infrastructure/k8s/deployment.yaml > "/tmp/deployment-$NEW_ACTIVE.yaml"

# Deploy new version (green deployment)
echo "🚀 Deploying new version..."
kubectl apply -f infrastructure/k8s/configmap.yaml -n "$NAMESPACE"
kubectl apply -f infrastructure/k8s/secret.yaml -n "$NAMESPACE"
kubectl apply -f infrastructure/k8s/pvc.yaml -n "$NAMESPACE"
kubectl apply -f "/tmp/deployment-$NEW_ACTIVE.yaml" -n "$NAMESPACE"

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl rollout status "deployment/airis-epm-app-$NEW_ACTIVE" -n "$NAMESPACE" --timeout=600s

# Get new deployment pod for health checks
NEW_POD=$(kubectl get pods -n "$NAMESPACE" -l "app=airis-epm,deployment=$NEW_ACTIVE" -o jsonpath='{.items[0].metadata.name}')
echo "🏥 Running health checks on pod: $NEW_POD"

# Health check loop
HEALTH_CHECK_ATTEMPTS=0
MAX_ATTEMPTS=30

while [[ $HEALTH_CHECK_ATTEMPTS -lt $MAX_ATTEMPTS ]]; do
    if kubectl exec "$NEW_POD" -n "$NAMESPACE" -- curl -sf http://localhost:3000/health > /dev/null; then
        echo "✅ Health check passed"
        break
    fi
    
    echo "⏳ Health check attempt $((HEALTH_CHECK_ATTEMPTS + 1))/$MAX_ATTEMPTS"
    sleep 10
    ((HEALTH_CHECK_ATTEMPTS++))
done

if [[ $HEALTH_CHECK_ATTEMPTS -eq $MAX_ATTEMPTS ]]; then
    echo "❌ Health checks failed. Rolling back..."
    kubectl delete deployment "airis-epm-app-$NEW_ACTIVE" -n "$NAMESPACE"
    exit 1
fi

# Run smoke tests
echo "🧪 Running smoke tests..."
kubectl exec "$NEW_POD" -n "$NAMESPACE" -- /bin/sh -c "
    curl -sf http://localhost:3000/health &&
    curl -sf http://localhost:3000/api/v1/status
"

if [[ $? -ne 0 ]]; then
    echo "❌ Smoke tests failed. Rolling back..."
    kubectl delete deployment "airis-epm-app-$NEW_ACTIVE" -n "$NAMESPACE"
    exit 1
fi

# Switch traffic to new deployment
echo "🔄 Switching traffic to new deployment..."
kubectl patch service airis-epm-app-service -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"deployment\":\"$NEW_ACTIVE\"}}}"

# Wait a bit and verify traffic is flowing
sleep 30

# Final verification
echo "🔍 Final verification..."
SERVICE_IP=$(kubectl get service airis-epm-app-service -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [[ -n "$SERVICE_IP" ]]; then
    curl -sf "http://$SERVICE_IP/health" || {
        echo "❌ Final verification failed. Rolling back..."
        kubectl patch service airis-epm-app-service -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"deployment\":\"$OLD_ACTIVE\"}}}"
        kubectl delete deployment "airis-epm-app-$NEW_ACTIVE" -n "$NAMESPACE"
        exit 1
    }
fi

# Clean up old deployment
echo "🧹 Cleaning up old deployment..."
kubectl delete deployment "airis-epm-app-$OLD_ACTIVE" -n "$NAMESPACE" --ignore-not-found=true

# Update ingress and other resources
kubectl apply -f infrastructure/k8s/service.yaml -n "$NAMESPACE"
kubectl apply -f infrastructure/k8s/hpa.yaml -n "$NAMESPACE"
kubectl apply -f infrastructure/k8s/ingress.yaml -n "$NAMESPACE"

echo "✅ Blue-Green deployment completed successfully!"
echo "🎉 AIRIS EPM $IMAGE_TAG is now active in $ENVIRONMENT environment"

# Clean up temporary files
rm -f "/tmp/deployment-$NEW_ACTIVE.yaml"