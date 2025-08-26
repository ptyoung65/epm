/**
 * Data Quality System Tests
 * AIRIS EPM - Enterprise Performance Management
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DataValidator, DataQualityScorer } from '../src/data-quality/validation-schema.js';
import { StatisticalAnomalyDetector, HybridAnomalyDetector } from '../src/data-quality/anomaly-detector.js';
import { DataCleansingPipeline, DataTransformer } from '../src/data-quality/data-cleansing.js';
import { QualityMetricsCollector } from '../src/data-quality/quality-metrics.js';

describe('Data Validation Schema', () => {
  let validator;
  
  beforeEach(() => {
    validator = new DataValidator();
  });
  
  test('should validate metric data correctly', () => {
    const validMetric = {
      timestamp: new Date().toISOString(),
      metricType: 'counter',
      name: 'request_count',
      value: 100,
      source: 'api-server'
    };
    
    const result = validator.validate(validMetric, 'metric');
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });
  
  test('should reject invalid metric data', () => {
    const invalidMetric = {
      timestamp: 'not-a-date',
      metricType: 'invalid',
      name: '',
      value: 'not-a-number'
    };
    
    const result = validator.validate(invalidMetric, 'metric');
    expect(result.isValid).toBe(false);
    expect(result.errors).not.toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });
  
  test('should validate batch data', () => {
    const batch = [
      { timestamp: new Date().toISOString(), metricType: 'gauge', name: 'cpu', value: 75, source: 'host1' },
      { timestamp: new Date().toISOString(), metricType: 'gauge', name: 'memory', value: 60, source: 'host1' },
      { timestamp: 'invalid', metricType: 'gauge', name: 'disk', value: 80, source: 'host1' }
    ];
    
    const result = validator.validateBatch(batch, 'metric');
    expect(result.total).toBe(3);
    expect(result.valid).toBe(2);
    expect(result.invalid).toBe(1);
    expect(result.successRate).toBeLessThan(100);
  });
});

describe('Data Quality Scorer', () => {
  let scorer;
  
  beforeEach(() => {
    scorer = new DataQualityScorer();
  });
  
  test('should calculate quality score', () => {
    const data = {
      timestamp: new Date().toISOString(),
      metricType: 'counter',
      name: 'request_count',
      value: 100,
      source: 'api-server',
      unit: 'requests',
      labels: { env: 'production' }
    };
    
    const score = scorer.calculateScore(data, 'metric');
    expect(score.overallScore).toBeGreaterThan(0);
    expect(score.overallScore).toBeLessThanOrEqual(1);
    expect(score.grade).toMatch(/[A-F]/);
    expect(score.dimensions).toHaveProperty('completeness');
    expect(score.dimensions).toHaveProperty('accuracy');
  });
  
  test('should assign correct grades', () => {
    expect(scorer.getGrade(0.95)).toBe('A');
    expect(scorer.getGrade(0.85)).toBe('B');
    expect(scorer.getGrade(0.75)).toBe('C');
    expect(scorer.getGrade(0.65)).toBe('D');
    expect(scorer.getGrade(0.55)).toBe('F');
  });
});

describe('Anomaly Detection', () => {
  let detector;
  
  beforeEach(() => {
    detector = new StatisticalAnomalyDetector({
      windowSize: 20,
      minSamples: 5
    });
  });
  
  test('should detect z-score anomalies', () => {
    const metricName = 'cpu_usage';
    
    // Add normal data
    for (let i = 0; i < 10; i++) {
      detector.detect({
        metricName,
        value: 50 + Math.random() * 10,
        timestamp: Date.now()
      });
    }
    
    // Add anomaly
    const anomalyResult = detector.detect({
      metricName,
      value: 200, // Extreme value
      timestamp: Date.now()
    });
    
    expect(anomalyResult.isAnomaly).toBe(true);
    expect(anomalyResult.details).toBeDefined();
  });
  
  test('should calculate statistics correctly', () => {
    const metricName = 'memory_usage';
    const values = [10, 20, 30, 40, 50];
    
    values.forEach(value => {
      detector.detect({
        metricName,
        value,
        timestamp: Date.now()
      });
    });
    
    const stats = detector.getStatistics(metricName);
    expect(stats.mean).toBe(30);
    expect(stats.median).toBe(30);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
  });
});

describe('Data Cleansing Pipeline', () => {
  let pipeline;
  
  beforeEach(() => {
    pipeline = new DataCleansingPipeline();
  });
  
  test('should remove null values', () => {
    const data = {
      name: 'test',
      value: 100,
      nullField: null,
      emptyField: '',
      validField: 'valid'
    };
    
    const result = pipeline.cleanSingle(data);
    expect(result.cleaned).not.toHaveProperty('nullField');
    expect(result.cleaned).not.toHaveProperty('emptyField');
    expect(result.cleaned).toHaveProperty('validField');
  });
  
  test('should normalize values', () => {
    const data = {
      name: '  TEST  ',
      value: 3.14159265359,
      boolString: 'true'
    };
    
    const result = pipeline.cleanSingle(data);
    expect(result.cleaned.name).toBe('test');
    expect(result.cleaned.value).toBe(3.1416);
    expect(result.cleaned.boolString).toBe(true);
  });
  
  test('should fill missing values', () => {
    const data = {
      metricType: 'counter',
      name: 'test'
    };
    
    const result = pipeline.cleanSingle(data);
    expect(result.cleaned).toHaveProperty('timestamp');
    expect(result.cleaned).toHaveProperty('source');
    expect(result.cleaned.value).toBe(0); // Counter default
  });
});

describe('Data Transformer', () => {
  let transformer;
  
  beforeEach(() => {
    transformer = new DataTransformer();
  });
  
  test('should apply transformations', () => {
    expect(transformer.apply('bytesToGB', 1073741824)).toBe(1);
    expect(transformer.apply('msToSeconds', 1000)).toBe(1);
    expect(transformer.apply('roundTo2', 3.14159)).toBe(3.14);
  });
  
  test('should chain transformations', () => {
    const result = transformer.applyChain(['msToSeconds', 'roundTo2'], 1234.5678);
    expect(result).toBe(1.23);
  });
});

describe('Quality Metrics Collection', () => {
  let collector;
  
  beforeEach(() => {
    collector = new QualityMetricsCollector({
      collectionInterval: 1000,
      aggregationLevels: ['1m']
    });
  });
  
  test('should record metrics', () => {
    collector.record('quality', 'test.score', 0.95);
    collector.record('validation', 'test.result', 1);
    
    const metrics = collector.getCurrentMetrics();
    expect(metrics['quality.test.score']).toBe(0.95);
    expect(metrics['validation.test.result']).toBe(1);
  });
  
  test('should calculate statistics', () => {
    const values = [
      { value: 10, timestamp: Date.now() },
      { value: 20, timestamp: Date.now() },
      { value: 30, timestamp: Date.now() }
    ];
    
    const stats = collector.calculateStatistics(values);
    expect(stats.count).toBe(3);
    expect(stats.sum).toBe(60);
    expect(stats.avg).toBe(20);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(30);
    expect(stats.median).toBe(20);
  });
  
  test('should generate report', () => {
    collector.record('quality', 'test.score', 0.95);
    collector.recordValidation('test', true);
    collector.recordAnomaly('test.metric', false, 0.1);
    
    const report = collector.generateReport();
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('currentMetrics');
    expect(report).toHaveProperty('overallQualityScore');
    expect(report).toHaveProperty('recommendations');
  });
});

describe('Hybrid Anomaly Detector', () => {
  let detector;
  
  beforeEach(() => {
    detector = new HybridAnomalyDetector();
  });
  
  test('should detect anomalies using multiple methods', async () => {
    // Add normal data
    for (let i = 0; i < 20; i++) {
      await detector.detect({
        metricName: 'test_metric',
        value: 50 + Math.random() * 10,
        timestamp: Date.now()
      });
    }
    
    // Test anomaly detection
    const result = await detector.detect({
      metricName: 'test_metric',
      value: 500, // Extreme value
      timestamp: Date.now()
    });
    
    expect(result.isAnomaly).toBe(true);
    expect(result.level).toBeDefined();
    expect(result.detectionResults).toBeInstanceOf(Array);
  });
  
  test('should get anomaly statistics', async () => {
    // Create some anomalies
    await detector.detect({ metricName: 'test', value: 1000, timestamp: Date.now() });
    await detector.detect({ metricName: 'test', value: -100, timestamp: Date.now() });
    
    const stats = detector.getAnomalyStatistics();
    expect(stats.total).toBeGreaterThanOrEqual(0);
    expect(stats.byLevel).toBeDefined();
  });
});

// Integration Test
describe('Data Quality System Integration', () => {
  test('should process data through complete pipeline', async () => {
    const validator = new DataValidator();
    const scorer = new DataQualityScorer();
    const cleaner = new DataCleansingPipeline();
    const detector = new HybridAnomalyDetector();
    const collector = new QualityMetricsCollector();
    
    // Raw data
    const rawData = {
      timestamp: '2025-08-26T10:00:00',
      metricType: 'counter',
      name: '  REQUEST_COUNT  ',
      value: '100',
      nullField: null,
      source: ''
    };
    
    // Clean data
    const cleanResult = cleaner.cleanSingle(rawData);
    expect(cleanResult.cleaned).toBeDefined();
    
    // Validate cleaned data
    const validationResult = validator.validate(cleanResult.cleaned, 'metric');
    expect(validationResult.isValid).toBe(true);
    
    // Calculate quality score
    const qualityScore = scorer.calculateScore(cleanResult.cleaned, 'metric');
    expect(qualityScore.overallScore).toBeGreaterThan(0);
    
    // Check for anomalies
    const anomalyResult = await detector.detect({
      metricName: cleanResult.cleaned.name,
      value: cleanResult.cleaned.value,
      timestamp: Date.now()
    });
    expect(anomalyResult).toBeDefined();
    
    // Record metrics
    collector.recordQualityScore('metric', qualityScore.overallScore, qualityScore.dimensions);
    collector.recordValidation('metric', validationResult.isValid);
    collector.recordAnomaly(cleanResult.cleaned.name, anomalyResult.isAnomaly, anomalyResult.confidence);
    
    // Generate report
    const report = collector.generateReport();
    expect(report.summary.totalMetrics).toBeGreaterThan(0);
  });
});