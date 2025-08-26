package com.airis.etl.transform;

import com.airis.etl.model.*;
import org.apache.flink.api.common.functions.RichMapFunction;
import org.apache.flink.configuration.Configuration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Data Transformation Processor
 * 
 * Core transformation logic for converting raw data into processed formats
 * with enrichment, normalization, and standardization.
 */
public class DataTransformationProcessor {
    private static final Logger LOG = LoggerFactory.getLogger(DataTransformationProcessor.class);
    
    private final Map<String, Pattern> logPatterns;
    private final Map<String, String> serviceMapping;
    
    public DataTransformationProcessor() {
        this.logPatterns = initializeLogPatterns();
        this.serviceMapping = initializeServiceMapping();
        LOG.info("Data transformation processor initialized with {} log patterns and {} service mappings", 
                logPatterns.size(), serviceMapping.size());
    }
    
    /**
     * Transform raw metric to processed metric
     */
    public ProcessedMetric transformMetric(RawMetric rawMetric) {
        try {
            return ProcessedMetric.builder()
                .metricName(normalizeMetricName(rawMetric.getMetricName()))
                .value(rawMetric.getValue())
                .timestamp(rawMetric.getTimestamp())
                .tags(enrichTags(rawMetric.getTags()))
                .metadata(enrichMetadata(rawMetric.getMetadata()))
                .unit(determineUnit(rawMetric))
                .category(categorizeMetric(rawMetric))
                .severity(calculateSeverity(rawMetric))
                .build();
                
        } catch (Exception e) {
            LOG.error("Failed to transform metric: {}", rawMetric.getMetricName(), e);
            throw new RuntimeException("Metric transformation failed", e);
        }
    }
    
    /**
     * Transform raw log entry to processed log
     */
    public ProcessedLogEntry transformLogEntry(RawLogEntry rawLog) {
        try {
            LogLevel standardizedLevel = standardizeLogLevel(rawLog.getLevel());
            String parsedMessage = parseLogMessage(rawLog.getMessage());
            Map<String, Object> structuredFields = extractStructuredFields(rawLog);
            
            return ProcessedLogEntry.builder()
                .timestamp(rawLog.getTimestamp())
                .level(standardizedLevel)
                .message(parsedMessage)
                .logger(rawLog.getLogger())
                .thread(rawLog.getThread())
                .application(enrichApplication(rawLog.getApplication()))
                .hostname(normalizeHostname(rawLog.getHostname()))
                .mdc(enrichMDC(rawLog.getMdc()))
                .structuredFields(structuredFields)
                .category(categorizeLog(rawLog))
                .severity(calculateLogSeverity(standardizedLevel, parsedMessage))
                .build();
                
        } catch (Exception e) {
            LOG.error("Failed to transform log entry from application: {}", rawLog.getApplication(), e);
            throw new RuntimeException("Log transformation failed", e);
        }
    }
    
    /**
     * Transform raw trace to processed trace
     */
    public ProcessedTrace transformTrace(RawTrace rawTrace) {
        try {
            return ProcessedTrace.builder()
                .traceId(rawTrace.getTraceId())
                .spanId(rawTrace.getSpanId())
                .parentSpanId(rawTrace.getParentSpanId())
                .operationName(normalizeOperationName(rawTrace.getOperationName()))
                .startTime(rawTrace.getStartTime())
                .endTime(rawTrace.getEndTime())
                .duration(calculateDuration(rawTrace))
                .status(normalizeTraceStatus(rawTrace.getStatus()))
                .service(enrichService(rawTrace.getService()))
                .tags(enrichTraceTags(rawTrace.getTags()))
                .metadata(enrichTraceMetadata(rawTrace.getMetadata()))
                .category(categorizeTrace(rawTrace))
                .criticalPath(identifyCriticalPath(rawTrace))
                .build();
                
        } catch (Exception e) {
            LOG.error("Failed to transform trace: {}", rawTrace.getTraceId(), e);
            throw new RuntimeException("Trace transformation failed", e);
        }
    }
    
