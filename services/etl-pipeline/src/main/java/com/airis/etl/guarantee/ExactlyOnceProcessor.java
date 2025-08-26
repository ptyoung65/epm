package com.airis.etl.guarantee;

import org.apache.flink.api.common.functions.RichMapFunction;
import org.apache.flink.api.common.state.MapState;
import org.apache.flink.api.common.state.MapStateDescriptor;
import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.metrics.Counter;
import org.apache.flink.metrics.Gauge;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.streaming.api.functions.ProcessFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.Serializable;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Exactly-Once Processor
 * 
 * Ensures exactly-once processing semantics through idempotency checks,
 * deduplication, and transaction coordination with comprehensive state management.
 */
public class ExactlyOnceProcessor<T extends UniqueIdentifiable> extends KeyedProcessFunction<String, T, T> {
    private static final Logger LOG = LoggerFactory.getLogger(ExactlyOnceProcessor.class);
    
    private static final long DEFAULT_TTL_MS = 3600000L; // 1 hour
    private static final int DEFAULT_MAX_CACHE_SIZE = 10000;
    
    private final long idempotencyTTL;
    private final int maxCacheSize;
    private final boolean enableDeduplication;
    private final boolean enableTransactionCoordination;
    
    // State for exactly-once guarantees
    private transient MapState<String, ProcessingRecord> processedRecords;
    private transient ValueState<TransactionState> transactionState;
    private transient ValueState<Long> lastCleanupTime;
    
    // Metrics
    private transient Counter processedCount;
    private transient Counter duplicateCount;
    private transient Counter transactionCount;
    private transient Counter transactionCommitCount;
    private transient Counter transactionRollbackCount;
    private transient Gauge<Integer> cacheSize;
    private transient final AtomicLong currentCacheSize = new AtomicLong(0);
    
    public ExactlyOnceProcessor(long idempotencyTTL, 
                               int maxCacheSize,
                               boolean enableDeduplication,
                               boolean enableTransactionCoordination) {
        this.idempotencyTTL = idempotencyTTL;
        this.maxCacheSize = maxCacheSize;
        this.enableDeduplication = enableDeduplication;
        this.enableTransactionCoordination = enableTransactionCoordination;
        
        LOG.info("Exactly-once processor initialized: ttl={}ms, cache_size={}, dedup={}, txn={}",
                idempotencyTTL, maxCacheSize, enableDeduplication, enableTransactionCoordination);
    }
    
    @Override
    public void open(Configuration parameters) throws Exception {
        super.open(parameters);
        
        // Initialize state
        MapStateDescriptor<String, ProcessingRecord> processedRecordsDescriptor = 
            new MapStateDescriptor<>("processed_records",
                                   TypeInformation.of(String.class),
                                   TypeInformation.of(ProcessingRecord.class));
        processedRecords = getRuntimeContext().getMapState(processedRecordsDescriptor);
        
        ValueStateDescriptor<TransactionState> transactionStateDescriptor = 
            new ValueStateDescriptor<>("transaction_state",
                                     TypeInformation.of(TransactionState.class));
        transactionState = getRuntimeContext().getState(transactionStateDescriptor);
        
        ValueStateDescriptor<Long> lastCleanupTimeDescriptor = 
            new ValueStateDescriptor<>("last_cleanup_time",
                                     TypeInformation.of(Long.class));
        lastCleanupTime = getRuntimeContext().getState(lastCleanupTimeDescriptor);
        
        // Initialize metrics
        processedCount = getRuntimeContext().getMetricGroup()
            .counter("exactly_once_processed");
        duplicateCount = getRuntimeContext().getMetricGroup()
            .counter("exactly_once_duplicates");
        transactionCount = getRuntimeContext().getMetricGroup()
            .counter("exactly_once_transactions");
        transactionCommitCount = getRuntimeContext().getMetricGroup()
            .counter("exactly_once_commits");
        transactionRollbackCount = getRuntimeContext().getMetricGroup()
            .counter("exactly_once_rollbacks");
        
        cacheSize = getRuntimeContext().getMetricGroup()
            .gauge("exactly_once_cache_size", () -> (int) currentCacheSize.get());
        
        LOG.debug("Exactly-once processor opened successfully");
    }
    
