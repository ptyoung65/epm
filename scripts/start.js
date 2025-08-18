#!/usr/bin/env node

const AIRISMonCore = require('../src/index');
const path = require('path');
const fs = require('fs');

/**
 * AIRIS-MON Startup Script
 * Production-ready startup with configuration loading and environment validation
 */
class Startup {
    constructor() {
        this.configPath = process.env.CONFIG_PATH || path.join(__dirname, '../config/production.json');
        this.config = this.loadConfiguration();
        this.core = null;
    }

    /**
     * Load configuration from file or environment
     */
    loadConfiguration() {
        console.log('📋 Loading configuration...');
        
        let config = {};

        // Try to load configuration file
        if (fs.existsSync(this.configPath)) {
            try {
                const configFile = fs.readFileSync(this.configPath, 'utf8');
                config = JSON.parse(configFile);
                console.log(`✅ Configuration loaded from ${this.configPath}`);
            } catch (error) {
                console.warn(`⚠️ Failed to load config file: ${error.message}`);
            }
        }

        // Override with environment variables
        const envConfig = {
            ingestion: {
                batchSize: parseInt(process.env.INGESTION_BATCH_SIZE) || config.ingestion?.batchSize || 1000,
                flushInterval: parseInt(process.env.INGESTION_FLUSH_INTERVAL) || config.ingestion?.flushInterval || 5000,
                queueConfig: {
                    redis: {
                        host: process.env.REDIS_HOST || config.ingestion?.queueConfig?.redis?.host || 'localhost',
                        port: parseInt(process.env.REDIS_PORT) || config.ingestion?.queueConfig?.redis?.port || 6379,
                        password: process.env.REDIS_PASSWORD || config.ingestion?.queueConfig?.redis?.password
                    },
                    kafka: {
                        brokers: process.env.KAFKA_BROKERS?.split(',') || config.ingestion?.queueConfig?.kafka?.brokers || ['localhost:9092']
                    },
                    rabbitmq: {
                        url: process.env.RABBITMQ_URL || config.ingestion?.queueConfig?.rabbitmq?.url || 'amqp://localhost'
                    }
                }
            },
            analytics: {
                realTimeEnabled: process.env.ANALYTICS_REALTIME === 'true' || config.analytics?.realTimeEnabled !== false,
                batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE) || config.analytics?.batchSize || 500,
                alertThreshold: parseFloat(process.env.ANALYTICS_ALERT_THRESHOLD) || config.analytics?.alertThreshold || 0.8
            },
            alerts: {
                batchSize: parseInt(process.env.ALERTS_BATCH_SIZE) || config.alerts?.batchSize || 100,
                suppressionWindow: parseInt(process.env.ALERTS_SUPPRESSION_WINDOW) || config.alerts?.suppressionWindow || 300000,
                escalationDelay: parseInt(process.env.ALERTS_ESCALATION_DELAY) || config.alerts?.escalationDelay || 900000,
                channels: {
                    email: {
                        enabled: process.env.EMAIL_ENABLED === 'true' || config.alerts?.channels?.email?.enabled || false,
                        smtp: process.env.SMTP_CONFIG || config.alerts?.channels?.email?.smtp
                    },
                    slack: {
                        enabled: process.env.SLACK_ENABLED === 'true' || config.alerts?.channels?.slack?.enabled || false,
                        webhook: process.env.SLACK_WEBHOOK || config.alerts?.channels?.slack?.webhook
                    },
                    webhook: {
                        enabled: process.env.WEBHOOK_ENABLED === 'true' || config.alerts?.channels?.webhook?.enabled || false,
                        url: process.env.WEBHOOK_URL || config.alerts?.channels?.webhook?.url
                    }
                }
            },
            api: {
                port: parseInt(process.env.PORT) || config.api?.port || 3000,
                host: process.env.HOST || config.api?.host || '0.0.0.0',
                cors: {
                    origin: process.env.CORS_ORIGIN || config.api?.cors?.origin || '*'
                }
            }
        };

