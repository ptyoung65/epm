# AIRIS-MON AIOps/MLOps 배포 가이드

## 개요

이 가이드는 AIRIS-MON AIOps/MLOps 시스템의 배포 과정을 단계별로 설명합니다.

## 사전 요구사항

### 시스템 요구사항
- **Node.js**: 18.0.0 이상
- **NPM**: 8.0.0 이상
- **메모리**: 최소 4GB RAM (권장: 8GB 이상)
- **디스크**: 최소 10GB 여유 공간
- **CPU**: 2코어 이상 (권장: 4코어 이상)

### 필수 서비스
- **ClickHouse**: 23.0 이상
- **Redis**: 6.0 이상
- **PostgreSQL**: 12.0 이상 (선택사항)

### 선택적 서비스
- **Ollama**: 로컬 LLM 모델용
- **Grafana**: 대시보드 및 시각화
- **Alert Manager**: 알림 관리

## 설치 과정

### 1. 저장소 클론 및 의존성 설치

```bash
# 저장소 클론
git clone <repository-url>
cd airis-mon

# 의존성 설치
npm install

# TypeScript 컴파일
npm run build
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```bash
# 기본 설정
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# 데이터베이스 설정
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DB=aiops
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# AI 서비스 설정
OLLAMA_BASE_URL=http://localhost:11434
GEMINI_API_KEY=your_gemini_api_key_here

# 선택적 서비스
GRAFANA_URL=http://localhost:3000
GRAFANA_API_KEY=your_grafana_api_key

ALERT_MANAGER_URL=http://localhost:9093
ALERT_MANAGER_API_KEY=your_alert_manager_api_key

# 보안 설정
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
ENCRYPTION_KEY_PATH=/path/to/encryption/key
```

### 3. 데이터베이스 초기화

#### ClickHouse 설정
```sql
-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS aiops;

-- 사용자 생성 (필요한 경우)
CREATE USER aiops_user IDENTIFIED BY 'secure_password';
GRANT ALL ON aiops.* TO aiops_user;
```

#### Redis 설정
```bash
# Redis 서버 시작
redis-server /etc/redis/redis.conf

# 메모리 정책 설정
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 2gb
```

### 4. 디렉토리 구조 생성

```bash
# AIOps 데이터 디렉토리 생성
mkdir -p data/aiops
mkdir -p models/aiops
mkdir -p pipelines/aiops
mkdir -p config/aiops
mkdir -p logs

# 권한 설정
chmod 755 data models pipelines config
chmod 644 logs
```

### 5. 설정 파일 생성

`config/aiops/aiops.config.json` 파일을 생성하세요:

```json
{
  "version": "1.0.0",
  "environment": "production",
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "models": ["llama2", "codellama", "mistral"],
    "timeout": 30000,
    "maxRetries": 3,
    "streamingEnabled": true
  },
  "gemini": {
    "apiKey": "${GEMINI_API_KEY}",
    "model": "gemini-1.5-flash",
    "temperature": 0.7,
    "maxTokens": 2048,
    "safetySettings": {
      "HARM_CATEGORY_HARASSMENT": "BLOCK_MEDIUM_AND_ABOVE",
      "HARM_CATEGORY_HATE_SPEECH": "BLOCK_MEDIUM_AND_ABOVE",
      "HARM_CATEGORY_SEXUALLY_EXPLICIT": "BLOCK_MEDIUM_AND_ABOVE",
      "HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_MEDIUM_AND_ABOVE"
    }
  },
  "mlops": {
    "dataPath": "./data/aiops",
    "modelPath": "./models/aiops",
    "pipelinePath": "./pipelines/aiops",
    "autoRetrain": true,
    "retrainThreshold": 0.1,
    "validationSplit": 0.2
  },
  "analytics": {
    "realTimeWindow": 300000,
    "anomalyThreshold": 2.5,
    "statisticalMethods": ["zscore", "iqr", "isolation_forest"],
    "timeSeriesEnabled": true
  },
  "monitoring": {
    "clickhouse": {
      "host": "${CLICKHOUSE_HOST}",
      "port": "${CLICKHOUSE_PORT}",
      "database": "${CLICKHOUSE_DB}",
      "username": "${CLICKHOUSE_USER}",
      "password": "${CLICKHOUSE_PASSWORD}"
    },
    "redis": {
      "host": "${REDIS_HOST}",
      "port": "${REDIS_PORT}",
      "password": "${REDIS_PASSWORD}",
      "database": "${REDIS_DB}"
    },
    "alertManager": {
      "url": "${ALERT_MANAGER_URL}",
      "apiKey": "${ALERT_MANAGER_API_KEY}"
    },
    "grafana": {
      "url": "${GRAFANA_URL}",
      "apiKey": "${GRAFANA_API_KEY}"
    }
  },
  "agents": {
    "knowledgeCollector": {
      "enabled": true,
      "maxAgents": 10,
      "defaultInterval": 60000
    }
  },
  "security": {
    "encryption": {
      "enabled": true,
      "algorithm": "aes-256-gcm",
      "keyPath": "${ENCRYPTION_KEY_PATH}"
    },
    "rateLimit": {
      "enabled": true,
      "windowMs": 60000,
      "maxRequests": 100
    }
  },
  "performance": {
    "batchSize": 1000,
    "flushInterval": 5000,
    "maxMemoryUsage": 536870912,
    "enableCaching": true
  }
}
```

## 배포 방법

### 방법 1: 직접 배포

```bash
# 애플리케이션 시작
npm start

