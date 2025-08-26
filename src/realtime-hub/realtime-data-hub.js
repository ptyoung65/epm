/**
 * AIRIS EPM 실시간 데이터 통합 허브
 * 여러 데이터 소스를 통합하여 실시간으로 데이터를 제공하는 WebSocket 기반 서비스
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const EventEmitter = require('events');

class RealtimeDataHub extends EventEmitter {
  constructor(port = 3300) {
    super();
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    
    // 데이터 소스들
    this.dataSources = new Map();
    this.subscribers = new Map();
    this.dataCache = new Map();
    this.updateIntervals = new Map();
    
    this.setupExpress();
    this.setupWebSocket();
    this.setupDataSources();
  }

  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // 로깅 미들웨어
    this.app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} - ${req.method} ${req.path}`);
      next();
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Realtime Data Hub',
        connections: this.wss.clients.size,
        dataSources: this.dataSources.size
      });
    });

    // 실시간 데이터 스냅샷
    this.app.get('/api/realtime/snapshot', (req, res) => {
      const snapshot = this.generateDataSnapshot();
      res.json(snapshot);
    });

    // 데이터 소스 상태
    this.app.get('/api/realtime/sources', (req, res) => {
      const sources = Array.from(this.dataSources.entries()).map(([id, source]) => ({
        id,
        name: source.name,
        status: source.status,
        lastUpdate: source.lastUpdate,
        errorCount: source.errorCount,
        dataPoints: source.dataPoints?.length || 0
      }));
      res.json(sources);
    });

    // 구독 관리
    this.app.get('/api/realtime/subscriptions', (req, res) => {
      const subscriptions = Array.from(this.subscribers.entries()).map(([topic, subscribers]) => ({
        topic,
        subscriberCount: subscribers.length
      }));
      res.json(subscriptions);
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      console.log(`📡 WebSocket client connected: ${clientId}`);
      
      ws.clientId = clientId;
      ws.subscriptions = new Set();
      
      // 클라이언트 메시지 처리
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });
      
      // 연결 종료 처리
      ws.on('close', () => {
        console.log(`📡 WebSocket client disconnected: ${clientId}`);
        this.unsubscribeClient(ws);
      });
      
      // 연결 확인 메시지 전송
      ws.send(JSON.stringify({
        type: 'connection',
        clientId,
        timestamp: new Date().toISOString(),
        availableTopics: this.getAvailableTopics()
      }));
    });
  }

  setupDataSources() {
    // AIRIS APM 시스템 데이터 소스
    this.registerDataSource({
      id: 'airis_apm',
      name: 'AIRIS APM System',
      url: 'http://localhost:3100',
      endpoints: [
        '/api/dashboard/overview',
        '/api/dashboard/realtime',
        '/api/apm/j2ee/metrics'
      ],
      interval: 5000, // 5초
      topic: 'apm'
    });

    // 비즈니스 메트릭 데이터 소스
    this.registerDataSource({
      id: 'business_metrics',
      name: 'Business Metrics API',
      url: 'http://localhost:3200',
      endpoints: [
        '/api/business-metrics/realtime',
        '/api/business-metrics/overview',
        '/api/business-metrics/roi'
      ],
      interval: 10000, // 10초
      topic: 'business'
    });

    // 시스템 메트릭 데이터 소스 (시뮬레이션)
    this.registerDataSource({
      id: 'system_metrics',
      name: 'System Metrics',
      url: null, // 시뮬레이션 데이터
      endpoints: [],
      interval: 2000, // 2초
      topic: 'system'
    });

    // 경고 및 알림 데이터 소스
    this.registerDataSource({
      id: 'alerts',
      name: 'Alert System',
      url: null, // 시뮬레이션 데이터
      endpoints: [],
      interval: 15000, // 15초
      topic: 'alerts'
    });
  }

  registerDataSource(config) {
    const source = {
      ...config,
      status: 'initializing',
      lastUpdate: null,
      errorCount: 0,
      dataPoints: [],
      retryCount: 0,
      maxRetries: 3
    };

    this.dataSources.set(config.id, source);
    
    // 데이터 수집 시작
    this.startDataCollection(config.id);
    
    console.log(`📊 Data source registered: ${config.name} (${config.id})`);
  }

  startDataCollection(sourceId) {
    const source = this.dataSources.get(sourceId);
    if (!source) return;

    const collectData = async () => {
      try {
        let data;
        
        if (source.url) {
          // 외부 API에서 데이터 수집
          data = await this.fetchFromAPI(source);
        } else {
          // 시뮬레이션 데이터 생성
          data = this.generateSimulationData(sourceId);
        }

        if (data) {
          source.status = 'active';
          source.lastUpdate = new Date();
          source.errorCount = 0;
          source.retryCount = 0;

          // 데이터 캐시 업데이트
          this.dataCache.set(sourceId, data);

          // 구독자들에게 브로드캐스트
          this.broadcast(source.topic, {
            type: 'data',
            source: sourceId,
            timestamp: new Date().toISOString(),
            data
          });

          this.emit('data', { sourceId, data });
        }
      } catch (error) {
        console.error(`Data collection error for ${sourceId}:`, error.message);
        source.errorCount++;
        source.retryCount++;
        
        if (source.retryCount >= source.maxRetries) {
          source.status = 'error';
          console.error(`Data source ${sourceId} failed after ${source.maxRetries} retries`);
        }
      }
    };

    // 첫 번째 수집 즉시 실행
    collectData();
    
    // 주기적 수집 설정
    const interval = setInterval(collectData, source.interval);
    this.updateIntervals.set(sourceId, interval);
  }

  async fetchFromAPI(source) {
    const fetch = (await import('node-fetch')).default;
    const results = {};

    for (const endpoint of source.endpoints) {
      try {
        const response = await fetch(`${source.url}${endpoint}`, {
          timeout: 5000
        });
        
        if (response.ok) {
          const data = await response.json();
          results[endpoint] = data;
        }
      } catch (error) {
        console.warn(`Failed to fetch ${source.url}${endpoint}: ${error.message}`);
      }
    }

    return Object.keys(results).length > 0 ? results : null;
  }

  generateSimulationData(sourceId) {
    const timestamp = new Date();
    
    switch (sourceId) {
      case 'system_metrics':
        return {
          cpu: {
            usage: 45 + Math.random() * 30,
            cores: 8,
            temperature: 65 + Math.random() * 15
          },
          memory: {
            used: 6.4 + Math.random() * 2,
            total: 16,
            swap: 0.5 + Math.random() * 0.5
          },
          network: {
            inbound: Math.random() * 100,
            outbound: Math.random() * 50,
            connections: 150 + Math.floor(Math.random() * 100)
          },
          disk: {
            usage: 65 + Math.random() * 10,
            iops: Math.random() * 1000,
            queue: Math.random() * 10
          },
          timestamp: timestamp.toISOString()
        };
        
      case 'alerts':
        const alertTypes = ['performance', 'security', 'business', 'system'];
        const severities = ['info', 'warning', 'error', 'critical'];
        const shouldGenerateAlert = Math.random() < 0.1; // 10% 확률
        
        if (shouldGenerateAlert) {
          return {
            id: `alert_${Date.now()}`,
            type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
            severity: severities[Math.floor(Math.random() * severities.length)],
            title: '시스템 성능 이상 감지',
            message: 'CPU 사용률이 임계치를 초과했습니다',
            timestamp: timestamp.toISOString(),
            source: 'system_monitor',
            resolved: false
          };
        }
        return null;
        
      default:
        return {
          timestamp: timestamp.toISOString(),
          value: Math.random() * 100
        };
    }
  }

  handleClientMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        this.subscribeClient(ws, data.topic);
        break;
        
      case 'unsubscribe':
        this.unsubscribeClient(ws, data.topic);
        break;
        
      case 'get_snapshot':
        const snapshot = this.generateDataSnapshot();
        ws.send(JSON.stringify({
          type: 'snapshot',
          data: snapshot,
          timestamp: new Date().toISOString()
        }));
        break;
        
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
        break;
        
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${data.type}`
        }));
    }
  }

  subscribeClient(ws, topic) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }
    
    const subscribers = this.subscribers.get(topic);
    if (!subscribers.includes(ws)) {
      subscribers.push(ws);
      ws.subscriptions.add(topic);
      
      ws.send(JSON.stringify({
        type: 'subscribed',
        topic,
        timestamp: new Date().toISOString()
      }));
      
      // 최신 데이터 즉시 전송
      const latestData = this.getLatestDataForTopic(topic);
      if (latestData) {
        ws.send(JSON.stringify({
          type: 'data',
          topic,
          data: latestData,
          timestamp: new Date().toISOString()
        }));
      }
      
      console.log(`📡 Client ${ws.clientId} subscribed to ${topic}`);
    }
  }

  unsubscribeClient(ws, topic = null) {
    if (topic) {
      // 특정 토픽에서 구독 해제
      const subscribers = this.subscribers.get(topic);
      if (subscribers) {
        const index = subscribers.indexOf(ws);
        if (index > -1) {
          subscribers.splice(index, 1);
          ws.subscriptions.delete(topic);
        }
      }
    } else {
      // 모든 토픽에서 구독 해제
      ws.subscriptions.forEach(topicName => {
        const subscribers = this.subscribers.get(topicName);
        if (subscribers) {
          const index = subscribers.indexOf(ws);
          if (index > -1) {
            subscribers.splice(index, 1);
          }
        }
      });
      ws.subscriptions.clear();
    }
  }

  broadcast(topic, message) {
    const subscribers = this.subscribers.get(topic);
    if (!subscribers) return;
    
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
        sentCount++;
      }
    });
    
    if (sentCount > 0) {
      console.log(`📡 Broadcasted to ${sentCount} subscribers on topic: ${topic}`);
    }
  }

  generateDataSnapshot() {
    const snapshot = {};
    
    for (const [sourceId, data] of this.dataCache.entries()) {
      const source = this.dataSources.get(sourceId);
      snapshot[sourceId] = {
        name: source.name,
        status: source.status,
        lastUpdate: source.lastUpdate,
        data
      };
    }
    
    return snapshot;
  }

  getLatestDataForTopic(topic) {
    for (const [sourceId, source] of this.dataSources.entries()) {
      if (source.topic === topic) {
        return this.dataCache.get(sourceId);
      }
    }
    return null;
  }

  getAvailableTopics() {
    const topics = new Set();
    this.dataSources.forEach(source => {
      topics.add(source.topic);
    });
    return Array.from(topics);
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`🚀 Realtime Data Hub running on port ${this.port}`);
      console.log(`📡 WebSocket server ready for connections`);
      console.log(`📊 Registered ${this.dataSources.size} data sources`);
      console.log(`🌐 Available topics: ${this.getAvailableTopics().join(', ')}`);
      
      // 상태 정보 주기적 출력
      setInterval(() => {
        console.log(`📊 Status - Connections: ${this.wss.clients.size}, Sources: ${this.dataSources.size}`);
      }, 60000); // 1분마다
    });
  }

  stop() {
    // 모든 인터벌 정리
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals.clear();
    
    // WebSocket 연결 정리
    this.wss.clients.forEach(ws => {
      ws.terminate();
    });
    
    // 서버 종료
    this.server.close(() => {
      console.log('🛑 Realtime Data Hub stopped');
    });
  }
}

// 인스턴스 생성 및 시작
if (require.main === module) {
  const hub = new RealtimeDataHub(3300);
  hub.start();
  
  // 종료 처리
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Realtime Data Hub...');
    hub.stop();
    process.exit(0);
  });
}

module.exports = RealtimeDataHub;