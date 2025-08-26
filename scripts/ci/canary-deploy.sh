#!/bin/bash
# AIRIS EPM Canary Deployment Script
# Gradually shifts traffic to new version

set -euo pipefail

ENVIRONMENT=${1:-production}
IMAGE_TAG=${2:-latest}
NAMESPACE="airis-epm-${ENVIRONMENT}"
CANARY_PERCENTAGE=${3:-10}

echo "🐦 Starting Canary deployment for AIRIS EPM"
echo "Environment: $ENVIRONMENT"
echo "Image: $IMAGE_TAG"
echo "Initial canary traffic: $CANARY_PERCENTAGE%"

# Check prerequisites
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo "❌ kubectl is not configured"
    exit 1
fi

# Create canary deployment
echo "🚀 Creating canary deployment..."
sed -e "s|airis-epm:latest|$IMAGE_TAG|g" \
    -e "s|name: airis-epm-app|name: airis-epm-app-canary|g" \
    -e "s|app: airis-epm|app: airis-epm\n        version: canary|g" \
    -e "s|replicas: 3|replicas: 1|g" \
    infrastructure/k8s/deployment.yaml > /tmp/deployment-canary.yaml

kubectl apply -f /tmp/deployment-canary.yaml -n "$NAMESPACE"

# Wait for canary deployment
echo "⏳ Waiting for canary deployment..."
kubectl rollout status deployment/airis-epm-app-canary -n "$NAMESPACE" --timeout=300s

# Create canary service
cat << EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: airis-epm-app-canary
  namespace: $NAMESPACE
  labels:
    app: airis-epm
    version: canary
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: airis-epm
    version: canary
EOF

# Setup Istio/NGINX traffic splitting (example with NGINX)
echo "🔄 Setting up traffic splitting..."
cat << EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: airis-epm-canary-ingress
  namespace: $NAMESPACE
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "$CANARY_PERCENTAGE"
spec:
  rules:
  - host: epm.airis.company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: airis-epm-app-canary
            port:
              number: 3000
EOF

# Monitor canary metrics
echo "📊 Monitoring canary metrics..."
monitor_canary() {
    local duration=$1
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        # Get metrics from both stable and canary versions
        STABLE_ERRORS=$(kubectl exec -n "$NAMESPACE" deployment/airis-epm-app -- curl -s http://localhost:3000/metrics | grep -o 'http_requests_errors_total [0-9]*' | awk '{sum += $2} END {print sum}' || echo "0")
        CANARY_ERRORS=$(kubectl exec -n "$NAMESPACE" deployment/airis-epm-app-canary -- curl -s http://localhost:3000/metrics | grep -o 'http_requests_errors_total [0-9]*' | awk '{sum += $2} END {print sum}' || echo "0")
        
        STABLE_RESPONSE_TIME=$(kubectl exec -n "$NAMESPACE" deployment/airis-epm-app -- curl -s http://localhost:3000/metrics | grep -o 'http_request_duration_ms_avg [0-9.]*' | awk '{print $2}' || echo "0")
        CANARY_RESPONSE_TIME=$(kubectl exec -n "$NAMESPACE" deployment/airis-epm-app-canary -- curl -s http://localhost:3000/metrics | grep -o 'http_request_duration_ms_avg [0-9.]*' | awk '{print $2}' || echo "0")
        
        echo "📈 Stable - Errors: $STABLE_ERRORS, Avg Response: ${STABLE_RESPONSE_TIME}ms"
        echo "🐦 Canary - Errors: $CANARY_ERRORS, Avg Response: ${CANARY_RESPONSE_TIME}ms"
        
        # Check if canary is performing worse
        if [[ $(echo "$CANARY_ERRORS > $STABLE_ERRORS * 2" | bc -l) -eq 1 ]] || 
           [[ $(echo "$CANARY_RESPONSE_TIME > $STABLE_RESPONSE_TIME * 1.5" | bc -l) -eq 1 ]]; then
            echo "❌ Canary metrics degraded. Aborting deployment!"
            return 1
        fi
        
        sleep 30
    done
    
    return 0
}

# Monitor for 5 minutes
if ! monitor_canary 300; then
    echo "🚨 Rolling back canary deployment..."
    kubectl delete deployment airis-epm-app-canary -n "$NAMESPACE"
    kubectl delete service airis-epm-app-canary -n "$NAMESPACE"
    kubectl delete ingress airis-epm-canary-ingress -n "$NAMESPACE"
    exit 1
fi

echo "✅ Canary deployment phase 1 successful (${CANARY_PERCENTAGE}% traffic)"

# Gradually increase canary traffic
TRAFFIC_STEPS=(25 50 75 100)

for percentage in "${TRAFFIC_STEPS[@]}"; do
    echo "📈 Increasing canary traffic to ${percentage}%..."
    
    kubectl patch ingress airis-epm-canary-ingress -n "$NAMESPACE" -p "{\"metadata\":{\"annotations\":{\"nginx.ingress.kubernetes.io/canary-weight\":\"$percentage\"}}}"
    
    # Monitor for 3 minutes at each step
    if ! monitor_canary 180; then
        echo "🚨 Rolling back canary deployment at ${percentage}%..."
        kubectl delete deployment airis-epm-app-canary -n "$NAMESPACE"
        kubectl delete service airis-epm-app-canary -n "$NAMESPACE"
        kubectl delete ingress airis-epm-canary-ingress -n "$NAMESPACE"
        exit 1
    fi
    
    echo "✅ Traffic at ${percentage}% - metrics look good"
done

echo "🎉 Canary deployment ready for completion!"
echo "Run canary-complete.sh to finish the deployment"

# Clean up temp files
rm -f /tmp/deployment-canary.yaml