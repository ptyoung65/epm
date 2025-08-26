# AIRIS EPM API Gateway Security Documentation

## 🛡️ Security Overview

The AIRIS EPM API Gateway implements a comprehensive security architecture with multiple layers of protection:

- **Authentication**: JWT tokens with refresh mechanism + API Key authentication
- **Authorization**: Role-Based Access Control (RBAC) with hierarchical permissions
- **Rate Limiting**: Configurable request throttling and slow-down protection
- **Request/Response Transformation**: Data sanitization, validation, and format conversion
- **API Versioning**: Backward compatibility with deprecation lifecycle management
- **Security Headers**: Helmet.js integration with CORS, CSP, and other protections

## 🔐 Authentication System

### JWT Authentication

#### Login Process
```bash
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123",
  "email": "admin@example.com"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_admin",
    "username": "admin",
    "role": "admin",
    "permissions": ["*:*"],
    "level": 100
  }
}
```

#### Token Usage
Include the access token in the Authorization header:
```bash
Authorization: Bearer <access_token>
```

#### Token Refresh
```bash
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}
```

#### Logout
```bash
POST /auth/logout
Authorization: Bearer <access_token>
```

### API Key Authentication

#### Generate API Key
```bash
POST /auth/api-key/generate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "role": "developer"
}
```

**Response:**
```json
{
  "message": "API key generated successfully",
  "apiKey": "dv_abc123_xyz789",
  "role": "developer",
  "permissions": ["metrics:read", "logs:read", ...],
  "expiresIn": "Never (revoke manually)"
}
```

#### Using API Keys
Include the API key in the header:
```bash
X-API-Key: dv_abc123_xyz789
```

## 🎭 Role-Based Access Control (RBAC)

### Role Hierarchy

| Role | Level | Description | Permissions |
|------|--------|-------------|-------------|
| `superadmin` | 1000 | Full system access | `*:*` |
| `admin` | 100 | System administrator | All resources and actions |
| `operator` | 50 | Operations team | Read/write metrics, logs, traces, alerts |
| `developer` | 30 | Developer access | Read/write observability data |
| `analyst` | 20 | Data analyst | Read-only access to data |
| `viewer` | 10 | Basic monitoring | Read metrics, logs, alerts |
| `guest` | 1 | Minimal access | Read metrics only |

### Permission Format
Permissions follow the format: `<resource>:<action>`

**Resources:**
- `metrics`: Metrics data and endpoints
- `logs`: Log data and endpoints  
- `traces`: Trace data and endpoints
- `alerts`: Alert management
- `etl`: ETL pipeline operations
- `gateway`: Gateway management
- `registry`: Service registry

**Actions:**
- `read`: View data
- `write`: Create/update data
- `delete`: Remove data
- `admin`: Administrative operations

**Examples:**
- `metrics:read`: Can view metrics
- `logs:*`: All log operations
- `*:read`: Read access to all resources

### Role Management

#### Get All Roles
```bash
GET /auth/roles
Authorization: Bearer <access_token>
```

#### Check User Permissions
The gateway automatically validates permissions based on:
1. User's role and assigned permissions
2. Required permission for the endpoint
3. Minimum role level requirements

## 📦 API Versioning System

### Supported Versions

| Version | Status | Features |
|---------|--------|----------|
| `1.0.0` | Active | Basic functionality |
| `1.1.0` | Active | Enhanced error responses, pagination |
| `2.0.0` | Beta | Restructured responses, streaming, GraphQL |

### Version Negotiation

#### Header-based
```bash
GET /api/metrics
Accept-Version: 1.1.0
```

#### Query Parameter
```bash
GET /api/metrics?version=1.1.0
```

#### URL Path
```bash
GET /api/v1.1/metrics
```

### Version Information
```bash
GET /api/versions
```

**Response:**
```json
{
  "versions": [
    {
      "version": "1.0.0",
      "status": "active",
      "deprecated": false,
      "documentation": "/docs/v1.0.0"
    }
  ],
  "default": "1.1.0",
  "latest": "2.0.0",
  "compatibility": {
    "1.0.0": {
      "backwardCompatible": ["1.0.0"],
      "forwardCompatible": ["1.0.0", "1.1.0"]
    }
  }
}
```

### Deprecation Management

#### Deprecate Version (Admin only)
```bash
POST /api/versions/1.0.0/deprecate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "sunsetDate": "2025-12-31T23:59:59Z"
}
```

Deprecated versions return warning headers:
```
Deprecated: true
Sunset: 2025-12-31T23:59:59Z
Link: </docs/1.0.0>; rel="deprecation"
Warning: 299 - "API version 1.0.0 will be sunset on 2025-12-31T23:59:59Z"
```

## 🔄 Request/Response Transformation

### Request Transformations

#### Data Sanitization
- Removes dangerous fields (`__proto__`, `constructor`, `password`)
- Strips XSS attempts (`<script>`, `javascript:`, `on*=`)
- Normalizes timestamps to ISO 8601 format

#### Field Mapping
Different API versions use different field names:

**v1.0.0:**
```json
{
  "page_size": 10,
  "page_number": 1
}
```

**v1.1.0:**
```json
{
  "pageSize": 10,
  "pageNumber": 1
}
```

