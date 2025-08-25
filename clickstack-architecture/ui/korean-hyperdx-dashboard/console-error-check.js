const { chromium } = require('playwright');

async function checkConsoleErrors() {
  console.log('🔍 브라우저 콘솔 에러 체크');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const warnings = [];
  const logs = [];
  
  // 콘솔 메시지 캐치
  page.on('console', (message) => {
    const text = message.text();
    switch (message.type()) {
      case 'error':
        errors.push(text);
        break;
      case 'warning':
        warnings.push(text);
        break;
      case 'log':
        logs.push(text);
        break;
    }
  });
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // 모든 탭 클릭해보기
    await page.click('#knowledge-tab');
    await page.waitForTimeout(1000);
    
    await page.click('#structure-tab');
    await page.waitForTimeout(1000);
    
    await page.click('#graph-tab');
    await page.waitForTimeout(1000);
    
    console.log('\n📊 콘솔 메시지 요약:');
    console.log(`- 에러: ${errors.length}개`);
    console.log(`- 경고: ${warnings.length}개`);
    console.log(`- 일반 로그: ${logs.length}개`);
    
    if (errors.length > 0) {
      console.log('\n❌ 에러 메시지들:');
      errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  경고 메시지들:');
      warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning}`);
      });
    }
    
    // 중요한 로그 메시지 확인
    const importantLogs = logs.filter(log => 
      log.includes('온톨로지') || 
      log.includes('초기화') || 
      log.includes('완료') ||
      log.includes('렌더링')
    );
    
    if (importantLogs.length > 0) {
      console.log('\n📝 중요 로그 메시지들:');
      importantLogs.forEach((log, i) => {
        console.log(`${i + 1}. ${log}`);
      });
    }
    
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') &&
      !error.includes('404') &&
      !error.includes('extension')
    );
    
    if (criticalErrors.length === 0) {
      console.log('\n✅ 중요한 JavaScript 에러 없음 - 애플리케이션 정상');
    } else {
      console.log(`\n❌ ${criticalErrors.length}개의 중요한 에러 발견`);
    }
    
  } finally {
    await browser.close();
  }
}

checkConsoleErrors().catch(console.error);