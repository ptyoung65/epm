package com.airis.etl.serialization;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.flink.api.common.serialization.SerializationSchema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;

/**
 * JSON Serialization Schema
 * 
 * Generic JSON serialization schema for Kafka messages and other outputs.
 */
public class JsonSerializationSchema<T> implements SerializationSchema<T> {
    private static final Logger LOG = LoggerFactory.getLogger(JsonSerializationSchema.class);
    
    private final ObjectMapper objectMapper;
    
    public JsonSerializationSchema() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        
        LOG.debug("JSON serialization schema created");
    }
    
    @Override
    public byte[] serialize(T element) {
        if (element == null) {
            LOG.warn("Received null element for serialization");
            return new byte[0];
        }
        
        try {
            String json = objectMapper.writeValueAsString(element);
            LOG.trace("Successfully serialized element of type: {}", element.getClass().getSimpleName());
            return json.getBytes(StandardCharsets.UTF_8);
            
        } catch (Exception e) {
            LOG.error("Failed to serialize element of type: {}", element.getClass().getSimpleName(), e);
            
            // Return empty byte array to avoid pipeline failure
            return new byte[0];
        }
    }
}