#!/bin/bash
# AIRIS EPM - 프로덕션 환경 시작 스크립트
# 모든 서비스를 안전하고 체계적으로 시작

set -euo pipefail

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a /app/logs/startup.log
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a /app/logs/startup.log
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a /app/logs/startup.log
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a /app/logs/startup.log
}

# 환경 변수 검증
validate_environment() {
    log_info "환경 변수 검증 중..."
    
    local required_vars=(
        "NODE_ENV"
        "REDIS_URL" 
        "POSTGRES_URL"
        "MONGODB_URL"
        "CLICKHOUSE_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "필수 환경 변수가 설정되지 않음: $var"
            exit 1
        fi
    done
    
    log_success "환경 변수 검증 완료"
}

# 디렉터리 구조 확인
check_directories() {
    log_info "디렉터리 구조 확인 중..."
    
    local directories=(
        "/app/logs"
        "/app/data"
        "/app/tmp"
        "/app/config"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log_error "필수 디렉터리가 없음: $dir"
            exit 1
        fi
    done
    
    log_success "디렉터리 구조 확인 완료"
}

# 데이터베이스 연결 대기
wait_for_dependencies() {
    log_info "외부 의존성 대기 중..."
    
    # Redis 연결 대기
    local redis_host=$(echo $REDIS_URL | sed 's/redis:\/\///g' | cut -d'@' -f2 | cut -d':' -f1)
    local redis_port=$(echo $REDIS_URL | sed 's/redis:\/\///g' | cut -d'@' -f2 | cut -d':' -f2 | cut -d'/' -f1)
    
    log_info "Redis 연결 대기: $redis_host:$redis_port"
    while ! nc -z "$redis_host" "$redis_port"; do
        log_info "Redis 연결 대기 중..."
        sleep 2
    done
    log_success "Redis 연결 확인"
    
    # PostgreSQL 연결 대기
    local postgres_host=$(echo $POSTGRES_URL | sed 's/postgresql:\/\/.*@//g' | cut -d':' -f1)
    local postgres_port=$(echo $POSTGRES_URL | sed 's/postgresql:\/\/.*@//g' | cut -d':' -f2 | cut -d'/' -f1)
    
    log_info "PostgreSQL 연결 대기: $postgres_host:$postgres_port"
    while ! nc -z "$postgres_host" "$postgres_port"; do
        log_info "PostgreSQL 연결 대기 중..."
        sleep 2
    done
    log_success "PostgreSQL 연결 확인"
    
    # MongoDB 연결 대기
    local mongo_host=$(echo $MONGODB_URL | sed 's/mongodb:\/\///g' | cut -d':' -f1)
    local mongo_port=$(echo $MONGODB_URL | sed 's/mongodb:\/\///g' | cut -d':' -f2 | cut -d'/' -f1)
    
    log_info "MongoDB 연결 대기: $mongo_host:$mongo_port"
    while ! nc -z "$mongo_host" "$mongo_port"; do
        log_info "MongoDB 연결 대기 중..."
        sleep 2
    done
    log_success "MongoDB 연결 확인"
    
    # ClickHouse 연결 대기
    local clickhouse_host=$(echo $CLICKHOUSE_URL | sed 's/http:\/\///g' | cut -d':' -f1)
    local clickhouse_port=$(echo $CLICKHOUSE_URL | sed 's/http:\/\///g' | cut -d':' -f2)
    
    log_info "ClickHouse 연결 대기: $clickhouse_host:$clickhouse_port"
    while ! nc -z "$clickhouse_host" "$clickhouse_port"; do
        log_info "ClickHouse 연결 대기 중..."
        sleep 2
    done
    log_success "ClickHouse 연결 확인"
}

# Node.js 메모리 설정 최적화
optimize_node_memory() {
    log_info "Node.js 메모리 설정 최적화..."
    
    # 메모리 제한 설정
    if [[ -z "${MAX_OLD_SPACE_SIZE:-}" ]]; then
        export MAX_OLD_SPACE_SIZE=2048
    fi
    
    export NODE_OPTIONS="--max-old-space-size=${MAX_OLD_SPACE_SIZE} --optimize-for-size"
    
    log_success "메모리 설정: ${MAX_OLD_SPACE_SIZE}MB"
}

# 정적 파일 서빙 준비
prepare_static_files() {
    log_info "정적 파일 준비 중..."
    
    if [[ -d "/app/dashboard/build" ]]; then
        # 정적 파일 압축
        find /app/dashboard/build -name "*.js" -o -name "*.css" -o -name "*.html" | xargs gzip -k -f
        
        # 캐시 헤더용 파일 해시 생성
        find /app/dashboard/build -type f -exec sha256sum {} + > /app/tmp/file-hashes.txt
        
        log_success "정적 파일 준비 완료"
    else
        log_warn "대시보드 빌드 파일을 찾을 수 없음"
    fi
}

# 서비스 시작
start_services() {
    log_info "AIRIS EPM 서비스 시작 중..."
    
    # PM2를 사용하여 프로세스 관리
    if command -v pm2 > /dev/null; then
        log_info "PM2를 사용한 프로세스 관리"
        
        # PM2 ecosystem 파일 생성
        cat > /app/ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'dashboard',
      script: '/app/services/dashboard-server.js',
      cwd: '/app',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: '/app/logs/dashboard-error.log',
      out_file: '/app/logs/dashboard-out.log',
      log_file: '/app/logs/dashboard.log',
      time: true
    },
    {
      name: 'realtime-hub',
      script: '/app/services/realtime-hub/index.js',
      cwd: '/app/services/realtime-hub',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3300
      },
      error_file: '/app/logs/realtime-hub-error.log',
      out_file: '/app/logs/realtime-hub-out.log',
      log_file: '/app/logs/realtime-hub.log',
      time: true
    },
    {
      name: 'ai-prediction',
      script: '/app/services/ai-prediction/ai-prediction-service.js',
      cwd: '/app/services/ai-prediction',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3500
      },
      error_file: '/app/logs/ai-prediction-error.log',
      out_file: '/app/logs/ai-prediction-out.log',
      log_file: '/app/logs/ai-prediction.log',
      time: true
    }
  ]
};
EOF
        
        pm2 start /app/ecosystem.config.js
        pm2 save
        
    else
        log_info "단일 프로세스 모드로 시작"
        
        # 대시보드 서버 시작 (백그라운드)
        node /app/services/dashboard-server.js > /app/logs/dashboard.log 2>&1 &
        echo $! > /app/tmp/dashboard.pid
        
        # 실시간 허브 시작 (백그라운드)
        cd /app/services/realtime-hub
        node index.js > /app/logs/realtime-hub.log 2>&1 &
        echo $! > /app/tmp/realtime-hub.pid
        
        # AI 예측 서비스 시작 (백그라운드)
        cd /app/services/ai-prediction
        node ai-prediction-service.js > /app/logs/ai-prediction.log 2>&1 &
        echo $! > /app/tmp/ai-prediction.pid
    fi
    
    log_success "모든 서비스 시작 완료"
}

