const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('ML Report Export and Print Tests', () => {
  
  test('Test export functionality for all models', async ({ page }) => {
    const models = ['autoencoder', 'lstm', 'rca', 'clustering'];
    const exportResults = [];
    
    for (const model of models) {
      const url = `/ml-training-report.html?model=${model}`;
      
      try {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        // Look for export buttons
        const exportButtons = await page.locator('button:has-text("JSON 내보내기"), button:has-text("Export"), button[onclick*="export"]').all();
        
        let exportWorked = false;
        
        if (exportButtons.length > 0) {
          // Listen for download
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
          
          // Click export button
          await exportButtons[0].click();
          
          // Wait for potential download
          const download = await downloadPromise;
          
          if (download) {
            exportWorked = true;
            console.log(`✅ Export working for ${model}: ${download.suggestedFilename()}`);
          }
        }
        
        exportResults.push({
          model,
          hasExportButton: exportButtons.length > 0,
          exportWorked
        });
        
      } catch (error) {
        exportResults.push({
          model,
          error: error.message
        });
      }
    }
    
    console.log('\n=== Export Functionality Results ===');
    exportResults.forEach(result => {
      console.log(`${result.model.toUpperCase()}:`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      } else {
        console.log(`  Has Export Button: ${result.hasExportButton}`);
        console.log(`  Export Worked: ${result.exportWorked}`);
      }
    });
  });

  test('Test print functionality', async ({ page }) => {
    const model = 'autoencoder';
    const url = `/ml-training-report.html?model=${model}`;
    
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Look for print button
    const printButtons = await page.locator('button:has-text("인쇄"), button:has-text("Print"), button[onclick*="print"]').all();
    
    if (printButtons.length > 0) {
      // Override print dialog to prevent actual printing
      await page.evaluate(() => {
        window.print = () => {
          console.log('Print dialog would open');
          return true;
        };
      });
      
      await printButtons[0].click();
      console.log('✅ Print button clicked successfully');
    } else {
      console.log('⚠️ No print button found');
    }
  });

  test('Test chart interactions', async ({ page }) => {
    const model = 'autoencoder';
    const url = `/ml-training-report.html?model=${model}`;
    
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Find all charts
    const charts = await page.locator('canvas').all();
    
    console.log(`Found ${charts.length} charts`);
    
    for (let i = 0; i < Math.min(charts.length, 3); i++) {
      const chart = charts[i];
      
      // Test hover
      await chart.hover();
      await page.waitForTimeout(500);
      
      // Test click
      await chart.click();
      await page.waitForTimeout(500);
      
      console.log(`✅ Interacted with chart ${i + 1}`);
    }
  });
});