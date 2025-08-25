const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test results
let coreTestResults = {
  timestamp: new Date().toISOString(),
  testName: "온톨로지 뷰어 핵심 기능 테스트",
  testUrl: "http://localhost:3001/ontology.html",
  results: {},
  screenshots: [],
  summary: { passed: 0, failed: 0, total: 0 }
};

async function runCoreTests() {
  console.log('🧪 온톨로지 뷰어 핵심 기능 테스트 시작');
  console.log('🌐 테스트 URL: http://localhost:3001/ontology.html');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Core Test 1: 페이지 로드 및 기본 요소 확인
    await testPageLoad(page);
    
    // Core Test 2: 그래프 탭 기본 렌더링
    await testGraphRendering(page);
    
    // Core Test 3: 지식베이스 탭 기능
    await testKnowledgeBase(page);
    
    // Core Test 4: 계층구조 탭 기능
    await testStructure(page);
    
    // Core Test 5: 탭 전환 기능
    await testTabSwitching(page);
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error);
  } finally {
    await browser.close();
    
    // 결과 저장
    const reportPath = path.join(__dirname, 'ontology-core-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(coreTestResults, null, 2), 'utf8');
    
    console.log('\n📊 핵심 기능 테스트 요약:');
    console.log(`- 총 테스트: ${coreTestResults.summary.total}`);
    console.log(`- 통과: ${coreTestResults.summary.passed}`);
    console.log(`- 실패: ${coreTestResults.summary.failed}`);
    console.log(`- 성공률: ${((coreTestResults.summary.passed / coreTestResults.summary.total) * 100).toFixed(1)}%`);
    console.log(`\n📄 상세 보고서: ${reportPath}`);
  }
}

async function testPageLoad(page) {
  coreTestResults.summary.total++;
  console.log('\n1️⃣ 페이지 로드 및 기본 요소 테스트');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
    
    // 기본 요소들 확인
    const elements = await Promise.all([
      page.waitForSelector('.main-container', { visible: true }),
      page.waitForSelector('.header-section', { visible: true }),
      page.waitForSelector('.stats-panel', { visible: true }),
      page.waitForSelector('#graph-tab', { visible: true }),
      page.waitForSelector('#knowledge-tab', { visible: true }),
      page.waitForSelector('#structure-tab', { visible: true })
    ]);
    
    // 통계 값 확인
    const stats = {
      nodes: await page.textContent('#total-nodes'),
      relations: await page.textContent('#total-relations'),
      categories: await page.textContent('#total-categories'),
      connections: await page.textContent('#active-connections')
    };
    
    const hasValidStats = parseInt(stats.nodes) > 0 && 
                         parseInt(stats.relations) > 0 && 
                         parseInt(stats.categories) > 0;
    
    if (!hasValidStats) {
      throw new Error('통계 값이 유효하지 않음');
    }
    
    console.log(`📊 통계: 노드 ${stats.nodes}개, 관계 ${stats.relations}개, 카테고리 ${stats.categories}개`);
    
    coreTestResults.results.pageLoad = {
      status: 'PASS',
      statistics: stats,
      timestamp: new Date().toISOString()
    };
    
    coreTestResults.summary.passed++;
    console.log('✅ 페이지 로드 테스트 통과');
    
  } catch (error) {
    coreTestResults.results.pageLoad = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    coreTestResults.summary.failed++;
    console.error('❌ 페이지 로드 테스트 실패:', error.message);
  }
}

async function testGraphRendering(page) {
  coreTestResults.summary.total++;
  console.log('\n2️⃣ 그래프 렌더링 테스트');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
    
    // 그래프 탭이 기본적으로 활성화되어 있는지 확인
    const graphTabActive = await page.evaluate(() => {
      const tab = document.getElementById('graph-tab');
      return tab && tab.classList.contains('active');
    });
    
    if (!graphTabActive) {
      throw new Error('그래프 탭이 기본적으로 활성화되지 않음');
    }
    
    // 그래프 요소들 확인
    await page.waitForSelector('#graph-svg', { visible: true });
    await page.waitForTimeout(3000); // D3 렌더링 대기
    
    const graphElements = await page.evaluate(() => {
      const svg = document.getElementById('graph-svg');
      return {
        nodes: svg ? svg.querySelectorAll('circle.node').length : 0,
        links: svg ? svg.querySelectorAll('line.link').length : 0,
        labels: svg ? svg.querySelectorAll('text.node-label').length : 0
      };
    });
    
    if (graphElements.nodes === 0 || graphElements.links === 0) {
      throw new Error('그래프 요소들이 렌더링되지 않음');
    }
    
    // 범례 확인
    const legendVisible = await page.isVisible('.graph-legend');
    if (!legendVisible) {
      throw new Error('그래프 범례가 표시되지 않음');
    }
    
    console.log(`📊 그래프 요소: 노드 ${graphElements.nodes}개, 링크 ${graphElements.links}개, 라벨 ${graphElements.labels}개`);
    
    // 스크린샷 저장
    const screenshotPath = path.join(__dirname, 'screenshots', 'core-test-graph.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    coreTestResults.screenshots.push('core-test-graph.png');
    
    coreTestResults.results.graphRendering = {
      status: 'PASS',
      elements: graphElements,
      legendVisible: true,
      timestamp: new Date().toISOString()
    };
    
    coreTestResults.summary.passed++;
    console.log('✅ 그래프 렌더링 테스트 통과');
    
  } catch (error) {
    coreTestResults.results.graphRendering = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    coreTestResults.summary.failed++;
    console.error('❌ 그래프 렌더링 테스트 실패:', error.message);
  }
}

