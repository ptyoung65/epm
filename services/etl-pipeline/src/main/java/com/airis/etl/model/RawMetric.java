package com.airis.etl.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/**
 * Raw Metric Model
 * 
 * Represents a raw metric data point from various monitoring sources.
 */
public class RawMetric implements Serializable {
    private final String id;
    private final String name;
    private final double value;
    private final long timestamp;
    private final String source;
    private final String type;
    private final String unit;
    private final Map<String, String> tags;
    private final Map<String, Object> metadata;

    @JsonCreator
    public RawMetric(
            @JsonProperty("id") String id,
            @JsonProperty("name") String name,
            @JsonProperty("value") double value,
            @JsonProperty("timestamp") long timestamp,
            @JsonProperty("source") String source,
            @JsonProperty("type") String type,
            @JsonProperty("unit") String unit,
            @JsonProperty("tags") Map<String, String> tags,
            @JsonProperty("metadata") Map<String, Object> metadata) {
        this.id = id;
        this.name = name;
        this.value = value;
        this.timestamp = timestamp;
        this.source = source;
        this.type = type;
        this.unit = unit;
        this.tags = tags;
        this.metadata = metadata;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public double getValue() { return value; }
    public long getTimestamp() { return timestamp; }
    public String getSource() { return source; }
    public String getType() { return type; }
    public String getUnit() { return unit; }
    public Map<String, String> getTags() { return tags; }
    public Map<String, Object> getMetadata() { return metadata; }

    public Instant getTimestampAsInstant() {
        return Instant.ofEpochMilli(timestamp);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RawMetric rawMetric = (RawMetric) o;
        return Double.compare(rawMetric.value, value) == 0 &&
               timestamp == rawMetric.timestamp &&
               Objects.equals(id, rawMetric.id) &&
               Objects.equals(name, rawMetric.name) &&
               Objects.equals(source, rawMetric.source) &&
               Objects.equals(type, rawMetric.type) &&
               Objects.equals(unit, rawMetric.unit) &&
               Objects.equals(tags, rawMetric.tags) &&
               Objects.equals(metadata, rawMetric.metadata);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, value, timestamp, source, type, unit, tags, metadata);
    }

    @Override
    public String toString() {
        return "RawMetric{" +
               "id='" + id + '\'' +
               ", name='" + name + '\'' +
               ", value=" + value +
               ", timestamp=" + timestamp +
               ", source='" + source + '\'' +
               ", type='" + type + '\'' +
               ", unit='" + unit + '\'' +
               ", tags=" + tags +
               ", metadata=" + metadata +
               '}';
    }
}