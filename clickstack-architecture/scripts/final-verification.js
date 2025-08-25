const { chromium } = require('playwright');

async function finalVerification() {
  console.log('🎭 Final verification of Babel fix and dashboard functionality...\n');
  
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const dashboards = [
    { name: 'Main Dashboard', url: 'http://localhost:3002/' },
    { name: 'J2EE Dashboard', url: 'http://localhost:3002/j2ee-dashboard.html' },
    { name: 'WAS Dashboard', url: 'http://localhost:3002/was-dashboard.html' },
    { name: 'Exception Dashboard', url: 'http://localhost:3002/exception-dashboard.html' },
    { name: 'Alert Dashboard', url: 'http://localhost:3002/alert-dashboard.html' }
  ];
  
  const results = [];
  
  for (const dashboard of dashboards) {
    console.log(`🔍 Verifying: ${dashboard.name}`);
    
    const page = await context.newPage();
    let babelWarnings = [];
    let otherIssues = [];
    
    page.on('console', (msg) => {
      if (msg.text().includes('transformScriptTags.ts:253') || 
          msg.text().includes('in-browser Babel transformer')) {
        babelWarnings.push(msg.text());
      } else if (msg.type() === 'error') {
        otherIssues.push(`ERROR: ${msg.text()}`);
      }
    });
    
    try {
      await page.goto(dashboard.url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const title = await page.title();
      const hasCharts = await page.$$eval('canvas', canvases => canvases.length > 0).catch(() => false);
      const hasCards = await page.$$eval('.bg-card, [class*="card"]', cards => cards.length > 0).catch(() => false);
      
      console.log(`   📄 Title: ${title}`);
      console.log(`   📊 Charts: ${hasCharts ? '✅' : '❌'}`);
      console.log(`   🎴 Cards: ${hasCards ? '✅' : '❌'}`);
      console.log(`   🚫 Babel Warnings: ${babelWarnings.length === 0 ? '✅ None' : `❌ ${babelWarnings.length}`}`);
      
      if (otherIssues.length > 0) {
        console.log(`   ⚠️  Other Issues: ${otherIssues.length}`);
        otherIssues.forEach(issue => console.log(`      - ${issue}`));
      }
      
      results.push({
        name: dashboard.name,
        success: true,
        babelWarnings: babelWarnings.length,
        hasUI: hasCharts || hasCards,
        title: title
      });
      
    } catch (error) {
      console.log(`   ❌ Failed to load: ${error.message}`);
      results.push({
        name: dashboard.name,
        success: false,
        error: error.message
      });
    }
    
    await page.close();
    console.log('');
  }
  
  await browser.close();
  
  // Summary
  console.log('📋 FINAL VERIFICATION SUMMARY');
  console.log('=' .repeat(50));
  
  const totalBabelWarnings = results.reduce((sum, r) => sum + (r.babelWarnings || 0), 0);
  const workingDashboards = results.filter(r => r.success && r.hasUI).length;
  
  console.log(`🎯 Total Babel Warnings: ${totalBabelWarnings === 0 ? '✅ 0 (FIXED!)' : `❌ ${totalBabelWarnings}`}`);
  console.log(`📊 Working Dashboards: ${workingDashboards}/${results.length}`);
  console.log(`🏆 Overall Status: ${totalBabelWarnings === 0 ? '✅ BABEL FIX SUCCESSFUL' : '❌ BABEL WARNINGS STILL PRESENT'}`);
  
  return totalBabelWarnings === 0;
}

finalVerification().then(success => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('🎉 VERIFICATION COMPLETE: Babel transformer warnings eliminated!');
    process.exit(0);
  } else {
    console.log('❌ VERIFICATION FAILED: Babel warnings still present');
    process.exit(1);
  }
}).catch(console.error);