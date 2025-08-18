#!/bin/bash

# AIRIS-APM 빠른 시작 스크립트 (기본 서비스만)

echo "🚀 AIRIS-APM 빠른 시작..."

# 컨테이너 레지스트리 시작
echo "📦 컨테이너 레지스트리 시작..."
docker run -d -p 5000:5000 --name airis-registry --restart=unless-stopped registry:2 2>/dev/null || echo "레지스트리가 이미 실행 중입니다."

# 레지스트리 대기
sleep 3

# 기본 서비스들만 시작 (DB + 핵심 API)
echo "🐳 기본 서비스들 시작 중..."
docker-compose up -d registry mongodb redis postgres clickhouse api-gateway ui

echo "⏳ 서비스 시작 대기 중..."
sleep 10

echo ""
echo "✅ 기본 서비스들이 시작되었습니다!"
echo ""
echo "📋 접속 정보:"
echo "  🌐 메인 대시보드: http://localhost:3002"
echo "  📊 API Gateway:   http://localhost:3000"
echo "  📦 Registry:      http://localhost:5000"
echo ""
echo "💡 전체 시스템 시작: ./scripts/start-all.sh"