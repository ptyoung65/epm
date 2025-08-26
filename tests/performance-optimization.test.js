/**
 * Performance Optimization System Tests
 * AIRIS EPM - Enterprise Performance Management
 * 성능 최적화 시스템 통합 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MultiLayerCache, MemoryCache, RedisCache } from '../src/performance/caching/redis-cache.js';
import { CacheManager, LRUStrategy } from '../src/performance/caching/cache-manager.js';
import { QueryOptimizer, QueryAnalyzer } from '../src/performance/query-optimizer.js';
import { DatabaseConnectionPool, AsyncTaskQueue } from '../src/performance/pooling/connection-pool.js';
import { CDNManager, CloudFrontProvider, ResourceOptimizer } from '../src/performance/cdn/cdn-manager.js';
import { MetricsCollector, PerformanceAnalyzer } from '../src/performance/monitoring/performance-monitor.js';

describe('Redis Cache System', () => {
  let cache;
  
  beforeEach(() => {
    cache = new MemoryCache({ max: 100 });
  });
  
  test('should store and retrieve values correctly', () => {
    const key = 'test-key';
    const value = { data: 'test-value', timestamp: Date.now() };
    
    cache.set(key, value);
    const retrieved = cache.get(key);
    
    expect(retrieved).toEqual(value);
  });
  
  test('should handle cache misses', () => {
    const result = cache.get('non-existent-key');
    expect(result).toBeNull();
  });
  
  test('should track statistics', () => {
    cache.set('key1', 'value1');
    cache.get('key1'); // hit
    cache.get('key2'); // miss
    
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(1);
  });
  
  test('should evict items when max size reached', () => {
    const smallCache = new MemoryCache({ max: 2 });
    
    smallCache.set('key1', 'value1');
    smallCache.set('key2', 'value2');
    smallCache.set('key3', 'value3'); // Should evict key1
    
    expect(smallCache.get('key1')).toBeNull();
    expect(smallCache.get('key2')).toBe('value2');
    expect(smallCache.get('key3')).toBe('value3');
  });
});

describe('Multi-Layer Cache System', () => {
  let multiCache;
  
  beforeEach(async () => {
    multiCache = new MultiLayerCache({
      l1: { max: 10 },
      l2: { host: 'localhost', port: 6379 }
    });
    // 실제 환경에서는 await multiCache.init();
  });
  
  test('should prioritize L1 cache', async () => {
    const key = 'test-key';
    const value = 'test-value';
    
    // L1에 저장
    multiCache.l1Cache.set(key, value);
    
    const result = await multiCache.get(key);
    expect(result).toBe(value);
    
    const stats = multiCache.getStats();
    expect(stats.overall.l1Hits).toBe(1);
    expect(stats.overall.l2Hits).toBe(0);
  });
  
  test('should promote L2 hits to L1', async () => {
    const key = 'test-key';
    const value = 'test-value';
    
    // L2에만 저장 (시뮬레이션)
    await multiCache.l2Cache.set(key, value);
    
    const result = await multiCache.get(key);
    
    // L1에도 저장되었는지 확인
    expect(multiCache.l1Cache.get(key)).toBe(value);
  });
});

describe('Cache Manager', () => {
  let cacheManager;
  
  beforeEach(async () => {
    cacheManager = new CacheManager({
      cache: {
        l1: { max: 100 },
        l2: { host: 'localhost' }
      }
    });
    // 실제 환경에서는 await cacheManager.init();
  });
  
  test('should use appropriate cache strategy', async () => {
    const context = {
      type: 'user',
      id: '123',
      strategy: 'lru'
    };
    
    const strategy = cacheManager.selectStrategy(context);
    expect(strategy).toBeInstanceOf(LRUStrategy);
    expect(strategy.name).toBe('lru');
  });
  
  test('should generate consistent cache keys', () => {
    const strategy = new LRUStrategy();
    const context = {
      type: 'user',
      id: '123',
      params: { include: 'profile' }
    };
    
    const key1 = strategy.generateKey(context);
    const key2 = strategy.generateKey(context);
    
    expect(key1).toBe(key2);
    expect(key1).toContain('user:123');
    expect(key1).toContain('include:profile');
  });
  
  test('should calculate appropriate TTL based on context', () => {
    const strategy = new LRUStrategy();
    const context = {
      accessCount: 150,
      dataSize: 1024
    };
    
    const ttl = strategy.getTTL(context);
    expect(ttl).toBeGreaterThan(3600); // Should increase TTL for high access count
  });
});

describe('Query Optimizer', () => {
  let optimizer;
  
  beforeEach(() => {
    optimizer = new QueryOptimizer();
  });
  
  test('should analyze query structure correctly', () => {
    const sql = 'SELECT name, email FROM users WHERE status = ? AND created_at > ?';
    const analysis = optimizer.analyzer.analyzeQuery(sql, ['active', '2024-01-01']);
    
    expect(analysis.type).toBe('SELECT');
    expect(analysis.tables).toContain('users');
    expect(analysis.columns).toContain('name');
    expect(analysis.columns).toContain('email');
    expect(analysis.conditions).toHaveLength(2);
  });
  
  test('should detect query complexity', () => {
    const complexSQL = `
      SELECT u.name, p.title, COUNT(c.id) as comment_count
      FROM users u 
      JOIN posts p ON u.id = p.user_id 
      LEFT JOIN comments c ON p.id = c.post_id
      WHERE u.status = 'active'
      GROUP BY u.id, p.id
      ORDER BY comment_count DESC
    `;
    
    const analysis = optimizer.analyzer.analyzeQuery(complexSQL);
    expect(analysis.complexity).toBeGreaterThan(3);
  });
  
  test('should suggest indexes for queries', () => {
    const sql = 'SELECT * FROM users WHERE email = ? AND status = ?';
    const analysis = optimizer.analyzer.analyzeQuery(sql);
    const suggestions = optimizer.analyzer.suggestIndexes(analysis);
    
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].columns).toContain('email');
  });
  
  test('should optimize queries', async () => {
    const originalSQL = 'SELECT * FROM users WHERE id = 1';
    const result = await optimizer.optimizeQuery(originalSQL);
    
    expect(result.original).toBe(originalSQL);
    expect(result.suggestions).toBeDefined();
    expect(result.analysis).toBeDefined();
  });
});

describe('Connection Pool', () => {
  let pool;
  
  beforeEach(async () => {
    pool = new DatabaseConnectionPool({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test'
    }, {
      min: 2,
      max: 5
    });
    
    // 실제 환경에서는 await pool.init();
  });
  
  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
  });
  
  test('should acquire and release connections', async () => {
    // 연결 풀 시뮬레이션을 위한 모킹
    pool.createRawConnection = jest.fn().mockResolvedValue({
      host: 'localhost',
      connected: true
    });
    
    await pool.init();
    
    const connection = await pool.acquire();
    expect(connection).toBeDefined();
    expect(connection.connected).toBe(true);
    
    await pool.release(connection);
    
    const stats = pool.getStats();
    expect(stats.acquired).toBe(1);
    expect(stats.released).toBe(1);
  });
  
  test('should handle connection timeouts', async () => {
    const smallPool = new DatabaseConnectionPool({}, {
      min: 1,
      max: 1,
      acquireTimeoutMs: 100
    });
    
    smallPool.createRawConnection = jest.fn().mockResolvedValue({
      host: 'localhost',
      connected: true
    });
    
    await smallPool.init();
    
    const connection1 = await smallPool.acquire();
    
    // 두 번째 연결 요청은 타임아웃되어야 함
    await expect(smallPool.acquire()).rejects.toThrow('Connection acquisition timeout');
    
    await smallPool.release(connection1);
    await smallPool.shutdown();
  });
  
  test('should maintain minimum connections', async () => {
    pool.createRawConnection = jest.fn().mockResolvedValue({
      host: 'localhost',
      connected: true
    });
    
    await pool.init();
    
    const stats = pool.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(pool.options.min);
  });
});

describe('Async Task Queue', () => {
  let queue;
  
  beforeEach(() => {
    queue = new AsyncTaskQueue({
      concurrency: 2,
      timeout: 1000
    });
  });
  
  test('should process tasks in order', async () => {
    const results = [];
    
    const task1 = () => new Promise(resolve => {
      setTimeout(() => {
        results.push('task1');
        resolve('result1');
      }, 50);
    });
    
    const task2 = () => new Promise(resolve => {
      setTimeout(() => {
        results.push('task2');
        resolve('result2');
      }, 25);
    });
    
    const promises = [
      queue.add(task1),
      queue.add(task2)
    ];
    
    const taskResults = await Promise.all(promises);
    
    expect(taskResults).toEqual(['result1', 'result2']);
    expect(results).toEqual(['task2', 'task1']); // task2가 더 빠름
  });
  
  test('should handle task failures and retries', async () => {
    let attempts = 0;
    const failingTask = () => new Promise((resolve, reject) => {
      attempts++;
      if (attempts < 3) {
        reject(new Error('Task failed'));
      } else {
        resolve('success');
      }
    });
    
    const result = await queue.add(failingTask);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
  
  test('should respect concurrency limits', async () => {
    let running = 0;
    let maxConcurrent = 0;
    
    const task = () => new Promise(resolve => {
      running++;
      maxConcurrent = Math.max(maxConcurrent, running);
      
      setTimeout(() => {
        running--;
        resolve('done');
      }, 100);
    });
    
    const promises = Array.from({ length: 5 }, () => queue.add(task));
    await Promise.all(promises);
    
    expect(maxConcurrent).toBeLessThanOrEqual(queue.options.concurrency);
  });
});

describe('CDN Manager', () => {
  let cdnManager;
  let mockProvider;
  
  beforeEach(() => {
    mockProvider = new CloudFrontProvider({
      distributionId: 'test-dist',
      bucketName: 'test-bucket',
      domainName: 'cdn.example.com'
    });
    
    cdnManager = new CDNManager();
    cdnManager.addProvider(mockProvider, true);
  });
  
  test('should upload files to CDN', async () => {
    const file = {
      name: 'test.css',
      content: 'body { color: red; }',
      size: 100
    };
    
    const result = await cdnManager.upload(file);
    
    expect(result.key).toBeDefined();
    expect(result.url).toContain('cdn.example.com');
    expect(result.optimization).toBeDefined();
  });
  
  test('should optimize resources before upload', async () => {
    const file = {
      name: 'test.js',
      content: '/* comment */ var x = 1;  \n  var y = 2;',
      size: 100
    };
    
    const result = await cdnManager.upload(file);
    
    expect(result.optimization.techniques).toContain('minification');
    expect(result.optimization.saved).toBeGreaterThan(0);
  });
  
  test('should handle batch uploads', async () => {
    const files = [
      { name: 'file1.css', content: 'css content', size: 50 },
      { name: 'file2.js', content: 'js content', size: 60 }
    ];
    
    const results = await cdnManager.uploadBatch(files);
    
    expect(results).toHaveLength(2);
    results.forEach(result => {
      expect(result.status).toBe('fulfilled');
    });
  });
});