#### Validation
Automatic validation based on endpoint schemas:
```javascript
// POST /api/metrics validation
{
  "name": "required string",
  "value": "required number", 
  "tags": "optional object",
  "timestamp": "optional date"
}
```

### Response Transformations

#### Metadata Injection
All responses include metadata:
```json
{
  "data": "...",
  "_meta": {
    "requestId": "uuid",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.1.0",
    "responseTime": 150
  }
}
```

#### Sensitive Data Filtering
Automatically removes or redacts:
- `password`: `[REDACTED]`
- `token`: `[REDACTED]`
- `secret`: `[REDACTED]`
- `apiKey`: `[REDACTED]`

#### Compression
Supports gzip compression when client sends:
```
Accept-Encoding: gzip
```

## 🚨 Rate Limiting & Security

### Rate Limits

| Scope | Window | Limit | Behavior |
|-------|---------|-------|----------|
| Global | 15 minutes | 1000 requests/IP | HTTP 429 |
| API Routes | 15 minutes | After 500 requests | 500ms delay/request |
| Max Delay | - | 20 seconds | Cap on delay |

### Security Headers

Applied automatically via Helmet.js:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security`
- `Referrer-Policy`

### CORS Configuration
```javascript
{
  origin: process.env.ALLOWED_ORIGINS || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
  credentials: true
}
```

## 🔍 Monitoring & Auditing

### Request Logging
All requests are logged with:
- Request ID (`X-Request-Id`)
- Method and path
- Response status and duration
- User information (if authenticated)
- IP address and User-Agent

### Audit Trail
Authentication and authorization events include:
- User ID and role
- Required vs granted permissions
- Timestamp and request context
- Success/failure status

### Error Responses
Consistent error format:
```json
{
  "error": "Human readable message",
  "code": "MACHINE_READABLE_CODE",
  "requestId": "uuid",
  "timestamp": "ISO date"
}
```

## 🛠️ Configuration

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

# Security
VALID_API_KEYS=key1,key2,key3
LOG_LEVEL=info
```

### Rate Limiting Configuration
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // requests per window
  standardHeaders: true,
  legacyHeaders: false
});
```

## 🧪 Security Testing

### Test Suite
Run the comprehensive security test suite:
```bash
npm run test:security
```

### Test Coverage
The test suite validates:
- JWT authentication flow
- API key generation and usage
- RBAC permission enforcement
- API versioning functionality
- Request/response transformations
- Rate limiting behavior
- Input validation and sanitization
- Error handling consistency
- Security headers presence

### Manual Testing Examples

#### Authentication Test
```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Use token
curl -X GET http://localhost:3000/auth/roles \
  -H "Authorization: Bearer <token>"
```

#### Version Test
```bash
# Test version negotiation
curl -X GET http://localhost:3000/api/versions \
  -H "Accept-Version: 1.1.0" \
  -v
```

#### Permission Test
```bash
# Generate viewer API key
curl -X POST http://localhost:3000/auth/api-key/generate \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "viewer"}'

# Try admin action with viewer key (should fail)
curl -X POST http://localhost:3000/auth/api-key/generate \
  -H "X-API-Key: <viewer_key>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

## 📋 Security Checklist

### Deployment Security
- [ ] Change default JWT secrets
- [ ] Configure proper CORS origins
- [ ] Set up Redis with authentication
- [ ] Enable HTTPS in production
- [ ] Set secure session cookies
- [ ] Configure rate limiting for your load
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Database credentials rotation
- [ ] API key lifecycle management

### Monitoring
- [ ] Request/response logging enabled
- [ ] Error tracking configured
- [ ] Performance monitoring active
- [ ] Security event alerting
- [ ] Failed authentication monitoring
- [ ] Rate limit threshold alerting
- [ ] Unusual API usage patterns

### Compliance
- [ ] Data retention policies defined
- [ ] Audit trail maintenance
- [ ] GDPR compliance measures
- [ ] Access control documentation
- [ ] Security incident response plan
- [ ] Regular security assessments
- [ ] Penetration testing schedule

## 🚀 Production Deployment

### High Availability Setup
```yaml
# Docker Compose example
version: '3.8'
services:
  api-gateway-1:
    build: .
    environment:
      - NODE_ID=gateway-1
    ports:
      - "3000:3000"
  
  api-gateway-2:
    build: .
    environment:
      - NODE_ID=gateway-2
    ports:
      - "3001:3000"
  
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### Load Balancer Configuration
```nginx
upstream api_gateway {
    server api-gateway-1:3000;
    server api-gateway-2:3000;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/api.crt;
    ssl_certificate_key /etc/ssl/private/api.key;
    
    location / {
        proxy_pass http://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📞 Support & Security Issues

### Reporting Security Vulnerabilities
For security issues, please contact:
- **Email**: security@airis.com
- **Response Time**: 24 hours
- **Disclosure**: Coordinated disclosure preferred

### Support Channels
- **Documentation**: `/docs` endpoint
- **Health Check**: `/health` endpoint  
- **Status Page**: `/gateway/status` endpoint
- **API Versions**: `/api/versions` endpoint

---

**Last Updated**: 2024-08-26
**Version**: 1.0.0
**Author**: AIRIS EPM Development Team