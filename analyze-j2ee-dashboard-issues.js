const { chromium } = require('playwright');

async function analyzeJ2EEDashboardIssues() {
  console.log('🔍 J2EE Dashboard 문제 분석 시작...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('\n📋 J2EE Dashboard 로드 시도...');
    
    // 네트워크 이벤트 모니터링
    const networkEvents = [];
    const consoleMessages = [];
    const pageErrors = [];

    page.on('response', response => {
      networkEvents.push({
        url: response.url(),
        status: response.status(),
        contentType: response.headers()['content-type']
      });
    });

    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
    });

    // 페이지 로드 시도
    let loadSuccess = false;
    let loadError = null;
    
    try {
      const response = await page.goto('http://localhost:3001/j2ee-dashboard.html', { 
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      loadSuccess = response.status() === 200;
      console.log(`   HTTP 상태: ${response.status()}`);
      console.log(`   Content-Type: ${response.headers()['content-type']}`);
      
    } catch (error) {
      loadError = error.message;
      console.log(`   ❌ 로드 실패: ${error.message}`);
    }

    await page.waitForTimeout(5000);

    // 페이지 기본 구조 분석
    const pageStructure = await page.evaluate(() => {
      return {
        title: document.title,
        hasHTML: !!document.documentElement,
        hasHead: !!document.head,
        hasBody: !!document.body,
        bodyContent: document.body ? document.body.innerHTML.length : 0,
        scripts: Array.from(document.querySelectorAll('script')).map(s => ({
          src: s.src,
          hasContent: s.innerHTML.length > 0,
          type: s.type
        })),
        stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(s => ({
          href: s.href || 'inline',
          hasContent: s.innerHTML ? s.innerHTML.length > 0 : false
        })),
        metaTags: Array.from(document.querySelectorAll('meta')).map(m => ({
          name: m.name,
          content: m.content,
          charset: m.charset
        })),
        bodyClasses: document.body ? document.body.className : null,
        firstElements: document.body ? Array.from(document.body.children).slice(0, 5).map(el => ({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          textContent: el.textContent ? el.textContent.substring(0, 100) : ''
        })) : []
      };
    });

    // 렌더링 상태 확인
    const renderingState = await page.evaluate(() => {
      const body = document.body;
      if (!body) return { hasBody: false };

      const computedStyle = window.getComputedStyle(body);
      const visibleElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });

      return {
        hasBody: true,
        bodyBackground: computedStyle.backgroundColor,
        bodyColor: computedStyle.color,
        bodyDisplay: computedStyle.display,
        visibleElementCount: visibleElements.length,
        hasNavigation: !!document.querySelector('nav'),
        hasHeader: !!document.querySelector('header, h1, h2'),
        hasMainContent: !!document.querySelector('main, .main, .content'),
        hasCharts: !!document.querySelector('canvas'),
        hasTables: !!document.querySelector('table'),
        hasCards: !!document.querySelectorAll('.card, .bg-white, .bg-card').length,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });

    // CSS/JS 로딩 상태 확인
    const resourceLoadingState = await page.evaluate(() => {
      const tailwindLoaded = !!document.querySelector('script[src*="tailwindcss"]') || 
                            !!document.querySelector('link[href*="tailwind"]');
      const chartJSLoaded = !!window.Chart;
      const customStyles = document.querySelectorAll('style').length;
      
      return {
        tailwindLoaded,
        chartJSLoaded,
        customStylesCount: customStyles,
        totalScripts: document.querySelectorAll('script').length,
        totalStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length
      };
    });

    // 드롭다운 메뉴 상태 확인
    const dropdownState = await page.evaluate(() => {
      const dropdowns = document.querySelectorAll('.relative.group');
      const dropdownData = Array.from(dropdowns).map(dropdown => {
        const button = dropdown.querySelector('button');
        const menu = dropdown.querySelector('div.absolute');
        return {
          hasButton: !!button,
          hasMenu: !!menu,
          buttonText: button ? button.textContent.trim() : '',
          isVisible: dropdown.offsetParent !== null
        };
      });

      return {
        dropdownCount: dropdowns.length,
        dropdowns: dropdownData
      };
    });

    // 결과 출력
    console.log('\n📊 J2EE Dashboard 분석 결과:');
    console.log(`✅ 페이지 로드 성공: ${loadSuccess ? 'YES' : 'NO'}`);
    if (loadError) {
      console.log(`❌ 로드 에러: ${loadError}`);
    }

    console.log('\n📄 페이지 기본 구조:');
    console.log(`   제목: ${pageStructure.title}`);
    console.log(`   Body 컨텐츠 크기: ${pageStructure.bodyContent}bytes`);
    console.log(`   스크립트: ${pageStructure.scripts.length}개`);
    console.log(`   스타일시트: ${pageStructure.stylesheets.length}개`);
    
    if (pageStructure.scripts.length > 0) {
      console.log('   로드된 스크립트:');
      pageStructure.scripts.forEach(script => {
        console.log(`     - ${script.src || 'inline'} (${script.hasContent ? 'has content' : 'empty'})`);
      });
    }

    console.log('\n🎨 렌더링 상태:');
    console.log(`   Body 존재: ${renderingState.hasBody ? 'YES' : 'NO'}`);
    console.log(`   보이는 요소: ${renderingState.visibleElementCount}개`);
    console.log(`   Navigation: ${renderingState.hasNavigation ? 'YES' : 'NO'}`);
    console.log(`   Header: ${renderingState.hasHeader ? 'YES' : 'NO'}`);
    console.log(`   Main Content: ${renderingState.hasMainContent ? 'YES' : 'NO'}`);
    console.log(`   Charts: ${renderingState.hasCharts ? 'YES' : 'NO'}`);
    console.log(`   Tables: ${renderingState.hasTables ? 'YES' : 'NO'}`);
    console.log(`   Cards: ${renderingState.hasCards}개`);

    console.log('\n📦 리소스 로딩 상태:');
    console.log(`   Tailwind CSS: ${resourceLoadingState.tailwindLoaded ? 'YES' : 'NO'}`);
    console.log(`   Chart.js: ${resourceLoadingState.chartJSLoaded ? 'YES' : 'NO'}`);
    console.log(`   Custom Styles: ${resourceLoadingState.customStylesCount}개`);

    console.log('\n🎛️  드롭다운 메뉴 상태:');
    console.log(`   드롭다운 개수: ${dropdownState.dropdownCount}개`);
    dropdownState.dropdowns.forEach((dropdown, index) => {
      console.log(`   ${index + 1}. ${dropdown.buttonText || '텍스트 없음'} - ${dropdown.hasButton && dropdown.hasMenu ? 'OK' : 'BROKEN'}`);
    });

    console.log('\n📡 네트워크 요청 상태:');
    const failedRequests = networkEvents.filter(event => event.status >= 400);
    console.log(`   총 요청: ${networkEvents.length}개`);
    console.log(`   실패한 요청: ${failedRequests.length}개`);
    
    if (failedRequests.length > 0) {
      console.log('   실패한 요청들:');
      failedRequests.forEach(req => {
        console.log(`     ❌ ${req.status} - ${req.url}`);
      });
    }

    console.log('\n💬 콘솔 메시지:');
    console.log(`   총 메시지: ${consoleMessages.length}개`);
    const errorMessages = consoleMessages.filter(msg => msg.type === 'error');
    const warningMessages = consoleMessages.filter(msg => msg.type === 'warning');
    
    if (errorMessages.length > 0) {
      console.log(`   ❌ 에러: ${errorMessages.length}개`);
      errorMessages.forEach(err => {
        console.log(`     - ${err.text}`);
      });
    }
    
    if (warningMessages.length > 0) {
      console.log(`   ⚠️  경고: ${warningMessages.length}개`);
      warningMessages.forEach(warn => {
        console.log(`     - ${warn.text}`);
      });
    }

    console.log('\n🚨 페이지 에러:');
    if (pageErrors.length > 0) {
      console.log(`   에러 개수: ${pageErrors.length}개`);
      pageErrors.forEach(error => {
        console.log(`     ❌ ${error.message}`);
      });
    } else {
      console.log('   페이지 에러 없음 ✅');
    }

    // 문제점 진단
    const issues = [];
    if (!loadSuccess) issues.push('페이지 로드 실패');
    if (pageStructure.bodyContent < 1000) issues.push('Body 컨텐츠 부족');
    if (!renderingState.hasNavigation) issues.push('Navigation 누락');
    if (renderingState.visibleElementCount < 10) issues.push('보이는 요소 부족');
    if (!resourceLoadingState.tailwindLoaded) issues.push('Tailwind CSS 로딩 실패');
    if (!resourceLoadingState.chartJSLoaded) issues.push('Chart.js 로딩 실패');
    if (dropdownState.dropdownCount < 5) issues.push('드롭다운 메뉴 부족');
    if (failedRequests.length > 0) issues.push('네트워크 요청 실패');
    if (errorMessages.length > 0) issues.push('JavaScript 에러');

    console.log('\n🔍 발견된 문제점:');
    if (issues.length === 0) {
      console.log('   ✅ 주요 문제 없음');
    } else {
      issues.forEach(issue => {
        console.log(`   ❌ ${issue}`);
      });
    }

    // 스크린샷 저장
    await page.screenshot({ 
      path: `/home/ptyoung/work/AIRIS_APM/j2ee-dashboard-analysis.png`,
      fullPage: true 
    });

    console.log('\n📸 스크린샷 저장 완료: j2ee-dashboard-analysis.png');

    await browser.close();

    return {
      loadSuccess,
      loadError,
      pageStructure,
      renderingState,
      resourceLoadingState,
      dropdownState,
      networkEvents,
      consoleMessages,
      pageErrors,
      issues
    };

  } catch (error) {
    console.error(`❌ 분석 오류: ${error.message}`);
    await browser.close();
    return null;
  }
}

analyzeJ2EEDashboardIssues().catch(console.error);