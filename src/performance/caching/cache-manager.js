/**
 * Cache Management Engine
 * AIRIS EPM - Enterprise Performance Management
 * 지능형 캐시 전략 및 관리 시스템
 */

import { MultiLayerCache } from './redis-cache.js';

// 캐시 전략 인터페이스
export class CacheStrategy {
  constructor(name) {
    this.name = name;
  }

  // 캐시 키 생성
  generateKey(context) {
    throw new Error('generateKey method must be implemented');
  }

  // TTL 결정
  getTTL(context, data) {
    throw new Error('getTTL method must be implemented');
  }

  // 캐시 여부 결정
  shouldCache(context, data) {
    return true;
  }

  // 무효화 패턴
  getInvalidationPattern(context) {
    return null;
  }
}

// LRU 기반 전략
export class LRUStrategy extends CacheStrategy {
  constructor(options = {}) {
    super('lru');
    this.baseTTL = options.baseTTL || 3600;
    this.maxTTL = options.maxTTL || 86400;
    this.minTTL = options.minTTL || 300;
  }

  generateKey(context) {
    const { type, id, params = {} } = context;
    const paramStr = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    return `${type}:${id}${paramStr ? ':' + paramStr : ''}`;
  }

  getTTL(context, data) {
    const { accessCount = 0, dataSize = 0 } = context;
    
    // 접근 빈도에 따른 TTL 조정
    let ttl = this.baseTTL;
    
    if (accessCount > 100) {
      ttl = Math.min(ttl * 2, this.maxTTL);
    } else if (accessCount < 10) {
      ttl = Math.max(ttl / 2, this.minTTL);
    }
    
    // 데이터 크기에 따른 TTL 조정
    if (dataSize > 1024 * 1024) { // 1MB 이상
      ttl = Math.max(ttl / 2, this.minTTL);
    }
    
    return ttl;
  }

  shouldCache(context, data) {
    const { dataSize = 0, computationCost = 1 } = context;
    
    // 너무 큰 데이터는 캐시하지 않음
    if (dataSize > 10 * 1024 * 1024) { // 10MB
      return false;
    }
    
    // 계산 비용이 높은 데이터는 반드시 캐시
    if (computationCost > 5) {
      return true;
    }
    
    return true;
  }

  getInvalidationPattern(context) {
    const { type, id } = context;
    return `${type}:${id}*`;
  }
}

// 시간 기반 전략
export class TimeBasedStrategy extends CacheStrategy {
  constructor(options = {}) {
    super('time-based');
    this.hourlyTTLs = options.hourlyTTLs || {};
    this.defaultTTL = options.defaultTTL || 3600;
  }

  generateKey(context) {
    const { type, id, timestamp } = context;
    const hour = new Date(timestamp || Date.now()).getHours();
    return `${type}:${id}:h${hour}`;
  }

  getTTL(context, data) {
    const hour = new Date().getHours();
    return this.hourlyTTLs[hour] || this.defaultTTL;
  }

  shouldCache(context, data) {
    const hour = new Date().getHours();
    // 피크 시간대에는 더 적극적으로 캐시
    if (hour >= 9 && hour <= 18) {
      return true;
    }
    
    const { importance = 1 } = context;
    return importance > 0.5;
  }
}

// 비즈니스 우선순위 기반 전략
export class BusinessPriorityStrategy extends CacheStrategy {
  constructor(options = {}) {
    super('business-priority');
    this.priorityTTLs = {
      critical: 86400,  // 24시간
      high: 21600,      // 6시간
      medium: 7200,     // 2시간
      low: 1800         // 30분
    };
    Object.assign(this.priorityTTLs, options.priorityTTLs || {});
  }

  generateKey(context) {
    const { type, id, businessUnit, priority } = context;
    return `${businessUnit || 'default'}:${priority || 'medium'}:${type}:${id}`;
  }

  getTTL(context, data) {
    const { priority = 'medium' } = context;
    return this.priorityTTLs[priority] || this.priorityTTLs.medium;
  }

