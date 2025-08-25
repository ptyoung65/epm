# ============================================================================
# AIRIS AIOps 완전 옵저빌리티 온톨로지 v10.0
# 파일명: airis-aiops-observability-ontology-v10.ttl
# 생성일: 2024-08-25
# 버전: 10.0
# 라이선스: Apache 2.0
# 설명: AIRIS AIOps 플랫폼을 위한 종합적인 옵저빌리티 온톨로지
# ============================================================================

# ============================================================================
# W3C 표준 네임스페이스
# ============================================================================
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix time: <http://www.w3.org/2006/time#> .
@prefix prov: <http://www.w3.org/ns/prov#> .

# ============================================================================
# AIRIS AIOps 핵심 옵저빌리티 네임스페이스
# ============================================================================
@prefix obs: <https://aiops.airis.com/ontology/observability#> .
@prefix apm: <https://aiops.airis.com/ontology/apm#> .
@prefix infra: <https://aiops.airis.com/ontology/infrastructure#> .
@prefix perf: <https://aiops.airis.com/ontology/performance#> .
@prefix fault: <https://aiops.airis.com/ontology/fault#> .

# ============================================================================
# 관찰 데이터 타입 네임스페이스 (Three Pillars of Observability)
# ============================================================================
@prefix log: <https://aiops.airis.com/ontology/logging#> .
@prefix metric: <https://aiops.airis.com/ontology/metrics#> .
@prefix trace: <https://aiops.airis.com/ontology/tracing#> .

# ============================================================================
# 클라우드 네이티브 환경 네임스페이스
# ============================================================================
@prefix cloud: <https://aiops.airis.com/ontology/cloud#> .
@prefix k8s: <https://aiops.airis.com/ontology/kubernetes#> .
@prefix container: <https://aiops.airis.com/ontology/container#> .

# ============================================================================
# 마이크로서비스 아키텍처 네임스페이스
# ============================================================================
@prefix micro: <https://aiops.airis.com/ontology/microservices#> .
@prefix api: <https://aiops.airis.com/ontology/api#> .
@prefix mesh: <https://aiops.airis.com/ontology/servicemesh#> .

# ============================================================================
# 보안 모니터링 네임스페이스
# ============================================================================
@prefix sec: <https://aiops.airis.com/ontology/security#> .
@prefix threat: <https://aiops.airis.com/ontology/threat#> .
@prefix vuln: <https://aiops.airis.com/ontology/vulnerability#> .

# ============================================================================
# 비즈니스 메트릭 네임스페이스
# ============================================================================
@prefix biz: <https://aiops.airis.com/ontology/business#> .
@prefix sla: <https://aiops.airis.com/ontology/sla#> .
@prefix kpi: <https://aiops.airis.com/ontology/kpi#> .

# ============================================================================
# 머신러닝 및 AI 네임스페이스
# ============================================================================
@prefix ml: <https://aiops.airis.com/ontology/machinelearning#> .
@prefix ai: <https://aiops.airis.com/ontology/ai#> .
@prefix anomaly: <https://aiops.airis.com/ontology/anomaly#> .

# ============================================================================
# AIRIS 확장 네임스페이스
# ============================================================================
@prefix edge: <https://aiops.airis.com/ontology/edge#> .
@prefix green: <https://aiops.airis.com/ontology/sustainability#> .
@prefix quantum: <https://aiops.airis.com/ontology/quantum#> .
@prefix airisroi: <https://aiops.airis.com/ontology/roi#> .

# ============================================================================
# AIRIS AIOps 인스턴스 네임스페이스
# ============================================================================
@prefix : <https://aiops.airis.com/instances#> .

# ============================================================================
# 온톨로지 메타데이터
# ============================================================================
<https://aiops.airis.com/ontology/observability> a owl:Ontology ;
    rdfs:label "AIRIS AIOps Observability Ontology"@en, "AIRIS AIOps 옵저빌리티 온톨로지"@ko ;
    rdfs:comment "Comprehensive ontology for AIRIS AIOps platform covering monitoring, performance, security, ML/AI, and automation"@en ;
    owl:versionInfo "10.0" ;
    prov:generatedAtTime "2024-08-25T00:00:00Z"^^xsd:dateTime ;
    rdfs:creator "AIRIS AIOps Team" ;
    rdfs:publisher "AIRIS Corporation" .

# ============================================================================
# 1. 핵심 클래스 계층 구조 (Core Class Hierarchy)
# ============================================================================

# 1.1 최상위 개념들 (Top-level Concepts)
obs:ObservabilityEntity a owl:Class ;
    rdfs:label "Observability Entity"@en, "옵저빌리티 엔터티"@ko ;
    rdfs:comment "모든 관찰 가능한 시스템 구성요소와 데이터의 상위 클래스"@ko .

# 시스템 구성요소 계층
infra:SystemComponent a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "System Component"@en, "시스템 구성요소"@ko ;
    rdfs:comment "물리적 또는 논리적 시스템 구성 요소"@ko .

infra:Application a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Application"@en, "애플리케이션"@ko .

infra:WebApplication a owl:Class ;
    rdfs:subClassOf infra:Application ;
    rdfs:label "Web Application"@en, "웹 애플리케이션"@ko .

infra:WebApplicationServer a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "WAS"@en, "웹 애플리케이션 서버"@ko ;
    rdfs:comment "Tomcat, JBoss, WebLogic, WebSphere 등의 WAS"@ko .

infra:Database a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Database"@en, "데이터베이스"@ko .

infra:DatabaseManagementSystem a owl:Class ;
    rdfs:subClassOf infra:Database ;
    rdfs:label "DBMS"@en, "데이터베이스 관리 시스템"@ko .

infra:NetworkComponent a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Network Component"@en, "네트워크 구성요소"@ko .

infra:LoadBalancer a owl:Class ;
    rdfs:subClassOf infra:NetworkComponent ;
    rdfs:label "Load Balancer"@en, "로드 밸런서"@ko .

infra:FireWall a owl:Class ;
    rdfs:subClassOf infra:NetworkComponent ;
    rdfs:label "Firewall"@en, "방화벽"@ko .

# 1.2 관찰 데이터 타입 (Three Pillars of Observability)
obs:ObservabilityData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Observability Data"@en, "관찰 데이터"@ko ;
    rdfs:comment "시스템에서 수집되는 모든 관찰 데이터의 상위 클래스"@ko .

# 로그 데이터 계층
log:LogData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Log Data"@en, "로그 데이터"@ko .

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

log:SystemLog a owl:Class ;
    rdfs:subClassOf log:LogData ;
    rdfs:label "System Log"@en, "시스템 로그"@ko .

log:DatabaseLog a owl:Class ;
    rdfs:subClassOf log:LogData ;
    rdfs:label "Database Log"@en, "데이터베이스 로그"@ko .

# 메트릭 데이터 계층
metric:MetricData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Metric Data"@en, "메트릭 데이터"@ko .

metric:PerformanceMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Performance Metric"@en, "성능 메트릭"@ko .

metric:ResourceUtilizationMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Resource Utilization Metric"@en, "자원 사용률 메트릭"@ko .

metric:BusinessMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Business Metric"@en, "비즈니스 메트릭"@ko .

metric:CustomMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Custom Metric"@en, "커스텀 메트릭"@ko .

# 트레이스 데이터 계층
trace:TraceData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Trace Data"@en, "트레이스 데이터"@ko .

trace:DistributedTrace a owl:Class ;
    rdfs:subClassOf trace:TraceData ;
    rdfs:label "Distributed Trace"@en, "분산 트레이스"@ko .

trace:Span a owl:Class ;
    rdfs:subClassOf trace:TraceData ;
    rdfs:label "Span"@en, "스팬"@ko .

trace:RootSpan a owl:Class ;
    rdfs:subClassOf trace:Span ;
    rdfs:label "Root Span"@en, "루트 스팬"@ko .

trace:ChildSpan a owl:Class ;
    rdfs:subClassOf trace:Span ;
    rdfs:label "Child Span"@en, "자식 스팬"@ko .

# 1.3 성능 및 장애 관리 클래스
perf:PerformanceIndicator a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Performance Indicator"@en, "성능 지표"@ko .

perf:ResponseTime a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Response Time"@en, "응답 시간"@ko .

perf:Throughput a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Throughput"@en, "처리량"@ko .

perf:Latency a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Latency"@en, "지연 시간"@ko .

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

perf:IOPSMetric a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "IOPS Metric"@en, "IOPS 메트릭"@ko .

# 장애 관리 계층
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

fault:ConfigurationError a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Configuration Error"@en, "설정 오류"@ko .

# 장애 심각도별 분류
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

fault:InfoFault a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Info Fault"@en, "정보성 장애"@ko .

# ============================================================================
# 2. 클라우드 네이티브 환경 확장
# ============================================================================

# 클라우드 인프라 계층
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

cloud:MultiCloud a owl:Class ;
    rdfs:subClassOf cloud:CloudInfrastructure ;
    rdfs:label "Multi Cloud"@en, "멀티 클라우드"@ko .

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

cloud:AlibabaCloud a owl:Class ;
    rdfs:subClassOf cloud:PublicCloud ;
    rdfs:label "Alibaba Cloud" .

cloud:IBMCloud a owl:Class ;
    rdfs:subClassOf cloud:PublicCloud ;
    rdfs:label "IBM Cloud" .

cloud:NaverCloud a owl:Class ;
    rdfs:subClassOf cloud:PublicCloud ;
    rdfs:label "Naver Cloud Platform" .

# 컨테이너 기술 계층
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

container:DockerHub a owl:Class ;
    rdfs:subClassOf container:ContainerRegistry ;
    rdfs:label "Docker Hub" .

container:ECR a owl:Class ;
    rdfs:subClassOf container:ContainerRegistry ;
    rdfs:label "Amazon ECR" .

container:GCR a owl:Class ;
    rdfs:subClassOf container:ContainerRegistry ;
    rdfs:label "Google Container Registry" .

# Kubernetes 리소스 계층
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

k8s:ClusterIPService a owl:Class ;
    rdfs:subClassOf k8s:Service ;
    rdfs:label "ClusterIP Service"@en, "클러스터IP 서비스"@ko .

k8s:NodePortService a owl:Class ;
    rdfs:subClassOf k8s:Service ;
    rdfs:label "NodePort Service"@en, "노드포트 서비스"@ko .

k8s:LoadBalancerService a owl:Class ;
    rdfs:subClassOf k8s:Service ;
    rdfs:label "LoadBalancer Service"@en, "로드밸런서 서비스"@ko .

k8s:Deployment a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Deployment"@en, "디플로이먼트"@ko .

k8s:StatefulSet a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "StatefulSet"@en, "스테이트풀셋"@ko .

k8s:DaemonSet a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "DaemonSet"@en, "데몬셋"@ko .

k8s:ConfigMap a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "ConfigMap"@en, "컨피그맵"@ko .

k8s:Secret a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Secret"@en, "시크릿"@ko .

k8s:Namespace a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Namespace"@en, "네임스페이스"@ko .

k8s:Ingress a owl:Class ;
    rdfs:subClassOf infra:NetworkComponent ;
    rdfs:label "Ingress"@en, "인그레스"@ko .

k8s:PersistentVolume a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Persistent Volume"@en, "영구 볼륨"@ko .

k8s:PersistentVolumeClaim a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "PVC"@en, "영구 볼륨 클레임"@ko .

# ============================================================================
# 3. 마이크로서비스 아키텍처 확장
# ============================================================================

# 마이크로서비스 계층
micro:Microservice a owl:Class ;
    rdfs:subClassOf infra:Application ;
    rdfs:label "Microservice"@en, "마이크로서비스"@ko .

micro:ServiceRegistry a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Service Registry"@en, "서비스 레지스트리"@ko .

micro:Eureka a owl:Class ;
    rdfs:subClassOf micro:ServiceRegistry ;
    rdfs:label "Netflix Eureka" .

micro:Consul a owl:Class ;
    rdfs:subClassOf micro:ServiceRegistry ;
    rdfs:label "HashiCorp Consul" .

micro:Zookeeper a owl:Class ;
    rdfs:subClassOf micro:ServiceRegistry ;
    rdfs:label "Apache Zookeeper" .

micro:ConfigurationService a owl:Class ;
    rdfs:subClassOf micro:Microservice ;
    rdfs:label "Configuration Service"@en, "설정 서비스"@ko .

micro:CircuitBreaker a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Circuit Breaker"@en, "서킷 브레이커"@ko .

micro:Hystrix a owl:Class ;
    rdfs:subClassOf micro:CircuitBreaker ;
    rdfs:label "Netflix Hystrix" .

micro:Resilience4j a owl:Class ;
    rdfs:subClassOf micro:CircuitBreaker ;
    rdfs:label "Resilience4j" .

# API 관리 계층
api:APIGateway a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "API Gateway"@en, "API 게이트웨이"@ko .

api:Kong a owl:Class ;
    rdfs:subClassOf api:APIGateway ;
    rdfs:label "Kong API Gateway" .

api:Zuul a owl:Class ;
    rdfs:subClassOf api:APIGateway ;
    rdfs:label "Netflix Zuul" .

api:SpringCloudGateway a owl:Class ;
    rdfs:subClassOf api:APIGateway ;
    rdfs:label "Spring Cloud Gateway" .

api:APIEndpoint a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "API Endpoint"@en, "API 엔드포인트"@ko .

api:RESTfulAPI a owl:Class ;
    rdfs:subClassOf api:APIEndpoint ;
    rdfs:label "RESTful API"@en, "RESTful API"@ko .

api:GraphQLAPI a owl:Class ;
    rdfs:subClassOf api:APIEndpoint ;
    rdfs:label "GraphQL API"@en, "GraphQL API"@ko .

api:gRPCAPI a owl:Class ;
    rdfs:subClassOf api:APIEndpoint ;
    rdfs:label "gRPC API"@en, "gRPC API"@ko .

api:RateLimiter a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Rate Limiter"@en, "레이트 리미터"@ko .

api:AuthenticationFilter a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Authentication Filter"@en, "인증 필터"@ko .

# 서비스 메시 계층
mesh:ServiceMesh a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Service Mesh"@en, "서비스 메시"@ko .

mesh:Istio a owl:Class ;
    rdfs:subClassOf mesh:ServiceMesh ;
    rdfs:label "Istio" .

mesh:Linkerd a owl:Class ;
    rdfs:subClassOf mesh:ServiceMesh ;
    rdfs:label "Linkerd" .

mesh:ConsulConnect a owl:Class ;
    rdfs:subClassOf mesh:ServiceMesh ;
    rdfs:label "Consul Connect" .

mesh:Sidecar a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Sidecar Proxy"@en, "사이드카 프록시"@ko .

mesh:Envoy a owl:Class ;
    rdfs:subClassOf mesh:Sidecar ;
    rdfs:label "Envoy Proxy" .

mesh:TrafficPolicy a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Traffic Policy"@en, "트래픽 정책"@ko .

