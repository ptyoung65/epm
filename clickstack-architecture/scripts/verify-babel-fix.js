const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

const dashboardUrls = [
  { name: 'Main Dashboard', url: 'http://localhost:3002/' },
  { name: 'WAS Dashboard', url: 'http://localhost:3002/was-dashboard.html' },
  { name: 'Exception Dashboard', url: 'http://localhost:3002/exception-dashboard.html' },
  { name: 'Alert Dashboard', url: 'http://localhost:3002/alert-dashboard.html' },
  { name: 'J2EE Dashboard', url: 'http://localhost:3002/j2ee-dashboard.html' },
  { name: 'Service Topology', url: 'http://localhost:3002/topology-dashboard.html' }
];

async function verifyBabelFix() {
  console.log('🎭 Starting Playwright verification of Babel transformer fix...\n');
  
  const browser = await chromium.launch({ 
    headless: false, // Show browser for visual verification
    slowMo: 1000 // Slow down for better observation
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const results = {
    dashboards: [],
    babelWarningsFound: false,
    totalErrors: 0,
    totalWarnings: 0,
    screenshots: []
  };

  try {
    for (const dashboard of dashboardUrls) {
      console.log(`🔍 Checking: ${dashboard.name}`);
      console.log(`📍 URL: ${dashboard.url}`);
      
      const page = await context.newPage();
      const consoleMessages = [];
      const errors = [];
      
      // Collect all console messages
      page.on('console', (msg) => {
        const message = {
          type: msg.type(),
          text: msg.text(),
          location: msg.location()
        };
        consoleMessages.push(message);
        
        // Check specifically for Babel transformer warnings
        if (msg.text().includes('transformScriptTags.ts:253') || 
            msg.text().includes('in-browser Babel transformer')) {
          results.babelWarningsFound = true;
          console.log(`   ⚠️  BABEL WARNING FOUND: ${msg.text()}`);
        }
        
        // Log other important messages
        if (msg.type() === 'error') {
          errors.push(message);
          results.totalErrors++;
          console.log(`   ❌ ERROR: ${msg.text()}`);
        } else if (msg.type() === 'warning') {
          results.totalWarnings++;
          console.log(`   ⚠️  WARNING: ${msg.text()}`);
        } else if (msg.type() === 'log') {
          console.log(`   📝 LOG: ${msg.text()}`);
        }
      });

      // Handle page errors
      page.on('pageerror', (error) => {
        errors.push({
          type: 'pageerror',
          text: error.message,
          stack: error.stack
        });
        results.totalErrors++;
        console.log(`   💥 PAGE ERROR: ${error.message}`);
      });

      try {
        // Navigate to the dashboard
        await page.goto(dashboard.url, { 
          waitUntil: 'networkidle',
          timeout: 30000
        });

        // Wait a moment for all JavaScript to load and execute
        await page.waitForTimeout(3000);

        // Check if the page loaded successfully
        const title = await page.title();
        console.log(`   📄 Page Title: ${title}`);

        // Take screenshot
        const screenshotPath = `/home/ptyoung/work/AIRIS_APM/clickstack-architecture/scripts/screenshots/${dashboard.name.replace(/\s+/g, '-').toLowerCase()}-verification.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        results.screenshots.push(screenshotPath);
        console.log(`   📸 Screenshot saved: ${screenshotPath}`);

        // Check for essential UI elements
        const hasCharts = await page.$$eval('canvas', canvases => canvases.length > 0).catch(() => false);
        const hasCards = await page.$$eval('.bg-card, [class*="card"]', cards => cards.length > 0).catch(() => false);
        const hasButtons = await page.$$eval('button', buttons => buttons.length > 0).catch(() => false);

        console.log(`   📊 Charts present: ${hasCharts ? '✅' : '❌'}`);
        console.log(`   🎴 Cards present: ${hasCards ? '✅' : '❌'}`);
        console.log(`   🔘 Buttons present: ${hasButtons ? '✅' : '❌'}`);

        results.dashboards.push({
          name: dashboard.name,
          url: dashboard.url,
          title: title,
          consoleMessages: consoleMessages,
          errors: errors,
          uiElements: {
            hasCharts,
            hasCards,
            hasButtons
          },
          screenshot: screenshotPath
        });

      } catch (navigationError) {
        console.log(`   ❌ Failed to load dashboard: ${navigationError.message}`);
        results.dashboards.push({
          name: dashboard.name,
          url: dashboard.url,
          error: navigationError.message,
          consoleMessages: consoleMessages,
          errors: errors
        });
      }

      await page.close();
      console.log(`✅ Completed: ${dashboard.name}\n`);
    }

  } catch (error) {
    console.error(`❌ Browser automation error: ${error.message}`);
  } finally {
    await browser.close();
  }

  // Generate summary report
  console.log('📋 VERIFICATION SUMMARY');
  console.log('=' .repeat(50));
  console.log(`🎯 Babel Transformer Warnings Found: ${results.babelWarningsFound ? '❌ YES' : '✅ NO'}`);
  console.log(`⚠️  Total Warnings: ${results.totalWarnings}`);
  console.log(`❌ Total Errors: ${results.totalErrors}`);
  console.log(`📊 Dashboards Checked: ${results.dashboards.length}`);
  console.log(`📸 Screenshots Taken: ${results.screenshots.length}`);

  // Create detailed report file
  const reportPath = '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/scripts/babel-verification-report.json';
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved: ${reportPath}`);

  return results;
}

// Create screenshots directory
async function ensureScreenshotsDir() {
  const screenshotsDir = '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/scripts/screenshots';
  try {
    await fs.mkdir(screenshotsDir, { recursive: true });
    console.log(`📁 Screenshots directory ready: ${screenshotsDir}`);
  } catch (error) {
    console.error(`❌ Failed to create screenshots directory: ${error.message}`);
  }
}

// Main execution
async function main() {
  await ensureScreenshotsDir();
  const results = await verifyBabelFix();
  
  // Exit with appropriate code
  if (results.babelWarningsFound) {
    console.log('\n❌ VERIFICATION FAILED: Babel transformer warnings still present');
    process.exit(1);
  } else {
    console.log('\n✅ VERIFICATION PASSED: No Babel transformer warnings found');
    process.exit(0);
  }
}

main().catch(console.error);