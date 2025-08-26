package com.airis.etl.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/**
 * Processed Metric Model
 * 
 * Represents a transformed and enriched metric after processing through the ETL pipeline.
 */
public class ProcessedMetric implements Serializable {
    private final String metricName;
    private final double value;
    private final long timestamp;
    private final Map<String, String> tags;
    private final Map<String, Object> metadata;
    private final String unit;
    private final String category;
    private final String severity;
    
    @JsonCreator
    public ProcessedMetric(
            @JsonProperty("metricName") String metricName,
            @JsonProperty("value") double value,
            @JsonProperty("timestamp") long timestamp,
            @JsonProperty("tags") Map<String, String> tags,
            @JsonProperty("metadata") Map<String, Object> metadata,
            @JsonProperty("unit") String unit,
            @JsonProperty("category") String category,
            @JsonProperty("severity") String severity) {
        this.metricName = metricName;
        this.value = value;
        this.timestamp = timestamp;
        this.tags = tags;
        this.metadata = metadata;
        this.unit = unit;
        this.category = category;
        this.severity = severity;
    }
    
    public String getMetricName() { return metricName; }
    public double getValue() { return value; }
    public long getTimestamp() { return timestamp; }
    public Map<String, String> getTags() { return tags; }
    public Map<String, Object> getMetadata() { return metadata; }
    public String getUnit() { return unit; }
    public String getCategory() { return category; }
    public String getSeverity() { return severity; }
    
    public Instant getTimestampAsInstant() {
        return Instant.ofEpochMilli(timestamp);
    }
    
    public boolean isHighSeverity() {
        return "high".equals(severity) || "critical".equals(severity);
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String metricName;
        private double value;
        private long timestamp;
        private Map<String, String> tags;
        private Map<String, Object> metadata;
        private String unit;
        private String category;
        private String severity;
        
        public Builder metricName(String metricName) { this.metricName = metricName; return this; }
        public Builder value(double value) { this.value = value; return this; }
        public Builder timestamp(long timestamp) { this.timestamp = timestamp; return this; }
        public Builder tags(Map<String, String> tags) { this.tags = tags; return this; }
        public Builder metadata(Map<String, Object> metadata) { this.metadata = metadata; return this; }
        public Builder unit(String unit) { this.unit = unit; return this; }
        public Builder category(String category) { this.category = category; return this; }
        public Builder severity(String severity) { this.severity = severity; return this; }
        
        public ProcessedMetric build() {
            return new ProcessedMetric(metricName, value, timestamp, tags, metadata, unit, category, severity);
        }
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ProcessedMetric that = (ProcessedMetric) o;
        return Double.compare(that.value, value) == 0 &&
               timestamp == that.timestamp &&
               Objects.equals(metricName, that.metricName) &&
               Objects.equals(tags, that.tags) &&
               Objects.equals(metadata, that.metadata) &&
               Objects.equals(unit, that.unit) &&
               Objects.equals(category, that.category) &&
               Objects.equals(severity, that.severity);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(metricName, value, timestamp, tags, metadata, unit, category, severity);
    }
    
    @Override
    public String toString() {
        return "ProcessedMetric{" +
               "metricName='" + metricName + '\'' +
               ", value=" + value +
               ", timestamp=" + timestamp +
               ", unit='" + unit + '\'' +
               ", category='" + category + '\'' +
               ", severity='" + severity + '\'' +
               ", tags=" + tags +
               ", metadata=" + metadata +
               '}';
    }
}