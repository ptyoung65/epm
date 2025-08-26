package com.airis.etl.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Raw Trace Model
 * 
 * Represents a raw distributed trace from various tracing sources.
 */
public class RawTrace implements Serializable {
    private final String traceId;
    private final String spanId;
    private final String parentSpanId;
    private final String operationName;
    private final String serviceName;
    private final long startTime;
    private final long endTime;
    private final long duration;
    private final String status;
    private final String kind;
    private final Map<String, String> tags;
    private final List<LogEntry> logs;
    private final Map<String, Object> metadata;

    @JsonCreator
    public RawTrace(
            @JsonProperty("traceId") String traceId,
            @JsonProperty("spanId") String spanId,
            @JsonProperty("parentSpanId") String parentSpanId,
            @JsonProperty("operationName") String operationName,
            @JsonProperty("serviceName") String serviceName,
            @JsonProperty("startTime") long startTime,
            @JsonProperty("endTime") long endTime,
            @JsonProperty("duration") long duration,
            @JsonProperty("status") String status,
            @JsonProperty("kind") String kind,
            @JsonProperty("tags") Map<String, String> tags,
            @JsonProperty("logs") List<LogEntry> logs,
            @JsonProperty("metadata") Map<String, Object> metadata) {
        this.traceId = traceId;
        this.spanId = spanId;
        this.parentSpanId = parentSpanId;
        this.operationName = operationName;
        this.serviceName = serviceName;
        this.startTime = startTime;
        this.endTime = endTime;
        this.duration = duration > 0 ? duration : (endTime - startTime);
        this.status = status;
        this.kind = kind;
        this.tags = tags;
        this.logs = logs;
        this.metadata = metadata;
    }

    public String getTraceId() { return traceId; }
    public String getSpanId() { return spanId; }
    public String getParentSpanId() { return parentSpanId; }
    public String getOperationName() { return operationName; }
    public String getServiceName() { return serviceName; }
    public long getStartTime() { return startTime; }
    public long getEndTime() { return endTime; }
    public long getDuration() { return duration; }
    public String getStatus() { return status; }
    public String getKind() { return kind; }
    public Map<String, String> getTags() { return tags; }
    public List<LogEntry> getLogs() { return logs; }
    public Map<String, Object> getMetadata() { return metadata; }

    public long getTimestamp() {
        return startTime;
    }

    public Instant getStartTimeAsInstant() {
        return Instant.ofEpochMilli(startTime);
    }

    public Instant getEndTimeAsInstant() {
        return Instant.ofEpochMilli(endTime);
    }

    public boolean isRootSpan() {
        return parentSpanId == null || parentSpanId.isEmpty();
    }

    public boolean isError() {
        return "error".equalsIgnoreCase(status) || "ERROR".equals(status);
    }

    public double getDurationInMillis() {
        return duration / 1000.0; // Convert from microseconds to milliseconds
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RawTrace rawTrace = (RawTrace) o;
        return startTime == rawTrace.startTime &&
               endTime == rawTrace.endTime &&
               duration == rawTrace.duration &&
               Objects.equals(traceId, rawTrace.traceId) &&
               Objects.equals(spanId, rawTrace.spanId) &&
               Objects.equals(parentSpanId, rawTrace.parentSpanId) &&
               Objects.equals(operationName, rawTrace.operationName) &&
               Objects.equals(serviceName, rawTrace.serviceName) &&
               Objects.equals(status, rawTrace.status) &&
               Objects.equals(kind, rawTrace.kind) &&
               Objects.equals(tags, rawTrace.tags) &&
               Objects.equals(logs, rawTrace.logs) &&
               Objects.equals(metadata, rawTrace.metadata);
    }

    @Override
    public int hashCode() {
        return Objects.hash(traceId, spanId, parentSpanId, operationName, serviceName,
                          startTime, endTime, duration, status, kind, tags, logs, metadata);
    }

    @Override
    public String toString() {
        return "RawTrace{" +
               "traceId='" + traceId + '\'' +
               ", spanId='" + spanId + '\'' +
               ", parentSpanId='" + parentSpanId + '\'' +
               ", operationName='" + operationName + '\'' +
               ", serviceName='" + serviceName + '\'' +
               ", startTime=" + startTime +
               ", endTime=" + endTime +
               ", duration=" + duration +
               ", status='" + status + '\'' +
               ", kind='" + kind + '\'' +
               ", tags=" + tags +
               ", logsCount=" + (logs != null ? logs.size() : 0) +
               ", metadata=" + metadata +
               '}';
    }

    /**
     * Log Entry within a span
     */
    public static class LogEntry implements Serializable {
        private final long timestamp;
        private final Map<String, String> fields;

        @JsonCreator
        public LogEntry(
                @JsonProperty("timestamp") long timestamp,
                @JsonProperty("fields") Map<String, String> fields) {
            this.timestamp = timestamp;
            this.fields = fields;
        }

        public long getTimestamp() { return timestamp; }
        public Map<String, String> getFields() { return fields; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            LogEntry logEntry = (LogEntry) o;
            return timestamp == logEntry.timestamp &&
                   Objects.equals(fields, logEntry.fields);
        }

        @Override
        public int hashCode() {
            return Objects.hash(timestamp, fields);
        }

        @Override
        public String toString() {
            return "LogEntry{" +
                   "timestamp=" + timestamp +
                   ", fields=" + fields +
                   '}';
        }
    }
}