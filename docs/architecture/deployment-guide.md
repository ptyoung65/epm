# AIRIS-MON Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying AIRIS-MON in various environments, from development to production-scale deployments. The deployment strategy follows cloud-native best practices with containerization, orchestration, and infrastructure as code.

## Prerequisites

### System Requirements

#### Minimum Requirements (Development)
```yaml
Development Environment:
  CPU: 4 cores
  Memory: 8 GB RAM
  Storage: 50 GB SSD
  OS: Linux (Ubuntu 20.04+), macOS 11+, Windows 10+ with WSL2
  
Container Runtime:
  Docker: 20.10+
  Docker Compose: 2.0+
```

#### Recommended Requirements (Staging)
```yaml
Staging Environment:
  CPU: 8 cores
  Memory: 16 GB RAM
  Storage: 200 GB SSD
  Network: 1 Gbps
  
Kubernetes Cluster:
  Nodes: 3 nodes minimum
  Node Resources: 4 CPU, 8 GB RAM each
  Storage: Persistent volumes supported
```

#### Production Requirements
```yaml
Production Environment:
  CPU: 32+ cores (across cluster)
  Memory: 64+ GB RAM (across cluster)
  Storage: 1+ TB SSD with backup
  Network: 10+ Gbps with redundancy
  
Kubernetes Cluster:
  Master Nodes: 3 (HA setup)
  Worker Nodes: 5+ nodes
  Node Resources: 8 CPU, 16 GB RAM minimum per node
  Storage: CSI-compliant persistent storage
  
Database Requirements:
  PostgreSQL: 4 CPU, 8 GB RAM, 500 GB storage
  InfluxDB: 4 CPU, 8 GB RAM, 1 TB storage
  Redis: 2 CPU, 4 GB RAM, 100 GB storage
  MongoDB: 2 CPU, 4 GB RAM, 200 GB storage
```

### Software Dependencies

```yaml
Required Software:
  Container Platform:
    - Docker Engine 20.10+
    - Kubernetes 1.24+
    - Helm 3.8+
    
  Infrastructure Tools:
    - Terraform 1.3+
    - Ansible 2.12+ (optional)
    - Git 2.30+
    
  Development Tools:
    - Node.js 18+ LTS
    - Python 3.10+
    - Go 1.19+ (for Kubernetes tools)
```

## Environment Setup

### Development Environment

#### Docker Compose Setup
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # Database Services
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: airis_mon_dev
      POSTGRES_USER: airis_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U airis_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  influxdb:
    image: influxdb:2.7-alpine
    ports:
      - "8086:8086"
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: admin
      DOCKER_INFLUXDB_INIT_PASSWORD: adminpassword
      DOCKER_INFLUXDB_INIT_ORG: airis-mon
      DOCKER_INFLUXDB_INIT_BUCKET: metrics
    volumes:
      - influxdb_data:/var/lib/influxdb2
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8086/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  mongodb:
    image: mongo:7-jammy
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: adminpassword
      MONGO_INITDB_DATABASE: airis_mon
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  # Message Queue Services
  kafka:
    image: confluentinc/cp-kafka:7.4.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: true
    healthcheck:
      test: kafka-topics --bootstrap-server localhost:9092 --list
      interval: 10s
      timeout: 5s
      retries: 5

  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: adminpassword
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 30s
      timeout: 30s
      retries: 3

  # Application Services
  api-gateway:
    build:
      context: ./src/api-gateway
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://airis_user:dev_password@postgres:5432/airis_mon_dev
      REDIS_URL: redis://redis:6379
      KAFKA_BROKERS: kafka:9092
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      kafka:
        condition: service_healthy
    volumes:
      - ./src/api-gateway:/app
      - /app/node_modules

  data-ingestion:
    build:
      context: ./src/data-ingestion
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: development
      INFLUXDB_URL: http://influxdb:8086
      KAFKA_BROKERS: kafka:9092
    depends_on:
      influxdb:
        condition: service_healthy
      kafka:
        condition: service_healthy
    volumes:
      - ./src/data-ingestion:/app
      - /app/node_modules

  analytics-engine:
    build:
      context: ./src/analytics-engine
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    environment:
      PYTHONPATH: /app
      DATABASE_URL: postgresql://airis_user:dev_password@postgres:5432/airis_mon_dev
      INFLUXDB_URL: http://influxdb:8086
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      influxdb:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./src/analytics-engine:/app

  web-ui:
    build:
      context: ./src/web-ui
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:3000/api
      REACT_APP_WS_URL: ws://localhost:3000/ws
    volumes:
      - ./src/web-ui:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
  influxdb_data:
  mongodb_data:
  rabbitmq_data:

