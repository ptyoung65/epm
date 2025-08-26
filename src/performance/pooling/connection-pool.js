/**
 * Connection Pooling and Async Processing System
 * AIRIS EPM - Enterprise Performance Management
 * 고성능 연결 풀링 및 비동기 처리 시스템
 */

import EventEmitter from 'events';

// 연결 풀 기본 클래스
export class ConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      min: options.min || 5,                    // 최소 연결 수
      max: options.max || 20,                   // 최대 연결 수
      acquireTimeoutMs: options.acquireTimeoutMs || 30000,  // 연결 획득 타임아웃
      idleTimeoutMs: options.idleTimeoutMs || 600000,       // 유휴 연결 타임아웃 (10분)
      maxLifetimeMs: options.maxLifetimeMs || 3600000,      // 최대 연결 수명 (1시간)
      testOnBorrow: options.testOnBorrow !== false,         // 대여시 연결 테스트
      testInterval: options.testInterval || 60000,          // 테스트 간격 (1분)
      retryAttempts: options.retryAttempts || 3,            // 재시도 횟수
      retryDelay: options.retryDelay || 1000,               // 재시도 지연
      ...options
    };
    
    this.connections = new Map();
    this.availableConnections = [];
    this.pendingRequests = [];
    this.stats = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      timeouts: 0,
      errors: 0,
      testFailures: 0
    };
    
    this.isInitialized = false;
    this.isShuttingDown = false;
    this.maintenanceInterval = null;
    
    // 이벤트 리스너
    this.on('error', this.handleError.bind(this));
  }

  // 풀 초기화
  async init() {
    if (this.isInitialized) return;
    
    try {
      // 최소 연결 수만큼 생성
      const connections = [];
      for (let i = 0; i < this.options.min; i++) {
        connections.push(this.createConnection());
      }
      
      await Promise.all(connections);
      
      // 유지보수 작업 시작
      this.startMaintenance();
      
      this.isInitialized = true;
      this.emit('initialized', { poolSize: this.connections.size });
      
      console.log(`Connection pool initialized with ${this.connections.size} connections`);
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
      throw error;
    }
  }

  // 연결 생성 (추상 메서드)
  async createConnection() {
    throw new Error('createConnection method must be implemented by subclass');
  }

  // 연결 검증 (추상 메서드)
  async validateConnection(connection) {
    throw new Error('validateConnection method must be implemented by subclass');
  }

  // 연결 종료 (추상 메서드)
  async destroyConnection(connection) {
    throw new Error('destroyConnection method must be implemented by subclass');
  }

  // 연결 획득
  async acquire() {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }
    
    return new Promise((resolve, reject) => {
      const request = {
        resolve,
        reject,
        timestamp: Date.now(),
        timeout: setTimeout(() => {
          this.stats.timeouts++;
          const index = this.pendingRequests.indexOf(request);
          if (index > -1) {
            this.pendingRequests.splice(index, 1);
          }
          reject(new Error('Connection acquisition timeout'));
        }, this.options.acquireTimeoutMs)
      };
      
      this.pendingRequests.push(request);
      this.processRequests();
    });
  }

  // 연결 반환
  async release(connection) {
    if (!connection || !this.connections.has(connection.id)) {
      console.warn('Attempt to release unknown connection');
      return;
    }
    
    const connInfo = this.connections.get(connection.id);
    
    if (connInfo.inUse) {
      connInfo.inUse = false;
      connInfo.lastReleased = Date.now();
      this.availableConnections.push(connection);
      this.stats.released++;
      
      // 대기 중인 요청 처리
      this.processRequests();
      
      this.emit('released', { connectionId: connection.id });
    }
  }

  // 요청 처리
  async processRequests() {
    while (this.pendingRequests.length > 0 && this.availableConnections.length > 0) {
      const request = this.pendingRequests.shift();
      const connection = this.availableConnections.shift();
      
      clearTimeout(request.timeout);
      
      try {
        // 연결 테스트
        if (this.options.testOnBorrow) {
          const isValid = await this.validateConnection(connection);
          if (!isValid) {
            this.stats.testFailures++;
            await this.destroyConnection(connection);
            this.connections.delete(connection.id);
            
            // 새 연결 생성 시도
            if (this.connections.size < this.options.max) {
              this.createConnection().catch(err => 
                console.error('Failed to create replacement connection:', err)
              );
            }
            
            // 다음 사용 가능한 연결로 재시도
            continue;
          }
        }
        
        // 연결 할당
        const connInfo = this.connections.get(connection.id);
        connInfo.inUse = true;
        connInfo.lastAcquired = Date.now();
        
        this.stats.acquired++;
        request.resolve(connection);
        
        this.emit('acquired', { connectionId: connection.id });
      } catch (error) {
        this.stats.errors++;
        request.reject(error);
      }
    }
    
    // 연결 부족시 새 연결 생성
    if (this.pendingRequests.length > 0 && this.connections.size < this.options.max) {
      this.createConnection().catch(err => 
        console.error('Failed to create connection for pending request:', err)
      );
    }
  }

  // 실제 연결 생성 로직
  async createConnection() {
    if (this.connections.size >= this.options.max) {
      return;
    }
    
    let retries = 0;
    
    while (retries < this.options.retryAttempts) {
      try {
        const connection = await this.createRawConnection();
        connection.id = this.generateConnectionId();
        
        const connInfo = {
          connection,
          createdAt: Date.now(),
          lastAcquired: null,
          lastReleased: Date.now(),
          inUse: false,
          testFailures: 0
        };
        
        this.connections.set(connection.id, connInfo);
        this.availableConnections.push(connection);
        this.stats.created++;
        
        this.emit('created', { connectionId: connection.id });
        return connection;
      } catch (error) {
        retries++;
        this.stats.errors++;
        
        if (retries < this.options.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
        } else {
          throw error;
        }
      }
    }
  }

  // 실제 연결 생성 (서브클래스에서 구현)
  async createRawConnection() {
    throw new Error('createRawConnection method must be implemented by subclass');
  }

  // 연결 ID 생성
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 유지보수 작업 시작
  startMaintenance() {
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance();
    }, this.options.testInterval);
  }

  // 유지보수 작업 수행
  async performMaintenance() {
    const now = Date.now();
    const connectionsToRemove = [];
    
    // 만료된 연결 찾기
    for (const [id, connInfo] of this.connections.entries()) {
      const age = now - connInfo.createdAt;
      const idleTime = now - connInfo.lastReleased;
      
      // 최대 수명 초과 또는 유휴 시간 초과
      if (age > this.options.maxLifetimeMs || 
          (!connInfo.inUse && idleTime > this.options.idleTimeoutMs)) {
        connectionsToRemove.push(id);
      }
    }
    
    // 만료된 연결 제거
    for (const id of connectionsToRemove) {
      const connInfo = this.connections.get(id);
      if (!connInfo.inUse) {
        await this.destroyConnection(connInfo.connection);
        this.connections.delete(id);
        
        const index = this.availableConnections.indexOf(connInfo.connection);
        if (index > -1) {
          this.availableConnections.splice(index, 1);
        }
        
        this.stats.destroyed++;
        this.emit('destroyed', { connectionId: id, reason: 'maintenance' });
      }
    }
    
    // 최소 연결 수 유지
    const currentSize = this.connections.size;
    const minConnectionsNeeded = this.options.min - currentSize;
    
    if (minConnectionsNeeded > 0) {
      const promises = [];
      for (let i = 0; i < minConnectionsNeeded; i++) {
        promises.push(this.createConnection().catch(err => 
          console.error('Maintenance connection creation failed:', err)
        ));
      }
      await Promise.allSettled(promises);
    }
    
    this.emit('maintenance', {
      removed: connectionsToRemove.length,
      current: this.connections.size,
      available: this.availableConnections.length
    });
  }

  // 에러 처리
  handleError(error) {
    console.error('Connection pool error:', error);
    this.stats.errors++;
  }

  // 통계 조회
  getStats() {
    return {
      ...this.stats,
      total: this.connections.size,
      available: this.availableConnections.length,
      inUse: this.connections.size - this.availableConnections.length,
      pending: this.pendingRequests.length,
      utilization: this.connections.size > 0 
        ? ((this.connections.size - this.availableConnections.length) / this.connections.size) * 100 
        : 0
    };
  }

  // 연결 상태 조회
  getConnectionStatus() {
    const connections = [];
    
    for (const [id, connInfo] of this.connections.entries()) {
      connections.push({
        id,
        createdAt: connInfo.createdAt,
        lastAcquired: connInfo.lastAcquired,
        lastReleased: connInfo.lastReleased,
        inUse: connInfo.inUse,
        age: Date.now() - connInfo.createdAt,
        idleTime: connInfo.inUse ? 0 : Date.now() - connInfo.lastReleased
      });
    }
    
    return connections;
  }

  // 헬스체크
  async health() {
    const stats = this.getStats();
    
    let status = 'healthy';
    const issues = [];
    
    // 사용 가능한 연결이 부족한 경우
    if (stats.available === 0 && stats.pending > 0) {
      status = 'warning';
      issues.push('No available connections with pending requests');
    }
    
    // 오류율이 높은 경우
    const errorRate = stats.acquired > 0 ? (stats.errors / stats.acquired) * 100 : 0;
    if (errorRate > 10) {
      status = 'critical';
      issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
    }
    
    // 타임아웃이 많은 경우
    const timeoutRate = stats.acquired > 0 ? (stats.timeouts / stats.acquired) * 100 : 0;
    if (timeoutRate > 5) {
      status = 'warning';
      issues.push(`High timeout rate: ${timeoutRate.toFixed(2)}%`);
    }
    
    return {
      status,
      stats,
      issues,
      initialized: this.isInitialized,
      shuttingDown: this.isShuttingDown
    };
  }

  // 풀 종료
  async shutdown() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    
    // 유지보수 작업 중단
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }
    
    // 대기 중인 요청 거부
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection pool shutting down'));
    });
    this.pendingRequests = [];
    
    // 모든 연결 종료
    const promises = [];
    for (const [id, connInfo] of this.connections.entries()) {
      promises.push(this.destroyConnection(connInfo.connection));
    }
    
    await Promise.allSettled(promises);
    
    this.connections.clear();
    this.availableConnections = [];
    
    this.emit('shutdown');
    console.log('Connection pool shut down');
  }
}

