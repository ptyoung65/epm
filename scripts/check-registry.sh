#!/bin/bash

# AIRIS-MON Container Registry Checker
# 컨테이너 레지스트리 상태 및 이미지 목록 확인 스크립트

set -e

REGISTRY_URL="localhost:5000"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔍 AIRIS-MON Container Registry Status${NC}"
echo "========================================"
echo ""

# Check if registry is running
echo -e "${YELLOW}📡 Registry 연결 상태 확인...${NC}"
if curl -s -f "http://${REGISTRY_URL}/v2/" > /dev/null; then
    echo -e "${GREEN}✅ Registry 서버 정상 동작 중${NC}"
    echo "   URL: http://${REGISTRY_URL}"
else
    echo -e "${RED}❌ Registry 서버 연결 실패${NC}"
    echo "   docker run -d -p 5000:5000 --name registry registry:2 명령으로 시작하세요"
    exit 1
fi

echo ""

# Get repository list
echo -e "${YELLOW}📦 저장소 목록 조회...${NC}"
REPOS=$(curl -s "http://${REGISTRY_URL}/v2/_catalog" | jq -r '.repositories[]?' 2>/dev/null)

if [ -z "$REPOS" ]; then
    echo -e "${RED}❌ 저장소가 없습니다${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 발견된 저장소 수: $(echo "$REPOS" | wc -l)${NC}"
echo ""

# Display each repository with tags
echo -e "${BLUE}🏷️  이미지별 태그 정보${NC}"
echo "------------------------"

total_size=0
for repo in $REPOS; do
    echo -e "${PURPLE}📦 $repo${NC}"
    
    # Get tags
    tags=$(curl -s "http://${REGISTRY_URL}/v2/$repo/tags/list" | jq -r '.tags[]?' 2>/dev/null | sort)
    
    if [ -n "$tags" ]; then
        for tag in $tags; do
            echo -e "   🏷️  $tag"
            
            # Get manifest to estimate size (simplified)
            manifest=$(curl -s -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
                      "http://${REGISTRY_URL}/v2/$repo/manifests/$tag" 2>/dev/null)
            
            if [ $? -eq 0 ]; then
                # Get config blob size (approximate)
                config_size=$(echo "$manifest" | jq -r '.config.size // 0' 2>/dev/null)
                layers_size=$(echo "$manifest" | jq -r '.layers[].size // 0' 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
                
                if [ "$layers_size" -gt 0 ]; then
                    size_mb=$((($layers_size + $config_size) / 1024 / 1024))
                    echo -e "      📏 크기: ~${size_mb}MB"
                    total_size=$(($total_size + $size_mb))
                fi
            fi
        done
    else
        echo -e "   ${RED}❌ 태그 없음${NC}"
    fi
    echo ""
done

echo -e "${CYAN}📊 전체 통계${NC}"
echo "------------"
echo -e "총 저장소 수: ${GREEN}$(echo "$REPOS" | wc -l)${NC}"
echo -e "총 예상 크기: ${GREEN}~${total_size}MB${NC}"
echo ""

echo -e "${YELLOW}🌐 웹 브라우저 접속 URL${NC}"
echo "----------------------"
echo "전체 목록: http://${REGISTRY_URL}/v2/_catalog"
echo "예시 태그: http://${REGISTRY_URL}/v2/airis-mon/api-gateway/tags/list"
echo ""

echo -e "${YELLOW}🔧 유용한 명령어${NC}"
echo "---------------"
echo "# 전체 저장소 목록"
echo "curl -s http://${REGISTRY_URL}/v2/_catalog | jq ."
echo ""
echo "# 특정 이미지 태그 목록"
echo "curl -s http://${REGISTRY_URL}/v2/airis-mon/api-gateway/tags/list | jq ."
echo ""
echo "# 이미지 Pull"
echo "docker pull ${REGISTRY_URL}/airis-mon/api-gateway:latest"
echo ""

echo -e "${GREEN}✅ Registry 상태 확인 완료!${NC}"