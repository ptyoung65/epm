const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test report object
let testReport = {
  timestamp: new Date().toISOString(),
  testResults: {},
  screenshots: [],
  errors: [],
  summary: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0
  }
};

async function runOntologyTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('🧪 온톨로지 뷰어 종합 테스트 시작');
  
  try {
    // Test 1: 페이지 초기 로드
    await testInitialLoad(page);
    
    // Test 2: 그래프 시각화 탭
    await testGraphTab(page);
    
    // Test 3: 지식베이스 탭
    await testKnowledgeTab(page);
    
    // Test 4: 계층구조 탭
    await testStructureTab(page);
    
    // Test 5: 콘솔 에러 확인
    await testConsoleErrors(page);
    
    // Test 6: 반응형 디자인
    await testResponsiveDesign(page);
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  } finally {
    await browser.close();
    
    // 테스트 보고서 저장
    const reportPath = path.join(__dirname, 'ontology-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2), 'utf8');
    
    console.log('\n📄 테스트 보고서가 저장되었습니다:', reportPath);
    console.log('\n📊 테스트 요약:');
    console.log(`- 총 테스트: ${testReport.summary.totalTests}`);
    console.log(`- 통과: ${testReport.summary.passedTests}`);
    console.log(`- 실패: ${testReport.summary.failedTests}`);
    console.log(`- 성공률: ${((testReport.summary.passedTests / testReport.summary.totalTests) * 100).toFixed(1)}%`);
  }
}

async function testInitialLoad(page) {
  testReport.summary.totalTests++;
  console.log('\n1️⃣ 페이지 초기 로드 테스트');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // 페이지 제목 확인
    const title = await page.title();
    if (!title.includes('AIRIS APM - 온톨로지 시각화')) {
      throw new Error('페이지 제목이 올바르지 않음');
    }
    
    // 주요 요소들 확인
    await page.waitForSelector('.main-container', { visible: true });
    await page.waitForSelector('.header-section', { visible: true });
    await page.waitForSelector('.stats-panel', { visible: true });
    await page.waitForSelector('.tab-navigation', { visible: true });
    
    // 탭들 확인
    await page.waitForSelector('#graph-tab', { visible: true });
    await page.waitForSelector('#knowledge-tab', { visible: true });
    await page.waitForSelector('#structure-tab', { visible: true });
    
    // 통계 값 확인
    const totalNodes = await page.textContent('#total-nodes');
    const totalRelations = await page.textContent('#total-relations');
    const totalCategories = await page.textContent('#total-categories');
    
    if (parseInt(totalNodes) <= 0 || parseInt(totalRelations) <= 0 || parseInt(totalCategories) <= 0) {
      throw new Error('통계 값이 올바르지 않음');
    }
    
    // 스크린샷 저장
    const screenshotPath = path.join(__dirname, 'screenshots', '01-initial-load.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    testReport.screenshots.push('01-initial-load.png');
    
    testReport.testResults.initialLoad = {
      status: 'PASS',
      title: title,
      statistics: { totalNodes, totalRelations, totalCategories },
      timestamp: new Date().toISOString()
    };
    
    testReport.summary.passedTests++;
    console.log('✅ 초기 로드 테스트 통과');
    
  } catch (error) {
    testReport.testResults.initialLoad = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    testReport.summary.failedTests++;
    testReport.errors.push(`초기 로드: ${error.message}`);
    console.error('❌ 초기 로드 테스트 실패:', error.message);
  }
}

