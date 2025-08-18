# AIRIS-MON AIOps/MLOps API Specification

## Overview

The AIRIS-MON AIOps/MLOps API provides comprehensive artificial intelligence and machine learning operations capabilities for infrastructure monitoring and analysis.

### Base URL
```
http://localhost:3000/api/v1/aiops
```

### Authentication
Currently, the API uses the same authentication mechanism as the main AIRIS-MON system. Future versions will include dedicated API key authentication.

### Response Format
All responses follow this standard format:
```json
{
  "success": true,
  "result": { ... },
  "metadata": { ... },
  "timestamp": "2025-01-17T10:30:00Z"
}
```

Error responses:
```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": [ ... ],
  "timestamp": "2025-01-17T10:30:00Z"
}
```

## Endpoints

### Health & Status

#### Get Health Status
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "initialized": true,
  "started": true,
  "services": {
    "ollama": true,
    "gemini": true,
    "knowledgeCollector": true,
    "mlops": true,
    "analytics": true,
    "monitoring": true
  },
  "healthyServices": 6,
  "totalServices": 6,
  "errorRecoveryStatus": {
    "circuitBreakerState": "closed",
    "errorCount": 0,
    "uniqueErrors": 0,
    "fallbackCacheSize": 0
  },
  "timestamp": "2025-01-17T10:30:00Z"
}
```

#### Get Detailed Status
```http
GET /status
```

**Response:**
```json
{
  "initialized": true,
  "started": true,
  "services": { ... },
  "systemMetrics": {
    "cpu": 45.2,
    "memory": 67.8,
    "disk": 23.1,
    "network": 12.5,
    "timestamp": "2025-01-17T10:30:00Z"
  },
  "timestamp": "2025-01-17T10:30:00Z"
}
```

### Text Generation

#### Generate Text
```http
POST /generate/text
```

**Request Body:**
```json
{
  "prompt": "Analyze the following system metrics and identify any anomalies...",
  "model": "gemini",
  "modelName": "gemini-1.5-flash",
  "options": {
    "temperature": 0.7,
    "maxTokens": 1024
  }
}
```

**Parameters:**
- `prompt` (string, required): Input text prompt (1-10000 characters)
- `model` (string, optional): AI model to use ("ollama" or "gemini")
- `modelName` (string, optional): Specific model name
- `options` (object, optional): Additional generation options

**Response:**
```json
{
  "success": true,
  "result": "Based on the provided metrics, I can identify several potential anomalies...",
  "metadata": {
    "model": "gemini",
    "modelName": "gemini-1.5-flash",
    "promptLength": 67,
    "responseLength": 342
  },
  "timestamp": "2025-01-17T10:30:00Z"
}
```

### Knowledge Collection

#### Register Knowledge Agent
```http
POST /knowledge/agents
```

**Request Body:**
```json
{
  "id": "system-logs-collector",
  "name": "System Logs Knowledge Collector",
  "type": "file",
  "config": {
    "filePath": "/var/log/system.log",
    "encoding": "utf8",
    "watch": true,
    "tags": ["system", "logs", "monitoring"]
  },
  "enabled": true,
  "interval": 30000
}
```

**Parameters:**
- `id` (string, required): Unique agent identifier
- `name` (string, required): Human-readable agent name
- `type` (string, required): Agent type ("web", "database", "api", "file")
- `config` (object, required): Type-specific configuration
- `enabled` (boolean, optional): Whether agent is enabled (default: true)
- `interval` (number, optional): Collection interval in milliseconds (min: 1000)

**Agent Types and Configurations:**

**Web Agent:**
```json
{
  "type": "web",
  "config": {
    "url": "https://api.example.com/status",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer token"
    },
    "selector": ".status-data",
    "tags": ["api", "status"]
  }
}
```

**Database Agent:**
```json
{
  "type": "database",
  "config": {
    "query": "SELECT * FROM metrics WHERE timestamp > NOW() - INTERVAL 1 HOUR",
    "parameters": [],
    "tags": ["database", "metrics"]
  }
}
```

**API Agent:**
```json
{
  "type": "api",
  "config": {
    "url": "https://api.example.com/metrics",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "query": "system_metrics"
    },
    "auth": {
      "username": "user",
      "password": "pass"
    },
    "timeout": 5000,
    "tags": ["api", "external"]
  }
}
```

**File Agent:**
```json
{
  "type": "file",
  "config": {
    "filePath": "/var/log/app.log",
    "encoding": "utf8",
    "watch": false,
    "tags": ["logs", "application"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Knowledge agent registered successfully",
  "agent": {
    "id": "system-logs-collector",
    "name": "System Logs Knowledge Collector",
    "type": "file",
    "enabled": true
  },
  "timestamp": "2025-01-17T10:30:00Z"
}
```

### MLOps

#### Create and Train Model
```http
POST /models
```

**Request Body:**
```json
{
  "name": "anomaly-detection-model",
  "type": "anomaly",
  "architecture": {
    "algorithm": "isolation_forest",
    "features": ["cpu", "memory", "disk", "network"]
  },
  "hyperparameters": {
    "n_estimators": 100,
    "contamination": 0.1,
    "random_state": 42
  }
}
```

**Parameters:**
- `name` (string, required): Model name
- `type` (string, required): Model type ("classification", "regression", "clustering", "anomaly")
- `architecture` (object, optional): Model architecture specification
- `hyperparameters` (object, optional): Training hyperparameters

**Response:**
```json
{
  "success": true,
  "model": {
    "id": "model_1737105000123_abc123def",
    "name": "anomaly-detection-model",
    "type": "anomaly",
    "status": "training",
    "version": "1.0.0",
    "createdAt": "2025-01-17T10:30:00Z"
  },
  "timestamp": "2025-01-17T10:30:00Z"
}
```

### Analytics

#### Analyze Metric Data
```http
POST /analytics/analyze
```

**Request Body:**
```json
{
  "metricName": "cpu_usage_percent",
  "values": [45.2, 67.8, 23.1, 89.5, 12.3, 156.7, 34.9, 78.2]
}
```

**Parameters:**
- `metricName` (string, required): Name of the metric being analyzed
- `values` (array, required): Array of numeric values (1-10000 items)

**Response:**
```json
{
  "success": true,
  "result": {
    "id": "analysis_cpu_usage_percent_1737105000123",
    "type": "statistics",
    "data": {
      "statistics": {
        "mean": 63.21,
        "median": 56.5,
        "stdDev": 43.25,
        "min": 12.3,
        "max": 156.7,
        "q1": 34.9,
        "q3": 78.2,
        "count": 8
      },
      "anomaly": {
        "isAnomaly": true,
        "score": 2.87,
        "threshold": 2.5,
        "method": "zscore",
        "explanation": "Z-score: 2.87, threshold: 2.5"
      },
      "trend": {
        "trend": "stable",
        "slope": -0.12,
        "r2": 0.23,
        "confidence": 0.23
      }
    },
    "confidence": 0.85,
    "timestamp": "2025-01-17T10:30:00Z",
    "metadata": {
      "metric": "cpu_usage_percent",
      "dataPoints": 8
    }
  },
  "timestamp": "2025-01-17T10:30:00Z"
}
```

### Configuration Management

#### Get Current Configuration
```http
GET /config
```

**Response:**
```json
{
  "success": true,
  "config": {
    "version": "1.0.0",
    "environment": "development",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "models": ["llama2", "codellama", "mistral"],
      "timeout": 30000,
      "maxRetries": 3,
      "streamingEnabled": true
    },
    "gemini": {
      "apiKey": "***",
      "model": "gemini-1.5-flash",
      "temperature": 0.7,
      "maxTokens": 2048
    },
    "mlops": {
      "dataPath": "./data/aiops",
      "modelPath": "./models/aiops",
      "pipelinePath": "./pipelines/aiops",
      "autoRetrain": true,
      "retrainThreshold": 0.1,
      "validationSplit": 0.2
    },
    "analytics": {
      "realTimeWindow": 300000,
      "anomalyThreshold": 2.5,
      "statisticalMethods": ["zscore", "iqr", "isolation_forest"],
      "timeSeriesEnabled": true
    }
  },
  "timestamp": "2025-01-17T10:30:00Z"
}
```

#### Update Configuration
```http
PATCH /config
```

**Request Body:**
```json
{
  "analytics": {
    "anomalyThreshold": 3.0,
    "realTimeWindow": 600000
  },
  "ollama": {
    "timeout": 45000
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration updated successfully",
  "timestamp": "2025-01-17T10:30:00Z"
}
```

### Metrics Ingestion

#### Ingest Metric Data
```http
POST /metrics
```

**Request Body:**
```json
{
  "metricName": "response_time_ms",
  "value": 234.5,
  "labels": {
    "service": "api",
    "endpoint": "/users",
    "method": "GET"
  },
  "source": "application",
  "timestamp": "2025-01-17T10:30:00Z"
}
```

**Parameters:**
- `metricName` (string, required): Metric name
- `value` (number, required): Metric value
- `labels` (object, optional): Metric labels/tags
- `source` (string, optional): Metric source (default: "api")
- `timestamp` (string, optional): ISO8601 timestamp (default: current time)

**Response:**
```json
{
  "success": true,
  "message": "Metric ingested successfully",
  "metric": {
    "name": "response_time_ms",
    "value": 234.5,
    "labels": {
      "service": "api",
      "endpoint": "/users",
      "method": "GET"
    },
    "source": "application",
    "timestamp": "2025-01-17T10:30:00Z"
  }
}
```

## Error Codes

| HTTP Code | Error Type | Description |
|-----------|------------|-------------|
| 400 | Validation Error | Invalid request parameters |
| 401 | Authentication Error | Invalid or missing authentication |
| 403 | Authorization Error | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Rate Limit Exceeded | Too many requests |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | AIOps services not available |

## Rate Limiting

API requests are limited to:
- 100 requests per minute per IP address
- 1000 requests per hour per authenticated user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1737105060
```

## WebSocket Events

The AIOps system emits real-time events via WebSocket:

```javascript
// Connect to WebSocket
const socket = io('/aiops');

// Listen for events
socket.on('anomaly_detected', (event) => {
  console.log('Anomaly detected:', event);
});

socket.on('model_trained', (event) => {
  console.log('Model training completed:', event);
});

socket.on('alert_triggered', (event) => {
  console.log('Alert triggered:', event);
});
```

### Event Types

- `anomaly_detected`: Statistical anomaly detected
- `model_trained`: ML model training completed
- `pipeline_completed`: MLOps pipeline finished
- `alert_triggered`: Alert rule triggered
- `knowledge_data_collected`: New knowledge collected
- `configuration_updated`: Configuration changed

## Examples

### Complete Anomaly Detection Workflow

1. **Register a knowledge collector:**
```bash
curl -X POST http://localhost:3000/api/v1/aiops/knowledge/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "cpu-metrics-collector",
    "name": "CPU Metrics Collector",
    "type": "api",
    "config": {
      "url": "http://localhost:9090/api/v1/query?query=cpu_usage",
      "method": "GET",
      "headers": {
        "Accept": "application/json"
      },
      "tags": ["cpu", "metrics"]
    },
    "enabled": true,
    "interval": 60000
  }'
```

2. **Train an anomaly detection model:**
```bash
curl -X POST http://localhost:3000/api/v1/aiops/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cpu-anomaly-detector",
    "type": "anomaly"
  }'
```

3. **Analyze incoming metrics:**
```bash
curl -X POST http://localhost:3000/api/v1/aiops/analytics/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "cpu_usage",
    "values": [45, 67, 89, 95, 12, 78, 156, 34]
  }'
```

4. **Generate AI insights:**
```bash
curl -X POST http://localhost:3000/api/v1/aiops/generate/text \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze CPU usage anomaly: values [45, 67, 89, 95, 12, 78, 156, 34]. Explain potential causes and recommend actions.",
    "model": "gemini"
  }'
```

### Batch Operations

1. **Ingest multiple metrics:**
```bash
# Loop to send multiple metrics
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/v1/aiops/metrics \
    -H "Content-Type: application/json" \
    -d "{
      \"metricName\": \"cpu_usage\",
      \"value\": $((RANDOM % 100)),
      \"labels\": {\"instance\": \"server-$i\"},
      \"source\": \"monitoring\"
    }"
done
```

2. **Configure multiple knowledge agents:**
```bash
# Register multiple agents
curl -X POST http://localhost:3000/api/v1/aiops/knowledge/agents \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": "memory-collector",
      "name": "Memory Metrics Collector",
      "type": "file",
      "config": {"filePath": "/proc/meminfo"},
      "enabled": true,
      "interval": 30000
    },
    {
      "id": "disk-collector", 
      "name": "Disk Metrics Collector",
      "type": "api",
      "config": {
        "url": "http://localhost:9090/api/v1/query?query=disk_usage",
        "method": "GET"
      },
      "enabled": true,
      "interval": 60000
    }
  ]'
```

## SDK and Client Libraries

### JavaScript/TypeScript Client
```typescript
import { AIOpsClient } from '@airis-mon/aiops-client';

const client = new AIOpsClient({
  baseUrl: 'http://localhost:3000/api/v1/aiops',
  apiKey: 'your-api-key'
});

// Generate text
const response = await client.generateText({
  prompt: 'Analyze system performance',
  model: 'gemini'
});

// Analyze metrics
const analysis = await client.analyzeMetric({
  metricName: 'cpu_usage',
  values: [45, 67, 89, 95]
});

// Train model
const model = await client.createModel({
  name: 'anomaly-detector',
  type: 'anomaly'
});
```

### Python Client
```python
from airis_mon_client import AIOpsClient

client = AIOpsClient(
    base_url='http://localhost:3000/api/v1/aiops',
    api_key='your-api-key'
)

# Generate text
response = client.generate_text(
    prompt='Analyze system performance',
    model='gemini'
)

# Analyze metrics
analysis = client.analyze_metric(
    metric_name='cpu_usage',
    values=[45, 67, 89, 95]
)

# Train model
model = client.create_model(
    name='anomaly-detector',
    type='anomaly'
)
```

## Integration Examples

### Grafana Dashboard Integration
```javascript
// Custom Grafana panel plugin
const aiopsClient = new AIOpsClient({
  baseUrl: panel.baseUrl,
  apiKey: panel.apiKey
});

// Get anomaly analysis for dashboard
const analysis = await aiopsClient.analyzeMetric({
  metricName: 'response_time',
  values: timeSeriesData
});

// Display anomaly indicators on graph
if (analysis.result.data.anomaly.isAnomaly) {
  addAnomalyMarker(analysis.result.data.anomaly);
}
```

### Prometheus Integration
```yaml
# prometheus.yml
rule_files:
  - "aiops_rules.yml"

# aiops_rules.yml
groups:
  - name: aiops_alerts
    rules:
      - alert: AnomalyDetected
        expr: aiops_anomaly_score > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Anomaly detected by AIOps system"
```

### Kubernetes Integration
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: aiops-config
data:
  config.json: |
    {
      "analytics": {
        "anomalyThreshold": 2.5
      },
      "monitoring": {
        "clickhouse": {
          "host": "clickhouse-service"
        }
      }
    }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: airis-mon-aiops
spec:
  template:
    spec:
      containers:
      - name: aiops
        image: airis-mon:latest
        volumeMounts:
        - name: config
          mountPath: /app/config/aiops
      volumes:
      - name: config
        configMap:
          name: aiops-config
```