# 헬스체크 수행
perform_health_check() {
    log_info "서비스 헬스체크 수행 중..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log_info "헬스체크 시도 $attempt/$max_attempts"
        
        # 각 서비스 헬스체크
        local all_healthy=true
        
        # Dashboard
        if ! curl -sf http://localhost:3002/health > /dev/null; then
            all_healthy=false
            log_warn "Dashboard 헬스체크 실패"
        fi
        
        # Realtime Hub
        if ! curl -sf http://localhost:3300/health > /dev/null; then
            all_healthy=false
            log_warn "Realtime Hub 헬스체크 실패"
        fi
        
        # AI Prediction
        if ! curl -sf http://localhost:3500/health > /dev/null; then
            all_healthy=false
            log_warn "AI Prediction 헬스체크 실패"
        fi
        
        if [[ "$all_healthy" == "true" ]]; then
            log_success "모든 서비스 헬스체크 통과"
            return 0
        fi
        
        sleep 5
        ((attempt++))
    done
    
    log_error "헬스체크 실패 - 일부 서비스가 응답하지 않음"
    return 1
}

# 시작 메트릭 전송
send_startup_metrics() {
    log_info "시작 메트릭 전송 중..."
    
    local startup_data=$(cat <<EOF
{
    "event": "application_startup",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "${APP_VERSION:-unknown}",
    "environment": "${NODE_ENV}",
    "memory_limit": "${MAX_OLD_SPACE_SIZE:-2048}MB",
    "services": ["dashboard", "realtime-hub", "ai-prediction"]
}
EOF
)
    
    # 내부 메트릭 엔드포인트로 전송 (실패해도 계속 진행)
    curl -s -X POST http://localhost:3300/api/internal/metrics \
         -H "Content-Type: application/json" \
         -d "$startup_data" || log_warn "메트릭 전송 실패 (무시됨)"
    
    log_success "시작 메트릭 전송 완료"
}

