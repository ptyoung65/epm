const { chromium } = require('playwright');

async function inspectWaterfallPadding() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        console.log('🚀 Playwright를 사용하여 span waterfall chart 패딩 검사 시작...\n');

        // 페이지 접속
        console.log('1. 페이지 접속 중...');
        await page.goto('http://localhost:3100/trace-analysis-dashboard.html', { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
        });
        
        // 페이지가 로드될 때까지 대기
        await page.waitForTimeout(3000);

        // 오른쪽 span detail panel 확인
        console.log('\n2. 오른쪽 span detail panel 검사...');
        const spanDetailPanel = await page.locator('.span-detail-panel').first();
        
        if (await spanDetailPanel.isVisible()) {
            const panelBox = await spanDetailPanel.boundingBox();
            const panelStyles = await spanDetailPanel.evaluate(el => {
                const computed = window.getComputedStyle(el);
                return {
                    paddingLeft: computed.paddingLeft,
                    paddingRight: computed.paddingRight,
                    marginLeft: computed.marginLeft,
                    marginRight: computed.marginRight,
                    width: computed.width,
                    position: computed.position,
                    left: computed.left,
                    right: computed.right
                };
            });
            
            console.log('   📊 Span Detail Panel 속성:');
            console.log(`   - 위치: x=${panelBox?.x}, y=${panelBox?.y}`);
            console.log(`   - 크기: width=${panelBox?.width}, height=${panelBox?.height}`);
            console.log(`   - Padding Left: ${panelStyles.paddingLeft}`);
            console.log(`   - Padding Right: ${panelStyles.paddingRight}`);
            console.log(`   - Margin Left: ${panelStyles.marginLeft}`);
            console.log(`   - Margin Right: ${panelStyles.marginRight}`);
            console.log(`   - Width: ${panelStyles.width}`);
            console.log(`   - Position: ${panelStyles.position}`);
        } else {
            console.log('   ❌ .span-detail-panel을 찾을 수 없습니다.');
        }

        // waterfall container 확인
        console.log('\n3. Waterfall Container 검사...');
        const waterfallContainer = await page.locator('.waterfall-container').first();
        
        // 먼저 차트를 클릭하여 trace 데이터를 로드
        try {
            console.log('   🎯 성능 차트 클릭 시도...');
            // canvas를 찾아서 클릭
            const canvas = await page.locator('canvas').first();
            if (await canvas.isVisible()) {
                const canvasBox = await canvas.boundingBox();
                // 차트의 중앙 부분을 클릭
                await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
                await page.waitForTimeout(1000);
                console.log('   ✅ 성능 차트 클릭됨');
                
                // trace 항목이 생성될 때까지 대기
                await page.waitForTimeout(2000);
                
                // 첫 번째 trace 항목 클릭
                const traceItem = await page.locator('.trace-item').first();
                if (await traceItem.isVisible()) {
                    await traceItem.click();
                    await page.waitForTimeout(1000);
                    console.log('   ✅ 첫 번째 trace 항목 클릭됨');
                } else {
                    console.log('   ⚠️ trace 항목을 찾을 수 없음');
                }
            } else {
                console.log('   ⚠️ 성능 차트 canvas를 찾을 수 없음');
            }
        } catch (e) {
            console.log('   ⚠️ 차트 클릭 중 오류:', e.message);
        }
        
        if (await waterfallContainer.isVisible()) {
            const containerBox = await waterfallContainer.boundingBox();
            const containerStyles = await waterfallContainer.evaluate(el => {
                const computed = window.getComputedStyle(el);
                return {
                    paddingLeft: computed.paddingLeft,
                    paddingRight: computed.paddingRight,
                    marginLeft: computed.marginLeft,
                    marginRight: computed.marginRight,
                    width: computed.width,
                    overflow: computed.overflow,
                    overflowX: computed.overflowX,
                    position: computed.position
                };
            });
            
            console.log('   📊 Waterfall Container 속성:');
            console.log(`   - 위치: x=${containerBox?.x}, y=${containerBox?.y}`);
            console.log(`   - 크기: width=${containerBox?.width}, height=${containerBox?.height}`);
            console.log(`   - Padding Left: ${containerStyles.paddingLeft}`);
            console.log(`   - Padding Right: ${containerStyles.paddingRight}`);
            console.log(`   - Margin Left: ${containerStyles.marginLeft}`);
            console.log(`   - Margin Right: ${containerStyles.marginRight}`);
            console.log(`   - Width: ${containerStyles.width}`);
            console.log(`   - Overflow: ${containerStyles.overflow}`);
            console.log(`   - Overflow-X: ${containerStyles.overflowX}`);
        } else {
            console.log('   ❌ .waterfall-container를 찾을 수 없습니다.');
        }

        // waterfall-labels 영역 확인 (헤더)
        console.log('\n4. Waterfall Labels (헤더) 영역 검사...');
        const waterfallLabels = await page.locator('.waterfall-labels').first();
        
        if (await waterfallLabels.isVisible()) {
            const labelsBox = await waterfallLabels.boundingBox();
            const labelsStyles = await waterfallLabels.evaluate(el => {
                const computed = window.getComputedStyle(el);
                return {
                    paddingLeft: computed.paddingLeft,
                    paddingRight: computed.paddingRight,
                    marginLeft: computed.marginLeft,
                    marginRight: computed.marginRight,
                    width: computed.width,
                    minWidth: computed.minWidth,
                    maxWidth: computed.maxWidth,
                    position: computed.position,
                    float: computed.float,
                    display: computed.display
                };
            });
            
            console.log('   📊 Waterfall Labels 속성:');
            console.log(`   - 위치: x=${labelsBox?.x}, y=${labelsBox?.y}`);
            console.log(`   - 크기: width=${labelsBox?.width}, height=${labelsBox?.height}`);
            console.log(`   - Padding Left: ${labelsStyles.paddingLeft}`);
            console.log(`   - Padding Right: ${labelsStyles.paddingRight}`);
            console.log(`   - Margin Left: ${labelsStyles.marginLeft}`);
            console.log(`   - Margin Right: ${labelsStyles.marginRight}`);
            console.log(`   - Width: ${labelsStyles.width}`);
            console.log(`   - Min Width: ${labelsStyles.minWidth}`);
            console.log(`   - Max Width: ${labelsStyles.maxWidth}`);
            console.log(`   - Display: ${labelsStyles.display}`);
        } else {
            console.log('   ❌ .waterfall-labels를 찾을 수 없습니다.');
        }

        // span-labels 영역 확인 (개별 행)
        console.log('\n5. Span Labels (개별 행) 영역 검사...');
        const spanLabels = await page.locator('.span-labels').first();
        
        if (await spanLabels.isVisible()) {
            const labelsBox = await spanLabels.boundingBox();
            const labelsStyles = await spanLabels.evaluate(el => {
                const computed = window.getComputedStyle(el);
                return {
                    paddingLeft: computed.paddingLeft,
                    paddingRight: computed.paddingRight,
                    marginLeft: computed.marginLeft,
                    marginRight: computed.marginRight,
                    width: computed.width,
                    minWidth: computed.minWidth,
                    maxWidth: computed.maxWidth,
                    position: computed.position,
                    float: computed.float,
                    display: computed.display
                };
            });
            
            console.log('   📊 Span Labels 속성:');
            console.log(`   - 위치: x=${labelsBox?.x}, y=${labelsBox?.y}`);
            console.log(`   - 크기: width=${labelsBox?.width}, height=${labelsBox?.height}`);
            console.log(`   - Padding Left: ${labelsStyles.paddingLeft}`);
            console.log(`   - Padding Right: ${labelsStyles.paddingRight}`);
            console.log(`   - Margin Left: ${labelsStyles.marginLeft}`);
            console.log(`   - Margin Right: ${labelsStyles.marginRight}`);
            console.log(`   - Width: ${labelsStyles.width}`);
            console.log(`   - Min Width: ${labelsStyles.minWidth}`);
            console.log(`   - Max Width: ${labelsStyles.maxWidth}`);
            console.log(`   - Display: ${labelsStyles.display}`);
        } else {
            console.log('   ❌ .span-labels를 찾을 수 없습니다.');
        }

        // waterfall-timeline 영역 확인 (헤더)
        console.log('\n6. Waterfall Timeline (헤더) 영역 검사...');
        const waterfallTimeline = await page.locator('.waterfall-timeline').first();
        
        if (await waterfallTimeline.isVisible()) {
            const timelineBox = await waterfallTimeline.boundingBox();
            const timelineStyles = await waterfallTimeline.evaluate(el => {
                const computed = window.getComputedStyle(el);
                return {
                    paddingLeft: computed.paddingLeft,
                    paddingRight: computed.paddingRight,
                    marginLeft: computed.marginLeft,
                    marginRight: computed.marginRight,
                    width: computed.width,
                    position: computed.position,
                    left: computed.left,
                    transform: computed.transform,
                    display: computed.display
                };
            });
            
            console.log('   📊 Waterfall Timeline 속성:');
            console.log(`   - 위치: x=${timelineBox?.x}, y=${timelineBox?.y}`);
            console.log(`   - 크기: width=${timelineBox?.width}, height=${timelineBox?.height}`);
            console.log(`   - Padding Left: ${timelineStyles.paddingLeft}`);
            console.log(`   - Padding Right: ${timelineStyles.paddingRight}`);
            console.log(`   - Margin Left: ${timelineStyles.marginLeft}`);
            console.log(`   - Margin Right: ${timelineStyles.marginRight}`);
            console.log(`   - Width: ${timelineStyles.width}`);
            console.log(`   - Position: ${timelineStyles.position}`);
            console.log(`   - Left: ${timelineStyles.left}`);
            console.log(`   - Transform: ${timelineStyles.transform}`);
        } else {
            console.log('   ❌ .waterfall-timeline을 찾을 수 없습니다.');
        }

        // span-timeline 영역 확인 (개별 행)
        console.log('\n7. Span Timeline (개별 행) 영역 검사...');
        const spanTimeline = await page.locator('.span-timeline').first();
        
        if (await spanTimeline.isVisible()) {
            const timelineBox = await spanTimeline.boundingBox();
            const timelineStyles = await spanTimeline.evaluate(el => {
                const computed = window.getComputedStyle(el);
                return {
                    paddingLeft: computed.paddingLeft,
                    paddingRight: computed.paddingRight,
                    marginLeft: computed.marginLeft,
                    marginRight: computed.marginRight,
                    width: computed.width,
                    position: computed.position,
                    left: computed.left,
                    transform: computed.transform,
                    display: computed.display
                };
            });
            
            console.log('   📊 Span Timeline 속성:');
            console.log(`   - 위치: x=${timelineBox?.x}, y=${timelineBox?.y}`);
            console.log(`   - 크기: width=${timelineBox?.width}, height=${timelineBox?.height}`);
            console.log(`   - Padding Left: ${timelineStyles.paddingLeft}`);
            console.log(`   - Padding Right: ${timelineStyles.paddingRight}`);
            console.log(`   - Margin Left: ${timelineStyles.marginLeft}`);
            console.log(`   - Margin Right: ${timelineStyles.marginRight}`);
            console.log(`   - Width: ${timelineStyles.width}`);
            console.log(`   - Position: ${timelineStyles.position}`);
            console.log(`   - Left: ${timelineStyles.left}`);
            console.log(`   - Transform: ${timelineStyles.transform}`);
        } else {
            console.log('   ❌ .span-timeline을 찾을 수 없습니다.');
        }

        // waterfall-row 항목 확인
        console.log('\n8. Waterfall Row 항목들 검사...');
        const waterfallRows = await page.locator('.waterfall-row').all();
        
        if (waterfallRows.length > 0) {
            console.log(`   📋 총 ${waterfallRows.length}개의 waterfall row 발견`);
            
            for (let i = 0; i < Math.min(3, waterfallRows.length); i++) {
                const waterfallRow = waterfallRows[i];
                const itemBox = await waterfallRow.boundingBox();
                const itemStyles = await waterfallRow.evaluate(el => {
                    const computed = window.getComputedStyle(el);
                    return {
                        paddingLeft: computed.paddingLeft,
                        marginLeft: computed.marginLeft,
                        position: computed.position,
                        left: computed.left,
                        transform: computed.transform,
                        display: computed.display
                    };
                });
                
                console.log(`   📊 Waterfall Row ${i + 1}:`);
                console.log(`   - 위치: x=${itemBox?.x}, y=${itemBox?.y}`);
                console.log(`   - 크기: width=${itemBox?.width}, height=${itemBox?.height}`);
                console.log(`   - Padding Left: ${itemStyles.paddingLeft}`);
                console.log(`   - Margin Left: ${itemStyles.marginLeft}`);
                console.log(`   - Position: ${itemStyles.position}`);
                console.log(`   - Left: ${itemStyles.left}`);
                console.log(`   - Transform: ${itemStyles.transform}`);
                console.log(`   - Display: ${itemStyles.display}`);
            }
        } else {
            console.log('   ❌ waterfall row를 찾을 수 없습니다.');
        }

        // 전체 레이아웃 분석
        console.log('\n9. 전체 레이아웃 분석...');
        const bodyWidth = await page.evaluate(() => document.body.clientWidth);
        const windowWidth = await page.evaluate(() => window.innerWidth);
        
        console.log(`   📏 Body Width: ${bodyWidth}px`);
        console.log(`   📏 Window Width: ${windowWidth}px`);

        // 왼쪽 패딩 문제 분석
        console.log('\n🔍 패딩 문제 분석 결과:');
        
        // 페이지의 실제 HTML 구조 확인
        const htmlStructure = await page.evaluate(() => {
            const spanDetailPanel = document.querySelector('.span-detail-panel');
            if (spanDetailPanel) {
                return {
                    innerHTML: spanDetailPanel.innerHTML.substring(0, 500) + '...',
                    classList: Array.from(spanDetailPanel.classList),
                    childElements: Array.from(spanDetailPanel.children).map(child => ({
                        tagName: child.tagName,
                        classList: Array.from(child.classList),
                        id: child.id
                    }))
                };
            }
            return null;
        });

        if (htmlStructure) {
            console.log('   📋 HTML 구조:');
            console.log(`   - 클래스: ${htmlStructure.classList.join(', ')}`);
            console.log(`   - 자식 요소들:`);
            htmlStructure.childElements.forEach((child, idx) => {
                console.log(`     ${idx + 1}. ${child.tagName} (${child.classList.join(', ')}) ${child.id ? `#${child.id}` : ''}`);
            });
        }

        // 스크린샷 촬영
        await page.screenshot({ 
            path: '/home/ptyoung/work/airis-mon/clickstack-architecture/test-suite/tests/waterfall-padding-issue.png',
            fullPage: true 
        });
        console.log('\n📸 스크린샷 저장됨: tests/waterfall-padding-issue.png');

        // 5초 대기 (수동 검사를 위해)
        console.log('\n⏱️  5초 대기 중... (수동 검사 가능)');
        await page.waitForTimeout(5000);

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
    } finally {
        await browser.close();
    }
}

// 실행
inspectWaterfallPadding();