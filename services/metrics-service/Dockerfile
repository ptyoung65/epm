FROM node:18-alpine

WORKDIR /app

COPY metrics-service/package*.json ./
RUN npm install --only=production

COPY metrics-service/src/ ./src/
COPY common/ ./common/

EXPOSE 3021

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3021/health || exit 1

USER node

CMD ["node", "src/index.js"]