  shouldCache(context, data) {
    const { priority = 'medium', userTier = 'standard' } = context;
    
    // Premium 사용자의 데이터는 항상 캐시
    if (userTier === 'premium') {
      return true;
    }
    
    // Critical, High 우선순위는 반드시 캐시
    return ['critical', 'high'].includes(priority);
  }

  getInvalidationPattern(context) {
    const { businessUnit, type } = context;
    return `${businessUnit || 'default'}:*:${type}:*`;
  }
}

// 캐시 관리자
export class CacheManager {
  constructor(options = {}) {
    this.cache = new MultiLayerCache(options.cache || {});
    this.strategies = new Map();
    this.defaultStrategy = 'lru';
    
    this.options = {
      enableMetrics: options.enableMetrics !== false,
      warmupPatterns: options.warmupPatterns || [],
      autoInvalidation: options.autoInvalidation !== false,
      maxConcurrentWarmup: options.maxConcurrentWarmup || 10,
      ...options
    };
    
    this.metrics = {
      requests: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      warmups: 0,
      invalidations: 0,
      strategyUsage: {}
    };
    
    this.warmupQueue = [];
    this.invalidationRules = new Map();
    
    this.registerDefaultStrategies();
  }

  // 기본 전략 등록
  registerDefaultStrategies() {
    this.registerStrategy('lru', new LRUStrategy());
    this.registerStrategy('time-based', new TimeBasedStrategy());
    this.registerStrategy('business-priority', new BusinessPriorityStrategy());
  }

  // 초기화
  async init() {
    await this.cache.init();
    
    if (this.options.warmupPatterns.length > 0) {
      await this.warmupCache();
    }
    
    this.setupInvalidationRules();
    console.log('CacheManager initialized successfully');
  }

  // 전략 등록
  registerStrategy(name, strategy) {
    this.strategies.set(name, strategy);
  }

  // 전략 선택
  selectStrategy(context) {
    const { strategy = this.defaultStrategy } = context;
    return this.strategies.get(strategy) || this.strategies.get(this.defaultStrategy);
  }

  // 데이터 가져오기
  async get(context, fallback = null) {
    this.metrics.requests++;
    
    try {
      const strategy = this.selectStrategy(context);
      const key = strategy.generateKey(context);
      
      // 캐시에서 시도
      const cached = await this.cache.get(key, {
        fallback: fallback ? async () => {
          const data = await fallback();
          return data;
        } : null
      });
      
      if (cached !== null) {
        this.metrics.hits++;
        this.updateStrategyMetrics(strategy.name, 'hit');
        return cached;
      }
      
      this.metrics.misses++;
      this.updateStrategyMetrics(strategy.name, 'miss');
      
      return null;
    } catch (error) {
      this.metrics.errors++;
      console.error('Cache get error:', error);
      
      // 폴백 함수 직접 호출
      if (fallback) {
        try {
          return await fallback();
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
        }
      }
      
      return null;
    }
  }

  // 데이터 저장
  async set(context, data) {
    try {
      const strategy = this.selectStrategy(context);
      
      if (!strategy.shouldCache(context, data)) {
        return false;
      }
      
      const key = strategy.generateKey(context);
      const ttl = strategy.getTTL(context, data);
      
      const success = await this.cache.set(key, data, {
        l1TTL: Math.min(ttl, 3600),  // L1은 최대 1시간
        l2TTL: ttl
      });
      
      if (success) {
        this.updateStrategyMetrics(strategy.name, 'set');
      }
      
      return success;
    } catch (error) {
      this.metrics.errors++;
      console.error('Cache set error:', error);
      return false;
    }
  }

