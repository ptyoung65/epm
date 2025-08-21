/**
 * Test script to analyze TweakCN theme functionality on AIRIS APM dashboard
 */

const fs = require('fs');
const { execSync } = require('child_process');

async function testDashboardWithPlaywright() {
    try {
        // Check if playwright is available
        try {
            const { chromium } = require('playwright');
            console.log('✅ Playwright found, launching browser...');
            
            const browser = await chromium.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();

            // Navigate to the dashboard
            console.log('📊 Navigating to AIRIS APM dashboard...');
            await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });

            // Wait for React to render and TweakCN to load
            await page.waitForTimeout(2000);

            // Take initial screenshot
            console.log('📸 Taking initial screenshot...');
            await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/dashboard-initial.png' });

            // Check if TweakCN button exists
            console.log('🔍 Looking for TweakCN theme button...');
            const themeButton = await page.locator('#tweakcn-toggle').first();
            const buttonExists = await themeButton.count() > 0;
            
            if (buttonExists) {
                console.log('✅ TweakCN theme button found!');
                
                // Click the theme button
                console.log('🖱️ Clicking TweakCN theme button...');
                await themeButton.click();
                await page.waitForTimeout(500);

                // Take screenshot with panel open
                await page.screenshot({ path: '/home/ptyoung/work/AIRIS_APM/dashboard-panel-open.png' });
                console.log('📸 Screenshot taken with theme panel open');

                // Check current CSS variables
                console.log('🎨 Checking current CSS variables...');
                const currentBgColor = await page.evaluate(() => {
                    return getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
                });
                console.log(`Current --background: "${currentBgColor}"`);

                // Try applying different themes
                const themes = ['ocean', 'forest', 'sunset', 'midnight'];
                for (const theme of themes) {
                    console.log(`🎨 Testing ${theme} theme...`);
                    
                    await page.evaluate((themeName) => {
                        if (window.TweakCNLoader) {
                            window.TweakCNLoader.applyPreset(themeName);
                        }
                    }, theme);
                    
                    await page.waitForTimeout(1000);
                    
                    // Check if background color changed
                    const newBgColor = await page.evaluate(() => {
                        return getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
                    });
                    
                    console.log(`${theme} theme --background: "${newBgColor}"`);
                    
                    // Take screenshot
                    await page.screenshot({ path: `/home/ptyoung/work/AIRIS_APM/dashboard-${theme}.png` });
                    console.log(`📸 Screenshot saved for ${theme} theme`);
                }

                // Check console messages
                console.log('📋 Checking console messages...');
                const logs = await page.evaluate(() => {
                    return window.console._logs || [];
                });

                // Get console logs with TweakCN messages
                page.on('console', msg => {
                    if (msg.text().includes('TweakCN')) {
                        console.log(`Console: ${msg.text()}`);
                    }
                });

            } else {
                console.log('❌ TweakCN theme button not found');
            }

            // Test specific functionality
            console.log('🧪 Testing TweakCN debug function...');
            await page.evaluate(() => {
                if (window.TweakCNLoader) {
                    window.TweakCNLoader.debugCurrentTheme();
                }
            });

            console.log('✅ Test completed successfully');
            await browser.close();

        } catch (playwrightError) {
            console.log('❌ Playwright not available:', playwrightError.message);
            console.log('📦 Attempting to install playwright...');
            
            try {
                execSync('npm install playwright', { stdio: 'inherit' });
                console.log('✅ Playwright installed, please run the script again');
            } catch (installError) {
                console.log('❌ Failed to install Playwright:', installError.message);
                return false;
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error testing dashboard:', error);
        return false;
    }
}

async function analyzeHTMLStructure() {
    console.log('\n🔍 Analyzing HTML structure...');
    
    try {
        const response = await fetch('http://localhost:3002/');
        const html = await response.text();
        
        // Check for TweakCN references
        const tweakcnReferences = html.match(/tweakcn|TweakCN/gi) || [];
        console.log(`Found ${tweakcnReferences.length} TweakCN references in HTML`);
        
        // Check for CSS variables
        const cssVariables = html.match(/--[a-zA-Z-]+:/g) || [];
        console.log(`Found ${cssVariables.length} CSS variables defined`);
        
        // Check for React
        const hasReact = html.includes('react') || html.includes('React');
        console.log(`React detected: ${hasReact}`);
        
        return true;
    } catch (error) {
        console.error('❌ Error analyzing HTML:', error);
        return false;
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting TweakCN Theme Analysis for AIRIS APM Dashboard\n');
    
    // First check if dashboard is running
    try {
        const response = await fetch('http://localhost:3002/');
        if (response.ok) {
            console.log('✅ AIRIS APM Dashboard is running at http://localhost:3002/');
        } else {
            throw new Error('Dashboard not accessible');
        }
    } catch (error) {
        console.error('❌ Dashboard not accessible. Please ensure it\'s running with: ./scripts/start-all.sh');
        return;
    }
    
    // Analyze structure first
    await analyzeHTMLStructure();
    
    // Then test with browser if possible
    await testDashboardWithPlaywright();
    
    console.log('\n📋 Analysis Summary:');
    console.log('- TweakCN theme system is loaded via /js/tweakcn-loader.js');
    console.log('- Multiple theme presets available: default, ocean, forest, sunset, midnight');
    console.log('- Theme button should appear in bottom-left corner');
    console.log('- Use Ctrl+Shift+T to toggle theme panel');
    console.log('- Screenshots saved in project directory if browser testing worked');
}

// For Node.js versions that don't have fetch
if (typeof fetch === 'undefined') {
    global.fetch = require('https').get;
}

main().catch(console.error);