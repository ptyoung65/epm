const { chromium } = require('playwright');

async function checkDropdownTransparency() {
  console.log('🔍 WAS Dashboard dropdown 투명도 문제 분석...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 페이지 로드
    await page.goto('http://localhost:3001/was-dashboard.html?t=' + Date.now(), { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('\n📊 모든 dropdown 메뉴 투명도 분석...');

    // 모든 드롭다운 메뉴의 스타일 분석
    const dropdownAnalysis = await page.evaluate(() => {
      const dropdowns = document.querySelectorAll('.relative.group');
      const results = [];

      dropdowns.forEach((dropdown, index) => {
        const button = dropdown.querySelector('button');
        const menu = dropdown.querySelector('div.absolute');
        
        if (button && menu) {
          const buttonText = button.textContent.trim();
          const computedStyle = window.getComputedStyle(menu);
          const isActive = button.classList.contains('bg-blue-100') || button.classList.contains('text-blue-700');
          
          results.push({
            index: index + 1,
            buttonText: buttonText,
            isActive: isActive,
            styles: {
              backgroundColor: computedStyle.backgroundColor,
              opacity: computedStyle.opacity,
              visibility: computedStyle.visibility,
              zIndex: computedStyle.zIndex,
              boxShadow: computedStyle.boxShadow,
              border: computedStyle.border,
              borderColor: computedStyle.borderColor
            },
            classes: {
              menuClasses: menu.className,
              hasWhiteBg: menu.classList.contains('bg-white'),
              hasDarkBg: menu.classList.contains('dark:bg-gray-800'),
              hasBorder: menu.classList.contains('border'),
              hasShadow: menu.classList.contains('shadow-lg')
            }
          });
        }
      });

      return results;
    });

    // 각 드롭다운 호버 테스트 및 투명도 확인
    console.log('\n🖱️  각 드롭다운 호버 테스트:');
    
    for (let i = 0; i < dropdownAnalysis.length; i++) {
      const dropdown = page.locator('.relative.group').nth(i);
      const menu = dropdown.locator('div.absolute');
      
      console.log(`\n${i + 1}. ${dropdownAnalysis[i].buttonText}:`);
      console.log(`   활성 상태: ${dropdownAnalysis[i].isActive ? 'YES' : 'NO'}`);
      console.log(`   초기 배경색: ${dropdownAnalysis[i].styles.backgroundColor}`);
      console.log(`   초기 투명도: ${dropdownAnalysis[i].styles.opacity}`);
      console.log(`   Z-Index: ${dropdownAnalysis[i].styles.zIndex}`);
      console.log(`   Box Shadow: ${dropdownAnalysis[i].styles.boxShadow}`);
      console.log(`   Border: ${dropdownAnalysis[i].styles.border}`);
      
      // 호버 테스트
      await dropdown.hover();
      await page.waitForTimeout(500);
      
      const hoverStyles = await menu.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          opacity: style.opacity,
          visibility: style.visibility,
          zIndex: style.zIndex,
          boxShadow: style.boxShadow,
          border: style.border,
          transform: style.transform
        };
      });
      
      console.log(`   호버 후 배경색: ${hoverStyles.backgroundColor}`);
      console.log(`   호버 후 투명도: ${hoverStyles.opacity}`);
      console.log(`   호버 후 가시성: ${hoverStyles.visibility}`);
      console.log(`   호버 후 Transform: ${hoverStyles.transform}`);
      
      // 투명도 문제 체크
      const hasTransparencyIssue = parseFloat(hoverStyles.opacity) < 1.0 || 
                                  hoverStyles.backgroundColor.includes('rgba') ||
                                  hoverStyles.backgroundColor === 'transparent';
      
      if (hasTransparencyIssue) {
        console.log(`   🚨 투명도 문제 발견!`);
      } else {
        console.log(`   ✅ 투명도 정상`);
      }
      
      // 호버 해제
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
    }

    // CSS 규칙 분석
    const cssAnalysis = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      const relevantRules = [];
      
      styleSheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          rules.forEach(rule => {
            if (rule.cssText && (
              rule.cssText.includes('.relative.group') ||
              rule.cssText.includes('.absolute') ||
              rule.cssText.includes('bg-white') ||
              rule.cssText.includes('bg-gray') ||
              rule.cssText.includes('opacity') ||
              rule.cssText.includes('background')
            )) {
              relevantRules.push({
                selector: rule.selectorText || 'unknown',
                cssText: rule.cssText,
                isImportant: rule.cssText.includes('!important')
              });
            }
          });
        } catch (e) {
          // Cross-origin stylesheet access denied
        }
      });
      
      return relevantRules;
    });

    console.log('\n🎨 관련 CSS 규칙들:');
    cssAnalysis.forEach(rule => {
      console.log(`   ${rule.selector}: ${rule.isImportant ? '[!important]' : ''}`);
      if (rule.cssText.includes('background') || rule.cssText.includes('opacity')) {
        console.log(`      ${rule.cssText.substring(0, 100)}...`);
      }
    });

    // 문제 진단 및 해결책 제시
    console.log('\n🔧 문제 진단:');
    
    const apmDropdown = dropdownAnalysis.find(d => d.buttonText.includes('APM 모니터링'));
    const otherDropdowns = dropdownAnalysis.filter(d => !d.buttonText.includes('APM 모니터링'));
    
    if (apmDropdown) {
      console.log(`\nAPM 모니터링 드롭다운:`);
      console.log(`   배경색: ${apmDropdown.styles.backgroundColor}`);
      console.log(`   투명도: ${apmDropdown.styles.opacity}`);
      
      if (otherDropdowns.length > 0) {
        console.log(`\n다른 드롭다운들과 비교:`);
        otherDropdowns.forEach(dropdown => {
          const bgMatch = dropdown.styles.backgroundColor === apmDropdown.styles.backgroundColor;
          const opacityMatch = dropdown.styles.opacity === apmDropdown.styles.opacity;
          console.log(`   ${dropdown.buttonText}:`);
          console.log(`      배경색 일치: ${bgMatch ? '✅' : '❌'} (${dropdown.styles.backgroundColor})`);
          console.log(`      투명도 일치: ${opacityMatch ? '✅' : '❌'} (${dropdown.styles.opacity})`);
        });
      }
    }

    // 스크린샷 저장 (호버 상태로)
    const firstDropdown = page.locator('.relative.group').first();
    await firstDropdown.hover();
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: `/home/ptyoung/work/AIRIS_APM/was-dashboard-transparency-issue.png`,
      fullPage: true 
    });

    await browser.close();

    return {
      dropdowns: dropdownAnalysis,
      css: cssAnalysis
    };

  } catch (error) {
    console.error(`❌ 분석 오류: ${error.message}`);
    await browser.close();
    return null;
  }
}

checkDropdownTransparency().catch(console.error);