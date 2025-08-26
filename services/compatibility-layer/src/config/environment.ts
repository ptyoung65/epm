import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

/**
 * Environment configuration schema for compatibility layer
 */
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  PORT: Joi.number().default(3100),
  
  // AIRIS APM Legacy API
  AIRIS_APM_API_URL: Joi.string().default('http://airis-apm-api.airis-apm.svc.cluster.local:3000'),
  AIRIS_APM_VERSION: Joi.string().default('2.1.0'),
  
  // AIRIS EPM New API
  AIRIS_EPM_API_URL: Joi.string().default('http://airis-epm-api-gateway.airis-epm.svc.cluster.local:4000'),
  AIRIS_EPM_GRAPHQL_URL: Joi.string().default('http://airis-epm-api-gateway.airis-epm.svc.cluster.local:4000/graphql'),
  
  // Database connections
  CLICKHOUSE_URL: Joi.string().default('http://clickhouse-lb.airis-epm.svc.cluster.local:8123'),
  CLICKHOUSE_DATABASE: Joi.string().default('airis_epm'),
  
  POSTGRESQL_URL: Joi.string().default('postgresql://airis_epm_user@postgresql-primary.airis-epm.svc.cluster.local:5432/airis_epm'),
  
  REDIS_URL: Joi.string().default('redis://redis-lb.airis-epm.svc.cluster.local:6379'),
  
  // Authentication
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('2h'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(2000), // Higher limit for compatibility layer
  
  // Server settings
  MAX_PAYLOAD_SIZE: Joi.string().default('50mb'), // Larger for data migration
  REQUEST_TIMEOUT: Joi.number().default(30000), // 30 seconds
  
  // CORS settings
  CORS_ALLOWED_ORIGINS: Joi.string().default('*'),
  
  // Migration settings
  MIGRATION_MODE: Joi.string().valid('transparent', 'gradual', 'forced').default('transparent'),
  MIGRATION_BATCH_SIZE: Joi.number().default(1000),
  MIGRATION_RETRY_ATTEMPTS: Joi.number().default(3),
  
  // Compatibility settings
  STRICT_VERSION_CHECK: Joi.boolean().default(false),
  DEPRECATED_WARNING_THRESHOLD: Joi.number().default(30), // days
  EOL_WARNING_THRESHOLD: Joi.number().default(90), // days
  
  // Monitoring
  JAEGER_ENDPOINT: Joi.string().default('http://jaeger.airis-epm.svc.cluster.local:14268'),
  PROMETHEUS_ENDPOINT: Joi.string().default('http://prometheus.airis-epm.svc.cluster.local:9090'),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
  
  // Feature flags
  ENABLE_DATA_VALIDATION: Joi.boolean().default(true),
  ENABLE_RESPONSE_CACHING: Joi.boolean().default(true),
  ENABLE_REQUEST_LOGGING: Joi.boolean().default(true),
  ENABLE_METRICS_COLLECTION: Joi.boolean().default(true),
}).unknown();

const { error, value: env } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Compatibility layer config validation error: ${error.message}`);
}

/**
 * Application configuration for compatibility layer
 */
export const config = {
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  
  server: {
    port: env.PORT,
    maxPayloadSize: env.MAX_PAYLOAD_SIZE,
    requestTimeout: env.REQUEST_TIMEOUT,
  },
  
  apis: {
    legacyApm: {
      url: env.AIRIS_APM_API_URL,
      version: env.AIRIS_APM_VERSION,
      timeout: env.REQUEST_TIMEOUT,
    },
    newEpm: {
      restUrl: env.AIRIS_EPM_API_URL,
      graphqlUrl: env.AIRIS_EPM_GRAPHQL_URL,
      timeout: env.REQUEST_TIMEOUT,
    },
  },
  
  databases: {
    clickhouse: {
      url: env.CLICKHOUSE_URL,
      database: env.CLICKHOUSE_DATABASE,
    },
    postgresql: {
      url: env.POSTGRESQL_URL,
    },
    redis: {
      url: env.REDIS_URL,
      keyPrefix: 'airis:compat:',
      ttl: 3600,
    },
  },
  
  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
  },
  
  rateLimiting: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  
  cors: {
    allowedOrigins: env.CORS_ALLOWED_ORIGINS.split(','),
  },
  
  migration: {
    mode: env.MIGRATION_MODE as 'transparent' | 'gradual' | 'forced',
    batchSize: env.MIGRATION_BATCH_SIZE,
    retryAttempts: env.MIGRATION_RETRY_ATTEMPTS,
  },
  
  compatibility: {
    strictVersionCheck: env.STRICT_VERSION_CHECK,
    deprecatedWarningThreshold: env.DEPRECATED_WARNING_THRESHOLD,
    eolWarningThreshold: env.EOL_WARNING_THRESHOLD,
    supportedVersions: ['1.0', '1.1', '1.2', '2.0', '2.1'], // Legacy APM versions
    currentVersion: '3.0', // New EPM version
  },
  
  monitoring: {
    jaegerEndpoint: env.JAEGER_ENDPOINT,
    prometheusEndpoint: env.PROMETHEUS_ENDPOINT,
  },
  
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
  
  features: {
    enableDataValidation: env.ENABLE_DATA_VALIDATION,
    enableResponseCaching: env.ENABLE_RESPONSE_CACHING,
    enableRequestLogging: env.ENABLE_REQUEST_LOGGING,
    enableMetricsCollection: env.ENABLE_METRICS_COLLECTION,
  },
  
  // API endpoint mappings for compatibility
  endpointMappings: {
    // Legacy APM -> New EPM mappings
    '/api/v1/metrics': '/api/v3/metrics',
    '/api/v1/alerts': '/api/v3/alerts',
    '/api/v1/dashboards': '/api/v3/dashboards',
    '/api/v1/users': '/api/v3/users',
    '/api/v1/traces': '/api/v3/traces',
    '/api/v1/logs': '/api/v3/logs',
    '/api/v1/health': '/health',
    '/api/v1/status': '/health',
    
    // GraphQL endpoints
    '/graphql': '/api/v3/graphql',
    '/api/graphql': '/api/v3/graphql',
  },
  
  // Data transformation rules
  transformationRules: {
    dateFormat: {
      legacy: 'YYYY-MM-DD HH:mm:ss',
      new: 'ISO8601',
    },
    fieldMappings: {
      // Common field name changes
      'timestamp': 'createdAt',
      'updated': 'updatedAt',
      'user_id': 'userId',
      'tenant_id': 'tenantId',
    },
    responseWrappers: {
      legacy: { data: 'response', status: 'success' },
      new: { data: 'data', errors: 'errors' },
    },
  },
} as const;

export type Config = typeof config;