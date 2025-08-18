# AIRIS-MON MSA 아키텍처 분석 보고서

## 📋 현재 구조 분석

### ✅ MSA 구조 확인
**네, 현재 프로젝트는 완전한 MSA(Microservices Architecture) 구조로 구성되어 있습니다.**

## 🏗️ 서비스 분류 및 분석

### 📊 **Stateless 서비스** (무상태 서비스)
> 데이터를 저장하지 않고, 요청을 처리한 후 즉시 응답하는 서비스

| 서비스명 | 포트 | 역할 | 특징 |
|---------|------|------|------|
| **api-gateway** | 3000 | API 게이트웨이 | 라우팅, 인증, 로드밸런싱 |
| **data-ingestion** | 3007 | 데이터 수집 | 실시간 데이터 수집 및 배치 처리 |
| **analytics-engine** | - | 분석 엔진 | 데이터 분석 및 집계 |
| **session-replay** | 3003 | 세션 리플레이 | 사용자 세션 재생 |
| **aiops** | 3004 | AI/ML 엔진 | 이상 탐지 및 예측 |
| **event-delta-analyzer** | 3005 | 이벤트 분석 | 이벤트 비교 분석 |
| **nlp-search** | 3006 | NLP 검색 | 자연어 검색 |
| **ui** | 3001 | 프론트엔드 | React 기반 UI |
| **test-suite** | 3100 | 테스트 스위트 | 통합 테스트 관리 |

### 🗄️ **Stateful 서비스** (상태 저장 서비스)
> 데이터를 영구적으로 저장하고 관리하는 서비스

| 서비스명 | 포트 | 역할 | 데이터 유형 | 지속성 요구사항 |
|---------|------|------|-------------|----------------|
| **ClickHouse** | 8123, 9000 | 메인 데이터베이스 | 메트릭, 로그, 트레이스 | **HIGH** - 데이터 손실 불가 |
| **Apache Kafka** | 9092, 29092 | 이벤트 스트리밍 | 이벤트 스트림 | **MEDIUM** - 임시 버퍼링 |
| **Zookeeper** | 2181 | Kafka 코디네이터 | 클러스터 메타데이터 | **HIGH** - 클러스터 운영 필수 |
| **Redis** | 6379 | 캐시/세션 저장소 | 캐시, 세션 | **LOW** - 재생성 가능 |
| **Container Registry** | 5000 | 이미지 저장소 | 컨테이너 이미지 | **HIGH** - 배포 필수 |

## 🎯 MSA 설계 원칙 준수도

### ✅ **잘 구현된 부분**
1. **단일 책임 원칙**: 각 서비스가 명확한 역할을 가짐
2. **독립적 배포**: 각 서비스별 Dockerfile과 패키지 구성
3. **기술 다양성**: Node.js 기반 통일된 기술 스택
4. **API 게이트웨이**: 중앙집중식 API 관리
5. **이벤트 기반 통신**: Kafka를 통한 비동기 통신
6. **서비스 디스커버리**: 컨테이너 네트워크 기반

### ⚠️ **개선이 필요한 부분**
1. **서비스 간 직접 의존성**: 일부 서비스가 직접 DB 접근
2. **로깅 분산**: 중앙집중식 로깅 시스템 부재
3. **서킷 브레이커 패턴**: 장애 전파 방지 메커니즘 부족
4. **서비스 메시**: Istio/Linkerd 등 서비스 메시 미적용

## 🏛️ 현재 K8s 배포 구성 분석

### ❌ **문제점 발견**
현재 K8s 매니페스트에서 **모든 서비스가 Deployment로 구성**되어 있어 Stateful 서비스의 특성을 제대로 반영하지 못함

```yaml
# 현재 - 잘못된 구성
apiVersion: apps/v1
kind: Deployment  # ❌ ClickHouse도 Deployment로 구성
metadata:
  name: clickhouse
```

## 🔧 권장 개선 사항

### 1. **Stateful 서비스 → StatefulSet 변경**

#### ClickHouse (주요 데이터베이스)
```yaml
apiVersion: apps/v1
kind: StatefulSet  # ✅ StatefulSet으로 변경
metadata:
  name: clickhouse
spec:
  serviceName: clickhouse-headless
  replicas: 3  # 클러스터 구성
  volumeClaimTemplates:
  - metadata:
      name: clickhouse-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
```

#### Kafka 클러스터
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: kafka
spec:
  serviceName: kafka-headless
  replicas: 3
  volumeClaimTemplates:
  - metadata:
      name: kafka-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
