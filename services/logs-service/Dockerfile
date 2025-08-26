FROM node:18-alpine

WORKDIR /app

COPY logs-service/package*.json ./
RUN npm install --only=production

COPY logs-service/src/ ./src/
COPY common/ ./common/

EXPOSE 3022

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3022/health || exit 1

USER node

CMD ["node", "src/index.js"]