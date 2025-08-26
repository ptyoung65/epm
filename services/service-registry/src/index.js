const express = require('express');
const winston = require('winston');
const Redis = require('ioredis');
const axios = require('axios');
const Joi = require('joi');
const moment = require('moment');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

class ServiceRegistry {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 8500;
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/service-registry.log' })
      ]
    });

    // Initialize Redis for service storage
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    // Service registration schema
    this.serviceSchema = Joi.object({
      id: Joi.string(),
      name: Joi.string().required(),
      address: Joi.string().required(),
      port: Joi.number().required(),
      tags: Joi.array().items(Joi.string()).default([]),
      meta: Joi.object().default({}),
      check: Joi.object({
        http: Joi.string(),
        interval: Joi.string().default('10s'),
        timeout: Joi.string().default('5s'),
        deregister_critical_service_after: Joi.string().default('30s')
      }),
      weights: Joi.object({
        passing: Joi.number().default(10),
        warning: Joi.number().default(1)
      }).default({ passing: 10, warning: 1 })
    });

    this.services = new Map();
    this.healthChecks = new Map();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.startHealthChecker();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS for web UI
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check for registry itself
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        services: this.services.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // Consul-compatible service registration
    this.app.put('/v1/agent/service/register', async (req, res) => {
      try {
        const service = await this.validateService(req.body);
        await this.registerService(service);
        res.status(200).json({ success: true });
      } catch (error) {
        this.logger.error('Service registration failed:', error);
        res.status(400).json({ error: error.message });
      }
    });

    // Consul-compatible service deregistration
    this.app.put('/v1/agent/service/deregister/:serviceId', async (req, res) => {
      try {
        const { serviceId } = req.params;
        await this.deregisterService(serviceId);
        res.status(200).json({ success: true });
      } catch (error) {
        this.logger.error('Service deregistration failed:', error);
        res.status(400).json({ error: error.message });
      }
    });

    // Get all services
    this.app.get('/v1/agent/services', async (req, res) => {
      try {
        const services = await this.getServices();
        res.json(services);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get healthy services by name
    this.app.get('/v1/health/service/:serviceName', async (req, res) => {
      try {
        const { serviceName } = req.params;
        const { passing } = req.query;
        
        const services = await this.getHealthyServices(serviceName, passing === 'true');
        res.json(services);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get service catalog
    this.app.get('/v1/catalog/services', async (req, res) => {
      try {
        const catalog = await this.getServiceCatalog();
        res.json(catalog);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get nodes for a service
    this.app.get('/v1/catalog/service/:serviceName', async (req, res) => {
      try {
        const { serviceName } = req.params;
        const nodes = await this.getServiceNodes(serviceName);
        res.json(nodes);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Service discovery endpoint
    this.app.get('/discover/:serviceName', async (req, res) => {
      try {
        const { serviceName } = req.params;
        const { strategy = 'round-robin' } = req.query;
        
        const instance = await this.discoverService(serviceName, strategy);
        if (!instance) {
          return res.status(404).json({ error: 'Service not found' });
        }
        
        res.json(instance);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Registry statistics
    this.app.get('/stats', async (req, res) => {
      try {
        const stats = await this.getRegistryStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Web UI for service registry
    this.app.get('/ui', (req, res) => {
      res.send(this.getRegistryUI());
    });
  }

  async validateService(data) {
    const service = await this.serviceSchema.validateAsync(data);
    
    // Generate ID if not provided
    if (!service.id) {
      service.id = `${service.name}-${uuidv4().slice(0, 8)}`;
    }

    return service;
  }

  async registerService(service) {
    const serviceKey = `service:${service.id}`;
    const nameKey = `services:${service.name}`;
    
    // Store service info
    const serviceData = {
      ...service,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: 'unknown'
    };

    await this.redis.hset(serviceKey, serviceData);
    await this.redis.sadd(nameKey, service.id);
    await this.redis.set(`service_name:${service.id}`, service.name);
    
    // Set TTL for service (30 minutes)
    await this.redis.expire(serviceKey, 1800);
    
    // Store in memory for quick access
    this.services.set(service.id, serviceData);
    
    // Start health checking if configured
    if (service.check && service.check.http) {
      this.startHealthCheck(service);
    }

    this.logger.info(`Service registered: ${service.name} (${service.id})`, {
      address: service.address,
      port: service.port
    });
  }

  async deregisterService(serviceId) {
    const serviceKey = `service:${serviceId}`;
    const serviceName = await this.redis.get(`service_name:${serviceId}`);
    
    if (serviceName) {
      const nameKey = `services:${serviceName}`;
      await this.redis.srem(nameKey, serviceId);
      await this.redis.del(`service_name:${serviceId}`);
    }
    
    await this.redis.del(serviceKey);
    
    // Remove from memory
    this.services.delete(serviceId);
    
    // Stop health checking
    if (this.healthChecks.has(serviceId)) {
      clearInterval(this.healthChecks.get(serviceId));
      this.healthChecks.delete(serviceId);
    }

    this.logger.info(`Service deregistered: ${serviceId}`);
  }

  async getServices() {
    const services = {};
    
    for (const [serviceId, service] of this.services) {
      services[serviceId] = {
        ID: service.id,
        Service: service.name,
        Address: service.address,
        Port: service.port,
        Tags: service.tags,
        Meta: service.meta,
        Weights: service.weights
      };
    }

    return services;
  }

  async getHealthyServices(serviceName, passingOnly = false) {
    const nameKey = `services:${serviceName}`;
    const serviceIds = await this.redis.smembers(nameKey);
    
    const healthyServices = [];
    
    for (const serviceId of serviceIds) {
      const serviceKey = `service:${serviceId}`;
      const service = await this.redis.hgetall(serviceKey);
      
      if (!service.id) continue;
      
      const status = await this.redis.get(`health:${serviceId}`) || 'unknown';
      
      if (!passingOnly || status === 'passing') {
        healthyServices.push({
          Node: {
            ID: serviceId,
            Node: service.address,
            Address: service.address
          },
          Service: {
            ID: service.id,
            Service: service.name,
            Address: service.address,
            Port: parseInt(service.port),
            Tags: JSON.parse(service.tags || '[]'),
            Meta: JSON.parse(service.meta || '{}'),
            Weights: JSON.parse(service.weights || '{"passing": 10, "warning": 1}')
          },
          Checks: [{
            CheckID: `service:${serviceId}`,
            Status: status,
            Output: '',
            ServiceID: serviceId,
            ServiceName: service.name
          }]
        });
      }
    }

    return healthyServices;
  }

  async getServiceCatalog() {
    const catalog = {};
    const serviceNames = await this.redis.keys('services:*');
    
    for (const nameKey of serviceNames) {
      const serviceName = nameKey.replace('services:', '');
      const serviceIds = await this.redis.smembers(nameKey);
      
      if (serviceIds.length > 0) {
        // Get tags from first service instance
        const firstServiceKey = `service:${serviceIds[0]}`;
        const firstService = await this.redis.hgetall(firstServiceKey);
        catalog[serviceName] = JSON.parse(firstService.tags || '[]');
      }
    }

    return catalog;
  }

  async getServiceNodes(serviceName) {
    return await this.getHealthyServices(serviceName);
  }

  async discoverService(serviceName, strategy = 'round-robin') {
    const healthyServices = await this.getHealthyServices(serviceName, true);
    
    if (healthyServices.length === 0) {
      return null;
    }

    let selected;
    
    switch (strategy) {
      case 'round-robin':
        const rrKey = `rr:${serviceName}`;
        const currentIndex = await this.redis.incr(rrKey) - 1;
        await this.redis.expire(rrKey, 300);
        selected = healthyServices[currentIndex % healthyServices.length];
        break;
        
      case 'random':
        selected = healthyServices[Math.floor(Math.random() * healthyServices.length)];
        break;
        
      case 'least-connections':
        // Simple implementation - could be enhanced with real connection tracking
        selected = healthyServices[0];
        break;
        
      default:
        selected = healthyServices[0];
    }

    return {
      id: selected.Service.ID,
      name: selected.Service.Service,
      address: selected.Service.Address,
      port: selected.Service.Port,
      url: `http://${selected.Service.Address}:${selected.Service.Port}`,
      tags: selected.Service.Tags,
      meta: selected.Service.Meta
    };
  }

  startHealthCheck(service) {
    const interval = this.parseInterval(service.check.interval || '10s');
    const timeout = this.parseInterval(service.check.timeout || '5s');
    
    const healthCheckFn = async () => {
      try {
        const response = await axios.get(service.check.http, { 
          timeout 
        });
        
        if (response.status >= 200 && response.status < 300) {
          await this.updateServiceHealth(service.id, 'passing');
        } else {
          await this.updateServiceHealth(service.id, 'warning');
        }
      } catch (error) {
        await this.updateServiceHealth(service.id, 'critical');
        this.logger.warn(`Health check failed for ${service.name} (${service.id}):`, error.message);
      }
    };

    // Initial health check
    healthCheckFn();
    
    // Schedule recurring health checks
    const intervalId = setInterval(healthCheckFn, interval);
    this.healthChecks.set(service.id, intervalId);
  }

  async updateServiceHealth(serviceId, status) {
    await this.redis.set(`health:${serviceId}`, status);
    await this.redis.expire(`health:${serviceId}`, 60);
    
    // Update last seen timestamp
    const serviceKey = `service:${serviceId}`;
    await this.redis.hset(serviceKey, 'lastSeen', new Date().toISOString());
    await this.redis.hset(serviceKey, 'status', status);
  }

  parseInterval(interval) {
    const match = interval.match(/^(\d+)([smh])$/);
    if (!match) return 10000; // Default 10s
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return value * 1000;
    }
  }

  startHealthChecker() {
    // Clean up stale services every minute
    cron.schedule('* * * * *', async () => {
      await this.cleanupStaleServices();
    });

    // Refresh services from Redis every 30 seconds
    setInterval(async () => {
      await this.refreshServicesFromRedis();
    }, 30000);
  }

  async cleanupStaleServices() {
    const staleThreshold = moment().subtract(5, 'minutes').toISOString();
    
    for (const [serviceId, service] of this.services) {
      if (service.lastSeen < staleThreshold) {
        this.logger.info(`Cleaning up stale service: ${serviceId}`);
        await this.deregisterService(serviceId);
      }
    }
  }

  async refreshServicesFromRedis() {
    const serviceKeys = await this.redis.keys('service:*');
    
    for (const key of serviceKeys) {
      const service = await this.redis.hgetall(key);
      if (service.id) {
        this.services.set(service.id, service);
      }
    }
  }

  async getRegistryStats() {
    const servicesByName = {};
    const servicesByStatus = { passing: 0, warning: 0, critical: 0, unknown: 0 };
    
    for (const [serviceId, service] of this.services) {
      // Count by name
      if (!servicesByName[service.name]) {
        servicesByName[service.name] = 0;
      }
      servicesByName[service.name]++;
      
      // Count by status
      const status = await this.redis.get(`health:${serviceId}`) || 'unknown';
      servicesByStatus[status]++;
    }

    return {
      totalServices: this.services.size,
      servicesByName,
      servicesByStatus,
      uptime: process.uptime(),
      lastUpdated: new Date().toISOString()
    };
  }

  getRegistryUI() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>AIRIS EPM Service Registry</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .service { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
            .status { padding: 3px 8px; border-radius: 3px; color: white; font-size: 12px; }
            .passing { background-color: green; }
            .warning { background-color: orange; }
            .critical { background-color: red; }
            .unknown { background-color: gray; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
    </head>
    <body>
        <h1>AIRIS EPM Service Registry</h1>
        <div id="stats"></div>
        <div id="services"></div>
        
        <script>
            function loadData() {
                Promise.all([
                    fetch('/stats').then(r => r.json()),
                    fetch('/v1/agent/services').then(r => r.json())
                ]).then(([stats, services]) => {
                    document.getElementById('stats').innerHTML = 
                        '<h2>Statistics</h2>' +
                        '<p>Total Services: ' + stats.totalServices + '</p>' +
                        '<p>Passing: ' + stats.servicesByStatus.passing + ', ' +
                        'Warning: ' + stats.servicesByStatus.warning + ', ' +
                        'Critical: ' + stats.servicesByStatus.critical + ', ' +
                        'Unknown: ' + stats.servicesByStatus.unknown + '</p>';
                    
                    let html = '<h2>Services</h2><table><tr><th>ID</th><th>Name</th><th>Address</th><th>Port</th><th>Status</th></tr>';
                    
                    Object.values(services).forEach(service => {
                        html += '<tr>' +
                            '<td>' + service.ID + '</td>' +
                            '<td>' + service.Service + '</td>' +
                            '<td>' + service.Address + '</td>' +
                            '<td>' + service.Port + '</td>' +
                            '<td><span class="status unknown">Unknown</span></td>' +
                            '</tr>';
                    });
                    
                    html += '</table>';
                    document.getElementById('services').innerHTML = html;
                });
            }
            
            loadData();
            setInterval(loadData, 10000);
        </script>
    </body>
    </html>
    `;
  }

  async start() {
    try {
      // Test Redis connection
      await this.redis.ping();
      
      this.server = this.app.listen(this.port, () => {
        this.logger.info(`Service Registry listening on port ${this.port}`);
        this.logger.info(`Web UI available at http://localhost:${this.port}/ui`);
      });

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        this.logger.info('SIGTERM received, shutting down gracefully');
        await this.shutdown();
      });

      process.on('SIGINT', async () => {
        this.logger.info('SIGINT received, shutting down gracefully');
        await this.shutdown();
      });

    } catch (error) {
      this.logger.error('Failed to start Service Registry:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    // Clear all health check intervals
    for (const intervalId of this.healthChecks.values()) {
      clearInterval(intervalId);
    }

    // Close HTTP server
    if (this.server) {
      this.server.close();
    }

    // Disconnect Redis
    this.redis.disconnect();

    this.logger.info('Service Registry shut down complete');
    process.exit(0);
  }
}

// Start the service registry
const registry = new ServiceRegistry();
registry.start();