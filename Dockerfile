# AIRIS APM Dockerfile - Multi-stage build for production optimization

# Stage 1: Build stage for dependencies
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Development stage
FROM node:18-alpine AS development

WORKDIR /app

# Install system dependencies for APM monitoring
RUN apk add --no-cache \
    openjdk11-jre-headless \
    curl \
    netcat-openbsd \
    procps \
    htop \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p /app/logs /app/apm/agents /app/apm/profiles /app/apm/reports

# Set permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose APM specific ports
EXPOSE 3000 8080 8081 9999

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Default command for development
CMD ["npm", "run", "dev"]

# Stage 3: Production stage  
FROM node:18-alpine AS production

WORKDIR /app

# Install system dependencies for APM monitoring
RUN apk add --no-cache \
    openjdk11-jre-headless \
    curl \
    netcat-openbsd \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built dependencies from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create required directories with proper permissions
RUN mkdir -p /app/logs /app/apm/agents /app/apm/profiles /app/apm/reports && \
    chown -R nodejs:nodejs /app

# Set Java environment variables for APM
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk
ENV PATH="$JAVA_HOME/bin:$PATH"

# APM specific environment variables
ENV NODE_ENV=production
ENV APM_AGENT_ENABLED=true
ENV APM_PROFILER_ENABLED=true
ENV APM_JDBC_MONITORING=true
ENV APM_JVM_MONITORING=true

# Switch to non-root user
USER nodejs

# Expose APM specific ports
EXPOSE 3000 8080 8081 9999

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Production command
CMD ["node", "src/index.js"]

# Stage 4: APM Agent specific stage
FROM production AS apm-agent

# Additional APM agent specific configurations
ENV APM_AGENT_MODE=standalone
ENV APM_UDP_BUFFER_SIZE=8192
ENV APM_SAMPLING_RATE=100

# Start APM agent
CMD ["node", "src/apm/agent.js"]

# Stage 5: APM Profiler specific stage  
FROM production AS apm-profiler

# Additional profiler specific configurations
ENV APM_PROFILER_INTERVAL=30000
ENV APM_HEAP_DUMP_INTERVAL=300000
ENV APM_CALL_STACK_DEPTH=50

# Start APM profiler
CMD ["node", "src/apm/profiler.js"]