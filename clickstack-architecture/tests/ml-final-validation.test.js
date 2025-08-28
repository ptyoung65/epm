const { test, expect } = require('@playwright/test');

test.describe('Final ML Training Report Validation', () => {
  
  test('Comprehensive validation of all ML models', async ({ page }) => {
    const models = ['autoencoder', 'lstm', 'rca', 'clustering'];
    const finalResults = {
      summary: {
        totalTested: 0,
        successful: 0,
        hasCharts: 0,
        hasInteractivity: 0,
        hasExport: 0,
        hasPrint: 0
      },
      details: []
    };
    
    for (const model of models) {
      finalResults.summary.totalTested++;
      
      const url = `/ml-training-report.html?model=${model}`;
      const modelResult = { model, url };
      
      try {
        // Load page
        const response = await page.goto(url);
        modelResult.httpStatus = response.status();
        
        if (response.status() === 200) {
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(3000);
          
          // Basic page checks
          modelResult.title = await page.title();
          modelResult.loaded = true;
          finalResults.summary.successful++;
          
          // Chart validation
          const charts = await page.locator('canvas').count();
          modelResult.chartCount = charts;
          if (charts > 0) finalResults.summary.hasCharts++;
          
          // Interactive features
          const printBtn = await page.locator('button:has-text("인쇄"), button:has-text("Print")').count();
          const exportBtn = await page.locator('button:has-text("JSON"), button:has-text("Export")').count();
          const backBtn = await page.locator('button:has-text("뒤로"), button:has-text("학습")').count();
          
          modelResult.buttons = {
            print: printBtn > 0,
            export: exportBtn > 0, 
            back: backBtn > 0
          };
          
          if (printBtn > 0) finalResults.summary.hasPrint++;
          if (exportBtn > 0) finalResults.summary.hasExport++;
          if (charts > 0) finalResults.summary.hasInteractivity++;
          
          // Content validation
          const content = await page.content();
          modelResult.contentChecks = {
            hasModelReference: content.toLowerCase().includes(model.toLowerCase()) || content.includes('모델'),
            hasMetrics: /정확도|accuracy|precision|loss|성능/.test(content),
            hasTraining: /훈련|training|학습|모델/.test(content),
            hasBusiness: /비즈니스|business|영향|impact/.test(content),
            contentSize: content.length
          };
          
          // Chart dimensions check
          const chartDimensions = [];
          const chartElements = await page.locator('canvas').all();
          for (const chart of chartElements) {
            const box = await chart.boundingBox();
            if (box) {
              chartDimensions.push({ width: box.width, height: box.height });
            }
          }
          modelResult.chartDimensions = chartDimensions;
          
          // Performance check
          const performanceEntries = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0];
            return navigation ? {
              loadTime: navigation.loadEventEnd - navigation.loadEventStart,
              domReady: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              totalTime: navigation.loadEventEnd - navigation.fetchStart
            } : null;
          });
          modelResult.performance = performanceEntries;
          
        } else {
          modelResult.loaded = false;
        }
        
      } catch (error) {
        modelResult.error = error.message;
        modelResult.loaded = false;
      }
      
      finalResults.details.push(modelResult);
    }
    
    // Print comprehensive results
    console.log('\n' + '='.repeat(60));
    console.log('           ML TRAINING REPORT COMPREHENSIVE TEST RESULTS           ');
    console.log('='.repeat(60));
    
    console.log('\n📊 SUMMARY:');
    console.log(`  Total Models Tested: ${finalResults.summary.totalTested}`);
    console.log(`  Successfully Loaded: ${finalResults.summary.successful}/${finalResults.summary.totalTested}`);
    console.log(`  Models with Charts: ${finalResults.summary.hasCharts}/${finalResults.summary.totalTested}`);
    console.log(`  Models with Export: ${finalResults.summary.hasExport}/${finalResults.summary.totalTested}`);
    console.log(`  Models with Print: ${finalResults.summary.hasPrint}/${finalResults.summary.totalTested}`);
    console.log(`  Success Rate: ${Math.round((finalResults.summary.successful / finalResults.summary.totalTested) * 100)}%`);
    
    console.log('\n🔍 DETAILED RESULTS:');
    
    finalResults.details.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.model.toUpperCase()} MODEL:`);
      console.log(`   📄 Status: ${result.loaded ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`   🌐 URL: ${result.url}`);
      console.log(`   📋 Title: ${result.title || 'N/A'}`);
      
      if (result.loaded) {
        console.log(`   📊 Charts: ${result.chartCount} found`);
        
        if (result.chartDimensions.length > 0) {
          console.log(`   📏 Chart Dimensions:`);
          result.chartDimensions.forEach((dim, i) => {
            console.log(`      Chart ${i+1}: ${dim.width}x${dim.height}px`);
          });
        }
        
        console.log(`   🔘 Buttons: Print(${result.buttons.print ? '✅' : '❌'}) Export(${result.buttons.export ? '✅' : '❌'}) Back(${result.buttons.back ? '✅' : '❌'})`);
        
        console.log(`   📝 Content Checks:`);
        console.log(`      Model Reference: ${result.contentChecks.hasModelReference ? '✅' : '❌'}`);
        console.log(`      Metrics Present: ${result.contentChecks.hasMetrics ? '✅' : '❌'}`);
        console.log(`      Training Info: ${result.contentChecks.hasTraining ? '✅' : '❌'}`);
        console.log(`      Business Section: ${result.contentChecks.hasBusiness ? '✅' : '❌'}`);
        console.log(`      Content Size: ${result.contentChecks.contentSize.toLocaleString()} characters`);
        
        if (result.performance) {
          console.log(`   ⚡ Performance:`);
          console.log(`      Load Time: ${result.performance.loadTime.toFixed(2)}ms`);
          console.log(`      DOM Ready: ${result.performance.domReady.toFixed(2)}ms`);
          console.log(`      Total Time: ${result.performance.totalTime.toFixed(2)}ms`);
        }
      } else {
        console.log(`   ❌ Error: ${result.error || 'Unknown error'}`);
        console.log(`   📈 HTTP Status: ${result.httpStatus || 'N/A'}`);
      }
    });
    
    console.log('\n🎯 OVERALL ASSESSMENT:');
    
    if (finalResults.summary.successful === finalResults.summary.totalTested) {
      console.log('   🏆 EXCELLENT: All ML training report pages are working perfectly!');
    } else if (finalResults.summary.successful > finalResults.summary.totalTested * 0.75) {
      console.log('   ✅ GOOD: Most ML training report pages are working well');
    } else {
      console.log('   ⚠️  NEEDS ATTENTION: Some ML training report pages have issues');
    }
    
    console.log('\n📋 FUNCTIONALITY CHECKLIST:');
    console.log(`   [${finalResults.summary.successful === finalResults.summary.totalTested ? '✅' : '❌'}] All models load successfully`);
    console.log(`   [${finalResults.summary.hasCharts === finalResults.summary.totalTested ? '✅' : '❌'}] All models have charts`);
    console.log(`   [${finalResults.summary.hasExport === finalResults.summary.totalTested ? '✅' : '❌'}] All models have export functionality`);
    console.log(`   [${finalResults.summary.hasPrint === finalResults.summary.totalTested ? '✅' : '❌'}] All models have print functionality`);
    
    console.log('\n' + '='.repeat(60));
    
    // Assert that all core functionality works
    expect(finalResults.summary.successful).toBe(finalResults.summary.totalTested);
    expect(finalResults.summary.hasCharts).toBeGreaterThan(0);
    expect(finalResults.summary.hasExport).toBeGreaterThan(0);
  });
});