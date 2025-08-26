package com.airis.etl.quality;

import com.airis.etl.model.*;
import org.apache.flink.api.common.functions.RichFilterFunction;
import org.apache.flink.api.common.state.MapState;
import org.apache.flink.api.common.state.MapStateDescriptor;
import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.metrics.Counter;
import org.apache.flink.metrics.Gauge;
import org.apache.flink.metrics.Histogram;
import org.apache.flink.runtime.metrics.DescriptiveStatisticsHistogram;
import org.apache.flink.streaming.api.functions.ProcessFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.Serializable;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

/**
 * Data Quality Validator
 * 
 * Comprehensive data quality validation system with schema validation,
 * business rule enforcement, anomaly detection, and quality scoring.
 */
public class DataQualityValidator<T> extends ProcessFunction<T, T> {
    private static final Logger LOG = LoggerFactory.getLogger(DataQualityValidator.class);
    
    private final DataQualityRules<T> qualityRules;
    private final double qualityThreshold;
    private final boolean enableAnomalyDetection;
    private final boolean strictMode;
    
    // State for quality tracking
    private transient MapState<String, QualityMetrics> fieldQualityMetrics;
    private transient ValueState<QualityProfile> qualityProfile;
    private transient ValueState<Long> lastProfileUpdate;
    
    // Metrics
    private transient Counter validRecords;
    private transient Counter invalidRecords;
    private transient Counter schemaViolations;
    private transient Counter businessRuleViolations;
    private transient Counter anomaliesDetected;
    private transient Histogram qualityScoreHistogram;
    private transient Gauge<Double> averageQualityScore;
    private transient final AtomicLong totalQualityScore = new AtomicLong(0);
    private transient final AtomicLong recordCount = new AtomicLong(0);
    
    public DataQualityValidator(DataQualityRules<T> qualityRules,
                               double qualityThreshold,
                               boolean enableAnomalyDetection,
                               boolean strictMode) {
        this.qualityRules = qualityRules;
        this.qualityThreshold = qualityThreshold;
        this.enableAnomalyDetection = enableAnomalyDetection;
        this.strictMode = strictMode;
        
        LOG.info("Data quality validator initialized: threshold={}, anomaly_detection={}, strict_mode={}",
                qualityThreshold, enableAnomalyDetection, strictMode);
    }
    
    @Override
    public void open(Configuration parameters) throws Exception {
        super.open(parameters);
        
        // Initialize state
        MapStateDescriptor<String, QualityMetrics> metricsDescriptor = 
            new MapStateDescriptor<>("field_quality_metrics",
                                   TypeInformation.of(String.class),
                                   TypeInformation.of(QualityMetrics.class));
        fieldQualityMetrics = getRuntimeContext().getMapState(metricsDescriptor);
        
        ValueStateDescriptor<QualityProfile> profileDescriptor = 
            new ValueStateDescriptor<>("quality_profile",
                                     TypeInformation.of(QualityProfile.class));
        qualityProfile = getRuntimeContext().getState(profileDescriptor);
        
        ValueStateDescriptor<Long> lastUpdateDescriptor = 
            new ValueStateDescriptor<>("last_profile_update",
                                     TypeInformation.of(Long.class));
        lastProfileUpdate = getRuntimeContext().getState(lastUpdateDescriptor);
        
        // Initialize metrics
        validRecords = getRuntimeContext().getMetricGroup().counter("quality_valid_records");
        invalidRecords = getRuntimeContext().getMetricGroup().counter("quality_invalid_records");
        schemaViolations = getRuntimeContext().getMetricGroup().counter("quality_schema_violations");
        businessRuleViolations = getRuntimeContext().getMetricGroup().counter("quality_business_rule_violations");
        anomaliesDetected = getRuntimeContext().getMetricGroup().counter("quality_anomalies_detected");
        
        qualityScoreHistogram = getRuntimeContext().getMetricGroup()
            .histogram("quality_score", new DescriptiveStatisticsHistogram(1000));
        
        averageQualityScore = getRuntimeContext().getMetricGroup()
            .gauge("average_quality_score", this::calculateAverageQualityScore);
        
        LOG.debug("Data quality validator opened successfully");
    }
    
