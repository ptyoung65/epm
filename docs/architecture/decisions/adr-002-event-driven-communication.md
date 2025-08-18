# ADR-002: Event-Driven Communication with Apache Kafka

## Status
Accepted

## Context
AIRIS-MON needs to handle high-throughput data ingestion and real-time processing of AI monitoring data. The system must be resilient, scalable, and capable of handling data streams from multiple sources while ensuring reliable delivery and processing.

## Decision
We will implement event-driven communication using Apache Kafka as the primary message streaming platform for asynchronous inter-service communication.

## Rationale

### Why Event-Driven Architecture?
- **Decoupling**: Services communicate through events without direct dependencies
- **Scalability**: Easy to add new consumers without affecting producers
- **Resilience**: Asynchronous processing reduces cascade failures
- **Audit Trail**: Events provide natural audit logging
- **Real-time Processing**: Enables stream processing and real-time analytics

### Why Apache Kafka?
- **High Throughput**: Handles millions of messages per second
- **Horizontal Scaling**: Easy to add brokers and partitions
- **Durability**: Persistent storage with configurable retention
- **Stream Processing**: Built-in Kafka Streams for data processing
- **Ecosystem**: Rich connector ecosystem for integrations

## Implementation Details

### Topic Design Strategy

#### Topic Naming Convention
```
airis-mon.{domain}.{event-type}.{version}

Examples:
- airis-mon.metrics.received.v1
- airis-mon.alerts.triggered.v1
- airis-mon.models.deployed.v1
- airis-mon.users.authenticated.v1
```

#### Core Topics
```yaml
Topics:
  # Data Ingestion
  - airis-mon.metrics.raw.v1          # Raw metrics from AI systems
  - airis-mon.events.raw.v1           # Raw events from AI systems
  - airis-mon.logs.raw.v1             # Raw log data
  
  # Processed Data
  - airis-mon.metrics.processed.v1    # Validated and enriched metrics
  - airis-mon.events.processed.v1     # Processed and categorized events
  - airis-mon.alerts.triggered.v1     # Generated alerts
  
  # System Events
  - airis-mon.system.health.v1        # System health events
  - airis-mon.config.changed.v1       # Configuration changes
  - airis-mon.users.activity.v1       # User activity events
```

### Event Schema Design

#### Base Event Structure
```json
{
  "id": "evt_uuid_here",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0",
  "source": "service-name",
  "type": "event.type.name",
  "data": {
    // Event-specific payload
  },
  "metadata": {
    "correlation_id": "correlation_uuid",
    "causation_id": "parent_event_uuid",
    "user_id": "user_uuid",
    "tenant_id": "tenant_uuid"
  }
}
```

#### Metric Event Example
```json
{
  "id": "evt_metric_12345",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0",
  "source": "data-ingestion-service",
  "type": "metric.received",
  "data": {
    "metric_name": "inference_latency",
    "value": 125.5,
    "unit": "milliseconds",
    "tags": {
      "model_id": "bert-v1.0",
      "environment": "production"
    }
  },
  "metadata": {
    "correlation_id": "req_abc123",
    "tenant_id": "tenant_xyz"
  }
}
```

### Kafka Configuration

#### Production Settings
```properties
# Broker Configuration
num.network.threads=8
num.io.threads=16
socket.send.buffer.bytes=102400
socket.receive.buffer.bytes=102400
socket.request.max.bytes=104857600

# Log Configuration
log.retention.hours=168
log.segment.bytes=1073741824
log.retention.check.interval.ms=300000

# Replication
default.replication.factor=3
min.insync.replicas=2

# Performance
compression.type=snappy
batch.size=16384
linger.ms=5
```

#### Topic Configurations
```yaml
Topics:
  airis-mon.metrics.raw.v1:
    partitions: 12
    replication_factor: 3
    retention_ms: 86400000  # 24 hours
    
  airis-mon.events.processed.v1:
    partitions: 6
    replication_factor: 3
    retention_ms: 604800000  # 7 days
    
  airis-mon.alerts.triggered.v1:
    partitions: 3
    replication_factor: 3
    retention_ms: 2592000000  # 30 days
```