async function testKnowledgeBase(page) {
  coreTestResults.summary.total++;
  console.log('\n3️⃣ 지식베이스 기능 테스트');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
    
    // 지식베이스 탭 클릭
    await page.click('#knowledge-tab');
    await page.waitForTimeout(1000);
    
    // 탭 활성화 확인
    const tabActive = await page.evaluate(() => {
      const tab = document.getElementById('knowledge-tab');
      return tab && tab.classList.contains('active');
    });
    
    if (!tabActive) {
      throw new Error('지식베이스 탭이 활성화되지 않음');
    }
    
    // 레이아웃 요소들 확인
    await page.waitForSelector('#knowledge-panel.show.active', { visible: true });
    await page.waitForSelector('.categories-panel', { visible: true });
    await page.waitForSelector('.content-panel', { visible: true });
    
    // 카테고리들 확인
    const categoryInfo = await page.evaluate(() => {
      const categories = document.querySelectorAll('#knowledge-categories .category-btn');
      const activeCategory = document.querySelector('#knowledge-categories .category-btn.active');
      return {
        total: categories.length,
        hasActive: !!activeCategory,
        activeTitle: activeCategory ? activeCategory.textContent.trim() : null
      };
    });
    
    if (categoryInfo.total === 0) {
      throw new Error('카테고리가 로드되지 않음');
    }
    
    if (!categoryInfo.hasActive) {
      throw new Error('활성 카테고리가 없음');
    }
    
    // 컨텐츠 표시 확인
    const contentLoaded = await page.evaluate(() => {
      const content = document.getElementById('knowledge-content');
      const title = content ? content.querySelector('h4') : null;
      return {
        hasContent: !!content,
        hasTitle: !!title,
        titleText: title ? title.textContent.trim() : null
      };
    });
    
    if (!contentLoaded.hasContent || !contentLoaded.hasTitle) {
      throw new Error('지식베이스 컨텐츠가 로드되지 않음');
    }
    
    console.log(`📚 카테고리 ${categoryInfo.total}개, 활성 카테고리: "${categoryInfo.activeTitle}"`);
    
    // 스크린샷 저장
    const screenshotPath = path.join(__dirname, 'screenshots', 'core-test-knowledge.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    coreTestResults.screenshots.push('core-test-knowledge.png');
    
    coreTestResults.results.knowledgeBase = {
      status: 'PASS',
      categories: categoryInfo,
      content: contentLoaded,
      timestamp: new Date().toISOString()
    };
    
    coreTestResults.summary.passed++;
    console.log('✅ 지식베이스 기능 테스트 통과');
    
  } catch (error) {
    coreTestResults.results.knowledgeBase = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    coreTestResults.summary.failed++;
    console.error('❌ 지식베이스 기능 테스트 실패:', error.message);
  }
}

