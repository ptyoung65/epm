package com.airis.etl;

import com.airis.etl.config.PipelineConfiguration;
import com.airis.etl.pipeline.StreamingPipeline;
import com.typesafe.config.Config;
import com.typesafe.config.ConfigFactory;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.runtime.state.filesystem.FsStateBackend;
import org.apache.flink.runtime.state.rocksdb.RocksDBStateBackend;
import org.apache.flink.streaming.api.environment.CheckpointConfig;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

/**
 * AIRIS EPM ETL Pipeline Application
 * 
 * Main entry point for the real-time ETL data pipeline using Apache Flink and Kafka.
 * Processes streaming data from multiple sources and outputs to various sinks.
 */
public class EtlPipelineApplication {
    private static final Logger LOG = LoggerFactory.getLogger(EtlPipelineApplication.class);

    public static void main(String[] args) throws Exception {
        LOG.info("Starting AIRIS EPM ETL Pipeline...");

        try {
            // Load configuration
            Config config = loadConfiguration(args);
            PipelineConfiguration pipelineConfig = new PipelineConfiguration(config);

            // Setup Flink execution environment
            StreamExecutionEnvironment env = setupFlinkEnvironment(pipelineConfig);

            // Build and execute the streaming pipeline
            StreamingPipeline pipeline = new StreamingPipeline(env, pipelineConfig);
            pipeline.buildPipeline();

            LOG.info("ETL Pipeline configured successfully. Starting execution...");
            
            // Execute the pipeline
            env.execute("AIRIS EPM Real-time ETL Pipeline");

        } catch (Exception e) {
            LOG.error("Failed to start ETL Pipeline", e);
            System.exit(1);
        }
    }

    /**
     * Load configuration from files and environment variables
     */
    private static Config loadConfiguration(String[] args) {
        LOG.info("Loading configuration...");
        
        Config config = ConfigFactory.load();
        
        // Override with command line arguments if provided
        if (args.length > 0) {
            for (String arg : args) {
                if (arg.startsWith("--config=")) {
                    String configPath = arg.substring("--config=".length());
                    Config fileConfig = ConfigFactory.parseFileAnySyntax(new java.io.File(configPath));
                    config = fileConfig.withFallback(config);
                }
            }
        }

        LOG.info("Configuration loaded. Environment: {}", 
                config.hasPath("pipeline.environment") ? config.getString("pipeline.environment") : "default");
        
        return config;
    }

    /**
     * Setup Flink execution environment with configuration
     */
    private static StreamExecutionEnvironment setupFlinkEnvironment(PipelineConfiguration config) throws Exception {
        LOG.info("Setting up Flink execution environment...");

        // Create execution environment
        StreamExecutionEnvironment env;
        
        if (config.isLocalExecution()) {
            LOG.info("Creating local execution environment");
            Configuration flinkConfig = new Configuration();
            flinkConfig.setString("web.port", String.valueOf(config.getWebUIPort()));
            env = StreamExecutionEnvironment.createLocalEnvironmentWithWebUI(flinkConfig);
        } else {
            LOG.info("Creating cluster execution environment");
            env = StreamExecutionEnvironment.getExecutionEnvironment();
        }

        // Set parallelism
        env.setParallelism(config.getParallelism());
        env.setMaxParallelism(config.getMaxParallelism());
        
        LOG.info("Parallelism set to: {}, Max parallelism: {}", 
                config.getParallelism(), config.getMaxParallelism());

        // Configure checkpointing
        if (config.isCheckpointingEnabled()) {
            setupCheckpointing(env, config);
        }

        // Configure state backend
        setupStateBackend(env, config);

        // Set time characteristic
        env.getConfig().setAutoWatermarkInterval(1000L);

        LOG.info("Flink execution environment configured successfully");
        return env;
    }

    /**
     * Setup checkpointing configuration
     */
    private static void setupCheckpointing(StreamExecutionEnvironment env, PipelineConfiguration config) {
        LOG.info("Setting up checkpointing...");

        env.enableCheckpointing(config.getCheckpointInterval());

        CheckpointConfig checkpointConfig = env.getCheckpointConfig();
        
        // Checkpoint configuration
        checkpointConfig.setCheckpointTimeout(config.getCheckpointTimeout());
        checkpointConfig.setMinPauseBetweenCheckpoints(config.getCheckpointInterval() / 2);
        checkpointConfig.setMaxConcurrentCheckpoints(1);
        checkpointConfig.setTolerableCheckpointFailureNumber(3);
        
        // Enable external checkpoints
        checkpointConfig.setExternalizedCheckpointCleanup(
            CheckpointConfig.ExternalizedCheckpointCleanup.RETAIN_ON_CANCELLATION);

        LOG.info("Checkpointing enabled - Interval: {}ms, Timeout: {}ms", 
                config.getCheckpointInterval(), config.getCheckpointTimeout());
    }

    /**
     * Setup state backend configuration
     */
    private static void setupStateBackend(StreamExecutionEnvironment env, PipelineConfiguration config) 
            throws Exception {
        LOG.info("Setting up state backend: {}", config.getStateBackend());

        switch (config.getStateBackend().toLowerCase()) {
            case "rocksdb":
                RocksDBStateBackend rocksDBBackend = new RocksDBStateBackend(
                    config.getCheckpointDir(), config.isIncrementalCheckpoints());
                rocksDBBackend.setDbStoragePath(config.getRocksDBLocalDir());
                env.setStateBackend(rocksDBBackend);
                LOG.info("RocksDB state backend configured - Local dir: {}, Remote dir: {}", 
                        config.getRocksDBLocalDir(), config.getCheckpointDir());
                break;
                
            case "filesystem":
                FsStateBackend fsBackend = new FsStateBackend(config.getCheckpointDir());
                env.setStateBackend(fsBackend);
                LOG.info("Filesystem state backend configured - Dir: {}", config.getCheckpointDir());
                break;
                
            default:
                LOG.info("Using default memory state backend");
        }
    }
}