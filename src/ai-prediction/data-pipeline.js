/**
 * AIRIS EPM AI 예측 분석 - 데이터 수집 및 전처리 파이프라인
 * 다양한 소스에서 데이터를 수집하고 ML 모델을 위한 전처리 수행
 */

const express = require('express');
const cors = require('cors');
const EventEmitter = require('events');

class DataPipeline extends EventEmitter {
  constructor() {
    super();
    this.dataSources = new Map();
    this.processedData = new Map();
    this.featureStore = new Map();
    this.trainingDatasets = new Map();
    
    this.setupDataSources();
    this.startDataCollection();
  }

  setupDataSources() {
    // 1. 비즈니스 메트릭 데이터 소스
    this.registerDataSource({
      id: 'business_metrics',
      name: '비즈니스 메트릭',
      url: 'http://localhost:3200/api/business-metrics',
      endpoints: [
        '/overview',
        '/roi-analysis',
        '/cost-optimization',
        '/sla-monitoring'
      ],
      updateInterval: 300000, // 5분
      features: [
        'revenue', 'profit_margin', 'customer_acquisition_cost',
        'customer_lifetime_value', 'churn_rate', 'conversion_rate'
      ]
    });

    // 2. 시스템 성능 데이터 소스
    this.registerDataSource({
      id: 'system_performance',
      name: '시스템 성능',
      url: 'http://localhost:3100/api/dashboard',
      endpoints: [
        '/realtime',
        '/overview'
      ],
      updateInterval: 60000, // 1분
      features: [
        'cpu_usage', 'memory_usage', 'disk_usage', 'network_io',
        'response_time', 'throughput', 'error_rate', 'active_connections'
      ]
    });

    // 3. 사용자 행동 데이터 소스
    this.registerDataSource({
      id: 'user_behavior',
      name: '사용자 행동',
      url: 'http://localhost:3004/api/sessions',
      endpoints: [
        '/events',
        '/analytics'
      ],
      updateInterval: 180000, // 3분
      features: [
        'page_views', 'session_duration', 'bounce_rate',
        'click_through_rate', 'user_engagement_score'
      ]
    });

    // 4. 실시간 데이터 허브 소스
    this.registerDataSource({
      id: 'realtime_hub',
      name: '실시간 데이터',
      url: 'http://localhost:3300/api/realtime',
      endpoints: [
        '/snapshot',
        '/sources'
      ],
      updateInterval: 30000, // 30초
      features: [
        'alert_count', 'incident_severity', 'system_health_score',
        'business_impact_score'
      ]
    });

    console.log(`🔧 Configured ${this.dataSources.size} data sources for ML pipeline`);
  }

  registerDataSource(config) {
    const source = {
      ...config,
      status: 'active',
      lastUpdate: null,
      errorCount: 0,
      dataHistory: [],
      featureHistory: new Map()
    };

    this.dataSources.set(config.id, source);
    console.log(`📊 Registered data source: ${config.name}`);
  }

  async startDataCollection() {
    console.log('🚀 Starting ML data collection pipeline...');

    for (const [sourceId, source] of this.dataSources) {
      this.scheduleDataCollection(sourceId);
    }

    // 특징 공학 파이프라인 시작
    this.startFeatureEngineering();
    
    // 훈련 데이터셋 생성 스케줄링
    this.scheduleDatasetGeneration();
  }

  scheduleDataCollection(sourceId) {
    const source = this.dataSources.get(sourceId);
    if (!source) return;

    const collectData = async () => {
      try {
        const data = await this.collectSourceData(source);
        if (data) {
          await this.preprocessData(sourceId, data);
          source.lastUpdate = new Date();
          source.errorCount = 0;
        }
      } catch (error) {
        console.error(`❌ Data collection error for ${sourceId}:`, error.message);
        source.errorCount++;
        
        if (source.errorCount >= 5) {
          source.status = 'error';
          this.emit('dataSourceError', { sourceId, error });
        }
      }
    };

    // 즉시 실행
    collectData();
    
    // 주기적 실행
    setInterval(collectData, source.updateInterval);
  }