### Consumer Patterns

#### Competing Consumers
```javascript
// Multiple instances processing from the same consumer group
const consumer = kafka.consumer({ 
  groupId: 'metrics-processor',
  maxWaitTimeInMs: 3000,
  maxBytesPerPartition: 1048576
});

await consumer.subscribe({ topic: 'airis-mon.metrics.raw.v1' });
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    await processMetric(message.value);
  }
});
```

#### Event Sourcing Pattern
```javascript
// Replay events from beginning for rebuilding state
const consumer = kafka.consumer({ 
  groupId: 'state-rebuilder',
  fromBeginning: true
});

await consumer.run({
  eachMessage: async ({ message }) => {
    await applyEventToState(JSON.parse(message.value.toString()));
  }
});
```

### Producer Patterns

#### Reliable Publishing
```javascript
const producer = kafka.producer({
  idempotent: true,
  maxInFlightRequests: 1,
  retries: Number.MAX_SAFE_INTEGER,
  acks: 'all'
});

await producer.send({
  topic: 'airis-mon.metrics.processed.v1',
  messages: [{
    key: metricId,
    value: JSON.stringify(processedMetric),
    timestamp: Date.now(),
    headers: {
      'correlation-id': correlationId,
      'content-type': 'application/json'
    }
  }]
});
```

### Stream Processing with Kafka Streams

#### Anomaly Detection Pipeline
```javascript
const anomalyDetector = new KafkaStreams({
  kafka: kafkaConfig,
  applicationId: 'anomaly-detector'
});

anomalyDetector
  .stream('airis-mon.metrics.processed.v1')
  .filter((key, value) => value.metric_name === 'inference_latency')
  .groupByKey()
  .windowedBy(TimeWindows.of(Duration.ofMinutes(5)))
  .aggregate(
    () => ({ sum: 0, count: 0 }),
    (key, value, aggregate) => ({
      sum: aggregate.sum + value.data.value,
      count: aggregate.count + 1
    })
  )
  .toStream()
  .filter((key, value) => {
    const avg = value.sum / value.count;
    return avg > ANOMALY_THRESHOLD;
  })
  .to('airis-mon.alerts.triggered.v1');
```

## Error Handling & Dead Letter Queues

### Dead Letter Topic Pattern
```yaml
Dead Letter Topics:
  - airis-mon.metrics.raw.v1.dlq
  - airis-mon.events.raw.v1.dlq
  - airis-mon.alerts.failed.v1.dlq
```

### Retry Strategy
```javascript
const retryConfig = {
  retries: 3,
  initialRetryDelayMs: 1000,
  retryDelayMultiplier: 2,
  maxRetryDelayMs: 30000
};

async function processWithRetry(message, processor) {
  let attempt = 0;
  while (attempt <= retryConfig.retries) {
    try {
      await processor(message);
      return;
    } catch (error) {
      attempt++;
      if (attempt > retryConfig.retries) {
        await sendToDeadLetter(message, error);
        return;
      }
      await delay(calculateRetryDelay(attempt));
    }
  }
}
```

## Monitoring & Observability

### Key Metrics to Monitor
```yaml
Producer Metrics:
  - record-send-rate
  - record-error-rate
  - request-latency-avg
  - batch-size-avg

Consumer Metrics:
  - records-consumed-rate
  - fetch-latency-avg
  - commit-latency-avg
  - consumer-lag

Broker Metrics:
  - bytes-in-per-sec
  - bytes-out-per-sec
  - messages-in-per-sec
  - request-handler-avg-idle-percent
```

