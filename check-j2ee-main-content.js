const { chromium } = require('playwright');

async function checkJ2EEMainContent() {
  console.log('🔍 J2EE Dashboard 메인 컨텐츠 분석...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 페이지 로드
    await page.goto(`http://localhost:3001/j2ee-dashboard.html?t=${Date.now()}`, { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
    await page.waitForTimeout(5000);

    console.log('\n📊 메인 컨텐츠 영역 분석...');

    // 메인 컨텐츠 영역 상세 분석
    const contentAnalysis = await page.evaluate(() => {
      const analysis = {
        navigation: {
          exists: !!document.querySelector('nav'),
          height: document.querySelector('nav') ? document.querySelector('nav').offsetHeight : 0
        },
        header: {
          exists: !!document.querySelector('header'),
          height: document.querySelector('header') ? document.querySelector('header').offsetHeight : 0
        },
        main: {
          exists: !!document.querySelector('main'),
          selector: null,
          height: 0,
          visible: false,
          styles: {},
          content: ''
        },
        body: {
          height: document.body.offsetHeight,
          scrollHeight: document.body.scrollHeight,
          styles: window.getComputedStyle(document.body),
          children: Array.from(document.body.children).map(child => ({
            tagName: child.tagName,
            className: child.className,
            id: child.id,
            visible: child.offsetHeight > 0,
            height: child.offsetHeight,
            display: window.getComputedStyle(child).display
          }))
        },
        charts: [],
        tables: [],
        cards: [],
        sections: []
      };

      // main 요소 찾기
      const mainElement = document.querySelector('main') || 
                         document.querySelector('.main') || 
                         document.querySelector('[role="main"]') ||
                         document.querySelector('section');
      
      if (mainElement) {
        analysis.main.selector = mainElement.tagName + (mainElement.className ? `.${mainElement.className.split(' ').join('.')}` : '');
        analysis.main.height = mainElement.offsetHeight;
        analysis.main.visible = mainElement.offsetHeight > 0;
        analysis.main.styles = {
          display: window.getComputedStyle(mainElement).display,
          visibility: window.getComputedStyle(mainElement).visibility,
          opacity: window.getComputedStyle(mainElement).opacity,
          position: window.getComputedStyle(mainElement).position,
          overflow: window.getComputedStyle(mainElement).overflow,
          height: window.getComputedStyle(mainElement).height,
          minHeight: window.getComputedStyle(mainElement).minHeight,
          maxHeight: window.getComputedStyle(mainElement).maxHeight,
          backgroundColor: window.getComputedStyle(mainElement).backgroundColor,
          zIndex: window.getComputedStyle(mainElement).zIndex
        };
        analysis.main.content = mainElement.innerHTML.substring(0, 500) + '...';
      }

      // 차트 요소들 찾기
      document.querySelectorAll('canvas').forEach((canvas, index) => {
        const parent = canvas.closest('div, section');
        analysis.charts.push({
          index,
          id: canvas.id,
          width: canvas.width,
          height: canvas.height,
          offsetWidth: canvas.offsetWidth,
          offsetHeight: canvas.offsetHeight,
          visible: canvas.offsetHeight > 0,
          parentInfo: parent ? {
            tagName: parent.tagName,
            className: parent.className,
            visible: parent.offsetHeight > 0,
            height: parent.offsetHeight
          } : null,
          styles: {
            display: window.getComputedStyle(canvas).display,
            visibility: window.getComputedStyle(canvas).visibility,
            opacity: window.getComputedStyle(canvas).opacity
          }
        });
      });

      // 테이블 요소들 찾기
      document.querySelectorAll('table').forEach((table, index) => {
        analysis.tables.push({
          index,
          rows: table.rows ? table.rows.length : 0,
          visible: table.offsetHeight > 0,
          height: table.offsetHeight,
          styles: {
            display: window.getComputedStyle(table).display,
            visibility: window.getComputedStyle(table).visibility
          }
        });
      });

      // 카드/섹션 요소들 찾기
      document.querySelectorAll('.card, .bg-white, .bg-card, section').forEach((element, index) => {
        // 네비게이션이 아닌 것만
        if (!element.closest('nav')) {
          analysis.cards.push({
            index,
            tagName: element.tagName,
            className: element.className,
            visible: element.offsetHeight > 0,
            height: element.offsetHeight,
            hasContent: element.textContent.length > 10,
            styles: {
              display: window.getComputedStyle(element).display,
              visibility: window.getComputedStyle(element).visibility,
              opacity: window.getComputedStyle(element).opacity
            }
          });
        }
      });

      // 주요 섹션들 찾기
      const potentialSections = document.querySelectorAll('div[class*="container"], div[class*="content"], div[class*="dashboard"], div[class*="grid"]');
      potentialSections.forEach((section, index) => {
        if (!section.closest('nav') && section.offsetHeight > 50) {
          analysis.sections.push({
            index,
            className: section.className,
            visible: section.offsetHeight > 0,
            height: section.offsetHeight,
            children: section.children.length,
            styles: {
              display: window.getComputedStyle(section).display,
              position: window.getComputedStyle(section).position,
              zIndex: window.getComputedStyle(section).zIndex
            }
          });
        }
      });

      return analysis;
    });

    // 결과 출력
    console.log('\n🏗️ 페이지 구조 분석:');
    console.log(`   Navigation: ${contentAnalysis.navigation.exists ? `있음 (높이: ${contentAnalysis.navigation.height}px)` : '없음'}`);
    console.log(`   Header: ${contentAnalysis.header.exists ? `있음 (높이: ${contentAnalysis.header.height}px)` : '없음'}`);
    console.log(`   Main 요소: ${contentAnalysis.main.exists ? `있음 (${contentAnalysis.main.selector})` : '없음'}`);
    
    if (contentAnalysis.main.exists) {
      console.log(`      높이: ${contentAnalysis.main.height}px`);
      console.log(`      표시: ${contentAnalysis.main.visible ? 'YES' : 'NO'}`);
      console.log(`      Display: ${contentAnalysis.main.styles.display}`);
      console.log(`      Visibility: ${contentAnalysis.main.styles.visibility}`);
      console.log(`      Opacity: ${contentAnalysis.main.styles.opacity}`);
      console.log(`      Position: ${contentAnalysis.main.styles.position}`);
      console.log(`      Z-Index: ${contentAnalysis.main.styles.zIndex}`);
    }

    console.log(`\n📊 차트 분석 (${contentAnalysis.charts.length}개):`);
    if (contentAnalysis.charts.length === 0) {
      console.log('   ❌ 차트가 발견되지 않았습니다!');
    } else {
      contentAnalysis.charts.forEach(chart => {
        console.log(`   ${chart.index + 1}. Canvas (ID: ${chart.id || 'none'})`);
        console.log(`      크기: ${chart.offsetWidth}x${chart.offsetHeight}px`);
        console.log(`      표시: ${chart.visible ? 'YES' : 'NO'}`);
        console.log(`      Display: ${chart.styles.display}`);
        console.log(`      Visibility: ${chart.styles.visibility}`);
        console.log(`      Opacity: ${chart.styles.opacity}`);
        if (chart.parentInfo) {
          console.log(`      부모: ${chart.parentInfo.tagName} (높이: ${chart.parentInfo.height}px)`);
        }
      });
    }

    console.log(`\n🃏 카드/섹션 분석 (${contentAnalysis.cards.length}개):`);
    if (contentAnalysis.cards.length === 0) {
      console.log('   ❌ 카드나 섹션이 발견되지 않았습니다!');
    } else {
      contentAnalysis.cards.forEach(card => {
        console.log(`   ${card.index + 1}. ${card.tagName} (${card.className || 'no class'})`);
        console.log(`      높이: ${card.height}px`);
        console.log(`      표시: ${card.visible ? 'YES' : 'NO'}`);
        console.log(`      내용: ${card.hasContent ? 'YES' : 'NO'}`);
        console.log(`      Display: ${card.styles.display}`);
      });
    }

    console.log(`\n📄 주요 섹션들 (${contentAnalysis.sections.length}개):`);
    contentAnalysis.sections.forEach(section => {
      console.log(`   ${section.index + 1}. ${section.className || 'no class'}`);
      console.log(`      높이: ${section.height}px, 자식: ${section.children}개`);
      console.log(`      Display: ${section.styles.display}`);
    });

    console.log(`\n🔍 Body 분석:`);
    console.log(`   높이: ${contentAnalysis.body.height}px`);
    console.log(`   스크롤 높이: ${contentAnalysis.body.scrollHeight}px`);
    console.log(`   직접 자식들:`);
    contentAnalysis.body.children.forEach((child, index) => {
      console.log(`      ${index + 1}. ${child.tagName} (높이: ${child.height}px, 표시: ${child.visible ? 'YES' : 'NO'})`);
      if (child.className) console.log(`         클래스: ${child.className}`);
      console.log(`         Display: ${child.display}`);
    });

    // JavaScript 에러 확인
    const jsErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // Chart.js 로딩 상태 확인
    const chartJSStatus = await page.evaluate(() => {
      return {
        chartJSLoaded: typeof Chart !== 'undefined',
        chartsInitialized: window.chartsInitialized || false,
        initErrors: window.chartInitErrors || [],
        chartInstances: Object.keys(Chart.instances || {}).length
      };
    });

    console.log(`\n📈 Chart.js 상태:`);
    console.log(`   Chart.js 로드: ${chartJSStatus.chartJSLoaded ? 'YES' : 'NO'}`);
    console.log(`   차트 초기화: ${chartJSStatus.chartsInitialized ? 'YES' : 'NO'}`);
    console.log(`   차트 인스턴스: ${chartJSStatus.chartInstances}개`);
    if (chartJSStatus.initErrors.length > 0) {
      console.log(`   초기화 에러:`);
      chartJSStatus.initErrors.forEach(err => console.log(`     - ${err}`));
    }

    // 스크린샷 촬영
    await page.screenshot({ 
      path: `/home/ptyoung/work/AIRIS_APM/j2ee-main-content-analysis.png`,
      fullPage: true 
    });

    // 문제점 진단
    const issues = [];
    if (!contentAnalysis.main.exists) {
      issues.push('Main 컨텐츠 영역이 없음');
    } else if (!contentAnalysis.main.visible) {
      issues.push('Main 컨텐츠 영역이 보이지 않음');
    }
    
    if (contentAnalysis.charts.length === 0) {
      issues.push('차트가 전혀 없음');
    } else {
      const invisibleCharts = contentAnalysis.charts.filter(c => !c.visible);
      if (invisibleCharts.length > 0) {
        issues.push(`${invisibleCharts.length}개 차트가 보이지 않음`);
      }
    }
    
    if (contentAnalysis.cards.length === 0) {
      issues.push('카드/섹션 컨텐츠가 없음');
    }
    
    if (!chartJSStatus.chartJSLoaded) {
      issues.push('Chart.js 로딩 실패');
    }
    
    if (jsErrors.length > 0) {
      issues.push('JavaScript 에러 존재');
    }

    console.log(`\n🚨 발견된 문제점:`);
    if (issues.length === 0) {
      console.log('   ✅ 주요 문제 없음');
    } else {
      issues.forEach(issue => console.log(`   ❌ ${issue}`));
    }

    console.log(`\n💡 권장 해결방법:`);
    if (!contentAnalysis.main.exists || !contentAnalysis.main.visible) {
      console.log('   🔧 Main 컨텐츠 영역 HTML 구조 확인 필요');
    }
    if (contentAnalysis.charts.length === 0 || !chartJSStatus.chartJSLoaded) {
      console.log('   🔧 Chart.js 스크립트 및 초기화 코드 확인 필요');
    }
    if (contentAnalysis.cards.length === 0) {
      console.log('   🔧 대시보드 카드/섹션 HTML 추가 필요');
    }

    await browser.close();

    return {
      contentAnalysis,
      chartJSStatus,
      jsErrors,
      issues
    };

  } catch (error) {
    console.error(`❌ 분석 오류: ${error.message}`);
    await browser.close();
    return null;
  }
}

checkJ2EEMainContent().catch(console.error);