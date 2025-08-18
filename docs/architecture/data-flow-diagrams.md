# AIRIS-MON Data Flow Diagrams

## Overview

This document provides detailed data flow diagrams for the AIRIS-MON platform, illustrating how data moves through the system from ingestion to visualization.

## 1. High-Level Data Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Systems    │    │   Collectors    │    │  Event Stream   │
│                 │───▶│                 │───▶│     (Kafka)     │
│ • Models        │    │ • Metrics       │    │                 │
│ • Services      │    │ • Events        │    │ • Partitioned   │
│ • Applications  │    │ • Logs          │    │ • Replicated    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dashboards    │    │   Data Stores   │    │   Processors    │
│                 │◀───│                 │◀───│                 │
│ • Real-time     │    │ • InfluxDB      │    │ • Validation    │
│ • Historical    │    │ • PostgreSQL    │    │ • Enrichment    │
│ • Alerts        │    │ • MongoDB       │    │ • Aggregation   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 2. Detailed Ingestion Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                      Data Ingestion Layer                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Metrics   │  │   Events    │  │    Logs     │              │
│  │ Collector   │  │ Collector   │  │Aggregator   │              │
│  │             │  │             │  │             │              │
│  │ • REST API  │  │ • Webhooks  │  │ • FluentBit │              │
│  │ • Push/Pull │  │ • SSE       │  │ • Syslog    │              │
│  │ • Batch     │  │ • WebSocket │  │ • File      │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               Validation Layer                          │    │
│  │                                                         │    │
│  │ • Schema Validation    • Rate Limiting                  │    │
│  │ • Data Sanitization    • Duplicate Detection           │    │
│  │ • Format Conversion    • Authentication                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                │                                │
│                                ▼                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               Apache Kafka Topics                      │    │
│  │                                                         │    │
│  │ metrics-raw     │ events-raw      │ logs-raw           │    │
│  │ • Partitioned   │ • Partitioned   │ • Partitioned      │    │
│  │ • Replicated    │ • Replicated    │ • Replicated       │    │
│  │ • Retention:24h │ • Retention:7d  │ • Retention:30d    │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

## 3. Stream Processing Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                   Stream Processing Layer                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│ │   Kafka         │  │   Kafka         │  │   Kafka         │   │
│ │   Streams       │  │   Streams       │  │   Streams       │   │
│ │                 │  │                 │  │                 │   │
│ │ • Metrics       │  │ • Events        │  │ • Logs          │   │
│ │   Processor     │  │   Processor     │  │   Processor     │   │
│ │                 │  │                 │  │                 │   │
│ │ Enrichment:     │  │ Enrichment:     │  │ Processing:     │   │
│ │ • Metadata      │  │ • Correlation   │  │ • Parsing       │   │
│ │ • Tagging       │  │ • Context       │  │ • Indexing      │   │
│ │ • Aggregation   │  │ • Classification│  │ • Filtering     │   │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘   │
│         │                     │                     │            │
│         ▼                     ▼                     ▼            │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │              Processed Data Topics                          │  │
│ │                                                             │  │
│ │ metrics-processed │ events-processed │ logs-processed      │  │
│ │ • Time-windowed   │ • Correlated     │ • Structured        │  │
│ │ • Aggregated      │ • Enriched       │ • Indexed           │  │
│ │ • Validated       │ • Categorized    │ • Searchable        │  │
│ └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## 4. Storage Architecture Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      Storage Layer                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│ │   Hot Storage   │  │  Warm Storage   │  │  Cold Storage   │   │
│ │    (Redis)      │  │   (InfluxDB)    │  │   (S3/MinIO)    │   │
│ │                 │  │                 │  │                 │   │
│ │ • Last 1 hour   │  │ • Last 30 days  │  │ • Historical    │   │
│ │ • In-memory     │  │ • Time-series   │  │ • Compressed    │   │
│ │ • Sub-ms access │  │ • Indexed       │  │ • Archived      │   │
│ │                 │  │ • Compressed    │  │                 │   │
│ │ Data Types:     │  │ Data Types:     │  │ Data Types:     │   │
│ │ • Live metrics  │  │ • Historical    │  │ • Long-term     │   │
│ │ • Active alerts │  │   metrics       │  │   archives      │   │
│ │ • Dashboard     │  │ • Aggregated    │  │ • Compliance    │   │
│ │   cache         │  │   data          │  │   data          │   │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘   │
│         ▲                     ▲                     ▲            │
│         │                     │                     │            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Data Lifecycle Management                    │ │
│  │                                                             │ │
│  │ • Automatic tiering based on age                           │ │
│  │ • Compression policies                                      │ │
│  │ • Retention policies                                        │ │
│  │ • Backup and recovery                                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## 5. Real-time Analytics Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                   Analytics Engine                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Input Streams                    Processing                      │
│ ┌─────────────┐                 ┌─────────────┐                 │
│ │   Metrics   │────────────────▶│  Anomaly    │                 │
│ │   Stream    │                 │  Detection  │                 │
│ └─────────────┘                 │             │                 │
│ ┌─────────────┐                 │ • Z-score   │                 │
│ │   Events    │────────────────▶│ • IQR       │                 │
│ │   Stream    │                 │ • ML models │                 │
│ └─────────────┘                 └─────────────┘                 │
│                                         │                        │
│                                         ▼                        │
│                                 ┌─────────────┐                 │
│                                 │ Correlation │                 │
│                                 │   Engine    │                 │
│                                 │             │                 │
│                                 │ • Pattern   │                 │
│                                 │   matching  │                 │
│                                 │ • Root cause│                 │
│                                 │   analysis  │                 │
│                                 └─────────────┘                 │
│                                         │                        │
│                                         ▼                        │
│                                 ┌─────────────┐                 │
│                                 │   Alert     │                 │
│                                 │  Generator  │                 │
│                                 │             │                 │
│                                 │ • Rule      │                 │
│                                 │   engine    │                 │
│                                 │ • Severity  │                 │
│                                 │   ranking   │                 │
│                                 │ • Routing   │                 │
│                                 └─────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

