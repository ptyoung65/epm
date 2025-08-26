/**
 * AIRIS EPM 통합 로깅 시스템
 * Winston 기반 구조화된 로깅
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from '../config/environment';

// 로그 레벨 정의
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// 개발/프로덕션 환경에 따른 로그 레벨 설정
const level = () => {
    const env = config.env || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : 'warn';
};

// 로그 색상 설정
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// 로그 포맷 정의
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

// 파일 로그 포맷 (색상 제거)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// 트랜스포트 설정
const transports = [
    // 콘솔 출력
    new winston.transports.Console({
        format,
    }),
    
    // 에러 로그 파일 (일별 로테이션)
    new DailyRotateFile({
        filename: path.join(process.cwd(), 'logs', 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        format: fileFormat,
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
    }),
    
    // 모든 로그 파일 (일별 로테이션)
    new DailyRotateFile({
        filename: path.join(process.cwd(), 'logs', 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        format: fileFormat,
        maxSize: '20m',
        maxFiles: '30d',
        zippedArchive: true,
    }),
];

// Winston 로거 생성
export const logger = winston.createLogger({
    level: level(),
    levels: logLevels,
    format: fileFormat,
    transports,
    exitOnError: false,
});

// 프로덕션 환경에서는 예외 처리 로그 추가
if (config.env === 'production') {
    logger.exceptions.handle(
        new DailyRotateFile({
            filename: path.join(process.cwd(), 'logs', 'exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true,
        })
    );
    
    logger.rejections.handle(
        new DailyRotateFile({
            filename: path.join(process.cwd(), 'logs', 'rejections-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true,
        })
    );
}

// 구조화된 로깅을 위한 헬퍼 함수들
export const loggers = {
    // 시스템 로그
    system: (message: string, meta?: any) => {
        logger.info(message, { component: 'system', ...meta });
    },
    
    // 세션 관련 로그
    session: (message: string, sessionId?: string, meta?: any) => {
        logger.info(message, { component: 'session', sessionId, ...meta });
    },
    
    // OpenReplay 관련 로그
    openreplay: (message: string, meta?: any) => {
        logger.info(message, { component: 'openreplay', ...meta });
    },
    
    // 프로젝트 관리 로그
    project: (message: string, projectId?: string, meta?: any) => {
        logger.info(message, { component: 'project', projectId, ...meta });
    },
    
    // 데이터베이스 로그
    database: (message: string, operation?: string, meta?: any) => {
        logger.info(message, { component: 'database', operation, ...meta });
    },
    
    // API 요청 로그
    api: (message: string, method?: string, path?: string, meta?: any) => {
        logger.http(message, { component: 'api', method, path, ...meta });
    },
    
    // 에러 로그
    error: (message: string, error?: Error, meta?: any) => {
        logger.error(message, { 
            component: 'error', 
            stack: error?.stack,
            name: error?.name,
            message: error?.message,
            ...meta 
        });
    },
    
    // 성능 로그
    performance: (message: string, duration?: number, meta?: any) => {
        logger.debug(message, { component: 'performance', duration, ...meta });
    },
    
    // 보안 로그
    security: (message: string, userId?: string, action?: string, meta?: any) => {
        logger.warn(message, { component: 'security', userId, action, ...meta });
    },
    
    // 비즈니스 로직 로그
    business: (message: string, action?: string, meta?: any) => {
        logger.info(message, { component: 'business', action, ...meta });
    },
};

// 성능 측정 헬퍼
export class PerformanceLogger {
    private startTime: number;
    private operation: string;
    
    constructor(operation: string) {
        this.operation = operation;
        this.startTime = Date.now();
        loggers.performance(`Started: ${operation}`);
    }
    
    end(meta?: any): number {
        const duration = Date.now() - this.startTime;
        loggers.performance(`Completed: ${this.operation}`, duration, meta);
        return duration;
    }
    
    checkpoint(checkpoint: string): number {
        const duration = Date.now() - this.startTime;
        loggers.performance(`Checkpoint [${checkpoint}]: ${this.operation}`, duration);
        return duration;
    }
}

// HTTP 요청 로깅 미들웨어 헬퍼
export const createRequestLogger = () => {
    return (req: any, res: any, next: any) => {
        const start = Date.now();
        
        res.on('finish', () => {
            const duration = Date.now() - start;
            const { method, url, ip } = req;
            const { statusCode } = res;
            
            loggers.api(
                `${method} ${url} - ${statusCode}`,
                method,
                url,
                { 
                    statusCode, 
                    duration, 
                    ip,
                    userAgent: req.get('User-Agent'),
                    contentLength: res.get('Content-Length')
                }
            );
        });
        
        next();
    };
};

// 에러 로깅 헬퍼
export const logError = (error: Error, context?: string, meta?: any) => {
    loggers.error(
        `${context ? `[${context}] ` : ''}${error.message}`,
        error,
        meta
    );
};

// 디버그 로깅 (개발 환경에서만)
export const logDebug = (message: string, meta?: any) => {
    if (config.env === 'development') {
        logger.debug(message, meta);
    }
};

export default logger;