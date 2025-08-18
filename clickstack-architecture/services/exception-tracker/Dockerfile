FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 애플리케이션 소스 복사
COPY src/ ./src/

# 로그 디렉토리 생성
RUN mkdir -p ./logs

# 비루트 사용자 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S exceptiontracker -u 1001

# 권한 설정
RUN chown -R exceptiontracker:nodejs /app
USER exceptiontracker

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
  const options = { hostname: 'localhost', port: 3010, path: '/health', timeout: 2000 }; \
  const req = http.request(options, (res) => { \
    if (res.statusCode === 200) { console.log('healthy'); process.exit(0); } \
    else { console.log('unhealthy'); process.exit(1); } \
  }); \
  req.on('error', () => { console.log('unhealthy'); process.exit(1); }); \
  req.end();"

# 포트 노출
EXPOSE 3010

# 환경변수 설정
ENV NODE_ENV=production
ENV PORT=3010
ENV LOG_LEVEL=info

# 서비스 시작
CMD ["node", "src/index.js"]