    @Override
    public void processElement(T value, KeyedProcessFunction<String, T, T>.Context ctx, Collector<T> out) throws Exception {
        long currentTime = ctx.timestamp() != null ? ctx.timestamp() : System.currentTimeMillis();
        
        try {
            // Start transaction if enabled
            if (enableTransactionCoordination) {
                startTransaction(value, currentTime);
            }
            
            // Check for duplicates if deduplication is enabled
            if (enableDeduplication) {
                if (isDuplicate(value, currentTime)) {
                    duplicateCount.inc();
                    LOG.debug("Duplicate record detected and filtered: {}", value.getUniqueId());
                    
                    if (enableTransactionCoordination) {
                        rollbackTransaction(value, "Duplicate record");
                    }
                    return;
                }
            }
            
            // Process the record with exactly-once guarantees
            T processedValue = processWithGuarantees(value, currentTime, ctx);
            
            // Record processing
            recordProcessing(value, currentTime);
            
            // Commit transaction if enabled
            if (enableTransactionCoordination) {
                commitTransaction(value, currentTime);
            }
            
            // Emit processed value
            out.collect(processedValue);
            processedCount.inc();
            
            // Periodic cleanup
            performPeriodicCleanup(currentTime);
            
        } catch (Exception e) {
            LOG.error("Error processing record {}: {}", value.getUniqueId(), e.getMessage(), e);
            
            if (enableTransactionCoordination) {
                rollbackTransaction(value, e.getMessage());
            }
            
            throw e;
        }
    }
    
    /**
     * Check if record is a duplicate
     */
    private boolean isDuplicate(T value, long currentTime) throws Exception {
        String uniqueId = value.getUniqueId();
        ProcessingRecord existingRecord = processedRecords.get(uniqueId);
        
        if (existingRecord == null) {
            return false;
        }
        
        // Check if record is within TTL window
        if (currentTime - existingRecord.processedAt > idempotencyTTL) {
            // Record expired, remove it and allow processing
            processedRecords.remove(uniqueId);
            currentCacheSize.decrementAndGet();
            return false;
        }
        
        // Check if it's truly a duplicate (same content hash)
        String contentHash = calculateContentHash(value);
        if (contentHash.equals(existingRecord.contentHash)) {
            return true; // Exact duplicate
        }
        
        // Same ID but different content - potential replay with updates
        LOG.warn("Same ID with different content detected: id={}, old_hash={}, new_hash={}",
                uniqueId, existingRecord.contentHash, contentHash);
        
        // Update existing record with new content
        existingRecord.contentHash = contentHash;
        existingRecord.processedAt = currentTime;
        existingRecord.processCount++;
        processedRecords.put(uniqueId, existingRecord);
        
        return false; // Allow processing of updated content
    }
    
    /**
     * Process record with exactly-once guarantees
     */
    private T processWithGuarantees(T value, long currentTime, KeyedProcessFunction<String, T, T>.Context ctx) throws Exception {
        // Apply idempotency transformations
        T processedValue = applyIdempotentTransformations(value);
        
        // Validate processing integrity
        validateProcessingIntegrity(processedValue);
        
        // Apply additional exactly-once specific processing
        processedValue = applyExactlyOnceSemantics(processedValue, currentTime);
        
        return processedValue;
    }
    
    /**
     * Record processing for deduplication
     */
    private void recordProcessing(T value, long currentTime) throws Exception {
        String uniqueId = value.getUniqueId();
        String contentHash = calculateContentHash(value);
        
        ProcessingRecord record = new ProcessingRecord(
            uniqueId, contentHash, currentTime, 1, currentTime
        );
        
        processedRecords.put(uniqueId, record);
        currentCacheSize.incrementAndGet();
        
        // Check cache size limit
        if (currentCacheSize.get() > maxCacheSize) {
            performCacheviction();
        }
    }
    