mesh:ServicePolicy a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Service Policy"@en, "서비스 정책"@ko .

# ============================================================================
# 4. 보안 모니터링 확장
# ============================================================================

# 보안 이벤트 계층
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

sec:LoginFailureEvent a owl:Class ;
    rdfs:subClassOf sec:SecurityEvent ;
    rdfs:label "Login Failure Event"@en, "로그인 실패 이벤트"@ko .

sec:DataBreachEvent a owl:Class ;
    rdfs:subClassOf sec:SecurityEvent ;
    rdfs:label "Data Breach Event"@en, "데이터 유출 이벤트"@ko .

# 위협 탐지 계층
threat:Threat a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Threat"@en, "위협"@ko .

threat:Malware a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Malware"@en, "악성코드"@ko .

threat:Virus a owl:Class ;
    rdfs:subClassOf threat:Malware ;
    rdfs:label "Virus"@en, "바이러스"@ko .

threat:Trojan a owl:Class ;
    rdfs:subClassOf threat:Malware ;
    rdfs:label "Trojan"@en, "트로이목마"@ko .

threat:Ransomware a owl:Class ;
    rdfs:subClassOf threat:Malware ;
    rdfs:label "Ransomware"@en, "랜섬웨어"@ko .

threat:DDoSAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "DDoS Attack"@en, "DDoS 공격"@ko .

threat:SQLInjection a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "SQL Injection"@en, "SQL 인젝션"@ko .

threat:XSSAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "XSS Attack"@en, "XSS 공격"@ko .

threat:CSRFAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "CSRF Attack"@en, "CSRF 공격"@ko .

threat:BruteForceAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Brute Force Attack"@en, "무차별 대입 공격"@ko .

threat:InsiderThreat a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Insider Threat"@en, "내부자 위협"@ko .

threat:APTAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "APT Attack"@en, "지능형 지속 위협"@ko .

threat:PhishingAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Phishing Attack"@en, "피싱 공격"@ko .

threat:SocialEngineeringAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Social Engineering Attack"@en, "사회공학적 공격"@ko .

# 취약점 관리 계층
vuln:Vulnerability a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Vulnerability"@en, "취약점"@ko .

vuln:CVSSScore a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "CVSS Score"@en, "CVSS 점수"@ko .

vuln:ZeroDayVulnerability a owl:Class ;
    rdfs:subClassOf vuln:Vulnerability ;
    rdfs:label "Zero-day Vulnerability"@en, "제로데이 취약점"@ko .

vuln:KnownVulnerability a owl:Class ;
    rdfs:subClassOf vuln:Vulnerability ;
    rdfs:label "Known Vulnerability"@en, "알려진 취약점"@ko .

vuln:ConfigurationVulnerability a owl:Class ;
    rdfs:subClassOf vuln:Vulnerability ;
    rdfs:label "Configuration Vulnerability"@en, "설정 취약점"@ko .

# 보안 도구 계층
sec:SecurityTool a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Security Tool"@en, "보안 도구"@ko .

sec:SIEM a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "SIEM"@en, "보안 정보 이벤트 관리"@ko .

sec:Splunk a owl:Class ;
    rdfs:subClassOf sec:SIEM ;
    rdfs:label "Splunk" .

sec:QRadar a owl:Class ;
    rdfs:subClassOf sec:SIEM ;
    rdfs:label "IBM QRadar" .

sec:ArcSight a owl:Class ;
    rdfs:subClassOf sec:SIEM ;
    rdfs:label "Micro Focus ArcSight" .

sec:IDS a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "IDS"@en, "침입 탐지 시스템"@ko .

sec:IPS a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "IPS"@en, "침입 방지 시스템"@ko .

sec:EDR a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "EDR"@en, "엔드포인트 탐지 및 대응"@ko .

sec:SOAR a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "SOAR"@en, "보안 오케스트레이션 자동화 대응"@ko .

sec:VulnerabilityScanner a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "Vulnerability Scanner"@en, "취약점 스캐너"@ko .

# ============================================================================
# 5. 비즈니스 메트릭 확장
# ============================================================================

# 비즈니스 메트릭 계층
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

biz:ChurnRate a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "Churn Rate"@en, "이탈률"@ko .

biz:CustomerSatisfaction a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "Customer Satisfaction"@en, "고객 만족도"@ko .

biz:NetPromoterScore a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "Net Promoter Score"@en, "순추천지수"@ko .

# SLA/SLO/SLI 계층
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

sla:ReliabilitySLA a owl:Class ;
    rdfs:subClassOf sla:ServiceLevelAgreement ;
    rdfs:label "Reliability SLA"@en, "신뢰성 SLA"@ko .

sla:ErrorBudget a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Error Budget"@en, "오류 예산"@ko .

sla:BurnRate a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Burn Rate"@en, "소모율"@ko .

# KPI 계층
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

kpi:MTTD a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "MTTD"@en, "평균 탐지 시간"@ko .

kpi:MTTA a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "MTTA"@en, "평균 확인 시간"@ko .

kpi:Uptime a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "Uptime"@en, "가동 시간"@ko .

kpi:Availability a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "Availability"@en, "가용성"@ko .

kpi:Reliability a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "Reliability"@en, "신뢰성"@ko .

# ============================================================================
# 6. 머신러닝 및 AI 확장
# ============================================================================

# AIRIS AIOps 머신러닝 모델 계층
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

ml:ClusteringModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Clustering Model"@en, "클러스터링 모델"@ko .

ml:NeuralNetwork a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Neural Network"@en, "신경망"@ko .

ml:DeepLearningModel a owl:Class ;
    rdfs:subClassOf ml:NeuralNetwork ;
    rdfs:label "Deep Learning Model"@en, "딥러닝 모델"@ko .

ml:TransformerModel a owl:Class ;
    rdfs:subClassOf ml:DeepLearningModel ;
    rdfs:label "Transformer Model"@en, "트랜스포머 모델"@ko .

# AIRIS 이상 탐지 계층
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

anomaly:NetworkAnomaly a owl:Class ;
    rdfs:subClassOf anomaly:Anomaly ;
    rdfs:label "Network Anomaly"@en, "네트워크 이상"@ko .

anomaly:DataAnomaly a owl:Class ;
    rdfs:subClassOf anomaly:Anomaly ;
    rdfs:label "Data Anomaly"@en, "데이터 이상"@ko .

anomaly:AnomalyScore a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Anomaly Score"@en, "이상 점수"@ko .

# AIRIS AIOps 운영 계층
ai:AIOperations a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "AI Operations"@en, "AI 운영"@ko .

ai:AIOps a owl:Class ;
    rdfs:subClassOf ai:AIOperations ;
    rdfs:label "AIOps"@en, "AI 운영"@ko ;
    rdfs:comment "AIRIS AIOps platform capabilities"@en .

ai:MLOps a owl:Class ;
    rdfs:subClassOf ai:AIOperations ;
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

ai:ModelValidation a owl:Class ;
    rdfs:subClassOf ai:MLOps ;
    rdfs:label "Model Validation"@en, "모델 검증"@ko .

ai:DataDrift a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Data Drift"@en, "데이터 드리프트"@ko .

ai:ModelDrift a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Model Drift"@en, "모델 드리프트"@ko .

ai:ConceptDrift a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Concept Drift"@en, "개념 드리프트"@ko .

# 예측 분석 계층
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

ml:TrendPrediction a owl:Class ;
    rdfs:subClassOf ml:Prediction ;
    rdfs:label "Trend Prediction"@en, "트렌드 예측"@ko .

ml:ResourcePrediction a owl:Class ;
    rdfs:subClassOf ml:Prediction ;
    rdfs:label "Resource Prediction"@en, "리소스 예측"@ko .

ml:UserBehaviorPrediction a owl:Class ;
    rdfs:subClassOf ml:Prediction ;
    rdfs:label "User Behavior Prediction"@en, "사용자 행동 예측"@ko .

# AIRIS 자동화 및 추천 시스템
ai:AutomationSystem a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Automation System"@en, "자동화 시스템"@ko .

ai:RecommendationEngine a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Recommendation Engine"@en, "추천 엔진"@ko .

ai:AutoRemediation a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Auto Remediation"@en, "자동 복구"@ko .

ai:AlertCorrelation a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Alert Correlation"@en, "알람 상관분석"@ko .

ai:RootCauseAnalysis a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Root Cause Analysis"@en, "근본원인분석"@ko .

ai:PredictiveScaling a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Predictive Scaling"@en, "예측 기반 스케일링"@ko .

ai:IntelligentRouting a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Intelligent Routing"@en, "지능형 라우팅"@ko .

# ============================================================================
# 7. APM 도구 및 기술 스택
# ============================================================================

# APM 및 모니터링 도구 계층
apm:MonitoringTool a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Monitoring Tool"@en, "모니터링 도구"@ko .

apm:APMTool a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "APM Tool"@en, "APM 도구"@ko .

# 상용 APM 도구들
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

apm:SolarWinds a owl:Class ;
    rdfs:subClassOf apm:APMTool ;
    rdfs:label "SolarWinds APM" .

apm:CA_APM a owl:Class ;
    rdfs:subClassOf apm:APMTool ;
    rdfs:label "CA Application Performance Management" .

# 오픈소스 모니터링 도구들
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

apm:OpenTelemetry a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "OpenTelemetry" .

apm:Nagios a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Nagios" .

apm:Zabbix a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Zabbix" .

apm:InfluxDB a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "InfluxDB" .

apm:Fluentd a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Fluentd" .

apm:Logstash a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Logstash" .

# WAS 종류
infra:Tomcat a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Apache Tomcat" .

infra:JBoss a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Red Hat JBoss EAP" .

infra:WildFly a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "WildFly" .

infra:WebLogic a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Oracle WebLogic Server" .

infra:WebSphere a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "IBM WebSphere Application Server" .

infra:Jetty a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Eclipse Jetty" .

infra:Undertow a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Undertow" .

infra:GlassFish a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Eclipse GlassFish" .

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

infra:Redis a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "Redis" .

infra:Cassandra a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "Apache Cassandra" .

infra:Elasticsearch a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "Elasticsearch" .

infra:MariaDB a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "MariaDB" .

infra:DB2 a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "IBM DB2" .

# ============================================================================
# 8. AIRIS 확장 클래스들
# ============================================================================

# Edge Computing 확장
edge:EdgeComputingInfrastructure a owl:Class ;
    rdfs:subClassOf cloud:CloudInfrastructure ;
    rdfs:label "Edge Computing Infrastructure"@en, "엣지 컴퓨팅 인프라"@ko .

edge:EdgeNode a owl:Class ;
    rdfs:subClassOf k8s:Node ;
    rdfs:label "Edge Node"@en, "엣지 노드"@ko .

edge:IoTDevice a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "IoT Device"@en, "IoT 디바이스"@ko .

edge:EdgeAIModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Edge AI Model"@en, "엣지 AI 모델"@ko .

edge:EdgeGateway a owl:Class ;
    rdfs:subClassOf infra:NetworkComponent ;
    rdfs:label "Edge Gateway"@en, "엣지 게이트웨이"@ko .

# 지속가능성 모니터링 확장
green:SustainabilityMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Sustainability Metric"@en, "지속가능성 메트릭"@ko .

green:CarbonFootprint a owl:Class ;
    rdfs:subClassOf green:SustainabilityMetric ;
    rdfs:label "Carbon Footprint"@en, "탄소 발자국"@ko .

green:EnergyEfficiency a owl:Class ;
    rdfs:subClassOf green:SustainabilityMetric ;
    rdfs:label "Energy Efficiency"@en, "에너지 효율성"@ko .

green:PowerUsageEffectiveness a owl:Class ;
    rdfs:subClassOf green:EnergyEfficiency ;
    rdfs:label "PUE"@en, "전력 사용 효율성"@ko .

green:GreenComputing a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Green Computing"@en, "그린 컴퓨팅"@ko .

green:RenewableEnergy a owl:Class ;
    rdfs:subClassOf green:SustainabilityMetric ;
    rdfs:label "Renewable Energy"@en, "재생 에너지"@ko .

# 양자 컴퓨팅 준비
quantum:QuantumComputing a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Quantum Computing"@en, "양자 컴퓨팅"@ko .

quantum:QuantumProcessor a owl:Class ;
    rdfs:subClassOf quantum:QuantumComputing ;
    rdfs:label "Quantum Processor"@en, "양자 프로세서"@ko .

quantum:QuantumErrorCorrection a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Quantum Error Correction"@en, "양자 오류 정정"@ko .

quantum:QuantumCoherence a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Quantum Coherence"@en, "양자 결맞음"@ko .

quantum:QuantumAIOpsModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Quantum AIOps Model"@en, "양자 AIOps 모델"@ko .

# AIRIS ROI 측정
airisroi:AIOpsROI a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "AIRIS AIOps ROI"@en, "AIRIS AIOps ROI"@ko .

airisroi:AutomationEfficiency a owl:Class ;
    rdfs:subClassOf airisroi:AIOpsROI ;
    rdfs:label "Automation Efficiency"@en, "자동화 효율성"@ko .

airisroi:PredictiveAccuracy a owl:Class ;
    rdfs:subClassOf airisroi:AIOpsROI ;
    rdfs:label "Predictive Accuracy"@en, "예측 정확도"@ko .

airisroi:OperationalCostSaving a owl:Class ;
    rdfs:subClassOf airisroi:AIOpsROI ;
    rdfs:label "Operational Cost Saving"@en, "운영비용 절감"@ko .

# ============================================================================
# 9. 객체 속성 정의 (Object Properties)
# ============================================================================

# 기본 관계 속성들
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

obs:connectedTo a owl:ObjectProperty ;
    rdfs:label "connected to"@en, "연결됨"@ko ;
    rdfs:domain infra:SystemComponent ;
    rdfs:range infra:SystemComponent .

obs:runsOn a owl:ObjectProperty ;
    rdfs:label "runs on"@en, "실행됨"@ko ;
    rdfs:domain infra:Application ;
    rdfs:range infra:SystemComponent .

obs:hosts a owl:ObjectProperty ;
    rdfs:label "hosts"@en, "호스트함"@ko ;
    rdfs:domain infra:SystemComponent ;
    rdfs:range infra:Application ;
    owl:inverseOf obs:runsOn .

# 트레이스 관계 속성들
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

trace:followsFrom a owl:ObjectProperty ;
    rdfs:label "follows from"@en, "따라옴"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range trace:Span .

# 장애 관계 속성들
fault:causes a owl:ObjectProperty ;
    rdfs:label "causes"@en, "원인이 됨"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range fault:Fault .

fault:affects a owl:ObjectProperty ;
    rdfs:label "affects"@en, "영향을 줌"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range infra:SystemComponent .

fault:triggers a owl:ObjectProperty ;
    rdfs:label "triggers"@en, "트리거함"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range fault:Fault .

fault:resolvedBy a owl:ObjectProperty ;
    rdfs:label "resolved by"@en, "해결됨"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range obs:ObservabilityEntity .