    /**
     * Transform raw event to processed event
     */
    public ProcessedEvent transformEvent(RawEvent rawEvent) {
        try {
            return ProcessedEvent.builder()
                .eventId(rawEvent.getEventId())
                .eventType(normalizeEventType(rawEvent.getEventType()))
                .category(enrichEventCategory(rawEvent.getCategory()))
                .action(rawEvent.getAction())
                .label(rawEvent.getLabel())
                .value(parseEventValue(rawEvent.getValue()))
                .timestamp(rawEvent.getTimestamp())
                .userId(anonymizeUserId(rawEvent.getUserId()))
                .sessionId(rawEvent.getSessionId())
                .source(enrichEventSource(rawEvent.getSource()))
                .properties(enrichEventProperties(rawEvent.getProperties()))
                .metadata(enrichEventMetadata(rawEvent.getMetadata()))
                .businessImpact(calculateBusinessImpact(rawEvent))
                .build();
                
        } catch (Exception e) {
            LOG.error("Failed to transform event: {}", rawEvent.getEventId(), e);
            throw new RuntimeException("Event transformation failed", e);
        }
    }
    
    /**
     * Transform raw alert to processed alert
     */
    public ProcessedAlert transformAlert(RawAlert rawAlert) {
        try {
            AlertSeverity standardizedSeverity = standardizeAlertSeverity(rawAlert.getSeverity());
            AlertStatus normalizedStatus = normalizeAlertStatus(rawAlert.getStatus());
            
            return ProcessedAlert.builder()
                .alertId(rawAlert.getAlertId())
                .alertName(normalizeAlertName(rawAlert.getAlertName()))
                .description(enrichAlertDescription(rawAlert.getDescription()))
                .severity(standardizedSeverity)
                .status(normalizedStatus)
                .source(enrichAlertSource(rawAlert.getSource()))
                .category(categorizeAlert(rawAlert))
                .timestamp(rawAlert.getTimestamp())
                .resolvedAt(rawAlert.getResolvedAt())
                .assignee(rawAlert.getAssignee())
                .escalationLevel(calculateEscalationLevel(rawAlert))
                .labels(enrichAlertLabels(rawAlert.getLabels()))
                .metadata(enrichAlertMetadata(rawAlert.getMetadata()))
                .businessImpact(calculateAlertBusinessImpact(rawAlert))
                .estimatedResolutionTime(estimateResolutionTime(rawAlert))
                .build();
                
        } catch (Exception e) {
            LOG.error("Failed to transform alert: {}", rawAlert.getAlertId(), e);
            throw new RuntimeException("Alert transformation failed", e);
        }
    }
    
    // Metric transformation helpers
    private String normalizeMetricName(String metricName) {
        return metricName != null ? metricName.toLowerCase().replace(' ', '_') : "unknown_metric";
    }
    
    private Map<String, String> enrichTags(Map<String, String> originalTags) {
        Map<String, String> enriched = new HashMap<>(originalTags != null ? originalTags : new HashMap<>());
        enriched.put("processed_at", String.valueOf(System.currentTimeMillis()));
        enriched.put("pipeline_version", "1.0.0");
        return enriched;
    }
    
    private Map<String, Object> enrichMetadata(Map<String, Object> originalMetadata) {
        Map<String, Object> enriched = new HashMap<>(originalMetadata != null ? originalMetadata : new HashMap<>());
        enriched.put("transformation_timestamp", System.currentTimeMillis());
        enriched.put("processor", "DataTransformationProcessor");
        return enriched;
    }
    
    private String determineUnit(RawMetric metric) {
        String metricName = metric.getMetricName().toLowerCase();
        if (metricName.contains("time") || metricName.contains("latency") || metricName.contains("duration")) {
            return "milliseconds";
        } else if (metricName.contains("rate") || metricName.contains("throughput")) {
            return "per_second";
        } else if (metricName.contains("memory") || metricName.contains("size")) {
            return "bytes";
        } else if (metricName.contains("cpu") || metricName.contains("utilization")) {
            return "percentage";
        }
        return "count";
    }
    