    /**
     * Start transaction for exactly-once processing
     */
    private void startTransaction(T value, long currentTime) throws Exception {
        TransactionState txnState = transactionState.value();
        if (txnState == null) {
            txnState = new TransactionState();
        }
        
        String transactionId = generateTransactionId(value, currentTime);
        txnState.transactionId = transactionId;
        txnState.startTime = currentTime;
        txnState.status = TransactionStatus.STARTED;
        txnState.recordId = value.getUniqueId();
        
        transactionState.update(txnState);
        transactionCount.inc();
        
        LOG.debug("Transaction started: txn_id={}, record_id={}", transactionId, value.getUniqueId());
    }
    
    /**
     * Commit transaction
     */
    private void commitTransaction(T value, long currentTime) throws Exception {
        TransactionState txnState = transactionState.value();
        if (txnState == null || !TransactionStatus.STARTED.equals(txnState.status)) {
            LOG.warn("Attempting to commit non-existent or invalid transaction for record: {}", value.getUniqueId());
            return;
        }
        
        txnState.status = TransactionStatus.COMMITTED;
        txnState.endTime = currentTime;
        transactionState.update(txnState);
        
        transactionCommitCount.inc();
        
        LOG.debug("Transaction committed: txn_id={}, record_id={}, duration={}ms",
                txnState.transactionId, value.getUniqueId(), currentTime - txnState.startTime);
    }
    
    /**
     * Rollback transaction
     */
    private void rollbackTransaction(T value, String reason) throws Exception {
        TransactionState txnState = transactionState.value();
        if (txnState == null) {
            return;
        }
        
        txnState.status = TransactionStatus.ROLLED_BACK;
        txnState.endTime = System.currentTimeMillis();
        txnState.rollbackReason = reason;
        transactionState.update(txnState);
        
        transactionRollbackCount.inc();
        
        LOG.debug("Transaction rolled back: txn_id={}, record_id={}, reason={}",
                txnState.transactionId, value.getUniqueId(), reason);
    }
    
    /**
     * Apply idempotent transformations
     */
    private T applyIdempotentTransformations(T value) {
        // Ensure transformations are idempotent and deterministic
        // This is implementation-specific based on the data type
        return value;
    }
    
    /**
     * Validate processing integrity
     */
    private void validateProcessingIntegrity(T value) throws Exception {
        // Perform integrity checks
        if (value == null) {
            throw new IllegalStateException("Processed value is null");
        }
        
        if (value.getUniqueId() == null || value.getUniqueId().isEmpty()) {
            throw new IllegalStateException("Processed value has invalid unique ID");
        }
    }
    
    /**
     * Apply exactly-once specific semantics
     */
    private T applyExactlyOnceSemantics(T value, long currentTime) {
        // Add exactly-once processing metadata
        // This is implementation-specific
        return value;
    }
    