async function testGraphTab(page) {
  testReport.summary.totalTests++;
  console.log('\n2️⃣ 그래프 시각화 탭 테스트');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
    
    // 그래프 탭이 기본적으로 활성화되어 있는지 확인
    const graphTab = await page.$('#graph-tab');
    const hasActiveClass = await page.evaluate(el => el.classList.contains('active'), graphTab);
    if (!hasActiveClass) {
      throw new Error('그래프 탭이 기본적으로 활성화되어 있지 않음');
    }
    
    // 그래프 패널 표시 확인
    await page.waitForSelector('#graph-panel.show.active', { visible: true });
    await page.waitForSelector('#graph-svg', { visible: true });
    
    // D3.js 렌더링 대기
    await page.waitForTimeout(3000);
    
    // 그래프 요소들 확인
    const nodes = await page.$$('#graph-svg circle.node');
    const links = await page.$$('#graph-svg line.link');
    const labels = await page.$$('#graph-svg text.node-label');
    
    if (nodes.length === 0 || links.length === 0 || labels.length === 0) {
      throw new Error('그래프 요소들이 렌더링되지 않음');
    }
    
    console.log(`📊 그래프 요소 수: 노드 ${nodes.length}개, 링크 ${links.length}개, 라벨 ${labels.length}개`);
    
    // 컨트롤 버튼들 확인
    await page.waitForSelector('button:has-text("리셋")', { visible: true });
    await page.waitForSelector('button:has-text("센터링")', { visible: true });
    
    // 범례 확인
    await page.waitForSelector('.graph-legend', { visible: true });
    const legendItems = await page.$$('.legend-item');
    
    if (legendItems.length === 0) {
      throw new Error('범례 항목이 없음');
    }
    
    // 노드 상호작용 테스트
    if (nodes.length > 0) {
      await nodes[0].hover();
      await page.waitForTimeout(500);
      
      const tooltip = await page.$('.tooltip');
      const tooltipVisible = await page.evaluate(el => el.style.opacity === '1', tooltip);
      if (!tooltipVisible) {
        throw new Error('툴팁이 표시되지 않음');
      }
    }
    
    // 스크린샷 저장
    const screenshotPath = path.join(__dirname, 'screenshots', '02-graph-tab.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    testReport.screenshots.push('02-graph-tab.png');
    
    testReport.testResults.graphTab = {
      status: 'PASS',
      graphElements: { 
        nodes: nodes.length, 
        links: links.length, 
        labels: labels.length,
        legendItems: legendItems.length 
      },
      interactivity: 'confirmed',
      timestamp: new Date().toISOString()
    };
    
    testReport.summary.passedTests++;
    console.log('✅ 그래프 시각화 탭 테스트 통과');
    
  } catch (error) {
    testReport.testResults.graphTab = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    testReport.summary.failedTests++;
    testReport.errors.push(`그래프 탭: ${error.message}`);
    console.error('❌ 그래프 시각화 탭 테스트 실패:', error.message);
  }
}

