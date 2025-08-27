const { chromium } = require('playwright');

async function debugExceptionDropdown() {
  console.log('🔍 Exception 대시보드 dropdown z-index 문제 분석...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('\n📄 Exception 대시보드 로딩...');
    await page.goto('http://localhost:3001/exception-dashboard.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 초기 스크린샷
    await page.screenshot({ 
      path: '/home/ptyoung/work/AIRIS_APM/exception-initial.png',
      fullPage: true 
    });
    console.log('📷 초기 스크린샷 저장: exception-initial.png');

    // 첫 번째 dropdown hover
    const firstDropdown = await page.$('.relative.group');
    if (firstDropdown) {
      console.log('\n🔍 첫 번째 dropdown 분석...');
      
      // hover 전 상태
      const beforeHover = await page.evaluate(() => {
        const dropdown = document.querySelector('.relative.group div.absolute');
        if (dropdown) {
          const style = window.getComputedStyle(dropdown);
          const rect = dropdown.getBoundingClientRect();
          return {
            zIndex: style.zIndex,
            position: style.position,
            opacity: style.opacity,
            visibility: style.visibility,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          };
        }
        return null;
      });
      
      console.log('Hover 전 dropdown 상태:', beforeHover);

      // hover 실행
      await firstDropdown.hover();
      await page.waitForTimeout(1000);

      // hover 후 상태
      const afterHover = await page.evaluate(() => {
        const dropdown = document.querySelector('.relative.group div.absolute');
        if (dropdown) {
          const style = window.getComputedStyle(dropdown);
          const rect = dropdown.getBoundingClientRect();
          return {
            zIndex: style.zIndex,
            position: style.position,
            opacity: style.opacity,
            visibility: style.visibility,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          };
        }
        return null;
      });
      
      console.log('Hover 후 dropdown 상태:', afterHover);

      // hover 상태 스크린샷
      await page.screenshot({ 
        path: '/home/ptyoung/work/AIRIS_APM/exception-hover.png',
        fullPage: true 
      });
      console.log('📷 Hover 스크린샷 저장: exception-hover.png');

      // dropdown 메뉴가 가려지는 요소들 찾기
      const overlappingElements = await page.evaluate(() => {
        const dropdown = document.querySelector('.relative.group div.absolute');
        if (!dropdown) return [];
        
        const dropdownRect = dropdown.getBoundingClientRect();
        const allElements = document.querySelectorAll('*');
        const overlapping = [];
        
        allElements.forEach((el, index) => {
          if (el === dropdown) return;
          
          const elRect = el.getBoundingClientRect();
          const elStyle = window.getComputedStyle(el);
          
          // 겹치는지 확인
          const isOverlapping = !(
            elRect.right < dropdownRect.left ||
            elRect.left > dropdownRect.right ||
            elRect.bottom < dropdownRect.top ||
            elRect.top > dropdownRect.bottom
          );
          
          if (isOverlapping && elStyle.zIndex && parseInt(elStyle.zIndex) >= 50) {
            overlapping.push({
              tagName: el.tagName,
              className: el.className,
              zIndex: elStyle.zIndex,
              position: elStyle.position,
              top: elRect.top,
              left: elRect.left,
              width: elRect.width,
              height: elRect.height
            });
          }
        });
        
        return overlapping.slice(0, 10); // 상위 10개만
      });
      
      console.log('\n🔍 Dropdown과 겹치는 요소들:');
      overlappingElements.forEach((el, i) => {
        console.log(`${i + 1}. ${el.tagName}.${el.className} (z-index: ${el.zIndex}, position: ${el.position})`);
      });

      // 모든 dropdown 메뉴 아이템들이 보이는지 확인
      const dropdownItems = await page.$$('.relative.group div.absolute a');
      console.log(`\n📋 Dropdown 메뉴 아이템 수: ${dropdownItems.length}`);
      
      for (let i = 0; i < dropdownItems.length; i++) {
        const isVisible = await dropdownItems[i].isVisible();
        const text = await dropdownItems[i].textContent();
        console.log(`${i + 1}. ${text}: ${isVisible ? '✅ 보임' : '❌ 안보임'}`);
      }
    }

  } catch (error) {
    console.log('❌ 오류 발생:', error.message);
  }

  await browser.close();
  console.log('\n🔍 분석 완료!');
}

debugExceptionDropdown().catch(console.error);