const { chromium } = require('playwright');

async function debugChartColors() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    
    console.log('🔍 Debugging Chart Color Issues\n');

    const page = await context.newPage();
    
    try {
        // Navigate to J2EE dashboard
        console.log('📊 Loading J2EE Dashboard...');
        await page.goto('http://localhost:3002/j2ee-dashboard.html', { waitUntil: 'networkidle' });
        
        // Wait for page to fully load
        await page.waitForTimeout(3000);
        
        // Debug color resolution
        console.log('🎨 Debugging color resolution...');
        const colorDebug = await page.evaluate(() => {
            // Test CSS variable resolution
            const style = getComputedStyle(document.documentElement);
            const primaryVar = style.getPropertyValue('--primary').trim();
            const borderVar = style.getPropertyValue('--border').trim();
            
            // Test getThemeColors function
            let themeColors = null;
            try {
                if (typeof getThemeColors === 'function') {
                    themeColors = getThemeColors();
                } else {
                    // Define the function if it doesn't exist
                    window.getThemeColors = function() {
                        const style = getComputedStyle(document.documentElement);
                        const primaryHsl = style.getPropertyValue('--primary').trim();
                        const borderHsl = style.getPropertyValue('--border').trim(); 
                        const mutedForegroundHsl = style.getPropertyValue('--muted-foreground').trim();
                        
                        return {
                            primary: `hsl(${primaryHsl})`,
                            primaryTransparent: `hsl(${primaryHsl} / 0.1)`,
                            border: `hsl(${borderHsl})`,
                            mutedForeground: `hsl(${mutedForegroundHsl})`
                        };
                    };
                    themeColors = getThemeColors();
                }
            } catch (e) {
                themeColors = { error: e.message };
            }
            
            // Test if Chart.js is available
            const chartAvailable = typeof Chart !== 'undefined';
            
            // Check what colors are actually being used in charts
            let chartColors = [];
            if (chartAvailable && Chart.instances) {
                Object.values(Chart.instances).forEach((chart, index) => {
                    if (chart.data && chart.data.datasets) {
                        chart.data.datasets.forEach((dataset, dsIndex) => {
                            chartColors.push({
                                chartIndex: index,
                                datasetIndex: dsIndex,
                                backgroundColor: dataset.backgroundColor,
                                borderColor: dataset.borderColor
                            });
                        });
                    }
                });
            }
            
            return {
                cssVariables: {
                    primary: primaryVar,
                    border: borderVar,
                    primaryHsl: `hsl(${primaryVar})`,
                    borderHsl: `hsl(${borderVar})`
                },
                themeColors: themeColors,
                chartAvailable: chartAvailable,
                chartInstanceCount: chartAvailable && Chart.instances ? Object.keys(Chart.instances).length : 0,
                chartColors: chartColors
            };
        });

        console.log('🔍 Color Debug Results:');
        console.log('   CSS Variables:', colorDebug.cssVariables);
        console.log('   Theme Colors:', colorDebug.themeColors);
        console.log('   Chart.js Available:', colorDebug.chartAvailable);
        console.log('   Chart Instances:', colorDebug.chartInstanceCount);
        console.log('   Chart Colors:', colorDebug.chartColors);

        // Test creating a test chart with manual color specification
        console.log('\n🧪 Testing manual chart creation...');
        const manualChartTest = await page.evaluate(() => {
            // Create a test canvas
            const testCanvas = document.createElement('canvas');
            testCanvas.width = 400;
            testCanvas.height = 200;
            testCanvas.id = 'testChart';
            document.body.appendChild(testCanvas);

            const ctx = testCanvas.getContext('2d');
            
            // Try to create a chart with explicit colors
            try {
                const testChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr'],
                        datasets: [{
                            label: 'Test Data',
                            data: [10, 20, 15, 25],
                            backgroundColor: 'rgb(60, 93, 169)', // Explicit blue color
                            borderColor: 'rgb(60, 93, 169)',
                            fill: false
                        }]
                    },
                    options: {
                        responsive: false,
                        maintainAspectRatio: false
                    }
                });

                // Force render
                testChart.update();

                // Get pixel data to check colors
                const imageData = ctx.getImageData(0, 0, testCanvas.width, testCanvas.height);
                const data = imageData.data;
                
                let bluePixels = 0;
                let blackPixels = 0;
                
                for (let i = 0; i < data.length; i += 16) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];
                    
                    if (a > 0) {
                        if (r === 0 && g === 0 && b === 0) {
                            blackPixels++;
                        } else if (b > r && b > g && b > 100) {
                            bluePixels++;
                        }
                    }
                }

                return {
                    success: true,
                    bluePixels: bluePixels,
                    blackPixels: blackPixels,
                    totalSampled: Math.floor(data.length / 16),
                    chartConfig: {
                        backgroundColor: testChart.data.datasets[0].backgroundColor,
                        borderColor: testChart.data.datasets[0].borderColor
                    }
                };
            } catch (e) {
                return {
                    success: false,
                    error: e.message
                };
            }
        });

        console.log('   Manual Chart Test:', manualChartTest);

        // Take a screenshot for visual inspection
        await page.screenshot({ 
            path: '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/tests/screenshots/debug-colors.png',
            fullPage: true 
        });
        console.log('   📸 Screenshot saved: debug-colors.png');

    } catch (error) {
        console.error('❌ Error during debugging:', error.message);
    } finally {
        await page.close();
        await context.close();
        await browser.close();
    }
}

// Run the debug
if (require.main === module) {
    debugChartColors().catch(console.error);
}

module.exports = { debugChartColors };