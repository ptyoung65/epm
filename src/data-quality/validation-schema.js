/**
 * Data Validation Schema System
 * AIRIS EPM - Enterprise Performance Management
 * 데이터 품질 및 검증 시스템
 */

import Joi from 'joi';

// 기본 검증 스키마 정의
export const ValidationSchemas = {
  // 메트릭 데이터 스키마
  metric: Joi.object({
    timestamp: Joi.date().iso().required(),
    metricType: Joi.string().valid('counter', 'gauge', 'histogram', 'summary').required(),
    name: Joi.string().min(1).max(256).required(),
    value: Joi.number().required(),
    unit: Joi.string().optional(),
    labels: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    source: Joi.string().required(),
    quality: Joi.object({
      confidence: Joi.number().min(0).max(1).default(1),
      validated: Joi.boolean().default(false),
      issues: Joi.array().items(Joi.string()).default([])
    }).optional()
  }),

  // 로그 데이터 스키마
  log: Joi.object({
    timestamp: Joi.date().iso().required(),
    level: Joi.string().valid('debug', 'info', 'warn', 'error', 'fatal').required(),
    message: Joi.string().required(),
    service: Joi.string().required(),
    traceId: Joi.string().optional(),
    spanId: Joi.string().optional(),
    context: Joi.object().optional(),
    metadata: Joi.object().optional()
  }),

  // 트레이스 데이터 스키마
  trace: Joi.object({
    traceId: Joi.string().required(),
    spanId: Joi.string().required(),
    parentSpanId: Joi.string().allow(null).optional(),
    operationName: Joi.string().required(),
    serviceName: Joi.string().required(),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().required(),
    duration: Joi.number().positive().required(),
    status: Joi.object({
      code: Joi.number().valid(0, 1, 2).required(), // 0: UNSET, 1: OK, 2: ERROR
      message: Joi.string().optional()
    }).required(),
    attributes: Joi.object().optional(),
    events: Joi.array().items(Joi.object()).optional()
  }),

  // 비즈니스 메트릭 스키마
  businessMetric: Joi.object({
    timestamp: Joi.date().iso().required(),
    kpiName: Joi.string().required(),
    value: Joi.number().required(),
    target: Joi.number().optional(),
    variance: Joi.number().optional(),
    department: Joi.string().required(),
    category: Joi.string().valid('revenue', 'cost', 'efficiency', 'quality', 'customer').required(),
    period: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly').required(),
    metadata: Joi.object().optional()
  }),

  // 성능 데이터 스키마
  performance: Joi.object({
    timestamp: Joi.date().iso().required(),
    service: Joi.string().required(),
    endpoint: Joi.string().required(),
    method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').required(),
    responseTime: Joi.number().positive().required(),
    statusCode: Joi.number().integer().min(100).max(599).required(),
    errorCount: Joi.number().integer().min(0).default(0),
    requestCount: Joi.number().integer().positive().required(),
    p50: Joi.number().positive().optional(),
    p95: Joi.number().positive().optional(),
    p99: Joi.number().positive().optional()
  })
};

// 데이터 검증 클래스
export class DataValidator {
  constructor(options = {}) {
    this.options = {
      abortEarly: false, // 모든 오류 수집
      allowUnknown: false, // 알려지지 않은 필드 거부
      stripUnknown: true, // 알려지지 않은 필드 제거
      ...options
    };
    
    this.validationStats = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  // 단일 데이터 검증
  validate(data, schemaType) {
    const schema = ValidationSchemas[schemaType];
    if (!schema) {
      throw new Error(`Unknown schema type: ${schemaType}`);
    }

    const result = schema.validate(data, this.options);
    this.updateStats(result);
    
    return {
      isValid: !result.error,
      value: result.value,
      errors: result.error ? this.formatErrors(result.error) : null,
      schemaType
    };
  }

  // 배치 데이터 검증
  validateBatch(dataArray, schemaType) {
    const results = dataArray.map(data => this.validate(data, schemaType));
    
    return {
      total: results.length,
      valid: results.filter(r => r.isValid).length,
      invalid: results.filter(r => !r.isValid).length,
      results,
      successRate: (results.filter(r => r.isValid).length / results.length) * 100
    };
  }

  // 커스텀 검증 규칙 추가
  addCustomRule(schemaType, field, rule) {
    if (!ValidationSchemas[schemaType]) {
      throw new Error(`Unknown schema type: ${schemaType}`);
    }
    
    // 기존 스키마 확장
    const currentSchema = ValidationSchemas[schemaType];
    ValidationSchemas[schemaType] = currentSchema.append({
      [field]: rule
    });
  }

  // 검증 통계 업데이트
  updateStats(result) {
    this.validationStats.total++;
    
    if (result.error) {
      this.validationStats.failed++;
      this.validationStats.errors.push({
        timestamp: new Date().toISOString(),
        errors: this.formatErrors(result.error)
      });
    } else {
      this.validationStats.passed++;
    }
  }

  // 오류 포맷팅
  formatErrors(error) {
    return error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type
    }));
  }

  // 통계 조회
  getStats() {
    return {
      ...this.validationStats,
      successRate: this.validationStats.total > 0 
        ? (this.validationStats.passed / this.validationStats.total) * 100 
        : 0
    };
  }

  // 통계 초기화
  resetStats() {
    this.validationStats = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }
}

