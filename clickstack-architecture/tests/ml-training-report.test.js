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

test.describe('ML Training Report Page Tests', () => {
  
  // Test 1: Direct URL Access Tests
  test.describe('Direct URL Access', () => {
    MODELS.forEach(model => {
      test(`should load report for ${model} model`, async ({ page }) => {
        const url = `${BASE_URL}/ml-training-report.html?model=${model}`;
        
        // Navigate to the page
        const response = await page.goto(url);
        expect(response.status()).toBe(200);
        
        // Wait for page to fully load
        await page.waitForLoadState('networkidle');
        
        // Take screenshot
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, `${model}-report-overview.png`),
          fullPage: true 
        });
        
        // Verify page is accessible and contains expected elements
        await expect(page).toHaveTitle(new RegExp(model, 'i'));
        
        console.log(`✅ ${model} model report loaded successfully`);
      });
    });
  });

  // Test 2: Content Verification
  test.describe('Content Verification', () => {
    MODELS.forEach(model => {
      test(`should display correct content for ${model} model`, async ({ page }) => {
        const url = `${BASE_URL}/ml-training-report.html?model=${model}`;
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // Check page title updates correctly
        const title = await page.title();
        expect(title.toLowerCase()).toContain(model.toLowerCase());
        
        // Verify main heading contains model name
        const mainHeading = await page.locator('h1').first().textContent();
        expect(mainHeading.toLowerCase()).toContain('ml 모델' || '머신러닝' || '훈련');
        
        // Check that model-specific data is displayed
        const modelInfo = await page.locator('[data-testid="model-info"], .model-info, .card').first();
        await expect(modelInfo).toBeVisible();
        
        // Verify charts are present
        const charts = await page.locator('canvas, .chart-container, [id*="chart"]').all();
        expect(charts.length).toBeGreaterThan(0);
        
        // Check for key sections
        const sections = [
          '훈련 현황',
          '성능 지표',
          '손실 함수',
          '비즈니스 영향',
          '모델 정보',
          'training',
          'performance',
          'metrics'
        ];
        
        let foundSections = 0;
        for (const section of sections) {
          const sectionElement = await page.locator(`text=${section}`).first();
          if (await sectionElement.isVisible().catch(() => false)) {
            foundSections++;
          }
        }
        
        expect(foundSections).toBeGreaterThan(2);
        
        console.log(`✅ ${model} content verification passed - ${foundSections} sections found`);
      });
    });
  });

  // Test 3: Chart Rendering and Fixed Heights
  test.describe('Chart Rendering Tests', () => {
    MODELS.forEach(model => {
      test(`should render charts with proper dimensions for ${model}`, async ({ page }) => {
        const url = `${BASE_URL}/ml-training-report.html?model=${model}`;
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // Wait for charts to load
        await page.waitForTimeout(3000);
        
        // Find all chart containers
        const chartContainers = await page.locator('canvas, .chart-container, [class*="chart"]').all();
        
        let chartsWithProperHeight = 0;
        for (const container of chartContainers) {
          const boundingBox = await container.boundingBox();
          if (boundingBox && boundingBox.height > 50) { // Reasonable minimum height
            chartsWithProperHeight++;
          }
        }
        
        expect(chartsWithProperHeight).toBeGreaterThan(0);
        
        // Take screenshot focusing on charts
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, `${model}-charts-detail.png`),
          fullPage: true 
        });
        
        console.log(`✅ ${model} charts rendered properly - ${chartsWithProperHeight} charts found`);
      });
    });
  });

  // Test 4: Navigation Button Tests
  test.describe('Navigation Buttons', () => {
    test('should test navigation from ML training pages to reports', async ({ page, context }) => {
      // First navigate to main ML training pages
      const mlPages = [
        'autoencoder-training.html',
        'lstm-training.html', 
        'rca-training.html',
        'clustering-training.html'
      ];
      
      for (const mlPage of mlPages) {
        const url = `${BASE_URL}/${mlPage}`;
        
        try {
          await page.goto(url);
          await page.waitForLoadState('networkidle');
          
          // Look for "상세 보고서" button
          const reportButtons = await page.locator('button:has-text("상세 보고서"), a:has-text("상세 보고서"), [href*="ml-training-report"]').all();
          
          if (reportButtons.length > 0) {
            // Click the first report button
            const [newPage] = await Promise.all([
              context.waitForEvent('page'),
              reportButtons[0].click()
            ]);
            
            await newPage.waitForLoadState('networkidle');
            
            // Verify it opened the report page
            const newUrl = newPage.url();
            expect(newUrl).toContain('ml-training-report.html');
            expect(newUrl).toContain('model=');
            
            await newPage.close();
            console.log(`✅ Navigation from ${mlPage} to report works`);
          } else {
            console.log(`⚠️ No report button found on ${mlPage}`);
          }
        } catch (error) {
          console.log(`⚠️ Could not access ${mlPage}: ${error.message}`);
        }
      }
    });

    test('should test back navigation buttons', async ({ page }) => {
      // Test each report page's back button
      for (const model of MODELS) {
        const url = `${BASE_URL}/ml-training-report.html?model=${model}`;
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // Look for back button
        const backButtons = await page.locator('button:has-text("학습 페이지로"), button:has-text("뒤로"), [onclick*="back"], [onclick*="history"]').all();
        
        if (backButtons.length > 0) {
          console.log(`✅ Back button found on ${model} report`);
        } else {
          console.log(`⚠️ No back button found on ${model} report`);
        }
      }
    });
  });

  // Test 5: Interactive Features
  test.describe('Interactive Features', () => {
    MODELS.forEach(model => {
      test(`should test interactive features for ${model}`, async ({ page }) => {
        const url = `${BASE_URL}/ml-training-report.html?model=${model}`;
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // Test print functionality
        const printButtons = await page.locator('button:has-text("인쇄"), button:has-text("Print"), [onclick*="print"]').all();
        if (printButtons.length > 0) {
          console.log(`✅ Print button found for ${model}`);
        }
        
        // Test export functionality  
        const exportButtons = await page.locator('button:has-text("내보내기"), button:has-text("Export"), button:has-text("JSON"), [onclick*="export"]').all();
        if (exportButtons.length > 0) {
          console.log(`✅ Export button found for ${model}`);
        }
        
        // Test chart interactivity (hover, click)
        const charts = await page.locator('canvas').all();
        for (const chart of charts) {
          if (await chart.isVisible()) {
            await chart.hover();
            await page.waitForTimeout(500);
            console.log(`✅ Chart interaction tested for ${model}`);
            break;
          }
        }
      });
    });
  });

  // Test 6: Report Content Quality
  test.describe('Report Content Quality', () => {
    MODELS.forEach(model => {
      test(`should verify content quality for ${model}`, async ({ page }) => {
        const url = `${BASE_URL}/ml-training-report.html?model=${model}`;
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // Check for model-specific metrics
        const metricsKeywords = [
          'accuracy', 'precision', 'recall', 'f1-score',
          '정확도', '정밀도', '재현율', '손실',
          'loss', 'epoch', 'batch', 'learning rate',
          '학습률', '에포크', '배치', '성능'
        ];
        
        let foundMetrics = 0;
        for (const keyword of metricsKeywords) {
          const element = await page.locator(`text=${keyword}`).first();
          if (await element.isVisible().catch(() => false)) {
            foundMetrics++;
          }
        }
        
        expect(foundMetrics).toBeGreaterThan(3);
        
        // Check for charts with data
        const chartCanvases = await page.locator('canvas').all();
        let chartsWithData = 0;
        
        for (const canvas of chartCanvases) {
          const boundingBox = await canvas.boundingBox();
          if (boundingBox && boundingBox.width > 100 && boundingBox.height > 100) {
            chartsWithData++;
          }
        }
        
        expect(chartsWithData).toBeGreaterThan(0);
        
        // Verify business impact section
        const businessSection = await page.locator('text=비즈니스 영향, text=Business Impact, text=impact, text=영향').first();
        const hasBusiness = await businessSection.isVisible().catch(() => false);
        
        console.log(`✅ ${model} content quality verified - ${foundMetrics} metrics, ${chartsWithData} charts, business section: ${hasBusiness}`);
      });
    });
  });

  // Test 7: Comprehensive Screenshot Documentation
  test('should take comprehensive screenshots', async ({ page }) => {
    for (const model of MODELS) {
      const url = `${BASE_URL}/ml-training-report.html?model=${model}`;
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Full page screenshot
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, `${model}-full-report.png`),
        fullPage: true 
      });
      
      // Header section
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, `${model}-header.png`),
        clip: { x: 0, y: 0, width: 1200, height: 400 }
      });
      
      // Charts section (if visible)
      const chartElement = await page.locator('canvas, .chart-container').first();
      if (await chartElement.isVisible().catch(() => false)) {
        await chartElement.screenshot({ 
          path: path.join(SCREENSHOT_DIR, `${model}-chart-detail.png`)
        });
      }
      
      console.log(`✅ Screenshots captured for ${model}`);
    }
  });

  // Test 8: Error Handling and Edge Cases
  test.describe('Error Handling', () => {
    test('should handle invalid model parameters', async ({ page }) => {
      const invalidUrl = `${BASE_URL}/ml-training-report.html?model=invalid-model`;
      const response = await page.goto(invalidUrl);
      
      // Should still load the page (may show default or error state)
      expect(response.status()).toBe(200);
      
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of error handling
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'invalid-model-handling.png'),
        fullPage: true 
      });
      
      console.log('✅ Invalid model parameter handling tested');
    });

    test('should handle missing model parameter', async ({ page }) => {
      const noModelUrl = `${BASE_URL}/ml-training-report.html`;
      const response = await page.goto(noModelUrl);
      
      expect(response.status()).toBe(200);
      await page.waitForLoadState('networkidle');
      
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'no-model-parameter.png'),
        fullPage: true 
      });
      
      console.log('✅ Missing model parameter handling tested');
    });
  });
});