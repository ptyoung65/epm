const { chromium } = require('playwright');

async function debugDropdown() {
  console.log('🔍 Dropdown 디버깅...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 메인 페이지 테스트
  console.log('\n📄 메인 페이지 디버깅...');
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // HTML 구조 확인
  const dropdownHTML = await page.$eval('.relative.group div.absolute', el => el.outerHTML);
  console.log('메인 페이지 dropdown HTML:', dropdownHTML.substring(0, 200) + '...');
  
  // 스크린샷 찍기
  await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/main-initial.png' });
  console.log('초기 스크린샷 저장됨: main-initial.png');

  // hover 후 스크린샷
  await page.hover('.relative.group');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/main-hover.png' });
  console.log('Hover 스크린샷 저장됨: main-hover.png');

  console.log('\n📄 J2EE 페이지 디버깅...');
  await page.goto('http://localhost:3001/j2ee-dashboard.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // J2EE HTML 구조 확인
  const j2eeDropdownHTML = await page.$eval('.relative.group div.absolute', el => el.outerHTML).catch(() => 'HTML not found');
  console.log('J2EE 페이지 dropdown HTML:', j2eeDropdownHTML.substring(0, 200) + '...');
  
  await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/j2ee-initial.png' });
  console.log('J2EE 초기 스크린샷 저장됨: j2ee-initial.png');

  await page.hover('.relative.group');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/j2ee-hover.png' });
  console.log('J2EE Hover 스크린샷 저장됨: j2ee-hover.png');

  await browser.close();
  console.log('\n디버깅 완료! 스크린샷을 확인하세요.');
}

debugDropdown().catch(console.error);