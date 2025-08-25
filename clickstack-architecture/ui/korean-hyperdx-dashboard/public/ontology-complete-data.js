// 완전한 온톨로지 데이터 구조 - observability_ontology_fin.md 전체 내용 기반
const ontologyCompleteData = {
  nodes: [
    // 핵심 관찰성 엔터티
    {
      id: "obs:ObservabilityEntity",
      group: "core",
      label: "관찰 엔터티",
      description: "모든 관찰 가능한 시스템의 최상위 개념. 마치 병원의 환자 모니터링 시스템처럼, 시스템의 상태를 지속적으로 관찰하고 기록합니다.",
      category: "core"
    },
    {
      id: "obs:InfrastructureComponent",
      group: "infrastructure",
      label: "인프라 컴포넌트",
      description: "IT 인프라의 기본 구성 요소. 건물의 기초 구조물처럼 시스템의 기반이 되는 핵심 요소들입니다.",
      category: "infrastructure"
    },
    {
      id: "obs:Application",
      group: "infrastructure",
      label: "애플리케이션",
      description: "사용자가 실제로 사용하는 소프트웨어 프로그램. 스마트폰의 앱처럼 특정 기능을 수행하는 프로그램입니다.",
      category: "infrastructure"
    },
    {
      id: "obs:Database",
      group: "infrastructure",
      label: "데이터베이스",
      description: "정보를 체계적으로 저장하고 관리하는 시스템. 도서관의 목록 시스템처럼 데이터를 정리하고 빠르게 찾을 수 있게 해줍니다.",
      category: "infrastructure"
    },
    {
      id: "obs:Network",
      group: "infrastructure",
      label: "네트워크",
      description: "컴퓨터들을 연결하는 통신망. 도로망처럼 데이터가 이동할 수 있는 경로를 제공합니다.",
      category: "infrastructure"
    },
    {
      id: "obs:Server",
      group: "infrastructure",
      label: "서버",
      description: "다른 컴퓨터에게 서비스를 제공하는 컴퓨터. 식당의 주방처럼 요청을 받아서 처리하고 결과를 제공합니다.",
      category: "infrastructure"
    },
    {
      id: "obs:LoadBalancer",
      group: "infrastructure",
      label: "로드 밸런서",
      description: "여러 서버에 작업을 골고루 분배하는 시스템. 은행 창구의 번호표 시스템처럼 대기열을 관리합니다.",
      category: "infrastructure"
    },

    // 관찰성 세 기둥
    {
      id: "obs:ObservabilityData",
      group: "pillars",
      label: "관찰성 데이터",
      description: "시스템의 상태를 파악할 수 있는 모든 정보. 의사가 환자를 진단할 때 사용하는 체온, 혈압, 맥박 같은 정보입니다.",
      category: "pillars"
    },
    {
      id: "obs:Log",
      group: "pillars",
      label: "로그",
      description: "시스템에서 발생한 사건들의 기록. 일기장처럼 언제, 무엇이, 어떻게 일어났는지를 시간 순서대로 기록합니다.",
      category: "pillars"
    },
    {
      id: "obs:Metric",
      group: "pillars",
      label: "메트릭",
      description: "시스템의 성능을 수치로 나타낸 지표. 자동차의 속도계나 연료계처럼 현재 상태를 숫자로 보여줍니다.",
      category: "pillars"
    },
    {
      id: "obs:Trace",
      group: "pillars",
      label: "트레이스",
      description: "하나의 요청이 시스템을 통과하는 전체 경로. 택배의 배송 추적처럼 요청이 어디를 거쳐서 처리되는지 보여줍니다.",
      category: "pillars"
    },
    {
      id: "obs:Span",
      group: "pillars",
      label: "스팬",
      description: "트레이스를 구성하는 개별 작업 단위. 요리 과정에서 '재료 준비', '조리', '플레이팅' 같은 각각의 단계를 의미합니다.",
      category: "pillars"
    },

    // 성능 지표
    {
      id: "obs:PerformanceIndicator",
      group: "performance",
      label: "성능 지표",
      description: "시스템이 얼마나 잘 동작하는지를 나타내는 측정값. 운동선수의 기록처럼 성능을 객관적으로 평가할 수 있게 해줍니다.",
      category: "performance"
    },
    {
      id: "obs:ResponseTime",
      group: "performance",
      label: "응답 시간",
      description: "요청을 보내고 답변을 받기까지 걸리는 시간. 전화를 걸었을 때 상대방이 받기까지의 시간과 같습니다.",
      category: "performance"
    },
    {
      id: "obs:Throughput",
      group: "performance",
      label: "처리량",
      description: "단위 시간당 처리할 수 있는 작업의 양. 고속도로의 시간당 통과 차량 수와 같은 개념입니다.",
      category: "performance"
    },
    {
      id: "obs:ErrorRate",
      group: "performance",
      label: "오류율",
      description: "전체 요청 중 실패한 요청의 비율. 공장에서 불량품이 나오는 비율과 같은 개념입니다.",
      category: "performance"
    },
    {
      id: "obs:Availability",
      group: "performance",
      label: "가용성",
      description: "시스템이 정상적으로 서비스를 제공하는 시간의 비율. 상점의 영업시간처럼 언제 서비스를 이용할 수 있는지를 나타냅니다.",
      category: "performance"
    },

    // 리소스 사용률
    {
      id: "obs:ResourceUtilization",
      group: "resources",
      label: "자원 사용률",
      description: "시스템 자원이 얼마나 사용되고 있는지를 나타내는 지표. 주차장의 주차 공간 사용률처럼 가용 자원 대비 사용량을 보여줍니다.",
      category: "resources"
    },
    {
      id: "obs:CPUUsage",
      group: "resources",
      label: "CPU 사용률",
      description: "컴퓨터의 두뇌인 CPU가 얼마나 바쁘게 일하고 있는지를 나타냅니다. 사람의 뇌 활동량과 같은 개념입니다.",
      category: "resources"
    },
    {
      id: "obs:MemoryUsage",
      group: "resources",
      label: "메모리 사용률",
      description: "컴퓨터가 작업을 위해 사용하는 임시 저장 공간의 사용량. 책상 위 작업 공간이 얼마나 찬 상태인지와 같습니다.",
      category: "resources"
    },
    {
      id: "obs:DiskUsage",
      group: "resources",
      label: "디스크 사용률",
      description: "데이터를 영구적으로 저장하는 공간의 사용량. 창고나 서랍의 저장 공간 사용률과 같은 개념입니다.",
      category: "resources"
    },
    {
      id: "obs:NetworkTraffic",
      group: "resources",
      label: "네트워크 트래픽",
      description: "네트워크를 통해 전송되는 데이터의 양. 도로의 차량 통행량처럼 네트워크를 지나다니는 데이터의 양을 의미합니다.",
      category: "resources"
    },

    // 장애 관리
    {
      id: "obs:FaultManagement",
      group: "faults",
      label: "장애 관리",
      description: "시스템에서 발생하는 문제를 감지, 진단, 해결하는 과정. 병원의 응급실 시스템처럼 문제를 빠르게 찾아내고 해결합니다.",
      category: "faults"
    },
    {
      id: "obs:Alert",
      group: "faults",
      label: "알림",
      description: "시스템에 문제가 발생했을 때 관리자에게 보내는 경고 메시지. 화재경보기처럼 위험 상황을 즉시 알려줍니다.",
      category: "faults"
    },
    {
      id: "obs:Incident",
      group: "faults",
      label: "인시던트",
      description: "시스템 서비스에 영향을 주는 예상치 못한 사건. 교통사고처럼 정상적인 흐름을 방해하는 상황을 의미합니다.",
      category: "faults"
    },
    {
      id: "obs:Anomaly",
      group: "faults",
      label: "이상 현상",
      description: "정상 패턴에서 벗어난 비정상적인 동작. 평소와 다른 행동을 보이는 것처럼 예상과 다른 시스템 동작입니다.",
      category: "faults"
    },
    {
      id: "obs:Threshold",
      group: "faults",
      label: "임계치",
      description: "정상과 비정상을 구분하는 기준값. 체온 37도처럼 정상 범위를 벗어나면 문제가 있다고 판단하는 기준선입니다.",
      category: "faults"
    },

    // 클라우드 인프라
    {
      id: "obs:CloudInfrastructure",
      group: "cloud",
      label: "클라우드 인프라",
      description: "인터넷을 통해 제공되는 컴퓨팅 자원. 전기나 수도처럼 필요한 만큼 사용하고 비용을 지불하는 IT 서비스입니다.",
      category: "cloud"
    },
    {
      id: "obs:VirtualMachine",
      group: "cloud",
      label: "가상 머신",
      description: "물리적 컴퓨터 안에서 동작하는 가상의 컴퓨터. 아파트 한 동에 여러 세대가 있듯이, 하나의 서버에서 여러 개의 독립적인 컴퓨터를 운영합니다.",
      category: "cloud"
    },
    {
      id: "obs:CloudService",
      group: "cloud",
      label: "클라우드 서비스",
      description: "클라우드를 통해 제공되는 다양한 IT 서비스. 넷플릭스나 스포티파이처럼 인터넷으로 이용하는 서비스입니다.",
      category: "cloud"
    },

    // 컨테이너 기술
    {
      id: "obs:Container",
      group: "containers",
      label: "컨테이너",
      description: "애플리케이션과 실행 환경을 하나로 묶어서 어디서든 동일하게 실행할 수 있게 만든 패키지. 이사할 때 짐을 박스에 담듯이 프로그램을 포장합니다.",
      category: "containers"
    },
    {
      id: "obs:DockerContainer",
      group: "containers",
      label: "도커 컨테이너",
      description: "가장 널리 사용되는 컨테이너 기술. 표준 택배 상자처럼 어떤 프로그램이든 동일한 방식으로 포장하고 배송할 수 있게 해줍니다.",
      category: "containers"
    },
    {
      id: "obs:ContainerImage",
      group: "containers",
      label: "컨테이너 이미지",
      description: "컨테이너를 만들기 위한 템플릿. 붕어빵 틀처럼 동일한 컨테이너를 여러 개 만들 수 있는 원본 틀입니다.",
      category: "containers"
    },
    {
      id: "obs:ContainerRegistry",
      group: "containers",
      label: "컨테이너 레지스트리",
      description: "컨테이너 이미지를 저장하고 공유하는 저장소. 앱스토어처럼 필요한 컨테이너를 찾아서 다운로드할 수 있는 곳입니다.",
      category: "containers"
    },

    // 쿠버네티스
    {
      id: "obs:Kubernetes",
      group: "kubernetes",
      label: "쿠버네티스",
      description: "많은 컨테이너를 자동으로 관리하는 시스템. 대형 물류센터의 자동화 시스템처럼 수많은 컨테이너를 효율적으로 운영합니다.",
      category: "kubernetes"
    },
    {
      id: "obs:Pod",
      group: "kubernetes",
      label: "파드",
      description: "쿠버네티스에서 실행되는 최소 단위. 하나 이상의 컨테이너를 묶어서 함께 실행하는 그룹입니다.",
      category: "kubernetes"
    },
    {
      id: "obs:Service",
      group: "kubernetes",
      label: "서비스",
      description: "파드들에 접근할 수 있는 안정적인 경로를 제공. 회사의 대표번호처럼 내부 직원이 바뀌어도 외부에서는 동일한 번호로 연결됩니다.",
      category: "kubernetes"
    },
    {
      id: "obs:Deployment",
      group: "kubernetes",
      label: "디플로이먼트",
      description: "애플리케이션의 배포와 업데이트를 관리. 공장의 생산 라인처럼 새 버전을 안전하고 체계적으로 배포합니다.",
      category: "kubernetes"
    },
    {
      id: "obs:Node",
      group: "kubernetes",
      label: "노드",
      description: "쿠버네티스 클러스터를 구성하는 개별 서버. 오케스트라의 각 연주자처럼 전체 시스템의 한 부분을 담당합니다.",
      category: "kubernetes"
    },
    {
      id: "obs:Namespace",
      group: "kubernetes",
      label: "네임스페이스",
      description: "쿠버네티스 내에서 리소스를 논리적으로 분리하는 가상 공간. 아파트의 동별 구분처럼 같은 건물 내에서도 영역을 나눕니다.",
      category: "kubernetes"
    },

    // 보안 모니터링
    {
      id: "obs:SecurityMonitoring",
      group: "security",
      label: "보안 모니터링",
      description: "시스템을 대상으로 한 보안 위협을 감지하고 대응하는 활동. 건물의 보안 시스템처럼 불법 침입을 감시하고 막습니다.",
      category: "security"
    },
    {
      id: "obs:SecurityEvent",
      group: "security",
      label: "보안 이벤트",
      description: "보안과 관련된 중요한 사건이나 활동. CCTV에 포착된 수상한 움직임처럼 주의 깊게 살펴봐야 할 상황입니다.",
      category: "security"
    },
    {
      id: "obs:AccessLog",
      group: "security",
      label: "접근 로그",
      description: "시스템에 누가 언제 접근했는지 기록한 출입 기록부. 건물 출입 카드 기록처럼 모든 접근을 추적합니다.",
      category: "security"
    },
    {
      id: "obs:Vulnerability",
      group: "security",
      label: "취약점",
      description: "시스템의 보안상 약점이나 결함. 집의 잠기지 않은 문이나 창문처럼 공격자가 악용할 수 있는 보안 허점입니다.",
      category: "security"
    },

    // AI/ML 관련
    {
      id: "obs:AIOps",
      group: "aiml",
      label: "AIOps",
      description: "인공지능을 활용한 IT 운영 자동화. 숙련된 의사가 환자를 진단하듯이 AI가 시스템 문제를 자동으로 분석하고 해결합니다.",
      category: "aiml"
    },
    {
      id: "obs:MachineLearning",
      group: "aiml",
      label: "머신러닝",
      description: "컴퓨터가 데이터로부터 패턴을 학습하는 기술. 사람이 경험을 통해 학습하듯이 기계가 데이터를 통해 지식을 얻습니다.",
      category: "aiml"
    },
    {
      id: "obs:AnomalyDetection",
      group: "aiml",
      label: "이상 탐지",
      description: "정상 패턴에서 벗어난 비정상적인 상황을 자동으로 찾아내는 기술. 보안 요원이 수상한 행동을 감지하듯이 AI가 문제를 찾아냅니다.",
      category: "aiml"
    },
    {
      id: "obs:PredictiveAnalytics",
      group: "aiml",
      label: "예측 분석",
      description: "과거 데이터를 바탕으로 미래를 예측하는 분석 기법. 일기예보처럼 현재 상황을 보고 앞으로 일어날 일을 예상합니다.",
      category: "aiml"
    },

    // 비즈니스 메트릭
    {
      id: "obs:BusinessMetric",
      group: "business",
      label: "비즈니스 메트릭",
      description: "사업 성과를 측정하는 지표. 매출이나 고객 만족도처럼 비즈니스가 얼마나 잘되고 있는지를 나타내는 수치입니다.",
      category: "business"
    },
    {
      id: "obs:SLA",
      group: "business",
      label: "서비스 수준 협약",
      description: "서비스 제공자가 고객에게 약속하는 최소 서비스 품질. 배송업체가 약속하는 배송 시간처럼 지켜야 할 서비스 기준입니다.",
      category: "business"
    },
    {
      id: "obs:UserExperience",
      group: "business",
      label: "사용자 경험",
      description: "사용자가 서비스를 이용하면서 느끼는 전반적인 경험. 식당에서 음식 맛뿐만 아니라 서비스, 분위기 등을 종합한 만족도와 같습니다.",
      category: "business"
    },

    // 데이터 파이프라인
    {
      id: "obs:DataPipeline",
      group: "data",
      label: "데이터 파이프라인",
      description: "데이터가 수집되어 처리되고 저장되는 전체 과정. 공장의 생산 라인처럼 원료 데이터가 유용한 정보로 변환되는 경로입니다.",
      category: "data"
    },
    {
      id: "obs:DataIngestion",
      group: "data",
      label: "데이터 수집",
      description: "다양한 소스에서 데이터를 모아오는 과정. 뉴스 기자가 여러 곳에서 정보를 수집하듯이 시스템 곳곳에서 데이터를 모읍니다.",
      category: "data"
    },
    {
      id: "obs:DataStorage",
      group: "data",
      label: "데이터 저장소",
      description: "수집된 데이터를 보관하는 저장 시설. 도서관이나 창고처럼 데이터를 체계적으로 정리해서 보관하는 곳입니다.",
      category: "data"
    },

    // 모니터링 도구
    {
      id: "obs:MonitoringTool",
      group: "tools",
      label: "모니터링 도구",
      description: "시스템 상태를 감시하고 분석하는 소프트웨어. 의료진이 사용하는 환자 모니터링 장비처럼 시스템의 건강 상태를 지켜봅니다.",
      category: "tools"
    },
    {
      id: "obs:Dashboard",
      group: "tools",
      label: "대시보드",
      description: "시스템 상태를 한눈에 볼 수 있게 정리해서 보여주는 화면. 자동차의 계기판처럼 중요한 정보를 쉽게 파악할 수 있게 해줍니다.",
      category: "tools"
    },
    {
      id: "obs:Visualization",
      group: "tools",
      label: "시각화",
      description: "복잡한 데이터를 그래프나 차트로 쉽게 이해할 수 있게 표현하는 방법. 지도나 그림처럼 숫자를 시각적으로 보여줍니다.",
      category: "tools"
    },

    // AIRIS APM 플랫폼 특화
    {
      id: "airis:Platform",
      group: "airis",
      label: "AIRIS APM 플랫폼",
      description: "AI 기반 종합 시스템 성능 관리 플랫폼. 숙련된 시스템 관리자의 경험과 지식을 AI로 구현한 지능형 모니터링 시스템입니다.",
      category: "airis"
    },
    {
      id: "airis:IntelligentAnalysis",
      group: "airis",
      label: "지능형 분석",
      description: "AI를 활용한 고도화된 시스템 분석. 전문의가 종합적인 검진 결과를 보고 정확한 진단을 내리듯이 AI가 시스템을 분석합니다.",
      category: "airis"
    },
    {
      id: "airis:AutomatedResponse",
      group: "airis",
      label: "자동화 대응",
      description: "문제 상황에 대한 AI 기반 자동 대응 시스템. 응급실의 자동 응급 처치 시스템처럼 문제를 즉시 감지하고 대응합니다.",
      category: "airis"
    },

    // 추가 핵심 개념들
    {
      id: "obs:DistributedTracing",
      group: "pillars",
      label: "분산 추적",
      description: "여러 시스템에 걸친 요청의 전체 경로를 추적하는 기술. 여러 도시를 거치는 기차 여행의 전체 경로를 추적하는 것과 같습니다.",
      category: "pillars"
    },
    {
      id: "obs:RealTimeMonitoring",
      group: "core",
      label: "실시간 모니터링",
      description: "시스템 상태를 즉시 감시하고 분석하는 기능. 생방송처럼 지금 이 순간 무슨 일이 일어나고 있는지 실시간으로 보여줍니다.",
      category: "core"
    },
    {
      id: "obs:CapacityPlanning",
      group: "performance",
      label: "용량 계획",
      description: "미래 요구사항에 맞춰 시스템 자원을 계획하는 활동. 인구 증가에 대비해서 도시 인프라를 확장하는 것과 같은 개념입니다.",
      category: "performance"
    },
    {
      id: "obs:ServiceMesh",
      group: "kubernetes",
      label: "서비스 메시",
      description: "마이크로서비스 간의 통신을 관리하는 인프라 계층. 도시의 교통 관제 시스템처럼 서비스들 사이의 통신을 조율합니다.",
      category: "kubernetes"
    }
  ],

  links: [
    // 핵심 상속 관계
    { source: "obs:InfrastructureComponent", target: "obs:ObservabilityEntity", type: "subClassOf" },
    { source: "obs:Application", target: "obs:InfrastructureComponent", type: "subClassOf" },
    { source: "obs:Database", target: "obs:InfrastructureComponent", type: "subClassOf" },
    { source: "obs:Network", target: "obs:InfrastructureComponent", type: "subClassOf" },
    { source: "obs:Server", target: "obs:InfrastructureComponent", type: "subClassOf" },
    { source: "obs:LoadBalancer", target: "obs:InfrastructureComponent", type: "subClassOf" },

    // 관찰성 데이터 관계
    { source: "obs:ObservabilityData", target: "obs:ObservabilityEntity", type: "subClassOf" },
    { source: "obs:Log", target: "obs:ObservabilityData", type: "subClassOf" },
    { source: "obs:Metric", target: "obs:ObservabilityData", type: "subClassOf" },
    { source: "obs:Trace", target: "obs:ObservabilityData", type: "subClassOf" },
    { source: "obs:Span", target: "obs:Trace", type: "subClassOf" },
    { source: "obs:DistributedTracing", target: "obs:Trace", type: "subClassOf" },

    // 성능 지표 관계
    { source: "obs:PerformanceIndicator", target: "obs:Metric", type: "subClassOf" },
    { source: "obs:ResponseTime", target: "obs:PerformanceIndicator", type: "subClassOf" },
    { source: "obs:Throughput", target: "obs:PerformanceIndicator", type: "subClassOf" },
    { source: "obs:ErrorRate", target: "obs:PerformanceIndicator", type: "subClassOf" },
    { source: "obs:Availability", target: "obs:PerformanceIndicator", type: "subClassOf" },
    { source: "obs:CapacityPlanning", target: "obs:PerformanceIndicator", type: "subClassOf" },

    // 자원 사용률 관계
    { source: "obs:ResourceUtilization", target: "obs:Metric", type: "subClassOf" },
    { source: "obs:CPUUsage", target: "obs:ResourceUtilization", type: "subClassOf" },
    { source: "obs:MemoryUsage", target: "obs:ResourceUtilization", type: "subClassOf" },
    { source: "obs:DiskUsage", target: "obs:ResourceUtilization", type: "subClassOf" },
    { source: "obs:NetworkTraffic", target: "obs:ResourceUtilization", type: "subClassOf" },

    // 장애 관리 관계
    { source: "obs:FaultManagement", target: "obs:ObservabilityEntity", type: "subClassOf" },
    { source: "obs:Alert", target: "obs:FaultManagement", type: "subClassOf" },
    { source: "obs:Incident", target: "obs:FaultManagement", type: "subClassOf" },
    { source: "obs:Anomaly", target: "obs:FaultManagement", type: "subClassOf" },
    { source: "obs:Threshold", target: "obs:FaultManagement", type: "subClassOf" },

    // 클라우드 관계
    { source: "obs:CloudInfrastructure", target: "obs:InfrastructureComponent", type: "subClassOf" },
    { source: "obs:VirtualMachine", target: "obs:CloudInfrastructure", type: "subClassOf" },
    { source: "obs:CloudService", target: "obs:CloudInfrastructure", type: "subClassOf" },

    // 컨테이너 관계
    { source: "obs:Container", target: "obs:InfrastructureComponent", type: "subClassOf" },
    { source: "obs:DockerContainer", target: "obs:Container", type: "subClassOf" },
    { source: "obs:ContainerImage", target: "obs:Container", type: "subClassOf" },
    { source: "obs:ContainerRegistry", target: "obs:Container", type: "subClassOf" },

    // 쿠버네티스 관계
    { source: "obs:Kubernetes", target: "obs:CloudInfrastructure", type: "subClassOf" },
    { source: "obs:Pod", target: "obs:Kubernetes", type: "subClassOf" },
    { source: "obs:Service", target: "obs:Kubernetes", type: "subClassOf" },
    { source: "obs:Deployment", target: "obs:Kubernetes", type: "subClassOf" },
    { source: "obs:Node", target: "obs:Kubernetes", type: "subClassOf" },
    { source: "obs:Namespace", target: "obs:Kubernetes", type: "subClassOf" },
    { source: "obs:ServiceMesh", target: "obs:Kubernetes", type: "subClassOf" },

    // 보안 관계
    { source: "obs:SecurityMonitoring", target: "obs:ObservabilityEntity", type: "subClassOf" },
    { source: "obs:SecurityEvent", target: "obs:SecurityMonitoring", type: "subClassOf" },
    { source: "obs:AccessLog", target: "obs:SecurityMonitoring", type: "subClassOf" },
    { source: "obs:Vulnerability", target: "obs:SecurityMonitoring", type: "subClassOf" },

    // AI/ML 관계
    { source: "obs:AIOps", target: "obs:ObservabilityEntity", type: "subClassOf" },
    { source: "obs:MachineLearning", target: "obs:AIOps", type: "subClassOf" },
    { source: "obs:AnomalyDetection", target: "obs:AIOps", type: "subClassOf" },
    { source: "obs:PredictiveAnalytics", target: "obs:AIOps", type: "subClassOf" },

    // 비즈니스 관계
    { source: "obs:BusinessMetric", target: "obs:Metric", type: "subClassOf" },
    { source: "obs:SLA", target: "obs:BusinessMetric", type: "subClassOf" },
    { source: "obs:UserExperience", target: "obs:BusinessMetric", type: "subClassOf" },

    // 데이터 관계
    { source: "obs:DataPipeline", target: "obs:ObservabilityEntity", type: "subClassOf" },
    { source: "obs:DataIngestion", target: "obs:DataPipeline", type: "subClassOf" },
    { source: "obs:DataStorage", target: "obs:DataPipeline", type: "subClassOf" },

    // 도구 관계
    { source: "obs:MonitoringTool", target: "obs:ObservabilityEntity", type: "subClassOf" },
    { source: "obs:Dashboard", target: "obs:MonitoringTool", type: "subClassOf" },
    { source: "obs:Visualization", target: "obs:MonitoringTool", type: "subClassOf" },
    { source: "obs:RealTimeMonitoring", target: "obs:MonitoringTool", type: "subClassOf" },

    // AIRIS 특화 관계
    { source: "airis:Platform", target: "obs:AIOps", type: "subClassOf" },
    { source: "airis:IntelligentAnalysis", target: "airis:Platform", type: "subClassOf" },
    { source: "airis:AutomatedResponse", target: "airis:Platform", type: "subClassOf" },

    // 기능적 관계들 (relatedTo)
    { source: "obs:Alert", target: "obs:Anomaly", type: "relatedTo" },
    { source: "obs:Trace", target: "obs:Application", type: "monitors" },
    { source: "obs:Metric", target: "obs:Server", type: "monitors" },
    { source: "obs:Log", target: "obs:Database", type: "monitors" },
    { source: "obs:Dashboard", target: "obs:Visualization", type: "uses" },
    { source: "obs:AnomalyDetection", target: "obs:Anomaly", type: "detects" },
    { source: "obs:PredictiveAnalytics", target: "obs:CapacityPlanning", type: "supports" },
    { source: "airis:IntelligentAnalysis", target: "obs:AnomalyDetection", type: "includes" },
    { source: "airis:AutomatedResponse", target: "obs:Alert", type: "responds" },
    { source: "obs:ServiceMesh", target: "obs:DistributedTracing", type: "enables" }
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
    }
  },

  // UI 친화적 지식 베이스 구조
  uiKnowledgeBase: {
    basic: {
      title: "🏛️ 관찰성 기본",
      items: [
        {
          title: "관찰성 (Observability)이란?",
          description: "시스템 내부 상태를 외부에서 파악할 수 있는 능력입니다. 마치 의사가 환자의 상태를 파악하기 위해 체온, 혈압, 맥박을 재는 것과 같습니다.",
          examples: ["웹사이트 접속 속도 확인", "서버 CPU 사용률 모니터링", "데이터베이스 응답 시간 측정"],
          analogy: "자동차 계기판이 엔진 상태, 연료량, 속도를 보여주는 것처럼, IT 시스템도 건강 상태를 확인할 수 있어야 합니다."
        },
        {
          title: "모니터링 (Monitoring)",
          description: "시스템을 지속적으로 감시하여 정상 작동 여부를 확인하는 과정입니다.",
          examples: ["CCTV로 건물 보안 감시", "스마트 워치로 심박수 모니터링", "은행 ATM 상태 점검"],
          analogy: "보안 요원이 CCTV로 건물을 24시간 감시하는 것처럼, 컴퓨터 시스템도 계속 지켜봐야 합니다."
        },
        {
          title: "관찰성의 세 기둥",
          description: "로그, 메트릭, 트레이스는 시스템을 이해하는 세 가지 핵심 방법입니다.",
          examples: ["로그: 시스템 이벤트 기록", "메트릭: 성능 수치 측정", "트레이스: 요청 경로 추적"],
          analogy: "의학 검사에서 혈액검사(로그), 활력징후(메트릭), CT스캔(트레이스)으로 종합 진단하는 것과 같습니다."
        }
      ]
    },
    infrastructure: {
      title: "🏗️ 인프라스트럭처",
      items: [
        {
          title: "애플리케이션 (Application)",
          description: "사용자가 직접 사용하는 소프트웨어 프로그램입니다. 스마트폰의 앱이나 웹사이트가 대표적입니다.",
          examples: ["카카오톡 앱", "네이버 웹사이트", "은행 ATM 프로그램", "온라인 쇼핑몰"],
          analogy: "상점의 계산대처럼, 고객(사용자)이 직접 사용하는 서비스 창구입니다."
        },
        {
          title: "웹 애플리케이션 서버 (WAS)",
          description: "웹사이트나 앱이 실제로 동작하는 컴퓨터입니다. 식당의 주방과 비슷한 역할을 합니다.",
          examples: ["톰캣 서버", "아파치 서버", "IIS 서버"],
          analogy: "식당에서 주방이 요리를 만드는 곳이라면, WAS는 웹사이트의 기능을 처리하는 주방입니다."
        },
        {
          title: "데이터베이스 (Database)",
          description: "정보를 체계적으로 저장하고 관리하는 시스템입니다. 도서관과 같은 역할을 합니다.",
          examples: ["고객 정보", "상품 목록", "주문 내역", "회원 데이터"],
          analogy: "도서관이 책을 분류하여 보관하듯, 데이터베이스는 정보를 정리하여 저장합니다."
        },
        {
          title: "네트워크 (Network)",
          description: "컴퓨터들을 연결하는 통신망입니다. 도로망처럼 데이터가 이동할 수 있는 경로를 제공합니다.",
          examples: ["인터넷 연결", "사내 네트워크", "Wi-Fi", "5G 통신"],
          analogy: "도시의 도로망이 사람과 물건의 이동을 가능하게 하듯, 네트워크는 데이터의 이동을 담당합니다."
        }
      ]
    },
    observability: {
      title: "👁️ 관찰성 3요소",
      items: [
        {
          title: "로그 (Log)",
          description: "시스템이 남기는 기록입니다. 일기장처럼 언제 무슨 일이 일어났는지 기록을 남깁니다.",
          examples: ["웹사이트 방문 기록", "로그인/로그아웃 기록", "오류 발생 기록", "거래 내역"],
          analogy: "블랙박스나 일기장처럼, 나중에 무슨 일이 있었는지 확인할 수 있는 기록입니다."
        },
        {
          title: "메트릭 (Metric)",
          description: "시스템의 상태를 숫자로 나타낸 지표입니다. 체온이나 혈압 같은 건강 지표와 비슷합니다.",
          examples: ["CPU 사용률 85%", "메모리 사용량 4GB", "응답 시간 200ms", "오류율 0.1%"],
          analogy: "체온계나 혈압계처럼, 시스템의 건강 상태를 숫자로 보여주는 도구입니다."
        },
        {
          title: "트레이스 (Trace)",
          description: "하나의 작업이 시스템을 통과하는 전체 경로를 추적하는 것입니다.",
          examples: ["온라인 주문 처리 과정", "로그인 인증 절차", "결제 승인 과정"],
          analogy: "택배가 발송지에서 목적지까지 이동하는 전체 경로를 추적하는 것과 같습니다."
        },
        {
          title: "분산 추적 (Distributed Tracing)",
          description: "여러 시스템에 걸친 요청의 전체 경로를 추적하는 기술입니다.",
          examples: ["마이크로서비스 간 호출 추적", "API 게이트웨이를 통한 요청 경로"],
          analogy: "여러 도시를 거치는 기차 여행의 전체 경로를 추적하는 것과 같습니다."
        }
      ]
    },
    performance: {
      title: "⚡ 성능 관리",
      items: [
        {
          title: "응답 시간 (Response Time)",
          description: "요청을 보내고 답변을 받기까지 걸리는 시간입니다.",
          examples: ["웹페이지 로딩 시간", "검색 결과 표시 시간", "파일 다운로드 시간", "결제 처리 시간"],
          analogy: "식당에서 주문하고 음식이 나올 때까지의 시간과 같습니다."
        },
        {
          title: "처리량 (Throughput)",
          description: "단위 시간당 처리할 수 있는 작업의 양입니다.",
          examples: ["초당 처리 가능한 주문 수", "분당 처리 가능한 사용자 수"],
          analogy: "고속도로의 시간당 통과 차량 수나 은행 창구의 시간당 처리 고객 수와 비슷합니다."
        },
        {
          title: "자원 사용률 (Resource Utilization)",
          description: "시스템 자원이 얼마나 사용되고 있는지를 나타내는 지표입니다.",
          examples: ["CPU 사용률", "메모리 사용량", "디스크 사용률", "네트워크 대역폭"],
          analogy: "주차장의 주차 공간 사용률처럼 가용 자원 대비 사용량을 보여줍니다."
        },
        {
          title: "용량 계획 (Capacity Planning)",
          description: "미래 요구사항에 맞춰 시스템 자원을 계획하는 활동입니다.",
          examples: ["서버 증설 계획", "네트워크 대역폭 확장", "스토리지 용량 증대"],
          analogy: "인구 증가에 대비해서 도시 인프라를 확장하는 것과 같은 개념입니다."
        }
      ]
    },
    fault: {
      title: "🚨 장애 관리",
      items: [
        {
          title: "인시던트 (Incident)",
          description: "시스템에 문제가 발생한 사건입니다. 정전이나 화재 같은 비상 상황과 비슷합니다.",
          examples: ["웹사이트 접속 불가", "데이터베이스 다운", "해킹 공격", "네트워크 장애"],
          analogy: "병원의 응급상황이나 정전 사고처럼, 즉시 대응이 필요한 문제입니다."
        },
        {
          title: "알림 (Alert)",
          description: "시스템에 문제가 생겼을 때 담당자에게 알려주는 시스템입니다.",
          examples: ["문자 메시지 알림", "이메일 알림", "슬랙 메시지", "전화 알림"],
          analogy: "화재 경보기나 도난 경보기처럼, 문제 상황을 즉시 알려주는 장치입니다."
        },
        {
          title: "이상 현상 (Anomaly)",
          description: "정상 패턴에서 벗어난 비정상적인 동작입니다.",
          examples: ["평소보다 높은 응답 시간", "비정상적인 트래픽 증가", "메모리 사용량 급증"],
          analogy: "평소와 다른 행동을 보이는 것처럼 예상과 다른 시스템 동작입니다."
        },
        {
          title: "임계치 (Threshold)",
          description: "정상과 비정상을 구분하는 기준값입니다.",
          examples: ["CPU 사용률 80% 초과", "응답 시간 5초 이상", "오류율 1% 초과"],
          analogy: "체온 37도처럼 정상 범위를 벗어나면 문제가 있다고 판단하는 기준선입니다."
        }
      ]
    },
    cloud: {
      title: "☁️ 클라우드 & 컨테이너",
      items: [
        {
          title: "클라우드 서비스",
          description: "인터넷을 통해 컴퓨터 자원을 빌려 사용하는 서비스입니다.",
          examples: ["AWS", "구글 클라우드", "마이크로소프트 Azure", "네이버 클라우드"],
          analogy: "자동차를 사지 않고 필요할 때만 렌트하는 것처럼, 서버를 필요한 만큼만 빌려 사용합니다."
        },
        {
          title: "컨테이너 (Container)",
          description: "애플리케이션을 포장하여 어디서든 동일하게 실행할 수 있게 만드는 기술입니다.",
          examples: ["도커 컨테이너", "쿠버네티스 파드"],
          analogy: "이사할 때 물건을 박스에 포장하면 어디든 옮길 수 있듯, 프로그램을 컨테이너에 담으면 어떤 서버에서든 실행할 수 있습니다."
        },
        {
          title: "쿠버네티스 (Kubernetes)",
          description: "수많은 컨테이너를 자동으로 관리해주는 시스템입니다.",
          examples: ["파드 관리", "서비스 로드밸런싱", "자동 스케일링"],
          analogy: "대형 물류센터의 자동화 시스템이 수천 개의 상품을 효율적으로 관리하는 것처럼 컨테이너를 자동 관리합니다."
        },
        {
          title: "서비스 메시 (Service Mesh)",
          description: "마이크로서비스 간의 통신을 관리하는 인프라 계층입니다.",
          examples: ["서비스 간 보안 통신", "트래픽 관리", "장애 복구"],
          analogy: "도시의 교통 관제 시스템처럼 서비스들 사이의 통신을 조율합니다."
        }
      ]
    },
    aiml: {
      title: "🤖 AI/ML",
      items: [
        {
          title: "머신러닝 (Machine Learning)",
          description: "컴퓨터가 데이터를 보고 스스로 학습하여 패턴을 찾는 기술입니다.",
          examples: ["스팸 메일 필터", "상품 추천 시스템", "음성 인식", "이미지 분류"],
          analogy: "사람이 경험을 통해 학습하듯, 컴퓨터도 많은 데이터를 보고 규칙을 스스로 찾아냅니다."
        },
        {
          title: "이상 탐지 (Anomaly Detection)",
          description: "정상과 다른 비정상적인 패턴을 자동으로 찾아내는 기술입니다.",
          examples: ["신용카드 도용 탐지", "네트워크 침입 탐지", "시스템 성능 이상 감지"],
          analogy: "보안요원이 평소와 다른 수상한 행동을 눈치채는 것처럼, AI가 비정상적인 패턴을 자동으로 발견합니다."
        },
        {
          title: "예측 분석 (Predictive Analytics)",
          description: "과거 데이터를 바탕으로 미래를 예측하는 분석 기법입니다.",
          examples: ["시스템 장애 예측", "트래픽 증가 예상", "자원 사용량 예측"],
          analogy: "일기예보처럼 데이터를 보고 미래의 문제를 예측하는 것입니다."
        },
        {
          title: "AIOps",
          description: "인공지능을 활용한 IT 운영 자동화입니다.",
          examples: ["자동 장애 감지", "근본 원인 분석", "자동 복구"],
          analogy: "숙련된 의사가 환자를 진단하듯이 AI가 시스템 문제를 자동으로 분석하고 해결합니다."
        }
      ]
    }
  }
};

// 전역으로 export하여 다른 스크립트에서 사용 가능
window.ontologyCompleteData = ontologyCompleteData;