        console.log(`✅ Configuration merged with environment variables`);
        return envConfig;
    }

    /**
     * Validate environment and dependencies
     */
    validateEnvironment() {
        console.log('🔍 Validating environment...');
        
        const issues = [];

        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        if (majorVersion < 14) {
            issues.push(`Node.js version ${nodeVersion} is not supported. Please use Node.js 14 or higher.`);
        }

        // Check required environment variables for production
        if (process.env.NODE_ENV === 'production') {
            const requiredEnvVars = [];
            
            if (this.config.alerts.channels.email.enabled && !this.config.alerts.channels.email.smtp) {
                requiredEnvVars.push('SMTP_CONFIG (email alerts enabled)');
            }
            
            if (this.config.alerts.channels.slack.enabled && !this.config.alerts.channels.slack.webhook) {
                requiredEnvVars.push('SLACK_WEBHOOK (slack alerts enabled)');
            }

            if (requiredEnvVars.length > 0) {
                issues.push(`Missing required environment variables: ${requiredEnvVars.join(', ')}`);
            }
        }

        // Check port availability
        const port = this.config.api.port;
        if (port < 1024 && process.getuid && process.getuid() !== 0) {
            issues.push(`Port ${port} requires root privileges. Use a port >= 1024 or run as root.`);
        }

        if (issues.length > 0) {
            console.error('❌ Environment validation failed:');
            issues.forEach(issue => console.error(`   • ${issue}`));
            process.exit(1);
        }

        console.log('✅ Environment validation passed');
    }

    /**
     * Setup monitoring and logging
     */
    setupMonitoring() {
        console.log('📊 Setting up system monitoring...');

        // Log system information
        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: {
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
            },
            uptime: process.uptime(),
            pid: process.pid
        };

        console.log('📋 System Information:', JSON.stringify(systemInfo, null, 2));

        // Setup process monitoring
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error);
            this.gracefulShutdown('uncaughtException', 1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            this.gracefulShutdown('unhandledRejection', 1);
        });

        process.on('SIGINT', () => this.gracefulShutdown('SIGINT', 0));
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM', 0));

        // Memory usage monitoring
        if (process.env.NODE_ENV === 'production') {
            setInterval(() => {
                const memUsage = process.memoryUsage();
                const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);
                
                if (memoryMB > 1024) { // 1GB threshold
                    console.warn(`⚠️ High memory usage: ${memoryMB}MB`);
                }
            }, 60000); // Check every minute
        }
    }

    /**
     * Graceful shutdown handler
     */
    async gracefulShutdown(signal, exitCode) {
        console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
        
        if (this.core) {
            try {
                await this.core.stop();
                console.log('✅ AIRIS-MON stopped gracefully');
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                exitCode = 1;
            }
        }

        console.log('👋 Goodbye!');
        process.exit(exitCode);
    }

    /**
     * Start the monitoring system
     */
    async start() {
        console.log('🚀 Starting AIRIS-MON...');
        console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🏠 Working directory: ${process.cwd()}`);
        
        try {
            // Validate environment
            this.validateEnvironment();

            // Setup monitoring
            this.setupMonitoring();

            // Initialize and start core
            this.core = new AIRISMonCore(this.config);
            await this.core.start();

            // Log success information
            console.log('\n🎉 AIRIS-MON started successfully!');
            console.log(`🌐 API Gateway: http://${this.config.api.host}:${this.config.api.port}`);
            console.log(`📊 WebSocket: ws://${this.config.api.host}:${this.config.api.port}/ws`);
            console.log(`🏥 Health Check: http://${this.config.api.host}:${this.config.api.port}/api/v1/health`);
            
            if (process.env.NODE_ENV !== 'production') {
                console.log(`\n📚 API Documentation:`);
                console.log(`   GET  /api/v1/status          - System status`);
                console.log(`   GET  /api/v1/health          - Health check`);
                console.log(`   GET  /api/v1/metrics         - Metrics data`);
                console.log(`   GET  /api/v1/alerts          - Active alerts`);
                console.log(`   POST /api/v1/metrics         - Submit metrics`);
                console.log(`   WS   /ws                     - Real-time updates`);
            }

        } catch (error) {
            console.error('❌ Failed to start AIRIS-MON:', error);
            process.exit(1);
        }
    }
}

// Main execution
if (require.main === module) {
    const startup = new Startup();
    startup.start();
}

module.exports = Startup;