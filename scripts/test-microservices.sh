#!/bin/bash

# AIRIS EPM Microservices Integration Test Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GATEWAY_URL="http://localhost:3000"
REGISTRY_URL="http://localhost:8500"

echo -e "${BLUE}🧪 Starting AIRIS EPM Microservices Integration Tests${NC}"
echo "================================================="

# Function to check if a service is responding
check_service() {
    local service_name=$1
    local url=$2
    local max_retries=${3:-30}
    local retry_interval=${4:-2}
    
    echo -n "Checking $service_name..."
    
    for i in $(seq 1 $max_retries); do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        sleep $retry_interval
        echo -n "."
    done
    
    echo -e " ${RED}✗${NC}"
    return 1
}

# Function to test API endpoint
test_api_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=${3:-200}
    local data=$4
    
    echo -n "Testing $method $endpoint..."
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "%{http_code}" -X "$method" "$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "%{http_code}" -X "$method" "$endpoint" 2>/dev/null)
    fi
    
    status_code="${response: -3}"
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e " ${GREEN}✓${NC} ($status_code)"
        return 0
    else
        echo -e " ${RED}✗${NC} (expected $expected_status, got $status_code)"
        return 1
    fi
}

# Function to wait for services to be ready
wait_for_services() {
    echo -e "\n${YELLOW}⏳ Waiting for services to be ready...${NC}"
    
    # Core infrastructure
    check_service "Redis" "http://localhost:6379" 30 2
    check_service "Service Registry" "$REGISTRY_URL/health" 30 2
    check_service "API Gateway" "$GATEWAY_URL/health" 30 2
    
    # Database services
    check_service "MongoDB" "http://localhost:27017" 30 2 || echo "MongoDB check skipped (no HTTP endpoint)"
    check_service "ClickHouse" "http://localhost:8123/ping" 30 2
    check_service "PostgreSQL" "http://localhost:5432" 30 2 || echo "PostgreSQL check skipped (no HTTP endpoint)"
    
    # Kafka cluster
    check_service "Kafka UI" "http://localhost:8080" 30 2 || echo "Kafka UI not available"
    
    # Microservices
    check_service "Metrics Service" "http://localhost:3021/health" 30 2
    check_service "Logs Service" "http://localhost:3022/health" 30 2
    check_service "Traces Service" "http://localhost:3023/health" 30 2
    check_service "Alerts Service" "http://localhost:3024/health" 30 2
    check_service "ETL Pipeline" "http://localhost:3020/health" 30 2
}

# Function to test service discovery
test_service_discovery() {
    echo -e "\n${YELLOW}🔍 Testing Service Discovery...${NC}"
    
    # Check service registry catalog
    test_api_endpoint "GET" "$REGISTRY_URL/v1/catalog/services"
    
    # Check service registration status
    services=("metrics-service" "logs-service" "traces-service" "alerts-service" "etl-pipeline")
    
    for service in "${services[@]}"; do
        test_api_endpoint "GET" "$REGISTRY_URL/v1/health/service/$service?passing=true"
    done
    
    # Test gateway service discovery
    test_api_endpoint "GET" "$GATEWAY_URL/gateway/status"
}

# Function to test API gateway routing
test_api_gateway_routing() {
    echo -e "\n${YELLOW}🌐 Testing API Gateway Routing...${NC}"
    
    # Test direct service access vs gateway routing
    services=(
        "metrics:3021:/api/metrics/stats"
        "logs:3022:/api/logs/stats" 
        "traces:3023:/api/traces/stats"
        "alerts:3024:/api/alerts/stats"
        "etl:3020:/api/etl/stats"
    )
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service_name port endpoint <<< "$service_info"
        
        echo "Testing $service_name service routing..."
        
        # Test direct access
        test_api_endpoint "GET" "http://localhost:$port$endpoint" 200
        
        # Test gateway routing
        test_api_endpoint "GET" "$GATEWAY_URL$endpoint" 200
    done
}

