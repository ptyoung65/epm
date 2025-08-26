import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import { TraceProcessor } from '../processors/TraceProcessor';
import { DependencyAnalyzer } from '../analyzers/DependencyAnalyzer';
import { PerformanceAnalyzer } from '../analyzers/PerformanceAnalyzer';

export class TraceController {
  private traceProcessor: TraceProcessor;
  private dependencyAnalyzer: DependencyAnalyzer;
  private performanceAnalyzer: PerformanceAnalyzer;

  constructor(
    traceProcessor: TraceProcessor,
    dependencyAnalyzer: DependencyAnalyzer,
    performanceAnalyzer: PerformanceAnalyzer
  ) {
    this.traceProcessor = traceProcessor;
    this.dependencyAnalyzer = dependencyAnalyzer;
    this.performanceAnalyzer = performanceAnalyzer;
  }

  /**
   * Ingest single trace
   */
  ingestTrace = asyncHandler(async (req: Request, res: Response) => {
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
      logs: Joi.array().items(Joi.object()).optional().default([]),
      references: Joi.array().items(Joi.object()).optional().default([])
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      await this.traceProcessor.processTrace(value);
      res.status(202).json({
        status: 'accepted',
        message: 'Trace queued for processing'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to process trace',
        message: error.message
      });
    }
  });

  /**
   * Ingest batch of traces
   */
  ingestBatch = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.array().items(
      Joi.object({
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
        logs: Joi.array().items(Joi.object()).optional().default([]),
        references: Joi.array().items(Joi.object()).optional().default([])
      })
    ).min(1).max(500);

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      await this.traceProcessor.processBatch(value);
      res.status(202).json({
        status: 'accepted',
        count: value.length,
        message: 'Traces batch queued for processing'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to process traces batch',
        message: error.message
      });
    }
  });

  /**
   * Get traces with filtering
   */
  getTraces = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      serviceName: Joi.string().optional(),
      operationName: Joi.string().optional(),
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      minDuration: Joi.number().min(0).optional(),
      maxDuration: Joi.number().min(0).optional(),
      status: Joi.string().valid('ok', 'error', 'timeout').optional(),
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
      const traces = await this.traceProcessor.getTraces(value);
      res.json(traces);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get traces',
        message: error.message
      });
    }
  });

  /**
   * Get single trace by ID
   */
  getTrace = asyncHandler(async (req: Request, res: Response) => {
    const { traceId } = req.params;

    if (!traceId) {
      return res.status(400).json({
        error: 'Trace ID is required'
      });
    }

    try {
      const trace = await this.traceProcessor.getTrace(traceId);
      if (!trace) {
        return res.status(404).json({
          error: 'Trace not found'
        });
      }
      res.json(trace);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get trace',
        message: error.message
      });
    }
  });

  /**
   * Get spans for a trace
   */
  getTraceSpans = asyncHandler(async (req: Request, res: Response) => {
    const { traceId } = req.params;

    if (!traceId) {
      return res.status(400).json({
        error: 'Trace ID is required'
      });
    }

    try {
      const spans = await this.traceProcessor.getTraceSpans(traceId);
      res.json(spans);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get trace spans',
        message: error.message
      });
    }
  });

  /**
   * Get service dependencies
   */
  getDependencies = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      serviceName: Joi.string().optional(),
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      depth: Joi.number().min(1).max(10).default(3)
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const dependencies = await this.dependencyAnalyzer.getDependencies(value);
      res.json(dependencies);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get dependencies',
        message: error.message
      });
    }
  });

  /**
   * Get performance metrics
   */
  getPerformanceMetrics = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      serviceName: Joi.string().optional(),
      operationName: Joi.string().optional(),
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      groupBy: Joi.string().valid('service', 'operation', 'status').default('service')
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const metrics = await this.performanceAnalyzer.getPerformanceMetrics(value);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get performance metrics',
        message: error.message
      });
    }
  });

  /**
   * Get error analysis
   */
  getErrorAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      serviceName: Joi.string().optional(),
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
      const analysis = await this.performanceAnalyzer.getErrorAnalysis(value);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get error analysis',
        message: error.message
      });
    }
  });

  /**
   * Get latency analysis
   */
  getLatencyAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      serviceName: Joi.string().optional(),
      operationName: Joi.string().optional(),
      startTime: Joi.date().optional(),
      endTime: Joi.date().optional().default(() => new Date()),
      percentiles: Joi.array().items(Joi.number().min(0).max(100)).default([50, 90, 95, 99])
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const analysis = await this.performanceAnalyzer.getLatencyAnalysis(value);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get latency analysis',
        message: error.message
      });
    }
  });

  /**
   * Get service map
   */
  getServiceMap = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
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
      const serviceMap = await this.dependencyAnalyzer.getServiceMap(value);
      res.json(serviceMap);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get service map',
        message: error.message
      });
    }
  });

  /**
   * Get critical path for a trace
   */
  getCriticalPath = asyncHandler(async (req: Request, res: Response) => {
    const { traceId } = req.params;

    if (!traceId) {
      return res.status(400).json({
        error: 'Trace ID is required'
      });
    }

    try {
      const criticalPath = await this.performanceAnalyzer.getCriticalPath(traceId);
      res.json(criticalPath);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get critical path',
        message: error.message
      });
    }
  });

  /**
   * Update sampling configuration
   */
  updateSamplingConfig = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      serviceName: Joi.string().required(),
      sampleRate: Joi.number().min(0).max(1).required(),
      maxTracesPerSecond: Joi.number().min(1).optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      await this.traceProcessor.updateSamplingConfig(value);
      res.json({
        status: 'success',
        message: 'Sampling configuration updated'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update sampling configuration',
        message: error.message
      });
    }
  });

  /**
   * Cleanup old traces
   */
  cleanupOldTraces = asyncHandler(async (req: Request, res: Response) => {
    const schema = Joi.object({
      olderThanDays: Joi.number().min(1).required()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    try {
      const result = await this.traceProcessor.cleanupOldTraces(value.olderThanDays);
      res.json({
        status: 'success',
        message: 'Old traces cleaned up',
        deletedTraces: result.deletedTraces
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to cleanup old traces',
        message: error.message
      });
    }
  });

  /**
   * Reindex traces
   */
  reindexTraces = asyncHandler(async (req: Request, res: Response) => {
    try {
      await this.traceProcessor.reindexTraces();
      res.json({
        status: 'success',
        message: 'Traces reindexing started'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to start reindexing',
        message: error.message
      });
    }
  });
}