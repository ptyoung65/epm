/**
 * AIRIS EPM OpenReplay 통합 관리자 서비스
 * 세션 리플레이 및 관리자 모니터링 메인 서버
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

import { config } from './config/environment';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis } from './config/redis';

// Route imports
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import sessionRoutes from './routes/sessions';
import adminRoutes from './routes/admin';
import projectRoutes from './routes/projects';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';

// Service imports
import { SessionReplayService } from './services/SessionReplayService';
import { AdminMonitoringService } from './services/AdminMonitoringService';
import { ProjectManagerService } from './services/ProjectManagerService';
import { WebSocketManager } from './services/WebSocketManager';

// Middleware imports
import { errorHandler } from './middleware/errorHandler';
import { authentication } from './middleware/authentication';
import { requestLogger } from './middleware/requestLogger';

class OpenReplayAdminServer {
    private app: express.Application;
    private server: any;
    private io: Server;
    private sessionReplayService: SessionReplayService;
    private adminMonitoringService: AdminMonitoringService;
    private projectManagerService: ProjectManagerService;
    private webSocketManager: WebSocketManager;

    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: config.cors.origin,
                credentials: true,
            },
        });

        this.initializeServices();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
    }

    private initializeServices(): void {
        this.sessionReplayService = new SessionReplayService();
        this.adminMonitoringService = new AdminMonitoringService();
        this.projectManagerService = new ProjectManagerService();
        this.webSocketManager = new WebSocketManager(this.io);
    }

    private setupMiddleware(): void {
        // 보안 헤더
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    scriptSrc: ["'self'", "'unsafe-eval'"],
                    connectSrc: ["'self'", "ws:", "wss:"],
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
        this.app.use(express.json({ limit: config.server.maxPayloadSize }));
        this.app.use(express.urlencoded({ extended: true, limit: config.server.maxPayloadSize }));
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
                sameSite: config.session.sameSite as any,
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
            this.app.use(morgan('combined', {
                stream: { write: (message: string) => logger.info(message.trim()) },
            }));
        }

        // 커스텀 요청 로거
        this.app.use(requestLogger);

        // 정적 파일 서빙
        this.app.use('/static', express.static(path.join(__dirname, 'public')));
    }

    private setupRoutes(): void {
        // 인증되지 않은 라우트
        this.app.use('/api/health', healthRoutes);
        this.app.use('/api/auth', authRoutes);

        // 인증된 라우트
        this.app.use('/api/dashboard', authentication, dashboardRoutes);
        this.app.use('/api/sessions', authentication, sessionRoutes);
        this.app.use('/api/admin', authentication, adminRoutes);
        this.app.use('/api/projects', authentication, projectRoutes);
        this.app.use('/api/analytics', authentication, analyticsRoutes);

        // 메인 대시보드 라우트
        this.app.get('/', (req: express.Request, res: express.Response) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // SPA 라우팅 지원
        this.app.get('*', (req: express.Request, res: express.Response) => {
            if (req.path.startsWith('/api/')) {
                res.status(404).json({ error: 'API endpoint not found' });
            } else {
                res.sendFile(path.join(__dirname, 'public', 'index.html'));
            }
        });
    }

    private setupWebSocket(): void {
        this.webSocketManager.initialize();
        logger.info('WebSocket manager initialized');
    }

    private setupErrorHandling(): void {
        this.app.use(errorHandler);

        // Graceful shutdown
        process.on('SIGTERM', this.shutdown.bind(this));
        process.on('SIGINT', this.shutdown.bind(this));
        process.on('uncaughtException', (error: Error) => {
            logger.error('Uncaught Exception:', error);
            this.shutdown();
        });
        process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.shutdown();
        });
    }

    public async start(): Promise<void> {
        try {
            // 데이터베이스 연결
            await connectDatabase();
            logger.info('Database connected successfully');

            // Redis 연결
            await connectRedis();
            logger.info('Redis connected successfully');

            // 서비스 초기화
            await this.sessionReplayService.initialize();
            await this.adminMonitoringService.initialize();
            await this.projectManagerService.initialize();

            // 서버 시작
            this.server.listen(config.server.port, config.server.host, () => {
                logger.info(`🚀 OpenReplay Admin Server running on http://${config.server.host}:${config.server.port}`);
                logger.info(`📊 Dashboard: http://${config.server.host}:${config.server.port}`);
                logger.info(`🎮 WebSocket: ws://${config.server.host}:${config.server.port}`);
                logger.info(`📈 Environment: ${config.env}`);
                logger.info(`🔒 Security: ${config.session.secureCookies ? 'HTTPS' : 'HTTP'}`);
            });

            // 주기적 작업 시작
            this.startCronJobs();

        } catch (error) {
            logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    private startCronJobs(): void {
        // 세션 클리닝 (매일 자정)
        const cron = require('node-cron');
        
        cron.schedule('0 0 * * *', async () => {
            try {
                await this.sessionReplayService.cleanupOldSessions();
                logger.info('Daily session cleanup completed');
            } catch (error) {
                logger.error('Session cleanup failed:', error);
            }
        });

        // 시스템 상태 체크 (매 5분)
        cron.schedule('*/5 * * * *', async () => {
            try {
                await this.adminMonitoringService.performHealthCheck();
            } catch (error) {
                logger.error('Health check failed:', error);
            }
        });

        // 메트릭 집계 (매시간)
        cron.schedule('0 * * * *', async () => {
            try {
                await this.adminMonitoringService.aggregateHourlyMetrics();
                logger.info('Hourly metrics aggregation completed');
            } catch (error) {
                logger.error('Metrics aggregation failed:', error);
            }
        });

        logger.info('Cron jobs scheduled successfully');
    }

    private async shutdown(): Promise<void> {
        logger.info('Shutting down server gracefully...');

        try {
            // 새로운 연결 거부
            this.server.close(async () => {
                logger.info('HTTP server closed');

                // WebSocket 연결 종료
                this.io.close();
                logger.info('WebSocket connections closed');

                // 데이터베이스 연결 해제
                await disconnectDatabase();
                logger.info('Database disconnected');

                // 서비스 정리
                await this.sessionReplayService.cleanup();
                await this.adminMonitoringService.cleanup();
                await this.projectManagerService.cleanup();

                logger.info('Server shutdown complete');
                process.exit(0);
            });

            // 강제 종료 타이머 (30초)
            setTimeout(() => {
                logger.warn('Forced shutdown after timeout');
                process.exit(1);
            }, 30000);

        } catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }

    public getApp(): express.Application {
        return this.app;
    }

    public getServer(): any {
        return this.server;
    }

    public getIO(): Server {
        return this.io;
    }
}

// 서버 인스턴스 생성 및 시작
const server = new OpenReplayAdminServer();

if (require.main === module) {
    server.start().catch((error) => {
        logger.error('Failed to start application:', error);
        process.exit(1);
    });
}

export default server;