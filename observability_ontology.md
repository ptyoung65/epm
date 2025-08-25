# APM 및 옵저빌리티 온톨로지 (Observability Ontology)

## 1. 네임스페이스 정의 (Namespace Definitions)

```turtle
@prefix obs: <http://example.org/ontology/observability#> .
@prefix apm: <http://example.org/ontology/apm#> .
@prefix infra: <http://example.org/ontology/infrastructure#> .
@prefix perf: <http://example.org/ontology/performance#> .
@prefix fault: <http://example.org/ontology/fault#> .
@prefix log: <http://example.org/ontology/logging#> .
@prefix metric: <http://example.org/ontology/metrics#> .
@prefix trace: <http://example.org/ontology/tracing#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix time: <http://www.w3.org/2006/time#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
```

## 2. 핵심 클래스 계층 구조 (Core Class Hierarchy)

### 2.1 최상위 개념들 (Top-level Concepts)

```turtle
# 기본 엔터티
obs:ObservabilityEntity a owl:Class ;
    rdfs:label "Observability Entity"@en, "옵저빌리티 엔터티"@ko ;
    rdfs:comment "모든 관찰 가능한 시스템 구성요소의 상위 클래스"@ko .

# 시스템 구성요소
infra:SystemComponent a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "System Component"@en, "시스템 구성요소"@ko .

infra:Application a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Application"@en, "애플리케이션"@ko .

infra:WebApplication a owl:Class ;
    rdfs:subClassOf infra:Application ;
    rdfs:label "Web Application"@en, "웹 애플리케이션"@ko .

infra:WebApplicationServer a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "WAS"@en, "웹 애플리케이션 서버"@ko ;
    rdfs:comment "Tomcat, JBoss, WebLogic, WebSphere 등"@ko .

infra:Database a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Database"@en, "데이터베이스"@ko .

infra:DatabaseManagementSystem a owl:Class ;
    rdfs:subClassOf infra:Database ;
    rdfs:label "DBMS"@en, "데이터베이스 관리 시스템"@ko .
```

### 2.2 관찰 데이터 타입 (Observability Data Types)

```turtle
# 세 가지 기본 관찰 데이터 타입 (Three Pillars of Observability)
obs:ObservabilityData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Observability Data"@en, "관찰 데이터"@ko .

log:LogData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Log Data"@en, "로그 데이터"@ko .

metric:MetricData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Metric Data"@en, "메트릭 데이터"@ko .

trace:TraceData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Trace Data"@en, "트레이스 데이터"@ko .

# 로그 세부 분류
log:ApplicationLog a owl:Class ;
    rdfs:subClassOf log:LogData ;
    rdfs:label "Application Log"@en, "애플리케이션 로그"@ko .

log:AccessLog a owl:Class ;
    rdfs:subClassOf log:LogData ;
    rdfs:label "Access Log"@en, "접근 로그"@ko .

log:ErrorLog a owl:Class ;
    rdfs:subClassOf log:LogData ;
    rdfs:label "Error Log"@en, "에러 로그"@ko .

log:SecurityLog a owl:Class ;
    rdfs:subClassOf log:LogData ;
    rdfs:label "Security Log"@en, "보안 로그"@ko .

log:AuditLog a owl:Class ;
    rdfs:subClassOf log:LogData ;
    rdfs:label "Audit Log"@en, "감사 로그"@ko .

# 메트릭 세부 분류
metric:PerformanceMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Performance Metric"@en, "성능 메트릭"@ko .

metric:ResourceUtilizationMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Resource Utilization Metric"@en, "자원 사용률 메트릭"@ko .

metric:BusinessMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Business Metric"@en, "비즈니스 메트릭"@ko .

# 트레이스 세부 분류
trace:DistributedTrace a owl:Class ;
    rdfs:subClassOf trace:TraceData ;
    rdfs:label "Distributed Trace"@en, "분산 트레이스"@ko .

trace:Span a owl:Class ;
    rdfs:subClassOf trace:TraceData ;
    rdfs:label "Span"@en, "스팬"@ko .
```

### 2.3 성능 및 장애 관련 클래스

```turtle
# 성능 관련
perf:PerformanceIndicator a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Performance Indicator"@en, "성능 지표"@ko .

perf:ResponseTime a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Response Time"@en, "응답 시간"@ko .

perf:Throughput a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Throughput"@en, "처리량"@ko .

perf:ResourceUtilization a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Resource Utilization"@en, "자원 사용률"@ko .

perf:CPUUtilization a owl:Class ;
    rdfs:subClassOf perf:ResourceUtilization ;
    rdfs:label "CPU Utilization"@en, "CPU 사용률"@ko .

perf:MemoryUtilization a owl:Class ;
    rdfs:subClassOf perf:ResourceUtilization ;
    rdfs:label "Memory Utilization"@en, "메모리 사용률"@ko .

perf:DiskUtilization a owl:Class ;
    rdfs:subClassOf perf:ResourceUtilization ;
    rdfs:label "Disk Utilization"@en, "디스크 사용률"@ko .

perf:NetworkUtilization a owl:Class ;
    rdfs:subClassOf perf:ResourceUtilization ;
    rdfs:label "Network Utilization"@en, "네트워크 사용률"@ko .

# 장애 관련
fault:Fault a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Fault"@en, "장애"@ko .

fault:SystemFailure a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "System Failure"@en, "시스템 장애"@ko .

fault:ApplicationError a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Application Error"@en, "애플리케이션 오류"@ko .

fault:DatabaseError a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Database Error"@en, "데이터베이스 오류"@ko .

fault:NetworkError a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Network Error"@en, "네트워크 오류"@ko .

# 장애 심각도
fault:CriticalFault a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Critical Fault"@en, "심각한 장애"@ko .

fault:MajorFault a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Major Fault"@en, "주요 장애"@ko .

fault:MinorFault a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Minor Fault"@en, "경미한 장애"@ko .

fault:WarningFault a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Warning Fault"@en, "경고성 장애"@ko .
```

