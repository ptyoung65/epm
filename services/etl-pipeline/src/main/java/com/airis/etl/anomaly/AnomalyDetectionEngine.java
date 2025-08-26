package com.airis.etl.anomaly;

import com.airis.etl.model.ProcessedMetric;
import org.apache.flink.api.common.functions.RichMapFunction;
import org.apache.flink.api.common.state.MapState;
import org.apache.flink.api.common.state.MapStateDescriptor;
import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.metrics.Counter;
import org.apache.flink.metrics.Gauge;
import org.apache.flink.metrics.Histogram;
import org.apache.flink.runtime.metrics.DescriptiveStatisticsHistogram;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.Serializable;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Anomaly Detection Engine
 * 
 * Advanced anomaly detection system using multiple algorithms including
 * statistical methods, machine learning techniques, and pattern recognition
 * for real-time detection of anomalies in streaming data.
 */
public class AnomalyDetectionEngine<T> extends KeyedProcessFunction<String, T, AnomalyAlert> {
    private static final Logger LOG = LoggerFactory.getLogger(AnomalyDetectionEngine.class);
    
    private final AnomalyDetectionConfig config;
    private final Set<AnomalyDetectionAlgorithm> enabledAlgorithms;
    
    // State for anomaly detection
    private transient MapState<String, StatisticalProfile> statisticalProfiles;
    private transient MapState<String, TimeSeriesData> timeSeriesData;
    private transient ValueState<MachineLearningModel> mlModel;
    private transient ValueState<Long> lastModelUpdate;
    
    // Metrics
    private transient Counter totalDataPoints;
    private transient Counter anomaliesDetected;
    private transient Counter falsePositives;
    private transient Counter truePositives;
    private transient Histogram anomalyScoreHistogram;
    private transient Gauge<Double> anomalyRate;
    private transient Gauge<Double> modelAccuracy;
    private transient final AtomicLong anomalyCount = new AtomicLong(0);
    private transient final AtomicLong dataPointCount = new AtomicLong(0);
    
    public AnomalyDetectionEngine(AnomalyDetectionConfig config, 
                                 Set<AnomalyDetectionAlgorithm> enabledAlgorithms) {
        this.config = config;
        this.enabledAlgorithms = enabledAlgorithms != null ? enabledAlgorithms : getDefaultAlgorithms();
        
        LOG.info("Anomaly detection engine initialized with {} algorithms: {}", 
                enabledAlgorithms.size(), enabledAlgorithms);
    }
    
    @Override
    public void open(Configuration parameters) throws Exception {
        super.open(parameters);
        
        // Initialize state
        MapStateDescriptor<String, StatisticalProfile> profileDescriptor = 
            new MapStateDescriptor<>("statistical_profiles",
                                   TypeInformation.of(String.class),
                                   TypeInformation.of(StatisticalProfile.class));
        statisticalProfiles = getRuntimeContext().getMapState(profileDescriptor);
        
        MapStateDescriptor<String, TimeSeriesData> timeSeriesDescriptor = 
            new MapStateDescriptor<>("time_series_data",
                                   TypeInformation.of(String.class),
                                   TypeInformation.of(TimeSeriesData.class));
        timeSeriesData = getRuntimeContext().getMapState(timeSeriesDescriptor);
        
        ValueStateDescriptor<MachineLearningModel> mlModelDescriptor = 
            new ValueStateDescriptor<>("ml_model",
                                     TypeInformation.of(MachineLearningModel.class));
        mlModel = getRuntimeContext().getState(mlModelDescriptor);
        
        ValueStateDescriptor<Long> lastUpdateDescriptor = 
            new ValueStateDescriptor<>("last_model_update",
                                     TypeInformation.of(Long.class));
        lastModelUpdate = getRuntimeContext().getState(lastUpdateDescriptor);
        
        // Initialize metrics
        totalDataPoints = getRuntimeContext().getMetricGroup().counter("anomaly_total_data_points");
        anomaliesDetected = getRuntimeContext().getMetricGroup().counter("anomaly_detected");
        falsePositives = getRuntimeContext().getMetricGroup().counter("anomaly_false_positives");
        truePositives = getRuntimeContext().getMetricGroup().counter("anomaly_true_positives");
        
        anomalyScoreHistogram = getRuntimeContext().getMetricGroup()
            .histogram("anomaly_score", new DescriptiveStatisticsHistogram(1000));
        
        anomalyRate = getRuntimeContext().getMetricGroup()
            .gauge("anomaly_rate", this::calculateAnomalyRate);
        
        modelAccuracy = getRuntimeContext().getMetricGroup()
            .gauge("model_accuracy", this::calculateModelAccuracy);
        
        LOG.debug("Anomaly detection engine opened successfully");
    }
    
