const { chromium } = require('playwright');

async function testDropdownNavigation() {
  console.log('🔍 Dropdown 네비게이션 테스트 시작...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseUrl = 'http://localhost:3001';
  const pages = [
    { name: '메인 대시보드', url: '/', expectedDropdowns: 6 },
    { name: 'J2EE 대시보드', url: '/j2ee-dashboard.html', expectedDropdowns: 6 },
    { name: 'WAS 대시보드', url: '/was-dashboard.html', expectedDropdowns: 6 },
    { name: '예외 추적 대시보드', url: '/exception-dashboard.html', expectedDropdowns: 6 },
    { name: '토폴로지 대시보드', url: '/topology-dashboard.html', expectedDropdowns: 6 },
    { name: '알림 관리 대시보드', url: '/alert-dashboard.html', expectedDropdowns: 6 },
    { name: '서비스 관리 (참조)', url: '/services-management.html', expectedDropdowns: 6 }
  ];

  const results = [];

  for (const testPage of pages) {
    console.log(`\n📄 테스트 중: ${testPage.name} (${testPage.url})`);
    
    try {
      await page.goto(`${baseUrl}${testPage.url}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000); // 페이지 로딩 대기

      // dropdown 메뉴 요소들 찾기
      const dropdownGroups = await page.$$('.relative.group');
      console.log(`  └ 발견된 dropdown 그룹: ${dropdownGroups.length}개`);

      // 각 dropdown 그룹 테스트
      const dropdownResults = [];
      for (let i = 0; i < dropdownGroups.length; i++) {
        const group = dropdownGroups[i];
        
        // 버튼 텍스트 가져오기
        const buttonText = await group.$eval('button', btn => btn.textContent.trim()).catch(() => 'Unknown');
        console.log(`    🔸 테스트 중: ${buttonText}`);

        // hover 전 dropdown 메뉴 상태 확인 (숨겨진 상태여야 함)
        const dropdownMenu = await group.$('div.absolute');
        if (!dropdownMenu) {
          console.log(`    ❌ ${buttonText}: dropdown 메뉴 요소를 찾을 수 없음`);
          dropdownResults.push({ button: buttonText, status: 'no_menu', visible: false });
          continue;
        }

        const initialVisibility = await dropdownMenu.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            opacity: style.opacity,
            visibility: style.visibility,
            display: style.display
          };
        });

        console.log(`      초기 상태: opacity=${initialVisibility.opacity}, visibility=${initialVisibility.visibility}`);

        // hover 이벤트 시뮬레이션
        await group.hover();
        await page.waitForTimeout(500); // hover 효과 대기

        // hover 후 dropdown 메뉴 상태 확인 (보여진 상태여야 함)
        const hoverVisibility = await dropdownMenu.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            opacity: style.opacity,
            visibility: style.visibility,
            display: style.display
          };
        });

        console.log(`      hover 후: opacity=${hoverVisibility.opacity}, visibility=${hoverVisibility.visibility}`);

        // 결과 판단
        const isWorking = hoverVisibility.opacity === '1' && hoverVisibility.visibility === 'visible';
        console.log(`    ${isWorking ? '✅' : '❌'} ${buttonText}: ${isWorking ? '정상 작동' : 'hover 효과 없음'}`);
        
        dropdownResults.push({
          button: buttonText,
          status: isWorking ? 'working' : 'broken',
          initialState: initialVisibility,
          hoverState: hoverVisibility
        });

        // 다음 테스트를 위해 hover 해제
        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);
      }

      results.push({
        page: testPage.name,
        url: testPage.url,
        dropdownCount: dropdownGroups.length,
        dropdowns: dropdownResults,
        overallStatus: dropdownResults.every(d => d.status === 'working') ? 'working' : 'broken'
      });

    } catch (error) {
      console.log(`  ❌ 오류: ${error.message}`);
      results.push({
        page: testPage.name,
        url: testPage.url,
        error: error.message,
        overallStatus: 'error'
      });
    }
  }

  await browser.close();

  // 결과 요약
  console.log('\n📊 테스트 결과 요약:');
  console.log('='.repeat(60));
  
  for (const result of results) {
    const status = result.overallStatus === 'working' ? '✅' : 
                   result.overallStatus === 'error' ? '💥' : '❌';
    console.log(`${status} ${result.page}: ${result.overallStatus.toUpperCase()}`);
    
    if (result.dropdowns) {
      for (const dropdown of result.dropdowns) {
        const dropdownStatus = dropdown.status === 'working' ? '  ✓' : '  ✗';
        console.log(`  ${dropdownStatus} ${dropdown.button}`);
      }
    }
  }

  // 문제가 있는 페이지들 반환
  const brokenPages = results.filter(r => r.overallStatus !== 'working');
  if (brokenPages.length > 0) {
    console.log('\n🔧 수정이 필요한 페이지들:');
    brokenPages.forEach(page => {
      console.log(`  - ${page.page} (${page.url})`);
    });
  } else {
    console.log('\n🎉 모든 페이지의 dropdown이 정상 작동합니다!');
  }

  return results;
}

// 테스트 실행
testDropdownNavigation().catch(console.error);