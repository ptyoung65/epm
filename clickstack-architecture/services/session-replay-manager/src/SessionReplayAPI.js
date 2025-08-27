/**
 * 세션 리플레이와 OpenTelemetry 통합 REST API
 * AIRIS APM 시스템용 통합 세션 추적 API 서버
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const SessionTelemetryIntegration = require('./SessionTelemetryIntegration');
const logger = require('./utils/logger');

class SessionReplayAPI {
    constructor(config = {}) {
        this.config = {
            port: process.env.SESSION_API_PORT || 3004,
            host: process.env.SESSION_API_HOST || '0.0.0.0',
            corsOrigin: process.env.CORS_ORIGIN || '*',
            rateLimit: {
                windowMs: 15 * 60 * 1000, // 15분
                max: 1000, // 요청당 IP별 제한
                message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도하세요.'
            },
            ...config
        };

        this.app = express();
        this.sessionTelemetry = new SessionTelemetryIntegration();
        this.isRunning = false;
        
        this.metrics = {
            totalRequests: 0,
            errors: 0,
            activeSessions: 0,
            startTime: Date.now()
        };

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * 미들웨어 설정
     */
    setupMiddleware() {
        // 보안 헤더
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "http://localhost:*", "ws://localhost:*"]
                }
            }
        }));

        // CORS 설정
        this.app.use(cors({
            origin: this.config.corsOrigin,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Rate Limiting
        const limiter = rateLimit(this.config.rateLimit);
        this.app.use(limiter);

        // 요청 압축
        this.app.use(compression());

        // Body 파싱
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // 요청 로깅 미들웨어
        this.app.use((req, res, next) => {
            this.metrics.totalRequests++;
            const startTime = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                logger.debug('API 요청 완료', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                });
            });
            
            next();
        });
    }

    /**
     * API 라우트 설정
     */
    setupRoutes() {
        // 헬스 체크
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: Date.now() - this.metrics.startTime,
                metrics: this.getMetrics()
            });
        });

        // API 정보
        this.app.get('/api/info', (req, res) => {
            res.json({
                service: 'AIRIS Session Replay & Telemetry Integration API',
                version: '1.0.0',
                description: '세션 리플레이와 OpenTelemetry 통합 추적 시스템',
                endpoints: {
                    sessions: '/api/sessions',
                    telemetry: '/api/telemetry',
                    insights: '/api/insights',
                    analytics: '/api/analytics'
                }
            });
        });

        // === 세션 관리 API ===

        // 새 세션 생성/시작
        this.app.post('/api/sessions', async (req, res) => {
            try {
                const sessionData = {
                    airisSessionId: req.body.sessionId || `airis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    otelSessionId: req.body.otelSessionId,
                    otelTraceId: req.body.otelTraceId,
                    userId: req.body.userId,
                    userAgent: req.get('User-Agent'),
                    ipAddress: req.ip,
                    geoLocation: req.body.geoLocation
                };

                const session = await this.sessionTelemetry.createSessionTracking(sessionData);
                this.metrics.activeSessions++;

                res.status(201).json({
                    success: true,
                    message: '세션 생성 성공',
                    data: session
                });

            } catch (error) {
                this.handleError(res, error, '세션 생성 실패');
            }
        });

        // 세션 정보 조회
        this.app.get('/api/sessions/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const session = await this.sessionTelemetry.getSessionSummary(sessionId);
                
                if (!session) {
                    return res.status(404).json({
                        success: false,
                        message: '세션을 찾을 수 없습니다',
                        sessionId
                    });
                }

                res.json({
                    success: true,
                    data: session
                });

            } catch (error) {
                this.handleError(res, error, '세션 조회 실패');
            }
        });

        // 세션에 OpenTelemetry 정보 업데이트
        this.app.put('/api/sessions/:sessionId/telemetry', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const telemetryData = req.body;

                const updatedSession = await this.sessionTelemetry.updateSessionWithTelemetry(sessionId, telemetryData);
                
                if (!updatedSession) {
                    return res.status(404).json({
                        success: false,
                        message: '세션을 찾을 수 없습니다',
                        sessionId
                    });
                }

                res.json({
                    success: true,
                    message: '세션 텔레메트리 정보 업데이트 성공',
                    data: updatedSession
                });

            } catch (error) {
                this.handleError(res, error, '세션 텔레메트리 업데이트 실패');
            }
        });

        // 세션 완료 처리
        this.app.post('/api/sessions/:sessionId/complete', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const completionData = req.body;

                const completedSession = await this.sessionTelemetry.completeSession(sessionId, completionData);
                
                if (!completedSession) {
                    return res.status(404).json({
                        success: false,
                        message: '세션을 찾을 수 없습니다',
                        sessionId
                    });
                }

                this.metrics.activeSessions = Math.max(0, this.metrics.activeSessions - 1);

                res.json({
                    success: true,
                    message: '세션 완료 처리 성공',
                    data: completedSession
                });

            } catch (error) {
                this.handleError(res, error, '세션 완료 처리 실패');
            }
        });

        // === 페이지 뷰 관리 API ===

        // 페이지 뷰 추가
        this.app.post('/api/sessions/:sessionId/pageviews', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const pageData = req.body;

                const pageView = await this.sessionTelemetry.addPageView(sessionId, pageData);

                res.status(201).json({
                    success: true,
                    message: '페이지 뷰 기록 성공',
                    data: pageView
                });

            } catch (error) {
                this.handleError(res, error, '페이지 뷰 기록 실패');
            }
        });

        // === 상관관계 분석 API ===

        // 세션-텔레메트리 이벤트 상관관계 생성
        this.app.post('/api/sessions/:sessionId/correlations', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const correlationData = req.body;

                const correlation = await this.sessionTelemetry.correlateSessionTelemetryEvents(sessionId, correlationData);
                
                if (!correlation) {
                    return res.status(400).json({
                        success: false,
                        message: '상관관계 신뢰도가 임계치에 미달합니다'
                    });
                }

                res.status(201).json({
                    success: true,
                    message: '상관관계 분석 성공',
                    data: correlation
                });

            } catch (error) {
                this.handleError(res, error, '상관관계 분석 실패');
            }
        });

        // === 인사이트 및 분석 API ===

        // AI 인사이트 생성
        this.app.post('/api/sessions/:sessionId/insights', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const analysisData = req.body;

                const insight = await this.sessionTelemetry.generateSessionInsight(sessionId, analysisData);

                res.status(201).json({
                    success: true,
                    message: '인사이트 생성 성공',
                    data: insight
                });

            } catch (error) {
                this.handleError(res, error, '인사이트 생성 실패');
            }
        });

        // === 태그 관리 API ===

        // 세션 태그 추가
        this.app.post('/api/sessions/:sessionId/tags', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const { tagKey, tagValue, tagSource = 'manual', confidenceScore = 1.0, createdBy = 'api' } = req.body;

                const tag = await this.sessionTelemetry.addSessionTag(
                    sessionId, tagKey, tagValue, tagSource, confidenceScore, createdBy
                );

                res.status(201).json({
                    success: true,
                    message: '태그 추가 성공',
                    data: tag
                });

            } catch (error) {
                this.handleError(res, error, '태그 추가 실패');
            }
        });

        // === 배치 처리 API ===

        // 다중 세션 이벤트 배치 처리
        this.app.post('/api/sessions/events/batch', async (req, res) => {
            try {
                const { events } = req.body;
                const results = [];
                const errors = [];

                for (const event of events) {
                    try {
                        let result;
                        switch (event.type) {
                            case 'pageview':
                                result = await this.sessionTelemetry.addPageView(event.sessionId, event.data);
                                break;
                            case 'correlation':
                                result = await this.sessionTelemetry.correlateSessionTelemetryEvents(event.sessionId, event.data);
                                break;
                            case 'tag':
                                result = await this.sessionTelemetry.addSessionTag(
                                    event.sessionId, event.data.tagKey, event.data.tagValue, 
                                    event.data.tagSource, event.data.confidenceScore, event.data.createdBy
                                );
                                break;
                            default:
                                throw new Error(`지원하지 않는 이벤트 타입: ${event.type}`);
                        }
                        results.push({ eventId: event.id, success: true, data: result });
                    } catch (error) {
                        errors.push({ eventId: event.id, error: error.message });
                    }
                }

                res.json({
                    success: true,
                    message: `배치 처리 완료 - 성공: ${results.length}, 실패: ${errors.length}`,
                    results,
                    errors
                });

            } catch (error) {
                this.handleError(res, error, '배치 처리 실패');
            }
        });

        // === 분석 및 리포팅 API ===

        // 세션 성능 분석
        this.app.get('/api/analytics/sessions/:sessionId/performance', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const session = await this.sessionTelemetry.getSessionSummary(sessionId);
                
                if (!session) {
                    return res.status(404).json({
                        success: false,
                        message: '세션을 찾을 수 없습니다'
                    });
                }

                // 성능 분석 로직
                const analysis = {
                    sessionId,
                    performance: {
                        averageResponseTime: session.avg_response_time_ms,
                        totalRequests: session.total_requests,
                        errorRate: session.otel_error_count / Math.max(session.otel_span_count, 1),
                        pageLoadPerformance: session.avg_page_load_time_ms,
                        userEngagement: {
                            totalTimeSpent: session.total_time_spent_ms,
                            pageViews: session.actual_page_count,
                            averageTimePerPage: session.total_time_spent_ms / Math.max(session.actual_page_count, 1)
                        }
                    },
                    insights: {
                        critical: session.critical_insights_count,
                        high: session.high_insights_count
                    },
                    tags: session.session_tags || []
                };

                res.json({
                    success: true,
                    data: analysis
                });

            } catch (error) {
                this.handleError(res, error, '세션 성능 분석 실패');
            }
        });

        // 메트릭 조회
        this.app.get('/api/metrics', (req, res) => {
            res.json({
                success: true,
                data: this.getMetrics()
            });
        });
    }

    /**
     * 에러 핸들링 설정
     */
    setupErrorHandling() {
        // 404 핸들러
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'API 엔드포인트를 찾을 수 없습니다',
                path: req.originalUrl,
                method: req.method
            });
        });

        // 글로벌 에러 핸들러
        this.app.use((error, req, res, next) => {
            this.metrics.errors++;
            
            logger.error('API 에러 발생', {
                error: error.message,
                stack: error.stack,
                path: req.originalUrl,
                method: req.method,
                body: req.body
            });

            res.status(error.status || 500).json({
                success: false,
                message: error.message || '서버 내부 오류가 발생했습니다',
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            });
        });
    }

    /**
     * 공통 에러 처리 헬퍼
     */
    handleError(res, error, context) {
        this.metrics.errors++;
        
        logger.error(context, {
            error: error.message,
            stack: error.stack
        });

        const statusCode = error.status || error.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || context,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }

    /**
     * 서비스 시작
     */
    async start() {
        try {
            // SessionTelemetryIntegration 초기화
            await this.sessionTelemetry.initialize();

            // HTTP 서버 시작
            return new Promise((resolve, reject) => {
                this.server = this.app.listen(this.config.port, this.config.host, (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    this.isRunning = true;
                    logger.info('세션 리플레이 API 서버 시작됨', {
                        port: this.config.port,
                        host: this.config.host,
                        env: process.env.NODE_ENV || 'development'
                    });

                    resolve(this.server);
                });
            });

        } catch (error) {
            logger.error('세션 리플레이 API 서버 시작 실패', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * 서비스 중지
     */
    async stop() {
        try {
            logger.info('세션 리플레이 API 서버 중지 중...');

            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
            }

            await this.sessionTelemetry.cleanup();
            this.isRunning = false;

            logger.info('세션 리플레이 API 서버 중지 완료');

        } catch (error) {
            logger.error('세션 리플레이 API 서버 중지 중 오류', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 메트릭 조회
     */
    getMetrics() {
        return {
            ...this.metrics,
            ...this.sessionTelemetry.getMetrics(),
            uptime: Date.now() - this.metrics.startTime,
            isRunning: this.isRunning
        };
    }
}

module.exports = SessionReplayAPI;