    @Override
    public void processElement(T value, Context ctx, Collector<AnomalyAlert> out) throws Exception {
        long currentTime = ctx.timestamp() != null ? ctx.timestamp() : System.currentTimeMillis();
        
        totalDataPoints.inc();
        dataPointCount.incrementAndGet();
        
        try {
            // Extract features for anomaly detection
            FeatureVector features = extractFeatures(value, currentTime);
            
            // Run enabled anomaly detection algorithms
            List<AnomalyResult> results = new ArrayList<>();
            
            if (enabledAlgorithms.contains(AnomalyDetectionAlgorithm.STATISTICAL)) {
                results.add(detectStatisticalAnomalies(features, currentTime));
            }
            
            if (enabledAlgorithms.contains(AnomalyDetectionAlgorithm.ISOLATION_FOREST)) {
                results.add(detectIsolationForestAnomalies(features, currentTime));
            }
            
            if (enabledAlgorithms.contains(AnomalyDetectionAlgorithm.LSTM)) {
                results.add(detectLSTMAnomalies(features, currentTime));
            }
            
            if (enabledAlgorithms.contains(AnomalyDetectionAlgorithm.SEASONAL_DECOMPOSITION)) {
                results.add(detectSeasonalAnomalies(features, currentTime));
            }
            
            if (enabledAlgorithms.contains(AnomalyDetectionAlgorithm.CHANGE_POINT)) {
                results.add(detectChangePoints(features, currentTime));
            }
            
            // Combine results using ensemble method
            AnomalyResult combinedResult = combineResults(results, features);
            
            // Update models and profiles
            updateStatisticalProfile(features, currentTime);
            updateTimeSeriesData(features, currentTime);
            updateMachineLearningModel(features, combinedResult, currentTime);
            
            // Record anomaly score
            anomalyScoreHistogram.update((long) (combinedResult.anomalyScore * 1000));
            
            // Generate alert if anomaly detected
            if (combinedResult.isAnomaly) {
                AnomalyAlert alert = createAnomalyAlert(value, features, combinedResult, currentTime);
                out.collect(alert);
                
                anomaliesDetected.inc();
                anomalyCount.incrementAndGet();
                
                LOG.debug("Anomaly detected: score={}, algorithms={}, feature_key={}", 
                         combinedResult.anomalyScore, combinedResult.detectionAlgorithms, features.key);
            }
            
        } catch (Exception e) {
            LOG.error("Error during anomaly detection for key: {}", getFeatureKey(value), e);
            throw e;
        }
    }
    
    /**
     * Extract features from input data
     */
    private FeatureVector extractFeatures(T value, long timestamp) {
        FeatureVector features = new FeatureVector();
        features.timestamp = timestamp;
        features.key = getFeatureKey(value);
        
        if (value instanceof ProcessedMetric) {
            ProcessedMetric metric = (ProcessedMetric) value;
            features.numericValue = metric.getValue();
            features.category = metric.getCategory();
            features.severity = metric.getSeverity();
            features.attributes = new HashMap<>(metric.getTags());
        } else {
            // Generic feature extraction
            features.numericValue = extractNumericValue(value);
            features.category = extractCategory(value);
            features.attributes = extractAttributes(value);
        }
        
        return features;
    }
    