# Function to test metrics ingestion
test_metrics_ingestion() {
    echo -e "\n${YELLOW}📊 Testing Metrics Ingestion...${NC}"
    
    # Test single metric ingestion
    metric_data='{
        "name": "test.cpu.usage",
        "value": 75.5,
        "tags": {
            "host": "test-server",
            "environment": "test"
        },
        "source": "integration-test"
    }'
    
    test_api_endpoint "POST" "$GATEWAY_URL/api/metrics" 201 "$metric_data"
    
    # Test bulk metrics ingestion
    bulk_metrics='{
        "metrics": [
            {
                "name": "test.memory.usage",
                "value": 85.2,
                "tags": {"host": "test-server"},
                "source": "integration-test"
            },
            {
                "name": "test.disk.usage", 
                "value": 45.8,
                "tags": {"host": "test-server"},
                "source": "integration-test"
            }
        ]
    }'
    
    test_api_endpoint "POST" "$GATEWAY_URL/api/metrics/bulk" 201 "$bulk_metrics"
    
    # Wait and test metric retrieval
    sleep 5
    test_api_endpoint "GET" "$GATEWAY_URL/api/metrics?name=test.cpu.usage&limit=10"
}

# Function to test log ingestion
test_log_ingestion() {
    echo -e "\n${YELLOW}📝 Testing Log Ingestion...${NC}"
    
    # Test single log ingestion
    log_data='{
        "message": "Integration test log message",
        "level": "info",
        "service": "integration-test",
        "host": "test-server",
        "metadata": {
            "test": true,
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
        }
    }'
    
    test_api_endpoint "POST" "$GATEWAY_URL/api/logs" 201 "$log_data"
    
    # Test bulk log ingestion
    bulk_logs='{
        "logs": [
            {
                "message": "Bulk test log 1",
                "level": "info",
                "service": "integration-test",
                "host": "test-server"
            },
            {
                "message": "Bulk test log 2", 
                "level": "warn",
                "service": "integration-test",
                "host": "test-server"
            }
        ]
    }'
    
    test_api_endpoint "POST" "$GATEWAY_URL/api/logs/bulk" 201 "$bulk_logs"
    
    # Wait and test log retrieval
    sleep 3
    test_api_endpoint "GET" "$GATEWAY_URL/api/logs?service=integration-test&limit=5"
}

# Function to test trace ingestion
test_trace_ingestion() {
    echo -e "\n${YELLOW}🔍 Testing Trace Ingestion...${NC}"
    
    # Test trace ingestion
    trace_data='{
        "traceId": "test-trace-'$(uuidgen | tr '[:upper:]' '[:lower:]')'",
        "spans": [
            {
                "spanId": "span-1",
                "parentSpanId": null,
                "operationName": "integration-test-operation",
                "serviceName": "integration-test-service",
                "startTime": "'$(date -u -d '10 seconds ago' +%Y-%m-%dT%H:%M:%S.%3NZ)'",
                "endTime": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
                "tags": {
                    "test": "true",
                    "environment": "integration"
                }
            }
        ]
    }'
    
    test_api_endpoint "POST" "$GATEWAY_URL/api/traces" 201 "$trace_data"
    
    # Wait and test trace retrieval
    sleep 5
    test_api_endpoint "GET" "$GATEWAY_URL/api/traces?service=integration-test-service&limit=1"
}

# Function to test alert creation
test_alert_creation() {
    echo -e "\n${YELLOW}🚨 Testing Alert Creation...${NC}"
    
    # Test alert creation
    alert_data='{
        "type": "threshold",
        "severity": "warning",
        "title": "Integration Test Alert",
        "message": "This is a test alert created during integration testing",
        "source": "integration-test",
        "tags": {
            "test": "true",
            "environment": "integration"
        },
        "metadata": {
            "threshold": 80,
            "current_value": 90
        }
    }'
    
    test_api_endpoint "POST" "$GATEWAY_URL/api/alerts" 201 "$alert_data"
    
    # Wait and test alert retrieval
    sleep 2
    test_api_endpoint "GET" "$GATEWAY_URL/api/alerts?source=integration-test&limit=5"
}

# Function to test ETL pipeline
test_etl_pipeline() {
    echo -e "\n${YELLOW}🔄 Testing ETL Pipeline...${NC}"
    
    # Test ETL status
    test_api_endpoint "GET" "$GATEWAY_URL/api/etl/status"
    
    # Test ETL topics
    test_api_endpoint "GET" "$GATEWAY_URL/api/etl/topics"
    
    # Test data processing
    test_data='{
        "data": {
            "name": "test.pipeline.metric",
            "value": 123.45,
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
        },
        "processingType": "metric"
    }'
    
    test_api_endpoint "POST" "$GATEWAY_URL/api/etl/process" 200 "$test_data"
}

