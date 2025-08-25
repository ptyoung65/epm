const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testChartColors() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    
    const results = [];
    
    // Define dashboard URLs and names
    const dashboards = [
        {
            name: 'J2EE Dashboard',
            url: 'http://localhost:3002/j2ee-dashboard.html',
            filename: 'j2ee-dashboard'
        },
        {
            name: 'WAS Dashboard',
            url: 'http://localhost:3002/was-dashboard.html',
            filename: 'was-dashboard'
        },
        {
            name: 'Exception Dashboard',
            url: 'http://localhost:3002/exception-dashboard.html',
            filename: 'exception-dashboard'
        },
        {
            name: 'Alert Dashboard',
            url: 'http://localhost:3002/alert-dashboard.html',
            filename: 'alert-dashboard'
        }
    ];

    // Create screenshots directory
    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    console.log('🚀 Starting Chart Color Verification Test\n');

    for (const dashboard of dashboards) {
        console.log(`📊 Testing ${dashboard.name}...`);
        
        const page = await context.newPage();
        const result = {
            name: dashboard.name,
            url: dashboard.url,
            status: 'pending',
            issues: [],
            chartInfo: []
        };

        try {
            // Navigate to dashboard
            await page.goto(dashboard.url, { waitUntil: 'networkidle' });
            
            // Wait for charts to load
            console.log('   ⏳ Waiting for charts to load...');
            await page.waitForTimeout(3000);
            
            // Wait for Chart.js to initialize
            await page.waitForFunction(() => {
                return window.Chart !== undefined;
            }, { timeout: 10000 });

            // Take full page screenshot
            const screenshotPath = path.join(screenshotDir, `${dashboard.filename}-full.png`);
            await page.screenshot({ 
                path: screenshotPath, 
                fullPage: true 
            });
            console.log(`   📸 Screenshot saved: ${screenshotPath}`);

            // Find all canvas elements (Chart.js charts)
            const canvasElements = await page.$$('canvas');
            console.log(`   📈 Found ${canvasElements.length} chart canvas elements`);

            // Check each chart for color issues
            for (let i = 0; i < canvasElements.length; i++) {
                const canvas = canvasElements[i];
                
                // Get canvas context and check for black pixels
                const canvasData = await canvas.evaluate((canvasEl) => {
                    if (!canvasEl.getContext) return null;
                    
                    const ctx = canvasEl.getContext('2d');
                    const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
                    const data = imageData.data;
                    
                    let blackPixels = 0;
                    let totalPixels = data.length / 4;
                    let hasBluePixels = false;
                    
                    // Sample pixels to check for black (0,0,0) and blue colors
                    for (let j = 0; j < data.length; j += 16) { // Sample every 4th pixel
                        const r = data[j];
                        const g = data[j + 1];
                        const b = data[j + 2];
                        const a = data[j + 3];
                        
                        // Check for black pixels (indicating missing colors)
                        if (r === 0 && g === 0 && b === 0 && a > 0) {
                            blackPixels++;
                        }
                        
                        // Check for blue-ish colors (indicating proper theming)
                        if (b > r && b > g && b > 100) {
                            hasBluePixels = true;
                        }
                    }
                    
                    return {
                        width: canvasEl.width,
                        height: canvasEl.height,
                        blackPixels: blackPixels,
                        totalSampled: Math.floor(totalPixels / 4),
                        hasBluePixels: hasBluePixels,
                        blackPercentage: (blackPixels / Math.floor(totalPixels / 4)) * 100
                    };
                });

                if (canvasData) {
                    const chartInfo = {
                        index: i + 1,
                        dimensions: `${canvasData.width}x${canvasData.height}`,
                        blackPixels: canvasData.blackPixels,
                        blackPercentage: canvasData.blackPercentage.toFixed(2),
                        hasBluePixels: canvasData.hasBluePixels
                    };
                    
                    result.chartInfo.push(chartInfo);
                    
                    // Flag issues
                    if (canvasData.blackPercentage > 30) {
                        result.issues.push(`Chart ${i + 1}: High black pixel percentage (${canvasData.blackPercentage.toFixed(2)}%)`);
                    }
                    
                    if (!canvasData.hasBluePixels) {
                        result.issues.push(`Chart ${i + 1}: No blue theme colors detected`);
                    }
                    
                    console.log(`   📊 Chart ${i + 1}: ${canvasData.width}x${canvasData.height}, Black: ${canvasData.blackPercentage.toFixed(2)}%, Blue: ${canvasData.hasBluePixels ? '✅' : '❌'}`);
                }
            }

            // Check for CSS variables being properly resolved
            const cssVariableCheck = await page.evaluate(() => {
                const testElement = document.createElement('div');
                testElement.style.color = 'var(--primary)';
                document.body.appendChild(testElement);
                
                const computedStyle = window.getComputedStyle(testElement);
                const resolvedColor = computedStyle.color;
                
                document.body.removeChild(testElement);
                
                return {
                    originalValue: 'var(--primary)',
                    resolvedColor: resolvedColor,
                    isResolved: resolvedColor !== 'var(--primary)' && resolvedColor !== ''
                };
            });

            console.log(`   🎨 CSS Variable Resolution: ${cssVariableCheck.isResolved ? '✅' : '❌'} (${cssVariableCheck.resolvedColor})`);
            
            if (!cssVariableCheck.isResolved) {
                result.issues.push('CSS variables not properly resolved');
            }

            // Determine overall status
            result.status = result.issues.length === 0 ? 'passed' : 'failed';
            console.log(`   ${result.status === 'passed' ? '✅' : '❌'} Status: ${result.status.toUpperCase()}`);
            
            if (result.issues.length > 0) {
                console.log(`   ⚠️  Issues found:`);
                result.issues.forEach(issue => console.log(`      - ${issue}`));
            }

        } catch (error) {
            result.status = 'error';
            result.issues.push(`Error: ${error.message}`);
            console.log(`   ❌ Error testing ${dashboard.name}: ${error.message}`);
        } finally {
            await page.close();
        }
        
        results.push(result);
        console.log(''); // Empty line for readability
    }

    await context.close();
    await browser.close();

    // Generate summary report
    console.log('📋 CHART COLOR TEST SUMMARY');
    console.log('=' .repeat(50));
    
    let passedCount = 0;
    let failedCount = 0;
    let errorCount = 0;
    
    results.forEach(result => {
        const statusIcon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
        console.log(`${statusIcon} ${result.name}: ${result.status.toUpperCase()}`);
        
        if (result.status === 'passed') passedCount++;
        else if (result.status === 'failed') failedCount++;
        else errorCount++;
        
        if (result.chartInfo.length > 0) {
            console.log(`   Charts found: ${result.chartInfo.length}`);
            result.chartInfo.forEach(chart => {
                const blueIcon = chart.hasBluePixels ? '🔵' : '⚫';
                console.log(`   ${blueIcon} Chart ${chart.index}: ${chart.dimensions}, Black: ${chart.blackPercentage}%`);
            });
        }
        
        if (result.issues.length > 0) {
            console.log(`   Issues: ${result.issues.length}`);
            result.issues.forEach(issue => console.log(`   - ${issue}`));
        }
        console.log('');
    });

    console.log(`📊 FINAL RESULTS:`);
    console.log(`   ✅ Passed: ${passedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   ⚠️  Errors: ${errorCount}`);
    console.log(`   📸 Screenshots saved in: ${screenshotDir}`);

    // Save detailed results to JSON
    const reportPath = path.join(screenshotDir, 'chart-color-test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`📄 Detailed report saved: ${reportPath}`);

    return results;
}

// Run the test
if (require.main === module) {
    testChartColors().catch(console.error);
}

module.exports = { testChartColors };