const { chromium } = require('playwright');

async function analyzeWASDashboard() {
  console.log('🔍 WAS Dashboard dropdown 메뉴 및 컴포넌트 순서 분석...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('\n📋 WAS Dashboard 분석 시작...');
    
    // 페이지 로드
    await page.goto('http://localhost:3001/was-dashboard.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 페이지 구조 분석
    const pageAnalysis = await page.evaluate(() => {
      const analysis = {
        title: document.title,
        hasNav: !!document.querySelector('nav'),
        dropdowns: [],
        components: [],
        activeElements: []
      };

      // 드롭다운 메뉴 분석
      const dropdownGroups = document.querySelectorAll('.relative.group');
      dropdownGroups.forEach((group, index) => {
        const button = group.querySelector('button');
        const menu = group.querySelector('div.absolute');
        
        if (button && menu) {
          const buttonText = button.textContent.trim();
          const menuItems = Array.from(menu.querySelectorAll('a')).map(a => ({
            text: a.textContent.trim(),
            href: a.getAttribute('href'),
            isActive: a.classList.contains('text-blue-700') || a.classList.contains('bg-blue-50')
          }));
          
          const isActiveButton = button.classList.contains('bg-blue-100') || button.classList.contains('text-blue-700');
          
          analysis.dropdowns.push({
            index,
            buttonText,
            isActive: isActiveButton,
            menuItemCount: menuItems.length,
            menuItems
          });
        }
      });

      // 페이지 컴포넌트 순서 분석
      const mainContent = document.querySelector('main') || document.body;
      const sections = mainContent.querySelectorAll('section, div.grid, div.bg-white, div.bg-card, .card');
      
      sections.forEach((section, index) => {
        const headings = section.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const chartElements = section.querySelectorAll('canvas, svg, .chart');
        const tableElements = section.querySelectorAll('table');
        
        if (headings.length > 0 || chartElements.length > 0 || tableElements.length > 0) {
          analysis.components.push({
            index,
            type: section.className.includes('grid') ? 'grid-layout' : 
                  section.tagName.toLowerCase() === 'section' ? 'section' : 'content-block',
            headings: Array.from(headings).map(h => ({
              level: h.tagName,
              text: h.textContent.trim()
            })),
            hasCharts: chartElements.length > 0,
            chartCount: chartElements.length,
            hasTables: tableElements.length > 0,
            tableCount: tableElements.length,
            className: section.className
          });
        }
      });

      // 활성 상태 요소 확인
      const activeElements = document.querySelectorAll('[class*="bg-blue-100"], [class*="text-blue-700"], .active');
      analysis.activeElements = Array.from(activeElements).map(el => ({
        tagName: el.tagName,
        className: el.className,
        textContent: el.textContent.trim().substring(0, 50),
        isInNavigation: !!el.closest('nav')
      }));

      return analysis;
    });

    // CSS 분석
    const cssAnalysis = await page.evaluate(() => {
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
        hasGroupHover: styles.includes('group-hover'),
        hasShadcnUI: styles.includes(':root') && styles.includes('--background'),
        tailwindSource: document.querySelector('script[src*="tailwindcss"]') ? 'CDN' : 
                       document.querySelector('link[href*="tailwind"]') ? 'Local' : 'None'
      };
    });

    // 호버 테스트
    console.log('\n🖱️  드롭다운 호버 테스트 중...');
    const hoverResults = [];
    
    for (let i = 0; i < Math.min(pageAnalysis.dropdowns.length, 3); i++) {
      const dropdown = page.locator('.relative.group').nth(i);
      const menu = dropdown.locator('div.absolute');
      
      // 호버 전 상태
      const beforeHover = await menu.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          opacity: style.opacity,
          visibility: style.visibility
        };
      });
      
      // 호버
      await dropdown.hover();
      await page.waitForTimeout(500);
      
      // 호버 후 상태
      const afterHover = await menu.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          opacity: style.opacity,
          visibility: style.visibility
        };
      });
      
      hoverResults.push({
        dropdownIndex: i,
        beforeHover,
        afterHover,
        hoverWorks: parseFloat(afterHover.opacity) > 0.5 && afterHover.visibility === 'visible'
      });
    }

    // 결과 출력
    console.log(`\n📊 WAS Dashboard 분석 결과:`);
    console.log(`   제목: ${pageAnalysis.title}`);
    console.log(`   Navigation: ${pageAnalysis.hasNav ? '있음' : '없음'}`);
    console.log(`   드롭다운 개수: ${pageAnalysis.dropdowns.length}개`);
    console.log(`   페이지 컴포넌트: ${pageAnalysis.components.length}개`);

    console.log(`\n🎯 드롭다운 메뉴 상세:`);
    pageAnalysis.dropdowns.forEach(dropdown => {
      console.log(`   ${dropdown.index + 1}. ${dropdown.buttonText} (${dropdown.isActive ? '활성' : '비활성'})`);
      console.log(`      - 메뉴 항목: ${dropdown.menuItemCount}개`);
      if (dropdown.menuItems.length > 0) {
        dropdown.menuItems.forEach(item => {
          console.log(`        • ${item.text} ${item.isActive ? '(활성)' : ''}`);
        });
      }
    });

    console.log(`\n📐 페이지 컴포넌트 순서:`);
    pageAnalysis.components.forEach(comp => {
      console.log(`   ${comp.index + 1}. ${comp.type.toUpperCase()}`);
      if (comp.headings.length > 0) {
        console.log(`      제목: ${comp.headings.map(h => h.text).join(', ')}`);
      }
      if (comp.hasCharts) {
        console.log(`      차트: ${comp.chartCount}개`);
      }
      if (comp.hasTables) {
        console.log(`      테이블: ${comp.tableCount}개`);
      }
    });

    console.log(`\n🎨 CSS 분석:`);
    console.log(`   드롭다운 CSS: ${cssAnalysis.hasDropdownCSS ? '✅' : '❌'}`);
    console.log(`   Z-Index 9999: ${cssAnalysis.hasZIndex9999 ? '✅' : '❌'}`);
    console.log(`   Group Hover: ${cssAnalysis.hasGroupHover ? '✅' : '❌'}`);
    console.log(`   Shadcn/UI: ${cssAnalysis.hasShadcnUI ? '✅' : '❌'}`);
    console.log(`   Tailwind 소스: ${cssAnalysis.tailwindSource}`);

    console.log(`\n🖱️  호버 테스트 결과:`);
    hoverResults.forEach(result => {
      console.log(`   드롭다운 ${result.dropdownIndex + 1}: ${result.hoverWorks ? '✅ 정상' : '❌ 문제'}`);
      if (!result.hoverWorks) {
        console.log(`      Before: opacity=${result.beforeHover.opacity}, visibility=${result.beforeHover.visibility}`);
        console.log(`      After: opacity=${result.afterHover.opacity}, visibility=${result.afterHover.visibility}`);
      }
    });

    // 문제점 식별
    const issues = [];
    if (pageAnalysis.dropdowns.length < 5) {
      issues.push(`드롭다운 메뉴 부족 (${pageAnalysis.dropdowns.length}/5)`);
    }
    if (!cssAnalysis.hasDropdownCSS) {
      issues.push('드롭다운 제어 CSS 누락');
    }
    if (!hoverResults.every(r => r.hoverWorks)) {
      issues.push('호버 동작 문제');
    }
    
    // 예상 활성 상태 확인 (WAS 대시보드는 APM 모니터링 카테고리)
    const expectedActiveCategory = 'APM 모니터링';
    const expectedActiveItem = 'WAS 모니터링';
    const hasCorrectActiveCategory = pageAnalysis.dropdowns.some(d => 
      d.buttonText.includes(expectedActiveCategory) && d.isActive
    );
    
    if (!hasCorrectActiveCategory) {
      issues.push(`활성 카테고리 문제 (예상: ${expectedActiveCategory})`);
    }

    console.log(`\n🚨 발견된 문제점:`);
    if (issues.length === 0) {
      console.log(`   ✅ 문제 없음 - 모든 기능 정상!`);
    } else {
      issues.forEach(issue => console.log(`   ❌ ${issue}`));
    }

    // 스크린샷 저장
    await page.screenshot({ 
      path: `/home/ptyoung/work/AIRIS_APM/was-dashboard-analysis.png`,
      fullPage: true 
    });

    await browser.close();
    
    return {
      analysis: pageAnalysis,
      css: cssAnalysis,
      hover: hoverResults,
      issues
    };

  } catch (error) {
    console.error(`❌ 분석 오류: ${error.message}`);
    await browser.close();
    return null;
  }
}

analyzeWASDashboard().catch(console.error);