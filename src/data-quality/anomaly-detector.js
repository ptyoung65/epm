/**
 * Anomaly Detection Engine
 * AIRIS EPM - Enterprise Performance Management
 * 실시간 이상치 탐지 시스템
 */

// 통계 기반 이상치 탐지 클래스
export class StatisticalAnomalyDetector {
  constructor(options = {}) {
    this.options = {
      windowSize: options.windowSize || 100,           // 슬라이딩 윈도우 크기
      zScoreThreshold: options.zScoreThreshold || 3,   // Z-score 임계값
      iqrMultiplier: options.iqrMultiplier || 1.5,     // IQR 곱수
      minSamples: options.minSamples || 10,             // 최소 샘플 수
      adaptiveThreshold: options.adaptiveThreshold || false,
      ...options
    };
    
    this.dataWindows = new Map(); // 메트릭별 데이터 윈도우
    this.statistics = new Map();   // 메트릭별 통계
    this.anomalies = [];           // 탐지된 이상치
  }

  // 데이터 포인트 추가 및 이상치 탐지
  detect(dataPoint) {
    const { metricName, value, timestamp, metadata = {} } = dataPoint;
    
    if (!this.dataWindows.has(metricName)) {
      this.dataWindows.set(metricName, []);
      this.statistics.set(metricName, {});
    }
    
    const window = this.dataWindows.get(metricName);
    window.push({ value, timestamp, metadata });
    
    // 윈도우 크기 유지
    if (window.length > this.options.windowSize) {
      window.shift();
    }
    
    // 충분한 데이터가 없으면 이상치 검사 스킵
    if (window.length < this.options.minSamples) {
      return { isAnomaly: false, reason: 'Insufficient data' };
    }
    
    // 통계 계산
    this.updateStatistics(metricName);
    
    // 이상치 탐지 메서드들
    const detectionMethods = [
      this.detectZScoreAnomaly(metricName, value),
      this.detectIQRAnomaly(metricName, value),
      this.detectMovingAverageAnomaly(metricName, value),
      this.detectSeasonalAnomaly(metricName, value, timestamp)
    ];
    
    // 여러 메서드 중 하나라도 이상치로 판단하면 이상치
    const anomalyResults = detectionMethods.filter(result => result.isAnomaly);
    const isAnomaly = anomalyResults.length > 0;
    
    if (isAnomaly) {
      const anomaly = {
        timestamp,
        metricName,
        value,
        expectedRange: this.getExpectedRange(metricName),
        detectionMethods: anomalyResults.map(r => r.method),
        severity: this.calculateSeverity(metricName, value),
        metadata
      };
      
      this.anomalies.push(anomaly);
      return { isAnomaly: true, details: anomaly };
    }
    
    return { isAnomaly: false };
  }

  // Z-Score 기반 이상치 탐지
  detectZScoreAnomaly(metricName, value) {
    const stats = this.statistics.get(metricName);
    const zScore = Math.abs((value - stats.mean) / stats.stdDev);
    
    const threshold = this.options.adaptiveThreshold 
      ? this.getAdaptiveThreshold(metricName) 
      : this.options.zScoreThreshold;
    
    return {
      isAnomaly: zScore > threshold,
      method: 'z-score',
      score: zScore,
      threshold
    };
  }

  // IQR(사분위수 범위) 기반 이상치 탐지
  detectIQRAnomaly(metricName, value) {
    const stats = this.statistics.get(metricName);
    const iqr = stats.q3 - stats.q1;
    const lowerBound = stats.q1 - (this.options.iqrMultiplier * iqr);
    const upperBound = stats.q3 + (this.options.iqrMultiplier * iqr);
    
    return {
      isAnomaly: value < lowerBound || value > upperBound,
      method: 'iqr',
      bounds: { lower: lowerBound, upper: upperBound }
    };
  }

  // 이동 평균 기반 이상치 탐지
  detectMovingAverageAnomaly(metricName, value) {
    const window = this.dataWindows.get(metricName);
    const recentWindow = window.slice(-20); // 최근 20개 샘플
    const ma = recentWindow.reduce((sum, d) => sum + d.value, 0) / recentWindow.length;
    const deviation = Math.abs((value - ma) / ma);
    
    return {
      isAnomaly: deviation > 0.5, // 50% 이상 편차
      method: 'moving-average',
      movingAverage: ma,
      deviation: deviation * 100
    };
  }

