#!/bin/bash
# AIRIS EPM Test Runner Script
# Comprehensive test execution for CI/CD pipeline

set -euo pipefail

TEST_TYPE=${1:-all}
ENVIRONMENT=${2:-test}
PARALLEL=${3:-true}

echo "🧪 AIRIS EPM Test Runner"
echo "Test Type: $TEST_TYPE"
echo "Environment: $ENVIRONMENT"
echo "Parallel: $PARALLEL"

# Set up test environment variables
export NODE_ENV=test
export DATABASE_URL=${TEST_DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/airis_epm_test"}
export REDIS_URL=${TEST_REDIS_URL:-"redis://localhost:6379"}
export CLICKHOUSE_URL=${TEST_CLICKHOUSE_URL:-"http://localhost:8123"}
export LOG_LEVEL=error

# Create test results directory
mkdir -p test-results coverage

# Function to run unit tests
run_unit_tests() {
    echo "🔬 Running unit tests..."
    if [[ "$PARALLEL" == "true" ]]; then
        npm run test:unit -- --coverage --maxWorkers=4 --junit --outputFile=test-results/unit-results.xml
    else
        npm run test:unit -- --coverage --runInBand --junit --outputFile=test-results/unit-results.xml
    fi
}

# Function to run integration tests
run_integration_tests() {
    echo "🔗 Running integration tests..."
    
    # Wait for services to be ready
    echo "⏳ Waiting for services..."
    wait_for_service "postgres" "localhost:5432"
    wait_for_service "redis" "localhost:6379" 
    wait_for_service "clickhouse" "localhost:8123"
    
    npm run test:integration -- --junit --outputFile=test-results/integration-results.xml
}

# Function to run e2e tests
run_e2e_tests() {
    echo "🌐 Running end-to-end tests..."
    
    # Start application in test mode
    npm run start:test &
    APP_PID=$!
    
    # Wait for application to start
    sleep 10
    wait_for_service "application" "localhost:3000"
    
    # Run Playwright tests
    npx playwright test --reporter=junit --output-dir=test-results/e2e
    
    # Clean up
    kill $APP_PID
}

# Function to run performance tests
run_performance_tests() {
    echo "⚡ Running performance tests..."
    
    # Artillery performance testing
    npx artillery run tests/performance/load-test.yml --output test-results/performance-results.json
    
    # K6 performance testing (if available)
    if command -v k6 &> /dev/null; then
        k6 run tests/performance/stress-test.js --out json=test-results/k6-results.json
    fi
}

# Function to run security tests
run_security_tests() {
    echo "🔒 Running security tests..."
    
    # OWASP dependency check
    npm audit --audit-level=moderate --json > test-results/audit-results.json || true
    
    # Snyk security scan
    if command -v snyk &> /dev/null; then
        snyk test --json > test-results/snyk-results.json || true
    fi
    
    # Custom security tests
    npm run test:security -- --json --outputFile=test-results/security-results.json
}

# Function to wait for service
wait_for_service() {
    local name=$1
    local address=$2
    local timeout=${3:-60}
    local count=0
    
    echo "⏳ Waiting for $name at $address..."
    
    while [[ $count -lt $timeout ]]; do
        if nc -z ${address/:/ } 2>/dev/null; then
            echo "✅ $name is ready"
            return 0
        fi
        ((count++))
        sleep 1
    done
    
    echo "❌ $name failed to start within ${timeout}s"
    return 1
}

# Function to generate test report
generate_report() {
    echo "📊 Generating test report..."
    
    cat << EOF > test-results/summary.html
<!DOCTYPE html>
<html>
<head>
    <title>AIRIS EPM Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .passed { color: green; font-weight: bold; }
        .failed { color: red; font-weight: bold; }
        .warning { color: orange; font-weight: bold; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 AIRIS EPM Test Results</h1>
        <p><strong>Date:</strong> $(date)</p>
        <p><strong>Environment:</strong> $ENVIRONMENT</p>
        <p><strong>Test Type:</strong> $TEST_TYPE</p>
    </div>
    
    <div class="section">
        <h2>Test Summary</h2>
        <table>
            <tr><th>Test Suite</th><th>Status</th><th>Details</th></tr>
EOF

    # Add test results to report
    if [[ -f "test-results/unit-results.xml" ]]; then
        echo "            <tr><td>Unit Tests</td><td class=\"passed\">✅ Passed</td><td>Coverage available</td></tr>" >> test-results/summary.html
    fi
    
    if [[ -f "test-results/integration-results.xml" ]]; then
        echo "            <tr><td>Integration Tests</td><td class=\"passed\">✅ Passed</td><td>All services connected</td></tr>" >> test-results/summary.html
    fi
    
    cat << EOF >> test-results/summary.html
        </table>
    </div>
    
    <div class="section">
        <h2>Coverage Report</h2>
        <p>Detailed coverage report available in coverage/lcov-report/index.html</p>
    </div>
</body>
</html>
EOF

    echo "📋 Test report generated: test-results/summary.html"
}

# Main execution logic
case $TEST_TYPE in
    "unit")
        run_unit_tests
        ;;
    "integration")
        run_integration_tests
        ;;
    "e2e")
        run_e2e_tests
        ;;
    "performance")
        run_performance_tests
        ;;
    "security")
        run_security_tests
        ;;
    "all")
        echo "🚀 Running all test suites..."
        run_unit_tests
        run_integration_tests
        run_e2e_tests
        run_performance_tests
        run_security_tests
        ;;
    *)
        echo "❌ Unknown test type: $TEST_TYPE"
        echo "Available types: unit, integration, e2e, performance, security, all"
        exit 1
        ;;
esac

# Generate final report
generate_report

echo "✅ Test execution completed successfully!"
echo "📊 Results available in test-results/ directory"