describe('Resource Optimizer', () => {
  let optimizer;
  
  beforeEach(() => {
    optimizer = new ResourceOptimizer();
  });
  
  test('should minify JavaScript', async () => {
    const file = {
      name: 'test.js',
      content: '/* This is a comment */\nvar x = 1; // Another comment\nvar y = 2;',
      size: 100
    };
    
    const optimized = await optimizer.optimize(file);
    
    expect(optimized.content.length).toBeLessThan(file.content.length);
    expect(optimized.optimization.techniques).toContain('minification');
    expect(optimized.optimization.saved).toBeGreaterThan(0);
  });
  
  test('should minify CSS', async () => {
    const file = {
      name: 'test.css',
      content: '/* Comment */ body { color: red; margin: 0; }',
      size: 100
    };
    
    const optimized = await optimizer.optimize(file);
    
    expect(optimized.content).not.toContain('/*');
    expect(optimized.optimization.techniques).toContain('minification');
  });
  
  test('should skip optimization for binary files', async () => {
    const file = {
      name: 'image.png',
      content: 'binary-image-data',
      size: 1000
    };
    
    const optimized = await optimizer.optimize(file);
    
    expect(optimized.optimization.techniques).toContain('image-optimization');
  });
});

describe('Performance Monitor', () => {
  let collector;
  let analyzer;
  
  beforeEach(() => {
    collector = new MetricsCollector({
      enableSystemMetrics: true,
      enableApplicationMetrics: true
    });
    
    analyzer = new PerformanceAnalyzer(collector);
  });
  
  afterEach(() => {
    collector.stop();
    analyzer.stop();
  });
  
  test('should collect system metrics', async () => {
    const metrics = await collector.collectSystemMetrics();
    
    expect(metrics.cpu).toBeDefined();
    expect(metrics.memory).toBeDefined();
    expect(metrics.uptime).toBeDefined();
    
    expect(metrics.cpu.count).toBeGreaterThan(0);
    expect(metrics.memory.total).toBeGreaterThan(0);
  });
  
  test('should collect application metrics', async () => {
    const metrics = await collector.collectApplicationMetrics();
    
    expect(metrics.eventLoop).toBeDefined();
    expect(metrics.handles).toBeDefined();
    expect(metrics.versions).toBeDefined();
    
    expect(metrics.eventLoop.delay).toBeGreaterThanOrEqual(0);
    expect(metrics.handles.active).toBeGreaterThanOrEqual(0);
  });
  
  test('should detect performance issues', async () => {
    // 높은 CPU 사용률 시뮬레이션
    const highCpuMetrics = {
      system: {
        cpu: { usage: { average: 90 } },
        memory: { usagePercent: 50 }
      }
    };
    
    const alerts = analyzer.checkThresholds(highCpuMetrics);
    
    expect(alerts).toHaveLength(1);
    expect(alerts[0].metric).toBe('cpu_usage');
    expect(alerts[0].severity).toBe('warning');
  });
  
  test('should generate performance reports', async () => {
    collector.start();
    await new Promise(resolve => setTimeout(resolve, 100)); // 데이터 수집 대기
    
    const report = await analyzer.analyze();
    
    expect(report.timestamp).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.recommendations).toBeDefined();
    
    collector.stop();
  });
});

