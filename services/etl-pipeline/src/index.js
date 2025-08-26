const express = require('express');
const { Kafka } = require('kafkajs');
const winston = require('winston');
const promClient = require('prom-client');
const Redis = require('ioredis');
const { ClickHouse } = require('clickhouse');
const { MongoClient } = require('mongodb');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const ETLProcessor = require('./processors/ETLProcessor');
const KafkaManager = require('./kafka/KafkaManager');
const MetricsCollector = require('./metrics/MetricsCollector');
const HealthCheck = require('./health/HealthCheck');

dotenv.config();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/etl-pipeline.log' })
  ]
});

class ETLPipelineService {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3020;
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeConnections();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Prometheus metrics endpoint
    this.app.get('/metrics', (req, res) => {
      res.set('Content-Type', promClient.register.contentType);
      promClient.register.metrics().then(metrics => {
        res.end(metrics);
      });
    });
  }

  setupRoutes() {
    const healthCheck = new HealthCheck(this);
    
    this.app.get('/health', async (req, res) => {
      const health = await healthCheck.check();
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    });

    this.app.get('/api/etl/status', (req, res) => {
      res.json({
        service: 'ETL Pipeline Service',
        version: '1.0.0',
        status: 'operational',
        kafka: this.kafkaManager?.status || 'initializing',
        processors: this.etlProcessor?.getStatus() || 'initializing'
      });
    });

    this.app.post('/api/etl/topics', async (req, res) => {
      try {
        const { topicName, partitions = 3, replicationFactor = 2 } = req.body;
        await this.kafkaManager.createTopic(topicName, partitions, replicationFactor);
        res.json({ success: true, message: `Topic ${topicName} created successfully` });
      } catch (error) {
        logger.error('Error creating topic:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/etl/topics', async (req, res) => {
      try {
        const topics = await this.kafkaManager.listTopics();
        res.json({ topics });
      } catch (error) {
        logger.error('Error listing topics:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/etl/process', async (req, res) => {
      try {
        const { data, processingType } = req.body;
        const result = await this.etlProcessor.process(data, processingType);
        res.json({ success: true, result });
      } catch (error) {
        logger.error('Error processing data:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/etl/stats', async (req, res) => {
      try {
        const stats = await this.metricsCollector.getStats();
        res.json(stats);
      } catch (error) {
        logger.error('Error getting stats:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  async initializeConnections() {
    try {
      // Initialize Kafka
      this.kafka = new Kafka({
        clientId: 'airis-epm-etl',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092,localhost:9093,localhost:9094').split(','),
        retry: {
          initialRetryTime: 100,
          retries: 10
        }
      });

      // Initialize Redis
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        retryStrategy: (times) => Math.min(times * 50, 2000)
      });

      // Initialize ClickHouse
      this.clickhouse = new ClickHouse({
        url: process.env.CLICKHOUSE_URL || 'http://localhost',
        port: process.env.CLICKHOUSE_PORT || 8123,
        debug: false,
        basicAuth: null,
        isUseGzip: true,
        format: "json",
        raw: false,
        config: {
          database: process.env.CLICKHOUSE_DB || 'airis_epm'
        }
      });

      // Initialize MongoDB
      const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
      this.mongoClient = new MongoClient(mongoUrl);
      await this.mongoClient.connect();
      this.mongodb = this.mongoClient.db(process.env.MONGODB_DB || 'airis_epm');
      
      // Initialize PostgreSQL
      this.postgres = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'airis_epm',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Initialize managers
      this.kafkaManager = new KafkaManager(this.kafka, logger);
      this.etlProcessor = new ETLProcessor({
        kafka: this.kafka,
        redis: this.redis,
        clickhouse: this.clickhouse,
        mongodb: this.mongodb,
        postgres: this.postgres,
        logger
      });
      this.metricsCollector = new MetricsCollector({
        redis: this.redis,
        logger
      });

      await this.kafkaManager.initialize();
      await this.etlProcessor.initialize();
      await this.metricsCollector.initialize();

      logger.info('All connections initialized successfully');
    } catch (error) {
      logger.error('Error initializing connections:', error);
      throw error;
    }
  }

  async start() {
    try {
      await this.initializeConnections();
      
      // Start ETL processors
      await this.etlProcessor.startProcessing();
      
      this.server = this.app.listen(this.port, () => {
        logger.info(`ETL Pipeline Service listening on port ${this.port}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        logger.info('SIGTERM signal received: closing HTTP server');
        await this.shutdown();
      });

      process.on('SIGINT', async () => {
        logger.info('SIGINT signal received: closing HTTP server');
        await this.shutdown();
      });

    } catch (error) {
      logger.error('Failed to start ETL Pipeline Service:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    try {
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      if (this.etlProcessor) {
        await this.etlProcessor.stopProcessing();
      }

      if (this.kafkaManager) {
        await this.kafkaManager.disconnect();
      }

      if (this.redis) {
        this.redis.disconnect();
      }

      if (this.mongoClient) {
        await this.mongoClient.close();
      }

      if (this.postgres) {
        await this.postgres.end();
      }

      logger.info('All connections closed gracefully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the service
const service = new ETLPipelineService();
service.start();