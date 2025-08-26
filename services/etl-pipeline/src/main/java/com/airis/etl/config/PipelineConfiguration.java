package com.airis.etl.config;

import com.typesafe.config.Config;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.Serializable;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * Pipeline Configuration
 * 
 * Central configuration class that wraps Typesafe Config and provides
 * typed access to all pipeline configuration parameters.
 */
public class PipelineConfiguration implements Serializable {
    private static final Logger LOG = LoggerFactory.getLogger(PipelineConfiguration.class);
    
    private final Config config;
    private final KafkaConfiguration kafka;
    private final ClickHouseConfiguration clickhouse;
    private final ElasticsearchConfiguration elasticsearch;
    private final RedisConfiguration redis;
    
    public PipelineConfiguration(Config config) {
        this.config = config;
        this.kafka = new KafkaConfiguration(config.getConfig("kafka"));
        this.clickhouse = new ClickHouseConfiguration(config.getConfig("clickhouse"));
        this.elasticsearch = new ElasticsearchConfiguration(config.getConfig("elasticsearch"));
        this.redis = new RedisConfiguration(config.getConfig("redis"));
        
        LOG.info("Pipeline configuration initialized for environment: {}", 
                getEnvironment());
    }

    // Pipeline settings
    public String getPipelineName() {
        return config.getString("pipeline.name");
    }
    
    public String getPipelineVersion() {
        return config.getString("pipeline.version");
    }
    
    public String getEnvironment() {
        return config.hasPath("pipeline.environment") ? 
               config.getString("pipeline.environment") : "development";
    }
    
    public int getParallelism() {
        return config.getInt("pipeline.parallelism");
    }
    
    public int getMaxParallelism() {
        return config.getInt("pipeline.maxParallelism");
    }

    // Checkpointing
    public boolean isCheckpointingEnabled() {
        return !isLocalExecution() && config.hasPath("pipeline.checkpointInterval");
    }
    
    public long getCheckpointInterval() {
        return config.getLong("pipeline.checkpointInterval");
    }
    
    public long getCheckpointTimeout() {
        return config.getLong("pipeline.checkpointTimeout");
    }

    // State backend
    public String getStateBackend() {
        return config.getString("pipeline.stateBackend");
    }
    
    public String getRocksDBLocalDir() {
        return config.getString("pipeline.rocksdb.localDir");
    }
    
    public String getCheckpointDir() {
        return config.getString("pipeline.rocksdb.remoteCheckpointDir");
    }
    
    public boolean isIncrementalCheckpoints() {
        return config.getBoolean("pipeline.rocksdb.incrementalCheckpoints");
    }

    // Development settings
    public boolean isLocalExecution() {
        return config.hasPath("development.debug.localExecution") && 
               config.getBoolean("development.debug.localExecution");
    }
    
    public int getWebUIPort() {
        return config.hasPath("development.debug.webUIPort") ? 
               config.getInt("development.debug.webUIPort") : 8081;
    }

    // Quality settings
    public boolean isSchemaValidationEnabled() {
        return config.getBoolean("quality.validateSchemas");
    }
    
    public String getSchemaRegistryUrl() {
        return config.getString("quality.schemaRegistry");
    }
    
    public List<String> getRequiredFields() {
        return config.getStringList("quality.requiredFields");
    }
    
    public long getDeduplicationWindow() {
        return config.getLong("quality.deduplicationWindow");
    }
    
    public List<String> getDeduplicationKeyFields() {
        return config.getStringList("quality.deduplicationKeyFields");
    }

    // Anomaly detection
    public boolean isAnomalyDetectionEnabled() {
        return config.getBoolean("quality.anomalyDetection.enabled");
    }
    
    public String getAnomalyDetectionAlgorithm() {
        return config.getString("quality.anomalyDetection.algorithm");
    }
    
    public double getAnomalyThreshold() {
        return config.getDouble("quality.anomalyDetection.threshold");
    }
    
