#!/bin/bash

# AIRIS-MON OpenTelemetry 자동 설정 스크립트
# 작성자: AIRIS-MON Development Team
# 버전: 1.0.0
# 설명: 다양한 애플리케이션 타입에 대한 OpenTelemetry 자동 설정

set -euo pipefail

# =============================================================================
# 상수 및 설정
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly OTEL_CONFIG_DIR="/opt/otel-config"
readonly AGENTS_DIR="/opt/otel-agents"

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
    echo -e "${GREEN}[OTEL-SETUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[OTEL-SETUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[OTEL-SETUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_success() {
    echo -e "${GREEN}[OTEL-SETUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - ✅ $1"
}

print_otel_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║   📊 OpenTelemetry 자동 설정 도구 📊                     ║
    ║                                                          ║
    ║   • 다양한 언어/프레임워크 지원                          ║
    ║   • 자동 계측 설정                                       ║
    ║   • 커스텀 설정 생성                                     ║
    ║   • 성능 최적화 적용                                     ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

detect_application_type() {
    local app_path="$1"
    
    log_info "애플리케이션 타입을 감지합니다: $app_path"
    
    if [[ -f "$app_path/package.json" ]]; then
        echo "nodejs"
    elif [[ -f "$app_path/pom.xml" ]] || [[ -f "$app_path/build.gradle" ]] || [[ -f "$app_path/build.gradle.kts" ]]; then
        echo "java"
    elif [[ -f "$app_path/requirements.txt" ]] || [[ -f "$app_path/setup.py" ]] || [[ -f "$app_path/pyproject.toml" ]]; then
        echo "python"
    elif [[ -f "$app_path/go.mod" ]]; then
        echo "go"
    elif [[ -f "$app_path/Cargo.toml" ]]; then
        echo "rust"
    elif [[ -f "$app_path/composer.json" ]]; then
        echo "php"
    elif [[ -f "$app_path/app.rb" ]] || [[ -f "$app_path/Gemfile" ]]; then
        echo "ruby"
    elif [[ -f "$app_path/Program.cs" ]] || [[ -f "$app_path/appsettings.json" ]]; then
        echo "dotnet"
    else
        echo "unknown"
    fi
}

# =============================================================================
# Node.js OpenTelemetry 설정
# =============================================================================

