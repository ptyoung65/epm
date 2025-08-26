/**
 * AIRIS EPM - E2E 대시보드 테스트
 * Puppeteer 기반 브라우저 자동화 테스트
 */

const puppeteer = require('puppeteer');
const path = require('path');

// E2E 테스트 설정
const E2E_CONFIG = {
  baseUrl: 'http://localhost:3002',
  viewport: { width: 1920, height: 1080 },
  timeout: 30000,
  waitForSelector: 5000,
  screenshotPath: '/home/ptyoung/work/AIRIS_EPM/tests/screenshots'
};

class DashboardE2ETest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  // 브라우저 초기화
  async initialize() {
    console.log('🚀 E2E 테스트 환경 초기화...');
    
    this.browser = await puppeteer.launch({
      headless: true, // CI/CD에서는 true, 개발시에는 false
      viewport: E2E_CONFIG.viewport,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote'
      ]
    });
    
    this.page = await this.browser.newPage();
    await this.page.setViewport(E2E_CONFIG.viewport);
    
    // 콘솔 에러 캐치
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`📱 브라우저 에러: ${msg.text()}`);
      }
    });
    
    // 네트워크 요청 실패 캐치
    this.page.on('requestfailed', request => {
      console.log(`🌐 요청 실패: ${request.failure().errorText} ${request.url()}`);
    });
  }

  // 전체 E2E 테스트 실행
  async runAllTests() {
    console.log('🎯 대시보드 E2E 테스트 시작...');
    const startTime = Date.now();
    
    try {
      await this.initialize();
      
      // 1. 메인 대시보드 테스트
      await this.testMainDashboard();
      
      // 2. Executive 대시보드 테스트
      await this.testExecutiveDashboard();
      
      // 3. AI 예측 대시보드 테스트
      await this.testAIPredictionDashboard();
      
      // 4. Strategic KPI 대시보드 테스트
      await this.testStrategicKPIDashboard();
      
      // 5. 알림 대시보드 테스트
      await this.testAlertsDashboard();
      
      // 6. 반응형 디자인 테스트
      await this.testResponsiveDesign();
      
      // 7. 사용자 인터랙션 테스트
      await this.testUserInteractions();
      
      // 8. 성능 테스트
      await this.testPerformance();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      await this.generateTestReport(duration);
      
    } catch (error) {
      console.error('❌ E2E 테스트 실행 중 오류:', error);
      this.results.errors.push({
        test: 'E2E Test Suite',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  // 1. 메인 대시보드 테스트
  async testMainDashboard() {
    console.log('\n📊 메인 대시보드 테스트...');
    
    await this.runE2ETest('Main Dashboard Load', async () => {
      await this.page.goto(E2E_CONFIG.baseUrl, { waitUntil: 'networkidle2' });
      
      // 페이지 제목 확인
      const title = await this.page.title();
      if (!title.includes('AIRIS EPM')) {
        throw new Error(`Invalid page title: ${title}`);
      }
      
      // 메인 네비게이션 확인
      await this.page.waitForSelector('nav', { timeout: E2E_CONFIG.waitForSelector });
      const navExists = await this.page.$('nav') !== null;
      if (!navExists) {
        throw new Error('Main navigation not found');
      }
      
      // 대시보드 카드들 확인
      await this.page.waitForSelector('.dashboard-card', { timeout: E2E_CONFIG.waitForSelector });
      const cardCount = await this.page.$$eval('.dashboard-card', cards => cards.length);
      if (cardCount < 4) { // 최소 4개 카드 기대
        throw new Error(`Insufficient dashboard cards: ${cardCount}`);
      }
      
      await this.takeScreenshot('main-dashboard');
    });

    // 네비게이션 메뉴 테스트
    await this.runE2ETest('Navigation Menu', async () => {
      // 모든 메뉴 링크 확인
      const menuLinks = await this.page.$$eval('nav a', links => 
        links.map(link => ({ text: link.textContent, href: link.href }))
      );
      
      const expectedMenus = ['Executive Dashboard', 'AI Prediction', 'Strategic KPI', 'Alerts'];
      for (const menu of expectedMenus) {
        const found = menuLinks.some(link => link.text.includes(menu));
        if (!found) {
          throw new Error(`Menu not found: ${menu}`);
        }
      }
    });
  }

  // 2. Executive 대시보드 테스트
  async testExecutiveDashboard() {
    console.log('\n👔 Executive 대시보드 테스트...');
    
    await this.runE2ETest('Executive Dashboard Load', async () => {
      await this.page.goto(`${E2E_CONFIG.baseUrl}/executive-dashboard`, { waitUntil: 'networkidle2' });
      
      // KPI 카드들 로딩 확인
      await this.page.waitForSelector('.kpi-card', { timeout: E2E_CONFIG.waitForSelector });
      const kpiCards = await this.page.$$('.kpi-card');
      if (kpiCards.length < 8) { // 최소 8개 KPI 기대
        throw new Error(`Insufficient KPI cards: ${kpiCards.length}`);
      }
      
      await this.takeScreenshot('executive-dashboard');
    });

    // KPI 실시간 업데이트 테스트
    await this.runE2ETest('KPI Real-time Update', async () => {
      // 초기 KPI 값 캡처
      const initialValues = await this.page.$$eval('.kpi-value', 
        elements => elements.map(el => el.textContent)
      );
      
      // 5초 대기 후 값 변경 확인
      await this.page.waitForTimeout(5000);
      
      const updatedValues = await this.page.$$eval('.kpi-value',
        elements => elements.map(el => el.textContent)
      );
      
      // 일부 값이 변경되었는지 확인 (실시간 업데이트)
      const hasUpdates = initialValues.some((value, index) => 
        value !== updatedValues[index]
      );
      
      if (!hasUpdates) {
        console.warn('⚠️ No real-time KPI updates detected');
      }
    });

    // Critical Alerts 섹션 테스트
    await this.runE2ETest('Critical Alerts Section', async () => {
      await this.page.waitForSelector('.critical-alerts', { timeout: E2E_CONFIG.waitForSelector });
      
      // 알림 리스트 확인
      const alertItems = await this.page.$$('.alert-item');
      console.log(`📊 Critical alerts found: ${alertItems.length}`);
      
      // 알림이 있는 경우 상세 내용 확인
      if (alertItems.length > 0) {
        const firstAlert = await alertItems[0].$('.alert-message');
        if (!firstAlert) {
          throw new Error('Alert message not found');
        }
      }
    });
  }

  // 3. AI 예측 대시보드 테스트
  async testAIPredictionDashboard() {
    console.log('\n🤖 AI 예측 대시보드 테스트...');
    
    await this.runE2ETest('AI Prediction Dashboard Load', async () => {
      await this.page.goto(`${E2E_CONFIG.baseUrl}/ai-prediction-dashboard`, { waitUntil: 'networkidle2' });
      
      // 모델 상태 카드들 확인
      await this.page.waitForSelector('.model-card', { timeout: E2E_CONFIG.waitForSelector });
      const modelCards = await this.page.$$('.model-card');
      if (modelCards.length < 4) { // 4개 모델 기대
        throw new Error(`Insufficient model cards: ${modelCards.length}`);
      }
      
      await this.takeScreenshot('ai-prediction-dashboard');
    });

    // 예측 차트 테스트
    await this.runE2ETest('Prediction Charts', async () => {
      // Chart.js 캔버스 확인
      await this.page.waitForSelector('canvas', { timeout: E2E_CONFIG.waitForSelector });
      const charts = await this.page.$$('canvas');
      if (charts.length < 2) {
        throw new Error(`Insufficient charts: ${charts.length}`);
      }
      
      // 차트 렌더링 완료 대기
      await this.page.waitForTimeout(3000);
      
      // 차트가 실제로 그려졌는지 확인 (픽셀 데이터 검사)
      const hasData = await this.page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // 투명하지 않은 픽셀이 있는지 확인
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) return true;
        }
        return false;
      });
      
      if (!hasData) {
        throw new Error('Charts appear to be empty');
      }
    });

    // 모델 성능 메트릭 테스트
    await this.runE2ETest('Model Performance Metrics', async () => {
      await this.page.waitForSelector('.metrics-table', { timeout: E2E_CONFIG.waitForSelector });
      
      // 메트릭 테이블 확인
      const metricsRows = await this.page.$$('.metrics-table tbody tr');
      if (metricsRows.length === 0) {
        throw new Error('No performance metrics found');
      }
      
      // 필수 메트릭 컬럼 확인
      const headers = await this.page.$$eval('.metrics-table th',
        elements => elements.map(el => el.textContent.toLowerCase())
      );
      
      const requiredHeaders = ['모델', 'accuracy', 'mse', 'status'];
      for (const header of requiredHeaders) {
        if (!headers.some(h => h.includes(header))) {
          throw new Error(`Missing metric header: ${header}`);
        }
      }
    });
  }

  // 4. Strategic KPI 대시보드 테스트
  async testStrategicKPIDashboard() {
    console.log('\n🎯 Strategic KPI 대시보드 테스트...');
    
    await this.runE2ETest('Strategic KPI Dashboard Load', async () => {
      await this.page.goto(`${E2E_CONFIG.baseUrl}/strategic-kpi-dashboard`, { waitUntil: 'networkidle2' });
      
      // KPI 카테고리 탭들 확인
      await this.page.waitForSelector('.kpi-tabs', { timeout: E2E_CONFIG.waitForSelector });
      const tabs = await this.page.$$('.kpi-tabs .tab');
      if (tabs.length < 4) { // 4개 카테고리 기대
        throw new Error(`Insufficient KPI category tabs: ${tabs.length}`);
      }
      
      await this.takeScreenshot('strategic-kpi-dashboard');
    });

    // KPI 카테고리 탭 전환 테스트
    await this.runE2ETest('KPI Category Tab Switching', async () => {
      const tabs = await this.page.$$('.kpi-tabs .tab');
      
      for (let i = 0; i < tabs.length; i++) {
        await tabs[i].click();
        await this.page.waitForTimeout(1000); // 탭 전환 애니메이션 대기
        
        // 해당 카테고리의 KPI들이 로드되었는지 확인
        const kpiItems = await this.page.$$('.kpi-grid .kpi-item');
        if (kpiItems.length === 0) {
          throw new Error(`No KPIs loaded for tab ${i}`);
        }
      }
    });

    // KPI 목표 대비 진행률 테스트
    await this.runE2ETest('KPI Progress vs Goals', async () => {
      await this.page.waitForSelector('.progress-bar', { timeout: E2E_CONFIG.waitForSelector });
      
      // 진행률 바 확인
      const progressBars = await this.page.$$('.progress-bar');
      if (progressBars.length === 0) {
        throw new Error('No progress bars found');
      }
      
      // 진행률 값 검증
      const progressValues = await this.page.$$eval('.progress-percentage',
        elements => elements.map(el => parseInt(el.textContent))
      );
      
      for (const value of progressValues) {
        if (isNaN(value) || value < 0 || value > 100) {
          throw new Error(`Invalid progress value: ${value}`);
        }
      }
    });
  }

  // 5. 알림 대시보드 테스트
  async testAlertsDashboard() {
    console.log('\n🚨 알림 대시보드 테스트...');
    
    await this.runE2ETest('Alerts Dashboard Load', async () => {
      await this.page.goto(`${E2E_CONFIG.baseUrl}/alerts-dashboard`, { waitUntil: 'networkidle2' });
      
      // 알림 필터 확인
      await this.page.waitForSelector('.alert-filters', { timeout: E2E_CONFIG.waitForSelector });
      const filters = await this.page.$$('.alert-filters .filter-btn');
      if (filters.length < 3) { // 최소 3개 필터 (all, critical, active)
        throw new Error(`Insufficient alert filters: ${filters.length}`);
      }
      
      await this.takeScreenshot('alerts-dashboard');
    });

    // 알림 필터링 테스트
    await this.runE2ETest('Alert Filtering', async () => {
      // Critical 알림 필터 클릭
      const criticalFilter = await this.page.$('.filter-btn[data-severity="critical"]');
      if (criticalFilter) {
        await criticalFilter.click();
        await this.page.waitForTimeout(1000);
        
        // 필터링 결과 확인
        const visibleAlerts = await this.page.$$('.alert-item:not(.hidden)');
        console.log(`📊 Critical alerts visible: ${visibleAlerts.length}`);
      }
      
      // Active 알림 필터 클릭
      const activeFilter = await this.page.$('.filter-btn[data-status="active"]');
      if (activeFilter) {
        await activeFilter.click();
        await this.page.waitForTimeout(1000);
        
        const visibleAlerts = await this.page.$$('.alert-item:not(.hidden)');
        console.log(`📊 Active alerts visible: ${visibleAlerts.length}`);
      }
    });

    // 알림 상세보기 모달 테스트
    await this.runE2ETest('Alert Details Modal', async () => {
      const alertItems = await this.page.$$('.alert-item');
      if (alertItems.length > 0) {
        // 첫 번째 알림 클릭
        await alertItems[0].click();
        await this.page.waitForTimeout(1000);
        
        // 모달 확인
        const modal = await this.page.$('.modal, .alert-modal');
        if (!modal) {
          console.warn('⚠️ Alert details modal not found');
          return;
        }
        
        // 모달 닫기
        const closeBtn = await this.page.$('.modal-close, .close-btn');
        if (closeBtn) {
          await closeBtn.click();
        }
      }
    });
  }

  // 6. 반응형 디자인 테스트
  async testResponsiveDesign() {
    console.log('\n📱 반응형 디자인 테스트...');
    
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 }
    ];

    for (const viewport of viewports) {
      await this.runE2ETest(`Responsive - ${viewport.name}`, async () => {
        await this.page.setViewport(viewport);
        await this.page.goto(E2E_CONFIG.baseUrl, { waitUntil: 'networkidle2' });
        
        // 레이아웃이 깨지지 않았는지 확인
        const isLayoutBroken = await this.page.evaluate(() => {
          // 수평 스크롤바가 생겼는지 확인
          return document.body.scrollWidth > window.innerWidth;
        });
        
        if (isLayoutBroken) {
          throw new Error(`Layout broken on ${viewport.name}`);
        }
        
        // 네비게이션 메뉴 확인
        if (viewport.width < 768) {
          // 모바일에서는 햄버거 메뉴 확인
          const hamburgerMenu = await this.page.$('.hamburger-menu, .mobile-menu-toggle');
          if (!hamburgerMenu) {
            console.warn(`⚠️ Mobile navigation not found on ${viewport.name}`);
          }
        }
        
        await this.takeScreenshot(`responsive-${viewport.name.toLowerCase()}`);
      });
    }
  }

  // 7. 사용자 인터랙션 테스트
  async testUserInteractions() {
    console.log('\n🖱️ 사용자 인터랙션 테스트...');
    
    await this.runE2ETest('Chart Tooltips', async () => {
      await this.page.goto(`${E2E_CONFIG.baseUrl}/executive-dashboard`, { waitUntil: 'networkidle2' });
      await this.page.waitForSelector('canvas', { timeout: E2E_CONFIG.waitForSelector });
      
      // 첫 번째 차트에 마우스 호버
      const firstChart = await this.page.$('canvas');
      if (firstChart) {
        await firstChart.hover();
        await this.page.waitForTimeout(500);
        
        // 툴팁이 표시되는지 확인
        const tooltip = await this.page.$('.chartjs-tooltip');
        if (!tooltip) {
          console.warn('⚠️ Chart tooltip not found');
        }
      }
    });

    await this.runE2ETest('Button Interactions', async () => {
      await this.page.goto(`${E2E_CONFIG.baseUrl}/ai-prediction-dashboard`, { waitUntil: 'networkidle2' });
      
      // 새로고침 버튼 클릭 테스트
      const refreshBtn = await this.page.$('.refresh-btn, [data-action="refresh"]');
      if (refreshBtn) {
        const beforeClick = Date.now();
        await refreshBtn.click();
        await this.page.waitForTimeout(2000);
        
        // 버튼이 일시적으로 비활성화되는지 확인 (로딩 상태)
        const isDisabled = await refreshBtn.evaluate(btn => btn.disabled || btn.classList.contains('loading'));
        if (!isDisabled) {
          console.warn('⚠️ Refresh button loading state not detected');
        }
      }
    });

    await this.runE2ETest('Data Table Interactions', async () => {
      await this.page.goto(`${E2E_CONFIG.baseUrl}/alerts-dashboard`, { waitUntil: 'networkidle2' });
      
      // 테이블 정렬 테스트
      const sortableHeaders = await this.page.$$('.sortable-header, th.sortable');
      if (sortableHeaders.length > 0) {
        const initialRows = await this.page.$$eval('tbody tr', rows => 
          rows.map(row => row.textContent)
        );
        
        // 첫 번째 정렬 가능한 헤더 클릭
        await sortableHeaders[0].click();
        await this.page.waitForTimeout(1000);
        
        const sortedRows = await this.page.$$eval('tbody tr', rows => 
          rows.map(row => row.textContent)
        );
        
        // 정렬이 실행되었는지 확인 (순서 변경)
        const wasSorted = JSON.stringify(initialRows) !== JSON.stringify(sortedRows);
        if (!wasSorted) {
          console.warn('⚠️ Table sorting not detected');
        }
      }
    });
  }

  // 8. 성능 테스트
  async testPerformance() {
    console.log('\n⚡ 성능 테스트...');
    
    await this.runE2ETest('Page Load Performance', async () => {
      // 성능 메트릭 수집 시작
      await this.page.goto(E2E_CONFIG.baseUrl, { waitUntil: 'networkidle2' });
      
      const performanceMetrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
          loadComplete: navigation.loadEventEnd - navigation.navigationStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
        };
      });
      
      console.log('📊 성능 메트릭:', performanceMetrics);
      
      // 성능 기준 검증
      if (performanceMetrics.domContentLoaded > 3000) {
        console.warn(`⚠️ Slow DOM content loaded: ${performanceMetrics.domContentLoaded}ms`);
      }
      
      if (performanceMetrics.loadComplete > 5000) {
        throw new Error(`Page load too slow: ${performanceMetrics.loadComplete}ms`);
      }
      
      if (performanceMetrics.firstContentfulPaint > 2000) {
        console.warn(`⚠️ Slow first contentful paint: ${performanceMetrics.firstContentfulPaint}ms`);
      }
    });

    await this.runE2ETest('Memory Usage', async () => {
      // 메모리 사용량 측정
      const memoryInfo = await this.page.evaluate(() => {
        if ('memory' in performance) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          };
        }
        return null;
      });
      
      if (memoryInfo) {
        const usedMB = Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);
        const totalMB = Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024);
        
        console.log(`📊 메모리 사용량: ${usedMB}MB / ${totalMB}MB`);
        
        if (usedMB > 100) { // 100MB 초과
          console.warn(`⚠️ High memory usage: ${usedMB}MB`);
        }
      }
    });
  }

  // E2E 테스트 실행 헬퍼
  async runE2ETest(testName, testFunction) {
    this.results.total++;
    
    try {
      console.log(`  ✓ ${testName}...`);
      await testFunction();
      this.results.passed++;
      console.log(`    ✅ 성공`);
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({
        test: testName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.log(`    ❌ 실패: ${error.message}`);
      
      // 실패시 스크린샷 저장
      await this.takeScreenshot(`error-${testName.replace(/\s+/g, '-').toLowerCase()}`);
    }
  }

  // 스크린샷 저장
  async takeScreenshot(name) {
    try {
      const screenshotPath = path.join(E2E_CONFIG.screenshotPath, `${name}-${Date.now()}.png`);
      await this.page.screenshot({ 
        path: screenshotPath, 
        fullPage: true,
        type: 'png'
      });
      console.log(`📸 스크린샷 저장: ${screenshotPath}`);
    } catch (error) {
      console.log(`📸 스크린샷 저장 실패: ${error.message}`);
    }
  }

  // 테스트 리포트 생성
  async generateTestReport(duration) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 대시보드 E2E 테스트 결과');
    console.log('='.repeat(60));
    console.log(`실행 시간: ${duration}ms`);
    console.log(`전체 테스트: ${this.results.total}`);
    console.log(`성공: ${this.results.passed} ✅`);
    console.log(`실패: ${this.results.failed} ❌`);
    console.log(`성공률: ${Math.round((this.results.passed / this.results.total) * 100)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ 실패한 테스트:');
      this.results.errors.forEach(error => {
        console.log(`  - ${error.test}: ${error.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    // 결과를 파일로 저장
    const report = {
      timestamp: new Date().toISOString(),
      duration,
      results: this.results,
      config: E2E_CONFIG
    };
    
    require('fs').writeFileSync(
      '/home/ptyoung/work/AIRIS_EPM/tests/reports/e2e-test-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('📄 E2E 테스트 리포트 저장: tests/reports/e2e-test-report.json');
  }
}

// 테스트 실행
if (require.main === module) {
  const e2eTest = new DashboardE2ETest();
  e2eTest.runAllTests().then(() => {
    process.exit(e2eTest.results.failed === 0 ? 0 : 1);
  });
}

module.exports = DashboardE2ETest;