// 데이터베이스 연결 풀
export class DatabaseConnectionPool extends ConnectionPool {
  constructor(dbConfig, options = {}) {
    super(options);
    this.dbConfig = dbConfig;
  }

  // 데이터베이스 연결 생성
  async createRawConnection() {
    // 실제로는 mysql2, pg, 또는 다른 DB 드라이버 사용
    // 여기서는 시뮬레이션
    
    const connection = {
      host: this.dbConfig.host,
      port: this.dbConfig.port,
      database: this.dbConfig.database,
      user: this.dbConfig.user,
      connected: true,
      lastQuery: null
    };
    
    // 연결 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return connection;
  }

  // 연결 검증
  async validateConnection(connection) {
    try {
      if (!connection.connected) {
        return false;
      }
      
      // ping 쿼리 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 10));
      return true;
    } catch (error) {
      return false;
    }
  }

  // 연결 종료
  async destroyConnection(connection) {
    try {
      connection.connected = false;
      // 연결 종료 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error('Error destroying connection:', error);
    }
  }

  // 쿼리 실행
  async query(sql, params = []) {
    const connection = await this.acquire();
    
    try {
      connection.lastQuery = { sql, params, timestamp: Date.now() };
      
      // 쿼리 실행 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      return {
        sql,
        params,
        rows: [],
        executionTime: Math.random() * 100
      };
    } finally {
      await this.release(connection);
    }
  }
}

