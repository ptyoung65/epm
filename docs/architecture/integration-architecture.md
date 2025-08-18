# AIRIS-MON Integration Architecture

## Executive Summary

AIRIS-MON serves as a central monitoring hub that integrates with diverse AI/ML platforms, cloud services, and enterprise systems. This document outlines the integration patterns, APIs, and protocols that enable seamless connectivity with external systems while maintaining security, reliability, and performance.

## Integration Overview

### Integration Categories

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AIRIS-MON Integration Hub                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   AI/ML         │  │     Cloud       │  │   Enterprise    │    │
│  │  Platforms      │  │   Services      │  │    Systems      │    │
│  │                 │  │                 │  │                 │    │
│  │ • TensorFlow    │  │ • AWS           │  │ • Active Dir    │    │
│  │ • PyTorch       │  │ • Azure         │  │ • LDAP          │    │
│  │ • MLflow        │  │ • GCP           │  │ • SIEM          │    │
│  │ • Kubeflow      │  │ • Kubernetes    │  │ • ITSM          │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│           │                     │                     │            │
│           ▼                     ▼                     ▼            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               Integration Layer                             │   │
│  │  • REST APIs • GraphQL • Message Queues • Webhooks       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                │                                    │
│                                ▼                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │  Notification   │  │   Monitoring    │  │    DevOps       │    │
│  │    Systems      │  │    Systems      │  │     Tools       │    │
│  │                 │  │                 │  │                 │    │
│  │ • Slack         │  │ • Prometheus    │  │ • GitHub        │    │
│  │ • Teams         │  │ • Grafana       │  │ • GitLab        │    │
│  │ • PagerDuty     │  │ • DataDog       │  │ • Jenkins       │    │
│  │ • Email         │  │ • New Relic     │  │ • ArgoCD        │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Integration Principles

1. **API-First Design**: All integrations built on well-defined APIs
2. **Event-Driven Architecture**: Real-time data flow through events
3. **Standardized Protocols**: Industry-standard protocols and formats
4. **Security by Default**: End-to-end encryption and authentication
5. **Resilient Connections**: Fault tolerance and retry mechanisms
6. **Observability**: Full visibility into integration health and performance

## AI/ML Platform Integrations

### TensorFlow Serving Integration

#### Metrics Collection
```python
# TensorFlow Serving metrics collector
import tensorflow as tf
from tensorflow_serving.apis import prediction_service_pb2_grpc
from tensorflow_serving.apis import predict_pb2
import grpc
import time
import json

class TensorFlowServingCollector:
    def __init__(self, serving_host, serving_port, airis_endpoint):
        self.serving_endpoint = f"{serving_host}:{serving_port}"
        self.airis_endpoint = airis_endpoint
        self.channel = grpc.insecure_channel(self.serving_endpoint)
        self.stub = prediction_service_pb2_grpc.PredictionServiceStub(self.channel)
    
    def collect_model_metrics(self, model_name, model_version=None):
        """Collect metrics from TensorFlow Serving model"""
        try:
            # Create prediction request for health check
            request = predict_pb2.PredictRequest()
            request.model_spec.name = model_name
            if model_version:
                request.model_spec.version.value = model_version
            
            # Measure inference time
            start_time = time.time()
            response = self.stub.Predict(request, timeout=10.0)
            inference_time = (time.time() - start_time) * 1000  # ms
            
            # Collect system metrics
            metrics = {
                "timestamp": int(time.time() * 1000),
                "source": f"tensorflow-serving-{model_name}",
                "metrics": [
                    {
                        "name": "inference_latency",
                        "value": inference_time,
                        "unit": "milliseconds",
                        "tags": {
                            "model_name": model_name,
                            "model_version": str(model_version or "latest"),
                            "framework": "tensorflow"
                        }
                    }
                ]
            }
            
            # Send to AIRIS-MON
            self.send_metrics(metrics)
            
        except grpc.RpcError as e:
            self.handle_error(f"TensorFlow Serving error: {e}")
    
    def send_metrics(self, metrics):
        """Send metrics to AIRIS-MON ingestion endpoint"""
        import requests
        
        response = requests.post(
            f"{self.airis_endpoint}/api/v1/metrics/ingest",
            json=metrics,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response.raise_for_status()
```