    public long getTrainingWindow() {
        return config.getLong("quality.anomalyDetection.trainingWindow");
    }

    // Windowing
    public Duration getDefaultTumblingWindowSize() {
        return Duration.parse("PT" + config.getString("windowing.tumbling.defaultSize").replace(" ", ""));
    }
    
    public Duration getMetricsTumblingWindowSize() {
        return Duration.parse("PT" + config.getString("windowing.tumbling.sizes.metrics").replace(" ", ""));
    }
    
    public Duration getLogsTumblingWindowSize() {
        return Duration.parse("PT" + config.getString("windowing.tumbling.sizes.logs").replace(" ", ""));
    }
    
    public Duration getTracesTumblingWindowSize() {
        return Duration.parse("PT" + config.getString("windowing.tumbling.sizes.traces").replace(" ", ""));
    }

    // Monitoring
    public boolean isMonitoringEnabled() {
        return config.getBoolean("monitoring.enabled");
    }
    
    public boolean isPrometheusEnabled() {
        return config.getBoolean("monitoring.prometheus.enabled");
    }
    
    public int getPrometheusPort() {
        return config.getInt("monitoring.prometheus.port");
    }
    
    public String getPrometheusPath() {
        return config.getString("monitoring.prometheus.path");
    }
    
    public boolean isHealthCheckEnabled() {
        return config.getBoolean("monitoring.health.enabled");
    }
    
    public int getHealthCheckPort() {
        return config.getInt("monitoring.health.port");
    }
    
    public String getHealthCheckPath() {
        return config.getString("monitoring.health.path");
    }

    // Alerting
    public boolean isAlertingEnabled() {
        return config.getBoolean("alerting.enabled");
    }
    
    public String getAlertKafkaTopic() {
        return config.getString("alerting.channels.kafka.topic");
    }

    // Component configurations
    public KafkaConfiguration getKafka() {
        return kafka;
    }
    
    public ClickHouseConfiguration getClickHouse() {
        return clickhouse;
    }
    
    public ElasticsearchConfiguration getElasticsearch() {
        return elasticsearch;
    }
    
    public RedisConfiguration getRedis() {
        return redis;
    }

    /**
     * Kafka Configuration
     */
    public static class KafkaConfiguration implements Serializable {
        private final Config config;
        
        public KafkaConfiguration(Config config) {
            this.config = config;
        }
        
        public String getBootstrapServers() {
            return config.getString("bootstrap.servers");
        }
        
        public Properties getConsumerProperties() {
            Properties props = new Properties();
            props.put("bootstrap.servers", getBootstrapServers());
            props.put("group.id", config.getString("consumer.group.id"));
            props.put("auto.offset.reset", config.getString("consumer.auto.offset.reset"));
            props.put("enable.auto.commit", config.getBoolean("consumer.enable.auto.commit"));
            props.put("max.poll.records", config.getInt("consumer.max.poll.records"));
            props.put("fetch.max.wait.ms", config.getInt("consumer.fetch.max.wait.ms"));
            return props;
        }
        
        public Properties getProducerProperties() {
            Properties props = new Properties();
            props.put("bootstrap.servers", getBootstrapServers());
            props.put("acks", config.getString("producer.acks"));
            props.put("retries", config.getInt("producer.retries"));
            props.put("max.in.flight.requests.per.connection", 
                     config.getInt("producer.max.in.flight.requests.per.connection"));
            props.put("enable.idempotence", config.getBoolean("producer.enable.idempotence"));
            props.put("compression.type", config.getString("producer.compression.type"));
            props.put("batch.size", config.getInt("producer.batch.size"));
            props.put("linger.ms", config.getInt("producer.linger.ms"));
            props.put("buffer.memory", config.getLong("producer.buffer.memory"));
            return props;
        }
        
        // Input topics
        public String getMetricsInputTopic() {
            return config.getString("topics.input.metrics");
        }
        
        public String getLogsInputTopic() {
            return config.getString("topics.input.logs");
        }
        