    /**
     * Statistical anomaly detection using Z-score and IQR
     */
    private AnomalyResult detectStatisticalAnomalies(FeatureVector features, long currentTime) throws Exception {
        StatisticalProfile profile = statisticalProfiles.get(features.key);
        
        if (profile == null || profile.sampleCount < config.getMinSamplesForDetection()) {
            // Not enough data for detection
            return new AnomalyResult(false, 0.0, "Insufficient data", 
                                   Collections.singleton(AnomalyDetectionAlgorithm.STATISTICAL));
        }
        
        // Z-score anomaly detection
        double zScore = Math.abs((features.numericValue - profile.mean) / profile.standardDeviation);
        boolean zScoreAnomaly = zScore > config.getZScoreThreshold();
        
        // IQR-based outlier detection
        double iqr = profile.q3 - profile.q1;
        double lowerBound = profile.q1 - 1.5 * iqr;
        double upperBound = profile.q3 + 1.5 * iqr;
        boolean iqrAnomaly = features.numericValue < lowerBound || features.numericValue > upperBound;
        
        // Modified Z-score using median
        double medianDeviation = Math.abs(features.numericValue - profile.median);
        double modifiedZScore = 0.6745 * medianDeviation / profile.medianAbsoluteDeviation;
        boolean modifiedZScoreAnomaly = modifiedZScore > config.getModifiedZScoreThreshold();
        
        // Combine statistical indicators
        boolean isAnomaly = zScoreAnomaly || iqrAnomaly || modifiedZScoreAnomaly;
        double anomalyScore = Math.max(Math.max(zScore / config.getZScoreThreshold(), 
                                               modifiedZScore / config.getModifiedZScoreThreshold()),
                                     iqrAnomaly ? 1.0 : 0.0);
        
        String explanation = String.format("Z-score: %.2f, IQR outlier: %s, Modified Z-score: %.2f", 
                                          zScore, iqrAnomaly, modifiedZScore);
        
        return new AnomalyResult(isAnomaly, anomalyScore, explanation, 
                               Collections.singleton(AnomalyDetectionAlgorithm.STATISTICAL));
    }
    
    /**
     * Isolation Forest anomaly detection
     */
    private AnomalyResult detectIsolationForestAnomalies(FeatureVector features, long currentTime) throws Exception {
        // Simplified isolation forest implementation
        // In production, use a proper machine learning library
        
        TimeSeriesData tsData = timeSeriesData.get(features.key);
        if (tsData == null || tsData.values.size() < config.getMinSamplesForDetection()) {
            return new AnomalyResult(false, 0.0, "Insufficient data for isolation forest", 
                                   Collections.singleton(AnomalyDetectionAlgorithm.ISOLATION_FOREST));
        }
        
        // Simple isolation score based on distance to nearest neighbors
        double isolationScore = calculateIsolationScore(features.numericValue, tsData.values);
        boolean isAnomaly = isolationScore > config.getIsolationForestThreshold();
        
        String explanation = String.format("Isolation score: %.3f", isolationScore);
        
        return new AnomalyResult(isAnomaly, isolationScore, explanation, 
                               Collections.singleton(AnomalyDetectionAlgorithm.ISOLATION_FOREST));
    }
    
    /**
     * LSTM-based time series anomaly detection
     */
    private AnomalyResult detectLSTMAnomalies(FeatureVector features, long currentTime) throws Exception {
        MachineLearningModel model = mlModel.value();
        
        if (model == null || !model.isTrained()) {
            return new AnomalyResult(false, 0.0, "LSTM model not trained", 
                                   Collections.singleton(AnomalyDetectionAlgorithm.LSTM));
        }
        
        // Get time series data for prediction
        TimeSeriesData tsData = timeSeriesData.get(features.key);
        if (tsData == null || tsData.values.size() < config.getLstmSequenceLength()) {
            return new AnomalyResult(false, 0.0, "Insufficient sequence data for LSTM", 
                                   Collections.singleton(AnomalyDetectionAlgorithm.LSTM));
        }
        
        // Predict next value using LSTM model
        double predictedValue = model.predict(tsData.getLastNValues(config.getLstmSequenceLength()));
        double predictionError = Math.abs(features.numericValue - predictedValue);
        double anomalyScore = predictionError / (model.getAveragePredictionError() + 1e-8);
        
        boolean isAnomaly = anomalyScore > config.getLstmAnomalyThreshold();
        
        String explanation = String.format("LSTM prediction error: %.3f, predicted: %.2f, actual: %.2f", 
                                          predictionError, predictedValue, features.numericValue);
        
        return new AnomalyResult(isAnomaly, anomalyScore, explanation, 
                               Collections.singleton(AnomalyDetectionAlgorithm.LSTM));
    }
    
