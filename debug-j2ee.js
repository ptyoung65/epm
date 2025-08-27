const { chromium } = require('playwright');

async function debugJ2EEPage() {
  console.log('🔍 J2EE 대시보드 페이지 디버깅...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 콘솔 메시지 수집
  const logs = [];
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
    console.log(`콘솔 ${msg.type()}: ${msg.text()}`);
  });

  // 페이지 오류 수집
  page.on('pageerror', error => {
    console.log('페이지 오류:', error.message);
  });

  // 네트워크 요청 실패 수집
  page.on('requestfailed', request => {
    console.log('요청 실패:', request.url(), request.failure().errorText);
  });

  try {
    console.log('\n📄 J2EE 대시보드 페이지 로딩...');
    await page.goto('http://localhost:3001/j2ee-dashboard.html', { 
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 페이지 로딩 완료 대기
    await page.waitForTimeout(5000);

    // 페이지 내용 확인
    const bodyContent = await page.evaluate(() => {
      return {
        title: document.title,
        bodyInnerHTML: document.body.innerHTML.length,
        hasContent: document.body.children.length > 0,
        visibleElements: document.querySelectorAll('*:not(script):not(style)').length,
        displayedText: document.body.innerText.substring(0, 200)
      };
    });

    console.log('\n📋 페이지 내용 분석:');
    console.log('- 제목:', bodyContent.title);
    console.log('- Body HTML 길이:', bodyContent.bodyInnerHTML);
    console.log('- 컨텐츠 존재:', bodyContent.hasContent);
    console.log('- 보이는 요소 수:', bodyContent.visibleElements);
    console.log('- 표시된 텍스트:', bodyContent.displayedText);

    // 스크린샷 저장
    await page.screenshot({ 
      path: '/home/ptyoung/work/AIRIS_APM/j2ee-debug.png',
      fullPage: true 
    });
    console.log('\n📷 스크린샷 저장: j2ee-debug.png');

    // CSS 로딩 상태 확인
    const cssStatus = await page.evaluate(() => {
      const stylesheets = Array.from(document.styleSheets);
      return stylesheets.map(sheet => {
        try {
          return {
            href: sheet.href,
            rules: sheet.cssRules ? sheet.cssRules.length : 0,
            loaded: true
          };
        } catch (e) {
          return {
            href: sheet.href,
            error: e.message,
            loaded: false
          };
        }
      });
    });

    console.log('\n🎨 CSS 상태:');
    cssStatus.forEach(css => {
      console.log(`- ${css.href}: ${css.loaded ? `${css.rules} rules` : css.error}`);
    });

  } catch (error) {
    console.log('❌ 오류 발생:', error.message);
  }

  await browser.close();
  console.log('\n디버깅 완료!');
}

debugJ2EEPage().catch(console.error);