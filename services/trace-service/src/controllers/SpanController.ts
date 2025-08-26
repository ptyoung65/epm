import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import { TraceProcessor } from '../processors/TraceProcessor';
import { TraceIngestionQueue } from '../queues/TraceIngestionQueue';

export class SpanController {
  private traceProcessor: TraceProcessor;
  private ingestionQueue: TraceIngestionQueue;

  constructor(
    traceProcessor: TraceProcessor,
    ingestionQueue: TraceIngestionQueue
  ) {
    this.traceProcessor = traceProcessor;
    this.ingestionQueue = ingestionQueue;
  }

  /**
   * Ingest single span
   */
  ingestSpan = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      traceId: Joi.string().required(),
      spanId: Joi.string().required(),
      parentSpanId: Joi.string().optional(),
      operationName: Joi.string().required(),
      serviceName: Joi.string().required(),
      startTime: Joi.date().required(),
      endTime: Joi.date().required(),
      duration: Joi.number().min(0).optional(),
      status: Joi.string().valid('ok', 'error', 'timeout').default('ok'),
      tags: Joi.object().optional().default({}),
      logs: Joi.array().items(
        Joi.object({
          timestamp: Joi.date().required(),
          level: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
          message: Joi.string().required(),
          fields: Joi.object().optional().default({})
        })
      ).optional().default([]),
      references: Joi.array().items(
        Joi.object({
          refType: Joi.string().valid('childOf', 'followsFrom').required(),
          traceId: Joi.string().required(),
          spanId: Joi.string().required()
        })
      ).optional().default([]),
      process: Joi.object({
        serviceName: Joi.string().required(),
        tags: Joi.object().optional().default({})
      }).optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      // Calculate duration if not provided
      if (!value.duration) {
        value.duration = new Date(value.endTime).getTime() - new Date(value.startTime).getTime();
      }

      await this.ingestionQueue.add(value);
      res.status(202).json({
        status: 'accepted',
        message: 'Span queued for processing'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to queue span',
        message: error.message
      });
    }
  });

  /**
   * Get span by ID
   */
  getSpan = asyncHandler(async (req: Request, res: Response) => {
    const { spanId } = req.params;

    if (!spanId) {
      return res.status(400).json({
        error: 'Span ID is required'
      });
    }

    try {
      const span = await this.traceProcessor.getSpan(spanId);
      if (!span) {
        return res.status(404).json({
          error: 'Span not found'
        });
      }
      res.json(span);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get span',
        message: error.message
      });
    }
  });

  /**
   * Get span children
   */
  getSpanChildren = asyncHandler(async (req: Request, res: Response) => {
    const { spanId } = req.params;
    
    const schema = Joi.object({
      depth: Joi.number().min(1).max(10).default(1)
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    if (!spanId) {
      return res.status(400).json({
        error: 'Span ID is required'
      });
    }

    try {
      const children = await this.traceProcessor.getSpanChildren(spanId, value.depth);
      res.json(children);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get span children',
        message: error.message
      });
    }
  });

  /**
   * Get span logs
   */
  getSpanLogs = asyncHandler(async (req: Request, res: Response) => {
    const { spanId } = req.params;
    
    const schema = Joi.object({
      level: Joi.string().valid('debug', 'info', 'warn', 'error').optional(),
      limit: Joi.number().min(1).max(1000).default(100)
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    if (!spanId) {
      return res.status(400).json({
        error: 'Span ID is required'
      });
    }

    try {
      const logs = await this.traceProcessor.getSpanLogs(spanId, value);
      res.json(logs);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get span logs',
        message: error.message
      });
    }
  });

  /**
   * Get span timeline
   */
  getSpanTimeline = asyncHandler(async (req: Request, res: Response) => {
    const { traceId } = req.params;

    if (!traceId) {
      return res.status(400).json({
        error: 'Trace ID is required'
      });
    }

    try {
      const timeline = await this.traceProcessor.getSpanTimeline(traceId);
      res.json(timeline);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get span timeline',
        message: error.message
      });
    }
  });

  /**
   * Search spans
   */
  searchSpans = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      query: Joi.string().required(),
      serviceName: Joi.string().optional(),
      operationName: Joi.string().optional(),
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      tags: Joi.object().optional(),
      limit: Joi.number().min(1).max(1000).default(100),
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
      const spans = await this.traceProcessor.searchSpans(value);
      res.json(spans);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to search spans',
        message: error.message
      });
    }
  });

  /**
   * Get span statistics
   */
  getSpanStats = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      serviceName: Joi.string().optional(),
      operationName: Joi.string().optional(),
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      groupBy: Joi.string().valid('service', 'operation', 'status', 'hour', 'day').default('service')
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const stats = await this.traceProcessor.getSpanStats(value);
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get span statistics',
        message: error.message
      });
    }
  });

  /**
   * Add span annotation
   */
  addSpanAnnotation = asyncHandler(async (req: Request, res: Response) => {
    const { spanId } = req.params;
    
    const schema = Joi.object({
      timestamp: Joi.date().default(() => new Date()),
      key: Joi.string().required(),
      value: Joi.string().required(),
      description: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    if (!spanId) {
      return res.status(400).json({
        error: 'Span ID is required'
      });
    }

    try {
      await this.traceProcessor.addSpanAnnotation(spanId, value);
      res.json({
        status: 'success',
        message: 'Span annotation added'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to add span annotation',
        message: error.message
      });
    }
  });
}