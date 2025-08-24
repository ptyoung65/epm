#!/bin/bash

# 통합 네비게이션 수정 스크립트
# deployment-manager.html의 TweakCN 제거 및 네비게이션 개선

echo "🔧 통합 네비게이션 수정 시작..."

# deployment-manager.html에서 TweakCN 스크립트 제거
echo "📋 deployment-manager.html에서 TweakCN 스크립트 제거 중..."
sed -i '/<script src="\/js\/tweakcn-loader.js"><\/script>/d' /home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/public/deployment-manager.html

echo "✅ 네비게이션 수정 완료!"
echo ""
echo "🎯 수정 요약:"
echo "  • deployment-manager.html에서 TweakCN 스크립트 제거"
echo ""
echo "📋 다음 단계:"
echo "  1. Docker UI 이미지 재빌드"
echo "  2. 컨테이너 재시작"
echo "  3. 모든 대시보드 네비게이션 테스트"