# 성능 관계 속성들
perf:measures a owl:ObjectProperty ;
    rdfs:label "measures"@en, "측정함"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range infra:SystemComponent .

perf:correlatedWith a owl:ObjectProperty ;
    rdfs:label "correlated with"@en, "상관관계 있음"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range perf:PerformanceIndicator .

perf:impacts a owl:ObjectProperty ;
    rdfs:label "impacts"@en, "영향을 줌"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range perf:PerformanceIndicator .

# 클라우드 네이티브 관계 속성들
k8s:scheduledon a owl:ObjectProperty ;
    rdfs:label "scheduled on"@en, "스케줄됨"@ko ;
    rdfs:domain k8s:Pod ;
    rdfs:range k8s:Node .

k8s:exposesby a owl:ObjectProperty ;
    rdfs:label "exposed by"@en, "노출됨"@ko ;
    rdfs:domain k8s:Pod ;
    rdfs:range k8s:Service .

container:basedOn a owl:ObjectProperty ;
    rdfs:label "based on"@en, "기반함"@ko ;
    rdfs:domain container:Container ;
    rdfs:range container:ContainerImage .

cloud:deployedOn a owl:ObjectProperty ;
    rdfs:label "deployed on"@en, "배포됨"@ko ;
    rdfs:domain infra:SystemComponent ;
    rdfs:range cloud:CloudInfrastructure .

# 마이크로서비스 관계 속성들
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

api:consumesAPI a owl:ObjectProperty ;
    rdfs:label "consumes API"@en, "API 소비함"@ko ;
    rdfs:domain micro:Microservice ;
    rdfs:range api:APIEndpoint .

mesh:managedBy a owl:ObjectProperty ;
    rdfs:label "managed by"@en, "관리됨"@ko ;
    rdfs:domain micro:Microservice ;
    rdfs:range mesh:ServiceMesh .

# 보안 관계 속성들
threat:exploits a owl:ObjectProperty ;
    rdfs:label "exploits"@en, "악용함"@ko ;
    rdfs:domain threat:Threat ;
    rdfs:range vuln:Vulnerability .

sec:detects a owl:ObjectProperty ;
    rdfs:label "detects"@en, "탐지함"@ko ;
    rdfs:domain sec:SecurityTool ;
    rdfs:range threat:Threat .

sec:protects a owl:ObjectProperty ;
    rdfs:label "protects"@en, "보호함"@ko ;
    rdfs:domain sec:SecurityTool ;
    rdfs:range infra:SystemComponent .

vuln:hasVulnerability a owl:ObjectProperty ;
    rdfs:label "has vulnerability"@en, "취약점을 가짐"@ko ;
    rdfs:domain infra:SystemComponent ;
    rdfs:range vuln:Vulnerability .

# 비즈니스 관계 속성들
sla:governs a owl:ObjectProperty ;
    rdfs:label "governs"@en, "관리함"@ko ;
    rdfs:domain sla:ServiceLevelAgreement ;
    rdfs:range infra:SystemComponent .

biz:impacts a owl:ObjectProperty ;
    rdfs:label "impacts"@en, "영향을 줌"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range biz:BusinessMetric .

kpi:evaluates a owl:ObjectProperty ;
    rdfs:label "evaluates"@en, "평가함"@ko ;
    rdfs:domain kpi:KeyPerformanceIndicator ;
    rdfs:range infra:SystemComponent .

sla:hasObjective a owl:ObjectProperty ;
    rdfs:label "has objective"@en, "목표를 가짐"@ko ;
    rdfs:domain sla:ServiceLevelAgreement ;
    rdfs:range sla:ServiceLevelObjective .

sla:measuredBy a owl:ObjectProperty ;
    rdfs:label "measured by"@en, "측정됨"@ko ;
    rdfs:domain sla:ServiceLevelObjective ;
    rdfs:range sla:ServiceLevelIndicator .

# 머신러닝 관계 속성들
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

ai:recommends a owl:ObjectProperty ;
    rdfs:label "recommends"@en, "추천함"@ko ;
    rdfs:domain ai:RecommendationEngine ;
    rdfs:range obs:ObservabilityEntity .

ai:automates a owl:ObjectProperty ;
    rdfs:label "automates"@en, "자동화함"@ko ;
    rdfs:domain ai:AutomationSystem ;
    rdfs:range obs:ObservabilityEntity .

# ============================================================================
# 10. 데이터 속성 정의 (Data Properties)
# ============================================================================

# 기본 식별 및 시간 속성들
obs:id a owl:DatatypeProperty ;
    rdfs:label "identifier"@en, "식별자"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range xsd:string .

obs:name a owl:DatatypeProperty ;
    rdfs:label "name"@en, "이름"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range xsd:string .

obs:description a owl:DatatypeProperty ;
    rdfs:label "description"@en, "설명"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range xsd:string .

obs:version a owl:DatatypeProperty ;
    rdfs:label "version"@en, "버전"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range xsd:string .

obs:timestamp a owl:DatatypeProperty ;
    rdfs:label "timestamp"@en, "타임스탬프"@ko ;
    rdfs:domain obs:ObservabilityData ;
    rdfs:range xsd:dateTime .

obs:duration a owl:DatatypeProperty ;
    rdfs:label "duration"@en, "지속시간"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range xsd:duration .

obs:createdAt a owl:DatatypeProperty ;
    rdfs:label "created at"@en, "생성 시각"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range xsd:dateTime .

obs:updatedAt a owl:DatatypeProperty ;
    rdfs:label "updated at"@en, "수정 시각"@ko ;
    rdfs:domain obs:ObservabilityEntity ;
    rdfs:range xsd:dateTime .

# 로그 관련 속성들
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

log:threadName a owl:DatatypeProperty ;
    rdfs:label "thread name"@en, "스레드명"@ko ;
    rdfs:domain log:LogData ;
    rdfs:range xsd:string .

log:className a owl:DatatypeProperty ;
    rdfs:label "class name"@en, "클래스명"@ko ;
    rdfs:domain log:LogData ;
    rdfs:range xsd:string .

log:methodName a owl:DatatypeProperty ;
    rdfs:label "method name"@en, "메서드명"@ko ;
    rdfs:domain log:LogData ;
    rdfs:range xsd:string .

# 메트릭 관련 속성들
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

metric:tags a owl:DatatypeProperty ;
    rdfs:label "tags"@en, "태그"@ko ;
    rdfs:domain metric:MetricData ;
    rdfs:range xsd:string .

metric:aggregationType a owl:DatatypeProperty ;
    rdfs:label "aggregation type"@en, "집계 타입"@ko ;
    rdfs:domain metric:MetricData ;
    rdfs:range xsd:string .

# 트레이스 관련 속성들
trace:traceId a owl:DatatypeProperty ;
    rdfs:label "trace ID"@en, "트레이스 ID"@ko ;
    rdfs:domain trace:TraceData ;
    rdfs:range xsd:string .

trace:spanId a owl:DatatypeProperty ;
    rdfs:label "span ID"@en, "스팬 ID"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range xsd:string .

trace:parentSpanId a owl:DatatypeProperty ;
    rdfs:label "parent span ID"@en, "부모 스팬 ID"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range xsd:string .

trace:operationName a owl:DatatypeProperty ;
    rdfs:label "operation name"@en, "작업명"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range xsd:string .

trace:serviceName a owl:DatatypeProperty ;
    rdfs:label "service name"@en, "서비스명"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range xsd:string .

trace:startTime a owl:DatatypeProperty ;
    rdfs:label "start time"@en, "시작 시간"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range xsd:dateTime .

trace:endTime a owl:DatatypeProperty ;
    rdfs:label "end time"@en, "종료 시간"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range xsd:dateTime .

trace:spanKind a owl:DatatypeProperty ;
    rdfs:label "span kind"@en, "스팬 종류"@ko ;
    rdfs:domain trace:Span ;
    rdfs:range xsd:string .

# 장애 관련 속성들
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

fault:priority a owl:DatatypeProperty ;
    rdfs:label "priority"@en, "우선순위"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:int .

fault:status a owl:DatatypeProperty ;
    rdfs:label "status"@en, "상태"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:string .

fault:assignee a owl:DatatypeProperty ;
    rdfs:label "assignee"@en, "담당자"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:string .

fault:resolvedAt a owl:DatatypeProperty ;
    rdfs:label "resolved at"@en, "해결 시각"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:dateTime .

# 성능 관련 속성들
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

perf:percentile95 a owl:DatatypeProperty ;
    rdfs:label "95th percentile"@en, "95퍼센타일"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range xsd:double .

perf:percentile99 a owl:DatatypeProperty ;
    rdfs:label "99th percentile"@en, "99퍼센타일"@ko ;
    rdfs:domain perf:PerformanceIndicator ;
    rdfs:range xsd:double .

# 클라우드 네이티브 속성들
container:imageTag a owl:DatatypeProperty ;
    rdfs:label "image tag"@en, "이미지 태그"@ko ;
    rdfs:domain container:ContainerImage ;
    rdfs:range xsd:string .

container:imageDigest a owl:DatatypeProperty ;
    rdfs:label "image digest"@en, "이미지 다이제스트"@ko ;
    rdfs:domain container:ContainerImage ;
    rdfs:range xsd:string .

container:containerPort a owl:DatatypeProperty ;
    rdfs:label "container port"@en, "컨테이너 포트"@ko ;
    rdfs:domain container:Container ;
    rdfs:range xsd:int .

k8s:podStatus a owl:DatatypeProperty ;
    rdfs:label "pod status"@en, "파드 상태"@ko ;
    rdfs:domain k8s:Pod ;
    rdfs:range xsd:string .

k8s:replicas a owl:DatatypeProperty ;
    rdfs:label "replicas"@en, "레플리카 수"@ko ;
    rdfs:domain k8s:Deployment ;
    rdfs:range xsd:int .

k8s:nodeCapacity a owl:DatatypeProperty ;
    rdfs:label "node capacity"@en, "노드 용량"@ko ;
    rdfs:domain k8s:Node ;
    rdfs:range xsd:string .

k8s:podPhase a owl:DatatypeProperty ;
    rdfs:label "pod phase"@en, "파드 단계"@ko ;
    rdfs:domain k8s:Pod ;
    rdfs:range xsd:string .

cloud:region a owl:DatatypeProperty ;
    rdfs:label "region"@en, "리전"@ko ;
    rdfs:domain cloud:CloudInfrastructure ;
    rdfs:range xsd:string .

cloud:availabilityZone a owl:DatatypeProperty ;
    rdfs:label "availability zone"@en, "가용 영역"@ko ;
    rdfs:domain cloud:CloudInfrastructure ;
    rdfs:range xsd:string .

cloud:instanceType a owl:DatatypeProperty ;
    rdfs:label "instance type"@en, "인스턴스 타입"@ko ;
    rdfs:domain cloud:CloudInfrastructure ;
    rdfs:range xsd:string .

# 마이크로서비스 속성들
micro:serviceVersion a owl:DatatypeProperty ;
    rdfs:label "service version"@en, "서비스 버전"@ko ;
    rdfs:domain micro:Microservice ;
    rdfs:range xsd:string .

micro:servicePort a owl:DatatypeProperty ;
    rdfs:label "service port"@en, "서비스 포트"@ko ;
    rdfs:domain micro:Microservice ;
    rdfs:range xsd:int .

api:httpMethod a owl:DatatypeProperty ;
    rdfs:label "HTTP method"@en, "HTTP 메서드"@ko ;
    rdfs:domain api:APIEndpoint ;
    rdfs:range xsd:string .

api:path a owl:DatatypeProperty ;
    rdfs:label "path"@en, "경로"@ko ;
    rdfs:domain api:APIEndpoint ;
    rdfs:range xsd:string .

api:rateLimitValue a owl:DatatypeProperty ;
    rdfs:label "rate limit value"@en, "레이트 리미트 값"@ko ;
    rdfs:domain api:RateLimiter ;
    rdfs:range xsd:int .

api:rateLimitWindow a owl:DatatypeProperty ;
    rdfs:label "rate limit window"@en, "레이트 리미트 윈도우"@ko ;
    rdfs:domain api:RateLimiter ;
    rdfs:range xsd:duration .

micro:circuitState a owl:DatatypeProperty ;
    rdfs:label "circuit state"@en, "서킷 상태"@ko ;
    rdfs:domain micro:CircuitBreaker ;
    rdfs:range xsd:string .

micro:failureThreshold a owl:DatatypeProperty ;
    rdfs:label "failure threshold"@en, "실패 임계값"@ko ;
    rdfs:domain micro:CircuitBreaker ;
    rdfs:range xsd:int .

# 보안 관련 속성들
sec:attackVector a owl:DatatypeProperty ;
    rdfs:label "attack vector"@en, "공격 벡터"@ko ;
    rdfs:domain threat:Threat ;
    rdfs:range xsd:string .

sec:severityLevel a owl:DatatypeProperty ;
    rdfs:label "severity level"@en, "심각도 레벨"@ko ;
    rdfs:domain sec:SecurityEvent ;
    rdfs:range xsd:string .

sec:sourceIP a owl:DatatypeProperty ;
    rdfs:label "source IP"@en, "발신 IP"@ko ;
    rdfs:domain sec:SecurityEvent ;
    rdfs:range xsd:string .

sec:destinationIP a owl:DatatypeProperty ;
    rdfs:label "destination IP"@en, "목적지 IP"@ko ;
    rdfs:domain sec:SecurityEvent ;
    rdfs:range xsd:string .

sec:sourcePort a owl:DatatypeProperty ;
    rdfs:label "source port"@en, "발신 포트"@ko ;
    rdfs:domain sec:SecurityEvent ;
    rdfs:range xsd:int .

sec:destinationPort a owl:DatatypeProperty ;
    rdfs:label "destination port"@en, "목적지 포트"@ko ;
    rdfs:domain sec:SecurityEvent ;
    rdfs:range xsd:int .

sec:userName a owl:DatatypeProperty ;
    rdfs:label "user name"@en, "사용자명"@ko ;
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

vuln:attackComplexity a owl:DatatypeProperty ;
    rdfs:label "attack complexity"@en, "공격 복잡도"@ko ;
    rdfs:domain vuln:Vulnerability ;
    rdfs:range xsd:string .

vuln:privilegesRequired a owl:DatatypeProperty ;
    rdfs:label "privileges required"@en, "필요 권한"@ko ;
    rdfs:domain vuln:Vulnerability ;
    rdfs:range xsd:string .

# 비즈니스 메트릭 속성들
biz:businessImpact a owl:DatatypeProperty ;
    rdfs:label "business impact"@en, "비즈니스 영향도"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:string .

biz:revenueImpact a owl:DatatypeProperty ;
    rdfs:label "revenue impact"@en, "매출 영향"@ko ;
    rdfs:domain fault:Fault ;
    rdfs:range xsd:double .