## 3. 속성 정의 (Property Definitions)

### 3.1 객체 속성 (Object Properties)

```turtle
# 시스템 관계
obs:belongsTo a owl:ObjectProperty ;
    rdfs:label "belongs to"@en, "~에 속함"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range infra:SystemComponent .

obs:generates a owl:ObjectProperty ;
    rdfs:label "generates"@en, "생성함"@ko ;
    rdfs:domain infra:SystemComponent ;
    rdfs:range obs:ObservabilityData .

obs:monitors a owl:ObjectProperty ;
    rdfs:label "monitors"@en, "모니터링함"@ko ;
    rdfs:domain apm:MonitoringTool ;
    rdfs:range infra:SystemComponent .

# 트레이스 관계
trace:hasSpan a owl:ObjectProperty ;
    rdfs:label "has span"@en, "스팬을 가짐"@ko ;
    rdfs:domain trace:DistributedTrace ;
    rdfs:range trace:Span .

trace:parentSpan a owl:ObjectProperty ;
    rdfs:label "parent span"@en, "부모 스팬"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range trace:Span .

trace:childSpan a owl:ObjectProperty ;
    rdfs:label "child span"@en, "자식 스팬"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range trace:Span ;
    owl:inverseOf trace:parentSpan .

# 장애 관계
fault:causes a owl:ObjectProperty ;
    rdfs:label "causes"@en, "원인이 됨"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range fault:Fault .

fault:affects a owl:ObjectProperty ;
    rdfs:label "affects"@en, "영향을 줌"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range infra:SystemComponent .

# 성능 관계
perf:measures a owl:ObjectProperty ;
    rdfs:label "measures"@en, "측정함"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range infra:SystemComponent .

perf:correlatedWith a owl:ObjectProperty ;
    rdfs:label "correlated with"@en, "상관관계 있음"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range perf:PerformanceIndicator .
```

### 3.2 데이터 속성 (Data Properties)

```turtle
# 시간 관련
obs:timestamp a owl:DatatypeProperty ;
    rdfs:label "timestamp"@en, "타임스탬프"@ko ;
    rdfs:domain obs:ObservabilityData ;
    rdfs:range xsd:dateTime .

obs:duration a owl:DatatypeProperty ;
    rdfs:label "duration"@en, "지속시간"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range xsd:duration .

# 식별 관련
obs:id a owl:DatatypeProperty ;
    rdfs:label "identifier"@en, "식별자"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range xsd:string .

obs:name a owl:DatatypeProperty ;
    rdfs:label "name"@en, "이름"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range xsd:string .

obs:version a owl:DatatypeProperty ;
    rdfs:label "version"@en, "버전"@ko ;
    rdfs:domain infra:SystemComponent ;
    rdfs:range xsd:string .

# 로그 관련
log:logLevel a owl:DatatypeProperty ;
    rdfs:label "log level"@en, "로그 레벨"@ko ;
    rdfs:domain log:LogData ;
    rdfs:range xsd:string .

log:message a owl:DatatypeProperty ;
    rdfs:label "message"@en, "메시지"@ko ;
    rdfs:domain log:LogData ;
    rdfs:range xsd:string .

log:sourceFile a owl:DatatypeProperty ;
    rdfs:label "source file"@en, "소스 파일"@ko ;
    rdfs:domain log:LogData ;
    rdfs:range xsd:string .

log:lineNumber a owl:DatatypeProperty ;
    rdfs:label "line number"@en, "라인 번호"@ko ;
    rdfs:domain log:LogData ;
    rdfs:range xsd:int .

# 메트릭 관련
metric:value a owl:DatatypeProperty ;
    rdfs:label "value"@en, "값"@ko ;
    rdfs:domain metric:MetricData ;
    rdfs:range xsd:double .

metric:unit a owl:DatatypeProperty ;
    rdfs:label "unit"@en, "단위"@ko ;
    rdfs:domain metric:MetricData ;
    rdfs:range xsd:string .

metric:metricType a owl:DatatypeProperty ;
    rdfs:label "metric type"@en, "메트릭 타입"@ko ;
    rdfs:domain metric:MetricData ;
    rdfs:range xsd:string .

# 트레이스 관련
trace:traceId a owl:DatatypeProperty ;
    rdfs:label "trace ID"@en, "트레이스 ID"@ko ;
    rdfs:domain trace:TraceData ;
    rdfs:range xsd:string .

trace:spanId a owl:DatatypeProperty ;
    rdfs:label "span ID"@en, "스팬 ID"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range xsd:string .

trace:operationName a owl:DatatypeProperty ;
    rdfs:label "operation name"@en, "작업명"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range xsd:string .

# 장애 관련
fault:severity a owl:DatatypeProperty ;
    rdfs:label "severity"@en, "심각도"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:string .

fault:errorCode a owl:DatatypeProperty ;
    rdfs:label "error code"@en, "오류 코드"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:string .

fault:errorMessage a owl:DatatypeProperty ;
    rdfs:label "error message"@en, "오류 메시지"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:string .

fault:resolution a owl:DatatypeProperty ;
    rdfs:label "resolution"@en, "해결방법"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:string .

# 성능 관련
perf:threshold a owl:DatatypeProperty ;
    rdfs:label "threshold"@en, "임계값"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range xsd:double .

perf:averageValue a owl:DatatypeProperty ;
    rdfs:label "average value"@en, "평균값"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range xsd:double .

perf:maxValue a owl:DatatypeProperty ;
    rdfs:label "maximum value"@en, "최대값"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range xsd:double .

perf:minValue a owl:DatatypeProperty ;
    rdfs:label "minimum value"@en, "최소값"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range xsd:double .
```