    /**
     * Seasonal decomposition anomaly detection
     */
    private AnomalyResult detectSeasonalAnomalies(FeatureVector features, long currentTime) throws Exception {
        TimeSeriesData tsData = timeSeriesData.get(features.key);
        
        if (tsData == null || tsData.values.size() < config.getSeasonalPeriod() * 2) {
            return new AnomalyResult(false, 0.0, "Insufficient data for seasonal analysis", 
                                   Collections.singleton(AnomalyDetectionAlgorithm.SEASONAL_DECOMPOSITION));
        }
        
        // Simple seasonal decomposition
        SeasonalDecomposition decomposition = performSeasonalDecomposition(tsData, config.getSeasonalPeriod());
        
        // Calculate expected value based on trend and seasonal components
        int seasonalIndex = (int) ((currentTime / (1000 * 60 * 60)) % config.getSeasonalPeriod()); // Hourly seasonality
        double expectedValue = decomposition.trend + decomposition.seasonal[seasonalIndex];
        
        double residual = Math.abs(features.numericValue - expectedValue);
        double anomalyScore = residual / (decomposition.residualStdDev + 1e-8);
        
        boolean isAnomaly = anomalyScore > config.getSeasonalAnomalyThreshold();
        
        String explanation = String.format("Seasonal residual: %.3f, expected: %.2f, actual: %.2f", 
                                          residual, expectedValue, features.numericValue);
        
        return new AnomalyResult(isAnomaly, anomalyScore, explanation, 
                               Collections.singleton(AnomalyDetectionAlgorithm.SEASONAL_DECOMPOSITION));
    }
    
    /**
     * Change point detection
     */
    private AnomalyResult detectChangePoints(FeatureVector features, long currentTime) throws Exception {
        TimeSeriesData tsData = timeSeriesData.get(features.key);
        
        if (tsData == null || tsData.values.size() < config.getChangePointWindowSize()) {
            return new AnomalyResult(false, 0.0, "Insufficient data for change point detection", 
                                   Collections.singleton(AnomalyDetectionAlgorithm.CHANGE_POINT));
        }
        
        // CUSUM (Cumulative Sum) change point detection
        double changePointScore = calculateCUSUM(tsData.values, features.numericValue);
        boolean isAnomaly = changePointScore > config.getChangePointThreshold();
        
        String explanation = String.format("Change point score (CUSUM): %.3f", changePointScore);
        
        return new AnomalyResult(isAnomaly, changePointScore, explanation, 
                               Collections.singleton(AnomalyDetectionAlgorithm.CHANGE_POINT));
    }
    
