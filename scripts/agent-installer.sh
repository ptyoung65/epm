#!/bin/bash

# AIRIS-MON 에이전트 설치 스크립트
# 작성자: AIRIS-MON Development Team
# 버전: 1.0.0
# 설명: 다양한 서버 타입(App/DB/Web/WAS)에 맞는 모니터링 에이전트 설치

set -euo pipefail

# =============================================================================
# 상수 및 설정
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly AGENT_BASE_DIR="/opt/airis-agents"
readonly CONFIG_DIR="/etc/airis-mon"

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
    echo -e "${GREEN}[AGENT-INSTALLER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[AGENT-INSTALLER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[AGENT-INSTALLER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_success() {
    echo -e "${GREEN}[AGENT-INSTALLER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - ✅ $1"
}

print_agent_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║   🤖 AIRIS-MON 에이전트 자동 설치 도구 🤖                ║
    ║                                                          ║
    ║   • 애플리케이션 서버 에이전트                           ║
    ║   • 데이터베이스 모니터링 에이전트                       ║
    ║   • 웹서버/WAS 모니터링 에이전트                        ║
    ║   • 시스템 메트릭 수집 에이전트                          ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

detect_system_info() {
    log_info "시스템 정보를 수집합니다..."
    
    echo -e "${WHITE}=== 시스템 정보 ===${NC}"
    
    # OS 정보
    if [[ -f /etc/os-release ]]; then
        local os_info=$(grep PRETTY_NAME /etc/os-release | cut -d'=' -f2 | tr -d '"')
        echo -e "OS: ${CYAN}$os_info${NC}"
    fi
    
    # 아키텍처
    local arch=$(uname -m)
    echo -e "Architecture: ${CYAN}$arch${NC}"
    
    # 메모리
    local memory=$(free -h | grep '^Mem:' | awk '{print $2}')
    echo -e "Memory: ${CYAN}$memory${NC}"
    
    # CPU
    local cpu_count=$(nproc)
    echo -e "CPU Cores: ${CYAN}$cpu_count${NC}"
    
    # 실행 중인 서비스 감지
    echo -e "\n${WHITE}=== 감지된 서비스 ===${NC}"
    
    # 웹서버
    if systemctl is-active --quiet nginx 2>/dev/null; then
        echo -e "웹서버: ${GREEN}Nginx (실행 중)${NC}"
    elif systemctl is-active --quiet apache2 2>/dev/null || systemctl is-active --quiet httpd 2>/dev/null; then
        echo -e "웹서버: ${GREEN}Apache (실행 중)${NC}"
    fi
    
    # 데이터베이스
    if systemctl is-active --quiet mysql 2>/dev/null || systemctl is-active --quiet mysqld 2>/dev/null; then
        echo -e "데이터베이스: ${GREEN}MySQL (실행 중)${NC}"
    fi
    if systemctl is-active --quiet postgresql 2>/dev/null; then
        echo -e "데이터베이스: ${GREEN}PostgreSQL (실행 중)${NC}"
    fi
    if systemctl is-active --quiet mongod 2>/dev/null; then
        echo -e "데이터베이스: ${GREEN}MongoDB (실행 중)${NC}"
    fi
    if systemctl is-active --quiet redis 2>/dev/null || systemctl is-active --quiet redis-server 2>/dev/null; then
        echo -e "캐시: ${GREEN}Redis (실행 중)${NC}"
    fi
    
    # 애플리케이션 서버
    if pgrep -f "java.*tomcat" > /dev/null; then
        echo -e "WAS: ${GREEN}Tomcat (실행 중)${NC}"
    fi
    if pgrep -f "java.*jetty" > /dev/null; then
        echo -e "WAS: ${GREEN}Jetty (실행 중)${NC}"
    fi
    if pgrep -f "node" > /dev/null; then
        echo -e "애플리케이션: ${GREEN}Node.js (실행 중)${NC}"
    fi
    if pgrep -f "python.*django\|python.*flask\|python.*fastapi" > /dev/null; then
        echo -e "애플리케이션: ${GREEN}Python Web App (실행 중)${NC}"
    fi
    
    echo
}

create_base_directories() {
    log_info "기본 디렉토리를 생성합니다..."
    
    sudo mkdir -p "$AGENT_BASE_DIR"/{app,db,web,system}
    sudo mkdir -p "$CONFIG_DIR"/{app,db,web,system}
    sudo mkdir -p /var/log/airis-mon
    sudo mkdir -p /var/lib/airis-mon
    
    # 권한 설정
    sudo chmod 755 "$AGENT_BASE_DIR"
    sudo chmod 755 "$CONFIG_DIR"
    sudo chmod 755 /var/log/airis-mon
    sudo chmod 755 /var/lib/airis-mon
    
    log_success "기본 디렉토리 생성 완료"
}

# =============================================================================
# 애플리케이션 서버 에이전트
# =============================================================================

install_app_agent() {
    local app_type="${1:-auto}"
    local service_name="${2:-app-service}"
    local otel_endpoint="${3:-http://localhost:4317}"
    
    log_info "애플리케이션 서버 에이전트를 설치합니다..."
    
    local agent_dir="$AGENT_BASE_DIR/app"
    local config_dir="$CONFIG_DIR/app"
    
    sudo mkdir -p "$agent_dir" "$config_dir"
    
    # Node.js 에이전트
    if [[ "$app_type" == "nodejs" ]] || [[ "$app_type" == "auto" && -n "$(which node 2>/dev/null)" ]]; then
        install_nodejs_agent "$agent_dir" "$config_dir" "$service_name" "$otel_endpoint"
    fi
    
    # Java 에이전트
    if [[ "$app_type" == "java" ]] || [[ "$app_type" == "auto" && -n "$(which java 2>/dev/null)" ]]; then
        install_java_agent "$agent_dir" "$config_dir" "$service_name" "$otel_endpoint"
    fi
    
    # Python 에이전트
    if [[ "$app_type" == "python" ]] || [[ "$app_type" == "auto" && -n "$(which python3 2>/dev/null)" ]]; then
        install_python_agent "$agent_dir" "$config_dir" "$service_name" "$otel_endpoint"
    fi
    
    # 공통 헬퍼 스크립트
    create_app_helper_scripts "$agent_dir" "$config_dir"
    
    log_success "애플리케이션 서버 에이전트 설치 완료"
}