networks:
  default:
    name: airis-mon-dev
```

#### Development Startup Script
```bash
#!/bin/bash
# scripts/dev-setup.sh

echo "🚀 Starting AIRIS-MON Development Environment"

# Check prerequisites
echo "Checking prerequisites..."
docker --version || { echo "Docker is required"; exit 1; }
docker-compose --version || { echo "Docker Compose is required"; exit 1; }
node --version || { echo "Node.js is required"; exit 1; }
python3 --version || { echo "Python 3 is required"; exit 1; }

# Create necessary directories
mkdir -p data/{logs,metrics,backups}
mkdir -p config/{secrets,certificates}

# Generate development certificates
echo "Generating development certificates..."
openssl req -x509 -newkey rsa:4096 -keyout config/certificates/dev-key.pem \
    -out config/certificates/dev-cert.pem -days 365 -nodes \
    -subj "/C=US/ST=CA/L=SF/O=AIRIS-MON/OU=Development/CN=localhost"

# Start services
echo "Starting services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Initialize database
echo "Initializing database..."
docker-compose -f docker-compose.dev.yml exec postgres psql -U airis_user -d airis_mon_dev -c "\l"

# Create Kafka topics
echo "Creating Kafka topics..."
docker-compose -f docker-compose.dev.yml exec kafka kafka-topics \
    --create --bootstrap-server localhost:9092 \
    --topic airis-mon.metrics.raw.v1 --partitions 3 --replication-factor 1

docker-compose -f docker-compose.dev.yml exec kafka kafka-topics \
    --create --bootstrap-server localhost:9092 \
    --topic airis-mon.events.raw.v1 --partitions 3 --replication-factor 1

# Install dependencies
echo "Installing Node.js dependencies..."
cd src/api-gateway && npm install && cd ../..
cd src/data-ingestion && npm install && cd ../..
cd src/web-ui && npm install && cd ../..

echo "Installing Python dependencies..."
cd src/analytics-engine && pip install -r requirements.txt && cd ../..

echo "✅ Development environment ready!"
echo "🌐 Web UI: http://localhost:3000"
echo "🔧 API Gateway: http://localhost:3000/api"
echo "📊 RabbitMQ Management: http://localhost:15672 (admin/adminpassword)"
echo "📈 InfluxDB: http://localhost:8086 (admin/adminpassword)"
```

### Staging Environment

#### Kubernetes Deployment
```yaml
# k8s/staging/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: airis-mon-staging
  labels:
    environment: staging
    project: airis-mon

---
# k8s/staging/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: airis-mon-config
  namespace: airis-mon-staging
data:
  NODE_ENV: "staging"
  LOG_LEVEL: "info"
  KAFKA_BROKERS: "kafka.airis-mon-staging.svc.cluster.local:9092"
  REDIS_URL: "redis://redis.airis-mon-staging.svc.cluster.local:6379"
  DATABASE_URL: "postgresql://airis_user:$(DB_PASSWORD)@postgres.airis-mon-staging.svc.cluster.local:5432/airis_mon_staging"
  INFLUXDB_URL: "http://influxdb.airis-mon-staging.svc.cluster.local:8086"

---
# k8s/staging/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: airis-mon-secrets
  namespace: airis-mon-staging
type: Opaque
data:
  DB_PASSWORD: YWlyaXNfdXNlcl9wYXNzd29yZA==  # base64 encoded
  JWT_SECRET: c3VwZXItc2VjdXJlLWp3dC1zZWNyZXQ=
  ENCRYPTION_KEY: ZW5jcnlwdGlvbi1rZXktMzItYnl0ZXM=
```

#### Database Deployment
```yaml
# k8s/staging/postgres.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: airis-mon-staging
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: airis_mon_staging
        - name: POSTGRES_USER
          value: airis_user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: airis-mon-secrets
              key: DB_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - airis_user
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - airis_user
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: airis-mon-staging
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: airis-mon-staging
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: ssd
```

#### Application Deployment
```yaml
# k8s/staging/api-gateway.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: airis-mon-staging
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
        version: v1
    spec:
      containers:
      - name: api-gateway
        image: airis-mon/api-gateway:staging
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: airis-mon-config
        - secretRef:
            name: airis-mon-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
              - ALL

