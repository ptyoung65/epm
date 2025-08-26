const BaseService = require('../common/BaseService');
const { Kafka } = require('kafkajs');
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
const { WebClient } = require('@slack/web-api');
const twilio = require('twilio');
const Joi = require('joi');
const moment = require('moment');
const cron = require('node-cron');
const Mustache = require('mustache');

class AlertsService extends BaseService {
  constructor() {
    super({
      serviceName: 'alerts-service',
      serviceVersion: '1.0.0',
      port: process.env.PORT || 3024
    });

    this.alertsBuffer = [];
    this.bufferSize = parseInt(process.env.BUFFER_SIZE || '100');

    // Alert validation schema
    this.alertSchema = Joi.object({
      id: Joi.string(),
      type: Joi.string().valid('threshold', 'anomaly', 'error_pattern', 'slow_trace', 'high_error_rate').required(),
      severity: Joi.string().valid('info', 'warning', 'error', 'critical').default('warning'),
      title: Joi.string().required(),
      message: Joi.string().required(),
      source: Joi.string().required(),
      tags: Joi.object().default({}),
      metadata: Joi.object().default({}),
      timestamp: Joi.date().default(() => new Date()),
      resolved: Joi.boolean().default(false)
    });

    // Notification channel schema
    this.channelSchema = Joi.object({
      name: Joi.string().required(),
      type: Joi.string().valid('email', 'slack', 'sms', 'webhook', 'pagerduty').required(),
      config: Joi.object().required(),
      enabled: Joi.boolean().default(true),
      filters: Joi.object({
        severity: Joi.array().items(Joi.string()),
        types: Joi.array().items(Joi.string()),
        sources: Joi.array().items(Joi.string()),
        tags: Joi.object()
      }).default({})
    });

    // Alert rule schema
    this.ruleSchema = Joi.object({
      name: Joi.string().required(),
      enabled: Joi.boolean().default(true),
      conditions: Joi.object().required(),
      actions: Joi.array().items(Joi.object({
        type: Joi.string().required(),
        config: Joi.object()
      })),
      cooldown: Joi.number().default(300), // 5 minutes
      escalation: Joi.object({
        enabled: Joi.boolean().default(false),
        levels: Joi.array().items(Joi.object())
      }).default({ enabled: false })
    });

    this.setupRoutes();
    this.initializeNotificationProviders();
  }

  async initialize() {
    // Initialize Kafka
    this.kafka = new Kafka({
      clientId: 'alerts-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
    });

    this.producer = this.kafka.producer();
    await this.producer.connect();

    // Initialize MongoDB
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
    this.mongoClient = new MongoClient(mongoUrl);
    await this.mongoClient.connect();
    this.db = this.mongoClient.db(process.env.MONGODB_DB || 'airis_epm');

    // Start alert consumers
    await this.startAlertConsumers();

    // Start alert processing
    this.startAlertProcessor();

    // Start escalation processor
    this.startEscalationProcessor();

    this.logger.info('Alerts service initialized');
  }

