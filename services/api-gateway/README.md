# AIRIS EPM API Gateway

> **Enterprise-grade API Gateway with comprehensive security, versioning, and observability features**

## 🚀 Overview

The AIRIS EPM API Gateway is a production-ready, security-first API gateway designed for enterprise monitoring and observability platforms. It provides robust authentication, authorization, rate limiting, request/response transformation, and API versioning capabilities.

## ✨ Key Features

### 🔐 Security & Authentication
- **JWT Authentication** with refresh token mechanism
- **API Key Authentication** with role-based prefixes
- **Role-Based Access Control (RBAC)** with 7 hierarchical roles
- **Rate Limiting** with configurable thresholds
- **Request/Response Sanitization** against XSS and injection attacks
- **Security Headers** via Helmet.js integration

### 📦 API Management
- **API Versioning** with semantic versioning support
- **Backward Compatibility** with automatic request/response transformation
- **Deprecation Management** with sunset date tracking
- **Content Negotiation** via headers, query params, or URL paths

### 🛡️ Data Protection
- **Input Validation** with Joi schema validation
- **Data Sanitization** removing dangerous fields and scripts
- **Sensitive Data Filtering** in responses
- **Compression Support** with gzip encoding

### 📊 Observability
- **Comprehensive Logging** with Winston
- **Request Tracing** with unique request IDs
- **Performance Metrics** with response time tracking
- **Audit Trail** for all authentication and authorization events

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │───▶│   API Gateway    │───▶│  Microservices  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │    Redis     │
                       │ (Cache/Auth) │
                       └──────────────┘
```

### Components
- **API Gateway**: Express.js-based gateway with middleware chain
- **Authentication System**: JWT + API Key management
- **Authorization System**: RBAC with hierarchical permissions
- **Version Manager**: Semantic versioning with transformation
- **Transformation Engine**: Request/response processing
- **Redis Cache**: Token storage and rate limiting

## 🚦 Quick Start

### Prerequisites
- Node.js 16+ 
- Redis 6+
- Docker (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd services/api-gateway

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the gateway
npm start
```

### Docker Setup

```bash
# Build the image
docker build -t airis-api-gateway .

# Run with Docker Compose
docker compose up -d
```

## 🔧 Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Gateway Configuration
PORT=3000
SERVICE_REGISTRY_URL=http://localhost:8500
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002

# Logging
LOG_LEVEL=info
```

## 📚 API Documentation

### Authentication Endpoints

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

#### Generate API Key
```http
POST /auth/api-key/generate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "role": "developer"
}
```

### Version Management

#### Get Supported Versions
```http
GET /api/versions
```

#### Version Header
```http
GET /api/metrics
Accept-Version: 1.1.0
```

### Protected Resources

All `/api/*` endpoints require authentication and are subject to RBAC permissions.

## 🛡️ Security Features

### Role Hierarchy

| Role | Level | Description |
|------|--------|-------------|
| `superadmin` | 1000 | Full system access |
| `admin` | 100 | Administrative access |
| `operator` | 50 | Operations team access |
| `developer` | 30 | Development access |
| `analyst` | 20 | Read-only data access |
| `viewer` | 10 | Basic monitoring access |
| `guest` | 1 | Minimal access |

### Permission System

Permissions follow the format: `<resource>:<action>`
- **Resources**: `metrics`, `logs`, `traces`, `alerts`, `etl`, `gateway`, `registry`
- **Actions**: `read`, `write`, `delete`, `admin`
- **Wildcards**: `*:*` (all permissions), `metrics:*` (all metric actions)

## 🧪 Testing

### Run Security Tests
```bash
npm run test:security
```

### Manual Testing
```bash
# Test authentication
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Test protected endpoint
curl -X GET http://localhost:3000/auth/roles \
  -H "Authorization: Bearer <token>"

# Test API versioning
curl -X GET http://localhost:3000/api/versions \
  -H "Accept-Version: 1.1.0"
```

## 📈 Monitoring

### Health Checks
- `GET /health` - Basic health status
- `GET /gateway/status` - Detailed gateway status with services
- `GET /ready` - Readiness probe for Kubernetes

### Metrics
- Request/response metrics via Prometheus format
- Performance timing with response duration
- Error rates and status code distribution
- Authentication success/failure rates

### Logging
- Structured JSON logging with Winston
- Request/response logging with correlation IDs
- Security event auditing
- Error tracking with stack traces

## 🔄 API Versioning

### Supported Versions

| Version | Status | Features |
|---------|--------|----------|
| 1.0.0 | Active | Basic functionality |
| 1.1.0 | Active | Enhanced pagination, error codes |
| 2.0.0 | Beta | Restructured responses, GraphQL |

### Version Negotiation Priority
1. `Accept-Version` or `API-Version` header
2. `version` or `api_version` query parameter  
3. URL path version (`/api/v1/...`)
4. Default version (1.1.0)

## 🚀 Production Deployment

### Docker Compose Example
```yaml
version: '3.8'
services:
  api-gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_HOST=redis
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: airis-api-gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: api-gateway-secrets
              key: jwt-secret
        - name: REDIS_HOST
          value: redis-service
```

## 📋 Middleware Chain

For `/api/*` routes, requests flow through:

1. **Transformation Middleware** - Sanitization and validation
2. **API Version Middleware** - Version negotiation and headers
3. **JWT Authentication** - Token validation and user context
4. **RBAC Authorization** - Permission checking
5. **Proxy Middleware** - Route to backend services

## 🔗 Service Integration

### Service Registry Integration
- Automatic service discovery via Consul
- Health check monitoring
- Load balancing with round-robin selection
- Circuit breaker pattern for resilience

### Backend Services
- `metrics-service` - Metrics collection and querying
- `logs-service` - Log aggregation and search  
- `traces-service` - Distributed tracing
- `alerts-service` - Alert management
- `etl-pipeline` - Data processing pipeline

## 📞 Support

### Documentation
- [API Security Documentation](./docs/API_SECURITY_DOCUMENTATION.md)
- [Security Policies](./docs/SECURITY_POLICIES.md)

### Health Endpoints
- `/health` - Gateway health
- `/gateway/status` - Service status
- `/api/versions` - API version info

### Troubleshooting
1. Check gateway health endpoint
2. Verify Redis connectivity
3. Validate JWT configuration
4. Review request logs
5. Test authentication flow

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Follow security best practices
5. Submit a pull request

### Security Guidelines
- Never commit secrets or keys
- Follow OWASP security practices
- Add security tests for new features
- Update security documentation
- Run security test suite before PR

## 📄 License

Copyright © 2024 AIRIS EPM Development Team. All rights reserved.

---

**Status**: Production Ready ✅  
**Version**: 1.0.0  
**Last Updated**: 2024-08-26  
**Security Review**: 2024-08-26