## 4. APM 도구 및 기술 스택

```turtle
# APM 도구
apm:MonitoringTool a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Monitoring Tool"@en, "모니터링 도구"@ko .

apm:APMTool a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "APM Tool"@en, "APM 도구"@ko .

# 구체적인 APM 도구들
apm:NewRelic a owl:Class ;
    rdfs:subClassOf apm:APMTool ;
    rdfs:label "New Relic" .

apm:Dynatrace a owl:Class ;
    rdfs:subClassOf apm:APMTool ;
    rdfs:label "Dynatrace" .

apm:AppDynamics a owl:Class ;
    rdfs:subClassOf apm:APMTool ;
    rdfs:label "AppDynamics" .

apm:Datadog a owl:Class ;
    rdfs:subClassOf apm:APMTool ;
    rdfs:label "Datadog" .

# 오픈소스 도구들
apm:Prometheus a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Prometheus" .

apm:Grafana a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Grafana" .

apm:ElasticStack a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Elastic Stack" .

apm:Jaeger a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Jaeger" .

apm:Zipkin a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Zipkin" .

# WAS 종류
infra:Tomcat a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Apache Tomcat" .

infra:JBoss a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "JBoss" .

infra:WebLogic a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Oracle WebLogic" .

infra:WebSphere a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "IBM WebSphere" .

# DBMS 종류
infra:MySQL a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "MySQL" .

infra:PostgreSQL a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "PostgreSQL" .

infra:Oracle a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "Oracle Database" .

infra:SQLServer a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "Microsoft SQL Server" .

infra:MongoDB a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "MongoDB" .
```

## 5. 실용적인 인스턴스 예시

```turtle
# 실제 시스템 예시
:WebServer01 a infra:Tomcat ;
    obs:name "Web Server 01" ;
    obs:version "9.0.65" ;
    perf:measures :CPUUsage01, :MemoryUsage01 .

:DatabaseServer01 a infra:MySQL ;
    obs:name "Main Database Server" ;
    obs:version "8.0.30" ;
    perf:measures :QueryResponseTime01 .

# 성능 메트릭 예시
:CPUUsage01 a perf:CPUUtilization ;
    metric:value 85.5 ;
    metric:unit "percent" ;
    obs:timestamp "2024-01-15T14:30:00Z"^^xsd:dateTime ;
    perf:threshold 80.0 .

:QueryResponseTime01 a perf:ResponseTime ;
    metric:value 250.0 ;
    metric:unit "milliseconds" ;
    obs:timestamp "2024-01-15T14:30:00Z"^^xsd:dateTime ;
    perf:threshold 200.0 .

# 장애 예시
:DatabaseConnectionError01 a fault:DatabaseError ;
    fault:severity "Critical" ;
    fault:errorCode "CONNECTION_TIMEOUT" ;
    fault:errorMessage "Database connection timeout after 30 seconds" ;
    obs:timestamp "2024-01-15T14:35:00Z"^^xsd:dateTime ;
    fault:affects :DatabaseServer01 .

# 로그 예시
:ErrorLog001 a log:ErrorLog ;
    log:logLevel "ERROR" ;
    log:message "Failed to connect to database: Connection timeout" ;
    log:sourceFile "DatabaseConnection.java" ;
    log:lineNumber 245 ;
    obs:timestamp "2024-01-15T14:35:00Z"^^xsd:dateTime ;
    obs:belongsTo :WebServer01 .

# 트레이스 예시
:Trace001 a trace:DistributedTrace ;
    trace:traceId "abc123def456" ;
    trace:hasSpan :Span001, :Span002 .

:Span001 a trace:Span ;
    trace:spanId "span001" ;
    trace:operationName "HTTP GET /api/users" ;
    obs:duration "PT0.250S"^^xsd:duration ;
    trace:childSpan :Span002 .

:Span002 a trace:Span ;
    trace:spanId "span002" ;
    trace:operationName "Database Query: SELECT * FROM users" ;
    obs:duration "PT0.200S"^^xsd:duration ;
    trace:parentSpan :Span001 .
```

## 6. 추론 규칙 예시

```turtle
# 성능 임계값 초과 시 경고 생성
[ a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      perf:PerformanceIndicator
      [ a owl:Restriction ;
        owl:onProperty metric:value ;
        owl:someValuesFrom [
          a rdfs:Datatype ;
          owl:onDatatype xsd:double ;
          owl:withRestrictions (
            [ xsd:minExclusive ?threshold ]
          )
        ]
      ]
    )
  ]
] rdfs:subClassOf fault:WarningFault .

# 장애 전파 규칙
fault:DatabaseError rdfs:subClassOf [
  a owl:Restriction ;
  owl:onProperty fault:affects ;
  owl:someValuesFrom infra:WebApplicationServer
] .
```