install_nodejs_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    local service_name="$3"
    local otel_endpoint="$4"
    
    log_info "Node.js 에이전트를 설정합니다..."
    
    # 글로벌 OpenTelemetry 패키지 설치
    sudo npm install -g \
        @opentelemetry/api \
        @opentelemetry/sdk-node \
        @opentelemetry/auto-instrumentations-node \
        @opentelemetry/exporter-otlp-grpc
    
    # 에이전트 스크립트 생성
    sudo tee "$agent_dir/nodejs-agent.js" > /dev/null << 'EOF'
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const fs = require('fs');
const path = require('path');

// 설정 파일 읽기
const configPath = process.env.AIRIS_CONFIG_PATH || '/etc/airis-mon/app/nodejs-config.json';
let config = {};

try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (error) {
    console.warn('Failed to read config file:', error.message);
}

const serviceName = process.env.OTEL_SERVICE_NAME || config.serviceName || 'nodejs-app';
const serviceVersion = process.env.OTEL_SERVICE_VERSION || config.serviceVersion || '1.0.0';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || config.otlpEndpoint || 'http://localhost:4317';

const sdk = new NodeSDK({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'airis-mon',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'production',
    }),
    traceExporter: new OTLPTraceExporter({
        url: `${otlpEndpoint}/v1/traces`,
        headers: { 'x-airis-agent': 'nodejs' },
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
});

console.log(`🚀 AIRIS Node.js agent started for service: ${serviceName}`);
EOF
    
    # 설정 파일 생성
    sudo tee "$config_dir/nodejs-config.json" > /dev/null << EOF
{
    "serviceName": "$service_name",
    "serviceVersion": "1.0.0",
    "otlpEndpoint": "$otel_endpoint",
    "environment": "production",
    "enabledInstrumentations": [
        "http",
        "express",
        "mysql",
        "mongodb",
        "redis"
    ]
}
EOF
    
    log_success "Node.js 에이전트 설정 완료"
}

install_java_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    local service_name="$3"
    local otel_endpoint="$4"
    
    log_info "Java 에이전트를 설정합니다..."
    
    # Java Agent 다운로드
    local agent_version="1.32.0"
    local agent_url="https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${agent_version}/opentelemetry-javaagent.jar"
    
    if [[ ! -f "$agent_dir/opentelemetry-javaagent.jar" ]]; then
        sudo curl -L -o "$agent_dir/opentelemetry-javaagent.jar" "$agent_url"
    fi
    
    # 설정 파일 생성
    sudo tee "$config_dir/java-agent.properties" > /dev/null << EOF
# AIRIS Java Agent 설정
otel.service.name=$service_name
otel.service.version=1.0.0
otel.service.namespace=airis-mon
otel.exporter.otlp.endpoint=$otel_endpoint
otel.exporter.otlp.protocol=grpc
otel.traces.exporter=otlp
otel.metrics.exporter=otlp
otel.logs.exporter=otlp
otel.propagators=tracecontext,baggage
otel.resource.attributes=deployment.environment=production

# 성능 설정
otel.span.attribute.count.limit=128
otel.span.event.count.limit=128
otel.bsp.max.export.batch.size=512
otel.bsp.export.timeout=30s

# 계측 활성화
otel.instrumentation.http.enabled=true
otel.instrumentation.jdbc.enabled=true
otel.instrumentation.kafka.enabled=true
otel.instrumentation.spring.enabled=true
EOF
    
    # 헬퍼 스크립트 생성
    sudo tee "$agent_dir/java-agent-wrapper.sh" > /dev/null << EOF
#!/bin/bash

# Java 애플리케이션을 AIRIS 에이전트와 함께 실행하는 헬퍼 스크립트

AGENT_JAR="$agent_dir/opentelemetry-javaagent.jar"
CONFIG_FILE="$config_dir/java-agent.properties"

if [[ ! -f "\$AGENT_JAR" ]]; then
    echo "Error: Java agent not found at \$AGENT_JAR"
    exit 1
fi

# JVM 옵션 설정
JAVA_OPTS="\${JAVA_OPTS} -javaagent:\$AGENT_JAR"
JAVA_OPTS="\${JAVA_OPTS} -Dotel.javaagent.configuration-file=\$CONFIG_FILE"

export JAVA_OPTS

echo "🚀 Starting Java application with AIRIS agent..."
echo "📊 Agent: \$AGENT_JAR"
echo "⚙️  Config: \$CONFIG_FILE"

# 전달받은 인수로 Java 애플리케이션 실행
exec "\$@"
EOF
    sudo chmod +x "$agent_dir/java-agent-wrapper.sh"
    
    log_success "Java 에이전트 설정 완료"
}

install_python_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    local service_name="$3"
    local otel_endpoint="$4"
    
    log_info "Python 에이전트를 설정합니다..."
    
    # OpenTelemetry 패키지 설치
    sudo pip3 install \
        opentelemetry-api \
        opentelemetry-sdk \
        opentelemetry-exporter-otlp-proto-grpc \
        opentelemetry-instrumentation \
        opentelemetry-bootstrap
    
    # 자동 계측 패키지 설치
    sudo python3 -m opentelemetry.bootstrap --action=install
    
    # 에이전트 스크립트 생성
    sudo tee "$agent_dir/python-agent.py" > /dev/null << 'EOF'
#!/usr/bin/env python3

import os
import json
import logging
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.resource import ResourceAttributes

def load_config():
    """설정 파일 로드"""
    config_path = os.getenv('AIRIS_CONFIG_PATH', '/etc/airis-mon/app/python-config.json')
    
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logging.warning(f"Failed to load config: {e}")
        return {}

