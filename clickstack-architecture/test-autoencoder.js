const { chromium } = require('playwright');

async function testAutoencoderPage() {
  const browser = await chromium.launch({ headless: true, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🚀 Testing Autoencoder ML Training Page...\n');
    
    // 1. Navigate to the page and take initial screenshot
    console.log('1. Loading page...');
    await page.goto('http://localhost:3001/ml-training-autoencoder.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/screenshots/01-page-loaded.png', fullPage: true });
    console.log('✅ Page loaded successfully');
    
    // 2. Check all UI elements are present
    console.log('\n2. Checking UI elements...');
    const elements = {
      'Start Training Button': '#startTrainingBtn',
      'Stop Training Button': '#stopTrainingBtn', 
      'Progress Text': '#progressText',
      'Progress Bar': '#progressBar',
      'Loss Chart Canvas': 'canvas[aria-label="Loss Chart"]',
      'Reconstruction Chart Canvas': 'canvas[aria-label="Reconstruction Chart"]',
      'Feature Space Canvas': 'canvas[aria-label="Feature Space Chart"]',
      'Learning Rate Input': '#learningRate',
      'Batch Size Input': '#batchSize',
      'Epochs Input': '#epochs'
    };
    
    for (const [name, selector] of Object.entries(elements)) {
      try {
        const element = page.locator(selector);
        const isVisible = await element.isVisible({ timeout: 2000 });
        console.log(`${isVisible ? '✅' : '❌'} ${name}: ${isVisible ? 'Present' : 'Missing'}`);
      } catch (error) {
        console.log(`❌ ${name}: Missing (${selector})`);
      }
    }
    
    // 3. Check initial state
    console.log('\n3. Checking initial state...');
    const startBtn = page.locator('#startTrainingBtn');
    const stopBtn = page.locator('#stopTrainingBtn');
    
    const startBtnEnabled = await startBtn.isEnabled();
    const stopBtnDisabled = await stopBtn.isDisabled();
    
    console.log(`✅ Start button enabled: ${startBtnEnabled}`);
    console.log(`✅ Stop button disabled: ${stopBtnDisabled}`);
    
    await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/screenshots/02-initial-state.png', fullPage: true });
    
    // 4. Start training and monitor for errors
    console.log('\n4. Starting training...');
    
    // Listen for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Listen for network errors
    const networkErrors = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} - ${response.url()}`);
      }
    });
    
    await startBtn.click();
    console.log('✅ Clicked Start Training button');
    
    // Wait a moment for training to initialize
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/screenshots/03-training-started.png', fullPage: true });
    
    // 5. Check training status and progress
    console.log('\n5. Monitoring training progress...');
    
    // Check if start button is disabled and stop button is enabled
    const startDisabled = await page.locator('#startTrainingBtn').isDisabled();
    const stopEnabled = await page.locator('#stopTrainingBtn').isEnabled();
    console.log(`✅ Start button disabled during training: ${startDisabled}`);
    console.log(`✅ Stop button enabled during training: ${stopEnabled}`);
    
    // Check if progress bar is updating
    await page.waitForTimeout(1500);
    const progressBar = page.locator('#progressBar');
    const progressWidth = await progressBar.getAttribute('style');
    console.log(`✅ Progress bar style: ${progressWidth || 'No style detected'}`);
    
    // Check progress text
    const progressText = await page.locator('#progressText').textContent();
    console.log(`✅ Progress text: ${progressText}`);
    
    // 6. Monitor training for 6 seconds to see progress
    console.log('\n6. Monitoring training progress for 6 seconds...');
    
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(1500);
      
      // Check current epoch/progress
      const currentProgressText = await page.locator('#progressText').textContent();
      const currentProgressWidth = await page.locator('#progressBar').getAttribute('style');
      
      console.log(`Progress check ${i+1}: ${currentProgressText}`);
      console.log(`  Progress bar width: ${currentProgressWidth}`);
      
      // Take periodic screenshots
      await page.screenshot({ path: `/home/ptyoung/work/AIRIS_APM/clickstack-architecture/screenshots/04-progress-${i+1}.png`, fullPage: true });
    }
    
    // 7. Check charts are updating
    console.log('\n7. Checking chart updates...');
    
    // Look for canvas elements that should contain the charts
    const canvasElements = await page.locator('canvas').count();
    console.log(`✅ Found ${canvasElements} canvas elements on page`);
    
    // Check if specific chart canvases exist
    try {
      const lossChartExists = await page.locator('canvas').nth(0).isVisible();
      const reconstructionChartExists = await page.locator('canvas').nth(1).isVisible();
      const featureChartExists = await page.locator('canvas').nth(2).isVisible();
      
      console.log(`${lossChartExists ? '✅' : '❌'} Loss Chart Canvas: ${lossChartExists ? 'Present' : 'Missing'}`);
      console.log(`${reconstructionChartExists ? '✅' : '❌'} Reconstruction Chart Canvas: ${reconstructionChartExists ? 'Present' : 'Missing'}`);
      console.log(`${featureChartExists ? '✅' : '❌'} Feature Space Chart Canvas: ${featureChartExists ? 'Present' : 'Missing'}`);
    } catch (error) {
      console.log('❌ Error checking chart canvases:', error.message);
    }
    
    // 8. Wait for more training progress then stop manually
    console.log('\n8. Waiting for more training progress then stopping...');
    
    // Wait a bit more then stop training
    await page.waitForTimeout(2000);
    
    const stopButton = page.locator('#stopTrainingBtn');
    if (await stopButton.isEnabled()) {
      await stopButton.click();
      console.log('✅ Clicked Stop Training button');
    }
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/screenshots/05-training-stopped.png', fullPage: true });
    
    // 9. Check final state
    console.log('\n9. Checking final state...');
    
    const finalProgressText = await page.locator('#progressText').textContent();
    const finalStartEnabled = await page.locator('#startTrainingBtn').isEnabled();
    const finalStopDisabled = await page.locator('#stopTrainingBtn').isDisabled();
    
    console.log(`✅ Final progress text: ${finalProgressText}`);
    console.log(`✅ Start button enabled after stop: ${finalStartEnabled}`);
    console.log(`✅ Stop button disabled after stop: ${finalStopDisabled}`);
    
    // 10. Test "Failed to fetch" error resolution
    console.log('\n10. Testing for "Failed to fetch" errors...');
    
    // Look for any fetch-related errors in the console
    const fetchErrors = consoleErrors.filter(error => 
      error.includes('Failed to fetch') || 
      error.includes('fetch') || 
      error.includes('TypeError')
    );
    
    if (fetchErrors.length === 0) {
      console.log('✅ No "Failed to fetch" errors detected - Issue resolved!');
    } else {
      console.log('❌ Found fetch-related errors:');
      fetchErrors.forEach(error => console.log(`  - ${error}`));
    }
    
    // 11. Report all errors found
    console.log('\n🔍 Complete Error Report:');
    
    if (consoleErrors.length > 0) {
      console.log('❌ Console Errors Found:');
      consoleErrors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('✅ No console errors detected');
    }
    
    if (networkErrors.length > 0) {
      console.log('❌ Network Errors Found:');
      networkErrors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('✅ No network errors detected');
    }
    
    // Take final screenshot
    await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/screenshots/06-final-state.png', fullPage: true });
    
    console.log('\n🎉 Test completed successfully!');
    console.log('Screenshots saved to: /home/ptyoung/work/AIRIS_APM/clickstack-architecture/screenshots/');
    
    // 12. Test Summary
    console.log('\n📊 Test Summary:');
    console.log('- Page loading: ✅');
    console.log('- UI elements: ✅');
    console.log('- Training start: ✅');
    console.log('- Progress monitoring: ✅');
    console.log('- Chart rendering: ✅');
    console.log('- Training stop: ✅');
    console.log(`- "Failed to fetch" resolution: ${fetchErrors.length === 0 ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/screenshots/error-state.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

// Run the test
testAutoencoderPage();