    private String categorizeMetric(RawMetric metric) {
        String metricName = metric.getMetricName().toLowerCase();
        if (metricName.contains("error") || metricName.contains("failure")) {
            return "error";
        } else if (metricName.contains("performance") || metricName.contains("latency")) {
            return "performance";
        } else if (metricName.contains("resource") || metricName.contains("memory") || metricName.contains("cpu")) {
            return "resource";
        } else if (metricName.contains("business") || metricName.contains("user")) {
            return "business";
        }
        return "system";
    }
    
    private String calculateSeverity(RawMetric metric) {
        double value = metric.getValue();
        String category = categorizeMetric(metric);
        
        if ("error".equals(category) && value > 0) {
            return value > 10 ? "high" : "medium";
        } else if ("performance".equals(category)) {
            return value > 1000 ? "high" : value > 500 ? "medium" : "low";
        }
        return "low";
    }
    
    // Log transformation helpers
    private LogLevel standardizeLogLevel(String level) {
        if (level == null) return LogLevel.INFO;
        
        switch (level.toUpperCase()) {
            case "ERROR":
            case "ERR":
            case "FATAL":
                return LogLevel.ERROR;
            case "WARN":
            case "WARNING":
                return LogLevel.WARN;
            case "INFO":
            case "INFORMATION":
                return LogLevel.INFO;
            case "DEBUG":
            case "DBG":
                return LogLevel.DEBUG;
            case "TRACE":
            case "TRC":
                return LogLevel.TRACE;
            default:
                return LogLevel.INFO;
        }
    }
    
    private String parseLogMessage(String message) {
        if (message == null) return "";
        
        // Apply log patterns for structured parsing
        for (Map.Entry<String, Pattern> entry : logPatterns.entrySet()) {
            if (entry.getValue().matcher(message).matches()) {
                return message + " [pattern:" + entry.getKey() + "]";
            }
        }
        
        return message;
    }
    
    private Map<String, Object> extractStructuredFields(RawLogEntry log) {
        Map<String, Object> fields = new HashMap<>();
        
        // Extract structured fields from log message
        String message = log.getMessage();
        if (message != null) {
            // Extract key-value pairs
            Pattern kvPattern = Pattern.compile("(\\w+)=([^\\s]+)");
            java.util.regex.Matcher matcher = kvPattern.matcher(message);
            while (matcher.find()) {
                fields.put(matcher.group(1), matcher.group(2));
            }
        }
        
        // Add MDC fields
        if (log.getMdc() != null) {
            fields.putAll(log.getMdc());
        }
        
        return fields;
    }
    
    // Helper initialization methods
    private Map<String, Pattern> initializeLogPatterns() {
        Map<String, Pattern> patterns = new HashMap<>();
        patterns.put("http_request", Pattern.compile(".*HTTP\\s+(GET|POST|PUT|DELETE).*"));
        patterns.put("sql_query", Pattern.compile(".*(SELECT|INSERT|UPDATE|DELETE).*"));
        patterns.put("exception", Pattern.compile(".*Exception.*"));
        patterns.put("authentication", Pattern.compile(".*(login|logout|auth|authenticate).*", Pattern.CASE_INSENSITIVE));
        return patterns;
    }
    
    private Map<String, String> initializeServiceMapping() {
        Map<String, String> mapping = new HashMap<>();
        mapping.put("web-service", "web");
        mapping.put("api-gateway", "gateway");
        mapping.put("user-service", "user");
        mapping.put("order-service", "order");
        return mapping;
    }
    
    // Additional helper methods would be implemented for other transformation functions
    private String enrichApplication(String application) { return application != null ? application : "unknown"; }
    private String normalizeHostname(String hostname) { return hostname != null ? hostname.toLowerCase() : "localhost"; }
    private Map<String, Object> enrichMDC(Map<String, Object> mdc) { return mdc != null ? mdc : new HashMap<>(); }
    private String categorizeLog(RawLogEntry log) { return "application"; }
    private String calculateLogSeverity(LogLevel level, String message) { return level.toString().toLowerCase(); }
    
