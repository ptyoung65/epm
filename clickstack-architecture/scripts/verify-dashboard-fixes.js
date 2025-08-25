#!/usr/bin/env node
/**
 * Playwright verification script for dashboard CDN and color fixes
 * Checks for:
 * - CDN warnings
 * - Color definition errors
 * - Chart display issues
 * - Takes screenshots for documentation
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Dashboard URLs to test
const dashboards = [
  {
    name: 'WAS Dashboard',
    url: 'http://localhost:3002/was-dashboard.html'
  },
  {
    name: 'Exception Dashboard', 
    url: 'http://localhost:3002/exception-dashboard.html'
  },
  {
    name: 'Alert Dashboard',
    url: 'http://localhost:3002/alert-dashboard.html'
  },
  {
    name: 'J2EE Dashboard',
    url: 'http://localhost:3002/j2ee-dashboard.html'
  },
  {
    name: 'Main Dashboard',
    url: 'http://localhost:3002/'
  },
  {
    name: 'Topology Dashboard',
    url: 'http://localhost:3002/topology-dashboard.html'
  }
];

async function verifyDashboard(browser, dashboard) {
  console.log(`\n🔍 Verifying ${dashboard.name}...`);
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console messages
  const consoleMessages = [];
  const errors = [];
  
  page.on('console', (msg) => {
    const text = msg.text();
    consoleMessages.push({
      type: msg.type(),
      text: text
    });
    
    // Check for specific issues
    if (text.includes('cdn.tailwindcss.com should not be used in production')) {
      errors.push({
        type: 'CDN_WARNING',
        message: text
      });
    }
    
    if (text.includes('colors is not defined')) {
      errors.push({
        type: 'COLOR_ERROR', 
        message: text
      });
    }
  });
  
  page.on('pageerror', (error) => {
    errors.push({
      type: 'PAGE_ERROR',
      message: error.message,
      stack: error.stack
    });
  });
  
  try {
    // Navigate to dashboard
    await page.goto(dashboard.url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for charts to load
    await page.waitForTimeout(5000);
    
    // Check if charts are visible and have proper colors
    const chartElements = await page.$$('[id*="Chart"], canvas, .chart-container');
    const chartInfo = [];
    
    for (const chart of chartElements) {
      const boundingBox = await chart.boundingBox();
      if (boundingBox) {
        chartInfo.push({
          visible: true,
          width: boundingBox.width,
          height: boundingBox.height
        });
      }
    }
    
    // Take screenshot
    const screenshotDir = '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    const screenshotPath = path.join(screenshotDir, `${dashboard.name.toLowerCase().replace(/\s+/g, '-')}-verification.png`);
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    
    // Check for shadcn/ui elements
    const shadcnElements = await page.$$('[class*="bg-card"], [class*="text-card-foreground"], .border, .rounded-lg');
    
    await context.close();
    
    return {
      dashboard: dashboard.name,
      url: dashboard.url,
      success: true,
      errors: errors,
      consoleMessages: consoleMessages,
      chartCount: chartElements.length,
      chartInfo: chartInfo,
      shadcnElements: shadcnElements.length,
      screenshotPath: screenshotPath
    };
    
  } catch (error) {
    await context.close();
    return {
      dashboard: dashboard.name,
      url: dashboard.url,
      success: false,
      error: error.message,
      errors: errors,
      consoleMessages: consoleMessages
    };
  }
}

async function main() {
  console.log('🚀 Starting Dashboard Verification...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = [];
  
  for (const dashboard of dashboards) {
    const result = await verifyDashboard(browser, dashboard);
    results.push(result);
  }
  
  await browser.close();
  
  // Generate report
  console.log('\n📊 VERIFICATION REPORT');
  console.log('='.repeat(50));
  
  let totalIssues = 0;
  
  for (const result of results) {
    console.log(`\n📋 ${result.dashboard}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`   Issues Found: ${result.errors.length}`);
      totalIssues += result.errors.length;
      
      result.errors.forEach(error => {
        console.log(`   🚨 ${error.type}: ${error.message}`);
      });
    } else {
      console.log(`   Issues Found: 0 ✅`);
    }
    
    if (result.chartCount !== undefined) {
      console.log(`   Charts Found: ${result.chartCount}`);
    }
    
    if (result.shadcnElements !== undefined) {
      console.log(`   shadcn/ui Elements: ${result.shadcnElements}`);
    }
    
    if (result.screenshotPath) {
      console.log(`   Screenshot: ${result.screenshotPath}`);
    }
  }
  
  console.log('\n📈 SUMMARY');
  console.log('='.repeat(30));
  console.log(`Total Dashboards: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log(`Total Issues: ${totalIssues}`);
  
  // Specific issue breakdown
  const cdnWarnings = results.reduce((sum, r) => sum + (r.errors?.filter(e => e.type === 'CDN_WARNING').length || 0), 0);
  const colorErrors = results.reduce((sum, r) => sum + (r.errors?.filter(e => e.type === 'COLOR_ERROR').length || 0), 0);
  const pageErrors = results.reduce((sum, r) => sum + (r.errors?.filter(e => e.type === 'PAGE_ERROR').length || 0), 0);
  
  console.log(`CDN Warnings: ${cdnWarnings}`);
  console.log(`Color Errors: ${colorErrors}`);
  console.log(`Page Errors: ${pageErrors}`);
  
  if (totalIssues === 0) {
    console.log('\n🎉 ALL ISSUES RESOLVED! All dashboards are working correctly.');
  } else {
    console.log(`\n⚠️  ${totalIssues} issues still need to be addressed.`);
  }
  
  // Save detailed report
  const reportPath = '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/verification-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

// Run the verification
main().catch(console.error);