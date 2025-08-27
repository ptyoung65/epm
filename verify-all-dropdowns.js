const { chromium } = require('playwright');

async function verifyAllDropdownsWithPlaywright() {
  console.log('🔍 전체 6개 페이지 dropdown 기능 검증 시작...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pages = [
    { url: 'http://localhost:3001/logs-dashboard.html', name: 'Logs Dashboard', expectedActive: '관찰성' },
    { url: 'http://localhost:3001/metrics-dashboard.html', name: 'Metrics Dashboard', expectedActive: '관찰성' },
    { url: 'http://localhost:3001/traces-dashboard.html', name: 'Traces Dashboard', expectedActive: '관찰성' },
    { url: 'http://localhost:3001/session-analysis.html', name: 'Session Analysis', expectedActive: '세션 분석' },
    { url: 'http://localhost:3001/session-telemetry-dashboard.html', name: 'Session Telemetry', expectedActive: '세션 분석' },
    { url: 'http://localhost:3001/session-replay.html', name: 'Session Replay', expectedActive: '세션 분석' }
  ];

  const verificationResults = [];
  let allTestsPassed = true;

  for (const pageInfo of pages) {
    console.log(`\n🧪 ${pageInfo.name} 검증:`);
    
    try {
      // 페이지 로드
      await page.goto(pageInfo.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 드롭다운 기능 검증
      const dropdownTest = await page.evaluate(() => {
        const dropdowns = document.querySelectorAll('.relative.group');
        const results = [];
        
        dropdowns.forEach((dropdown, index) => {
          const button = dropdown.querySelector('button');
          const menu = dropdown.querySelector('div.absolute');
          
          if (button && menu) {
            const buttonText = button.textContent.trim();
            const menuVisible = window.getComputedStyle(menu).visibility;
            const menuOpacity = window.getComputedStyle(menu).opacity;
            const zIndex = window.getComputedStyle(menu).zIndex;
            
            results.push({
              buttonText,
              hasMenu: true,
              initiallyHidden: menuVisible === 'hidden' && menuOpacity === '0',
              hasHighZIndex: parseInt(zIndex) >= 9999
            });
          }
        });
        
        return results;
      });

      // 호버 테스트
      console.log(`   드롭다운 개수: ${dropdownTest.length}개`);
      
      let hoverTestResults = [];
      for (let i = 0; i < Math.min(dropdownTest.length, 3); i++) {
        const dropdown = await page.locator('.relative.group').nth(i);
        
        // 호버 전 상태
        const menuBefore = await dropdown.locator('div.absolute').getAttribute('style');
        
        // 호버
        await dropdown.hover();
        await page.waitForTimeout(300);
        
        // 호버 후 상태 확인
        const menuVisible = await page.evaluate((index) => {
          const dropdown = document.querySelectorAll('.relative.group')[index];
          const menu = dropdown.querySelector('div.absolute');
          const style = window.getComputedStyle(menu);
          return {
            visibility: style.visibility,
            opacity: style.opacity,
            transform: style.transform
          };
        }, i);
        
        hoverTestResults.push({
          dropdownIndex: i,
          beforeHover: menuBefore,
          afterHover: menuVisible,
          hoverWorks: menuVisible.visibility === 'visible' && parseFloat(menuVisible.opacity) > 0
        });
      }

      // 활성 상태 확인
      const activeStateTest = await page.evaluate((expectedActive) => {
        const buttons = document.querySelectorAll('.relative.group button');
        let foundActive = null;
        
        buttons.forEach(button => {
          const buttonText = button.textContent.trim();
          const hasActiveClass = button.classList.contains('bg-blue-100') || 
                                button.classList.contains('text-blue-700');
          
          if (hasActiveClass && buttonText.includes(expectedActive)) {
            foundActive = buttonText;
          }
        });
        
        return foundActive;
      }, pageInfo.expectedActive);

      // CSS 확인
      const cssTest = await page.evaluate(() => {
        const styles = Array.from(document.styleSheets).map(sheet => {
          try {
            return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
          } catch {
            return '';
          }
        }).join('\n');
        
        return {
          hasDropdownCSS: styles.includes('Dropdown 메뉴 완전 제어'),
          hasZIndex9999: styles.includes('z-index: 9999'),
          hasHoverRules: styles.includes('group-hover')
        };
      });

      // 결과 평가
      const testsPassed = {
        dropdownsExist: dropdownTest.length >= 5,
        hoverWorks: hoverTestResults.every(test => test.hoverWorks),
        activeStateCorrect: activeStateTest !== null,
        cssPresent: cssTest.hasDropdownCSS && cssTest.hasZIndex9999
      };

      const pageSuccess = Object.values(testsPassed).every(test => test);
      allTestsPassed = allTestsPassed && pageSuccess;

      console.log(`   ✅ 드롭다운 존재: ${testsPassed.dropdownsExist ? '통과' : '실패'}`);
      console.log(`   ✅ 호버 동작: ${testsPassed.hoverWorks ? '통과' : '실패'}`);
      console.log(`   ✅ 활성 상태: ${testsPassed.activeStateCorrect ? '통과' : '실패'} (${activeStateTest || '없음'})`);
      console.log(`   ✅ CSS 적용: ${testsPassed.cssPresent ? '통과' : '실패'}`);
      console.log(`   🏆 전체 결과: ${pageSuccess ? '✅ 성공' : '❌ 실패'}`);

      verificationResults.push({
        page: pageInfo.name,
        url: pageInfo.url,
        success: pageSuccess,
        details: {
          dropdownCount: dropdownTest.length,
          hoverTests: hoverTestResults,
          activeState: activeStateTest,
          css: cssTest,
          tests: testsPassed
        }
      });

      // 스크린샷 저장
      const screenshotName = pageInfo.name.replace(/\s+/g, '-').toLowerCase();
      await page.screenshot({ 
        path: `/home/ptyoung/work/AIRIS_APM/${screenshotName}-after-fix.png`,
        fullPage: true 
      });

    } catch (error) {
      console.log(`   ❌ ${pageInfo.name} 검증 오류: ${error.message}`);
      allTestsPassed = false;
      verificationResults.push({
        page: pageInfo.name,
        url: pageInfo.url,
        success: false,
        error: error.message
      });
    }
  }

  // 최종 종합 결과
  console.log(`\n📊 최종 검증 결과:`);
  console.log(`성공한 페이지: ${verificationResults.filter(r => r.success).length}/6개`);
  console.log(`전체 테스트: ${allTestsPassed ? '✅ 성공' : '❌ 실패'}`);
  
  if (allTestsPassed) {
    console.log(`\n🎉 모든 페이지의 dropdown 메뉴가 정상 작동합니다!`);
  } else {
    console.log(`\n🚨 일부 페이지에서 문제가 발견되었습니다:`);
    verificationResults.filter(r => !r.success).forEach(result => {
      console.log(`- ${result.page}: ${result.error || '테스트 실패'}`);
    });
  }

  await browser.close();
  console.log('🔍 검증 완료!');
  
  return { allTestsPassed, results: verificationResults };
}

verifyAllDropdownsWithPlaywright().catch(console.error);