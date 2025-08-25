const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testWASDashboard() {
  console.log('🧪 Starting comprehensive WAS Dashboard test...\n');
  
  let browser, context, page;
  const testResults = [];
  const screenshots = [];
  
  try {
    // Launch browser
    browser = await chromium.launch({ 
      headless: false,  // Run in headed mode to see the dashboard
      slowMo: 1000      // Slow down for visual verification
    });
    
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    
    // Collect console messages and errors
    const consoleMessages = [];
    const consoleErrors = [];
    
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push({ type, text });
      
      if (type === 'error') {
        consoleErrors.push(text);
      }
      
      console.log(`📄 Console [${type}]: ${text}`);
    });
    
    // Collect page errors (uncaught exceptions)
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
      console.log(`💥 Page Error: ${error.message}`);
    });
    
    console.log('📍 Navigating to WAS Dashboard...');
    
    // Navigate to the dashboard
    try {
      await page.goto('http://localhost:3002/was-dashboard.html', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      testResults.push({ test: 'Page Load', status: 'PASS', details: 'Dashboard loaded successfully' });
    } catch (error) {
      testResults.push({ test: 'Page Load', status: 'FAIL', details: error.message });
      throw error;
    }
    
    // Wait for page to be fully loaded
    await page.waitForTimeout(3000);
    
    // Test 1: Check if page loads without errors
    console.log('✅ Test 1: Page Loading');
    
    // Test 2: Verify no specific error messages in console
    console.log('✅ Test 2: Checking for resolved error messages...');
    
    const hasProductionWarning = consoleErrors.some(msg => 
      msg.includes('cdn.tailwindcss.com should not be used in production')
    );
    
    const hasBabelWarning = consoleErrors.some(msg => 
      msg.includes('You are using the in-browser Babel transformer')
    );
    
    const hasColorsError = consoleErrors.some(msg => 
      msg.includes('colors is not defined')
    );
    
    testResults.push({ 
      test: 'Tailwind Production Warning', 
      status: hasProductionWarning ? 'FAIL' : 'PASS', 
      details: hasProductionWarning ? 'Still shows production warning' : 'Production warning resolved' 
    });
    
    testResults.push({ 
      test: 'Babel Transformer Warning', 
      status: hasBabelWarning ? 'FAIL' : 'PASS', 
      details: hasBabelWarning ? 'Still shows Babel warning' : 'Babel warning resolved' 
    });
    
    testResults.push({ 
      test: 'Colors Undefined Error', 
      status: hasColorsError ? 'FAIL' : 'PASS', 
      details: hasColorsError ? 'Still shows colors error' : 'Colors error resolved' 
    });
    
    // Test 3: Take full page screenshot
    console.log('✅ Test 3: Taking initial screenshot...');
    const initialScreenshot = await page.screenshot({ 
      fullPage: true,
      path: path.join(__dirname, 'screenshots', 'was-dashboard-full.png')
    });
    screenshots.push({ name: 'Full Dashboard', path: 'was-dashboard-full.png' });
    
    // Test 4: Check if charts are visible and properly colored
    console.log('✅ Test 4: Checking chart elements...');
    
    try {
      // Wait for charts to load
      await page.waitForSelector('canvas', { timeout: 10000 });
      
      const chartElements = await page.$$('canvas');
      testResults.push({ 
        test: 'Chart Elements Present', 
        status: chartElements.length > 0 ? 'PASS' : 'FAIL', 
        details: `Found ${chartElements.length} chart canvas elements` 
      });
      
      // Test chart colors by checking if canvas elements are not black
      let chartsWithColor = 0;
      for (let i = 0; i < chartElements.length; i++) {
        try {
          // Take screenshot of individual chart
          const chartScreenshot = await chartElements[i].screenshot();
          const chartPath = path.join(__dirname, 'screenshots', `chart-${i}.png`);
          await fs.promises.writeFile(chartPath, chartScreenshot);
          screenshots.push({ name: `Chart ${i + 1}`, path: `chart-${i}.png` });
          
          // Simple check: if screenshot file size > 1KB, assume chart has content
          const stats = await fs.promises.stat(chartPath);
          if (stats.size > 1024) {
            chartsWithColor++;
          }
        } catch (error) {
          console.log(`⚠️  Could not capture chart ${i}: ${error.message}`);
        }
      }
      
      testResults.push({ 
        test: 'Chart Colors', 
        status: chartsWithColor > 0 ? 'PASS' : 'FAIL', 
        details: `${chartsWithColor}/${chartElements.length} charts appear to have proper rendering` 
      });
      
    } catch (error) {
      testResults.push({ 
        test: 'Chart Elements Present', 
        status: 'FAIL', 
        details: 'Charts not found or failed to load: ' + error.message 
      });
    }
    
    // Test 5: Test UI interactions
    console.log('✅ Test 5: Testing UI interactions...');
    
    try {
      // Test WAS type selector
      const wasSelector = await page.$('select');
      if (wasSelector) {
        await wasSelector.selectOption('weblogic');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(__dirname, 'screenshots', 'weblogic-selected.png') });
        screenshots.push({ name: 'WebLogic Selected', path: 'weblogic-selected.png' });
        
        await wasSelector.selectOption('websphere');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(__dirname, 'screenshots', 'websphere-selected.png') });
        screenshots.push({ name: 'WebSphere Selected', path: 'websphere-selected.png' });
        
        testResults.push({ test: 'WAS Selector Interaction', status: 'PASS', details: 'WAS selector works correctly' });
      } else {
        testResults.push({ test: 'WAS Selector Interaction', status: 'FAIL', details: 'WAS selector not found' });
      }
    } catch (error) {
      testResults.push({ test: 'WAS Selector Interaction', status: 'FAIL', details: error.message });
    }
    
    // Test 6: Check shadcn/ui styling
    console.log('✅ Test 6: Verifying shadcn/ui styling...');
    
    try {
      // Check for modern card styling
      const cards = await page.$$('.bg-white, .bg-card');
      const buttons = await page.$$('.bg-blue-600, .bg-primary');
      const shadows = await page.$$('.shadow, .shadow-lg');
      
      testResults.push({ 
        test: 'shadcn/ui Styling', 
        status: (cards.length > 0 && buttons.length > 0) ? 'PASS' : 'FAIL', 
        details: `Found ${cards.length} cards, ${buttons.length} buttons, ${shadows.length} shadowed elements` 
      });
      
    } catch (error) {
      testResults.push({ test: 'shadcn/ui Styling', status: 'FAIL', details: error.message });
    }
    
    // Test 7: Check Korean localization
    console.log('✅ Test 7: Verifying Korean localization...');
    
    try {
      const koreanText = await page.$eval('body', el => el.innerText);
      const hasKorean = /[\u3131-\u3163\uac00-\ud7a3]/.test(koreanText);
      
      testResults.push({ 
        test: 'Korean Localization', 
        status: hasKorean ? 'PASS' : 'FAIL', 
        details: hasKorean ? 'Korean text found in dashboard' : 'No Korean text detected' 
      });
      
    } catch (error) {
      testResults.push({ test: 'Korean Localization', status: 'FAIL', details: error.message });
    }
    
    // Test 8: Check for JavaScript errors
    console.log('✅ Test 8: Checking for JavaScript errors...');
    
    testResults.push({ 
      test: 'JavaScript Errors', 
      status: pageErrors.length === 0 ? 'PASS' : 'FAIL', 
      details: pageErrors.length === 0 ? 'No JavaScript errors found' : `${pageErrors.length} errors: ${pageErrors.join(', ')}` 
    });
    
    // Test 9: Test navigation menu
    console.log('✅ Test 9: Testing navigation...');
    
    try {
      // Look for navigation menu
      const menuItems = await page.$$('a[href], .nav-link');
      
      testResults.push({ 
        test: 'Navigation Menu', 
        status: menuItems.length > 0 ? 'PASS' : 'FAIL', 
        details: `Found ${menuItems.length} navigation elements` 
      });
      
    } catch (error) {
      testResults.push({ test: 'Navigation Menu', status: 'FAIL', details: error.message });
    }
    
    // Final screenshot
    await page.screenshot({ 
      fullPage: true, 
      path: path.join(__dirname, 'screenshots', 'was-dashboard-final.png') 
    });
    screenshots.push({ name: 'Final State', path: 'was-dashboard-final.png' });
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    testResults.push({ test: 'Overall Execution', status: 'FAIL', details: error.message });
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
  
  // Generate comprehensive report
  console.log('\n📊 COMPREHENSIVE TEST REPORT');
  console.log('==========================================');
  
  let passCount = 0;
  let failCount = 0;
  
  testResults.forEach(result => {
    const status = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${status} ${result.test}: ${result.details}`);
    
    if (result.status === 'PASS') passCount++;
    else failCount++;
  });
  
  console.log('\n📈 SUMMARY');
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${testResults.length}`);
  console.log(`🎯 Success Rate: ${Math.round((passCount / testResults.length) * 100)}%`);
  
  console.log('\n📸 SCREENSHOTS CAPTURED');
  screenshots.forEach(screenshot => {
    console.log(`📷 ${screenshot.name}: ${screenshot.path}`);
  });
  
  console.log('\n🎯 ORIGINAL ISSUES STATUS CHECK:');
  console.log('1. ❓ Tailwind CDN production warning');
  console.log('2. ❓ Babel transformer warning'); 
  console.log('3. ❓ Colors undefined error');
  console.log('4. ❓ Charts appearing black');
  
  // Return results for programmatic access
  return {
    testResults,
    screenshots,
    passCount,
    failCount,
    totalTests: testResults.length,
    successRate: Math.round((passCount / testResults.length) * 100)
  };
}

// Create screenshots directory
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Run the test
if (require.main === module) {
  testWASDashboard()
    .then(results => {
      console.log('\n✨ Test execution completed!');
      process.exit(results.failCount > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testWASDashboard };