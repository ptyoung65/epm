/**
 * AIRIS EPM Session Replay Manager
 * OpenReplay 통합 관리자 서비스 (간단한 JavaScript 버전)
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// 기본 설정
const config = {
    env: process.env.NODE_ENV || 'production',
    port: parseInt(process.env.PORT || '3004'),
    adminPort: parseInt(process.env.ADMIN_PORT || '3024'),
    host: process.env.HOST || '0.0.0.0',
    
    database: {
        postgres: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/airis_apm',
        redis: process.env.REDIS_URL || 'redis://localhost:6379',
        mongodb: process.env.MONGODB_URL || 'mongodb://localhost:27017/airis-apm',
        clickhouse: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    },
    
    openreplay: {
        projectKey: process.env.OPENREPLAY_PROJECT_KEY || 'airis-epm',
        apiUrl: process.env.OPENREPLAY_API_URL || 'http://openreplay-chalice:8080',
        frontendUrl: process.env.OPENREPLAY_FRONTEND_URL || 'http://openreplay-frontend:8080',
    },
    
    session: {
        secret: process.env.SESSION_SECRET || 'airis-epm-session-secret',
        secureCookies: process.env.NODE_ENV === 'production',
    },
    
    cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : 
               ['http://localhost:3002', 'http://localhost:3024', 'http://localhost:3030'],
    },
};

// 로깅 함수
const log = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
};

class SessionReplayManagerServer {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: config.cors.origin,
                credentials: true,
            },
        });

        // 세션 데이터 저장소 (실제 환경에서는 데이터베이스 사용)
        this.sessions = new Map();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // 보안 헤더 - 테스트 페이지를 위해 CSP 완화
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
                    connectSrc: ["'self'", "ws:", "wss:", "http://localhost:3004", "ws://localhost:3004", "http://localhost:3030", "ws://localhost:3030", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
                },
            },
        }));

        // CORS 설정
        this.app.use(cors({
            origin: config.cors.origin,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        }));

        // 압축
        this.app.use(compression());

        // Body parsing
        this.app.use(express.json({ limit: '100mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '100mb' }));
        this.app.use(cookieParser());

        // 세션 설정
        this.app.use(session({
            secret: config.session.secret,
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: config.session.secureCookies,
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000, // 24시간
            },
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15분
            max: 1000, // 요청 제한
            message: {
                error: 'Too many requests from this IP, please try again later.',
            },
        });
        this.app.use('/api/', limiter);

        // 로깅
        if (config.env !== 'test') {
            this.app.use(morgan('combined'));
        }

        // 정적 파일 서빙
        this.app.use('/static', express.static(path.join(__dirname, 'public')));
        this.app.use('/public', express.static(path.join(__dirname, 'public')));
        
        // 루트 경로에서도 정적 파일 제공 (HTML, JS, CSS 등)
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    setupRoutes() {
        // 헬스 체크
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                service: 'session-replay-manager',
                version: '1.0.0'
            });
        });

        // API 라우트
        this.app.get('/api/sessions', (req, res) => {
            const sessionArray = Array.from(this.sessions.values());
            res.json({ 
                sessions: sessionArray,
                total: sessionArray.length,
                message: 'Session Replay Manager API - Sessions endpoint'
            });
        });

        // 개별 세션 조회 API
        this.app.get('/api/sessions/:sessionId', (req, res) => {
            try {
                const sessionId = req.params.sessionId;
                const sessionData = this.sessions.get(sessionId);
                
                if (sessionData) {
                    res.json(sessionData);
                } else {
                    res.status(404).json({ 
                        error: 'Session not found',
                        sessionId: sessionId
                    });
                }
            } catch (error) {
                log.error(`Error fetching session ${req.params.sessionId}: ${error.message}`);
                res.status(500).json({ 
                    error: error.message
                });
            }
        });

        // POST /api/sessions/events - 이벤트 배치 수신 (다중 페이지 추적용)
        this.app.post('/api/sessions/events', (req, res) => {
            try {
                const { sessionId, events, url, timestamp, unload } = req.body;
                
                if (!sessionId || !events || !Array.isArray(events)) {
                    return res.status(400).json({
                        error: 'Invalid request',
                        message: 'sessionId and events array are required'
                    });
                }

                log.info(`📥 이벤트 배치 수신: ${events.length}개 (세션: ${sessionId})`);
                
                // 기존 세션 찾기 또는 생성
                let session = this.sessions.get(sessionId);
                if (!session) {
                    session = {
                        sessionId: sessionId,
                        createdAt: new Date().toISOString(),
                        rrwebEvents: [],
                        eventCount: 0,
                        url: url,
                        lastActivity: timestamp,
                        pageViews: []
                    };
                }

                // 이벤트 추가
                if (!session.rrwebEvents) {
                    session.rrwebEvents = [];
                }
                session.rrwebEvents.push(...events);
                session.eventCount = session.rrwebEvents.length;
                session.lastActivity = timestamp;

                // 페이지 방문 기록
                if (url && (!session.pageViews || session.pageViews[session.pageViews.length - 1] !== url)) {
                    if (!session.pageViews) session.pageViews = [];
                    session.pageViews.push(url);
                    log.info(`📄 페이지 방문 기록: ${url}`);
                }

                // 페이지 이탈 시 세션 완료 처리
                if (unload) {
                    session.status = 'completed';
                    session.completedAt = timestamp;
                    log.info(`🏁 세션 완료: ${sessionId} (총 ${session.eventCount}개 이벤트, ${session.pageViews ? session.pageViews.length : 1}개 페이지)`);
                }

                // 세션 저장
                this.sessions.set(sessionId, session);

                res.json({
                    success: true,
                    sessionId: sessionId,
                    eventsReceived: events.length,
                    totalEvents: session.eventCount,
                    pageViews: session.pageViews ? session.pageViews.length : 1,
                    message: unload ? 'Session completed' : 'Events received'
                });

            } catch (error) {
                log.error('이벤트 배치 처리 오류:', error);
                res.status(500).json({
                    error: 'Internal server error',
                    message: error.message
                });
            }
        });

        // 세션 저장 API (기존 방식 호환)
        this.app.post('/api/sessions', (req, res) => {
            try {
                const sessionData = req.body;
                sessionData.createdAt = new Date().toISOString();
                this.sessions.set(sessionData.sessionId, sessionData);
                log.info(`Session saved via API: ${sessionData.sessionId}, action: ${sessionData.action}, rrwebEvents: ${sessionData.rrwebEvents ? sessionData.rrwebEvents.length : 0}`);
                res.json({ 
                    success: true,
                    message: 'Session saved successfully',
                    sessionId: sessionData.sessionId
                });
            } catch (error) {
                log.error(`Error saving session: ${error.message}`);
                res.status(500).json({ 
                    success: false,
                    error: error.message
                });
            }
        });

        this.app.get('/api/projects', (req, res) => {
            res.json({ 
                projects: [],
                total: 0,
                message: 'Session Replay Manager API - Projects endpoint'
            });
        });

        this.app.get('/api/openreplay/status', (req, res) => {
            res.json({
                status: 'connected',
                config: {
                    projectKey: config.openreplay.projectKey,
                    apiUrl: config.openreplay.apiUrl,
                    frontendUrl: config.openreplay.frontendUrl,
                },
                message: 'OpenReplay integration status'
            });
        });

        // 세션 리플레이 테스트 페이지
        this.app.get('/test', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'test-session-replay.html'));
        });

        // 간단한 테스트 페이지
        this.app.get('/simple-test', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'simple-test.html'));
        });

        // 디버그 테스트 페이지
        this.app.get('/debug-test', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'debug-test.html'));
        });

        // 세션 리플레이 테스트 페이지 (루트 경로)
        this.app.get('/test-session-replay.html', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'test-session-replay.html'));
        });

        // 세션 플레이어 페이지 (루트 경로)
        this.app.get('/session-player.html', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'session-player.html'));
        });

        // 관리자 대시보드
        this.app.get('/', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>AIRIS EPM Session Replay Manager</title>
                    <style>
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                            max-width: 1200px; 
                            margin: 0 auto; 
                            padding: 2rem;
                            background: #f8fafc;
                        }
                        .header { 
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; 
                            padding: 2rem; 
                            border-radius: 12px; 
                            margin-bottom: 2rem;
                            text-align: center;
                        }
                        .card { 
                            background: white; 
                            padding: 1.5rem; 
                            border-radius: 12px; 
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
                            margin-bottom: 1rem;
                        }
                        .status { 
                            display: inline-block; 
                            background: #10b981; 
                            color: white; 
                            padding: 0.5rem 1rem; 
                            border-radius: 20px; 
                            font-size: 0.875rem;
                            font-weight: 600;
                        }
                        .endpoints { 
                            display: grid; 
                            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
                            gap: 1rem; 
                            margin-top: 1rem;
                        }
                        .endpoint { 
                            background: #f1f5f9; 
                            padding: 1rem; 
                            border-radius: 8px; 
                            border-left: 4px solid #3b82f6;
                        }
                        .endpoint a { 
                            color: #3b82f6; 
                            text-decoration: none; 
                            font-weight: 600;
                        }
                        .endpoint a:hover { 
                            text-decoration: underline; 
                        }
                        .version { 
                            color: #64748b; 
                            font-size: 0.875rem; 
                            margin-top: 1rem;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>🎬 AIRIS EPM Session Replay Manager</h1>
                        <p>OpenReplay 통합 관리자 서비스</p>
                        <span class="status">✅ 서비스 정상 작동 중</span>
                    </div>

                    <div class="card">
                        <h2>📊 시스템 정보</h2>
                        <p><strong>포트:</strong> ${config.port}</p>
                        <p><strong>관리자 포트:</strong> ${config.adminPort}</p>
                        <p><strong>환경:</strong> ${config.env}</p>
                        <p><strong>OpenReplay 프로젝트:</strong> ${config.openreplay.projectKey}</p>
                        <div class="version">서비스 버전: 1.0.0 | 빌드 시간: ${new Date().toISOString()}</div>
                    </div>

                    <div class="card">
                        <h2>🔗 API 엔드포인트</h2>
                        <div class="endpoints">
                            <div class="endpoint">
                                <strong><a href="/health">GET /health</a></strong>
                                <p>서비스 상태 확인</p>
                            </div>
                            <div class="endpoint">
                                <strong><a href="/api/sessions">GET /api/sessions</a></strong>
                                <p>세션 데이터 조회</p>
                            </div>
                            <div class="endpoint">
                                <strong><a href="/api/projects">GET /api/projects</a></strong>
                                <p>프로젝트 목록 조회</p>
                            </div>
                            <div class="endpoint">
                                <strong><a href="/api/openreplay/status">GET /api/openreplay/status</a></strong>
                                <p>OpenReplay 연결 상태</p>
                            </div>
                            <div class="endpoint">
                                <strong><a href="/test">🧪 세션 리플레이 테스트</a></strong>
                                <p>세션 기록 및 재생 테스트 페이지</p>
                            </div>
                            <div class="endpoint">
                                <strong><a href="/debug-test">🔧 디버그 테스트</a></strong>
                                <p>간단한 버튼 기능 테스트</p>
                            </div>
                            <div class="endpoint">
                                <strong><a href="/simple-test">⚡ 간단 테스트</a></strong>
                                <p>기본 JavaScript 및 Socket.IO 테스트</p>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <h2>🌐 외부 서비스 연결</h2>
                        <div class="endpoints">
                            <div class="endpoint">
                                <strong><a href="${config.openreplay.frontendUrl}" target="_blank">OpenReplay Frontend</a></strong>
                                <p>OpenReplay 웹 인터페이스</p>
                            </div>
                            <div class="endpoint">
                                <strong><a href="http://localhost:3002" target="_blank">AIRIS EPM Dashboard</a></strong>
                                <p>메인 APM 대시보드</p>
                            </div>
                            <div class="endpoint">
                                <strong><a href="http://localhost:9001" target="_blank">MinIO Console</a></strong>
                                <p>저장소 관리 콘솔</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `);
        });

        // 404 처리
        this.app.use((req, res) => {
            if (req.path.startsWith('/api/')) {
                res.status(404).json({ error: 'API endpoint not found' });
            } else {
                res.status(404).send(`
                    <!DOCTYPE html>
                    <html lang="ko">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Page Not Found - AIRIS EPM</title>
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 2rem; background: #f8fafc; }
                            .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                            h1 { color: #e53e3e; margin-bottom: 1rem; }
                            p { color: #64748b; margin-bottom: 1rem; }
                            a { color: #3b82f6; text-decoration: none; font-weight: 600; }
                            a:hover { text-decoration: underline; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>🔍 페이지를 찾을 수 없습니다</h1>
                            <p>요청하신 페이지 <strong>${req.path}</strong>를 찾을 수 없습니다.</p>
                            <p><a href="/">🏠 메인 대시보드로 돌아가기</a></p>
                            <p><a href="/test">🧪 세션 리플레이 테스트</a></p>
                        </div>
                    </body>
                    </html>
                `);
            }
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            log.info(`WebSocket client connected: ${socket.id}`);

            socket.on('disconnect', () => {
                log.info(`WebSocket client disconnected: ${socket.id}`);
            });

            // 세션 관련 이벤트
            socket.on('join_session', (sessionId) => {
                socket.join(`session_${sessionId}`);
                log.info(`Client ${socket.id} joined session ${sessionId}`);
            });

            socket.on('leave_session', (sessionId) => {
                socket.leave(`session_${sessionId}`);
                log.info(`Client ${socket.id} left session ${sessionId}`);
            });

            // 세션 시작 이벤트
            socket.on('session_start', (data) => {
                log.info(`Session started: ${data.sessionId}`);
                socket.to(`session_${data.sessionId}`).emit('session_started', data);
            });

            // 세션 중지 이벤트 - 세션 데이터 저장
            socket.on('session_stop', (data) => {
                try {
                    // 세션 데이터 저장
                    const sessionData = {
                        id: data.sessionId,
                        sessionId: data.sessionId,
                        action: data.action || 'stop',
                        startTime: data.startTime,
                        endTime: new Date().toISOString(),
                        duration: data.duration || 0,
                        eventCount: data.eventCount || 0,
                        interactionCount: data.interactionCount || 0,
                        userAgent: data.userAgent || '',
                        url: data.url || '',
                        viewport: data.viewport || {},
                        timestamp: data.timestamp || new Date().toISOString(),
                        rrwebEvents: data.rrwebEvents || [], // rrweb 이벤트 포함!
                        createdAt: new Date().toISOString()
                    };
                    
                    this.sessions.set(data.sessionId, sessionData);
                    log.info(`Session stopped and saved: ${data.sessionId}, duration: ${data.duration}s, events: ${data.eventCount}, rrwebEvents: ${data.rrwebEvents ? data.rrwebEvents.length : 0}`);
                    
                    // 클라이언트에 확인 응답
                    socket.emit('session_saved', { 
                        sessionId: data.sessionId,
                        success: true,
                        message: 'Session saved successfully'
                    });
                    
                    // 방의 다른 클라이언트들에게 알림
                    socket.to(`session_${data.sessionId}`).emit('session_stopped', sessionData);
                } catch (error) {
                    log.error(`Error saving session ${data.sessionId}: ${error.message}`);
                    socket.emit('session_save_error', {
                        sessionId: data.sessionId,
                        error: error.message
                    });
                }
            });
        });

        log.info('WebSocket manager initialized');
    }

    setupErrorHandling() {
        this.app.use((error, req, res, next) => {
            log.error(`Express error: ${error.message}`);
            res.status(500).json({
                error: 'Internal server error',
                message: config.env === 'development' ? error.message : 'Something went wrong'
            });
        });

        // Graceful shutdown
        process.on('SIGTERM', this.shutdown.bind(this));
        process.on('SIGINT', this.shutdown.bind(this));
        process.on('uncaughtException', (error) => {
            log.error(`Uncaught Exception: ${error.message}`);
            this.shutdown();
        });
        process.on('unhandledRejection', (reason, promise) => {
            log.error(`Unhandled Rejection: ${reason}`);
            this.shutdown();
        });
    }

    async start() {
        try {
            // 메인 서버 시작
            this.server.listen(config.port, config.host, () => {
                log.info(`🚀 Session Replay Manager running on http://${config.host}:${config.port}`);
                log.info(`📊 Dashboard: http://${config.host}:${config.port}`);
                log.info(`🎮 WebSocket: ws://${config.host}:${config.port}`);
                log.info(`📈 Environment: ${config.env}`);
                log.info(`🔒 Security: ${config.session.secureCookies ? 'HTTPS' : 'HTTP'}`);
            });

        } catch (error) {
            log.error(`Failed to start server: ${error.message}`);
            process.exit(1);
        }
    }

    async shutdown() {
        log.info('Shutting down server gracefully...');

        try {
            this.server.close(() => {
                log.info('HTTP server closed');
                this.io.close();
                log.info('WebSocket connections closed');
                log.info('Server shutdown complete');
                process.exit(0);
            });

            // 강제 종료 타이머 (30초)
            setTimeout(() => {
                log.warn('Forced shutdown after timeout');
                process.exit(1);
            }, 30000);

        } catch (error) {
            log.error(`Error during shutdown: ${error.message}`);
            process.exit(1);
        }
    }
}

// 서버 인스턴스 생성 및 시작
const server = new SessionReplayManagerServer();

if (require.main === module) {
    server.start().catch((error) => {
        console.error('Failed to start application:', error);
        process.exit(1);
    });
}

module.exports = server;