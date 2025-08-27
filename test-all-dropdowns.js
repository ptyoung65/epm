const { chromium } = require('playwright');

async function testAllDropdowns() {
  console.log('🔍 모든 dropdown 메뉴 테스트...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('📄 Exception 대시보드 로딩...');
    await page.goto('http://localhost:3001/exception-dashboard.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 모든 dropdown 컨테이너 찾기
    const dropdownContainers = await page.$$('.relative.group');
    console.log(`🔍 발견된 dropdown 컨테이너: ${dropdownContainers.length}개`);

    let totalVisibleItems = 0;
    let totalHiddenItems = 0;

    for (let i = 0; i < dropdownContainers.length; i++) {
      console.log(`\n📋 Dropdown ${i + 1} 테스트:`);
      
      const container = dropdownContainers[i];
      
      // 컨테이너 label 가져오기
      const labelText = await container.evaluate(el => {
        const button = el.querySelector('button');
        return button ? button.textContent.trim() : `Dropdown ${i + 1}`;
      });
      console.log(`   레이블: ${labelText}`);
      
      // hover 실행
      await container.hover();
      await page.waitForTimeout(1000);

      // 이 컨테이너의 모든 메뉴 아이템 확인
      const dropdownItems = await container.$$('.absolute a');
      console.log(`   메뉴 아이템 수: ${dropdownItems.length}개`);
      
      let visibleCount = 0;
      let hiddenCount = 0;
      
      for (let j = 0; j < dropdownItems.length; j++) {
        const item = dropdownItems[j];
        const isVisible = await item.isVisible();
        const text = await item.textContent();
        console.log(`   ${j + 1}. ${text}: ${isVisible ? '✅ 보임' : '❌ 안보임'}`);
        
        if (isVisible) {
          visibleCount++;
          totalVisibleItems++;
        } else {
          hiddenCount++;
          totalHiddenItems++;
        }
      }
      
      console.log(`   📊 이 dropdown 결과: 보이는 항목 ${visibleCount}개, 가려진 항목 ${hiddenCount}개`);
      
      // hover 해제
      await page.mouse.move(50, 50);
      await page.waitForTimeout(500);
    }

    console.log(`\n📊 전체 결과: 보이는 항목 ${totalVisibleItems}개, 가려진 항목 ${totalHiddenItems}개`);
    
    if (totalHiddenItems === 0) {
      console.log('🎉 모든 dropdown 메뉴가 정상적으로 보입니다!');
    } else {
      console.log('❌ 일부 dropdown 메뉴가 여전히 가려져 있습니다.');
    }

    // 최종 스크린샷
    await page.screenshot({ 
      path: '/home/ptyoung/work/AIRIS_APM/all-dropdowns-test.png',
      fullPage: true 
    });
    console.log('📷 전체 테스트 스크린샷 저장: all-dropdowns-test.png');

  } catch (error) {
    console.log('❌ 오류 발생:', error.message);
  }

  await browser.close();
  console.log('🔍 전체 테스트 완료!');
}

testAllDropdowns().catch(console.error);