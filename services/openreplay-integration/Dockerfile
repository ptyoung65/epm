# OpenReplay Integration Service
FROM node:20-alpine

# 메타데이터
LABEL maintainer="AIRIS EPM Team <dev-team@airis-epm.com>"
LABEL description="AIRIS EPM OpenReplay Integration Service"
LABEL version="1.0.0"

# 시스템 패키지 설치
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tzdata

# 시간대 설정
ENV TZ=Asia/Seoul

# 비루트 사용자 생성
RUN addgroup -g 1001 -S nodejs && \
    adduser -S openreplay -u 1001

# 작업 디렉터리 설정
WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 소스 코드 복사
COPY src/ ./src/

# 필요한 디렉터리 생성
RUN mkdir -p logs sessions && \
    chown -R openreplay:nodejs /app

# 환경변수 설정
ENV NODE_ENV=production
ENV PORT=3000

# 포트 노출
EXPOSE 3000

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 사용자 변경
USER openreplay

# 애플리케이션 시작 명령
CMD ["node", "src/index.js"]