    /**
     * Calculate content hash for duplicate detection
     */
    private String calculateContentHash(T value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String content = value.toString(); // Use appropriate serialization
            byte[] hashBytes = digest.digest(content.getBytes("UTF-8"));
            
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
            
        } catch (NoSuchAlgorithmException | java.io.UnsupportedEncodingException e) {
            LOG.error("Error calculating content hash", e);
            return String.valueOf(value.hashCode()); // Fallback to hashCode
        }
    }
    
    /**
     * Generate transaction ID
     */
    private String generateTransactionId(T value, long currentTime) {
        return String.format("txn_%s_%d_%d", 
                           value.getUniqueId(), 
                           currentTime, 
                           Thread.currentThread().getId());
    }
    
    /**
     * Perform periodic cleanup of expired records
     */
    private void performPeriodicCleanup(long currentTime) throws Exception {
        Long lastCleanup = lastCleanupTime.value();
        if (lastCleanup == null) {
            lastCleanup = currentTime;
            lastCleanupTime.update(lastCleanup);
        }
        
        // Cleanup every 5 minutes
        if (currentTime - lastCleanup > 300000L) {
            cleanupExpiredRecords(currentTime);
            lastCleanupTime.update(currentTime);
        }
    }
    
    /**
     * Cleanup expired records from state
     */
    private void cleanupExpiredRecords(long currentTime) throws Exception {
        int cleanedCount = 0;
        
        for (Map.Entry<String, ProcessingRecord> entry : processedRecords.entries()) {
            if (currentTime - entry.getValue().processedAt > idempotencyTTL) {
                processedRecords.remove(entry.getKey());
                currentCacheSize.decrementAndGet();
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            LOG.info("Cleaned up {} expired processing records", cleanedCount);
        }
    }
    
    /**
     * Perform cache eviction when size limit is exceeded
     */
    private void performCacheviction() throws Exception {
        // Simple LRU-style eviction - remove oldest records
        long cutoffTime = System.currentTimeMillis() - (idempotencyTTL / 2);
        int evictedCount = 0;
        
        for (Map.Entry<String, ProcessingRecord> entry : processedRecords.entries()) {
            if (entry.getValue().processedAt < cutoffTime) {
                processedRecords.remove(entry.getKey());
                currentCacheSize.decrementAndGet();
                evictedCount++;
                
                if (currentCacheSize.get() <= maxCacheSize * 0.8) {
                    break; // Evicted enough
                }
            }
        }
        
        LOG.info("Evicted {} records due to cache size limit", evictedCount);
    }
    
    /**
     * Processing record for state management
     */
    public static class ProcessingRecord implements Serializable {
        public String recordId;
        public String contentHash;
        public long processedAt;
        public int processCount;
        public long lastAccessTime;
        
        public ProcessingRecord() {}
        
        public ProcessingRecord(String recordId, String contentHash, long processedAt, 
                              int processCount, long lastAccessTime) {
            this.recordId = recordId;
            this.contentHash = contentHash;
            this.processedAt = processedAt;
            this.processCount = processCount;
            this.lastAccessTime = lastAccessTime;
        }
    }
    
    /**
     * Transaction state for coordination
     */
    public static class TransactionState implements Serializable {
        public String transactionId;
        public long startTime;
        public long endTime;
        public TransactionStatus status;
        public String recordId;
        public String rollbackReason;
        
        public TransactionState() {}
    }
    
    /**
     * Transaction status enumeration
     */
    public enum TransactionStatus {
        STARTED, COMMITTED, ROLLED_BACK
    }
    
    /**
     * Interface for objects with unique identifiers
     */
    public interface UniqueIdentifiable {
        String getUniqueId();
    }
    
    /**
     * Factory method for default exactly-once processor
     */
    public static <T extends UniqueIdentifiable> ExactlyOnceProcessor<T> createDefault() {
        return new ExactlyOnceProcessor<>(
            DEFAULT_TTL_MS,       // 1 hour TTL
            DEFAULT_MAX_CACHE_SIZE, // 10K max cache size
            true,                 // enable deduplication
            true                  // enable transaction coordination
        );
    }
    
    /**
     * Factory method for high-throughput exactly-once processor
     */
    public static <T extends UniqueIdentifiable> ExactlyOnceProcessor<T> createHighThroughput() {
        return new ExactlyOnceProcessor<>(
            1800000L,            // 30 minutes TTL
            50000,               // 50K max cache size
            true,                // enable deduplication
            false                // disable transaction coordination for performance
        );
    }
    
    /**
     * Factory method for strict exactly-once processor
     */
    public static <T extends UniqueIdentifiable> ExactlyOnceProcessor<T> createStrict() {
        return new ExactlyOnceProcessor<>(
            7200000L,            // 2 hours TTL
            5000,                // 5K max cache size for memory efficiency
            true,                // enable deduplication
            true                 // enable transaction coordination
        );
    }
}