import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import { MetricsProcessor } from '../processors/MetricsProcessor';
import { MetricsIngestionQueue } from '../queues/MetricsIngestionQueue';

export class MetricsController {
  private metricsProcessor: MetricsProcessor;
  private ingestionQueue: MetricsIngestionQueue;

  constructor(
    metricsProcessor: MetricsProcessor,
    ingestionQueue: MetricsIngestionQueue
  ) {
    this.metricsProcessor = metricsProcessor;
    this.ingestionQueue = ingestionQueue;
  }

  /**
   * Ingest single metric
   */
  ingestMetric = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      name: Joi.string().required(),
      value: Joi.number().required(),
      timestamp: Joi.date().optional().default(() => new Date()),
      labels: Joi.object().pattern(Joi.string(), Joi.string()).optional().default({}),
      metadata: Joi.object().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      // Add to ingestion queue for async processing
      await this.ingestionQueue.add(value);

      res.status(202).json({
        status: 'accepted',
        message: 'Metric queued for processing'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to queue metric',
        message: error.message
      });
    }
  });

  /**
   * Ingest batch of metrics
   */
  ingestBatch = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.number().required(),
        timestamp: Joi.date().optional().default(() => new Date()),
        labels: Joi.object().pattern(Joi.string(), Joi.string()).optional().default({}),
        metadata: Joi.object().optional()
      })
    ).min(1).max(1000);

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      // Add batch to ingestion queue
      await this.ingestionQueue.addBatch(value);

      res.status(202).json({
        status: 'accepted',
        count: value.length,
        message: 'Metrics batch queued for processing'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to queue metrics batch',
        message: error.message
      });
    }
  });

  /**
   * Set retention policy for metrics
   */
  setRetentionPolicy = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      metricPattern: Joi.string().required(),
      retentionDays: Joi.number().min(1).max(3650).required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      await this.metricsProcessor.setRetentionPolicy(
        value.metricPattern,
        value.retentionDays
      );

      res.json({
        status: 'success',
        message: 'Retention policy updated'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to set retention policy',
        message: error.message
      });
    }
  });

  /**
   * Purge old data
   */
  purgeOldData = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      olderThanDays: Joi.number().min(1).required(),
      metricPattern: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const result = await this.metricsProcessor.purgeOldData(
        value.olderThanDays,
        value.metricPattern
      );

      res.json({
        status: 'success',
        message: 'Old data purged',
        deletedRows: result.deletedRows
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to purge old data',
        message: error.message
      });
    }
  });

  /**
   * Get ingestion statistics
   */
  getIngestionStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const stats = await this.ingestionQueue.getStats();
      const processorStats = await this.metricsProcessor.getStats();

      res.json({
        queue: stats,
        processor: processorStats
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get ingestion stats',
        message: error.message
      });
    }
  });

  /**
   * Pause/Resume ingestion
   */
  controlIngestion = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      action: Joi.string().valid('pause', 'resume').required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      if (value.action === 'pause') {
        await this.ingestionQueue.pause();
      } else {
        await this.ingestionQueue.resume();
      }

      res.json({
        status: 'success',
        message: `Ingestion ${value.action}d`
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to ${value.action} ingestion`,
        message: error.message
      });
    }
  });

  /**
   * Get metric cardinality
   */
  getCardinality = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      metricPattern: Joi.string().optional(),
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date())
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const cardinality = await this.metricsProcessor.getCardinality({
        metricPattern: value.metricPattern,
        startTime: value.startTime,
        endTime: value.endTime
      });

      res.json(cardinality);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get cardinality',
        message: error.message
      });
    }
  });

  /**
   * Validate metric name
   */
  validateMetricName = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      name: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const validation = this.metricsProcessor.validateMetricName(value.name);
      
      res.json({
        valid: validation.valid,
        errors: validation.errors,
        suggestions: validation.suggestions
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to validate metric name',
        message: error.message
      });
    }
  });

  /**
   * Get metric metadata
   */
  getMetricMetadata = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      metricName: Joi.string().required()
    });

    const { error, value } = schema.validate(req.params);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const metadata = await this.metricsProcessor.getMetricMetadata(value.metricName);
      
      if (!metadata) {
        return res.status(404).json({
          error: 'Metric not found',
          metricName: value.metricName
        });
      }

      res.json(metadata);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get metric metadata',
        message: error.message
      });
    }
  });
}