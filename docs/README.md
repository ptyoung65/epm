# AIRIS-MON - AI-Driven Real-time Infrastructure and Security Monitoring

## Overview

AIRIS-MON is a comprehensive monitoring and security platform that leverages artificial intelligence to provide real-time insights into infrastructure performance, security threats, and system anomalies.

## Features

- **Real-time Monitoring**: Live dashboards for infrastructure metrics
- **AI-Powered Anomaly Detection**: Machine learning algorithms to identify unusual patterns
- **Security Threat Detection**: Automated security monitoring and alert system
- **Multi-Cloud Support**: Monitor AWS, Azure, GCP, and on-premises infrastructure
- **Scalable Architecture**: Built to handle enterprise-level monitoring requirements
- **API-First Design**: Comprehensive REST and WebSocket APIs

## Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Docker and Docker Compose
- MongoDB, PostgreSQL, Redis, and InfluxDB (or use Docker Compose)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd airis-mon
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start with Docker Compose (Recommended)**:
   ```bash
   npm run docker:dev
   ```

5. **Or start services manually**:
   ```bash
   # Start databases
   # MongoDB: mongod
   # PostgreSQL: pg_ctl start
   # Redis: redis-server
   # InfluxDB: influxd
   
   # Start the application
   npm run dev
   ```

### Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run typecheck` - Run TypeScript type checking

## Architecture

### Database Design

- **MongoDB**: Application data, user accounts, configurations
- **PostgreSQL**: Relational data, audit logs, user sessions
- **Redis**: Caching, session storage, rate limiting
- **InfluxDB**: Time-series data, metrics, performance data

### API Structure

```
/api/v1/
├── /auth          # Authentication endpoints
├── /users         # User management
├── /monitoring    # Monitoring data and controls
├── /alerts        # Alert management
├── /dashboards    # Dashboard configuration
├── /reports       # Report generation
└── /admin         # Administrative functions
```

### Real-time Features

- WebSocket connections for live data streaming
- Server-sent events for notifications
- Real-time dashboard updates
- Live alert notifications

## Configuration

### Environment Variables

Key configuration options:

- `NODE_ENV`: Environment (development/staging/production)
- `PORT`: Application port (default: 3000)
- `MONGODB_URI`: MongoDB connection string
- `POSTGRES_*`: PostgreSQL configuration
- `REDIS_*`: Redis configuration
- `INFLUXDB_*`: InfluxDB configuration
- `JWT_SECRET`: JWT signing secret
- `LOG_LEVEL`: Logging level (error/warn/info/debug)

### Security

- JWT-based authentication
- Rate limiting
- CORS configuration
- Helmet.js security headers
- Input validation and sanitization
- Environment-specific security settings

## Testing

### Test Structure

```
tests/
├── unit/          # Unit tests
├── integration/   # Integration tests
├── e2e/          # End-to-end tests
└── fixtures/     # Test data and mocks
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=unit

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Deployment

### Docker Deployment

1. **Build the image**:
   ```bash
   docker build -t airis-mon .
   ```

2. **Run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

### Production Checklist

- [ ] Set secure JWT_SECRET
- [ ] Configure production database connections
- [ ] Set up SSL/TLS certificates
- [ ] Configure monitoring and logging
- [ ] Set up backup strategies
- [ ] Configure alerting systems
- [ ] Review security settings
- [ ] Set up CI/CD pipeline

## Monitoring and Observability

### Metrics

The application exposes Prometheus metrics at `/metrics`:

- HTTP request metrics
- Database connection metrics
- Custom business metrics
- System resource usage

### Health Checks

Health check endpoint at `/health` provides:

- Application status
- Database connectivity
- External service availability
- Resource utilization

### Logging

Structured logging with Winston:

- Application logs: `logs/app.log`
- Error logs: `logs/error.log`
- Security logs: `logs/security.log`
- Performance logs: `logs/performance.log`

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run linting and tests
5. Submit a pull request

### Code Standards

- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- 80% test coverage minimum
- Documentation for public APIs

## API Documentation

### Authentication

```bash
# Login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# Get user profile
GET /api/v1/users/profile
Authorization: Bearer <token>
```

### Monitoring Data

```bash
# Get system metrics
GET /api/v1/monitoring/metrics?timeRange=1h

# Get alerts
GET /api/v1/alerts?status=active

# Create dashboard
POST /api/v1/dashboards
{
  "name": "System Overview",
  "widgets": [...]
}
```

## Support and Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   - Check database service status
   - Verify connection strings
   - Check firewall settings

2. **High Memory Usage**:
   - Review connection pool settings
   - Check for memory leaks
   - Monitor garbage collection

3. **Performance Issues**:
   - Enable query logging
   - Review database indexes
   - Monitor resource usage

### Getting Help

- Check the [documentation](docs/)
- Review [common issues](docs/troubleshooting.md)
- Submit [bug reports](issues/)
- Join our [community discussions](discussions/)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.