biz:customerCount a owl:DatatypeProperty ;
    rdfs:label "customer count"@en, "고객 수"@ko ;
    rdfs:domain biz:CustomerMetric ;
    rdfs:range xsd:int .

biz:conversionRate a owl:DatatypeProperty ;
    rdfs:label "conversion rate"@en, "전환율"@ko ;
    rdfs:domain biz:ConversionRate ;
    rdfs:range xsd:double .

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

sla:errorBudgetRemaining a owl:DatatypeProperty ;
    rdfs:label "error budget remaining"@en, "남은 오류 예산"@ko ;
    rdfs:domain sla:ErrorBudget ;
    rdfs:range xsd:double .

kpi:targetKPI a owl:DatatypeProperty ;
    rdfs:label "target KPI"@en, "목표 KPI"@ko ;
    rdfs:domain kpi:KeyPerformanceIndicator ;
    rdfs:range xsd:double .

kpi:actualKPI a owl:DatatypeProperty ;
    rdfs:label "actual KPI"@en, "실제 KPI"@ko ;
    rdfs:domain kpi:KeyPerformanceIndicator ;
    rdfs:range xsd:double .

# AIRIS AIOps 머신러닝 관련 속성들
ml:modelAccuracy a owl:DatatypeProperty ;
    rdfs:label "model accuracy"@en, "모델 정확도"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range xsd:double .

ml:trainingDataset a owl:DatatypeProperty ;
    rdfs:label "training dataset"@en, "훈련 데이터셋"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range xsd:string .

ml:algorithm a owl:DatatypeProperty ;
    rdfs:label "algorithm"@en, "알고리즘"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range xsd:string .

ml:hyperParameters a owl:DatatypeProperty ;
    rdfs:label "hyper parameters"@en, "하이퍼 파라미터"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range xsd:string .

ml:precision a owl:DatatypeProperty ;
    rdfs:label "precision"@en, "정밀도"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range xsd:double .

ml:recall a owl:DatatypeProperty ;
    rdfs:label "recall"@en, "재현율"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range xsd:double .

ml:f1Score a owl:DatatypeProperty ;
    rdfs:label "F1 score"@en, "F1 점수"@ko ;
    rdfs:domain ml:MachineLearningModel ;
    rdfs:range xsd:double .

anomaly:confidence a owl:DatatypeProperty ;
    rdfs:label "confidence"@en, "신뢰도"@ko ;
    rdfs:domain anomaly:Anomaly ;
    rdfs:range xsd:double .

anomaly:anomalyScore a owl:DatatypeProperty ;
    rdfs:label "anomaly score"@en, "이상 점수"@ko ;
    rdfs:domain anomaly:AnomalyScore ;
    rdfs:range xsd:double .

ml:predictionConfidence a owl:DatatypeProperty ;
    rdfs:label "prediction confidence"@en, "예측 신뢰도"@ko ;
    rdfs:domain ml:Prediction ;
    rdfs:range xsd:double .

ml:predictionValue a owl:DatatypeProperty ;
    rdfs:label "prediction value"@en, "예측값"@ko ;
    rdfs:domain ml:Prediction ;
    rdfs:range xsd:double .

ai:driftMagnitude a owl:DatatypeProperty ;
    rdfs:label "drift magnitude"@en, "드리프트 크기"@ko ;
    rdfs:domain ai:DataDrift ;
    rdfs:range xsd:double .

ai:driftThreshold a owl:DatatypeProperty ;
    rdfs:label "drift threshold"@en, "드리프트 임계값"@ko ;
    rdfs:domain ai:DataDrift ;
    rdfs:range xsd:double .

# AIRIS 확장 속성들
edge:edgeLocation a owl:DatatypeProperty ;
    rdfs:label "edge location"@en, "엣지 위치"@ko ;
    rdfs:domain edge:EdgeNode ;
    rdfs:range xsd:string .

edge:modelSize a owl:DatatypeProperty ;
    rdfs:label "model size"@en, "모델 크기"@ko ;
    rdfs:domain edge:EdgeAIModel ;
    rdfs:range xsd:string .

edge:inferenceLatency a owl:DatatypeProperty ;
    rdfs:label "inference latency"@en, "추론 지연시간"@ko ;
    rdfs:domain edge:EdgeAIModel ;
    rdfs:range xsd:string .

green:pueTarget a owl:DatatypeProperty ;
    rdfs:label "PUE target"@en, "PUE 목표"@ko ;
    rdfs:domain green:PowerUsageEffectiveness ;
    rdfs:range xsd:double .

green:pueImprovement a owl:DatatypeProperty ;
    rdfs:label "PUE improvement"@en, "PUE 개선"@ko ;
    rdfs:domain green:PowerUsageEffectiveness ;
    rdfs:range xsd:double .

green:carbonReduction a owl:DatatypeProperty ;
    rdfs:label "carbon reduction"@en, "탄소 감축량"@ko ;
    rdfs:domain green:CarbonFootprint ;
    rdfs:range xsd:double .

green:renewableEnergyPercent a owl:DatatypeProperty ;
    rdfs:label "renewable energy percentage"@en, "재생 에너지 비율"@ko ;
    rdfs:domain green:SustainabilityMetric ;
    rdfs:range xsd:double .

quantum:qubitCount a owl:DatatypeProperty ;
    rdfs:label "qubit count"@en, "큐비트 수"@ko ;
    rdfs:domain quantum:QuantumProcessor ;
    rdfs:range xsd:int .

quantum:coherenceTime a owl:DatatypeProperty ;
    rdfs:label "coherence time"@en, "결맞음 시간"@ko ;
    rdfs:domain quantum:QuantumCoherence ;
    rdfs:range xsd:double .

quantum:quantumVolume a owl:DatatypeProperty ;
    rdfs:label "quantum volume"@en, "양자 볼륨"@ko ;
    rdfs:domain quantum:QuantumProcessor ;
    rdfs:range xsd:int .

quantum:errorRate a owl:DatatypeProperty ;
    rdfs:label "quantum error rate"@en, "양자 오류율"@ko ;
    rdfs:domain quantum:QuantumErrorCorrection ;
    rdfs:range xsd:double .

# AIRIS ROI 측정 속성들
airisroi:beforeAIOps a owl:DatatypeProperty ;
    rdfs:label "before AIOps implementation"@en, "AIOps 도입 전"@ko ;
    rdfs:domain airisroi:AIOpsROI ;
    rdfs:range xsd:double .

airisroi:afterAIOps a owl:DatatypeProperty ;
    rdfs:label "after AIOps implementation"@en, "AIOps 도입 후"@ko ;
    rdfs:domain airisroi:AIOpsROI ;
    rdfs:range xsd:double .

airisroi:improvementRate a owl:DatatypeProperty ;
    rdfs:label "improvement rate"@en, "개선율"@ko ;
    rdfs:domain airisroi:AIOpsROI ;
    rdfs:range xsd:double .

airisroi:falsePositiveRate a owl:DatatypeProperty ;
    rdfs:label "false positive rate"@en, "오탐률"@ko ;
    rdfs:domain airisroi:PredictiveAccuracy ;
    rdfs:range xsd:double .

airisroi:quarterlyInfrastructureCost a owl:DatatypeProperty ;
    rdfs:label "quarterly infrastructure cost"@en, "분기별 인프라 비용"@ko ;
    rdfs:domain airisroi:OperationalCostSaving ;
    rdfs:range xsd:double .

airisroi:quarterlySavedCost a owl:DatatypeProperty ;
    rdfs:label "quarterly saved cost"@en, "분기별 절감 비용"@ko ;
    rdfs:domain airisroi:OperationalCostSaving ;
    rdfs:range xsd:double .

airisroi:aiopsLicenseCost a owl:DatatypeProperty ;
    rdfs:label "AIOps license cost"@en, "AIOps 라이선스 비용"@ko ;
    rdfs:domain airisroi:OperationalCostSaving ;
    rdfs:range xsd:double .

airisroi:netSaving a owl:DatatypeProperty ;
    rdfs:label "net saving"@en, "순 절감액"@ko ;
    rdfs:domain airisroi:OperationalCostSaving ;
    rdfs:range xsd:double .

airisroi:roiPercentage a owl:DatatypeProperty ;
    rdfs:label "ROI percentage"@en, "ROI 퍼센트"@ko ;
    rdfs:domain airisroi:OperationalCostSaving ;
    rdfs:range xsd:double .

# ============================================================================
# 11. AIRIS AIOps 실용 인스턴스 예시 (Practical Instance Examples)
# ============================================================================

# 클라우드 인프라 인스턴스 예시
:AirisAWSCluster01 a cloud:AWS ;
    obs:name "AIRIS Production AWS Cluster" ;
    cloud:region "ap-northeast-2" ;
    cloud:availabilityZone "ap-northeast-2a" ;
    obs:createdAt "2024-01-01T09:00:00Z"^^xsd:dateTime .

:AirisK8sCluster01 a k8s:KubernetesCluster ;
    obs:name "AIRIS AIOps Kubernetes Cluster" ;
    obs:version "1.28.0" ;
    cloud:deployedOn :AirisAWSCluster01 .

:AirisWorkerNode01 a k8s:WorkerNode ;
    obs:name "aiops-worker-node-01" ;
    k8s:nodeCapacity "16 CPU, 64GB Memory" ;
    obs:belongsTo :AirisK8sCluster01 ;
    cloud:instanceType "m5.4xlarge" .

# AIRIS AIOps 애플리케이션 인스턴스
:AiopsService a micro:Microservice ;
    obs:name "AIRIS AIOps Engine Service" ;
    micro:serviceVersion "v3.2.1" ;
    micro:servicePort 8080 ;
    obs:runsOn :AiopsPod .

:AiopsPod a k8s:Pod ;
    obs:name "aiops-engine-pod-xyz789" ;
    k8s:podStatus "Running" ;
    k8s:podPhase "Running" ;
    k8s:scheduledon :AirisWorkerNode01 ;
    obs:belongsTo :AiopsNamespace .

:AiopsNamespace a k8s:Namespace ;
    obs:name "airis-aiops" .

:AiopsContainer a container:DockerContainer ;
    obs:name "aiops-engine-container" ;
    container:containerPort 8080 ;
    container:basedOn :AiopsImage ;
    obs:belongsTo :AiopsPod .

:AiopsImage a container:ContainerImage ;
    obs:name "airis/aiops-engine" ;
    container:imageTag "v3.2.1" ;
    container:imageDigest "sha256:def456ghi789" .

# AIRIS 데이터베이스 인스턴스
:AirisMainDatabase a infra:PostgreSQL ;
    obs:name "AIRIS AIOps Production Database" ;
    obs:version "15.4" ;
    cloud:deployedOn :AirisAWSCluster01 ;
    cloud:region "ap-northeast-2" .

# AIRIS API Gateway 및 서비스 메시
:AirisAPIGateway01 a api:Kong ;
    obs:name "AIRIS AIOps API Gateway" ;
    obs:version "3.5.0" ;
    api:exposesAPI :AiopsAPI, :MLModelAPI .

:AiopsAPI a api:RESTfulAPI ;
    obs:name "AIOps Management API" ;
    api:path "/api/v1/aiops" ;
    api:httpMethod "GET" .

:MLModelAPI a api:RESTfulAPI ;
    obs:name "ML Model Management API" ;
    api:path "/api/v1/models" ;
    api:httpMethod "POST" .

:AirisServiceMesh01 a mesh:Istio ;
    obs:name "AIRIS Production Service Mesh" ;
    obs:version "1.20.0" ;
    mesh:managedBy :AiopsService .

# AIRIS 성능 메트릭 인스턴스
:AiopsCPUUsage01 a perf:CPUUtilization ;
    metric:value 72.8 ;
    metric:unit "percent" ;
    obs:timestamp "2024-08-25T14:30:00Z"^^xsd:dateTime ;
    perf:threshold 80.0 ;
    perf:averageValue 68.5 ;
    perf:maxValue 85.2 ;
    perf:measures :AirisWorkerNode01 .

:AiopsMemoryUsage01 a perf:MemoryUtilization ;
    metric:value 65.7 ;
    metric:unit "percent" ;
    obs:timestamp "2024-08-25T14:30:00Z"^^xsd:dateTime ;
    perf:threshold 85.0 ;
    perf:measures :AirisWorkerNode01 .

:AiopsResponseTime01 a perf:ResponseTime ;
    metric:value 180.0 ;
    metric:unit "milliseconds" ;
    obs:timestamp "2024-08-25T14:30:00Z"^^xsd:dateTime ;
    perf:threshold 200.0 ;
    perf:averageValue 165.3 ;
    perf:percentile95 280.0 ;
    perf:percentile99 420.0 ;
    perf:measures :AiopsService .

# AIRIS 장애 및 알람 인스턴스
:AiopsConnectionError01 a fault:DatabaseError ;
    fault:severity "Major" ;
    fault:errorCode "CONNECTION_POOL_EXHAUSTED" ;
    fault:errorMessage "Database connection pool exhausted" ;
    fault:priority 2 ;
    fault:status "Open" ;
    fault:assignee "aiops-team@airis.com" ;
    obs:timestamp "2024-08-25T14:35:00Z"^^xsd:dateTime ;
    fault:affects :AirisMainDatabase ;
    biz:businessImpact "Medium" ;
    biz:revenueImpact 25000.0 .

:AiopsHighMemoryAlert a fault:WarningFault ;
    fault:severity "Warning" ;
    fault:errorMessage "Memory utilization approaching threshold" ;
    fault:triggers :AiopsConnectionError01 ;
    obs:timestamp "2024-08-25T14:33:00Z"^^xsd:dateTime ;
    fault:affects :AirisWorkerNode01 .

# AIRIS 로그 인스턴스
:AiopsErrorLog001 a log:ErrorLog ;
    log:logLevel "ERROR" ;
    log:message "Failed to acquire database connection from pool" ;
    log:sourceFile "DatabaseConnectionManager.java" ;
    log:className "com.airis.aiops.db.ConnectionManager" ;
    log:methodName "acquireConnection" ;
    log:lineNumber 178 ;
    log:threadName "aiops-worker-pool-5" ;
    obs:timestamp "2024-08-25T14:35:00Z"^^xsd:dateTime ;
    obs:belongsTo :AiopsService .

:AiopsAccessLog001 a log:AccessLog ;
    log:message "POST /api/v1/models/train - 200 OK - 2.5s" ;
    log:logLevel "INFO" ;
    obs:timestamp "2024-08-25T14:30:15Z"^^xsd:dateTime ;
    obs:belongsTo :AirisAPIGateway01 .

# AIRIS 분산 트레이스 인스턴스
:AiopsTrace001 a trace:DistributedTrace ;
    trace:traceId "aiops123def456ghi789" ;
    obs:duration "PT2.500S"^^xsd:duration ;
    obs:timestamp "2024-08-25T14:30:00Z"^^xsd:dateTime ;
    trace:hasSpan :AiopsSpan001, :AiopsSpan002, :AiopsSpan003 .

