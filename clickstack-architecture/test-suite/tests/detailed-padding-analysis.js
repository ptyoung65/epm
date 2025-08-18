const { chromium } = require('playwright');

async function detailedPaddingAnalysis() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        console.log('🔍 상세한 waterfall chart 패딩 분석 시작...\n');

        // 페이지 접속 및 데이터 로드
        await page.goto('http://localhost:3100/trace-analysis-dashboard.html', { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
        });
        await page.waitForTimeout(3000);

        // 차트 클릭하여 데이터 로드
        const canvas = await page.locator('canvas').first();
        if (await canvas.isVisible()) {
            const canvasBox = await canvas.boundingBox();
            await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
            await page.waitForTimeout(2000);
            
            const traceItem = await page.locator('.trace-item').first();
            if (await traceItem.isVisible()) {
                await traceItem.click();
                await page.waitForTimeout(1000);
            }
        }

        console.log('📊 상세 레이아웃 분석...\n');

        // 1. span-detail-panel의 내부 패딩 확인
        const panelAnalysis = await page.evaluate(() => {
            const panel = document.querySelector('.span-detail-panel');
            if (!panel) return null;
            
            const computed = window.getComputedStyle(panel);
            const rect = panel.getBoundingClientRect();
            
            return {
                element: 'span-detail-panel',
                position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                padding: {
                    left: computed.paddingLeft,
                    right: computed.paddingRight,
                    top: computed.paddingTop,
                    bottom: computed.paddingBottom
                },
                margin: {
                    left: computed.marginLeft,
                    right: computed.marginRight,
                    top: computed.marginTop,
                    bottom: computed.marginBottom
                },
                border: {
                    left: computed.borderLeftWidth,
                    right: computed.borderRightWidth,
                    top: computed.borderTopWidth,
                    bottom: computed.borderBottomWidth
                },
                boxSizing: computed.boxSizing
            };
        });

        // 2. waterfall-container의 상세 분석
        const containerAnalysis = await page.evaluate(() => {
            const container = document.querySelector('.waterfall-container');
            if (!container) return null;
            
            const computed = window.getComputedStyle(container);
            const rect = container.getBoundingClientRect();
            
            return {
                element: 'waterfall-container',
                position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                padding: {
                    left: computed.paddingLeft,
                    right: computed.paddingRight,
                    top: computed.paddingTop,
                    bottom: computed.paddingBottom
                },
                margin: {
                    left: computed.marginLeft,
                    right: computed.marginRight,
                    top: computed.marginTop,
                    bottom: computed.marginBottom
                },
                border: {
                    left: computed.borderLeftWidth,
                    right: computed.borderRightWidth,
                    top: computed.borderTopWidth,
                    bottom: computed.borderBottomWidth
                }
            };
        });

        // 3. waterfall-labels와 waterfall-timeline 정렬 분석
        const alignmentAnalysis = await page.evaluate(() => {
            const labels = document.querySelector('.waterfall-labels');
            const timeline = document.querySelector('.waterfall-timeline');
            
            if (!labels || !timeline) return null;
            
            const labelsRect = labels.getBoundingClientRect();
            const timelineRect = timeline.getBoundingClientRect();
            const labelsStyle = window.getComputedStyle(labels);
            const timelineStyle = window.getComputedStyle(timeline);
            
            return {
                labels: {
                    position: { x: labelsRect.x, y: labelsRect.y, width: labelsRect.width, height: labelsRect.height },
                    padding: { left: labelsStyle.paddingLeft, right: labelsStyle.paddingRight },
                    margin: { left: labelsStyle.marginLeft, right: labelsStyle.marginRight },
                    textAlign: labelsStyle.textAlign
                },
                timeline: {
                    position: { x: timelineRect.x, y: timelineRect.y, width: timelineRect.width, height: timelineRect.height },
                    padding: { left: timelineStyle.paddingLeft, right: timelineStyle.paddingRight },
                    margin: { left: timelineStyle.marginLeft, right: timelineStyle.marginRight },
                    textAlign: timelineStyle.textAlign
                },
                gap: timelineRect.x - (labelsRect.x + labelsRect.width),
                heightDiff: Math.abs(labelsRect.height - timelineRect.height)
            };
        });

        // 4. 개별 span 행들의 정렬 분석
        const spanRowsAnalysis = await page.evaluate(() => {
            const rows = document.querySelectorAll('.waterfall-row');
            if (rows.length === 0) return null;
            
            return Array.from(rows).slice(0, 3).map((row, index) => {
                const spanLabels = row.querySelector('.span-labels');
                const spanTimeline = row.querySelector('.span-timeline');
                
                if (!spanLabels || !spanTimeline) return null;
                
                const labelsRect = spanLabels.getBoundingClientRect();
                const timelineRect = spanTimeline.getBoundingClientRect();
                const labelsStyle = window.getComputedStyle(spanLabels);
                const timelineStyle = window.getComputedStyle(spanTimeline);
                
                return {
                    rowIndex: index + 1,
                    spanLabels: {
                        position: { x: labelsRect.x, y: labelsRect.y, width: labelsRect.width },
                        padding: { left: labelsStyle.paddingLeft, right: labelsStyle.paddingRight },
                        margin: { left: labelsStyle.marginLeft, right: labelsStyle.marginRight }
                    },
                    spanTimeline: {
                        position: { x: timelineRect.x, y: timelineRect.y, width: timelineRect.width },
                        padding: { left: timelineStyle.paddingLeft, right: timelineStyle.paddingRight },
                        margin: { left: timelineStyle.marginLeft, right: timelineStyle.marginRight }
                    },
                    gap: timelineRect.x - (labelsRect.x + labelsRect.width),
                    yAlignment: labelsRect.y - timelineRect.y
                };
            }).filter(Boolean);
        });

        // 결과 출력
        console.log('📋 span-detail-panel 분석:');
        if (panelAnalysis) {
            console.log(`   위치: (${panelAnalysis.position.x}, ${panelAnalysis.position.y})`);
            console.log(`   크기: ${panelAnalysis.position.width}x${panelAnalysis.position.height}`);
            console.log(`   패딩: ${panelAnalysis.padding.left} | ${panelAnalysis.padding.right} | ${panelAnalysis.padding.top} | ${panelAnalysis.padding.bottom}`);
            console.log(`   마진: ${panelAnalysis.margin.left} | ${panelAnalysis.margin.right} | ${panelAnalysis.margin.top} | ${panelAnalysis.margin.bottom}`);
            console.log(`   경계: ${panelAnalysis.border.left} | ${panelAnalysis.border.right} | ${panelAnalysis.border.top} | ${panelAnalysis.border.bottom}`);
            console.log(`   Box Sizing: ${panelAnalysis.boxSizing}\n`);
        }

        console.log('📋 waterfall-container 분석:');
        if (containerAnalysis) {
            console.log(`   위치: (${containerAnalysis.position.x}, ${containerAnalysis.position.y})`);
            console.log(`   크기: ${containerAnalysis.position.width}x${containerAnalysis.position.height}`);
            console.log(`   패딩: ${containerAnalysis.padding.left} | ${containerAnalysis.padding.right} | ${containerAnalysis.padding.top} | ${containerAnalysis.padding.bottom}`);
            console.log(`   마진: ${containerAnalysis.margin.left} | ${containerAnalysis.margin.right} | ${containerAnalysis.margin.top} | ${containerAnalysis.margin.bottom}`);
            console.log(`   경계: ${containerAnalysis.border.left} | ${containerAnalysis.border.right} | ${containerAnalysis.border.top} | ${containerAnalysis.border.bottom}\n`);
        }

        console.log('📋 헤더 정렬 분석:');
        if (alignmentAnalysis) {
            console.log(`   Labels 위치: (${alignmentAnalysis.labels.position.x}, ${alignmentAnalysis.labels.position.y})`);
            console.log(`   Labels 크기: ${alignmentAnalysis.labels.position.width}x${alignmentAnalysis.labels.position.height}`);
            console.log(`   Timeline 위치: (${alignmentAnalysis.timeline.position.x}, ${alignmentAnalysis.timeline.position.y})`);
            console.log(`   Timeline 크기: ${alignmentAnalysis.timeline.position.width}x${alignmentAnalysis.timeline.position.height}`);
            console.log(`   🔍 Labels-Timeline 간격: ${alignmentAnalysis.gap}px`);
            console.log(`   🔍 높이 차이: ${alignmentAnalysis.heightDiff}px\n`);
        }

        console.log('📋 개별 행 정렬 분석:');
        if (spanRowsAnalysis && spanRowsAnalysis.length > 0) {
            spanRowsAnalysis.forEach(row => {
                console.log(`   Row ${row.rowIndex}:`);
                console.log(`     Labels 위치: (${row.spanLabels.position.x}, ${row.spanLabels.position.y})`);
                console.log(`     Timeline 위치: (${row.spanTimeline.position.x}, ${row.spanTimeline.position.y})`);
                console.log(`     🔍 간격: ${row.gap}px`);
                console.log(`     🔍 Y축 정렬 차이: ${row.yAlignment}px`);
                console.log(`     Labels 패딩: L=${row.spanLabels.padding.left}, R=${row.spanLabels.padding.right}`);
                console.log(`     Timeline 패딩: L=${row.spanTimeline.padding.left}, R=${row.spanTimeline.padding.right}\n`);
            });
        }

        // 문제점 분석
        console.log('🚨 패딩 문제 분석:');
        
        let issues = [];
        
        if (panelAnalysis && parseInt(panelAnalysis.padding.left) === 0) {
            issues.push('❌ span-detail-panel에 왼쪽 패딩이 없음 (0px)');
        }
        
        if (containerAnalysis && parseInt(containerAnalysis.padding.left) === 0) {
            issues.push('❌ waterfall-container에 왼쪽 패딩이 없음 (0px)');
        }
        
        if (alignmentAnalysis && Math.abs(alignmentAnalysis.gap) > 5) {
            issues.push(`❌ Labels와 Timeline 사이 간격이 비정상적: ${alignmentAnalysis.gap}px`);
        }
        
        if (spanRowsAnalysis) {
            spanRowsAnalysis.forEach(row => {
                if (Math.abs(row.gap) > 5) {
                    issues.push(`❌ Row ${row.rowIndex}: Labels-Timeline 간격 문제 (${row.gap}px)`);
                }
                if (Math.abs(row.yAlignment) > 2) {
                    issues.push(`❌ Row ${row.rowIndex}: Y축 정렬 문제 (${row.yAlignment}px)`);
                }
            });
        }
        
        if (issues.length === 0) {
            console.log('   ✅ 주요 패딩 문제가 발견되지 않았습니다.');
        } else {
            issues.forEach(issue => console.log(`   ${issue}`));
        }

        // 추천 수정사항
        console.log('\n💡 추천 수정사항:');
        console.log('   1. .span-detail-panel에 padding-left: 15px 추가');
        console.log('   2. .waterfall-container에 padding: 10px 추가');
        console.log('   3. .span-labels와 .span-timeline 간격 조정');
        console.log('   4. 전체 컨테이너의 박스 모델 재검토');

        // 스크린샷 저장
        await page.screenshot({ 
            path: '/home/ptyoung/work/airis-mon/clickstack-architecture/test-suite/tests/detailed-padding-analysis.png',
            fullPage: true 
        });
        
        console.log('\n📸 상세 분석 스크린샷 저장됨: tests/detailed-padding-analysis.png');
        
        await page.waitForTimeout(3000);

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
    } finally {
        await browser.close();
    }
}

// 실행
detailedPaddingAnalysis();