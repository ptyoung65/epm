package com.airis.etl.model;

import com.airis.etl.transform.DataTransformationProcessor.LogLevel;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/**
 * Processed Log Entry Model
 * 
 * Represents a transformed and enriched log entry after processing through the ETL pipeline.
 */
public class ProcessedLogEntry implements Serializable {
    private final long timestamp;
    private final LogLevel level;
    private final String message;
    private final String logger;
    private final String thread;
    private final String application;
    private final String hostname;
    private final Map<String, Object> mdc;
    private final Map<String, Object> structuredFields;
    private final String category;
    private final String severity;
    
    @JsonCreator
    public ProcessedLogEntry(
            @JsonProperty("timestamp") long timestamp,
            @JsonProperty("level") LogLevel level,
            @JsonProperty("message") String message,
            @JsonProperty("logger") String logger,
            @JsonProperty("thread") String thread,
            @JsonProperty("application") String application,
            @JsonProperty("hostname") String hostname,
            @JsonProperty("mdc") Map<String, Object> mdc,
            @JsonProperty("structuredFields") Map<String, Object> structuredFields,
            @JsonProperty("category") String category,
            @JsonProperty("severity") String severity) {
        this.timestamp = timestamp;
        this.level = level;
        this.message = message;
        this.logger = logger;
        this.thread = thread;
        this.application = application;
        this.hostname = hostname;
        this.mdc = mdc;
        this.structuredFields = structuredFields;
        this.category = category;
        this.severity = severity;
    }
    
    public long getTimestamp() { return timestamp; }
    public LogLevel getLevel() { return level; }
    public String getMessage() { return message; }
    public String getLogger() { return logger; }
    public String getThread() { return thread; }
    public String getApplication() { return application; }
    public String getHostname() { return hostname; }
    public Map<String, Object> getMdc() { return mdc; }
    public Map<String, Object> getStructuredFields() { return structuredFields; }
    public String getCategory() { return category; }
    public String getSeverity() { return severity; }
    
    public Instant getTimestampAsInstant() {
        return Instant.ofEpochMilli(timestamp);
    }
    
    public boolean isError() {
        return LogLevel.ERROR.equals(level);
    }
    
    public boolean isWarning() {
        return LogLevel.WARN.equals(level);
    }
    
    public boolean isHighSeverity() {
        return isError() || "high".equals(severity);
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private long timestamp;
        private LogLevel level;
        private String message;
        private String logger;
        private String thread;
        private String application;
        private String hostname;
        private Map<String, Object> mdc;
        private Map<String, Object> structuredFields;
        private String category;
        private String severity;
        
        public Builder timestamp(long timestamp) { this.timestamp = timestamp; return this; }
        public Builder level(LogLevel level) { this.level = level; return this; }
        public Builder message(String message) { this.message = message; return this; }
        public Builder logger(String logger) { this.logger = logger; return this; }
        public Builder thread(String thread) { this.thread = thread; return this; }
        public Builder application(String application) { this.application = application; return this; }
        public Builder hostname(String hostname) { this.hostname = hostname; return this; }
        public Builder mdc(Map<String, Object> mdc) { this.mdc = mdc; return this; }
        public Builder structuredFields(Map<String, Object> structuredFields) { this.structuredFields = structuredFields; return this; }
        public Builder category(String category) { this.category = category; return this; }
        public Builder severity(String severity) { this.severity = severity; return this; }
        
        public ProcessedLogEntry build() {
            return new ProcessedLogEntry(timestamp, level, message, logger, thread, application, 
                                       hostname, mdc, structuredFields, category, severity);
        }
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ProcessedLogEntry that = (ProcessedLogEntry) o;
        return timestamp == that.timestamp &&
               level == that.level &&
               Objects.equals(message, that.message) &&
               Objects.equals(logger, that.logger) &&
               Objects.equals(thread, that.thread) &&
               Objects.equals(application, that.application) &&
               Objects.equals(hostname, that.hostname) &&
               Objects.equals(mdc, that.mdc) &&
               Objects.equals(structuredFields, that.structuredFields) &&
               Objects.equals(category, that.category) &&
               Objects.equals(severity, that.severity);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(timestamp, level, message, logger, thread, application, 
                          hostname, mdc, structuredFields, category, severity);
    }
    
    @Override
    public String toString() {
        return "ProcessedLogEntry{" +
               "timestamp=" + timestamp +
               ", level=" + level +
               ", message='" + (message != null ? message.substring(0, Math.min(message.length(), 100)) : null) + "...'" +
               ", logger='" + logger + '\'' +
               ", thread='" + thread + '\'' +
               ", application='" + application + '\'' +
               ", hostname='" + hostname + '\'' +
               ", category='" + category + '\'' +
               ", severity='" + severity + '\'' +
               ", mdc=" + mdc +
               ", structuredFields=" + structuredFields +
               '}';
    }
}