#!/bin/bash

# AIRIS EPM Session Replay Manager 빌드 및 배포 스크립트
# OpenReplay 통합 서비스 빌드 자동화

set -e  # 에러 발생시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
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

# 스크립트 시작
log_info "🚀 AIRIS EPM Session Replay Manager 빌드 시작"

# 환경변수 설정
export NODE_ENV=${NODE_ENV:-production}
export DOCKER_REGISTRY=${DOCKER_REGISTRY:-localhost:5000}
export SERVICE_NAME="session-replay-manager"
export IMAGE_TAG=${IMAGE_TAG:-latest}
export FULL_IMAGE_NAME="${DOCKER_REGISTRY}/airis-mon/${SERVICE_NAME}:${IMAGE_TAG}"

# 프로젝트 루트 디렉터리 확인
PROJECT_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"
SERVICE_DIR="${PROJECT_ROOT}/services/${SERVICE_NAME}"

log_info "프로젝트 루트: $PROJECT_ROOT"
log_info "서비스 디렉터리: $SERVICE_DIR"

# 서비스 디렉터리 존재 확인
if [ ! -d "$SERVICE_DIR" ]; then
    log_error "서비스 디렉터리를 찾을 수 없습니다: $SERVICE_DIR"
    exit 1
fi

cd "$SERVICE_DIR"

# package.json 존재 확인
if [ ! -f "package.json" ]; then
    log_error "package.json 파일을 찾을 수 없습니다"
    exit 1
fi

# Dockerfile 존재 확인
if [ ! -f "Dockerfile" ]; then
    log_error "Dockerfile을 찾을 수 없습니다"
    exit 1
fi

# Docker가 실행 중인지 확인
if ! docker info > /dev/null 2>&1; then
    log_error "Docker가 실행되고 있지 않습니다"
    exit 1
fi

# 레지스트리가 실행 중인지 확인
if ! curl -s "http://${DOCKER_REGISTRY}/v2/_catalog" > /dev/null; then
    log_warning "Docker 레지스트리에 접근할 수 없습니다: $DOCKER_REGISTRY"
    log_info "로컬 이미지로만 빌드를 진행합니다"
fi

# 이전 빌드 정리 (선택적)
if [ "$1" = "--clean" ]; then
    log_info "🧹 이전 빌드 아티팩트 정리 중..."
    rm -rf dist/ node_modules/ .npm/
    docker rmi "$FULL_IMAGE_NAME" 2>/dev/null || true
    log_success "정리 완료"
fi

# Docker 이미지 빌드
log_info "🔨 Docker 이미지 빌드 중: $FULL_IMAGE_NAME"

# 빌드 아규먼트 설정
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")

# Docker 빌드 실행
docker build \
    --build-arg BUILD_DATE="$BUILD_DATE" \
    --build-arg VCS_REF="$VCS_REF" \
    --build-arg VERSION="$VERSION" \
    --target production \
    -t "$FULL_IMAGE_NAME" \
    -t "${DOCKER_REGISTRY}/airis-mon/${SERVICE_NAME}:${VCS_REF}" \
    . || {
        log_error "Docker 빌드 실패"
        exit 1
    }

log_success "Docker 이미지 빌드 완료"

# 이미지 크기 확인
IMAGE_SIZE=$(docker images --format "{{.Size}}" "$FULL_IMAGE_NAME" | head -1)
log_info "이미지 크기: $IMAGE_SIZE"

# 이미지 테스트 (간단한 헬스체크)
log_info "🧪 이미지 테스트 중..."

# 임시 컨테이너 실행으로 이미지 검증
TEMP_CONTAINER_NAME="${SERVICE_NAME}-build-test-$$"
docker run --rm -d \
    --name "$TEMP_CONTAINER_NAME" \
    -e NODE_ENV=test \
    -p 13004:3004 \
    "$FULL_IMAGE_NAME" || {
        log_error "컨테이너 실행 테스트 실패"
        exit 1
    }

# 컨테이너 시작 대기
sleep 5

# 헬스체크
if curl -f http://localhost:13004/health > /dev/null 2>&1; then
    log_success "헬스체크 통과"
else
    log_warning "헬스체크 실패 - 컨테이너 로그 확인 필요"
fi

# 테스트 컨테이너 정리
docker stop "$TEMP_CONTAINER_NAME" > /dev/null 2>&1 || true

# 레지스트리에 푸시 (선택적)
if [ "$1" = "--push" ] || [ "$2" = "--push" ]; then
    log_info "📤 이미지를 레지스트리에 푸시 중..."
    
    docker push "$FULL_IMAGE_NAME" || {
        log_error "이미지 푸시 실패"
        exit 1
    }
    
    # VCS ref 태그도 푸시
    docker push "${DOCKER_REGISTRY}/airis-mon/${SERVICE_NAME}:${VCS_REF}" || {
        log_warning "VCS ref 태그 푸시 실패"
    }
    
    log_success "이미지 푸시 완료"
fi

# 빌드 정보 출력
log_info "📋 빌드 정보:"
echo "  • 이미지: $FULL_IMAGE_NAME"
echo "  • 크기: $IMAGE_SIZE"
echo "  • 빌드 날짜: $BUILD_DATE"
echo "  • VCS Ref: $VCS_REF"
echo "  • 버전: $VERSION"

# 실행 가이드
log_info "🎯 실행 방법:"
echo "  단일 실행: docker run -p 3004:3004 $FULL_IMAGE_NAME"
echo "  Docker Compose: docker-compose up session-replay-manager"
echo "  전체 시스템: ./scripts/start-all.sh"

log_success "✅ Session Replay Manager 빌드 완료!"

# 정리 및 최적화 제안
if [ -z "$1" ]; then
    echo
    log_info "💡 추가 옵션:"
    echo "  • --clean: 이전 빌드 아티팩트 정리"
    echo "  • --push: 레지스트리에 이미지 푸시"
    echo "  • IMAGE_TAG=v1.1 $0: 특정 태그로 빌드"
fi

log_success "빌드 스크립트 실행 완료!"