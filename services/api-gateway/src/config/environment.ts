import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

/**
 * Environment configuration schema
 */
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  PORT: Joi.number().default(4000),
  
  // Database configurations
  CLICKHOUSE_URL: Joi.string().default('http://clickhouse-lb.airis-epm.svc.cluster.local:8123'),
  CLICKHOUSE_DATABASE: Joi.string().default('airis_epm'),
  
  POSTGRESQL_URL: Joi.string().default('postgresql://airis_epm_user@postgresql-primary.airis-epm.svc.cluster.local:5432/airis_epm'),
  
  REDIS_URL: Joi.string().default('redis://redis-lb.airis-epm.svc.cluster.local:6379'),
  
  MONGODB_URL: Joi.string().default('mongodb://mongodb-primary.airis-epm.svc.cluster.local:27017/airis_epm'),
  
  // Authentication
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('2h'),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),
  
  // External services
  AIRIS_APM_API_URL: Joi.string().default('http://airis-apm-api.airis-apm.svc.cluster.local:3000'),
  
  // Microservices URLs
  METRICS_SERVICE_URL: Joi.string().default('http://metrics-service.airis-epm.svc.cluster.local:4001'),
  LOGS_SERVICE_URL: Joi.string().default('http://logs-service.airis-epm.svc.cluster.local:4002'),
  TRACES_SERVICE_URL: Joi.string().default('http://traces-service.airis-epm.svc.cluster.local:4003'),
  ALERTS_SERVICE_URL: Joi.string().default('http://alerts-service.airis-epm.svc.cluster.local:4004'),
  USER_SERVICE_URL: Joi.string().default('http://user-service.airis-epm.svc.cluster.local:4005'),
  DASHBOARD_SERVICE_URL: Joi.string().default('http://dashboard-service.airis-epm.svc.cluster.local:4006'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(1000),
  
  // GraphQL settings
  GRAPHQL_MAX_DEPTH: Joi.number().default(10),
  GRAPHQL_MAX_COMPLEXITY: Joi.number().default(1000),
  
  // Server settings
  MAX_PAYLOAD_SIZE: Joi.string().default('10mb'),
  
  // Monitoring
  JAEGER_ENDPOINT: Joi.string().default('http://jaeger.airis-epm.svc.cluster.local:14268'),
  PROMETHEUS_ENDPOINT: Joi.string().default('http://prometheus.airis-epm.svc.cluster.local:9090'),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
  
  // CORS
  CORS_ORIGINS: Joi.string().default('*'),
  CORS_CREDENTIALS: Joi.boolean().default(true),
}).unknown();

const { error, value: env } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

/**
 * Application configuration
 */
export const config = {
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  
  server: {
    port: env.PORT,
    maxPayloadSize: env.MAX_PAYLOAD_SIZE,
  },
  
  databases: {
    clickhouse: {
      url: env.CLICKHOUSE_URL,
      database: env.CLICKHOUSE_DATABASE,
    },
    postgresql: {
      url: env.POSTGRESQL_URL,
    },
    mongodb: {
      url: env.MONGODB_URL,
    },
  },
  
  redis: {
    url: env.REDIS_URL,
    keyPrefix: 'airis:epm:',
    ttl: 3600, // 1 hour default TTL
  },
  
  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    refreshTokenExpiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
  },
  
  services: {
    legacyApiUrl: env.AIRIS_APM_API_URL,
    metricsService: env.METRICS_SERVICE_URL,
    logsService: env.LOGS_SERVICE_URL,
    tracesService: env.TRACES_SERVICE_URL,
    alertsService: env.ALERTS_SERVICE_URL,
    userService: env.USER_SERVICE_URL,
    dashboardService: env.DASHBOARD_SERVICE_URL,
  },
  
  rateLimiting: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  
  graphql: {
    maxDepth: env.GRAPHQL_MAX_DEPTH,
    maxComplexity: env.GRAPHQL_MAX_COMPLEXITY,
  },
  
  cors: {
    origins: env.CORS_ORIGINS.split(','),
    credentials: env.CORS_CREDENTIALS,
  },
  
  monitoring: {
    jaegerEndpoint: env.JAEGER_ENDPOINT,
    prometheusEndpoint: env.PROMETHEUS_ENDPOINT,
  },
  
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
} as const;

export type Config = typeof config;