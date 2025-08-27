const { chromium } = require('playwright');

async function testAll4PagesDropdown() {
  console.log('🔍 4개 모니터링 페이지 dropdown 메뉴 종합 테스트...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pages = [
    { url: 'http://localhost:3001/app-monitoring.html', name: 'App 모니터링' },
    { url: 'http://localhost:3001/system-monitoring.html', name: 'System 모니터링' },
    { url: 'http://localhost:3001/db-monitoring.html', name: 'DB 모니터링' },
    { url: 'http://localhost:3001/web-monitoring.html', name: 'Web 모니터링' }
  ];

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const pageInfo of pages) {
    console.log(`\n📋 ${pageInfo.name} 페이지 테스트:`);
    
    try {
      // 페이지 로드
      await page.goto(pageInfo.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 모든 dropdown 컨테이너 찾기
      const dropdownContainers = await page.$$('.relative.group');
      console.log(`   발견된 dropdown 컨테이너: ${dropdownContainers.length}개`);

      let pageVisibleItems = 0;
      let pageHiddenItems = 0;

      for (let i = 0; i < dropdownContainers.length; i++) {
        const container = dropdownContainers[i];
        
        // 컨테이너 label 가져오기
        const labelText = await container.evaluate(el => {
          const button = el.querySelector('button');
          return button ? button.textContent.trim() : `Dropdown ${i + 1}`;
        });
        
        // hover 실행
        await container.hover();
        await page.waitForTimeout(800);

        // 이 컨테이너의 모든 메뉴 아이템 확인
        const dropdownItems = await container.$$('.absolute a');
        
        let visibleCount = 0;
        let hiddenCount = 0;
        
        for (let j = 0; j < dropdownItems.length; j++) {
          const item = dropdownItems[j];
          const isVisible = await item.isVisible();
          
          if (isVisible) {
            visibleCount++;
          } else {
            hiddenCount++;
          }
        }
        
        console.log(`   ${labelText}: 보이는 항목 ${visibleCount}개, 가려진 항목 ${hiddenCount}개`);
        
        pageVisibleItems += visibleCount;
        pageHiddenItems += hiddenCount;
        
        // hover 해제
        await page.mouse.move(50, 50);
        await page.waitForTimeout(300);
      }

      console.log(`   📊 ${pageInfo.name} 결과: 보이는 항목 ${pageVisibleItems}개, 가려진 항목 ${pageHiddenItems}개`);
      
      if (pageHiddenItems === 0 && pageVisibleItems > 0) {
        console.log(`   ✅ ${pageInfo.name} dropdown 완전히 정상!`);
        totalSuccess++;
      } else {
        console.log(`   ❌ ${pageInfo.name} dropdown 문제 있음!`);
        totalFailed++;
      }

      // 페이지별 스크린샷 저장
      const screenshotName = pageInfo.name.replace(/\s+/g, '-').toLowerCase();
      await page.screenshot({ 
        path: `/home/ptyoung/work/AIRIS_APM/${screenshotName}-dropdown-test.png`,
        fullPage: true 
      });

    } catch (error) {
      console.log(`   ❌ ${pageInfo.name} 테스트 오류: ${error.message}`);
      totalFailed++;
    }
  }

  console.log(`\n📊 전체 테스트 결과:`);
  console.log(`✅ 성공한 페이지: ${totalSuccess}개`);
  console.log(`❌ 실패한 페이지: ${totalFailed}개`);
  
  if (totalFailed === 0) {
    console.log('🎉 모든 4개 페이지의 dropdown 메뉴가 완벽하게 작동합니다!');
  } else {
    console.log('⚠️ 일부 페이지에서 dropdown 문제가 발견되었습니다.');
  }

  await browser.close();
  console.log('🔍 전체 테스트 완료!');
}

testAll4PagesDropdown().catch(console.error);