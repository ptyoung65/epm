package com.airis.etl.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/**
 * Raw Event Model
 * 
 * Represents a raw event from various event sources (user actions, system events, etc.).
 */
public class RawEvent implements Serializable {
    private final String eventId;
    private final String eventType;
    private final String category;
    private final String action;
    private final String label;
    private final String value;
    private final long timestamp;
    private final String userId;
    private final String sessionId;
    private final String source;
    private final String userAgent;
    private final String ipAddress;
    private final Map<String, String> properties;
    private final Map<String, Object> metadata;

    @JsonCreator
    public RawEvent(
            @JsonProperty("eventId") String eventId,
            @JsonProperty("eventType") String eventType,
            @JsonProperty("category") String category,
            @JsonProperty("action") String action,
            @JsonProperty("label") String label,
            @JsonProperty("value") String value,
            @JsonProperty("timestamp") long timestamp,
            @JsonProperty("userId") String userId,
            @JsonProperty("sessionId") String sessionId,
            @JsonProperty("source") String source,
            @JsonProperty("userAgent") String userAgent,
            @JsonProperty("ipAddress") String ipAddress,
            @JsonProperty("properties") Map<String, String> properties,
            @JsonProperty("metadata") Map<String, Object> metadata) {
        this.eventId = eventId;
        this.eventType = eventType;
        this.category = category;
        this.action = action;
        this.label = label;
        this.value = value;
        this.timestamp = timestamp;
        this.userId = userId;
        this.sessionId = sessionId;
        this.source = source;
        this.userAgent = userAgent;
        this.ipAddress = ipAddress;
        this.properties = properties;
        this.metadata = metadata;
    }

    public String getEventId() { return eventId; }
    public String getEventType() { return eventType; }
    public String getCategory() { return category; }
    public String getAction() { return action; }
    public String getLabel() { return label; }
    public String getValue() { return value; }
    public long getTimestamp() { return timestamp; }
    public String getUserId() { return userId; }
    public String getSessionId() { return sessionId; }
    public String getSource() { return source; }
    public String getUserAgent() { return userAgent; }
    public String getIpAddress() { return ipAddress; }
    public Map<String, String> getProperties() { return properties; }
    public Map<String, Object> getMetadata() { return metadata; }

    public Instant getTimestampAsInstant() {
        return Instant.ofEpochMilli(timestamp);
    }

    public boolean isUserEvent() {
        return "user".equalsIgnoreCase(eventType) || "interaction".equalsIgnoreCase(eventType);
    }

    public boolean isSystemEvent() {
        return "system".equalsIgnoreCase(eventType) || "internal".equalsIgnoreCase(eventType);
    }

    public boolean isBusinessEvent() {
        return "business".equalsIgnoreCase(eventType) || "transaction".equalsIgnoreCase(eventType);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RawEvent rawEvent = (RawEvent) o;
        return timestamp == rawEvent.timestamp &&
               Objects.equals(eventId, rawEvent.eventId) &&
               Objects.equals(eventType, rawEvent.eventType) &&
               Objects.equals(category, rawEvent.category) &&
               Objects.equals(action, rawEvent.action) &&
               Objects.equals(label, rawEvent.label) &&
               Objects.equals(value, rawEvent.value) &&
               Objects.equals(userId, rawEvent.userId) &&
               Objects.equals(sessionId, rawEvent.sessionId) &&
               Objects.equals(source, rawEvent.source) &&
               Objects.equals(userAgent, rawEvent.userAgent) &&
               Objects.equals(ipAddress, rawEvent.ipAddress) &&
               Objects.equals(properties, rawEvent.properties) &&
               Objects.equals(metadata, rawEvent.metadata);
    }

    @Override
    public int hashCode() {
        return Objects.hash(eventId, eventType, category, action, label, value,
                          timestamp, userId, sessionId, source, userAgent, ipAddress,
                          properties, metadata);
    }

    @Override
    public String toString() {
        return "RawEvent{" +
               "eventId='" + eventId + '\'' +
               ", eventType='" + eventType + '\'' +
               ", category='" + category + '\'' +
               ", action='" + action + '\'' +
               ", label='" + label + '\'' +
               ", value='" + value + '\'' +
               ", timestamp=" + timestamp +
               ", userId='" + userId + '\'' +
               ", sessionId='" + sessionId + '\'' +
               ", source='" + source + '\'' +
               ", userAgent='" + (userAgent != null ? userAgent.substring(0, Math.min(userAgent.length(), 50)) : null) + "..." +
               ", ipAddress='" + ipAddress + '\'' +
               ", properties=" + properties +
               ", metadata=" + metadata +
               '}';
    }
}

/**
 * Event Severity Enumeration
 */
enum EventSeverity {
    LOW(0),
    MEDIUM(1),
    HIGH(2),
    CRITICAL(3);

    private final int level;

    EventSeverity(int level) {
        this.level = level;
    }

    public int getLevel() {
        return level;
    }

    public static EventSeverity fromString(String severity) {
        if (severity == null) return LOW;
        
        switch (severity.toUpperCase()) {
            case "CRITICAL":
            case "FATAL":
                return CRITICAL;
            case "HIGH":
            case "ERROR":
                return HIGH;
            case "MEDIUM":
            case "WARN":
            case "WARNING":
                return MEDIUM;
            case "LOW":
            case "INFO":
            case "DEBUG":
            default:
                return LOW;
        }
    }
}