### MLflow Integration

#### Model Registry Monitoring
```python
# MLflow integration for model lifecycle monitoring
import mlflow
from mlflow.tracking import MlflowClient
import requests
import threading
import time

class MLflowIntegration:
    def __init__(self, mlflow_uri, airis_endpoint):
        mlflow.set_tracking_uri(mlflow_uri)
        self.client = MlflowClient()
        self.airis_endpoint = airis_endpoint
        
    def monitor_model_registry(self):
        """Monitor MLflow model registry for changes"""
        while True:
            try:
                # Get all registered models
                models = self.client.list_registered_models()
                
                for model in models:
                    # Get model versions
                    versions = self.client.get_registered_model(model.name).latest_versions
                    
                    for version in versions:
                        self.collect_model_version_metrics(model.name, version)
                        
                time.sleep(60)  # Check every minute
                
            except Exception as e:
                self.handle_error(f"MLflow monitoring error: {e}")
                time.sleep(300)  # Wait 5 minutes on error
    
    def collect_model_version_metrics(self, model_name, version):
        """Collect metrics for a specific model version"""
        metrics_data = {
            "timestamp": int(time.time() * 1000),
            "source": f"mlflow-{model_name}",
            "events": [
                {
                    "event_type": "model_version_status",
                    "model_name": model_name,
                    "version": version.version,
                    "stage": version.current_stage,
                    "status": version.status,
                    "creation_timestamp": version.creation_timestamp,
                    "last_updated_timestamp": version.last_updated_timestamp,
                    "run_id": version.run_id,
                    "tags": dict(version.tags) if version.tags else {}
                }
            ]
        }
        
        # Send event to AIRIS-MON
        self.send_event(metrics_data)
    
    def setup_webhook_listener(self, port=8080):
        """Setup webhook listener for real-time MLflow events"""
        from flask import Flask, request
        
        app = Flask(__name__)
        
        @app.route('/mlflow/webhook', methods=['POST'])
        def handle_webhook():
            data = request.get_json()
            self.process_webhook_event(data)
            return '', 200
        
        app.run(host='0.0.0.0', port=port)
```

### Kubeflow Pipelines Integration

#### Pipeline Monitoring
```yaml
# Kubeflow Pipeline monitoring configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: airis-mon-kubeflow-config
data:
  monitoring.yaml: |
    kubeflow:
      pipeline_endpoint: "https://kubeflow.example.com/pipeline"
      namespace: "kubeflow-pipelines"
      
    monitoring:
      pipeline_runs:
        interval: 30s
        metrics:
          - pipeline_duration
          - step_duration
          - resource_usage
          - success_rate
          
      experiments:
        track_metrics: true
        custom_metrics:
          - accuracy
          - loss
          - f1_score
          
    integration:
      airis_endpoint: "https://airis-mon.example.com/api/v1"
      authentication:
        type: "service_account"
        token_path: "/var/run/secrets/kubernetes.io/serviceaccount/token"
```

## Cloud Service Integrations

### AWS Integration