    /**
     * Combine results from multiple algorithms using ensemble method
     */
    private AnomalyResult combineResults(List<AnomalyResult> results, FeatureVector features) {
        if (results.isEmpty()) {
            return new AnomalyResult(false, 0.0, "No algorithms executed", Collections.emptySet());
        }
        
        // Weighted voting ensemble
        double totalWeight = 0.0;
        double weightedScore = 0.0;
        int anomalyVotes = 0;
        Set<AnomalyDetectionAlgorithm> detectingAlgorithms = new HashSet<>();
        List<String> explanations = new ArrayList<>();
        
        for (AnomalyResult result : results) {
            double weight = getAlgorithmWeight(result.detectionAlgorithms.iterator().next());
            totalWeight += weight;
            weightedScore += result.anomalyScore * weight;
            
            if (result.isAnomaly) {
                anomalyVotes++;
                detectingAlgorithms.addAll(result.detectionAlgorithms);
            }
            
            explanations.add(result.explanation);
        }
        
        double combinedScore = totalWeight > 0 ? weightedScore / totalWeight : 0.0;
        
        // Consensus-based decision
        boolean isAnomaly = false;
        if (config.getEnsembleMethod() == EnsembleMethod.MAJORITY_VOTE) {
            isAnomaly = anomalyVotes > results.size() / 2;
        } else if (config.getEnsembleMethod() == EnsembleMethod.WEIGHTED_SCORE) {
            isAnomaly = combinedScore > config.getEnsembleThreshold();
        } else if (config.getEnsembleMethod() == EnsembleMethod.ANY_VOTE) {
            isAnomaly = anomalyVotes > 0;
        }
        
        String combinedExplanation = String.join("; ", explanations);
        
        return new AnomalyResult(isAnomaly, combinedScore, combinedExplanation, detectingAlgorithms);
    }
    
    /**
     * Create anomaly alert from detection result
     */
    private AnomalyAlert createAnomalyAlert(T value, FeatureVector features, AnomalyResult result, long timestamp) {
        AnomalySeverity severity = calculateSeverity(result.anomalyScore);
        
        return new AnomalyAlert(
            generateAlertId(features.key, timestamp),
            features.key,
            timestamp,
            result.anomalyScore,
            severity,
            result.detectionAlgorithms,
            result.explanation,
            features.numericValue,
            features.attributes,
            value.toString()
        );
    }
    
    // State update methods
    private void updateStatisticalProfile(FeatureVector features, long timestamp) throws Exception {
        StatisticalProfile profile = statisticalProfiles.get(features.key);
        if (profile == null) {
            profile = new StatisticalProfile();
        }
        
        profile.updateWith(features.numericValue);
        statisticalProfiles.put(features.key, profile);
    }
    
    private void updateTimeSeriesData(FeatureVector features, long timestamp) throws Exception {
        TimeSeriesData tsData = timeSeriesData.get(features.key);
        if (tsData == null) {
            tsData = new TimeSeriesData(config.getMaxTimeSeriesLength());
        }
        
        tsData.addDataPoint(features.numericValue, timestamp);
        timeSeriesData.put(features.key, tsData);
    }
    
    private void updateMachineLearningModel(FeatureVector features, AnomalyResult result, long timestamp) throws Exception {
        MachineLearningModel model = mlModel.value();
        Long lastUpdate = lastModelUpdate.value();
        
        if (model == null) {
            model = new MachineLearningModel();
        }
        
        // Update model with new training sample
        model.addTrainingSample(features, result);
        
        // Retrain model periodically
        if (lastUpdate == null || timestamp - lastUpdate > config.getModelRetrainingInterval()) {
            model.retrain();
            mlModel.update(model);
            lastModelUpdate.update(timestamp);
            LOG.info("Machine learning model retrained for better anomaly detection");
        }
    }
    
    // Helper methods
    private Set<AnomalyDetectionAlgorithm> getDefaultAlgorithms() {
        return EnumSet.of(
            AnomalyDetectionAlgorithm.STATISTICAL,
            AnomalyDetectionAlgorithm.ISOLATION_FOREST,
            AnomalyDetectionAlgorithm.CHANGE_POINT
        );
    }
    
    private String getFeatureKey(T value) {
        if (value instanceof ProcessedMetric) {
            return ((ProcessedMetric) value).getMetricName();
        }
        return value.getClass().getSimpleName() + "_" + value.hashCode();
    }
    
    private double extractNumericValue(T value) {
        if (value instanceof ProcessedMetric) {
            return ((ProcessedMetric) value).getValue();
        }
        // Generic numeric extraction
        return value.hashCode() % 1000; // Placeholder
    }
    
