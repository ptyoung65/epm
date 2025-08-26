package com.airis.etl.pipeline;

import com.airis.etl.config.PipelineConfiguration;
import com.airis.etl.model.*;
import com.airis.etl.source.KafkaSourceFactory;
import com.airis.etl.sink.MultiSinkFactory;
import com.airis.etl.transformation.DataTransformationPipeline;
import com.airis.etl.quality.DataQualityValidator;
import com.airis.etl.aggregation.WindowedAggregator;
import com.airis.etl.anomaly.AnomalyDetector;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.datastream.KeyedStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.ProcessFunction;
import org.apache.flink.util.Collector;
import org.apache.flink.util.OutputTag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

/**
 * Streaming Pipeline
 * 
 * Main pipeline orchestrator that builds the complete ETL processing pipeline
 * using Apache Flink's streaming APIs.
 */
public class StreamingPipeline {
    private static final Logger LOG = LoggerFactory.getLogger(StreamingPipeline.class);
    
    private final StreamExecutionEnvironment env;
    private final PipelineConfiguration config;
    private final KafkaSourceFactory sourceFactory;
    private final MultiSinkFactory sinkFactory;
    private final DataTransformationPipeline transformer;
    private final DataQualityValidator qualityValidator;
    private final WindowedAggregator aggregator;
    private final AnomalyDetector anomalyDetector;

    // Side output tags for error handling
    private static final OutputTag<ProcessingError> PROCESSING_ERRORS = 
        new OutputTag<ProcessingError>("processing-errors") {};
    private static final OutputTag<DataQualityError> QUALITY_ERRORS = 
        new OutputTag<DataQualityError>("quality-errors") {};

    public StreamingPipeline(StreamExecutionEnvironment env, PipelineConfiguration config) {
        this.env = env;
        this.config = config;
        this.sourceFactory = new KafkaSourceFactory(config);
        this.sinkFactory = new MultiSinkFactory(config);
        this.transformer = new DataTransformationPipeline(config);
        this.qualityValidator = new DataQualityValidator(config);
        this.aggregator = new WindowedAggregator(config);
        this.anomalyDetector = new AnomalyDetector(config);
    }

    /**
     * Build the complete streaming pipeline
     */
    public void buildPipeline() {
        LOG.info("Building streaming pipeline...");

        try {
            // 1. Create data sources
            buildDataSources();
            
            // 2. Process metrics pipeline
            buildMetricsPipeline();
            
            // 3. Process logs pipeline  
            buildLogsPipeline();
            
            // 4. Process traces pipeline
            buildTracesPipeline();
            
            // 5. Process events pipeline
            buildEventsPipeline();
            
            // 6. Process alerts pipeline
            buildAlertsPipeline();
            
            // 7. Setup error handling
            setupErrorHandling();

            LOG.info("Streaming pipeline built successfully");

        } catch (Exception e) {
            LOG.error("Failed to build streaming pipeline", e);
            throw new RuntimeException("Pipeline build failed", e);
        }
    }

    /**
     * Create Kafka data sources for all input topics
     */
    private void buildDataSources() {
        LOG.info("Creating Kafka data sources...");
        
        // Setup watermark strategies for event time processing
        WatermarkStrategy<RawMetric> metricsWatermark = WatermarkStrategy
            .<RawMetric>forBoundedOutOfOrderness(Duration.ofSeconds(10))
            .withTimestampAssigner((metric, timestamp) -> metric.getTimestamp());
            
        WatermarkStrategy<RawLogEntry> logsWatermark = WatermarkStrategy
            .<RawLogEntry>forBoundedOutOfOrderness(Duration.ofSeconds(30))
            .withTimestampAssigner((log, timestamp) -> log.getTimestamp());
            
        WatermarkStrategy<RawTrace> tracesWatermark = WatermarkStrategy
            .<RawTrace>forBoundedOutOfOrderness(Duration.ofSeconds(5))
            .withTimestampAssigner((trace, timestamp) -> trace.getTimestamp());
            
        WatermarkStrategy<RawEvent> eventsWatermark = WatermarkStrategy
            .<RawEvent>forBoundedOutOfOrderness(Duration.ofSeconds(1))
            .withTimestampAssigner((event, timestamp) -> event.getTimestamp());

        LOG.info("Watermark strategies configured for event time processing");
    }

