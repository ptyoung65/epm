#!/bin/bash

echo "🚀 Starting OpenTelemetry Monitoring System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Build sample applications
echo -e "${YELLOW}📦 Building sample applications...${NC}"
docker build -t java-sample-app ./sample-apps/java-app
docker build -t python-sample-app ./sample-apps/python-app

# Build OpenTelemetry monitor service  
echo -e "${YELLOW}📦 Building OpenTelemetry monitor service...${NC}"
docker build -t otel-monitor ./clickstack-architecture/services/otel-monitor

# Start OpenTelemetry services
echo -e "${GREEN}🔧 Starting OpenTelemetry services...${NC}"
docker compose -f docker-compose.otel.yml up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 15

# Check service health
echo -e "${GREEN}🔍 Checking service health...${NC}"

# Check OpenTelemetry Collector
if curl -s http://localhost:13133/health > /dev/null; then
    echo -e "${GREEN}✅ OpenTelemetry Collector is healthy${NC}"
else
    echo -e "${RED}❌ OpenTelemetry Collector is not responding${NC}"
fi

# Check OpenTelemetry Gateway
if curl -s http://localhost:14318 > /dev/null; then
    echo -e "${GREEN}✅ OpenTelemetry Gateway is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  OpenTelemetry Gateway may still be starting${NC}"
fi

# Check OpenTelemetry Monitor API
if curl -s http://localhost:3013/health > /dev/null; then
    echo -e "${GREEN}✅ OpenTelemetry Monitor API is healthy${NC}"
else
    echo -e "${RED}❌ OpenTelemetry Monitor API is not responding${NC}"
fi

# Check Java sample app
if curl -s http://localhost:8080/api/health > /dev/null; then
    echo -e "${GREEN}✅ Java sample app is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Java sample app may still be starting${NC}"
fi

# Check Python sample app
if curl -s http://localhost:8081/health > /dev/null; then
    echo -e "${GREEN}✅ Python sample app is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Python sample app may still be starting${NC}"
fi

echo -e "${GREEN}✨ OpenTelemetry Monitoring System is running!${NC}"
echo ""
echo "📊 Access points:"
echo "  - OpenTelemetry Collector OTLP: http://localhost:4317 (gRPC), http://localhost:4318 (HTTP)"
echo "  - OpenTelemetry Gateway: http://localhost:14317 (gRPC), http://localhost:14318 (HTTP)"
echo "  - OpenTelemetry Monitor API: http://localhost:3013"
echo "  - Java Sample App: http://localhost:8080"
echo "  - Python Sample App: http://localhost:8081"
echo "  - App Monitoring Dashboard: http://localhost:3002/app-monitoring.html"
echo "  - Collector Metrics: http://localhost:8888/metrics"
echo "  - Prometheus Metrics: http://localhost:8889"
echo ""
echo "💡 Generate sample traffic:"
echo "  curl http://localhost:8080/api/orders"
echo "  curl http://localhost:8081/api/products"
echo ""
echo "🛑 To stop: ./scripts/stop-otel.sh"