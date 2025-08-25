const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Final comprehensive test
async function runFinalTest() {
  console.log('🎯 온톨로지 뷰어 최종 검증 테스트');
  console.log('🌐 테스트 URL: http://localhost:3001/ontology.html');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  let finalReport = {
    timestamp: new Date().toISOString(),
    testName: "온톨로지 뷰어 최종 검증",
    url: "http://localhost:3001/ontology.html",
    results: {},
    screenshots: [],
    summary: { passed: 0, failed: 0, total: 0 }
  };
  
  try {
    // 최종 검증 테스트
    await testComplete(page, finalReport);
    
  } finally {
    await browser.close();
    
    const reportPath = path.join(__dirname, 'ontology-final-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2), 'utf8');
    
    console.log('\n🏁 최종 검증 결과:');
    console.log(`- 총 검증 항목: ${finalReport.summary.total}`);
    console.log(`- 통과: ${finalReport.summary.passed}`);
    console.log(`- 실패: ${finalReport.summary.failed}`);
    console.log(`- 성공률: ${((finalReport.summary.passed / finalReport.summary.total) * 100).toFixed(1)}%`);
    console.log(`\n📋 최종 보고서: ${reportPath}`);
  }
}

async function testComplete(page, report) {
  console.log('\n🔍 전체 기능 통합 테스트 수행 중...');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { 
      waitUntil: 'networkidle',
      timeout: 20000 
    });
    
    // 1. 페이지 로드 상태 검증
    report.summary.total++;
    console.log('1️⃣ 페이지 기본 로드 상태 검증...');
    
    const basicElements = await page.evaluate(() => {
      return {
        hasMainContainer: !!document.querySelector('.main-container'),
        hasHeader: !!document.querySelector('.header-section'),
        hasStatsPanel: !!document.querySelector('.stats-panel'),
        hasTabNavigation: !!document.querySelector('.tab-navigation'),
        hasTabs: {
          graph: !!document.querySelector('#graph-tab'),
          knowledge: !!document.querySelector('#knowledge-tab'),
          structure: !!document.querySelector('#structure-tab')
        },
        statistics: {
          nodes: document.querySelector('#total-nodes')?.textContent || '0',
          relations: document.querySelector('#total-relations')?.textContent || '0',
          categories: document.querySelector('#total-categories')?.textContent || '0'
        }
      };
    });
    
    const pageLoadOk = basicElements.hasMainContainer && 
                      basicElements.hasHeader && 
                      basicElements.hasStatsPanel &&
                      basicElements.hasTabs.graph &&
                      basicElements.hasTabs.knowledge &&
                      basicElements.hasTabs.structure;
    
    if (pageLoadOk) {
      report.results.pageLoad = { status: 'PASS', details: basicElements };
      report.summary.passed++;
      console.log('   ✅ 페이지 기본 요소 모두 로드됨');
    } else {
      throw new Error('필수 페이지 요소가 누락됨');
    }
    
    // 2. 그래프 탭 검증
    report.summary.total++;
    console.log('2️⃣ 그래프 시각화 탭 검증...');
    
    await page.waitForTimeout(3000); // D3 렌더링 대기
    
    const graphStatus = await page.evaluate(() => {
      const graphTab = document.querySelector('#graph-tab');
      const graphPanel = document.querySelector('#graph-panel');
      const svg = document.querySelector('#graph-svg');
      
      return {
        tabActive: graphTab && graphTab.classList.contains('active'),
        panelVisible: graphPanel && graphPanel.classList.contains('show', 'active'),
        svgExists: !!svg,
        elements: {
          nodes: svg ? svg.querySelectorAll('circle.node').length : 0,
          links: svg ? svg.querySelectorAll('line.link').length : 0,
          labels: svg ? svg.querySelectorAll('text.node-label').length : 0
        },
        hasLegend: !!document.querySelector('.graph-legend')
      };
    });
    
    const graphOk = graphStatus.tabActive && 
                   graphStatus.panelVisible && 
                   graphStatus.svgExists &&
                   graphStatus.elements.nodes > 0 &&
                   graphStatus.elements.links > 0 &&
                   graphStatus.hasLegend;
    
    if (graphOk) {
      report.results.graph = { status: 'PASS', details: graphStatus };
      report.summary.passed++;
      console.log(`   ✅ 그래프 정상 렌더링 (노드 ${graphStatus.elements.nodes}개, 링크 ${graphStatus.elements.links}개)`);
    } else {
      throw new Error('그래프 렌더링에 문제 있음');
    }
    
    // 3. 지식베이스 탭 검증
    report.summary.total++;
    console.log('3️⃣ 지식베이스 탭 검증...');
    
    await page.click('#knowledge-tab');
    await page.waitForTimeout(1000);
    
    const knowledgeStatus = await page.evaluate(() => {
      const tab = document.querySelector('#knowledge-tab');
      const panel = document.querySelector('#knowledge-panel');
      const categoriesPanel = document.querySelector('.categories-panel');
      const contentPanel = document.querySelector('.content-panel');
      const categories = document.querySelectorAll('.category-btn');
      const activeCategory = document.querySelector('.category-btn.active');
      const content = document.querySelector('#knowledge-content');
      
      return {
        tabActive: tab && tab.classList.contains('active'),
        panelVisible: panel && panel.classList.contains('show', 'active'),
        layoutExists: !!categoriesPanel && !!contentPanel,
        categoryCount: categories.length,
        hasActiveCategory: !!activeCategory,
        hasContent: !!content && content.children.length > 0
      };
    });
    
    const knowledgeOk = knowledgeStatus.tabActive &&
                       knowledgeStatus.panelVisible &&
                       knowledgeStatus.layoutExists &&
                       knowledgeStatus.categoryCount > 0 &&
                       knowledgeStatus.hasActiveCategory &&
                       knowledgeStatus.hasContent;
    
    if (knowledgeOk) {
      report.results.knowledge = { status: 'PASS', details: knowledgeStatus };
      report.summary.passed++;
      console.log(`   ✅ 지식베이스 정상 작동 (카테고리 ${knowledgeStatus.categoryCount}개)`);
    } else {
      throw new Error('지식베이스 탭에 문제 있음');
    }
    
    // 4. 계층구조 탭 검증  
    report.summary.total++;
    console.log('4️⃣ 계층구조 탭 검증...');
    
    await page.click('#structure-tab');
    await page.waitForTimeout(1000);
    
    const structureStatus = await page.evaluate(() => {
      const tab = document.querySelector('#structure-tab');
      const panel = document.querySelector('#structure-panel');
      const container = document.querySelector('.structure-container');
      const treeStructure = document.querySelector('#tree-structure');
      const treeNodes = document.querySelectorAll('.tree-node');
      const treeChildren = document.querySelectorAll('.tree-children');
      
      return {
        tabActive: tab && tab.classList.contains('active'),
        panelVisible: panel && panel.classList.contains('show', 'active'),
        containerExists: !!container,
        treeExists: !!treeStructure,
        nodeCount: treeNodes.length,
        childrenCount: treeChildren.length
      };
    });
    
    const structureOk = structureStatus.tabActive &&
                       structureStatus.panelVisible &&
                       structureStatus.containerExists &&
                       structureStatus.treeExists &&
                       structureStatus.nodeCount > 0;
    
    if (structureOk) {
      report.results.structure = { status: 'PASS', details: structureStatus };
      report.summary.passed++;
      console.log(`   ✅ 계층구조 정상 작동 (노드 ${structureStatus.nodeCount}개)`);
    } else {
      throw new Error('계층구조 탭에 문제 있음');
    }
    
    // 5. 탭 전환 기능 검증
    report.summary.total++;
    console.log('5️⃣ 탭 전환 기능 검증...');
    
    // 그래프 탭으로 돌아가기
    await page.click('#graph-tab');
    await page.waitForTimeout(500);
    
    const finalTabCheck = await page.evaluate(() => {
      const graphTab = document.querySelector('#graph-tab');
      const graphPanel = document.querySelector('#graph-panel');
      const knowledgePanel = document.querySelector('#knowledge-panel');
      const structurePanel = document.querySelector('#structure-panel');
      
      return {
        graphTabActive: graphTab && graphTab.classList.contains('active'),
        graphPanelVisible: graphPanel && graphPanel.classList.contains('show', 'active'),
        knowledgePanelHidden: !knowledgePanel.classList.contains('show', 'active'),
        structurePanelHidden: !structurePanel.classList.contains('show', 'active')
      };
    });
    
    const tabSwitchingOk = finalTabCheck.graphTabActive &&
                          finalTabCheck.graphPanelVisible &&
                          finalTabCheck.knowledgePanelHidden &&
                          finalTabCheck.structurePanelHidden;
    
    if (tabSwitchingOk) {
      report.results.tabSwitching = { status: 'PASS', details: finalTabCheck };
      report.summary.passed++;
      console.log('   ✅ 탭 전환 정상 작동');
    } else {
      throw new Error('탭 전환 기능에 문제 있음');
    }
    
    // 최종 스크린샷들
    console.log('📸 최종 검증 스크린샷 촬영 중...');
    
    // 그래프 탭
    await page.click('#graph-tab');
    await page.waitForTimeout(800);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'final-test-graph.png'),
      fullPage: true 
    });
    report.screenshots.push('final-test-graph.png');
    
    // 지식베이스 탭
    await page.click('#knowledge-tab');
    await page.waitForTimeout(800);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'final-test-knowledge.png'),
      fullPage: true 
    });
    report.screenshots.push('final-test-knowledge.png');
    
    // 계층구조 탭
    await page.click('#structure-tab');
    await page.waitForTimeout(800);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'final-test-structure.png'),
      fullPage: true 
    });
    report.screenshots.push('final-test-structure.png');
    
    console.log('✅ 모든 검증 항목 완료');
    
  } catch (error) {
    report.summary.failed++;
    report.results.error = {
      status: 'FAIL',
      message: error.message,
      timestamp: new Date().toISOString()
    };
    console.error('❌ 검증 중 오류 발생:', error.message);
  }
}

// 테스트 실행
runFinalTest().catch(console.error);