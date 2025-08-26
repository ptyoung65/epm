#!/bin/bash
# AIRIS EPM Canary Deployment Completion Script
# Completes the canary deployment by replacing stable version

set -euo pipefail

ENVIRONMENT=${1:-production}
NAMESPACE="airis-epm-${ENVIRONMENT}"

echo "🎯 Completing canary deployment for AIRIS EPM"
echo "Environment: $ENVIRONMENT"

# Check if canary deployment exists
if ! kubectl get deployment airis-epm-app-canary -n "$NAMESPACE" >/dev/null 2>&1; then
    echo "❌ No canary deployment found"
    exit 1
fi

# Get the canary image tag
CANARY_IMAGE=$(kubectl get deployment airis-epm-app-canary -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')
echo "📦 Promoting canary image: $CANARY_IMAGE"

# Scale up canary to full capacity
echo "📈 Scaling up canary deployment..."
kubectl scale deployment airis-epm-app-canary -n "$NAMESPACE" --replicas=3

# Wait for scale up
kubectl rollout status deployment/airis-epm-app-canary -n "$NAMESPACE" --timeout=300s

# Update main deployment with canary image
echo "🔄 Updating main deployment..."
kubectl set image deployment/airis-epm-app -n "$NAMESPACE" airis-epm="$CANARY_IMAGE"

# Wait for main deployment rollout
kubectl rollout status deployment/airis-epm-app -n "$NAMESPACE" --timeout=600s

# Remove canary ingress (send all traffic to main)
echo "🗑️ Removing canary ingress..."
kubectl delete ingress airis-epm-canary-ingress -n "$NAMESPACE" --ignore-not-found=true

# Wait for traffic to stabilize
sleep 60

# Final health check on main deployment
echo "🏥 Final health check..."
kubectl exec deployment/airis-epm-app -n "$NAMESPACE" -- curl -sf http://localhost:3000/health

# Clean up canary resources
echo "🧹 Cleaning up canary resources..."
kubectl delete deployment airis-epm-app-canary -n "$NAMESPACE"
kubectl delete service airis-epm-app-canary -n "$NAMESPACE"

echo "✅ Canary deployment completed successfully!"
echo "🎉 AIRIS EPM production deployment updated with $CANARY_IMAGE"