## 7. 활용 시나리오

### 7.1 쿼리 예시 (SPARQL)

```sparql
# 높은 CPU 사용률을 보이는 서버 찾기
SELECT ?server ?cpu_value
WHERE {
  ?server a infra:SystemComponent .
  ?server perf:measures ?cpu_metric .
  ?cpu_metric a perf:CPUUtilization .
  ?cpu_metric metric:value ?cpu_value .
  ?cpu_metric perf:threshold ?threshold .
  FILTER (?cpu_value > ?threshold)
}

# 특정 시간대의 에러 로그 조회
SELECT ?log ?message ?timestamp
WHERE {
  ?log a log:ErrorLog .
  ?log log:message ?message .
  ?log obs:timestamp ?timestamp .
  FILTER (?timestamp >= "2024-01-15T14:00:00Z"^^xsd:dateTime &&
          ?timestamp <= "2024-01-15T15:00:00Z"^^xsd:dateTime)
}

# 트레이스의 전체 수행 시간 계산
SELECT ?trace (SUM(?span_duration) AS ?total_duration)
WHERE {
  ?trace a trace:DistributedTrace .
  ?trace trace:hasSpan ?span .
  ?span obs:duration ?span_duration .
}
GROUP BY ?trace
```

### 7.2 확장 가능성

이 온톨로지는 다음과 같이 확장 가능합니다:

1. **클라우드 네이티브 환경**: Kubernetes, Docker 컨테이너 관련 클래스 추가
2. **마이크로서비스 아키텍처**: 서비스 메시, API 게이트웨이 관련 개념 확장
3. **보안 모니터링**: 보안 이벤트, 위협 탐지 관련 클래스 추가
4. **비즈니스 메트릭**: SLA, KPI 관련 성능 지표 확장
5. **머신러닝**: 이상 탐지, 예측 분석 관련 개념 추가

# 8. 클라우드 네이티브 환경 확장

```turtle
# 네임스페이스 추가
@prefix cloud: <http://example.org/ontology/cloud#> .
@prefix k8s: <http://example.org/ontology/kubernetes#> .
@prefix container: <http://example.org/ontology/container#> .

# 클라우드 인프라
cloud:CloudInfrastructure a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Cloud Infrastructure"@en, "클라우드 인프라"@ko .

cloud:PublicCloud a owl:Class ;
    rdfs:subClassOf cloud:CloudInfrastructure ;
    rdfs:label "Public Cloud"@en, "퍼블릭 클라우드"@ko .

cloud:PrivateCloud a owl:Class ;
    rdfs:subClassOf cloud:CloudInfrastructure ;
    rdfs:label "Private Cloud"@en, "프라이빗 클라우드"@ko .

cloud:HybridCloud a owl:Class ;
    rdfs:subClassOf cloud:CloudInfrastructure ;
    rdfs:label "Hybrid Cloud"@en, "하이브리드 클라우드"@ko .

# 클라우드 프로바이더
cloud:AWS a owl:Class ;
    rdfs:subClassOf cloud:PublicCloud ;
    rdfs:label "Amazon Web Services" .

cloud:Azure a owl:Class ;
    rdfs:subClassOf cloud:PublicCloud ;
    rdfs:label "Microsoft Azure" .

cloud:GCP a owl:Class ;
    rdfs:subClassOf cloud:PublicCloud ;
    rdfs:label "Google Cloud Platform" .

# 컨테이너 기술
container:Container a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Container"@en, "컨테이너"@ko .

container:DockerContainer a owl:Class ;
    rdfs:subClassOf container:Container ;
    rdfs:label "Docker Container"@en, "도커 컨테이너"@ko .

container:ContainerImage a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Container Image"@en, "컨테이너 이미지"@ko .

container:ContainerRegistry a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Container Registry"@en, "컨테이너 레지스트리"@ko .

# Kubernetes 관련
k8s:KubernetesCluster a owl:Class ;
    rdfs:subClassOf cloud:CloudInfrastructure ;
    rdfs:label "Kubernetes Cluster"@en, "쿠버네티스 클러스터"@ko .

k8s:Node a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Kubernetes Node"@en, "쿠버네티스 노드"@ko .

k8s:MasterNode a owl:Class ;
    rdfs:subClassOf k8s:Node ;
    rdfs:label "Master Node"@en, "마스터 노드"@ko .

k8s:WorkerNode a owl:Class ;
    rdfs:subClassOf k8s:Node ;
    rdfs:label "Worker Node"@en, "워커 노드"@ko .

k8s:Pod a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Pod"@en, "파드"@ko .

k8s:Service a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Kubernetes Service"@en, "쿠버네티스 서비스"@ko .

k8s:Deployment a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Deployment"@en, "디플로이먼트"@ko .

k8s:ConfigMap a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "ConfigMap"@en, "컨피그맵"@ko .

k8s:Secret a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Secret"@en, "시크릿"@ko .

k8s:Namespace a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Namespace"@en, "네임스페이스"@ko .

# 클라우드 네이티브 속성
container:imageTag a owl:DatatypeProperty ;
    rdfs:label "image tag"@en, "이미지 태그"@ko ;
    rdfs:domain container:ContainerImage ;
    rdfs:range xsd:string .

k8s:podStatus a owl:DatatypeProperty ;
    rdfs:label "pod status"@en, "파드 상태"@ko ;
    rdfs:domain k8s:Pod ;
    rdfs:range xsd:string .

k8s:replicas a owl:DatatypeProperty ;
    rdfs:label "replicas"@en, "레플리카 수"@ko ;
    rdfs:domain k8s:Deployment ;
    rdfs:range xsd:int .

cloud:region a owl:DatatypeProperty ;
    rdfs:label "region"@en, "리전"@ko ;
    rdfs:domain cloud:CloudInfrastructure ;
    rdfs:range xsd:string .

cloud:availabilityZone a owl:DatatypeProperty ;
    rdfs:label "availability zone"@en, "가용 영역"@ko ;
    rdfs:domain cloud:CloudInfrastructure ;
    rdfs:range xsd:string .
```