```

### 2. **Storage Class 최적화**

#### 성능 기반 스토리지 분류
```yaml
# 고성능 SSD - ClickHouse용
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "16000"
  throughput: "1000"

# 표준 스토리지 - Kafka용
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
```

### 3. **헤드리스 서비스 구성**

```yaml
# StatefulSet용 헤드리스 서비스
apiVersion: v1
kind: Service
metadata:
  name: clickhouse-headless
spec:
  clusterIP: None  # 헤드리스 서비스
  selector:
    app: clickhouse
  ports:
  - port: 8123
    name: http
  - port: 9000
    name: native
```

### 4. **Pod Disruption Budget 설정**

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: clickhouse-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: clickhouse
```

## 📊 리소스 최적화 권장사항

### **Stateful 서비스 리소스 할당**

| 서비스 | CPU Request | CPU Limit | Memory Request | Memory Limit | Storage |
|--------|-------------|-----------|----------------|--------------|---------|
| ClickHouse | 2 | 8 | 4Gi | 16Gi | 100Gi |
| Kafka | 1 | 4 | 2Gi | 8Gi | 50Gi |
| Zookeeper | 500m | 2 | 1Gi | 4Gi | 10Gi |
| Redis | 200m | 1 | 512Mi | 2Gi | 5Gi |

### **Stateless 서비스 리소스 할당**

| 서비스 | CPU Request | CPU Limit | Memory Request | Memory Limit |
|--------|-------------|-----------|----------------|--------------|
| api-gateway | 500m | 2 | 512Mi | 2Gi |
| data-ingestion | 300m | 1 | 256Mi | 1Gi |
| analytics-engine | 500m | 2 | 512Mi | 2Gi |
| session-replay | 200m | 1 | 256Mi | 1Gi |
| aiops | 1 | 4 | 1Gi | 4Gi |
| nlp-search | 300m | 1 | 512Mi | 2Gi |
| ui | 100m | 500m | 128Mi | 512Mi |

## 🔄 데이터 백업 및 복구 전략

### **ClickHouse 백업**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: clickhouse-backup
spec:
  schedule: "0 2 * * *"  # 매일 새벽 2시
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: clickhouse/clickhouse-server:23.12
            command:
            - /bin/bash
            - -c
            - |
              clickhouse-client --query "BACKUP DATABASE airis_mon TO S3('s3://backup-bucket/clickhouse/$(date +%Y%m%d)')"
```

### **Kafka 토픽 복제**
```yaml
# Kafka 클러스터 간 미러링
apiVersion: v1
kind: ConfigMap
metadata:
  name: kafka-mirror-maker
data:
  consumer.properties: |
    bootstrap.servers=kafka-source:9092
    group.id=mirror-maker
  producer.properties: |
    bootstrap.servers=kafka-target:9092
```

## 🚨 모니터링 및 알림 강화

### **Stateful 서비스 전용 모니터링**
```yaml
# ClickHouse 모니터링 ServiceMonitor
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: clickhouse-monitor
spec:
  selector:
    matchLabels:
      app: clickhouse
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

## 🎯 다음 단계 권장사항

### **1단계: Stateful 서비스 마이그레이션 (1-2주)**
1. ClickHouse StatefulSet 변환
2. Kafka StatefulSet 구성
3. 스토리지 클래스 최적화
4. 백업 전략 구현

### **2단계: Stateless 서비스 최적화 (1주)**
1. HPA 설정 최적화
2. 리소스 할당 튜닝
3. 서킷 브레이커 패턴 적용

### **3단계: 고급 MSA 패턴 적용 (2-3주)**
1. 서비스 메시 도입 (Istio)
2. 분산 트레이싱 강화
3. 중앙집중식 로깅
4. Chaos Engineering 도구 도입

## 💡 결론

현재 AIRIS-MON 프로젝트는 **훌륭한 MSA 아키텍처**를 가지고 있으나, K8s 배포에서 **Stateful과 Stateless 서비스를 구분하지 않은 점**이 주요 개선점입니다.

**핵심 개선사항:**
1. ✅ **StatefulSet 적용**: ClickHouse, Kafka, Zookeeper
2. ✅ **PVC 템플릿**: 데이터 영속성 보장
3. ✅ **헤드리스 서비스**: 안정적인 네트워크 신원성
4. ✅ **백업 전략**: 자동화된 데이터 보호
5. ✅ **리소스 최적화**: 서비스별 맞춤 리소스 할당

이러한 개선을 통해 **더욱 안정적이고 확장 가능한 MSA 시스템**을 구축할 수 있습니다.