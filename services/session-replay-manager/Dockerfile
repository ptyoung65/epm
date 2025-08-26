# AIRIS EPM Session Replay Manager - 통합 OpenReplay 관리자 서비스
# Multi-stage build for production optimization

# Stage 1: Build stage
FROM node:20-alpine AS builder

# 작업 디렉터리 설정
WORKDIR /app

# 시스템 패키지 설치
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci --only=production && npm cache clean --force

# 개발 의존성 설치 (빌드용)
RUN npm ci

# 소스 코드 복사
COPY src/ ./src/

# TypeScript 빌드
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine AS production

# 메타데이터 설정
LABEL maintainer="AIRIS EPM Team <dev-team@airis-epm.com>"
LABEL description="AIRIS EPM Session Replay Manager with OpenReplay Integration"
LABEL version="1.0.0"

# 시스템 패키지 설치 (런타임 필요)
RUN apk add --no-cache \
    curl \
    postgresql-client \
    redis \
    ca-certificates \
    tzdata

# 시간대 설정
ENV TZ=Asia/Seoul

# 비루트 사용자 생성
RUN addgroup -g 1001 -S nodejs && \
    adduser -S airisuser -u 1001

# 작업 디렉터리 설정
WORKDIR /app

# 필요한 디렉터리 생성
RUN mkdir -p logs storage uploads temp && \
    chown -R airisuser:nodejs /app

# 빌드된 파일과 의존성 복사
COPY --from=builder --chown=airisuser:nodejs /app/dist ./dist
COPY --from=builder --chown=airisuser:nodejs /app/node_modules ./node_modules
COPY --chown=airisuser:nodejs package*.json ./

# Public 파일 복사 (있는 경우)
COPY --chown=airisuser:nodejs src/public ./dist/public 2>/dev/null || true

# 환경변수 설정
ENV NODE_ENV=production
ENV PORT=3004
ENV ADMIN_PORT=3024

# 포트 노출
EXPOSE 3004 3024

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3004/health || exit 1

# 사용자 변경
USER airisuser

# 애플리케이션 시작 명령
CMD ["node", "dist/index.js"]

# Volume for persistent data
VOLUME ["/app/storage", "/app/logs"]

# Build arguments for flexibility
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.version=$VERSION \
      org.label-schema.schema-version="1.0"