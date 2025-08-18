#!/bin/bash

# AIRIS-MON 원격 서버 모니터링 설정 스크립트
# 작성자: AIRIS-MON Development Team
# 버전: 1.0.0
# 설명: 원격 Linux 서버에 AIRIS-MON 모니터링 에이전트 및 OpenTelemetry 설정

set -euo pipefail

# =============================================================================
# 상수 및 설정
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly REMOTE_SETUP_DIR="/tmp/airis-mon-setup"
readonly OTEL_VERSION="1.32.0"
readonly COLLECTOR_VERSION="0.91.0"

# 색상 코드
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m'

# =============================================================================
# 유틸리티 함수
# =============================================================================

log_info() {
    echo -e "${GREEN}[REMOTE-SETUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[REMOTE-SETUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[REMOTE-SETUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_success() {
    echo -e "${GREEN}[REMOTE-SETUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - ✅ $1"
}

print_setup_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║   🌐 AIRIS-MON 원격 서버 모니터링 설정 🌐                ║
    ║                                                          ║
    ║   • OpenTelemetry Collector 설치                        ║
    ║   • 애플리케이션 에이전트 설정                           ║
    ║   • 데이터베이스 모니터링 설정                           ║
    ║   • 웹서버/WAS 모니터링 설정                            ║
    ║   • 자동 설정 및 검증                                   ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# =============================================================================
# 원격 서버 연결 확인
# =============================================================================

check_remote_connection() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    
    log_info "원격 서버 연결을 확인합니다: $user@$host:$port"
    
    local ssh_cmd="ssh -o ConnectTimeout=10 -o BatchMode=yes"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    if $ssh_cmd "echo 'Connection test successful'" > /dev/null 2>&1; then
        log_success "원격 서버 연결 성공"
        return 0
    else
        log_error "원격 서버 연결 실패"
        return 1
    fi
}

get_remote_info() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    
    log_info "원격 서버 정보를 수집합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    echo -e "${WHITE}=== 원격 서버 정보 ===${NC}"
    
    # OS 정보
    local os_info=$($ssh_cmd "cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '\"'" 2>/dev/null || echo "Unknown")
    echo -e "OS: ${CYAN}$os_info${NC}"
    
    # 아키텍처
    local arch=$($ssh_cmd "uname -m" 2>/dev/null || echo "Unknown")
    echo -e "Architecture: ${CYAN}$arch${NC}"
    
    # 메모리
    local memory=$($ssh_cmd "free -h | grep '^Mem:' | awk '{print \$2}'" 2>/dev/null || echo "Unknown")
    echo -e "Memory: ${CYAN}$memory${NC}"
    
    # CPU
    local cpu_count=$($ssh_cmd "nproc" 2>/dev/null || echo "Unknown")
    echo -e "CPU Cores: ${CYAN}$cpu_count${NC}"
    
    # 디스크
    local disk=$($ssh_cmd "df -h / | tail -1 | awk '{print \$2 \" (\" \$5 \" used)\"}'" 2>/dev/null || echo "Unknown")
    echo -e "Root Disk: ${CYAN}$disk${NC}"
    
    echo
}

# =============================================================================
# OpenTelemetry Collector 설치
# =============================================================================

install_otel_collector() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    local airis_host="${5:-localhost}"
    local airis_port="${6:-4317}"
    
    log_info "OpenTelemetry Collector를 설치합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    # 설치 스크립트 생성
    local install_script=$(cat << 'SCRIPT_EOF'
#!/bin/bash
set -euo pipefail

OTEL_VERSION="0.91.0"
COLLECTOR_DIR="/opt/otelcol"
SERVICE_USER="otelcol"

# 사용자 생성
if ! id "$SERVICE_USER" &>/dev/null; then
    sudo useradd --system --shell /bin/false --home-dir "$COLLECTOR_DIR" --create-home "$SERVICE_USER"
fi

# 디렉토리 생성
sudo mkdir -p "$COLLECTOR_DIR"/{config,data,logs}
sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$COLLECTOR_DIR"

# 아키텍처 감지
ARCH=$(uname -m)
case $ARCH in
    x86_64) OTEL_ARCH="amd64" ;;
    aarch64) OTEL_ARCH="arm64" ;;
    armv7l) OTEL_ARCH="arm" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# OpenTelemetry Collector 다운로드