  initializeNotificationProviders() {
    this.providers = {};

    // Email provider
    if (process.env.SMTP_HOST) {
      this.providers.email = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }

    // Slack provider
    if (process.env.SLACK_TOKEN) {
      this.providers.slack = new WebClient(process.env.SLACK_TOKEN);
    }

    // SMS provider (Twilio)
    if (process.env.TWILIO_ACCOUNT_SID) {
      this.providers.sms = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  setupRoutes() {
    // Create alert
    this.app.post('/api/alerts', async (req, res) => {
      try {
        const alert = await this.validateAlert(req.body);
        const created = await this.createAlert(alert);
        res.status(201).json({ success: true, alert: created });
      } catch (error) {
        if (error.isJoi) {
          res.status(400).json({ error: error.details[0].message });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    });

    // Get alerts
    this.app.get('/api/alerts', async (req, res) => {
      try {
        const {
          severity,
          type,
          source,
          resolved,
          from,
          to,
          limit = 50,
          offset = 0
        } = req.query;

        const alerts = await this.getAlerts({
          severity,
          type,
          source,
          resolved: resolved !== undefined ? resolved === 'true' : undefined,
          from: from || moment().subtract(24, 'hours').toISOString(),
          to: to || moment().toISOString(),
          limit: parseInt(limit),
          offset: parseInt(offset)
        });

        res.json({ alerts });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Resolve alert
    this.app.patch('/api/alerts/:id/resolve', async (req, res) => {
      try {
        const { id } = req.params;
        const { resolution } = req.body;
        
        await this.resolveAlert(id, resolution);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get alert rules
    this.app.get('/api/alert-rules', async (req, res) => {
      try {
        const rules = await this.getAlertRules();
        res.json({ rules });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Create alert rule
    this.app.post('/api/alert-rules', async (req, res) => {
      try {
        const rule = await this.validateAlertRule(req.body);
        const created = await this.createAlertRule(rule);
        res.status(201).json({ success: true, rule: created });
      } catch (error) {
        if (error.isJoi) {
          res.status(400).json({ error: error.details[0].message });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    });

    // Update alert rule
    this.app.put('/api/alert-rules/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const rule = await this.validateAlertRule(req.body);
        const updated = await this.updateAlertRule(id, rule);
        res.json({ success: true, rule: updated });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete alert rule
    this.app.delete('/api/alert-rules/:id', async (req, res) => {
      try {
        const { id } = req.params;
        await this.deleteAlertRule(id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get notification channels
    this.app.get('/api/notification-channels', async (req, res) => {
      try {
        const channels = await this.getNotificationChannels();
        res.json({ channels });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Create notification channel
    this.app.post('/api/notification-channels', async (req, res) => {
      try {
        const channel = await this.validateNotificationChannel(req.body);
        const created = await this.createNotificationChannel(channel);
        res.status(201).json({ success: true, channel: created });
      } catch (error) {
        if (error.isJoi) {
          res.status(400).json({ error: error.details[0].message });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    });

    // Test notification channel
    this.app.post('/api/notification-channels/:id/test', async (req, res) => {
      try {
        const { id } = req.params;
        await this.testNotificationChannel(id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get alert statistics
    this.app.get('/api/alerts/stats', async (req, res) => {
      try {
        const stats = await this.getAlertStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Real-time alerts stream
    this.app.get('/api/alerts/stream', (req, res) => {
      const { severity } = req.query;
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const subscriber = this.subscribeToAlerts((alert) => {
        if (severity && alert.severity !== severity) return;
        res.write(`data: ${JSON.stringify(alert)}\n\n`);
      });

      req.on('close', () => {
        subscriber.unsubscribe();
      });
    });
  }

  async validateAlert(data) {
    return await this.alertSchema.validateAsync(data);
  }

  async validateAlertRule(data) {
    return await this.ruleSchema.validateAsync(data);
  }

  async validateNotificationChannel(data) {
    return await this.channelSchema.validateAsync(data);
  }

  async createAlert(alert) {
    // Add ID if not provided
    if (!alert.id) {
      alert.id = require('uuid').v4();
    }

    // Store in MongoDB
    const result = await this.db.collection('alerts').insertOne({
      ...alert,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Add to processing buffer
    this.alertsBuffer.push(alert);

    // Publish for real-time notifications
    await this.publish('alerts:new', alert);

    // Send to Kafka for further processing
    await this.producer.send({
      topic: 'airis-epm-alerts',
      messages: [{
        key: alert.id,
        value: JSON.stringify(alert)
      }]
    });

    return { ...alert, _id: result.insertedId };
  }

  async getAlerts(filters) {
    const query = {};

    if (filters.severity) {
      query.severity = filters.severity;
    }
    if (filters.type) {
      query.type = filters.type;
    }
    if (filters.source) {
      query.source = filters.source;
    }
    if (filters.resolved !== undefined) {
      query.resolved = filters.resolved;
    }
    if (filters.from || filters.to) {
      query.timestamp = {};
      if (filters.from) {
        query.timestamp.$gte = new Date(filters.from);
      }
      if (filters.to) {
        query.timestamp.$lte = new Date(filters.to);
      }
    }

    const alerts = await this.db.collection('alerts')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(filters.limit)
      .skip(filters.offset)
      .toArray();

    return alerts;
  }

  async resolveAlert(id, resolution = {}) {
    const result = await this.db.collection('alerts').updateOne(
      { id },
      {
        $set: {
          resolved: true,
          resolvedAt: new Date(),
          resolution,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error('Alert not found');
    }

    // Publish resolution event
    await this.publish('alerts:resolved', { id, resolution });
  }

  async startAlertConsumers() {
    const topics = [
      'alerts:threshold',
      'alerts:anomaly', 
      'alerts:error_pattern',
      'alerts:slow_trace',
      'alerts:high_error_rate'
    ];

    for (const topic of topics) {
      await this.subscribe(topic, async (data) => {
        await this.processIncomingAlert(topic, data);
      });
    }
  }

  async processIncomingAlert(topic, data) {
    try {
      // Convert topic alert to standard alert format
      const alert = this.convertToAlert(topic, data);
      
      // Check if alert should be suppressed
      if (await this.shouldSuppressAlert(alert)) {
        return;
      }

      // Create the alert
      await this.createAlert(alert);
      
      this.logger.info(`Processed alert from ${topic}`, { alertId: alert.id });
    } catch (error) {
      this.logger.error(`Failed to process alert from ${topic}:`, error);
    }
  }

  convertToAlert(topic, data) {
    const alertType = topic.split(':')[1];
    
    const baseAlert = {
      type: alertType,
      source: data.service || data.source || 'unknown',
      timestamp: new Date(data.timestamp || Date.now()),
      tags: data.tags || {},
      metadata: data
    };

    switch (alertType) {
      case 'threshold':
        return {
          ...baseAlert,
          severity: data.severity || 'warning',
          title: `Threshold Alert: ${data.metric}`,
          message: `Metric ${data.metric} value ${data.value} exceeds threshold ${data.threshold}`
        };
        
      case 'anomaly':
        return {
          ...baseAlert,
          severity: 'warning',
          title: `Anomaly Detected: ${data.metric}`,
          message: `Metric ${data.metric} shows anomalous behavior (deviation: ${data.deviation.toFixed(2)}σ)`
        };
        
      case 'error_pattern':
        return {
          ...baseAlert,
          severity: 'error',
          title: `Error Pattern: ${data.service}`,
          message: `Error pattern detected in ${data.service}: ${data.pattern} (${data.count} occurrences)`
        };
        
      case 'slow_trace':
        return {
          ...baseAlert,
          severity: 'warning',
          title: `Slow Trace: ${data.service}`,
          message: `Trace ${data.traceId} took ${data.duration}ms (P99: ${data.p99}ms)`
        };
        
      case 'high_error_rate':
        return {
          ...baseAlert,
          severity: 'critical',
          title: `High Error Rate: ${data.service}`,
          message: `Service ${data.service} has ${data.errorCount} errors in ${data.window}`
        };
        
      default:
        return {
          ...baseAlert,
          severity: 'info',
          title: `Alert: ${alertType}`,
          message: JSON.stringify(data)
        };
    }
  }

  async shouldSuppressAlert(alert) {
    // Check cooldown period
    const cooldownKey = `alert_cooldown:${alert.type}:${alert.source}`;
    const lastAlert = await this.redis.get(cooldownKey);
    
    if (lastAlert) {
      this.logger.debug(`Alert suppressed due to cooldown: ${alert.type}/${alert.source}`);
      return true;
    }

    // Set cooldown
    await this.redis.setex(cooldownKey, 300, Date.now()); // 5 minutes cooldown
    
    return false;
  }

  startAlertProcessor() {
    setInterval(async () => {
      if (this.alertsBuffer.length === 0) return;

      const alerts = [...this.alertsBuffer];
      this.alertsBuffer = [];

      for (const alert of alerts) {
        await this.processAlert(alert);
      }
    }, 5000);
  }

  async processAlert(alert) {
    try {
      // Get notification channels
      const channels = await this.getNotificationChannels();
      
      // Filter channels based on alert properties
      const matchingChannels = channels.filter(channel => 
        this.channelMatches(channel, alert)
      );

      // Send notifications
      for (const channel of matchingChannels) {
        await this.sendNotification(channel, alert);
      }

      // Update alert with notification status
      await this.db.collection('alerts').updateOne(
        { id: alert.id },
        {
          $set: {
            notificationsSent: matchingChannels.length,
            processedAt: new Date()
          }
        }
      );

    } catch (error) {
      this.logger.error(`Failed to process alert ${alert.id}:`, error);
    }
  }

  channelMatches(channel, alert) {
    if (!channel.enabled) return false;

    const { filters } = channel;
    
    // Check severity filter
    if (filters.severity && filters.severity.length > 0) {
      if (!filters.severity.includes(alert.severity)) return false;
    }
    
    // Check type filter
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(alert.type)) return false;
    }
    
    // Check source filter
    if (filters.sources && filters.sources.length > 0) {
      if (!filters.sources.includes(alert.source)) return false;
    }
    
    // Check tags filter
    if (filters.tags && Object.keys(filters.tags).length > 0) {
      for (const [key, value] of Object.entries(filters.tags)) {
        if (alert.tags[key] !== value) return false;
      }
    }

    return true;
  }

  async sendNotification(channel, alert) {
    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(channel, alert);
          break;
        case 'slack':
          await this.sendSlackNotification(channel, alert);
          break;
        case 'sms':
          await this.sendSmsNotification(channel, alert);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, alert);
          break;
        default:
          this.logger.warn(`Unsupported notification type: ${channel.type}`);
      }

      this.logger.info(`Sent ${channel.type} notification`, {
        channel: channel.name,
        alert: alert.id
      });

    } catch (error) {
      this.logger.error(`Failed to send ${channel.type} notification:`, error);
    }
  }

  async sendEmailNotification(channel, alert) {
    if (!this.providers.email) {
      throw new Error('Email provider not configured');
    }

    const template = channel.config.template || this.getDefaultEmailTemplate();
    const subject = Mustache.render(channel.config.subjectTemplate || '{{severity}} Alert: {{title}}', alert);
    const body = Mustache.render(template, alert);

    await this.providers.email.sendMail({
      from: channel.config.from || process.env.SMTP_FROM,
      to: channel.config.to,
      subject,
      html: body
    });
  }

  async sendSlackNotification(channel, alert) {
    if (!this.providers.slack) {
      throw new Error('Slack provider not configured');
    }

    const color = this.getSeverityColor(alert.severity);
    
    await this.providers.slack.chat.postMessage({
      channel: channel.config.channel,
      text: alert.title,
      attachments: [{
        color,
        title: alert.title,
        text: alert.message,
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Source', value: alert.source, short: true },
          { title: 'Time', value: moment(alert.timestamp).format('YYYY-MM-DD HH:mm:ss'), short: true }
        ],
        ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
      }]
    });
  }

  async sendSmsNotification(channel, alert) {
    if (!this.providers.sms) {
      throw new Error('SMS provider not configured');
    }

    const message = `${alert.severity.toUpperCase()}: ${alert.title}\n${alert.message}`;
    
    await this.providers.sms.messages.create({
      body: message.substring(0, 160), // SMS limit
      from: channel.config.from || process.env.TWILIO_FROM,
      to: channel.config.to
    });
  }

  async sendWebhookNotification(channel, alert) {
    const payload = {
      alert,
      channel: channel.name,
      timestamp: new Date()
    };

    await axios.post(channel.config.url, payload, {
      headers: channel.config.headers || {},
      timeout: 10000
    });
  }

  getDefaultEmailTemplate() {
    return `
      <h2>{{title}}</h2>
      <p><strong>Severity:</strong> {{severity}}</p>
      <p><strong>Source:</strong> {{source}}</p>
      <p><strong>Time:</strong> {{timestamp}}</p>
      <p><strong>Message:</strong></p>
      <p>{{message}}</p>
      {{#metadata}}
      <h3>Additional Information:</h3>
      <pre>{{.}}</pre>
      {{/metadata}}
    `;
  }

  getSeverityColor(severity) {
    const colors = {
      info: '#36a64f',
      warning: '#ffcc00',
      error: '#ff6600',
      critical: '#ff0000'
    };
    return colors[severity] || '#cccccc';
  }

  startEscalationProcessor() {
    // Check for escalations every minute
    cron.schedule('* * * * *', async () => {
      await this.processEscalations();
    });
  }

  async processEscalations() {
    // Find unresolved critical alerts older than escalation threshold
    const threshold = moment().subtract(15, 'minutes').toDate();
    
    const alerts = await this.db.collection('alerts').find({
      resolved: false,
      severity: 'critical',
      timestamp: { $lt: threshold },
      escalated: { $ne: true }
    }).toArray();

    for (const alert of alerts) {
      await this.escalateAlert(alert);
    }
  }

  async escalateAlert(alert) {
    // Mark as escalated
    await this.db.collection('alerts').updateOne(
      { _id: alert._id },
      { $set: { escalated: true, escalatedAt: new Date() } }
    );

    // Create escalation alert
    const escalationAlert = {
      type: 'escalation',
      severity: 'critical',
      title: `Escalation: ${alert.title}`,
      message: `Alert has been escalated: ${alert.message}`,
      source: alert.source,
      tags: { ...alert.tags, escalation: true },
      metadata: { originalAlert: alert.id }
    };

    await this.createAlert(escalationAlert);
    
    this.logger.warn(`Escalated alert: ${alert.id}`);
  }

  // CRUD operations for alert rules and notification channels
  async getAlertRules() {
    return await this.db.collection('alert_rules').find({}).toArray();
  }

  async createAlertRule(rule) {
    const result = await this.db.collection('alert_rules').insertOne({
      ...rule,
      id: require('uuid').v4(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { ...rule, _id: result.insertedId };
  }

  async updateAlertRule(id, rule) {
    const result = await this.db.collection('alert_rules').findOneAndUpdate(
      { id },
      { $set: { ...rule, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result.value;
  }

  async deleteAlertRule(id) {
    await this.db.collection('alert_rules').deleteOne({ id });
  }

  async getNotificationChannels() {
    return await this.db.collection('notification_channels').find({}).toArray();
  }

  async createNotificationChannel(channel) {
    const result = await this.db.collection('notification_channels').insertOne({
      ...channel,
      id: require('uuid').v4(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { ...channel, _id: result.insertedId };
  }

  async testNotificationChannel(id) {
    const channel = await this.db.collection('notification_channels').findOne({ id });
    if (!channel) {
      throw new Error('Notification channel not found');
    }

    const testAlert = {
      id: 'test',
      type: 'test',
      severity: 'info',
      title: 'Test Notification',
      message: 'This is a test notification from AIRIS EPM',
      source: 'alerts-service',
      timestamp: new Date()
    };

    await this.sendNotification(channel, testAlert);
  }

  async getAlertStats() {
    const today = moment().startOf('day').toDate();
    const hourAgo = moment().subtract(1, 'hour').toDate();

    const [dailyStats, hourlyStats, severityStats] = await Promise.all([
      this.db.collection('alerts').aggregate([
        { $match: { timestamp: { $gte: today } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]).toArray(),
      
      this.db.collection('alerts').aggregate([
        { $match: { timestamp: { $gte: hourAgo } } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]).toArray(),
      
      this.db.collection('alerts').aggregate([
        { $match: { resolved: false } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]).toArray()
    ]);

    return {
      daily: dailyStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      hourly: hourlyStats[0]?.count || 0,
      unresolved: severityStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      buffer: this.alertsBuffer.length
    };
  }

  subscribeToAlerts(callback) {
    const subscriber = this.subscribe('alerts:new', callback);
    return {
      unsubscribe: () => subscriber.then(s => s.unsubscribe())
    };
  }

  customHealthChecks() {
    return {
      kafka: {
        status: this.producer ? 'healthy' : 'unhealthy'
      },
      mongodb: {
        status: this.db ? 'healthy' : 'unhealthy'
      },
      providers: {
        email: this.providers.email ? 'configured' : 'not_configured',
        slack: this.providers.slack ? 'configured' : 'not_configured',
        sms: this.providers.sms ? 'configured' : 'not_configured'
      },
      buffer: {
        size: this.alertsBuffer.length,
        maxSize: this.bufferSize
      }
    };
  }

  getFeatures() {
    return [
      'intelligent-alerting',
      'multi-channel-notifications',
      'alert-rules-engine',
      'escalation-management',
      'notification-templates',
      'alert-suppression',
      'real-time-notifications'
    ];
  }

  async cleanup() {
    // Disconnect Kafka
    if (this.producer) {
      await this.producer.disconnect();
    }
    
    // Disconnect MongoDB
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
    
    this.logger.info('Alerts service cleanup complete');
  }
}

// Start the service
const service = new AlertsService();
service.start();