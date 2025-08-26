# Dockerfile for AIRIS EPM ETL Pipeline Service
FROM node:18-alpine

# Install dependencies for node-gyp
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY etl-pipeline/package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application files
COPY etl-pipeline/src/ ./src/
COPY common/ ./common/

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3020

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3020/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start the service
CMD ["node", "src/index.js"]