### Distributed Tracing
```javascript
// OpenTelemetry integration
const tracer = opentelemetry.trace.getTracer('kafka-service');

async function publishEvent(event) {
  const span = tracer.startSpan('kafka.publish');
  span.setAttributes({
    'messaging.system': 'kafka',
    'messaging.destination': topic,
    'messaging.operation': 'publish'
  });
  
  try {
    // Inject trace context into message headers
    const headers = {};
    opentelemetry.propagation.inject(
      opentelemetry.context.active(), 
      headers
    );
    
    await producer.send({
      topic,
      messages: [{ 
        value: JSON.stringify(event),
        headers 
      }]
    });
    
    span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({
      code: opentelemetry.SpanStatusCode.ERROR,
      message: error.message
    });
    throw error;
  } finally {
    span.end();
  }
}
```

## Security Considerations

### Authentication & Authorization
```yaml
# SASL/SSL Configuration
security.protocol: SASL_SSL
sasl.mechanism: SCRAM-SHA-512
sasl.username: airis-mon-service
sasl.password: ${KAFKA_PASSWORD}

# ACLs
ACLs:
  - principal: User:data-ingestion-service
    operation: WRITE
    resource: Topic:airis-mon.metrics.raw.v1
    
  - principal: User:analytics-service
    operation: READ
    resource: Topic:airis-mon.metrics.processed.v1
    
  - principal: User:alert-service
    operation: WRITE
    resource: Topic:airis-mon.alerts.triggered.v1
```

### Message Encryption
```javascript
// Client-side message encryption
const encryptedMessage = await encrypt(
  JSON.stringify(sensitiveEvent),
  process.env.MESSAGE_ENCRYPTION_KEY
);

await producer.send({
  topic: 'airis-mon.sensitive-data.v1',
  messages: [{
    value: encryptedMessage,
    headers: {
      'encryption': 'aes-256-gcm',
      'encrypted': 'true'
    }
  }]
});
```

## Consequences

### Positive
- **Scalability**: Easy to scale consumers and producers independently
- **Reliability**: Guaranteed delivery with acknowledgments and retries
- **Performance**: High throughput with batch processing
- **Flexibility**: Easy to add new event consumers without affecting producers
- **Audit Trail**: Complete event history for debugging and compliance

### Negative
- **Complexity**: Additional operational overhead for Kafka cluster
- **Consistency**: Eventual consistency model requires careful design
- **Debugging**: Distributed event flows can be harder to trace
- **Resource Usage**: Memory and disk usage for message buffering

## Alternatives Considered

### RabbitMQ
**Pros**: Rich feature set, easier operations, better tooling
**Cons**: Lower throughput, vertical scaling limitations
**Decision**: Will use RabbitMQ for specific use cases requiring complex routing

### Amazon SQS/SNS
**Pros**: Managed service, no operational overhead
**Cons**: Vendor lock-in, higher costs at scale, feature limitations
**Decision**: Considered for cloud-specific deployments

### Redis Streams
**Pros**: Simple setup, good performance for smaller scales
**Cons**: Limited persistence guarantees, memory constraints
**Decision**: Used for specific real-time use cases

## Implementation Timeline

### Phase 1 (Weeks 1-2)
- Set up Kafka cluster in development environment
- Implement basic producer/consumer libraries
- Create core topic structure

### Phase 2 (Weeks 3-4)
- Implement event schemas and validation
- Set up monitoring and alerting
- Create dead letter queue handling

### Phase 3 (Weeks 5-6)
- Implement stream processing pipelines
- Add security and authentication
- Performance tuning and optimization

### Phase 4 (Weeks 7-8)
- Production deployment
- Documentation and training
- Monitoring and maintenance procedures

## Success Metrics
- Message throughput: 100K+ messages/second
- End-to-end latency: < 100ms for 95th percentile
- Message loss rate: < 0.001%
- Consumer lag: < 10 seconds during peak hours

---
**Created**: 2024-01-01  
**Author**: System Architecture Team  
**Stakeholders**: Engineering Team, DevOps Team, Product Team