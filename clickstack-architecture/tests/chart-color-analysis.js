const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function analyzeChartColors() {
    const browser = await chromium.launch({ headless: false, slowMo: 1000 });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    const results = {
        timestamp: new Date().toISOString(),
        baseUrl: 'http://localhost:3001',
        dashboards: {}
    };

    const dashboards = [
        { name: 'j2ee-dashboard', url: '/j2ee-dashboard.html', title: 'J2EE 모니터링 대시보드' },
        { name: 'was-dashboard', url: '/was-dashboard.html', title: 'WAS 모니터링 대시보드' },
        { name: 'exception-dashboard', url: '/exception-dashboard.html', title: '예외 추적 대시보드' },
        { name: 'alert-dashboard', url: '/alert-dashboard.html', title: '알림 관리 대시보드' }
    ];

    // Create screenshots directory
    const screenshotsDir = '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/tests/screenshots';
    try {
        await fs.mkdir(screenshotsDir, { recursive: true });
    } catch (error) {
        console.log('Screenshots directory already exists or created successfully');
    }

    for (const dashboard of dashboards) {
        console.log(`\n🔍 Analyzing ${dashboard.name}...`);
        
        try {
            // Navigate to dashboard
            await page.goto(`${results.baseUrl}${dashboard.url}`, { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });

            // Wait for charts to load
            await page.waitForTimeout(5000);
            
            // Take full page screenshot
            const screenshotPath = path.join(screenshotsDir, `${dashboard.name}_full.png`);
            await page.screenshot({ 
                path: screenshotPath,
                fullPage: true 
            });

            console.log(`📸 Screenshot saved: ${screenshotPath}`);

            // Analyze chart colors
            const colorAnalysis = await page.evaluate(() => {
                const analysis = {
                    chartElements: [],
                    blackColorElements: [],
                    chartCanvases: [],
                    computedStyles: {}
                };

                // Find all canvas elements (Chart.js charts)
                const canvases = document.querySelectorAll('canvas');
                analysis.chartCanvases = Array.from(canvases).map((canvas, index) => ({
                    index,
                    id: canvas.id || `canvas-${index}`,
                    width: canvas.width,
                    height: canvas.height,
                    parentId: canvas.parentElement?.id || 'no-parent-id',
                    parentClasses: canvas.parentElement?.className || 'no-parent-classes'
                }));

                // Check for elements with black colors
                const allElements = document.querySelectorAll('*');
                allElements.forEach((element, index) => {
                    const computedStyle = window.getComputedStyle(element);
                    const color = computedStyle.color;
                    const backgroundColor = computedStyle.backgroundColor;
                    const borderColor = computedStyle.borderColor;

                    // Check for black colors
                    const blackColors = ['rgb(0, 0, 0)', '#000', '#000000', 'black'];
                    const hasBlackColor = blackColors.some(blackColor => 
                        color === blackColor || 
                        backgroundColor === blackColor || 
                        borderColor === blackColor
                    );

                    if (hasBlackColor && element.offsetParent !== null) { // Only visible elements
                        analysis.blackColorElements.push({
                            tagName: element.tagName,
                            id: element.id || `element-${index}`,
                            className: element.className,
                            color: color,
                            backgroundColor: backgroundColor,
                            borderColor: borderColor,
                            textContent: element.textContent?.substring(0, 50) || '',
                            isInChart: element.closest('canvas') !== null || element.closest('[id*="chart"]') !== null
                        });
                    }
                });

                // Check specific chart-related elements
                const chartContainers = document.querySelectorAll('[id*="chart"], [class*="chart"]');
                chartContainers.forEach((container, index) => {
                    const computedStyle = window.getComputedStyle(container);
                    analysis.chartElements.push({
                        id: container.id || `chart-container-${index}`,
                        className: container.className,
                        color: computedStyle.color,
                        backgroundColor: computedStyle.backgroundColor,
                        borderColor: computedStyle.borderColor
                    });
                });

                // Get Chart.js specific information if available
                if (window.Chart && window.Chart.instances) {
                    analysis.chartInstances = Object.keys(window.Chart.instances).map(key => {
                        const chart = window.Chart.instances[key];
                        return {
                            type: chart.config.type,
                            id: chart.canvas.id,
                            options: {
                                scales: chart.options.scales,
                                plugins: chart.options.plugins
                            }
                        };
                    });
                }

                return analysis;
            });

            // Take screenshot of each chart individually
            const chartCanvases = await page.$$('canvas');
            for (let i = 0; i < chartCanvases.length; i++) {
                const canvas = chartCanvases[i];
                const boundingBox = await canvas.boundingBox();
                if (boundingBox) {
                    const chartScreenshotPath = path.join(screenshotsDir, `${dashboard.name}_chart_${i}.png`);
                    await canvas.screenshot({ path: chartScreenshotPath });
                    console.log(`📊 Chart screenshot saved: ${chartScreenshotPath}`);
                }
            }

            // Store results
            results.dashboards[dashboard.name] = {
                title: dashboard.title,
                url: dashboard.url,
                status: 'success',
                colorAnalysis: colorAnalysis,
                screenshotPath: screenshotPath,
                chartCount: colorAnalysis.chartCanvases.length,
                blackColorElementsCount: colorAnalysis.blackColorElements.length
            };

            console.log(`✅ Analysis complete for ${dashboard.name}`);
            console.log(`   - Found ${colorAnalysis.chartCanvases.length} chart canvases`);
            console.log(`   - Found ${colorAnalysis.blackColorElements.length} elements with black colors`);

        } catch (error) {
            console.error(`❌ Error analyzing ${dashboard.name}:`, error.message);
            results.dashboards[dashboard.name] = {
                title: dashboard.title,
                url: dashboard.url,
                status: 'error',
                error: error.message
            };
        }
    }

    // Save detailed analysis report
    const reportPath = '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/tests/chart-color-analysis-report.json';
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📋 Detailed analysis report saved: ${reportPath}`);

    // Generate summary report
    const summaryReport = generateSummaryReport(results);
    const summaryPath = '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/tests/chart-color-summary.md';
    await fs.writeFile(summaryPath, summaryReport);
    console.log(`📋 Summary report saved: ${summaryPath}`);

    await browser.close();
    return results;
}

function generateSummaryReport(results) {
    let summary = `# Chart Color Analysis Report\n\n`;
    summary += `**Analysis Date**: ${results.timestamp}\n`;
    summary += `**Base URL**: ${results.baseUrl}\n\n`;

    summary += `## Executive Summary\n\n`;
    
    let totalCharts = 0;
    let totalBlackElements = 0;
    let dashboardsWithIssues = 0;

    Object.entries(results.dashboards).forEach(([key, dashboard]) => {
        if (dashboard.status === 'success') {
            totalCharts += dashboard.chartCount || 0;
            totalBlackElements += dashboard.blackColorElementsCount || 0;
            if ((dashboard.blackColorElementsCount || 0) > 0) {
                dashboardsWithIssues++;
            }
        }
    });

    summary += `- **Total Dashboards Analyzed**: ${Object.keys(results.dashboards).length}\n`;
    summary += `- **Total Charts Found**: ${totalCharts}\n`;
    summary += `- **Total Elements with Black Colors**: ${totalBlackElements}\n`;
    summary += `- **Dashboards with Color Issues**: ${dashboardsWithIssues}\n\n`;

    summary += `## Dashboard Analysis Details\n\n`;

    Object.entries(results.dashboards).forEach(([key, dashboard]) => {
        summary += `### ${dashboard.title}\n`;
        summary += `- **URL**: ${dashboard.url}\n`;
        summary += `- **Status**: ${dashboard.status}\n`;

        if (dashboard.status === 'success') {
            summary += `- **Chart Count**: ${dashboard.chartCount}\n`;
            summary += `- **Black Color Elements**: ${dashboard.blackColorElementsCount}\n`;

            if (dashboard.colorAnalysis?.blackColorElements?.length > 0) {
                summary += `\n**🚨 Color Issues Found:**\n`;
                dashboard.colorAnalysis.blackColorElements.forEach((element, index) => {
                    summary += `${index + 1}. **${element.tagName}** `;
                    if (element.id) summary += `(ID: ${element.id}) `;
                    if (element.className) summary += `(Class: ${element.className}) `;
                    summary += `\n   - Color: ${element.color}\n`;
                    if (element.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                        summary += `   - Background: ${element.backgroundColor}\n`;
                    }
                    if (element.borderColor !== 'rgb(0, 0, 0)' && element.borderColor !== 'rgba(0, 0, 0, 0)') {
                        summary += `   - Border: ${element.borderColor}\n`;
                    }
                    if (element.textContent) {
                        summary += `   - Content: "${element.textContent}"\n`;
                    }
                    summary += `   - In Chart Context: ${element.isInChart}\n\n`;
                });
            } else {
                summary += `\n✅ **No black color issues found**\n`;
            }

            if (dashboard.colorAnalysis?.chartCanvases?.length > 0) {
                summary += `\n**Chart Canvas Information:**\n`;
                dashboard.colorAnalysis.chartCanvases.forEach((canvas, index) => {
                    summary += `${index + 1}. Canvas ID: ${canvas.id} (${canvas.width}x${canvas.height})\n`;
                    summary += `   - Parent: ${canvas.parentId} (${canvas.parentClasses})\n`;
                });
            }
        } else {
            summary += `- **Error**: ${dashboard.error}\n`;
        }

        summary += `\n---\n\n`;
    });

    summary += `## Recommended Actions\n\n`;
    
    if (totalBlackElements > 0) {
        summary += `🔧 **Color Issues Detected**: ${totalBlackElements} elements with black colors found across ${dashboardsWithIssues} dashboards.\n\n`;
        summary += `**Immediate Actions:**\n`;
        summary += `1. Review Chart.js default color configurations\n`;
        summary += `2. Update CSS variables for chart text and axes\n`;
        summary += `3. Ensure shadcn/ui theme colors are properly applied to Chart.js options\n`;
        summary += `4. Test with both light and dark themes\n\n`;
        summary += `**Files to Check:**\n`;
        summary += `- Chart.js initialization scripts in each dashboard\n`;
        summary += `- CSS theme variables for chart elements\n`;
        summary += `- shadcn/ui configuration for chart components\n\n`;
    } else {
        summary += `✅ **No Color Issues**: All dashboards appear to have proper theme color implementation.\n\n`;
    }

    summary += `## Technical Details\n\n`;
    summary += `- **Browser**: Chromium (Playwright)\n`;
    summary += `- **Viewport**: 1920x1080\n`;
    summary += `- **Analysis Method**: DOM inspection + computed styles\n`;
    summary += `- **Screenshot Location**: tests/screenshots/\n`;
    summary += `- **Color Detection**: Checking for rgb(0, 0, 0), #000, #000000, black\n\n`;

    return summary;
}

// Run the analysis
analyzeChartColors()
    .then((results) => {
        console.log('\n🎉 Chart color analysis completed successfully!');
        console.log('\n📊 Quick Summary:');
        Object.entries(results.dashboards).forEach(([key, dashboard]) => {
            if (dashboard.status === 'success') {
                console.log(`   ${dashboard.title}: ${dashboard.chartCount} charts, ${dashboard.blackColorElementsCount} black elements`);
            }
        });
    })
    .catch((error) => {
        console.error('❌ Analysis failed:', error);
        process.exit(1);
    });