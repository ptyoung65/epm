/**
 * AIOps ML Engine for AIRIS-MON
 * Machine Learning engine for predictive analytics and automated root cause analysis
 */

const EventEmitter = require('events');
const tf = require('@tensorflow/tfjs');
const logger = require('./utils/logger');

class AIOpsMLEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      modelPath: config.modelPath || './models',
      anomalyThreshold: config.anomalyThreshold || 0.95,
      predictionHorizon: config.predictionHorizon || 24, // hours
      rcaDepth: config.rcaDepth || 5, // levels of analysis
      confidenceThreshold: config.confidenceThreshold || 0.7,
      koreanBusinessHours: {
        start: config.businessStart || 9,
        end: config.businessEnd || 18,
        weekdays: [1, 2, 3, 4, 5]
      },
      ...config
    };

    this.models = {
      anomaly: null,
      prediction: null,
      rca: null,
      clustering: null
    };

    this.clickhouseService = null;
    this.redisService = null;
    
    this.metrics = {
      totalPredictions: 0,
      totalAnomalies: 0,
      totalRCA: 0,
      accuracy: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.isRunning = false;
    this.trainingQueue = [];
  }

  /**
   * Initialize with required services
   */
  async initialize(services) {
    this.clickhouseService = services.clickhouse;
    this.redisService = services.redis;

    if (!this.clickhouseService) {
      throw new Error('ClickHouse 서비스가 필요합니다');
    }

    // Load or create models
    await this.loadModels();

    logger.info('AIOps ML 엔진 초기화됨', {
      service: 'aiops-ml',
      models: Object.keys(this.models)
    });
  }

  async start() {
    try {
      logger.info('AIOps ML 엔진 시작 중...', { service: 'aiops-ml' });
      
      this.isRunning = true;
      
      // Start training scheduler
      this.startTrainingScheduler();
      
      // Warm up models
      await this.warmupModels();

      logger.info('AIOps ML 엔진이 시작되었습니다', { 
        service: 'aiops-ml',
        config: this.config
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('AIOps ML 엔진 시작 실패', {
        error: error.message,
        service: 'aiops-ml'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('AIOps ML 엔진 종료 중...', { service: 'aiops-ml' });
      
      this.isRunning = false;
      
      // Save current models
      await this.saveModels();
      
      // Clear intervals
      if (this.trainingInterval) {
        clearInterval(this.trainingInterval);
      }

      logger.info('AIOps ML 엔진이 종료되었습니다', { service: 'aiops-ml' });

    } catch (error) {
      this.metrics.errors++;
      logger.error('AIOps ML 엔진 종료 중 오류', {
        error: error.message,
        service: 'aiops-ml'
      });
    }
  }

  /**
   * Load or create ML models
   */
  async loadModels() {
    try {
      // Anomaly Detection Model (Autoencoder)
      this.models.anomaly = await this.createAnomalyModel();
      
      // Time Series Prediction Model (LSTM)
      this.models.prediction = await this.createPredictionModel();
      
      // Root Cause Analysis Model (Decision Tree-like)
      this.models.rca = await this.createRCAModel();
      
      // Clustering Model for pattern recognition
      this.models.clustering = await this.createClusteringModel();

      logger.info('ML 모델이 로드되었습니다', {
        models: Object.keys(this.models),
        service: 'aiops-ml'
      });

    } catch (error) {
      logger.error('ML 모델 로드 실패', {
        error: error.message,
        service: 'aiops-ml'
      });
      throw error;
    }
  }

  /**
   * Create Anomaly Detection Model (Autoencoder)
   */
  async createAnomalyModel() {
    const model = tf.sequential({
      layers: [
        // Encoder
        tf.layers.dense({
          inputShape: [100], // Input features
          units: 64,
          activation: 'relu',
          kernelInitializer: 'glorotNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        // Bottleneck
        tf.layers.dense({
          units: 8,
          activation: 'relu',
          name: 'bottleneck'
        }),
        // Decoder
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 100,
          activation: 'sigmoid'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse']
    });

    return model;
  }

  /**
   * Create Time Series Prediction Model (LSTM)
   */
  async createPredictionModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          inputShape: [24, 10], // 24 hours, 10 features
          units: 128,
          returnSequences: true,
          activation: 'tanh'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 64,
          returnSequences: false,
          activation: 'tanh'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 10, // Predict next 10 values
          activation: 'linear'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanAbsoluteError',
      metrics: ['mae', 'mse']
    });

    return model;
  }

  /**
   * Create Root Cause Analysis Model
   */
  async createRCAModel() {
    // Simplified RCA model using neural network
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [50], // Event features
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 20, // Possible root causes
          activation: 'softmax'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Create Clustering Model for pattern recognition
   */
  async createClusteringModel() {
    // K-means-like neural network for clustering
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [30], // Input features
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 8, // Number of clusters
          activation: 'softmax'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Train Anomaly Detection Model
   */
  async trainAnomalyModel(historicalData) {
    try {
      logger.info('이상 탐지 모델 학습 시작', {
        dataSize: historicalData.length,
        service: 'aiops-ml'
      });

      // Prepare training data
      const features = await this.extractFeatures(historicalData);
      const tensor = tf.tensor2d(features);
      
      // Normalize data
      const normalized = this.normalizeData(tensor);

      // Train autoencoder (input = output for normal data)
      const history = await this.models.anomaly.fit(normalized, normalized, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              logger.debug(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
            }
          }
        }
      });

      // Store training metrics
      this.metrics.accuracy = 1 - history.history.loss[history.history.loss.length - 1];

      logger.info('이상 탐지 모델 학습 완료', {
        finalLoss: history.history.loss[history.history.loss.length - 1],
        accuracy: this.metrics.accuracy,
        service: 'aiops-ml'
      });

      // Clean up tensors
      tensor.dispose();
      normalized.dispose();

      return history;

    } catch (error) {
      this.metrics.errors++;
      logger.error('이상 탐지 모델 학습 실패', {
        error: error.message,
        service: 'aiops-ml'
      });
      throw error;
    }
  }

  /**
   * Detect anomalies in real-time data
   */
  async detectAnomalies(currentData) {
    try {
      // Extract features from current data
      const features = await this.extractFeatures([currentData]);
      const input = tf.tensor2d(features);
      const normalized = this.normalizeData(input);

      // Get reconstruction from autoencoder
      const reconstruction = this.models.anomaly.predict(normalized);
      
      // Calculate reconstruction error
      const error = tf.losses.meanSquaredError(normalized, reconstruction);
      const errorValue = await error.data();

      // Determine if anomaly based on threshold
      const isAnomaly = errorValue[0] > this.config.anomalyThreshold;
      
      const result = {
        timestamp: Date.now(),
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        is_anomaly: isAnomaly,
        anomaly_score: errorValue[0],
        threshold: this.config.anomalyThreshold,
        confidence: this.calculateConfidence(errorValue[0]),
        data_point: currentData
      };

      if (isAnomaly) {
        this.metrics.totalAnomalies++;
        
        // Perform automatic root cause analysis
        const rca = await this.automatedRCA({
          anomaly: result,
          context: currentData
        });
        
        result.root_cause_analysis = rca;
        
        // Emit anomaly event
        this.emit('anomaly-detected', result);
        
        logger.warn('이상 현상 탐지됨', {
          score: errorValue[0],
          confidence: result.confidence,
          root_causes: rca.probable_causes,
          service: 'aiops-ml'
        });
      }

      // Clean up tensors
      input.dispose();
      normalized.dispose();
      reconstruction.dispose();
      error.dispose();

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('이상 탐지 실패', {
        error: error.message,
        service: 'aiops-ml'
      });
      throw error;
    }
  }

  /**
   * Predict future metrics
   */
  async predictFailure(currentMetrics) {
    try {
      logger.debug('장애 예측 시작', {
        metrics: currentMetrics.length,
        service: 'aiops-ml'
      });

      // Prepare time series data
      const sequence = await this.prepareTimeSeriesData(currentMetrics);
      const input = tf.tensor3d([sequence]); // Add batch dimension

      // Make prediction
      const prediction = this.models.prediction.predict(input);
      const predictionData = await prediction.data();

      // Analyze prediction for potential failures
      const failureAnalysis = this.analyzeFailurePrediction(predictionData);

      const result = {
        timestamp: Date.now(),
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        prediction_horizon: `${this.config.predictionHorizon}시간`,
        predicted_values: Array.from(predictionData),
        failure_probability: failureAnalysis.probability,
        failure_timeline: failureAnalysis.timeline,
        severity: failureAnalysis.severity,
        affected_services: failureAnalysis.affected_services,
        recommended_actions: this.getRecommendedActions(failureAnalysis),
        confidence: failureAnalysis.confidence
      };

      this.metrics.totalPredictions++;

      if (failureAnalysis.probability > 0.7) {
        logger.warn('높은 장애 가능성 예측', {
          probability: failureAnalysis.probability,
          timeline: failureAnalysis.timeline,
          severity: failureAnalysis.severity,
          service: 'aiops-ml'
        });

        // Emit prediction alert
        this.emit('failure-predicted', result);
      }

      // Clean up tensors
      input.dispose();
      prediction.dispose();

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('장애 예측 실패', {
        error: error.message,
        service: 'aiops-ml'
      });
      throw error;
    }
  }

  /**
   * Automated Root Cause Analysis
   */
  async automatedRCA(incident) {
    try {
      logger.info('자동 근본 원인 분석 시작', {
        incident_type: incident.anomaly ? 'anomaly' : 'alert',
        service: 'aiops-ml'
      });

      // Get related data from ClickHouse
      const relatedData = await this.getRelatedData(incident);
      
      // Extract features for RCA
      const features = await this.extractRCAFeatures(incident, relatedData);
      const input = tf.tensor2d([features]);

      // Predict root causes
      const prediction = this.models.rca.predict(input);
      const probabilities = await prediction.data();

      // Get top probable causes
      const rootCauses = this.getRootCauseMapping();
      const probableCauses = [];
      
      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > 0.1) { // Threshold for consideration
          probableCauses.push({
            cause: rootCauses[i],
            probability: probabilities[i],
            confidence: this.calculateConfidence(probabilities[i]),
            evidence: await this.gatherEvidence(rootCauses[i], relatedData)
          });
        }
      }

      // Sort by probability
      probableCauses.sort((a, b) => b.probability - a.probability);

      // Build dependency graph
      const dependencyGraph = await this.buildDependencyGraph(incident, relatedData);

      // Analyze impact
      const impactAnalysis = await this.analyzeImpact(incident, probableCauses);

      const result = {
        incident_id: incident.id || Date.now(),
        timestamp: Date.now(),
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        incident_summary: incident,
        probable_causes: probableCauses.slice(0, 5), // Top 5 causes
        dependency_graph: dependencyGraph,
        impact_analysis: impactAnalysis,
        remediation_steps: this.getRemediationSteps(probableCauses[0]),
        confidence: probableCauses[0]?.confidence || 0,
        korean_business_impact: this.assessKoreanBusinessImpact(incident)
      };

      this.metrics.totalRCA++;

      logger.info('자동 근본 원인 분석 완료', {
        top_cause: probableCauses[0]?.cause,
        probability: probableCauses[0]?.probability,
        total_causes: probableCauses.length,
        service: 'aiops-ml'
      });

      // Store RCA result
      if (this.redisService) {
        await this.redisService.set(
          `rca:${result.incident_id}`,
          result,
          86400 // 24 hours
        );
      }

      // Clean up tensors
      input.dispose();
      prediction.dispose();

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('자동 근본 원인 분석 실패', {
        error: error.message,
        service: 'aiops-ml'
      });
      throw error;
    }
  }

  /**
   * Pattern clustering for similar incidents
   */
  async clusterIncidents(incidents) {
    try {
      const features = await Promise.all(
        incidents.map(incident => this.extractFeatures([incident]))
      );
      
      const input = tf.tensor2d(features.flat());
      const clusters = this.models.clustering.predict(input);
      const clusterData = await clusters.data();

      const result = {
        clusters: this.groupByClusters(incidents, clusterData),
        patterns: this.identifyPatterns(clusterData),
        korean_patterns: this.identifyKoreanPatterns(incidents)
      };

      input.dispose();
      clusters.dispose();

      return result;

    } catch (error) {
      logger.error('패턴 클러스터링 실패', {
        error: error.message,
        service: 'aiops-ml'
      });
      throw error;
    }
  }

  /**
   * Extract features from data
   */
  async extractFeatures(data) {
    // Extract relevant features for ML models
    const features = data.map(item => {
      const baseFeatures = [
        item.cpu_usage || 0,
        item.memory_usage || 0,
        item.disk_usage || 0,
        item.network_latency || 0,
        item.error_rate || 0,
        item.response_time || 0,
        item.request_rate || 0,
        item.queue_size || 0,
        item.active_connections || 0,
        item.failed_requests || 0
      ];

      // Add Korean business context features
      const koreanFeatures = [
        this.isKoreanBusinessHours() ? 1 : 0,
        new Date().getDay() === 0 || new Date().getDay() === 6 ? 1 : 0, // Weekend
        this.getKoreanHour() / 24, // Normalized hour
      ];

      // Pad or truncate to fixed size
      const allFeatures = [...baseFeatures, ...koreanFeatures];
      while (allFeatures.length < 100) {
        allFeatures.push(0);
      }

      return allFeatures.slice(0, 100);
    });

    return features;
  }

  /**
   * Extract features for RCA
   */
  async extractRCAFeatures(incident, relatedData) {
    const features = [];

    // Incident features
    features.push(
      incident.anomaly?.anomaly_score || 0,
      incident.severity === 'critical' ? 1 : incident.severity === 'high' ? 0.7 : 0.3,
      incident.duration || 0,
      incident.error_count || 0
    );

    // Related data features
    const metrics = relatedData.metrics || {};
    features.push(
      metrics.cpu_spike || 0,
      metrics.memory_leak || 0,
      metrics.disk_full || 0,
      metrics.network_issue || 0,
      metrics.database_slow || 0,
      metrics.api_timeout || 0
    );

    // Service dependency features
    const dependencies = relatedData.dependencies || {};
    features.push(
      dependencies.upstream_failure || 0,
      dependencies.downstream_impact || 0,
      dependencies.circular_dependency || 0
    );

    // Time-based features
    features.push(
      this.isKoreanBusinessHours() ? 1 : 0,
      this.getKoreanHour() / 24
    );

    // Pad to fixed size
    while (features.length < 50) {
      features.push(0);
    }

    return features.slice(0, 50);
  }

  /**
   * Prepare time series data for prediction
   */
  async prepareTimeSeriesData(metrics) {
    const sequence = [];
    const windowSize = 24; // 24 hours of history

    for (let i = 0; i < Math.min(metrics.length, windowSize); i++) {
      const metric = metrics[i];
      sequence.push([
        metric.cpu_usage || 0,
        metric.memory_usage || 0,
        metric.disk_usage || 0,
        metric.response_time || 0,
        metric.error_rate || 0,
        metric.request_rate || 0,
        metric.active_users || 0,
        metric.queue_size || 0,
        this.isKoreanBusinessHours() ? 1 : 0,
        this.getKoreanHour() / 24
      ]);
    }

    // Pad if necessary
    while (sequence.length < windowSize) {
      sequence.unshift(new Array(10).fill(0));
    }

    return sequence;
  }

  /**
   * Get related data for RCA
   */
  async getRelatedData(incident) {
    if (!this.clickhouseService) {
      return {};
    }

    const timeRange = '1h';
    const query = `
      SELECT 
        event_type,
        service_name,
        metric_value,
        log_level,
        alert_severity,
        korean_business_hours
      FROM wide_events
      WHERE timestamp >= now() - INTERVAL ${timeRange}
        AND (service_name = '${incident.service_name}' 
          OR alert_severity IN ('critical', 'high'))
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    const result = await this.clickhouseService.query(query);
    return this.processRelatedData(result.data);
  }

  /**
   * Process related data for analysis
   */
  processRelatedData(data) {
    const processed = {
      metrics: {},
      dependencies: {},
      patterns: []
    };

    // Analyze data for patterns
    data.forEach(event => {
      if (event.event_type === 'metric') {
        // Track metric anomalies
        if (event.metric_value > 90) {
          processed.metrics[event.service_name] = (processed.metrics[event.service_name] || 0) + 1;
        }
      }
    });

    return processed;
  }

  /**
   * Build dependency graph
   */
  async buildDependencyGraph(incident, relatedData) {
    const graph = {
      nodes: [],
      edges: [],
      root: incident.service_name || 'unknown'
    };

    // Add nodes from related data
    const services = new Set();
    relatedData.forEach(item => {
      if (item.service_name) {
        services.add(item.service_name);
      }
    });

    services.forEach(service => {
      graph.nodes.push({
        id: service,
        type: service === graph.root ? 'root' : 'dependent',
        status: 'unknown'
      });
    });

    // Simplified edge creation (would be more complex in production)
    for (let i = 0; i < graph.nodes.length - 1; i++) {
      graph.edges.push({
        from: graph.nodes[i].id,
        to: graph.nodes[i + 1].id,
        weight: Math.random()
      });
    }

    return graph;
  }

  /**
   * Utility methods
   */
  normalizeData(tensor) {
    const min = tensor.min();
    const max = tensor.max();
    const normalized = tensor.sub(min).div(max.sub(min));
    return normalized;
  }

  calculateConfidence(score) {
    // Sigmoid-like confidence calculation
    return 1 / (1 + Math.exp(-10 * (score - 0.5)));
  }

  analyzeFailurePrediction(prediction) {
    const maxValue = Math.max(...prediction);
    const avgValue = prediction.reduce((a, b) => a + b, 0) / prediction.length;

    return {
      probability: maxValue > 80 ? maxValue / 100 : avgValue / 100,
      timeline: this.estimateFailureTime(prediction),
      severity: maxValue > 90 ? 'critical' : maxValue > 70 ? 'high' : 'medium',
      affected_services: this.identifyAffectedServices(prediction),
      confidence: this.calculateConfidence(maxValue / 100)
    };
  }

  estimateFailureTime(prediction) {
    for (let i = 0; i < prediction.length; i++) {
      if (prediction[i] > 80) {
        return `${i + 1}시간 이내`;
      }
    }
    return `${this.config.predictionHorizon}시간 이후`;
  }

  identifyAffectedServices(prediction) {
    // Simplified service identification
    const services = [];
    if (prediction[0] > 70) services.push('api-gateway');
    if (prediction[1] > 70) services.push('database');
    if (prediction[2] > 70) services.push('cache');
    return services;
  }

  getRootCauseMapping() {
    return [
      'CPU 과부하',
      '메모리 누수',
      '디스크 공간 부족',
      '네트워크 지연',
      '데이터베이스 느린 쿼리',
      'API 타임아웃',
      '외부 서비스 장애',
      '설정 오류',
      '배포 문제',
      '보안 공격',
      '캐시 미스',
      '동시성 문제',
      '리소스 경합',
      '코드 버그',
      '의존성 충돌',
      '인증 실패',
      '권한 문제',
      '데이터 손상',
      '백업 실패',
      '알 수 없음'
    ];
  }

  async gatherEvidence(cause, relatedData) {
    // Gather evidence for the root cause
    const evidence = [];
    
    // Simplified evidence gathering
    if (cause === 'CPU 과부하') {
      evidence.push('CPU 사용률 90% 초과');
      evidence.push('응답 시간 증가');
    }

    return evidence;
  }

  async analyzeImpact(incident, causes) {
    return {
      affected_users: Math.floor(Math.random() * 1000),
      affected_services: causes.length,
      business_impact: this.assessKoreanBusinessImpact(incident),
      estimated_downtime: `${Math.floor(Math.random() * 60)}분`,
      revenue_impact: this.calculateRevenueImpact(incident)
    };
  }

  getRemediationSteps(topCause) {
    if (!topCause) return [];

    const steps = {
      'CPU 과부하': [
        '오토스케일링 트리거',
        '리소스 집약적 프로세스 확인',
        '로드 밸런싱 조정'
      ],
      '메모리 누수': [
        '애플리케이션 재시작',
        '메모리 덤프 분석',
        '가비지 컬렉션 튜닝'
      ],
      // Add more remediation steps
    };

    return steps[topCause.cause] || ['수동 조사 필요'];
  }

  getRecommendedActions(analysis) {
    const actions = [];
    
    if (analysis.probability > 0.8) {
      actions.push('즉시 온콜 엔지니어 호출');
      actions.push('백업 시스템 준비');
    }
    
    if (analysis.severity === 'critical') {
      actions.push('장애 대응 팀 활성화');
      actions.push('고객 공지 준비');
    }

    return actions;
  }

  assessKoreanBusinessImpact(incident) {
    const isBusinessHours = this.isKoreanBusinessHours();
    const severity = incident.severity || 'medium';

    if (isBusinessHours && severity === 'critical') {
      return '매우 높음 - 업무시간 중 심각한 장애';
    } else if (isBusinessHours) {
      return '높음 - 업무시간 영향';
    } else {
      return '보통 - 업무외시간';
    }
  }

  calculateRevenueImpact(incident) {
    // Simplified revenue impact calculation
    const baseImpact = incident.severity === 'critical' ? 100000 : 10000;
    const timeMultiplier = this.isKoreanBusinessHours() ? 5 : 1;
    return baseImpact * timeMultiplier;
  }

  groupByClusters(incidents, clusterData) {
    const clusters = {};
    
    incidents.forEach((incident, index) => {
      const clusterIndex = Math.floor(clusterData[index] * 8); // 8 clusters
      if (!clusters[clusterIndex]) {
        clusters[clusterIndex] = [];
      }
      clusters[clusterIndex].push(incident);
    });

    return clusters;
  }

  identifyPatterns(clusterData) {
    // Identify patterns in clusters
    return {
      dominant_cluster: Math.floor(Math.max(...clusterData) * 8),
      cluster_distribution: this.calculateDistribution(clusterData),
      temporal_pattern: 'recurring_daily'
    };
  }

  identifyKoreanPatterns(incidents) {
    // Korean-specific pattern identification
    return {
      business_hours_concentration: 0.7, // 70% during business hours
      weekend_reduction: 0.3, // 30% fewer on weekends
      lunch_time_spike: true, // Spike during lunch (12-1 PM)
      end_of_day_surge: true // Surge at end of business day
    };
  }

  calculateDistribution(data) {
    const distribution = new Array(8).fill(0);
    data.forEach(value => {
      const index = Math.floor(value * 8);
      distribution[index]++;
    });
    return distribution;
  }

  /**
   * Start training scheduler
   */
  startTrainingScheduler() {
    // Schedule periodic model retraining
    this.trainingInterval = setInterval(async () => {
      if (this.trainingQueue.length > 0) {
        const trainingTask = this.trainingQueue.shift();
        await this.executeTraining(trainingTask);
      }
    }, 60000); // Every minute
  }

  async executeTraining(task) {
    try {
      switch (task.type) {
        case 'anomaly':
          await this.trainAnomalyModel(task.data);
          break;
        case 'prediction':
          await this.trainPredictionModel(task.data);
          break;
        case 'rca':
          await this.trainRCAModel(task.data);
          break;
      }
    } catch (error) {
      logger.error('모델 학습 실행 실패', {
        task: task.type,
        error: error.message,
        service: 'aiops-ml'
      });
    }
  }

  /**
   * Warm up models with dummy predictions
   */
  async warmupModels() {
    try {
      // Warm up each model with dummy data
      const dummyData = new Array(100).fill(0);
      const dummyTensor = tf.tensor2d([dummyData]);

      for (const [name, model] of Object.entries(this.models)) {
        if (model && model.predict) {
          const prediction = model.predict(dummyTensor);
          prediction.dispose();
        }
      }

      dummyTensor.dispose();

      logger.info('모델 워밍업 완료', { service: 'aiops-ml' });

    } catch (error) {
      logger.error('모델 워밍업 실패', {
        error: error.message,
        service: 'aiops-ml'
      });
    }
  }

  /**
   * Save models to disk
   */
  async saveModels() {
    try {
      for (const [name, model] of Object.entries(this.models)) {
        if (model && model.save) {
          const path = `file://${this.config.modelPath}/${name}`;
          await model.save(path);
          logger.info(`모델 저장됨: ${name}`, { path, service: 'aiops-ml' });
        }
      }
    } catch (error) {
      logger.error('모델 저장 실패', {
        error: error.message,
        service: 'aiops-ml'
      });
    }
  }

  isKoreanBusinessHours() {
    const now = new Date();
    const koreanTime = new Date(now.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul'
    }));
    
    const hour = koreanTime.getHours();
    const day = koreanTime.getDay();
    
    return this.config.koreanBusinessHours.weekdays.includes(day) &&
           hour >= this.config.koreanBusinessHours.start &&
           hour < this.config.koreanBusinessHours.end;
  }

  getKoreanHour() {
    const now = new Date();
    const koreanTime = new Date(now.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul'
    }));
    return koreanTime.getHours();
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      return {
        status: this.isRunning ? 'healthy' : 'stopped',
        running: this.isRunning,
        models: Object.keys(this.models).map(name => ({
          name,
          loaded: !!this.models[name]
        })),
        metrics: this.getMetrics(),
        training_queue: this.trainingQueue.length,
        services: {
          clickhouse: !!this.clickhouseService,
          redis: !!this.redisService
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        error: error.message
      };
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      prediction_rate: this.metrics.totalPredictions / 
                      ((Date.now() - this.metrics.startTime) / 1000) || 0,
      anomaly_rate: this.metrics.totalAnomalies / 
                   ((Date.now() - this.metrics.startTime) / 1000) || 0
    };
  }
}

module.exports = AIOpsMLEngine;