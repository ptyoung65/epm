#!/bin/bash
# AIRIS EPM Deployment Monitoring Script
# Monitors key metrics after deployment

set -euo pipefail

DURATION=${1:-600}  # Default 10 minutes
ENVIRONMENT=${2:-production}
NAMESPACE="airis-epm-${ENVIRONMENT}"

echo "📊 Monitoring AIRIS EPM deployment for ${DURATION} seconds"
echo "Environment: $ENVIRONMENT"

# Function to get metrics
get_metrics() {
    local deployment=$1
    
    # Get pod metrics via kubectl top (requires metrics-server)
    local cpu_usage=$(kubectl top pod -n "$NAMESPACE" -l app=airis-epm --no-headers | awk '{sum += $2} END {print sum}' | sed 's/m$//')
    local memory_usage=$(kubectl top pod -n "$NAMESPACE" -l app=airis-epm --no-headers | awk '{sum += $3} END {print sum}' | sed 's/Mi$//')
    
    # Get application metrics
    local pod_name=$(kubectl get pods -n "$NAMESPACE" -l app=airis-epm -o jsonpath='{.items[0].metadata.name}')
    local response_time=$(kubectl exec "$pod_name" -n "$NAMESPACE" -- curl -s http://localhost:3000/metrics | grep -o 'http_request_duration_ms_avg [0-9.]*' | awk '{print $2}' || echo "0")
    local error_count=$(kubectl exec "$pod_name" -n "$NAMESPACE" -- curl -s http://localhost:3000/metrics | grep -o 'http_requests_errors_total [0-9]*' | awk '{sum += $2} END {print sum}' || echo "0")
    local request_count=$(kubectl exec "$pod_name" -n "$NAMESPACE" -- curl -s http://localhost:3000/metrics | grep -o 'http_requests_total [0-9]*' | awk '{sum += $2} END {print sum}' || echo "0")
    
    echo "$cpu_usage,$memory_usage,$response_time,$error_count,$request_count"
}

# Initialize monitoring
start_time=$(date +%s)
end_time=$((start_time + DURATION))
check_interval=30

echo "📈 Starting metrics collection..."
echo "Time,CPU(m),Memory(Mi),ResponseTime(ms),Errors,Requests"

# Baseline metrics
baseline_metrics=$(get_metrics "airis-epm-app")
baseline_cpu=$(echo "$baseline_metrics" | cut -d',' -f1)
baseline_memory=$(echo "$baseline_metrics" | cut -d',' -f2)
baseline_response_time=$(echo "$baseline_metrics" | cut -d',' -f3)
baseline_errors=$(echo "$baseline_metrics" | cut -d',' -f4)

echo "📊 Baseline: CPU=${baseline_cpu}m, Memory=${baseline_memory}Mi, RT=${baseline_response_time}ms, Errors=${baseline_errors}"

# Monitoring loop
while [[ $(date +%s) -lt $end_time ]]; do
    current_time=$(date '+%H:%M:%S')
    current_metrics=$(get_metrics "airis-epm-app")
    
    # Parse current metrics
    current_cpu=$(echo "$current_metrics" | cut -d',' -f1)
    current_memory=$(echo "$current_metrics" | cut -d',' -f2)
    current_response_time=$(echo "$current_metrics" | cut -d',' -f3)
    current_errors=$(echo "$current_metrics" | cut -d',' -f4)
    current_requests=$(echo "$current_metrics" | cut -d',' -f5)
    
    echo "$current_time,$current_metrics"
    
    # Check for anomalies
    cpu_threshold=$((baseline_cpu * 2))
    memory_threshold=$((baseline_memory * 2))
    response_time_threshold=$(echo "$baseline_response_time * 2" | bc -l)
    error_increase=$((current_errors - baseline_errors))
    
    # Alert conditions
    alerts=()
    
    if [[ -n "$current_cpu" && -n "$baseline_cpu" && $current_cpu -gt $cpu_threshold ]]; then
        alerts+=("🚨 HIGH CPU: ${current_cpu}m (baseline: ${baseline_cpu}m)")
    fi
    
    if [[ -n "$current_memory" && -n "$baseline_memory" && $current_memory -gt $memory_threshold ]]; then
        alerts+=("🚨 HIGH MEMORY: ${current_memory}Mi (baseline: ${baseline_memory}Mi)")
    fi
    
    if [[ -n "$current_response_time" && -n "$baseline_response_time" ]] && 
       [[ $(echo "$current_response_time > $response_time_threshold" | bc -l) -eq 1 ]]; then
        alerts+=("🚨 HIGH RESPONSE TIME: ${current_response_time}ms (baseline: ${baseline_response_time}ms)")
    fi
    
    if [[ $error_increase -gt 10 ]]; then
        alerts+=("🚨 ERROR INCREASE: +${error_increase} errors")
    fi
    
    # Print alerts
    for alert in "${alerts[@]}"; do
        echo "$alert"
    done
    
    # Check deployment health
    if ! kubectl get deployment airis-epm-app -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' | grep -q "True"; then
        echo "🚨 DEPLOYMENT UNHEALTHY!"
        exit 1
    fi
    
    sleep $check_interval
done

echo "✅ Monitoring completed successfully"
echo "🎉 No critical issues detected during ${DURATION}s monitoring period"