    private String extractCategory(T value) {
        if (value instanceof ProcessedMetric) {
            return ((ProcessedMetric) value).getCategory();
        }
        return "unknown";
    }
    
    private Map<String, String> extractAttributes(T value) {
        if (value instanceof ProcessedMetric) {
            return ((ProcessedMetric) value).getTags();
        }
        return new HashMap<>();
    }
    
    private double getAlgorithmWeight(AnomalyDetectionAlgorithm algorithm) {
        switch (algorithm) {
            case STATISTICAL: return 0.3;
            case ISOLATION_FOREST: return 0.25;
            case LSTM: return 0.2;
            case SEASONAL_DECOMPOSITION: return 0.15;
            case CHANGE_POINT: return 0.1;
            default: return 0.1;
        }
    }
    
    private double calculateAnomalyRate() {
        long total = dataPointCount.get();
        return total > 0 ? (double) anomalyCount.get() / total : 0.0;
    }
    
    private double calculateModelAccuracy() {
        long total = truePositives.getCount() + falsePositives.getCount();
        return total > 0 ? (double) truePositives.getCount() / total : 0.0;
    }
    
    private AnomalySeverity calculateSeverity(double anomalyScore) {
        if (anomalyScore > 0.8) return AnomalySeverity.CRITICAL;
        if (anomalyScore > 0.6) return AnomalySeverity.HIGH;
        if (anomalyScore > 0.4) return AnomalySeverity.MEDIUM;
        return AnomalySeverity.LOW;
    }
    
    private String generateAlertId(String key, long timestamp) {
        return String.format("anomaly_%s_%d_%d", key, timestamp, Thread.currentThread().getId());
    }
    
    // Algorithm-specific helper methods
    private double calculateIsolationScore(double value, List<Double> historicalValues) {
        // Simplified isolation score calculation
        List<Double> sortedValues = new ArrayList<>(historicalValues);
        Collections.sort(sortedValues);
        
        int index = Collections.binarySearch(sortedValues, value);
        if (index < 0) {
            index = -index - 1;
        }
        
        // Calculate isolation based on position in sorted list
        double normalizedPosition = (double) index / sortedValues.size();
        return Math.abs(0.5 - normalizedPosition) * 2.0; // 0 = perfectly normal, 1 = highly isolated
    }
    
    private double calculateCUSUM(List<Double> values, double currentValue) {
        if (values.size() < 2) return 0.0;
        
        double mean = values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double stdDev = Math.sqrt(values.stream().mapToDouble(v -> Math.pow(v - mean, 2)).average().orElse(1.0));
        
        double threshold = 2.0 * stdDev;
        double cusum = 0.0;
        
        for (double value : values) {
            cusum = Math.max(0, cusum + (value - mean) - threshold);
        }
        
        // Add current value
        cusum = Math.max(0, cusum + (currentValue - mean) - threshold);
        
        return cusum / (stdDev + 1e-8);
    }
    
    private SeasonalDecomposition performSeasonalDecomposition(TimeSeriesData tsData, int period) {
        // Simplified seasonal decomposition
        List<Double> values = tsData.values;
        double[] seasonal = new double[period];
        
        // Calculate seasonal component
        for (int i = 0; i < period; i++) {
            double sum = 0.0;
            int count = 0;
            
            for (int j = i; j < values.size(); j += period) {
                sum += values.get(j);
                count++;
            }
            
            seasonal[i] = count > 0 ? sum / count : 0.0;
        }
        
        // Calculate trend (moving average)
        double trend = values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        
        // Calculate residual standard deviation
        double residualSum = 0.0;
        int residualCount = 0;
        
        for (int i = 0; i < values.size(); i++) {
            double expectedValue = trend + seasonal[i % period];
            double residual = values.get(i) - expectedValue;
            residualSum += residual * residual;
            residualCount++;
        }
        
        double residualStdDev = residualCount > 0 ? Math.sqrt(residualSum / residualCount) : 1.0;
        
        return new SeasonalDecomposition(trend, seasonal, residualStdDev);
    }
    