def initialize_telemetry():
    """OpenTelemetry 초기화"""
    config = load_config()
    
    service_name = os.getenv('OTEL_SERVICE_NAME') or config.get('serviceName', 'python-app')
    service_version = os.getenv('OTEL_SERVICE_VERSION') or config.get('serviceVersion', '1.0.0')
    otlp_endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT') or config.get('otlpEndpoint', 'http://localhost:4317')
    
    resource = Resource.create({
        ResourceAttributes.SERVICE_NAME: service_name,
        ResourceAttributes.SERVICE_VERSION: service_version,
        ResourceAttributes.SERVICE_NAMESPACE: "airis-mon",
        ResourceAttributes.DEPLOYMENT_ENVIRONMENT: "production",
    })
    
    # Trace Provider 설정
    trace_provider = TracerProvider(resource=resource)
    trace_exporter = OTLPSpanExporter(
        endpoint=f"{otlp_endpoint}/v1/traces",
        headers={"x-airis-agent": "python"}
    )
    span_processor = BatchSpanProcessor(trace_exporter)
    trace_provider.add_span_processor(span_processor)
    trace.set_tracer_provider(trace_provider)
    
    # Metric Provider 설정
    metric_exporter = OTLPMetricExporter(
        endpoint=f"{otlp_endpoint}/v1/metrics",
        headers={"x-airis-agent": "python"}
    )
    metric_reader = PeriodicExportingMetricReader(exporter=metric_exporter)
    metric_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(metric_provider)
    
    print(f"🚀 AIRIS Python agent started for service: {service_name}")
    print(f"📊 Endpoint: {otlp_endpoint}")

if __name__ == "__main__":
    initialize_telemetry()
EOF
    
    sudo chmod +x "$agent_dir/python-agent.py"
    
    # 설정 파일 생성
    sudo tee "$config_dir/python-config.json" > /dev/null << EOF
{
    "serviceName": "$service_name",
    "serviceVersion": "1.0.0",
    "otlpEndpoint": "$otel_endpoint",
    "environment": "production",
    "enabledInstrumentations": [
        "flask",
        "django",
        "fastapi",
        "requests",
        "sqlalchemy",
        "pymongo",
        "redis"
    ]
}
EOF
    
    # 헬퍼 스크립트 생성
    sudo tee "$agent_dir/python-agent-wrapper.sh" > /dev/null << EOF
#!/bin/bash

# Python 애플리케이션을 AIRIS 에이전트와 함께 실행하는 헬퍼 스크립트

AGENT_SCRIPT="$agent_dir/python-agent.py"
CONFIG_FILE="$config_dir/python-config.json"

export AIRIS_CONFIG_PATH="\$CONFIG_FILE"

echo "🚀 Starting Python application with AIRIS agent..."

# 자동 계측 활성화하여 Python 애플리케이션 실행
opentelemetry-instrument python3 "\$AGENT_SCRIPT" && python3 "\$@"
EOF
    sudo chmod +x "$agent_dir/python-agent-wrapper.sh"
    
    log_success "Python 에이전트 설정 완료"
}

create_app_helper_scripts() {
    local agent_dir="$1"
    local config_dir="$2"
    
    # 통합 시작 스크립트
    sudo tee "$agent_dir/start-with-agent.sh" > /dev/null << 'EOF'
#!/bin/bash

# AIRIS 에이전트와 함께 애플리케이션 시작

APP_TYPE="${1:-auto}"
APP_COMMAND="${2:-}"

if [[ -z "$APP_COMMAND" ]]; then
    echo "Usage: $0 <app_type> <app_command>"
    echo "Example: $0 java 'java -jar myapp.jar'"
    echo "Example: $0 nodejs 'node app.js'"
    echo "Example: $0 python 'python3 app.py'"
    exit 1
fi

case "$APP_TYPE" in
    "java")
        exec /opt/airis-agents/app/java-agent-wrapper.sh $APP_COMMAND
        ;;
    "nodejs")
        AIRIS_CONFIG_PATH=/etc/airis-mon/app/nodejs-config.json node -r /opt/airis-agents/app/nodejs-agent.js $APP_COMMAND
        ;;
    "python")
        exec /opt/airis-agents/app/python-agent-wrapper.sh $APP_COMMAND
        ;;
    *)
        echo "지원하지 않는 애플리케이션 타입: $APP_TYPE"
        echo "지원 타입: java, nodejs, python"
        exit 1
        ;;
esac
EOF
    sudo chmod +x "$agent_dir/start-with-agent.sh"
}

# =============================================================================
# 데이터베이스 모니터링 에이전트
# =============================================================================

install_db_agents() {
    local db_types="${1:-auto}"
    local airis_endpoint="${2:-http://localhost:4317}"
    
    log_info "데이터베이스 모니터링 에이전트를 설치합니다..."
    
    local agent_dir="$AGENT_BASE_DIR/db"
    local config_dir="$CONFIG_DIR/db"
    
    sudo mkdir -p "$agent_dir" "$config_dir"
    
    # 자동 감지 모드
    if [[ "$db_types" == "auto" ]]; then
        # MySQL/MariaDB
        if systemctl is-active --quiet mysql 2>/dev/null || systemctl is-active --quiet mysqld 2>/dev/null; then
            install_mysql_agent "$agent_dir" "$config_dir" "$airis_endpoint"
        fi
        
        # PostgreSQL
        if systemctl is-active --quiet postgresql 2>/dev/null; then
            install_postgresql_agent "$agent_dir" "$config_dir" "$airis_endpoint"
        fi
        
        # MongoDB
        if systemctl is-active --quiet mongod 2>/dev/null; then
            install_mongodb_agent "$agent_dir" "$config_dir" "$airis_endpoint"
        fi
        
        # Redis
        if systemctl is-active --quiet redis 2>/dev/null || systemctl is-active --quiet redis-server 2>/dev/null; then
            install_redis_agent "$agent_dir" "$config_dir" "$airis_endpoint"
        fi
    else
        # 지정된 타입만 설치
        IFS=',' read -ra DB_TYPES <<< "$db_types"
        for db_type in "${DB_TYPES[@]}"; do
            case "$db_type" in
                "mysql")
                    install_mysql_agent "$agent_dir" "$config_dir" "$airis_endpoint"
                    ;;
                "postgresql")
                    install_postgresql_agent "$agent_dir" "$config_dir" "$airis_endpoint"
                    ;;
                "mongodb")
                    install_mongodb_agent "$agent_dir" "$config_dir" "$airis_endpoint"
                    ;;
                "redis")
                    install_redis_agent "$agent_dir" "$config_dir" "$airis_endpoint"
                    ;;
                *)
                    log_warn "지원하지 않는 데이터베이스 타입: $db_type"
                    ;;
            esac
        done
    fi
    
    log_success "데이터베이스 모니터링 에이전트 설치 완료"
}

