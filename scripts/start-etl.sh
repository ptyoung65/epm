#!/bin/bash

# AIRIS EPM ETL Pipeline Startup Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting AIRIS EPM ETL Pipeline..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    local service=$1
    local port=$2
    
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $service is running on port $port"
        return 0
    else
        echo -e "${RED}✗${NC} $service is not running on port $port"
        return 1
    fi
}

# Start Kafka and Flink infrastructure
echo "📦 Starting Kafka and Flink infrastructure..."
cd "$PROJECT_ROOT/infrastructure/kafka-flink"

# Start the ETL infrastructure
docker compose -f docker-compose.etl.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service status
echo -e "\n📊 Checking service status..."
check_service "Zookeeper" 2181
check_service "Kafka Broker 1" 9092
check_service "Kafka Broker 2" 9093
check_service "Kafka Broker 3" 9094
check_service "Kafka UI" 8080
check_service "Schema Registry" 8081
check_service "Flink JobManager" 8082
check_service "Kafka Connect" 8083

# Build and start the ETL Pipeline service
echo -e "\n🔨 Building ETL Pipeline service..."
cd "$PROJECT_ROOT/services/etl-pipeline"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t airis-epm-etl-pipeline:latest .

# Tag for registry
docker tag airis-epm-etl-pipeline:latest localhost:5000/airis-epm/etl-pipeline:latest

# Push to registry (if registry is running)
if check_service "Registry" 5000; then
    echo "📤 Pushing to registry..."
    docker push localhost:5000/airis-epm/etl-pipeline:latest
fi

# Run the ETL Pipeline service
echo -e "\n🎯 Starting ETL Pipeline service..."
docker run -d \
    --name airis-epm-etl-pipeline \
    --network airis-etl-network \
    -p 3020:3020 \
    -e NODE_ENV=production \
    -e KAFKA_BROKERS=kafka1:29092,kafka2:29092,kafka3:29092 \
    -e REDIS_HOST=redis \
    -e REDIS_PORT=6379 \
    -e CLICKHOUSE_URL=http://clickhouse \
    -e CLICKHOUSE_PORT=8123 \
    -e MONGODB_URL=mongodb://mongodb:27017 \
    -e POSTGRES_HOST=postgres \
    -e POSTGRES_PORT=5432 \
    -v "$PROJECT_ROOT/logs:/app/logs" \
    airis-epm-etl-pipeline:latest

# Wait for ETL service to start
sleep 5

# Check ETL service status
if check_service "ETL Pipeline" 3020; then
    echo -e "\n${GREEN}✅ ETL Pipeline started successfully!${NC}"
    echo -e "\n📝 Service URLs:"
    echo "  - ETL Pipeline API: http://localhost:3020"
    echo "  - Kafka UI: http://localhost:8080"
    echo "  - Flink UI: http://localhost:8082"
    echo "  - Schema Registry: http://localhost:8081"
    echo -e "\n📊 Health Check:"
    curl -s http://localhost:3020/health | jq '.' || echo "Health check endpoint not yet ready"
else
    echo -e "\n${RED}❌ Failed to start ETL Pipeline service${NC}"
    echo "Check logs with: docker logs airis-epm-etl-pipeline"
    exit 1
fi

echo -e "\n✨ ETL Pipeline is ready for processing!"