const { chromium } = require('playwright');

async function verifyWASDashboardFix() {
  console.log('🔧 WAS Dashboard 수정 후 검증 시작...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 캐시 무시하고 페이지 로드
    await page.goto('http://localhost:3001/was-dashboard.html?t=' + Date.now(), { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 드롭다운 검증
    const dropdownAnalysis = await page.evaluate(() => {
      const dropdowns = document.querySelectorAll('.relative.group');
      const activeButton = document.querySelector('.relative.group button.bg-blue-100');
      const activeMenuItem = document.querySelector('.relative.group .absolute a.text-blue-700');
      
      return {
        dropdownCount: dropdowns.length,
        hasActiveButton: !!activeButton,
        activeButtonText: activeButton ? activeButton.textContent.trim() : null,
        hasActiveMenuItem: !!activeMenuItem,
        activeMenuItemText: activeMenuItem ? activeMenuItem.textContent.trim() : null,
        hasDropdownCSS: document.querySelector('style').textContent.includes('Dropdown 메뉴 완전 제어')
      };
    });

    // 호버 테스트
    console.log('\n🖱️  드롭다운 호버 테스트...');
    const firstDropdown = page.locator('.relative.group').first();
    const firstMenu = firstDropdown.locator('div.absolute');
    
    // 초기 상태
    const initialState = await firstMenu.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        opacity: style.opacity,
        visibility: style.visibility
      };
    });

    // 호버
    await firstDropdown.hover();
    await page.waitForTimeout(500);

    // 호버 후 상태
    const hoverState = await firstMenu.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        opacity: style.opacity,
        visibility: style.visibility
      };
    });

    const hoverWorks = parseFloat(hoverState.opacity) > 0.5 && hoverState.visibility === 'visible';

    // 페이지 컴포넌트 구조 분석
    const componentAnalysis = await page.evaluate(() => {
      const components = [];
      
      // 헤더 (페이지 제목)
      const pageHeader = document.querySelector('h1, h2');
      if (pageHeader) {
        components.push({
          type: 'page-header',
          content: pageHeader.textContent.trim(),
          order: 1
        });
      }

      // WAS 서버 선택 섹션
      const serverSelection = document.querySelector('select, .server-selection');
      if (serverSelection || document.textContent.includes('WAS 서버 선택')) {
        components.push({
          type: 'server-selection',
          content: 'WAS 서버 선택 드롭다운',
          order: 2
        });
      }

      // 메트릭 카드들 (상단 KPI)
      const metricCards = document.querySelectorAll('.bg-white, .bg-card, .metric-card');
      let metricCardCount = 0;
      metricCards.forEach((card, index) => {
        const hasMetrics = card.querySelector('h3, .text-2xl, .font-bold');
        if (hasMetrics) {
          metricCardCount++;
        }
      });
      
      if (metricCardCount > 0) {
        components.push({
          type: 'metric-cards',
          content: `${metricCardCount}개의 메트릭 카드`,
          order: 3
        });
      }

      // 차트 섹션들
      const charts = document.querySelectorAll('canvas');
      charts.forEach((chart, index) => {
        const parentSection = chart.closest('div.bg-white, div.bg-card, section');
        const sectionTitle = parentSection ? parentSection.querySelector('h3, h4') : null;
        
        components.push({
          type: 'chart',
          content: sectionTitle ? sectionTitle.textContent.trim() : `차트 ${index + 1}`,
          order: 4 + index
        });
      });

      // 테이블 섹션들
      const tables = document.querySelectorAll('table');
      tables.forEach((table, index) => {
        const parentSection = table.closest('div.bg-white, div.bg-card, section');
        const sectionTitle = parentSection ? parentSection.querySelector('h3, h4') : null;
        
        components.push({
          type: 'table',
          content: sectionTitle ? sectionTitle.textContent.trim() : `테이블 ${index + 1}`,
          order: 10 + index
        });
      });

      return components.sort((a, b) => a.order - b.order);
    });

    // 결과 출력
    console.log('\n📊 WAS Dashboard 수정 후 검증 결과:');
    console.log(`✅ 드롭다운 개수: ${dropdownAnalysis.dropdownCount}개`);
    console.log(`✅ 드롭다운 CSS: ${dropdownAnalysis.hasDropdownCSS ? '적용됨' : '누락'}`);
    console.log(`✅ 활성 버튼: ${dropdownAnalysis.hasActiveButton ? dropdownAnalysis.activeButtonText : '없음'}`);
    console.log(`✅ 활성 메뉴항목: ${dropdownAnalysis.hasActiveMenuItem ? dropdownAnalysis.activeMenuItemText : '없음'}`);
    console.log(`✅ 호버 동작: ${hoverWorks ? '정상' : '문제'}`);
    
    console.log('\n📐 페이지 컴포넌트 순서:');
    componentAnalysis.forEach((comp, index) => {
      console.log(`   ${index + 1}. ${comp.type.toUpperCase()}: ${comp.content}`);
    });

    // 권장 컴포넌트 순서
    const recommendedOrder = [
      'page-header (페이지 제목)',
      'server-selection (WAS 서버 선택)',
      'metric-cards (핵심 지표 카드들)',
      'chart (JVM 메모리 사용현황)',
      'chart (스레드 풀 상태)',
      'chart (GC 성능 모니터링)',
      'table (WAS 인스턴스 상태)',
      'table (최근 이벤트 로그)'
    ];

    console.log('\n💡 권장 컴포넌트 순서:');
    recommendedOrder.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item}`);
    });

    // 문제점 및 개선사항
    const issues = [];
    const improvements = [];

    if (dropdownAnalysis.dropdownCount < 5) {
      issues.push('드롭다운 메뉴 부족');
    }
    if (!dropdownAnalysis.hasDropdownCSS) {
      issues.push('드롭다운 제어 CSS 누락');
    }
    if (!hoverWorks) {
      issues.push('호버 동작 문제');
    }
    if (!dropdownAnalysis.hasActiveButton || !dropdownAnalysis.activeButtonText.includes('APM 모니터링')) {
      issues.push('활성 카테고리 문제');
    }
    if (!dropdownAnalysis.hasActiveMenuItem || !dropdownAnalysis.activeMenuItemText.includes('WAS 모니터링')) {
      issues.push('활성 메뉴 항목 문제');
    }

    // 컴포넌트 순서 개선사항
    const hasServerSelection = componentAnalysis.some(c => c.type === 'server-selection');
    const hasMetricCards = componentAnalysis.some(c => c.type === 'metric-cards');
    const chartCount = componentAnalysis.filter(c => c.type === 'chart').length;

    if (!hasServerSelection) {
      improvements.push('WAS 서버 선택 드롭다운 추가');
    }
    if (!hasMetricCards) {
      improvements.push('핵심 메트릭 카드 섹션 추가');
    }
    if (chartCount < 2) {
      improvements.push('JVM 메모리 및 스레드 풀 차트 추가');
    }

    console.log('\n🚨 발견된 문제점:');
    if (issues.length === 0) {
      console.log('   ✅ 문제 없음!');
    } else {
      issues.forEach(issue => console.log(`   ❌ ${issue}`));
    }

    console.log('\n💡 개선 제안사항:');
    if (improvements.length === 0) {
      console.log('   ✅ 컴포넌트 구조 양호!');
    } else {
      improvements.forEach(improvement => console.log(`   🔧 ${improvement}`));
    }

    // 스크린샷 저장
    await page.screenshot({ 
      path: `/home/ptyoung/work/AIRIS_APM/was-dashboard-fixed.png`,
      fullPage: true 
    });

    await browser.close();

    const allGood = issues.length === 0;
    console.log(`\n🏆 최종 결과: ${allGood ? '🎉 모든 기능 정상!' : '🔧 추가 수정 필요'}`);

    return {
      dropdown: dropdownAnalysis,
      hover: { works: hoverWorks, initial: initialState, after: hoverState },
      components: componentAnalysis,
      issues,
      improvements,
      success: allGood
    };

  } catch (error) {
    console.error(`❌ 검증 오류: ${error.message}`);
    await browser.close();
    return null;
  }
}

verifyWASDashboardFix().catch(console.error);