  // 계절성 기반 이상치 탐지
  detectSeasonalAnomaly(metricName, value, timestamp) {
    const window = this.dataWindows.get(metricName);
    const currentHour = new Date(timestamp).getHours();
    
    // 같은 시간대의 과거 데이터 수집
    const sameHourData = window.filter(d => {
      return new Date(d.timestamp).getHours() === currentHour;
    });
    
    if (sameHourData.length < 3) {
      return { isAnomaly: false, method: 'seasonal' };
    }
    
    const seasonalMean = sameHourData.reduce((sum, d) => sum + d.value, 0) / sameHourData.length;
    const seasonalStdDev = Math.sqrt(
      sameHourData.reduce((sum, d) => sum + Math.pow(d.value - seasonalMean, 2), 0) / sameHourData.length
    );
    
    const zScore = Math.abs((value - seasonalMean) / (seasonalStdDev || 1));
    
    return {
      isAnomaly: zScore > 3,
      method: 'seasonal',
      seasonalMean,
      zScore
    };
  }

  // 통계 업데이트
  updateStatistics(metricName) {
    const window = this.dataWindows.get(metricName);
    const values = window.map(d => d.value).sort((a, b) => a - b);
    
    const stats = {
      mean: values.reduce((sum, v) => sum + v, 0) / values.length,
      median: this.calculateMedian(values),
      q1: this.calculatePercentile(values, 25),
      q3: this.calculatePercentile(values, 75),
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
    
    // 표준편차 계산
    const variance = values.reduce((sum, v) => sum + Math.pow(v - stats.mean, 2), 0) / values.length;
    stats.stdDev = Math.sqrt(variance);
    
    this.statistics.set(metricName, stats);
  }

  // 중앙값 계산
  calculateMedian(sortedValues) {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  // 백분위수 계산
  calculatePercentile(sortedValues, percentile) {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  // 적응형 임계값 계산
  getAdaptiveThreshold(metricName) {
    const stats = this.statistics.get(metricName);
    const cv = stats.stdDev / stats.mean; // 변동계수
    
    // 변동성이 높으면 임계값 증가
    if (cv > 0.5) return 4;
    if (cv > 0.3) return 3.5;
    return 3;
  }

  // 예상 범위 계산
  getExpectedRange(metricName) {
    const stats = this.statistics.get(metricName);
    return {
      lower: stats.mean - (2 * stats.stdDev),
      upper: stats.mean + (2 * stats.stdDev),
      mean: stats.mean
    };
  }

  // 이상치 심각도 계산
  calculateSeverity(metricName, value) {
    const stats = this.statistics.get(metricName);
    const zScore = Math.abs((value - stats.mean) / stats.stdDev);
    
    if (zScore > 5) return 'critical';
    if (zScore > 4) return 'high';
    if (zScore > 3) return 'medium';
    return 'low';
  }

  // 최근 이상치 조회
  getRecentAnomalies(count = 10) {
    return this.anomalies.slice(-count);
  }

  // 메트릭별 통계 조회
  getStatistics(metricName) {
    return this.statistics.get(metricName);
  }

  // 모든 통계 조회
  getAllStatistics() {
    const result = {};
    this.statistics.forEach((stats, metric) => {
      result[metric] = stats;
    });
    return result;
  }
}

// 머신러닝 기반 이상치 탐지 클래스
export class MLAnomalyDetector {
  constructor(options = {}) {
    this.options = {
      algorithm: options.algorithm || 'isolation-forest',
      contamination: options.contamination || 0.1, // 예상 이상치 비율
      nEstimators: options.nEstimators || 100,     // 트리 개수
      maxSamples: options.maxSamples || 256,       // 샘플 크기
      ...options
    };
    
    this.trainingData = [];
    this.model = null;
    this.isTraining = false;
  }

  // 모델 학습
  async train(data) {
    this.isTraining = true;
    this.trainingData = data;
    
    try {
      switch (this.options.algorithm) {
        case 'isolation-forest':
          this.model = await this.trainIsolationForest(data);
          break;
        case 'local-outlier-factor':
          this.model = await this.trainLOF(data);
          break;
        case 'one-class-svm':
          this.model = await this.trainOneClassSVM(data);
          break;
        default:
          throw new Error(`Unknown algorithm: ${this.options.algorithm}`);
      }
      
      this.isTraining = false;
      return { success: true, algorithm: this.options.algorithm };
    } catch (error) {
      this.isTraining = false;
      throw error;
    }
  }

  // Isolation Forest 학습 (시뮬레이션)
  async trainIsolationForest(data) {
    // 실제 구현에서는 ML 라이브러리 사용
    return {
      type: 'isolation-forest',
      trees: this.options.nEstimators,
      trained: true,
      trainingSize: data.length
    };
  }

  // Local Outlier Factor 학습 (시뮬레이션)
  async trainLOF(data) {
    return {
      type: 'lof',
      neighbors: 20,
      trained: true,
      trainingSize: data.length
    };
  }

  // One-Class SVM 학습 (시뮬레이션)
  async trainOneClassSVM(data) {
    return {
      type: 'one-class-svm',
      kernel: 'rbf',
      trained: true,
      trainingSize: data.length
    };
  }

  // 예측
  predict(dataPoint) {
    if (!this.model) {
      throw new Error('Model not trained. Call train() first.');
    }
    
    // 시뮬레이션된 예측 (실제로는 ML 모델 사용)
    const anomalyScore = this.calculateAnomalyScore(dataPoint);
    const isAnomaly = anomalyScore > 0.7;
    
    return {
      isAnomaly,
      anomalyScore,
      confidence: isAnomaly ? anomalyScore : 1 - anomalyScore
    };
  }

  // 이상치 점수 계산 (시뮬레이션)
  calculateAnomalyScore(dataPoint) {
    // 실제 구현에서는 학습된 모델 사용
    const randomFactor = Math.random() * 0.3;
    const baseScore = 0.5;
    
    // 극단값일수록 높은 점수
    if (dataPoint.value > 1000 || dataPoint.value < 0) {
      return Math.min(baseScore + 0.4 + randomFactor, 1);
    }
    
    return Math.min(baseScore + randomFactor, 1);
  }
}

// 복합 이상치 탐지기
export class HybridAnomalyDetector {
  constructor(options = {}) {
    this.statisticalDetector = new StatisticalAnomalyDetector(options);
    this.mlDetector = new MLAnomalyDetector(options);
    this.anomalyHistory = [];
    this.alertThresholds = {
      critical: 0.9,
      high: 0.7,
      medium: 0.5,
      low: 0.3
    };
  }

  // 복합 탐지
  async detect(dataPoint) {
    const results = [];
    
    // 통계 기반 탐지
    const statisticalResult = this.statisticalDetector.detect(dataPoint);
    results.push({
      method: 'statistical',
      ...statisticalResult
    });
    
    // ML 기반 탐지 (모델이 학습된 경우)
    if (this.mlDetector.model) {
      try {
        const mlResult = this.mlDetector.predict(dataPoint);
        results.push({
          method: 'ml',
          ...mlResult
        });
      } catch (error) {
        console.warn('ML detection failed:', error);
      }
    }
    
    // 종합 판단
    const isAnomaly = results.some(r => r.isAnomaly);
    const confidenceScores = results.filter(r => r.confidence).map(r => r.confidence);
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length
      : 0;
    
    const anomalyLevel = this.getAnomalyLevel(avgConfidence);
    
    const result = {
      isAnomaly,
      confidence: avgConfidence,
      level: anomalyLevel,
      detectionResults: results,
      timestamp: new Date().toISOString(),
      dataPoint
    };
    
    if (isAnomaly) {
      this.anomalyHistory.push(result);
    }
    
    return result;
  }

  // 이상치 레벨 판단
  getAnomalyLevel(confidence) {
    if (confidence >= this.alertThresholds.critical) return 'critical';
    if (confidence >= this.alertThresholds.high) return 'high';
    if (confidence >= this.alertThresholds.medium) return 'medium';
    if (confidence >= this.alertThresholds.low) return 'low';
    return 'none';
  }

  // ML 모델 학습
  async trainMLModel(data) {
    return await this.mlDetector.train(data);
  }

  // 이상치 이력 조회
  getAnomalyHistory(limit = 100) {
    return this.anomalyHistory.slice(-limit);
  }

  // 이상치 통계
  getAnomalyStatistics() {
    const total = this.anomalyHistory.length;
    const byLevel = {};
    
    ['critical', 'high', 'medium', 'low'].forEach(level => {
      byLevel[level] = this.anomalyHistory.filter(a => a.level === level).length;
    });
    
    return {
      total,
      byLevel,
      lastDetected: this.anomalyHistory[this.anomalyHistory.length - 1]?.timestamp
    };
  }
}

export default {
  StatisticalAnomalyDetector,
  MLAnomalyDetector,
  HybridAnomalyDetector
};