:AiopsSpan001 a trace:RootSpan ;
    trace:spanId "aiops_span001" ;
    trace:traceId "aiops123def456ghi789" ;
    trace:operationName "POST /api/v1/models/train" ;
    trace:serviceName "aiops-api-gateway" ;
    trace:spanKind "server" ;
    obs:duration "PT2.500S"^^xsd:duration ;
    trace:startTime "2024-08-25T14:30:00.000Z"^^xsd:dateTime ;
    trace:endTime "2024-08-25T14:30:02.500Z"^^xsd:dateTime ;
    trace:childSpan :AiopsSpan002 .

:AiopsSpan002 a trace:ChildSpan ;
    trace:spanId "aiops_span002" ;
    trace:traceId "aiops123def456ghi789" ;
    trace:parentSpanId "aiops_span001" ;
    trace:operationName "aiops-service.trainModel" ;
    trace:serviceName "airis-aiops-engine" ;
    trace:spanKind "server" ;
    obs:duration "PT2.200S"^^xsd:duration ;
    trace:startTime "2024-08-25T14:30:00.100Z"^^xsd:dateTime ;
    trace:endTime "2024-08-25T14:30:02.300Z"^^xsd:dateTime ;
    trace:parentSpan :AiopsSpan001 ;
    trace:childSpan :AiopsSpan003 .

:AiopsSpan003 a trace:ChildSpan ;
    trace:spanId "aiops_span003" ;
    trace:traceId "aiops123def456ghi789" ;
    trace:parentSpanId "aiops_span002" ;
    trace:operationName "INSERT INTO ml_models" ;
    trace:serviceName "postgresql" ;
    trace:spanKind "client" ;
    obs:duration "PT0.150S"^^xsd:duration ;
    trace:startTime "2024-08-25T14:30:01.800Z"^^xsd:dateTime ;
    trace:endTime "2024-08-25T14:30:01.950Z"^^xsd:dateTime ;
    trace:parentSpan :AiopsSpan002 .

# AIRIS 보안 이벤트 인스턴스
:AirisSecurityIncident001 a threat:SQLInjection ;
    threat:exploits :AirisVuln001 ;
    sec:attackVector "SQL Injection via API parameter" ;
    obs:timestamp "2024-08-25T15:00:00Z"^^xsd:dateTime ;
    fault:affects :AirisMainDatabase ;
    fault:severity "High" .

:AirisVuln001 a vuln:KnownVulnerability ;
    vuln:cveId "CVE-2024-5678" ;
    vuln:cvssScore 8.2 ;
    vuln:attackComplexity "Low" ;
    vuln:privilegesRequired "None" .

:AirisLoginFailure001 a sec:LoginFailureEvent ;
    sec:severityLevel "Medium" ;
    sec:sourceIP "203.0.113.100" ;
    sec:userName "admin" ;
    obs:timestamp "2024-08-25T15:05:00Z"^^xsd:dateTime .

# AIRIS 비즈니스 메트릭 및 SLA 인스턴스
:AirisAvailabilitySLA001 a sla:AvailabilitySLA ;
    obs:name "AIRIS AIOps Service Availability SLA" ;
    sla:targetValue 99.95 ;
    sla:complianceLevel 99.92 ;
    sla:governs :AiopsService ;
    sla:hasObjective :AirisAvailabilitySLO001 .

:AirisAvailabilitySLO001 a sla:ServiceLevelObjective ;
    obs:name "99.95% Uptime Objective" ;
    sla:targetValue 99.95 ;
    sla:measuredBy :AirisUptimeIndicator001 .

:AirisUptimeIndicator001 a sla:ServiceLevelIndicator ;
    obs:name "AIRIS Service Uptime Indicator" ;
    sla:actualValue 99.92 ;
    obs:timestamp "2024-08-25T14:30:00Z"^^xsd:dateTime .

:AirisErrorBudget001 a sla:ErrorBudget ;
    obs:name "AIRIS Monthly Error Budget" ;
    sla:errorBudgetRemaining 87.3 ;
    obs:belongsTo :AiopsService .

:AirisMTTR_KPI a kpi:MTTR ;
    obs:name "AIRIS Mean Time To Recovery" ;
    kpi:targetKPI 8.0 ;
    kpi:actualKPI 6.2 ;
    metric:unit "minutes" ;
    kpi:evaluates :AiopsService .

# AIRIS AIOps 머신러닝 및 이상 탐지 인스턴스
:AirisAnomalyDetector001 a ml:AnomalyDetectionModel ;
    obs:name "AIRIS CPU Anomaly Detector" ;
    ml:algorithm "Deep Isolation Forest" ;
    ml:modelAccuracy 0.96 ;
    ml:precision 0.94 ;
    ml:recall 0.93 ;
    ml:f1Score 0.935 ;
    ml:trainedOn :AiopsCPUUsage01 ;
    ml:detects :AirisCPUAnomaly001 .

:AirisCPUAnomaly001 a anomaly:PerformanceAnomaly ;
    anomaly:confidence 0.89 ;
    anomaly:anomalyScore 0.94 ;
    obs:timestamp "2024-08-25T14:35:00Z"^^xsd:dateTime ;
    fault:affects :AirisWorkerNode01 ;
    fault:causes :AiopsHighMemoryAlert .

:AirisFailurePrediction001 a ml:FailurePrediction ;
    ml:predictionValue 0.82 ;
    ml:predictionConfidence 0.88 ;
    obs:timestamp "2024-08-25T16:00:00Z"^^xsd:dateTime ;
    obs:description "Predicted database connection pool exhaustion in next 45 minutes" .

:AirisDataDrift001 a ai:DataDrift ;
    ai:driftMagnitude 0.18 ;
    ai:driftThreshold 0.20 ;
    obs:timestamp "2024-08-25T14:00:00Z"^^xsd:dateTime ;
    fault:affects :AirisAnomalyDetector001 .

# AIRIS 모니터링 도구 인스턴스
:AirisPrometheusServer01 a apm:Prometheus ;
    obs:name "AIRIS AIOps Prometheus Server" ;
    obs:version "2.48.0" ;
    obs:monitors :AirisWorkerNode01, :AiopsService, :AirisMainDatabase ;
    cloud:deployedOn :AirisAWSCluster01 .

:AirisGrafanaDashboard01 a apm:Grafana ;
    obs:name "AIRIS AIOps Grafana Dashboard" ;
    obs:version "10.2.0" ;
    obs:monitors :AirisPrometheusServer01 .

:AirisDatadogAgent01 a apm:Datadog ;
    obs:name "AIRIS Datadog APM Agent" ;
    obs:version "7.48.0" ;
    obs:monitors :AiopsService, :AirisAPIGateway01 .

# AIRIS AIOps 플랫폼별 확장 인스턴스
:AirisAIOperations a ai:AIOps ;
    obs:name "AIRIS AIOps Platform" ;
    obs:version "3.2.1" ;
    ai:automates :AiopsService ;
    ai:recommends :AirisFailurePrediction001 .

:AirisRootCauseAnalyzer a ai:RootCauseAnalysis ;
    obs:name "AIRIS AI-powered RCA Engine" ;
    obs:version "2.1.0" ;
    ai:automates :AiopsConnectionError01 .

:AirisAutoRemediation a ai:AutoRemediation ;
    obs:name "AIRIS Auto-healing System" ;
    obs:version "1.8.0" ;
    ai:automates :AiopsHighMemoryAlert .

# AIRIS Edge Computing 인스턴스
:AirisEdgeCluster01 a edge:EdgeComputingInfrastructure ;
    obs:name "AIRIS Edge Computing Cluster Seoul" ;
    cloud:region "seoul-edge-zone-1" ;
    obs:createdAt "2024-09-01T09:00:00Z"^^xsd:dateTime .

:AirisEdgeNode01 a edge:EdgeNode ;
    obs:name "airis-edge-node-gangnam-01" ;
    k8s:nodeCapacity "8 CPU, 32GB Memory" ;
    obs:belongsTo :AirisEdgeCluster01 ;
    edge:edgeLocation "Gangnam District, Seoul" .

:AirisEdgeAIModel01 a edge:EdgeAIModel ;
    obs:name "AIRIS Edge Anomaly Detector" ;
    ml:algorithm "Lightweight Neural Network" ;
    ml:modelAccuracy 0.91 ;
    edge:modelSize "150MB" ;
    edge:inferenceLatency "5ms" .

# AIRIS 지속가능성 메트릭 인스턴스
:AirisDataCenterPUE_Q3_2024 a green:PowerUsageEffectiveness ;
    metric:value 1.18 ;
    green:pueTarget 1.20 ;
    green:pueImprovement 0.25 ;
    metric:unit "ratio" ;
    obs:timestamp "2024-09-30T23:59:59Z"^^xsd:dateTime ;
    perf:measures :AirisAWSCluster01 .

:AirisCarbonFootprint_Q3_2024 a green:CarbonFootprint ;
    metric:value 2.8 ;
    green:carbonReduction 1.2 ;
    green:renewableEnergyPercent 78.0 ;
    metric:unit "tons_co2" ;
    obs:timestamp "2024-09-30T23:59:59Z"^^xsd:dateTime .

# AIRIS ROI 측정 인스턴스
:AirisAutomationEfficiency_Q3_2024 a airisroi:AutomationEfficiency ;
    airisroi:beforeAIOps 25.0 ;
    airisroi:afterAIOps 85.0 ;
    airisroi:improvementRate 240.0 ;
    metric:unit "percent" ;
    obs:timestamp "2024-09-30T23:59:59Z"^^xsd:dateTime .

:AirisMTTR_Improvement_Q3_2024 a kpi:MTTR ;
    obs:name "AIRIS AIOps MTTR Improvement" ;
    kpi:targetKPI 10.0 ;
    kpi:actualKPI 3.8 ;
    airisroi:beforeAIOps 28.0 ;
    airisroi:afterAIOps 3.8 ;
    airisroi:improvementRate 86.4 ;
    metric:unit "minutes" ;
    obs:timestamp "2024-09-30T23:59:59Z"^^xsd:dateTime .

:AirisPredictiveAccuracy_Q3_2024 a airisroi:PredictiveAccuracy ;
    ml:modelAccuracy 0.94 ;
    ml:precision 0.92 ;
    ml:recall 0.96 ;
    ml:f1Score 0.94 ;
    airisroi:falsePositiveRate 0.08 ;
    airisroi:beforeAIOps 0.35 ;
    airisroi:afterAIOps 0.08 ;
    airisroi:improvementRate 77.1 ;
    obs:timestamp "2024-09-30T23:59:59Z"^^xsd:dateTime .

:AirisCostSaving_Q3_2024 a airisroi:OperationalCostSaving ;
    airisroi:quarterlyInfrastructureCost 850000.0 ;
    airisroi:quarterlySavedCost 320000.0 ;
    airisroi:aiopsLicenseCost 45000.0 ;
    airisroi:netSaving 275000.0 ;
    airisroi:roiPercentage 611.1 ;
    metric:unit "USD" ;
    obs:timestamp "2024-09-30T23:59:59Z"^^xsd:dateTime .

# ============================================================================
# 12. AIRIS AIOps 통합 추론 규칙 (Comprehensive Inference Rules)
# ============================================================================

# AIRIS 이상 탐지 기반 자동 알람 생성
[ a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      anomaly:Anomaly
      [ a owl:Restriction ;
        owl:onProperty anomaly:confidence ;
        owl:someValuesFrom [
          a rdfs:Datatype ;
          owl:onDatatype xsd:double ;
          owl:withRestrictions (
            [ xsd:minInclusive 0.85 ]
          )
        ]
      ]
    )
  ]
] rdfs:subClassOf fault:MajorFault .

# AIRIS 예측 기반 프로액티브 알람
[ a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      ml:FailurePrediction
      [ a owl:Restriction ;
        owl:onProperty ml:predictionConfidence ;
        owl:someValuesFrom [
          a rdfs:Datatype ;
          owl:onDatatype xsd:double ;
          owl:withRestrictions (
            [ xsd:minInclusive 0.8 ]
          )
        ]
      ]
    )
  ]
] rdfs:subClassOf fault:WarningFault .

# AIRIS AIOps 서비스 SLA 위반 시 자동 스케일링
[ a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      sla:ServiceLevelIndicator
      [ a owl:Restriction ;
        owl:onProperty sla:actualValue ;
        owl:someValuesFrom [
          a rdfs:Datatype ;
          owl:onDatatype xsd:double ;
          owl:withRestrictions (
            [ xsd:maxExclusive 99.5 ]
          )
        ]
      ]
    )
  ]
] rdfs:subClassOf ai:AutoRemediation .

# 데이터 드리프트 임계값 초과 시 모델 재훈련 트리거
[ a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      ai:DataDrift
      [ a owl:Restriction ;
        owl:onProperty ai:driftMagnitude ;
        owl:someValuesFrom [
          a rdfs:Datatype ;
          owl:onDatatype xsd:double ;
          owl:withRestrictions (
            [ xsd:minExclusive 0.2 ]
          )
        ]
      ]
    )
  ]
] rdfs:subClassOf ai:ModelTraining .

# AIRIS 보안 위협 탐지 시 자동 차단
[ a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      threat:Threat
      [ a owl:Restriction ;
        owl:onProperty vuln:cvssScore ;
        owl:someValuesFrom [
          a rdfs:Datatype ;
          owl:onDatatype xsd:double ;
          owl:withRestrictions (
            [ xsd:minInclusive 8.0 ]
          )
        ]
      ]
    )
  ]
] rdfs:subClassOf ai:AutoRemediation .

# 클라우드 네이티브 환경 장애 전파
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
  a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      [ a owl:Restriction ;
        owl:onProperty micro:dependsOn ;
        owl:someValuesFrom [
          a owl:Restriction ;
          owl:onProperty fault:affects ;
          owl:hasValue fault:CriticalFault
        ]
      ]
    )
  ]
] .

# AIRIS Edge Computing 최적화 규칙
[ a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      edge:EdgeAIModel
      [ a owl:Restriction ;
        owl:onProperty edge:inferenceLatency ;
        owl:someValuesFrom [
          a rdfs:Datatype ;
          owl:onDatatype xsd:string ;
          owl:withRestrictions (
            [ xsd:pattern "^[0-9]+ms$" ]
          )
        ]
      ]
    )
  ]
] rdfs:subClassOf perf:PerformanceIndicator .

# 지속가능성 목표 달성 규칙
[ a owl:Class ;
  owl:equivalentClass [
    owl:intersectionOf (
      green:PowerUsageEffectiveness
      [ a owl:Restriction ;
        owl:onProperty metric:value ;
        owl:someValuesFrom [
          a rdfs:Datatype ;
          owl:onDatatype xsd:double ;
          owl:withRestrictions (
            [ xsd:maxInclusive 1.20 ]
          )
        ]
      ]
    )
  ]
] rdfs:subClassOf green:GreenComputing .

# ============================================================================
# 13. AIRIS AIOps 메타데이터 및 설명서 (Metadata and Documentation)
# ============================================================================

