package com.airis.etl.aggregation;

import com.airis.etl.model.ProcessedMetric;
import com.airis.etl.sink.MultiSinkFactory.AggregatedMetric;
import org.apache.flink.api.common.functions.AggregateFunction;
import org.apache.flink.api.common.functions.ReduceFunction;
import org.apache.flink.api.common.state.MapState;
import org.apache.flink.api.common.state.MapStateDescriptor;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.api.java.tuple.Tuple2;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.metrics.Counter;
import org.apache.flink.metrics.Gauge;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.streaming.api.functions.windowing.ProcessWindowFunction;
import org.apache.flink.streaming.api.windowing.assigners.SlidingProcessingTimeWindows;
import org.apache.flink.streaming.api.windowing.assigners.TumblingProcessingTimeWindows;
import org.apache.flink.streaming.api.windowing.time.Time;
import org.apache.flink.streaming.api.windowing.windows.TimeWindow;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.Serializable;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Windowed Aggregation Processor
 * 
 * Advanced windowed aggregations with multiple window types, custom aggregation functions,
 * and real-time streaming analytics for metrics, events, and other time-series data.
 */
public class WindowedAggregationProcessor {
    private static final Logger LOG = LoggerFactory.getLogger(WindowedAggregationProcessor.class);
    
    /**
     * Create tumbling window aggregations for metrics
     */
    public static DataStream<AggregatedMetric> createTumblingWindowAggregation(
            DataStream<ProcessedMetric> metricsStream,
            Duration windowSize) {
        
        LOG.info("Creating tumbling window aggregation with window size: {}", windowSize);
        
        return metricsStream
            .keyBy(metric -> metric.getMetricName())
            .window(TumblingProcessingTimeWindows.of(Time.of(windowSize.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS)))
            .aggregate(
                new MetricAggregateFunction(),
                new MetricWindowProcessFunction()
            )
            .name("Tumbling Window Aggregation");
    }
    
    /**
     * Create sliding window aggregations for metrics
     */
    public static DataStream<AggregatedMetric> createSlidingWindowAggregation(
            DataStream<ProcessedMetric> metricsStream,
            Duration windowSize,
            Duration slideSize) {
        
        LOG.info("Creating sliding window aggregation with window size: {}, slide size: {}", 
                windowSize, slideSize);
        
        return metricsStream
            .keyBy(metric -> metric.getMetricName())
            .window(SlidingProcessingTimeWindows.of(
                Time.of(windowSize.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS),
                Time.of(slideSize.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS)
            ))
            .aggregate(
                new MetricAggregateFunction(),
                new MetricWindowProcessFunction()
            )
            .name("Sliding Window Aggregation");
    }
    
    /**
     * Create session window aggregations
     */
    public static DataStream<AggregatedMetric> createSessionWindowAggregation(
            DataStream<ProcessedMetric> metricsStream,
            Duration sessionTimeout) {
        
        LOG.info("Creating session window aggregation with timeout: {}", sessionTimeout);
        
        return metricsStream
            .keyBy(metric -> metric.getMetricName())
            .process(new SessionWindowAggregator(sessionTimeout))
            .name("Session Window Aggregation");
    }
    
    /**
     * Create custom windowed aggregations with multiple functions
     */
    public static DataStream<EnrichedAggregatedMetric> createAdvancedWindowAggregation(
            DataStream<ProcessedMetric> metricsStream,
            Duration windowSize,
            Set<AggregationType> aggregationTypes) {
        
        LOG.info("Creating advanced window aggregation with {} aggregation types", 
                aggregationTypes.size());
        
        return metricsStream
            .keyBy(metric -> metric.getMetricName())
            .window(TumblingProcessingTimeWindows.of(Time.of(windowSize.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS)))
            .process(new AdvancedWindowProcessor(aggregationTypes))
            .name("Advanced Window Aggregation");
    }
    
