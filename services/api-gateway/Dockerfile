FROM node:18-alpine

WORKDIR /app

COPY api-gateway/package*.json ./
RUN npm install --only=production

COPY api-gateway/src/ ./src/
COPY common/ ./common/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

USER node

CMD ["node", "src/index.js"]