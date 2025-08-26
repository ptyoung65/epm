import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import { AlertProcessor } from '../processors/AlertProcessor';
import { AlertQueue } from '../queues/AlertQueue';
import { EscalationManager } from '../managers/EscalationManager';

export class AlertController {
  private alertProcessor: AlertProcessor;
  private alertQueue: AlertQueue;
  private escalationManager: EscalationManager;

  constructor(
    alertProcessor: AlertProcessor,
    alertQueue: AlertQueue,
    escalationManager: EscalationManager
  ) {
    this.alertProcessor = alertProcessor;
    this.alertQueue = alertQueue;
    this.escalationManager = escalationManager;
  }

  /**
   * Create single alert
   */
  createAlert = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      title: Joi.string().required().max(200),
      description: Joi.string().required().max(1000),
      severity: Joi.string().valid('critical', 'high', 'medium', 'low', 'info').required(),
      source: Joi.string().required(),
      serviceName: Joi.string().required(),
      tags: Joi.object().optional().default({}),
      metrics: Joi.object().optional(),
      timestamp: Joi.date().optional().default(() => new Date()),
      fingerprint: Joi.string().optional(),
      resolveTimeout: Joi.number().min(0).optional(),
      annotations: Joi.object().optional().default({}),
      labels: Joi.object().optional().default({})
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const alertId = await this.alertProcessor.createAlert(value);
      res.status(201).json({
        status: 'success',
        alertId,
        message: 'Alert created successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to create alert',
        message: error.message
      });
    }
  });

  /**
   * Create batch of alerts
   */
  createBatch = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.array().items(
      Joi.object({
        title: Joi.string().required().max(200),
        description: Joi.string().required().max(1000),
        severity: Joi.string().valid('critical', 'high', 'medium', 'low', 'info').required(),
        source: Joi.string().required(),
        serviceName: Joi.string().required(),
        tags: Joi.object().optional().default({}),
        metrics: Joi.object().optional(),
        timestamp: Joi.date().optional().default(() => new Date()),
        fingerprint: Joi.string().optional(),
        resolveTimeout: Joi.number().min(0).optional(),
        annotations: Joi.object().optional().default({}),
        labels: Joi.object().optional().default({})
      })
    ).min(1).max(100);

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const results = await this.alertProcessor.createBatch(value);
      res.status(201).json({
        status: 'success',
        created: results.length,
        alertIds: results,
        message: 'Alerts batch created successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to create alerts batch',
        message: error.message
      });
    }
  });

  /**
   * Get alerts with filtering
   */
  getAlerts = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      status: Joi.string().valid('active', 'acknowledged', 'resolved', 'suppressed').optional(),
      severity: Joi.string().valid('critical', 'high', 'medium', 'low', 'info').optional(),
      serviceName: Joi.string().optional(),
      source: Joi.string().optional(),
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      tags: Joi.object().optional(),
      labels: Joi.object().optional(),
      limit: Joi.number().min(1).max(1000).default(50),
      offset: Joi.number().min(0).default(0),
      sortBy: Joi.string().valid('timestamp', 'severity', 'status', 'serviceName').default('timestamp'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const result = await this.alertProcessor.getAlerts(value);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get alerts',
        message: error.message
      });
    }
  });

  /**
   * Get single alert by ID
   */
  getAlert = asyncHandler(async (req: Request, res: Response) => {
    const { alertId } = req.params;

    if (!alertId) {
      return res.status(400).json({
        error: 'Alert ID is required'
      });
    }

    try {
      const alert = await this.alertProcessor.getAlert(alertId);
      if (!alert) {
        return res.status(404).json({
          error: 'Alert not found'
        });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get alert',
        message: error.message
      });
    }
  });

  /**
   * Update alert status
   */
  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { alertId } = req.params;
    
    const schema = Joi.object({
      status: Joi.string().valid('active', 'acknowledged', 'resolved', 'suppressed').required(),
      comment: Joi.string().optional(),
      assignee: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    if (!alertId) {
      return res.status(400).json({
        error: 'Alert ID is required'
      });
    }

    try {
      await this.alertProcessor.updateStatus(alertId, value.status, {
        comment: value.comment,
        assignee: value.assignee,
        updatedBy: req.user?.id || 'system'
      });
      res.json({
        status: 'success',
        message: 'Alert status updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update alert status',
        message: error.message
      });
    }
  });

  /**
   * Acknowledge alert
   */
  acknowledgeAlert = asyncHandler(async (req: Request, res: Response) => {
    const { alertId } = req.params;
    
    const schema = Joi.object({
      comment: Joi.string().optional(),
      assignee: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    if (!alertId) {
      return res.status(400).json({
        error: 'Alert ID is required'
      });
    }

    try {
      await this.alertProcessor.acknowledgeAlert(alertId, {
        comment: value.comment,
        assignee: value.assignee,
        acknowledgedBy: req.user?.id || 'system'
      });
      res.json({
        status: 'success',
        message: 'Alert acknowledged successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to acknowledge alert',
        message: error.message
      });
    }
  });

  /**
   * Resolve alert
   */
  resolveAlert = asyncHandler(async (req: Request, res: Response) => {
    const { alertId } = req.params;
    
    const schema = Joi.object({
      resolution: Joi.string().required(),
      comment: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    if (!alertId) {
      return res.status(400).json({
        error: 'Alert ID is required'
      });
    }

    try {
      await this.alertProcessor.resolveAlert(alertId, {
        resolution: value.resolution,
        comment: value.comment,
        resolvedBy: req.user?.id || 'system'
      });
      res.json({
        status: 'success',
        message: 'Alert resolved successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to resolve alert',
        message: error.message
      });
    }
  });

  /**
   * Escalate alert
   */
  escalateAlert = asyncHandler(async (req: Request, res: Response) => {
    const { alertId } = req.params;
    
    const schema = Joi.object({
      escalationLevel: Joi.string().valid('L1', 'L2', 'L3', 'manager', 'executive').required(),
      reason: Joi.string().required(),
      urgency: Joi.string().valid('low', 'medium', 'high', 'critical').optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    if (!alertId) {
      return res.status(400).json({
        error: 'Alert ID is required'
      });
    }

    try {
      await this.escalationManager.escalateAlert(alertId, {
        level: value.escalationLevel,
        reason: value.reason,
        urgency: value.urgency,
        escalatedBy: req.user?.id || 'system'
      });
      res.json({
        status: 'success',
        message: 'Alert escalated successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to escalate alert',
        message: error.message
      });
    }
  });

  /**
   * Get alert summary statistics
   */
  getAlertSummary = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      groupBy: Joi.string().valid('severity', 'status', 'service', 'source', 'hour', 'day').default('severity')
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const summary = await this.alertProcessor.getAlertSummary(value);
      res.json(summary);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get alert summary',
        message: error.message
      });
    }
  });

  /**
   * Get alert trends
   */
  getAlertTrends = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      interval: Joi.string().valid('hour', 'day', 'week').default('hour'),
      serviceName: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const trends = await this.alertProcessor.getAlertTrends(value);
      res.json(trends);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get alert trends',
        message: error.message
      });
    }
  });

  /**
   * Get top services by alert count
   */
  getTopServices = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      limit: Joi.number().min(1).max(50).default(10)
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const topServices = await this.alertProcessor.getTopServices(value);
      res.json(topServices);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get top services',
        message: error.message
      });
    }
  });

  /**
   * Get escalations
   */
  getEscalations = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').optional(),
      level: Joi.string().valid('L1', 'L2', 'L3', 'manager', 'executive').optional(),
      limit: Joi.number().min(1).max(100).default(20),
      offset: Joi.number().min(0).default(0)
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const escalations = await this.escalationManager.getEscalations(value);
      res.json(escalations);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get escalations',
        message: error.message
      });
    }
  });

  /**
   * Create escalation policy
   */
  createEscalation = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      name: Joi.string().required(),
      description: Joi.string().optional(),
      rules: Joi.array().items(
        Joi.object({
          condition: Joi.object().required(),
          escalationSteps: Joi.array().items(
            Joi.object({
              level: Joi.string().valid('L1', 'L2', 'L3', 'manager', 'executive').required(),
              delayMinutes: Joi.number().min(0).required(),
              notificationChannels: Joi.array().items(Joi.string()).required()
            })
          ).required()
        })
      ).required(),
      enabled: Joi.boolean().default(true)
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const escalationId = await this.escalationManager.createEscalationPolicy(value);
      res.status(201).json({
        status: 'success',
        escalationId,
        message: 'Escalation policy created successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to create escalation policy',
        message: error.message
      });
    }
  });

  /**
   * Update escalation policy
   */
  updateEscalation = asyncHandler(async (req: Request, res: Response) => {
    const { escalationId } = req.params;
    
    const schema = Joi.object({
      name: Joi.string().optional(),
      description: Joi.string().optional(),
      rules: Joi.array().items(
        Joi.object({
          condition: Joi.object().required(),
          escalationSteps: Joi.array().items(
            Joi.object({
              level: Joi.string().valid('L1', 'L2', 'L3', 'manager', 'executive').required(),
              delayMinutes: Joi.number().min(0).required(),
              notificationChannels: Joi.array().items(Joi.string()).required()
            })
          ).required()
        })
      ).optional(),
      enabled: Joi.boolean().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    if (!escalationId) {
      return res.status(400).json({
        error: 'Escalation ID is required'
      });
    }

    try {
      await this.escalationManager.updateEscalationPolicy(escalationId, value);
      res.json({
        status: 'success',
        message: 'Escalation policy updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update escalation policy',
        message: error.message
      });
    }
  });

  /**
   * Get alert correlations
   */
  getCorrelations = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      alertId: Joi.string().optional(),
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      threshold: Joi.number().min(0).max(1).default(0.8)
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const correlations = await this.alertProcessor.getCorrelations(value);
      res.json(correlations);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get correlations',
        message: error.message
      });
    }
  });

  /**
   * Analyze correlations
   */
  analyzeCorrelations = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      startTime: Joi.date().required(),
      endTime: Joi.date().required(),
      services: Joi.array().items(Joi.string()).optional(),
      minConfidence: Joi.number().min(0).max(1).default(0.7)
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const analysis = await this.alertProcessor.analyzeCorrelations(value);
      res.json({
        status: 'success',
        analysis,
        message: 'Correlation analysis completed'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to analyze correlations',
        message: error.message
      });
    }
  });

  /**
   * Set maintenance mode
   */
  setMaintenanceMode = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      enabled: Joi.boolean().required(),
      services: Joi.array().items(Joi.string()).optional(),
      startTime: Joi.date().optional().default(() => new Date()),
      endTime: Joi.date().optional(),
      reason: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      await this.alertProcessor.setMaintenanceMode(value);
      res.json({
        status: 'success',
        message: `Maintenance mode ${value.enabled ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to set maintenance mode',
        message: error.message
      });
    }
  });

  /**
   * Cleanup old alerts
   */
  cleanupOldAlerts = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      olderThanDays: Joi.number().min(1).required(),
      status: Joi.string().valid('resolved', 'suppressed').optional()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const result = await this.alertProcessor.cleanupOldAlerts(value);
      res.json({
        status: 'success',
        message: 'Old alerts cleaned up',
        deletedCount: result.deletedCount
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to cleanup old alerts',
        message: error.message
      });
    }
  });

  /**
   * Bulk action on alerts
   */
  bulkAction = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      alertIds: Joi.array().items(Joi.string()).min(1).max(100).required(),
      action: Joi.string().valid('acknowledge', 'resolve', 'suppress', 'delete').required(),
      comment: Joi.string().optional(),
      resolution: Joi.string().when('action', { is: 'resolve', then: Joi.required() })
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const result = await this.alertProcessor.bulkAction(value);
      res.json({
        status: 'success',
        processed: result.processed,
        failed: result.failed,
        message: 'Bulk action completed'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to perform bulk action',
        message: error.message
      });
    }
  });
}