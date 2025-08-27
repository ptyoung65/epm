const { chromium } = require('playwright');

async function finalDropdownVerification() {
  console.log('🔍 최종 6개 페이지 dropdown 검증...');
  
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

  let allSuccess = true;
  
  for (const pageInfo of pages) {
    console.log(`\n🧪 ${pageInfo.name} 검증:`);
    
    try {
      // 페이지 로드 및 충분한 대기
      await page.goto(pageInfo.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      // 드롭다운 개수 확인
      const dropdownCount = await page.locator('.relative.group').count();
      console.log(`   드롭다운 개수: ${dropdownCount}개`);

      if (dropdownCount >= 5) {
        // 첫 번째 드롭다운 호버 테스트
        const firstDropdown = page.locator('.relative.group').first();
        const menu = firstDropdown.locator('div.absolute');
        
        // 초기 상태
        const initialOpacity = await menu.evaluate(el => window.getComputedStyle(el).opacity);
        console.log(`   초기 투명도: ${initialOpacity}`);
        
        // 호버
        await firstDropdown.hover();
        await page.waitForTimeout(500);
        
        // 호버 후 상태
        const hoverOpacity = await menu.evaluate(el => window.getComputedStyle(el).opacity);
        const hoverVisibility = await menu.evaluate(el => window.getComputedStyle(el).visibility);
        
        console.log(`   호버 후 투명도: ${hoverOpacity}, 가시성: ${hoverVisibility}`);
        
        const hoverWorks = parseFloat(hoverOpacity) > 0.5 && hoverVisibility === 'visible';
        console.log(`   ✅ 호버 동작: ${hoverWorks ? '성공' : '실패'}`);
        
        if (hoverWorks) {
          console.log(`   🎉 ${pageInfo.name} - 모든 테스트 통과!`);
        } else {
          console.log(`   ❌ ${pageInfo.name} - 호버 동작 실패`);
          allSuccess = false;
        }
      } else {
        console.log(`   ❌ ${pageInfo.name} - 드롭다운 부족 (${dropdownCount}/5)`);
        allSuccess = false;
      }
      
    } catch (error) {
      console.log(`   ❌ ${pageInfo.name} 검증 오류: ${error.message}`);
      allSuccess = false;
    }
  }

  console.log(`\n📊 최종 결과: ${allSuccess ? '🎉 전체 성공!' : '❌ 일부 실패'}`);
  
  await browser.close();
  return allSuccess;
}

finalDropdownVerification().catch(console.error);