    /**
     * Build metrics processing pipeline
     */
    private void buildMetricsPipeline() {
        LOG.info("Building metrics processing pipeline...");

        // Create source stream
        DataStream<RawMetric> metricsSource = sourceFactory.createMetricsSource(env);

        // Apply watermarks
        DataStream<RawMetric> metricsWithWatermarks = metricsSource
            .assignTimestampsAndWatermarks(
                WatermarkStrategy.<RawMetric>forBoundedOutOfOrderness(Duration.ofSeconds(10))
                    .withTimestampAssigner((metric, timestamp) -> metric.getTimestamp())
            );

        // Data quality validation with side outputs for errors
        DataStream<RawMetric> validMetrics = metricsWithWatermarks
            .process(new ProcessFunction<RawMetric, RawMetric>() {
                @Override
                public void processElement(RawMetric metric, Context ctx, Collector<RawMetric> out) {
                    try {
                        if (qualityValidator.validateMetric(metric)) {
                            out.collect(metric);
                        } else {
                            ctx.output(QUALITY_ERRORS, 
                                new DataQualityError("Invalid metric", metric.toString()));
                        }
                    } catch (Exception e) {
                        ctx.output(PROCESSING_ERRORS, 
                            new ProcessingError("Metric validation failed", e.getMessage(), metric.toString()));
                    }
                }
            });

        // Transform metrics
        DataStream<ProcessedMetric> transformedMetrics = validMetrics
            .map(transformer::transformMetric)
            .name("Transform Metrics");

        // Key by metric name and source for aggregation
        KeyedStream<ProcessedMetric, String> keyedMetrics = transformedMetrics
            .keyBy(metric -> metric.getName() + ":" + metric.getSource());

        // Windowed aggregation
        DataStream<AggregatedMetric> aggregatedMetrics = aggregator
            .aggregateMetrics(keyedMetrics, config.getMetricsTumblingWindowSize());

        // Anomaly detection
        DataStream<AnomalyAlert> anomalies = anomalyDetector
            .detectMetricAnomalies(aggregatedMetrics);

        // Output to multiple sinks
        sinkFactory.createMetricsSinks(transformedMetrics, aggregatedMetrics, anomalies);

        LOG.info("Metrics processing pipeline configured");
    }

    /**
     * Build logs processing pipeline
     */
    private void buildLogsPipeline() {
        LOG.info("Building logs processing pipeline...");

        // Create source stream
        DataStream<RawLogEntry> logsSource = sourceFactory.createLogsSource(env);

        // Apply watermarks
        DataStream<RawLogEntry> logsWithWatermarks = logsSource
            .assignTimestampsAndWatermarks(
                WatermarkStrategy.<RawLogEntry>forBoundedOutOfOrderness(Duration.ofSeconds(30))
                    .withTimestampAssigner((log, timestamp) -> log.getTimestamp())
            );

        // Data quality validation
        DataStream<RawLogEntry> validLogs = logsWithWatermarks
            .filter(qualityValidator::validateLogEntry)
            .name("Validate Logs");

        // Transform logs
        DataStream<ProcessedLogEntry> transformedLogs = validLogs
            .map(transformer::transformLogEntry)
            .name("Transform Logs");

        // Extract structured data and enrich
        DataStream<EnrichedLogEntry> enrichedLogs = transformedLogs
            .map(transformer::enrichLogEntry)
            .name("Enrich Logs");

        // Key by application and log level for aggregation
        KeyedStream<EnrichedLogEntry, String> keyedLogs = enrichedLogs
            .keyBy(log -> log.getApplication() + ":" + log.getLevel());

        // Windowed aggregation for log statistics
        DataStream<LogStatistics> logStats = aggregator
            .aggregateLogs(keyedLogs, config.getLogsTumblingWindowSize());

        // Error pattern detection
        DataStream<ErrorPattern> errorPatterns = anomalyDetector
            .detectErrorPatterns(enrichedLogs);

        // Output to sinks
        sinkFactory.createLogsSinks(enrichedLogs, logStats, errorPatterns);

        LOG.info("Logs processing pipeline configured");
    }