DOWNLOAD_URL="https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${OTEL_VERSION}/otelcol_${OTEL_VERSION}_linux_${OTEL_ARCH}.tar.gz"

cd /tmp
curl -L -o otelcol.tar.gz "$DOWNLOAD_URL"
tar -xzf otelcol.tar.gz
sudo mv otelcol "$COLLECTOR_DIR/bin/"
sudo chmod +x "$COLLECTOR_DIR/bin/otelcol"
sudo chown "$SERVICE_USER:$SERVICE_USER" "$COLLECTOR_DIR/bin/otelcol"

echo "OpenTelemetry Collector 설치 완료"
SCRIPT_EOF
)
    
    # 원격 서버에서 설치 실행
    echo "$install_script" | $ssh_cmd "cat > /tmp/install_otel.sh && chmod +x /tmp/install_otel.sh && sudo /tmp/install_otel.sh"
    
    # 설정 파일 생성
    create_otel_config "$host" "$user" "$port" "$key_file" "$airis_host" "$airis_port"
    
    # systemd 서비스 생성
    create_otel_service "$host" "$user" "$port" "$key_file"
    
    log_success "OpenTelemetry Collector 설치 완료"
}

create_otel_config() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    local airis_host="${5:-localhost}"
    local airis_port="${6:-4317}"
    
    log_info "OpenTelemetry Collector 설정을 생성합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    # 설정 파일 내용
    local config_content=$(cat << EOF
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
  
  prometheus:
    config:
      scrape_configs:
        - job_name: 'node-exporter'
          static_configs:
            - targets: ['localhost:9100']
        - job_name: 'application'
          static_configs:
            - targets: ['localhost:8080']
  
  filelog:
    include:
      - /var/log/*.log
      - /var/log/*/*.log
    exclude:
      - /var/log/otelcol/*.log
    
  hostmetrics:
    collection_interval: 30s
    scrapers:
      cpu:
        metrics:
          system.cpu.utilization:
            enabled: true
      disk:
      filesystem:
      load:
      memory:
      network:
      process:

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024
  
  memory_limiter:
    limit_mib: 512
  
  resource:
    attributes:
      - key: service.name
        value: "airis-agent"
        action: upsert
      - key: service.version
        value: "1.0.0"
        action: upsert
      - key: deployment.environment
        value: "production"
        action: upsert
      - key: host.name
        from_attribute: host.name
        action: upsert

exporters:
  otlp/airis:
    endpoint: "http://${airis_host}:${airis_port}"
    tls:
      insecure: true
    sending_queue:
      enabled: true
      num_consumers: 4
      queue_size: 100
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 300s
  
  logging:
    loglevel: info
  
  file:
    path: /opt/otelcol/data/traces.json

extensions:
  health_check:
    endpoint: 0.0.0.0:13133
  
  pprof:
    endpoint: 0.0.0.0:1777
  
  zpages:
    endpoint: 0.0.0.0:55679

service:
  extensions: [health_check, pprof, zpages]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [otlp/airis, logging]
    
    metrics:
      receivers: [otlp, prometheus, hostmetrics]
      processors: [memory_limiter, batch, resource]
      exporters: [otlp/airis, logging]
    
    logs:
      receivers: [otlp, filelog]
      processors: [memory_limiter, batch, resource]
      exporters: [otlp/airis, logging]
  
  telemetry:
    logs:
      level: "info"
    metrics:
      address: 0.0.0.0:8888
EOF
)
    
    # 설정 파일 전송
    echo "$config_content" | $ssh_cmd "sudo tee /opt/otelcol/config/config.yaml > /dev/null"
    $ssh_cmd "sudo chown otelcol:otelcol /opt/otelcol/config/config.yaml"
    
    log_success "OpenTelemetry Collector 설정 파일 생성 완료"
}

create_otel_service() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    
    log_info "OpenTelemetry Collector systemd 서비스를 생성합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    # systemd 서비스 파일
    local service_content=$(cat << 'EOF'
[Unit]
Description=OpenTelemetry Collector
Documentation=https://opentelemetry.io/
After=network.target

[Service]
Type=simple
User=otelcol
Group=otelcol
ExecStart=/opt/otelcol/bin/otelcol --config=/opt/otelcol/config/config.yaml
ExecReload=/bin/kill -HUP $MAINPID
KillMode=mixed
KillSignal=SIGTERM
Restart=always
RestartSec=10s
StartLimitInterval=60s
StartLimitBurst=3

# 보안 설정
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/otelcol
RemoveIPC=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true

# 리소스 제한
LimitNOFILE=65536
LimitNPROC=32768

# 로그 설정
StandardOutput=journal
StandardError=journal
SyslogIdentifier=otelcol

[Install]
WantedBy=multi-user.target
EOF
)
    
    # 서비스 파일 생성 및 등록
    echo "$service_content" | $ssh_cmd "sudo tee /etc/systemd/system/otelcol.service > /dev/null"
    $ssh_cmd "sudo systemctl daemon-reload"
    $ssh_cmd "sudo systemctl enable otelcol"
    
    log_success "OpenTelemetry Collector 서비스 생성 완료"
}

# =============================================================================
# 애플리케이션별 모니터링 설정
# =============================================================================

setup_node_monitoring() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    local app_path="${5:-/opt/app}"
    
    log_info "Node.js 애플리케이션 모니터링을 설정합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    # Node.js OpenTelemetry 설정 스크립트
    local node_setup=$(cat << 'SCRIPT_EOF'
#!/bin/bash
set -euo pipefail

APP_PATH="$1"
cd "$APP_PATH"

# OpenTelemetry 패키지 설치
npm install --save \
    @opentelemetry/api \
    @opentelemetry/sdk-node \
    @opentelemetry/auto-instrumentations-node \
    @opentelemetry/exporter-otlp-grpc \
    @opentelemetry/instrumentation

# Instrumentation 파일 생성
cat > instrumentation.js << 'INST_EOF'
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'nodejs-app',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'production',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4317/v1/traces',
  }),
  metricExporter: new OTLPMetricExporter({
    url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4317/v1/metrics',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OpenTelemetry SDK terminated'))
    .catch((error) => console.log('Error terminating OpenTelemetry SDK', error))
    .finally(() => process.exit(0));
});
INST_EOF

echo "Node.js OpenTelemetry 설정 완료"
SCRIPT_EOF
)
    
    echo "$node_setup" | $ssh_cmd "cat > /tmp/setup_node_monitoring.sh && chmod +x /tmp/setup_node_monitoring.sh && /tmp/setup_node_monitoring.sh '$app_path'"
    
    log_success "Node.js 애플리케이션 모니터링 설정 완료"
}

setup_java_monitoring() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    local app_path="${5:-/opt/app}"
    
    log_info "Java 애플리케이션 모니터링을 설정합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    # Java OpenTelemetry 에이전트 설치
    local java_setup=$(cat << 'SCRIPT_EOF'
#!/bin/bash
set -euo pipefail

AGENT_DIR="/opt/otel-agent"
AGENT_VERSION="1.32.0"

# 디렉토리 생성
sudo mkdir -p "$AGENT_DIR"

# OpenTelemetry Java Agent 다운로드
curl -L -o "$AGENT_DIR/opentelemetry-javaagent.jar" \
    "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${AGENT_VERSION}/opentelemetry-javaagent.jar"

# 권한 설정
sudo chmod 644 "$AGENT_DIR/opentelemetry-javaagent.jar"

# 환경 변수 설정 파일 생성
cat > "$AGENT_DIR/otel-java.env" << 'ENV_EOF'
OTEL_SERVICE_NAME=java-app
OTEL_SERVICE_VERSION=1.0.0
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_PROPAGATORS=tracecontext,baggage
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
ENV_EOF

echo "Java OpenTelemetry 에이전트 설치 완료"
echo "애플리케이션 시작 시 다음 옵션을 추가하세요:"
echo "-javaagent:$AGENT_DIR/opentelemetry-javaagent.jar"
SCRIPT_EOF
)
    
    echo "$java_setup" | $ssh_cmd "cat > /tmp/setup_java_monitoring.sh && chmod +x /tmp/setup_java_monitoring.sh && sudo /tmp/setup_java_monitoring.sh"
    
    log_success "Java 애플리케이션 모니터링 설정 완료"
}

setup_nginx_monitoring() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    
    log_info "Nginx 웹서버 모니터링을 설정합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    # Nginx 모니터링 설정
    local nginx_setup=$(cat << 'SCRIPT_EOF'
#!/bin/bash
set -euo pipefail

# Nginx status 모듈 활성화 확인
if ! nginx -V 2>&1 | grep -q "with-http_stub_status_module"; then
    echo "Warning: Nginx status module이 활성화되지 않았습니다."
fi

# Nginx status 설정 추가
cat > /etc/nginx/conf.d/status.conf << 'NGINX_EOF'
server {
    listen 8080;
    server_name localhost;
    
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
NGINX_EOF

# Nginx 로그 포맷 수정 (JSON 형태)
NGINX_CONF="/etc/nginx/nginx.conf"
if ! grep -q "log_format json" "$NGINX_CONF"; then
    sed -i '/http {/a\
    log_format json escape=json '\''{\
        "time_local": "$time_local",\
        "remote_addr": "$remote_addr",\
        "remote_user": "$remote_user",\
        "request": "$request",\
        "status": "$status",\
        "body_bytes_sent": "$body_bytes_sent",\
        "http_referer": "$http_referer",\
        "http_user_agent": "$http_user_agent",\
        "http_x_forwarded_for": "$http_x_forwarded_for",\
        "request_time": "$request_time",\
        "upstream_response_time": "$upstream_response_time"\
    }'\'';' "$NGINX_CONF"
    
    # 기본 로그 포맷을 JSON으로 변경
    sed -i 's/access_log .*access.log.*;/access_log \/var\/log\/nginx\/access.log json;/' "$NGINX_CONF"
fi

# Nginx 설정 테스트 및 재시작
nginx -t && systemctl reload nginx

echo "Nginx 모니터링 설정 완료"
SCRIPT_EOF
)
    
    echo "$nginx_setup" | $ssh_cmd "sudo bash -s"
    
    log_success "Nginx 웹서버 모니터링 설정 완료"
}

setup_mysql_monitoring() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    local db_user="${5:-monitor}"
    local db_password="${6:-$(openssl rand -base64 32)}"
    
    log_info "MySQL 데이터베이스 모니터링을 설정합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    # MySQL 모니터링 설정
    local mysql_setup=$(cat << SCRIPT_EOF
#!/bin/bash
set -euo pipefail

DB_USER="$1"
DB_PASSWORD="$2"

# MySQL 모니터링 사용자 생성
mysql -u root -p << 'SQL_EOF'
CREATE USER IF NOT EXISTS '\${DB_USER}'@'localhost' IDENTIFIED BY '\${DB_PASSWORD}';
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO '\${DB_USER}'@'localhost';
GRANT SELECT ON performance_schema.* TO '\${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL_EOF

# MySQL Exporter 다운로드 및 설치
EXPORTER_VERSION="0.14.0"
EXPORTER_DIR="/opt/mysql-exporter"

sudo mkdir -p "\$EXPORTER_DIR"
cd /tmp

wget "https://github.com/prometheus/mysqld_exporter/releases/download/v\${EXPORTER_VERSION}/mysqld_exporter-\${EXPORTER_VERSION}.linux-amd64.tar.gz"
tar -xzf "mysqld_exporter-\${EXPORTER_VERSION}.linux-amd64.tar.gz"
sudo mv "mysqld_exporter-\${EXPORTER_VERSION}.linux-amd64/mysqld_exporter" "\$EXPORTER_DIR/"
sudo chmod +x "\$EXPORTER_DIR/mysqld_exporter"

# 설정 파일 생성
cat > "\$EXPORTER_DIR/.my.cnf" << CNF_EOF
[client]
user = \${DB_USER}
password = \${DB_PASSWORD}
host = localhost
port = 3306
CNF_EOF

sudo chmod 600 "\$EXPORTER_DIR/.my.cnf"

# systemd 서비스 생성
cat > /etc/systemd/system/mysql-exporter.service << 'SERVICE_EOF'
[Unit]
Description=MySQL Exporter
After=network.target mysql.service

[Service]
Type=simple
User=nobody
ExecStart=/opt/mysql-exporter/mysqld_exporter --config.my-cnf=/opt/mysql-exporter/.my.cnf --web.listen-address=0.0.0.0:9104
Restart=always

[Install]
WantedBy=multi-user.target
SERVICE_EOF

sudo systemctl daemon-reload
sudo systemctl enable mysql-exporter
sudo systemctl start mysql-exporter

echo "MySQL 모니터링 설정 완료 (포트: 9104)"
SCRIPT_EOF
)
    
    echo "$mysql_setup" | $ssh_cmd "sudo bash -s '$db_user' '$db_password'"
    
    log_success "MySQL 데이터베이스 모니터링 설정 완료"
    log_info "MySQL 모니터링 사용자: $db_user"
    log_info "MySQL 모니터링 비밀번호: $db_password"
}

# =============================================================================
# 시스템 모니터링 도구 설치
# =============================================================================

install_node_exporter() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    
    log_info "Node Exporter를 설치합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    local node_exporter_setup=$(cat << 'SCRIPT_EOF'
#!/bin/bash
set -euo pipefail

EXPORTER_VERSION="1.7.0"
EXPORTER_DIR="/opt/node-exporter"

# 사용자 생성
sudo useradd --system --shell /bin/false --home-dir /nonexistent node_exporter 2>/dev/null || true

# 디렉토리 생성
sudo mkdir -p "$EXPORTER_DIR"

# 아키텍처 감지
ARCH=$(uname -m)
case $ARCH in
    x86_64) NODE_ARCH="amd64" ;;
    aarch64) NODE_ARCH="arm64" ;;
    armv7l) NODE_ARCH="armv7" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Node Exporter 다운로드
cd /tmp
wget "https://github.com/prometheus/node_exporter/releases/download/v${EXPORTER_VERSION}/node_exporter-${EXPORTER_VERSION}.linux-${NODE_ARCH}.tar.gz"
tar -xzf "node_exporter-${EXPORTER_VERSION}.linux-${NODE_ARCH}.tar.gz"
sudo mv "node_exporter-${EXPORTER_VERSION}.linux-${NODE_ARCH}/node_exporter" "$EXPORTER_DIR/"
sudo chmod +x "$EXPORTER_DIR/node_exporter"
sudo chown node_exporter:node_exporter "$EXPORTER_DIR/node_exporter"

# systemd 서비스 생성
cat > /etc/systemd/system/node-exporter.service << 'SERVICE_EOF'
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
User=node_exporter
Group=node_exporter
ExecStart=/opt/node-exporter/node_exporter --web.listen-address=0.0.0.0:9100
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE_EOF

sudo systemctl daemon-reload
sudo systemctl enable node-exporter
sudo systemctl start node-exporter

echo "Node Exporter 설치 완료 (포트: 9100)"
SCRIPT_EOF
)
    
    echo "$node_exporter_setup" | $ssh_cmd "sudo bash -s"
    
    log_success "Node Exporter 설치 완료"
}

# =============================================================================
# 방화벽 및 보안 설정
# =============================================================================

setup_firewall() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    local airis_host="${5:-}"
    
    log_info "방화벽 설정을 구성합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    local firewall_setup=$(cat << SCRIPT_EOF
#!/bin/bash
set -euo pipefail

AIRIS_HOST="\$1"

# ufw가 설치되어 있는지 확인
if command -v ufw > /dev/null; then
    # OpenTelemetry Collector 포트
    sudo ufw allow 4317/tcp comment "OTEL GRPC"
    sudo ufw allow 4318/tcp comment "OTEL HTTP"
    
    # 모니터링 포트
    sudo ufw allow 9100/tcp comment "Node Exporter"
    sudo ufw allow 9104/tcp comment "MySQL Exporter"
    sudo ufw allow 8080/tcp comment "Nginx Status"
    
    # Health Check 포트
    sudo ufw allow 13133/tcp comment "OTEL Health Check"
    
    # AIRIS-MON 서버에서의 접근 허용
    if [[ -n "\$AIRIS_HOST" ]]; then
        sudo ufw allow from "\$AIRIS_HOST" to any port 4317
        sudo ufw allow from "\$AIRIS_HOST" to any port 4318
        sudo ufw allow from "\$AIRIS_HOST" to any port 9100
        sudo ufw allow from "\$AIRIS_HOST" to any port 9104
        sudo ufw allow from "\$AIRIS_HOST" to any port 13133
    fi
    
    echo "ufw 방화벽 규칙 설정 완료"
elif command -v firewall-cmd > /dev/null; then
    # firewalld 설정
    sudo firewall-cmd --permanent --add-port=4317/tcp
    sudo firewall-cmd --permanent --add-port=4318/tcp
    sudo firewall-cmd --permanent --add-port=9100/tcp
    sudo firewall-cmd --permanent --add-port=9104/tcp
    sudo firewall-cmd --permanent --add-port=8080/tcp
    sudo firewall-cmd --permanent --add-port=13133/tcp
    
    if [[ -n "\$AIRIS_HOST" ]]; then
        sudo firewall-cmd --permanent --add-rich-rule="rule family=\"ipv4\" source address=\"\$AIRIS_HOST\" port protocol=\"tcp\" port=\"4317\" accept"
        sudo firewall-cmd --permanent --add-rich-rule="rule family=\"ipv4\" source address=\"\$AIRIS_HOST\" port protocol=\"tcp\" port=\"4318\" accept"
    fi
    
    sudo firewall-cmd --reload
    echo "firewalld 방화벽 규칙 설정 완료"
else
    echo "방화벽 도구를 찾을 수 없습니다 (ufw 또는 firewalld 필요)"
fi
SCRIPT_EOF
)
    
    echo "$firewall_setup" | $ssh_cmd "bash -s '$airis_host'"
    
    log_success "방화벽 설정 완료"
}

# =============================================================================
# 설정 검증 및 테스트
# =============================================================================

validate_setup() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    
    log_info "모니터링 설정을 검증합니다..."
    
    local ssh_cmd="ssh"
    if [[ -n "$key_file" ]]; then
        ssh_cmd="$ssh_cmd -i $key_file"
    fi
    ssh_cmd="$ssh_cmd -p $port $user@$host"
    
    echo -e "${WHITE}=== 설정 검증 결과 ===${NC}"
    
    # OpenTelemetry Collector 상태
    if $ssh_cmd "sudo systemctl is-active otelcol" &>/dev/null; then
        echo -e "OpenTelemetry Collector: ${GREEN}실행 중${NC}"
    else
        echo -e "OpenTelemetry Collector: ${RED}중지됨${NC}"
    fi
    
    # Node Exporter 상태
    if $ssh_cmd "sudo systemctl is-active node-exporter" &>/dev/null; then
        echo -e "Node Exporter: ${GREEN}실행 중${NC}"
    else
        echo -e "Node Exporter: ${RED}중지됨${NC}"
    fi
    
    # 포트 확인
    local ports=("4317" "4318" "9100" "13133")
    for port_num in "${ports[@]}"; do
        if $ssh_cmd "netstat -tuln | grep :$port_num" &>/dev/null; then
            echo -e "포트 $port_num: ${GREEN}수신 대기 중${NC}"
        else
            echo -e "포트 $port_num: ${RED}수신 대기하지 않음${NC}"
        fi
    done
    
    # Health Check
    if $ssh_cmd "curl -f -s http://localhost:13133/health" &>/dev/null; then
        echo -e "Health Check: ${GREEN}정상${NC}"
    else
        echo -e "Health Check: ${RED}실패${NC}"
    fi
    
    log_success "설정 검증 완료"
}

# =============================================================================
# 전체 설치 프로세스
# =============================================================================

install_full_monitoring() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key_file="${4:-}"
    local airis_host="${5:-localhost}"
    local airis_port="${6:-4317}"
    local components="${7:-otel,node,nginx}"
    
    print_setup_banner
    
    log_info "원격 서버 모니터링 설치를 시작합니다..."
    log_info "대상 서버: $user@$host:$port"
    log_info "AIRIS-MON 서버: $airis_host:$airis_port"
    log_info "설치 컴포넌트: $components"
    
    # 연결 확인
    if ! check_remote_connection "$host" "$user" "$port" "$key_file"; then
        log_error "원격 서버 연결에 실패했습니다."
        return 1
    fi
    
    # 서버 정보 수집
    get_remote_info "$host" "$user" "$port" "$key_file"
    
    # 컴포넌트별 설치
    IFS=',' read -ra COMPONENTS <<< "$components"
    for component in "${COMPONENTS[@]}"; do
        case "$component" in
            "otel")
                install_otel_collector "$host" "$user" "$port" "$key_file" "$airis_host" "$airis_port"
                ;;
            "node")
                install_node_exporter "$host" "$user" "$port" "$key_file"
                ;;
            "nginx")
                setup_nginx_monitoring "$host" "$user" "$port" "$key_file"
                ;;
            "mysql")
                setup_mysql_monitoring "$host" "$user" "$port" "$key_file"
                ;;
            "java")
                setup_java_monitoring "$host" "$user" "$port" "$key_file"
                ;;
            "nodejs")
                setup_node_monitoring "$host" "$user" "$port" "$key_file"
                ;;
            *)
                log_warn "알 수 없는 컴포넌트: $component"
                ;;
        esac
    done
    
    # 방화벽 설정
    setup_firewall "$host" "$user" "$port" "$key_file" "$airis_host"
    
    # 설정 검증
    validate_setup "$host" "$user" "$port" "$key_file"
    
    log_success "원격 서버 모니터링 설치 완료!"
    
    echo
    echo -e "${WHITE}=== 설치 완료 정보 ===${NC}"
    echo -e "모니터링 서버: ${CYAN}$host${NC}"
    echo -e "OpenTelemetry Endpoint: ${CYAN}http://$host:4317${NC}"
    echo -e "Health Check: ${CYAN}http://$host:13133/health${NC}"
    echo -e "Node Exporter: ${CYAN}http://$host:9100/metrics${NC}"
    echo
    echo -e "${YELLOW}다음 단계:${NC}"
    echo -e "1. AIRIS-MON에서 $host:4317을 데이터 소스로 추가"
    echo -e "2. 애플리케이션에 OpenTelemetry 계측 코드 적용"
    echo -e "3. 모니터링 대시보드에서 데이터 확인"
    echo
}

# =============================================================================
# 헬프 함수
# =============================================================================

show_help() {
    echo -e "${WHITE}AIRIS-MON 원격 서버 모니터링 설정 스크립트${NC}"
    echo
    echo -e "${YELLOW}사용법:${NC}"
    echo -e "  $0 <command> [options]"
    echo
    echo -e "${YELLOW}명령어:${NC}"
    echo -e "  ${GREEN}install${NC}       전체 모니터링 스택 설치"
    echo -e "  ${GREEN}otel-only${NC}     OpenTelemetry Collector만 설치"
    echo -e "  ${GREEN}node-only${NC}     Node Exporter만 설치"
    echo -e "  ${GREEN}validate${NC}      설정 검증"
    echo -e "  ${GREEN}info${NC}          원격 서버 정보 확인"
    echo
    echo -e "${YELLOW}옵션:${NC}"
    echo -e "  ${GREEN}-h, --host${NC}         원격 서버 호스트명/IP"
    echo -e "  ${GREEN}-u, --user${NC}         SSH 사용자명"
    echo -e "  ${GREEN}-p, --port${NC}         SSH 포트 (기본값: 22)"
    echo -e "  ${GREEN}-k, --key${NC}          SSH 키 파일 경로"
    echo -e "  ${GREEN}-a, --airis-host${NC}   AIRIS-MON 서버 호스트"
    echo -e "  ${GREEN}-P, --airis-port${NC}   AIRIS-MON 서버 포트 (기본값: 4317)"
    echo -e "  ${GREEN}-c, --components${NC}   설치할 컴포넌트 (otel,node,nginx,mysql,java,nodejs)"
    echo
    echo -e "${YELLOW}예시:${NC}"
    echo -e "  $0 install -h 192.168.1.100 -u ubuntu -k ~/.ssh/id_rsa -a 192.168.1.10"
    echo -e "  $0 otel-only -h server.example.com -u root -a airis.company.com"
    echo -e "  $0 validate -h 192.168.1.100 -u ubuntu"
    echo
}

# =============================================================================
# 메인 실행 로직
# =============================================================================

main() {
    local command="${1:-help}"
    shift || true
    
    local host=""
    local user=""
    local port="22"
    local key_file=""
    local airis_host="localhost"
    local airis_port="4317"
    local components="otel,node"
    
    # 옵션 파싱
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--host)
                host="$2"
                shift 2
                ;;
            -u|--user)
                user="$2"
                shift 2
                ;;
            -p|--port)
                port="$2"
                shift 2
                ;;
            -k|--key)
                key_file="$2"
                shift 2
                ;;
            -a|--airis-host)
                airis_host="$2"
                shift 2
                ;;
            -P|--airis-port)
                airis_port="$2"
                shift 2
                ;;
            -c|--components)
                components="$2"
                shift 2
                ;;
            *)
                log_error "알 수 없는 옵션: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 필수 매개변수 확인
    if [[ "$command" != "help" ]] && [[ -z "$host" || -z "$user" ]]; then
        log_error "호스트(-h)와 사용자(-u)는 필수입니다."
        show_help
        exit 1
    fi
    
    case "$command" in
        "install")
            install_full_monitoring "$host" "$user" "$port" "$key_file" "$airis_host" "$airis_port" "$components"
            ;;
        "otel-only")
            install_otel_collector "$host" "$user" "$port" "$key_file" "$airis_host" "$airis_port"
            ;;
        "node-only")
            install_node_exporter "$host" "$user" "$port" "$key_file"
            ;;
        "validate")
            validate_setup "$host" "$user" "$port" "$key_file"
            ;;
        "info")
            get_remote_info "$host" "$user" "$port" "$key_file"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "알 수 없는 명령어: $command"
            show_help
            exit 1
            ;;
    esac
}

# 스크립트가 직접 실행되었을 때만 main 함수 호출
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi