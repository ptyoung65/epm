const { chromium } = require('playwright');

async function quickFixAnalysis() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log('🔍 Quick Fix Analysis for Ontology Viewer');
    console.log('='.repeat(50));
    
    try {
        await page.goto('http://localhost:3002/ontology-viewer.html', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        // 1. Check D3 Graph Issues
        console.log('\n📊 D3.js Graph Analysis:');
        await page.click('#tabGraph');
        await page.waitForTimeout(2000);
        
        const graphSVG = await page.locator('#ontologyGraph svg').first();
        const svgHTML = await graphSVG.innerHTML().catch(() => '');
        const hasNodes = svgHTML.includes('circle') || svgHTML.includes('node');
        const hasLinks = svgHTML.includes('line') || svgHTML.includes('path');
        
        console.log(`  SVG Content Length: ${svgHTML.length} chars`);
        console.log(`  Has Nodes: ${hasNodes}`);
        console.log(`  Has Links: ${hasLinks}`);
        console.log(`  SVG Dimensions:`, await graphSVG.evaluate(el => ({ 
            width: el.getAttribute('width'), 
            height: el.getAttribute('height'),
            viewBox: el.getAttribute('viewBox')
        })).catch(() => 'N/A'));
        
        // 2. Check Knowledge Base Content Update
        console.log('\n📚 Knowledge Base Analysis:');
        await page.click('#tabKnowledge');
        await page.waitForTimeout(1000);
        
        const initialContent = await page.locator('#knowledgeContent').textContent();
        console.log(`  Initial Content Length: ${initialContent.length} chars`);
        
        // Click first category
        await page.click('.knowledge-category[data-category="basic"]');
        await page.waitForTimeout(1000);
        
        const updatedContent = await page.locator('#knowledgeContent').textContent();
        console.log(`  Updated Content Length: ${updatedContent.length} chars`);
        console.log(`  Content Changed: ${initialContent !== updatedContent}`);
        
        // Check if content is actually different
        const contentSample = updatedContent.substring(0, 100);
        console.log(`  Content Sample: "${contentSample.replace(/\s+/g, ' ').trim()}..."`);
        
        // 3. Check Tree Structure Issues
        console.log('\n🌲 Tree Structure Analysis:');
        await page.click('#tabStructure');
        await page.waitForTimeout(2000);
        
        const treeContainer = page.locator('#ontologyTree');
        const treeVisible = await treeContainer.isVisible();
        const treeHTML = await treeContainer.innerHTML();
        const treeCSS = await treeContainer.evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
                display: styles.display,
                visibility: styles.visibility,
                height: styles.height,
                overflow: styles.overflow
            };
        });
        
        console.log(`  Tree Visible: ${treeVisible}`);
        console.log(`  Tree HTML Length: ${treeHTML.length} chars`);
        console.log(`  Tree CSS:`, treeCSS);
        console.log(`  Tree Content Sample: "${treeHTML.substring(0, 150).replace(/\s+/g, ' ').trim()}..."`);
        
        // 4. Check Statistics
        const nodeCount = await page.locator('#nodeCount').textContent();
        const relationCount = await page.locator('#relationCount').textContent();
        console.log(`  Statistics - Nodes: ${nodeCount}, Relations: ${relationCount}`);
        
        // 5. Quick CSS/JS Debug
        console.log('\n🐛 Debug Information:');
        const errors = await page.evaluate(() => {
            const issues = [];
            
            // Check if D3 is loaded
            if (typeof d3 === 'undefined') issues.push('D3.js not loaded');
            
            // Check graph container
            const graphContainer = document.getElementById('ontologyGraph');
            if (graphContainer) {
                const svg = graphContainer.querySelector('svg');
                if (svg) {
                    const rect = svg.getBoundingClientRect();
                    issues.push(`SVG dimensions: ${rect.width}x${rect.height}`);
                    
                    // Check for nodes
                    const nodes = svg.querySelectorAll('circle, .node');
                    const links = svg.querySelectorAll('line, path');
                    issues.push(`SVG elements: ${nodes.length} nodes, ${links.length} links`);
                }
            }
            
            // Check tree content
            const treeContainer = document.getElementById('ontologyTree');
            if (treeContainer && treeContainer.innerHTML.trim()) {
                issues.push(`Tree has ${treeContainer.children.length} direct children`);
            }
            
            return issues;
        });
        
        errors.forEach(issue => console.log(`  • ${issue}`));
        
        console.log('\n✅ Analysis Complete');
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    } finally {
        await browser.close();
    }
}

quickFixAnalysis();