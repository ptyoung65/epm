# AIRIS EPM-APM Integration Mapping

## Overview
Integration mapping between the new React EPM Dashboard and existing AIRIS APM System.

## Service Architecture

### AIRIS APM System (Already Running)
| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| API Gateway | 3000 | ✅ | Main API entry point |
| UI Dashboard | 3001 | ✅ | Legacy HTML dashboards |  
| Session Replay | 3003 | ❌ | User session recording |
| AIOps Engine | 3004 | ✅ | AI-based anomaly detection |
| Event Delta | 3005 | ✅ | Change analysis |
| NLP Search | 3006 | ✅ | Natural language search |
| Data Ingestion | 3007 | ✅ | Data collection |
| ClickHouse | 8123, 9000 | ✅ | Time-series database |
| Redis | 6379 | ✅ | Caching layer |
| Kafka | 9092 | ✅ | Message streaming |

### New React EPM Dashboard (Being Integrated)
| Component | Port | Purpose | Maps To |
|-----------|------|---------|---------|
| Main Dashboard | TBD | Enterprise dashboard | API Gateway (3000) |
| APM Overview | TBD | Performance monitoring | API Gateway /api/v1/dashboard |
| J2EE Monitoring | TBD | Java EE monitoring | API Gateway + existing j2ee-monitor service |
| WAS Monitoring | TBD | WebLogic/Tomcat monitoring | API Gateway + existing was-monitor service |
| Exception Tracking | TBD | Error analysis | API Gateway + existing exception-tracker |
| Service Topology | TBD | Service dependencies | API Gateway + existing service-topology |
| Alert Management | TBD | Notification management | API Gateway + existing alert-notification |

## API Endpoint Mapping

### Core APIs Available (AIRIS APM)
- **Health Check**: `GET http://localhost:3000/health`
- **System Status**: `GET http://localhost:3000/api/v1/status` 
- **API Documentation**: `GET http://localhost:3000/api/docs`

### Required Integration APIs (To Be Created)
- **Dashboard Data**: `GET /api/v1/dashboard/overview`
- **Real-time Metrics**: `GET /api/v1/dashboard/realtime` 
- **Performance Metrics**: `GET /api/v1/dashboard/performance`
- **J2EE Metrics**: `GET /api/v1/j2ee/metrics`
- **WAS Status**: `GET /api/v1/was/status`
- **Exception Data**: `GET /api/v1/exceptions`
- **Service Topology**: `GET /api/v1/topology/services`
- **Alert Data**: `GET /api/v1/alerts`

## Data Flow Architecture

```
React EPM Dashboard → API Gateway (3000) → Microservices → ClickHouse/Redis
                  ↑
            Authentication Layer
```

## Integration Strategy

### Phase 1: API Layer Integration
1. Create adapter layer in API Gateway to serve React-compatible endpoints
2. Map existing microservice data to standardized JSON responses
3. Add CORS support for React frontend

### Phase 2: Data Harmonization  
1. Standardize data formats between legacy and new systems
2. Create unified authentication mechanism
3. Implement real-time WebSocket connections

### Phase 3: UI Integration
1. Replace placeholder components with real data consumers
2. Implement unified navigation between old/new dashboards  
3. Migrate users gradually from legacy UI

## Next Steps
1. Create integration API layer
2. Update React components to consume APM data
3. Test cross-system authentication
4. Implement unified navigation

---
*Generated: 2025-08-26*