    // Supporting classes and enums
    public enum AnomalyDetectionAlgorithm {
        STATISTICAL, ISOLATION_FOREST, LSTM, SEASONAL_DECOMPOSITION, CHANGE_POINT
    }
    
    public enum EnsembleMethod {
        MAJORITY_VOTE, WEIGHTED_SCORE, ANY_VOTE
    }
    
    public enum AnomalySeverity {
        LOW, MEDIUM, HIGH, CRITICAL
    }
    
    // Additional supporting classes would be defined here...
    public static class AnomalyDetectionConfig implements Serializable {
        private int minSamplesForDetection = 30;
        private double zScoreThreshold = 3.0;
        private double modifiedZScoreThreshold = 3.5;
        private double isolationForestThreshold = 0.6;
        private double lstmAnomalyThreshold = 2.0;
        private double seasonalAnomalyThreshold = 3.0;
        private double changePointThreshold = 5.0;
        private double ensembleThreshold = 0.5;
        private int lstmSequenceLength = 10;
        private int seasonalPeriod = 24; // 24 hours
        private int changePointWindowSize = 20;
        private int maxTimeSeriesLength = 1000;
        private long modelRetrainingInterval = 3600000L; // 1 hour
        private EnsembleMethod ensembleMethod = EnsembleMethod.WEIGHTED_SCORE;
        
        // Getters and setters
        public int getMinSamplesForDetection() { return minSamplesForDetection; }
        public double getZScoreThreshold() { return zScoreThreshold; }
        public double getModifiedZScoreThreshold() { return modifiedZScoreThreshold; }
        public double getIsolationForestThreshold() { return isolationForestThreshold; }
        public double getLstmAnomalyThreshold() { return lstmAnomalyThreshold; }
        public double getSeasonalAnomalyThreshold() { return seasonalAnomalyThreshold; }
        public double getChangePointThreshold() { return changePointThreshold; }
        public double getEnsembleThreshold() { return ensembleThreshold; }
        public int getLstmSequenceLength() { return lstmSequenceLength; }
        public int getSeasonalPeriod() { return seasonalPeriod; }
        public int getChangePointWindowSize() { return changePointWindowSize; }
        public int getMaxTimeSeriesLength() { return maxTimeSeriesLength; }
        public long getModelRetrainingInterval() { return modelRetrainingInterval; }
        public EnsembleMethod getEnsembleMethod() { return ensembleMethod; }
    }
    
    public static class FeatureVector implements Serializable {
        public String key;
        public long timestamp;
        public double numericValue;
        public String category;
        public String severity;
        public Map<String, String> attributes;
    }
    
    public static class AnomalyResult implements Serializable {
        public boolean isAnomaly;
        public double anomalyScore;
        public String explanation;
        public Set<AnomalyDetectionAlgorithm> detectionAlgorithms;
        
        public AnomalyResult(boolean isAnomaly, double anomalyScore, String explanation, 
                           Set<AnomalyDetectionAlgorithm> detectionAlgorithms) {
            this.isAnomaly = isAnomaly;
            this.anomalyScore = anomalyScore;
            this.explanation = explanation;
            this.detectionAlgorithms = detectionAlgorithms;
        }
    }
    
    public static class AnomalyAlert implements Serializable {
        public String alertId;
        public String featureKey;
        public long timestamp;
        public double anomalyScore;
        public AnomalySeverity severity;
        public Set<AnomalyDetectionAlgorithm> detectionAlgorithms;
        public String explanation;
        public double actualValue;
        public Map<String, String> attributes;
        public String rawData;
        
        public AnomalyAlert(String alertId, String featureKey, long timestamp, double anomalyScore,
                           AnomalySeverity severity, Set<AnomalyDetectionAlgorithm> detectionAlgorithms,
                           String explanation, double actualValue, Map<String, String> attributes,
                           String rawData) {
            this.alertId = alertId;
            this.featureKey = featureKey;
            this.timestamp = timestamp;
            this.anomalyScore = anomalyScore;
            this.severity = severity;
            this.detectionAlgorithms = detectionAlgorithms;
            this.explanation = explanation;
            this.actualValue = actualValue;
            this.attributes = attributes;
            this.rawData = rawData;
        }
    }
    