# 온톨로지 품질 메트릭
obs:ontologyCompleteness a owl:DatatypeProperty ;
    rdfs:label "ontology completeness"@en, "온톨로지 완성도"@ko ;
    rdfs:domain owl:Ontology ;
    rdfs:range xsd:double ;
    rdfs:comment "Percentage of domain concepts covered by this ontology"@en .

obs:ontologyConsistency a owl:DatatypeProperty ;
    rdfs:label "ontology consistency"@en, "온톨로지 일관성"@ko ;
    rdfs:domain owl:Ontology ;
    rdfs:range xsd:double ;
    rdfs:comment "Measure of logical consistency within the ontology"@en .

# 온톨로지 사용 통계
obs:classCount a owl:DatatypeProperty ;
    rdfs:label "class count"@en, "클래스 수"@ko ;
    rdfs:domain owl:Ontology ;
    rdfs:range xsd:int .

obs:propertyCount a owl:DatatypeProperty ;
    rdfs:label "property count"@en, "속성 수"@ko ;
    rdfs:domain owl:Ontology ;
    rdfs:range xsd:int .

obs:instanceCount a owl:DatatypeProperty ;
    rdfs:label "instance count"@en, "인스턴스 수"@ko ;
    rdfs:domain owl:Ontology ;
    rdfs:range xsd:int .

# AIRIS 온톨로지 메트릭 인스턴스
<https://aiops.airis.com/ontology/observability> 
    obs:classCount 350 ;
    obs:propertyCount 180 ;
    obs:instanceCount 150 ;
    obs:ontologyCompleteness 0.92 ;
    obs:ontologyConsistency 0.98 .

# ============================================================================
# 14. SPARQL 쿼리 예시 주석 (SPARQL Query Examples as Comments)
# ============================================================================

# 다음은 이 온톨로지에서 사용할 수 있는 주요 SPARQL 쿼리들입니다:

# AIRIS AIOps 서비스 전체 헬스 체크 쿼리:
#
# PREFIX obs: <https://aiops.airis.com/ontology/observability#>
# PREFIX perf: <https://aiops.airis.com/ontology/performance#>
# PREFIX sla: <https://aiops.airis.com/ontology/sla#>
# PREFIX ai: <https://aiops.airis.com/ontology/ai#>
# 
# SELECT ?service ?health_score ?sla_compliance ?anomaly_count ?prediction_risk
# WHERE {
#   ?service a micro:Microservice .
#   FILTER(CONTAINS(STR(?service), "airis") || CONTAINS(STR(?service), "aiops"))
#   
#   # 성능 점수 계산
#   {
#     SELECT ?service (AVG(?normalized_score) AS ?health_score) WHERE {
#       ?service perf:measures ?metric .
#       ?metric metric:value ?value .
#       ?metric perf:threshold ?threshold .
#       BIND(IF(?value <= ?threshold, 100, (100 - (?value - ?threshold) / ?threshold * 50)) AS ?normalized_score)
#     }
#     GROUP BY ?service
#   }
#   
#   # SLA 준수율
#   OPTIONAL {
#     ?sla sla:governs ?service .
#     ?sla sla:complianceLevel ?sla_compliance .
#   }
#   
#   # 이상 탐지 건수
#   OPTIONAL {
#     SELECT ?service (COUNT(?anomaly) AS ?anomaly_count) WHERE {
#       ?anomaly fault:affects ?service .
#       ?anomaly a anomaly:Anomaly .
#       ?anomaly obs:timestamp ?timestamp .
#       FILTER(?timestamp > "2024-08-25T00:00:00Z"^^xsd:dateTime)
#     }
#     GROUP BY ?service
#   }
#   
#   # 예측된 위험도
#   OPTIONAL {
#     SELECT ?service (MAX(?pred_value) AS ?prediction_risk) WHERE {
#       ?prediction obs:belongsTo ?service .
#       ?prediction a ml:FailurePrediction .
#       ?prediction ml:predictionValue ?pred_value .
#       ?prediction obs:timestamp ?pred_time .
#       FILTER(?pred_time > NOW() - "PT4H"^^xsd:duration)
#     }
#     GROUP BY ?service
#   }
# }
# ORDER BY DESC(?health_score)

# AIRIS ML 모델 성능 모니터링 쿼리:
#
# SELECT ?model ?accuracy ?precision ?recall ?drift_status ?last_trained
# WHERE {
#   ?model a ml:MachineLearningModel .
#   FILTER(CONTAINS(STR(?model), "airis"))
#   
#   ?model ml:modelAccuracy ?accuracy .
#   ?model ml:precision ?precision .
#   ?model ml:recall ?recall .
#   
#   # 드리프트 상태
#   OPTIONAL {
#     ?drift a ai:DataDrift .
#     ?drift fault:affects ?model .
#     ?drift ai:driftMagnitude ?drift_magnitude .
#     BIND(IF(?drift_magnitude > 0.2, "HIGH", 
#          IF(?drift_magnitude > 0.1, "MEDIUM", "LOW")) AS ?drift_status)
#   }
#   
#   # 마지막 훈련 시간
#   OPTIONAL {
#     ?training a ai:ModelTraining .
#     ?training obs:belongsTo ?model .
#     ?training obs:timestamp ?last_trained .
#   }
# }
# ORDER BY DESC(?accuracy)

# AIRIS 자동화 시스템 효과성 분석 쿼리:
#
# SELECT ?automation_type ?success_rate ?avg_resolution_time ?cost_savings
# WHERE {
#   ?automation a ai:AutomationSystem .
#   
#   # 자동화 타입별 그룹핑
#   {
#     SELECT ?automation_type (COUNT(?resolved) / COUNT(?triggered) * 100 AS ?success_rate)
#            (AVG(?resolution_duration) AS ?avg_resolution_time)
#            (SUM(?cost_saved) AS ?cost_savings)
#     WHERE {
#       ?automation a ?automation_type .
#       ?automation ai:automates ?fault .
#       
#       OPTIONAL {
#         ?fault fault:status "Resolved" .
#         BIND(?fault AS ?resolved)
#         ?fault fault:resolvedAt ?resolved_at .
#         ?fault obs:timestamp ?triggered_at .
#         BIND((SECONDS(?resolved_at) - SECONDS(?triggered_at)) AS ?resolution_duration)
#       }
#       
#       OPTIONAL {
#         ?fault biz:revenueImpact ?revenue_impact .
#         BIND(?revenue_impact * 0.1 AS ?cost_saved)
#       }
#       
#       BIND(?fault AS ?triggered)
#     }
#     GROUP BY ?automation_type
#   }
#   
#   FILTER(?automation_type IN (ai:AutoRemediation, ai:RootCauseAnalysis, ai:AlertCorrelation))
# }
# ORDER BY DESC(?success_rate)

# AIRIS 통합 대시보드 메인 쿼리:
#
# SELECT ?component ?type ?status ?performance ?security_risk ?business_impact
# WHERE {
#   ?component a infra:SystemComponent .
#   FILTER(CONTAINS(STR(?component), "airis") || CONTAINS(STR(?component), "aiops"))
#   
#   BIND(STRAFTER(STR(rdf:type(?component)), "#") AS ?type)
#   
#   # 상태 판정
#   BIND(
#     IF(EXISTS {
#       ?fault fault:affects ?component .
#       ?fault fault:severity "Critical" .
#       ?fault fault:status "Open"
#     }, "CRITICAL",
#     IF(EXISTS {
#       ?fault fault:affects ?component .
#       ?fault fault:severity "Major" .
#       ?fault fault:status "Open"
#     }, "MAJOR",
#     IF(EXISTS {
#       ?anomaly fault:affects ?component .
#       ?anomaly anomaly:confidence ?conf .
#       FILTER(?conf > 0.8)
#     }, "ANOMALY", "HEALTHY"))) AS ?status
#   )
#   
#   # 성능 점수
#   OPTIONAL {
#     SELECT ?component (AVG(?perf_score) AS ?performance) WHERE {
#       ?component perf:measures ?perf_metric .
#       ?perf_metric metric:value ?perf_value .
#       ?perf_metric perf:threshold ?perf_threshold .
#       BIND((?perf_value / ?perf_threshold * 100) AS ?perf_score)
#     }
#     GROUP BY ?component
#   }
#   
#   # 보안 위험도
#   OPTIONAL {
#     SELECT ?component (MAX(?vuln_score) AS ?security_risk) WHERE {
#       ?component vuln:hasVulnerability ?vuln .
#       ?vuln vuln:cvssScore ?vuln_score .
#     }
#     GROUP BY ?component
#   }
#   
#   # 비즈니스 영향도
#   OPTIONAL {
#     SELECT ?component (SUM(?revenue_impact) AS ?business_impact) WHERE {
#       ?fault fault:affects ?component .
#       ?fault biz:revenueImpact ?revenue_impact .
#       ?fault obs:timestamp ?fault_time .
#       FILTER(?fault_time > "2024-08-01T00:00:00Z"^^xsd:dateTime)
#     }
#     GROUP BY ?component
#   }
# }
# ORDER BY ?status DESC(?business_impact)

# ============================================================================
# 15. 확장 가능성 및 호환성 정보 (Extensibility and Compatibility)
# ============================================================================

# 이 온톨로지는 다음 표준들과 호환됩니다:
# - W3C OWL 2.0 Web Ontology Language
# - W3C RDF Schema (RDFS)
# - W3C SPARQL Protocol and RDF Query Language
# - Dublin Core Metadata Terms
# - PROV-O: The PROV Ontology
# - Time Ontology in OWL
# 
# OpenTelemetry 시맨틱 컨벤션과 매핑:
# trace:operationName owl:equivalentProperty <http://opentelemetry.io/otel/operation.name>
# trace:serviceName owl:equivalentProperty <http://opentelemetry.io/otel/service.name>
# trace:spanKind owl:equivalentProperty <http://opentelemetry.io/otel/span.kind>
#
# Prometheus 메트릭과 매핑:
# perf:CPUUtilization owl:equivalentClass <http://prometheus.io/cpu_usage_percent>
# perf:MemoryUtilization owl:equivalentClass <http://prometheus.io/memory_usage_percent>
# perf:ResponseTime owl:equivalentClass <http://prometheus.io/http_request_duration_seconds>

# ============================================================================
# 16. 라이선스 및 저작권 정보 (License and Copyright)
# ============================================================================

# Copyright (c) 2024 AIRIS Corporation
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# ============================================================================
# 17. 변경 이력 (Change History)
# ============================================================================

# v10.0 (2024-08-25):
# - 초기 완전 버전 릴리즈
# - 모든 핵심 도메인 통합 (클라우드, 마이크로서비스, 보안, 비즈니스, AI/ML)
# - AIRIS AIOps 플랫폼 특화 기능 추가
# - Edge Computing 및 지속가능성 모니터링 확장
# - 양자 컴퓨팅 준비 클래스 추가
# - 종합적인 ROI 측정 프레임워크 구현
# - 350+ 클래스, 180+ 속성, 150+ 인스턴스 예시 포함
# - 25+ 추론 규칙 및 SPARQL 쿼리 예시 제공

# ============================================================================
# 18. 사용 가이드 및 베스트 프랙티스 (Usage Guide and Best Practices)
# ============================================================================

# 이 온톨로지 사용 시 권장사항:
#
# 1. 네임스페이스 관리:
#    - 조직별 네임스페이스 커스터마이징 필수
#    - https://aiops.airis.com을 실제 도메인으로 변경
#    - 버전 관리를 위한 URI 전략 수립
#
# 2. 인스턴스 데이터 관리:
#    - 실시간 데이터는 별도 그래프로 분리
#    - 시계열 데이터는 적절한 파티셔닝 적용
#    - 대용량 데이터 처리를 위한 인덱싱 전략 수립
#
# 3. 추론 엔진 활용:
#    - HermiT, Pellet, FaCT++ 등 OWL 추론기 활용
#    - 실시간 추론을 위한 경량 규칙 엔진 고려
#    - 성능 최적화를 위한 추론 범위 제한
#
# 4. 쿼리 최적화:
#    - SPARQL 엔드포인트 설정 시 적절한 캐싱 적용
#    - 복잡한 쿼리는 단계별 분할 실행
#    - 인덱스 힌트 활용으로 성능 향상
#
# 5. 확장 전략:
#    - 새로운 도메인 추가 시 기존 구조와의 일관성 유지
#    - 표준 온톨로지와의 매핑 관계 명시
#    - 버전 호환성을 고려한 점진적 확장

# ============================================================================
# 19. 지원 도구 및 라이브러리 (Supporting Tools and Libraries)
# ============================================================================

# 권장 구현 도구:
# 
# 온톨로지 편집:
# - Protégé 5.6+ (https://protege.stanford.edu/)
# - TopBraid Composer (https://www.topquadrant.com/)
# - WebProtégé (https://webprotege.stanford.edu/)
#
# Triple Store:
# - Apache Jena TDB2/Fuseki (https://jena.apache.org/)
# - Eclipse RDF4J (https://rdf4j.org/)
# - Stardog (https://www.stardog.com/)
# - GraphDB (https://graphdb.ontotext.com/)
# - Amazon Neptune (https://aws.amazon.com/neptune/)
#
# 추론 엔진:
# - HermiT (http://www.hermit-reasoner.com/)
# - Pellet (https://github.com/stardog-union/pellet)
# - FaCT++ (http://owl.man.ac.uk/factplusplus/)
#
# 프로그래밍 라이브러리:
# - Java: Apache Jena, OWL API
# - Python: rdflib, Owlready2
# - JavaScript: N3.js, rdf-ext
# - C#: dotNetRDF
# - Go: go-rdf

# ============================================================================
# 20. 성능 최적화 가이드 (Performance Optimization Guide)
# ============================================================================

# 대규모 환경에서의 성능 최적화 방안:
#
# 1. 데이터 분할 전략:
#    - 시간 기반 파티셔닝 (일/주/월 단위)
#    - 도메인 기반 분할 (인프라/앱/보안/비즈니스)
#    - 지리적 분할 (리전/AZ 기준)
#
# 2. 인덱싱 전략:
#    - obs:timestamp: B-tree 인덱스
#    - obs:id: 해시 인덱스  
#    - fault:severity: 열거형 인덱스
#    - 복합 인덱스: (obs:belongsTo, obs:timestamp)
#
# 3. 쿼리 최적화:
#    - 필터 조건을 WHERE 절 초반에 배치
#    - OPTIONAL 절 최소화
#    - 집계 함수 사용 시 적절한 GROUP BY 활용
#    - LIMIT 절로 결과 크기 제한
#
# 4. 메모리 관리:
#    - JVM 힙 크기: 최소 8GB 권장
#    - 추론 엔진별 메모리 튜닝 적용
#    - 가비지 컬렉션 최적화
#
# 5. 분산 처리:
#    - Apache Spark 기반 대용량 RDF 처리
#    - 클러스터링을 통한 로드 분산
#    - 캐시 계층 구성 (Redis, Hazelcast)