---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: airis-mon-staging
spec:
  selector:
    app: api-gateway
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway-ingress
  namespace: airis-mon-staging
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api-staging.airis-mon.example.com
    secretName: api-gateway-tls
  rules:
  - host: api-staging.airis-mon.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 80
```

### Production Environment

#### Terraform Infrastructure
```hcl
# infrastructure/terraform/main.tf
terraform {
  required_version = ">= 1.3"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.16"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.8"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "airis-mon"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "~> 3.18"

  name = "${var.project_name}-${var.environment}-vpc"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway   = true
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }

  public_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                    = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"           = "1"
  }
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = var.cluster_name
  cluster_version = var.kubernetes_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true
  cluster_endpoint_public_access_cidrs = var.allowed_cidrs

  eks_managed_node_groups = {
    main = {
      desired_size = var.node_group_desired_size
      max_size     = var.node_group_max_size
      min_size     = var.node_group_min_size

      instance_types = var.node_instance_types
      capacity_type  = "ON_DEMAND"

      ami_type = "AL2_x86_64"
      platform = "linux"

      tags = {
        Environment = var.environment
        Application = "airis-mon"
      }
    }
  }

  # IRSA for service accounts
  enable_irsa = true

  tags = {
    Environment = var.environment
    Application = "airis-mon"
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier = "${var.project_name}-${var.environment}-postgres"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type         = "gp3"
  storage_encrypted    = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = var.db_backup_retention_days
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  skip_final_snapshot = var.environment != "production"
  deletion_protection = var.environment == "production"

  performance_insights_enabled = true
  monitoring_interval         = 60

  tags = {
    Name        = "${var.project_name}-${var.environment}-postgres"
    Environment = var.environment
  }
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-${var.environment}-redis"
  description                = "Redis cluster for AIRIS-MON"

  port                = 6379
  parameter_group_name = "default.redis7"
  node_type           = var.redis_node_type
  num_cache_clusters  = var.redis_num_cache_nodes

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = var.redis_num_cache_nodes > 1
  multi_az_enabled          = var.redis_num_cache_nodes > 1

  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis"
    Environment = var.environment
  }
}

# S3 Bucket for data storage
resource "aws_s3_bucket" "data_storage" {
  bucket = "${var.project_name}-${var.environment}-data-storage"
}

