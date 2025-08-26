import dotenv from 'dotenv';
import { ServiceRegistryApp, ServiceRegistryConfig } from './ServiceRegistryApp';

// Load environment variables
dotenv.config();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Configuration
const config: ServiceRegistryConfig = {
  port: parseInt(process.env.PORT || '8500'),
  consul: {
    host: process.env.CONSUL_HOST || 'localhost',
    port: parseInt(process.env.CONSUL_PORT || '8500')
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  etcd: process.env.ETCD_HOSTS ? {
    hosts: process.env.ETCD_HOSTS.split(',')
  } : undefined,
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX || '1000')
  },
  healthCheck: {
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
    retries: parseInt(process.env.HEALTH_CHECK_RETRIES || '3')
  }
};

// Start the service registry
async function start() {
  try {
    const serviceRegistry = new ServiceRegistryApp(config);
    await serviceRegistry.start();
    
    console.log('🚀 Service Registry started successfully');
    console.log(`📁 Service: ${process.env.npm_package_name || 'service-registry'}`);
    console.log(`🔌 Port: ${config.port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Consul: ${config.consul.host}:${config.consul.port}`);
    console.log(`💾 Redis: ${config.redis.host}:${config.redis.port}`);
  } catch (error) {
    console.error('❌ Failed to start Service Registry:', error);
    process.exit(1);
  }
}

start();