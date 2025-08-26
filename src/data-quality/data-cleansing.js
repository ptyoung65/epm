/**
 * Data Cleansing Pipeline
 * AIRIS EPM - Enterprise Performance Management  
 * 데이터 정제 및 변환 파이프라인
 */

// 데이터 클렌징 파이프라인 클래스
export class DataCleansingPipeline {
  constructor(options = {}) {
    this.options = {
      removeNulls: options.removeNulls !== false,
      removeDuplicates: options.removeDuplicates !== false,
      normalizeValues: options.normalizeValues !== false,
      fillMissingValues: options.fillMissingValues !== false,
      transformTimestamps: options.transformTimestamps !== false,
      validateTypes: options.validateTypes !== false,
      ...options
    };
    
    this.cleansingSteps = [];
    this.cleansingStats = {
      processed: 0,
      cleaned: 0,
      removed: 0,
      transformed: 0,
      errors: []
    };
    
    this.initializeSteps();
  }

  // 클렌징 단계 초기화
  initializeSteps() {
    if (this.options.removeNulls) {
      this.addStep('removeNullValues', this.removeNullValues.bind(this));
    }
    
    if (this.options.removeDuplicates) {
      this.addStep('removeDuplicates', this.removeDuplicates.bind(this));
    }
    
    if (this.options.normalizeValues) {
      this.addStep('normalizeValues', this.normalizeValues.bind(this));
    }
    
    if (this.options.fillMissingValues) {
      this.addStep('fillMissingValues', this.fillMissingValues.bind(this));
    }
    
    if (this.options.transformTimestamps) {
      this.addStep('transformTimestamps', this.transformTimestamps.bind(this));
    }
    
    if (this.options.validateTypes) {
      this.addStep('validateTypes', this.validateTypes.bind(this));
    }
  }

  // 클렌징 단계 추가
  addStep(name, fn) {
    this.cleansingSteps.push({ name, fn });
  }

