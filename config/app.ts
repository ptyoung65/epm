import { LogLevel } from '../src/types/config';

interface AppConfig {
  port: number;
  env: string;
  apiVersion: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  security: {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptSaltRounds: number;
    sessionSecret: string;
  };
  logging: {
    level: LogLevel;
    file: string;
    maxFiles: number;
    maxSize: string;
  };
  monitoring: {
    metricsPath: string;
    healthCheckPath: string;
    enablePrometheus: boolean;
  };
  websocket: {
    pingTimeout: number;
    pingInterval: number;
  };
}

const development: AppConfig = {
  port: parseInt(process.env.PORT || '3000'),
  env: 'development',
  apiVersion: 'v1',
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
    jwtExpiresIn: '24h',
    bcryptSaltRounds: 10,
    sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
  },
  logging: {
    level: (process.env.LOG_LEVEL as LogLevel) || 'debug',
    file: 'logs/app.log',
    maxFiles: 5,
    maxSize: '10m',
  },
  monitoring: {
    metricsPath: '/metrics',
    healthCheckPath: '/health',
    enablePrometheus: true,
  },
  websocket: {
    pingTimeout: 60000,
    pingInterval: 25000,
  },
};

const staging: AppConfig = {
  ...development,
  env: 'staging',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['https://staging.airis-mon.com'],
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 500,
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: '12h',
    bcryptSaltRounds: 12,
    sessionSecret: process.env.SESSION_SECRET || '',
  },
  logging: {
    level: 'info',
    file: 'logs/app.log',
    maxFiles: 10,
    maxSize: '50m',
  },
};

const production: AppConfig = {
  ...development,
  env: 'production',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['https://airis-mon.com'],
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 300,
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: '8h',
    bcryptSaltRounds: 12,
    sessionSecret: process.env.SESSION_SECRET || '',
  },
  logging: {
    level: 'error',
    file: 'logs/app.log',
    maxFiles: 20,
    maxSize: '100m',
  },
};

const configs = {
  development,
  staging,
  production,
};

export default configs[process.env.NODE_ENV as keyof typeof configs] || development;