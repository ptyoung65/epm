class HealthCheck {
  constructor(service) {
    this.service = service;
    this.checks = {
      kafka: this.checkKafka.bind(this),
      redis: this.checkRedis.bind(this),
      clickhouse: this.checkClickHouse.bind(this),
      mongodb: this.checkMongoDB.bind(this),
      postgres: this.checkPostgres.bind(this)
    };
  }

  async check() {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {},
      details: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
        memory: process.memoryUsage()
      }
    };

    // Run all health checks in parallel
    const checkPromises = Object.entries(this.checks).map(async ([name, checkFn]) => {
      try {
        const startTime = Date.now();
        const result = await checkFn();
        const duration = Date.now() - startTime;
        
        return {
          name,
          status: result.healthy ? 'healthy' : 'unhealthy',
          duration,
          details: result.details
        };
      } catch (error) {
        return {
          name,
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    const checkResults = await Promise.all(checkPromises);
    
    // Aggregate results
    let allHealthy = true;
    for (const result of checkResults) {
      results.checks[result.name] = result;
      if (result.status !== 'healthy') {
        allHealthy = false;
      }
    }

    results.status = allHealthy ? 'healthy' : 'unhealthy';
    
    // Add processing stats if available
    if (this.service.etlProcessor) {
      results.processing = this.service.etlProcessor.getStatus();
    }

    return results;
  }

  async checkKafka() {
    try {
      if (!this.service.kafkaManager) {
        return { healthy: false, details: 'Kafka Manager not initialized' };
      }

      const topics = await this.service.kafkaManager.listTopics();
      
      return {
        healthy: true,
        details: {
          connected: true,
          status: this.service.kafkaManager.status,
          topicCount: topics.length
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: error.message
      };
    }
  }

  async checkRedis() {
    try {
      if (!this.service.redis) {
        return { healthy: false, details: 'Redis not initialized' };
      }

      const pingResult = await this.service.redis.ping();
      const info = await this.service.redis.info('server');
      
      return {
        healthy: pingResult === 'PONG',
        details: {
          connected: true,
          response: pingResult,
          version: this.parseRedisVersion(info)
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: error.message
      };
    }
  }

  async checkClickHouse() {
    try {
      if (!this.service.clickhouse) {
        return { healthy: false, details: 'ClickHouse not initialized' };
      }

      const result = await this.service.clickhouse
        .query('SELECT version() as version, uptime() as uptime')
        .toPromise();
      
      return {
        healthy: true,
        details: {
          connected: true,
          version: result[0]?.version,
          uptime: result[0]?.uptime
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: error.message
      };
    }
  }

  async checkMongoDB() {
    try {
      if (!this.service.mongodb) {
        return { healthy: false, details: 'MongoDB not initialized' };
      }

      const admin = this.service.mongodb.admin();
      const result = await admin.ping();
      const serverStatus = await admin.serverStatus();
      
      return {
        healthy: result.ok === 1,
        details: {
          connected: true,
          version: serverStatus.version,
          uptime: serverStatus.uptime
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: error.message
      };
    }
  }

  async checkPostgres() {
    try {
      if (!this.service.postgres) {
        return { healthy: false, details: 'PostgreSQL not initialized' };
      }

      const result = await this.service.postgres.query('SELECT version(), NOW() as time');
      
      return {
        healthy: true,
        details: {
          connected: true,
          version: result.rows[0]?.version,
          serverTime: result.rows[0]?.time
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: error.message
      };
    }
  }

  parseRedisVersion(info) {
    const lines = info.split('\r\n');
    const versionLine = lines.find(line => line.startsWith('redis_version:'));
    return versionLine ? versionLine.split(':')[1] : 'unknown';
  }
}

module.exports = HealthCheck;