  // 단일 데이터 클렌징
  cleanSingle(data) {
    let cleanedData = { ...data };
    const cleansingReport = {
      original: data,
      steps: []
    };
    
    for (const step of this.cleansingSteps) {
      try {
        const result = step.fn(cleanedData);
        cleanedData = result.data;
        cleansingReport.steps.push({
          name: step.name,
          success: true,
          changes: result.changes
        });
      } catch (error) {
        cleansingReport.steps.push({
          name: step.name,
          success: false,
          error: error.message
        });
        this.cleansingStats.errors.push({
          step: step.name,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    this.cleansingStats.processed++;
    if (JSON.stringify(data) !== JSON.stringify(cleanedData)) {
      this.cleansingStats.cleaned++;
    }
    
    cleansingReport.cleaned = cleanedData;
    return cleansingReport;
  }

  // 배치 데이터 클렌징
  cleanBatch(dataArray) {
    const results = dataArray.map(data => this.cleanSingle(data));
    
    return {
      total: results.length,
      cleaned: results.filter(r => r.cleaned).length,
      reports: results,
      stats: this.getStats()
    };
  }

  // Null 값 제거
  removeNullValues(data) {
    const cleanedData = {};
    const removedFields = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined && value !== '') {
        cleanedData[key] = value;
      } else {
        removedFields.push(key);
      }
    }
    
    return {
      data: cleanedData,
      changes: {
        removedFields,
        fieldsRemoved: removedFields.length
      }
    };
  }

  // 중복 제거 (배치 처리용)
  removeDuplicates(data) {
    // 데이터 해시 생성
    const hash = this.generateHash(data);
    
    if (!this.seenHashes) {
      this.seenHashes = new Set();
    }
    
    const isDuplicate = this.seenHashes.has(hash);
    this.seenHashes.add(hash);
    
    return {
      data: isDuplicate ? null : data,
      changes: {
        isDuplicate,
        hash
      }
    };
  }

  // 값 정규화
  normalizeValues(data) {
    const normalizedData = { ...data };
    const normalizedFields = [];
    
    for (const [key, value] of Object.entries(normalizedData)) {
      // 문자열 정규화
      if (typeof value === 'string') {
        normalizedData[key] = value.trim().toLowerCase();
        normalizedFields.push(key);
      }
      
      // 숫자 정규화 (소수점 자리수 제한)
      if (typeof value === 'number' && !Number.isInteger(value)) {
        normalizedData[key] = Math.round(value * 10000) / 10000;
        normalizedFields.push(key);
      }
      
      // 불리언 정규화
      if (value === 'true' || value === 'false') {
        normalizedData[key] = value === 'true';
        normalizedFields.push(key);
      }
    }
    
    return {
      data: normalizedData,
      changes: {
        normalizedFields,
        fieldsNormalized: normalizedFields.length
      }
    };
  }

  // 누락된 값 채우기
  fillMissingValues(data) {
    const filledData = { ...data };
    const filledFields = [];
    
    // 기본 필수 필드 체크
    const requiredFields = {
      timestamp: () => new Date().toISOString(),
      source: () => 'unknown',
      quality: () => 1.0
    };
    
    for (const [field, defaultValueFn] of Object.entries(requiredFields)) {
      if (!filledData[field]) {
        filledData[field] = defaultValueFn();
        filledFields.push(field);
      }
    }
    
    // 메트릭별 특수 처리
    if (filledData.metricType === 'counter' && !filledData.value) {
      filledData.value = 0;
      filledFields.push('value');
    }
    
    return {
      data: filledData,
      changes: {
        filledFields,
        fieldsFilled: filledFields.length
      }
    };
  }

  // 타임스탬프 변환
  transformTimestamps(data) {
    const transformedData = { ...data };
    const transformedFields = [];
    
    const timestampFields = ['timestamp', 'startTime', 'endTime', 'createdAt', 'updatedAt'];
    
    for (const field of timestampFields) {
      if (transformedData[field]) {
        try {
          // Unix timestamp to ISO
          if (typeof transformedData[field] === 'number') {
            transformedData[field] = new Date(transformedData[field]).toISOString();
            transformedFields.push(field);
          }
          // String to ISO
          else if (typeof transformedData[field] === 'string' && !transformedData[field].includes('T')) {
            transformedData[field] = new Date(transformedData[field]).toISOString();
            transformedFields.push(field);
          }
        } catch (error) {
          // Invalid timestamp, keep original
          console.warn(`Failed to transform timestamp field ${field}:`, error);
        }
      }
    }
    
    return {
      data: transformedData,
      changes: {
        transformedFields,
        fieldsTransformed: transformedFields.length
      }
    };
  }

  // 타입 검증 및 변환
  validateTypes(data) {
    const validatedData = { ...data };
    const typeChanges = [];
    
    const typeSchema = {
      value: 'number',
      count: 'number',
      duration: 'number',
      responseTime: 'number',
      errorCount: 'number',
      timestamp: 'string',
      metricName: 'string',
      serviceName: 'string',
      isActive: 'boolean',
      enabled: 'boolean'
    };
    
    for (const [field, expectedType] of Object.entries(typeSchema)) {
      if (validatedData[field] !== undefined) {
        const actualType = typeof validatedData[field];
        
        if (actualType !== expectedType) {
          // 타입 변환 시도
          try {
            if (expectedType === 'number') {
              validatedData[field] = Number(validatedData[field]);
            } else if (expectedType === 'string') {
              validatedData[field] = String(validatedData[field]);
            } else if (expectedType === 'boolean') {
              validatedData[field] = Boolean(validatedData[field]);
            }
            
            typeChanges.push({
              field,
              from: actualType,
              to: expectedType
            });
          } catch (error) {
            console.warn(`Failed to convert field ${field} from ${actualType} to ${expectedType}`);
          }
        }
      }
    }
    
    return {
      data: validatedData,
      changes: {
        typeChanges,
        fieldsConverted: typeChanges.length
      }
    };
  }

  // 데이터 해시 생성
  generateHash(data) {
    const sortedKeys = Object.keys(data).sort();
    const values = sortedKeys.map(key => `${key}:${data[key]}`).join('|');
    
    // 간단한 해시 함수 (실제로는 crypto 사용 권장)
    let hash = 0;
    for (let i = 0; i < values.length; i++) {
      const char = values.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(16);
  }

  // 통계 조회
  getStats() {
    return {
      ...this.cleansingStats,
      successRate: this.cleansingStats.processed > 0
        ? (this.cleansingStats.cleaned / this.cleansingStats.processed) * 100
        : 0
    };
  }

  // 통계 초기화
  resetStats() {
    this.cleansingStats = {
      processed: 0,
      cleaned: 0,
      removed: 0,
      transformed: 0,
      errors: []
    };
    this.seenHashes = new Set();
  }
}

// 데이터 변환 클래스
export class DataTransformer {
  constructor() {
    this.transformations = new Map();
    this.registerDefaultTransformations();
  }

  // 기본 변환 등록
  registerDefaultTransformations() {
    // 단위 변환
    this.register('bytesToGB', (value) => value / (1024 * 1024 * 1024));
    this.register('msToSeconds', (value) => value / 1000);
    this.register('percentToDecimal', (value) => value / 100);
    
    // 집계 변환
    this.register('sum', (values) => values.reduce((sum, v) => sum + v, 0));
    this.register('avg', (values) => values.reduce((sum, v) => sum + v, 0) / values.length);
    this.register('max', (values) => Math.max(...values));
    this.register('min', (values) => Math.min(...values));
    
    // 형식 변환
    this.register('roundTo2', (value) => Math.round(value * 100) / 100);
    this.register('toUpperCase', (value) => value.toUpperCase());
    this.register('toLowerCase', (value) => value.toLowerCase());
    
    // 날짜 변환
    this.register('toUnixTimestamp', (date) => new Date(date).getTime());
    this.register('toISO', (date) => new Date(date).toISOString());
  }

  // 변환 함수 등록
  register(name, fn) {
    this.transformations.set(name, fn);
  }

  // 변환 적용
  apply(transformName, data) {
    const transformFn = this.transformations.get(transformName);
    
    if (!transformFn) {
      throw new Error(`Unknown transformation: ${transformName}`);
    }
    
    try {
      return transformFn(data);
    } catch (error) {
      console.error(`Transformation ${transformName} failed:`, error);
      return data;
    }
  }

  // 체인 변환
  applyChain(transformNames, data) {
    let result = data;
    
    for (const name of transformNames) {
      result = this.apply(name, result);
    }
    
    return result;
  }

  // 조건부 변환
  applyConditional(condition, transformName, data) {
    if (condition(data)) {
      return this.apply(transformName, data);
    }
    return data;
  }
}

// 데이터 농축 클래스
export class DataEnricher {
  constructor() {
    this.enrichmentRules = new Map();
    this.externalDataSources = new Map();
  }

  // 농축 규칙 추가
  addRule(name, rule) {
    this.enrichmentRules.set(name, rule);
  }

  // 외부 데이터 소스 등록
  registerDataSource(name, fetchFn) {
    this.externalDataSources.set(name, fetchFn);
  }

  // 데이터 농축
  async enrich(data, rules = []) {
    const enrichedData = { ...data };
    const enrichmentReport = {
      original: data,
      enrichments: []
    };
    
    for (const ruleName of rules) {
      const rule = this.enrichmentRules.get(ruleName);
      
      if (rule) {
        try {
          const enrichment = await rule(enrichedData);
          Object.assign(enrichedData, enrichment);
          
          enrichmentReport.enrichments.push({
            rule: ruleName,
            fields: Object.keys(enrichment),
            success: true
          });
        } catch (error) {
          enrichmentReport.enrichments.push({
            rule: ruleName,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    enrichmentReport.enriched = enrichedData;
    return enrichmentReport;
  }

  // 지리 정보 농축
  async enrichWithGeoData(data) {
    if (data.ipAddress) {
      // 실제로는 GeoIP 서비스 호출
      return {
        country: 'KR',
        city: 'Seoul',
        latitude: 37.5665,
        longitude: 126.9780
      };
    }
    return {};
  }

  // 비즈니스 컨텍스트 농축
  async enrichWithBusinessContext(data) {
    if (data.customerId) {
      // 실제로는 고객 데이터베이스 조회
      return {
        customerSegment: 'premium',
        accountAge: 365,
        lifetimeValue: 50000
      };
    }
    return {};
  }

  // 시계열 컨텍스트 농축
  enrichWithTimeContext(data) {
    if (data.timestamp) {
      const date = new Date(data.timestamp);
      return {
        dayOfWeek: date.getDay(),
        hourOfDay: date.getHours(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isBusinessHours: date.getHours() >= 9 && date.getHours() < 18,
        quarter: Math.floor(date.getMonth() / 3) + 1
      };
    }
    return {};
  }
}

export default {
  DataCleansingPipeline,
  DataTransformer,
  DataEnricher
};