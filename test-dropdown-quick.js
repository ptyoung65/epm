const { chromium } = require('playwright');

async function quickDropdownTest() {
  console.log('🔍 빠른 Dropdown 테스트...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const testPages = [
    { name: '메인 대시보드', url: 'http://localhost:3001/' },
    { name: 'J2EE 대시보드', url: 'http://localhost:3001/j2ee-dashboard.html' },
    { name: '서비스 관리 (참조)', url: 'http://localhost:3001/services-management.html' }
  ];

  for (const testPage of testPages) {
    console.log(`\n📄 테스트: ${testPage.name}`);
    
    try {
      await page.goto(testPage.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 첫 번째 dropdown 테스트
      const firstDropdown = await page.$('.relative.group');
      if (firstDropdown) {
        const dropdownMenu = await firstDropdown.$('div.absolute');
        if (dropdownMenu) {
          // 초기 상태
          const initial = await dropdownMenu.evaluate(el => {
            const style = window.getComputedStyle(el);
            return { opacity: style.opacity, visibility: style.visibility };
          });
          
          console.log(`  초기: opacity=${initial.opacity}, visibility=${initial.visibility}`);
          
          // hover
          await firstDropdown.hover();
          await page.waitForTimeout(500);
          
          const hover = await dropdownMenu.evaluate(el => {
            const style = window.getComputedStyle(el);
            return { opacity: style.opacity, visibility: style.visibility };
          });
          
          console.log(`  hover: opacity=${hover.opacity}, visibility=${hover.visibility}`);
          
          const working = initial.opacity === '0' && initial.visibility === 'hidden' && 
                        hover.opacity === '1' && hover.visibility === 'visible';
          console.log(`  결과: ${working ? '✅ 정상' : '❌ 문제있음'}`);
        }
      }
    } catch (error) {
      console.log(`  ❌ 오류: ${error.message}`);
    }
  }

  await browser.close();
  console.log('\n테스트 완료!');
}

quickDropdownTest().catch(console.error);