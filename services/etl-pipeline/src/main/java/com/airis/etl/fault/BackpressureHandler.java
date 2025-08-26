package com.airis.etl.fault;

import org.apache.flink.api.common.functions.RichMapFunction;
import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.metrics.Counter;
import org.apache.flink.metrics.Gauge;
import org.apache.flink.metrics.Histogram;
import org.apache.flink.runtime.metrics.DescriptiveStatisticsHistogram;
import org.apache.flink.streaming.api.functions.ProcessFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Backpressure Handler
 * 
 * Intelligent backpressure detection and handling with adaptive throttling,
 * load shedding, and circuit breaker patterns.
 */
public class BackpressureHandler<T> extends ProcessFunction<T, T> {
    private static final Logger LOG = LoggerFactory.getLogger(BackpressureHandler.class);
    
    private final Duration processingTimeThreshold;
    private final Duration backpressureDetectionWindow;
    private final double backpressureThreshold;
    private final int maxQueueSize;
    private final boolean enableLoadShedding;
    private final double loadSheddingRatio;
    
    // Metrics
    private transient Counter processedRecords;
    private transient Counter droppedRecords;
    private transient Counter backpressureEvents;
    private transient Histogram processingLatency;
    private transient Gauge<Long> queueSize;
    private transient Gauge<Double> backpressureRatio;
    
    // State
    private transient ValueState<BackpressureState> backpressureState;
    private transient final AtomicLong currentQueueSize = new AtomicLong(0);
    private transient final AtomicLong windowStartTime = new AtomicLong(0);
    private transient final AtomicLong windowProcessedCount = new AtomicLong(0);
    private transient final AtomicLong windowDroppedCount = new AtomicLong(0);
    
    public BackpressureHandler(Duration processingTimeThreshold, 
                              Duration backpressureDetectionWindow,
                              double backpressureThreshold,
                              int maxQueueSize,
                              boolean enableLoadShedding,
                              double loadSheddingRatio) {
        this.processingTimeThreshold = processingTimeThreshold;
        this.backpressureDetectionWindow = backpressureDetectionWindow;
        this.backpressureThreshold = backpressureThreshold;
        this.maxQueueSize = maxQueueSize;
        this.enableLoadShedding = enableLoadShedding;
        this.loadSheddingRatio = loadSheddingRatio;
        
        LOG.info("Backpressure handler initialized: threshold={}ms, window={}ms, max_queue={}, load_shedding={}",
                processingTimeThreshold.toMillis(), 
                backpressureDetectionWindow.toMillis(), 
                maxQueueSize, 
                enableLoadShedding);
    }
    
    @Override
    public void open(Configuration parameters) throws Exception {
        super.open(parameters);
        
        // Initialize metrics
        processedRecords = getRuntimeContext().getMetricGroup()
            .counter("processed_records");
        droppedRecords = getRuntimeContext().getMetricGroup()
            .counter("dropped_records");
        backpressureEvents = getRuntimeContext().getMetricGroup()
            .counter("backpressure_events");
        
        processingLatency = getRuntimeContext().getMetricGroup()
            .histogram("processing_latency", new DescriptiveStatisticsHistogram(1000));
        
        queueSize = getRuntimeContext().getMetricGroup()
            .gauge("queue_size", () -> currentQueueSize.get());
        
        backpressureRatio = getRuntimeContext().getMetricGroup()
            .gauge("backpressure_ratio", this::calculateBackpressureRatio);
        
        // Initialize state
        ValueStateDescriptor<BackpressureState> stateDescriptor = 
            new ValueStateDescriptor<>("backpressure_state", 
                                     TypeInformation.of(BackpressureState.class));
        backpressureState = getRuntimeContext().getState(stateDescriptor);
        
        // Initialize window
        windowStartTime.set(System.currentTimeMillis());
        
        LOG.debug("Backpressure handler opened successfully");
    }
    