// 통합 테스트
describe('Performance System Integration', () => {
  let systems;
  
  beforeEach(async () => {
    systems = {
      cache: new CacheManager(),
      optimizer: new QueryOptimizer(),
      pool: new DatabaseConnectionPool({ host: 'localhost' }),
      cdn: new CDNManager(),
      monitor: new MetricsCollector()
    };
    
    // 실제 환경에서는 모든 시스템 초기화
    // await systems.cache.init();
    // await systems.pool.init();
  });
  
  afterEach(async () => {
    systems.monitor.stop();
    // await systems.pool.shutdown();
  });
  
  test('should handle end-to-end workflow', async () => {
    // 1. 쿼리 최적화
    const sql = 'SELECT * FROM users WHERE id = ?';
    const optimizedQuery = await systems.optimizer.optimizeQuery(sql, [1]);
    
    expect(optimizedQuery.analysis).toBeDefined();
    
    // 2. 캐시에서 결과 확인
    const cacheKey = 'user:1';
    const cachedResult = await systems.cache.get({
      type: 'user',
      id: '1'
    });
    
    // 첫 번째 요청에서는 캐시 미스
    expect(cachedResult).toBeNull();
    
    // 3. 데이터 저장 후 캐시에 저장
    const userData = { id: 1, name: 'Test User' };
    await systems.cache.set({
      type: 'user',
      id: '1'
    }, userData);
    
    // 4. 캐시에서 데이터 조회
    const cachedData = await systems.cache.get({
      type: 'user',
      id: '1'
    });
    
    expect(cachedData).toEqual(userData);
    
    // 5. 성능 메트릭 수집
    const metrics = systems.monitor.getLatestMetrics();
    expect(metrics).toBeDefined();
  });
  
  test('should maintain performance under load', async () => {
    const startTime = Date.now();
    const operations = [];
    
    // 100개의 동시 캐시 작업
    for (let i = 0; i < 100; i++) {
      operations.push(systems.cache.set({
        type: 'test',
        id: i.toString()
      }, { data: `test-${i}` }));
    }
    
    await Promise.all(operations);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 100개 작업이 1초 이내에 완료되어야 함
    expect(duration).toBeLessThan(1000);
    
    // 캐시 통계 확인
    const stats = systems.cache.getMetrics();
    expect(stats.manager.hits + stats.manager.misses).toBeGreaterThanOrEqual(100);
  });
});

