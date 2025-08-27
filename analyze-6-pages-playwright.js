const { chromium } = require('playwright');

async function analyze6PagesWithPlaywright() {
  console.log('🔍 6개 추가 페이지 dropdown 현황 분석...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pages = [
    { url: 'http://localhost:3001/logs-dashboard.html', name: 'Logs Dashboard' },
    { url: 'http://localhost:3001/metrics-dashboard.html', name: 'Metrics Dashboard' },
    { url: 'http://localhost:3001/traces-dashboard.html', name: 'Traces Dashboard' },
    { url: 'http://localhost:3001/session-analysis.html', name: 'Session Analysis' },
    { url: 'http://localhost:3001/session-telemetry-dashboard.html', name: 'Session Telemetry' },
    { url: 'http://localhost:3001/session-replay.html', name: 'Session Replay' }
  ];

  const analysisResults = [];

  for (const pageInfo of pages) {
    console.log(`\n📋 ${pageInfo.name} 분석:`);
    
    try {
      // 페이지 로드
      await page.goto(pageInfo.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Navigation 구조 분석
      const navigationInfo = await page.evaluate(() => {
        const nav = document.querySelector('nav');
        const header = document.querySelector('header');
        const dropdowns = document.querySelectorAll('.relative.group');
        const buttons = document.querySelectorAll('button[onclick]');
        const tailwindScript = document.querySelector('script[src*="tailwindcss"]');
        const tailwindLink = document.querySelector('link[href*="tailwind"]');
        
        return {
          hasNav: !!nav,
          hasHeader: !!header,
          dropdownCount: dropdowns.length,
          onclickButtonCount: buttons.length,
          usesTailwindCDN: !!tailwindScript,
          usesTailwindLocal: !!tailwindLink,
          navStructure: nav ? nav.outerHTML.substring(0, 300) + '...' : 'NO NAV',
          title: document.title
        };
      });

      console.log(`   제목: ${navigationInfo.title}`);
      console.log(`   Nav 태그: ${navigationInfo.hasNav ? '있음' : '없음'}`);
      console.log(`   Header 태그: ${navigationInfo.hasHeader ? '있음' : '없음'}`);
      console.log(`   Dropdown 컨테이너: ${navigationInfo.dropdownCount}개`);
      console.log(`   Onclick 버튼: ${navigationInfo.onclickButtonCount}개`);
      console.log(`   Tailwind CDN: ${navigationInfo.usesTailwindCDN ? '사용' : '미사용'}`);
      console.log(`   Tailwind Local: ${navigationInfo.usesTailwindLocal ? '사용' : '미사용'}`);

      // 문제점 분석
      let issues = [];
      if (navigationInfo.dropdownCount === 0) issues.push('Dropdown 메뉴 없음');
      if (navigationInfo.onclickButtonCount > 0) issues.push('CSP 위반 onclick 사용');
      if (!navigationInfo.usesTailwindCDN && navigationInfo.usesTailwindLocal) issues.push('로컬 Tailwind 사용');
      if (!navigationInfo.hasNav || navigationInfo.navStructure.includes('NO NAV')) issues.push('현대적 Navigation 구조 없음');

      console.log(`   🚨 문제점: ${issues.length > 0 ? issues.join(', ') : '없음'}`);

      analysisResults.push({
        page: pageInfo.name,
        url: pageInfo.url,
        issues: issues,
        needsUpdate: issues.length > 0
      });

      // 스크린샷 저장
      const screenshotName = pageInfo.name.replace(/\s+/g, '-').toLowerCase();
      await page.screenshot({ 
        path: `/home/ptyoung/work/AIRIS_APM/${screenshotName}-before-fix.png`,
        fullPage: true 
      });

    } catch (error) {
      console.log(`   ❌ ${pageInfo.name} 분석 오류: ${error.message}`);
      analysisResults.push({
        page: pageInfo.name,
        url: pageInfo.url,
        issues: ['페이지 로드 실패'],
        needsUpdate: true
      });
    }
  }

  // 종합 분석 리포트
  console.log(`\n📊 종합 분석 결과:`);
  const needsFixPages = analysisResults.filter(result => result.needsUpdate);
  console.log(`수정이 필요한 페이지: ${needsFixPages.length}/${analysisResults.length}개`);
  
  if (needsFixPages.length > 0) {
    console.log(`\n🔧 수정 대상 페이지:`);
    needsFixPages.forEach(result => {
      console.log(`- ${result.page}: ${result.issues.join(', ')}`);
    });
  }

  await browser.close();
  console.log('🔍 분석 완료!');
  
  return analysisResults;
}

analyze6PagesWithPlaywright().catch(console.error);