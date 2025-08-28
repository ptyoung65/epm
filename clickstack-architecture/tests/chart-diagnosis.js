const { chromium } = require('playwright');

/**
 * ML 학습 페이지들의 차트 크기 증가 문제 진단 스크립트
 * Playwright를 사용하여 차트 요소들의 실제 크기와 동작을 분석
 */
async function diagnoseChartSizeIssues() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // 시각적 분석을 위한 속도 조절
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const pages = [
    {
      name: 'LSTM 장애 예측',
      url: 'http://localhost:3001/ml-training-lstm.html'
    },
    {
      name: 'RCA 분석',
      url: 'http://localhost:3001/ml-training-rca.html'
    },
    {
      name: '클러스터링',
      url: 'http://localhost:3001/ml-training-clustering.html'
    }
  ];

  const results = [];

  for (const pageInfo of pages) {
    console.log(`\n🔍 분석 중: ${pageInfo.name}`);
    console.log(`📍 URL: ${pageInfo.url}`);
    
    const page = await context.newPage();
    
    try {
      // 페이지 로드
      await page.goto(pageInfo.url, { 
        waitUntil: 'networkidle',
        timeout: 10000
      });
      
      // 페이지가 완전히 로드될 때까지 대기
      await page.waitForTimeout(3000);
      
      // 차트 컨테이너 찾기
      const chartContainers = await page.$$eval('canvas, .chart-container, [id*="chart"], [class*="chart"]', 
        elements => elements.map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          width: el.offsetWidth || el.clientWidth,
          height: el.offsetHeight || el.clientHeight,
          styles: {
            width: getComputedStyle(el).width,
            height: getComputedStyle(el).height,
            position: getComputedStyle(el).position,
            display: getComputedStyle(el).display
          }
        }))
      );

      // Chart.js 인스턴스 확인
      const chartInstances = await page.evaluate(() => {
        if (typeof Chart === 'undefined') return [];
        
        return Chart.instances ? Object.keys(Chart.instances).map(key => {
          const chart = Chart.instances[key];
          return {
            id: key,
            type: chart.config.type,
            canvas: {
              width: chart.canvas.width,
              height: chart.canvas.height,
              style: {
                width: chart.canvas.style.width,
                height: chart.canvas.style.height
              }
            },
            options: {
              responsive: chart.config.options?.responsive,
              maintainAspectRatio: chart.config.options?.maintainAspectRatio,
              aspectRatio: chart.config.options?.aspectRatio
            }
          };
        }) : [];
      });

      // 차트 크기 변화 모니터링 시작
      console.log('📊 차트 크기 변화 모니터링 중...');
      
      const sizeChanges = [];
      let monitoringCount = 0;
      
      // 5초 동안 1초마다 차트 크기 측정
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(1000);
        
        const currentSizes = await page.$$eval('canvas', 
          canvases => canvases.map(canvas => ({
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
            timestamp: Date.now()
          }))
        );
        
        sizeChanges.push({
          iteration: i + 1,
          sizes: currentSizes
        });
        
        monitoringCount++;
        console.log(`  📐 측정 ${monitoringCount}: ${currentSizes.length}개 차트 발견`);
      }

      // JavaScript 에러 및 이벤트 리스너 확인
      const jsErrors = [];
      page.on('pageerror', error => {
        jsErrors.push(error.message);
      });

      // 차트 관련 JavaScript 함수 분석
      const jsAnalysis = await page.evaluate(() => {
        const analysis = {
          chartJsLoaded: typeof Chart !== 'undefined',
          windowResizeListeners: [],
          chartUpdateFunctions: [],
          timers: []
        };

        // 글로벌 변수에서 차트 관련 함수 찾기
        for (let prop in window) {
          if (typeof window[prop] === 'function' && 
              (prop.toLowerCase().includes('chart') || 
               prop.toLowerCase().includes('update') ||
               prop.toLowerCase().includes('resize'))) {
            analysis.chartUpdateFunctions.push(prop);
          }
        }

        return analysis;
      });

      // CSS 미디어 쿼리 및 반응형 속성 확인
      const cssAnalysis = await page.evaluate(() => {
        const styles = Array.from(document.styleSheets).flatMap(sheet => {
          try {
            return Array.from(sheet.cssRules);
          } catch (e) {
            return [];
          }
        });

        return {
          mediaQueries: styles.filter(rule => rule.type === CSSRule.MEDIA_RULE)
                               .map(rule => rule.conditionText),
          containerQueries: styles.filter(rule => rule.selectorText?.includes('container'))
                                 .map(rule => rule.cssText)
        };
      });

      const pageResult = {
        page: pageInfo.name,
        url: pageInfo.url,
        chartContainers,
        chartInstances,
        sizeChanges,
        jsAnalysis,
        cssAnalysis,
        jsErrors,
        timestamp: new Date().toISOString()
      };

      results.push(pageResult);

      // 상세 분석 결과 출력
      console.log(`\n📊 ${pageInfo.name} 분석 결과:`);
      console.log(`  📦 차트 컨테이너: ${chartContainers.length}개`);
      console.log(`  🎯 Chart.js 인스턴스: ${chartInstances.length}개`);
      console.log(`  📐 크기 변화 기록: ${sizeChanges.length}회`);
      console.log(`  ⚠️  JavaScript 에러: ${jsErrors.length}개`);

      if (chartInstances.length > 0) {
        chartInstances.forEach((chart, index) => {
          console.log(`    차트 ${index + 1}: ${chart.type}, 반응형: ${chart.options.responsive}, 비율유지: ${chart.options.maintainAspectRatio}`);
        });
      }

    } catch (error) {
      console.error(`❌ ${pageInfo.name} 분석 실패:`, error.message);
      results.push({
        page: pageInfo.name,
        url: pageInfo.url,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      await page.close();
    }
  }

  await browser.close();
  return results;
}

/**
 * 차트 크기 문제 근본 원인 분석
 */
function analyzeChartSizeIssues(results) {
  console.log('\n🔎 차트 크기 문제 근본 원인 분석');
  console.log('=' .repeat(60));

  const issues = [];
  const recommendations = [];

  results.forEach(result => {
    if (result.error) {
      issues.push(`❌ ${result.page}: 페이지 로드 실패 - ${result.error}`);
      return;
    }

    console.log(`\n📊 ${result.page} 상세 분석:`);

    // Chart.js 설정 문제 확인
    result.chartInstances?.forEach((chart, index) => {
      console.log(`\n  차트 ${index + 1} (${chart.type}):`);
      console.log(`    🎯 반응형: ${chart.options.responsive}`);
      console.log(`    📐 비율 유지: ${chart.options.maintainAspectRatio}`);
      console.log(`    📏 종횡비: ${chart.options.aspectRatio}`);
      console.log(`    📦 캔버스 크기: ${chart.canvas.width}x${chart.canvas.height}`);
      console.log(`    🎨 스타일 크기: ${chart.canvas.style.width} x ${chart.canvas.style.height}`);

      // 문제 진단
      if (chart.options.responsive === true && chart.options.maintainAspectRatio !== false) {
        issues.push(`⚠️  ${result.page} 차트 ${index + 1}: maintainAspectRatio가 true로 설정되어 크기가 변동할 수 있음`);
        recommendations.push(`🔧 ${result.page} 차트 ${index + 1}: maintainAspectRatio를 false로 설정하거나 고정 aspectRatio 사용`);
      }

      if (!chart.options.aspectRatio && chart.options.maintainAspectRatio) {
        issues.push(`⚠️  ${result.page} 차트 ${index + 1}: aspectRatio가 설정되지 않아 기본 비율로 크기가 계산됨`);
        recommendations.push(`🔧 ${result.page} 차트 ${index + 1}: 고정 aspectRatio 값 설정 (예: 2.0)`);
      }
    });

    // 컨테이너 CSS 문제 확인
    result.chartContainers?.forEach((container, index) => {
      console.log(`\n  컨테이너 ${index + 1}:`);
      console.log(`    🏷️  태그: ${container.tagName}`);
      console.log(`    📦 실제 크기: ${container.width}x${container.height}`);
      console.log(`    🎨 CSS 크기: ${container.styles.width} x ${container.styles.height}`);
      console.log(`    📍 포지션: ${container.styles.position}`);

      if (container.styles.width === 'auto' || container.styles.height === 'auto') {
        issues.push(`⚠️  ${result.page} 컨테이너 ${index + 1}: width 또는 height가 auto로 설정되어 동적 크기 변경 가능`);
        recommendations.push(`🔧 ${result.page} 컨테이너 ${index + 1}: 고정 width, height 값 설정`);
      }

      if (container.styles.position === 'static' && container.tagName === 'CANVAS') {
        recommendations.push(`💡 ${result.page} 컨테이너 ${index + 1}: 컨테이너에 고정 크기 설정 고려`);
      }
    });

    // 크기 변화 패턴 분석
    if (result.sizeChanges && result.sizeChanges.length > 0) {
      console.log(`\n  📐 크기 변화 분석:`);
      
      const firstMeasurement = result.sizeChanges[0];
      const lastMeasurement = result.sizeChanges[result.sizeChanges.length - 1];
      
      firstMeasurement.sizes.forEach((firstSize, index) => {
        if (lastMeasurement.sizes[index]) {
          const lastSize = lastMeasurement.sizes[index];
          const widthChange = lastSize.width - firstSize.width;
          const heightChange = lastSize.height - firstSize.height;
          
          console.log(`    차트 ${index + 1}: 폭 ${widthChange >= 0 ? '+' : ''}${widthChange}px, 높이 ${heightChange >= 0 ? '+' : ''}${heightChange}px`);
          
          if (Math.abs(widthChange) > 10 || Math.abs(heightChange) > 10) {
            issues.push(`🚨 ${result.page} 차트 ${index + 1}: 5초간 폭 ${widthChange}px, 높이 ${heightChange}px 변화 감지`);
          }
        }
      });
    }

    // JavaScript 에러 확인
    if (result.jsErrors?.length > 0) {
      console.log(`\n  ⚠️  JavaScript 에러:`);
      result.jsErrors.forEach(error => console.log(`    - ${error}`));
    }
  });

  console.log('\n📋 발견된 문제점들:');
  issues.forEach(issue => console.log(issue));

  console.log('\n🔧 권장 해결방안:');
  recommendations.forEach(rec => console.log(rec));

  return { issues, recommendations };
}

/**
 * 구체적인 해결 방안 생성
 */
function generateSolutions(analysisResult) {
  console.log('\n💡 구체적인 해결 방안');
  console.log('=' .repeat(60));

  const solutions = [
    {
      title: '1. Chart.js 설정 최적화',
      code: `
// Chart.js 초기화 시 다음 옵션 적용
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false, // 컨테이너 크기에 맞춤
  // 또는 고정 비율 사용:
  // maintainAspectRatio: true,
  // aspectRatio: 2, // 고정 비율 설정
  plugins: {
    legend: {
      display: true
    }
  },
  scales: {
    x: {
      display: true
    },
    y: {
      display: true
    }
  }
};`
    },
    {
      title: '2. CSS 컨테이너 고정 크기 설정',
      code: `
/* 차트 컨테이너에 고정 크기 적용 */
.chart-container {
  width: 800px !important;
  height: 400px !important;
  position: relative;
  overflow: hidden;
}

/* 반응형이 필요한 경우 최대/최소 크기 제한 */
.chart-container {
  width: 100%;
  height: 400px;
  max-width: 1200px;
  min-height: 300px;
  position: relative;
}

/* Canvas 직접 제어 */
canvas {
  max-width: 100% !important;
  height: auto !important;
}`
    },
    {
      title: '3. JavaScript 업데이트 로직 최적화',
      code: `
// 차트 업데이트 시 크기 변경 방지
function updateChart(chart, newData) {
  // 크기 변경 없이 데이터만 업데이트
  chart.data = newData;
  chart.update('none'); // 애니메이션 없이 업데이트
}

// 리사이즈 이벤트 디바운싱
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // 리사이즈 후 차트 크기 재조정
    Chart.instances.forEach(chart => {
      chart.resize();
    });
  }, 250);
});`
    },
    {
      title: '4. 페이지별 개별 수정 방안',
      code: `
<!-- HTML 구조 개선 -->
<div class="ml-chart-wrapper">
  <div class="chart-container" style="width: 800px; height: 400px;">
    <canvas id="lstmChart"></canvas>
  </div>
</div>

<script>
// 각 페이지의 차트 초기화 개선
const ctx = document.getElementById('lstmChart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'line',
  data: chartData,
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0 // 크기 변경 시 애니메이션 제거
    }
  }
});
</script>`
    }
  ];

  solutions.forEach(solution => {
    console.log(`\n${solution.title}:`);
    console.log(solution.code);
  });

  return solutions;
}

// 메인 실행 함수
async function main() {
  console.log('🎯 ML 학습 페이지 차트 크기 진단 시작');
  console.log('=' .repeat(60));

  try {
    // 차트 크기 문제 진단
    const results = await diagnoseChartSizeIssues();
    
    // 결과 분석
    const analysis = analyzeChartSizeIssues(results);
    
    // 해결 방안 생성
    const solutions = generateSolutions(analysis);
    
    // 결과를 JSON 파일로 저장
    const fs = require('fs');
    const reportData = {
      timestamp: new Date().toISOString(),
      results,
      analysis,
      solutions: solutions.map(s => ({ title: s.title, code: s.code }))
    };
    
    fs.writeFileSync('chart-diagnosis-report.json', JSON.stringify(reportData, null, 2));
    console.log('\n💾 상세 분석 결과가 chart-diagnosis-report.json에 저장되었습니다.');
    
  } catch (error) {
    console.error('❌ 진단 중 오류 발생:', error.message);
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  diagnoseChartSizeIssues,
  analyzeChartSizeIssues,
  generateSolutions
};