#### CloudWatch Metrics Bridge
```python
# AWS CloudWatch to AIRIS-MON bridge
import boto3
from datetime import datetime, timedelta
import requests
import json

class AWSCloudWatchIntegration:
    def __init__(self, region, airis_endpoint, aws_credentials):
        self.cloudwatch = boto3.client('cloudwatch', region_name=region, **aws_credentials)
        self.airis_endpoint = airis_endpoint
        
    def sync_sagemaker_metrics(self):
        """Sync SageMaker endpoint metrics"""
        # Get SageMaker endpoints
        sagemaker = boto3.client('sagemaker', region_name=self.region)
        endpoints = sagemaker.list_endpoints()
        
        for endpoint in endpoints['Endpoints']:
            endpoint_name = endpoint['EndpointName']
            
            # Collect key metrics
            metrics_to_collect = [
                'Invocations',
                'Invocation4XXErrors',
                'Invocation5XXErrors',
                'ModelLatency',
                'OverheadLatency'
            ]
            
            for metric_name in metrics_to_collect:
                metric_data = self.get_cloudwatch_metric(
                    namespace='AWS/SageMaker',
                    metric_name=metric_name,
                    dimensions=[
                        {'Name': 'EndpointName', 'Value': endpoint_name}
                    ]
                )
                
                if metric_data:
                    self.send_to_airis_mon(endpoint_name, metric_name, metric_data)
    
    def get_cloudwatch_metric(self, namespace, metric_name, dimensions, 
                             start_time=None, end_time=None):
        """Retrieve metric data from CloudWatch"""
        if not start_time:
            start_time = datetime.utcnow() - timedelta(minutes=5)
        if not end_time:
            end_time = datetime.utcnow()
            
        response = self.cloudwatch.get_metric_statistics(
            Namespace=namespace,
            MetricName=metric_name,
            Dimensions=dimensions,
            StartTime=start_time,
            EndTime=end_time,
            Period=300,  # 5 minutes
            Statistics=['Average', 'Sum', 'Maximum', 'Minimum']
        )
        
        return response['Datapoints']
    
    def send_to_airis_mon(self, endpoint_name, metric_name, datapoints):
        """Send metric data to AIRIS-MON"""
        for point in datapoints:
            metrics_payload = {
                "timestamp": int(point['Timestamp'].timestamp() * 1000),
                "source": f"aws-sagemaker-{endpoint_name}",
                "metrics": [
                    {
                        "name": metric_name.lower(),
                        "value": point.get('Average', point.get('Sum', 0)),
                        "unit": point.get('Unit', 'Count'),
                        "tags": {
                            "endpoint_name": endpoint_name,
                            "cloud_provider": "aws",
                            "service": "sagemaker"
                        }
                    }
                ]
            }
            
            requests.post(
                f"{self.airis_endpoint}/api/v1/metrics/ingest",
                json=metrics_payload,
                timeout=30
            )
```

### Google Cloud Platform Integration

#### Vertex AI Monitoring
```python
# GCP Vertex AI integration
from google.cloud import aiplatform
from google.cloud import monitoring_v3
import requests
from datetime import datetime, timedelta

class VertexAIIntegration:
    def __init__(self, project_id, region, airis_endpoint):
        self.project_id = project_id
        self.region = region
        self.airis_endpoint = airis_endpoint
        
        # Initialize clients
        aiplatform.init(project=project_id, location=region)
        self.monitoring_client = monitoring_v3.MetricServiceClient()
        
    def collect_endpoint_metrics(self):
        """Collect metrics from Vertex AI endpoints"""
        # List all endpoints
        endpoints = aiplatform.Endpoint.list()
        
        for endpoint in endpoints:
            # Collect prediction metrics
            metrics = self.get_vertex_ai_metrics(
                endpoint.resource_name,
                ['prediction/online/response_count', 
                 'prediction/online/prediction_latency']
            )
            
            for metric in metrics:
                self.send_metric_to_airis_mon(endpoint.display_name, metric)
    
    def get_vertex_ai_metrics(self, resource_name, metric_types):
        """Get metrics from Google Cloud Monitoring"""
        project_name = f"projects/{self.project_id}"
        interval = monitoring_v3.TimeInterval({
            "end_time": {"seconds": int(time.time())},
            "start_time": {"seconds": int(time.time()) - 300}
        })
        
        metrics_data = []
        for metric_type in metric_types:
            request = monitoring_v3.ListTimeSeriesRequest(
                name=project_name,
                filter=f'metric.type="aiplatform.googleapis.com/{metric_type}" AND '
                      f'resource.label.endpoint_id="{resource_name}"',
                interval=interval
            )
            
            results = self.monitoring_client.list_time_series(request=request)
            metrics_data.extend(results)
            
        return metrics_data
```

## Enterprise System Integrations

### Active Directory/LDAP Integration