async function testKnowledgeTab(page) {
  testReport.summary.totalTests++;
  console.log('\n3️⃣ 지식베이스 탭 테스트');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
    
    // 지식베이스 탭 클릭
    await page.click('#knowledge-tab');
    await page.waitForTimeout(1000);
    
    // 탭 활성화 확인
    const knowledgeTab = await page.$('#knowledge-tab');
    const hasActiveClass = await page.evaluate(el => el.classList.contains('active'), knowledgeTab);
    if (!hasActiveClass) {
      throw new Error('지식베이스 탭이 활성화되지 않음');
    }
    
    // 패널 표시 확인
    await page.waitForSelector('#knowledge-panel.show.active', { visible: true });
    await page.waitForSelector('.categories-panel', { visible: true });
    await page.waitForSelector('.content-panel', { visible: true });
    
    // 카테고리들 확인
    const categories = await page.$$('#knowledge-categories .category-btn');
    if (categories.length === 0) {
      throw new Error('카테고리가 로드되지 않음');
    }
    
    console.log(`📚 카테고리 수: ${categories.length}개`);
    
    // 첫 번째 카테고리가 자동 선택되었는지 확인
    const firstCategory = categories[0];
    const firstCategoryActive = await page.evaluate(el => el.classList.contains('active'), firstCategory);
    if (!firstCategoryActive) {
      throw new Error('첫 번째 카테고리가 자동 선택되지 않음');
    }
    
    // 컨텐츠 표시 확인
    await page.waitForSelector('#knowledge-content', { visible: true });
    const contentTitle = await page.textContent('#knowledge-content h4');
    if (!contentTitle || contentTitle.trim().length === 0) {
      throw new Error('컨텐츠가 로드되지 않음');
    }
    
    // 스크린샷 저장
    let screenshotPath = path.join(__dirname, 'screenshots', '03-knowledge-base-tab.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    testReport.screenshots.push('03-knowledge-base-tab.png');
    
    // 다른 카테고리 클릭 테스트
    if (categories.length > 1) {
      await categories[1].click();
      await page.waitForTimeout(500);
      
      const secondCategoryActive = await page.evaluate(el => el.classList.contains('active'), categories[1]);
      const firstCategoryStillActive = await page.evaluate(el => el.classList.contains('active'), firstCategory);
      
      if (!secondCategoryActive || firstCategoryStillActive) {
        throw new Error('카테고리 전환이 올바르지 않음');
      }
      
      const newContentTitle = await page.textContent('#knowledge-content h4');
      if (newContentTitle === contentTitle) {
        throw new Error('컨텐츠가 변경되지 않음');
      }
      
      screenshotPath = path.join(__dirname, 'screenshots', '04-category-clicked.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      testReport.screenshots.push('04-category-clicked.png');
    }
    
    // 지식 아이템들 확인
    const knowledgeItems = await page.$$('.knowledge-item');
    if (knowledgeItems.length === 0) {
      throw new Error('지식 아이템이 표시되지 않음');
    }
    
    testReport.testResults.knowledgeTab = {
      status: 'PASS',
      categoryCount: categories.length,
      itemCount: knowledgeItems.length,
      layoutConfirmed: true,
      interactivity: 'confirmed',
      timestamp: new Date().toISOString()
    };
    
    testReport.summary.passedTests++;
    console.log('✅ 지식베이스 탭 테스트 통과');
    
  } catch (error) {
    testReport.testResults.knowledgeTab = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    testReport.summary.failedTests++;
    testReport.errors.push(`지식베이스 탭: ${error.message}`);
    console.error('❌ 지식베이스 탭 테스트 실패:', error.message);
  }
}

async function testStructureTab(page) {
  testReport.summary.totalTests++;
  console.log('\n4️⃣ 계층구조 탭 테스트');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
    
    // 계층구조 탭 클릭
    await page.click('#structure-tab');
    await page.waitForTimeout(1000);
    
    // 탭 활성화 확인
    const structureTab = await page.$('#structure-tab');
    const hasActiveClass = await page.evaluate(el => el.classList.contains('active'), structureTab);
    if (!hasActiveClass) {
      throw new Error('계층구조 탭이 활성화되지 않음');
    }
    
    // 패널 표시 확인
    await page.waitForSelector('#structure-panel.show.active', { visible: true });
    await page.waitForSelector('.structure-container', { visible: true });
    await page.waitForSelector('#tree-structure', { visible: true });
    
    // 트리 노드들 확인
    const treeNodes = await page.$$('.tree-node');
    if (treeNodes.length === 0) {
      throw new Error('트리 노드가 로드되지 않음');
    }
    
    console.log(`🌲 트리 노드 수: ${treeNodes.length}개`);
    
    // 트리 자식 요소들 확인
    const treeChildren = await page.$$('.tree-children');
    if (treeChildren.length === 0) {
      throw new Error('트리 자식 요소가 없음');
    }
    
    // 첫 번째 노드의 확장 상태 확인
    const firstTreeNode = treeNodes[0];
    const firstChildren = treeChildren[0];
    
    const initiallyVisible = await page.evaluate(el => el.style.display !== 'none', firstChildren);
    if (!initiallyVisible) {
      throw new Error('첫 번째 트리 노드가 기본적으로 확장되어 있지 않음');
    }
    
    // 토글 기능 테스트
    await firstTreeNode.click();
    await page.waitForTimeout(500);
    
    const hiddenAfterClick = await page.evaluate(el => el.style.display === 'none', firstChildren);
    if (!hiddenAfterClick) {
      throw new Error('트리 노드 축소가 작동하지 않음');
    }
    
    // 다시 클릭하여 확장
    await firstTreeNode.click();
    await page.waitForTimeout(500);
    
    const visibleAfterSecondClick = await page.evaluate(el => el.style.display !== 'none', firstChildren);
    if (!visibleAfterSecondClick) {
      throw new Error('트리 노드 확장이 작동하지 않음');
    }
    
    // 토글 아이콘 확인
    const toggleIcons = await page.$$('.tree-toggle');
    if (toggleIcons.length === 0) {
      throw new Error('토글 아이콘이 없음');
    }
    
    // 스크린샷 저장
    const screenshotPath = path.join(__dirname, 'screenshots', '05-structure-tab.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    testReport.screenshots.push('05-structure-tab.png');
    
    testReport.testResults.structureTab = {
      status: 'PASS',
      nodeCount: treeNodes.length,
      childrenCount: treeChildren.length,
      toggleCount: toggleIcons.length,
      interactivity: 'confirmed',
      timestamp: new Date().toISOString()
    };
    
    testReport.summary.passedTests++;
    console.log('✅ 계층구조 탭 테스트 통과');
    
  } catch (error) {
    testReport.testResults.structureTab = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    testReport.summary.failedTests++;
    testReport.errors.push(`계층구조 탭: ${error.message}`);
    console.error('❌ 계층구조 탭 테스트 실패:', error.message);
  }
}

async function testConsoleErrors(page) {
  testReport.summary.totalTests++;
  console.log('\n5️⃣ 브라우저 콘솔 에러 확인');
  
  try {
    const consoleErrors = [];
    const consoleWarnings = [];
    
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      } else if (message.type() === 'warning') {
        consoleWarnings.push(message.text());
      }
    });
    
    await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // 각 탭 클릭하여 JavaScript 실행
    await page.click('#knowledge-tab');
    await page.waitForTimeout(1000);
    
    await page.click('#structure-tab');
    await page.waitForTimeout(1000);
    
    await page.click('#graph-tab');
    await page.waitForTimeout(1000);
    
    // 그래프 상호작용 테스트
    const nodes = await page.$$('#graph-svg circle.node');
    if (nodes.length > 0) {
      await nodes[0].hover();
      await page.waitForTimeout(500);
      await nodes[0].click();
      await page.waitForTimeout(1000);
    }
    
    // 중요한 에러만 필터링
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('404') && 
      !error.includes('network') &&
      !error.toLowerCase().includes('extension')
    );
    
    testReport.testResults.consoleErrors = {
      status: criticalErrors.length === 0 ? 'PASS' : 'FAIL',
      totalErrors: consoleErrors.length,
      criticalErrors: criticalErrors.length,
      totalWarnings: consoleWarnings.length,
      errors: criticalErrors,
      warnings: consoleWarnings,
      timestamp: new Date().toISOString()
    };
    
    if (criticalErrors.length === 0) {
      testReport.summary.passedTests++;
      console.log('✅ 브라우저 콘솔 에러 확인 통과 (중요한 에러 없음)');
      if (consoleErrors.length > 0) {
        console.log(`⚠️  총 ${consoleErrors.length}개의 에러가 있지만 중요하지 않은 에러들입니다.`);
      }
    } else {
      testReport.summary.failedTests++;
      testReport.errors.push(`중요한 콘솔 에러 ${criticalErrors.length}개 발견`);
      console.error('❌ 중요한 콘솔 에러 발견:', criticalErrors);
    }
    
  } catch (error) {
    testReport.testResults.consoleErrors = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    testReport.summary.failedTests++;
    testReport.errors.push(`콘솔 에러 확인: ${error.message}`);
    console.error('❌ 브라우저 콘솔 에러 확인 실패:', error.message);
  }
}