// 벤치마크 테스트
describe('Performance Benchmarks', () => {
  test('cache performance benchmark', async () => {
    const cache = new MemoryCache({ max: 10000 });
    const iterations = 1000;
    
    // 쓰기 성능 측정
    const writeStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      cache.set(`key-${i}`, { data: `value-${i}` });
    }
    const writeTime = Date.now() - writeStart;
    
    // 읽기 성능 측정
    const readStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      cache.get(`key-${i}`);
    }
    const readTime = Date.now() - readStart;
    
    console.log(`Cache Write Performance: ${iterations}/${writeTime}ms = ${(iterations/writeTime*1000).toFixed(0)} ops/sec`);
    console.log(`Cache Read Performance: ${iterations}/${readTime}ms = ${(iterations/readTime*1000).toFixed(0)} ops/sec`);
    
    // 성능 기준 확인
    expect(writeTime).toBeLessThan(1000); // 1초 이내
    expect(readTime).toBeLessThan(100);   // 100ms 이내
  });
  
  test('query optimization benchmark', async () => {
    const optimizer = new QueryOptimizer();
    const queries = [
      'SELECT * FROM users WHERE id = ?',
      'SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id',
      'SELECT COUNT(*) FROM orders WHERE created_at > ? GROUP BY user_id'
    ];
    
    const startTime = Date.now();
    
    const results = await Promise.all(
      queries.map(sql => optimizer.optimizeQuery(sql))
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Query Optimization: ${queries.length}/${duration}ms = ${(queries.length/duration*1000).toFixed(0)} queries/sec`);
    
    expect(results).toHaveLength(queries.length);
    expect(duration).toBeLessThan(500); // 500ms 이내
  });
  
  test('connection pool benchmark', async () => {
    const pool = new DatabaseConnectionPool({}, {
      min: 5,
      max: 20
    });
    
    pool.createRawConnection = jest.fn().mockResolvedValue({
      host: 'localhost',
      connected: true
    });
    
    await pool.init();
    
    const operations = 100;
    const startTime = Date.now();
    
    const promises = Array.from({ length: operations }, async () => {
      const conn = await pool.acquire();
      // 작업 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      await pool.release(conn);
    });
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Connection Pool: ${operations}/${duration}ms = ${(operations/duration*1000).toFixed(0)} ops/sec`);
    
    const stats = pool.getStats();
    expect(stats.acquired).toBe(operations);
    expect(stats.released).toBe(operations);
    
    await pool.shutdown();
  });
});