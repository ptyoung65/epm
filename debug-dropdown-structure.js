const { chromium } = require('playwright');

async function debugDropdownStructure() {
  console.log('🔍 Dropdown 구조 상세 분석...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('📄 Exception 대시보드 로딩...');
    await page.goto('http://localhost:3001/exception-dashboard.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 드롭다운 hover
    const dropdown = await page.$('.relative.group');
    if (dropdown) {
      console.log('🔍 첫 번째 dropdown hover...');
      await dropdown.hover();
      await page.waitForTimeout(1000);

      // 드롭다운 컨테이너 정보 확인
      const dropdownInfo = await page.evaluate(() => {
        const dropdown = document.querySelector('.relative.group div.absolute');
        if (dropdown) {
          const rect = dropdown.getBoundingClientRect();
          const style = window.getComputedStyle(dropdown);
          return {
            height: style.height,
            maxHeight: style.maxHeight,
            overflow: style.overflow,
            overflowY: style.overflowY,
            position: style.position,
            top: style.top,
            left: style.left,
            zIndex: style.zIndex,
            rect: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            },
            childrenCount: dropdown.children.length,
            scrollHeight: dropdown.scrollHeight,
            viewportHeight: window.innerHeight
          };
        }
        return null;
      });
      
      console.log('📐 Dropdown container 정보:');
      console.log(JSON.stringify(dropdownInfo, null, 2));

      // 개별 아이템의 위치 확인
      const itemPositions = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.relative.group div.absolute a'));
        return items.map((item, index) => {
          const rect = item.getBoundingClientRect();
          const style = window.getComputedStyle(item);
          const isInViewport = rect.top >= 0 && rect.left >= 0 && 
                              rect.bottom <= window.innerHeight && 
                              rect.right <= window.innerWidth;
          return {
            index: index + 1,
            text: item.textContent.trim(),
            isInViewport: isInViewport,
            rect: { 
              top: Math.round(rect.top), 
              left: Math.round(rect.left), 
              width: Math.round(rect.width), 
              height: Math.round(rect.height),
              bottom: Math.round(rect.bottom),
              right: Math.round(rect.right)
            },
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity
          };
        });
      });
      
      console.log('\n🔍 각 메뉴 아이템 분석:');
      itemPositions.forEach(item => {
        const status = item.isInViewport ? '✅' : '❌';
        console.log(`${item.index}. ${item.text}: ${status}`);
        console.log(`   위치: top=${item.rect.top}, bottom=${item.rect.bottom} (viewport=${dropdownInfo.viewportHeight})`);
        console.log(`   스타일: display=${item.display}, visibility=${item.visibility}, opacity=${item.opacity}`);
      });

      // 뷰포트 밖으로 나간 항목들 확인
      const hiddenItems = itemPositions.filter(item => !item.isInViewport);
      console.log(`\n📊 결과: 총 ${itemPositions.length}개 항목 중 ${hiddenItems.length}개가 뷰포트 밖에 있음`);
      
      if (hiddenItems.length > 0) {
        console.log('💡 해결책: max-height 제거 또는 scroll 기능 추가 필요');
      }

      // 스크린샷 저장
      await page.screenshot({ 
        path: '/home/ptyoung/work/AIRIS_APM/dropdown-debug.png',
        fullPage: true 
      });
      console.log('📷 디버그 스크린샷 저장: dropdown-debug.png');
    }

  } catch (error) {
    console.log('❌ 오류 발생:', error.message);
  }

  await browser.close();
  console.log('🔍 분석 완료!');
}

debugDropdownStructure().catch(console.error);