    @Override
    public void processElement(T value, ProcessFunction<T, T>.Context ctx, Collector<T> out) throws Exception {
        long currentTime = ctx.timestamp() != null ? ctx.timestamp() : System.currentTimeMillis();
        
        try {
            // Perform comprehensive quality validation
            QualityValidationResult result = validateDataQuality(value, currentTime);
            
            // Update quality metrics
            updateQualityMetrics(result, currentTime);
            
            // Update quality profile
            updateQualityProfile(result, currentTime);
            
            // Record quality score
            qualityScoreHistogram.update((long) (result.overallScore * 100));
            totalQualityScore.addAndGet((long) (result.overallScore * 100));
            recordCount.incrementAndGet();
            
            // Decide whether to pass or filter the record
            if (shouldPassRecord(result)) {
                out.collect(value);
                validRecords.inc();
                LOG.trace("Record passed quality validation: score={}, violations={}",
                         result.overallScore, result.violations.size());
            } else {
                invalidRecords.inc();
                LOG.debug("Record failed quality validation: score={}, violations={}, record={}",
                         result.overallScore, result.violations.size(), value.toString());
                
                // Optionally send to dead letter queue
                handleInvalidRecord(value, result, ctx);
            }
            
        } catch (Exception e) {
            LOG.error("Error during quality validation: {}", e.getMessage(), e);
            invalidRecords.inc();
            
            if (strictMode) {
                throw e;
            } else {
                // In non-strict mode, pass the record with warning
                out.collect(value);
                LOG.warn("Passing record despite validation error in non-strict mode");
            }
        }
    }
    
    /**
     * Comprehensive data quality validation
     */
    private QualityValidationResult validateDataQuality(T value, long currentTime) throws Exception {
        QualityValidationResult result = new QualityValidationResult();
        result.timestamp = currentTime;
        result.recordId = getRecordId(value);
        
        // 1. Schema validation
        ValidationResult schemaResult = validateSchema(value);
        result.schemaValid = schemaResult.isValid;
        if (!schemaResult.isValid) {
            result.violations.addAll(schemaResult.violations);
            schemaViolations.inc();
        }
        
        // 2. Business rule validation
        ValidationResult businessResult = validateBusinessRules(value);
        result.businessRulesValid = businessResult.isValid;
        if (!businessResult.isValid) {
            result.violations.addAll(businessResult.violations);
            businessRuleViolations.inc();
        }
        
        // 3. Data consistency validation
        ValidationResult consistencyResult = validateConsistency(value, currentTime);
        result.consistencyValid = consistencyResult.isValid;
        if (!consistencyResult.isValid) {
            result.violations.addAll(consistencyResult.violations);
        }
        
        // 4. Anomaly detection
        if (enableAnomalyDetection) {
            ValidationResult anomalyResult = detectAnomalies(value, currentTime);
            result.anomalyFree = anomalyResult.isValid;
            if (!anomalyResult.isValid) {
                result.violations.addAll(anomalyResult.violations);
                anomaliesDetected.inc();
            }
        } else {
            result.anomalyFree = true;
        }
        
        // 5. Calculate overall quality score
        result.overallScore = calculateQualityScore(result);
        
        return result;
    }
    
