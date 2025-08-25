const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testOntologyViewer() {
    const browser = await chromium.launch({
        headless: true, // Use headless mode for CI/server environment
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Additional args for server environment
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Set up console message monitoring
    const consoleMessages = [];
    page.on('console', msg => {
        consoleMessages.push({
            type: msg.type(),
            text: msg.text(),
            timestamp: new Date().toISOString()
        });
        console.log(`Console ${msg.type()}: ${msg.text()}`);
    });
    
    // Set up error monitoring
    const pageErrors = [];
    page.on('pageerror', error => {
        pageErrors.push({
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        console.log(`Page Error: ${error.message}`);
    });
    
    const report = {
        timestamp: new Date().toISOString(),
        tests: [],
        consoleMessages: [],
        errors: [],
        screenshots: []
    };
    
    try {
        console.log('🚀 Starting Ontology Viewer Test...');
        
        // Test 1: Navigate to the page
        console.log('📍 Test 1: Navigating to ontology viewer...');
        await page.goto('http://localhost:3002/ontology-viewer.html', { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        // Wait for the page to fully load
        await page.waitForTimeout(3000);
        
        // Take initial screenshot
        const screenshotPath1 = `/home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/screenshots/01-initial-load.png`;
        await page.screenshot({ path: screenshotPath1, fullPage: true });
        report.screenshots.push('01-initial-load.png');
        console.log('✅ Successfully navigated to ontology viewer');
        
        report.tests.push({
            test: 'Page Navigation',
            status: 'PASSED',
            details: 'Successfully loaded ontology viewer page'
        });
        
        // Test 2: Check if tabs are visible and clickable
        console.log('📍 Test 2: Checking tab visibility...');
        const tabs = await page.locator('.tab-button').all();
        const tabNames = [];
        for (const tab of tabs) {
            const text = await tab.textContent();
            tabNames.push(text.trim());
        }
        
        console.log(`Found tabs: ${tabNames.join(', ')}`);
        report.tests.push({
            test: 'Tab Visibility',
            status: tabNames.length >= 3 ? 'PASSED' : 'FAILED',
            details: `Found ${tabNames.length} tabs: ${tabNames.join(', ')}`
        });
        
        // Test 3: Test Graph Tab (D3.js visualization)
        console.log('📍 Test 3: Testing Graph Tab...');
        const graphTab = page.locator('#tabGraph');
        if (await graphTab.count() > 0) {
            await graphTab.click();
            await page.waitForTimeout(3000); // Allow more time for D3 to render
            
            // Check if D3.js graph is rendered in the correct container
            const graphContainer = page.locator('#ontologyGraph');
            const svgElements = await graphContainer.locator('svg').count();
            const graphNodes = await graphContainer.locator('circle, .node').count();
            const graphLinks = await graphContainer.locator('line, path').count();
            
            // Also check for D3 force simulation elements
            const gElements = await graphContainer.locator('g').count();
            
            // Take screenshot of graph
            const screenshotPath2 = `/home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/screenshots/02-graph-tab.png`;
            await page.screenshot({ path: screenshotPath2, fullPage: true });
            report.screenshots.push('02-graph-tab.png');
            
            // Check if graph container has content
            const hasGraphContent = svgElements > 0 || gElements > 0;
            const graphStatus = hasGraphContent ? 'PASSED' : 'FAILED';
            console.log(`Graph rendering: SVG: ${svgElements}, G elements: ${gElements}, Nodes: ${graphNodes}, Links: ${graphLinks}`);
            
            report.tests.push({
                test: 'D3.js Graph Rendering',
                status: graphStatus,
                details: `SVG elements: ${svgElements}, G elements: ${gElements}, Graph nodes: ${graphNodes}, Graph links: ${graphLinks}`
            });
        } else {
            report.tests.push({
                test: 'Graph Tab',
                status: 'FAILED',
                details: 'Graph tab not found'
            });
        }
        
        // Test 4: Test Knowledge Base Tab (Left-Right Layout)
        console.log('📍 Test 4: Testing Knowledge Base Tab...');
        const knowledgeTab = page.locator('#tabKnowledge');
        if (await knowledgeTab.count() > 0) {
            await knowledgeTab.click();
            await page.waitForTimeout(2000);
            
            // Check for left-right layout elements based on actual HTML structure
            const leftPanel = page.locator('.lg\\:col-span-4'); // Category list panel
            const rightPanel = page.locator('.lg\\:col-span-8'); // Knowledge content panel
            const knowledgeContent = page.locator('#knowledgeContent');
            const categories = await page.locator('.knowledge-category').count();
            
            const leftPanelVisible = await leftPanel.isVisible().catch(() => false);
            const rightPanelVisible = await rightPanel.isVisible().catch(() => false);
            const knowledgeContentVisible = await knowledgeContent.isVisible().catch(() => false);
            
            // Take screenshot of knowledge base
            const screenshotPath3 = `/home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/screenshots/03-knowledge-base-tab.png`;
            await page.screenshot({ path: screenshotPath3, fullPage: true });
            report.screenshots.push('03-knowledge-base-tab.png');
            
            console.log(`Knowledge Base: Left panel: ${leftPanelVisible}, Right panel: ${rightPanelVisible}, Content: ${knowledgeContentVisible}, Categories: ${categories}`);
            
            report.tests.push({
                test: 'Knowledge Base Layout',
                status: leftPanelVisible && rightPanelVisible && knowledgeContentVisible ? 'PASSED' : 'FAILED',
                details: `Left panel: ${leftPanelVisible}, Right panel: ${rightPanelVisible}, Content panel: ${knowledgeContentVisible}, Categories found: ${categories}`
            });
            
            // Test 5: Test Category Interaction
            if (categories > 0) {
                console.log('📍 Test 5: Testing Category Interaction...');
                const firstCategory = page.locator('.knowledge-category').first();
                const initialContent = await knowledgeContent.textContent().catch(() => '');
                
                await firstCategory.click();
                await page.waitForTimeout(1500);
                
                const updatedContent = await knowledgeContent.textContent().catch(() => '');
                const contentChanged = initialContent !== updatedContent && updatedContent.length > initialContent.length;
                
                // Take screenshot after category click
                const screenshotPath4 = `/home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/screenshots/04-category-clicked.png`;
                await page.screenshot({ path: screenshotPath4, fullPage: true });
                report.screenshots.push('04-category-clicked.png');
                
                console.log(`Category interaction: Content changed: ${contentChanged}, Initial length: ${initialContent.length}, Updated length: ${updatedContent.length}`);
                
                report.tests.push({
                    test: 'Category Interaction',
                    status: contentChanged ? 'PASSED' : 'FAILED',
                    details: `Content updated after category click: ${contentChanged}`
                });
            }
        } else {
            report.tests.push({
                test: 'Knowledge Base Tab',
                status: 'FAILED',
                details: 'Knowledge Base tab not found'
            });
        }
        
        // Test 6: Test Structure Tab (Tree Structure)
        console.log('📍 Test 6: Testing Structure Tab...');
        const structureTab = page.locator('#tabStructure');
        if (await structureTab.count() > 0) {
            await structureTab.click();
            await page.waitForTimeout(3000); // Allow time for tree to render
            
            // Check for tree structure elements based on actual HTML
            const treeContainer = page.locator('#ontologyTree');
            const statisticsCards = page.locator('.rounded-lg.border.bg-card');
            const nodeCountEl = page.locator('#nodeCount');
            const relationCountEl = page.locator('#relationCount');
            
            const treeVisible = await treeContainer.isVisible().catch(() => false);
            const treeContent = await treeContainer.textContent().catch(() => '');
            const hasTreeContent = treeContent.length > 50; // Has meaningful content
            const statsVisible = await statisticsCards.first().isVisible().catch(() => false);
            
            // Check if statistics are populated
            const nodeCount = await nodeCountEl.textContent().catch(() => '0');
            const relationCount = await relationCountEl.textContent().catch(() => '0');
            
            // Take screenshot of structure tab
            const screenshotPath5 = `/home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/screenshots/05-structure-tab.png`;
            await page.screenshot({ path: screenshotPath5, fullPage: true });
            report.screenshots.push('05-structure-tab.png');
            
            console.log(`Structure: Tree visible: ${treeVisible}, Has content: ${hasTreeContent}, Stats visible: ${statsVisible}, Nodes: ${nodeCount}, Relations: ${relationCount}`);
            
            const structureStatus = treeVisible && (hasTreeContent || statsVisible) ? 'PASSED' : 'FAILED';
            report.tests.push({
                test: 'Tree Structure',
                status: structureStatus,
                details: `Tree container visible: ${treeVisible}, Has content: ${hasTreeContent}, Statistics visible: ${statsVisible}, Node count: ${nodeCount}, Relation count: ${relationCount}`
            });
        } else {
            report.tests.push({
                test: 'Structure Tab',
                status: 'FAILED',
                details: 'Structure tab not found'
            });
        }
        
        // Test 7: Check for JavaScript errors and warnings
        console.log('📍 Test 7: Analyzing Console Messages...');
        
        // Collect final console messages and errors
        report.consoleMessages = consoleMessages;
        report.errors = pageErrors;
        
        const errorCount = consoleMessages.filter(msg => msg.type === 'error').length;
        const warningCount = consoleMessages.filter(msg => msg.type === 'warning').length;
        
        console.log(`Console Analysis: ${errorCount} errors, ${warningCount} warnings, ${pageErrors.length} page errors`);
        
        report.tests.push({
            test: 'Console Health',
            status: errorCount === 0 && pageErrors.length === 0 ? 'PASSED' : errorCount > 5 ? 'FAILED' : 'WARNING',
            details: `${errorCount} console errors, ${warningCount} warnings, ${pageErrors.length} page errors`
        });
        
        // Generate final summary
        const passedTests = report.tests.filter(t => t.status === 'PASSED').length;
        const failedTests = report.tests.filter(t => t.status === 'FAILED').length;
        const warningTests = report.tests.filter(t => t.status === 'WARNING').length;
        
        report.summary = {
            total: report.tests.length,
            passed: passedTests,
            failed: failedTests,
            warnings: warningTests,
            successRate: `${Math.round((passedTests / report.tests.length) * 100)}%`
        };
        
        console.log('\n🎯 TEST SUMMARY:');
        console.log(`Total Tests: ${report.summary.total}`);
        console.log(`✅ Passed: ${report.summary.passed}`);
        console.log(`❌ Failed: ${report.summary.failed}`);
        console.log(`⚠️ Warnings: ${report.summary.warnings}`);
        console.log(`Success Rate: ${report.summary.successRate}`);
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        report.tests.push({
            test: 'Test Execution',
            status: 'FAILED',
            details: `Test execution error: ${error.message}`
        });
    } finally {
        await browser.close();
    }
    
    // Save detailed report
    const reportPath = `/home/ptyoung/work/AIRIS_APM/clickstack-architecture/ui/korean-hyperdx-dashboard/ontology-test-report.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Detailed report saved to: ${reportPath}`);
    
    return report;
}

// Run the test
testOntologyViewer().then(report => {
    console.log('\n🏁 Test completed successfully!');
    process.exit(report.summary.failed > 0 ? 1 : 0);
}).catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
});