const fs = require('fs');
const path = require('path');

// Session 페이지들과 그들의 활성 카테고리 정의
const sessionPages = [
  { 
    file: 'session-analysis.html', 
    activeCategory: '세션 분석', 
    activeItem: '📈 세션 분석' 
  },
  { 
    file: 'session-telemetry-dashboard.html', 
    activeCategory: '세션 분석', 
    activeItem: '🛰️ 세션 텔레메트리' 
  },
  { 
    file: 'session-replay.html', 
    activeCategory: '세션 분석', 
    activeItem: '🎬 세션 리플레이' 
  }
];

// 공통 dropdown CSS
const dropdownCSS = `
    /* Dropdown 메뉴 완전 제어 - 모든 Tailwind 클래스 오버라이드 */
    .relative.group div.absolute {
      opacity: 0 !important;
      visibility: hidden !important;
      transform: translateY(-10px) !important;
      transition: all 0.2s ease-in-out !important;
      z-index: 9999 !important;
      pointer-events: none !important;
    }
    .relative.group:hover div.absolute {
      opacity: 1 !important;
      visibility: visible !important;
      transform: translateY(0) !important;
      z-index: 9999 !important;
      pointer-events: auto !important;
    }
    
    /* 추가 강제 오버라이드 - Tailwind 클래스별 */
    .group-hover\\\\:opacity-100 { opacity: 1 !important; }
    .group-hover\\\\:visible { visibility: visible !important; }
    .opacity-0 { opacity: 0 !important; }
    .invisible { visibility: hidden !important; }
    
    /* 드롭다운 항목들 모두 강제 표시 */
    .relative.group:hover .absolute a {
      opacity: 1 !important;
      visibility: visible !important;
      display: block !important;
    }`;

// 각 카테고리별 활성/비활성 클래스 생성
function getButtonClass(category, activeCategory) {
  if (category === activeCategory) {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 transition-colors bg-transparent border-none cursor-pointer flex items-center px-3 py-2 text-sm font-medium rounded-md';
  }
  return 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors bg-transparent border-none cursor-pointer flex items-center px-3 py-2 text-sm font-medium';
}

// 각 항목별 활성/비활성 클래스 생성
function getItemClass(item, activeItem) {
  if (item === activeItem) {
    return 'block px-4 py-2 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50';
  }
  return 'block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white';
}

// 새로운 navigation HTML 생성
function generateNavigation(activeCategory, activeItem) {
  return `    <!-- Navigation -->
    <nav class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">🚀 AIRIS EPM</h1>
            </div>
            <div class="ml-10 flex items-center space-x-8">
              <!-- 메인 대시보드 -->
              <a href="/" class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 text-sm font-medium">📊 메인</a>
              
              <!-- APM 모니터링 드롭다운 -->
              <div class="relative group">
                <button class="${getButtonClass('APM 모니터링', activeCategory)}">
                  ⚡ APM 모니터링 ▾
                </button>
                <div class="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <a href="/j2ee-dashboard.html" class="${getItemClass('☕ J2EE 모니터링', activeItem)}">☕ J2EE 모니터링</a>
                  <a href="/was-dashboard.html" class="${getItemClass('🏗️ WAS 모니터링', activeItem)}">🏗️ WAS 모니터링</a>
                  <a href="/exception-dashboard.html" class="${getItemClass('🚨 예외 추적', activeItem)}">🚨 예외 추적</a>
                  <a href="/topology-dashboard.html" class="${getItemClass('🗺️ 서비스 토폴로지', activeItem)}">🗺️ 서비스 토폴로지</a>
                  <a href="/alert-dashboard.html" class="${getItemClass('🔔 알림 관리', activeItem)}">🔔 알림 관리</a>
                </div>
              </div>

              <!-- 인프라 모니터링 드롭다운 -->
              <div class="relative group">
                <button class="${getButtonClass('인프라 모니터링', activeCategory)}">
                  🖥️ 인프라 모니터링 ▾
                </button>
                <div class="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <a href="/app-monitoring.html" class="${getItemClass('📱 애플리케이션 모니터링', activeItem)}">📱 애플리케이션 모니터링</a>
                  <a href="/system-monitoring.html" class="${getItemClass('⚙️ 시스템 모니터링', activeItem)}">⚙️ 시스템 모니터링</a>
                  <a href="/db-monitoring.html" class="${getItemClass('🗃️ 데이터베이스 모니터링', activeItem)}">🗃️ 데이터베이스 모니터링</a>
                  <a href="/web-monitoring.html" class="${getItemClass('🌐 웹 성능 모니터링', activeItem)}">🌐 웹 성능 모니터링</a>
                </div>
              </div>

              <!-- 관찰성 드롭다운 -->
              <div class="relative group">
                <button class="${getButtonClass('관찰성', activeCategory)}">
                  🔍 관찰성 ▾
                </button>
                <div class="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <a href="/logs-dashboard.html" class="${getItemClass('📋 로그 대시보드', activeItem)}">📋 로그 대시보드</a>
                  <a href="/metrics-dashboard.html" class="${getItemClass('📊 메트릭 대시보드', activeItem)}">📊 메트릭 대시보드</a>
                  <a href="/traces-dashboard.html" class="${getItemClass('🔗 트레이스 대시보드', activeItem)}">🔗 트레이스 대시보드</a>
                </div>
              </div>

              <!-- 세션 분석 드롭다운 -->
              <div class="relative group">
                <button class="${getButtonClass('세션 분석', activeCategory)}">
                  👥 세션 분석 ▾
                </button>
                <div class="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <a href="/session-analysis.html" class="${getItemClass('📈 세션 분석', activeItem)}">📈 세션 분석</a>
                  <a href="/session-telemetry-dashboard.html" class="${getItemClass('🛰️ 세션 텔레메트리', activeItem)}">🛰️ 세션 텔레메트리</a>
                  <a href="/session-replay.html" class="${getItemClass('🎬 세션 리플레이', activeItem)}">🎬 세션 리플레이</a>
                </div>
              </div>

              <!-- 시스템 관리 드롭다운 -->
              <div class="relative group">
                <button class="${getButtonClass('시스템 관리', activeCategory)}">
                  🛠️ 시스템 관리 ▾
                </button>
                <div class="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <a href="/services-management.html" class="${getItemClass('⚙️ 서비스 관리', activeItem)}">⚙️ 서비스 관리</a>
                  <a href="/deployment-manager.html" class="${getItemClass('🚀 배포 관리', activeItem)}">🚀 배포 관리</a>
                  <a href="/ontology.html" class="${getItemClass('🧠 온톨로지 시스템', activeItem)}">🧠 온톨로지 시스템</a>
                </div>
              </div>

              <!-- 포털 링크 -->
              <a href="/portal.html" class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 px-3 py-2 text-sm font-medium">🏠 포털</a>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <button id="darkModeToggle" class="p-2 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              <span class="dark:hidden">🌙</span>
              <span class="hidden dark:inline">☀️</span>
            </button>
            <div id="systemStatus" class="flex items-center space-x-2">
              <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span class="text-sm text-gray-600 dark:text-gray-300">시스템 정상</span>
            </div>
          </div>
        </div>
      </div>
    </nav>`;
}