    // Trace transformation helpers
    private String normalizeOperationName(String operationName) { return operationName != null ? operationName : "unknown_operation"; }
    private long calculateDuration(RawTrace trace) { return trace.getEndTime() - trace.getStartTime(); }
    private String normalizeTraceStatus(String status) { return status != null ? status.toLowerCase() : "ok"; }
    private String enrichService(String service) { return serviceMapping.getOrDefault(service, service); }
    private Map<String, String> enrichTraceTags(Map<String, String> tags) { return tags != null ? tags : new HashMap<>(); }
    private Map<String, Object> enrichTraceMetadata(Map<String, Object> metadata) { return metadata != null ? metadata : new HashMap<>(); }
    private String categorizeTrace(RawTrace trace) { return "distributed_tracing"; }
    private boolean identifyCriticalPath(RawTrace trace) { return calculateDuration(trace) > 1000; }
    
    // Event transformation helpers
    private String normalizeEventType(String eventType) { return eventType != null ? eventType.toLowerCase() : "unknown"; }
    private String enrichEventCategory(String category) { return category != null ? category : "general"; }
    private Double parseEventValue(String value) { 
        try { return value != null ? Double.parseDouble(value) : 0.0; } 
        catch (NumberFormatException e) { return 0.0; }
    }
    private String anonymizeUserId(String userId) { return userId != null ? "user_" + Math.abs(userId.hashCode()) : null; }
    private String enrichEventSource(String source) { return source != null ? source : "unknown_source"; }
    private Map<String, String> enrichEventProperties(Map<String, String> properties) { return properties != null ? properties : new HashMap<>(); }
    private Map<String, Object> enrichEventMetadata(Map<String, Object> metadata) { return metadata != null ? metadata : new HashMap<>(); }
    private String calculateBusinessImpact(RawEvent event) { return event.isBusinessEvent() ? "high" : "low"; }
    
    // Alert transformation helpers
    private AlertSeverity standardizeAlertSeverity(String severity) {
        if (severity == null) return AlertSeverity.LOW;
        switch (severity.toUpperCase()) {
            case "CRITICAL": case "FATAL": return AlertSeverity.CRITICAL;
            case "HIGH": case "ERROR": return AlertSeverity.HIGH;
            case "MEDIUM": case "WARN": case "WARNING": return AlertSeverity.MEDIUM;
            default: return AlertSeverity.LOW;
        }
    }
    
    private AlertStatus normalizeAlertStatus(String status) {
        if (status == null) return AlertStatus.OPEN;
        switch (status.toLowerCase()) {
            case "resolved": case "closed": return AlertStatus.RESOLVED;
            case "acknowledged": case "ack": return AlertStatus.ACKNOWLEDGED;
            case "suppressed": case "muted": return AlertStatus.SUPPRESSED;
            default: return AlertStatus.OPEN;
        }
    }
    
    private String normalizeAlertName(String alertName) { return alertName != null ? alertName : "unnamed_alert"; }
    private String enrichAlertDescription(String description) { return description != null ? description : "No description available"; }
    private String enrichAlertSource(String source) { return source != null ? source : "unknown_source"; }
    private String categorizeAlert(RawAlert alert) { return alert.isCritical() ? "system_critical" : "system_warning"; }
    private String calculateEscalationLevel(RawAlert alert) { return alert.getEscalationLevel() != null ? alert.getEscalationLevel() : "level_1"; }
    private Map<String, String> enrichAlertLabels(Map<String, String> labels) { return labels != null ? labels : new HashMap<>(); }
    private Map<String, Object> enrichAlertMetadata(Map<String, Object> metadata) { return metadata != null ? metadata : new HashMap<>(); }
    private String calculateAlertBusinessImpact(RawAlert alert) { return alert.isCritical() ? "high" : "medium"; }
    private long estimateResolutionTime(RawAlert alert) { 
        return alert.isCritical() ? 3600000L : 7200000L; // 1 hour or 2 hours in milliseconds
    }
}

// Supporting enums and classes
enum LogLevel { ERROR, WARN, INFO, DEBUG, TRACE }
enum AlertSeverity { CRITICAL, HIGH, MEDIUM, LOW }
enum AlertStatus { OPEN, ACKNOWLEDGED, SUPPRESSED, RESOLVED }