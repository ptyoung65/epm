#!/bin/bash

# AIRIS-MON 테스트 스위트 빌드 테스트
echo "🚀 AIRIS-MON 테스트 스위트 빌드 테스트 시작..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Docker 빌드 테스트
echo -e "${YELLOW}📦 Docker 이미지 빌드 중...${NC}"
docker build -t airis-mon-test-suite:test . 

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker 이미지 빌드 성공!${NC}"
else
    echo -e "${RED}❌ Docker 이미지 빌드 실패${NC}"
    exit 1
fi

# 2. 데이터 생성기 이미지 빌드 테스트
echo -e "${YELLOW}📦 데이터 생성기 이미지 빌드 중...${NC}"
docker build -f Dockerfile.generator -t airis-mon-data-generator:test .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 데이터 생성기 이미지 빌드 성공!${NC}"
else
    echo -e "${RED}❌ 데이터 생성기 이미지 빌드 실패${NC}"
    exit 1
fi

# 3. Node.js 종속성 설치 테스트
echo -e "${YELLOW}📦 Node.js 종속성 설치 테스트...${NC}"
npm install --production

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Node.js 종속성 설치 성공!${NC}"
else
    echo -e "${RED}❌ Node.js 종속성 설치 실패${NC}"
    exit 1
fi

# 4. 애플리케이션 실행 테스트 (5초간)
echo -e "${YELLOW}🧪 애플리케이션 실행 테스트...${NC}"
timeout 5 npm start > /dev/null 2>&1 &
PID=$!
sleep 3

if ps -p $PID > /dev/null; then
    echo -e "${GREEN}✅ 애플리케이션 실행 성공!${NC}"
    kill $PID 2>/dev/null
else
    echo -e "${RED}❌ 애플리케이션 실행 실패${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 모든 빌드 테스트 통과!${NC}"
echo -e "${GREEN}Docker Compose로 전체 스택을 실행할 준비가 되었습니다:${NC}"
echo -e "${YELLOW}  docker-compose up -d${NC}"