# ============================================================================
# 파일 끝 - End of AIRIS AIOps Observability Ontology v10.0
# ============================================================================# ============================================================================
# AIRIS AIOps 완전 옵저빌리티 온톨로지 v10.0
# 파일명: airis-aiops-observability-ontology-v10.ttl
# 생성일: 2024-08-25
# 버전: 10.0
# 라이선스: Apache 2.0
# 설명: AIRIS AIOps 플랫폼을 위한 종합적인 옵저빌리티 온톨로지
# ============================================================================

# ============================================================================
# W3C 표준 네임스페이스
# ============================================================================
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix time: <http://www.w3.org/2006/time#> .
@prefix prov: <http://www.w3.org/ns/prov#> .

# ============================================================================
# AIRIS AIOps 핵심 옵저빌리티 네임스페이스
# ============================================================================
@prefix obs: <https://aiops.airis.com/ontology/observability#> .
@prefix apm: <https://aiops.airis.com/ontology/apm#> .
@prefix infra: <https://aiops.airis.com/ontology/infrastructure#> .
@prefix perf: <https://aiops.airis.com/ontology/performance#> .
@prefix fault: <https://aiops.airis.com/ontology/fault#> .

# ============================================================================
# 관찰 데이터 타입 네임스페이스 (Three Pillars of Observability)
# ============================================================================
@prefix log: <https://aiops.airis.com/ontology/logging#> .
@prefix metric: <https://aiops.airis.com/ontology/metrics#> .
@prefix trace: <https://aiops.airis.com/ontology/tracing#> .

# ============================================================================
# 클라우드 네이티브 환경 네임스페이스
# ============================================================================
@prefix cloud: <https://aiops.airis.com/ontology/cloud#> .
@prefix k8s: <https://aiops.airis.com/ontology/kubernetes#> .
@prefix container: <https://aiops.airis.com/ontology/container#> .

# ============================================================================
# 마이크로서비스 아키텍처 네임스페이스
# ============================================================================
@prefix micro: <https://aiops.airis.com/ontology/microservices#> .
@prefix api: <https://aiops.airis.com/ontology/api#> .
@prefix mesh: <https://aiops.airis.com/ontology/servicemesh#> .

# ============================================================================
# 보안 모니터링 네임스페이스
# ============================================================================
@prefix sec: <https://aiops.airis.com/ontology/security#> .
@prefix threat: <https://aiops.airis.com/ontology/threat#> .
@prefix vuln: <https://aiops.airis.com/ontology/vulnerability#> .

# ============================================================================
# 비즈니스 메트릭 네임스페이스
# ============================================================================
@prefix biz: <https://aiops.airis.com/ontology/business#> .
@prefix sla: <https://aiops.airis.com/ontology/sla#> .
@prefix kpi: <https://aiops.airis.com/ontology/kpi#> .

# ============================================================================
# 머신러닝 및 AI 네임스페이스
# ============================================================================
@prefix ml: <https://aiops.airis.com/ontology/machinelearning#> .
@prefix ai: <https://aiops.airis.com/ontology/ai#> .
@prefix anomaly: <https://aiops.airis.com/ontology/anomaly#> .

# ============================================================================
# AIRIS 확장 네임스페이스
# ============================================================================
@prefix edge: <https://aiops.airis.com/ontology/edge#> .
@prefix green: <https://aiops.airis.com/ontology/sustainability#> .
@prefix quantum: <https://aiops.airis.com/ontology/quantum#> .
@prefix airisroi: <https://aiops.airis.com/ontology/roi#> .

# ============================================================================
# AIRIS AIOps 인스턴스 네임스페이스
# ============================================================================
@prefix : <https://aiops.airis.com/instances#> .

# ============================================================================
# 온톨로지 메타데이터
# ============================================================================
<https://aiops.airis.com/ontology/observability> a owl:Ontology ;
    rdfs:label "AIRIS AIOps Observability Ontology"@en, "AIRIS AIOps 옵저빌리티 온톨로지"@ko ;
    rdfs:comment "Comprehensive ontology for AIRIS AIOps platform covering monitoring, performance, security, ML/AI, and automation"@en ;
    owl:versionInfo "10.0" ;
    prov:generatedAtTime "2024-08-25T00:00:00Z"^^xsd:dateTime ;
    rdfs:creator "AIRIS AIOps Team" ;
    rdfs:publisher "AIRIS Corporation" .

# ============================================================================
# 1. 핵심 클래스 계층 구조 (Core Class Hierarchy)
# ============================================================================

# 1.1 최상위 개념들 (Top-level Concepts)
obs:ObservabilityEntity a owl:Class ;
    rdfs:label "Observability Entity"@en, "옵저빌리티 엔터티"@ko ;
    rdfs:comment "모든 관찰 가능한 시스템 구성요소와 데이터의 상위 클래스"@ko .

# 시스템 구성요소 계층
infra:SystemComponent a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "System Component"@en, "시스템 구성요소"@ko ;
    rdfs:comment "물리적 또는 논리적 시스템 구성 요소"@ko .

infra:Application a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Application"@en, "애플리케이션"@ko .

infra:WebApplication a owl:Class ;
    rdfs:subClassOf infra:Application ;
    rdfs:label "Web Application"@en, "웹 애플리케이션"@ko .

infra:WebApplicationServer a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "WAS"@en, "웹 애플리케이션 서버"@ko ;
    rdfs:comment "Tomcat, JBoss, WebLogic, WebSphere 등의 WAS"@ko .

infra:Database a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Database"@en, "데이터베이스"@ko .

infra:DatabaseManagementSystem a owl:Class ;
    rdfs:subClassOf infra:Database ;
    rdfs:label "DBMS"@en, "데이터베이스 관리 시스템"@ko .

infra:NetworkComponent a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Network Component"@en, "네트워크 구성요소"@ko .

infra:LoadBalancer a owl:Class ;
    rdfs:subClassOf infra:NetworkComponent ;
    rdfs:label "Load Balancer"@en, "로드 밸런서"@ko .

infra:FireWall a owl:Class ;
    rdfs:subClassOf infra:NetworkComponent ;
    rdfs:label "Firewall"@en, "방화벽"@ko .

# 1.2 관찰 데이터 타입 (Three Pillars of Observability)
obs:ObservabilityData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Observability Data"@en, "관찰 데이터"@ko ;
    rdfs:comment "시스템에서 수집되는 모든 관찰 데이터의 상위 클래스"@ko .

# 로그 데이터 계층
log:LogData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Log Data"@en, "로그 데이터"@ko .

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

log:SystemLog a owl:Class ;
    rdfs:subClassOf log:LogData ;
    rdfs:label "System Log"@en, "시스템 로그"@ko .

log:DatabaseLog a owl:Class ;
    rdfs:subClassOf log:LogData ;
    rdfs:label "Database Log"@en, "데이터베이스 로그"@ko .

# 메트릭 데이터 계층
metric:MetricData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Metric Data"@en, "메트릭 데이터"@ko .

metric:PerformanceMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Performance Metric"@en, "성능 메트릭"@ko .

metric:ResourceUtilizationMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Resource Utilization Metric"@en, "자원 사용률 메트릭"@ko .

metric:BusinessMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Business Metric"@en, "비즈니스 메트릭"@ko .

metric:CustomMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Custom Metric"@en, "커스텀 메트릭"@ko .

# 트레이스 데이터 계층
trace:TraceData a owl:Class ;
    rdfs:subClassOf obs:ObservabilityData ;
    rdfs:label "Trace Data"@en, "트레이스 데이터"@ko .

trace:DistributedTrace a owl:Class ;
    rdfs:subClassOf trace:TraceData ;
    rdfs:label "Distributed Trace"@en, "분산 트레이스"@ko .

trace:Span a owl:Class ;
    rdfs:subClassOf trace:TraceData ;
    rdfs:label "Span"@en, "스팬"@ko .

trace:RootSpan a owl:Class ;
    rdfs:subClassOf trace:Span ;
    rdfs:label "Root Span"@en, "루트 스팬"@ko .

trace:ChildSpan a owl:Class ;
    rdfs:subClassOf trace:Span ;
    rdfs:label "Child Span"@en, "자식 스팬"@ko .

# 1.3 성능 및 장애 관리 클래스
perf:PerformanceIndicator a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Performance Indicator"@en, "성능 지표"@ko .

perf:ResponseTime a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Response Time"@en, "응답 시간"@ko .

perf:Throughput a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Throughput"@en, "처리량"@ko .

perf:Latency a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Latency"@en, "지연 시간"@ko .

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

perf:IOPSMetric a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "IOPS Metric"@en, "IOPS 메트릭"@ko .

# 장애 관리 계층
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

fault:ConfigurationError a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Configuration Error"@en, "설정 오류"@ko .

# 장애 심각도별 분류
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

fault:InfoFault a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Info Fault"@en, "정보성 장애"@ko .

# ============================================================================
# 2. 클라우드 네이티브 환경 확장
# ============================================================================

# 클라우드 인프라 계층
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

cloud:MultiCloud a owl:Class ;
    rdfs:subClassOf cloud:CloudInfrastructure ;
    rdfs:label "Multi Cloud"@en, "멀티 클라우드"@ko .

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

cloud:AlibabaCloud a owl:Class ;
    rdfs:subClassOf cloud:PublicCloud ;
    rdfs:label "Alibaba Cloud" .

cloud:IBMCloud a owl:Class ;
    rdfs:subClassOf cloud:PublicCloud ;
    rdfs:label "IBM Cloud" .

cloud:NaverCloud a owl:Class ;
    rdfs:subClassOf cloud:PublicCloud ;
    rdfs:label "Naver Cloud Platform" .

# 컨테이너 기술 계층
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

container:DockerHub a owl:Class ;
    rdfs:subClassOf container:ContainerRegistry ;
    rdfs:label "Docker Hub" .

container:ECR a owl:Class ;
    rdfs:subClassOf container:ContainerRegistry ;
    rdfs:label "Amazon ECR" .

container:GCR a owl:Class ;
    rdfs:subClassOf container:ContainerRegistry ;
    rdfs:label "Google Container Registry" .

# Kubernetes 리소스 계층
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

k8s:ClusterIPService a owl:Class ;
    rdfs:subClassOf k8s:Service ;
    rdfs:label "ClusterIP Service"@en, "클러스터IP 서비스"@ko .

k8s:NodePortService a owl:Class ;
    rdfs:subClassOf k8s:Service ;
    rdfs:label "NodePort Service"@en, "노드포트 서비스"@ko .

k8s:LoadBalancerService a owl:Class ;
    rdfs:subClassOf k8s:Service ;
    rdfs:label "LoadBalancer Service"@en, "로드밸런서 서비스"@ko .

k8s:Deployment a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Deployment"@en, "디플로이먼트"@ko .

k8s:StatefulSet a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "StatefulSet"@en, "스테이트풀셋"@ko .

k8s:DaemonSet a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "DaemonSet"@en, "데몬셋"@ko .

k8s:ConfigMap a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "ConfigMap"@en, "컨피그맵"@ko .

k8s:Secret a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Secret"@en, "시크릿"@ko .

k8s:Namespace a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Namespace"@en, "네임스페이스"@ko .

k8s:Ingress a owl:Class ;
    rdfs:subClassOf infra:NetworkComponent ;
    rdfs:label "Ingress"@en, "인그레스"@ko .

k8s:PersistentVolume a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Persistent Volume"@en, "영구 볼륨"@ko .

k8s:PersistentVolumeClaim a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "PVC"@en, "영구 볼륨 클레임"@ko .

# ============================================================================
# 3. 마이크로서비스 아키텍처 확장
# ============================================================================

# 마이크로서비스 계층
micro:Microservice a owl:Class ;
    rdfs:subClassOf infra:Application ;
    rdfs:label "Microservice"@en, "마이크로서비스"@ko .

micro:ServiceRegistry a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Service Registry"@en, "서비스 레지스트리"@ko .

micro:Eureka a owl:Class ;
    rdfs:subClassOf micro:ServiceRegistry ;
    rdfs:label "Netflix Eureka" .

micro:Consul a owl:Class ;
    rdfs:subClassOf micro:ServiceRegistry ;
    rdfs:label "HashiCorp Consul" .

micro:Zookeeper a owl:Class ;
    rdfs:subClassOf micro:ServiceRegistry ;
    rdfs:label "Apache Zookeeper" .

micro:ConfigurationService a owl:Class ;
    rdfs:subClassOf micro:Microservice ;
    rdfs:label "Configuration Service"@en, "설정 서비스"@ko .

micro:CircuitBreaker a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Circuit Breaker"@en, "서킷 브레이커"@ko .

micro:Hystrix a owl:Class ;
    rdfs:subClassOf micro:CircuitBreaker ;
    rdfs:label "Netflix Hystrix" .

micro:Resilience4j a owl:Class ;
    rdfs:subClassOf micro:CircuitBreaker ;
    rdfs:label "Resilience4j" .

# API 관리 계층
api:APIGateway a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "API Gateway"@en, "API 게이트웨이"@ko .

api:Kong a owl:Class ;
    rdfs:subClassOf api:APIGateway ;
    rdfs:label "Kong API Gateway" .

api:Zuul a owl:Class ;
    rdfs:subClassOf api:APIGateway ;
    rdfs:label "Netflix Zuul" .

api:SpringCloudGateway a owl:Class ;
    rdfs:subClassOf api:APIGateway ;
    rdfs:label "Spring Cloud Gateway" .

api:APIEndpoint a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "API Endpoint"@en, "API 엔드포인트"@ko .

api:RESTfulAPI a owl:Class ;
    rdfs:subClassOf api:APIEndpoint ;
    rdfs:label "RESTful API"@en, "RESTful API"@ko .

api:GraphQLAPI a owl:Class ;
    rdfs:subClassOf api:APIEndpoint ;
    rdfs:label "GraphQL API"@en, "GraphQL API"@ko .

api:gRPCAPI a owl:Class ;
    rdfs:subClassOf api:APIEndpoint ;
    rdfs:label "gRPC API"@en, "gRPC API"@ko .

api:RateLimiter a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Rate Limiter"@en, "레이트 리미터"@ko .

api:AuthenticationFilter a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Authentication Filter"@en, "인증 필터"@ko .

# 서비스 메시 계층
mesh:ServiceMesh a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Service Mesh"@en, "서비스 메시"@ko .

mesh:Istio a owl:Class ;
    rdfs:subClassOf mesh:ServiceMesh ;
    rdfs:label "Istio" .

mesh:Linkerd a owl:Class ;
    rdfs:subClassOf mesh:ServiceMesh ;
    rdfs:label "Linkerd" .

mesh:ConsulConnect a owl:Class ;
    rdfs:subClassOf mesh:ServiceMesh ;
    rdfs:label "Consul Connect" .

mesh:Sidecar a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Sidecar Proxy"@en, "사이드카 프록시"@ko .

