const { chromium } = require('playwright');

async function detailedJ2EENetworkAnalysis() {
  console.log('🕵️ J2EE Dashboard 상세 네트워크 분석...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const detailedNetworkEvents = [];
    
    // 상세한 네트워크 이벤트 모니터링
    page.on('request', request => {
      detailedNetworkEvents.push({
        type: 'request',
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        resourceType: request.resourceType()
      });
    });

    page.on('response', response => {
      detailedNetworkEvents.push({
        type: 'response',
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        fromCache: response.fromCache()
      });
    });

    page.on('requestfailed', request => {
      detailedNetworkEvents.push({
        type: 'failed',
        url: request.url(),
        failure: request.failure(),
        resourceType: request.resourceType()
      });
    });

    console.log('\n📡 J2EE Dashboard 로드 중...');
    
    await page.goto('http://localhost:3001/j2ee-dashboard.html', { 
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(5000);

    // 네트워크 이벤트 분석
    console.log('\n📊 상세 네트워크 분석:');
    console.log(`총 네트워크 이벤트: ${detailedNetworkEvents.length}개`);

    const requests = detailedNetworkEvents.filter(e => e.type === 'request');
    const responses = detailedNetworkEvents.filter(e => e.type === 'response');
    const failures = detailedNetworkEvents.filter(e => e.type === 'failed');

    console.log(`\n📤 요청 (${requests.length}개):`);
    requests.forEach((req, index) => {
      console.log(`   ${index + 1}. ${req.method} ${req.url}`);
      console.log(`      타입: ${req.resourceType}`);
    });

    console.log(`\n📥 응답 (${responses.length}개):`);
    responses.forEach((res, index) => {
      const status = res.status >= 400 ? '❌' : '✅';
      console.log(`   ${index + 1}. ${status} ${res.status} ${res.statusText} - ${res.url}`);
      console.log(`      캐시: ${res.fromCache ? 'YES' : 'NO'}`);
      console.log(`      Content-Type: ${res.headers['content-type'] || 'unknown'}`);
    });

    if (failures.length > 0) {
      console.log(`\n❌ 실패한 요청들 (${failures.length}개):`);
      failures.forEach((fail, index) => {
        console.log(`   ${index + 1}. ${fail.url}`);
        console.log(`      실패 이유: ${fail.failure ? fail.failure.errorText : 'unknown'}`);
      });
    }

    // 404 오류 상세 분석
    const errorResponses = responses.filter(r => r.status >= 400);
    if (errorResponses.length > 0) {
      console.log(`\n🚨 에러 응답 상세 분석:`);
      errorResponses.forEach(err => {
        console.log(`   URL: ${err.url}`);
        console.log(`   상태: ${err.status} ${err.statusText}`);
        console.log(`   헤더:`, JSON.stringify(err.headers, null, 2));
      });
    }

    // 페이지 내용 샘플 확인
    const pageContent = await page.evaluate(() => {
      return {
        bodyHTML: document.body ? document.body.innerHTML.substring(0, 500) + '...' : 'NO BODY',
        headHTML: document.head ? document.head.innerHTML.substring(0, 500) + '...' : 'NO HEAD',
        documentReady: document.readyState,
        currentURL: window.location.href
      };
    });

    console.log(`\n📄 페이지 내용 샘플:`);
    console.log(`   Document Ready: ${pageContent.documentReady}`);
    console.log(`   Current URL: ${pageContent.currentURL}`);
    console.log(`   Head 샘플: ${pageContent.headHTML.substring(0, 200)}...`);
    console.log(`   Body 샘플: ${pageContent.bodyHTML.substring(0, 200)}...`);

    // CSS/JS 리소스 상세 확인
    const resourceDetails = await page.evaluate(() => {
      const resources = {
        scripts: [],
        stylesheets: [],
        images: [],
        other: []
      };

      // 스크립트 분석
      document.querySelectorAll('script').forEach(script => {
        resources.scripts.push({
          src: script.src || 'inline',
          loaded: script.readyState === 'complete' || !script.src,
          hasContent: script.innerHTML.length > 0,
          type: script.type,
          async: script.async,
          defer: script.defer
        });
      });

      // 스타일시트 분석
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(style => {
        resources.stylesheets.push({
          href: style.href || 'inline',
          loaded: !style.href || style.sheet !== null,
          hasContent: style.innerHTML ? style.innerHTML.length > 0 : false,
          media: style.media
        });
      });

      // 이미지 분석
      document.querySelectorAll('img').forEach(img => {
        resources.images.push({
          src: img.src,
          loaded: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        });
      });

      return resources;
    });

    console.log(`\n📦 리소스 로딩 상태 상세:`);
    
    console.log(`   스크립트 (${resourceDetails.scripts.length}개):`);
    resourceDetails.scripts.forEach((script, index) => {
      const status = script.loaded ? '✅' : '❌';
      console.log(`     ${index + 1}. ${status} ${script.src}`);
      console.log(`        타입: ${script.type || 'default'}, 내용: ${script.hasContent ? 'YES' : 'NO'}`);
    });

    console.log(`   스타일시트 (${resourceDetails.stylesheets.length}개):`);
    resourceDetails.stylesheets.forEach((style, index) => {
      const status = style.loaded ? '✅' : '❌';
      console.log(`     ${index + 1}. ${status} ${style.href}`);
      console.log(`        미디어: ${style.media || 'all'}, 내용: ${style.hasContent ? 'YES' : 'NO'}`);
    });

    // 렌더링 성능 확인
    const performanceMetrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        loadComplete: perf.loadEventEnd - perf.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
      };
    });

    console.log(`\n⏱️  성능 메트릭:`);
    console.log(`   DOM Content Loaded: ${performanceMetrics.domContentLoaded.toFixed(2)}ms`);
    console.log(`   Load Complete: ${performanceMetrics.loadComplete.toFixed(2)}ms`);
    console.log(`   First Paint: ${performanceMetrics.firstPaint.toFixed(2)}ms`);
    console.log(`   First Contentful Paint: ${performanceMetrics.firstContentfulPaint.toFixed(2)}ms`);

    // 추가 스크린샷 (더 긴 대기 시간)
    await page.waitForTimeout(3000);
    await page.screenshot({ 
      path: `/home/ptyoung/work/AIRIS_APM/j2ee-dashboard-detailed.png`,
      fullPage: true 
    });

    await browser.close();

    // 문제 종합 진단
    const diagnostics = [];
    
    if (errorResponses.length > 0) {
      diagnostics.push(`HTTP 에러: ${errorResponses.length}개 요청 실패`);
    }
    
    if (failures.length > 0) {
      diagnostics.push(`네트워크 실패: ${failures.length}개 요청 실패`);
    }
    
    const failedScripts = resourceDetails.scripts.filter(s => !s.loaded);
    if (failedScripts.length > 0) {
      diagnostics.push(`스크립트 로딩 실패: ${failedScripts.length}개`);
    }
    
    const failedStyles = resourceDetails.stylesheets.filter(s => !s.loaded);
    if (failedStyles.length > 0) {
      diagnostics.push(`스타일시트 로딩 실패: ${failedStyles.length}개`);
    }

    console.log(`\n🔍 종합 진단:`);
    if (diagnostics.length === 0) {
      console.log('   ✅ 주요 문제 없음 - 페이지가 정상적으로 로드되었습니다.');
    } else {
      console.log('   발견된 문제들:');
      diagnostics.forEach(diagnostic => {
        console.log(`   ❌ ${diagnostic}`);
      });
    }

    return {
      networkEvents: detailedNetworkEvents,
      pageContent,
      resourceDetails,
      performanceMetrics,
      diagnostics
    };

  } catch (error) {
    console.error(`❌ 상세 분석 오류: ${error.message}`);
    await browser.close();
    return null;
  }
}

detailedJ2EENetworkAnalysis().catch(console.error);