#!/bin/bash

# AIRIS-APM 전체 시스템 시작 스크립트
set -e  # 에러 발생 시 스크립트 중단

echo "🚀 AIRIS-APM 시스템 시작 중..."

# 로그 함수 정의
log_info() {
    echo "ℹ️  $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo "✅ $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "❌ $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo "⚠️  $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 1. 기존 컨테이너 정리
log_info "기존 컨테이너 정리 중..."
docker compose down 2>/dev/null || true

# 2. 컨테이너 레지스트리 시작
log_info "컨테이너 레지스트리 시작..."
docker run -d -p 5000:5000 --name airis-registry --restart=unless-stopped registry:2 2>/dev/null || log_warn "레지스트리가 이미 실행 중입니다."

# 3. 레지스트리 상태 확인
log_info "레지스트리 준비 대기..."
for i in {1..10}; do
    if curl -s http://localhost:5000/v2/_catalog > /dev/null; then
        log_success "레지스트리 준비 완료"
        break
    fi
    if [ $i -eq 10 ]; then
        log_error "레지스트리 시작 실패"
        exit 1
    fi
    sleep 2
done

# 4. 각 서비스 빌드
log_info "서비스들 빌드 시작..."

services=(
    "api-gateway"
    "data-ingestion" 
    "analytics-engine"
    "session-replay"
    "aiops"
    "event-delta-analyzer"
    "nlp-search"
    "j2ee-monitor"
    "was-monitor"
    "exception-tracker"
    "service-topology"
    "alert-notification"
)

build_service() {
    local service=$1
    local service_dir="clickstack-architecture/services/$service"
    
    if [ ! -d "$service_dir" ]; then
        log_warn "서비스 디렉토리가 없습니다: $service"
        return 1
    fi
    
    log_info "$service 빌드 중..."
    cd "$service_dir"
    
    # package.json이 있으면 npm install
    if [ -f "package.json" ]; then
        log_info "$service - npm install 실행 중..."
        npm install --silent || {
            log_error "$service - npm install 실패"
            cd ../../..
            return 1
        }
    fi
    
    # Dockerfile이 있으면 이미지 빌드
    if [ -f "Dockerfile" ]; then
        log_info "$service - Docker 이미지 빌드 중..."
        docker build -t airis-mon/$service:latest . || {
            log_error "$service - Docker 빌드 실패"
            cd ../../..
            return 1
        }
        
        # 레지스트리에 태그 및 푸시
        docker tag airis-mon/$service:latest localhost:5000/airis-mon/$service:latest
        docker push localhost:5000/airis-mon/$service:latest || {
            log_error "$service - Docker 푸시 실패"
            cd ../../..
            return 1
        }
        log_success "$service - 이미지 빌드 및 푸시 완료"
    else
        log_warn "$service - Dockerfile이 없습니다"
    fi
    
    cd ../../..
}

# 서비스들 순차적 빌드
for service in "${services[@]}"; do
    build_service "$service" || {
        log_error "서비스 빌드 실패: $service"
        exit 1
    }
done

# 5. UI 서비스 별도 처리
log_info "UI 서비스 빌드 시작..."
if [ -d "clickstack-architecture/ui/korean-hyperdx-dashboard" ]; then
    cd clickstack-architecture/ui/korean-hyperdx-dashboard
    
    # UI 서비스용 Dockerfile 생성
    log_info "UI - Dockerfile 및 nginx.conf 생성 중..."
    cat > Dockerfile << 'EOF'
FROM nginx:alpine
COPY public/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

    # nginx.conf 생성
    cat > nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://api-gateway:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

    log_info "UI - Docker 이미지 빌드 중..."
    docker build -t airis-mon/ui:latest . || {
        log_error "UI - Docker 빌드 실패"
        cd ../../..
        exit 1
    }
    
    docker tag airis-mon/ui:latest localhost:5000/airis-mon/ui:latest
    docker push localhost:5000/airis-mon/ui:latest || {
        log_error "UI - Docker 푸시 실패"
        cd ../../..
        exit 1
    }
    
    cd ../../..
    log_success "UI 서비스 빌드 완료"
else
    log_warn "UI 서비스 디렉토리를 찾을 수 없습니다"
fi

# 6. Docker Compose로 전체 시스템 시작
log_info "Docker Compose로 전체 시스템 시작..."
docker compose up -d || {
    log_error "Docker Compose 시작 실패"
    exit 1
}

# 7. 서비스 상태 확인
log_info "서비스들이 준비될 때까지 대기 중..."
sleep 20

# 8. 최종 결과 표시
echo ""
log_success "AIRIS-APM 시스템이 시작되었습니다!"
echo ""
echo "📋 접속 정보:"
echo "  🌐 메인 대시보드:     http://localhost:3002"
echo "  🚀 배포 관리:         http://localhost:3002/deployment-manager.html"
echo "  📊 API Gateway:       http://localhost:3000"
echo "  📦 Container Registry: http://localhost:5000"
echo ""
echo "🔧 서비스 포트:"
echo "  - API Gateway:        3000"
echo "  - Data Ingestion:     3001"
echo "  - UI Dashboard:       3002"
echo "  - Analytics Engine:   3003"
echo "  - Session Replay:     3004"
echo "  - AIOps:             3005"
echo "  - Event Delta:        3006"
echo "  - NLP Search:         3007"
echo "  - J2EE Monitor:       3008"
echo "  - WAS Monitor:        3009"
echo "  - Exception Tracker:  3010"
echo "  - Alert Notification: 3011"
echo "  - Service Topology:   3012"
echo ""

# 9. 서비스 헬스체크
log_info "서비스 상태 확인 중..."
services_to_check=(
    "localhost:3000/health"
    "localhost:3001/health"
    "localhost:3002"
    "localhost:3003/health"
    "localhost:3008/health"
    "localhost:3009/health"
    "localhost:3010/health"
    "localhost:3011/health"
    "localhost:3012/health"
)

healthy_count=0
total_count=${#services_to_check[@]}

for url in "${services_to_check[@]}"; do
    if curl -s -f "http://$url" --connect-timeout 5 > /dev/null 2>&1; then
        echo "  ✅ $url"
        ((healthy_count++))
    else
        echo "  ⏳ $url (시작 중 또는 응답 없음)"
    fi
done

echo ""
log_info "서비스 상태: $healthy_count/$total_count 개 서비스가 응답 중입니다"

# 10. 실행 중인 컨테이너 표시
echo ""
log_info "실행 중인 컨테이너:"
docker compose ps

echo ""
log_info "💡 시스템이 완전히 시작되려면 1-2분 정도 소요될 수 있습니다."
log_info "💡 문제가 있다면 'docker compose logs [서비스명]'으로 로그를 확인하세요."
log_info "💡 전체 시스템 중지: docker compose down"