#### User Synchronization
```python
# Active Directory integration for user management
import ldap3
from ldap3 import Server, Connection, ALL, SUBTREE
import requests
import json
import schedule
import time

class ActiveDirectoryIntegration:
    def __init__(self, ad_server, bind_dn, bind_password, airis_endpoint):
        self.server = Server(ad_server, get_info=ALL)
        self.bind_dn = bind_dn
        self.bind_password = bind_password
        self.airis_endpoint = airis_endpoint
        
    def sync_users(self):
        """Synchronize users from Active Directory"""
        try:
            conn = Connection(self.server, self.bind_dn, self.bind_password, auto_bind=True)
            
            # Search for users
            search_base = "DC=company,DC=com"
            search_filter = "(&(objectClass=user)(!(objectClass=computer)))"
            attributes = ['sAMAccountName', 'mail', 'displayName', 'department', 'title']
            
            conn.search(search_base, search_filter, SUBTREE, attributes=attributes)
            
            users_data = []
            for entry in conn.entries:
                user_data = {
                    "username": str(entry.sAMAccountName),
                    "email": str(entry.mail) if entry.mail else None,
                    "display_name": str(entry.displayName) if entry.displayName else None,
                    "department": str(entry.department) if entry.department else None,
                    "title": str(entry.title) if entry.title else None,
                    "sync_timestamp": int(time.time() * 1000)
                }
                users_data.append(user_data)
            
            # Send to AIRIS-MON
            self.send_user_sync_data(users_data)
            
            conn.unbind()
            
        except Exception as e:
            print(f"AD sync error: {e}")
    
    def send_user_sync_data(self, users_data):
        """Send user synchronization data to AIRIS-MON"""
        sync_payload = {
            "event_type": "user_sync",
            "source": "active_directory",
            "timestamp": int(time.time() * 1000),
            "data": {
                "users": users_data,
                "sync_type": "full"
            }
        }
        
        response = requests.post(
            f"{self.airis_endpoint}/api/v1/integrations/user-sync",
            json=sync_payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.get_api_token()}"
            }
        )
        response.raise_for_status()
```

### SIEM Integration

#### Security Event Forwarding
```python
# SIEM integration for security event correlation
import requests
import json
from datetime import datetime
import hashlib
import hmac

class SIEMIntegration:
    def __init__(self, siem_endpoint, api_key, airis_endpoint):
        self.siem_endpoint = siem_endpoint
        self.api_key = api_key
        self.airis_endpoint = airis_endpoint
        
    def forward_security_events(self, events):
        """Forward AIRIS-MON security events to SIEM"""
        for event in events:
            # Enrich event with additional context
            enriched_event = self.enrich_security_event(event)
            
            # Send to SIEM
            self.send_to_siem(enriched_event)
    
    def enrich_security_event(self, event):
        """Enrich security event with additional context"""
        enriched = {
            "timestamp": event.get("timestamp"),
            "source": "airis-mon",
            "event_type": event.get("event_type"),
            "severity": self.map_severity(event.get("severity")),
            "user_id": event.get("user_id"),
            "session_id": event.get("session_id"),
            "source_ip": event.get("source_ip"),
            "user_agent": event.get("user_agent"),
            "resource": event.get("resource"),
            "action": event.get("action"),
            "result": event.get("result"),
            "additional_data": event.get("additional_data", {}),
            
            # AIRIS-MON specific fields
            "ai_model_id": event.get("ai_model_id"),
            "monitoring_context": event.get("monitoring_context"),
            "correlation_id": event.get("correlation_id")
        }
        
        return enriched
    
    def send_to_siem(self, event):
        """Send enriched event to SIEM"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-Timestamp": str(int(time.time())),
            "X-Signature": self.generate_signature(json.dumps(event))
        }
        
        response = requests.post(
            f"{self.siem_endpoint}/api/v1/events",
            json=event,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
```

## Notification System Integrations

### Slack Integration