        public String getTracesInputTopic() {
            return config.getString("topics.input.traces");
        }
        
        public String getEventsInputTopic() {
            return config.getString("topics.input.events");
        }
        
        public String getAlertsInputTopic() {
            return config.getString("topics.input.alerts");
        }
        
        // Output topics
        public String getProcessedMetricsTopic() {
            return config.getString("topics.output.processedMetrics");
        }
        
        public String getProcessedLogsTopic() {
            return config.getString("topics.output.processedLogs");
        }
        
        public String getProcessedTracesTopic() {
            return config.getString("topics.output.processedTraces");
        }
        
        public String getAggregatedMetricsTopic() {
            return config.getString("topics.output.aggregatedMetrics");
        }
        
        public String getAnomaliesTopic() {
            return config.getString("topics.output.anomalies");
        }
        
        public String getDeadLetterTopic() {
            return config.getString("topics.deadletter");
        }
    }

    /**
     * ClickHouse Configuration
     */
    public static class ClickHouseConfiguration implements Serializable {
        private final Config config;
        
        public ClickHouseConfiguration(Config config) {
            this.config = config;
        }
        
        public String getUrl() {
            return config.getString("url");
        }
        
        public String getUsername() {
            return config.getString("username");
        }
        
        public String getPassword() {
            return config.getString("password");
        }
        
        public int getMaxConnections() {
            return config.getInt("maxConnections");
        }
        
        public int getBatchSize() {
            return config.getInt("batchSize");
        }
        
        public long getFlushInterval() {
            return config.getLong("flushInterval");
        }
        
        public String getMetricsTable() {
            return config.getString("tables.metrics");
        }
        
        public String getLogsTable() {
            return config.getString("tables.logs");
        }
        
        public String getTracesTable() {
            return config.getString("tables.traces");
        }
        
        public String getEventsTable() {
            return config.getString("tables.events");
        }
        
        public String getAggregatedMetricsTable() {
            return config.getString("tables.aggregated_metrics");
        }
    }

    /**
     * Elasticsearch Configuration
     */
    public static class ElasticsearchConfiguration implements Serializable {
        private final Config config;
        
        public ElasticsearchConfiguration(Config config) {
            this.config = config;
        }
        
        public List<String> getHosts() {
            return config.getStringList("hosts");
        }
        
        public String getUsername() {
            return config.hasPath("username") ? config.getString("username") : null;
        }
        
        public String getPassword() {
            return config.hasPath("password") ? config.getString("password") : null;
        }
        
        public int getBulkActions() {
            return config.getInt("bulkActions");
        }
        
        public int getBulkSizeMB() {
            return config.getInt("bulkSizeMB");
        }
        
        public long getFlushInterval() {
            return config.getLong("flushInterval");
        }
        
        public String getLogsIndex() {
            return config.getString("indices.logs");
        }
        
        public String getTracesIndex() {
            return config.getString("indices.traces");
        }
        
        public String getEventsIndex() {
            return config.getString("indices.events");
        }
        
        public String getAnomaliesIndex() {
            return config.getString("indices.anomalies");
        }
    }

    /**
     * Redis Configuration
     */
    public static class RedisConfiguration implements Serializable {
        private final Config config;
        
        public RedisConfiguration(Config config) {
            this.config = config;
        }
        
        public String getHost() {
            return config.getString("host");
        }
        
        public int getPort() {
            return config.getInt("port");
        }
        
        public int getDatabase() {
            return config.getInt("database");
        }
        
        public String getPassword() {
            return config.hasPath("password") ? config.getString("password") : null;
        }
        
        public int getMaxConnections() {
            return config.getInt("maxConnections");
        }
        
        public int getTimeout() {
            return config.getInt("timeout");
        }
        
        public int getMetricsTTL() {
            return config.getInt("ttl.metrics");
        }
        
        public int getEnrichmentTTL() {
            return config.getInt("ttl.enrichment");
        }
        
        public int getSessionsTTL() {
            return config.getInt("ttl.sessions");
        }
    }
}