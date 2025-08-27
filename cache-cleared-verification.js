const { chromium } = require('playwright');

async function cacheKlearedVerification() {
  console.log('🧹 캐시 삭제 후 dropdown 메뉴 검증...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor', 
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-cache',
      '--disable-application-cache',
      '--disable-offline-load-stale-cache',
      '--disk-cache-size=0',
      '--media-cache-size=0'
    ]
  });
  
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  
  const page = await context.newPage();
  
  // 브라우저 캐시 완전 삭제
  await page.evaluate(() => {
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    localStorage.clear();
    sessionStorage.clear();
  });

  const pages = [
    { url: 'http://localhost:3001/logs-dashboard.html', name: 'Logs Dashboard' },
    { url: 'http://localhost:3001/metrics-dashboard.html', name: 'Metrics Dashboard' },
    { url: 'http://localhost:3001/traces-dashboard.html', name: 'Traces Dashboard' },
    { url: 'http://localhost:3001/session-analysis.html', name: 'Session Analysis' },
    { url: 'http://localhost:3001/session-telemetry-dashboard.html', name: 'Session Telemetry' },
    { url: 'http://localhost:3001/session-replay.html', name: 'Session Replay' }
  ];

  let allSuccess = true;
  
  for (const pageInfo of pages) {
    console.log(`\n🔍 ${pageInfo.name} 캐시 없이 검증:`);
    
    try {
      // 강제 새로고침으로 페이지 로드
      await page.goto(pageInfo.url + '?t=' + Date.now(), { 
        waitUntil: 'networkidle',
        timeout: 30000
      });
      await page.waitForTimeout(3000);

      // 드롭다운 메뉴 확인
      const dropdownInfo = await page.evaluate(() => {
        const dropdowns = document.querySelectorAll('.relative.group');
        const dropdownMenus = document.querySelectorAll('.relative.group .absolute');
        const activeButtons = document.querySelectorAll('.relative.group button[class*="bg-blue-100"]');
        
        return {
          dropdownCount: dropdowns.length,
          menuCount: dropdownMenus.length,
          activeCount: activeButtons.length,
          hasCSS: document.querySelector('style').textContent.includes('Dropdown 메뉴 완전 제어')
        };
      });

      console.log(`   드롭다운: ${dropdownInfo.dropdownCount}개`);
      console.log(`   메뉴: ${dropdownInfo.menuCount}개`);
      console.log(`   활성 버튼: ${dropdownInfo.activeCount}개`);
      console.log(`   CSS 적용: ${dropdownInfo.hasCSS ? '✅' : '❌'}`);

      // 호버 테스트
      if (dropdownInfo.dropdownCount >= 5) {
        const firstDropdown = page.locator('.relative.group').first();
        await firstDropdown.hover();
        await page.waitForTimeout(500);
        
        const menuVisible = await page.evaluate(() => {
          const menu = document.querySelector('.relative.group .absolute');
          const style = window.getComputedStyle(menu);
          return {
            opacity: style.opacity,
            visibility: style.visibility
          };
        });

        const hoverWorks = parseFloat(menuVisible.opacity) > 0.5 && menuVisible.visibility === 'visible';
        console.log(`   호버 동작: ${hoverWorks ? '✅ 성공' : '❌ 실패'}`);
        
        if (!hoverWorks || dropdownInfo.dropdownCount < 5) {
          allSuccess = false;
          console.log(`   ❌ ${pageInfo.name} - 문제 발견`);
        } else {
          console.log(`   🎉 ${pageInfo.name} - 완벽!`);
        }
      } else {
        console.log(`   ❌ ${pageInfo.name} - 드롭다운 부족`);
        allSuccess = false;
      }
      
    } catch (error) {
      console.log(`   ❌ ${pageInfo.name} 오류: ${error.message}`);
      allSuccess = false;
    }
  }

  console.log(`\n🏆 캐시 삭제 후 최종 결과: ${allSuccess ? '🎉 모든 페이지 완벽!' : '❌ 일부 문제 있음'}`);
  
  await browser.close();
  return allSuccess;
}

cacheKlearedVerification().catch(console.error);