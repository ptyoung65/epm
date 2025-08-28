const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Test configuration
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'ml-navigation');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('ML Training Navigation Tests', () => {
  
  test('Navigation from training pages to reports', async ({ page, context }) => {
    const mlTrainingPages = [
      'autoencoder-training.html',
      'lstm-training.html', 
      'rca-training.html',
      'clustering-training.html'
    ];
    
    const navigationResults = [];
    
    for (const trainingPage of mlTrainingPages) {
      try {
        // Navigate to training page
        const response = await page.goto(`/${trainingPage}`);
        
        if (response.status() === 200) {
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          
          // Take screenshot of training page
          await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, `${trainingPage}-training-page.png`),
            fullPage: true 
          });
          
          // Look for report navigation buttons
          const reportButtons = [
            'button:has-text("상세 보고서")',
            'a:has-text("상세 보고서")', 
            'button:has-text("보고서")',
            'a:has-text("보고서")',
            '[href*="ml-training-report"]',
            'button[onclick*="report"]',
            '.report-button'
          ];
          
          let reportButtonFound = false;
          let navigationWorked = false;
          
          for (const buttonSelector of reportButtons) {
            const buttons = await page.locator(buttonSelector).all();
            
            if (buttons.length > 0) {
              reportButtonFound = true;
              
              try {
                // Try to click the report button  
                const [newPage] = await Promise.all([
                  context.waitForEvent('page'),
                  buttons[0].click()
                ]);
                
                await newPage.waitForLoadState('networkidle');
                const newUrl = newPage.url();
                
                if (newUrl.includes('ml-training-report.html')) {
                  navigationWorked = true;
                  
                  // Take screenshot of opened report
                  await newPage.screenshot({ 
                    path: path.join(SCREENSHOT_DIR, `${trainingPage}-opened-report.png`),
                    fullPage: true 
                  });
                }
                
                await newPage.close();
                break;
                
              } catch (clickError) {
                console.log(`Could not click report button on ${trainingPage}: ${clickError.message}`);
              }
            }
          }
          
          navigationResults.push({
            page: trainingPage,
            status: 'SUCCESS',
            reportButtonFound,
            navigationWorked,
            url: page.url()
          });
          
        } else {
          navigationResults.push({
            page: trainingPage,
            status: 'NOT_FOUND',
            httpStatus: response.status()
          });
        }
        
      } catch (error) {
        navigationResults.push({
          page: trainingPage,
          status: 'ERROR',
          error: error.message
        });
      }
    }
    
    // Print results
    console.log('\n=== ML Training Navigation Results ===');
    navigationResults.forEach(result => {
      console.log(`\n${result.page}:`);
      console.log(`  Status: ${result.status}`);
      
      if (result.status === 'SUCCESS') {
        console.log(`  Report Button Found: ${result.reportButtonFound}`);
        console.log(`  Navigation Worked: ${result.navigationWorked}`);
        console.log(`  Page URL: ${result.url}`);
      } else if (result.status === 'NOT_FOUND') {
        console.log(`  HTTP Status: ${result.httpStatus}`);
      } else {
        console.log(`  Error: ${result.error}`);
      }
    });
    
    // Check that at least some pages have working navigation
    const workingNavigation = navigationResults.filter(r => r.navigationWorked).length;
    console.log(`\nSummary: ${workingNavigation} pages with working report navigation`);
  });

  test('Test back navigation from reports', async ({ page }) => {
    const models = ['autoencoder', 'lstm', 'rca', 'clustering'];
    const backResults = [];
    
    for (const model of models) {
      const url = `/ml-training-report.html?model=${model}`;
      
      try {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Look for back navigation buttons
        const backButtons = [
          'button:has-text("학습 페이지로")',
          'button:has-text("뒤로")',
          'button:has-text("Back")', 
          '[onclick*="back"]',
          '[onclick*="history.back"]',
          '.back-button'
        ];
        
        let backButtonFound = false;
        
        for (const buttonSelector of backButtons) {
          const buttons = await page.locator(buttonSelector).count();
          if (buttons > 0) {
            backButtonFound = true;
            break;
          }
        }
        
        backResults.push({
          model,
          backButtonFound
        });
        
      } catch (error) {
        backResults.push({
          model,
          error: error.message
        });
      }
    }
    
    console.log('\n=== Back Navigation Results ===');
    backResults.forEach(result => {
      console.log(`${result.model.toUpperCase()}: Back Button Found = ${result.backButtonFound || 'ERROR'}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });
  });

  test('Test report URL parameters and functionality', async ({ page }) => {
    const paramTests = [
      { model: 'autoencoder', expected: 'Autoencoder' },
      { model: 'lstm', expected: 'LSTM' },
      { model: 'rca', expected: 'RCA' }, 
      { model: 'clustering', expected: 'Clustering' },
      { model: 'invalid', expected: 'default' },
      { model: '', expected: 'default' }
    ];
    
    console.log('\n=== URL Parameter Tests ===');
    
    for (const test of paramTests) {
      try {
        const url = test.model ? 
          `/ml-training-report.html?model=${test.model}` : 
          '/ml-training-report.html';
          
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Check page content
        const content = await page.content();
        const title = await page.title();
        
        // Take screenshot
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, `param-test-${test.model || 'empty'}.png`),
          fullPage: true 
        });
        
        console.log(`Model: ${test.model || 'empty'}`);
        console.log(`  Title: ${title}`);
        console.log(`  Content Length: ${content.length} chars`);
        console.log(`  Page Loaded: ${content.length > 1000 ? 'YES' : 'NO'}`);
        
      } catch (error) {
        console.log(`Model: ${test.model || 'empty'} - ERROR: ${error.message}`);
      }
    }
  });
  
});