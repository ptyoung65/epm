const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 테스트 결과 저장을 위한 변수
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

test.describe('온톨로지 뷰어 종합 테스트', () => {
  
  test.beforeAll(async () => {
    console.log('🧪 온톨로지 뷰어 종합 테스트 시작');
    testReport.testResults.startTime = new Date().toISOString();
  });

  test.afterAll(async () => {
    // 테스트 보고서 저장
    const reportPath = path.join(__dirname, 'ontology-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2), 'utf8');
    console.log('📄 테스트 보고서가 저장되었습니다:', reportPath);
    
    console.log('📊 테스트 요약:');
    console.log(`- 총 테스트: ${testReport.summary.totalTests}`);
    console.log(`- 통과: ${testReport.summary.passedTests}`);
    console.log(`- 실패: ${testReport.summary.failedTests}`);
    console.log(`- 성공률: ${((testReport.summary.passedTests / testReport.summary.totalTests) * 100).toFixed(1)}%`);
  });

  test('1. 페이지 초기 로드 테스트', async ({ page }) => {
    testReport.summary.totalTests++;
    
    try {
      // 페이지 로드
      console.log('🌐 페이지 로딩 중...');
      await page.goto('http://localhost:3001/ontology.html', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // 페이지 제목 확인
      const title = await page.title();
      expect(title).toContain('AIRIS APM - 온톨로지 시각화');

      // 주요 요소들이 로드되었는지 확인
      await expect(page.locator('.main-container')).toBeVisible();
      await expect(page.locator('.header-section')).toBeVisible();
      await expect(page.locator('.stats-panel')).toBeVisible();
      await expect(page.locator('.tab-navigation')).toBeVisible();

      // 탭들이 있는지 확인
      await expect(page.locator('#graph-tab')).toBeVisible();
      await expect(page.locator('#knowledge-tab')).toBeVisible();
      await expect(page.locator('#structure-tab')).toBeVisible();

      // 통계 패널의 숫자들이 업데이트되었는지 확인 (0이 아닌 값)
      const totalNodes = await page.locator('#total-nodes').textContent();
      const totalRelations = await page.locator('#total-relations').textContent();
      const totalCategories = await page.locator('#total-categories').textContent();
      
      expect(parseInt(totalNodes)).toBeGreaterThan(0);
      expect(parseInt(totalRelations)).toBeGreaterThan(0);
      expect(parseInt(totalCategories)).toBeGreaterThan(0);

      // 초기 로드 스크린샷
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
      throw error;
    }
  });

  test('2. 그래프 시각화 탭 테스트', async ({ page }) => {
    testReport.summary.totalTests++;
    
    try {
      await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });

      // 그래프 탭이 기본적으로 활성화되어 있는지 확인
      const graphTab = page.locator('#graph-tab');
      await expect(graphTab).toHaveClass(/active/);

      // 그래프 컨테이너가 보이는지 확인
      const graphPanel = page.locator('#graph-panel');
      await expect(graphPanel).toBeVisible();
      await expect(graphPanel).toHaveClass(/show active/);

      // SVG 그래프가 렌더링되었는지 확인
      const graphSvg = page.locator('#graph-svg');
      await expect(graphSvg).toBeVisible();

      // D3.js가 실제로 노드와 링크를 생성했는지 확인
      await page.waitForTimeout(2000); // D3 애니메이션 완료 대기

      const nodes = await page.locator('#graph-svg circle.node').count();
      const links = await page.locator('#graph-svg line.link').count();
      const labels = await page.locator('#graph-svg text.node-label').count();

      expect(nodes).toBeGreaterThan(0);
      expect(links).toBeGreaterThan(0);
      expect(labels).toBeGreaterThan(0);

      console.log(`📊 그래프 요소 수: 노드 ${nodes}개, 링크 ${links}개, 라벨 ${labels}개`);

      // 그래프 컨트롤 버튼들이 동작하는지 확인
      const resetBtn = page.locator('button:has-text("리셋")');
      const centerBtn = page.locator('button:has-text("센터링")');
      
      await expect(resetBtn).toBeVisible();
      await expect(centerBtn).toBeVisible();

      // 리셋 버튼 클릭 테스트
      await resetBtn.click();
      await page.waitForTimeout(500);

      // 센터링 버튼 클릭 테스트
      await centerBtn.click();
      await page.waitForTimeout(500);

      // 범례가 표시되는지 확인
      await expect(page.locator('.graph-legend')).toBeVisible();
      const legendItems = await page.locator('.legend-item').count();
      expect(legendItems).toBeGreaterThan(0);

      // 노드 상호작용 테스트 (첫 번째 노드에 호버)
      const firstNode = page.locator('#graph-svg circle.node').first();
      await firstNode.hover();
      
      // 툴팁이 나타나는지 확인
      const tooltip = page.locator('.tooltip');
      await expect(tooltip).toBeVisible();

      // 그래프 탭 스크린샷
      const screenshotPath = path.join(__dirname, 'screenshots', '02-graph-tab.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      testReport.screenshots.push('02-graph-tab.png');

      testReport.testResults.graphTab = {
        status: 'PASS',
        graphElements: { nodes, links, labels, legendItems },
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
      throw error;
    }
  });

  test('3. 지식베이스 탭 테스트', async ({ page }) => {
    testReport.summary.totalTests++;
    
    try {
      await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });

      // 지식베이스 탭 클릭
      const knowledgeTab = page.locator('#knowledge-tab');
      await knowledgeTab.click();
      await page.waitForTimeout(1000);

      // 탭이 활성화되었는지 확인
      await expect(knowledgeTab).toHaveClass(/active/);

      // 지식베이스 패널이 표시되는지 확인
      const knowledgePanel = page.locator('#knowledge-panel');
      await expect(knowledgePanel).toBeVisible();
      await expect(knowledgePanel).toHaveClass(/show active/);

      // 좌우 레이아웃 확인
      const categoriesPanel = page.locator('.categories-panel');
      const contentPanel = page.locator('.content-panel');
      
      await expect(categoriesPanel).toBeVisible();
      await expect(contentPanel).toBeVisible();

      // 카테고리들이 로드되었는지 확인
      const categories = page.locator('#knowledge-categories .category-btn');
      const categoryCount = await categories.count();
      expect(categoryCount).toBeGreaterThan(0);

      console.log(`📚 카테고리 수: ${categoryCount}개`);

      // 첫 번째 카테고리가 자동 선택되었는지 확인
      const firstCategory = categories.first();
      await expect(firstCategory).toHaveClass(/active/);

      // 컨텐츠가 표시되는지 확인
      const knowledgeContent = page.locator('#knowledge-content');
      await expect(knowledgeContent).toBeVisible();
      
      const contentTitle = await knowledgeContent.locator('h4').first().textContent();
      expect(contentTitle).toBeTruthy();

      // 지식베이스 탭 스크린샷 (초기 상태)
      let screenshotPath = path.join(__dirname, 'screenshots', '03-knowledge-base-tab.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      testReport.screenshots.push('03-knowledge-base-tab.png');

      // 다른 카테고리 클릭 테스트
      if (categoryCount > 1) {
        const secondCategory = categories.nth(1);
        await secondCategory.click();
        await page.waitForTimeout(500);

        // 두 번째 카테고리가 활성화되었는지 확인
        await expect(secondCategory).toHaveClass(/active/);
        await expect(firstCategory).not.toHaveClass(/active/);

        // 컨텐츠가 변경되었는지 확인
        const newContentTitle = await knowledgeContent.locator('h4').first().textContent();
        expect(newContentTitle).toBeTruthy();
        expect(newContentTitle).not.toBe(contentTitle);

        // 카테고리 클릭 후 스크린샷
        screenshotPath = path.join(__dirname, 'screenshots', '04-category-clicked.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        testReport.screenshots.push('04-category-clicked.png');
      }

      // 지식 아이템들이 표시되는지 확인
      const knowledgeItems = page.locator('.knowledge-item');
      const itemCount = await knowledgeItems.count();
      expect(itemCount).toBeGreaterThan(0);

      testReport.testResults.knowledgeTab = {
        status: 'PASS',
        categoryCount: categoryCount,
        itemCount: itemCount,
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
      throw error;
    }
  });

  test('4. 계층구조 탭 테스트', async ({ page }) => {
    testReport.summary.totalTests++;
    
    try {
      await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });

      // 계층구조 탭 클릭
      const structureTab = page.locator('#structure-tab');
      await structureTab.click();
      await page.waitForTimeout(1000);

      // 탭이 활성화되었는지 확인
      await expect(structureTab).toHaveClass(/active/);

      // 구조 패널이 표시되는지 확인
      const structurePanel = page.locator('#structure-panel');
      await expect(structurePanel).toBeVisible();
      await expect(structurePanel).toHaveClass(/show active/);

      // 트리 구조 컨테이너 확인
      const structureContainer = page.locator('.structure-container');
      await expect(structureContainer).toBeVisible();

      // 트리 구조가 로드되었는지 확인
      const treeStructure = page.locator('#tree-structure');
      await expect(treeStructure).toBeVisible();

      // 트리 노드들이 있는지 확인
      const treeNodes = page.locator('.tree-node');
      const nodeCount = await treeNodes.count();
      expect(nodeCount).toBeGreaterThan(0);

      console.log(`🌲 트리 노드 수: ${nodeCount}개`);

      // 트리 자식 요소들이 있는지 확인
      const treeChildren = page.locator('.tree-children');
      const childrenCount = await treeChildren.count();
      expect(childrenCount).toBeGreaterThan(0);

      // 첫 번째 최상위 노드가 확장된 상태인지 확인 (기본적으로 확장되어 있어야 함)
      const firstTreeNode = treeNodes.first();
      const firstChildren = page.locator('.tree-children').first();
      
      const isVisible = await firstChildren.isVisible();
      expect(isVisible).toBe(true);

      // 토글 기능 테스트
      await firstTreeNode.click();
      await page.waitForTimeout(500);

      // 클릭 후 상태 확인 (축소되어야 함)
      const isHiddenAfterClick = await firstChildren.isHidden();
      expect(isHiddenAfterClick).toBe(true);

      // 다시 클릭하여 확장
      await firstTreeNode.click();
      await page.waitForTimeout(500);

      const isVisibleAfterSecondClick = await firstChildren.isVisible();
      expect(isVisibleAfterSecondClick).toBe(true);

      // 트리 토글 아이콘 확인
      const toggleIcons = page.locator('.tree-toggle');
      const toggleCount = await toggleIcons.count();
      expect(toggleCount).toBeGreaterThan(0);

      // 계층구조 탭 스크린샷
      const screenshotPath = path.join(__dirname, 'screenshots', '05-structure-tab.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      testReport.screenshots.push('05-structure-tab.png');

      testReport.testResults.structureTab = {
        status: 'PASS',
        nodeCount: nodeCount,
        childrenCount: childrenCount,
        toggleCount: toggleCount,
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
      throw error;
    }
  });

  test('5. 브라우저 콘솔 에러 확인', async ({ page }) => {
    testReport.summary.totalTests++;
    
    try {
      const consoleErrors = [];
      const consoleWarnings = [];
      
      // 콘솔 메시지 수집
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        } else if (message.type() === 'warning') {
          consoleWarnings.push(message.text());
        }
      });

      // 페이지 로드 및 모든 탭 클릭
      await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 각 탭을 클릭하여 JavaScript 실행
      await page.locator('#knowledge-tab').click();
      await page.waitForTimeout(1000);
      
      await page.locator('#structure-tab').click();
      await page.waitForTimeout(1000);
      
      await page.locator('#graph-tab').click();
      await page.waitForTimeout(1000);

      // 그래프 상호작용 테스트
      const nodes = page.locator('#graph-svg circle.node');
      const nodeCount = await nodes.count();
      if (nodeCount > 0) {
        await nodes.first().hover();
        await page.waitForTimeout(500);
        await nodes.first().click();
        await page.waitForTimeout(1000);
      }

      // 결과 평가
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
        throw new Error(`중요한 콘솔 에러 ${criticalErrors.length}개 발견`);
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
      throw error;
    }
  });

  test('6. 반응형 디자인 테스트', async ({ page }) => {
    testReport.summary.totalTests++;
    
    try {
      await page.goto('http://localhost:3001/ontology.html', { waitUntil: 'networkidle' });

      // 데스크톱 뷰 테스트
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);
      
      await expect(page.locator('.main-container')).toBeVisible();
      const desktopLayout = await page.locator('.knowledge-container').evaluate(el => 
        window.getComputedStyle(el).flexDirection
      );

      // 태블릿 뷰 테스트
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      await expect(page.locator('.main-container')).toBeVisible();

      // 모바일 뷰 테스트  
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      await expect(page.locator('.main-container')).toBeVisible();
      
      // 지식베이스 탭에서 모바일 레이아웃 확인
      await page.locator('#knowledge-tab').click();
      await page.waitForTimeout(1000);
      
      const mobileLayout = await page.locator('.knowledge-container').evaluate(el => 
        window.getComputedStyle(el).flexDirection
      );

      // 모바일에서는 세로 방향이어야 함
      expect(mobileLayout).toBe('column');

      testReport.testResults.responsiveDesign = {
        status: 'PASS',
        desktopLayout: desktopLayout,
        mobileLayout: mobileLayout,
        viewportsTested: ['1920x1080', '768x1024', '375x667'],
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
      throw error;
    }
  });
});