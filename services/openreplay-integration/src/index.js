const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// 환경 설정
const config = {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    postgres: {
        url: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/airis_apm'
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    },
    minio: {
        endpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        bucketName: process.env.MINIO_BUCKET_NAME || 'openreplay-sessions',
        useSSL: process.env.MINIO_USE_SSL === 'true'
    }
};

// 로깅 유틸리티
const log = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
};

class OpenReplayIntegrationServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        // 세션 저장소
        this.sessions = new Map();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // 보안 헤더
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
                    connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
                },
            },
        }));

        // CORS 설정
        this.app.use(cors({
            origin: "*",
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        }));

        // 압축 및 파싱
        this.app.use(compression());
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // 정적 파일 제공
        this.app.use('/static', express.static(path.join(__dirname, 'public')));
    }

    setupRoutes() {
        // 헬스 체크
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                service: 'openreplay-integration',
                version: '1.0.0'
            });
        });

        // 세션 목록 조회
        this.app.get('/api/sessions', (req, res) => {
            const sessionArray = Array.from(this.sessions.values());
            res.json({ 
                sessions: sessionArray,
                total: sessionArray.length,
                message: 'OpenReplay Integration - Sessions endpoint'
            });
        });

        // 특정 세션 조회
        this.app.get('/api/sessions/:id', (req, res) => {
            const sessionId = req.params.id;
            const session = this.sessions.get(sessionId);
            
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }
            
            res.json(session);
        });

        // 세션 저장
        this.app.post('/api/sessions', (req, res) => {
            try {
                const sessionData = req.body;
                const sessionId = sessionData.sessionId || uuidv4();
                
                const session = {
                    id: sessionId,
                    sessionId: sessionId,
                    events: sessionData.events || [],
                    startTime: sessionData.startTime || new Date().toISOString(),
                    endTime: sessionData.endTime,
                    duration: sessionData.duration || 0,
                    eventCount: sessionData.eventCount || (sessionData.events ? sessionData.events.length : 0),
                    userAgent: sessionData.userAgent,
                    url: sessionData.url,
                    viewport: sessionData.viewport,
                    createdAt: new Date().toISOString(),
                    status: 'recorded'
                };
                
                this.sessions.set(sessionId, session);
                log.info(`Session saved: ${sessionId}, events: ${session.eventCount}`);
                
                res.json({ 
                    success: true,
                    sessionId: sessionId,
                    message: 'Session saved successfully'
                });
            } catch (error) {
                log.error(`Error saving session: ${error.message}`);
                res.status(500).json({ 
                    success: false,
                    error: error.message
                });
            }
        });

        // OpenReplay 플레이어 페이지
        this.app.get('/player/:sessionId?', (req, res) => {
            const sessionId = req.params.sessionId;
            res.send(this.generatePlayerHTML(sessionId));
        });

        // 메인 대시보드
        this.app.get('/', (req, res) => {
            res.send(this.generateDashboardHTML());
        });

        // 404 처리
        this.app.use((req, res) => {
            if (req.path.startsWith('/api/')) {
                res.status(404).json({ error: 'API endpoint not found' });
            } else {
                res.status(404).send(this.generate404HTML(req.path));
            }
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            log.info(`WebSocket client connected: ${socket.id}`);

            socket.on('disconnect', () => {
                log.info(`WebSocket client disconnected: ${socket.id}`);
            });

            // 세션 이벤트 수신
            socket.on('session_events', (data) => {
                try {
                    const { sessionId, events } = data;
                    let session = this.sessions.get(sessionId);
                    
                    if (!session) {
                        session = {
                            id: sessionId,
                            sessionId: sessionId,
                            events: [],
                            startTime: new Date().toISOString(),
                            createdAt: new Date().toISOString(),
                            status: 'recording'
                        };
                        this.sessions.set(sessionId, session);
                    }
                    
                    // 이벤트 추가
                    if (Array.isArray(events)) {
                        session.events.push(...events);
                        session.eventCount = session.events.length;
                        session.lastUpdated = new Date().toISOString();
                    }
                    
                    log.info(`Session ${sessionId} updated: ${session.eventCount} events`);
                    socket.emit('session_events_ack', { sessionId, eventCount: session.eventCount });
                } catch (error) {
                    log.error(`Error processing session events: ${error.message}`);
                    socket.emit('session_events_error', { error: error.message });
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
    }

    generatePlayerHTML(sessionId) {
        return `
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>OpenReplay Player - AIRIS EPM</title>
                <script src="https://cdn.jsdelivr.net/npm/rrweb@latest/dist/rrweb.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/index.js"></script>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0;
                        padding: 20px;
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
                    .player-container {
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        padding: 2rem;
                        margin-bottom: 2rem;
                    }
                    .controls {
                        display: flex;
                        gap: 1rem;
                        margin-bottom: 1rem;
                        flex-wrap: wrap;
                    }
                    .btn {
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.875rem;
                        font-weight: 600;
                        transition: background 0.2s;
                    }
                    .btn:hover { background: #2563eb; }
                    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
                    .session-info {
                        background: #f1f5f9;
                        padding: 1rem;
                        border-radius: 8px;
                        margin-bottom: 1rem;
                    }
                    #player { width: 100%; min-height: 600px; border: 1px solid #e2e8f0; }
                    .status {
                        padding: 0.5rem 1rem;
                        border-radius: 20px;
                        font-size: 0.875rem;
                        font-weight: 600;
                        margin-left: 1rem;
                    }
                    .status.loading { background: #fef3c7; color: #92400e; }
                    .status.ready { background: #d1fae5; color: #065f46; }
                    .status.error { background: #fee2e2; color: #991b1b; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎬 OpenReplay Player</h1>
                    <p>AIRIS EPM 세션 리플레이 플레이어</p>
                    ${sessionId ? `<p>세션 ID: <strong>${sessionId}</strong></p>` : ''}
                </div>

                <div class="player-container">
                    <div class="controls">
                        <select id="sessionSelect" class="btn" style="background: #f8fafc; color: #374151; border: 1px solid #d1d5db;">
                            <option value="">세션을 선택하세요...</option>
                        </select>
                        <button id="loadBtn" class="btn">세션 로드</button>
                        <button id="playBtn" class="btn" disabled>재생</button>
                        <button id="pauseBtn" class="btn" disabled>일시정지</button>
                        <button id="resetBtn" class="btn" disabled>처음으로</button>
                        <span id="status" class="status loading">준비 중...</span>
                    </div>

                    <div id="sessionInfo" class="session-info" style="display: none;">
                        <h3>세션 정보</h3>
                        <div id="sessionDetails"></div>
                    </div>

                    <div id="player"></div>
                </div>

                <script>
                    let currentPlayer = null;
                    let currentSession = null;
                    const statusEl = document.getElementById('status');
                    const sessionSelect = document.getElementById('sessionSelect');
                    const sessionInfo = document.getElementById('sessionInfo');
                    const sessionDetails = document.getElementById('sessionDetails');

                    // 상태 업데이트
                    function updateStatus(text, type = 'loading') {
                        statusEl.textContent = text;
                        statusEl.className = 'status ' + type;
                    }

                    // 세션 목록 로드
                    async function loadSessions() {
                        try {
                            const response = await fetch('/api/sessions');
                            const data = await response.json();
                            
                            sessionSelect.innerHTML = '<option value="">세션을 선택하세요...</option>';
                            
                            if (data.sessions && data.sessions.length > 0) {
                                data.sessions.forEach(session => {
                                    const option = document.createElement('option');
                                    option.value = session.sessionId;
                                    option.textContent = `${session.sessionId} (${session.eventCount || 0} 이벤트, ${new Date(session.createdAt).toLocaleString()})`;
                                    sessionSelect.appendChild(option);
                                });
                                updateStatus('세션 목록 로드 완료', 'ready');
                            } else {
                                updateStatus('저장된 세션이 없습니다', 'error');
                            }
                        } catch (error) {
                            console.error('세션 목록 로드 오류:', error);
                            updateStatus('세션 목록 로드 실패', 'error');
                        }
                    }

                    // 특정 세션 로드
                    async function loadSession(sessionId) {
                        try {
                            updateStatus('세션 로딩 중...', 'loading');
                            
                            const response = await fetch(`/api/sessions/${sessionId}`);
                            if (!response.ok) throw new Error('세션을 찾을 수 없습니다');
                            
                            currentSession = await response.json();
                            console.log('로드된 세션:', currentSession);
                            
                            // 세션 정보 표시
                            sessionDetails.innerHTML = \`
                                <p><strong>세션 ID:</strong> \${currentSession.sessionId}</p>
                                <p><strong>시작 시간:</strong> \${new Date(currentSession.startTime).toLocaleString()}</p>
                                <p><strong>이벤트 수:</strong> \${currentSession.eventCount || 0}</p>
                                <p><strong>지속시간:</strong> \${currentSession.duration || 0}초</p>
                                <p><strong>URL:</strong> \${currentSession.url || 'N/A'}</p>
                            \`;
                            sessionInfo.style.display = 'block';

                            // rrweb 플레이어 초기화
                            if (currentSession.events && currentSession.events.length > 0) {
                                initializePlayer(currentSession.events);
                                updateStatus('재생 준비 완료', 'ready');
                            } else {
                                updateStatus('이벤트 데이터가 없습니다', 'error');
                            }
                        } catch (error) {
                            console.error('세션 로드 오류:', error);
                            updateStatus('세션 로드 실패: ' + error.message, 'error');
                        }
                    }

                    // rrweb 플레이어 초기화
                    function initializePlayer(events) {
                        const playerEl = document.getElementById('player');
                        playerEl.innerHTML = '';

                        try {
                            // rrweb-player 사용
                            currentPlayer = new rrwebPlayer({
                                target: playerEl,
                                props: {
                                    events: events,
                                    width: playerEl.offsetWidth,
                                    height: 600,
                                    autoPlay: false,
                                    speedOption: [0.5, 1, 2, 4],
                                    showController: true,
                                    tags: {}
                                }
                            });

                            // 컨트롤 버튼 활성화
                            document.getElementById('playBtn').disabled = false;
                            document.getElementById('pauseBtn').disabled = false;
                            document.getElementById('resetBtn').disabled = false;
                            
                            console.log('rrweb 플레이어 초기화 완료');
                        } catch (error) {
                            console.error('플레이어 초기화 오류:', error);
                            
                            // 폴백: 기본 이벤트 표시
                            playerEl.innerHTML = \`
                                <div style="padding: 2rem; text-align: center;">
                                    <h3>📊 세션 이벤트 데이터</h3>
                                    <p>총 \${events.length}개의 이벤트가 기록되었습니다.</p>
                                    <details style="text-align: left; margin-top: 1rem;">
                                        <summary>이벤트 데이터 보기</summary>
                                        <pre style="background: #f1f5f9; padding: 1rem; border-radius: 6px; overflow: auto; max-height: 400px;">\${JSON.stringify(events, null, 2)}</pre>
                                    </details>
                                </div>
                            \`;
                        }
                    }

                    // 이벤트 리스너 설정
                    document.getElementById('loadBtn').addEventListener('click', () => {
                        const sessionId = sessionSelect.value;
                        if (sessionId) {
                            loadSession(sessionId);
                        } else {
                            alert('세션을 선택해주세요.');
                        }
                    });

                    document.getElementById('playBtn').addEventListener('click', () => {
                        if (currentPlayer && currentPlayer.play) {
                            currentPlayer.play();
                        }
                    });

                    document.getElementById('pauseBtn').addEventListener('click', () => {
                        if (currentPlayer && currentPlayer.pause) {
                            currentPlayer.pause();
                        }
                    });

                    document.getElementById('resetBtn').addEventListener('click', () => {
                        if (currentPlayer && currentPlayer.goto) {
                            currentPlayer.goto(0);
                        }
                    });

                    // URL에서 세션 ID가 제공된 경우 자동 로드
                    const urlSessionId = '${sessionId || ''}';
                    
                    // 초기 로드
                    window.addEventListener('load', () => {
                        loadSessions().then(() => {
                            if (urlSessionId) {
                                sessionSelect.value = urlSessionId;
                                loadSession(urlSessionId);
                            }
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }

    generateDashboardHTML() {
        return `
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>OpenReplay Integration - AIRIS EPM</title>
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
                    .endpoints {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 1rem;
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
                    .endpoint a:hover { text-decoration: underline; }
                    .status {
                        background: #10b981;
                        color: white;
                        padding: 0.5rem 1rem;
                        border-radius: 20px;
                        font-size: 0.875rem;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎬 OpenReplay Integration</h1>
                    <p>AIRIS EPM 세션 리플레이 통합 서비스</p>
                    <span class="status">✅ 서비스 정상 작동 중</span>
                </div>

                <div class="card">
                    <h2>🎮 세션 리플레이 플레이어</h2>
                    <div class="endpoints">
                        <div class="endpoint">
                            <strong><a href="/player">🎬 세션 플레이어</a></strong>
                            <p>저장된 세션을 선택하여 재생합니다</p>
                        </div>
                        <div class="endpoint">
                            <strong><a href="/api/sessions">📋 세션 목록 API</a></strong>
                            <p>저장된 모든 세션 데이터 조회</p>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h2>🔗 관련 서비스</h2>
                    <div class="endpoints">
                        <div class="endpoint">
                            <strong><a href="http://localhost:3004/test" target="_blank">🧪 세션 기록 테스트</a></strong>
                            <p>세션 기록 및 저장 테스트</p>
                        </div>
                        <div class="endpoint">
                            <strong><a href="http://localhost:3002" target="_blank">📊 AIRIS EPM 대시보드</a></strong>
                            <p>메인 APM 모니터링 대시보드</p>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h2>📈 실시간 통계</h2>
                    <div id="stats">로딩 중...</div>
                </div>

                <script>
                    // 실시간 통계 로드
                    async function loadStats() {
                        try {
                            const response = await fetch('/api/sessions');
                            const data = await response.json();
                            
                            document.getElementById('stats').innerHTML = \`
                                <p><strong>총 세션 수:</strong> \${data.total}</p>
                                <p><strong>최근 업데이트:</strong> \${new Date().toLocaleString()}</p>
                            \`;
                        } catch (error) {
                            document.getElementById('stats').innerHTML = '<p style="color: #e53e3e;">통계 로드 실패</p>';
                        }
                    }

                    // 페이지 로드시 통계 로드
                    window.addEventListener('load', loadStats);
                    
                    // 10초마다 통계 업데이트
                    setInterval(loadStats, 10000);
                </script>
            </body>
            </html>
        `;
    }

    generate404HTML(path) {
        return `
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Page Not Found - OpenReplay Integration</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                        text-align: center; 
                        padding: 2rem; 
                        background: #f8fafc; 
                    }
                    .container { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        background: white; 
                        padding: 2rem; 
                        border-radius: 12px; 
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
                    }
                    h1 { color: #e53e3e; margin-bottom: 1rem; }
                    p { color: #64748b; margin-bottom: 1rem; }
                    a { color: #3b82f6; text-decoration: none; font-weight: 600; }
                    a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔍 페이지를 찾을 수 없습니다</h1>
                    <p>요청하신 페이지 <strong>${path}</strong>를 찾을 수 없습니다.</p>
                    <p><a href="/">🏠 메인 대시보드로 돌아가기</a></p>
                    <p><a href="/player">🎬 세션 플레이어</a></p>
                </div>
            </body>
            </html>
        `;
    }

    async start() {
        try {
            this.server.listen(config.port, '0.0.0.0', () => {
                log.info(`🚀 OpenReplay Integration Server started`);
                log.info(`🌐 Server: http://0.0.0.0:${config.port}`);
                log.info(`🎬 Player: http://0.0.0.0:${config.port}/player`);
                log.info(`📈 Environment: ${config.env}`);
            });
        } catch (error) {
            log.error(`Failed to start server: ${error.message}`);
            process.exit(1);
        }
    }

    async shutdown() {
        log.info('🔄 Shutting down server gracefully...');
        this.server.close(() => {
            log.info('✅ Server shutdown complete');
            process.exit(0);
        });
    }
}

// 서버 시작
const server = new OpenReplayIntegrationServer();
server.start();

// Graceful shutdown
process.on('SIGTERM', server.shutdown.bind(server));
process.on('SIGINT', server.shutdown.bind(server));

module.exports = OpenReplayIntegrationServer;