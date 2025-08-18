FROM node:20-alpine

WORKDIR /app

# Install Python and build dependencies for TensorFlow.js  
RUN apk add --no-cache python3 py3-pip make g++ curl gcompat libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src/ ./src/
COPY . .

# Create directories
RUN mkdir -p /app/models /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the service
CMD ["npm", "start"]