    /**
     * Create real-time percentile aggregations
     */
    public static DataStream<PercentileMetric> createPercentileAggregation(
            DataStream<ProcessedMetric> metricsStream,
            Duration windowSize,
            double[] percentiles) {
        
        LOG.info("Creating percentile aggregation for percentiles: {}", Arrays.toString(percentiles));
        
        return metricsStream
            .keyBy(metric -> metric.getMetricName())
            .window(TumblingProcessingTimeWindows.of(Time.of(windowSize.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS)))
            .process(new PercentileWindowProcessor(percentiles))
            .name("Percentile Aggregation");
    }
    
    /**
     * Metric aggregate function for basic statistics
     */
    public static class MetricAggregateFunction implements AggregateFunction<ProcessedMetric, MetricAccumulator, MetricAccumulator> {
        
        @Override
        public MetricAccumulator createAccumulator() {
            return new MetricAccumulator();
        }
        
        @Override
        public MetricAccumulator add(ProcessedMetric metric, MetricAccumulator accumulator) {
            accumulator.count++;
            accumulator.sum += metric.getValue();
            accumulator.min = Math.min(accumulator.min, metric.getValue());
            accumulator.max = Math.max(accumulator.max, metric.getValue());
            
            // Update tags
            if (accumulator.tags == null) {
                accumulator.tags = new HashMap<>(metric.getTags());
            }
            
            // Track first and last timestamps
            if (accumulator.firstTimestamp == 0 || metric.getTimestamp() < accumulator.firstTimestamp) {
                accumulator.firstTimestamp = metric.getTimestamp();
            }
            if (metric.getTimestamp() > accumulator.lastTimestamp) {
                accumulator.lastTimestamp = metric.getTimestamp();
            }
            
            return accumulator;
        }
        
        @Override
        public MetricAccumulator getResult(MetricAccumulator accumulator) {
            if (accumulator.count > 0) {
                accumulator.average = accumulator.sum / accumulator.count;
            }
            return accumulator;
        }
        
        @Override
        public MetricAccumulator merge(MetricAccumulator a, MetricAccumulator b) {
            MetricAccumulator merged = new MetricAccumulator();
            merged.count = a.count + b.count;
            merged.sum = a.sum + b.sum;
            merged.min = Math.min(a.min, b.min);
            merged.max = Math.max(a.max, b.max);
            merged.firstTimestamp = Math.min(a.firstTimestamp, b.firstTimestamp);
            merged.lastTimestamp = Math.max(a.lastTimestamp, b.lastTimestamp);
            
            if (merged.count > 0) {
                merged.average = merged.sum / merged.count;
            }
            
            // Merge tags
            merged.tags = new HashMap<>();
            if (a.tags != null) merged.tags.putAll(a.tags);
            if (b.tags != null) merged.tags.putAll(b.tags);
            
            return merged;
        }
    }
    
    /**
     * Window process function for creating aggregated metrics
     */
    public static class MetricWindowProcessFunction extends ProcessWindowFunction<MetricAccumulator, AggregatedMetric, String, TimeWindow> {
        
        @Override
        public void process(String key, Context context, Iterable<MetricAccumulator> elements, Collector<AggregatedMetric> out) throws Exception {
            MetricAccumulator accumulator = elements.iterator().next();
            
            AggregatedMetric aggregated = new AggregatedMetric(
                key, // metricName
                accumulator.average,
                accumulator.min,
                accumulator.max,
                accumulator.count,
                context.window().getStart(),
                context.window().getEnd(),
                accumulator.tags != null ? accumulator.tags : new HashMap<>()
            );
            
            out.collect(aggregated);
        }
    }
    
    /**
     * Session window aggregator for event-driven aggregations
     */
    public static class SessionWindowAggregator extends KeyedProcessFunction<String, ProcessedMetric, AggregatedMetric> {
        
        private final long sessionTimeout;
        private transient MapState<String, SessionAccumulator> sessionState;
        private transient Counter activeSessions;
        private transient Counter expiredSessions;
        
        public SessionWindowAggregator(Duration sessionTimeout) {
            this.sessionTimeout = sessionTimeout.toMillis();
        }
        