# 9. 마이크로서비스 아키텍처 확장

```turtle
# 네임스페이스 추가
@prefix micro: <http://example.org/ontology/microservices#> .
@prefix api: <http://example.org/ontology/api#> .
@prefix mesh: <http://example.org/ontology/servicemesh#> .

# 마이크로서비스
micro:Microservice a owl:Class ;
    rdfs:subClassOf infra:Application ;
    rdfs:label "Microservice"@en, "마이크로서비스"@ko .

micro:ServiceRegistry a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Service Registry"@en, "서비스 레지스트리"@ko .

micro:ConfigurationService a owl:Class ;
    rdfs:subClassOf micro:Microservice ;
    rdfs:label "Configuration Service"@en, "설정 서비스"@ko .

micro:CircuitBreaker a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Circuit Breaker"@en, "서킷 브레이커"@ko .

# API 관리
api:APIGateway a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "API Gateway"@en, "API 게이트웨이"@ko .

api:APIEndpoint a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "API Endpoint"@en, "API 엔드포인트"@ko .

api:RESTfulAPI a owl:Class ;
    rdfs:subClassOf api:APIEndpoint ;
    rdfs:label "RESTful API"@en, "RESTful API"@ko .

api:GraphQLAPI a owl:Class ;
    rdfs:subClassOf api:APIEndpoint ;
    rdfs:label "GraphQL API"@en, "GraphQL API"@ko .

api:RateLimiter a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Rate Limiter"@en, "레이트 리미터"@ko .

# 서비스 메시
mesh:ServiceMesh a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Service Mesh"@en, "서비스 메시"@ko .

mesh:Istio a owl:Class ;
    rdfs:subClassOf mesh:ServiceMesh ;
    rdfs:label "Istio" .

mesh:Linkerd a owl:Class ;
    rdfs:subClassOf mesh:ServiceMesh ;
    rdfs:label "Linkerd" .

mesh:Consul a owl:Class ;
    rdfs:subClassOf mesh:ServiceMesh ;
    rdfs:label "Consul Connect" .

mesh:Sidecar a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Sidecar Proxy"@en, "사이드카 프록시"@ko .

mesh:Envoy a owl:Class ;
    rdfs:subClassOf mesh:Sidecar ;
    rdfs:label "Envoy Proxy" .

# 마이크로서비스 속성
micro:serviceVersion a owl:DatatypeProperty ;
    rdfs:label "service version"@en, "서비스 버전"@ko ;
    rdfs:domain micro:Microservice ;
    rdfs:range xsd:string .

api:httpMethod a owl:DatatypeProperty ;
    rdfs:label "HTTP method"@en, "HTTP 메서드"@ko ;
    rdfs:domain api:APIEndpoint ;
    rdfs:range xsd:string .

api:rateLimitValue a owl:DatatypeProperty ;
    rdfs:label "rate limit value"@en, "레이트 리미트 값"@ko ;
    rdfs:domain api:RateLimiter ;
    rdfs:range xsd:int .

micro:circuitState a owl:DatatypeProperty ;
    rdfs:label "circuit state"@en, "서킷 상태"@ko ;
    rdfs:domain micro:CircuitBreaker ;
    rdfs:range xsd:string .

# 마이크로서비스 관계
micro:dependsOn a owl:ObjectProperty ;
    rdfs:label "depends on"@en, "의존함"@ko ;
    rdfs:domain micro:Microservice ;
    rdfs:range micro:Microservice .

micro:communicatesWith a owl:ObjectProperty ;
    rdfs:label "communicates with"@en, "통신함"@ko ;
    rdfs:domain micro:Microservice ;
    rdfs:range micro:Microservice .

api:exposesAPI a owl:ObjectProperty ;
    rdfs:label "exposes API"@en, "API 노출함"@ko ;
    rdfs:domain micro:Microservice ;
    rdfs:range api:APIEndpoint .
```

# 10. 보안 모니터링 확장

