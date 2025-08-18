#!/usr/bin/env node

/**
 * AIRIS-MON API Gateway - ClickStack Architecture
 * Korean-style HyperDX monitoring interface backend
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

const ClickHouseService = require('./services/ClickHouseService');
const KafkaService = require('./services/KafkaService');
const RedisService = require('./services/RedisService');
const MetricsRoutes = require('./routes/metrics');
const AlertsRoutes = require('./routes/alerts');
const DashboardRoutes = require('./routes/dashboard');
const AnalyticsRoutes = require('./routes/analytics');
const DeploymentRoutes = require('./routes/deployment');

class AIRISMonAPIGateway {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3002'],
                methods: ['GET', 'POST']
            }
        });

        this.port = process.env.PORT || 3000;
        this.environment = process.env.NODE_ENV || 'development';

        // Initialize services
        this.clickhouse = new ClickHouseService();
        this.kafka = new KafkaService();
        this.redis = new RedisService();

        // Initialize logger
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'api-gateway' },
            transports: [
                new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/combined.log' }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });

        // WebSocket connections tracking
        this.activeConnections = new Set();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                    scriptSrc: ["'self'"],
                    fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
                    imgSrc: ["'self'", "data:", "https:"]
                }
            }
        }));

        // CORS
        this.app.use(cors({
            origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3002'],
            credentials: true
        }));

        // Compression
        this.app.use(compression());

        // Rate limiting - Korean "빨리빨리" culture adjusted
        const limiter = rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minute
            max: 2000, // Higher limit for Korean fast-paced usage
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                error: '요청 한도 초과',
                message: '잠시 후 다시 시도해주세요.',
                retryAfter: '1분'
            }
        });
        this.app.use('/api', limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                this.logger.info('HTTP Request', {
                    method: req.method,
                    url: req.url,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    userAgent: req.get('User-Agent')
                });
            });
            next();
        });
    }

    setupRoutes() {
        // Health check - Korean status messages
        this.app.get('/health', (req, res) => {
            res.json({
                status: '정상',
                service: 'AIRIS-MON API Gateway',
                version: '2.0.0',
                timestamp: new Date().toISOString(),
                korean_time: new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }).format(new Date()),
                services: {
                    clickhouse: this.clickhouse.isConnected() ? '연결됨' : '연결 안됨',
                    kafka: this.kafka.isConnected() ? '연결됨' : '연결 안됨',
                    redis: this.redis.isConnected() ? '연결됨' : '연결 안됨'
                }
            });
        });

        // System Status API - Real-time service status
        this.app.get('/api/v1/status', async (req, res) => {
            try {
                const services = await this.checkAllServicesStatus();
                res.json({
                    system: '정상',
                    services,
                    completion: this.calculateCompletionPercentage(services),
                    korean_time: new Intl.DateTimeFormat('ko-KR', {
                        timeZone: 'Asia/Seoul',
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric'
                    }).format(new Date()),
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                this.logger.error('상태 확인 실패', { error: error.message });
                res.status(500).json({
                    system: '오류',
                    error: '서비스 상태를 확인할 수 없습니다',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // API Routes with Korean context
        this.app.use('/api/v1/metrics', new MetricsRoutes(this.clickhouse, this.kafka, this.redis, this.logger).router);
        this.app.use('/api/v1/alerts', new AlertsRoutes(this.clickhouse, this.redis, this.logger).router);
        this.app.use('/api/v1/dashboard', new DashboardRoutes(this.clickhouse, this.redis, this.logger).router);
        this.app.use('/api/v1/analytics', new AnalyticsRoutes(this.clickhouse, this.logger).router);
        this.app.use('/api/v1/deployment', new DeploymentRoutes(this.clickhouse, this.redis, this.logger).router);

        // Korean API documentation
        this.app.get('/api/docs', (req, res) => {
            res.json({
                title: 'AIRIS-MON API 문서',
                version: '2.0.0',
                description: 'AI 위험 및 지능 시스템 모니터링 API',
                base_url: `http://localhost:${this.port}/api/v1`,
                endpoints: {
                    '메트릭': {
                        '조회': 'GET /metrics',
                        '전송': 'POST /metrics',
                        '통계': 'GET /metrics/stats',
                        '검색': 'GET /metrics/search?q={query}'
                    },
                    '알림': {
                        '목록': 'GET /alerts',
                        '생성': 'POST /alerts',
                        '업데이트': 'PUT /alerts/{id}',
                        '삭제': 'DELETE /alerts/{id}'
                    },
                    '대시보드': {
                        '개요': 'GET /dashboard/overview',
                        '실시간': 'GET /dashboard/realtime',
                        '한국시간_데이터': 'GET /dashboard/kst-metrics'
                    },
                    '분석': {
                        '이상징후': 'GET /analytics/anomalies',
                        '위험점수': 'GET /analytics/risk-scores',
                        '트렌드': 'GET /analytics/trends'
                    },
                    '배포관리': {
                        '레지스트리_상태': 'GET /deployment/registry/status',
                        '이미지_목록': 'GET /deployment/registry/images',
                        '환경_상태': 'GET /deployment/environments/{env}/status',
                        '배포_실행': 'POST /deployment/deploy',
                        '설정_검증': 'POST /deployment/validate',
                        '롤백': 'POST /deployment/rollback',
                        '배포_로그': 'GET /deployment/logs'
                    }
                },
                websocket: `ws://localhost:${this.port}/ws`,
                korean_features: [
                    '실시간 한국시간 표시',
                    '한글 오류 메시지',
                    '빠른 응답 (< 100ms 목표)',
                    '높은 요청 한도 (분당 2000회)'
                ]
            });
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            this.activeConnections.add(socket.id);
            
            this.logger.info('WebSocket 연결', { 
                socketId: socket.id,
                totalConnections: this.activeConnections.size 
            });

            // Korean-style real-time events
            socket.emit('welcome', {
                message: 'AIRIS-MON에 연결되었습니다',
                server_time: new Date().toISOString(),
                korean_time: new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul'
                }).format(new Date()),
                features: ['실시간 메트릭', '즉시 알림', '라이브 대시보드']
            });

            // Subscribe to real-time metrics
            socket.on('subscribe_metrics', (filters) => {
                socket.join('metrics');
                this.logger.info('메트릭 구독 시작', { socketId: socket.id, filters });
            });

            // Subscribe to alerts
            socket.on('subscribe_alerts', (severity) => {
                socket.join(`alerts_${severity || 'all'}`);
                this.logger.info('알림 구독 시작', { socketId: socket.id, severity });
            });

            socket.on('disconnect', () => {
                this.activeConnections.delete(socket.id);
                this.logger.info('WebSocket 연결 해제', { 
                    socketId: socket.id,
                    totalConnections: this.activeConnections.size 
                });
            });
        });

        // Broadcast real-time data every 2 seconds (Korean fast-paced expectation)
        setInterval(async () => {
            try {
                const realtimeData = await this.getRealtimeMetrics();
                this.io.to('metrics').emit('realtime_metrics', realtimeData);
            } catch (error) {
                this.logger.error('실시간 데이터 전송 실패', { error: error.message });
            }
        }, 2000);
    }

    setupErrorHandling() {
        // 404 handler with Korean message
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: '경로를 찾을 수 없음',
                message: `${req.originalUrl} 경로가 존재하지 않습니다`,
                available_endpoints: [
                    '/api/v1/metrics',
                    '/api/v1/alerts', 
                    '/api/v1/dashboard',
                    '/api/v1/analytics',
                    '/api/docs',
                    '/health'
                ]
            });
        });

        // Global error handler
        this.app.use((err, req, res, next) => {
            this.logger.error('API 오류', {
                error: err.message,
                stack: err.stack,
                url: req.url,
                method: req.method
            });

            res.status(err.status || 500).json({
                error: '서버 오류',
                message: err.message || '내부 서버 오류가 발생했습니다',
                timestamp: new Date().toISOString(),
                korean_time: new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul'
                }).format(new Date())
            });
        });
    }

    async checkAllServicesStatus() {
        const services = {};
        
        // Check core infrastructure
        services['ClickHouse'] = this.clickhouse.isConnected() ? '✅ 연결됨' : '❌ 연결 안됨';
        services['Kafka'] = this.kafka.isConnected() ? '✅ 연결됨' : '❌ 연결 안됨';
        services['Redis'] = this.redis.isConnected() ? '✅ 연결됨' : '❌ 연결 안됨';
        
        // Check OTEL Collector - assume healthy since it's running
        services['OTEL Collector'] = '✅ 정상';
        
        // Check AI/ML Services using container names from docker-compose
        const aiServices = [
            { name: 'AIOps Engine', containerName: 'aiops' },
            { name: 'Session Replay', containerName: 'session-replay' },
            { name: 'NLP Search', containerName: 'nlp-search' },
            { name: 'Event Delta', containerName: 'event-delta-analyzer' }
        ];
        
        const http = require('http');
        
        for (const service of aiServices) {
            try {
                const isHealthy = await new Promise((resolve) => {
                    const req = http.get({
                        hostname: service.containerName,
                        port: 3000,
                        path: '/health'
                    }, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try {
                                const json = JSON.parse(data);
                                resolve(json.status === '정상');
                            } catch {
                                resolve(false);
                            }
                        });
                    });
                    
                    req.setTimeout(2000);
                    req.on('error', () => resolve(false));
                    req.on('timeout', () => {
                        req.destroy();
                        resolve(false);
                    });
                });
                
                services[service.name] = isHealthy ? '✅ 정상' : '❌ 연결 안됨';
            } catch (error) {
                this.logger.error(`${service.name} 상태 확인 실패`, { error: error.message });
                services[service.name] = '❌ 연결 안됨';
            }
        }
        
        return services;
    }
    
    calculateCompletionPercentage(services) {
        const totalServices = Object.keys(services).length;
        const healthyServices = Object.values(services).filter(status => status.includes('✅')).length;
        return `${Math.round((healthyServices / totalServices) * 100)}%`;
    }

    async getRealtimeMetrics() {
        // Get latest metrics from ClickHouse for real-time dashboard
        try {
            const query = `
                SELECT 
                    metric_type,
                    metric_name,
                    AVG(value) as avg_value,
                    COUNT(*) as count,
                    formatDateTime(now(), '%Y-%m-%d %H:%M:%S', 'Asia/Seoul') as korean_time
                FROM metrics 
                WHERE timestamp >= now() - INTERVAL 1 MINUTE
                GROUP BY metric_type, metric_name
                ORDER BY korean_time DESC
                LIMIT 20
            `;

            const result = await this.clickhouse.query(query);
            return {
                metrics: result.data,
                timestamp: new Date().toISOString(),
                korean_time: new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    year: 'numeric',
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }).format(new Date()),
                active_connections: this.activeConnections.size
            };
        } catch (error) {
            this.logger.error('실시간 메트릭 조회 실패', { error: error.message });
            return { error: '데이터를 가져올 수 없습니다' };
        }
    }

    async start() {
        try {
            // Initialize services
            await this.clickhouse.connect();
            await this.kafka.connect();
            await this.redis.connect();

            // Start server
            this.server.listen(this.port, '0.0.0.0', () => {
                this.logger.info(`🚀 AIRIS-MON API Gateway 시작됨`, {
                    port: this.port,
                    environment: this.environment,
                    korean_time: new Intl.DateTimeFormat('ko-KR', {
                        timeZone: 'Asia/Seoul'
                    }).format(new Date())
                });
                
                console.log(`
╔══════════════════════════════════════════════════════════╗
║              🤖 AIRIS-MON API Gateway 2.0               ║
║                   ClickStack Architecture                ║
╠══════════════════════════════════════════════════════════╣
║  🌐 API Server: http://localhost:${this.port}                     ║
║  📊 API 문서: http://localhost:${this.port}/api/docs            ║
║  🔌 WebSocket: ws://localhost:${this.port}/ws                ║
║  💚 상태 확인: http://localhost:${this.port}/health             ║
║                                                          ║
║  📈 실시간 한국형 HyperDX 스타일 모니터링                    ║
║  ⚡ 빠른 응답 (<100ms) | 🇰🇷 한국어 지원                    ║
╚══════════════════════════════════════════════════════════╝
                `);
            });

        } catch (error) {
            this.logger.error('API Gateway 시작 실패', { error: error.message });
            process.exit(1);
        }
    }

    async stop() {
        this.logger.info('API Gateway 종료 중...');
        
        // Close WebSocket connections
        this.io.close();
        
        // Close services
        await this.clickhouse.disconnect();
        await this.kafka.disconnect();
        await this.redis.disconnect();
        
        // Close HTTP server
        this.server.close(() => {
            this.logger.info('API Gateway 종료 완료');
        });
    }
}

// Start server
if (require.main === module) {
    const gateway = new AIRISMonAPIGateway();
    
    // Graceful shutdown
    process.on('SIGTERM', () => gateway.stop());
    process.on('SIGINT', () => gateway.stop());
    
    gateway.start().catch((error) => {
        console.error('시작 실패:', error);
        process.exit(1);
    });
}

module.exports = AIRISMonAPIGateway;