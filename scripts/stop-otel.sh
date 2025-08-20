#!/bin/bash

echo "🛑 Stopping OpenTelemetry Monitoring System..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Stop OpenTelemetry services
echo -e "${YELLOW}📦 Stopping OpenTelemetry services...${NC}"
docker compose -f docker-compose.otel.yml down

# Remove OpenTelemetry volumes if needed (optional)
read -p "Do you want to remove OpenTelemetry data volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🗑️  Removing OpenTelemetry volumes...${NC}"
    docker compose -f docker-compose.otel.yml down -v
fi

echo -e "${GREEN}✅ OpenTelemetry Monitoring System stopped successfully!${NC}"