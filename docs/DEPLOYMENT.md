# AIRIS EPM 배포 및 운영 가이드

## 📚 목차

1. [배포 환경 구성](#배포-환경-구성)
2. [컨테이너화 및 Docker](#컨테이너화-및-docker)
3. [Kubernetes 배포](#kubernetes-배포)
4. [CI/CD 파이프라인](#cicd-파이프라인)
5. [모니터링 및 로깅](#모니터링-및-로깅)
6. [보안 설정](#보안-설정)
7. [성능 튜닝](#성능-튜닝)
8. [백업 및 복구](#백업-및-복구)
9. [운영 절차](#운영-절차)
10. [장애 대응](#장애-대응)

## 🏗️ 배포 환경 구성

### 환경별 구성 전략

#### Development 환경
```yaml
Environment: Development
Purpose: 개발 및 초기 테스트
Resources: 최소 사양
Services: All-in-one 또는 단일 노드
Monitoring: 기본 레벨
Security: 개발 전용 설정
```

#### Staging 환경
```yaml
Environment: Staging
Purpose: 통합 테스트 및 성능 검증
Resources: 프로덕션의 50-70%
Services: 프로덕션과 동일한 아키텍처
Monitoring: 프로덕션 수준
Security: 프로덕션과 동일
```

#### Production 환경
```yaml
Environment: Production
Purpose: 실제 서비스 운영
Resources: 최적화된 사양
Services: 고가용성 클러스터
Monitoring: 완전한 관찰성
Security: 최고 보안 수준
```

### 인프라 요구사항

#### 최소 시스템 요구사항

| 컴포넌트 | CPU | Memory | Disk | Network |
|----------|-----|---------|------|---------|
| **Metrics Service** | 2 cores | 4GB | 50GB SSD | 1Gbps |
| **Log Service** | 2 cores | 4GB | 100GB SSD | 1Gbps |
| **Trace Service** | 1 core | 2GB | 20GB SSD | 1Gbps |
| **Alert Service** | 1 core | 2GB | 20GB SSD | 1Gbps |
| **ClickHouse** | 4 cores | 8GB | 500GB SSD | 1Gbps |
| **Elasticsearch** | 4 cores | 8GB | 200GB SSD | 1Gbps |
| **Redis** | 2 cores | 4GB | 50GB SSD | 1Gbps |
| **Kafka** | 2 cores | 4GB | 100GB SSD | 1Gbps |

#### 권장 프로덕션 사양

| 컴포넌트 | CPU | Memory | Disk | Network | Replicas |
|----------|-----|---------|------|---------|----------|
| **Metrics Service** | 4 cores | 8GB | 100GB SSD | 10Gbps | 3 |
| **Log Service** | 4 cores | 8GB | 200GB SSD | 10Gbps | 3 |
| **Trace Service** | 2 cores | 4GB | 50GB SSD | 10Gbps | 2 |
| **Alert Service** | 2 cores | 4GB | 50GB SSD | 10Gbps | 2 |
| **ClickHouse** | 8 cores | 32GB | 2TB NVMe | 10Gbps | 3 |
| **Elasticsearch** | 8 cores | 32GB | 1TB NVMe | 10Gbps | 3 |
| **Redis** | 4 cores | 16GB | 100GB SSD | 10Gbps | 2 |
| **Kafka** | 4 cores | 16GB | 500GB SSD | 10Gbps | 3 |

## 🐳 컨테이너화 및 Docker

### Docker 이미지 빌드

#### Multi-stage Dockerfile 예시

```dockerfile
# services/metrics-service/Dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY ../shared/package*.json ../shared/
RUN npm ci --only=production

# Copy source
COPY src ./src
COPY ../shared/src ../shared/src
COPY tsconfig*.json ./

# Build
RUN npm run build

# Production stage  
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S airis && \
    adduser -S airis -u 1001 -G airis

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=airis:airis /app/dist ./dist
COPY --from=builder --chown=airis:airis /app/node_modules ./node_modules
COPY --from=builder --chown=airis:airis /app/package.json ./package.json

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Create necessary directories
RUN mkdir -p logs tmp && chown airis:airis logs tmp

# Switch to non-root user
USER airis

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node dist/health-check.js || exit 1

# Set environment
ENV NODE_ENV=production

# Start application
CMD ["node", "dist/index.js"]
```

### Docker Compose 설정

#### 프로덕션 배포 스크립트

```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

REGISTRY="registry.airis-epm.com"
VERSION=${1:-latest}
ENVIRONMENT=${2:-production}

echo "🚀 Starting AIRIS EPM deployment..."
echo "Registry: $REGISTRY"
echo "Version: $VERSION"
echo "Environment: $ENVIRONMENT"

# Build and push images
echo "📦 Building Docker images..."
docker build -t $REGISTRY/metrics-service:$VERSION services/metrics-service/
docker build -t $REGISTRY/log-service:$VERSION services/log-service/
docker build -t $REGISTRY/trace-service:$VERSION services/trace-service/
docker build -t $REGISTRY/alert-service:$VERSION services/alert-service/

echo "📤 Pushing images to registry..."
docker push $REGISTRY/metrics-service:$VERSION
docker push $REGISTRY/log-service:$VERSION
docker push $REGISTRY/trace-service:$VERSION
docker push $REGISTRY/alert-service:$VERSION

# Deploy to Kubernetes
echo "☸️ Deploying to Kubernetes..."
envsubst < k8s/production.yaml | kubectl apply -f -

echo "✅ Deployment completed successfully!"
```

## ☸️ Kubernetes 배포

### Helm Chart 구성

#### Chart.yaml

```yaml
apiVersion: v2
name: airis-epm
description: AIRIS EPM Microservices Platform
type: application
version: 1.0.0
appVersion: "1.0.0"
home: https://airis-epm.com
maintainers:
  - name: AIRIS Team
    email: team@airis-epm.com
dependencies:
  - name: redis
    version: 17.3.7
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
  - name: clickhouse
    version: 3.1.0
    repository: https://charts.bitnami.com/bitnami
    condition: clickhouse.enabled
```

#### values.yaml

```yaml
# Global settings
global:
  imageRegistry: registry.airis-epm.com
  imagePullSecrets:
    - airis-registry-secret
  storageClass: fast-ssd

# Microservices
metricsService:
  enabled: true
  image:
    repository: airis-epm/metrics-service
    tag: v1.0.0
  replicaCount: 3
  resources:
    requests:
      memory: 2Gi
      cpu: 1000m
    limits:
      memory: 4Gi
      cpu: 2000m
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80

logService:
  enabled: true
  image:
    repository: airis-epm/log-service
    tag: v1.0.0
  replicaCount: 3
  resources:
    requests:
      memory: 2Gi
      cpu: 1000m
    limits:
      memory: 4Gi
      cpu: 2000m

# Infrastructure
redis:
  enabled: true
  auth:
    enabled: true
    password: "secure_redis_password"
  master:
    persistence:
      enabled: true
      size: 20Gi

clickhouse:
  enabled: true
  auth:
    username: admin
    password: "secure_clickhouse_password"
  persistence:
    enabled: true
    size: 500Gi
    storageClass: fast-ssd

# Ingress
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
  hosts:
    - host: api.airis-epm.com
      paths:
        - path: /v1/metrics
          pathType: Prefix
          service: metrics-service
        - path: /v1/logs
          pathType: Prefix
          service: log-service
  tls:
    - secretName: airis-epm-tls
      hosts:
        - api.airis-epm.com
```

## 🔄 CI/CD 파이프라인

### GitHub Actions 워크플로우

```yaml
# .github/workflows/deploy.yml
name: Deploy AIRIS EPM

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: registry.airis-epm.com
  DOCKER_BUILDKIT: 1

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [metrics-service, log-service, trace-service, alert-service]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: services/${{ matrix.service }}/package-lock.json
    
    - name: Install dependencies
      run: |
        cd services/shared && npm ci
        cd ../services/${{ matrix.service }} && npm ci
    
    - name: Run tests
      run: |
        cd services/${{ matrix.service }}
        npm run test:unit
        npm run test:integration
        npm run lint
        npm run typecheck
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: services/${{ matrix.service }}/coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
    strategy:
      matrix:
        service: [metrics-service, log-service, trace-service, alert-service]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Login to Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ secrets.REGISTRY_USERNAME }}
        password: ${{ secrets.REGISTRY_PASSWORD }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ matrix.service }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=sha,prefix={{branch}}-
    
    - name: Build and push
      uses: docker/build-push-action@v5
      with:
        context: services/${{ matrix.service }}
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'
    
    - name: Configure Kubernetes
      run: |
        echo "${{ secrets.KUBE_CONFIG_STAGING }}" | base64 -d > /tmp/kubeconfig
        export KUBECONFIG=/tmp/kubeconfig
    
    - name: Deploy to Staging
      run: |
        export KUBECONFIG=/tmp/kubeconfig
        helm upgrade --install airis-epm ./helm/airis-epm \
          --namespace airis-epm-staging \
          --create-namespace \
          --set global.environment=staging \
          --set metricsService.image.tag=${{ github.sha }} \
          --wait --timeout=10m

  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Kubectl
      uses: azure/setup-kubectl@v3
    
    - name: Deploy to Production
      run: |
        echo "${{ secrets.KUBE_CONFIG_PROD }}" | base64 -d > /tmp/kubeconfig
        export KUBECONFIG=/tmp/kubeconfig
        
        helm upgrade --install airis-epm ./helm/airis-epm \
          --namespace airis-epm \
          --create-namespace \
          --set global.environment=production \
          --set metricsService.image.tag=${GITHUB_REF#refs/tags/} \
          --wait --timeout=15m
```

## 📊 모니터링 및 로깅

### Prometheus 설정

#### ServiceMonitor

```yaml
# monitoring/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: airis-epm-services
  namespace: airis-epm
  labels:
    app: airis-epm
spec:
  selector:
    matchLabels:
      app: metrics-service
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
    honorLabels: true
```

#### PrometheusRule

```yaml
# monitoring/prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: airis-epm-rules
  namespace: airis-epm
spec:
  groups:
  - name: airis-epm.rules
    rules:
    - alert: HighCPUUsage
      expr: cpu_usage_percent > 80
      for: 5m
      labels:
        severity: warning
        service: "{{ $labels.service }}"
      annotations:
        summary: "High CPU usage detected"
        description: "CPU usage is {{ $value }}% on {{ $labels.instance }}"
    
    - alert: HighMemoryUsage
      expr: memory_usage_percent > 85
      for: 3m
      labels:
        severity: critical
        service: "{{ $labels.service }}"
      annotations:
        summary: "High memory usage detected"
        description: "Memory usage is {{ $value }}% on {{ $labels.instance }}"
    
    - alert: ServiceDown
      expr: up == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Service is down"
        description: "{{ $labels.instance }} has been down for more than 1 minute"
```

## 🔒 보안 설정

### Network Policies

```yaml
# security/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: airis-epm-network-policy
  namespace: airis-epm
spec:
  podSelector:
    matchLabels:
      app: metrics-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: airis-epm
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8001
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: airis-epm
    ports:
    - protocol: TCP
      port: 8500  # Consul
    - protocol: TCP
      port: 6379  # Redis
    - protocol: TCP
      port: 8123  # ClickHouse
```

## 💾 백업 및 복구

### 자동화 백업 스크립트

```bash
#!/bin/bash
# scripts/backup-system.sh

set -e

BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
RETENTION_DAYS=30

echo "🔄 Starting AIRIS EPM system backup..."
mkdir -p $BACKUP_DIR

# ClickHouse 백업
echo "📊 Backing up ClickHouse..."
kubectl exec -n airis-epm clickhouse-0 -- clickhouse-client -q "
  BACKUP TABLE metrics TO S3('s3://airis-backups/clickhouse/$(date +%Y%m%d)/metrics', '${AWS_ACCESS_KEY_ID}', '${AWS_SECRET_ACCESS_KEY}')
"

# Elasticsearch 백업
echo "📝 Backing up Elasticsearch..."
kubectl exec -n airis-epm elasticsearch-0 -- curl -X PUT "localhost:9200/_snapshot/s3_repository/$(date +%Y%m%d_%H%M%S)" -H 'Content-Type: application/json' -d'
{
  "indices": "logs-*",
  "ignore_unavailable": true,
  "include_global_state": false
}'

# Redis 백업
echo "💾 Backing up Redis..."
kubectl exec -n airis-epm redis-0 -- redis-cli --rdb /tmp/dump.rdb
kubectl cp airis-epm/redis-0:/tmp/dump.rdb $BACKUP_DIR/redis-dump.rdb

# 설정 백업
echo "⚙️ Backing up configurations..."
kubectl get configmaps -n airis-epm -o yaml > $BACKUP_DIR/configmaps.yaml
kubectl get secrets -n airis-epm -o yaml > $BACKUP_DIR/secrets.yaml

# 오래된 백업 삭제
find /backups -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \;

echo "✅ Backup completed: $BACKUP_DIR"
```

## 🚨 장애 대응

### 자동 복구 스크립트

```bash
#!/bin/bash
# scripts/auto-recovery.sh

SERVICE_NAME=$1
NAMESPACE=${2:-airis-epm}

if [ -z "$SERVICE_NAME" ]; then
    echo "Usage: $0 <service-name> [namespace]"
    exit 1
fi

echo "🚨 Starting auto-recovery for $SERVICE_NAME..."

# 1. 서비스 상태 확인
UNHEALTHY_PODS=$(kubectl get pods -n $NAMESPACE -l app=$SERVICE_NAME -o json | jq -r '.items[] | select(.status.phase != "Running" or (.status.containerStatuses[]?.ready != true)) | .metadata.name')

if [ -n "$UNHEALTHY_PODS" ]; then
    echo "🔧 Found unhealthy pods, restarting..."
    for pod in $UNHEALTHY_PODS; do
        kubectl delete pod $pod -n $NAMESPACE
        echo "♻️ Deleted pod: $pod"
    done
    
    # 파드 재시작 대기
    kubectl wait --for=condition=ready pod -l app=$SERVICE_NAME -n $NAMESPACE --timeout=300s
fi

# 2. 트래픽 재분배
echo "🔄 Redistributing traffic..."
kubectl annotate service $SERVICE_NAME -n $NAMESPACE "last-restart=$(date)" --overwrite

# 3. 헬스체크 확인
echo "🏥 Running health checks..."
SERVICE_IP=$(kubectl get svc $SERVICE_NAME -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
SERVICE_PORT=$(kubectl get svc $SERVICE_NAME -n $NAMESPACE -o jsonpath='{.spec.ports[0].port}')

for i in {1..5}; do
    if curl -f http://$SERVICE_IP:$SERVICE_PORT/health; then
        echo "✅ Health check passed"
        break
    else
        echo "❌ Health check failed, retry $i/5"
        sleep 10
    fi
done

echo "✅ Auto-recovery completed for $SERVICE_NAME"
```

### 장애 대응 플레이북

#### 서비스 다운 대응

```bash
# 1. 즉시 확인사항
kubectl get pods -n airis-epm
kubectl get svc -n airis-epm
kubectl describe pod <failing-pod> -n airis-epm

# 2. 로그 분석
kubectl logs <pod-name> -n airis-epm --tail=100
kubectl logs <pod-name> -n airis-epm --previous

# 3. 리소스 확인
kubectl top pods -n airis-epm
kubectl describe hpa -n airis-epm

# 4. 트래픽 차단 (필요시)
kubectl scale deployment/<service-name> --replicas=0 -n airis-epm

# 5. 긴급 복구
kubectl rollout restart deployment/<service-name> -n airis-epm
kubectl rollout status deployment/<service-name> -n airis-epm
```

## 🔧 운영 스크립트

### 배포 스크립트

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}

echo "🚀 Deploying AIRIS EPM to $ENVIRONMENT..."

# 환경별 설정
case $ENVIRONMENT in
    "development")
        NAMESPACE="airis-epm-dev"
        REPLICAS=1
        ;;
    "staging")
        NAMESPACE="airis-epm-staging" 
        REPLICAS=2
        ;;
    "production")
        NAMESPACE="airis-epm"
        REPLICAS=3
        ;;
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Helm 배포
helm upgrade --install airis-epm ./helm/airis-epm \
    --namespace $NAMESPACE \
    --create-namespace \
    --set global.environment=$ENVIRONMENT \
    --set metricsService.replicaCount=$REPLICAS \
    --set logService.replicaCount=$REPLICAS \
    --set traceService.replicaCount=$REPLICAS \
    --set alertService.replicaCount=$REPLICAS \
    --wait --timeout=10m

echo "✅ Deployment completed successfully!"
```

이 배포 가이드는 AIRIS EPM 마이크로서비스 시스템의 포괄적인 배포 전략과 운영 절차를 제공합니다. 각 환경별 특성에 맞는 설정과 자동화된 배포 파이프라인을 통해 안정적인 서비스 운영을 지원합니다.