```turtle
# 네임스페이스 추가
@prefix sec: <http://example.org/ontology/security#> .
@prefix threat: <http://example.org/ontology/threat#> .
@prefix vuln: <http://example.org/ontology/vulnerability#> .

# 보안 이벤트
sec:SecurityEvent a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Security Event"@en, "보안 이벤트"@ko .

sec:AuthenticationEvent a owl:Class ;
    rdfs:subClassOf sec:SecurityEvent ;
    rdfs:label "Authentication Event"@en, "인증 이벤트"@ko .

sec:AuthorizationEvent a owl:Class ;
    rdfs:subClassOf sec:SecurityEvent ;
    rdfs:label "Authorization Event"@en, "권한 이벤트"@ko .

sec:AccessDeniedEvent a owl:Class ;
    rdfs:subClassOf sec:SecurityEvent ;
    rdfs:label "Access Denied Event"@en, "접근 거부 이벤트"@ko .

sec:PrivilegeEscalationEvent a owl:Class ;
    rdfs:subClassOf sec:SecurityEvent ;
    rdfs:label "Privilege Escalation Event"@en, "권한 상승 이벤트"@ko .

# 위협 탐지
threat:Threat a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Threat"@en, "위협"@ko .

threat:Malware a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Malware"@en, "악성코드"@ko .

threat:DDoSAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "DDoS Attack"@en, "DDoS 공격"@ko .

threat:SQLInjection a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "SQL Injection"@en, "SQL 인젝션"@ko .

threat:XSSAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "XSS Attack"@en, "XSS 공격"@ko .

threat:BruteForceAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Brute Force Attack"@en, "무차별 대입 공격"@ko .

threat:InsiderThreat a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Insider Threat"@en, "내부자 위협"@ko .

threat:APTAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "APT Attack"@en, "지능형 지속 위협"@ko .

# 취약점
vuln:Vulnerability a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Vulnerability"@en, "취약점"@ko .

vuln:CVSSScore a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "CVSS Score"@en, "CVSS 점수"@ko .

vuln:ZeroDayVulnerability a owl:Class ;
    rdfs:subClassOf vuln:Vulnerability ;
    rdfs:label "Zero-day Vulnerability"@en, "제로데이 취약점"@ko .

# 보안 도구
sec:SIEM a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "SIEM"@en, "보안 정보 이벤트 관리"@ko .

sec:IDS a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "IDS"@en, "침입 탐지 시스템"@ko .

sec:IPS a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "IPS"@en, "침입 방지 시스템"@ko .

sec:EDR a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "EDR"@en, "엔드포인트 탐지 및 대응"@ko .

# 보안 속성
sec:attackVector a owl:DatatypeProperty ;
    rdfs:label "attack vector"@en, "공격 벡터"@ko ;
    rdfs:domain threat:Threat ;
    rdfs:range xsd:string .

sec:severityLevel a owl:DatatypeProperty ;
    rdfs:label "severity level"@en, "심각도 레벨"@ko ;
    rdfs:domain sec:SecurityEvent ;
    rdfs:range xsd:string .

vuln:cveId a owl:DatatypeProperty ;
    rdfs:label "CVE ID"@en, "CVE 식별자"@ko ;
    rdfs:domain vuln:Vulnerability ;
    rdfs:range xsd:string .

vuln:cvssScore a owl:DatatypeProperty ;
    rdfs:label "CVSS score"@en, "CVSS 점수"@ko ;
    rdfs:domain vuln:CVSSScore ;
    rdfs:range xsd:double .

sec:sourceIP a owl:DatatypeProperty ;
    rdfs:label "source IP"@en, "발신 IP"@ko ;
    rdfs:domain sec:SecurityEvent ;
    rdfs:range xsd:string .

sec:destinationIP a owl:DatatypeProperty ;
    rdfs:label "destination IP"@en, "목적지 IP"@ko ;
    rdfs:domain sec:SecurityEvent ;
    rdfs:range xsd:string .

# 보안 관계
threat:exploits a owl:ObjectProperty ;
    rdfs:label "exploits"@en, "악용함"@ko ;
    rdfs:domain threat:Threat ;
    rdfs:range vuln:Vulnerability .

sec:detects a owl:ObjectProperty ;
    rdfs:label "detects"@en, "탐지함"@ko ;
    rdfs:domain sec:SIEM ;
    rdfs:range threat:Threat .
```

# 11. 비즈니스 메트릭 확장

```turtle
# 네임스페이스 추가
@prefix biz: <http://example.org/ontology/business#> .
@prefix sla: <http://example.org/ontology/sla#> .
@prefix kpi: <http://example.org/ontology/kpi#> .

# 비즈니스 메트릭
biz:BusinessMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Business Metric"@en, "비즈니스 메트릭"@ko .

biz:RevenueMetric a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "Revenue Metric"@en, "매출 메트릭"@ko .

biz:CustomerMetric a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "Customer Metric"@en, "고객 메트릭"@ko .

biz:ConversionRate a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "Conversion Rate"@en, "전환율"@ko .

biz:UserEngagement a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "User Engagement"@en, "사용자 참여도"@ko .

# SLA 관련
sla:ServiceLevelAgreement a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "SLA"@en, "서비스 수준 협약"@ko .

sla:ServiceLevelObjective a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "SLO"@en, "서비스 수준 목표"@ko .

sla:ServiceLevelIndicator a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "SLI"@en, "서비스 수준 지표"@ko .

sla:AvailabilitySLA a owl:Class ;
    rdfs:subClassOf sla:ServiceLevelAgreement ;
    rdfs:label "Availability SLA"@en, "가용성 SLA"@ko .

sla:PerformanceSLA a owl:Class ;
    rdfs:subClassOf sla:ServiceLevelAgreement ;
    rdfs:label "Performance SLA"@en, "성능 SLA"@ko .

sla:ErrorBudget a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Error Budget"@en, "오류 예산"@ko .

# KPI
kpi:KeyPerformanceIndicator a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "KPI"@en, "핵심 성과 지표"@ko .

kpi:TechnicalKPI a owl:Class ;
    rdfs:subClassOf kpi:KeyPerformanceIndicator ;
    rdfs:label "Technical KPI"@en, "기술적 KPI"@ko .

kpi:BusinessKPI a owl:Class ;
    rdfs:subClassOf kpi:KeyPerformanceIndicator ;
    rdfs:label "Business KPI"@en, "비즈니스 KPI"@ko .

kpi:MTTR a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "MTTR"@en, "평균 복구 시간"@ko .

kpi:MTBF a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "MTBF"@en, "평균 장애 간격"@ko .

kpi:Uptime a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "Uptime"@en, "가동 시간"@ko .

# 비즈니스 속성
sla:targetValue a owl:DatatypeProperty ;
    rdfs:label "target value"@en, "목표값"@ko ;
    rdfs:domain sla:ServiceLevelObjective ;
    rdfs:range xsd:double .

sla:actualValue a owl:DatatypeProperty ;
    rdfs:label "actual value"@en, "실제값"@ko ;
    rdfs:domain sla:ServiceLevelIndicator ;
    rdfs:range xsd:double .

sla:complianceLevel a owl:DatatypeProperty ;
    rdfs:label "compliance level"@en, "준수 수준"@ko ;
    rdfs:domain sla:ServiceLevelAgreement ;
    rdfs:range xsd:double .

biz:businessImpact a owl:DatatypeProperty ;
    rdfs:label "business impact"@en, "비즈니스 영향도"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:string .

kpi:targetKPI a owl:DatatypeProperty ;
    rdfs:label "target KPI"@en, "목표 KPI"@ko ;
    rdfs:domain kpi:KeyPerformanceIndicator ;
    rdfs:range xsd:double .

# 비즈니스 관계
sla:governs a owl:ObjectProperty ;
    rdfs:label "governs"@en, "관리함"@ko ;
    rdfs:domain sla:ServiceLevelAgreement ;
    rdfs:range infra:SystemComponent .

biz:impacts a owl:ObjectProperty ;
    rdfs:label "impacts"@en, "영향을 줌"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range biz:BusinessMetric .
```

