const { chromium } = require('playwright');

async function verifyTransparencyFix() {
  console.log('🔧 투명도 수정 후 검증...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 캐시 무시하고 페이지 로드
    await page.goto('http://localhost:3001/was-dashboard.html?t=' + Date.now(), { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('\n🎯 투명도 수정 후 각 드롭다운 검증:');

    // 모든 드롭다운 분석
    const results = [];
    const dropdownCount = await page.locator('.relative.group').count();
    
    for (let i = 0; i < dropdownCount; i++) {
      const dropdown = page.locator('.relative.group').nth(i);
      const button = dropdown.locator('button');
      const menu = dropdown.locator('div.absolute');
      
      // 버튼 텍스트 가져오기
      const buttonText = await button.textContent();
      
      console.log(`\n${i + 1}. ${buttonText.trim()}:`);
      
      // 호버 전 상태
      const beforeHover = await menu.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          opacity: style.opacity,
          visibility: style.visibility
        };
      });
      
      console.log(`   호버 전 - 배경: ${beforeHover.backgroundColor}, 투명도: ${beforeHover.opacity}`);
      
      // 호버
      await dropdown.hover();
      await page.waitForTimeout(500);
      
      // 호버 후 상태
      const afterHover = await menu.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          opacity: style.opacity,
          visibility: style.visibility
        };
      });
      
      console.log(`   호버 후 - 배경: ${afterHover.backgroundColor}, 투명도: ${afterHover.opacity}, 가시성: ${afterHover.visibility}`);
      
      // 투명도 문제 체크
      const hasOpaqueBg = !afterHover.backgroundColor.includes('rgba(0, 0, 0, 0)') && 
                         afterHover.backgroundColor !== 'transparent' &&
                         (afterHover.backgroundColor.includes('rgb(255, 255, 255)') || 
                          afterHover.backgroundColor.includes('white') ||
                          afterHover.backgroundColor.includes('rgb(31, 41, 55)'));
      
      const isFullyOpaque = parseFloat(afterHover.opacity) >= 1.0;
      const isVisible = afterHover.visibility === 'visible';
      
      const isFixed = hasOpaqueBg && isFullyOpaque && isVisible;
      
      console.log(`   상태: ${isFixed ? '✅ 수정됨' : '❌ 여전히 문제'}`);
      if (!isFixed) {
        if (!hasOpaqueBg) console.log(`      - 배경색 투명 문제`);
        if (!isFullyOpaque) console.log(`      - 투명도 문제`);
        if (!isVisible) console.log(`      - 가시성 문제`);
      }
      
      results.push({
        index: i + 1,
        buttonText: buttonText.trim(),
        isFixed,
        beforeHover,
        afterHover
      });
      
      // 호버 해제
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
    }

    // 시각적 검증을 위한 모든 드롭다운 동시 호버 테스트
    console.log('\n📸 시각적 검증을 위한 스크린샷 촬영...');
    
    // 첫 번째 드롭다운(APM 모니터링) 호버 상태로 스크린샷
    const apmDropdown = page.locator('.relative.group').first();
    await apmDropdown.hover();
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: `/home/ptyoung/work/AIRIS_APM/was-dashboard-transparency-fixed.png`,
      fullPage: false
    });

    // 결과 요약
    const fixedCount = results.filter(r => r.isFixed).length;
    const totalCount = results.length;
    
    console.log('\n📊 수정 결과 요약:');
    console.log(`   수정된 드롭다운: ${fixedCount}/${totalCount}개`);
    console.log(`   전체 수정 성공: ${fixedCount === totalCount ? '✅ YES' : '❌ NO'}`);
    
    if (fixedCount === totalCount) {
      console.log('\n🎉 모든 드롭다운 메뉴의 투명도 문제가 해결되었습니다!');
      console.log('   - 배경색이 불투명한 흰색/회색으로 설정됨');
      console.log('   - 뒤쪽 글자가 더 이상 투영되지 않음');
      console.log('   - 모든 드롭다운에서 일관된 배경색 적용');
    } else {
      console.log('\n🚨 일부 드롭다운에서 여전히 문제가 있습니다.');
      const problematicDropdowns = results.filter(r => !r.isFixed);
      problematicDropdowns.forEach(dropdown => {
        console.log(`   - ${dropdown.buttonText}: 추가 수정 필요`);
      });
    }

    // Dark 모드 테스트 (가능한 경우)
    console.log('\n🌙 Dark 모드 테스트...');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);
    
    const apmDropdownDark = page.locator('.relative.group').first();
    await apmDropdownDark.hover();
    await page.waitForTimeout(500);
    
    const darkModeStyle = await apmDropdownDark.locator('div.absolute').evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        opacity: style.opacity
      };
    });
    
    console.log(`   Dark 모드 배경색: ${darkModeStyle.backgroundColor}`);
    console.log(`   Dark 모드 투명도: ${darkModeStyle.opacity}`);
    
    const darkModeFixed = !darkModeStyle.backgroundColor.includes('rgba(0, 0, 0, 0)') &&
                         darkModeStyle.backgroundColor !== 'transparent';
    console.log(`   Dark 모드 상태: ${darkModeFixed ? '✅ 정상' : '❌ 문제'}`);

    await browser.close();

    return {
      totalDropdowns: totalCount,
      fixedDropdowns: fixedCount,
      allFixed: fixedCount === totalCount,
      darkModeFixed,
      results
    };

  } catch (error) {
    console.error(`❌ 검증 오류: ${error.message}`);
    await browser.close();
    return null;
  }
}

verifyTransparencyFix().catch(console.error);