## 6. Alert Processing Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    Alert Processing                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│ │   Alert     │    │ Rule Engine │    │ Enrichment  │           │
│ │ Generated   │───▶│             │───▶│   Service   │           │
│ │             │    │ • Threshold │    │             │           │
│ │ • Raw data  │    │   matching  │    │ • Context   │           │
│ │ • Timestamp │    │ • Pattern   │    │   addition  │           │
│ │ • Source    │    │   detection │    │ • Metadata  │           │
│ │ • Severity  │    │ • Suppression│   │   lookup    │           │
│ └─────────────┘    │   rules     │    │ • Historical│           │
│                    └─────────────┘    │   context   │           │
│                                       └─────────────┘           │
│                                              │                   │
│                                              ▼                   │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│ │ Notification│    │  Routing    │    │ Escalation  │           │
│ │  Delivery   │◀───│   Logic     │◀───│  Manager    │           │
│ │             │    │             │    │             │           │
│ │ • Email     │    │ • Team      │    │ • Time-based│           │
│ │ • Slack     │    │   routing   │    │ • Severity  │           │
│ │ • PagerDuty │    │ • Priority  │    │   based     │           │
│ │ • SMS       │    │   based     │    │ • Acknowl-  │           │
│ │ • Webhook   │    │ • Round     │    │   edgment   │           │
│ │             │    │   robin     │    │   tracking  │           │
│ └─────────────┘    └─────────────┘    └─────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

## 7. API Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        API Gateway                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│ │   Client    │    │    API      │    │    Rate     │           │
│ │  Request    │───▶│  Gateway    │───▶│  Limiting   │           │
│ │             │    │             │    │             │           │
│ │ • Headers   │    │ • Routing   │    │ • Per user  │           │
│ │ • Auth      │    │ • Load      │    │ • Per API   │           │
│ │ • Payload   │    │   balancing │    │ • Global    │           │
│ └─────────────┘    │ • SSL term  │    └─────────────┘           │
│                    └─────────────┘           │                   │
│                           │                  ▼                   │
│                           ▼          ┌─────────────┐             │
│                    ┌─────────────┐   │    Auth     │             │
│                    │   Request   │   │  Service    │             │
│                    │ Validation  │◀──│             │             │
│                    │             │   │ • JWT       │             │
│                    │ • Schema    │   │ • API keys  │             │
│                    │ • Headers   │   │ • RBAC      │             │
│                    │ • Payload   │   └─────────────┘             │
│                    └─────────────┘                               │
│                           │                                      │
│                           ▼                                      │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│ │  Response   │    │  Service    │    │   Cache     │           │
│ │  Assembly   │◀───│   Router    │───▶│   Layer     │           │
│ │             │    │             │    │             │           │
│ │ • Format    │    │ • Metrics   │    │ • Redis     │           │
│ │ • Headers   │    │   API       │    │ • TTL based │           │
│ │ • Status    │    │ • Events    │    │ • Invalidat │           │
│ │ • Body      │    │   API       │    │   ion       │           │
│ └─────────────┘    │ • Config    │    └─────────────┘           │
│                    │   API       │                              │
│                    │ • Reports   │                              │
│                    │   API       │                              │
│                    └─────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
```

## 8. Dashboard Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      Frontend Data Flow                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│ │   User      │    │   React     │    │   Redux     │           │
│ │ Interaction │───▶│ Components  │───▶│   Store     │           │
│ │             │    │             │    │             │           │
│ │ • Click     │    │ • Dashboard │    │ • State     │           │
│ │ • Filter    │    │ • Charts    │    │   management│           │
│ │ • Search    │    │ • Tables    │    │ • Actions   │           │
│ │ • Navigate  │    │ • Forms     │    │ • Reducers  │           │
│ └─────────────┘    └─────────────┘    └─────────────┘           │
│                           │                   │                  │
│                           ▼                   ▼                  │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│ │  Render     │    │   API       │    │ WebSocket   │           │
│ │  Update     │◀───│   Client    │───▶│ Connection  │           │
│ │             │    │             │    │             │           │
│ │ • Charts    │    │ • HTTP      │    │ • Real-time │           │
│ │ • Tables    │    │   requests  │    │   updates   │           │
│ │ • Alerts    │    │ • Caching   │    │ • Event     │           │
│ │ • Status    │    │ • Error     │    │   streaming │           │
│ │             │    │   handling  │    │             │           │
│ └─────────────┘    └─────────────┘    └─────────────┘           │
│                           │                   │                  │
│                           ▼                   ▼                  │
│                    ┌─────────────────────────────────┐          │
│                    │          Backend APIs           │          │
│                    │                                 │          │
│                    │ • Metrics API (/api/metrics)    │          │
│                    │ • Events API (/api/events)      │          │
│                    │ • Alerts API (/api/alerts)      │          │
│                    │ • Config API (/api/config)      │          │
│                    │ • Users API (/api/users)        │          │
│                    │ • Reports API (/api/reports)    │          │
│                    └─────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

## 9. Data Transformation Pipeline

```
Raw Data → Validation → Enrichment → Aggregation → Storage → Query → Visualization

┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Raw Input  │    │ Validation  │    │ Enrichment  │
│             │───▶│             │───▶│             │
│ • Metrics   │    │ • Schema    │    │ • Metadata  │
│ • Events    │    │ • Format    │    │ • Context   │
│ • Logs      │    │ • Range     │    │ • Tags      │
│ • Traces    │    │ • Required  │    │ • Correlat- │
│             │    │   fields    │    │   ion IDs   │
└─────────────┘    └─────────────┘    └─────────────┘
                          │                   │
                          ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│Visualization│    │   Storage   │    │Aggregation  │
│             │◀───│             │◀───│             │
│ • Charts    │    │ • Hot       │    │ • Time      │
│ • Tables    │    │ • Warm      │    │   windows   │
│ • Alerts    │    │ • Cold      │    │ • Rollups   │
│ • Reports   │    │ • Indexes   │    │ • Summary   │
│             │    │ • Partitions│    │   stats     │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 10. Monitoring Data Model

### Metrics Data Structure
```json
{
  "namespace": "airis-mon",
  "metric_name": "inference_latency",
  "timestamp": "2024-01-01T12:00:00Z",
  "value": 125.5,
  "unit": "milliseconds",
  "dimensions": {
    "model_id": "bert-v1.0",
    "environment": "production",
    "region": "us-west-2",
    "instance_id": "i-1234567890"
  },
  "metadata": {
    "request_id": "req_abc123",
    "batch_size": 32,
    "input_tokens": 512
  }
}
```

### Event Data Structure
```json
{
  "event_id": "evt_xyz789",
  "timestamp": "2024-01-01T12:00:00Z",
  "event_type": "model_deployment",
  "source": "deployment-service",
  "severity": "info",
  "message": "Model deployed successfully",
  "attributes": {
    "model_id": "bert-v1.1",
    "version": "1.1.0",
    "deployment_time": 45.2,
    "rollback_available": true
  },
  "context": {
    "user_id": "user_123",
    "session_id": "session_456",
    "trace_id": "trace_789"
  }
}
```

### Alert Data Structure
```json
{
  "alert_id": "alert_def456",
  "timestamp": "2024-01-01T12:00:00Z",
  "alert_type": "threshold_breach",
  "severity": "warning",
  "status": "firing",
  "rule_id": "rule_123",
  "metric": "inference_latency",
  "threshold": 100.0,
  "current_value": 125.5,
  "duration": "5m",
  "labels": {
    "model_id": "bert-v1.0",
    "environment": "production"
  },
  "annotations": {
    "description": "Model inference latency is above threshold",
    "runbook_url": "https://docs.company.com/runbooks/latency"
  }
}
```

## Data Retention Policies

| Data Type | Hot Storage | Warm Storage | Cold Storage |
|-----------|-------------|--------------|--------------|
| Metrics   | 1 hour      | 30 days      | 2 years      |
| Events    | 6 hours     | 90 days      | 7 years      |
| Logs      | 2 hours     | 14 days      | 1 year       |
| Alerts    | 24 hours    | 1 year       | 3 years      |
| Traces    | 1 hour      | 7 days       | 90 days      |

## Performance Characteristics

| Operation | Target Latency | Target Throughput |
|-----------|----------------|-------------------|
| Metric Ingestion | < 10ms | 100K ops/sec |
| Event Ingestion | < 50ms | 50K ops/sec |
| Query (Hot) | < 100ms | 10K queries/sec |
| Query (Warm) | < 500ms | 5K queries/sec |
| Alert Processing | < 1s | 1K alerts/sec |
| Dashboard Load | < 2s | 1K users |

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-01  
**Owner**: Data Architecture Team