        @Override
        public void open(Configuration parameters) throws Exception {
            super.open(parameters);
            
            MapStateDescriptor<String, SessionAccumulator> sessionDescriptor = 
                new MapStateDescriptor<>("session_state",
                                       TypeInformation.of(String.class),
                                       TypeInformation.of(SessionAccumulator.class));
            sessionState = getRuntimeContext().getMapState(sessionDescriptor);
            
            activeSession = getRuntimeContext().getMetricGroup().counter("active_sessions");
            expiredSessions = getRuntimeContext().getMetricGroup().counter("expired_sessions");
        }
        
        @Override
        public void processElement(ProcessedMetric metric, Context ctx, Collector<AggregatedMetric> out) throws Exception {
            String sessionKey = generateSessionKey(metric);
            long currentTime = ctx.timestamp() != null ? ctx.timestamp() : System.currentTimeMillis();
            
            SessionAccumulator session = sessionState.get(sessionKey);
            
            if (session == null) {
                // New session
                session = new SessionAccumulator(metric.getMetricName(), currentTime);
                activeSession.inc();
            } else if (currentTime - session.lastActivity > sessionTimeout) {
                // Session expired, emit current session and start new one
                emitSessionResult(session, out);
                expiredSessions.inc();
                session = new SessionAccumulator(metric.getMetricName(), currentTime);
            }
            
            // Update session
            session.addMetric(metric, currentTime);
            sessionState.put(sessionKey, session);
            
            // Set timer for session expiration
            ctx.timerService().registerProcessingTimeTimer(currentTime + sessionTimeout);
        }
        
        @Override
        public void onTimer(long timestamp, OnTimerContext ctx, Collector<AggregatedMetric> out) throws Exception {
            // Check for expired sessions
            for (Map.Entry<String, SessionAccumulator> entry : sessionState.entries()) {
                SessionAccumulator session = entry.getValue();
                if (timestamp - session.lastActivity >= sessionTimeout) {
                    emitSessionResult(session, out);
                    sessionState.remove(entry.getKey());
                    expiredSessions.inc();
                }
            }
        }
        
        private String generateSessionKey(ProcessedMetric metric) {
            // Generate session key based on metric characteristics
            return metric.getMetricName() + "_" + 
                   (metric.getTags() != null ? metric.getTags().hashCode() : 0);
        }
        
        private void emitSessionResult(SessionAccumulator session, Collector<AggregatedMetric> out) {
            AggregatedMetric result = new AggregatedMetric(
                session.metricName,
                session.getAverage(),
                session.min,
                session.max,
                session.count,
                session.sessionStart,
                session.lastActivity,
                session.tags
            );
            
            out.collect(result);
        }
    }
    
    /**
     * Advanced window processor with multiple aggregation types
     */
    public static class AdvancedWindowProcessor extends ProcessWindowFunction<ProcessedMetric, EnrichedAggregatedMetric, String, TimeWindow> {
        
        private final Set<AggregationType> aggregationTypes;
        private transient Counter processedWindows;
        private transient Gauge<Integer> averageWindowSize;
        private transient final AtomicLong totalWindowSize = new AtomicLong(0);
        private transient final AtomicLong windowCount = new AtomicLong(0);
        
        public AdvancedWindowProcessor(Set<AggregationType> aggregationTypes) {
            this.aggregationTypes = aggregationTypes;
        }
        
        @Override
        public void open(Configuration parameters) throws Exception {
            super.open(parameters);
            
            processedWindows = getRuntimeContext().getMetricGroup().counter("processed_windows");
            averageWindowSize = getRuntimeContext().getMetricGroup()
                .gauge("average_window_size", () -> {
                    long count = windowCount.get();
                    return count > 0 ? (int) (totalWindowSize.get() / count) : 0;
                });
        }
        