    /**
     * Validate data schema and structure
     */
    private ValidationResult validateSchema(T value) {
        ValidationResult result = new ValidationResult();
        
        try {
            // Perform type-specific schema validation
            if (value instanceof RawMetric) {
                validateMetricSchema((RawMetric) value, result);
            } else if (value instanceof RawLogEntry) {
                validateLogSchema((RawLogEntry) value, result);
            } else if (value instanceof RawTrace) {
                validateTraceSchema((RawTrace) value, result);
            } else if (value instanceof RawEvent) {
                validateEventSchema((RawEvent) value, result);
            } else if (value instanceof RawAlert) {
                validateAlertSchema((RawAlert) value, result);
            } else {
                // Generic validation
                validateGenericSchema(value, result);
            }
            
        } catch (Exception e) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_ERROR,
                "schema_validation_error",
                "Error during schema validation: " + e.getMessage(),
                QualitySeverity.HIGH
            ));
        }
        
        return result;
    }
    
    /**
     * Validate business rules
     */
    private ValidationResult validateBusinessRules(T value) {
        ValidationResult result = new ValidationResult();
        
        if (qualityRules != null) {
            for (BusinessRule<T> rule : qualityRules.getBusinessRules()) {
                try {
                    if (!rule.validate(value)) {
                        result.isValid = false;
                        result.violations.add(new QualityViolation(
                            QualityViolationType.BUSINESS_RULE,
                            rule.getRuleId(),
                            rule.getViolationMessage(),
                            rule.getSeverity()
                        ));
                    }
                } catch (Exception e) {
                    result.isValid = false;
                    result.violations.add(new QualityViolation(
                        QualityViolationType.BUSINESS_RULE,
                        rule.getRuleId(),
                        "Business rule validation error: " + e.getMessage(),
                        QualitySeverity.MEDIUM
                    ));
                }
            }
        }
        
        return result;
    }
    
    /**
     * Validate data consistency
     */
    private ValidationResult validateConsistency(T value, long currentTime) throws Exception {
        ValidationResult result = new ValidationResult();
        
        // Check timestamp consistency
        if (!validateTimestamp(value, currentTime)) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.CONSISTENCY,
                "timestamp_consistency",
                "Timestamp is outside acceptable range",
                QualitySeverity.MEDIUM
            ));
        }
        
        // Check field consistency
        if (!validateFieldConsistency(value)) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.CONSISTENCY,
                "field_consistency",
                "Field values are inconsistent",
                QualitySeverity.LOW
            ));
        }
        
        return result;
    }
    
    /**
     * Detect anomalies in data
     */
    private ValidationResult detectAnomalies(T value, long currentTime) throws Exception {
        ValidationResult result = new ValidationResult();
        
        QualityProfile profile = qualityProfile.value();
        if (profile == null) {
            // No profile yet, consider normal
            return result;
        }
        
        // Statistical anomaly detection
        if (detectStatisticalAnomalies(value, profile)) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.ANOMALY,
                "statistical_anomaly",
                "Statistical anomaly detected",
                QualitySeverity.LOW
            ));
        }
        
        // Pattern anomaly detection
        if (detectPatternAnomalies(value, profile)) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.ANOMALY,
                "pattern_anomaly",
                "Pattern anomaly detected",
                QualitySeverity.LOW
            ));
        }
        
        return result;
    }
    
    /**
     * Calculate overall quality score
     */
    private double calculateQualityScore(QualityValidationResult result) {
        double score = 1.0;
        
        // Deduct points for violations based on severity
        for (QualityViolation violation : result.violations) {
            switch (violation.severity) {
                case HIGH:
                    score -= 0.3;
                    break;
                case MEDIUM:
                    score -= 0.2;
                    break;
                case LOW:
                    score -= 0.1;
                    break;
            }
        }
        
        // Ensure score is not negative
        return Math.max(0.0, score);
    }
    
    /**
     * Determine if record should pass validation
     */
    private boolean shouldPassRecord(QualityValidationResult result) {
        if (strictMode) {
            // In strict mode, record must be perfect
            return result.violations.isEmpty();
        } else {
            // In normal mode, use quality threshold
            return result.overallScore >= qualityThreshold;
        }
    }
    
    /**
     * Handle invalid record
     */
    private void handleInvalidRecord(T value, QualityValidationResult result, ProcessFunction<T, T>.Context ctx) {
        // Could send to dead letter queue using side output
        // ctx.output(deadLetterTag, new DeadLetterRecord(value, result));
        
        LOG.debug("Invalid record handled: violations={}", result.violations.size());
    }
    
    /**
     * Update quality metrics
     */
    private void updateQualityMetrics(QualityValidationResult result, long currentTime) throws Exception {
        for (QualityViolation violation : result.violations) {
            String fieldKey = violation.fieldName;
            QualityMetrics metrics = fieldQualityMetrics.get(fieldKey);
            if (metrics == null) {
                metrics = new QualityMetrics(fieldKey);
            }
            
            metrics.violationCount++;
            metrics.lastViolationTime = currentTime;
            metrics.violationTypes.put(violation.type.toString(), 
                                     metrics.violationTypes.getOrDefault(violation.type.toString(), 0) + 1);
            
            fieldQualityMetrics.put(fieldKey, metrics);
        }
    }
    
    /**
     * Update quality profile
     */
    private void updateQualityProfile(QualityValidationResult result, long currentTime) throws Exception {
        QualityProfile profile = qualityProfile.value();
        if (profile == null) {
            profile = new QualityProfile();
        }
        
        profile.totalRecords++;
        profile.totalScore += result.overallScore;
        profile.lastUpdateTime = currentTime;
        
        if (!result.violations.isEmpty()) {
            profile.violationCount++;
        }
        
        // Update profile every 1000 records or 5 minutes
        Long lastUpdate = lastProfileUpdate.value();
        if (lastUpdate == null || 
            currentTime - lastUpdate > 300000L || 
            profile.totalRecords % 1000 == 0) {
            
            profile.averageScore = profile.totalScore / profile.totalRecords;
            qualityProfile.update(profile);
            lastProfileUpdate.update(currentTime);
        }
    }
    
    /**
     * Calculate average quality score
     */
    private double calculateAverageQualityScore() {
        long count = recordCount.get();
        return count > 0 ? (double) totalQualityScore.get() / (count * 100) : 0.0;
    }
    
    // Schema validation methods for specific types
    private void validateMetricSchema(RawMetric metric, ValidationResult result) {
        if (metric.getMetricName() == null || metric.getMetricName().trim().isEmpty()) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_REQUIRED,
                "metric_name",
                "Metric name is required",
                QualitySeverity.HIGH
            ));
        }
        
        if (Double.isNaN(metric.getValue()) || Double.isInfinite(metric.getValue())) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_TYPE,
                "metric_value",
                "Metric value is not a valid number",
                QualitySeverity.HIGH
            ));
        }
        
        if (metric.getTimestamp() <= 0) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_RANGE,
                "timestamp",
                "Timestamp must be positive",
                QualitySeverity.HIGH
            ));
        }
    }
    
    private void validateLogSchema(RawLogEntry log, ValidationResult result) {
        if (log.getMessage() == null || log.getMessage().trim().isEmpty()) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_REQUIRED,
                "log_message",
                "Log message is required",
                QualitySeverity.HIGH
            ));
        }
        
        if (log.getLevel() == null || log.getLevel().trim().isEmpty()) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_REQUIRED,
                "log_level",
                "Log level is required",
                QualitySeverity.MEDIUM
            ));
        }
    }
    
    private void validateTraceSchema(RawTrace trace, ValidationResult result) {
        if (trace.getTraceId() == null || trace.getTraceId().trim().isEmpty()) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_REQUIRED,
                "trace_id",
                "Trace ID is required",
                QualitySeverity.HIGH
            ));
        }
        
        if (trace.getSpanId() == null || trace.getSpanId().trim().isEmpty()) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_REQUIRED,
                "span_id",
                "Span ID is required",
                QualitySeverity.HIGH
            ));
        }
        
        if (trace.getEndTime() < trace.getStartTime()) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_LOGIC,
                "trace_timing",
                "End time cannot be before start time",
                QualitySeverity.HIGH
            ));
        }
    }
    
    private void validateEventSchema(RawEvent event, ValidationResult result) {
        if (event.getEventId() == null || event.getEventId().trim().isEmpty()) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_REQUIRED,
                "event_id",
                "Event ID is required",
                QualitySeverity.HIGH
            ));
        }
        
        if (event.getEventType() == null || event.getEventType().trim().isEmpty()) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_REQUIRED,
                "event_type",
                "Event type is required",
                QualitySeverity.MEDIUM
            ));
        }
    }
    
    private void validateAlertSchema(RawAlert alert, ValidationResult result) {
        if (alert.getAlertId() == null || alert.getAlertId().trim().isEmpty()) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_REQUIRED,
                "alert_id",
                "Alert ID is required",
                QualitySeverity.HIGH
            ));
        }
        
        if (alert.getSeverity() == null || alert.getSeverity().trim().isEmpty()) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_REQUIRED,
                "alert_severity",
                "Alert severity is required",
                QualitySeverity.MEDIUM
            ));
        }
    }
    
    private void validateGenericSchema(T value, ValidationResult result) {
        if (value == null) {
            result.isValid = false;
            result.violations.add(new QualityViolation(
                QualityViolationType.SCHEMA_REQUIRED,
                "object",
                "Object cannot be null",
                QualitySeverity.HIGH
            ));
        }
    }
    
    // Helper methods
    private String getRecordId(T value) {
        // Try to extract record ID based on type
        if (value instanceof RawMetric) {
            return ((RawMetric) value).getMetricName() + "_" + ((RawMetric) value).getTimestamp();
        } else if (value instanceof RawLogEntry) {
            return "log_" + ((RawLogEntry) value).getTimestamp();
        } else if (value instanceof RawTrace) {
            return ((RawTrace) value).getTraceId() + "_" + ((RawTrace) value).getSpanId();
        } else if (value instanceof RawEvent) {
            return ((RawEvent) value).getEventId();
        } else if (value instanceof RawAlert) {
            return ((RawAlert) value).getAlertId();
        }
        return "unknown_" + System.nanoTime();
    }
    
    private boolean validateTimestamp(T value, long currentTime) {
        long recordTimestamp = 0;
        
        if (value instanceof RawMetric) {
            recordTimestamp = ((RawMetric) value).getTimestamp();
        } else if (value instanceof RawLogEntry) {
            recordTimestamp = ((RawLogEntry) value).getTimestamp();
        } else if (value instanceof RawTrace) {
            recordTimestamp = ((RawTrace) value).getStartTime();
        } else if (value instanceof RawEvent) {
            recordTimestamp = ((RawEvent) value).getTimestamp();
        } else if (value instanceof RawAlert) {
            recordTimestamp = ((RawAlert) value).getTimestamp();
        }
        
        // Allow timestamps within 1 hour of current time (past or future)
        long timeDiff = Math.abs(currentTime - recordTimestamp);
        return timeDiff <= 3600000L; // 1 hour in milliseconds
    }
    
    private boolean validateFieldConsistency(T value) {
        // Implement field consistency checks based on data type
        return true; // Placeholder
    }
    
    private boolean detectStatisticalAnomalies(T value, QualityProfile profile) {
        // Implement statistical anomaly detection
        return false; // Placeholder
    }
    
    private boolean detectPatternAnomalies(T value, QualityProfile profile) {
        // Implement pattern-based anomaly detection
        return false; // Placeholder
    }
    
    // Supporting classes
    public static class ValidationResult {
        public boolean isValid = true;
        public java.util.List<QualityViolation> violations = new java.util.ArrayList<>();
    }
    
    public static class QualityValidationResult {
        public String recordId;
        public long timestamp;
        public boolean schemaValid = true;
        public boolean businessRulesValid = true;
        public boolean consistencyValid = true;
        public boolean anomalyFree = true;
        public double overallScore = 1.0;
        public java.util.List<QualityViolation> violations = new java.util.ArrayList<>();
    }
    
    public static class QualityViolation implements Serializable {
        public QualityViolationType type;
        public String fieldName;
        public String message;
        public QualitySeverity severity;
        
        public QualityViolation(QualityViolationType type, String fieldName, String message, QualitySeverity severity) {
            this.type = type;
            this.fieldName = fieldName;
            this.message = message;
            this.severity = severity;
        }
    }
    
    public enum QualityViolationType {
        SCHEMA_REQUIRED, SCHEMA_TYPE, SCHEMA_RANGE, SCHEMA_LOGIC, SCHEMA_ERROR,
        BUSINESS_RULE, CONSISTENCY, ANOMALY
    }
    
    public enum QualitySeverity {
        HIGH, MEDIUM, LOW
    }
    
    public static class QualityMetrics implements Serializable {
        public String fieldName;
        public long violationCount = 0;
        public long lastViolationTime = 0;
        public Map<String, Integer> violationTypes = new HashMap<>();
        
        public QualityMetrics(String fieldName) {
            this.fieldName = fieldName;
        }
    }
    
    public static class QualityProfile implements Serializable {
        public long totalRecords = 0;
        public long violationCount = 0;
        public double totalScore = 0.0;
        public double averageScore = 0.0;
        public long lastUpdateTime = 0;
    }
    
    public interface DataQualityRules<T> {
        java.util.List<BusinessRule<T>> getBusinessRules();
    }
    
    public interface BusinessRule<T> {
        boolean validate(T value);
        String getRuleId();
        String getViolationMessage();
        QualitySeverity getSeverity();
    }
}