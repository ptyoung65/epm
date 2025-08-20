# AIRIS APM - OpenTelemetry 통합 모니터링 시스템

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-000000?style=for-the-badge&logo=opentelemetry&logoColor=white)](https://opentelemetry.io/)

## 🌟 Overview

AIRIS APM은 OpenTelemetry 기반의 통합 애플리케이션 성능 모니터링(APM) 솔루션입니다. Java와 Python 애플리케이션의 완전한 관찰 가능성(Observability)을 제공하며, 로그, 메트릭, 트레이스, 그리고 세션 리플레이를 통합하여 실시간 모니터링과 분석을 지원합니다.

## 🚀 Key Features

### 🔍 **통합 모니터링**
- **Traces**: 분산 시스템의 요청 흐름 추적
- **Metrics**: 애플리케이션 및 인프라 성능 지표
- **Logs**: 구조화된 로그 집계 및 검색
- **Session Replay**: 브라우저 세션 기록 및 재생

### 📊 **전용 대시보드**
- **애플리케이션 모니터링**: 서비스 성능 및 의존성 분석
- **데이터베이스 모니터링**: 쿼리 성능 및 연결 풀 상태
- **시스템 모니터링**: CPU, 메모리, 디스크, 네트워크 리소스
- **웹 모니터링**: 실사용자 모니터링(RUM) 및 Core Web Vitals
- **J2EE/WAS 모니터링**: Servlet, JSP, EJB 전문 모니터링

### 🎯 **고급 기능**
- **실시간 알림**: 임계치 기반 다채널 알림
- **AIOps**: AI 기반 이상 탐지 및 예측
- **서비스 맵**: 동적 서비스 의존성 시각화
- **에러 추적**: 스택 트레이스 분석 및 영향도 측정

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Dashboards                    │
├─────────────────────────────────────────────────────────────┤
│  App Monitor │ DB Monitor │ System │ Web │ J2EE │ WAS      │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                    OpenTelemetry Stack                      │
├─────────────────────────────────────────────────────────────┤
│  Gateway  │  Collector  │  Monitor API  │  WebSocket       │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                      Data Storage                           │
├─────────────────────────────────────────────────────────────┤
│  ClickHouse (Metrics, Traces, Logs, Session Replay)       │
│  PostgreSQL │ Redis │ MongoDB                             │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                   Sample Applications                       │
├─────────────────────────────────────────────────────────────┤
│  Java (Spring Boot) │ Python (FastAPI) │ Browser SDK      │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Node.js**: 18+ (for development)
- **Java**: 17+ (for Java sample app)
- **Python**: 3.11+ (for Python sample app)

## 🚀 Quick Start

### 1. 전체 시스템 실행

```bash
# 저장소 클론
git clone <repository-url>
cd AIRIS_APM

# 전체 시스템 시작
./scripts/start-all.sh
```

### 2. OpenTelemetry만 실행

```bash
# OpenTelemetry 모니터링 시스템만 시작
./scripts/start-otel.sh
```

### 3. 접속 URL

#### 📊 모니터링 대시보드
- **애플리케이션**: http://localhost:3002/app-monitoring.html
- **데이터베이스**: http://localhost:3002/db-monitoring.html  
- **시스템**: http://localhost:3002/system-monitoring.html
- **웹 & 세션**: http://localhost:3002/web-monitoring.html

#### 🔧 기존 대시보드
- **메인 대시보드**: http://localhost:3002/
- **J2EE 모니터링**: http://localhost:3002/j2ee-dashboard.html
- **WAS 모니터링**: http://localhost:3002/was-dashboard.html

#### ⚙️ API & Services
- **OpenTelemetry API**: http://localhost:3013/api
- **Sample Java App**: http://localhost:8080
- **Sample Python App**: http://localhost:8081
- **ClickHouse**: http://localhost:8123

## 🛠️ Sample Applications

### Java Application (Spring Boot)
```bash
# 직접 실행
cd sample-apps/java-app
mvn spring-boot:run

# API 테스트
curl http://localhost:8080/api/orders
curl http://localhost:8080/api/orders -X POST -H "Content-Type: application/json" -d '{"customerName":"John","productName":"Laptop","quantity":1,"price":1299.99}'
```

### Python Application (FastAPI)
```bash
# 직접 실행
cd sample-apps/python-app
pip install -r requirements.txt
python main.py

# API 테스트
curl http://localhost:8081/api/products
curl http://localhost:8081/api/products -X POST -H "Content-Type: application/json" -d '{"name":"Monitor","description":"4K Display","price":599.99,"quantity":10,"category":"Electronics"}'
```

## 📊 Data Schema

### ClickHouse Tables
- **otel_traces**: 분산 트레이싱 데이터
- **otel_metrics_*****: 메트릭 데이터 (gauge, sum, histogram 등)
- **otel_logs**: 구조화된 로그 데이터
- **browser_sessions**: 브라우저 세션 정보
- **session_replay_events**: 세션 리플레이 이벤트
- **browser_errors**: 브라우저 에러 정보

### Materialized Views
- **service_performance_mv**: 서비스별 성능 요약
- **service_dependencies_mv**: 서비스 의존성 분석
- **error_analysis_mv**: 에러 분석 집계

## 🔧 Configuration

### OpenTelemetry Collector
```yaml
# opentelemetry/collector/otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

exporters:
  clickhouse:
    endpoint: tcp://clickhouse:9000?database=otel
    ttl_days: 30
```

### Sample Application Configuration
```yaml
# Java (application.yml)
otel:
  service:
    name: java-sample-app
  exporter:
    otlp:
      endpoint: http://otel-collector:4317

# Python (environment variables)
OTEL_SERVICE_NAME=python-sample-app
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
```

## 🚨 Monitoring & Alerting

### Real-time Metrics
- **처리량**: 분당 요청 수
- **응답시간**: P50, P95, P99 백분위수
- **에러율**: 서비스별 에러 발생률
- **리소스 사용률**: CPU, 메모리, 디스크, 네트워크

### Alert Configuration
```javascript
// 예시: 높은 에러율 알림
{
  "name": "High Error Rate",
  "condition": "error_rate > 5%",
  "duration": "5m",
  "channels": ["slack", "email", "webhook"]
}
```

## 🐛 Troubleshooting

### Common Issues

1. **서비스 시작 실패**
   ```bash
   # 로그 확인
   docker logs <container-name>
   
   # 서비스 상태 확인
   curl http://localhost:13133/health
   ```

2. **데이터 수집 안됨**
   ```bash
   # OpenTelemetry Collector 상태 확인
   curl http://localhost:8888/metrics
   
   # ClickHouse 연결 확인
   docker exec -it clickhouse clickhouse-client --query "SELECT COUNT(*) FROM otel.otel_traces"
   ```

3. **메모리 부족**
   ```bash
   # Docker 리소스 제한 조정
   # docker-compose.yml에서 memory 설정 증가
   ```

## 📈 Performance Tuning

### ClickHouse Optimization
```sql
-- 인덱스 최적화
ALTER TABLE otel_traces ADD INDEX idx_service_timestamp (service_name, timestamp) TYPE minmax GRANULARITY 1;

-- 파티셔닝 정책 조정
ALTER TABLE otel_traces MODIFY TTL timestamp + INTERVAL 30 DAY;
```

### OpenTelemetry Configuration
```yaml
# 배치 처리 최적화
processors:
  batch:
    timeout: 1s
    send_batch_size: 2048
    send_batch_max_size: 4096
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenTelemetry](https://opentelemetry.io/) - Open source observability framework
- [ClickHouse](https://clickhouse.com/) - Real-time analytics database
- [Spring Boot](https://spring.io/projects/spring-boot) - Java application framework
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework

## 📞 Support

For support and questions:
- 📧 Email: support@airis-apm.com
- 📱 Issues: [GitHub Issues](https://github.com/your-repo/airis-apm/issues)
- 📖 Documentation: [Wiki](https://github.com/your-repo/airis-apm/wiki)

---

**Made with ❤️ for the observability community**