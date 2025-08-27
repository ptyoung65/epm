const { chromium } = require('playwright');

async function testExceptionFixedDropdown() {
  console.log('🔍 Exception 대시보드 dropdown z-index 수정 후 테스트...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('\n📄 Exception 대시보드 로딩...');
    await page.goto('http://localhost:3001/exception-dashboard.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 첫 번째 dropdown hover
    const firstDropdown = await page.$('.relative.group');
    if (firstDropdown) {
      console.log('\n🔍 Dropdown z-index 확인...');
      
      // hover 실행
      await firstDropdown.hover();
      await page.waitForTimeout(1000);

      // z-index 확인
      const zIndexInfo = await page.evaluate(() => {
        const dropdown = document.querySelector('.relative.group div.absolute');
        if (dropdown) {
          const style = window.getComputedStyle(dropdown);
          return {
            zIndex: style.zIndex,
            opacity: style.opacity,
            visibility: style.visibility
          };
        }
        return null;
      });
      
      console.log('Dropdown z-index:', zIndexInfo);

      // 모든 dropdown 메뉴 아이템들 확인
      const dropdownItems = await page.$$('.relative.group div.absolute a');
      console.log(`\n📋 Dropdown 메뉴 아이템 가시성 테스트:`);
      
      let visibleCount = 0;
      let hiddenCount = 0;
      
      for (let i = 0; i < dropdownItems.length; i++) {
        const isVisible = await dropdownItems[i].isVisible();
        const text = await dropdownItems[i].textContent();
        console.log(`${i + 1}. ${text}: ${isVisible ? '✅ 보임' : '❌ 안보임'}`);
        
        if (isVisible) {
          visibleCount++;
        } else {
          hiddenCount++;
        }
      }
      
      console.log(`\n📊 결과: 보이는 항목 ${visibleCount}개, 가려진 항목 ${hiddenCount}개`);
      
      if (hiddenCount === 0) {
        console.log('🎉 모든 dropdown 메뉴가 정상적으로 보입니다!');
      } else {
        console.log('❌ 일부 dropdown 메뉴가 여전히 가려져 있습니다.');
      }

      // 수정 후 스크린샷
      await page.screenshot({ 
        path: '/home/ptyoung/work/AIRIS_APM/exception-fixed.png',
        fullPage: true 
      });
      console.log('📷 수정 후 스크린샷 저장: exception-fixed.png');
    }

  } catch (error) {
    console.log('❌ 오류 발생:', error.message);
  }

  await browser.close();
  console.log('\n🔍 테스트 완료!');
}

testExceptionFixedDropdown().catch(console.error);