install_mysql_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    local airis_endpoint="$3"
    
    log_info "MySQL 모니터링 에이전트를 설치합니다..."
    
    # MySQL Exporter 다운로드
    local exporter_version="0.15.1"
    local arch=$(uname -m)
    case $arch in
        x86_64) exporter_arch="amd64" ;;
        aarch64) exporter_arch="arm64" ;;
        *) exporter_arch="amd64" ;;
    esac
    
    local exporter_url="https://github.com/prometheus/mysqld_exporter/releases/download/v${exporter_version}/mysqld_exporter-${exporter_version}.linux-${exporter_arch}.tar.gz"
    
    cd /tmp
    curl -L -o mysqld_exporter.tar.gz "$exporter_url"
    tar -xzf mysqld_exporter.tar.gz
    sudo mv "mysqld_exporter-${exporter_version}.linux-${exporter_arch}/mysqld_exporter" "$agent_dir/"
    sudo chmod +x "$agent_dir/mysqld_exporter"
    
    # 설정 파일 생성
    sudo tee "$config_dir/mysql-exporter.cnf" > /dev/null << 'EOF'
[client]
user = airis_monitor
password = airis_monitor_password
host = localhost
port = 3306

[mysql]
default-character-set = utf8mb4
EOF
    
    sudo chmod 600 "$config_dir/mysql-exporter.cnf"
    
    # systemd 서비스 생성
    sudo tee "/etc/systemd/system/airis-mysql-exporter.service" > /dev/null << EOF
[Unit]
Description=AIRIS MySQL Exporter
After=network.target mysql.service

[Service]
Type=simple
User=nobody
ExecStart=$agent_dir/mysqld_exporter --config.my-cnf=$config_dir/mysql-exporter.cnf --web.listen-address=0.0.0.0:9104
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable airis-mysql-exporter
    
    log_info "MySQL 모니터링 사용자를 생성하세요:"
    echo "CREATE USER 'airis_monitor'@'localhost' IDENTIFIED BY 'airis_monitor_password';"
    echo "GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'airis_monitor'@'localhost';"
    echo "GRANT SELECT ON performance_schema.* TO 'airis_monitor'@'localhost';"
    echo "FLUSH PRIVILEGES;"
    
    log_success "MySQL 에이전트 설치 완료"
}

install_postgresql_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    local airis_endpoint="$3"
    
    log_info "PostgreSQL 모니터링 에이전트를 설치합니다..."
    
    # PostgreSQL Exporter 다운로드
    local exporter_version="0.15.0"
    local arch=$(uname -m)
    case $arch in
        x86_64) exporter_arch="amd64" ;;
        aarch64) exporter_arch="arm64" ;;
        *) exporter_arch="amd64" ;;
    esac
    
    local exporter_url="https://github.com/prometheus-community/postgres_exporter/releases/download/v${exporter_version}/postgres_exporter-${exporter_version}.linux-${exporter_arch}.tar.gz"
    
    cd /tmp
    curl -L -o postgres_exporter.tar.gz "$exporter_url"
    tar -xzf postgres_exporter.tar.gz
    sudo mv "postgres_exporter-${exporter_version}.linux-${exporter_arch}/postgres_exporter" "$agent_dir/"
    sudo chmod +x "$agent_dir/postgres_exporter"
    
    # 환경 파일 생성
    sudo tee "$config_dir/postgres-exporter.env" > /dev/null << 'EOF'
DATA_SOURCE_NAME="postgresql://airis_monitor:airis_monitor_password@localhost:5432/postgres?sslmode=disable"
PG_EXPORTER_WEB_LISTEN_ADDRESS=":9187"
PG_EXPORTER_EXTEND_QUERY_PATH="/etc/airis-mon/db/postgres-queries.yaml"
EOF
    
    # 커스텀 쿼리 설정
    sudo tee "$config_dir/postgres-queries.yaml" > /dev/null << 'EOF'
pg_stat_statements:
  query: "SELECT query, calls, total_time, mean_time, stddev_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 20"
  master: true
  metrics:
    - query:
        usage: "LABEL"
        description: "Query text"
    - calls:
        usage: "COUNTER"
        description: "Number of times executed"
    - total_time:
        usage: "COUNTER"
        description: "Total time spent in the statement"
    - mean_time:
        usage: "GAUGE"
        description: "Mean time spent in the statement"

pg_database_size:
  query: "SELECT datname, pg_database_size(datname) as size FROM pg_database"
  master: true
  metrics:
    - datname:
        usage: "LABEL"
        description: "Database name"
    - size:
        usage: "GAUGE"
        description: "Database size in bytes"
EOF
    
    # systemd 서비스 생성
    sudo tee "/etc/systemd/system/airis-postgres-exporter.service" > /dev/null << EOF
[Unit]
Description=AIRIS PostgreSQL Exporter
After=network.target postgresql.service

