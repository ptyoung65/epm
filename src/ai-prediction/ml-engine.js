/**
 * AIRIS EPM AI 예측 분석 - 머신러닝 엔진
 * TensorFlow.js 기반 모델 훈련, 추론 및 관리
 */

const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class MLEngine extends EventEmitter {
  constructor() {
    super();
    this.models = new Map();
    this.trainingHistory = new Map();
    this.predictionCache = new Map();
    this.modelConfigs = new Map();
    
    this.setupModelConfigurations();
    this.initializeModels();
  }

  setupModelConfigurations() {
    // 수익 예측 모델 설정
    this.modelConfigs.set('revenue_prediction', {
      type: 'regression',
      architecture: 'lstm',
      inputShape: [24, 11], // 24시간, 11개 특징
      outputShape: 1,
      layers: [
        { type: 'lstm', units: 64, returnSequences: true },
        { type: 'dropout', rate: 0.2 },
        { type: 'lstm', units: 32, returnSequences: false },
        { type: 'dropout', rate: 0.2 },
        { type: 'dense', units: 16, activation: 'relu' },
        { type: 'dense', units: 1, activation: 'linear' }
      ],
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae', 'mse'],
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2
    });

    // 성능 예측 모델 설정
    this.modelConfigs.set('performance_prediction', {
      type: 'regression',
      architecture: 'feedforward',
      inputShape: [120], // 12시간 * 10개 특징
      outputShape: 1,
      layers: [
        { type: 'dense', units: 128, activation: 'relu' },
        { type: 'dropout', rate: 0.3 },
        { type: 'dense', units: 64, activation: 'relu' },
        { type: 'dropout', rate: 0.3 },
        { type: 'dense', units: 32, activation: 'relu' },
        { type: 'dense', units: 1, activation: 'linear' }
      ],
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae'],
      epochs: 150,
      batchSize: 64,
      validationSplit: 0.2
    });

    // 이상 탐지 모델 설정
    this.modelConfigs.set('anomaly_detection', {
      type: 'classification',
      architecture: 'autoencoder',
      inputShape: [60], // 6시간 * 10개 특징
      outputShape: 2, // 정상/이상
      layers: [
        // Encoder
        { type: 'dense', units: 32, activation: 'relu' },
        { type: 'dense', units: 16, activation: 'relu' },
        { type: 'dense', units: 8, activation: 'relu' },
        // Decoder
        { type: 'dense', units: 16, activation: 'relu' },
        { type: 'dense', units: 32, activation: 'relu' },
        { type: 'dense', units: 60, activation: 'sigmoid' },
        // Classification head
        { type: 'dense', units: 16, activation: 'relu' },
        { type: 'dense', units: 2, activation: 'softmax' }
      ],
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall'],
      epochs: 200,
      batchSize: 128,
      validationSplit: 0.2
    });

    // 용량 계획 모델 설정
    this.modelConfigs.set('capacity_planning', {
      type: 'regression',
      architecture: 'cnn_lstm',
      inputShape: [72, 8], // 72시간, 8개 특징
      outputShape: 3, // CPU, 메모리, 디스크 사용률 예측
      layers: [
        // CNN layers for feature extraction
        { type: 'conv1d', filters: 64, kernelSize: 3, activation: 'relu' },
        { type: 'conv1d', filters: 32, kernelSize: 3, activation: 'relu' },
        { type: 'maxPooling1d', poolSize: 2 },
        // LSTM layers for temporal modeling
        { type: 'lstm', units: 50, returnSequences: true },
        { type: 'lstm', units: 25, returnSequences: false },
        { type: 'dense', units: 16, activation: 'relu' },
        { type: 'dense', units: 3, activation: 'sigmoid' }
      ],
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae'],
      epochs: 120,
      batchSize: 32,
      validationSplit: 0.2
    });

    console.log(`🧠 Configured ${this.modelConfigs.size} ML model architectures`);
  }

  async initializeModels() {
    console.log('🏗️ Initializing ML models...');

    for (const [modelName, config] of this.modelConfigs) {
      try {
        // 기존 모델 로드 시도
        const model = await this.loadModel(modelName);
        if (model) {
          this.models.set(modelName, model);
          console.log(`✅ Loaded existing model: ${modelName}`);
        } else {
          // 새 모델 생성
          const newModel = this.createModel(config);
          this.models.set(modelName, newModel);
          console.log(`🆕 Created new model: ${modelName}`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize model ${modelName}:`, error);
      }
    }

    console.log(`🎯 Initialized ${this.models.size} ML models`);
  }

  createModel(config) {
    const model = tf.sequential();
    
    // 아키텍처별 모델 구성
    switch (config.architecture) {
      case 'lstm':
        return this.createLSTMModel(config);
      case 'feedforward':
        return this.createFeedforwardModel(config);
      case 'autoencoder':
        return this.createAutoencoderModel(config);
      case 'cnn_lstm':
        return this.createCNNLSTMModel(config);
      default:
        return this.createFeedforwardModel(config);
    }
  }

  createLSTMModel(config) {
    const model = tf.sequential();
    
    for (let i = 0; i < config.layers.length; i++) {
      const layer = config.layers[i];
      
      if (i === 0 && layer.type === 'lstm') {
        // 첫 번째 LSTM 레이어
        model.add(tf.layers.lstm({
          units: layer.units,
          returnSequences: layer.returnSequences,
          inputShape: config.inputShape
        }));
      } else if (layer.type === 'lstm') {
        model.add(tf.layers.lstm({
          units: layer.units,
          returnSequences: layer.returnSequences
        }));
      } else if (layer.type === 'dropout') {
        model.add(tf.layers.dropout({ rate: layer.rate }));
      } else if (layer.type === 'dense') {
        model.add(tf.layers.dense({
          units: layer.units,
          activation: layer.activation
        }));
      }
    }

    model.compile({
      optimizer: config.optimizer,
      loss: config.loss,
      metrics: config.metrics
    });

    return model;
  }

  createFeedforwardModel(config) {
    const model = tf.sequential();
    
    for (let i = 0; i < config.layers.length; i++) {
      const layer = config.layers[i];
      
      if (i === 0 && layer.type === 'dense') {
        // 첫 번째 Dense 레이어
        model.add(tf.layers.dense({
          units: layer.units,
          activation: layer.activation,
          inputShape: config.inputShape
        }));
      } else if (layer.type === 'dense') {
        model.add(tf.layers.dense({
          units: layer.units,
          activation: layer.activation
        }));
      } else if (layer.type === 'dropout') {
        model.add(tf.layers.dropout({ rate: layer.rate }));
      }
    }

    model.compile({
      optimizer: config.optimizer,
      loss: config.loss,
      metrics: config.metrics
    });

    return model;
  }

  createAutoencoderModel(config) {
    const input = tf.input({ shape: config.inputShape });
    
    // Encoder
    let x = tf.layers.dense({ units: 32, activation: 'relu' }).apply(input);
    x = tf.layers.dense({ units: 16, activation: 'relu' }).apply(x);
    const encoded = tf.layers.dense({ units: 8, activation: 'relu' }).apply(x);
    
    // Decoder for reconstruction loss
    let decoded = tf.layers.dense({ units: 16, activation: 'relu' }).apply(encoded);
    decoded = tf.layers.dense({ units: 32, activation: 'relu' }).apply(decoded);
    const reconstructed = tf.layers.dense({ 
      units: config.inputShape[0], 
      activation: 'sigmoid' 
    }).apply(decoded);
    
    // Classification head for anomaly detection
    let classified = tf.layers.dense({ units: 16, activation: 'relu' }).apply(encoded);
    classified = tf.layers.dropout({ rate: 0.3 }).apply(classified);
    const output = tf.layers.dense({ 
      units: config.outputShape, 
      activation: 'softmax' 
    }).apply(classified);

    const model = tf.model({ inputs: input, outputs: [reconstructed, output] });
    
    model.compile({
      optimizer: config.optimizer,
      loss: ['meanSquaredError', config.loss],
      lossWeights: [0.3, 0.7], // 재구성 손실: 30%, 분류 손실: 70%
      metrics: {
        1: config.metrics // 분류 출력에만 메트릭 적용
      }
    });

    return model;
  }

  createCNNLSTMModel(config) {
    const model = tf.sequential();
    
    // CNN layers
    model.add(tf.layers.conv1d({
      filters: 64,
      kernelSize: 3,
      activation: 'relu',
      inputShape: config.inputShape
    }));
    
    model.add(tf.layers.conv1d({
      filters: 32,
      kernelSize: 3,
      activation: 'relu'
    }));
    
    model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
    
    // LSTM layers
    model.add(tf.layers.lstm({
      units: 50,
      returnSequences: true
    }));
    
    model.add(tf.layers.lstm({
      units: 25,
      returnSequences: false
    }));
    
    // Dense layers
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dense({
      units: config.outputShape,
      activation: 'sigmoid'
    }));

    model.compile({
      optimizer: config.optimizer,
      loss: config.loss,
      metrics: config.metrics
    });

    return model;
  }

  async trainModel(modelName, dataset, options = {}) {
    console.log(`🎓 Starting training for model: ${modelName}`);
    
    const model = this.models.get(modelName);
    const config = this.modelConfigs.get(modelName);
    
    if (!model || !config) {
      throw new Error(`Model ${modelName} not found`);
    }

    try {
      // 데이터 준비
      const { features, labels } = this.prepareTrainingData(dataset, config);
      
      // 훈련 옵션 설정
      const trainOptions = {
        epochs: options.epochs || config.epochs,
        batchSize: options.batchSize || config.batchSize,
        validationSplit: options.validationSplit || config.validationSplit,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            this.emit('trainingProgress', {
              modelName,
              epoch: epoch + 1,
              totalEpochs: trainOptions.epochs,
              logs
            });
            
            if ((epoch + 1) % 10 === 0) {
              console.log(`📊 Epoch ${epoch + 1}/${trainOptions.epochs} - Loss: ${logs.loss.toFixed(4)} - Val Loss: ${logs.val_loss.toFixed(4)}`);
            }
          },
          onTrainEnd: () => {
            console.log(`✅ Training completed for ${modelName}`);
            this.emit('trainingCompleted', { modelName });
          }
        }
      };

      // 모델 훈련 실행
      const history = await model.fit(features, labels, trainOptions);
      
      // 훈련 히스토리 저장
      this.trainingHistory.set(modelName, {
        history: history.history,
        timestamp: new Date(),
        config: trainOptions
      });

      // 모델 저장
      await this.saveModel(modelName, model);
      
      // 모델 평가
      const evaluation = await this.evaluateModel(modelName, features, labels);
      
      console.log(`🎯 Model ${modelName} training completed with validation loss: ${evaluation.loss?.toFixed(4)}`);
      
      return {
        history: history.history,
        evaluation,
        modelName
      };
      
    } catch (error) {
      console.error(`❌ Training failed for ${modelName}:`, error);
      this.emit('trainingError', { modelName, error });
      throw error;
    }
  }

  prepareTrainingData(dataset, config) {
    const { features, labels } = dataset;
    
    // 특징 텐서 생성
    let featureTensor;
    if (config.architecture === 'lstm' || config.architecture === 'cnn_lstm') {
      // 3D 텐서 (samples, timesteps, features)
      featureTensor = tf.tensor3d(features);
    } else {
      // 2D 텐서 (samples, features)
      featureTensor = tf.tensor2d(features);
    }
    
    // 레이블 텐서 생성
    let labelTensor;
    if (config.type === 'classification') {
      // 원-핫 인코딩
      if (config.outputShape > 1) {
        labelTensor = tf.oneHot(tf.tensor1d(labels, 'int32'), config.outputShape);
      } else {
        labelTensor = tf.tensor1d(labels);
      }
    } else {
      // 회귀
      if (config.outputShape > 1) {
        labelTensor = tf.tensor2d(labels);
      } else {
        labelTensor = tf.tensor1d(labels);
      }
    }

    return { features: featureTensor, labels: labelTensor };
  }

  async evaluateModel(modelName, features, labels) {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }

    const evaluation = model.evaluate(features, labels);
    
    if (Array.isArray(evaluation)) {
      // 다중 출력 모델의 경우
      const results = {};
      evaluation.forEach((result, index) => {
        results[`output_${index}`] = result.dataSync()[0];
      });
      return results;
    } else {
      // 단일 출력 모델의 경우
      return { loss: evaluation.dataSync()[0] };
    }
  }

  async predict(modelName, inputData, options = {}) {
    const model = this.models.get(modelName);
    const config = this.modelConfigs.get(modelName);
    
    if (!model || !config) {
      throw new Error(`Model ${modelName} not found`);
    }

    try {
      // 캐시 확인
      const cacheKey = `${modelName}_${JSON.stringify(inputData)}`;
      if (options.useCache && this.predictionCache.has(cacheKey)) {
        const cached = this.predictionCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5분 캐시
          return cached.prediction;
        }
      }

      // 입력 데이터 전처리
      const preprocessedInput = this.preprocessInput(inputData, config);
      
      // 예측 실행
      const prediction = model.predict(preprocessedInput);
      
      // 결과 후처리
      const processedResult = await this.postprocessPrediction(prediction, config);
      
      // 캐시에 저장
      if (options.useCache) {
        this.predictionCache.set(cacheKey, {
          prediction: processedResult,
          timestamp: Date.now()
        });
      }

      // 텐서 메모리 정리
      preprocessedInput.dispose();
      if (Array.isArray(prediction)) {
        prediction.forEach(p => p.dispose());
      } else {
        prediction.dispose();
      }

      return processedResult;

    } catch (error) {
      console.error(`❌ Prediction failed for ${modelName}:`, error);
      throw error;
    }
  }

  preprocessInput(inputData, config) {
    // 입력 데이터를 모델에 맞는 형태로 변환
    let tensor;
    
    if (config.architecture === 'lstm' || config.architecture === 'cnn_lstm') {
      // 시계열 데이터: [timesteps, features] -> [1, timesteps, features]
      if (Array.isArray(inputData) && Array.isArray(inputData[0])) {
        tensor = tf.tensor3d([inputData]);
      } else {
        // 1D 배열을 적절한 형태로 변환
        const timesteps = config.inputShape[0];
        const features = config.inputShape[1];
        const reshaped = this.reshapeInput(inputData, timesteps, features);
        tensor = tf.tensor3d([reshaped]);
      }
    } else {
      // 피드포워드 모델: [features] -> [1, features]
      if (Array.isArray(inputData)) {
        tensor = tf.tensor2d([inputData]);
      } else {
        tensor = tf.tensor2d([[inputData]]);
      }
    }

    return tensor;
  }

  reshapeInput(inputData, timesteps, features) {
    const reshaped = [];
    for (let i = 0; i < timesteps; i++) {
      const timeStep = [];
      for (let j = 0; j < features; j++) {
        const index = i * features + j;
        timeStep.push(inputData[index] || 0);
      }
      reshaped.push(timeStep);
    }
    return reshaped;
  }

  async postprocessPrediction(prediction, config) {
    if (Array.isArray(prediction)) {
      // 다중 출력 모델
      const results = {};
      for (let i = 0; i < prediction.length; i++) {
        const data = await prediction[i].data();
        results[`output_${i}`] = Array.from(data);
      }
      return results;
    } else {
      // 단일 출력 모델
      const data = await prediction.data();
      const result = Array.from(data);
      
      if (config.type === 'classification') {
        // 분류 결과 후처리
        if (config.outputShape === 2) {
          // 이진 분류
          return {
            prediction: result[1] > 0.5 ? 1 : 0,
            confidence: result[1],
            probabilities: result
          };
        } else {
          // 다중 분류
          const maxIndex = result.indexOf(Math.max(...result));
          return {
            prediction: maxIndex,
            confidence: result[maxIndex],
            probabilities: result
          };
        }
      } else {
        // 회귀 결과
        if (result.length === 1) {
          return { prediction: result[0] };
        } else {
          return { predictions: result };
        }
      }
    }
  }

  async batchPredict(modelName, inputDataArray, options = {}) {
    const model = this.models.get(modelName);
    const config = this.modelConfigs.get(modelName);
    
    if (!model || !config) {
      throw new Error(`Model ${modelName} not found`);
    }

    try {
      // 배치 입력 데이터 전처리
      const batchTensor = this.preprocessBatchInput(inputDataArray, config);
      
      // 배치 예측 실행
      const batchPrediction = model.predict(batchTensor);
      
      // 배치 결과 후처리
      const batchResults = await this.postprocessBatchPrediction(batchPrediction, config);
      
      // 메모리 정리
      batchTensor.dispose();
      if (Array.isArray(batchPrediction)) {
        batchPrediction.forEach(p => p.dispose());
      } else {
        batchPrediction.dispose();
      }

      return batchResults;

    } catch (error) {
      console.error(`❌ Batch prediction failed for ${modelName}:`, error);
      throw error;
    }
  }

  preprocessBatchInput(inputDataArray, config) {
    if (config.architecture === 'lstm' || config.architecture === 'cnn_lstm') {
      // 3D 텐서: [batch, timesteps, features]
      const batchData = inputDataArray.map(data => {
        if (Array.isArray(data) && Array.isArray(data[0])) {
          return data;
        } else {
          const timesteps = config.inputShape[0];
          const features = config.inputShape[1];
          return this.reshapeInput(data, timesteps, features);
        }
      });
      return tf.tensor3d(batchData);
    } else {
      // 2D 텐서: [batch, features]
      return tf.tensor2d(inputDataArray);
    }
  }

  async postprocessBatchPrediction(batchPrediction, config) {
    if (Array.isArray(batchPrediction)) {
      // 다중 출력 모델
      const results = [];
      const outputCount = batchPrediction.length;
      const batchSize = batchPrediction[0].shape[0];
      
      for (let i = 0; i < batchSize; i++) {
        const sampleResult = {};
        for (let j = 0; j < outputCount; j++) {
          const outputData = await batchPrediction[j].data();
          const outputShape = batchPrediction[j].shape.slice(1);
          const startIndex = i * outputShape.reduce((a, b) => a * b, 1);
          const endIndex = startIndex + outputShape.reduce((a, b) => a * b, 1);
          sampleResult[`output_${j}`] = Array.from(outputData.slice(startIndex, endIndex));
        }
        results.push(sampleResult);
      }
      
      return results;
    } else {
      // 단일 출력 모델
      const data = await batchPrediction.data();
      const shape = batchPrediction.shape;
      const batchSize = shape[0];
      const outputSize = shape.slice(1).reduce((a, b) => a * b, 1);
      
      const results = [];
      for (let i = 0; i < batchSize; i++) {
        const startIndex = i * outputSize;
        const endIndex = startIndex + outputSize;
        const sampleData = Array.from(data.slice(startIndex, endIndex));
        
        if (config.type === 'classification') {
          if (outputSize === 2) {
            results.push({
              prediction: sampleData[1] > 0.5 ? 1 : 0,
              confidence: sampleData[1],
              probabilities: sampleData
            });
          } else {
            const maxIndex = sampleData.indexOf(Math.max(...sampleData));
            results.push({
              prediction: maxIndex,
              confidence: sampleData[maxIndex],
              probabilities: sampleData
            });
          }
        } else {
          if (outputSize === 1) {
            results.push({ prediction: sampleData[0] });
          } else {
            results.push({ predictions: sampleData });
          }
        }
      }
      
      return results;
    }
  }

  async loadModel(modelName) {
    try {
      const modelPath = path.join(__dirname, '../models', `${modelName}`);
      if (fs.existsSync(path.join(modelPath, 'model.json'))) {
        const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
        console.log(`📁 Loaded model from disk: ${modelName}`);
        return model;
      }
      return null;
    } catch (error) {
      console.warn(`⚠️ Could not load model ${modelName}:`, error.message);
      return null;
    }
  }

  async saveModel(modelName, model) {
    try {
      const modelDir = path.join(__dirname, '../models', modelName);
      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }
      
      await model.save(`file://${modelDir}`);
      console.log(`💾 Saved model to disk: ${modelName}`);
    } catch (error) {
      console.error(`❌ Failed to save model ${modelName}:`, error);
    }
  }

  getModelInfo(modelName) {
    const model = this.models.get(modelName);
    const config = this.modelConfigs.get(modelName);
    const history = this.trainingHistory.get(modelName);
    
    if (!model || !config) {
      throw new Error(`Model ${modelName} not found`);
    }

    return {
      name: modelName,
      type: config.type,
      architecture: config.architecture,
      inputShape: config.inputShape,
      outputShape: config.outputShape,
      trainable: model.trainable,
      totalParams: model.countParams(),
      lastTraining: history?.timestamp,
      layers: model.layers.map(layer => ({
        name: layer.name,
        type: layer.getClassName(),
        outputShape: layer.outputShape,
        trainableParams: layer.countParams()
      }))
    };
  }

  getTrainingHistory(modelName) {
    return this.trainingHistory.get(modelName);
  }

  clearPredictionCache() {
    this.predictionCache.clear();
    console.log('🧹 Prediction cache cleared');
  }

  getMemoryUsage() {
    return {
      totalModels: this.models.size,
      cacheSize: this.predictionCache.size,
      tensorflowMemory: tf.memory()
    };
  }

  dispose() {
    // 모든 모델과 텐서 정리
    this.models.forEach(model => model.dispose());
    this.models.clear();
    this.predictionCache.clear();
    console.log('🗑️ ML Engine disposed');
  }
}

module.exports = MLEngine;