  // 여러 데이터 가져오기
  async mget(contexts, fallback = null) {
    const results = {};
    const keyToContext = new Map();
    const keys = [];
    
    // 키 생성
    contexts.forEach(context => {
      const strategy = this.selectStrategy(context);
      const key = strategy.generateKey(context);
      keys.push(key);
      keyToContext.set(key, context);
    });
    
    try {
      const cached = await this.cache.mget(keys, {
        fallback: fallback ? async (missedKeys) => {
          const fallbackResults = {};
          const missedContexts = missedKeys.map(key => keyToContext.get(key));
          
          const data = await fallback(missedContexts);
          
          if (data && typeof data === 'object') {
            missedContexts.forEach((context, index) => {
              const key = keys[contexts.indexOf(context)];
              if (data[context.id] !== undefined) {
                fallbackResults[key] = data[context.id];
              }
            });
          }
          
          return fallbackResults;
        } : null
      });
      
      // 결과 매핑
      keys.forEach((key, index) => {
        const context = contexts[index];
        if (cached[key] !== undefined) {
          results[context.id] = cached[key];
          this.metrics.hits++;
        } else {
          this.metrics.misses++;
        }
      });
      
      this.metrics.requests += contexts.length;
      return results;
    } catch (error) {
      this.metrics.errors++;
      console.error('Cache mget error:', error);
      return {};
    }
  }

  // 여러 데이터 저장
  async mset(contextDataPairs) {
    const keyValuePairs = {};
    const ttlMap = new Map();
    
    try {
      contextDataPairs.forEach(({ context, data }) => {
        const strategy = this.selectStrategy(context);
        
        if (strategy.shouldCache(context, data)) {
          const key = strategy.generateKey(context);
          const ttl = strategy.getTTL(context, data);
          
          keyValuePairs[key] = data;
          ttlMap.set(key, ttl);
        }
      });
      
      if (Object.keys(keyValuePairs).length > 0) {
        const success = await this.cache.mset(keyValuePairs);
        
        if (success) {
          contextDataPairs.forEach(({ context }) => {
            const strategy = this.selectStrategy(context);
            this.updateStrategyMetrics(strategy.name, 'set');
          });
        }
        
        return success;
      }
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      console.error('Cache mset error:', error);
      return false;
    }
  }

  // 캐시 무효화
  async invalidate(context) {
    try {
      const strategy = this.selectStrategy(context);
      const pattern = strategy.getInvalidationPattern(context);
      
      if (pattern) {
        const count = await this.cache.invalidate(pattern);
        this.metrics.invalidations += count;
        
        console.log(`Invalidated ${count} cache entries for pattern: ${pattern}`);
        return count;
      }
      
      return 0;
    } catch (error) {
      this.metrics.errors++;
      console.error('Cache invalidation error:', error);
      return 0;
    }
  }

  // 조건부 무효화
  async invalidateIf(context, condition) {
    if (typeof condition === 'function') {
      try {
        const shouldInvalidate = await condition(context);
        if (shouldInvalidate) {
          return await this.invalidate(context);
        }
      } catch (error) {
        console.error('Conditional invalidation error:', error);
      }
    }
    
    return 0;
  }

  // 캐시 워밍업
  async warmupCache() {
    console.log('Starting cache warmup...');
    
    const promises = this.options.warmupPatterns.slice(0, this.options.maxConcurrentWarmup).map(async (pattern) => {
      try {
        if (typeof pattern.loader === 'function') {
          const data = await pattern.loader();
          
          if (Array.isArray(data)) {
            const contextDataPairs = data.map(item => ({
              context: { ...pattern.context, id: item.id },
              data: item
            }));
            
            await this.mset(contextDataPairs);
            this.metrics.warmups += data.length;
          }
        }
      } catch (error) {
        console.error(`Warmup failed for pattern ${pattern.name}:`, error);
      }
    });
    
    await Promise.allSettled(promises);
    console.log(`Cache warmup completed. Warmed ${this.metrics.warmups} entries.`);
  }

