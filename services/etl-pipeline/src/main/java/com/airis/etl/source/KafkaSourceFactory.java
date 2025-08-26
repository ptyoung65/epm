package com.airis.etl.source;

import com.airis.etl.config.PipelineConfiguration;
import com.airis.etl.model.*;
import com.airis.etl.serialization.JsonDeserializationSchema;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.Properties;

/**
 * Kafka Source Factory
 * 
 * Factory class for creating Kafka sources for different data types
 * with proper configuration and error handling.
 */
public class KafkaSourceFactory {
    private static final Logger LOG = LoggerFactory.getLogger(KafkaSourceFactory.class);
    
    private final PipelineConfiguration config;
    private final Properties baseConsumerProps;

    public KafkaSourceFactory(PipelineConfiguration config) {
        this.config = config;
        this.baseConsumerProps = config.getKafka().getConsumerProperties();
        
        // Add additional consumer configurations for reliability
        baseConsumerProps.setProperty(ConsumerConfig.ISOLATION_LEVEL_CONFIG, "read_committed");
        baseConsumerProps.setProperty(ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG, "30000");
        baseConsumerProps.setProperty(ConsumerConfig.HEARTBEAT_INTERVAL_MS_CONFIG, "3000");
        baseConsumerProps.setProperty(ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG, "300000");
        
        LOG.info("Kafka source factory initialized with bootstrap servers: {}", 
                config.getKafka().getBootstrapServers());
    }

    /**
     * Create metrics source stream
     */
    public DataStream<RawMetric> createMetricsSource(StreamExecutionEnvironment env) {
        LOG.info("Creating metrics source for topic: {}", 
                config.getKafka().getMetricsInputTopic());

        KafkaSource<RawMetric> kafkaSource = KafkaSource.<RawMetric>builder()
            .setBootstrapServers(config.getKafka().getBootstrapServers())
            .setTopics(config.getKafka().getMetricsInputTopic())
            .setGroupId(baseConsumerProps.getProperty(ConsumerConfig.GROUP_ID_CONFIG) + "-metrics")
            .setStartingOffsets(OffsetsInitializer.latest())
            .setValueOnlyDeserializer(new JsonDeserializationSchema<>(RawMetric.class))
            .setProperties(baseConsumerProps)
            .build();

        return env.fromSource(
            kafkaSource,
            WatermarkStrategy.<RawMetric>forBoundedOutOfOrderness(Duration.ofSeconds(10))
                .withTimestampAssigner((metric, timestamp) -> metric.getTimestamp()),
            "Kafka Metrics Source"
        );
    }

    /**
     * Create logs source stream
     */
    public DataStream<RawLogEntry> createLogsSource(StreamExecutionEnvironment env) {
        LOG.info("Creating logs source for topic: {}", 
                config.getKafka().getLogsInputTopic());

        KafkaSource<RawLogEntry> kafkaSource = KafkaSource.<RawLogEntry>builder()
            .setBootstrapServers(config.getKafka().getBootstrapServers())
            .setTopics(config.getKafka().getLogsInputTopic())
            .setGroupId(baseConsumerProps.getProperty(ConsumerConfig.GROUP_ID_CONFIG) + "-logs")
            .setStartingOffsets(OffsetsInitializer.latest())
            .setValueOnlyDeserializer(new JsonDeserializationSchema<>(RawLogEntry.class))
            .setProperties(baseConsumerProps)
            .build();

        return env.fromSource(
            kafkaSource,
            WatermarkStrategy.<RawLogEntry>forBoundedOutOfOrderness(Duration.ofSeconds(30))
                .withTimestampAssigner((log, timestamp) -> log.getTimestamp()),
            "Kafka Logs Source"
        );
    }

    /**
     * Create traces source stream
     */
    public DataStream<RawTrace> createTracesSource(StreamExecutionEnvironment env) {
        LOG.info("Creating traces source for topic: {}", 
                config.getKafka().getTracesInputTopic());

        KafkaSource<RawTrace> kafkaSource = KafkaSource.<RawTrace>builder()
            .setBootstrapServers(config.getKafka().getBootstrapServers())
            .setTopics(config.getKafka().getTracesInputTopic())
            .setGroupId(baseConsumerProps.getProperty(ConsumerConfig.GROUP_ID_CONFIG) + "-traces")
            .setStartingOffsets(OffsetsInitializer.latest())
            .setValueOnlyDeserializer(new JsonDeserializationSchema<>(RawTrace.class))
            .setProperties(baseConsumerProps)
            .build();

        return env.fromSource(
            kafkaSource,
            WatermarkStrategy.<RawTrace>forBoundedOutOfOrderness(Duration.ofSeconds(5))
                .withTimestampAssigner((trace, timestamp) -> trace.getTimestamp()),
            "Kafka Traces Source"
        );
    }