  async collectSourceData(source) {
    const fetch = (await import('node-fetch')).default;
    const collectedData = {
      timestamp: new Date().toISOString(),
      sourceId: source.id,
      data: {}
    };

    for (const endpoint of source.endpoints) {
      try {
        const response = await fetch(`${source.url}${endpoint}`, {
          timeout: 10000
        });

        if (response.ok) {
          const endpointData = await response.json();
          collectedData.data[endpoint] = endpointData;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch ${source.url}${endpoint}: ${error.message}`);
      }
    }

    // 데이터 히스토리 유지 (최근 1000개)
    source.dataHistory.push(collectedData);
    if (source.dataHistory.length > 1000) {
      source.dataHistory.shift();
    }

    return Object.keys(collectedData.data).length > 0 ? collectedData : null;
  }

  async preprocessData(sourceId, rawData) {
    const source = this.dataSources.get(sourceId);
    if (!source) return;

    const features = {};
    const timestamp = new Date(rawData.timestamp);

    // 소스별 전처리 로직
    switch (sourceId) {
      case 'business_metrics':
        features.revenue = this.extractNumericValue(rawData.data, ['overview', 'revenue']);
        features.profit_margin = this.extractNumericValue(rawData.data, ['overview', 'profit_margin']);
        features.customer_acquisition_cost = this.extractNumericValue(rawData.data, ['cost-optimization', 'cac']);
        features.conversion_rate = this.extractNumericValue(rawData.data, ['overview', 'conversion_rate']);
        break;

      case 'system_performance':
        features.cpu_usage = this.extractNumericValue(rawData.data, ['realtime', 'cpu_usage']);
        features.memory_usage = this.extractNumericValue(rawData.data, ['realtime', 'memory_usage']);
        features.response_time = this.extractNumericValue(rawData.data, ['realtime', 'response_time']);
        features.throughput = this.extractNumericValue(rawData.data, ['realtime', 'throughput']);
        features.error_rate = this.extractNumericValue(rawData.data, ['realtime', 'error_rate']);
        break;

      case 'user_behavior':
        features.page_views = this.extractNumericValue(rawData.data, ['analytics', 'page_views']);
        features.session_duration = this.extractNumericValue(rawData.data, ['analytics', 'session_duration']);
        features.bounce_rate = this.extractNumericValue(rawData.data, ['analytics', 'bounce_rate']);
        break;

      case 'realtime_hub':
        features.alert_count = this.extractNumericValue(rawData.data, ['snapshot', 'alert_count']);
        features.system_health_score = this.calculateSystemHealthScore(rawData.data);
        break;
    }

    // 결측값 처리
    for (const [key, value] of Object.entries(features)) {
      if (value === null || value === undefined || isNaN(value)) {
        // 이전 값으로 대체 또는 평균값 사용
        features[key] = this.fillMissingValue(sourceId, key, value);
      }
    }

    // 특징 정규화
    const normalizedFeatures = this.normalizeFeatures(sourceId, features);

    // 특징 저장
    this.storeFeatures(sourceId, timestamp, normalizedFeatures);

    console.log(`✅ Processed ${Object.keys(features).length} features from ${sourceId}`);
    return normalizedFeatures;
  }

  extractNumericValue(data, path) {
    try {
      let current = data;
      for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          return null;
        }
      }
      
      const numValue = parseFloat(current);
      return isNaN(numValue) ? null : numValue;
    } catch (error) {
      return null;
    }
  }

  calculateSystemHealthScore(data) {
    try {
      // 시스템 상태 지표들을 종합하여 건강도 점수 계산
      const snapshot = data.snapshot || {};
      const sources = data.sources || [];
      
      let healthScore = 100;
      
      // 활성 소스 수에 따른 점수 감점
      const activeSources = sources.filter(s => s.status === 'active').length;
      const totalSources = sources.length;
      if (totalSources > 0) {
        const activeRatio = activeSources / totalSources;
        healthScore *= activeRatio;
      }
      
      // 에러 수에 따른 점수 감점
      const totalErrors = sources.reduce((sum, s) => sum + (s.errorCount || 0), 0);
      healthScore -= Math.min(totalErrors * 5, 50);
      
      return Math.max(0, Math.min(100, healthScore));
    } catch (error) {
      return 50; // 기본값
    }
  }

  fillMissingValue(sourceId, featureName, missingValue) {
    const source = this.dataSources.get(sourceId);
    if (!source || !source.featureHistory.has(featureName)) {
      return 0; // 기본값
    }

    const history = source.featureHistory.get(featureName);
    if (history.length === 0) return 0;

    // 최근 10개 값의 평균으로 대체
    const recent = history.slice(-10);
    const average = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    
    return average;
  }

  normalizeFeatures(sourceId, features) {
    const normalized = {};
    
    // Min-Max 정규화 또는 Z-score 정규화
    for (const [featureName, value] of Object.entries(features)) {
      if (typeof value !== 'number') {
        normalized[featureName] = 0;
        continue;
      }

      // 특징별 정규화 범위 설정
      const normalizationConfig = this.getNormalizationConfig(featureName);
      normalized[featureName] = this.normalizeValue(value, normalizationConfig);
    }

    return normalized;
  }

  getNormalizationConfig(featureName) {
    const configs = {
      // 퍼센트 기반 메트릭
      cpu_usage: { min: 0, max: 100, type: 'minmax' },
      memory_usage: { min: 0, max: 100, type: 'minmax' },
      disk_usage: { min: 0, max: 100, type: 'minmax' },
      profit_margin: { min: 0, max: 50, type: 'minmax' },
      conversion_rate: { min: 0, max: 20, type: 'minmax' },
      bounce_rate: { min: 0, max: 100, type: 'minmax' },
      
      // 응답시간 (ms)
      response_time: { min: 0, max: 5000, type: 'minmax' },
      
      // 처리량 (req/min)
      throughput: { min: 0, max: 5000, type: 'minmax' },
      
      // 에러율
      error_rate: { min: 0, max: 10, type: 'minmax' },
      
      // 수익 (로그 변환)
      revenue: { type: 'log' },
      customer_acquisition_cost: { type: 'log' },
      
      // 기본 설정
      default: { min: 0, max: 1, type: 'minmax' }
    };

    return configs[featureName] || configs.default;
  }

  normalizeValue(value, config) {
    switch (config.type) {
      case 'minmax':
        return (value - config.min) / (config.max - config.min);
      
      case 'log':
        return Math.log(Math.max(1, value));
      
      case 'zscore':
        // Z-score 정규화 (평균과 표준편차 필요)
        return (value - config.mean) / config.std;
      
      default:
        return value;
    }
  }

  storeFeatures(sourceId, timestamp, features) {
    const source = this.dataSources.get(sourceId);
    if (!source) return;

    // 특징별 히스토리 업데이트
    for (const [featureName, value] of Object.entries(features)) {
      if (!source.featureHistory.has(featureName)) {
        source.featureHistory.set(featureName, []);
      }
      
      const history = source.featureHistory.get(featureName);
      history.push(value);
      
      // 최근 1000개 값만 유지
      if (history.length > 1000) {
        history.shift();
      }
    }

    // Feature Store에 저장
    const featureKey = `${sourceId}_${timestamp.getTime()}`;
    this.featureStore.set(featureKey, {
      sourceId,
      timestamp,
      features
    });

    // Feature Store 크기 제한 (최근 10000개)
    if (this.featureStore.size > 10000) {
      const oldestKey = this.featureStore.keys().next().value;
      this.featureStore.delete(oldestKey);
    }
  }

  startFeatureEngineering() {
    console.log('🔬 Starting feature engineering pipeline...');
    
    // 매 10분마다 고급 특징 생성
    setInterval(() => {
      this.generateAdvancedFeatures();
    }, 600000); // 10분

    // 매 시간마다 시계열 특징 생성
    setInterval(() => {
      this.generateTimeSeriesFeatures();
    }, 3600000); // 1시간
  }

  generateAdvancedFeatures() {
    try {
      console.log('🔧 Generating advanced features...');
      
      // 1. 비율 및 조합 특징 생성
      this.generateRatioFeatures();
      
      // 2. 이동 평균 및 추세 특징 생성
      this.generateTrendFeatures();
      
      // 3. 계절성 및 주기성 특징 생성
      this.generateSeasonalFeatures();
      
      // 4. 교차 특징 생성
      this.generateInteractionFeatures();
      
      console.log('✅ Advanced features generated successfully');
    } catch (error) {
      console.error('❌ Error generating advanced features:', error);
    }
  }

  generateRatioFeatures() {
    // 수익 대비 비용 비율
    // CPU 대비 메모리 사용률 비율
    // 처리량 대비 에러율 비율 등
    
    const ratioFeatures = new Map();
    
    // 최근 데이터에서 비율 계산
    for (const [key, data] of this.featureStore) {
      const { features } = data;
      
      if (features.revenue && features.customer_acquisition_cost) {
        features.revenue_cac_ratio = features.revenue / features.customer_acquisition_cost;
      }
      
      if (features.cpu_usage && features.memory_usage) {
        features.cpu_memory_ratio = features.cpu_usage / features.memory_usage;
      }
      
      if (features.throughput && features.error_rate) {
        features.throughput_error_ratio = features.throughput / Math.max(0.01, features.error_rate);
      }
    }
  }

  generateTrendFeatures() {
    // 각 소스별로 추세 특징 계산
    for (const [sourceId, source] of this.dataSources) {
      for (const [featureName, history] of source.featureHistory) {
        if (history.length < 10) continue;
        
        const recent = history.slice(-10);
        const older = history.slice(-20, -10);
        
        if (older.length > 0) {
          const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
          const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
          
          // 추세 방향 (-1: 감소, 0: 평행, 1: 증가)
          const trendDirection = recentAvg > olderAvg ? 1 : recentAvg < olderAvg ? -1 : 0;
          
          // 변화율
          const changeRate = olderAvg !== 0 ? (recentAvg - olderAvg) / olderAvg : 0;
          
          // 변동성 (표준편차)
          const volatility = this.calculateStandardDeviation(recent);
          
          // 추세 특징을 Feature Store에 추가
          const trendFeatures = {
            [`${featureName}_trend_direction`]: trendDirection,
            [`${featureName}_change_rate`]: changeRate,
            [`${featureName}_volatility`]: volatility
          };
          
          // 현재 시간으로 추세 특징 저장
          const trendKey = `${sourceId}_trend_${Date.now()}`;
          this.featureStore.set(trendKey, {
            sourceId: `${sourceId}_trend`,
            timestamp: new Date(),
            features: trendFeatures
          });
        }
      }
    }
  }

  generateSeasonalFeatures() {
    const now = new Date();
    const seasonalFeatures = {
      hour_of_day: now.getHours() / 23,
      day_of_week: now.getDay() / 6,
      day_of_month: now.getDate() / 31,
      month_of_year: now.getMonth() / 11,
      is_weekend: (now.getDay() === 0 || now.getDay() === 6) ? 1 : 0,
      is_business_hours: (now.getHours() >= 9 && now.getHours() <= 18) ? 1 : 0
    };

    // 계절성 특징 저장
    const seasonalKey = `seasonal_${Date.now()}`;
    this.featureStore.set(seasonalKey, {
      sourceId: 'seasonal',
      timestamp: now,
      features: seasonalFeatures
    });
  }

  generateInteractionFeatures() {
    // 서로 다른 소스의 특징들 간 상관관계 특징 생성
    const recentFeatures = Array.from(this.featureStore.values())
      .filter(data => Date.now() - new Date(data.timestamp).getTime() < 3600000) // 최근 1시간
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 100); // 최근 100개

    if (recentFeatures.length < 10) return;

    const interactionFeatures = {};

    // CPU 사용률과 응답시간의 상관관계
    const cpuUsages = recentFeatures.map(f => f.features.cpu_usage).filter(v => v !== undefined);
    const responseTimes = recentFeatures.map(f => f.features.response_time).filter(v => v !== undefined);
    
    if (cpuUsages.length > 5 && responseTimes.length > 5) {
      interactionFeatures.cpu_response_correlation = this.calculateCorrelation(cpuUsages, responseTimes);
    }

    // 수익과 시스템 성능의 상관관계
    const revenues = recentFeatures.map(f => f.features.revenue).filter(v => v !== undefined);
    const systemHealth = recentFeatures.map(f => f.features.system_health_score).filter(v => v !== undefined);
    
    if (revenues.length > 5 && systemHealth.length > 5) {
      interactionFeatures.revenue_health_correlation = this.calculateCorrelation(revenues, systemHealth);
    }

    // 교차 특징 저장
    if (Object.keys(interactionFeatures).length > 0) {
      const interactionKey = `interaction_${Date.now()}`;
      this.featureStore.set(interactionKey, {
        sourceId: 'interaction',
        timestamp: new Date(),
        features: interactionFeatures
      });
    }
  }

  generateTimeSeriesFeatures() {
    console.log('📈 Generating time series features...');
    
    // 시계열 특징: 자기상관, 계절성, 추세 분해 등
    for (const [sourceId, source] of this.dataSources) {
      for (const [featureName, history] of source.featureHistory) {
        if (history.length < 50) continue; // 최소 50개 데이터 포인트 필요
        
        const timeSeriesFeatures = {
          // 지연 특징 (Lag features)
          [`${featureName}_lag_1`]: history[history.length - 2] || 0,
          [`${featureName}_lag_5`]: history[history.length - 6] || 0,
          [`${featureName}_lag_10`]: history[history.length - 11] || 0,
          
          // 이동 평균
          [`${featureName}_ma_5`]: this.calculateMovingAverage(history.slice(-5)),
          [`${featureName}_ma_10`]: this.calculateMovingAverage(history.slice(-10)),
          [`${featureName}_ma_20`]: this.calculateMovingAverage(history.slice(-20)),
          
          // 이동 표준편차
          [`${featureName}_std_5`]: this.calculateStandardDeviation(history.slice(-5)),
          [`${featureName}_std_10`]: this.calculateStandardDeviation(history.slice(-10)),
          
          // 최대/최소값
          [`${featureName}_max_10`]: Math.max(...history.slice(-10)),
          [`${featureName}_min_10`]: Math.min(...history.slice(-10)),
          
          // 변화량
          [`${featureName}_diff_1`]: history[history.length - 1] - (history[history.length - 2] || 0),
          [`${featureName}_diff_5`]: history[history.length - 1] - (history[history.length - 6] || 0)
        };

        // 시계열 특징 저장
        const timeSeriesKey = `${sourceId}_timeseries_${Date.now()}`;
        this.featureStore.set(timeSeriesKey, {
          sourceId: `${sourceId}_timeseries`,
          timestamp: new Date(),
          features: timeSeriesFeatures
        });
      }
    }
  }

  calculateMovingAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  calculateStandardDeviation(values) {
    if (values.length === 0) return 0;
    const mean = this.calculateMovingAverage(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }
    
    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  scheduleDatasetGeneration() {
    console.log('📋 Scheduling training dataset generation...');
    
    // 매 30분마다 훈련 데이터셋 생성
    setInterval(() => {
      this.generateTrainingDatasets();
    }, 1800000); // 30분
  }

  async generateTrainingDatasets() {
    try {
      console.log('📊 Generating training datasets...');
      
      // 1. 예측 작업별 데이터셋 생성
      await this.generateDataset('revenue_prediction', this.createRevenuePredictionDataset());
      await this.generateDataset('performance_prediction', this.createPerformancePredictionDataset());
      await this.generateDataset('anomaly_detection', this.createAnomalyDetectionDataset());
      await this.generateDataset('capacity_planning', this.createCapacityPlanningDataset());
      
      console.log('✅ Training datasets generated successfully');
    } catch (error) {
      console.error('❌ Error generating training datasets:', error);
    }
  }

  generateDataset(datasetName, datasetConfig) {
    const features = this.collectFeaturesForDataset(datasetConfig);
    const labels = this.generateLabelsForDataset(datasetName, features);
    
    const dataset = {
      name: datasetName,
      features,
      labels,
      metadata: {
        createdAt: new Date(),
        featureCount: features.length,
        sampleCount: features[0]?.length || 0,
        datasetConfig
      }
    };

    this.trainingDatasets.set(datasetName, dataset);
    
    // 데이터셋 파일로 저장
    this.saveDatasetToFile(datasetName, dataset);
    
    console.log(`📁 Generated dataset '${datasetName}' with ${dataset.metadata.sampleCount} samples`);
  }

  createRevenuePredictionDataset() {
    return {
      targetFeature: 'revenue',
      inputFeatures: [
        'profit_margin', 'customer_acquisition_cost', 'conversion_rate',
        'page_views', 'session_duration', 'bounce_rate',
        'system_health_score', 'alert_count',
        'hour_of_day', 'day_of_week', 'is_weekend'
      ],
      lookbackWindow: 24, // 24시간 뒤처리
      predictionHorizon: 6 // 6시간 후 예측
    };
  }

  createPerformancePredictionDataset() {
    return {
      targetFeature: 'response_time',
      inputFeatures: [
        'cpu_usage', 'memory_usage', 'disk_usage', 'network_io',
        'throughput', 'active_connections', 'error_rate',
        'hour_of_day', 'day_of_week', 'is_business_hours'
      ],
      lookbackWindow: 12, // 12시간 뒤처리
      predictionHorizon: 2 // 2시간 후 예측
    };
  }

  createAnomalyDetectionDataset() {
    return {
      targetFeature: 'is_anomaly',
      inputFeatures: [
        'cpu_usage', 'memory_usage', 'response_time', 'throughput', 'error_rate',
        'revenue', 'system_health_score', 'alert_count',
        'cpu_usage_volatility', 'response_time_trend_direction'
      ],
      lookbackWindow: 6, // 6시간 뒤처리
      predictionHorizon: 0 // 실시간 탐지
    };
  }

  createCapacityPlanningDataset() {
    return {
      targetFeature: 'resource_utilization',
      inputFeatures: [
        'cpu_usage', 'memory_usage', 'disk_usage',
        'throughput', 'active_connections',
        'hour_of_day', 'day_of_week', 'month_of_year'
      ],
      lookbackWindow: 72, // 72시간 (3일) 뒤처리
      predictionHorizon: 24 // 24시간 후 예측
    };
  }

  collectFeaturesForDataset(config) {
    const { inputFeatures, lookbackWindow, predictionHorizon } = config;
    const featureMatrix = [];
    
    // Feature Store에서 시계열 데이터 수집
    const sortedData = Array.from(this.featureStore.values())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (let i = lookbackWindow; i < sortedData.length - predictionHorizon; i++) {
      const sample = [];
      
      // 룩백 윈도우만큼의 특징들 수집
      for (let j = i - lookbackWindow; j < i; j++) {
        const dataPoint = sortedData[j];
        for (const featureName of inputFeatures) {
          const value = this.getFeatureValue(dataPoint, featureName);
          sample.push(value);
        }
      }
      
      featureMatrix.push(sample);
    }

    return featureMatrix;
  }

  getFeatureValue(dataPoint, featureName) {
    // 모든 소스의 특징에서 해당 특징 찾기
    if (dataPoint.features[featureName] !== undefined) {
      return dataPoint.features[featureName];
    }

    // 특징을 찾을 수 없는 경우 0으로 대체
    return 0;
  }

  generateLabelsForDataset(datasetName, features) {
    // 실제 구현에서는 역사적 데이터를 기반으로 레이블 생성
    // 여기서는 시뮬레이션 데이터 생성
    const labels = [];

    switch (datasetName) {
      case 'revenue_prediction':
        // 수익 예측 레이블 (연속값)
        for (let i = 0; i < features.length; i++) {
          labels.push(50000 + Math.random() * 100000); // 시뮬레이션 수익값
        }
        break;

      case 'performance_prediction':
        // 성능 예측 레이블 (응답시간)
        for (let i = 0; i < features.length; i++) {
          labels.push(100 + Math.random() * 400); // 100-500ms
        }
        break;

      case 'anomaly_detection':
        // 이상 탐지 레이블 (0: 정상, 1: 이상)
        for (let i = 0; i < features.length; i++) {
          labels.push(Math.random() < 0.1 ? 1 : 0); // 10% 이상
        }
        break;

      case 'capacity_planning':
        // 용량 계획 레이블 (리소스 사용률)
        for (let i = 0; i < features.length; i++) {
          labels.push(50 + Math.random() * 40); // 50-90% 사용률
        }
        break;

      default:
        // 기본 레이블
        for (let i = 0; i < features.length; i++) {
          labels.push(0);
        }
    }

    return labels;
  }

  saveDatasetToFile(datasetName, dataset) {
    const fs = require('fs');
    const path = require('path');
    
    const dataDir = path.join(__dirname, '../data/datasets');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, `${datasetName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2));
    
    console.log(`💾 Saved dataset to ${filePath}`);
  }

  // API 엔드포인트 설정
  setupAPI() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // 데이터 파이프라인 상태
    app.get('/api/pipeline/status', (req, res) => {
      const status = {
        dataSources: Array.from(this.dataSources.entries()).map(([id, source]) => ({
          id,
          name: source.name,
          status: source.status,
          lastUpdate: source.lastUpdate,
          errorCount: source.errorCount,
          featureCount: source.features.length
        })),
        featureStore: {
          totalFeatures: this.featureStore.size,
          latestTimestamp: this.getLatestFeatureTimestamp()
        },
        trainingDatasets: Array.from(this.trainingDatasets.entries()).map(([name, dataset]) => ({
          name,
          sampleCount: dataset.metadata.sampleCount,
          featureCount: dataset.metadata.featureCount,
          createdAt: dataset.metadata.createdAt
        }))
      };
      
      res.json(status);
    });

    // 특징 데이터 조회
    app.get('/api/pipeline/features/:sourceId', (req, res) => {
      const { sourceId } = req.params;
      const source = this.dataSources.get(sourceId);
      
      if (!source) {
        return res.status(404).json({ error: 'Data source not found' });
      }

      const features = Object.fromEntries(source.featureHistory);
      res.json(features);
    });

    // 훈련 데이터셋 조회
    app.get('/api/pipeline/datasets/:datasetName', (req, res) => {
      const { datasetName } = req.params;
      const dataset = this.trainingDatasets.get(datasetName);
      
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      res.json(dataset);
    });

    const port = 3400;
    app.listen(port, () => {
      console.log(`🚀 Data Pipeline API running on port ${port}`);
    });
  }

  getLatestFeatureTimestamp() {
    let latest = null;
    for (const data of this.featureStore.values()) {
      if (!latest || new Date(data.timestamp) > new Date(latest)) {
        latest = data.timestamp;
      }
    }
    return latest;
  }
}

// 모듈로 사용할 경우
if (require.main === module) {
  const pipeline = new DataPipeline();
  pipeline.setupAPI();
}

module.exports = DataPipeline;