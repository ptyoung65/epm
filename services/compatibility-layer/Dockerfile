# Use Node.js 18 Alpine as base image
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies needed for compilation
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development

# Install all dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3100

# Start development server
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build

# Install all dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Set NODE_ENV
ENV NODE_ENV=production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S airis -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from build stage
COPY --from=build --chown=airis:nodejs /app/dist ./dist

# Copy environment files if they exist
COPY --chown=airis:nodejs .env* ./

# Create logs directory
RUN mkdir -p logs && chown -R airis:nodejs logs

# Switch to non-root user
USER airis

# Expose port
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3100/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]

# Labels for better container management
LABEL maintainer="AIRIS EPM Team <support@airis-epm.com>"
LABEL description="AIRIS APM to EPM Compatibility Layer"
LABEL version="1.0.0"
LABEL service="compatibility-layer"