    @Override
    public void processElement(T value, ProcessFunction<T, T>.Context ctx, Collector<T> out) throws Exception {
        long startTime = System.currentTimeMillis();
        
        try {
            // Check current queue size
            long currentQueue = currentQueueSize.get();
            if (currentQueue >= maxQueueSize) {
                handleQueueOverflow(value, ctx);
                return;
            }
            
            // Increment queue size
            currentQueueSize.incrementAndGet();
            
            // Check for backpressure
            BackpressureState state = backpressureState.value();
            if (state == null) {
                state = new BackpressureState();
            }
            
            boolean isBackpressureDetected = detectBackpressure(state, startTime);
            
            if (isBackpressureDetected) {
                handleBackpressure(value, state, ctx, out);
            } else {
                // Normal processing
                processNormally(value, ctx, out);
            }
            
            // Update state
            updateBackpressureState(state, startTime);
            backpressureState.update(state);
            
            // Record processing latency
            long processingTime = System.currentTimeMillis() - startTime;
            processingLatency.update(processingTime);
            
        } finally {
            // Always decrement queue size
            currentQueueSize.decrementAndGet();
        }
    }
    
    /**
     * Detect backpressure based on processing time and queue size
     */
    private boolean detectBackpressure(BackpressureState state, long currentTime) {
        // Check processing time threshold
        boolean processingTimeExceeded = (currentTime - state.lastProcessedTime) > processingTimeThreshold.toMillis();
        
        // Check queue size threshold
        boolean queueSizeExceeded = currentQueueSize.get() > (maxQueueSize * backpressureThreshold);
        
        // Check window-based backpressure ratio
        boolean windowBackpressure = calculateWindowBackpressureRatio() > backpressureThreshold;
        
        boolean backpressureDetected = processingTimeExceeded || queueSizeExceeded || windowBackpressure;
        
        if (backpressureDetected && !state.isBackpressureActive) {
            LOG.warn("Backpressure detected: processing_time_exceeded={}, queue_size_exceeded={}, window_backpressure={}, current_queue={}, threshold={}",
                    processingTimeExceeded, queueSizeExceeded, windowBackpressure, currentQueueSize.get(), maxQueueSize * backpressureThreshold);
            backpressureEvents.inc();
        }
        
        return backpressureDetected;
    }
    
    /**
     * Handle backpressure with adaptive strategies
     */
    private void handleBackpressure(T value, BackpressureState state, ProcessFunction<T, T>.Context ctx, Collector<T> out) throws Exception {
        state.isBackpressureActive = true;
        state.backpressureCount++;
        
        if (enableLoadShedding && shouldShedLoad(state)) {
            // Load shedding: drop some records
            if (Math.random() < loadSheddingRatio) {
                droppedRecords.inc();
                windowDroppedCount.incrementAndGet();
                LOG.debug("Load shedding: dropped record due to backpressure");
                return;
            }
        }
        
        // Adaptive throttling: add delay
        long throttleDelay = calculateThrottleDelay(state);
        if (throttleDelay > 0) {
            try {
                Thread.sleep(throttleDelay);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                LOG.warn("Throttle sleep interrupted", e);
            }
        }
        
        // Process with backpressure handling
        processNormally(value, ctx, out);
    }
    
    /**
     * Handle queue overflow with circuit breaker pattern
     */
    private void handleQueueOverflow(T value, ProcessFunction<T, T>.Context ctx) {
        droppedRecords.inc();
        windowDroppedCount.incrementAndGet();
        
        LOG.warn("Queue overflow: dropping record, current_queue_size={}, max_queue_size={}", 
                currentQueueSize.get(), maxQueueSize);
        
        // Optionally send to dead letter queue or side output
        // ctx.output(deadLetterTag, value);
    }
    
    /**
     * Normal processing without backpressure
     */
    private void processNormally(T value, ProcessFunction<T, T>.Context ctx, Collector<T> out) {
        out.collect(value);
        processedRecords.inc();
        windowProcessedCount.incrementAndGet();
    }
    
