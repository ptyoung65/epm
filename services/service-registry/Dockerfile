FROM node:18-alpine

WORKDIR /app

COPY service-registry/package*.json ./
RUN npm install --only=production

COPY service-registry/src/ ./src/
COPY common/ ./common/

EXPOSE 8500

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8500/health || exit 1

USER node

CMD ["node", "src/index.js"]