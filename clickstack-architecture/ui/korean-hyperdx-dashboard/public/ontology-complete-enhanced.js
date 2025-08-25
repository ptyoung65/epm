// 완전한 온톨로지 데이터 구조 - 모든 클래스, 속성, 관계 포함
const ontologyCompleteEnhancedData = {
  nodes: [
    // ===== 핵심 관찰성 엔터티 =====
    {
      id: "obs:ObservabilityEntity",
      group: "core",
      label: "관찰 엔터티",
      description: "모든 관찰 가능한 시스템의 최상위 개념",
      category: "core",
      type: "class",
      properties: ["name", "id", "timestamp", "status", "metadata"]
    },
    {
      id: "obs:RealTimeMonitoring",
      group: "core", 
      label: "실시간 모니터링",
      description: "시스템 상태를 즉시 감시하고 분석하는 기능",
      category: "core",
      type: "class",
      properties: ["updateInterval", "dataSource", "alertEnabled", "refreshRate"]
    },

    // ===== 인프라스트럭처 컴포넌트 =====
    {
      id: "obs:InfrastructureComponent",
      group: "infrastructure",
      label: "인프라 컴포넌트", 
      description: "IT 인프라의 기본 구성 요소",
      category: "infrastructure",
      type: "class",
      properties: ["componentType", "location", "version", "healthStatus", "configuration"]
    },
    {
      id: "obs:Application",
      group: "infrastructure",
      label: "애플리케이션",
      description: "사용자가 실제로 사용하는 소프트웨어 프로그램",
      category: "infrastructure", 
      type: "class",
      properties: ["applicationName", "version", "language", "framework", "port", "endpoint", "dependencies"]
    },
    {
      id: "obs:Database",
      group: "infrastructure",
      label: "데이터베이스",
      description: "정보를 체계적으로 저장하고 관리하는 시스템",
      category: "infrastructure",
      type: "class", 
      properties: ["dbType", "version", "connectionString", "poolSize", "queryPerformance", "indexStats"]
    },
    {
      id: "obs:Network",
      group: "infrastructure",
      label: "네트워크",
      description: "컴퓨터들을 연결하는 통신망",
      category: "infrastructure",
      type: "class",
      properties: ["networkType", "bandwidth", "latency", "packetLoss", "protocol", "topology"]
    },
    {
      id: "obs:Server", 
      group: "infrastructure",
      label: "서버",
      description: "다른 컴퓨터에게 서비스를 제공하는 컴퓨터",
      category: "infrastructure",
      type: "class",
      properties: ["hostname", "ipAddress", "os", "cpuCores", "ramSize", "diskSpace", "uptime"]
    },
    {
      id: "obs:LoadBalancer",
      group: "infrastructure", 
      label: "로드 밸런서",
      description: "여러 서버에 작업을 골고루 분배하는 시스템",
      category: "infrastructure",
      type: "class",
      properties: ["algorithm", "backendServers", "healthChecks", "sessionPersistence", "throughput"]
    },

    // ===== 관찰성 세 기둥 =====
    {
      id: "obs:ObservabilityData",
      group: "pillars",
      label: "관찰성 데이터",
      description: "시스템의 상태를 파악할 수 있는 모든 정보",
      category: "pillars",
      type: "class",
      properties: ["dataType", "timestamp", "source", "format", "retention", "sampling"]
    },
    {
      id: "obs:Log",
      group: "pillars",
      label: "로그", 
      description: "시스템에서 발생한 사건들의 기록",
      category: "pillars",
      type: "class",
      properties: ["logLevel", "message", "timestamp", "source", "format", "size", "rotation"]
    },
    {
      id: "obs:Metric",
      group: "pillars",
      label: "메트릭",
      description: "시스템의 성능을 수치로 나타낸 지표", 
      category: "pillars",
      type: "class",
      properties: ["metricName", "value", "unit", "timestamp", "labels", "aggregation", "resolution"]
    },
    {
      id: "obs:Trace",
      group: "pillars",
      label: "트레이스",
      description: "하나의 요청이 시스템을 통과하는 전체 경로",
      category: "pillars", 
      type: "class",
      properties: ["traceId", "duration", "startTime", "endTime", "spans", "operationName", "tags"]
    },
    {
      id: "obs:Span",
      group: "pillars",
      label: "스팬",
      description: "트레이스를 구성하는 개별 작업 단위",
      category: "pillars",
      type: "class",
      properties: ["spanId", "parentSpanId", "operationName", "startTime", "duration", "logs", "tags"]
    },
    {
      id: "obs:DistributedTracing",
      group: "pillars",
      label: "분산 추적", 
      description: "여러 시스템에 걸친 요청의 전체 경로를 추적하는 기술",
      category: "pillars",
      type: "class",
      properties: ["traceId", "serviceName", "spanCount", "totalDuration", "errorCount", "sampling"]
    },

    // ===== 성능 지표 =====
    {
      id: "obs:PerformanceIndicator",
      group: "performance",
      label: "성능 지표",
      description: "시스템이 얼마나 잘 동작하는지를 나타내는 측정값",
      category: "performance",
      type: "class",
      properties: ["metricType", "currentValue", "threshold", "trend", "baseline", "target"]
    },
    {
      id: "obs:ResponseTime",
      group: "performance",
      label: "응답 시간", 
      description: "요청을 보내고 답변을 받기까지 걸리는 시간",
      category: "performance",
      type: "class", 
      properties: ["averageTime", "p50", "p95", "p99", "maxTime", "minTime", "unit"]
    },
    {
      id: "obs:Throughput",
      group: "performance",
      label: "처리량",
      description: "단위 시간당 처리할 수 있는 작업의 양", 
      category: "performance",
      type: "class",
      properties: ["requestsPerSecond", "transactionsPerMinute", "dataVolumePerHour", "peakThroughput"]
    },
    {
      id: "obs:ErrorRate",
      group: "performance",
      label: "오류율",
      description: "전체 요청 중 실패한 요청의 비율",
      category: "performance", 
      type: "class",
      properties: ["errorCount", "totalRequests", "errorPercentage", "errorTypes", "timeWindow"]
    },
    {
      id: "obs:Availability",
      group: "performance",
      label: "가용성",
      description: "시스템이 정상적으로 서비스를 제공하는 시간의 비율",
      category: "performance",
      type: "class",
      properties: ["uptime", "downtime", "totalTime", "availabilityPercentage", "slaTarget"]
    },
    {
      id: "obs:CapacityPlanning",
      group: "performance",
      label: "용량 계획", 
      description: "미래 요구사항에 맞춰 시스템 자원을 계획하는 활동",
      category: "performance",
      type: "class",
      properties: ["currentCapacity", "projectedGrowth", "resourceRequirements", "scalingTriggers"]
    },

    // ===== 리소스 사용률 =====
    {
      id: "obs:ResourceUtilization",
      group: "resources", 
      label: "자원 사용률",
      description: "시스템 자원이 얼마나 사용되고 있는지를 나타내는 지표",
      category: "resources",
      type: "class",
      properties: ["resourceType", "used", "total", "available", "utilizationPercentage", "peak"]
    },
    {
      id: "obs:CPUUsage",
      group: "resources",
      label: "CPU 사용률",
      description: "컴퓨터의 두뇌인 CPU가 얼마나 바쁘게 일하고 있는지",
      category: "resources",
      type: "class", 
      properties: ["cpuPercentage", "loadAverage", "coreCount", "frequency", "temperature", "processes"]
    },
    {
      id: "obs:MemoryUsage",
      group: "resources",
      label: "메모리 사용률",
      description: "컴퓨터가 작업을 위해 사용하는 임시 저장 공간의 사용량",
      category: "resources",
      type: "class",
      properties: ["totalMemory", "usedMemory", "freeMemory", "bufferCache", "swapUsage", "pageFiles"]
    },
    {
      id: "obs:DiskUsage", 
      group: "resources",
      label: "디스크 사용률",
      description: "데이터를 영구적으로 저장하는 공간의 사용량",
      category: "resources",
      type: "class",
      properties: ["totalSpace", "usedSpace", "freeSpace", "iops", "readSpeed", "writeSpeed"]
    },
    {
      id: "obs:NetworkTraffic",
      group: "resources",
      label: "네트워크 트래픽",
      description: "네트워크를 통해 전송되는 데이터의 양",
      category: "resources", 
      type: "class",
      properties: ["bytesIn", "bytesOut", "packetsIn", "packetsOut", "bandwidth", "errorCount"]
    },

    // ===== 장애 관리 =====
    {
      id: "obs:FaultManagement",
      group: "faults",
      label: "장애 관리",
      description: "시스템에서 발생하는 문제를 감지, 진단, 해결하는 과정",
      category: "faults",
      type: "class",
      properties: ["incidentCount", "mttr", "mtbf", "escalationRules", "recoveryProcedures"]
    },
    {
      id: "obs:Alert",
      group: "faults", 
      label: "알림",
      description: "시스템에 문제가 발생했을 때 관리자에게 보내는 경고 메시지",
      category: "faults",
      type: "class",
      properties: ["alertId", "severity", "message", "timestamp", "source", "recipients", "acknowledged"]
    },
    {
      id: "obs:Incident",
      group: "faults",
      label: "인시던트",
      description: "시스템 서비스에 영향을 주는 예상치 못한 사건",
      category: "faults",
      type: "class", 
      properties: ["incidentId", "priority", "status", "description", "impact", "assignee", "resolution"]
    },
    {
      id: "obs:Anomaly",
      group: "faults",
      label: "이상 현상",
      description: "정상 패턴에서 벗어난 비정상적인 동작",
      category: "faults",
      type: "class",
      properties: ["anomalyScore", "deviation", "pattern", "confidence", "context", "duration"]
    },
    {
      id: "obs:Threshold", 
      group: "faults",
      label: "임계치",
      description: "정상과 비정상을 구분하는 기준값",
      category: "faults",
      type: "class",
      properties: ["metricName", "warningThreshold", "criticalThreshold", "operator", "duration", "action"]
    },

    // ===== 클라우드 인프라 =====
    {
      id: "obs:CloudInfrastructure",
      group: "cloud",
      label: "클라우드 인프라",
      description: "인터넷을 통해 제공되는 컴퓨팅 자원",
      category: "cloud", 
      type: "class",
      properties: ["provider", "region", "availabilityZone", "serviceType", "pricing", "scalability"]
    },
    {
      id: "obs:VirtualMachine",
      group: "cloud",
      label: "가상 머신",
      description: "물리적 컴퓨터 안에서 동작하는 가상의 컴퓨터",
      category: "cloud",
      type: "class",
      properties: ["vmId", "instanceType", "cpu", "memory", "storage", "networkInterfaces", "hypervisor"]
    },
    {
      id: "obs:CloudService", 
      group: "cloud",
      label: "클라우드 서비스",
      description: "클라우드를 통해 제공되는 다양한 IT 서비스",
      category: "cloud",
      type: "class",
      properties: ["serviceName", "tier", "sla", "cost", "region", "apiEndpoint", "authentication"]
    },

    // ===== 컨테이너 기술 =====
    {
      id: "obs:Container",
      group: "containers",
      label: "컨테이너",
      description: "애플리케이션과 실행 환경을 하나로 묶은 패키지",
      category: "containers",
      type: "class",
      properties: ["containerId", "image", "status", "ports", "volumes", "environment", "resources"]
    },
    {
      id: "obs:DockerContainer", 
      group: "containers",
      label: "도커 컨테이너",
      description: "가장 널리 사용되는 컨테이너 기술",
      category: "containers",
      type: "class",
      properties: ["dockerVersion", "imageTag", "layerInfo", "registryUrl", "runCommand", "healthCheck"]
    },
    {
      id: "obs:ContainerImage",
      group: "containers",
      label: "컨테이너 이미지",
      description: "컨테이너를 만들기 위한 템플릿",
      category: "containers",
      type: "class", 
      properties: ["imageId", "tag", "size", "layers", "dockerfile", "buildTime", "vulnerabilities"]
    },
    {
      id: "obs:ContainerRegistry",
      group: "containers",
      label: "컨테이너 레지스트리",
      description: "컨테이너 이미지를 저장하고 공유하는 저장소",
      category: "containers",
      type: "class",
      properties: ["registryUrl", "repositories", "authentication", "storage", "accessControl"]
    },

    // ===== 쿠버네티스 =====
    {
      id: "obs:Kubernetes", 
      group: "kubernetes",
      label: "쿠버네티스",
      description: "많은 컨테이너를 자동으로 관리하는 시스템",
      category: "kubernetes",
      type: "class",
      properties: ["clusterName", "version", "nodes", "namespaces", "apiVersion", "controlPlane"]
    },
    {
      id: "obs:Pod",
      group: "kubernetes",
      label: "파드",
      description: "쿠버네티스에서 실행되는 최소 단위",
      category: "kubernetes",
      type: "class", 
      properties: ["podName", "namespace", "containers", "volumes", "labels", "nodeSelector", "status"]
    },
    {
      id: "obs:Service",
      group: "kubernetes",
      label: "서비스",
      description: "파드들에 접근할 수 있는 안정적인 경로를 제공",
      category: "kubernetes",
      type: "class",
      properties: ["serviceName", "type", "ports", "selector", "endpoints", "sessionAffinity"]
    },
    {
      id: "obs:Deployment", 
      group: "kubernetes",
      label: "디플로이먼트",
      description: "애플리케이션의 배포와 업데이트를 관리",
      category: "kubernetes",
      type: "class",
      properties: ["deploymentName", "replicas", "strategy", "template", "selector", "rolloutStatus"]
    },
    {
      id: "obs:Node",
      group: "kubernetes",
      label: "노드",
      description: "쿠버네티스 클러스터를 구성하는 개별 서버",
      category: "kubernetes",
      type: "class", 
      properties: ["nodeName", "role", "capacity", "allocatable", "conditions", "kubeletVersion"]
    },
    {
      id: "obs:Namespace",
      group: "kubernetes",
      label: "네임스페이스",
      description: "쿠버네티스 내에서 리소스를 논리적으로 분리하는 가상 공간",
      category: "kubernetes",
      type: "class",
      properties: ["namespaceName", "labels", "annotations", "resourceQuotas", "limitRanges"]
    },
    {
      id: "obs:ServiceMesh", 
      group: "kubernetes",
      label: "서비스 메시",
      description: "마이크로서비스 간의 통신을 관리하는 인프라 계층",
      category: "kubernetes",
      type: "class",
      properties: ["meshType", "proxies", "policies", "certificates", "telemetry", "security"]
    },

    // ===== 보안 모니터링 =====
    {
      id: "obs:SecurityMonitoring",
      group: "security",
      label: "보안 모니터링",
      description: "시스템을 대상으로 한 보안 위협을 감지하고 대응하는 활동",
      category: "security", 
      type: "class",
      properties: ["threatLevel", "vulnerabilityCount", "incidentCount", "compliance", "policies"]
    },
    {
      id: "obs:SecurityEvent",
      group: "security",
      label: "보안 이벤트",
      description: "보안과 관련된 중요한 사건이나 활동",
      category: "security",
      type: "class",
      properties: ["eventId", "type", "severity", "source", "target", "timestamp", "action"]
    },
    {
      id: "obs:AccessLog", 
      group: "security",
      label: "접근 로그",
      description: "시스템에 누가 언제 접근했는지 기록한 출입 기록부",
      category: "security",
      type: "class",
      properties: ["userId", "ipAddress", "timestamp", "resource", "action", "result", "userAgent"]
    },
    {
      id: "obs:Vulnerability",
      group: "security",
      label: "취약점",
      description: "시스템의 보안상 약점이나 결함",
      category: "security",
      type: "class", 
      properties: ["cveId", "severity", "cvssScore", "description", "affectedSystems", "patchAvailable"]
    },

    // ===== AI/ML 관련 =====
    {
      id: "obs:AIOps",
      group: "aiml",
      label: "AIOps",
      description: "인공지능을 활용한 IT 운영 자동화",
      category: "aiml",
      type: "class",
      properties: ["modelType", "accuracy", "trainingData", "predictions", "recommendations", "automation"]
    },
    {
      id: "obs:MachineLearning", 
      group: "aiml",
      label: "머신러닝",
      description: "컴퓨터가 데이터로부터 패턴을 학습하는 기술",
      category: "aiml",
      type: "class",
      properties: ["algorithm", "dataset", "features", "trainingTime", "accuracy", "modelSize"]
    },
    {
      id: "obs:AnomalyDetection",
      group: "aiml",
      label: "이상 탐지",
      description: "정상 패턴에서 벗어난 비정상적인 상황을 자동으로 찾아내는 기술",
      category: "aiml", 
      type: "class",
      properties: ["detectionMethod", "sensitivity", "falsePositiveRate", "trainingPeriod", "baselineData"]
    },
    {
      id: "obs:PredictiveAnalytics",
      group: "aiml",
      label: "예측 분석",
      description: "과거 데이터를 바탕으로 미래를 예측하는 분석 기법",
      category: "aiml",
      type: "class",
      properties: ["predictionModel", "timeHorizon", "confidence", "historicalData", "forecastAccuracy"]
    },

    // ===== 비즈니스 메트릭 =====
    {
      id: "obs:BusinessMetric", 
      group: "business",
      label: "비즈니스 메트릭",
      description: "사업 성과를 측정하는 지표",
      category: "business",
      type: "class",
      properties: ["kpiName", "target", "actual", "variance", "trend", "impact", "owner"]
    },
    {
      id: "obs:SLA",
      group: "business",
      label: "서비스 수준 협약",
      description: "서비스 제공자가 고객에게 약속하는 최소 서비스 품질",
      category: "business",
      type: "class", 
      properties: ["slaTarget", "actualPerformance", "penalties", "measurement", "reporting", "review"]
    },
    {
      id: "obs:UserExperience",
      group: "business",
      label: "사용자 경험",
      description: "사용자가 서비스를 이용하면서 느끼는 전반적인 경험",
      category: "business",
      type: "class",
      properties: ["satisfactionScore", "usabilityMetrics", "performanceImpact", "feedbackData", "conversionRate"]
    },

    // ===== 데이터 파이프라인 =====
    {
      id: "obs:DataPipeline", 
      group: "data",
      label: "데이터 파이프라인",
      description: "데이터가 수집되어 처리되고 저장되는 전체 과정",
      category: "data",
      type: "class",
      properties: ["pipelineName", "stages", "throughput", "latency", "errorRate", "dataQuality"]
    },
    {
      id: "obs:DataIngestion",
      group: "data",
      label: "데이터 수집",
      description: "다양한 소스에서 데이터를 모아오는 과정",
      category: "data", 
      type: "class",
      properties: ["sources", "format", "volume", "frequency", "compression", "validation"]
    },
    {
      id: "obs:DataStorage",
      group: "data",
      label: "데이터 저장소",
      description: "수집된 데이터를 보관하는 저장 시설",
      category: "data",
      type: "class",
      properties: ["storageType", "capacity", "retention", "compression", "indexing", "replication"]
    },

    // ===== 모니터링 도구 =====
    {
      id: "obs:MonitoringTool", 
      group: "tools",
      label: "모니터링 도구",
      description: "시스템 상태를 감시하고 분석하는 소프트웨어",
      category: "tools",
      type: "class",
      properties: ["toolName", "version", "capabilities", "dataRetention", "alerting", "integrations"]
    },
    {
      id: "obs:Dashboard",
      group: "tools",
      label: "대시보드",
      description: "시스템 상태를 한눈에 볼 수 있게 정리해서 보여주는 화면",
      category: "tools", 
      type: "class",
      properties: ["dashboardName", "widgets", "refreshRate", "filters", "permissions", "exportOptions"]
    },
    {
      id: "obs:Visualization",
      group: "tools",
      label: "시각화",
      description: "복잡한 데이터를 그래프나 차트로 쉽게 이해할 수 있게 표현하는 방법",
      category: "tools",
      type: "class",
      properties: ["chartType", "dataSource", "dimensions", "metrics", "interactivity", "styling"]
    },

    // ===== AIRIS APM 플랫폼 특화 =====
    {
      id: "airis:Platform", 
      group: "airis",
      label: "AIRIS APM 플랫폼",
      description: "AI 기반 종합 시스템 성능 관리 플랫폼",
      category: "airis",
      type: "class",
      properties: ["version", "modules", "integrations", "aiCapabilities", "scalability", "licensing"]
    },
    {
      id: "airis:IntelligentAnalysis",
      group: "airis",
      label: "지능형 분석",
      description: "AI를 활용한 고도화된 시스템 분석",
      category: "airis", 
      type: "class",
      properties: ["analysisType", "algorithms", "dataInputs", "insights", "recommendations", "confidence"]
    },
    {
      id: "airis:AutomatedResponse",
      group: "airis",
      label: "자동화 대응",
      description: "문제 상황에 대한 AI 기반 자동 대응 시스템",
      category: "airis",
      type: "class",
      properties: ["triggers", "actions", "escalationRules", "rollbackCapability", "approvals", "auditLog"]
    },

    // ===== 속성(Properties) 노드들 =====
    // 공통 속성들
    { id: "prop:name", type: "property", label: "이름", dataType: "string", description: "엔터티의 고유 이름" },
    { id: "prop:id", type: "property", label: "식별자", dataType: "string", description: "시스템 내 고유 식별자" },
    { id: "prop:timestamp", type: "property", label: "타임스탬프", dataType: "datetime", description: "이벤트 발생 시점" },
    { id: "prop:status", type: "property", label: "상태", dataType: "enum", description: "현재 작동 상태" },
    { id: "prop:version", type: "property", label: "버전", dataType: "string", description: "소프트웨어 버전 정보" },
    
    // 성능 관련 속성들
    { id: "prop:responseTime", type: "property", label: "응답시간", dataType: "number", description: "요청 처리 소요 시간 (ms)" },
    { id: "prop:throughput", type: "property", label: "처리량", dataType: "number", description: "단위 시간당 처리 건수" },
    { id: "prop:errorRate", type: "property", label: "오류율", dataType: "percentage", description: "전체 요청 대비 오류 비율" },
    { id: "prop:availability", type: "property", label: "가용성", dataType: "percentage", description: "서비스 정상 운영 시간 비율" },
    
    // 자원 관련 속성들
    { id: "prop:cpuUsage", type: "property", label: "CPU 사용률", dataType: "percentage", description: "프로세서 사용량" },
    { id: "prop:memoryUsage", type: "property", label: "메모리 사용량", dataType: "bytes", description: "메모리 점유량" },
    { id: "prop:diskUsage", type: "property", label: "디스크 사용량", dataType: "bytes", description: "저장공간 점유량" },
    { id: "prop:networkTraffic", type: "property", label: "네트워크 트래픽", dataType: "bytes", description: "네트워크 데이터 전송량" },
    
    // 비즈니스 관련 속성들
    { id: "prop:userCount", type: "property", label: "사용자 수", dataType: "number", description: "동시 접속 사용자 수" },
    { id: "prop:transactionVolume", type: "property", label: "거래량", dataType: "number", description: "단위 시간당 거래 건수" },
    { id: "prop:revenue", type: "property", label: "수익", dataType: "currency", description: "비즈니스 수익 지표" }
  ],

  links: [
    // ===== 클래스 상속 관계 (subClassOf) =====
    { source: "obs:InfrastructureComponent", target: "obs:ObservabilityEntity", type: "subClassOf", label: "상속" },
    { source: "obs:Application", target: "obs:InfrastructureComponent", type: "subClassOf", label: "상속" },
    { source: "obs:Database", target: "obs:InfrastructureComponent", type: "subClassOf", label: "상속" },
    { source: "obs:Network", target: "obs:InfrastructureComponent", type: "subClassOf", label: "상속" },
    { source: "obs:Server", target: "obs:InfrastructureComponent", type: "subClassOf", label: "상속" },
    { source: "obs:LoadBalancer", target: "obs:InfrastructureComponent", type: "subClassOf", label: "상속" },

    { source: "obs:ObservabilityData", target: "obs:ObservabilityEntity", type: "subClassOf", label: "상속" },
    { source: "obs:Log", target: "obs:ObservabilityData", type: "subClassOf", label: "상속" },
    { source: "obs:Metric", target: "obs:ObservabilityData", type: "subClassOf", label: "상속" },
    { source: "obs:Trace", target: "obs:ObservabilityData", type: "subClassOf", label: "상속" },
    { source: "obs:Span", target: "obs:Trace", type: "subClassOf", label: "상속" },
    { source: "obs:DistributedTracing", target: "obs:Trace", type: "subClassOf", label: "상속" },

    { source: "obs:PerformanceIndicator", target: "obs:Metric", type: "subClassOf", label: "상속" },
    { source: "obs:ResponseTime", target: "obs:PerformanceIndicator", type: "subClassOf", label: "상속" },
    { source: "obs:Throughput", target: "obs:PerformanceIndicator", type: "subClassOf", label: "상속" },
    { source: "obs:ErrorRate", target: "obs:PerformanceIndicator", type: "subClassOf", label: "상속" },
    { source: "obs:Availability", target: "obs:PerformanceIndicator", type: "subClassOf", label: "상속" },
    { source: "obs:CapacityPlanning", target: "obs:PerformanceIndicator", type: "subClassOf", label: "상속" },

    { source: "obs:ResourceUtilization", target: "obs:Metric", type: "subClassOf", label: "상속" },
    { source: "obs:CPUUsage", target: "obs:ResourceUtilization", type: "subClassOf", label: "상속" },
    { source: "obs:MemoryUsage", target: "obs:ResourceUtilization", type: "subClassOf", label: "상속" },
    { source: "obs:DiskUsage", target: "obs:ResourceUtilization", type: "subClassOf", label: "상속" },
    { source: "obs:NetworkTraffic", target: "obs:ResourceUtilization", type: "subClassOf", label: "상속" },

    { source: "obs:FaultManagement", target: "obs:ObservabilityEntity", type: "subClassOf", label: "상속" },
    { source: "obs:Alert", target: "obs:FaultManagement", type: "subClassOf", label: "상속" },
    { source: "obs:Incident", target: "obs:FaultManagement", type: "subClassOf", label: "상속" },
    { source: "obs:Anomaly", target: "obs:FaultManagement", type: "subClassOf", label: "상속" },
    { source: "obs:Threshold", target: "obs:FaultManagement", type: "subClassOf", label: "상속" },

    { source: "obs:CloudInfrastructure", target: "obs:InfrastructureComponent", type: "subClassOf", label: "상속" },
    { source: "obs:VirtualMachine", target: "obs:CloudInfrastructure", type: "subClassOf", label: "상속" },
    { source: "obs:CloudService", target: "obs:CloudInfrastructure", type: "subClassOf", label: "상속" },

    { source: "obs:Container", target: "obs:InfrastructureComponent", type: "subClassOf", label: "상속" },
    { source: "obs:DockerContainer", target: "obs:Container", type: "subClassOf", label: "상속" },
    { source: "obs:ContainerImage", target: "obs:Container", type: "subClassOf", label: "상속" },
    { source: "obs:ContainerRegistry", target: "obs:Container", type: "subClassOf", label: "상속" },

    { source: "obs:Kubernetes", target: "obs:CloudInfrastructure", type: "subClassOf", label: "상속" },
    { source: "obs:Pod", target: "obs:Kubernetes", type: "subClassOf", label: "상속" },
    { source: "obs:Service", target: "obs:Kubernetes", type: "subClassOf", label: "상속" },
    { source: "obs:Deployment", target: "obs:Kubernetes", type: "subClassOf", label: "상속" },
    { source: "obs:Node", target: "obs:Kubernetes", type: "subClassOf", label: "상속" },
    { source: "obs:Namespace", target: "obs:Kubernetes", type: "subClassOf", label: "상속" },
    { source: "obs:ServiceMesh", target: "obs:Kubernetes", type: "subClassOf", label: "상속" },

    { source: "obs:SecurityMonitoring", target: "obs:ObservabilityEntity", type: "subClassOf", label: "상속" },
    { source: "obs:SecurityEvent", target: "obs:SecurityMonitoring", type: "subClassOf", label: "상속" },
    { source: "obs:AccessLog", target: "obs:SecurityMonitoring", type: "subClassOf", label: "상속" },
    { source: "obs:Vulnerability", target: "obs:SecurityMonitoring", type: "subClassOf", label: "상속" },

    { source: "obs:AIOps", target: "obs:ObservabilityEntity", type: "subClassOf", label: "상속" },
    { source: "obs:MachineLearning", target: "obs:AIOps", type: "subClassOf", label: "상속" },
    { source: "obs:AnomalyDetection", target: "obs:AIOps", type: "subClassOf", label: "상속" },
    { source: "obs:PredictiveAnalytics", target: "obs:AIOps", type: "subClassOf", label: "상속" },

    { source: "obs:BusinessMetric", target: "obs:Metric", type: "subClassOf", label: "상속" },
    { source: "obs:SLA", target: "obs:BusinessMetric", type: "subClassOf", label: "상속" },
    { source: "obs:UserExperience", target: "obs:BusinessMetric", type: "subClassOf", label: "상속" },

    { source: "obs:DataPipeline", target: "obs:ObservabilityEntity", type: "subClassOf", label: "상속" },
    { source: "obs:DataIngestion", target: "obs:DataPipeline", type: "subClassOf", label: "상속" },
    { source: "obs:DataStorage", target: "obs:DataPipeline", type: "subClassOf", label: "상속" },

    { source: "obs:MonitoringTool", target: "obs:ObservabilityEntity", type: "subClassOf", label: "상속" },
    { source: "obs:Dashboard", target: "obs:MonitoringTool", type: "subClassOf", label: "상속" },
    { source: "obs:Visualization", target: "obs:MonitoringTool", type: "subClassOf", label: "상속" },
    { source: "obs:RealTimeMonitoring", target: "obs:MonitoringTool", type: "subClassOf", label: "상속" },

    { source: "airis:Platform", target: "obs:AIOps", type: "subClassOf", label: "상속" },
    { source: "airis:IntelligentAnalysis", target: "airis:Platform", type: "subClassOf", label: "상속" },
    { source: "airis:AutomatedResponse", target: "airis:Platform", type: "subClassOf", label: "상속" },

    // ===== 속성 관계 (hasProperty) =====
    // 모든 엔터티가 가지는 기본 속성들
    { source: "obs:ObservabilityEntity", target: "prop:name", type: "hasProperty", label: "속성" },
    { source: "obs:ObservabilityEntity", target: "prop:id", type: "hasProperty", label: "속성" },
    { source: "obs:ObservabilityEntity", target: "prop:timestamp", type: "hasProperty", label: "속성" },
    { source: "obs:ObservabilityEntity", target: "prop:status", type: "hasProperty", label: "속성" },

    // 애플리케이션 속성들
    { source: "obs:Application", target: "prop:version", type: "hasProperty", label: "속성" },
    { source: "obs:Application", target: "prop:responseTime", type: "hasProperty", label: "속성" },
    { source: "obs:Application", target: "prop:throughput", type: "hasProperty", label: "속성" },
    { source: "obs:Application", target: "prop:errorRate", type: "hasProperty", label: "속성" },
    { source: "obs:Application", target: "prop:availability", type: "hasProperty", label: "속성" },
    { source: "obs:Application", target: "prop:userCount", type: "hasProperty", label: "속성" },

    // 서버 속성들
    { source: "obs:Server", target: "prop:cpuUsage", type: "hasProperty", label: "속성" },
    { source: "obs:Server", target: "prop:memoryUsage", type: "hasProperty", label: "속성" },
    { source: "obs:Server", target: "prop:diskUsage", type: "hasProperty", label: "속성" },
    { source: "obs:Server", target: "prop:networkTraffic", type: "hasProperty", label: "속성" },

    // 성능 지표 속성들
    { source: "obs:ResponseTime", target: "prop:responseTime", type: "hasProperty", label: "속성" },
    { source: "obs:Throughput", target: "prop:throughput", type: "hasProperty", label: "속성" },
    { source: "obs:ErrorRate", target: "prop:errorRate", type: "hasProperty", label: "속성" },
    { source: "obs:Availability", target: "prop:availability", type: "hasProperty", label: "속성" },

    // 자원 사용률 속성들
    { source: "obs:CPUUsage", target: "prop:cpuUsage", type: "hasProperty", label: "속성" },
    { source: "obs:MemoryUsage", target: "prop:memoryUsage", type: "hasProperty", label: "속성" },
    { source: "obs:DiskUsage", target: "prop:diskUsage", type: "hasProperty", label: "속성" },
    { source: "obs:NetworkTraffic", target: "prop:networkTraffic", type: "hasProperty", label: "속성" },

    // 비즈니스 메트릭 속성들
    { source: "obs:BusinessMetric", target: "prop:revenue", type: "hasProperty", label: "속성" },
    { source: "obs:BusinessMetric", target: "prop:userCount", type: "hasProperty", label: "속성" },
    { source: "obs:BusinessMetric", target: "prop:transactionVolume", type: "hasProperty", label: "속성" },

    // ===== 기능적 관계들 =====
    { source: "obs:Alert", target: "obs:Anomaly", type: "triggeredBy", label: "트리거" },
    { source: "obs:Trace", target: "obs:Application", type: "monitors", label: "모니터링" },
    { source: "obs:Metric", target: "obs:Server", type: "monitors", label: "모니터링" },
    { source: "obs:Log", target: "obs:Database", type: "monitors", label: "모니터링" },
    { source: "obs:Dashboard", target: "obs:Visualization", type: "uses", label: "사용" },
    { source: "obs:AnomalyDetection", target: "obs:Anomaly", type: "detects", label: "감지" },
    { source: "obs:PredictiveAnalytics", target: "obs:CapacityPlanning", type: "supports", label: "지원" },
    { source: "airis:IntelligentAnalysis", target: "obs:AnomalyDetection", type: "includes", label: "포함" },
    { source: "airis:AutomatedResponse", target: "obs:Alert", type: "respondTo", label: "대응" },
    { source: "obs:ServiceMesh", target: "obs:DistributedTracing", type: "enables", label: "활성화" },

    // ===== 컨테이너 관계들 =====
    { source: "obs:Pod", target: "obs:Container", type: "contains", label: "포함" },
    { source: "obs:Container", target: "obs:ContainerImage", type: "basedOn", label: "기반" },
    { source: "obs:ContainerRegistry", target: "obs:ContainerImage", type: "stores", label: "저장" },

    // ===== 데이터 흐름 관계들 =====
    { source: "obs:DataIngestion", target: "obs:DataPipeline", type: "partOf", label: "일부" },
    { source: "obs:DataStorage", target: "obs:DataPipeline", type: "partOf", label: "일부" },
    { source: "obs:Log", target: "obs:DataIngestion", type: "inputTo", label: "입력" },
    { source: "obs:Metric", target: "obs:DataIngestion", type: "inputTo", label: "입력" },
    { source: "obs:Trace", target: "obs:DataIngestion", type: "inputTo", label: "입력" },

    // ===== 쿠버네티스 관계들 =====
    { source: "obs:Deployment", target: "obs:Pod", type: "manages", label: "관리" },
    { source: "obs:Service", target: "obs:Pod", type: "exposes", label: "노출" },
    { source: "obs:Pod", target: "obs:Node", type: "runsOn", label: "실행" },
    { source: "obs:Namespace", target: "obs:Pod", type: "contains", label: "포함" },
    { source: "obs:Namespace", target: "obs:Service", type: "contains", label: "포함" },
    { source: "obs:Namespace", target: "obs:Deployment", type: "contains", label: "포함" }
  ],

  categories: {
    core: { 
      name: "핵심 개념", 
      color: "#4338ca", 
      description: "관찰성의 기본이 되는 핵심 개념들"
    },
    infrastructure: { 
      name: "인프라 구조", 
      color: "#059669", 
      description: "시스템의 기반이 되는 인프라 컴포넌트들"
    },
    pillars: { 
      name: "관찰성 3요소", 
      color: "#dc2626", 
      description: "로그, 메트릭, 트레이스의 관찰성 핵심 요소들"
    },
    performance: { 
      name: "성능 지표", 
      color: "#ea580c", 
      description: "시스템 성능을 측정하고 평가하는 지표들"
    },
    resources: { 
      name: "자원 관리", 
      color: "#7c3aed", 
      description: "시스템 자원의 사용률과 관리 관련 개념들"
    },
    faults: { 
      name: "장애 관리", 
      color: "#be185d", 
      description: "시스템 장애의 감지, 분석, 대응 관련 개념들"
    },
    cloud: { 
      name: "클라우드", 
      color: "#0891b2", 
      description: "클라우드 인프라와 관련된 개념들"
    },
    containers: { 
      name: "컨테이너", 
      color: "#0d9488", 
      description: "컨테이너 기술과 관련된 개념들"
    },
    kubernetes: { 
      name: "쿠버네티스", 
      color: "#1d4ed8", 
      description: "쿠버네티스 오케스트레이션 관련 개념들"
    },
    security: { 
      name: "보안 모니터링", 
      color: "#991b1b", 
      description: "시스템 보안 감시와 관련된 개념들"
    },
    aiml: { 
      name: "AI/ML", 
      color: "#6b21a8", 
      description: "인공지능과 머신러닝을 활용한 모니터링"
    },
    business: { 
      name: "비즈니스", 
      color: "#92400e", 
      description: "사업적 관점의 성과 측정 지표들"
    },
    data: { 
      name: "데이터 파이프라인", 
      color: "#374151", 
      description: "데이터 처리와 저장 관련 개념들"
    },
    tools: { 
      name: "모니터링 도구", 
      color: "#065f46", 
      description: "시스템 모니터링을 위한 도구들"
    },
    airis: { 
      name: "AIRIS 플랫폼", 
      color: "#7c2d12", 
      description: "AIRIS APM 플랫폼의 특화 기능들"
    },
    properties: {
      name: "속성",
      color: "#6b7280",
      description: "엔터티들의 속성과 특성들"
    }
  }
};

// 전역으로 export하여 다른 스크립트에서 사용 가능
window.ontologyCompleteEnhancedData = ontologyCompleteEnhancedData;