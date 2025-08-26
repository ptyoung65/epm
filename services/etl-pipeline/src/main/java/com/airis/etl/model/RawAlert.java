package com.airis.etl.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/**
 * Raw Alert Model
 * 
 * Represents a raw alert from various alerting sources.
 */
public class RawAlert implements Serializable {
    private final String alertId;
    private final String alertName;
    private final String description;
    private final String severity;
    private final String status;
    private final String source;
    private final String category;
    private final long timestamp;
    private final long resolvedAt;
    private final String assignee;
    private final String escalationLevel;
    private final Map<String, String> labels;
    private final Map<String, Object> annotations;
    private final Map<String, Object> metadata;

    @JsonCreator
    public RawAlert(
            @JsonProperty("alertId") String alertId,
            @JsonProperty("alertName") String alertName,
            @JsonProperty("description") String description,
            @JsonProperty("severity") String severity,
            @JsonProperty("status") String status,
            @JsonProperty("source") String source,
            @JsonProperty("category") String category,
            @JsonProperty("timestamp") long timestamp,
            @JsonProperty("resolvedAt") long resolvedAt,
            @JsonProperty("assignee") String assignee,
            @JsonProperty("escalationLevel") String escalationLevel,
            @JsonProperty("labels") Map<String, String> labels,
            @JsonProperty("annotations") Map<String, Object> annotations,
            @JsonProperty("metadata") Map<String, Object> metadata) {
        this.alertId = alertId;
        this.alertName = alertName;
        this.description = description;
        this.severity = severity;
        this.status = status;
        this.source = source;
        this.category = category;
        this.timestamp = timestamp;
        this.resolvedAt = resolvedAt;
        this.assignee = assignee;
        this.escalationLevel = escalationLevel;
        this.labels = labels;
        this.annotations = annotations;
        this.metadata = metadata;
    }

    public String getAlertId() { return alertId; }
    public String getAlertName() { return alertName; }
    public String getDescription() { return description; }
    public String getSeverity() { return severity; }
    public String getStatus() { return status; }
    public String getSource() { return source; }
    public String getCategory() { return category; }
    public long getTimestamp() { return timestamp; }
    public long getResolvedAt() { return resolvedAt; }
    public String getAssignee() { return assignee; }
    public String getEscalationLevel() { return escalationLevel; }
    public Map<String, String> getLabels() { return labels; }
    public Map<String, Object> getAnnotations() { return annotations; }
    public Map<String, Object> getMetadata() { return metadata; }

    public Instant getTimestampAsInstant() {
        return Instant.ofEpochMilli(timestamp);
    }

    public boolean isResolved() {
        return resolvedAt > 0 || "resolved".equalsIgnoreCase(status);
    }

    public boolean isCritical() {
        return "critical".equalsIgnoreCase(severity) || "fatal".equalsIgnoreCase(severity);
    }

    public long getDurationMillis() {
        if (!isResolved()) return System.currentTimeMillis() - timestamp;
        return resolvedAt - timestamp;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RawAlert rawAlert = (RawAlert) o;
        return timestamp == rawAlert.timestamp &&
               resolvedAt == rawAlert.resolvedAt &&
               Objects.equals(alertId, rawAlert.alertId) &&
               Objects.equals(alertName, rawAlert.alertName) &&
               Objects.equals(description, rawAlert.description) &&
               Objects.equals(severity, rawAlert.severity) &&
               Objects.equals(status, rawAlert.status) &&
               Objects.equals(source, rawAlert.source) &&
               Objects.equals(category, rawAlert.category) &&
               Objects.equals(assignee, rawAlert.assignee) &&
               Objects.equals(escalationLevel, rawAlert.escalationLevel) &&
               Objects.equals(labels, rawAlert.labels) &&
               Objects.equals(annotations, rawAlert.annotations) &&
               Objects.equals(metadata, rawAlert.metadata);
    }

    @Override
    public int hashCode() {
        return Objects.hash(alertId, alertName, description, severity, status, source,
                          category, timestamp, resolvedAt, assignee, escalationLevel,
                          labels, annotations, metadata);
    }

    @Override
    public String toString() {
        return "RawAlert{" +
               "alertId='" + alertId + '\'' +
               ", alertName='" + alertName + '\'' +
               ", description='" + (description != null ? description.substring(0, Math.min(description.length(), 100)) : null) + "...'" +
               ", severity='" + severity + '\'' +
               ", status='" + status + '\'' +
               ", source='" + source + '\'' +
               ", category='" + category + '\'' +
               ", timestamp=" + timestamp +
               ", resolvedAt=" + resolvedAt +
               ", assignee='" + assignee + '\'' +
               ", escalationLevel='" + escalationLevel + '\'' +
               ", labels=" + labels +
               ", annotations=" + annotations +
               ", metadata=" + metadata +
               '}';
    }
}