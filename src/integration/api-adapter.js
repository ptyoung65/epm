#!/usr/bin/env node

/**
 * AIRIS EPM-APM Integration API Adapter
 * Bridges the React EPM Dashboard with existing AIRIS APM System
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');

class EPMAPMAdapter {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3100;
    
    // AIRIS APM System endpoints
    this.apmGateway = 'http://localhost:3000';
    this.apmServices = {
      aiops: 'http://localhost:3004',
      eventDelta: 'http://localhost:3005', 
      nlpSearch: 'http://localhost:3006',
      dataIngestion: 'http://localhost:3007'
    };
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    // CORS for React frontend
    this.app.use(cors({
      origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
      credentials: true
    }));
    
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }
  
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        service: 'EPM-APM Integration Adapter',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });
    });
    
    // Dashboard data endpoints for React EPM
    this.app.get('/api/dashboard/overview', this.getDashboardOverview.bind(this));
    this.app.get('/api/dashboard/realtime', this.getRealtimeData.bind(this));
    this.app.get('/api/dashboard/performance', this.getPerformanceMetrics.bind(this));
    
    // APM specific endpoints
    this.app.get('/api/apm/j2ee/metrics', this.getJ2EEMetrics.bind(this));
    this.app.get('/api/apm/was/status', this.getWASStatus.bind(this));
    this.app.get('/api/apm/exceptions', this.getExceptions.bind(this));
    this.app.get('/api/apm/topology', this.getServiceTopology.bind(this));
    this.app.get('/api/apm/alerts', this.getAlerts.bind(this));
    
    // Authentication endpoints
    this.app.post('/api/auth/login', this.handleLogin.bind(this));
    this.app.get('/api/auth/user', this.getCurrentUser.bind(this));
    
    // Proxy for direct APM access
    this.app.use('/api/apm-proxy', createProxyMiddleware({
      target: this.apmGateway,
      changeOrigin: true,
      pathRewrite: {
        '^/api/apm-proxy': '/api/v1'
      }
    }));
  }
  
  async getDashboardOverview(req, res) {
    try {
      // Get data from APM system
      const [statusRes, healthRes] = await Promise.all([
        axios.get(`${this.apmGateway}/api/v1/status`),
        axios.get(`${this.apmGateway}/health`)
      ]);
      
      const status = statusRes.data;
      
      // Transform to React EPM format
      const overview = {
        system: {
          status: status.system,
          completion: status.completion,
          uptime: '24시간+',
          korean_time: status.korean_time
        },
        services: {
          total: Object.keys(status.services).length,
          healthy: Object.values(status.services).filter(s => s.includes('✅')).length,
          unhealthy: Object.values(status.services).filter(s => s.includes('❌')).length,
          details: status.services
        },
        metrics: {
          total_events: 15420,
          avg_response_time: '89ms',
          error_rate: '0.02%',
          throughput: '1,234 req/min'
        }
      };
      
      res.json({
        success: true,
        data: overview,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Dashboard overview error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard overview',
        message: error.message
      });
    }
  }
  
  async getRealtimeData(req, res) {
    try {
      // Simulate real-time data - in production, this would come from WebSocket or streaming API
      const realtimeData = {
        timestamp: new Date().toISOString(),
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit', 
          second: '2-digit'
        }).format(new Date()),
        metrics: [
          { name: 'CPU Usage', value: Math.floor(Math.random() * 100), unit: '%' },
          { name: 'Memory Usage', value: Math.floor(Math.random() * 100), unit: '%' },
          { name: 'Response Time', value: Math.floor(Math.random() * 500), unit: 'ms' },
          { name: 'Throughput', value: Math.floor(Math.random() * 2000), unit: 'req/min' },
          { name: 'Error Rate', value: (Math.random() * 0.1).toFixed(3), unit: '%' }
        ]
      };
      
      res.json({
        success: true,
        data: realtimeData
      });
      
    } catch (error) {
      console.error('Realtime data error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch realtime data',
        message: error.message
      });
    }
  }
  
  async getPerformanceMetrics(req, res) {
    try {
      const { timeRange = '1h' } = req.query;
      
      // Generate sample performance data
      const performance = {
        timeRange,
        data: Array.from({ length: 24 }, (_, i) => ({
          time: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
          cpu: Math.floor(Math.random() * 100),
          memory: Math.floor(Math.random() * 100),
          responseTime: Math.floor(Math.random() * 500),
          throughput: Math.floor(Math.random() * 2000)
        }))
      };
      
      res.json({
        success: true,
        data: performance
      });
      
    } catch (error) {
      console.error('Performance metrics error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance metrics',
        message: error.message
      });
    }
  }
  
  async getJ2EEMetrics(req, res) {
    try {
      // Sample J2EE metrics - would be fetched from actual j2ee-monitor service
      const j2eeData = {
        servlets: [
          { name: 'UserServlet', requests: 1234, avgResponseTime: 45, errors: 2 },
          { name: 'DataServlet', requests: 856, avgResponseTime: 67, errors: 0 },
          { name: 'AuthServlet', requests: 2341, avgResponseTime: 23, errors: 1 }
        ],
        jsps: [
          { name: 'dashboard.jsp', requests: 567, avgResponseTime: 89, errors: 0 },
          { name: 'report.jsp', requests: 234, avgResponseTime: 123, errors: 1 }
        ],
        ejbs: [
          { name: 'UserSessionBean', calls: 456, avgResponseTime: 34, errors: 0 },
          { name: 'DataEntityBean', calls: 789, avgResponseTime: 56, errors: 2 }
        ]
      };
      
      res.json({
        success: true,
        data: j2eeData
      });
      
    } catch (error) {
      console.error('J2EE metrics error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch J2EE metrics',
        message: error.message
      });
    }
  }
  
  async getWASStatus(req, res) {
    try {
      // Sample WAS status - would be fetched from actual was-monitor service  
      const wasData = {
        servers: [
          {
            name: 'Tomcat-01',
            status: 'healthy',
            jvm: { heap: 45, nonHeap: 23, threads: 34 },
            threadPools: { active: 12, idle: 88, max: 100 }
          },
          {
            name: 'WebLogic-01', 
            status: 'healthy',
            jvm: { heap: 67, nonHeap: 34, threads: 45 },
            threadPools: { active: 23, idle: 77, max: 100 }
          }
        ]
      };
      
      res.json({
        success: true,
        data: wasData
      });
      
    } catch (error) {
      console.error('WAS status error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch WAS status',
        message: error.message
      });
    }
  }
  
  async getExceptions(req, res) {
    try {
      // Sample exception data
      const exceptions = {
        summary: {
          total: 45,
          critical: 3,
          high: 12,
          medium: 20,
          low: 10
        },
        recent: [
          {
            id: 1,
            timestamp: new Date().toISOString(),
            severity: 'critical',
            message: 'Database connection timeout',
            service: 'UserService',
            count: 5
          },
          {
            id: 2,
            timestamp: new Date(Date.now() - 300000).toISOString(),
            severity: 'high',
            message: 'Authentication failed',
            service: 'AuthService',
            count: 12
          }
        ]
      };
      
      res.json({
        success: true,
        data: exceptions
      });
      
    } catch (error) {
      console.error('Exceptions error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch exceptions',
        message: error.message
      });
    }
  }
  
  async getServiceTopology(req, res) {
    try {
      // Sample service topology
      const topology = {
        nodes: [
          { id: 'web', name: 'Web Server', type: 'web', status: 'healthy' },
          { id: 'app', name: 'App Server', type: 'application', status: 'healthy' },
          { id: 'db', name: 'Database', type: 'database', status: 'healthy' },
          { id: 'cache', name: 'Redis Cache', type: 'cache', status: 'healthy' }
        ],
        edges: [
          { from: 'web', to: 'app', status: 'healthy', latency: 23 },
          { from: 'app', to: 'db', status: 'healthy', latency: 45 },
          { from: 'app', to: 'cache', status: 'healthy', latency: 12 }
        ]
      };
      
      res.json({
        success: true,
        data: topology
      });
      
    } catch (error) {
      console.error('Service topology error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch service topology',
        message: error.message
      });
    }
  }
  
  async getAlerts(req, res) {
    try {
      // Sample alerts data
      const alerts = {
        active: [
          {
            id: 1,
            timestamp: new Date().toISOString(),
            severity: 'critical',
            title: 'High CPU Usage',
            message: 'CPU usage exceeded 90% for 5 minutes',
            service: 'app-server-01'
          },
          {
            id: 2,
            timestamp: new Date(Date.now() - 600000).toISOString(),
            severity: 'warning',
            title: 'Memory Usage High',
            message: 'Memory usage at 85%',
            service: 'database-01'
          }
        ],
        resolved: [
          {
            id: 3,
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            severity: 'info',
            title: 'Service Restarted',
            message: 'Cache service successfully restarted',
            service: 'redis-cache'
          }
        ]
      };
      
      res.json({
        success: true,
        data: alerts
      });
      
    } catch (error) {
      console.error('Alerts error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alerts',
        message: error.message
      });
    }
  }
  
  async handleLogin(req, res) {
    try {
      const { username, password } = req.body;
      
      // Simple authentication - in production, integrate with actual auth service
      if (username && password) {
        const user = {
          id: 1,
          username,
          name: '관리자',
          role: 'admin',
          permissions: ['dashboard', 'apm', 'analytics', 'settings']
        };
        
        res.json({
          success: true,
          token: 'mock-jwt-token',
          user
        });
      } else {
        res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }
      
    } catch (error) {
      console.error('Login error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        message: error.message
      });
    }
  }
  
  async getCurrentUser(req, res) {
    try {
      // Mock current user - in production, validate JWT token
      const user = {
        id: 1,
        username: 'admin',
        name: '시스템 관리자',
        role: 'admin',
        permissions: ['dashboard', 'apm', 'analytics', 'settings']
      };
      
      res.json({
        success: true,
        user
      });
      
    } catch (error) {
      console.error('Get user error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to get user',
        message: error.message
      });
    }
  }
  
  start() {
    this.app.listen(this.port, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║            🔗 EPM-APM Integration Adapter                ║
╠══════════════════════════════════════════════════════════╣
║  🌐 Integration API: http://localhost:${this.port}                  ║
║  🔌 APM Gateway: ${this.apmGateway}                       ║
║  📊 Status: Ready for React EPM Dashboard               ║
║                                                          ║
║  🚀 Ready to bridge React EPM ↔ AIRIS APM System        ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  }
}

// Start the adapter
if (require.main === module) {
  const adapter = new EPMAPMAdapter();
  adapter.start();
}

module.exports = EPMAPMAdapter;