const { chromium } = require('playwright');

async function validateCSSVariables() {
    const browser = await chromium.launch({ headless: false, slowMo: 1000 });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    console.log('🔍 Validating CSS Variable Resolution...');

    try {
        await page.goto('http://localhost:3001/j2ee-dashboard.html', { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });

        // Wait for page to load
        await page.waitForTimeout(3000);

        // Check CSS variable resolution
        const cssVariableCheck = await page.evaluate(() => {
            const rootStyles = getComputedStyle(document.documentElement);
            
            return {
                primaryRaw: rootStyles.getPropertyValue('--primary'),
                primaryResolved: getComputedStyle(document.documentElement).getPropertyValue('--primary'),
                primaryHSL: `hsl(${rootStyles.getPropertyValue('--primary')})`,
                
                // Test element creation to see resolved colors
                testElement: (() => {
                    const testDiv = document.createElement('div');
                    testDiv.style.backgroundColor = 'hsl(var(--primary))';
                    testDiv.style.color = 'hsl(var(--primary))';
                    document.body.appendChild(testDiv);
                    
                    const computedStyle = getComputedStyle(testDiv);
                    const result = {
                        backgroundColor: computedStyle.backgroundColor,
                        color: computedStyle.color,
                        backgroundColorRGB: computedStyle.backgroundColor,
                        colorRGB: computedStyle.color
                    };
                    
                    document.body.removeChild(testDiv);
                    return result;
                })(),

                // Check if CSS variables are defined
                allCSSVariables: (() => {
                    const variables = {};
                    const allRules = Array.from(document.styleSheets)
                        .flatMap(sheet => {
                            try {
                                return Array.from(sheet.cssRules || sheet.rules || []);
                            } catch (e) {
                                return [];
                            }
                        });
                    
                    allRules.forEach(rule => {
                        if (rule.style) {
                            for (let i = 0; i < rule.style.length; i++) {
                                const prop = rule.style[i];
                                if (prop.startsWith('--')) {
                                    variables[prop] = rule.style.getPropertyValue(prop);
                                }
                            }
                        }
                    });
                    
                    return variables;
                })(),

                // Chart canvas inspection
                chartCanvases: Array.from(document.querySelectorAll('canvas')).map(canvas => {
                    return {
                        id: canvas.id,
                        width: canvas.width,
                        height: canvas.height,
                        computedStyle: {
                            backgroundColor: getComputedStyle(canvas).backgroundColor,
                            borderColor: getComputedStyle(canvas).borderColor
                        }
                    };
                })
            };
        });

        console.log('\n📊 CSS Variable Resolution Results:');
        console.log('Primary Variable Raw:', cssVariableCheck.primaryRaw);
        console.log('Primary HSL String:', cssVariableCheck.primaryHSL);
        console.log('Test Element Background:', cssVariableCheck.testElement.backgroundColor);
        console.log('Test Element Color:', cssVariableCheck.testElement.color);

        console.log('\n🎨 All CSS Variables Found:');
        Object.entries(cssVariableCheck.allCSSVariables).forEach(([key, value]) => {
            if (key.includes('primary') || key.includes('secondary') || key.includes('accent')) {
                console.log(`  ${key}: ${value}`);
            }
        });

        console.log('\n🖼️ Chart Canvas Inspection:');
        cssVariableCheck.chartCanvases.forEach(canvas => {
            console.log(`  Canvas ${canvas.id}: ${canvas.width}x${canvas.height}`);
            console.log(`    Background: ${canvas.computedStyle.backgroundColor}`);
            console.log(`    Border: ${canvas.computedStyle.borderColor}`);
        });

        // Take screenshot showing browser developer tools
        await page.screenshot({ 
            path: '/home/ptyoung/work/AIRIS_APM/clickstack-architecture/tests/screenshots/css-variable-validation.png',
            fullPage: true 
        });

        await browser.close();
        return cssVariableCheck;

    } catch (error) {
        console.error('❌ Error validating CSS variables:', error);
        await browser.close();
        throw error;
    }
}

validateCSSVariables()
    .then((result) => {
        console.log('\n✅ CSS Variable validation completed!');
        
        // Analyze if primary color is too dark
        const testBg = result.testElement.backgroundColor;
        if (testBg.includes('rgb(0, 0, 0)') || testBg.includes('rgba(0, 0, 0')) {
            console.log('🚨 ISSUE: Primary color resolves to black!');
        } else {
            console.log('✅ Primary color resolves correctly:', testBg);
        }
    })
    .catch((error) => {
        console.error('❌ Validation failed:', error);
        process.exit(1);
    });