    /**
     * Create events source stream
     */
    public DataStream<RawEvent> createEventsSource(StreamExecutionEnvironment env) {
        LOG.info("Creating events source for topic: {}", 
                config.getKafka().getEventsInputTopic());

        KafkaSource<RawEvent> kafkaSource = KafkaSource.<RawEvent>builder()
            .setBootstrapServers(config.getKafka().getBootstrapServers())
            .setTopics(config.getKafka().getEventsInputTopic())
            .setGroupId(baseConsumerProps.getProperty(ConsumerConfig.GROUP_ID_CONFIG) + "-events")
            .setStartingOffsets(OffsetsInitializer.latest())
            .setValueOnlyDeserializer(new JsonDeserializationSchema<>(RawEvent.class))
            .setProperties(baseConsumerProps)
            .build();

        return env.fromSource(
            kafkaSource,
            WatermarkStrategy.<RawEvent>forBoundedOutOfOrderness(Duration.ofSeconds(1))
                .withTimestampAssigner((event, timestamp) -> event.getTimestamp()),
            "Kafka Events Source"
        );
    }

    /**
     * Create alerts source stream
     */
    public DataStream<RawAlert> createAlertsSource(StreamExecutionEnvironment env) {
        LOG.info("Creating alerts source for topic: {}", 
                config.getKafka().getAlertsInputTopic());

        KafkaSource<RawAlert> kafkaSource = KafkaSource.<RawAlert>builder()
            .setBootstrapServers(config.getKafka().getBootstrapServers())
            .setTopics(config.getKafka().getAlertsInputTopic())
            .setGroupId(baseConsumerProps.getProperty(ConsumerConfig.GROUP_ID_CONFIG) + "-alerts")
            .setStartingOffsets(OffsetsInitializer.latest())
            .setValueOnlyDeserializer(new JsonDeserializationSchema<>(RawAlert.class))
            .setProperties(baseConsumerProps)
            .build();

        return env.fromSource(
            kafkaSource,
            WatermarkStrategy.<RawAlert>forBoundedOutOfOrderness(Duration.ofSeconds(1))
                .withTimestampAssigner((alert, timestamp) -> alert.getTimestamp()),
            "Kafka Alerts Source"
        );
    }

    /**
     * Create generic source with custom configuration
     */
    public <T> DataStream<T> createCustomSource(
            StreamExecutionEnvironment env,
            String topic,
            Class<T> clazz,
            String sourceName,
            Duration outOfOrderness,
            Properties customProps) {
        
        LOG.info("Creating custom source for topic: {} with type: {}", topic, clazz.getSimpleName());

        Properties consumerProps = new Properties();
        consumerProps.putAll(baseConsumerProps);
        if (customProps != null) {
            consumerProps.putAll(customProps);
        }

        KafkaSource<T> kafkaSource = KafkaSource.<T>builder()
            .setBootstrapServers(config.getKafka().getBootstrapServers())
            .setTopics(topic)
            .setGroupId(consumerProps.getProperty(ConsumerConfig.GROUP_ID_CONFIG) + "-custom")
            .setStartingOffsets(OffsetsInitializer.latest())
            .setValueOnlyDeserializer(new JsonDeserializationSchema<>(clazz))
            .setProperties(consumerProps)
            .build();

        return env.fromSource(
            kafkaSource,
            WatermarkStrategy.<T>forBoundedOutOfOrderness(outOfOrderness),
            sourceName
        );
    }

    /**
     * Create source with specific offset strategy
     */
    public <T> DataStream<T> createSourceWithOffsets(
            StreamExecutionEnvironment env,
            String topic,
            Class<T> clazz,
            String sourceName,
            OffsetsInitializer offsetsInitializer) {
        
        LOG.info("Creating source with custom offsets for topic: {}", topic);

        KafkaSource<T> kafkaSource = KafkaSource.<T>builder()
            .setBootstrapServers(config.getKafka().getBootstrapServers())
            .setTopics(topic)
            .setGroupId(baseConsumerProps.getProperty(ConsumerConfig.GROUP_ID_CONFIG) + "-offset-custom")
            .setStartingOffsets(offsetsInitializer)
            .setValueOnlyDeserializer(new JsonDeserializationSchema<>(clazz))
            .setProperties(baseConsumerProps)
            .build();

        return env.fromSource(kafkaSource, WatermarkStrategy.noWatermarks(), sourceName);
    }

    /**
     * Get consumer properties for debugging
     */
    public Properties getConsumerProperties() {
        return new Properties(baseConsumerProps);
    }
}