[Service]
Type=simple
User=nobody
EnvironmentFile=$config_dir/postgres-exporter.env
ExecStart=$agent_dir/postgres_exporter
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable airis-postgres-exporter
    
    log_info "PostgreSQL 모니터링 사용자를 생성하세요:"
    echo "CREATE USER airis_monitor WITH PASSWORD 'airis_monitor_password';"
    echo "GRANT CONNECT ON DATABASE postgres TO airis_monitor;"
    echo "GRANT SELECT ON ALL TABLES IN SCHEMA public TO airis_monitor;"
    echo "GRANT SELECT ON ALL TABLES IN SCHEMA information_schema TO airis_monitor;"
    echo "GRANT SELECT ON ALL TABLES IN SCHEMA pg_catalog TO airis_monitor;"
    
    log_success "PostgreSQL 에이전트 설치 완료"
}

install_mongodb_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    local airis_endpoint="$3"
    
    log_info "MongoDB 모니터링 에이전트를 설치합니다..."
    
    # MongoDB Exporter 다운로드
    local exporter_version="0.40.0"
    local arch=$(uname -m)
    case $arch in
        x86_64) exporter_arch="amd64" ;;
        aarch64) exporter_arch="arm64" ;;
        *) exporter_arch="amd64" ;;
    esac
    
    local exporter_url="https://github.com/percona/mongodb_exporter/releases/download/v${exporter_version}/mongodb_exporter-${exporter_version}.linux-${exporter_arch}.tar.gz"
    
    cd /tmp
    curl -L -o mongodb_exporter.tar.gz "$exporter_url"
    tar -xzf mongodb_exporter.tar.gz
    sudo mv "mongodb_exporter-${exporter_version}.linux-${exporter_arch}/mongodb_exporter" "$agent_dir/"
    sudo chmod +x "$agent_dir/mongodb_exporter"
    
    # 설정 파일 생성
    sudo tee "$config_dir/mongodb-exporter.env" > /dev/null << 'EOF'
MONGODB_URI="mongodb://airis_monitor:airis_monitor_password@localhost:27017/admin"
HTTP_ADDR=":9216"
LOG_LEVEL="info"
COLLECT_ALL="true"
EOF
    
    # systemd 서비스 생성
    sudo tee "/etc/systemd/system/airis-mongodb-exporter.service" > /dev/null << EOF
[Unit]
Description=AIRIS MongoDB Exporter
After=network.target mongod.service

[Service]
Type=simple
User=nobody
EnvironmentFile=$config_dir/mongodb-exporter.env
ExecStart=$agent_dir/mongodb_exporter
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable airis-mongodb-exporter
    
    log_info "MongoDB 모니터링 사용자를 생성하세요:"
    echo "use admin"
    echo "db.createUser({"
    echo "  user: 'airis_monitor',"
    echo "  pwd: 'airis_monitor_password',"
    echo "  roles: [ { role: 'readAnyDatabase', db: 'admin' }, { role: 'clusterMonitor', db: 'admin' } ]"
    echo "})"
    
    log_success "MongoDB 에이전트 설치 완료"
}

install_redis_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    local airis_endpoint="$3"
    
    log_info "Redis 모니터링 에이전트를 설치합니다..."
    
    # Redis Exporter 다운로드
    local exporter_version="1.55.0"
    local arch=$(uname -m)
    case $arch in
        x86_64) exporter_arch="amd64" ;;
        aarch64) exporter_arch="arm64" ;;
        *) exporter_arch="amd64" ;;
    esac
    
    local exporter_url="https://github.com/oliver006/redis_exporter/releases/download/v${exporter_version}/redis_exporter-v${exporter_version}.linux-${exporter_arch}.tar.gz"
    
    cd /tmp
    curl -L -o redis_exporter.tar.gz "$exporter_url"
    tar -xzf redis_exporter.tar.gz
    sudo mv "redis_exporter-v${exporter_version}.linux-${exporter_arch}/redis_exporter" "$agent_dir/"
    sudo chmod +x "$agent_dir/redis_exporter"
    
    # 설정 파일 생성
    sudo tee "$config_dir/redis-exporter.env" > /dev/null << 'EOF'
REDIS_ADDR="redis://localhost:6379"
REDIS_PASSWORD=""
WEB_LISTEN_ADDRESS=":9121"
LOG_FORMAT="json"
INCLUDE_SYSTEM_METRICS="true"
EOF
    
    # systemd 서비스 생성
    sudo tee "/etc/systemd/system/airis-redis-exporter.service" > /dev/null << EOF
[Unit]
Description=AIRIS Redis Exporter
After=network.target redis.service

[Service]
Type=simple
User=nobody
EnvironmentFile=$config_dir/redis-exporter.env
ExecStart=$agent_dir/redis_exporter
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable airis-redis-exporter
    
    log_success "Redis 에이전트 설치 완료"
}

# =============================================================================
# 웹서버/WAS 모니터링 에이전트
# =============================================================================

install_web_agents() {
    local web_types="${1:-auto}"
    local airis_endpoint="${2:-http://localhost:4317}"
    
    log_info "웹서버/WAS 모니터링 에이전트를 설치합니다..."
    
    local agent_dir="$AGENT_BASE_DIR/web"
    local config_dir="$CONFIG_DIR/web"
    
    sudo mkdir -p "$agent_dir" "$config_dir"
    
    # 자동 감지 모드
    if [[ "$web_types" == "auto" ]]; then
        # Nginx
        if systemctl is-active --quiet nginx 2>/dev/null; then
            install_nginx_agent "$agent_dir" "$config_dir" "$airis_endpoint"
        fi
        
        # Apache
        if systemctl is-active --quiet apache2 2>/dev/null || systemctl is-active --quiet httpd 2>/dev/null; then
            install_apache_agent "$agent_dir" "$config_dir" "$airis_endpoint"
        fi
        
        # Tomcat
        if pgrep -f "java.*tomcat" > /dev/null; then
            install_tomcat_agent "$agent_dir" "$config_dir" "$airis_endpoint"
        fi
    else
        # 지정된 타입만 설치
        IFS=',' read -ra WEB_TYPES <<< "$web_types"
        for web_type in "${WEB_TYPES[@]}"; do
            case "$web_type" in
                "nginx")
                    install_nginx_agent "$agent_dir" "$config_dir" "$airis_endpoint"
                    ;;
                "apache")
                    install_apache_agent "$agent_dir" "$config_dir" "$airis_endpoint"
                    ;;
                "tomcat")
                    install_tomcat_agent "$agent_dir" "$config_dir" "$airis_endpoint"
                    ;;
                *)
                    log_warn "지원하지 않는 웹서버 타입: $web_type"
                    ;;
            esac
        done
    fi
    
    log_success "웹서버/WAS 모니터링 에이전트 설치 완료"
}