resource "aws_s3_bucket_versioning" "data_storage" {
  bucket = aws_s3_bucket.data_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "data_storage" {
  bucket = aws_s3_bucket.data_storage.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "data_storage" {
  bucket = aws_s3_bucket.data_storage.id

  rule {
    id     = "transition_to_ia"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
  }
}
```

#### Helm Chart Deployment
```yaml
# helm/airis-mon/values.production.yaml
global:
  environment: production
  imageRegistry: your-registry.com/airis-mon
  imageTag: "v1.0.0"
  
  ingress:
    enabled: true
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
      nginx.ingress.kubernetes.io/rate-limit: "1000"
      nginx.ingress.kubernetes.io/ssl-redirect: "true"
    hosts:
      - host: airis-mon.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: airis-mon-tls
        hosts:
          - airis-mon.example.com

  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "1000m"

  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80

apiGateway:
  replicaCount: 3
  image:
    repository: your-registry.com/airis-mon/api-gateway
    tag: "v1.0.0"
  
  service:
    type: ClusterIP
    port: 80

  config:
    NODE_ENV: production
    LOG_LEVEL: info
    DATABASE_URL: "postgresql://$(DB_USER):$(DB_PASSWORD)@airis-mon-postgres:5432/airis_mon"
    REDIS_URL: "redis://airis-mon-redis:6379"

dataIngestion:
  replicaCount: 5
  image:
    repository: your-registry.com/airis-mon/data-ingestion
    tag: "v1.0.0"
    
  resources:
    requests:
      memory: "2Gi"
      cpu: "1000m"
    limits:
      memory: "4Gi"
      cpu: "2000m"

analyticsEngine:
  replicaCount: 3
  image:
    repository: your-registry.com/airis-mon/analytics-engine
    tag: "v1.0.0"
    
  resources:
    requests:
      memory: "4Gi"
      cpu: "2000m"
    limits:
      memory: "8Gi"
      cpu: "4000m"

postgresql:
  enabled: false  # Using external RDS instance
  external:
    host: airis-mon-prod-postgres.cluster-xyz.us-west-2.rds.amazonaws.com
    port: 5432
    database: airis_mon
    existingSecret: airis-mon-postgres-secret

redis:
  enabled: false  # Using external ElastiCache
  external:
    host: airis-mon-prod-redis.xyz.cache.amazonaws.com
    port: 6379

kafka:
  enabled: true
  replicaCount: 3
  
  configurationOverrides:
    num.network.threads: 8
    num.io.threads: 16
    default.replication.factor: 3
    min.insync.replicas: 2
    
  persistence:
    enabled: true
    size: 100Gi
    storageClass: gp3
    
  resources:
    requests:
      memory: "4Gi"
      cpu: "2000m"
    limits:
      memory: "8Gi"
      cpu: "4000m"

influxdb:
  enabled: true
  image:
    tag: "2.7-alpine"
    
  persistence:
    enabled: true
    size: 1Ti
    storageClass: gp3
    
  resources:
    requests:
      memory: "4Gi"
      cpu: "2000m"
    limits:
      memory: "8Gi"
      cpu: "4000m"

monitoring:
  prometheus:
    enabled: true
  grafana:
    enabled: true
    adminPassword: changeme
  jaeger:
    enabled: true
```

## Deployment Procedures

### CI/CD Pipeline

#### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy AIRIS-MON

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        cd src/api-gateway && npm ci
        cd ../data-ingestion && npm ci
        cd ../web-ui && npm ci
    
    - name: Run tests
      run: |
        cd src/api-gateway && npm test
        cd ../data-ingestion && npm test
        cd ../web-ui && npm test
    
    - name: Run security scan
      uses: securecodewarrior/github-action-add-sarif@v1
      with:
        sarif-file: security-scan-results.sarif

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}
    
    - name: Build and push Docker images
      run: |
        docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api-gateway:${{ steps.meta.outputs.tags }} src/api-gateway
        docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api-gateway:${{ steps.meta.outputs.tags }}
        
        docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/data-ingestion:${{ steps.meta.outputs.tags }} src/data-ingestion
        docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/data-ingestion:${{ steps.meta.outputs.tags }}
        
        docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/analytics-engine:${{ steps.meta.outputs.tags }} src/analytics-engine
        docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/analytics-engine:${{ steps.meta.outputs.tags }}
        
        docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/web-ui:${{ steps.meta.outputs.tags }} src/web-ui
        docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/web-ui:${{ steps.meta.outputs.tags }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging'
    environment: staging
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name airis-mon-staging-cluster
    
    - name: Deploy to staging
      run: |
        helm upgrade --install airis-mon ./helm/airis-mon \
          --namespace airis-mon-staging \
          --create-namespace \
          --values ./helm/airis-mon/values.staging.yaml \
          --set global.imageTag=${{ github.sha }} \
          --wait --timeout=10m

  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name airis-mon-production-cluster
    
    - name: Deploy to production
      run: |
        helm upgrade --install airis-mon ./helm/airis-mon \
          --namespace airis-mon-production \
          --create-namespace \
          --values ./helm/airis-mon/values.production.yaml \
          --set global.imageTag=${{ github.sha }} \
          --wait --timeout=15m
    
    - name: Run smoke tests
      run: |
        kubectl wait --for=condition=ready pod -l app=airis-mon -n airis-mon-production --timeout=300s
        curl -f https://airis-mon.example.com/health || exit 1
```

### Deployment Scripts

#### Production Deployment Script
```bash
#!/bin/bash
# scripts/deploy-production.sh

set -euo pipefail

# Configuration
ENVIRONMENT="production"
NAMESPACE="airis-mon-production"
CLUSTER_NAME="airis-mon-production-cluster"
AWS_REGION="us-west-2"
HELM_CHART_PATH="./helm/airis-mon"

echo "🚀 Starting AIRIS-MON Production Deployment"

# Pre-deployment checks
echo "Performing pre-deployment checks..."

# Check if all required tools are installed
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "Helm is required"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required"; exit 1; }

# Check AWS credentials
aws sts get-caller-identity > /dev/null || { echo "AWS credentials not configured"; exit 1; }

# Update kubeconfig
echo "Updating kubeconfig..."
aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME

# Verify cluster connectivity
echo "Verifying cluster connectivity..."
kubectl cluster-info > /dev/null || { echo "Cannot connect to cluster"; exit 1; }

# Create namespace if it doesn't exist
echo "Creating namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Apply secrets
echo "Applying secrets..."
kubectl apply -f k8s/production/secrets.yaml -n $NAMESPACE

# Install/upgrade cert-manager if not present
echo "Installing cert-manager..."
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --create-namespace \
    --version v1.13.0 \
    --set installCRDs=true

# Install/upgrade ingress-nginx if not present
echo "Installing ingress-nginx..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --create-namespace \
    --set controller.service.type=LoadBalancer

# Deploy AIRIS-MON
echo "Deploying AIRIS-MON..."
helm upgrade --install airis-mon $HELM_CHART_PATH \
    --namespace $NAMESPACE \
    --values $HELM_CHART_PATH/values.production.yaml \
    --set global.imageTag=${IMAGE_TAG:-latest} \
    --wait --timeout=15m

# Wait for rollout to complete
echo "Waiting for rollout to complete..."
kubectl rollout status deployment/api-gateway -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/data-ingestion -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/analytics-engine -n $NAMESPACE --timeout=300s

# Run health checks
echo "Running health checks..."
sleep 30

# Get the load balancer URL
LB_URL=$(kubectl get ingress airis-mon-ingress -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Load Balancer URL: https://$LB_URL"

# Health check
curl -f https://$LB_URL/health || { echo "Health check failed"; exit 1; }

echo "✅ Deployment completed successfully!"
echo "🌐 Application URL: https://$LB_URL"
echo "📊 Grafana: https://$LB_URL/grafana"
echo "📈 Metrics: https://$LB_URL/metrics"
```

### Rollback Procedures

#### Automated Rollback Script
```bash
#!/bin/bash
# scripts/rollback.sh

set -euo pipefail

NAMESPACE=${1:-airis-mon-production}
REVISION=${2:-0}  # 0 means previous revision

echo "🔄 Rolling back AIRIS-MON in namespace: $NAMESPACE"

if [ "$REVISION" = "0" ]; then
    echo "Rolling back to previous revision..."
    helm rollback airis-mon --namespace $NAMESPACE
else
    echo "Rolling back to revision: $REVISION"
    helm rollback airis-mon $REVISION --namespace $NAMESPACE
fi

# Wait for rollout
echo "Waiting for rollout to complete..."
kubectl rollout status deployment/api-gateway -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/data-ingestion -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/analytics-engine -n $NAMESPACE --timeout=300s

# Verify health
echo "Verifying application health..."
sleep 30

LB_URL=$(kubectl get ingress airis-mon-ingress -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
curl -f https://$LB_URL/health || { echo "Health check failed after rollback"; exit 1; }

echo "✅ Rollback completed successfully!"
```

## Monitoring & Maintenance

### Health Check Endpoints

#### Application Health Checks
```javascript
// src/api-gateway/routes/health.js
const express = require('express');
const router = express.Router();

// Basic health check
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || 'unknown'
    });
});

// Detailed readiness check
router.get('/ready', async (req, res) => {
    const checks = {
        database: await checkDatabase(),
        redis: await checkRedis(),
        kafka: await checkKafka(),
        external_apis: await checkExternalAPIs()
    };
    
    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
    
    res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'ready' : 'not_ready',
        checks,
        timestamp: new Date().toISOString()
    });
});

async function checkDatabase() {
    try {
        await db.raw('SELECT 1');
        return { status: 'healthy', latency: Date.now() - start };
    } catch (error) {
        return { status: 'unhealthy', error: error.message };
    }
}
```

### Backup Procedures

#### Database Backup Script
```bash
#!/bin/bash
# scripts/backup-database.sh

set -euo pipefail

NAMESPACE="airis-mon-production"
BACKUP_BUCKET="airis-mon-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🗄️ Starting database backup..."

# Create database dump
kubectl exec -n $NAMESPACE deployment/postgres -- pg_dump -U airis_user airis_mon > backup_${TIMESTAMP}.sql

# Compress backup
gzip backup_${TIMESTAMP}.sql

# Upload to S3
aws s3 cp backup_${TIMESTAMP}.sql.gz s3://$BACKUP_BUCKET/database/

# Clean up local file
rm backup_${TIMESTAMP}.sql.gz

# Remove backups older than 30 days
aws s3 ls s3://$BACKUP_BUCKET/database/ | \
    awk '$1 <= "'$(date -d '30 days ago' '+%Y-%m-%d')'" {print $4}' | \
    xargs -I {} aws s3 rm s3://$BACKUP_BUCKET/database/{}

echo "✅ Database backup completed: backup_${TIMESTAMP}.sql.gz"
```

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-01  
**Next Review**: 2024-04-01  
**Owner**: DevOps Team