    /**
     * Update backpressure state
     */
    private void updateBackpressureState(BackpressureState state, long currentTime) {
        state.lastProcessedTime = currentTime;
        
        // Reset backpressure if conditions improve
        if (state.isBackpressureActive && 
            currentQueueSize.get() < (maxQueueSize * 0.5) &&
            calculateWindowBackpressureRatio() < (backpressureThreshold * 0.5)) {
            
            state.isBackpressureActive = false;
            state.consecutiveNormalProcessing++;
            
            if (state.consecutiveNormalProcessing > 10) {
                state.backpressureCount = Math.max(0, state.backpressureCount - 1);
                LOG.info("Backpressure conditions improved, count reduced to: {}", state.backpressureCount);
            }
        } else {
            state.consecutiveNormalProcessing = 0;
        }
        
        // Reset window if expired
        long windowDuration = currentTime - windowStartTime.get();
        if (windowDuration > backpressureDetectionWindow.toMillis()) {
            resetWindow(currentTime);
        }
    }
    
    /**
     * Calculate adaptive throttle delay based on backpressure severity
     */
    private long calculateThrottleDelay(BackpressureState state) {
        if (!state.isBackpressureActive) {
            return 0;
        }
        
        // Exponential backoff based on consecutive backpressure events
        long baseDelay = 10; // 10ms base delay
        long maxDelay = 1000; // 1 second max delay
        
        long delay = Math.min(baseDelay * (1L << Math.min(state.backpressureCount, 6)), maxDelay);
        
        // Factor in current queue utilization
        double queueUtilization = (double) currentQueueSize.get() / maxQueueSize;
        delay = (long) (delay * (1 + queueUtilization));
        
        return Math.min(delay, maxDelay);
    }
    
    /**
     * Determine if load shedding should be applied
     */
    private boolean shouldShedLoad(BackpressureState state) {
        // Apply load shedding if backpressure persists and queue is highly utilized
        return state.backpressureCount > 5 && 
               currentQueueSize.get() > (maxQueueSize * 0.8);
    }
    
    /**
     * Calculate current backpressure ratio
     */
    private double calculateBackpressureRatio() {
        long processed = windowProcessedCount.get();
        long dropped = windowDroppedCount.get();
        long total = processed + dropped;
        
        return total > 0 ? (double) dropped / total : 0.0;
    }
    
    /**
     * Calculate window-based backpressure ratio
     */
    private double calculateWindowBackpressureRatio() {
        long windowDuration = System.currentTimeMillis() - windowStartTime.get();
        if (windowDuration < backpressureDetectionWindow.toMillis() / 2) {
            return 0.0; // Not enough data yet
        }
        
        return calculateBackpressureRatio();
    }
    
    /**
     * Reset detection window
     */
    private void resetWindow(long currentTime) {
        windowStartTime.set(currentTime);
        windowProcessedCount.set(0);
        windowDroppedCount.set(0);
    }
    
    /**
     * Backpressure state holder
     */
    public static class BackpressureState {
        public boolean isBackpressureActive = false;
        public long backpressureCount = 0;
        public long lastProcessedTime = System.currentTimeMillis();
        public long consecutiveNormalProcessing = 0;
        
        public BackpressureState() {}
    }
    
    /**
     * Factory method for creating backpressure handler with default settings
     */
    public static <T> BackpressureHandler<T> createDefault() {
        return new BackpressureHandler<>(
            Duration.ofMillis(100),  // 100ms processing threshold
            Duration.ofSeconds(30),   // 30 second detection window
            0.7,                     // 70% backpressure threshold
            1000,                    // 1000 max queue size
            true,                    // enable load shedding
            0.1                      // 10% load shedding ratio
        );
    }
    
    /**
     * Factory method for creating backpressure handler for high throughput
     */
    public static <T> BackpressureHandler<T> createHighThroughput() {
        return new BackpressureHandler<>(
            Duration.ofMillis(50),   // 50ms processing threshold
            Duration.ofSeconds(15),  // 15 second detection window
            0.8,                     // 80% backpressure threshold
            5000,                    // 5000 max queue size
            true,                    // enable load shedding
            0.05                     // 5% load shedding ratio
        );
    }
    
    /**
     * Factory method for creating backpressure handler for low latency
     */
    public static <T> BackpressureHandler<T> createLowLatency() {
        return new BackpressureHandler<>(
            Duration.ofMillis(20),   // 20ms processing threshold
            Duration.ofSeconds(10),  // 10 second detection window
            0.5,                     // 50% backpressure threshold
            500,                     // 500 max queue size
            false,                   // disable load shedding for consistency
            0.0                      // no load shedding
        );
    }
}