// HTTP 연결 풀
export class HttpConnectionPool extends ConnectionPool {
  constructor(baseURL, options = {}) {
    super(options);
    this.baseURL = baseURL;
    this.keepAlive = options.keepAlive !== false;
    this.timeout = options.timeout || 30000;
  }

  // HTTP 연결 생성
  async createRawConnection() {
    // 실제로는 http.Agent 또는 axios 인스턴스 생성
    const connection = {
      baseURL: this.baseURL,
      keepAlive: this.keepAlive,
      timeout: this.timeout,
      active: true,
      requestCount: 0
    };
    
    // 연결 초기화 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return connection;
  }

  // 연결 검증
  async validateConnection(connection) {
    try {
      return connection.active;
    } catch (error) {
      return false;
    }
  }

  // 연결 종료
  async destroyConnection(connection) {
    connection.active = false;
  }

  // HTTP 요청 실행
  async request(method, path, data = null, headers = {}) {
    const connection = await this.acquire();
    
    try {
      connection.requestCount++;
      
      // HTTP 요청 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
      
      return {
        status: 200,
        data: { message: 'Success' },
        headers: {},
        config: { method, path, data }
      };
    } finally {
      await this.release(connection);
    }
  }
}

// 비동기 작업 큐
export class AsyncTaskQueue {
  constructor(options = {}) {
    this.options = {
      concurrency: options.concurrency || 10,
      maxQueueSize: options.maxQueueSize || 1000,
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };
    
    this.queue = [];
    this.running = new Set();
    this.results = new Map();
    this.stats = {
      added: 0,
      processed: 0,
      failed: 0,
      retried: 0,
      timeouts: 0
    };
    
    this.isProcessing = false;
  }