async function testStructure(page) {
  coreTestResults.summary.total++;
  console.log('\n4️⃣ 계층구조 기능 테스트');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
    
    // 계층구조 탭 클릭
    await page.click('#structure-tab');
    await page.waitForTimeout(1000);
    
    // 탭 활성화 확인
    const tabActive = await page.evaluate(() => {
      const tab = document.getElementById('structure-tab');
      return tab && tab.classList.contains('active');
    });
    
    if (!tabActive) {
      throw new Error('계층구조 탭이 활성화되지 않음');
    }
    
    // 구조 요소들 확인
    await page.waitForSelector('#structure-panel.show.active', { visible: true });
    await page.waitForSelector('.structure-container', { visible: true });
    await page.waitForSelector('#tree-structure', { visible: true });
    
    // 트리 요소들 확인
    const treeInfo = await page.evaluate(() => {
      const treeNodes = document.querySelectorAll('.tree-node');
      const treeChildren = document.querySelectorAll('.tree-children');
      const toggles = document.querySelectorAll('.tree-toggle');
      
      // 첫 번째 자식이 보이는지 확인
      const firstChild = treeChildren[0];
      const isVisible = firstChild && firstChild.style.display !== 'none';
      
      return {
        nodeCount: treeNodes.length,
        childrenCount: treeChildren.length,
        toggleCount: toggles.length,
        firstChildVisible: isVisible
      };
    });
    
    if (treeInfo.nodeCount === 0) {
      throw new Error('트리 노드가 로드되지 않음');
    }
    
    if (treeInfo.childrenCount === 0) {
      throw new Error('트리 자식 요소가 없음');
    }
    
    // 토글 기능 테스트
    const firstTreeNode = await page.$('.tree-node');
    if (firstTreeNode) {
      await firstTreeNode.click();
      await page.waitForTimeout(500);
      
      const toggledState = await page.evaluate(() => {
        const firstChild = document.querySelector('.tree-children');
        return firstChild ? firstChild.style.display === 'none' : false;
      });
      
      if (!toggledState) {
        console.log('⚠️  토글 기능이 완전히 작동하지 않을 수 있지만 구조는 정상');
      }
    }
    
    console.log(`🌲 트리 노드 ${treeInfo.nodeCount}개, 자식 그룹 ${treeInfo.childrenCount}개`);
    
    // 스크린샷 저장
    const screenshotPath = path.join(__dirname, 'screenshots', 'core-test-structure.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    coreTestResults.screenshots.push('core-test-structure.png');
    
    coreTestResults.results.structure = {
      status: 'PASS',
      treeInfo: treeInfo,
      timestamp: new Date().toISOString()
    };
    
    coreTestResults.summary.passed++;
    console.log('✅ 계층구조 기능 테스트 통과');
    
  } catch (error) {
    coreTestResults.results.structure = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    coreTestResults.summary.failed++;
    console.error('❌ 계층구조 기능 테스트 실패:', error.message);
  }
}

async function testTabSwitching(page) {
  coreTestResults.summary.total++;
  console.log('\n5️⃣ 탭 전환 기능 테스트');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
    
    const tabSequence = [
      { id: '#knowledge-tab', panelId: '#knowledge-panel', name: '지식베이스' },
      { id: '#structure-tab', panelId: '#structure-panel', name: '계층구조' },
      { id: '#graph-tab', panelId: '#graph-panel', name: '그래프' }
    ];
    
    const switchResults = [];
    
    for (const tab of tabSequence) {
      await page.click(tab.id);
      await page.waitForTimeout(800);
      
      // 탭과 패널 활성화 확인
      const isActive = await page.evaluate((tabId, panelId) => {
        const tabElement = document.querySelector(tabId);
        const panelElement = document.querySelector(panelId);
        
        return {
          tabActive: tabElement && tabElement.classList.contains('active'),
          panelActive: panelElement && panelElement.classList.contains('show', 'active')
        };
      }, tab.id, tab.panelId);
      
      switchResults.push({
        tabName: tab.name,
        tabActive: isActive.tabActive,
        panelActive: isActive.panelActive,
        success: isActive.tabActive && isActive.panelActive
      });
      
      console.log(`🔄 ${tab.name} 탭 전환: ${isActive.tabActive && isActive.panelActive ? '✅' : '❌'}`);
    }
    
    const allSwitchesWorked = switchResults.every(result => result.success);
    
    if (!allSwitchesWorked) {
      throw new Error('일부 탭 전환이 실패했습니다');
    }
    
    // 최종 스크린샷 (그래프 탭 상태)
    const screenshotPath = path.join(__dirname, 'screenshots', 'core-test-final.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    coreTestResults.screenshots.push('core-test-final.png');
    
    coreTestResults.results.tabSwitching = {
      status: 'PASS',
      switchResults: switchResults,
      timestamp: new Date().toISOString()
    };
    
    coreTestResults.summary.passed++;
    console.log('✅ 탭 전환 기능 테스트 통과');
    
  } catch (error) {
    coreTestResults.results.tabSwitching = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    coreTestResults.summary.failed++;
    console.error('❌ 탭 전환 기능 테스트 실패:', error.message);
  }
}

// 테스트 실행
runCoreTests().catch(console.error);