// 각 세션 페이지 처리
const basePath = '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/public';

sessionPages.forEach(pageInfo => {
  const filePath = path.join(basePath, pageInfo.file);
  console.log(`Processing ${pageInfo.file}...`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. CSS 수정 - 기존 스타일 섹션을 찾아서 dropdown CSS 추가
    if (!content.includes('Dropdown 메뉴 완전 제어')) {
      // shadcn/ui CSS Variables 뒤에 추가
      const cssVariablesEnd = content.indexOf('        }', content.indexOf(':root {'));
      if (cssVariablesEnd !== -1) {
        const insertPoint = content.indexOf('\n', cssVariablesEnd) + 1;
        content = content.slice(0, insertPoint) + dropdownCSS + content.slice(insertPoint);
      }
    }
    
    // 2. Tailwind CSS 처리 (로컬 파일을 CDN으로 변경)
    if (content.includes('href="/tailwind.css"')) {
      content = content.replace(
        /<link rel="stylesheet" href="\/tailwind\.css">/g,
        '<script src="https://cdn.tailwindcss.com"></script>'
      );
    }
    
    // 3. Navigation 구조 교체 - 세션 페이지의 특정 nav 구조 찾기
    const navStartRegex = /<!--\s*Navigation Menu\s*-->\s*<nav[^>]*>/;
    const navEndRegex = /<\/nav>/;
    
    const navStartMatch = content.match(navStartRegex);
    if (navStartMatch) {
      const navStart = navStartMatch.index;
      const afterNavStart = navStart;
      const navEndMatch = content.slice(navStart).match(navEndRegex);
      
      if (navEndMatch) {
        const navEnd = navStart + navEndMatch.index + navEndMatch[0].length;
        
        const beforeNav = content.slice(0, navStart);
        const afterNav = content.slice(navEnd);
        
        const newNavigation = generateNavigation(pageInfo.activeCategory, pageInfo.activeItem);
        content = beforeNav + newNavigation + afterNav;
      }
    }
    
    // 4. onclick 이벤트 제거 (CSP 준수)
    content = content.replace(/onclick="[^"]*"/g, '');
    
    // 파일 저장
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${pageInfo.file} 처리 완료`);
    
  } catch (error) {
    console.error(`❌ ${pageInfo.file} 처리 실패:`, error.message);
  }
});

console.log('🎉 모든 세션 페이지 처리 완료!');