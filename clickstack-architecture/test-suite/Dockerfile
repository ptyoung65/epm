# AIRIS-MON 테스트 스위트 Docker 컨테이너
FROM node:18-alpine

# 메타데이터
LABEL maintainer="AIRIS-MON Team"
LABEL description="AIRIS-MON Complete Feature Test Suite - Korean HyperDX Style"
LABEL version="1.0.0"

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치
RUN apk add --no-cache \
    curl \
    jq \
    bash \
    tzdata \
    && cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
    && echo "Asia/Seoul" > /etc/timezone

# 한국어 로케일 설정
ENV LANG=ko_KR.UTF-8
ENV LC_ALL=ko_KR.UTF-8
ENV TZ=Asia/Seoul

# Node.js 애플리케이션 설정
ENV NODE_ENV=production
ENV TEST_PORT=3100
ENV LOG_LEVEL=info

# package.json 복사
COPY package.json ./

# 의존성 설치 (package-lock.json이 없으므로 npm install 사용)
RUN npm install --production && \
    npm cache clean --force

# 애플리케이션 코드 복사
COPY src/ ./src/
COPY README.md ./

# 권한 설정
RUN chown -R node:node /app
USER node

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${TEST_PORT}/api/status || exit 1

# 포트 노출
EXPOSE 3100

# 시작 명령
CMD ["node", "src/app.js"]