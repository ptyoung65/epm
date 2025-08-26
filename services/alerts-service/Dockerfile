FROM node:18-alpine

WORKDIR /app

COPY alerts-service/package*.json ./
RUN npm install --only=production

COPY alerts-service/src/ ./src/
COPY common/ ./common/

EXPOSE 3024

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3024/health || exit 1

USER node

CMD ["node", "src/index.js"]