    /**
     * Build traces processing pipeline
     */
    private void buildTracesPipeline() {
        LOG.info("Building traces processing pipeline...");

        // Create source stream
        DataStream<RawTrace> tracesSource = sourceFactory.createTracesSource(env);

        // Apply watermarks
        DataStream<RawTrace> tracesWithWatermarks = tracesSource
            .assignTimestampsAndWatermarks(
                WatermarkStrategy.<RawTrace>forBoundedOutOfOrderness(Duration.ofSeconds(5))
                    .withTimestampAssigner((trace, timestamp) -> trace.getTimestamp())
            );

        // Data quality validation
        DataStream<RawTrace> validTraces = tracesWithWatermarks
            .filter(qualityValidator::validateTrace)
            .name("Validate Traces");

        // Transform and correlate spans
        DataStream<ProcessedTrace> processedTraces = validTraces
            .keyBy(RawTrace::getTraceId)
            .process(transformer::correlateSpans)
            .name("Correlate Spans");

        // Calculate trace metrics (latency, error rates)
        DataStream<TraceMetrics> traceMetrics = processedTraces
            .map(transformer::calculateTraceMetrics)
            .name("Calculate Trace Metrics");

        // Service dependency mapping
        DataStream<ServiceDependency> serviceDependencies = processedTraces
            .flatMap(transformer::extractServiceDependencies)
            .name("Extract Service Dependencies");

        // Windowed aggregation for service performance
        KeyedStream<TraceMetrics, String> keyedTraceMetrics = traceMetrics
            .keyBy(TraceMetrics::getServiceName);

        DataStream<ServicePerformance> servicePerformance = aggregator
            .aggregateServicePerformance(keyedTraceMetrics, config.getTracesTumblingWindowSize());

        // Performance anomaly detection
        DataStream<PerformanceAlert> performanceAlerts = anomalyDetector
            .detectPerformanceAnomalies(servicePerformance);

        // Output to sinks
        sinkFactory.createTracesSinks(processedTraces, servicePerformance, performanceAlerts);

        LOG.info("Traces processing pipeline configured");
    }

    /**
     * Build events processing pipeline
     */
    private void buildEventsPipeline() {
        LOG.info("Building events processing pipeline...");

        // Create source stream
        DataStream<RawEvent> eventsSource = sourceFactory.createEventsSource(env);

        // Apply watermarks
        DataStream<RawEvent> eventsWithWatermarks = eventsSource
            .assignTimestampsAndWatermarks(
                WatermarkStrategy.<RawEvent>forBoundedOutOfOrderness(Duration.ofSeconds(1))
                    .withTimestampAssigner((event, timestamp) -> event.getTimestamp())
            );

        // Data quality validation
        DataStream<RawEvent> validEvents = eventsWithWatermarks
            .filter(qualityValidator::validateEvent)
            .name("Validate Events");

        // Transform and categorize events
        DataStream<ProcessedEvent> processedEvents = validEvents
            .map(transformer::transformEvent)
            .name("Transform Events");

        // Event correlation and session tracking
        KeyedStream<ProcessedEvent, String> keyedEvents = processedEvents
            .keyBy(ProcessedEvent::getSessionId);

        DataStream<EventSession> eventSessions = keyedEvents
            .process(transformer::correlateEvents)
            .name("Correlate Events");

        // Critical event detection
        DataStream<CriticalEvent> criticalEvents = processedEvents
            .filter(event -> event.getSeverity().ordinal() >= EventSeverity.HIGH.ordinal())
            .map(transformer::toCriticalEvent)
            .name("Extract Critical Events");

        // Output to sinks
        sinkFactory.createEventsSinks(processedEvents, eventSessions, criticalEvents);

        LOG.info("Events processing pipeline configured");
    }

    /**
     * Build alerts processing pipeline
     */
    private void buildAlertsPipeline() {
        LOG.info("Building alerts processing pipeline...");

        // Create source stream for external alerts
        DataStream<RawAlert> alertsSource = sourceFactory.createAlertsSource(env);

        // Transform alerts
        DataStream<ProcessedAlert> processedAlerts = alertsSource
            .map(transformer::transformAlert)
            .name("Transform Alerts");

        // Alert deduplication
        KeyedStream<ProcessedAlert, String> keyedAlerts = processedAlerts
            .keyBy(alert -> alert.getAlertId());

        DataStream<ProcessedAlert> deduplicatedAlerts = keyedAlerts
            .process(transformer::deduplicateAlerts)
            .name("Deduplicate Alerts");

        // Alert enrichment with context
        DataStream<EnrichedAlert> enrichedAlerts = deduplicatedAlerts
            .map(transformer::enrichAlert)
            .name("Enrich Alerts");

        // Output to notification systems
        sinkFactory.createAlertsSinks(enrichedAlerts);

        LOG.info("Alerts processing pipeline configured");
    }

    /**
     * Setup error handling and monitoring
     */
    private void setupErrorHandling() {
        LOG.info("Setting up error handling and monitoring...");

        // Create side outputs for errors would be handled here
        // This is a placeholder for error stream processing
        
        // In a real implementation, you would:
        // 1. Create error streams from side outputs
        // 2. Route errors to dead letter queue
        // 3. Setup alerting for critical errors
        // 4. Create error dashboards and monitoring

        LOG.info("Error handling and monitoring configured");
    }
}