    public static class StatisticalProfile implements Serializable {
        public int sampleCount = 0;
        public double sum = 0.0;
        public double sumSquared = 0.0;
        public double mean = 0.0;
        public double variance = 0.0;
        public double standardDeviation = 0.0;
        public double min = Double.MAX_VALUE;
        public double max = Double.MIN_VALUE;
        public double median = 0.0;
        public double q1 = 0.0;
        public double q3 = 0.0;
        public double medianAbsoluteDeviation = 0.0;
        public List<Double> recentValues = new ArrayList<>();
        
        public void updateWith(double value) {
            sampleCount++;
            sum += value;
            sumSquared += value * value;
            min = Math.min(min, value);
            max = Math.max(max, value);
            
            mean = sum / sampleCount;
            variance = (sumSquared / sampleCount) - (mean * mean);
            standardDeviation = Math.sqrt(Math.max(variance, 0));
            
            // Keep recent values for quantile calculation
            recentValues.add(value);
            if (recentValues.size() > 100) {
                recentValues.remove(0);
            }
            
            // Update quantiles
            if (recentValues.size() >= 5) {
                updateQuantiles();
            }
        }
        
        private void updateQuantiles() {
            List<Double> sorted = new ArrayList<>(recentValues);
            Collections.sort(sorted);
            
            int n = sorted.size();
            q1 = sorted.get(n / 4);
            median = sorted.get(n / 2);
            q3 = sorted.get(3 * n / 4);
            
            // Calculate MAD
            double sumAbsoluteDeviations = 0.0;
            for (double value : sorted) {
                sumAbsoluteDeviations += Math.abs(value - median);
            }
            medianAbsoluteDeviation = sumAbsoluteDeviations / n;
        }
    }
    
    public static class TimeSeriesData implements Serializable {
        public List<Double> values = new ArrayList<>();
        public List<Long> timestamps = new ArrayList<>();
        private int maxLength;
        
        public TimeSeriesData(int maxLength) {
            this.maxLength = maxLength;
        }
        
        public void addDataPoint(double value, long timestamp) {
            values.add(value);
            timestamps.add(timestamp);
            
            if (values.size() > maxLength) {
                values.remove(0);
                timestamps.remove(0);
            }
        }
        
        public List<Double> getLastNValues(int n) {
            int start = Math.max(0, values.size() - n);
            return values.subList(start, values.size());
        }
    }
    
    public static class MachineLearningModel implements Serializable {
        private boolean trained = false;
        private double averagePredictionError = 1.0;
        private List<FeatureVector> trainingSamples = new ArrayList<>();
        private List<AnomalyResult> trainingLabels = new ArrayList<>();
        
        public boolean isTrained() { return trained; }
        public double getAveragePredictionError() { return averagePredictionError; }
        
        public void addTrainingSample(FeatureVector features, AnomalyResult result) {
            trainingSamples.add(features);
            trainingLabels.add(result);
        }
        
        public double predict(List<Double> sequence) {
            // Simplified prediction - in production use actual ML model
            return sequence.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        }
        
        public void retrain() {
            // Simplified retraining logic
            if (trainingSamples.size() > 10) {
                trained = true;
                // Update prediction error based on recent performance
                averagePredictionError = calculateAverageError();
            }
        }
        
        private double calculateAverageError() {
            // Placeholder calculation
            return 1.0;
        }
    }
    
    public static class SeasonalDecomposition implements Serializable {
        public double trend;
        public double[] seasonal;
        public double residualStdDev;
        
        public SeasonalDecomposition(double trend, double[] seasonal, double residualStdDev) {
            this.trend = trend;
            this.seasonal = seasonal;
            this.residualStdDev = residualStdDev;
        }
    }
}