async function testResponsiveDesign(page) {
  testReport.summary.totalTests++;
  console.log('\n6️⃣ 반응형 디자인 테스트');
  
  try {
    await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
    
    // 데스크톱 뷰
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    
    await page.waitForSelector('.main-container', { visible: true });
    const desktopLayout = await page.evaluate(() => {
      const container = document.querySelector('.knowledge-container');
      return container ? window.getComputedStyle(container).flexDirection : null;
    });
    
    // 모바일 뷰
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    await page.waitForSelector('.main-container', { visible: true });
    
    // 지식베이스 탭에서 모바일 레이아웃 확인
    await page.click('#knowledge-tab');
    await page.waitForTimeout(1000);
    
    const mobileLayout = await page.evaluate(() => {
      const container = document.querySelector('.knowledge-container');
      return container ? window.getComputedStyle(container).flexDirection : null;
    });
    
    if (mobileLayout !== 'column') {
      throw new Error('모바일에서 레이아웃이 세로 방향으로 변경되지 않음');
    }
    
    testReport.testResults.responsiveDesign = {
      status: 'PASS',
      desktopLayout: desktopLayout,
      mobileLayout: mobileLayout,
      viewportsTested: ['1920x1080', '375x667'],
      timestamp: new Date().toISOString()
    };
    
    testReport.summary.passedTests++;
    console.log('✅ 반응형 디자인 테스트 통과');
    
  } catch (error) {
    testReport.testResults.responsiveDesign = {
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    testReport.summary.failedTests++;
    testReport.errors.push(`반응형 디자인: ${error.message}`);
    console.error('❌ 반응형 디자인 테스트 실패:', error.message);
  }
}

// 테스트 실행
runOntologyTests().catch(console.error);