# PM2를 사용한 프로세스 관리
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 방법 2: Docker 배포

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 애플리케이션 코드 복사
COPY . .

# TypeScript 컴파일
RUN npm run build

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/aiops/health || exit 1

# 애플리케이션 시작
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  airis-mon:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CLICKHOUSE_HOST=clickhouse
      - REDIS_HOST=redis
    depends_on:
      - clickhouse
      - redis
    volumes:
      - ./data:/app/data
      - ./models:/app/models
      - ./logs:/app/logs
    restart: unless-stopped

  clickhouse:
    image: yandex/clickhouse-server:latest
    ports:
      - "8123:8123"
      - "9000:9000"
    environment:
      - CLICKHOUSE_DB=aiops
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

volumes:
  clickhouse_data:
  redis_data:
  ollama_data:
```

### 방법 3: Kubernetes 배포

#### ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: aiops-config
data:
  aiops.config.json: |
    {
      "version": "1.0.0",
      "environment": "production",
      "analytics": {
        "realTimeWindow": 300000,
        "anomalyThreshold": 2.5,
        "statisticalMethods": ["zscore", "iqr", "isolation_forest"],
        "timeSeriesEnabled": true
      }
    }
```

#### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: airis-mon-aiops
  labels:
    app: airis-mon-aiops
spec:
  replicas: 3
  selector:
    matchLabels:
      app: airis-mon-aiops
  template:
    metadata:
      labels:
        app: airis-mon-aiops
    spec:
      containers:
      - name: aiops
        image: airis-mon:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: CLICKHOUSE_HOST
          value: "clickhouse-service"
        - name: REDIS_HOST
          value: "redis-service"
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: aiops-secrets
              key: gemini-api-key
        volumeMounts:
        - name: config
          mountPath: /app/config/aiops
        - name: data
          mountPath: /app/data
        - name: models
          mountPath: /app/models
        livenessProbe:
          httpGet:
            path: /api/v1/aiops/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/aiops/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      volumes:
      - name: config
        configMap:
          name: aiops-config
      - name: data
        persistentVolumeClaim:
          claimName: aiops-data-pvc
      - name: models
        persistentVolumeClaim:
          claimName: aiops-models-pvc
```

#### Service
```yaml
apiVersion: v1
kind: Service
metadata:
  name: airis-mon-aiops-service
spec:
  selector:
    app: airis-mon-aiops
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

## 모니터링 및 로깅

### 1. 애플리케이션 로그

```bash
# 로그 파일 위치
tail -f logs/app.log
tail -f logs/error.log

# Docker 로그
docker logs -f airis-mon

# Kubernetes 로그
kubectl logs -f deployment/airis-mon-aiops
```

### 2. 헬스체크

```bash
# 기본 헬스체크
curl http://localhost:3000/api/v1/aiops/health

# 상세 상태 확인
curl http://localhost:3000/api/v1/aiops/status
```

### 3. 메트릭 수집

```bash
# Prometheus 메트릭
curl http://localhost:3000/metrics

# 시스템 메트릭
curl http://localhost:3000/api/v1/aiops/status | jq '.systemMetrics'
```

## 성능 최적화

### 1. 메모리 최적화

```javascript
// Node.js 메모리 설정
node --max-old-space-size=4096 dist/index.js

// PM2 설정
{
  "apps": [{
    "name": "airis-mon",
    "script": "dist/index.js",
    "node_args": "--max-old-space-size=4096",
    "instances": "max",
    "exec_mode": "cluster"
  }]
}
```

### 2. 데이터베이스 최적화

#### ClickHouse 최적화
```sql
-- 파티션 설정
ALTER TABLE aiops_metrics 
MODIFY TTL timestamp + INTERVAL 90 DAY DELETE;

-- 인덱스 최적화
ALTER TABLE aiops_metrics 
ADD INDEX idx_metric_name metric_name TYPE bloom_filter GRANULARITY 1;

-- 압축 설정
ALTER TABLE aiops_metrics 
MODIFY SETTING index_granularity = 8192;
```

#### Redis 최적화
```bash
# 메모리 정책
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 2gb

# 압축 설정
redis-cli CONFIG SET list-compress-depth 1
redis-cli CONFIG SET hash-max-ziplist-entries 512
```

### 3. 네트워크 최적화

```nginx
# Nginx 설정
upstream airis_mon {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name airis-mon.example.com;

    location /api/v1/aiops/ {
        proxy_pass http://airis_mon;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 버퍼링 설정
        proxy_buffering on;
        proxy_buffer_size 8k;
        proxy_buffers 8 8k;
        
        # 타임아웃 설정
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
    }
}
```

