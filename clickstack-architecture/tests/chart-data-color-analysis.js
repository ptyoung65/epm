const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function analyzeChartDataColors() {
    const browser = await chromium.launch({ headless: false, slowMo: 1000 });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    const results = {
        timestamp: new Date().toISOString(),
        baseUrl: 'http://localhost:3001',
        dashboards: {},
        criticalFindings: []
    };

    const dashboards = [
        { name: 'j2ee-dashboard', url: '/j2ee-dashboard.html', title: 'J2EE 모니터링 대시보드' },
        { name: 'was-dashboard', url: '/was-dashboard.html', title: 'WAS 모니터링 대시보드' },
        { name: 'exception-dashboard', url: '/exception-dashboard.html', title: '예외 추적 대시보드' },
        { name: 'alert-dashboard', url: '/alert-dashboard.html', title: '알림 관리 대시보드' }
    ];

    for (const dashboard of dashboards) {
        console.log(`\n🔍 Analyzing Chart Data Colors in ${dashboard.name}...`);
        
        try {
            await page.goto(`${results.baseUrl}${dashboard.url}`, { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });

            // Wait for charts to load
            await page.waitForTimeout(5000);

            // Analyze Chart.js data colors
            const chartDataAnalysis = await page.evaluate(() => {
                const analysis = {
                    chartInstances: [],
                    blackDataElements: [],
                    colorIssues: []
                };

                // Check if Chart.js is available and has instances
                if (typeof Chart !== 'undefined' && Chart.instances) {
                    Object.keys(Chart.instances).forEach(key => {
                        const chart = Chart.instances[key];
                        const chartInfo = {
                            id: chart.canvas.id,
                            type: chart.config.type,
                            datasets: [],
                            hasBlackElements: false
                        };

                        // Analyze each dataset
                        chart.config.data.datasets.forEach((dataset, datasetIndex) => {
                            const datasetInfo = {
                                index: datasetIndex,
                                label: dataset.label || `Dataset ${datasetIndex}`,
                                backgroundColor: dataset.backgroundColor,
                                borderColor: dataset.borderColor,
                                hasBlackBackground: false,
                                hasBlackBorder: false,
                                issues: []
                            };

                            // Check for black colors in various formats
                            const blackColors = [
                                'rgb(0, 0, 0)', 'rgb(0,0,0)', 
                                '#000', '#000000', 'black',
                                'rgba(0, 0, 0, 1)', 'rgba(0,0,0,1)',
                                'rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.5)'
                            ];

                            // Check background color
                            if (dataset.backgroundColor) {
                                const bgColor = Array.isArray(dataset.backgroundColor) 
                                    ? dataset.backgroundColor[0] 
                                    : dataset.backgroundColor;
                                
                                if (blackColors.some(black => 
                                    typeof bgColor === 'string' && bgColor.toLowerCase().includes(black.toLowerCase())
                                )) {
                                    datasetInfo.hasBlackBackground = true;
                                    datasetInfo.issues.push(`Black background color: ${bgColor}`);
                                    chartInfo.hasBlackElements = true;
                                    analysis.blackDataElements.push({
                                        chartId: chart.canvas.id,
                                        type: 'backgroundColor',
                                        value: bgColor,
                                        dataset: datasetInfo.label
                                    });
                                }
                            }

                            // Check border color
                            if (dataset.borderColor) {
                                const borderColor = Array.isArray(dataset.borderColor) 
                                    ? dataset.borderColor[0] 
                                    : dataset.borderColor;
                                
                                if (blackColors.some(black => 
                                    typeof borderColor === 'string' && borderColor.toLowerCase().includes(black.toLowerCase())
                                )) {
                                    datasetInfo.hasBlackBorder = true;
                                    datasetInfo.issues.push(`Black border color: ${borderColor}`);
                                    chartInfo.hasBlackElements = true;
                                    analysis.blackDataElements.push({
                                        chartId: chart.canvas.id,
                                        type: 'borderColor',
                                        value: borderColor,
                                        dataset: datasetInfo.label
                                    });
                                }
                            }

                            chartInfo.datasets.push(datasetInfo);
                        });

                        analysis.chartInstances.push(chartInfo);
                        
                        if (chartInfo.hasBlackElements) {
                            analysis.colorIssues.push({
                                chartId: chart.canvas.id,
                                chartType: chart.config.type,
                                issueCount: chartInfo.datasets.filter(d => d.issues.length > 0).length,
                                details: chartInfo.datasets.filter(d => d.issues.length > 0)
                            });
                        }
                    });
                }

                return analysis;
            });

            // Take a screenshot highlighting the issues
            const screenshotPath = path.join('/home/ptyoung/work/AIRIS_APM/clickstack-architecture/tests/screenshots', `${dashboard.name}_data_colors.png`);
            await page.screenshot({ 
                path: screenshotPath,
                fullPage: true 
            });

            results.dashboards[dashboard.name] = {
                title: dashboard.title,
                url: dashboard.url,
                status: 'success',
                chartDataAnalysis: chartDataAnalysis,
                screenshotPath: screenshotPath,
                hasBlackDataElements: chartDataAnalysis.blackDataElements.length > 0,
                blackElementCount: chartDataAnalysis.blackDataElements.length
            };

            console.log(`✅ Analysis complete for ${dashboard.name}`);
            console.log(`   - Found ${chartDataAnalysis.chartInstances.length} chart instances`);
            console.log(`   - Found ${chartDataAnalysis.blackDataElements.length} black data elements`);
            
            if (chartDataAnalysis.blackDataElements.length > 0) {
                console.log(`   ⚠️  BLACK DATA ELEMENTS DETECTED!`);
                results.criticalFindings.push({
                    dashboard: dashboard.name,
                    issues: chartDataAnalysis.blackDataElements
                });
            }

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
    const reportPath = '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/tests/chart-data-color-report.json';
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📋 Chart data color analysis saved: ${reportPath}`);

    // Generate critical findings summary
    const criticalSummary = generateCriticalSummary(results);
    const criticalPath = '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/tests/CRITICAL_CHART_COLOR_ISSUES.md';
    await fs.writeFile(criticalPath, criticalSummary);
    console.log(`📋 Critical findings report saved: ${criticalPath}`);

    await browser.close();
    return results;
}

function generateCriticalSummary(results) {
    let summary = `# 🚨 CRITICAL: Chart Data Color Issues Found\n\n`;
    summary += `**Analysis Date**: ${results.timestamp}\n`;
    summary += `**Base URL**: ${results.baseUrl}\n\n`;

    const totalIssues = results.criticalFindings.reduce((sum, finding) => sum + finding.issues.length, 0);

    if (totalIssues > 0) {
        summary += `## ⚠️ CRITICAL FINDINGS: ${totalIssues} Black Data Elements Detected\n\n`;
        
        summary += `### Issue Summary\n\n`;
        let dashboardsWithIssues = 0;
        
        Object.entries(results.dashboards).forEach(([key, dashboard]) => {
            if (dashboard.hasBlackDataElements) {
                dashboardsWithIssues++;
                summary += `- **${dashboard.title}**: ${dashboard.blackElementCount} black elements\n`;
            }
        });

        summary += `\n**Total Dashboards with Issues**: ${dashboardsWithIssues}/4\n\n`;

        summary += `### Detailed Findings\n\n`;

        results.criticalFindings.forEach(finding => {
            const dashboard = results.dashboards[finding.dashboard];
            summary += `#### 🔴 ${dashboard.title}\n\n`;
            
            finding.issues.forEach((issue, index) => {
                summary += `**Issue ${index + 1}:**\n`;
                summary += `- **Chart ID**: ${issue.chartId}\n`;
                summary += `- **Color Type**: ${issue.type}\n`;
                summary += `- **Color Value**: \`${issue.value}\`\n`;
                summary += `- **Dataset**: ${issue.dataset}\n\n`;
            });
        });

        summary += `## 🔧 Required Fixes\n\n`;
        summary += `The following Chart.js configurations need immediate attention:\n\n`;
        
        results.criticalFindings.forEach(finding => {
            const dashboard = results.dashboards[finding.dashboard];
            summary += `### ${dashboard.title}\n`;
            summary += `**File**: \`${dashboard.url}\`\n\n`;
            
            finding.issues.forEach(issue => {
                summary += `**Chart**: \`${issue.chartId}\`\n`;
                summary += `\`\`\`javascript\n`;
                summary += `// CURRENT (PROBLEMATIC):\n`;
                summary += `datasets: [{\n`;
                summary += `  ${issue.type}: '${issue.value}' // ❌ BLACK COLOR\n`;
                summary += `}]\n\n`;
                summary += `// REQUIRED FIX:\n`;
                summary += `datasets: [{\n`;
                if (issue.type === 'backgroundColor') {
                    summary += `  backgroundColor: 'hsl(var(--primary))' // ✅ Theme color\n`;
                } else if (issue.type === 'borderColor') {
                    summary += `  borderColor: 'hsl(var(--primary))' // ✅ Theme color\n`;
                }
                summary += `}]\n`;
                summary += `\`\`\`\n\n`;
            });
        });

        summary += `## 🎨 Recommended shadcn/ui Theme Colors\n\n`;
        summary += `Replace black colors with appropriate shadcn/ui theme variables:\n\n`;
        summary += `- **Primary Data**: \`hsl(var(--primary))\`\n`;
        summary += `- **Secondary Data**: \`hsl(var(--secondary))\`\n`;
        summary += `- **Accent Data**: \`hsl(var(--accent))\`\n`;
        summary += `- **Muted Data**: \`hsl(var(--muted))\`\n`;
        summary += `- **Success Data**: \`hsl(var(--success))\` (if available)\n`;
        summary += `- **Warning Data**: \`hsl(var(--warning))\` (if available)\n`;
        summary += `- **Error Data**: \`hsl(var(--destructive))\`\n\n`;

    } else {
        summary += `## ✅ NO CRITICAL ISSUES FOUND\n\n`;
        summary += `All chart data elements are properly themed with shadcn/ui colors.\n\n`;
    }

    summary += `## 📊 Analysis Details\n\n`;
    Object.entries(results.dashboards).forEach(([key, dashboard]) => {
        if (dashboard.status === 'success') {
            summary += `- **${dashboard.title}**: ${dashboard.chartDataAnalysis.chartInstances.length} charts analyzed\n`;
        }
    });

    summary += `\n---\n\n`;
    summary += `*Analysis performed using Playwright + Chart.js data inspection*\n`;
    summary += `*Screenshots saved in: tests/screenshots/*\n`;

    return summary;
}

// Run the analysis
analyzeChartDataColors()
    .then((results) => {
        console.log('\n🎉 Chart data color analysis completed!');
        
        const totalIssues = results.criticalFindings.reduce((sum, finding) => sum + finding.issues.length, 0);
        
        if (totalIssues > 0) {
            console.log(`\n🚨 CRITICAL: ${totalIssues} black data elements found!`);
            console.log('📋 Check CRITICAL_CHART_COLOR_ISSUES.md for detailed fix instructions');
        } else {
            console.log('\n✅ No black data elements detected - all charts properly themed!');
        }
    })
    .catch((error) => {
        console.error('❌ Analysis failed:', error);
        process.exit(1);
    });