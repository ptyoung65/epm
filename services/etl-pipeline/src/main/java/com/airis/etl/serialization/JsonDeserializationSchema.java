package com.airis.etl.serialization;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.flink.api.common.serialization.DeserializationSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * JSON Deserialization Schema
 * 
 * Generic JSON deserialization schema for Kafka messages with error handling.
 */
public class JsonDeserializationSchema<T> implements DeserializationSchema<T> {
    private static final Logger LOG = LoggerFactory.getLogger(JsonDeserializationSchema.class);
    
    private final Class<T> clazz;
    private final ObjectMapper objectMapper;
    
    public JsonDeserializationSchema(Class<T> clazz) {
        this.clazz = clazz;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        
        LOG.debug("JSON deserialization schema created for class: {}", clazz.getSimpleName());
    }
    
    @Override
    public T deserialize(byte[] message) throws IOException {
        if (message == null || message.length == 0) {
            LOG.warn("Received null or empty message for deserialization");
            return null;
        }
        
        try {
            String json = new String(message, StandardCharsets.UTF_8);
            T result = objectMapper.readValue(json, clazz);
            
            LOG.trace("Successfully deserialized message of type: {}", clazz.getSimpleName());
            return result;
            
        } catch (Exception e) {
            String messageStr = new String(message, StandardCharsets.UTF_8);
            LOG.error("Failed to deserialize message of type: {} - Message: {}", 
                     clazz.getSimpleName(), messageStr.substring(0, Math.min(messageStr.length(), 200)), e);
            
            // Return null to filter out invalid messages
            return null;
        }
    }
    
    @Override
    public boolean isEndOfStream(T nextElement) {
        return false;
    }
    
    @Override
    public TypeInformation<T> getProducedType() {
        return TypeInformation.of(clazz);
    }
}