## 보안 설정

### 1. 네트워크 보안

```bash
# 방화벽 설정
ufw allow 3000/tcp  # AIOps API
ufw allow 8123/tcp  # ClickHouse (내부 네트워크만)
ufw allow 6379/tcp  # Redis (내부 네트워크만)
ufw deny 11434/tcp  # Ollama (로컬만)
```

### 2. 암호화 키 생성

```bash
# 암호화 키 생성
openssl rand -base64 32 > /etc/airis-mon/encryption.key
chmod 600 /etc/airis-mon/encryption.key
chown airis-mon:airis-mon /etc/airis-mon/encryption.key
```

### 3. SSL/TLS 설정

```bash
# Let's Encrypt 인증서
certbot certonly --nginx -d airis-mon.example.com

# Nginx SSL 설정
server {
    listen 443 ssl http2;
    server_name airis-mon.example.com;
    
    ssl_certificate /etc/letsencrypt/live/airis-mon.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/airis-mon.example.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://airis_mon;
    }
}
```

## 백업 및 복구

### 1. 데이터 백업

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/airis-mon/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# ClickHouse 백업
clickhouse-client --query "BACKUP TABLE aiops.aiops_metrics TO Disk('backup', '$BACKUP_DIR/clickhouse/')"

# Redis 백업
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb $BACKUP_DIR/redis/

# 설정 파일 백업
tar -czf $BACKUP_DIR/config.tar.gz config/

# 모델 및 데이터 백업
tar -czf $BACKUP_DIR/models.tar.gz models/
tar -czf $BACKUP_DIR/data.tar.gz data/

echo "Backup completed: $BACKUP_DIR"
```

### 2. 복구 절차

```bash
#!/bin/bash
# restore.sh

BACKUP_DIR=$1
if [ -z "$BACKUP_DIR" ]; then
    echo "Usage: $0 <backup_directory>"
    exit 1
fi

# 서비스 중지
systemctl stop airis-mon

# 설정 복구
tar -xzf $BACKUP_DIR/config.tar.gz

# 데이터 복구
tar -xzf $BACKUP_DIR/models.tar.gz
tar -xzf $BACKUP_DIR/data.tar.gz

# Redis 복구
systemctl stop redis
cp $BACKUP_DIR/redis/dump.rdb /var/lib/redis/
systemctl start redis

# ClickHouse 복구
clickhouse-client --query "RESTORE TABLE aiops.aiops_metrics FROM Disk('backup', '$BACKUP_DIR/clickhouse/')"

# 서비스 시작
systemctl start airis-mon

echo "Restore completed from: $BACKUP_DIR"
```

## 문제 해결

### 1. 일반적인 문제

#### 서비스 시작 실패
```bash
# 로그 확인
journalctl -u airis-mon -f

# 포트 확인
netstat -tulpn | grep :3000

# 의존성 확인
npm ls
```

#### 메모리 부족
```bash
# 메모리 사용량 확인
free -h
ps aux --sort=-%mem | head

# Node.js 메모리 제한 증가
export NODE_OPTIONS="--max-old-space-size=8192"
```

#### 데이터베이스 연결 실패
```bash
# ClickHouse 연결 테스트
clickhouse-client --host localhost --port 8123 --query "SELECT 1"

# Redis 연결 테스트
redis-cli ping
```

### 2. 성능 문제

#### 느린 응답 시간
```bash
# CPU 사용률 확인
top -p $(pgrep -f airis-mon)

# 네트워크 지연 확인
ping clickhouse-server
ping redis-server

# 쿼리 성능 분석
clickhouse-client --query "SHOW PROCESSLIST"
```

#### 높은 메모리 사용량
```bash
# 메모리 프로파일링
node --inspect dist/index.js

# 가비지 컬렉션 모니터링
node --trace-gc dist/index.js
```

## 업그레이드 가이드

### 1. 애플리케이션 업그레이드

```bash
# 현재 버전 백업
cp -r . /backup/airis-mon-$(date +%Y%m%d)

# 새 버전 다운로드
git pull origin main

# 의존성 업데이트
npm ci

# 데이터베이스 마이그레이션 (필요한 경우)
npm run migrate

# 컴파일
npm run build

# 서비스 재시작
pm2 restart airis-mon
```

### 2. Zero-downtime 배포

```bash
# 블루-그린 배포
docker-compose -f docker-compose.blue.yml up -d
# 헬스체크 후 트래픽 전환
docker-compose -f docker-compose.green.yml down
```

## 라이센스 및 지원

이 소프트웨어는 MIT 라이센스 하에 배포됩니다. 기술 지원이 필요한 경우 프로젝트 GitHub 저장소의 Issues 섹션을 이용해 주세요.

## 추가 리소스

- [API 문서](./API_SPECIFICATION.md)
- [아키텍처 가이드](./docs/architecture/system-architecture.md)
- [개발자 가이드](./src/aiops/README.md)
- [문제 해결 가이드](./docs/TROUBLESHOOTING.md)