  // 무효화 규칙 설정
  setupInvalidationRules() {
    // 데이터 변경 시 관련 캐시 무효화
    this.invalidationRules.set('data_updated', (context) => {
      return [
        { ...context, strategy: 'lru' },
        { ...context, strategy: 'business-priority' }
      ];
    });
    
    // 시간 기반 자동 무효화
    this.invalidationRules.set('time_based', (context) => {
      const now = new Date();
      const hour = now.getHours();
      
      // 매일 자정에 전체 시간 기반 캐시 무효화
      if (hour === 0) {
        return [{ type: '*', strategy: 'time-based' }];
      }
      
      return [];
    });
  }

  // 자동 무효화 실행
  async executeAutoInvalidation(trigger, context) {
    if (!this.options.autoInvalidation) {
      return;
    }
    
    const rule = this.invalidationRules.get(trigger);
    if (rule) {
      try {
        const invalidationTargets = rule(context);
        
        for (const target of invalidationTargets) {
          await this.invalidate(target);
        }
      } catch (error) {
        console.error(`Auto invalidation error for trigger ${trigger}:`, error);
      }
    }
  }

  // 전략별 메트릭 업데이트
  updateStrategyMetrics(strategyName, operation) {
    if (!this.options.enableMetrics) {
      return;
    }
    
    if (!this.metrics.strategyUsage[strategyName]) {
      this.metrics.strategyUsage[strategyName] = {
        hits: 0,
        misses: 0,
        sets: 0
      };
    }
    
    this.metrics.strategyUsage[strategyName][operation] = 
      (this.metrics.strategyUsage[strategyName][operation] || 0) + 1;
  }

  // 통계 조회
  getMetrics() {
    const cacheStats = this.cache.getStats();
    
    return {
      manager: {
        ...this.metrics,
        hitRate: this.metrics.requests > 0 
          ? (this.metrics.hits / this.metrics.requests) * 100 
          : 0
      },
      cache: cacheStats,
      strategies: Object.keys(this.metrics.strategyUsage).map(name => ({
        name,
        stats: this.metrics.strategyUsage[name]
      }))
    };
  }

  // 성능 보고서
  getPerformanceReport() {
    const metrics = this.getMetrics();
    const recommendations = [];
    
    // 히트율 분석
    if (metrics.manager.hitRate < 70) {
      recommendations.push({
        type: 'hit_rate',
        message: '캐시 히트율이 낮습니다. TTL 조정을 고려해보세요.',
        priority: 'high'
      });
    }
    
    // 전략 성능 분석
    Object.entries(metrics.manager.strategyUsage).forEach(([strategy, stats]) => {
      const strategyHitRate = stats.hits + stats.misses > 0 
        ? (stats.hits / (stats.hits + stats.misses)) * 100 
        : 0;
      
      if (strategyHitRate < 50) {
        recommendations.push({
          type: 'strategy_performance',
          message: `${strategy} 전략의 성능이 낮습니다.`,
          priority: 'medium'
        });
      }
    });
    
    // 오류율 분석
    if (metrics.manager.errors / metrics.manager.requests > 0.01) {
      recommendations.push({
        type: 'error_rate',
        message: '캐시 오류율이 높습니다. 연결 상태를 확인해주세요.',
        priority: 'critical'
      });
    }
    
    return {
      timestamp: new Date().toISOString(),
      metrics,
      recommendations,
      health: {
        overall: recommendations.filter(r => r.priority === 'critical').length === 0 ? 'healthy' : 'critical',
        hitRate: metrics.manager.hitRate,
        errorRate: (metrics.manager.errors / Math.max(metrics.manager.requests, 1)) * 100
      }
    };
  }

  // 헬스체크
  async health() {
    try {
      const cacheHealth = await this.cache.health();
      const metrics = this.getMetrics();
      
      return {
        status: cacheHealth.overall.status,
        cache: cacheHealth,
        manager: {
          strategies: this.strategies.size,
          invalidationRules: this.invalidationRules.size,
          metrics: metrics.manager
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  // 연결 종료
  async disconnect() {
    await this.cache.disconnect();
  }
}

export default {
  CacheStrategy,
  LRUStrategy,
  TimeBasedStrategy,
  BusinessPriorityStrategy,
  CacheManager
};