  // 작업 추가
  async add(task, options = {}) {
    if (this.queue.length >= this.options.maxQueueSize) {
      throw new Error('Queue is full');
    }
    
    const taskWrapper = {
      id: this.generateTaskId(),
      task,
      options: { ...this.options, ...options },
      attempts: 0,
      createdAt: Date.now(),
      status: 'pending'
    };
    
    return new Promise((resolve, reject) => {
      taskWrapper.resolve = resolve;
      taskWrapper.reject = reject;
      
      this.queue.push(taskWrapper);
      this.stats.added++;
      
      if (!this.isProcessing) {
        this.process();
      }
    });
  }

  // 배치 작업 추가
  async addBatch(tasks, options = {}) {
    const promises = tasks.map(task => this.add(task, options));
    return Promise.allSettled(promises);
  }

  // 큐 처리
  async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    while (this.queue.length > 0 || this.running.size > 0) {
      // 동시 실행 제한 체크
      while (this.running.size < this.options.concurrency && this.queue.length > 0) {
        const taskWrapper = this.queue.shift();
        this.executeTask(taskWrapper);
      }
      
      // 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.isProcessing = false;
  }

  // 작업 실행
  async executeTask(taskWrapper) {
    this.running.add(taskWrapper.id);
    taskWrapper.status = 'running';
    taskWrapper.startedAt = Date.now();
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), taskWrapper.options.timeout);
      });
      
      const taskPromise = taskWrapper.task();
      const result = await Promise.race([taskPromise, timeoutPromise]);
      
      taskWrapper.status = 'completed';
      taskWrapper.completedAt = Date.now();
      taskWrapper.result = result;
      
      this.results.set(taskWrapper.id, result);
      this.stats.processed++;
      
      taskWrapper.resolve(result);
    } catch (error) {
      taskWrapper.attempts++;
      
      if (taskWrapper.attempts < taskWrapper.options.retryAttempts) {
        // 재시도
        taskWrapper.status = 'retrying';
        this.stats.retried++;
        
        setTimeout(() => {
          this.queue.unshift(taskWrapper);
        }, taskWrapper.options.retryDelay);
      } else {
        // 최종 실패
        taskWrapper.status = 'failed';
        taskWrapper.error = error;
        this.stats.failed++;
        
        if (error.message === 'Task timeout') {
          this.stats.timeouts++;
        }
        
        taskWrapper.reject(error);
      }
    } finally {
      this.running.delete(taskWrapper.id);
    }
  }

  // 작업 ID 생성
  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 우선순위 작업 추가
  async addPriority(task, priority = 0, options = {}) {
    const taskWrapper = {
      id: this.generateTaskId(),
      task,
      priority,
      options: { ...this.options, ...options },
      attempts: 0,
      createdAt: Date.now(),
      status: 'pending'
    };
    
    return new Promise((resolve, reject) => {
      taskWrapper.resolve = resolve;
      taskWrapper.reject = reject;
      
      // 우선순위에 따라 삽입 위치 결정
      let insertIndex = 0;
      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i].priority < priority) {
          insertIndex = i;
          break;
        }
        insertIndex = i + 1;
      }
      
      this.queue.splice(insertIndex, 0, taskWrapper);
      this.stats.added++;
      
      if (!this.isProcessing) {
        this.process();
      }
    });
  }

  // 큐 상태 조회
  getStatus() {
    return {
      queueSize: this.queue.length,
      running: this.running.size,
      completed: this.results.size,
      stats: this.stats,
      isProcessing: this.isProcessing
    };
  }

  // 작업 결과 조회
  getResult(taskId) {
    return this.results.get(taskId);
  }

  // 큐 일시정지
  pause() {
    this.isProcessing = false;
  }

  // 큐 재개
  resume() {
    if (!this.isProcessing && (this.queue.length > 0 || this.running.size > 0)) {
      this.process();
    }
  }

  // 큐 초기화
  clear() {
    this.queue.forEach(taskWrapper => {
      taskWrapper.reject(new Error('Queue cleared'));
    });
    
    this.queue = [];
    this.results.clear();
    this.stats = {
      added: 0,
      processed: 0,
      failed: 0,
      retried: 0,
      timeouts: 0
    };
  }
}

export default {
  ConnectionPool,
  DatabaseConnectionPool,
  HttpConnectionPool,
  AsyncTaskQueue
};