# 12. 머신러닝 확장

```turtle
# 네임스페이스 추가
@prefix ml: <http://example.org/ontology/machinelearning#> .
@prefix ai: <http://example.org/ontology/ai#> .
@prefix anomaly: <http://example.org/ontology/anomaly#> .

# 머신러닝 모델
ml:MachineLearningModel a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "ML Model"@en, "머신러닝 모델"@ko .

ml:AnomalyDetectionModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Anomaly Detection Model"@en, "이상 탐지 모델"@ko .

ml:PredictiveModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Predictive Model"@en, "예측 모델"@ko .

ml:ClassificationModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Classification Model"@en, "분류 모델"@ko .

ml:RegressionModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Regression Model"@en, "회귀 모델"@ko .

ml:TimeSeriesModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Time Series Model"@en, "시계열 모델"@ko .

# 이상 탐지
anomaly:Anomaly a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Anomaly"@en, "이상"@ko .

anomaly:PerformanceAnomaly a owl:Class ;
    rdfs:subClassOf anomaly:Anomaly ;
    rdfs:label "Performance Anomaly"@en, "성능 이상"@ko .

anomaly:SecurityAnomaly a owl:Class ;
    rdfs:subClassOf anomaly:Anomaly ;
    rdfs:label "Security Anomaly"@en, "보안 이상"@ko .

anomaly:BehaviorAnomaly a owl:Class ;
    rdfs:subClassOf anomaly:Anomaly ;
    rdfs:label "Behavior Anomaly"@en, "행동 이상"@ko .

anomaly:AnomalyScore a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Anomaly Score"@en, "이상 점수"@ko .

# AI 운영
ai:MLOps a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "MLOps"@en, "ML 운영"@ko .

ai:ModelTraining a owl:Class ;
    rdfs:subClassOf ai:MLOps ;
    rdfs:label "Model Training"@en, "모델 훈련"@ko .

ai:ModelDeployment a owl:Class ;
    rdfs:subClassOf ai:MLOps ;
    rdfs:label "Model Deployment"@en, "모델 배포"@ko .

ai:ModelMonitoring a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Model Monitoring"@en, "모델 모니터링"@ko .

ai:DataDrift a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Data Drift"@en, "데이터 드리프트"@ko .

ai:ModelDrift a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Model Drift"@en, "모델 드리프트"@ko .

# 예측 분석
ml:Prediction a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Prediction"@en, "예측"@ko .

ml:FailurePrediction a owl:Class ;
    rdfs:subClassOf ml:Prediction ;
    rdfs:label "Failure Prediction"@en, "장애 예측"@ko .

ml:CapacityPrediction a owl:Class ;
    rdfs:subClassOf ml:Prediction ;
    rdfs:label "Capacity Prediction"@en, "용량 예측"@ko .

ml:DemandForecast a owl:Class ;
    rdfs:subClassOf ml:Prediction ;
    rdfs:label "Demand Forecast"@en, "수요 예측"@ko .

# 머신러닝 속성
ml:modelAccuracy a owl:DatatypeProperty ;
    rdfs:label "model accuracy"@en, "모델 정확도"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range xsd:double .

ml:trainingData a owl:DatatypeProperty ;
    rdfs:label "training data"@en, "훈련 데이터"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range xsd:string .

ml:algorithm a owl:DatatypeProperty ;
    rdfs:label "algorithm"@en, "알고리즘"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range xsd:string .

anomaly:confidence a owl:DatatypeProperty ;
    rdfs:label "confidence"@en, "신뢰도"@ko ;
    rdfs:domain anomaly:Anomaly ;
    rdfs:range xsd:double .

ml:predictionConfidence a owl:DatatypeProperty ;
    rdfs:label "prediction confidence"@en, "예측 신뢰도"@ko ;
    rdfs:domain ml:Prediction ;
    rdfs:range xsd:double .

ai:driftMagnitude a owl:DatatypeProperty ;
    rdfs:label "drift magnitude"@en, "드리프트 크기"@ko ;
    rdfs:domain ai:DataDrift ;
    rdfs:range xsd:double .

# 머신러닝 관계
ml:detects a owl:ObjectProperty ;
    rdfs:label "detects"@en, "탐지함"@ko ;
    rdfs:domain ml:AnomalyDetectionModel ;
    rdfs:range anomaly:Anomaly .

ml:predicts a owl:ObjectProperty ;
    rdfs:label "predicts"@en, "예측함"@ko ;
    rdfs:domain ml:PredictiveModel ;
    rdfs:range ml:Prediction .

ai:monitors a owl:ObjectProperty ;
    rdfs:label "monitors"@en, "모니터링함"@ko ;
    rdfs:domain ai:ModelMonitoring ;
    rdfs:range ml:MachineLearningModel .

ml:trainedOn a owl:ObjectProperty ;
    rdfs:label "trained on"@en, "훈련됨"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range obs:ObservabilityData .
```