setup_nodejs_otel() {
    local app_path="$1"
    local service_name="${2:-nodejs-app}"
    local otel_endpoint="${3:-http://localhost:4317}"
    
    log_info "Node.js 애플리케이션 OpenTelemetry 설정을 생성합니다..."
    
    cd "$app_path"
    
    # 패키지 설치
    log_info "OpenTelemetry 패키지를 설치합니다..."
    npm install --save \
        @opentelemetry/api \
        @opentelemetry/sdk-node \
        @opentelemetry/auto-instrumentations-node \
        @opentelemetry/exporter-otlp-grpc \
        @opentelemetry/exporter-otlp-http \
        @opentelemetry/instrumentation \
        @opentelemetry/resources \
        @opentelemetry/semantic-conventions
    
    # Instrumentation 파일 생성
    cat > "$app_path/otel-instrumentation.js" << 'EOF'
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// 환경 변수에서 설정 읽기
const serviceName = process.env.OTEL_SERVICE_NAME || 'nodejs-app';
const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
const environment = process.env.NODE_ENV || 'production';

// 리소스 정의
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
  [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'airis-mon',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
  [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || require('os').hostname(),
});

// SDK 초기화
const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
    headers: {
      'x-airis-source': 'nodejs-auto-instrumentation',
    },
  }),
  metricExporter: new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`,
    headers: {
      'x-airis-source': 'nodejs-auto-instrumentation',
    },
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // HTTP 계측 설정
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => {
          // Health check 등 무시할 요청
          return req.url?.includes('/health') || req.url?.includes('/metrics');
        },
        requestHook: (span, request) => {
          span.setAttributes({
            'http.request.header.user-agent': request.headers['user-agent'],
            'http.request.header.x-forwarded-for': request.headers['x-forwarded-for'],
          });
        },
      },
      // Express 계측 설정
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      // 데이터베이스 계측 설정
      '@opentelemetry/instrumentation-mysql': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-mysql2': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-mongodb': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-redis': {
        enabled: true,
      },
      // 파일 시스템 계측 (선택적)
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // 너무 많은 span이 생성될 수 있음
      },
    }),
  ],
});

// 커스텀 span 생성 함수 추가
const { trace } = require('@opentelemetry/api');
const tracer = trace.getTracer('airis-custom', '1.0.0');

// 전역 함수로 추가
global.createCustomSpan = (name, fn) => {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: error.message }); // ERROR
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
};

// SDK 시작
sdk.start();

// 정상 종료 처리
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OpenTelemetry SDK shutdown successfully'))
    .catch((error) => console.error('Error shutting down OpenTelemetry SDK', error))
    .finally(() => process.exit(0));
});

console.log(`🔍 OpenTelemetry initialized for service: ${serviceName}`);
console.log(`📊 Traces and metrics will be sent to: ${otlpEndpoint}`);
EOF
    
    # 환경 변수 파일 생성
    cat > "$app_path/.env.otel" << EOF
# OpenTelemetry 설정
OTEL_SERVICE_NAME=$service_name
OTEL_SERVICE_VERSION=1.0.0
OTEL_EXPORTER_OTLP_ENDPOINT=$otel_endpoint
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_PROPAGATORS=tracecontext,baggage
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.namespace=airis-mon

# 성능 설정
OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT=128
OTEL_SPAN_EVENT_COUNT_LIMIT=128
OTEL_SPAN_LINK_COUNT_LIMIT=128
OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512
OTEL_BSP_EXPORT_TIMEOUT=30000
OTEL_BSP_SCHEDULE_DELAY=5000
EOF
    
    # 시작 스크립트 생성
    cat > "$app_path/start-with-otel.sh" << EOF
#!/bin/bash

# OpenTelemetry 환경 변수 로드
if [[ -f .env.otel ]]; then
    export \$(cat .env.otel | grep -v '^#' | xargs)
fi

# Node.js 애플리케이션을 OpenTelemetry와 함께 시작
node -r ./otel-instrumentation.js \${1:-app.js}
EOF
    chmod +x "$app_path/start-with-otel.sh"
    
    # package.json 스크립트 추가
    if [[ -f "package.json" ]]; then
        # jq가 설치되어 있으면 사용, 없으면 직접 편집
        if command -v jq &> /dev/null; then
            jq '.scripts.start_otel = "node -r ./otel-instrumentation.js app.js"' package.json > package.json.tmp && mv package.json.tmp package.json
            jq '.scripts.dev_otel = "nodemon -r ./otel-instrumentation.js app.js"' package.json > package.json.tmp && mv package.json.tmp package.json
        else
            log_warn "jq가 설치되지 않았습니다. package.json 스크립트는 수동으로 추가하세요."
        fi
    fi
    
    log_success "Node.js OpenTelemetry 설정 완료"
    echo -e "${WHITE}사용법:${NC}"
    echo -e "  npm run start_otel    # 프로덕션 모드"
    echo -e "  npm run dev_otel      # 개발 모드"
    echo -e "  ./start-with-otel.sh  # 직접 시작"
}

# =============================================================================
# Java OpenTelemetry 설정
# =============================================================================

setup_java_otel() {
    local app_path="$1"
    local service_name="${2:-java-app}"
    local otel_endpoint="${3:-http://localhost:4317}"
    
    log_info "Java 애플리케이션 OpenTelemetry 설정을 생성합니다..."
    
    # Java Agent 다운로드
    local agent_dir="$app_path/otel-agent"
    mkdir -p "$agent_dir"
    
    local agent_version="1.32.0"
    local agent_url="https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${agent_version}/opentelemetry-javaagent.jar"
    
    if [[ ! -f "$agent_dir/opentelemetry-javaagent.jar" ]]; then
        log_info "Java OpenTelemetry Agent를 다운로드합니다..."
        curl -L -o "$agent_dir/opentelemetry-javaagent.jar" "$agent_url"
    fi
    
    # 설정 파일 생성
    cat > "$agent_dir/otel-config.properties" << EOF
# OpenTelemetry Java Agent 설정
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
otel.span.link.count.limit=128
otel.bsp.max.export.batch.size=512
otel.bsp.export.timeout=30s
otel.bsp.schedule.delay=5s

# 계측 설정
otel.instrumentation.http.client.enabled=true
otel.instrumentation.http.server.enabled=true
otel.instrumentation.jdbc.enabled=true
otel.instrumentation.jms.enabled=true
otel.instrumentation.kafka.enabled=true
otel.instrumentation.spring.enabled=true

# 제외할 URL 패턴
otel.instrumentation.http.server.route.based.naming=true
otel.instrumentation.common.default-enabled=true
EOF
    
    # 시작 스크립트 생성 (Spring Boot용)
    cat > "$app_path/start-with-otel.sh" << EOF
#!/bin/bash

# Java 애플리케이션을 OpenTelemetry와 함께 시작
JAVA_OPTS="\${JAVA_OPTS} -javaagent:otel-agent/opentelemetry-javaagent.jar"
JAVA_OPTS="\${JAVA_OPTS} -Dotel.javaagent.configuration-file=otel-agent/otel-config.properties"
JAVA_OPTS="\${JAVA_OPTS} -Dotel.javaagent.debug=false"

# JVM 메모리 설정
JAVA_OPTS="\${JAVA_OPTS} -Xms512m -Xmx2g"
JAVA_OPTS="\${JAVA_OPTS} -XX:+UseG1GC -XX:MaxGCPauseMillis=200"

export JAVA_OPTS

# JAR 파일 찾기
JAR_FILE=\$(find . -name "*.jar" -not -path "./otel-agent/*" | head -1)

if [[ -z "\$JAR_FILE" ]]; then
    echo "JAR 파일을 찾을 수 없습니다."
    exit 1
fi

echo "🚀 Starting Java application with OpenTelemetry..."
echo "📊 JAR: \$JAR_FILE"
echo "🔍 Agent: otel-agent/opentelemetry-javaagent.jar"
echo "📈 Endpoint: $otel_endpoint"

java \$JAVA_OPTS -jar "\$JAR_FILE"
EOF
    chmod +x "$app_path/start-with-otel.sh"
    
    # Maven용 설정 (pom.xml이 있는 경우)
    if [[ -f "$app_path/pom.xml" ]]; then
        cat > "$app_path/run-with-otel-maven.sh" << 'EOF'
#!/bin/bash

# Maven으로 애플리케이션을 OpenTelemetry와 함께 실행
MAVEN_OPTS="${MAVEN_OPTS} -javaagent:otel-agent/opentelemetry-javaagent.jar"
MAVEN_OPTS="${MAVEN_OPTS} -Dotel.javaagent.configuration-file=otel-agent/otel-config.properties"

export MAVEN_OPTS

echo "🚀 Starting Maven application with OpenTelemetry..."
mvn spring-boot:run
EOF
        chmod +x "$app_path/run-with-otel-maven.sh"
    fi
    
    # Gradle용 설정 (build.gradle이 있는 경우)
    if [[ -f "$app_path/build.gradle" ]] || [[ -f "$app_path/build.gradle.kts" ]]; then
        cat > "$app_path/run-with-otel-gradle.sh" << 'EOF'
#!/bin/bash

# Gradle로 애플리케이션을 OpenTelemetry와 함께 실행
JAVA_OPTS="${JAVA_OPTS} -javaagent:otel-agent/opentelemetry-javaagent.jar"
JAVA_OPTS="${JAVA_OPTS} -Dotel.javaagent.configuration-file=otel-agent/otel-config.properties"

export JAVA_OPTS

echo "🚀 Starting Gradle application with OpenTelemetry..."
./gradlew bootRun
EOF
        chmod +x "$app_path/run-with-otel-gradle.sh"
    fi
    
    log_success "Java OpenTelemetry 설정 완료"
    echo -e "${WHITE}사용법:${NC}"
    echo -e "  ./start-with-otel.sh           # JAR 파일 직접 실행"
    if [[ -f "$app_path/pom.xml" ]]; then
        echo -e "  ./run-with-otel-maven.sh       # Maven으로 실행"
    fi
    if [[ -f "$app_path/build.gradle" ]] || [[ -f "$app_path/build.gradle.kts" ]]; then
        echo -e "  ./run-with-otel-gradle.sh      # Gradle로 실행"
    fi
}

# =============================================================================
# Python OpenTelemetry 설정
# =============================================================================

setup_python_otel() {
    local app_path="$1"
    local service_name="${2:-python-app}"
    local otel_endpoint="${3:-http://localhost:4317}"
    
    log_info "Python 애플리케이션 OpenTelemetry 설정을 생성합니다..."
    
    cd "$app_path"
    
    # 필요한 패키지 설치
    cat > "requirements-otel.txt" << 'EOF'
# OpenTelemetry 패키지
opentelemetry-api
opentelemetry-sdk
opentelemetry-exporter-otlp-proto-grpc
opentelemetry-exporter-otlp-proto-http
opentelemetry-instrumentation
opentelemetry-bootstrap

# 자동 계측 패키지
opentelemetry-instrumentation-flask
opentelemetry-instrumentation-django
opentelemetry-instrumentation-fastapi
opentelemetry-instrumentation-requests
opentelemetry-instrumentation-urllib3
opentelemetry-instrumentation-sqlalchemy
opentelemetry-instrumentation-pymongo
opentelemetry-instrumentation-redis
opentelemetry-instrumentation-psycopg2
opentelemetry-instrumentation-mysql
EOF
    
    # 계측 파일 생성
    cat > "$app_path/otel_instrumentation.py" << 'EOF'
import os
import socket
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.instrumentation.auto_instrumentation import sitecustomize

# 환경 변수에서 설정 읽기
SERVICE_NAME = os.getenv('OTEL_SERVICE_NAME', 'python-app')
SERVICE_VERSION = os.getenv('OTEL_SERVICE_VERSION', '1.0.0')
OTLP_ENDPOINT = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4317')
ENVIRONMENT = os.getenv('ENVIRONMENT', 'production')

def initialize_telemetry():
    """OpenTelemetry 초기화"""
    
    # 리소스 정의
    resource = Resource.create({
        ResourceAttributes.SERVICE_NAME: SERVICE_NAME,
        ResourceAttributes.SERVICE_VERSION: SERVICE_VERSION,
        ResourceAttributes.SERVICE_NAMESPACE: "airis-mon",
        ResourceAttributes.DEPLOYMENT_ENVIRONMENT: ENVIRONMENT,
        ResourceAttributes.SERVICE_INSTANCE_ID: socket.gethostname(),
        ResourceAttributes.HOST_NAME: socket.gethostname(),
    })
    
    # Trace Provider 설정
    trace_provider = TracerProvider(resource=resource)
    trace_exporter = OTLPSpanExporter(
        endpoint=f"{OTLP_ENDPOINT}/v1/traces",
        headers={
            "x-airis-source": "python-auto-instrumentation"
        }
    )
    span_processor = BatchSpanProcessor(
        trace_exporter,
        max_export_batch_size=512,
        export_timeout_millis=30000,
        schedule_delay_millis=5000,
    )
    trace_provider.add_span_processor(span_processor)
    trace.set_tracer_provider(trace_provider)
    
    # Metric Provider 설정
    metric_exporter = OTLPMetricExporter(
        endpoint=f"{OTLP_ENDPOINT}/v1/metrics",
        headers={
            "x-airis-source": "python-auto-instrumentation"
        }
    )
    metric_reader = PeriodicExportingMetricReader(
        exporter=metric_exporter,
        export_interval_millis=30000,
    )
    metric_provider = MeterProvider(
        resource=resource,
        metric_readers=[metric_reader]
    )
    metrics.set_meter_provider(metric_provider)
    
    print(f"🔍 OpenTelemetry initialized for service: {SERVICE_NAME}")
    print(f"📊 Traces and metrics will be sent to: {OTLP_ENDPOINT}")
    
    return trace.get_tracer(__name__), metrics.get_meter(__name__)

# 커스텀 데코레이터
def trace_function(name=None):
    """함수를 추적하는 데코레이터"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            tracer = trace.get_tracer(__name__)
            span_name = name or f"{func.__module__}.{func.__name__}"
            
            with tracer.start_as_current_span(span_name) as span:
                try:
                    result = func(*args, **kwargs)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise
        return wrapper
    return decorator

# 자동 초기화
if __name__ != "__main__":
    tracer, meter = initialize_telemetry()
EOF
    
    # 환경 변수 파일 생성
    cat > "$app_path/.env.otel" << EOF
# OpenTelemetry 설정
OTEL_SERVICE_NAME=$service_name
OTEL_SERVICE_VERSION=1.0.0
OTEL_EXPORTER_OTLP_ENDPOINT=$otel_endpoint
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_PROPAGATORS=tracecontext,baggage
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.namespace=airis-mon

# Python 특화 설정
OTEL_PYTHON_LOG_CORRELATION=true
OTEL_PYTHON_LOG_FORMAT="%(asctime)s %(levelname)s [%(name)s] [%(filename)s:%(lineno)d] [trace_id=%(otelTraceID)s span_id=%(otelSpanID)s] - %(message)s"
EOF
    
    # 시작 스크립트 생성
    cat > "$app_path/start-with-otel.sh" << EOF
#!/bin/bash

# 가상환경 활성화 (있는 경우)
if [[ -d "venv" ]]; then
    source venv/bin/activate
elif [[ -d ".venv" ]]; then
    source .venv/bin/activate
fi

# OpenTelemetry 패키지 설치 확인
if ! python -c "import opentelemetry" 2>/dev/null; then
    echo "OpenTelemetry 패키지를 설치합니다..."
    pip install -r requirements-otel.txt
    opentelemetry-bootstrap --action=install
fi

# 환경 변수 로드
if [[ -f .env.otel ]]; then
    export \$(cat .env.otel | grep -v '^#' | xargs)
fi

# Python 애플리케이션을 OpenTelemetry와 함께 시작
echo "🚀 Starting Python application with OpenTelemetry..."

# 자동 계측으로 실행
opentelemetry-instrument python \${1:-app.py}
EOF
    chmod +x "$app_path/start-with-otel.sh"
    
    # Flask용 예제 설정
    if [[ -f "$app_path/app.py" ]] && grep -q "Flask" "$app_path/app.py" 2>/dev/null; then
        cat > "$app_path/start-flask-otel.sh" << 'EOF'
#!/bin/bash

# Flask 애플리케이션을 OpenTelemetry와 함께 시작
export FLASK_APP=${1:-app.py}
export FLASK_ENV=production

# 환경 변수 로드
if [[ -f .env.otel ]]; then
    export $(cat .env.otel | grep -v '^#' | xargs)
fi

opentelemetry-instrument flask run --host=0.0.0.0 --port=5000
EOF
        chmod +x "$app_path/start-flask-otel.sh"
    fi
    
    log_success "Python OpenTelemetry 설정 완료"
    echo -e "${WHITE}사용법:${NC}"
    echo -e "  pip install -r requirements-otel.txt  # 패키지 설치"
    echo -e "  ./start-with-otel.sh                  # 자동 계측으로 시작"
    if [[ -f "$app_path/start-flask-otel.sh" ]]; then
        echo -e "  ./start-flask-otel.sh                 # Flask 앱 시작"
    fi
}

# =============================================================================
# 기타 언어 지원
# =============================================================================

setup_go_otel() {
    local app_path="$1"
    local service_name="${2:-go-app}"
    local otel_endpoint="${3:-http://localhost:4317}"
    
    log_info "Go 애플리케이션 OpenTelemetry 설정을 생성합니다..."
    
    cd "$app_path"
    
    # Go 모듈 의존성 추가
    cat > "otel-setup.sh" << 'EOF'
#!/bin/bash
go get go.opentelemetry.io/otel
go get go.opentelemetry.io/otel/trace
go get go.opentelemetry.io/otel/metric
go get go.opentelemetry.io/otel/sdk
go get go.opentelemetry.io/otel/sdk/trace
go get go.opentelemetry.io/otel/sdk/metric
go get go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc
go get go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc
go get go.opentelemetry.io/otel/semconv/v1.21.0
go get go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp
go get go.opentelemetry.io/contrib/instrumentation/github.com/gorilla/mux/otelmux
EOF
    chmod +x "$app_path/otel-setup.sh"
    
    # Go 계측 예제 코드 생성
    cat > "$app_path/otel_instrumentation.go" << EOF
package main

import (
    "context"
    "log"
    "os"
    "time"

    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
    "go.opentelemetry.io/otel/sdk/resource"
    "go.opentelemetry.io/otel/sdk/trace"
    "go.opentelemetry.io/otel/sdk/metric"
    semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

func InitTelemetry() func() {
    serviceName := getEnv("OTEL_SERVICE_NAME", "$service_name")
    serviceVersion := getEnv("OTEL_SERVICE_VERSION", "1.0.0")
    otlpEndpoint := getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "$otel_endpoint")
    
    // 리소스 생성
    res, err := resource.New(context.Background(),
        resource.WithAttributes(
            semconv.ServiceNameKey.String(serviceName),
            semconv.ServiceVersionKey.String(serviceVersion),
            semconv.ServiceNamespaceKey.String("airis-mon"),
            semconv.DeploymentEnvironmentKey.String("production"),
        ),
    )
    if err != nil {
        log.Fatalf("Failed to create resource: %v", err)
    }
    
    // Trace Exporter 설정
    traceExporter, err := otlptracegrpc.New(context.Background(),
        otlptracegrpc.WithEndpoint(otlpEndpoint),
        otlptracegrpc.WithInsecure(),
    )
    if err != nil {
        log.Fatalf("Failed to create trace exporter: %v", err)
    }
    
    // Trace Provider 설정
    tp := trace.NewTracerProvider(
        trace.WithResource(res),
        trace.WithBatcher(traceExporter,
            trace.WithBatchTimeout(5*time.Second),
            trace.WithMaxExportBatchSize(512),
        ),
    )
    otel.SetTracerProvider(tp)
    
    // Metric Exporter 설정
    metricExporter, err := otlpmetricgrpc.New(context.Background(),
        otlpmetricgrpc.WithEndpoint(otlpEndpoint),
        otlpmetricgrpc.WithInsecure(),
    )
    if err != nil {
        log.Fatalf("Failed to create metric exporter: %v", err)
    }
    
    // Metric Provider 설정
    mp := metric.NewMeterProvider(
        metric.WithResource(res),
        metric.WithReader(metric.NewPeriodicReader(metricExporter, metric.WithInterval(30*time.Second))),
    )
    otel.SetMeterProvider(mp)
    
    log.Printf("🔍 OpenTelemetry initialized for service: %s", serviceName)
    log.Printf("📊 Traces and metrics will be sent to: %s", otlpEndpoint)
    
    return func() {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        
        if err := tp.Shutdown(ctx); err != nil {
            log.Printf("Error shutting down tracer provider: %v", err)
        }
        if err := mp.Shutdown(ctx); err != nil {
            log.Printf("Error shutting down meter provider: %v", err)
        }
    }
}

func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}
EOF
    
    log_success "Go OpenTelemetry 설정 완료"
    echo -e "${WHITE}사용법:${NC}"
    echo -e "  ./otel-setup.sh                       # 의존성 설치"
    echo -e "  go run . (main.go에서 InitTelemetry() 호출)"
}

# =============================================================================
# 자동 설정 함수
# =============================================================================

auto_setup_otel() {
    local app_path="$1"
    local service_name="${2:-auto-detected-app}"
    local otel_endpoint="${3:-http://localhost:4317}"
    
    print_otel_banner
    
    log_info "OpenTelemetry 자동 설정을 시작합니다..."
    log_info "애플리케이션 경로: $app_path"
    log_info "서비스 이름: $service_name"
    log_info "OTLP 엔드포인트: $otel_endpoint"
    
    if [[ ! -d "$app_path" ]]; then
        log_error "애플리케이션 경로가 존재하지 않습니다: $app_path"
        return 1
    fi
    
    # 애플리케이션 타입 감지
    local app_type=$(detect_application_type "$app_path")
    log_info "감지된 애플리케이션 타입: $app_type"
    
    case "$app_type" in
        "nodejs")
            setup_nodejs_otel "$app_path" "$service_name" "$otel_endpoint"
            ;;
        "java")
            setup_java_otel "$app_path" "$service_name" "$otel_endpoint"
            ;;
        "python")
            setup_python_otel "$app_path" "$service_name" "$otel_endpoint"
            ;;
        "go")
            setup_go_otel "$app_path" "$service_name" "$otel_endpoint"
            ;;
        *)
            log_warn "지원하지 않는 애플리케이션 타입입니다: $app_type"
            log_warn "수동으로 OpenTelemetry를 설정해야 합니다."
            return 1
            ;;
    esac
    
    log_success "OpenTelemetry 자동 설정 완료!"
    
    echo
    echo -e "${WHITE}=== 설정 완료 정보 ===${NC}"
    echo -e "애플리케이션 타입: ${CYAN}$app_type${NC}"
    echo -e "서비스 이름: ${CYAN}$service_name${NC}"
    echo -e "OTLP 엔드포인트: ${CYAN}$otel_endpoint${NC}"
    echo -e "설정 파일 위치: ${CYAN}$app_path${NC}"
    echo
    echo -e "${YELLOW}다음 단계:${NC}"
    echo -e "1. 생성된 시작 스크립트를 사용하여 애플리케이션 실행"
    echo -e "2. AIRIS-MON 대시보드에서 추적 데이터 확인"
    echo -e "3. 필요에 따라 커스텀 계측 코드 추가"
    echo
}

# =============================================================================
# 헬프 함수
# =============================================================================

show_help() {
    echo -e "${WHITE}AIRIS-MON OpenTelemetry 자동 설정 도구${NC}"
    echo
    echo -e "${YELLOW}사용법:${NC}"
    echo -e "  $0 <command> [options]"
    echo
    echo -e "${YELLOW}명령어:${NC}"
    echo -e "  ${GREEN}auto${NC}          자동 감지 및 설정"
    echo -e "  ${GREEN}nodejs${NC}        Node.js 애플리케이션 설정"
    echo -e "  ${GREEN}java${NC}          Java 애플리케이션 설정"
    echo -e "  ${GREEN}python${NC}        Python 애플리케이션 설정"
    echo -e "  ${GREEN}go${NC}            Go 애플리케이션 설정"
    echo -e "  ${GREEN}detect${NC}        애플리케이션 타입 감지만 수행"
    echo
    echo -e "${YELLOW}옵션:${NC}"
    echo -e "  ${GREEN}-p, --path${NC}         애플리케이션 경로"
    echo -e "  ${GREEN}-s, --service${NC}      서비스 이름"
    echo -e "  ${GREEN}-e, --endpoint${NC}     OTLP 엔드포인트"
    echo
    echo -e "${YELLOW}예시:${NC}"
    echo -e "  $0 auto -p /opt/myapp -s my-service -e http://airis:4317"
    echo -e "  $0 nodejs -p /opt/webapp -s web-frontend"
    echo -e "  $0 detect -p /opt/myapp"
    echo
}

# =============================================================================
# 메인 실행 로직
# =============================================================================

main() {
    local command="${1:-help}"
    shift || true
    
    local app_path=""
    local service_name=""
    local otel_endpoint="http://localhost:4317"
    
    # 옵션 파싱
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--path)
                app_path="$2"
                shift 2
                ;;
            -s|--service)
                service_name="$2"
                shift 2
                ;;
            -e|--endpoint)
                otel_endpoint="$2"
                shift 2
                ;;
            *)
                log_error "알 수 없는 옵션: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 기본값 설정
    if [[ -z "$app_path" ]]; then
        app_path="$(pwd)"
    fi
    
    if [[ -z "$service_name" ]]; then
        service_name="$(basename "$app_path")"
    fi
    
    case "$command" in
        "auto")
            auto_setup_otel "$app_path" "$service_name" "$otel_endpoint"
            ;;
        "nodejs")
            setup_nodejs_otel "$app_path" "$service_name" "$otel_endpoint"
            ;;
        "java")
            setup_java_otel "$app_path" "$service_name" "$otel_endpoint"
            ;;
        "python")
            setup_python_otel "$app_path" "$service_name" "$otel_endpoint"
            ;;
        "go")
            setup_go_otel "$app_path" "$service_name" "$otel_endpoint"
            ;;
        "detect")
            local app_type=$(detect_application_type "$app_path")
            echo -e "${CYAN}감지된 애플리케이션 타입: $app_type${NC}"
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