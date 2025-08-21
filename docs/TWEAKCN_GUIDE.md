# TweakCN 테마 시스템 가이드

## 🎨 TweakCN 소개

TweakCN은 shadcn/ui 컴포넌트를 위한 시각적 테마 편집기입니다. 코드 수정 없이 슬라이더와 색상 선택기를 통해 전체 React 앱의 브랜딩을 커스터마이징할 수 있습니다.

## 🚀 AIRIS APM 통합 완료

모든 AIRIS APM 대시보드에 TweakCN이 성공적으로 통합되었습니다:

- ✅ 통합 메인 대시보드
- ✅ J2EE 모니터링 대시보드
- ✅ WAS 모니터링 대시보드
- ✅ 예외 추적 대시보드
- ✅ 서비스 토폴로지 대시보드
- ✅ 알림 관리 대시보드
- ✅ 배포 관리 대시보드

## 📋 사용 방법

### 1. 키보드 단축키

- **Ctrl+Shift+T**: 테마 패널 열기/닫기
- **Ctrl+Shift+D**: 다크모드 전환

### 2. 테마 버튼

모든 대시보드 왼쪽 하단에 테마 버튼(🎨)이 표시됩니다. 클릭하면 테마 선택 패널이 열립니다.

### 3. 사전 정의된 테마

5가지 프리셋 테마를 제공합니다:

- **Default**: 표준 AIRIS APM 테마
- **Ocean**: 파란색 중심의 모니터링 테마
- **Forest**: 정상 상태를 위한 녹색 테마
- **Sunset**: 알림을 위한 따뜻한 테마
- **Midnight**: 장시간 사용을 위한 다크 테마

### 4. 고급 설정

테마 스위처 페이지에서 더 많은 옵션을 사용할 수 있습니다:
http://localhost:3002/theme-switcher.html

## 🎯 주요 기능

### 시각적 편집
- 실시간 미리보기
- 색상 변수 즉시 적용
- 접근성 대비 검사

### 버전 호환성
- Tailwind v3 & v4 호환
- OKLCH/HSL 색상 모드 지원
- shadcn/ui 컴포넌트 완벽 지원

### 테마 관리
- 테마 내보내기/가져오기
- JSON 형식 저장
- URL 공유 가능

### 전역 색상 제어
- Primary, Secondary, Accent 색상
- Background, Foreground 색상
- Card, Sidebar, Chart 색상
- Border, Input, Ring 색상

## 🔧 기술적 구현

### 파일 구조
```
src/
├── styles/
│   └── tweakcn-theme.css      # TweakCN 테마 변수
├── config/
│   └── tweakcn.config.js      # TweakCN 설정
└── components/
    └── theme-switcher.html     # 테마 스위처 UI

clickstack-architecture/ui/korean-hyperdx-dashboard/public/
├── js/
│   ├── tweakcn-loader.js      # 자동 테마 로더
│   └── tweakcn.config.js      # 배포된 설정
├── css/
│   └── tweakcn-theme.css      # 배포된 테마 CSS
└── theme-switcher.html        # 테마 관리 페이지
```

### CSS 변수 시스템
```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --secondary: 240 4.8% 95.9%;
  /* ... 기타 변수들 */
}
```

### 로컬 스토리지
테마 설정은 브라우저의 로컬 스토리지에 자동 저장됩니다:
- 키: `airis-apm-tweakcn-theme`
- 값: JSON 형식의 테마 변수

## 🌐 TweakCN 에디터

더 고급 커스터마이징을 원한다면 TweakCN 공식 에디터를 사용하세요:
https://tweakcn.com

1. 에디터에서 테마 커스터마이징
2. CSS 변수 내보내기
3. AIRIS APM 테마 스위처에서 가져오기

## 🐳 Docker 통합

Docker 컨테이너 재시작 시 테마 파일이 자동으로 포함됩니다:

```bash
# UI 컨테이너 재시작
docker compose restart ui

# 파일 수동 복사 (필요시)
docker cp src/styles/tweakcn-theme.css airis-ui-dashboard:/usr/share/nginx/html/css/
docker cp src/config/tweakcn.config.js airis-ui-dashboard:/usr/share/nginx/html/js/
```

## 📝 커스텀 테마 만들기

### 1. 테마 스위처 페이지 열기
```
http://localhost:3002/theme-switcher.html
```

### 2. "Create Custom" 클릭

### 3. TweakCN 에디터에서 수정

### 4. 테마 내보내기 및 적용

## 🎨 APM 대시보드별 추천 테마

| 대시보드 | 추천 테마 | 이유 |
|---------|----------|------|
| J2EE 모니터링 | Sunset | Java의 따뜻한 색상과 어울림 |
| WAS 모니터링 | Ocean | 서버 인프라의 안정감 표현 |
| 예외 추적 | Default | 에러 표시를 위한 높은 대비 |
| 서비스 토폴로지 | Forest | 정상 상태의 녹색 강조 |
| 알림 관리 | Sunset | 경고 색상과 조화 |
| 배포 관리 | Midnight | 장시간 모니터링에 적합 |

## 🔍 문제 해결

### 테마가 적용되지 않는 경우
1. 브라우저 캐시 지우기 (Ctrl+F5)
2. 로컬 스토리지 초기화
3. UI 컨테이너 재시작

### 테마 버튼이 보이지 않는 경우
1. JavaScript 콘솔 확인
2. tweakcn-loader.js 로드 확인
3. 네트워크 탭에서 404 에러 확인

## 📚 참고 자료

- TweakCN 공식 사이트: https://tweakcn.com
- TweakCN GitHub: https://github.com/jnsahaj/tweakcn
- shadcn/ui 문서: https://ui.shadcn.com
- Tailwind CSS: https://tailwindcss.com

---

**마지막 업데이트**: 2025-08-21
**TweakCN 버전**: 최신
**호환성**: shadcn/ui, Tailwind CSS v3/v4