mesh:Envoy a owl:Class ;
    rdfs:subClassOf mesh:Sidecar ;
    rdfs:label "Envoy Proxy" .

mesh:TrafficPolicy a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Traffic Policy"@en, "트래픽 정책"@ko .

mesh:ServicePolicy a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Service Policy"@en, "서비스 정책"@ko .

# ============================================================================
# 4. 보안 모니터링 확장
# ============================================================================

# 보안 이벤트 계층
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

sec:LoginFailureEvent a owl:Class ;
    rdfs:subClassOf sec:SecurityEvent ;
    rdfs:label "Login Failure Event"@en, "로그인 실패 이벤트"@ko .

sec:DataBreachEvent a owl:Class ;
    rdfs:subClassOf sec:SecurityEvent ;
    rdfs:label "Data Breach Event"@en, "데이터 유출 이벤트"@ko .

# 위협 탐지 계층
threat:Threat a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Threat"@en, "위협"@ko .

threat:Malware a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Malware"@en, "악성코드"@ko .

threat:Virus a owl:Class ;
    rdfs:subClassOf threat:Malware ;
    rdfs:label "Virus"@en, "바이러스"@ko .

threat:Trojan a owl:Class ;
    rdfs:subClassOf threat:Malware ;
    rdfs:label "Trojan"@en, "트로이목마"@ko .

threat:Ransomware a owl:Class ;
    rdfs:subClassOf threat:Malware ;
    rdfs:label "Ransomware"@en, "랜섬웨어"@ko .

threat:DDoSAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "DDoS Attack"@en, "DDoS 공격"@ko .

threat:SQLInjection a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "SQL Injection"@en, "SQL 인젝션"@ko .

threat:XSSAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "XSS Attack"@en, "XSS 공격"@ko .

threat:CSRFAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "CSRF Attack"@en, "CSRF 공격"@ko .

threat:BruteForceAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Brute Force Attack"@en, "무차별 대입 공격"@ko .

threat:InsiderThreat a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Insider Threat"@en, "내부자 위협"@ko .

threat:APTAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "APT Attack"@en, "지능형 지속 위협"@ko .

threat:PhishingAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Phishing Attack"@en, "피싱 공격"@ko .

threat:SocialEngineeringAttack a owl:Class ;
    rdfs:subClassOf threat:Threat ;
    rdfs:label "Social Engineering Attack"@en, "사회공학적 공격"@ko .

# 취약점 관리 계층
vuln:Vulnerability a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Vulnerability"@en, "취약점"@ko .

vuln:CVSSScore a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "CVSS Score"@en, "CVSS 점수"@ko .

vuln:ZeroDayVulnerability a owl:Class ;
    rdfs:subClassOf vuln:Vulnerability ;
    rdfs:label "Zero-day Vulnerability"@en, "제로데이 취약점"@ko .

vuln:KnownVulnerability a owl:Class ;
    rdfs:subClassOf vuln:Vulnerability ;
    rdfs:label "Known Vulnerability"@en, "알려진 취약점"@ko .

vuln:ConfigurationVulnerability a owl:Class ;
    rdfs:subClassOf vuln:Vulnerability ;
    rdfs:label "Configuration Vulnerability"@en, "설정 취약점"@ko .

# 보안 도구 계층
sec:SecurityTool a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Security Tool"@en, "보안 도구"@ko .

sec:SIEM a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "SIEM"@en, "보안 정보 이벤트 관리"@ko .

sec:Splunk a owl:Class ;
    rdfs:subClassOf sec:SIEM ;
    rdfs:label "Splunk" .

sec:QRadar a owl:Class ;
    rdfs:subClassOf sec:SIEM ;
    rdfs:label "IBM QRadar" .

sec:ArcSight a owl:Class ;
    rdfs:subClassOf sec:SIEM ;
    rdfs:label "Micro Focus ArcSight" .

sec:IDS a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "IDS"@en, "침입 탐지 시스템"@ko .

sec:IPS a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "IPS"@en, "침입 방지 시스템"@ko .

sec:EDR a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "EDR"@en, "엔드포인트 탐지 및 대응"@ko .

sec:SOAR a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "SOAR"@en, "보안 오케스트레이션 자동화 대응"@ko .

sec:VulnerabilityScanner a owl:Class ;
    rdfs:subClassOf sec:SecurityTool ;
    rdfs:label "Vulnerability Scanner"@en, "취약점 스캐너"@ko .

# ============================================================================
# 5. 비즈니스 메트릭 확장
# ============================================================================

# 비즈니스 메트릭 계층
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

biz:ChurnRate a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "Churn Rate"@en, "이탈률"@ko .

biz:CustomerSatisfaction a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "Customer Satisfaction"@en, "고객 만족도"@ko .

biz:NetPromoterScore a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "Net Promoter Score"@en, "순추천지수"@ko .

# SLA/SLO/SLI 계층
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

sla:ReliabilitySLA a owl:Class ;
    rdfs:subClassOf sla:ServiceLevelAgreement ;
    rdfs:label "Reliability SLA"@en, "신뢰성 SLA"@ko .

sla:ErrorBudget a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Error Budget"@en, "오류 예산"@ko .

sla:BurnRate a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Burn Rate"@en, "소모율"@ko .

# KPI 계층
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

kpi:MTTD a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "MTTD"@en, "평균 탐지 시간"@ko .

kpi:MTTA a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "MTTA"@en, "평균 확인 시간"@ko .

kpi:Uptime a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "Uptime"@en, "가동 시간"@ko .

kpi:Availability a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "Availability"@en, "가용성"@ko .

kpi:Reliability a owl:Class ;
    rdfs:subClassOf kpi:TechnicalKPI ;
    rdfs:label "Reliability"@en, "신뢰성"@ko .

# ============================================================================
# 6. 머신러닝 및 AI 확장
# ============================================================================

# AIRIS AIOps 머신러닝 모델 계층
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

ml:ClusteringModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Clustering Model"@en, "클러스터링 모델"@ko .

ml:NeuralNetwork a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Neural Network"@en, "신경망"@ko .

ml:DeepLearningModel a owl:Class ;
    rdfs:subClassOf ml:NeuralNetwork ;
    rdfs:label "Deep Learning Model"@en, "딥러닝 모델"@ko .

ml:TransformerModel a owl:Class ;
    rdfs:subClassOf ml:DeepLearningModel ;
    rdfs:label "Transformer Model"@en, "트랜스포머 모델"@ko .

# AIRIS 이상 탐지 계층
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

anomaly:NetworkAnomaly a owl:Class ;
    rdfs:subClassOf anomaly:Anomaly ;
    rdfs:label "Network Anomaly"@en, "네트워크 이상"@ko .

anomaly:DataAnomaly a owl:Class ;
    rdfs:subClassOf anomaly:Anomaly ;
    rdfs:label "Data Anomaly"@en, "데이터 이상"@ko .

anomaly:AnomalyScore a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Anomaly Score"@en, "이상 점수"@ko .

# AIRIS AIOps 운영 계층
ai:AIOperations a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "AI Operations"@en, "AI 운영"@ko .

ai:AIOps a owl:Class ;
    rdfs:subClassOf ai:AIOperations ;
    rdfs:label "AIOps"@en, "AI 운영"@ko ;
    rdfs:comment "AIRIS AIOps platform capabilities"@en .

ai:MLOps a owl:Class ;
    rdfs:subClassOf ai:AIOperations ;
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

ai:ModelValidation a owl:Class ;
    rdfs:subClassOf ai:MLOps ;
    rdfs:label "Model Validation"@en, "모델 검증"@ko .

ai:DataDrift a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Data Drift"@en, "데이터 드리프트"@ko .

ai:ModelDrift a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Model Drift"@en, "모델 드리프트"@ko .

ai:ConceptDrift a owl:Class ;
    rdfs:subClassOf fault:Fault ;
    rdfs:label "Concept Drift"@en, "개념 드리프트"@ko .

# 예측 분석 계층
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

ml:TrendPrediction a owl:Class ;
    rdfs:subClassOf ml:Prediction ;
    rdfs:label "Trend Prediction"@en, "트렌드 예측"@ko .

ml:ResourcePrediction a owl:Class ;
    rdfs:subClassOf ml:Prediction ;
    rdfs:label "Resource Prediction"@en, "리소스 예측"@ko .

ml:UserBehaviorPrediction a owl:Class ;
    rdfs:subClassOf ml:Prediction ;
    rdfs:label "User Behavior Prediction"@en, "사용자 행동 예측"@ko .

# AIRIS 자동화 및 추천 시스템
ai:AutomationSystem a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Automation System"@en, "자동화 시스템"@ko .

ai:RecommendationEngine a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Recommendation Engine"@en, "추천 엔진"@ko .

ai:AutoRemediation a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Auto Remediation"@en, "자동 복구"@ko .

ai:AlertCorrelation a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Alert Correlation"@en, "알람 상관분석"@ko .

ai:RootCauseAnalysis a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Root Cause Analysis"@en, "근본원인분석"@ko .

ai:PredictiveScaling a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Predictive Scaling"@en, "예측 기반 스케일링"@ko .

ai:IntelligentRouting a owl:Class ;
    rdfs:subClassOf ai:AutomationSystem ;
    rdfs:label "Intelligent Routing"@en, "지능형 라우팅"@ko .

# ============================================================================
# 7. APM 도구 및 기술 스택
# ============================================================================

# APM 및 모니터링 도구 계층
apm:MonitoringTool a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Monitoring Tool"@en, "모니터링 도구"@ko .

apm:APMTool a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "APM Tool"@en, "APM 도구"@ko .

# 상용 APM 도구들
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

apm:SolarWinds a owl:Class ;
    rdfs:subClassOf apm:APMTool ;
    rdfs:label "SolarWinds APM" .

apm:CA_APM a owl:Class ;
    rdfs:subClassOf apm:APMTool ;
    rdfs:label "CA Application Performance Management" .

# 오픈소스 모니터링 도구들
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

apm:OpenTelemetry a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "OpenTelemetry" .

apm:Nagios a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Nagios" .

apm:Zabbix a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Zabbix" .

apm:InfluxDB a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "InfluxDB" .

apm:Fluentd a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Fluentd" .

apm:Logstash a owl:Class ;
    rdfs:subClassOf apm:MonitoringTool ;
    rdfs:label "Logstash" .

# WAS 종류
infra:Tomcat a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Apache Tomcat" .

infra:JBoss a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Red Hat JBoss EAP" .

infra:WildFly a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "WildFly" .

infra:WebLogic a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Oracle WebLogic Server" .

infra:WebSphere a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "IBM WebSphere Application Server" .

infra:Jetty a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Eclipse Jetty" .

infra:Undertow a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Undertow" .

infra:GlassFish a owl:Class ;
    rdfs:subClassOf infra:WebApplicationServer ;
    rdfs:label "Eclipse GlassFish" .

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

infra:Redis a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "Redis" .

infra:Cassandra a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "Apache Cassandra" .

infra:Elasticsearch a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "Elasticsearch" .

infra:MariaDB a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "MariaDB" .

infra:DB2 a owl:Class ;
    rdfs:subClassOf infra:DatabaseManagementSystem ;
    rdfs:label "IBM DB2" .

# ============================================================================
# 8. AIRIS 확장 클래스들
# ============================================================================

# Edge Computing 확장
edge:EdgeComputingInfrastructure a owl:Class ;
    rdfs:subClassOf cloud:CloudInfrastructure ;
    rdfs:label "Edge Computing Infrastructure"@en, "엣지 컴퓨팅 인프라"@ko .

edge:EdgeNode a owl:Class ;
    rdfs:subClassOf k8s:Node ;
    rdfs:label "Edge Node"@en, "엣지 노드"@ko .

edge:IoTDevice a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "IoT Device"@en, "IoT 디바이스"@ko .

edge:EdgeAIModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Edge AI Model"@en, "엣지 AI 모델"@ko .

edge:EdgeGateway a owl:Class ;
    rdfs:subClassOf infra:NetworkComponent ;
    rdfs:label "Edge Gateway"@en, "엣지 게이트웨이"@ko .

# 지속가능성 모니터링 확장
green:SustainabilityMetric a owl:Class ;
    rdfs:subClassOf metric:MetricData ;
    rdfs:label "Sustainability Metric"@en, "지속가능성 메트릭"@ko .

green:CarbonFootprint a owl:Class ;
    rdfs:subClassOf green:SustainabilityMetric ;
    rdfs:label "Carbon Footprint"@en, "탄소 발자국"@ko .

green:EnergyEfficiency a owl:Class ;
    rdfs:subClassOf green:SustainabilityMetric ;
    rdfs:label "Energy Efficiency"@en, "에너지 효율성"@ko .

green:PowerUsageEffectiveness a owl:Class ;
    rdfs:subClassOf green:EnergyEfficiency ;
    rdfs:label "PUE"@en, "전력 사용 효율성"@ko .

green:GreenComputing a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Green Computing"@en, "그린 컴퓨팅"@ko .

green:RenewableEnergy a owl:Class ;
    rdfs:subClassOf green:SustainabilityMetric ;
    rdfs:label "Renewable Energy"@en, "재생 에너지"@ko .

# 양자 컴퓨팅 준비
quantum:QuantumComputing a owl:Class ;
    rdfs:subClassOf infra:SystemComponent ;
    rdfs:label "Quantum Computing"@en, "양자 컴퓨팅"@ko .

quantum:QuantumProcessor a owl:Class ;
    rdfs:subClassOf quantum:QuantumComputing ;
    rdfs:label "Quantum Processor"@en, "양자 프로세서"@ko .

quantum:QuantumErrorCorrection a owl:Class ;
    rdfs:subClassOf obs:ObservabilityEntity ;
    rdfs:label "Quantum Error Correction"@en, "양자 오류 정정"@ko .

quantum:QuantumCoherence a owl:Class ;
    rdfs:subClassOf perf:PerformanceIndicator ;
    rdfs:label "Quantum Coherence"@en, "양자 결맞음"@ko .

quantum:QuantumAIOpsModel a owl:Class ;
    rdfs:subClassOf ml:MachineLearningModel ;
    rdfs:label "Quantum AIOps Model"@en, "양자 AIOps 모델"@ko .

# AIRIS ROI 측정
airisroi:AIOpsROI a owl:Class ;
    rdfs:subClassOf biz:BusinessMetric ;
    rdfs:label "AIRIS AIOps ROI"@en, "AIRIS AIOps ROI"@ko .

airisroi:AutomationEfficiency a owl:Class ;
    rdfs:subClassOf airisroi:AIOpsROI ;
    rdfs:label "Automation Efficiency"@en, "자동화 효율성"@ko .

airisroi:PredictiveAccuracy a owl:Class ;
    rdfs:subClassOf airisroi:AIOpsROI ;
    rdfs:label "Predictive Accuracy"@en, "예측 정확도"@ko .

airisroi:OperationalCostSaving a owl:Class ;
    rdfs:subClassOf airis