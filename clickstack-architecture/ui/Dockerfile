FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY korean-hyperdx-dashboard/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY korean-hyperdx-dashboard/ ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:1.25-alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]