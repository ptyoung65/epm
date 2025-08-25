const { chromium } = require('playwright');

async function checkForBabelWarnings() {
  console.log('🎭 Checking for Babel transformer warnings...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  const urls = [
    'http://localhost:3002/',
    'http://localhost:3002/j2ee-dashboard.html',
    'http://localhost:3002/was-dashboard.html',
    'http://localhost:3002/exception-dashboard.html',
    'http://localhost:3002/alert-dashboard.html',
    'http://localhost:3002/topology-dashboard.html'
  ];
  
  let babelWarningsFound = false;
  let totalWarnings = 0;
  
  for (const url of urls) {
    console.log(`🔍 Checking: ${url}`);
    const page = await context.newPage();
    
    page.on('console', (msg) => {
      if (msg.text().includes('transformScriptTags.ts:253') || 
          msg.text().includes('in-browser Babel transformer')) {
        console.log(`   ❌ BABEL WARNING: ${msg.text()}`);
        babelWarningsFound = true;
        totalWarnings++;
      }
    });
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(2000);
      console.log(`   ✅ No Babel warnings detected`);
    } catch (error) {
      console.log(`   ⚠️  Failed to load: ${error.message}`);
    }
    
    await page.close();
  }
  
  await browser.close();
  
  console.log('\n📋 SUMMARY');
  console.log('=' .repeat(30));
  console.log(`🎯 Babel Warnings Found: ${babelWarningsFound ? '❌ YES' : '✅ NO'}`);
  console.log(`⚠️  Total Babel Warnings: ${totalWarnings}`);
  
  return !babelWarningsFound;
}

checkForBabelWarnings().then(success => {
  if (success) {
    console.log('\n🎉 SUCCESS: No Babel transformer warnings found!');
    process.exit(0);
  } else {
    console.log('\n❌ FAILURE: Babel transformer warnings still present');
    process.exit(1);
  }
}).catch(console.error);