# 13. 확장된 쿼리 예시

```sparql
# 클라우드 환경에서 높은 CPU 사용률을 보이는 Pod 찾기
SELECT ?pod ?cpu_value ?namespace
WHERE {
  ?pod a k8s:Pod .
  ?pod k8s:podStatus "Running" .
  ?pod obs:belongsTo ?namespace .
  ?pod perf:measures ?cpu_metric .
  ?cpu_metric a perf:CPUUtilization .
  ?cpu_metric metric:value ?cpu_value .
  FILTER (?cpu_value > 80.0)
}

# 마이크로서비스 간 의존성 체인 조회
SELECT ?service1 ?service2
WHERE {
  ?service1 a micro:Microservice .
  ?service1 micro:dependsOn+ ?service2 .
  ?service2 a micro:Microservice .
}

# 보안 위협과 관련된 취약점 찾기
SELECT ?threat ?vulnerability ?cvss_score
WHERE {
  ?threat a threat:Threat .
  ?threat threat:exploits ?vulnerability .
  ?vulnerability vuln:cveId ?cve .
  ?cvss a vuln:CVSSScore .
  ?cvss vuln:cvssScore ?cvss_score .
  FILTER (?cvss_score > 7.0)
}

# SLA 위반 상황 모니터링
SELECT ?sla ?component ?actual ?target
WHERE {
  ?sla a sla:ServiceLevelAgreement .
  ?sla sla:governs ?component .
  ?sli a sla:ServiceLevelIndicator .
  ?sli obs:belongsTo ?component .
  ?sli sla:actualValue ?actual .
  ?slo a sla:ServiceLevelObjective .
  ?slo sla:targetValue ?target .
  FILTER (?actual < ?target)
}

# ML 모델이 탐지한 이상 현상 분석
SELECT ?anomaly ?score ?confidence ?component
WHERE {
  ?model a ml:AnomalyDetectionModel .
  ?model ml:detects ?anomaly .
  ?anomaly anomaly:confidence ?confidence .
  ?anomaly_score a anomaly:AnomalyScore .
  ?anomaly_score metric:value ?score .
  ?anomaly fault:affects ?component .
  FILTER (?score > 0.8 && ?confidence > 0.7)
}
```

# 14. 통합 추론 규칙

```turtle
# 클라우드 네이티브 환경에서의 장애 전파
[ a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      fault:SystemFailure
      [ a owl:Restriction ;
        owl:onProperty fault:affects ;
        owl:someValuesFrom k8s:Pod
      ]
    )
  ]
] rdfs:subClassOf [
  a owl:Restriction ;
  owl:onProperty fault:affects ;
  owl:someValuesFrom k8s:Service
] .

# 마이크로서비스 의존성 기반 장애 전파
micro:Microservice rdfs:subClassOf [
  a owl:Restriction ;
  owl:onProperty micro:dependsOn ;
  owl:someValuesFrom [
    a owl:Restriction ;
    owl:onProperty fault:affects ;
    owl:hasValue fault:SystemFailure
  ]
] .

# 보안 이상과 성능 이상의 상관관계
anomaly:SecurityAnomaly rdfs:subClassOf [
  a owl:Restriction ;
  owl:onProperty perf:correlatedWith ;
  owl:someValuesFrom anomaly:PerformanceAnomaly
] .

# SLA 위반 시 비즈니스 영향도 추론
[ a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      sla:ServiceLevelAgreement
      [ a owl:Restriction ;
        owl:onProperty sla:complianceLevel ;
        owl:someValuesFrom [
          a rdfs:Datatype ;
          owl:onDatatype xsd:double ;
          owl:withRestrictions (
            [ xsd:maxExclusive 95.0 ]
          )
        ]
      ]
    )
  ]
] rdfs:subClassOf fault:CriticalFault .
```

이 확장된 온톨로지는 W3C OWL 표준을 따르며, Protégé, Apache Jena, RDF4J 등의 도구로 활용할 수 있습니다. 현대적인 클라우드 네이티브, 마이크로서비스, 보안, 비즈니스, AI/ML 환경을 모두 아우르는 포괄적인 옵저빌리티 지식 체계를 제공합니다.