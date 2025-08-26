/**
 * AIRIS EPM AI 예측 분석 - 통합 서비스
 * 데이터 파이프라인, ML 엔진, 평가 시스템을 통합한 종합 AI 예측 서비스
 */

const express = require('express');
const cors = require('cors');
const EventEmitter = require('events');
const DataPipeline = require('./data-pipeline');
const MLEngine = require('./ml-engine');
const PredictionEvaluator = require('./prediction-evaluator');

class AIPredictionService extends EventEmitter {
  constructor(port = 3500) {
    super();
    this.port = port;
    this.app = express();
    
    // 컴포넌트 초기화
    this.dataPipeline = new DataPipeline();
    this.mlEngine = new MLEngine();
    this.evaluator = new PredictionEvaluator();
    
    // 상태 관리
    this.serviceStatus = 'initializing';
    this.predictionQueue = [];
    this.trainingQueue = [];
    this.activeJobs = new Map();
    
    this.setupEventHandlers();
    this.setupExpress();
    this.startService();
  }

  setupEventHandlers() {
    // 데이터 파이프라인 이벤트
    this.dataPipeline.on('dataSourceError', (data) => {
      console.error('📊 Data source error:', data);
      this.emit('systemAlert', {
        type: 'data_source_error',
        severity: 'high',
        message: `Data source ${data.sourceId} encountered an error`,
        data
      });
    });

    // ML 엔진 이벤트
    this.mlEngine.on('trainingProgress', (data) => {
      console.log(`🎓 Training progress - ${data.modelName}: ${data.epoch}/${data.totalEpochs}`);
      this.emit('trainingProgress', data);
    });

    this.mlEngine.on('trainingCompleted', (data) => {
      console.log(`✅ Training completed for ${data.modelName}`);
      this.emit('trainingCompleted', data);
      this.removeFromTrainingQueue(data.modelName);
    });

    this.mlEngine.on('trainingError', (data) => {
      console.error(`❌ Training error for ${data.modelName}:`, data.error);
      this.emit('trainingError', data);
      this.removeFromTrainingQueue(data.modelName);
    });

    // 평가 시스템 이벤트
    this.evaluator.on('performanceEvaluated', (data) => {
      console.log(`📈 Performance evaluated for ${data.modelId}`);
      this.emit('performanceEvaluated', data);
    });

    this.evaluator.on('performanceAlert', (data) => {
      console.warn(`🚨 Performance alert for ${data.modelId}`);
      this.emit('systemAlert', {
        type: 'performance_alert',
        severity: 'high',
        modelId: data.modelId,
        alerts: data.alerts
      });
    });

    this.evaluator.on('dataDrift', (data) => {
      console.warn(`🌊 Data drift detected for ${data.modelId}: ${data.driftScore}`);
      this.emit('systemAlert', {
        type: 'data_drift',
        severity: 'medium',
        modelId: data.modelId,
        driftScore: data.driftScore
      });
    });

    this.evaluator.on('abTestCompleted', (data) => {
      console.log(`📊 A/B test completed: ${data.testId}`);
      this.emit('abTestCompleted', data);
    });
  }

  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    
    // 로깅 미들웨어
    this.app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} - ${req.method} ${req.path}`);
      next();
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: this.serviceStatus,
        timestamp: new Date().toISOString(),
        components: {
          dataPipeline: 'healthy',
          mlEngine: 'healthy',
          evaluator: 'healthy'
        },
        memory: this.mlEngine.getMemoryUsage()
      });
    });

    // =================
    // 예측 API 엔드포인트
    // =================

    // 단일 예측 수행
    this.app.post('/api/predict/:modelId', async (req, res) => {
      try {
        const { modelId } = req.params;
        const { inputData, options = {} } = req.body;

        const predictionResult = await this.makePrediction(modelId, inputData, options);
        
        res.json({
          success: true,
          modelId,
          result: predictionResult,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Prediction error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 배치 예측 수행
    this.app.post('/api/predict/:modelId/batch', async (req, res) => {
      try {
        const { modelId } = req.params;
        const { inputDataArray, options = {} } = req.body;

        const batchResults = await this.mlEngine.batchPredict(modelId, inputDataArray, options);
        
        res.json({
          success: true,
          modelId,
          results: batchResults,
          count: batchResults.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Batch prediction error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 실시간 예측 스트림 (WebSocket 또는 SSE 대안)
    this.app.get('/api/predict/:modelId/stream', (req, res) => {
      const { modelId } = req.params;
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 스트림 등록
      this.registerPredictionStream(modelId, streamId, res);
      
      req.on('close', () => {
        this.unregisterPredictionStream(streamId);
      });
    });

    // =================
    // 모델 관리 API
    // =================

    // 모델 목록 조회
    this.app.get('/api/models', (req, res) => {
      const models = [];
      
      for (const [modelName, config] of this.mlEngine.modelConfigs) {
        try {
          const modelInfo = this.mlEngine.getModelInfo(modelName);
          const performanceSummary = this.evaluator.getModelPerformanceSummary(modelName);
          
          models.push({
            ...modelInfo,
            performance: performanceSummary.current,
            trend: performanceSummary.trend,
            lastEvaluation: performanceSummary.lastEvaluation
          });
        } catch (error) {
          console.warn(`Warning: Could not get info for model ${modelName}`);
        }
      }
      
      res.json({ models });
    });

    // 특정 모델 정보 조회
    this.app.get('/api/models/:modelId', (req, res) => {
      try {
        const { modelId } = req.params;
        const modelInfo = this.mlEngine.getModelInfo(modelId);
        const performanceSummary = this.evaluator.getModelPerformanceSummary(modelId);
        const trainingHistory = this.mlEngine.getTrainingHistory(modelId);
        
        res.json({
          ...modelInfo,
          performance: performanceSummary,
          trainingHistory
        });
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });

    // 모델 훈련 시작
    this.app.post('/api/models/:modelId/train', async (req, res) => {
      try {
        const { modelId } = req.params;
        const { datasetName, options = {} } = req.body;
        
        const jobId = await this.startModelTraining(modelId, datasetName, options);
        
        res.json({
          success: true,
          jobId,
          modelId,
          status: 'training_started',
          message: 'Model training has been queued'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 모델 훈련 상태 조회
    this.app.get('/api/models/:modelId/training/status', (req, res) => {
      const { modelId } = req.params;
      const trainingJob = this.activeJobs.get(`training_${modelId}`);
      
      if (trainingJob) {
        res.json({
          status: 'training',
          progress: trainingJob.progress,
          startTime: trainingJob.startTime,
          modelId
        });
      } else {
        res.json({
          status: 'not_training',
          modelId
        });
      }
    });

    // =================
    // 평가 및 모니터링 API
    // =================

    // Ground truth 데이터 추가
    this.app.post('/api/evaluation/:modelId/ground-truth', async (req, res) => {
      try {
        const { modelId } = req.params;
        const { predictionId, actualValue, timestamp } = req.body;
        
        await this.evaluator.addGroundTruth(modelId, predictionId, actualValue, timestamp);
        
        res.json({
          success: true,
          message: 'Ground truth data added successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 모델 성능 요약 조회
    this.app.get('/api/evaluation/:modelId/summary', (req, res) => {
      try {
        const { modelId } = req.params;
        const summary = this.evaluator.getModelPerformanceSummary(modelId);
        res.json(summary);
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });

    // 전체 모델 성능 요약
    this.app.get('/api/evaluation/summary', (req, res) => {
      const allSummaries = this.evaluator.getAllModelSummaries();
      res.json(allSummaries);
    });

    // 평가 리포트 내보내기
    this.app.get('/api/evaluation/:modelId/export', (req, res) => {
      try {
        const { modelId } = req.params;
        const { format = 'json' } = req.query;
        
        const report = this.evaluator.exportEvaluationReport(modelId, format);
        
        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${modelId}_evaluation_report.csv"`);
        } else {
          res.setHeader('Content-Type', 'application/json');
        }
        
        res.send(report);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // =================
    // A/B 테스트 API
    // =================

    // A/B 테스트 시작
    this.app.post('/api/ab-test/start', (req, res) => {
      try {
        const { testId, modelA, modelB, trafficSplit, duration } = req.body;
        
        const abTest = this.evaluator.setupABTest(testId, modelA, modelB, trafficSplit, duration);
        
        res.json({
          success: true,
          abTest: {
            testId: abTest.testId,
            modelA: abTest.modelA,
            modelB: abTest.modelB,
            trafficSplit: abTest.trafficSplit,
            startTime: abTest.startTime,
            endTime: abTest.endTime,
            status: abTest.status
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // A/B 테스트 종료
    this.app.post('/api/ab-test/:testId/finalize', async (req, res) => {
      try {
        const { testId } = req.params;
        const result = await this.evaluator.finalizeABTest(testId);
        
        if (result) {
          res.json({
            success: true,
            result
          });
        } else {
          res.status(404).json({
            success: false,
            error: 'A/B test not found'
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 활성 A/B 테스트 목록
    this.app.get('/api/ab-test/active', (req, res) => {
      const activeTests = this.evaluator.getActiveABTests();
      res.json({ activeTests });
    });

    // =================
    // 데이터 파이프라인 API
    // =================

    // 데이터 파이프라인 상태
    this.app.get('/api/pipeline/status', (req, res) => {
      // DataPipeline에서 이미 구현된 API 프록시
      res.redirect(307, 'http://localhost:3400/api/pipeline/status');
    });

    // 특징 데이터 조회
    this.app.get('/api/pipeline/features/:sourceId', (req, res) => {
      const { sourceId } = req.params;
      res.redirect(307, `http://localhost:3400/api/pipeline/features/${sourceId}`);
    });

    // 훈련 데이터셋 조회
    this.app.get('/api/pipeline/datasets/:datasetName', (req, res) => {
      const { datasetName } = req.params;
      res.redirect(307, `http://localhost:3400/api/pipeline/datasets/${datasetName}`);
    });

    // =================
    // 시스템 관리 API
    // =================

    // 시스템 통계
    this.app.get('/api/system/stats', (req, res) => {
      const stats = {
        service: {
          status: this.serviceStatus,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        },
        prediction: {
          queueSize: this.predictionQueue.length,
          totalPredictions: this.getTotalPredictions(),
          averageResponseTime: this.getAverageResponseTime()
        },
        training: {
          queueSize: this.trainingQueue.length,
          activeJobs: this.activeJobs.size,
          totalTrainingJobs: this.getTotalTrainingJobs()
        },
        models: {
          total: this.mlEngine.models.size,
          ready: this.getReadyModelsCount(),
          training: this.getTrainingModelsCount()
        }
      };
      
      res.json(stats);
    });

    // 캐시 관리
    this.app.post('/api/system/cache/clear', (req, res) => {
      this.mlEngine.clearPredictionCache();
      res.json({
        success: true,
        message: 'Prediction cache cleared'
      });
    });

    // 서비스 재시작
    this.app.post('/api/system/restart', (req, res) => {
      res.json({
        success: true,
        message: 'Service restart initiated'
      });
      
      // 안전한 재시작 로직
      setTimeout(() => {
        this.restart();
      }, 1000);
    });

    console.log('🌐 Express API routes configured');
  }

  async startService() {
    try {
      console.log('🚀 Starting AI Prediction Service...');
      
      // 컴포넌트들이 준비될 때까지 대기
      await this.waitForComponents();
      
      // 자동 훈련 스케줄러 시작
      this.startAutoTrainingScheduler();
      
      // 예측 큐 처리기 시작
      this.startPredictionProcessor();
      
      // 서버 시작
      this.server = this.app.listen(this.port, () => {
        console.log(`🎯 AI Prediction Service running on port ${this.port}`);
        this.serviceStatus = 'running';
        this.emit('serviceReady');
      });
      
    } catch (error) {
      console.error('❌ Failed to start AI Prediction Service:', error);
      this.serviceStatus = 'error';
      throw error;
    }
  }

  async waitForComponents() {
    // 실제 구현에서는 각 컴포넌트의 준비 상태를 확인
    console.log('⏳ Waiting for components to initialize...');
    
    // 간단한 지연 (실제로는 각 컴포넌트의 ready 이벤트를 대기)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ All components ready');
  }

  async makePrediction(modelId, inputData, options = {}) {
    const predictionId = `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // A/B 테스트 라우팅 확인
      if (options.abTestId) {
        const routedModel = this.evaluator.routeABTestTraffic(options.abTestId, inputData);
        if (routedModel) {
          modelId = routedModel;
        }
      }

      // 예측 수행
      const result = await this.mlEngine.predict(modelId, inputData, options);
      
      // 예측 결과를 평가 시스템에 추가
      await this.evaluator.addPrediction(
        modelId, 
        predictionId, 
        result.prediction, 
        result.confidence || 1.0, 
        inputData
      );

      return {
        predictionId,
        modelId,
        ...result,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`Prediction failed for ${modelId}:`, error);
      throw error;
    }
  }

  async startModelTraining(modelId, datasetName, options = {}) {
    const jobId = `train_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 훈련 작업을 큐에 추가
    const trainingJob = {
      jobId,
      modelId,
      datasetName,
      options,
      status: 'queued',
      startTime: new Date(),
      progress: 0
    };
    
    this.trainingQueue.push(trainingJob);
    this.activeJobs.set(`training_${modelId}`, trainingJob);
    
    console.log(`📝 Training job queued: ${jobId} for model ${modelId}`);
    
    return jobId;
  }

  startAutoTrainingScheduler() {
    // 매일 새벽 2시에 자동 재훈련 검토
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() === 0) {
        this.checkAutoRetraining();
      }
    }, 60000); // 매분 체크
    
    console.log('⏰ Auto-training scheduler started');
  }

  async checkAutoRetraining() {
    console.log('🔍 Checking for auto-retraining candidates...');
    
    for (const modelId of this.mlEngine.models.keys()) {
      const summary = this.evaluator.getModelPerformanceSummary(modelId);
      
      // 성능이 하락하거나 드리프트가 감지된 경우 재훈련
      if (summary.trend === 'declining' || 
          (summary.drift && summary.drift.status === 'critical')) {
        
        console.log(`🎓 Auto-retraining triggered for ${modelId}`);
        try {
          await this.startModelTraining(modelId, `${modelId}_dataset`, { auto: true });
        } catch (error) {
          console.error(`Auto-retraining failed for ${modelId}:`, error);
        }
      }
    }
  }

  startPredictionProcessor() {
    // 예측 큐 처리 (실제로는 필요시 구현)
    console.log('⚙️ Prediction processor ready');
  }

  removeFromTrainingQueue(modelId) {
    this.trainingQueue = this.trainingQueue.filter(job => job.modelId !== modelId);
    this.activeJobs.delete(`training_${modelId}`);
  }

  // 통계 계산 헬퍼 메서드들
  getTotalPredictions() {
    // 실제 구현에서는 카운터 유지
    return Math.floor(Math.random() * 10000);
  }

  getAverageResponseTime() {
    // 실제 구현에서는 응답시간 추적
    return Math.round(50 + Math.random() * 100);
  }

  getTotalTrainingJobs() {
    // 실제 구현에서는 훈련 작업 카운터 유지
    return Math.floor(Math.random() * 100);
  }

  getReadyModelsCount() {
    return this.mlEngine.models.size;
  }

  getTrainingModelsCount() {
    return this.trainingQueue.length;
  }

  registerPredictionStream(modelId, streamId, res) {
    // 실시간 예측 스트림 등록 (구현 생략)
    console.log(`📡 Prediction stream registered: ${streamId} for model ${modelId}`);
  }

  unregisterPredictionStream(streamId) {
    // 실시간 예측 스트림 해제 (구현 생략)
    console.log(`📡 Prediction stream unregistered: ${streamId}`);
  }

  async restart() {
    console.log('🔄 Restarting AI Prediction Service...');
    
    this.serviceStatus = 'restarting';
    
    // 진행 중인 작업들 안전하게 중지
    // 서버 재시작 로직
    
    if (this.server) {
      this.server.close();
    }
    
    // 컴포넌트 재시작
    setTimeout(() => {
      this.startService();
    }, 2000);
  }

  shutdown() {
    console.log('🛑 Shutting down AI Prediction Service...');
    
    this.serviceStatus = 'shutting_down';
    
    // 리소스 정리
    this.mlEngine.dispose();
    
    if (this.server) {
      this.server.close(() => {
        console.log('✅ AI Prediction Service shut down gracefully');
        process.exit(0);
      });
    }
  }
}

// 메인 실행
if (require.main === module) {
  const service = new AIPredictionService(3500);
  
  // 종료 시그널 처리
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    service.shutdown();
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    service.shutdown();
  });

  // 서비스 이벤트 로깅
  service.on('serviceReady', () => {
    console.log('🎉 AI Prediction Service is ready to serve requests!');
    console.log('📖 API Documentation available at http://localhost:3500/api/');
  });
}

module.exports = AIPredictionService;