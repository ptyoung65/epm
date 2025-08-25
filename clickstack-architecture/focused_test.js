const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function focusedTest() {
  console.log('🔍 FOCUSED TEST: Verifying Original Issues are Resolved\n');
  
  let browser, context, page;
  
  try {
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 500
    });
    
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    
    // Collect all console messages
    const allConsoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      allConsoleMessages.push({ type, text, timestamp: Date.now() });
      console.log(`📄 [${type.toUpperCase()}]: ${text}`);
    });
    
    // Collect page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
      console.log(`💥 PAGE ERROR: ${error.message}`);
    });
    
    console.log('🌐 Loading WAS Dashboard...');
    await page.goto('http://localhost:3002/was-dashboard.html', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for everything to load
    await page.waitForTimeout(5000);
    
    console.log('\n📊 CHECKING ORIGINAL ISSUES:\n');
    
    // Issue 1: Tailwind CDN Production Warning
    const tailwindWarnings = allConsoleMessages.filter(msg => 
      msg.text.includes('cdn.tailwindcss.com should not be used in production') ||
      msg.text.includes('tailwindcss') && msg.text.includes('production')
    );
    
    console.log(`1️⃣ TAILWIND CDN PRODUCTION WARNING:`);
    console.log(`   Found ${tailwindWarnings.length} related messages`);
    tailwindWarnings.forEach(msg => console.log(`   📄 ${msg.text}`));
    console.log(`   Status: ${tailwindWarnings.length === 0 ? '✅ RESOLVED' : '❌ STILL PRESENT'}\n`);
    
    // Issue 2: Babel Transformer Warning
    const babelWarnings = allConsoleMessages.filter(msg => 
      msg.text.includes('You are using the in-browser Babel transformer') ||
      msg.text.includes('babel') && msg.text.includes('browser')
    );
    
    console.log(`2️⃣ BABEL TRANSFORMER WARNING:`);
    console.log(`   Found ${babelWarnings.length} related messages`);
    babelWarnings.forEach(msg => console.log(`   📄 ${msg.text}`));
    console.log(`   Status: ${babelWarnings.length === 0 ? '✅ RESOLVED' : '❌ STILL PRESENT'}\n`);
    
    // Issue 3: Colors is not defined
    const colorsErrors = allConsoleMessages.filter(msg => 
      msg.text.includes('colors is not defined') ||
      (msg.type === 'error' && msg.text.includes('colors'))
    );
    
    console.log(`3️⃣ COLORS UNDEFINED ERROR:`);
    console.log(`   Found ${colorsErrors.length} related messages`);
    colorsErrors.forEach(msg => console.log(`   📄 ${msg.text}`));
    console.log(`   Status: ${colorsErrors.length === 0 ? '✅ RESOLVED' : '❌ STILL PRESENT'}\n`);
    
    // Issue 4: Charts appearing black - Visual inspection
    console.log(`4️⃣ CHARTS APPEARING BLACK (Visual Inspection):`);
    
    // Take full page screenshot first
    const screenshotsDir = path.join(__dirname, 'verification_screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    await page.screenshot({ 
      fullPage: true, 
      path: path.join(screenshotsDir, 'full_dashboard.png') 
    });
    console.log(`   📸 Full dashboard screenshot saved`);
    
    // Check individual charts
    try {
      const charts = await page.$$('canvas');
      console.log(`   Found ${charts.length} chart canvas elements`);
      
      for (let i = 0; i < charts.length; i++) {
        try {
          const chartBounds = await charts[i].boundingBox();
          if (chartBounds) {
            await charts[i].screenshot({ 
              path: path.join(screenshotsDir, `chart_${i + 1}.png`) 
            });
            console.log(`   📸 Chart ${i + 1} screenshot saved (${chartBounds.width}x${chartBounds.height})`);
          }
        } catch (chartError) {
          console.log(`   ⚠️  Could not capture chart ${i + 1}: ${chartError.message}`);
        }
      }
      
      // Test chart colors by checking Chart.js configuration
      const chartColors = await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        const results = [];
        
        canvases.forEach((canvas, index) => {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Get image data from center of canvas
            const imageData = ctx.getImageData(canvas.width/2, canvas.height/2, 1, 1);
            const [r, g, b, a] = imageData.data;
            const isBlack = (r < 50 && g < 50 && b < 50 && a > 0);
            const isTransparent = (a === 0);
            
            results.push({
              index: index + 1,
              centerPixel: { r, g, b, a },
              isBlack,
              isTransparent,
              hasContent: !isTransparent
            });
          }
        });
        
        return results;
      });
      
      console.log(`   📊 Chart color analysis:`);
      chartColors.forEach(chart => {
        const status = chart.isBlack ? '❌ BLACK' : 
                      chart.isTransparent ? '⚠️  TRANSPARENT' : 
                      '✅ HAS COLOR';
        console.log(`   Chart ${chart.index}: ${status} (RGBA: ${chart.centerPixel.r}, ${chart.centerPixel.g}, ${chart.centerPixel.b}, ${chart.centerPixel.a})`);
      });
      
      const blackCharts = chartColors.filter(c => c.isBlack).length;
      console.log(`   Status: ${blackCharts === 0 ? '✅ RESOLVED' : `❌ ${blackCharts} CHARTS STILL BLACK`}\n`);
      
    } catch (chartError) {
      console.log(`   ❌ Chart analysis failed: ${chartError.message}\n`);
    }
    
    // Additional verification: Check if dashboard is functional
    console.log(`5️⃣ DASHBOARD FUNCTIONALITY:`);
    
    // Check if title is loaded
    const title = await page.title();
    console.log(`   📄 Page title: "${title}"`);
    
    // Check if main elements are present
    const mainElements = await page.evaluate(() => {
      return {
        hasCharts: document.querySelectorAll('canvas').length > 0,
        hasCards: document.querySelectorAll('.bg-white, .bg-card, .bg-gray-50').length > 0,
        hasKoreanText: /[\u3131-\u3163\uac00-\ud7a3]/.test(document.body.innerText),
        hasNavigationMenu: document.querySelectorAll('a, .nav-link').length > 0
      };
    });
    
    console.log(`   📊 Charts present: ${mainElements.hasCharts ? '✅' : '❌'}`);
    console.log(`   🃏 Cards present: ${mainElements.hasCards ? '✅' : '❌'}`);
    console.log(`   🇰🇷 Korean text: ${mainElements.hasKoreanText ? '✅' : '❌'}`);
    console.log(`   🧭 Navigation: ${mainElements.hasNavigationMenu ? '✅' : '❌'}`);
    
    // Summary of all console messages by type
    console.log(`\n📋 CONSOLE MESSAGE SUMMARY:`);
    const messagesByType = allConsoleMessages.reduce((acc, msg) => {
      acc[msg.type] = (acc[msg.type] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(messagesByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} messages`);
    });
    
    // Check for any remaining critical errors
    const criticalErrors = allConsoleMessages.filter(msg => 
      msg.type === 'error' && 
      !msg.text.includes('favicon.ico') && // Ignore favicon errors
      !msg.text.includes('net::ERR_') // Ignore network errors
    );
    
    console.log(`\n🚨 CRITICAL ERRORS: ${criticalErrors.length}`);
    criticalErrors.forEach(error => {
      console.log(`   💥 ${error.text}`);
    });
    
    console.log(`\n📸 Screenshots saved in: ${screenshotsDir}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

// Run the focused test
focusedTest()
  .then(() => {
    console.log('\n✨ Focused test completed!');
  })
  .catch(error => {
    console.error('💥 Focused test failed:', error);
  });