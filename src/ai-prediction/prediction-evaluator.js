/**
 * AIRIS EPM AI 예측 분석 - 예측 정확도 모니터링 및 평가 시스템
 * 모델 성능 추적, A/B 테스트, 드리프트 감지
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class PredictionEvaluator extends EventEmitter {
  constructor() {
    super();
    this.evaluationHistory = new Map();
    this.groundTruthData = new Map();
    this.modelPerformanceMetrics = new Map();
    this.alertThresholds = new Map();
    this.driftDetectors = new Map();
    this.abTestConfigs = new Map();
    
    this.setupDefaultThresholds();
    this.initializeDriftDetectors();
  }

  setupDefaultThresholds() {
    // 모델별 성능 임계값 설정
    this.alertThresholds.set('revenue_prediction', {
      accuracy: { min: 85, warning: 90 },
      mse: { max: 1000, warning: 500 },
      mae: { max: 200, warning: 100 },
      drift_score: { max: 0.3, warning: 0.2 }
    });

    this.alertThresholds.set('performance_prediction', {
      accuracy: { min: 88, warning: 92 },
      mse: { max: 500, warning: 200 },
      mae: { max: 50, warning: 25 },
      drift_score: { max: 0.25, warning: 0.15 }
    });

    this.alertThresholds.set('anomaly_detection', {
      accuracy: { min: 90, warning: 95 },
      precision: { min: 85, warning: 90 },
      recall: { min: 80, warning: 85 },
      f1_score: { min: 85, warning: 90 },
      drift_score: { max: 0.2, warning: 0.1 }
    });

    this.alertThresholds.set('capacity_planning', {
      accuracy: { min: 80, warning: 85 },
      mse: { max: 0.1, warning: 0.05 },
      mae: { max: 0.08, warning: 0.04 },
      drift_score: { max: 0.35, warning: 0.25 }
    });

    console.log('📊 Performance thresholds configured for all models');
  }

  initializeDriftDetectors() {
    // 각 모델에 대한 드리프트 감지기 초기화
    const modelIds = ['revenue_prediction', 'performance_prediction', 'anomaly_detection', 'capacity_planning'];
    
    modelIds.forEach(modelId => {
      this.driftDetectors.set(modelId, {
        referenceDistribution: null,
        recentSamples: [],
        maxSamples: 1000,
        evaluationWindow: 100,
        lastEvaluation: null
      });
    });

    console.log('🔍 Drift detectors initialized for all models');
  }

  async addGroundTruth(modelId, predictionId, actualValue, timestamp) {
    if (!this.groundTruthData.has(modelId)) {
      this.groundTruthData.set(modelId, []);
    }

    const groundTruth = {
      predictionId,
      actualValue,
      timestamp: timestamp || new Date().toISOString(),
      evaluated: false
    };

    this.groundTruthData.get(modelId).push(groundTruth);
    
    // 오래된 데이터 정리 (최근 10000개 유지)
    const data = this.groundTruthData.get(modelId);
    if (data.length > 10000) {
      data.splice(0, data.length - 10000);
    }

    console.log(`✅ Ground truth added for ${modelId}: ${actualValue}`);
    
    // 자동 평가 트리거
    await this.evaluateModelPerformance(modelId);
  }

  async addPrediction(modelId, predictionId, predictedValue, confidence, inputFeatures, timestamp) {
    // 예측 결과를 드리프트 감지기에 추가
    const detector = this.driftDetectors.get(modelId);
    if (detector) {
      detector.recentSamples.push({
        predictionId,
        predictedValue,
        confidence,
        inputFeatures,
        timestamp: timestamp || new Date().toISOString()
      });

      // 최대 샘플 수 유지
      if (detector.recentSamples.length > detector.maxSamples) {
        detector.recentSamples.shift();
      }

      // 주기적으로 드리프트 감지 실행
      if (detector.recentSamples.length % detector.evaluationWindow === 0) {
        await this.detectDataDrift(modelId);
      }
    }
  }

  async evaluateModelPerformance(modelId) {
    const groundTruths = this.groundTruthData.get(modelId);
    if (!groundTruths || groundTruths.length === 0) {
      return null;
    }

    // 평가되지 않은 ground truth만 처리
    const unevaluatedData = groundTruths.filter(gt => !gt.evaluated);
    if (unevaluatedData.length === 0) {
      return null;
    }

    const evaluation = {
      modelId,
      evaluationId: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sampleCount: unevaluatedData.length,
      metrics: {}
    };

    try {
      // 모델 유형에 따른 평가 메트릭 계산
      const modelThresholds = this.alertThresholds.get(modelId);
      
      if (modelId === 'anomaly_detection') {
        evaluation.metrics = this.calculateClassificationMetrics(unevaluatedData);
      } else {
        evaluation.metrics = this.calculateRegressionMetrics(unevaluatedData);
      }

      // 평가된 데이터 마킹
      unevaluatedData.forEach(gt => gt.evaluated = true);

      // 평가 히스토리에 저장
      if (!this.evaluationHistory.has(modelId)) {
        this.evaluationHistory.set(modelId, []);
      }
      
      const history = this.evaluationHistory.get(modelId);
      history.push(evaluation);
      
      // 히스토리 크기 제한 (최근 1000개)
      if (history.length > 1000) {
        history.shift();
      }

      // 모델 성능 메트릭 업데이트
      this.updateModelPerformanceMetrics(modelId, evaluation.metrics);

      // 성능 알림 확인
      this.checkPerformanceAlerts(modelId, evaluation.metrics, modelThresholds);

      console.log(`📈 Performance evaluation completed for ${modelId}:`, evaluation.metrics);
      
      this.emit('performanceEvaluated', {
        modelId,
        evaluation,
        metrics: evaluation.metrics
      });

      return evaluation;

    } catch (error) {
      console.error(`❌ Performance evaluation failed for ${modelId}:`, error);
      return null;
    }
  }

  calculateRegressionMetrics(data) {
    const predictions = [];
    const actuals = [];

    data.forEach(item => {
      if (typeof item.predictedValue === 'number' && typeof item.actualValue === 'number') {
        predictions.push(item.predictedValue);
        actuals.push(item.actualValue);
      }
    });

    if (predictions.length === 0) {
      return { error: 'No valid numerical data for regression metrics' };
    }

    // Mean Squared Error (MSE)
    const mse = predictions.reduce((sum, pred, i) => {
      const diff = pred - actuals[i];
      return sum + diff * diff;
    }, 0) / predictions.length;

    // Mean Absolute Error (MAE)
    const mae = predictions.reduce((sum, pred, i) => {
      return sum + Math.abs(pred - actuals[i]);
    }, 0) / predictions.length;

    // Root Mean Squared Error (RMSE)
    const rmse = Math.sqrt(mse);

    // Mean Absolute Percentage Error (MAPE)
    let mape = 0;
    let validMapeCount = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (actuals[i] !== 0) {
        mape += Math.abs((actuals[i] - predictions[i]) / actuals[i]);
        validMapeCount++;
      }
    }
    mape = validMapeCount > 0 ? (mape / validMapeCount) * 100 : 0;

    // R-squared (결정 계수)
    const actualMean = actuals.reduce((sum, val) => sum + val, 0) / actuals.length;
    const totalSumSquares = actuals.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
    const residualSumSquares = predictions.reduce((sum, pred, i) => {
      return sum + Math.pow(actuals[i] - pred, 2);
    }, 0);
    const rSquared = totalSumSquares !== 0 ? 1 - (residualSumSquares / totalSumSquares) : 0;

    return {
      mse: Math.round(mse * 100) / 100,
      mae: Math.round(mae * 100) / 100,
      rmse: Math.round(rmse * 100) / 100,
      mape: Math.round(mape * 100) / 100,
      r_squared: Math.round(rSquared * 10000) / 10000,
      accuracy: Math.max(0, Math.round((100 - mape) * 100) / 100), // MAPE 기반 정확도
      sample_count: predictions.length
    };
  }

  calculateClassificationMetrics(data) {
    const predictions = [];
    const actuals = [];

    data.forEach(item => {
      if (typeof item.predictedValue === 'number' && typeof item.actualValue === 'number') {
        predictions.push(item.predictedValue);
        actuals.push(item.actualValue);
      }
    });

    if (predictions.length === 0) {
      return { error: 'No valid data for classification metrics' };
    }

    // Confusion Matrix 계산 (Binary Classification)
    let tp = 0, tn = 0, fp = 0, fn = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i] > 0.5 ? 1 : 0;
      const actual = actuals[i];
      
      if (pred === 1 && actual === 1) tp++;
      else if (pred === 0 && actual === 0) tn++;
      else if (pred === 1 && actual === 0) fp++;
      else if (pred === 0 && actual === 1) fn++;
    }

    // 메트릭 계산
    const accuracy = (tp + tn) / (tp + tn + fp + fn);
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;

    return {
      accuracy: Math.round(accuracy * 10000) / 100,
      precision: Math.round(precision * 10000) / 100,
      recall: Math.round(recall * 10000) / 100,
      f1_score: Math.round(f1Score * 10000) / 100,
      specificity: Math.round(specificity * 10000) / 100,
      true_positives: tp,
      true_negatives: tn,
      false_positives: fp,
      false_negatives: fn,
      sample_count: predictions.length
    };
  }

  updateModelPerformanceMetrics(modelId, newMetrics) {
    if (!this.modelPerformanceMetrics.has(modelId)) {
      this.modelPerformanceMetrics.set(modelId, {
        history: [],
        current: null,
        trend: 'stable'
      });
    }

    const performanceData = this.modelPerformanceMetrics.get(modelId);
    performanceData.history.push({
      timestamp: new Date().toISOString(),
      metrics: { ...newMetrics }
    });

    // 히스토리 크기 제한
    if (performanceData.history.length > 100) {
      performanceData.history.shift();
    }

    // 현재 성능 업데이트
    performanceData.current = { ...newMetrics };

    // 트렌드 분석
    if (performanceData.history.length >= 5) {
      performanceData.trend = this.analyzeTrend(modelId, 'accuracy');
    }
  }

  analyzeTrend(modelId, metricName) {
    const performanceData = this.modelPerformanceMetrics.get(modelId);
    if (!performanceData || performanceData.history.length < 5) {
      return 'stable';
    }

    const recentValues = performanceData.history
      .slice(-5)
      .map(h => h.metrics[metricName])
      .filter(v => typeof v === 'number');

    if (recentValues.length < 5) return 'stable';

    // 선형 회귀를 통한 추세 분석
    const n = recentValues.length;
    const sumX = n * (n - 1) / 2;
    const sumY = recentValues.reduce((sum, val) => sum + val, 0);
    const sumXY = recentValues.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = n * (n - 1) * (2 * n - 1) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    if (slope > 0.5) return 'improving';
    else if (slope < -0.5) return 'declining';
    else return 'stable';
  }

  checkPerformanceAlerts(modelId, metrics, thresholds) {
    if (!thresholds) return;

    const alerts = [];

    Object.entries(thresholds).forEach(([metricName, threshold]) => {
      const value = metrics[metricName];
      if (typeof value !== 'number') return;

      let alertLevel = null;
      let message = '';

      if ('min' in threshold) {
        if (value < threshold.min) {
          alertLevel = 'critical';
          message = `${metricName} (${value}) is below critical threshold (${threshold.min})`;
        } else if (value < threshold.warning) {
          alertLevel = 'warning';
          message = `${metricName} (${value}) is below warning threshold (${threshold.warning})`;
        }
      }

      if ('max' in threshold) {
        if (value > threshold.max) {
          alertLevel = 'critical';
          message = `${metricName} (${value}) exceeds critical threshold (${threshold.max})`;
        } else if (value > threshold.warning) {
          alertLevel = 'warning';
          message = `${metricName} (${value}) exceeds warning threshold (${threshold.warning})`;
        }
      }

      if (alertLevel) {
        alerts.push({
          modelId,
          metricName,
          value,
          alertLevel,
          message,
          timestamp: new Date().toISOString()
        });
      }
    });

    if (alerts.length > 0) {
      console.log(`🚨 Performance alerts for ${modelId}:`, alerts);
      this.emit('performanceAlert', { modelId, alerts });
    }
  }

  async detectDataDrift(modelId) {
    const detector = this.driftDetectors.get(modelId);
    if (!detector || detector.recentSamples.length < detector.evaluationWindow) {
      return null;
    }

    try {
      // 참조 분포와 최근 샘플 비교
      const driftScore = this.calculateDriftScore(detector);
      
      const driftDetection = {
        modelId,
        timestamp: new Date().toISOString(),
        driftScore,
        status: this.getDriftStatus(modelId, driftScore),
        sampleCount: detector.recentSamples.length
      };

      detector.lastEvaluation = driftDetection;

      if (driftDetection.status !== 'stable') {
        console.log(`🌊 Data drift detected for ${modelId}: ${driftScore.toFixed(4)}`);
        this.emit('dataDrift', driftDetection);
      }

      return driftDetection;

    } catch (error) {
      console.error(`❌ Drift detection failed for ${modelId}:`, error);
      return null;
    }
  }

  calculateDriftScore(detector) {
    const recentSamples = detector.recentSamples.slice(-detector.evaluationWindow);
    
    // 특징별 분포 변화 계산 (simplified KL divergence approximation)
    const features = recentSamples[0].inputFeatures || {};
    const featureNames = Object.keys(features);
    
    if (featureNames.length === 0) {
      return 0;
    }

    let totalDrift = 0;
    let validFeatures = 0;

    featureNames.forEach(featureName => {
      const values = recentSamples
        .map(sample => sample.inputFeatures?.[featureName])
        .filter(val => typeof val === 'number');

      if (values.length < 10) return; // 충분한 데이터 필요

      // 최근 50% vs 이전 50% 분포 비교
      const midPoint = Math.floor(values.length / 2);
      const recent = values.slice(midPoint);
      const older = values.slice(0, midPoint);

      if (recent.length > 0 && older.length > 0) {
        const recentMean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const olderMean = older.reduce((sum, val) => sum + val, 0) / older.length;
        
        const recentStd = Math.sqrt(recent.reduce((sum, val) => sum + Math.pow(val - recentMean, 2), 0) / recent.length);
        const olderStd = Math.sqrt(older.reduce((sum, val) => sum + Math.pow(val - olderMean, 2), 0) / older.length);

        // 평균과 분산 변화를 기반으로 드리프트 점수 계산
        const meanDrift = Math.abs(recentMean - olderMean) / (Math.abs(olderMean) + 1);
        const stdDrift = Math.abs(recentStd - olderStd) / (olderStd + 1);
        
        totalDrift += meanDrift + stdDrift;
        validFeatures++;
      }
    });

    return validFeatures > 0 ? totalDrift / validFeatures : 0;
  }

  getDriftStatus(modelId, driftScore) {
    const threshold = this.alertThresholds.get(modelId)?.drift_score;
    if (!threshold) return 'unknown';

    if (driftScore > threshold.max) return 'critical';
    else if (driftScore > threshold.warning) return 'warning';
    else return 'stable';
  }

  setupABTest(testId, modelA, modelB, trafficSplit = 0.5, duration = 7 * 24 * 60 * 60 * 1000) {
    const abTest = {
      testId,
      modelA,
      modelB,
      trafficSplit,
      startTime: new Date(),
      endTime: new Date(Date.now() + duration),
      status: 'running',
      results: {
        [modelA]: { predictions: [], actuals: [], metrics: null },
        [modelB]: { predictions: [], actuals: [], metrics: null }
      }
    };

    this.abTestConfigs.set(testId, abTest);
    console.log(`🧪 A/B test started: ${modelA} vs ${modelB} (${testId})`);
    
    return abTest;
  }

  routeABTestTraffic(testId, inputData) {
    const test = this.abTestConfigs.get(testId);
    if (!test || test.status !== 'running' || new Date() > test.endTime) {
      return null;
    }

    // 트래픽 분할
    const useModelA = Math.random() < test.trafficSplit;
    return useModelA ? test.modelA : test.modelB;
  }

  addABTestResult(testId, modelId, prediction, actual) {
    const test = this.abTestConfigs.get(testId);
    if (!test || !test.results[modelId]) return;

    test.results[modelId].predictions.push(prediction);
    test.results[modelId].actuals.push(actual);
  }

  async finalizeABTest(testId) {
    const test = this.abTestConfigs.get(testId);
    if (!test) return null;

    test.status = 'completed';
    test.endTime = new Date();

    // 각 모델의 성능 계산
    for (const modelId of [test.modelA, test.modelB]) {
      const data = test.results[modelId];
      if (data.predictions.length > 0 && data.actuals.length > 0) {
        const testData = data.predictions.map((pred, i) => ({
          predictedValue: pred,
          actualValue: data.actuals[i]
        }));

        if (modelId === 'anomaly_detection') {
          data.metrics = this.calculateClassificationMetrics(testData);
        } else {
          data.metrics = this.calculateRegressionMetrics(testData);
        }
      }
    }

    // 통계적 유의성 검정
    test.statisticalSignificance = this.calculateStatisticalSignificance(test);

    console.log(`📊 A/B test completed: ${testId}`, test.results);
    this.emit('abTestCompleted', test);

    return test;
  }

  calculateStatisticalSignificance(test) {
    const metricsA = test.results[test.modelA].metrics;
    const metricsB = test.results[test.modelB].metrics;
    
    if (!metricsA || !metricsB) {
      return { significant: false, reason: 'Insufficient data' };
    }

    // 간단한 t-test 근사
    const accuracyA = metricsA.accuracy || 0;
    const accuracyB = metricsB.accuracy || 0;
    const sampleSizeA = metricsA.sample_count || 0;
    const sampleSizeB = metricsB.sample_count || 0;

    if (sampleSizeA < 30 || sampleSizeB < 30) {
      return { significant: false, reason: 'Sample size too small' };
    }

    const difference = Math.abs(accuracyA - accuracyB);
    const pooledStdError = Math.sqrt((accuracyA * (100 - accuracyA) / sampleSizeA) + 
                                    (accuracyB * (100 - accuracyB) / sampleSizeB));
    
    const zScore = difference / pooledStdError;
    const significant = zScore > 1.96; // 95% confidence level

    return {
      significant,
      zScore,
      pValue: 2 * (1 - this.normalCDF(Math.abs(zScore))),
      confidenceLevel: 0.95,
      winner: accuracyA > accuracyB ? test.modelA : test.modelB,
      improvement: difference
    };
  }

  normalCDF(x) {
    // 표준정규분포 누적분포함수 근사
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  erf(x) {
    // 오차함수 근사
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  getModelPerformanceSummary(modelId) {
    const performanceData = this.modelPerformanceMetrics.get(modelId);
    const evaluationHistory = this.evaluationHistory.get(modelId);
    const driftDetector = this.driftDetectors.get(modelId);

    if (!performanceData) {
      return { error: `No performance data for model ${modelId}` };
    }

    return {
      modelId,
      current: performanceData.current,
      trend: performanceData.trend,
      evaluationCount: evaluationHistory?.length || 0,
      lastEvaluation: evaluationHistory?.[evaluationHistory.length - 1]?.timestamp,
      drift: driftDetector?.lastEvaluation || null,
      historicalPerformance: performanceData.history.slice(-10) // 최근 10개
    };
  }

  exportEvaluationReport(modelId, format = 'json') {
    const summary = this.getModelPerformanceSummary(modelId);
    const groundTruths = this.groundTruthData.get(modelId) || [];
    const evaluations = this.evaluationHistory.get(modelId) || [];
    
    const report = {
      modelId,
      generatedAt: new Date().toISOString(),
      summary,
      evaluationHistory: evaluations,
      groundTruthCount: groundTruths.length,
      format
    };

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(report);
    }

    return report;
  }

  convertToCSV(report) {
    // CSV 변환 로직 (간단 버전)
    let csv = 'Timestamp,Accuracy,MSE,MAE,Sample_Count\n';
    
    report.evaluationHistory.forEach(eval => {
      const metrics = eval.metrics;
      csv += `${eval.timestamp},${metrics.accuracy || ''},${metrics.mse || ''},${metrics.mae || ''},${metrics.sample_count || ''}\n`;
    });

    return csv;
  }

  // API 엔드포인트를 위한 메서드들
  getAllModelSummaries() {
    const summaries = {};
    for (const modelId of this.modelPerformanceMetrics.keys()) {
      summaries[modelId] = this.getModelPerformanceSummary(modelId);
    }
    return summaries;
  }

  getActiveABTests() {
    const activeTests = {};
    for (const [testId, test] of this.abTestConfigs) {
      if (test.status === 'running' && new Date() <= test.endTime) {
        activeTests[testId] = {
          testId,
          modelA: test.modelA,
          modelB: test.modelB,
          trafficSplit: test.trafficSplit,
          startTime: test.startTime,
          endTime: test.endTime,
          status: test.status
        };
      }
    }
    return activeTests;
  }
}

module.exports = PredictionEvaluator;