// 데이터 품질 점수 계산기
export class DataQualityScorer {
  constructor() {
    this.weights = {
      completeness: 0.3,    // 완전성
      accuracy: 0.3,        // 정확성
      consistency: 0.2,     // 일관성
      timeliness: 0.1,      // 적시성
      validity: 0.1         // 유효성
    };
  }

  // 품질 점수 계산
  calculateScore(data, schemaType) {
    const scores = {
      completeness: this.assessCompleteness(data, schemaType),
      accuracy: this.assessAccuracy(data, schemaType),
      consistency: this.assessConsistency(data, schemaType),
      timeliness: this.assessTimeliness(data),
      validity: this.assessValidity(data, schemaType)
    };

    const overallScore = Object.keys(scores).reduce((total, key) => {
      return total + (scores[key] * this.weights[key]);
    }, 0);

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      dimensions: scores,
      grade: this.getGrade(overallScore)
    };
  }

  // 완전성 평가
  assessCompleteness(data, schemaType) {
    const schema = ValidationSchemas[schemaType];
    if (!schema) return 0;

    const requiredFields = this.getRequiredFields(schema);
    const providedFields = Object.keys(data).filter(key => data[key] !== null && data[key] !== undefined);
    
    return providedFields.length / Math.max(requiredFields.length, 1);
  }

  // 정확성 평가
  assessAccuracy(data, schemaType) {
    const validator = new DataValidator();
    const result = validator.validate(data, schemaType);
    
    return result.isValid ? 1 : 0.5;
  }

  // 일관성 평가
  assessConsistency(data, schemaType) {
    // 데이터 타입 일관성 체크
    let score = 1;
    
    if (schemaType === 'metric' && data.value) {
      // 메트릭 값의 범위 체크
      if (data.value < 0 && !data.name?.includes('delta')) {
        score -= 0.3;
      }
    }
    
    if (schemaType === 'performance' && data.responseTime && data.p50) {
      // 응답 시간 일관성 체크
      if (data.responseTime < data.p50) {
        score -= 0.2;
      }
    }
    
    return Math.max(score, 0);
  }

  // 적시성 평가
  assessTimeliness(data) {
    if (!data.timestamp) return 0;
    
    const dataTime = new Date(data.timestamp);
    const now = new Date();
    const ageInMinutes = (now - dataTime) / (1000 * 60);
    
    // 5분 이내: 1.0, 1시간 이내: 0.8, 1일 이내: 0.5, 그 이상: 0.2
    if (ageInMinutes <= 5) return 1;
    if (ageInMinutes <= 60) return 0.8;
    if (ageInMinutes <= 1440) return 0.5;
    return 0.2;
  }

  // 유효성 평가
  assessValidity(data, schemaType) {
    const validator = new DataValidator();
    const result = validator.validate(data, schemaType);
    
    if (!result.isValid) {
      return Math.max(1 - (result.errors.length * 0.2), 0);
    }
    return 1;
  }

  // 필수 필드 추출
  getRequiredFields(schema) {
    const fields = [];
    const schemaDesc = schema.describe();
    
    const extractRequired = (desc, prefix = '') => {
      if (desc.keys) {
        Object.keys(desc.keys).forEach(key => {
          const field = desc.keys[key];
          const fullKey = prefix ? `${prefix}.${key}` : key;
          
          if (field.flags?.presence === 'required') {
            fields.push(fullKey);
          }
          
          if (field.keys) {
            extractRequired(field, fullKey);
          }
        });
      }
    };
    
    extractRequired(schemaDesc);
    return fields;
  }

  // 등급 산출
  getGrade(score) {
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  }
}

export default {
  ValidationSchemas,
  DataValidator,
  DataQualityScorer
};