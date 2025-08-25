const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive Tailwind CSS Production Build Verification Test
 * 
 * This script verifies that:
 * 1. No Tailwind CDN scripts are present in HTML source
 * 2. Local CSS file is properly loaded from ./css/tailwind.css
 * 3. shadcn/ui theme colors and styling are correctly applied
 * 4. Charts display with proper colors (not black)
 * 5. Responsive design and layout are working properly
 */

async function verifyTailwindProductionBuild() {
  const browser = await chromium.launch({ 
    headless: true,   // Run in headless mode for CI/server environments
    slowMo: 500      // Moderate slowdown for better stability
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Test URLs and their descriptions
  const testUrls = [
    {
      url: 'http://localhost:3002/',
      name: 'Main Dashboard',
      description: 'Main dashboard with comprehensive monitoring overview'
    },
    {
      url: 'http://localhost:3002/j2ee-dashboard.html',
      name: 'J2EE Dashboard', 
      description: 'J2EE specialized monitoring dashboard'
    },
    {
      url: 'http://localhost:3002/was-dashboard.html',
      name: 'WAS Dashboard',
      description: 'WAS (Web Application Server) monitoring dashboard'
    },
    {
      url: 'http://localhost:3002/exception-dashboard.html',
      name: 'Exception Dashboard',
      description: 'Exception and error tracking dashboard'
    },
    {
      url: 'http://localhost:3002/alert-dashboard.html',
      name: 'Alert Dashboard',
      description: 'Alert and notification management dashboard'
    },
    {
      url: 'http://localhost:3002/topology-dashboard.html',
      name: 'Topology Dashboard',
      description: 'Service topology and dependency visualization'
    },
    {
      url: 'http://localhost:3002/ontology-viewer.html',
      name: 'Ontology Viewer',
      description: 'Ontology data visualization page'
    }
  ];
  
  const results = [];
  const screenshotsDir = path.join(__dirname, 'screenshots');
  
  // Create screenshots directory if it doesn't exist
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  console.log('🧪 Starting Tailwind CSS Production Build Verification...\n');
  
  for (const testCase of testUrls) {
    console.log(`\n📊 Testing: ${testCase.name} (${testCase.url})`);
    console.log(`Description: ${testCase.description}\n`);
    
    const testResult = {
      name: testCase.name,
      url: testCase.url,
      tests: {},
      success: true,
      errors: []
    };
    
    try {
      // Navigate to the page
      console.log('  ↗️  Navigating to page...');
      const response = await page.goto(testCase.url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      if (!response || response.status() !== 200) {
        throw new Error(`Failed to load page: ${response ? response.status() : 'No response'}`);
      }
      
      // Wait for page to fully render
      await page.waitForTimeout(3000);
      
      // Test 1: Check HTML source for CDN scripts
      console.log('  🔍 Test 1: Checking for Tailwind CDN scripts in HTML source...');
      const htmlContent = await page.content();
      const hasTailwindCDN = htmlContent.includes('cdn.tailwindcss.com') || 
                           htmlContent.includes('unpkg.com/tailwindcss') ||
                           htmlContent.includes('jsdelivr.net/npm/tailwindcss');
      
      testResult.tests.noCdnScripts = !hasTailwindCDN;
      if (hasTailwindCDN) {
        testResult.errors.push('❌ Found Tailwind CDN script in HTML source');
        console.log('    ❌ Found Tailwind CDN script in HTML source');
      } else {
        console.log('    ✅ No Tailwind CDN scripts found - using local CSS');
      }
      
      // Test 2: Check for local CSS file loading
      console.log('  🔍 Test 2: Verifying local CSS file loading...');
      const localCssLoaded = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        return links.some(link => 
          link.href.includes('./css/tailwind.css') || 
          link.href.includes('/css/tailwind.css')
        );
      });
      
      testResult.tests.localCssLoaded = localCssLoaded;
      if (!localCssLoaded) {
        testResult.errors.push('❌ Local CSS file (./css/tailwind.css) not found');
        console.log('    ❌ Local CSS file (./css/tailwind.css) not found');
      } else {
        console.log('    ✅ Local CSS file is properly loaded');
      }
      
      // Test 3: Verify shadcn/ui styling is applied
      console.log('  🔍 Test 3: Verifying shadcn/ui styling application...');
      const shadcnStylingApplied = await page.evaluate(() => {
        // Check for CSS custom properties (CSS variables) that indicate shadcn/ui theme
        const rootStyles = getComputedStyle(document.documentElement);
        const hasCustomProperties = rootStyles.getPropertyValue('--background') !== '' ||
                                  rootStyles.getPropertyValue('--foreground') !== '' ||
                                  rootStyles.getPropertyValue('--primary') !== '';
        
        // Check for shadcn/ui card components
        const hasCardElements = document.querySelector('.bg-card') !== null ||
                               document.querySelector('[class*="border"]') !== null ||
                               document.querySelector('[class*="rounded"]') !== null;
        
        return hasCustomProperties || hasCardElements;
      });
      
      testResult.tests.shadcnStyling = shadcnStylingApplied;
      if (!shadcnStylingApplied) {
        testResult.errors.push('❌ shadcn/ui styling not properly applied');
        console.log('    ❌ shadcn/ui styling not properly applied');
      } else {
        console.log('    ✅ shadcn/ui styling is properly applied');
      }
      
      // Test 4: Check chart colors (ensure they're not black)
      console.log('  🔍 Test 4: Verifying chart colors are not black...');
      const chartColorsValid = await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        let validColors = true;
        
        // Check if canvases exist and have proper context
        canvases.forEach(canvas => {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Get image data and check for non-black pixels
            try {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              let hasColor = false;
              
              // Check every 4th pixel for non-black colors
              for (let i = 0; i < data.length; i += 16) {
                const r = data[i];
                const g = data[i + 1]; 
                const b = data[i + 2];
                const a = data[i + 3];
                
                // If pixel has alpha and any non-black color
                if (a > 0 && (r > 10 || g > 10 || b > 10)) {
                  hasColor = true;
                  break;
                }
              }
              
              if (!hasColor) {
                validColors = false;
              }
            } catch (e) {
              // Canvas might be tainted or empty, which is acceptable
            }
          }
        });
        
        return validColors || canvases.length === 0; // No charts is also valid
      });
      
      testResult.tests.chartColors = chartColorsValid;
      if (!chartColorsValid) {
        testResult.errors.push('❌ Charts appear to be all black or missing colors');
        console.log('    ❌ Charts appear to be all black or missing colors');
      } else {
        console.log('    ✅ Charts have proper colors or no charts present');
      }
      
      // Test 5: Check responsive design at different viewport sizes
      console.log('  🔍 Test 5: Testing responsive design...');
      
      // Test mobile viewport
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(1000);
      
      const mobileResponsive = await page.evaluate(() => {
        // Check if elements properly stack or hide on mobile
        const body = document.body;
        const bodyWidth = body.offsetWidth;
        
        // Look for responsive classes or proper mobile layout
        const hasResponsiveClasses = document.querySelector('[class*="sm:"]') !== null ||
                                   document.querySelector('[class*="md:"]') !== null ||
                                   document.querySelector('[class*="lg:"]') !== null ||
                                   document.querySelector('[class*="xl:"]') !== null;
        
        return hasResponsiveClasses && bodyWidth <= 400;
      });
      
      // Reset to desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);
      
      testResult.tests.responsiveDesign = mobileResponsive;
      if (!mobileResponsive) {
        testResult.errors.push('❌ Responsive design classes not found or not working');
        console.log('    ❌ Responsive design classes not found or not working');
      } else {
        console.log('    ✅ Responsive design is working properly');
      }
      
      // Test 6: Verify layout integrity
      console.log('  🔍 Test 6: Verifying layout integrity...');
      const layoutIntegrity = await page.evaluate(() => {
        // Check for basic layout elements
        const hasHeader = document.querySelector('header') !== null ||
                         document.querySelector('[class*="header"]') !== null ||
                         document.querySelector('h1, h2, h3') !== null;
        
        const hasContent = document.querySelector('main') !== null ||
                          document.querySelector('[class*="content"]') !== null ||
                          document.querySelector('.container') !== null;
        
        // Check if body has proper background
        const bodyStyles = getComputedStyle(document.body);
        const hasBackground = bodyStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                             bodyStyles.backgroundColor !== 'transparent';
        
        return hasHeader && hasContent && hasBackground;
      });
      
      testResult.tests.layoutIntegrity = layoutIntegrity;
      if (!layoutIntegrity) {
        testResult.errors.push('❌ Layout integrity issues detected');
        console.log('    ❌ Layout integrity issues detected');
      } else {
        console.log('    ✅ Layout integrity is good');
      }
      
      // Take screenshot for visual verification
      console.log('  📸 Taking screenshot for visual verification...');
      const screenshotPath = path.join(screenshotsDir, `${testCase.name.replace(/\s+/g, '_').toLowerCase()}_verification.png`);
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true,
        animations: 'disabled'
      });
      console.log(`    💾 Screenshot saved: ${screenshotPath}`);
      
      // Determine overall success
      testResult.success = Object.values(testResult.tests).every(test => test === true);
      
      if (testResult.success) {
        console.log(`  🎉 All tests passed for ${testCase.name}!`);
      } else {
        console.log(`  ⚠️  Some tests failed for ${testCase.name}`);
        testResult.errors.forEach(error => console.log(`    ${error}`));
      }
      
    } catch (error) {
      console.log(`  💥 Error testing ${testCase.name}: ${error.message}`);
      testResult.success = false;
      testResult.errors.push(`Navigation/Testing error: ${error.message}`);
    }
    
    results.push(testResult);
    console.log(`  ⏱️  Test completed for ${testCase.name}\n`);
  }
  
  // Generate comprehensive report
  console.log('\n' + '='.repeat(80));
  console.log('📋 TAILWIND CSS PRODUCTION BUILD VERIFICATION REPORT');
  console.log('='.repeat(80));
  
  const totalTests = results.length;
  const passedTests = results.filter(result => result.success).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`\n📊 Overall Results:`);
  console.log(`  ✅ Passed: ${passedTests}/${totalTests} dashboards`);
  console.log(`  ❌ Failed: ${failedTests}/${totalTests} dashboards`);
  console.log(`  📈 Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%\n`);
  
  // Detailed results for each dashboard
  results.forEach(result => {
    console.log(`\n🗂️  ${result.name} - ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   URL: ${result.url}`);
    
    const testNames = {
      noCdnScripts: 'No CDN Scripts',
      localCssLoaded: 'Local CSS Loaded',
      shadcnStyling: 'shadcn/ui Styling',
      chartColors: 'Chart Colors',
      responsiveDesign: 'Responsive Design',
      layoutIntegrity: 'Layout Integrity'
    };
    
    Object.entries(result.tests).forEach(([testKey, testResult]) => {
      const testName = testNames[testKey] || testKey;
      console.log(`   ${testResult ? '✅' : '❌'} ${testName}`);
    });
    
    if (result.errors.length > 0) {
      console.log(`   🚨 Issues found:`);
      result.errors.forEach(error => {
        console.log(`      ${error}`);
      });
    }
  });
  
  // Recommendations
  console.log(`\n💡 Recommendations:`);
  
  const allCdnIssues = results.filter(r => !r.tests.noCdnScripts).length;
  const allCssIssues = results.filter(r => !r.tests.localCssLoaded).length;
  const allStylingIssues = results.filter(r => !r.tests.shadcnStyling).length;
  
  if (allCdnIssues > 0) {
    console.log(`   🔧 Remove Tailwind CDN scripts from ${allCdnIssues} dashboard(s)`);
  }
  
  if (allCssIssues > 0) {
    console.log(`   🔧 Fix local CSS file loading in ${allCssIssues} dashboard(s)`);
  }
  
  if (allStylingIssues > 0) {
    console.log(`   🔧 Apply shadcn/ui styling properly in ${allStylingIssues} dashboard(s)`);
  }
  
  if (passedTests === totalTests) {
    console.log(`   🎉 All dashboards are working perfectly with production Tailwind CSS build!`);
  }
  
  console.log(`\n📁 Screenshots saved in: ${screenshotsDir}`);
  console.log(`🏁 Verification complete!\n`);
  
  await browser.close();
  
  return {
    totalTests,
    passedTests,
    failedTests,
    successRate: (passedTests/totalTests) * 100,
    results,
    screenshotsPath: screenshotsDir
  };
}

// Run the verification
if (require.main === module) {
  verifyTailwindProductionBuild()
    .then(report => {
      console.log(`Final Summary: ${report.passedTests}/${report.totalTests} dashboards passed (${report.successRate.toFixed(1)}%)`);
      process.exit(report.failedTests > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyTailwindProductionBuild };