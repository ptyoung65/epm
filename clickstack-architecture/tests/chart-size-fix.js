const { chromium } = require('playwright');

/**
 * 차트 크기 문제 해결을 위한 실시간 CSS 수정 스크립트
 */
async function fixChartSizes() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const pages = [
    {
      name: 'LSTM 장애 예측',
      url: 'http://localhost:3001/ml-training-lstm.html',
      charts: ['metricsTimeSeriesChart', 'failurePatternChart', 'lossChart', 'predictionChart', 'featureImportanceChart']
    },
    {
      name: 'RCA 분석',  
      url: 'http://localhost:3001/ml-training-rca.html',
      charts: ['datasetCompositionChart', 'trainingChart', 'confusionMatrixChart', 'categoryAccuracyChart', 'featureImportanceChart']
    },
    {
      name: '클러스터링',
      url: 'http://localhost:3001/ml-training-clustering.html', 
      charts: ['datasetVisualizationChart', 'clusteringProgressChart', 'clusterAnalysisChart']
    }
  ];

  for (const pageInfo of pages) {
    console.log(`\n🔧 ${pageInfo.name} 차트 크기 수정 중...`);
    
    const page = await context.newPage();
    
    try {
      await page.goto(pageInfo.url, { 
        waitUntil: 'networkidle',
        timeout: 10000
      });
      
      await page.waitForTimeout(3000);

      // 1. CSS에 고정 크기 스타일 추가
      await page.addStyleTag({
        content: `
          /* 차트 컨테이너 고정 크기 */
          .chart-container-fixed {
            width: 100% !important;
            height: 400px !important;
            position: relative !important;
          }
          
          .chart-container-fixed canvas {
            width: 100% !important;
            height: 100% !important;
          }
          
          /* Tailwind w-full h-full 오버라이드 */
          canvas.w-full.h-full {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
          }
          
          /* h-48, h-64 등 Tailwind 높이 클래스 강제 적용 */
          .h-48 {
            height: 12rem !important; /* 192px */
          }
          
          .h-64 {
            height: 16rem !important; /* 256px */
          }
          
          .h-32 {
            height: 8rem !important; /* 128px */
          }
        `
      });

      // 2. JavaScript로 Chart.js 설정 수정
      const modificationResult = await page.evaluate(() => {
        const results = [];
        
        // 기존 Chart.js 인스턴스들에 대해 설정 수정
        if (typeof Chart !== 'undefined' && Chart.instances) {
          Object.values(Chart.instances).forEach((chart, index) => {
            try {
              // 반응형 설정 수정
              chart.options.responsive = true;
              chart.options.maintainAspectRatio = false;
              chart.options.aspectRatio = undefined; // 자동 계산 방지
              
              // 애니메이션 비활성화 (크기 변경 시 깜빡임 방지)
              chart.options.animation = {
                duration: 0
              };
              
              // 차트 업데이트
              chart.update('none');
              
              results.push({
                chartIndex: index,
                success: true,
                canvasSize: {
                  width: chart.canvas.offsetWidth,
                  height: chart.canvas.offsetHeight
                }
              });
            } catch (error) {
              results.push({
                chartIndex: index,
                success: false,
                error: error.message
              });
            }
          });
        }
        
        return results;
      });

      // 3. 차트 컨테이너의 부모 div에 고정 클래스 추가
      for (const chartId of pageInfo.charts) {
        try {
          const containerExists = await page.locator(`#${chartId}`).count() > 0;
          if (containerExists) {
            // 부모 div에 고정 클래스 추가
            await page.evaluate((chartId) => {
              const canvas = document.getElementById(chartId);
              if (canvas && canvas.parentElement) {
                canvas.parentElement.classList.add('chart-container-fixed');
              }
            }, chartId);
            
            console.log(`  ✅ ${chartId} 컨테이너 수정 완료`);
          }
        } catch (error) {
          console.log(`  ❌ ${chartId} 수정 실패:`, error.message);
        }
      }

      console.log(`  📊 Chart.js 인스턴스 수정 결과:`, modificationResult);

      // 4. 5초 후 크기 변화 측정
      console.log(`  📐 수정 후 안정성 테스트 중...`);
      
      const beforeSizes = await page.$$eval('canvas', 
        canvases => canvases.map(canvas => ({
          id: canvas.id,
          width: canvas.offsetWidth,
          height: canvas.offsetHeight
        }))
      );

      await page.waitForTimeout(5000);

      const afterSizes = await page.$$eval('canvas', 
        canvases => canvases.map(canvas => ({
          id: canvas.id,
          width: canvas.offsetWidth,
          height: canvas.offsetHeight
        }))
      );

      console.log(`  📊 크기 안정성 결과:`);
      beforeSizes.forEach((before, index) => {
        const after = afterSizes[index];
        if (after) {
          const widthChange = after.width - before.width;
          const heightChange = after.height - before.height;
          console.log(`    ${before.id}: ${before.width}x${before.height} → ${after.width}x${after.height} (변화: ${widthChange}x${heightChange})`);
        }
      });

      // 스크린샷 촬영 (수정 후 결과 확인)
      await page.screenshot({ 
        path: `chart-fix-${pageInfo.name.replace(/\s+/g, '-')}.png`,
        fullPage: true
      });
      
      console.log(`  📸 수정 결과 스크린샷 저장: chart-fix-${pageInfo.name.replace(/\s+/g, '-')}.png`);

    } catch (error) {
      console.error(`❌ ${pageInfo.name} 수정 실패:`, error.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

// CSS 및 JavaScript 수정 코드 생성
function generateFixCode() {
  console.log('\n📝 적용할 수정 코드');
  console.log('=' .repeat(60));

  const cssFixCode = `
/* ML 학습 페이지 차트 크기 고정 CSS */
<style>
  /* 차트 컨테이너 고정 크기 */
  .ml-chart-container {
    width: 100% !important;
    position: relative !important;
  }
  
  .ml-chart-container.h-32 {
    height: 8rem !important; /* 128px */
  }
  
  .ml-chart-container.h-48 {
    height: 12rem !important; /* 192px */
  }
  
  .ml-chart-container.h-64 {
    height: 16rem !important; /* 256px */
  }
  
  .ml-chart-container canvas {
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
  }
</style>`;

  const jsFixCode = `
// Chart.js 설정 표준화
const standardChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 0 // 크기 변경 시 애니메이션 제거
  },
  plugins: {
    legend: {
      display: true
    }
  }
};

// 차트 초기화 함수 수정 예시
function createFixedChart(canvasId, chartType, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;
  
  return new Chart(ctx, {
    type: chartType,
    data: data,
    options: {
      ...standardChartOptions,
      // 추가 옵션들...
    }
  });
}`;

  const htmlFixCode = `
<!-- HTML 구조 수정 예시 -->
<div class="h-48 ml-chart-container">
  <canvas id="metricsTimeSeriesChart" class="w-full h-full"></canvas>
</div>

<div class="h-64 ml-chart-container">
  <canvas id="lossChart" class="w-full h-full"></canvas>
</div>`;

  console.log('1. CSS 수정:');
  console.log(cssFixCode);
  
  console.log('\n2. JavaScript 수정:');
  console.log(jsFixCode);
  
  console.log('\n3. HTML 구조 수정:');
  console.log(htmlFixCode);

  return { cssFixCode, jsFixCode, htmlFixCode };
}

async function main() {
  console.log('🎯 ML 차트 크기 문제 해결 시작');
  console.log('=' .repeat(60));

  try {
    // 실시간 차트 크기 수정 테스트
    await fixChartSizes();
    
    // 수정 코드 생성
    const fixCodes = generateFixCode();
    
    console.log('\n✅ 차트 크기 수정 완료!');
    console.log('📋 수정사항 요약:');
    console.log('  1. CSS로 컨테이너 고정 크기 설정');
    console.log('  2. Chart.js maintainAspectRatio: false 적용');
    console.log('  3. 애니메이션 비활성화로 깜빡임 제거');
    console.log('  4. Tailwind CSS 클래스 강제 적용');
    
  } catch (error) {
    console.error('❌ 수정 중 오류 발생:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fixChartSizes, generateFixCode };