install_nginx_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    local airis_endpoint="$3"
    
    log_info "Nginx 모니터링 에이전트를 설치합니다..."
    
    # Nginx VTS Exporter 설치 (Prometheus Exporter)
    # 또는 nginx-prometheus-exporter 사용
    local exporter_version="0.11.0"
    local arch=$(uname -m)
    case $arch in
        x86_64) exporter_arch="amd64" ;;
        aarch64) exporter_arch="arm64" ;;
        *) exporter_arch="amd64" ;;
    esac
    
    local exporter_url="https://github.com/nginxinc/nginx-prometheus-exporter/releases/download/v${exporter_version}/nginx-prometheus-exporter-${exporter_version}-linux-${exporter_arch}.tar.gz"
    
    cd /tmp
    curl -L -o nginx_exporter.tar.gz "$exporter_url"
    tar -xzf nginx_exporter.tar.gz
    sudo mv "nginx-prometheus-exporter" "$agent_dir/"
    sudo chmod +x "$agent_dir/nginx-prometheus-exporter"
    
    # Nginx 설정 수정 (stub_status 활성화)
    sudo tee "$config_dir/nginx-status.conf" > /dev/null << 'EOF'
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
EOF
    
    log_info "다음 설정을 Nginx에 추가하세요:"
    echo "include $config_dir/nginx-status.conf;"
    
    # systemd 서비스 생성
    sudo tee "/etc/systemd/system/airis-nginx-exporter.service" > /dev/null << EOF
[Unit]
Description=AIRIS Nginx Exporter
After=network.target nginx.service

[Service]
Type=simple
User=nobody
ExecStart=$agent_dir/nginx-prometheus-exporter -nginx.scrape-uri=http://localhost:8080/nginx_status -web.listen-address=:9113
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable airis-nginx-exporter
    
    log_success "Nginx 에이전트 설치 완료"
}

install_apache_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    local airis_endpoint="$3"
    
    log_info "Apache 모니터링 에이전트를 설치합니다..."
    
    # Apache Exporter 다운로드
    local exporter_version="1.0.0"
    local arch=$(uname -m)
    case $arch in
        x86_64) exporter_arch="amd64" ;;
        aarch64) exporter_arch="arm64" ;;
        *) exporter_arch="amd64" ;;
    esac
    
    local exporter_url="https://github.com/Lusitaniae/apache_exporter/releases/download/v${exporter_version}/apache_exporter-${exporter_version}.linux-${exporter_arch}.tar.gz"
    
    cd /tmp
    curl -L -o apache_exporter.tar.gz "$exporter_url"
    tar -xzf apache_exporter.tar.gz
    sudo mv "apache_exporter-${exporter_version}.linux-${exporter_arch}/apache_exporter" "$agent_dir/"
    sudo chmod +x "$agent_dir/apache_exporter"
    
    # Apache 모듈 활성화 안내
    log_info "Apache mod_status 모듈을 활성화하고 다음 설정을 추가하세요:"
    echo "LoadModule status_module modules/mod_status.so"
    echo "<Location \"/server-status\">"
    echo "    SetHandler server-status"
    echo "    Require local"
    echo "</Location>"
    
    # systemd 서비스 생성
    sudo tee "/etc/systemd/system/airis-apache-exporter.service" > /dev/null << EOF
[Unit]
Description=AIRIS Apache Exporter
After=network.target apache2.service

[Service]
Type=simple
User=nobody
ExecStart=$agent_dir/apache_exporter --scrape_uri=http://localhost/server-status?auto --web.listen-address=:9117
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable airis-apache-exporter
    
    log_success "Apache 에이전트 설치 완료"
}

install_tomcat_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    local airis_endpoint="$3"
    
    log_info "Tomcat 모니터링 에이전트를 설치합니다..."
    
    # JMX Exporter 다운로드
    local exporter_version="0.20.0"
    local exporter_url="https://repo1.maven.org/maven2/io/prometheus/jmx/jmx_prometheus_javaagent/${exporter_version}/jmx_prometheus_javaagent-${exporter_version}.jar"
    
    sudo curl -L -o "$agent_dir/jmx_prometheus_javaagent.jar" "$exporter_url"
    
    # JMX 설정 파일 생성
    sudo tee "$config_dir/tomcat-jmx-config.yaml" > /dev/null << 'EOF'
rules:
- pattern: 'Catalina<type=GlobalRequestProcessor, name=\"(\w+-\w+)-(\d+)\"><>(\w+):'
  name: tomcat_$3_total
  labels:
    port: "$2"
    protocol: "$1"
  help: Tomcat global $3
  type: COUNTER
- pattern: 'Catalina<j2eeType=Servlet, WebModule=//([-a-zA-Z0-9+&@#/%?=~_|!:.,;]*[-a-zA-Z0-9+&@#/%=~_|]), name=([-a-zA-Z0-9+/$%~_-|!.]*), J2EEApplication=none, J2EEServer=none><>(requestCount|maxTime|processingTime|errorCount):'
  name: tomcat_servlet_$3_total
  labels:
    module: "$1"
    servlet: "$2"
  help: Tomcat servlet $3 total
  type: COUNTER
- pattern: 'Catalina<type=ThreadPool, name="(\w+-\w+)-(\d+)"><>(currentThreadCount|currentThreadsBusy|keepAliveCount|pollerThreadCount|connectionCount):'
  name: tomcat_threads_$3
  labels:
    port: "$2"
    protocol: "$1"
  help: Tomcat threads $3
  type: GAUGE