# Function to test cross-service communication
test_cross_service_communication() {
    echo -e "\n${YELLOW}🔗 Testing Cross-Service Communication...${NC}"
    
    # Test that metrics create alerts when thresholds are exceeded
    high_metric='{
        "name": "test.cpu.critical",
        "value": 95.0,
        "tags": {
            "host": "test-server", 
            "alert": "true"
        },
        "source": "threshold-test"
    }'
    
    test_api_endpoint "POST" "$GATEWAY_URL/api/metrics" 201 "$high_metric"
    
    # Wait for processing and check if alert was generated
    echo "Waiting for cross-service alert processing..."
    sleep 10
    
    # Check for generated alerts
    test_api_endpoint "GET" "$GATEWAY_URL/api/alerts?source=metrics-service&limit=5"
}

# Function to test load balancing
test_load_balancing() {
    echo -e "\n${YELLOW}⚖️  Testing Load Balancing...${NC}"
    
    echo "Sending multiple requests to test load balancing..."
    
    for i in {1..10}; do
        response=$(curl -s -w "%{http_code}:%{time_total}" "$GATEWAY_URL/api/metrics/stats" 2>/dev/null)
        status_code=$(echo "$response" | cut -d':' -f2)
        response_time=$(echo "$response" | cut -d':' -f3)
        
        if [ "$status_code" = "200" ]; then
            echo "Request $i: ✓ (${response_time}s)"
        else
            echo "Request $i: ✗ ($status_code)"
        fi
    done
}

# Function to test rate limiting
test_rate_limiting() {
    echo -e "\n${YELLOW}🛡️  Testing Rate Limiting...${NC}"
    
    echo "Testing rate limiting (sending rapid requests)..."
    
    # Send many requests quickly to trigger rate limiting
    for i in {1..20}; do
        response=$(curl -s -w "%{http_code}" "$GATEWAY_URL/api/metrics/stats" 2>/dev/null)
        status_code="${response: -3}"
        
        if [ "$status_code" = "429" ]; then
            echo -e "Rate limiting triggered after $i requests ${GREEN}✓${NC}"
            return 0
        fi
    done
    
    echo -e "Rate limiting not triggered (may need adjustment) ${YELLOW}⚠${NC}"
}

# Function to generate test report
generate_test_report() {
    echo -e "\n${BLUE}📋 Test Summary${NC}"
    echo "=============="
    echo "Test completed at: $(date)"
    echo "Gateway URL: $GATEWAY_URL"
    echo "Registry URL: $REGISTRY_URL"
    
    # Get service status from gateway
    echo -e "\n${YELLOW}Service Status:${NC}"
    curl -s "$GATEWAY_URL/gateway/status" | jq -r '
        .services | to_entries[] | 
        "\(.key): \(.value.status) (\(.value.instances) instances)"
    ' 2>/dev/null || echo "Unable to retrieve service status"
    
    # Get registry statistics
    echo -e "\n${YELLOW}Registry Statistics:${NC}"
    curl -s "$REGISTRY_URL/stats" | jq -r '
        "Total Services: \(.totalServices)",
        "Passing: \(.servicesByStatus.passing)",
        "Warning: \(.servicesByStatus.warning)", 
        "Critical: \(.servicesByStatus.critical)",
        "Unknown: \(.servicesByStatus.unknown)"
    ' 2>/dev/null || echo "Unable to retrieve registry statistics"
}

# Main test execution
main() {
    echo -e "${BLUE}Starting comprehensive microservices integration test...${NC}\n"
    
    # Check if services are running
    wait_for_services
    
    # Run integration tests
    test_service_discovery
    test_api_gateway_routing
    test_metrics_ingestion
    test_log_ingestion
    test_trace_ingestion
    test_alert_creation
    test_etl_pipeline
    test_cross_service_communication
    test_load_balancing
    test_rate_limiting
    
    # Generate final report
    generate_test_report
    
    echo -e "\n${GREEN}🎉 Integration tests completed!${NC}"
    echo -e "${YELLOW}Check the logs and services for any issues.${NC}"
    
    # Open browser to gateway status (optional)
    if command -v xdg-open >/dev/null 2>&1; then
        echo -e "${BLUE}Opening gateway status in browser...${NC}"
        xdg-open "$GATEWAY_URL/gateway/status" 2>/dev/null || true
    fi
}

# Handle script arguments
case "${1:-}" in
    "quick")
        echo "Running quick health checks only..."
        wait_for_services
        test_service_discovery
        generate_test_report
        ;;
    "load")
        echo "Running load testing only..."
        test_load_balancing
        test_rate_limiting
        ;;
    *)
        main
        ;;
esac