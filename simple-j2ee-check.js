const { chromium } = require('playwright');

async function simpleJ2EECheck() {
  console.log('🔍 J2EE Dashboard 간단 확인...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const consoleMessages = [];
    const networkErrors = [];
    
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} - ${response.url()}`);
      }
    });

    console.log('\n📋 페이지 로드 중...');
    await page.goto('http://localhost:3001/j2ee-dashboard.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);

    // 기본 페이지 상태 확인
    const pageStatus = await page.evaluate(() => {
      return {
        title: document.title,
        hasBody: !!document.body,
        bodyVisible: document.body ? window.getComputedStyle(document.body).display !== 'none' : false,
        bodyContent: document.body ? document.body.innerHTML.length : 0,
        visibleElements: document.querySelectorAll('*:not([style*="display: none"]):not([style*="visibility: hidden"])').length,
        hasNavigation: !!document.querySelector('nav'),
        hasContent: !!document.querySelector('main, .main, section'),
        hasCharts: !!document.querySelector('canvas'),
        dropdownCount: document.querySelectorAll('.relative.group').length,
        errorMessages: Array.from(document.querySelectorAll('.error, [class*="error"]')).map(el => el.textContent),
        scripts: Array.from(document.querySelectorAll('script')).map(s => ({ src: s.src || 'inline', loaded: s.readyState !== 'loading' }))
      };
    });

    console.log('\n📊 페이지 상태:');
    console.log(`   제목: ${pageStatus.title}`);
    console.log(`   Body 존재: ${pageStatus.hasBody ? 'YES' : 'NO'}`);
    console.log(`   Body 표시: ${pageStatus.bodyVisible ? 'YES' : 'NO'}`);
    console.log(`   컨텐츠 크기: ${pageStatus.bodyContent} bytes`);
    console.log(`   보이는 요소: ${pageStatus.visibleElements}개`);
    console.log(`   Navigation: ${pageStatus.hasNavigation ? 'YES' : 'NO'}`);
    console.log(`   Main Content: ${pageStatus.hasContent ? 'YES' : 'NO'}`);
    console.log(`   Charts: ${pageStatus.hasCharts ? 'YES' : 'NO'}`);
    console.log(`   Dropdowns: ${pageStatus.dropdownCount}개`);

    if (pageStatus.errorMessages.length > 0) {
      console.log(`\n🚨 페이지 내 에러 메시지:`);
      pageStatus.errorMessages.forEach(err => console.log(`   - ${err}`));
    }

    console.log(`\n💬 콘솔 메시지 (${consoleMessages.length}개):`);
    consoleMessages.forEach(msg => console.log(`   ${msg}`));

    if (networkErrors.length > 0) {
      console.log(`\n❌ 네트워크 에러 (${networkErrors.length}개):`);
      networkErrors.forEach(err => console.log(`   ${err}`));
    }

    // 스크린샷 확인
    await page.screenshot({ 
      path: `/home/ptyoung/work/AIRIS_APM/j2ee-dashboard-simple-check.png`,
      fullPage: true 
    });

    // 페이지가 비어있는지 확인
    const isEmpty = pageStatus.bodyContent < 1000 || pageStatus.visibleElements < 10;
    const hasErrors = networkErrors.length > 0 || consoleMessages.some(msg => msg.includes('error'));
    
    console.log(`\n🎯 진단 결과:`);
    if (isEmpty) {
      console.log('   ❌ 페이지 내용이 비어있거나 부족합니다');
    } else {
      console.log('   ✅ 페이지 내용이 존재합니다');
    }
    
    if (hasErrors) {
      console.log('   ❌ 에러가 감지되었습니다');
    } else {
      console.log('   ✅ 주요 에러 없음');
    }

    if (!pageStatus.hasNavigation) {
      console.log('   ❌ Navigation 메뉴가 없습니다');
    } else {
      console.log('   ✅ Navigation 메뉴 존재');
    }

    if (pageStatus.dropdownCount < 5) {
      console.log('   ❌ 드롭다운 메뉴가 부족합니다');
    } else {
      console.log('   ✅ 드롭다운 메뉴 정상');
    }

    await browser.close();
    
    return {
      isEmpty,
      hasErrors,
      pageStatus,
      consoleMessages,
      networkErrors
    };

  } catch (error) {
    console.error(`❌ 확인 오류: ${error.message}`);
    await browser.close();
    return null;
  }
}

simpleJ2EECheck().catch(console.error);