- pattern: 'Catalina<type=Manager, host=([-a-zA-Z0-9+&@#/%?=~_|!:.,;]*[-a-zA-Z0-9+&@#/%=~_|]), context=([-a-zA-Z0-9+/$%~_-|!.]*)><>(processingTime|sessionCounter|rejectedSessions|expiredSessions):'
  name: tomcat_session_$3_total
  labels:
    context: "$2"
    host: "$1"
  help: Tomcat session $3 total
  type: COUNTER
EOF
    
    # Tomcat 시작 스크립트 수정 안내
    log_info "Tomcat의 setenv.sh 또는 catalina.sh에 다음 JVM 옵션을 추가하세요:"
    echo "JAVA_OPTS=\"\$JAVA_OPTS -javaagent:$agent_dir/jmx_prometheus_javaagent.jar=9404:$config_dir/tomcat-jmx-config.yaml\""
    
    log_success "Tomcat 에이전트 설치 완료"
}

# =============================================================================
# 시스템 메트릭 에이전트
# =============================================================================

install_system_agents() {
    local airis_endpoint="${1:-http://localhost:4317}"
    
    log_info "시스템 메트릭 에이전트를 설치합니다..."
    
    local agent_dir="$AGENT_BASE_DIR/system"
    local config_dir="$CONFIG_DIR/system"
    
    sudo mkdir -p "$agent_dir" "$config_dir"
    
    # Node Exporter 설치
    install_node_exporter_agent "$agent_dir" "$config_dir"
    
    # Process Exporter 설치
    install_process_exporter_agent "$agent_dir" "$config_dir"
    
    log_success "시스템 메트릭 에이전트 설치 완료"
}

install_node_exporter_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    
    log_info "Node Exporter를 설치합니다..."
    
    local exporter_version="1.7.0"
    local arch=$(uname -m)
    case $arch in
        x86_64) exporter_arch="amd64" ;;
        aarch64) exporter_arch="arm64" ;;
        armv7l) exporter_arch="armv7" ;;
        *) exporter_arch="amd64" ;;
    esac
    
    local exporter_url="https://github.com/prometheus/node_exporter/releases/download/v${exporter_version}/node_exporter-${exporter_version}.linux-${exporter_arch}.tar.gz"
    
    cd /tmp
    curl -L -o node_exporter.tar.gz "$exporter_url"
    tar -xzf node_exporter.tar.gz
    sudo mv "node_exporter-${exporter_version}.linux-${exporter_arch}/node_exporter" "$agent_dir/"
    sudo chmod +x "$agent_dir/node_exporter"
    
    # 사용자 생성
    sudo useradd --system --shell /bin/false --home-dir /nonexistent node_exporter 2>/dev/null || true
    
    # systemd 서비스 생성
    sudo tee "/etc/systemd/system/airis-node-exporter.service" > /dev/null << EOF
[Unit]
Description=AIRIS Node Exporter
After=network.target

[Service]
Type=simple
User=node_exporter
Group=node_exporter
ExecStart=$agent_dir/node_exporter --web.listen-address=0.0.0.0:9100 --collector.systemd --collector.processes
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable airis-node-exporter
    sudo systemctl start airis-node-exporter
    
    log_success "Node Exporter 설치 완료"
}

install_process_exporter_agent() {
    local agent_dir="$1"
    local config_dir="$2"
    
    log_info "Process Exporter를 설치합니다..."
    
    local exporter_version="0.7.10"
    local arch=$(uname -m)
    case $arch in
        x86_64) exporter_arch="amd64" ;;
        aarch64) exporter_arch="arm64" ;;
        *) exporter_arch="amd64" ;;
    esac
    
    local exporter_url="https://github.com/ncabatoff/process-exporter/releases/download/v${exporter_version}/process-exporter-${exporter_version}.linux-${exporter_arch}.tar.gz"
    
    cd /tmp
    curl -L -o process_exporter.tar.gz "$exporter_url"
    tar -xzf process_exporter.tar.gz
    sudo mv "process-exporter-${exporter_version}.linux-${exporter_arch}/process-exporter" "$agent_dir/"
    sudo chmod +x "$agent_dir/process-exporter"
    
    # 설정 파일 생성
    sudo tee "$config_dir/process-exporter.yaml" > /dev/null << 'EOF'
process_names:
  - name: "{{.Comm}}"
    cmdline:
    - '.+'
  - name: "systemd"
    cmdline:
    - 'systemd'
  - name: "nginx"
    cmdline:
    - 'nginx'
  - name: "mysql"
    cmdline:
    - 'mysqld'
  - name: "postgres"
    cmdline:
    - 'postgres'
  - name: "redis"
    cmdline:
    - 'redis-server'
  - name: "node"
    cmdline:
    - 'node'
  - name: "java"
    cmdline:
    - 'java'
  - name: "python"
    cmdline:
    - 'python'
EOF
    
    # systemd 서비스 생성
    sudo tee "/etc/systemd/system/airis-process-exporter.service" > /dev/null << EOF
[Unit]
Description=AIRIS Process Exporter
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=$agent_dir/process-exporter --config.path=$config_dir/process-exporter.yaml --web.listen-address=0.0.0.0:9256
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable airis-process-exporter
    sudo systemctl start airis-process-exporter
    
    log_success "Process Exporter 설치 완료"
}

# =============================================================================
# 에이전트 관리 함수
# =============================================================================

start_all_agents() {
    log_info "모든 AIRIS 에이전트를 시작합니다..."
    
    local services=(
        "airis-node-exporter"
        "airis-process-exporter"
        "airis-mysql-exporter"
        "airis-postgres-exporter"
        "airis-mongodb-exporter"
        "airis-redis-exporter"
        "airis-nginx-exporter"
        "airis-apache-exporter"
    )
    
    for service in "${services[@]}"; do
        if systemctl list-unit-files | grep -q "$service"; then
            sudo systemctl start "$service" 2>/dev/null || true
            if systemctl is-active --quiet "$service"; then
                echo -e "  ${GREEN}✓${NC} $service"
            else
                echo -e "  ${YELLOW}⚠${NC} $service (설정 확인 필요)"
            fi
        fi
    done
    
    log_success "에이전트 시작 완료"
}

