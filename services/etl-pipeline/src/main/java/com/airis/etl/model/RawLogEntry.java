package com.airis.etl.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/**
 * Raw Log Entry Model
 * 
 * Represents a raw log entry from various application sources.
 */
public class RawLogEntry implements Serializable {
    private final String id;
    private final String message;
    private final String level;
    private final long timestamp;
    private final String source;
    private final String application;
    private final String host;
    private final String thread;
    private final String logger;
    private final Map<String, String> mdc;
    private final String stackTrace;
    private final Map<String, Object> metadata;

    @JsonCreator
    public RawLogEntry(
            @JsonProperty("id") String id,
            @JsonProperty("message") String message,
            @JsonProperty("level") String level,
            @JsonProperty("timestamp") long timestamp,
            @JsonProperty("source") String source,
            @JsonProperty("application") String application,
            @JsonProperty("host") String host,
            @JsonProperty("thread") String thread,
            @JsonProperty("logger") String logger,
            @JsonProperty("mdc") Map<String, String> mdc,
            @JsonProperty("stackTrace") String stackTrace,
            @JsonProperty("metadata") Map<String, Object> metadata) {
        this.id = id;
        this.message = message;
        this.level = level;
        this.timestamp = timestamp;
        this.source = source;
        this.application = application;
        this.host = host;
        this.thread = thread;
        this.logger = logger;
        this.mdc = mdc;
        this.stackTrace = stackTrace;
        this.metadata = metadata;
    }

    public String getId() { return id; }
    public String getMessage() { return message; }
    public String getLevel() { return level; }
    public long getTimestamp() { return timestamp; }
    public String getSource() { return source; }
    public String getApplication() { return application; }
    public String getHost() { return host; }
    public String getThread() { return thread; }
    public String getLogger() { return logger; }
    public Map<String, String> getMdc() { return mdc; }
    public String getStackTrace() { return stackTrace; }
    public Map<String, Object> getMetadata() { return metadata; }

    public Instant getTimestampAsInstant() {
        return Instant.ofEpochMilli(timestamp);
    }

    public boolean isError() {
        return "ERROR".equalsIgnoreCase(level);
    }

    public boolean isWarn() {
        return "WARN".equalsIgnoreCase(level) || "WARNING".equalsIgnoreCase(level);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RawLogEntry that = (RawLogEntry) o;
        return timestamp == that.timestamp &&
               Objects.equals(id, that.id) &&
               Objects.equals(message, that.message) &&
               Objects.equals(level, that.level) &&
               Objects.equals(source, that.source) &&
               Objects.equals(application, that.application) &&
               Objects.equals(host, that.host) &&
               Objects.equals(thread, that.thread) &&
               Objects.equals(logger, that.logger) &&
               Objects.equals(mdc, that.mdc) &&
               Objects.equals(stackTrace, that.stackTrace) &&
               Objects.equals(metadata, that.metadata);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, message, level, timestamp, source, application, 
                          host, thread, logger, mdc, stackTrace, metadata);
    }

    @Override
    public String toString() {
        return "RawLogEntry{" +
               "id='" + id + '\'' +
               ", message='" + (message != null ? message.substring(0, Math.min(message.length(), 100)) : null) + "..." +
               ", level='" + level + '\'' +
               ", timestamp=" + timestamp +
               ", source='" + source + '\'' +
               ", application='" + application + '\'' +
               ", host='" + host + '\'' +
               ", thread='" + thread + '\'' +
               ", logger='" + logger + '\'' +
               ", mdc=" + mdc +
               ", hasStackTrace=" + (stackTrace != null) +
               ", metadata=" + metadata +
               '}';
    }
}