#### Rich Alert Notifications
```python
# Slack integration for rich alert notifications
import requests
import json
from datetime import datetime

class SlackIntegration:
    def __init__(self, webhook_url, channel, airis_mon_url):
        self.webhook_url = webhook_url
        self.channel = channel
        self.airis_mon_url = airis_mon_url
    
    def send_alert_notification(self, alert):
        """Send rich alert notification to Slack"""
        # Build Slack message with blocks
        message = {
            "channel": self.channel,
            "username": "AIRIS-MON",
            "icon_emoji": ":warning:" if alert["severity"] == "warning" else ":rotating_light:",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🚨 {alert['severity'].upper()} Alert"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Alert:*\n{alert['name']}"
                        },
                        {
                            "type": "mrkdwn", 
                            "text": f"*Severity:*\n{alert['severity']}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Model:*\n{alert.get('model_id', 'N/A')}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Environment:*\n{alert.get('environment', 'N/A')}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Description:*\n{alert['description']}"
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": f"Triggered at {datetime.fromtimestamp(alert['timestamp']/1000).strftime('%Y-%m-%d %H:%M:%S UTC')}"
                        }
                    ]
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "View Dashboard"
                            },
                            "url": f"{self.airis_mon_url}/dashboard?alert={alert['id']}"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Acknowledge"
                            },
                            "action_id": f"ack_alert_{alert['id']}"
                        }
                    ]
                }
            ]
        }
        
        response = requests.post(self.webhook_url, json=message)
        response.raise_for_status()
```

### PagerDuty Integration

#### Incident Management
```python
# PagerDuty integration for incident management
import requests
import json
from datetime import datetime

class PagerDutyIntegration:
    def __init__(self, integration_key, api_key):
        self.integration_key = integration_key
        self.api_key = api_key
        self.events_api = "https://events.pagerduty.com/v2/enqueue"
        self.api_base = "https://api.pagerduty.com"
    
    def create_incident(self, alert):
        """Create PagerDuty incident from AIRIS-MON alert"""
        # Determine if incident should be created based on severity
        if alert["severity"] not in ["critical", "high"]:
            return None
            
        incident_payload = {
            "routing_key": self.integration_key,
            "event_action": "trigger",
            "dedup_key": f"airis-mon-{alert['id']}",
            "payload": {
                "summary": f"AIRIS-MON Alert: {alert['name']}",
                "source": alert.get("source", "airis-mon"),
                "severity": self.map_severity(alert["severity"]),
                "timestamp": datetime.fromtimestamp(alert["timestamp"]/1000).isoformat(),
                "component": alert.get("model_id", "unknown"),
                "group": alert.get("environment", "production"),
                "class": alert.get("alert_type", "monitoring"),
                "custom_details": {
                    "alert_id": alert["id"],
                    "model_id": alert.get("model_id"),
                    "environment": alert.get("environment"),
                    "threshold": alert.get("threshold"),
                    "current_value": alert.get("current_value"),
                    "duration": alert.get("duration"),
                    "dashboard_url": f"{self.airis_mon_url}/dashboard?alert={alert['id']}"
                }
            }
        }
        
        response = requests.post(
            self.events_api,
            json=incident_payload,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        
        return response.json()
    
    def resolve_incident(self, alert_id):
        """Resolve PagerDuty incident when alert is resolved"""
        resolve_payload = {
            "routing_key": self.integration_key,
            "event_action": "resolve",
            "dedup_key": f"airis-mon-{alert_id}"
        }
        
        response = requests.post(
            self.events_api,
            json=resolve_payload,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
```

## DevOps Tool Integrations

### GitHub Integration

#### Repository Monitoring
```python
# GitHub integration for repository and workflow monitoring
import requests
from github import Github
import json
from datetime import datetime

class GitHubIntegration:
    def __init__(self, token, airis_endpoint):
        self.github = Github(token)
        self.airis_endpoint = airis_endpoint
        
    def monitor_workflows(self, repo_name):
        """Monitor GitHub Actions workflows"""
        repo = self.github.get_repo(repo_name)
        
        # Get recent workflow runs
        workflows = repo.get_workflows()
        
        for workflow in workflows:
            runs = workflow.get_runs()[:10]  # Last 10 runs
            
            for run in runs:
                workflow_metrics = {
                    "timestamp": int(run.created_at.timestamp() * 1000),
                    "source": f"github-{repo_name}",
                    "metrics": [
                        {
                            "name": "workflow_duration",
                            "value": (run.updated_at - run.created_at).total_seconds(),
                            "unit": "seconds",
                            "tags": {
                                "repository": repo_name,
                                "workflow": workflow.name,
                                "status": run.status,
                                "conclusion": run.conclusion,
                                "branch": run.head_branch,
                                "actor": run.actor.login
                            }
                        }
                    ]
                }
                
                # Send metrics to AIRIS-MON
                self.send_metrics(workflow_metrics)
    
    def setup_webhook_handler(self):
        """Setup webhook handler for real-time GitHub events"""
        from flask import Flask, request, abort
        import hashlib
        import hmac
        
        app = Flask(__name__)
        
        @app.route('/github/webhook', methods=['POST'])
        def handle_webhook():
            # Verify webhook signature
            signature = request.headers.get('X-Hub-Signature-256')
            if not self.verify_signature(request.data, signature):
                abort(403)
            
            event_type = request.headers.get('X-GitHub-Event')
            payload = request.get_json()
            
            # Process different event types
            if event_type == 'workflow_run':
                self.process_workflow_event(payload)
            elif event_type == 'push':
                self.process_push_event(payload)
            elif event_type == 'pull_request':
                self.process_pr_event(payload)
            
            return '', 200
        
        return app
```