# Graceful shutdown 핸들러
setup_signal_handlers() {
    log_info "시그널 핸들러 설정 중..."
    
    # Graceful shutdown 스크립트
    cat > /app/scripts/graceful-shutdown.sh << 'EOF'
#!/bin/bash
echo "Graceful shutdown 시작..."

if command -v pm2 > /dev/null; then
    pm2 stop all
    pm2 kill
else
    # PID 파일 기반 종료
    for pidfile in /app/tmp/*.pid; do
        if [[ -f "$pidfile" ]]; then
            pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                echo "프로세스 종료 중: $pid"
                kill -TERM "$pid"
                # 10초 대기 후 강제 종료
                (sleep 10; kill -9 "$pid" 2>/dev/null) &
            fi
        fi
    done
fi

echo "Graceful shutdown 완료"
EOF
    
    chmod +x /app/scripts/graceful-shutdown.sh
    
    # 시그널 트랩 설정
    trap '/app/scripts/graceful-shutdown.sh; exit 0' SIGTERM SIGINT
    
    log_success "시그널 핸들러 설정 완료"
}

# 대시보드 서버 스크립트 생성
create_dashboard_server() {
    log_info "대시보드 서버 스크립트 생성 중..."
    
    cat > /app/services/dashboard-server.js << 'EOF'
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

// 보안 미들웨어
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// CORS 설정
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3002'],
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// 압축
app.use(compression());

// 정적 파일 서빙
app.use(express.static('/app/dashboard/build', {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// API 프록시 (다른 서비스로 전달)
app.use('/api/realtime', require('http-proxy-middleware').createProxyMiddleware({
  target: 'http://localhost:3300',
  changeOrigin: true,
  pathRewrite: { '^/api/realtime': '' }
}));

app.use('/api/ai', require('http-proxy-middleware').createProxyMiddleware({
  target: 'http://localhost:3500',
  changeOrigin: true,
  pathRewrite: { '^/api/ai': '' }
}));

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: Math.floor(process.uptime())
  });
});

// SPA 라우팅 지원
app.get('*', (req, res) => {
  res.sendFile(path.join('/app/dashboard/build', 'index.html'));
});

// 에러 처리
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const server = app.listen(PORT, () => {
  console.log(`Dashboard server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Dashboard server closed');
    process.exit(0);
  });
});
EOF
    
    log_success "대시보드 서버 스크립트 생성 완료"
}

# 메인 실행 함수
main() {
    log_info "AIRIS EPM 프로덕션 환경 시작"
    log_info "시작 시간: $(date)"
    
    # 실행 단계
    validate_environment
    check_directories
    optimize_node_memory
    wait_for_dependencies
    prepare_static_files
    create_dashboard_server
    setup_signal_handlers
    start_services
    
    # 서비스 시작 완료 대기
    sleep 10
    
    if perform_health_check; then
        send_startup_metrics
        log_success "AIRIS EPM 프로덕션 환경 시작 완료!"
        log_info "서비스 URL:"
        log_info "  - Dashboard: http://localhost:3002"
        log_info "  - Realtime Hub: http://localhost:3300"
        log_info "  - AI Prediction: http://localhost:3500"
        
        # PM2 사용시 로그 표시
        if command -v pm2 > /dev/null; then
            pm2 logs --raw
        else
            # 메인 프로세스 대기 (신호 처리를 위해)
            wait
        fi
    else
        log_error "서비스 시작 실패"
        exit 1
    fi
}

# 스크립트 실행
main "$@"