stop_all_agents() {
    log_info "모든 AIRIS 에이전트를 중지합니다..."
    
    local services=(
        "airis-node-exporter"
        "airis-process-exporter"
        "airis-mysql-exporter"
        "airis-postgres-exporter"
        "airis-mongodb-exporter"
        "airis-redis-exporter"
        "airis-nginx-exporter"
        "airis-apache-exporter"
    )
    
    for service in "${services[@]}"; do
        if systemctl list-unit-files | grep -q "$service"; then
            sudo systemctl stop "$service" 2>/dev/null || true
            echo -e "  ${GREEN}✓${NC} $service stopped"
        fi
    done
    
    log_success "에이전트 중지 완료"
}

status_all_agents() {
    echo -e "${WHITE}=== AIRIS 에이전트 상태 ===${NC}"
    
    local services=(
        "airis-node-exporter:9100"
        "airis-process-exporter:9256"
        "airis-mysql-exporter:9104"
        "airis-postgres-exporter:9187"
        "airis-mongodb-exporter:9216"
        "airis-redis-exporter:9121"
        "airis-nginx-exporter:9113"
        "airis-apache-exporter:9117"
    )
    
    for service_port in "${services[@]}"; do
        local service="${service_port%%:*}"
        local port="${service_port##*:}"
        
        if systemctl list-unit-files | grep -q "$service"; then
            if systemctl is-active --quiet "$service"; then
                if netstat -tuln 2>/dev/null | grep -q ":$port "; then
                    echo -e "  ${GREEN}●${NC} $service (포트 $port 활성)"
                else
                    echo -e "  ${YELLOW}●${NC} $service (실행 중, 포트 확인 필요)"
                fi
            else
                echo -e "  ${RED}●${NC} $service (중지됨)"
            fi
        else
            echo -e "  ${CYAN}○${NC} $service (미설치)"
        fi
    done
}

# =============================================================================
# 헬프 함수
# =============================================================================

show_help() {
    echo -e "${WHITE}AIRIS-MON 에이전트 설치 도구${NC}"
    echo
    echo -e "${YELLOW}사용법:${NC}"
    echo -e "  $0 <command> [options]"
    echo
    echo -e "${YELLOW}명령어:${NC}"
    echo -e "  ${GREEN}detect${NC}        시스템 정보 및 서비스 감지"
    echo -e "  ${GREEN}install-all${NC}   모든 에이전트 자동 설치"
    echo -e "  ${GREEN}install-app${NC}   애플리케이션 에이전트 설치"
    echo -e "  ${GREEN}install-db${NC}    데이터베이스 에이전트 설치"
    echo -e "  ${GREEN}install-web${NC}   웹서버/WAS 에이전트 설치"
    echo -e "  ${GREEN}install-system${NC} 시스템 메트릭 에이전트 설치"
    echo -e "  ${GREEN}start${NC}         모든 에이전트 시작"
    echo -e "  ${GREEN}stop${NC}          모든 에이전트 중지"
    echo -e "  ${GREEN}status${NC}        모든 에이전트 상태 확인"
    echo
    echo -e "${YELLOW}옵션:${NC}"
    echo -e "  ${GREEN}--app-type${NC}        애플리케이션 타입 (nodejs,java,python,auto)"
    echo -e "  ${GREEN}--db-types${NC}        데이터베이스 타입 (mysql,postgresql,mongodb,redis,auto)"
    echo -e "  ${GREEN}--web-types${NC}       웹서버 타입 (nginx,apache,tomcat,auto)"
    echo -e "  ${GREEN}--service-name${NC}    서비스 이름"
    echo -e "  ${GREEN}--airis-endpoint${NC}  AIRIS 서버 엔드포인트"
    echo
    echo -e "${YELLOW}예시:${NC}"
    echo -e "  $0 detect"
    echo -e "  $0 install-all --airis-endpoint http://airis-server:4317"
    echo -e "  $0 install-app --app-type nodejs --service-name my-app"
    echo -e "  $0 install-db --db-types mysql,redis"
    echo -e "  $0 status"
    echo
}

# =============================================================================
# 메인 실행 로직
# =============================================================================

main() {
    local command="${1:-help}"
    shift || true
    
    local app_type="auto"
    local db_types="auto"
    local web_types="auto"
    local service_name="airis-service"
    local airis_endpoint="http://localhost:4317"
    
    # 옵션 파싱
    while [[ $# -gt 0 ]]; do
        case $1 in
            --app-type)
                app_type="$2"
                shift 2
                ;;
            --db-types)
                db_types="$2"
                shift 2
                ;;
            --web-types)
                web_types="$2"
                shift 2
                ;;
            --service-name)
                service_name="$2"
                shift 2
                ;;
            --airis-endpoint)
                airis_endpoint="$2"
                shift 2
                ;;
            *)
                log_error "알 수 없는 옵션: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    case "$command" in
        "detect")
            print_agent_banner
            detect_system_info
            ;;
        "install-all")
            print_agent_banner
            create_base_directories
            install_system_agents "$airis_endpoint"
            install_app_agent "$app_type" "$service_name" "$airis_endpoint"
            install_db_agents "$db_types" "$airis_endpoint"
            install_web_agents "$web_types" "$airis_endpoint"
            start_all_agents
            ;;
        "install-app")
            create_base_directories
            install_app_agent "$app_type" "$service_name" "$airis_endpoint"
            ;;
        "install-db")
            create_base_directories
            install_db_agents "$db_types" "$airis_endpoint"
            ;;
        "install-web")
            create_base_directories
            install_web_agents "$web_types" "$airis_endpoint"
            ;;
        "install-system")
            create_base_directories
            install_system_agents "$airis_endpoint"
            ;;
        "start")
            start_all_agents
            ;;
        "stop")
            stop_all_agents
            ;;
        "status")
            status_all_agents
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