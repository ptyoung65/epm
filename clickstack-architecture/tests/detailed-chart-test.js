const { chromium } = require('playwright');

async function detailedChartTest() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    
    console.log('🔍 Detailed Chart Loading Investigation\n');

    const dashboards = [
        { name: 'WAS Dashboard', url: 'http://localhost:3002/was-dashboard.html' },
        { name: 'Exception Dashboard', url: 'http://localhost:3002/exception-dashboard.html' },
        { name: 'Alert Dashboard', url: 'http://localhost:3002/alert-dashboard.html' }
    ];

    for (const dashboard of dashboards) {
        console.log(`🔍 Investigating ${dashboard.name}...`);
        const page = await context.newPage();
        
        try {
            // Navigate to dashboard
            await page.goto(dashboard.url, { waitUntil: 'networkidle' });
            
            // Wait longer for charts to initialize
            console.log('   ⏳ Waiting for Chart.js initialization...');
            await page.waitForTimeout(5000);

            // Debug chart initialization
            const debugInfo = await page.evaluate(() => {
                // Check if Chart.js is loaded
                const chartJsLoaded = typeof Chart !== 'undefined';
                
                // Check for canvas elements
                const canvasElements = Array.from(document.querySelectorAll('canvas'));
                
                // Check for chart container divs
                const chartContainers = Array.from(document.querySelectorAll('[id*="Chart"], [id*="chart"]'));
                
                // Check for errors in console
                let hasErrors = false;
                
                // Check if getThemeColors function exists
                const themeColorsFunctionExists = typeof getThemeColors === 'function';
                let themeColors = null;
                
                try {
                    if (themeColorsFunctionExists) {
                        themeColors = getThemeColors();
                    }
                } catch (e) {
                    hasErrors = true;
                }

                // Check Chart.js instances
                let chartInstances = 0;
                if (chartJsLoaded && Chart.instances) {
                    chartInstances = Object.keys(Chart.instances).length;
                }

                // Check for chart initialization functions/scripts
                const scriptElements = Array.from(document.querySelectorAll('script'));
                const hasChartScript = scriptElements.some(script => 
                    script.textContent && (
                        script.textContent.includes('new Chart') ||
                        script.textContent.includes('createChart')
                    )
                );

                return {
                    chartJsLoaded: chartJsLoaded,
                    canvasCount: canvasElements.length,
                    canvasIds: canvasElements.map(canvas => canvas.id || 'no-id'),
                    chartContainerCount: chartContainers.length,
                    chartContainerIds: chartContainers.map(container => container.id),
                    themeColorsFunctionExists: themeColorsFunctionExists,
                    themeColors: themeColors,
                    chartInstances: chartInstances,
                    hasChartScript: hasChartScript,
                    hasErrors: hasErrors
                };
            });

            console.log('   📊 Debug Info:');
            console.log('     Chart.js Loaded:', debugInfo.chartJsLoaded);
            console.log('     Canvas Elements:', debugInfo.canvasCount, debugInfo.canvasIds);
            console.log('     Chart Containers:', debugInfo.chartContainerCount, debugInfo.chartContainerIds);
            console.log('     Theme Colors Function:', debugInfo.themeColorsFunctionExists);
            console.log('     Chart Instances:', debugInfo.chartInstances);
            console.log('     Has Chart Script:', debugInfo.hasChartScript);
            console.log('     Theme Colors:', debugInfo.themeColors);

            // Try to manually trigger chart creation
            if (debugInfo.chartContainerCount > 0 && debugInfo.canvasCount === 0) {
                console.log('   🔧 Attempting to trigger chart creation...');
                
                await page.evaluate(() => {
                    // Look for initCharts or similar functions
                    if (typeof initCharts === 'function') {
                        console.log('Calling initCharts()');
                        initCharts();
                    }
                    
                    // Look for any chart creation functions
                    const functionNames = ['createCharts', 'setupCharts', 'loadCharts'];
                    functionNames.forEach(funcName => {
                        if (typeof window[funcName] === 'function') {
                            console.log(`Calling ${funcName}()`);
                            window[funcName]();
                        }
                    });
                });

                // Wait and check again
                await page.waitForTimeout(2000);
                const canvasCountAfter = await page.evaluate(() => document.querySelectorAll('canvas').length);
                console.log('   📊 Canvas count after manual trigger:', canvasCountAfter);
            }

            // Take screenshot for visual verification
            await page.screenshot({ 
                path: `/home/ptyoung/work/AIRIS_APM/clickstack-architecture/tests/screenshots/${dashboard.name.toLowerCase().replace(' ', '-')}-debug.png`,
                fullPage: true 
            });
            console.log(`   📸 Debug screenshot saved`);
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        } finally {
            await page.close();
        }
        
        console.log(''); // Empty line
    }

    await context.close();
    await browser.close();
}

// Run the test
if (require.main === module) {
    detailedChartTest().catch(console.error);
}

module.exports = { detailedChartTest };