        @Override
        public void process(String key, Context context, Iterable<ProcessedMetric> elements, Collector<EnrichedAggregatedMetric> out) throws Exception {
            List<ProcessedMetric> metrics = new ArrayList<>();
            elements.forEach(metrics::add);
            
            if (metrics.isEmpty()) {
                return;
            }
            
            totalWindowSize.addAndGet(metrics.size());
            windowCount.incrementAndGet();
            processedWindows.inc();
            
            EnrichedAggregatedMetric result = new EnrichedAggregatedMetric();
            result.metricName = key;
            result.windowStart = context.window().getStart();
            result.windowEnd = context.window().getEnd();
            result.count = metrics.size();
            
            // Calculate requested aggregations
            if (aggregationTypes.contains(AggregationType.BASIC_STATS)) {
                calculateBasicStats(metrics, result);
            }
            
            if (aggregationTypes.contains(AggregationType.PERCENTILES)) {
                calculatePercentiles(metrics, result);
            }
            
            if (aggregationTypes.contains(AggregationType.MOVING_AVERAGE)) {
                calculateMovingAverage(metrics, result);
            }
            
            if (aggregationTypes.contains(AggregationType.VARIANCE)) {
                calculateVariance(metrics, result);
            }
            
            if (aggregationTypes.contains(AggregationType.RATE_OF_CHANGE)) {
                calculateRateOfChange(metrics, result);
            }
            
            // Merge tags
            result.tags = new HashMap<>();
            for (ProcessedMetric metric : metrics) {
                if (metric.getTags() != null) {
                    result.tags.putAll(metric.getTags());
                }
            }
            
            out.collect(result);
        }
        
        private void calculateBasicStats(List<ProcessedMetric> metrics, EnrichedAggregatedMetric result) {
            double sum = 0;
            double min = Double.MAX_VALUE;
            double max = Double.MIN_VALUE;
            
            for (ProcessedMetric metric : metrics) {
                double value = metric.getValue();
                sum += value;
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
            
            result.sum = sum;
            result.average = sum / metrics.size();
            result.min = min;
            result.max = max;
        }
        
        private void calculatePercentiles(List<ProcessedMetric> metrics, EnrichedAggregatedMetric result) {
            double[] values = metrics.stream().mapToDouble(ProcessedMetric::getValue).sorted().toArray();
            
            result.p50 = calculatePercentile(values, 0.50);
            result.p90 = calculatePercentile(values, 0.90);
            result.p95 = calculatePercentile(values, 0.95);
            result.p99 = calculatePercentile(values, 0.99);
        }
        
        private void calculateMovingAverage(List<ProcessedMetric> metrics, EnrichedAggregatedMetric result) {
            // Simple moving average calculation
            int windowSize = Math.min(10, metrics.size()); // Use last 10 points
            double sum = 0;
            
            for (int i = metrics.size() - windowSize; i < metrics.size(); i++) {
                sum += metrics.get(i).getValue();
            }
            
            result.movingAverage = sum / windowSize;
        }
        
        private void calculateVariance(List<ProcessedMetric> metrics, EnrichedAggregatedMetric result) {
            if (result.average == 0) {
                calculateBasicStats(metrics, result); // Ensure average is calculated
            }
            
            double sumSquaredDiff = 0;
            for (ProcessedMetric metric : metrics) {
                double diff = metric.getValue() - result.average;
                sumSquaredDiff += diff * diff;
            }
            
            result.variance = sumSquaredDiff / metrics.size();
            result.standardDeviation = Math.sqrt(result.variance);
        }
        
        private void calculateRateOfChange(List<ProcessedMetric> metrics, EnrichedAggregatedMetric result) {
            if (metrics.size() < 2) {
                result.rateOfChange = 0.0;
                return;
            }
            
            // Sort by timestamp
            metrics.sort(Comparator.comparing(ProcessedMetric::getTimestamp));
            
            ProcessedMetric first = metrics.get(0);
            ProcessedMetric last = metrics.get(metrics.size() - 1);
            
            long timeDiff = last.getTimestamp() - first.getTimestamp();
            if (timeDiff > 0) {
                result.rateOfChange = (last.getValue() - first.getValue()) / (timeDiff / 1000.0); // per second
            } else {
                result.rateOfChange = 0.0;
            }
        }
        
        private double calculatePercentile(double[] sortedValues, double percentile) {
            if (sortedValues.length == 0) return 0.0;
            if (sortedValues.length == 1) return sortedValues[0];
            
            double index = percentile * (sortedValues.length - 1);
            int lowerIndex = (int) Math.floor(index);
            int upperIndex = (int) Math.ceil(index);
            
            if (lowerIndex == upperIndex) {
                return sortedValues[lowerIndex];
            } else {
                double weight = index - lowerIndex;
                return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
            }
        }
    }
    