## Integration API Specifications

### Inbound Integration APIs

#### Metrics Ingestion API
```yaml
# OpenAPI specification for metrics ingestion
openapi: 3.0.0
info:
  title: AIRIS-MON Metrics Ingestion API
  version: 1.0.0
  description: API for ingesting metrics from external systems

paths:
  /api/v1/metrics/ingest:
    post:
      summary: Ingest metrics data
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                timestamp:
                  type: integer
                  description: Unix timestamp in milliseconds
                source:
                  type: string
                  description: Source system identifier
                metrics:
                  type: array
                  items:
                    type: object
                    properties:
                      name:
                        type: string
                      value:
                        type: number
                      unit:
                        type: string
                      tags:
                        type: object
                        additionalProperties:
                          type: string
      responses:
        '200':
          description: Metrics ingested successfully
        '400':
          description: Invalid request format
        '401':
          description: Authentication required
        '429':
          description: Rate limit exceeded
```

#### Event Ingestion API
```yaml
  /api/v1/events/ingest:
    post:
      summary: Ingest event data
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                timestamp:
                  type: integer
                event_type:
                  type: string
                source:
                  type: string
                severity:
                  type: string
                  enum: [info, warning, error, critical]
                data:
                  type: object
                  additionalProperties: true
      responses:
        '200':
          description: Event ingested successfully
```

### Outbound Integration APIs

#### Webhook Configuration API
```yaml
  /api/v1/integrations/webhooks:
    post:
      summary: Configure webhook endpoint
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                url:
                  type: string
                  format: uri
                events:
                  type: array
                  items:
                    type: string
                headers:
                  type: object
                  additionalProperties:
                    type: string
                secret:
                  type: string
                  description: Webhook signing secret
      responses:
        '201':
          description: Webhook configured successfully
        '400':
          description: Invalid configuration
```

## Integration Monitoring & Health Checks

### Integration Health Dashboard
```python
# Integration health monitoring
class IntegrationHealthMonitor:
    def __init__(self, integrations_config):
        self.integrations = integrations_config
        self.health_status = {}
        
    def check_integration_health(self, integration_name):
        """Check health of a specific integration"""
        config = self.integrations.get(integration_name)
        if not config:
            return {"status": "unknown", "message": "Integration not configured"}
        
        try:
            # Perform health check based on integration type
            if config["type"] == "http":
                return self.check_http_integration(config)
            elif config["type"] == "database":
                return self.check_database_integration(config)
            elif config["type"] == "message_queue":
                return self.check_message_queue_integration(config)
            else:
                return {"status": "unknown", "message": "Unsupported integration type"}
                
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def check_all_integrations(self):
        """Check health of all configured integrations"""
        health_report = {
            "timestamp": int(time.time() * 1000),
            "overall_status": "healthy",
            "integrations": {}
        }
        
        for integration_name in self.integrations.keys():
            health = self.check_integration_health(integration_name)
            health_report["integrations"][integration_name] = health
            
            if health["status"] == "error":
                health_report["overall_status"] = "degraded"
        
        return health_report
```

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-01  
**Next Review**: 2024-04-01  
**Owner**: Integration Architecture Team