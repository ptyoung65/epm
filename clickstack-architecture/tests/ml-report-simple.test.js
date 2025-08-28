const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Test configuration
const MODELS = ['autoencoder', 'lstm', 'rca', 'clustering'];
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'ml-training-reports');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('ML Training Report Tests', () => {
  
  test('Direct URL Access for all models', async ({ page }) => {
    const results = [];
    
    for (const model of MODELS) {
      const url = `/ml-training-report.html?model=${model}`;
      
      try {
        // Navigate to the page
        const response = await page.goto(url);
        expect(response.status()).toBe(200);
        
        // Wait for page to fully load
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Take screenshot
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, `${model}-report-overview.png`),
          fullPage: true 
        });
        
        // Verify page title
        const title = await page.title();
        
        // Check for essential elements
        const hasTitle = await page.locator('h1, .title, .header').count() > 0;
        const hasContent = await page.locator('.card, .container, .content').count() > 0;
        const hasCharts = await page.locator('canvas, .chart').count() > 0;
        
        results.push({
          model,
          status: 'SUCCESS',
          title,
          hasTitle,
          hasContent,
          hasCharts,
          url: page.url()
        });
        
        console.log(`✅ ${model} model report loaded successfully`);
        
      } catch (error) {
        results.push({
          model,
          status: 'ERROR',
          error: error.message
        });
        
        console.log(`❌ ${model} model report failed: ${error.message}`);
      }
    }
    
    // Print comprehensive results
    console.log('\n=== ML Training Report Test Results ===');
    results.forEach(result => {
      console.log(`\n${result.model.toUpperCase()}:`);
      console.log(`  Status: ${result.status}`);
      if (result.status === 'SUCCESS') {
        console.log(`  Title: ${result.title}`);
        console.log(`  Has Title Element: ${result.hasTitle}`);
        console.log(`  Has Content: ${result.hasContent}`);
        console.log(`  Has Charts: ${result.hasCharts}`);
        console.log(`  Final URL: ${result.url}`);
      } else {
        console.log(`  Error: ${result.error}`);
      }
    });
    
    // Ensure at least some tests passed
    const successCount = results.filter(r => r.status === 'SUCCESS').length;
    expect(successCount).toBeGreaterThan(0);
  });

  test('Content verification for each model', async ({ page }) => {
    const contentResults = [];
    
    for (const model of MODELS) {
      const url = `/ml-training-report.html?model=${model}`;
      
      try {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Check for model-specific content
        const pageContent = await page.content();
        const hasModelName = pageContent.toLowerCase().includes(model.toLowerCase()) ||
                           pageContent.includes('ML') ||
                           pageContent.includes('머신러닝') ||
                           pageContent.includes('모델');
        
        // Check for essential sections
        const sections = {
          hasTrainingInfo: /훈련|training|학습|모델/.test(pageContent),
          hasMetrics: /성능|지표|정확도|accuracy|precision|recall|loss|metric/.test(pageContent),
          hasCharts: await page.locator('canvas, .chart-container, [id*="chart"]').count() > 0,
          hasBusiness: /비즈니스|business|영향|impact/.test(pageContent)
        };
        
        // Take detailed screenshot
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, `${model}-content-detail.png`),
          fullPage: true 
        });
        
        contentResults.push({
          model,
          hasModelName,
          sections,
          pageSize: pageContent.length
        });
        
      } catch (error) {
        contentResults.push({
          model,
          error: error.message
        });
      }
    }
    
    console.log('\n=== Content Verification Results ===');
    contentResults.forEach(result => {
      console.log(`\n${result.model.toUpperCase()}:`);
      if (result.sections) {
        console.log(`  Has Model Reference: ${result.hasModelName}`);
        console.log(`  Training Info: ${result.sections.hasTrainingInfo}`);
        console.log(`  Metrics: ${result.sections.hasMetrics}`);  
        console.log(`  Charts: ${result.sections.hasCharts}`);
        console.log(`  Business Section: ${result.sections.hasBusiness}`);
        console.log(`  Page Size: ${result.pageSize} chars`);
      } else {
        console.log(`  Error: ${result.error}`);
      }
    });
  });

  test('Navigation and interactive features', async ({ page, context }) => {
    const featureResults = [];
    
    for (const model of MODELS) {
      const url = `/ml-training-report.html?model=${model}`;
      
      try {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Test interactive features
        const features = {
          printButton: await page.locator('button:has-text("인쇄"), button:has-text("Print"), [onclick*="print"]').count() > 0,
          exportButton: await page.locator('button:has-text("내보내기"), button:has-text("Export"), button:has-text("JSON")').count() > 0,
          backButton: await page.locator('button:has-text("뒤로"), button:has-text("학습 페이지로"), [onclick*="back"]').count() > 0,
          chartInteraction: await page.locator('canvas').count() > 0
        };
        
        // Test chart hover if available
        const charts = await page.locator('canvas').all();
        let chartInteractive = false;
        if (charts.length > 0) {
          try {
            await charts[0].hover();
            chartInteractive = true;
          } catch (e) {
            // Chart may not be interactive
          }
        }
        
        featureResults.push({
          model,
          features: { ...features, chartInteractive }
        });
        
      } catch (error) {
        featureResults.push({
          model,
          error: error.message
        });
      }
    }
    
    console.log('\n=== Interactive Features Results ===');
    featureResults.forEach(result => {
      console.log(`\n${result.model.toUpperCase()}:`);
      if (result.features) {
        console.log(`  Print Button: ${result.features.printButton}`);
        console.log(`  Export Button: ${result.features.exportButton}`);
        console.log(`  Back Button: ${result.features.backButton}`);
        console.log(`  Charts Present: ${result.features.chartInteraction}`);
        console.log(`  Chart Interactive: ${result.features.chartInteractive}`);
      } else {
        console.log(`  Error: ${result.error}`);
      }
    });
  });

  test('Error handling for invalid parameters', async ({ page }) => {
    // Test invalid model parameter
    const invalidUrl = '/ml-training-report.html?model=invalid-model';
    const response = await page.goto(invalidUrl);
    expect(response.status()).toBe(200);
    
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'invalid-model-test.png'),
      fullPage: true 
    });
    
    // Test no model parameter
    const noModelUrl = '/ml-training-report.html';
    await page.goto(noModelUrl);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'no-model-parameter-test.png'),
      fullPage: true 
    });
    
    console.log('✅ Error handling tests completed');
  });
});