    /**
     * Percentile window processor
     */
    public static class PercentileWindowProcessor extends ProcessWindowFunction<ProcessedMetric, PercentileMetric, String, TimeWindow> {
        
        private final double[] percentiles;
        
        public PercentileWindowProcessor(double[] percentiles) {
            this.percentiles = percentiles;
        }
        
        @Override
        public void process(String key, Context context, Iterable<ProcessedMetric> elements, Collector<PercentileMetric> out) throws Exception {
            List<Double> values = new ArrayList<>();
            elements.forEach(metric -> values.add(metric.getValue()));
            
            if (values.isEmpty()) {
                return;
            }
            
            Collections.sort(values);
            
            Map<Double, Double> percentileValues = new HashMap<>();
            for (double percentile : percentiles) {
                percentileValues.put(percentile, calculatePercentile(values, percentile));
            }
            
            PercentileMetric result = new PercentileMetric(
                key,
                context.window().getStart(),
                context.window().getEnd(),
                values.size(),
                percentileValues
            );
            
            out.collect(result);
        }
        
        private double calculatePercentile(List<Double> sortedValues, double percentile) {
            if (sortedValues.isEmpty()) return 0.0;
            if (sortedValues.size() == 1) return sortedValues.get(0);
            
            double index = percentile * (sortedValues.size() - 1);
            int lowerIndex = (int) Math.floor(index);
            int upperIndex = (int) Math.ceil(index);
            
            if (lowerIndex == upperIndex) {
                return sortedValues.get(lowerIndex);
            } else {
                double weight = index - lowerIndex;
                return sortedValues.get(lowerIndex) * (1 - weight) + sortedValues.get(upperIndex) * weight;
            }
        }
    }
    
    // Supporting classes
    public static class MetricAccumulator implements Serializable {
        public long count = 0;
        public double sum = 0.0;
        public double min = Double.MAX_VALUE;
        public double max = Double.MIN_VALUE;
        public double average = 0.0;
        public long firstTimestamp = 0;
        public long lastTimestamp = 0;
        public Map<String, String> tags;
    }
    
    public static class SessionAccumulator implements Serializable {
        public String metricName;
        public long sessionStart;
        public long lastActivity;
        public long count = 0;
        public double sum = 0.0;
        public double min = Double.MAX_VALUE;
        public double max = Double.MIN_VALUE;
        public Map<String, String> tags = new HashMap<>();
        
        public SessionAccumulator(String metricName, long sessionStart) {
            this.metricName = metricName;
            this.sessionStart = sessionStart;
            this.lastActivity = sessionStart;
        }
        
        public void addMetric(ProcessedMetric metric, long timestamp) {
            count++;
            sum += metric.getValue();
            min = Math.min(min, metric.getValue());
            max = Math.max(max, metric.getValue());
            lastActivity = timestamp;
            
            if (metric.getTags() != null) {
                tags.putAll(metric.getTags());
            }
        }
        
        public double getAverage() {
            return count > 0 ? sum / count : 0.0;
        }
    }
    
    public static class EnrichedAggregatedMetric implements Serializable {
        public String metricName;
        public long windowStart;
        public long windowEnd;
        public long count;
        public double sum;
        public double average;
        public double min;
        public double max;
        public double p50;
        public double p90;
        public double p95;
        public double p99;
        public double movingAverage;
        public double variance;
        public double standardDeviation;
        public double rateOfChange;
        public Map<String, String> tags;
    }
    
    public static class PercentileMetric implements Serializable {
        public String metricName;
        public long windowStart;
        public long windowEnd;
        public long count;
        public Map<Double, Double> percentiles;
        
        public PercentileMetric(String metricName, long windowStart, long windowEnd, 
                              long count, Map<Double, Double> percentiles) {
            this.metricName = metricName;
            this.windowStart = windowStart;
            this.windowEnd = windowEnd;
            this.count = count;
            this.percentiles = percentiles;
        }
    }
    
    public enum AggregationType {
        BASIC_STATS, PERCENTILES, MOVING_AVERAGE, VARIANCE, RATE_OF_CHANGE
    }
}