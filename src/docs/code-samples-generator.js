/**
 * AIRIS EPM Code Samples Generator
 * Automatically generates code samples and usage examples
 * for multiple programming languages
 */

import fs from 'fs/promises';
import path from 'path';

export class CodeSamplesGenerator {
    constructor(options = {}) {
        this.outputDir = options.outputDir || './generated-samples';
        this.languages = options.languages || [
            'javascript', 'python', 'java', 'csharp', 
            'go', 'php', 'ruby', 'swift', 'kotlin'
        ];
        this.apiEndpoints = options.apiEndpoints || this.getDefaultEndpoints();
    }

    /**
     * Get default API endpoints to generate samples for
     */
    getDefaultEndpoints() {
        return {
            // Performance API
            performance: {
                getMetrics: {
                    method: 'GET',
                    path: '/performance/metrics',
                    params: ['timeRange', 'metricType', 'aggregation'],
                    description: '성능 메트릭 조회'
                },
                submitMetrics: {
                    method: 'POST',
                    path: '/performance/metrics',
                    body: 'metrics',
                    description: '성능 메트릭 제출'
                },
                getCacheStats: {
                    method: 'GET',
                    path: '/performance/cache/stats',
                    description: '캐시 통계 조회'
                }
            },
            // Data Quality API
            dataQuality: {
                validateData: {
                    method: 'POST',
                    path: '/data-quality/validation',
                    body: { data: 'object', schema: 'string' },
                    description: '데이터 품질 검증'
                },
                detectAnomalies: {
                    method: 'POST',
                    path: '/data-quality/anomalies',
                    body: { data: 'array', algorithms: 'array' },
                    description: '이상 탐지 실행'
                }
            },
            // Analytics API
            analytics: {
                getDashboard: {
                    method: 'GET',
                    path: '/analytics/dashboard',
                    params: ['dashboardId', 'timeRange'],
                    description: '대시보드 데이터 조회'
                },
                generateReport: {
                    method: 'POST',
                    path: '/analytics/reports',
                    body: { reportType: 'string', filters: 'object' },
                    description: '리포트 생성'
                }
            },
            // Alerts API
            alerts: {
                getAlerts: {
                    method: 'GET',
                    path: '/alerts',
                    params: ['status', 'severity', 'limit'],
                    description: '알림 목록 조회'
                },
                createAlertRule: {
                    method: 'POST',
                    path: '/alerts',
                    body: { name: 'string', condition: 'string', severity: 'string' },
                    description: '알림 규칙 생성'
                }
            },
            // GraphQL
            graphql: {
                getHealth: {
                    type: 'query',
                    description: '시스템 상태 조회 (GraphQL)'
                },
                submitMetrics: {
                    type: 'mutation',
                    description: '메트릭 제출 (GraphQL)'
                },
                subscribeToAlerts: {
                    type: 'subscription',
                    description: '실시간 알림 구독 (GraphQL)'
                }
            }
        };
    }

    /**
     * Generate all code samples
     */
    async generateAll() {
        console.log('🔧 Starting code samples generation...');
        
        try {
            // Create output directories
            await this.createDirectories();
            
            // Generate samples for each language
            const results = {};
            for (const language of this.languages) {
                console.log(`📝 Generating ${language.toUpperCase()} samples...`);
                results[language] = await this.generateLanguageSamples(language);
            }
            
            // Generate meta files
            await this.generateMetaFiles(results);
            
            console.log('✅ Code samples generation completed!');
            return results;
            
        } catch (error) {
            console.error('❌ Code samples generation failed:', error);
            throw error;
        }
    }

    /**
     * Create output directories
     */
    async createDirectories() {
        await fs.mkdir(this.outputDir, { recursive: true });
        
        for (const language of this.languages) {
            await fs.mkdir(path.join(this.outputDir, language), { recursive: true });
        }
    }

    /**
     * Generate samples for specific language
     */
    async generateLanguageSamples(language) {
        const generators = {
            javascript: () => this.generateJavaScriptSamples(),
            python: () => this.generatePythonSamples(),
            java: () => this.generateJavaSamples(),
            csharp: () => this.generateCSharpSamples(),
            go: () => this.generateGoSamples(),
            php: () => this.generatePHPSamples(),
            ruby: () => this.generateRubySamples(),
            swift: () => this.generateSwiftSamples(),
            kotlin: () => this.generateKotlinSamples()
        };

        if (!generators[language]) {
            throw new Error(`Unsupported language: ${language}`);
        }

        return await generators[language]();
    }

    /**
     * Generate JavaScript samples
     */
    async generateJavaScriptSamples() {
        const sampleDir = path.join(this.outputDir, 'javascript');
        
        // Basic setup example
        const setupSample = `/**
 * AIRIS EPM JavaScript SDK 기본 설정
 */

const { AirisEPMClient } = require('airis-epm-sdk-js');

// 클라이언트 초기화
const client = new AirisEPMClient({
    baseURL: 'https://api.airis-epm.com/v1',
    apiKey: 'your-api-key-here',
    timeout: 30000
});

// 연결 테스트
async function testConnection() {
    try {
        const result = await client.testConnection();
        console.log('연결 성공:', result);
        return result.success;
    } catch (error) {
        console.error('연결 실패:', error.message);
        return false;
    }
}

// 실행
testConnection();`;

        await fs.writeFile(path.join(sampleDir, '01-setup.js'), setupSample);

        // Performance monitoring samples
        const performanceSample = `/**
 * 성능 모니터링 예제
 */

const { AirisEPMClient } = require('airis-epm-sdk-js');

const client = new AirisEPMClient({
    apiKey: process.env.AIRIS_API_KEY
});

async function performanceExamples() {
    try {
        // 1. 성능 메트릭 조회
        console.log('📊 성능 메트릭 조회...');
        const metrics = await client.performance.getMetrics({
            timeRange: '1h',
            metricType: 'cpu',
            aggregation: 'avg'
        });
        console.log('메트릭 결과:', metrics);

        // 2. 메트릭 제출
        console.log('📤 메트릭 제출...');
        const submitResult = await client.performance.submitMetrics([
            {
                timestamp: new Date().toISOString(),
                metricType: 'cpu_usage',
                value: 75.5,
                tags: {
                    host: 'web-server-01',
                    region: 'ap-northeast-2',
                    environment: 'production'
                }
            },
            {
                timestamp: new Date().toISOString(),
                metricType: 'memory_usage',
                value: 68.2,
                tags: {
                    host: 'web-server-01',
                    region: 'ap-northeast-2',
                    environment: 'production'
                }
            }
        ]);
        console.log('제출 결과:', submitResult);

        // 3. 캐시 통계 조회
        console.log('💾 캐시 통계 조회...');
        const cacheStats = await client.performance.getCacheStats();
        console.log('캐시 통계:', cacheStats);

        // 4. 캐시 데이터 관리
        console.log('🔄 캐시 데이터 관리...');
        
        // 캐시에 데이터 저장
        await client.performance.setCachedData('user-session', 'user-123', {
            userId: 123,
            sessionId: 'sess_abc123',
            loginTime: new Date().toISOString(),
            preferences: { theme: 'dark', language: 'ko' }
        }, { ttl: 3600 });

        // 캐시에서 데이터 조회
        const cachedData = await client.performance.getCachedData('user-session', 'user-123');
        console.log('캐시된 데이터:', cachedData);

        // 캐시 무효화
        await client.performance.invalidateCache('user-session', 'user-123');
        console.log('캐시 무효화 완료');

    } catch (error) {
        console.error('성능 모니터링 예제 실패:', error);
    }
}

performanceExamples();`;

        await fs.writeFile(path.join(sampleDir, '02-performance.js'), performanceSample);

        // Data Quality samples
        const dataQualitySample = `/**
 * 데이터 품질 관리 예제
 */

const { AirisEPMClient } = require('airis-epm-sdk-js');

const client = new AirisEPMClient({
    apiKey: process.env.AIRIS_API_KEY
});

async function dataQualityExamples() {
    try {
        // 1. 데이터 품질 검증
        console.log('🔍 데이터 품질 검증...');
        const sensorData = {
            temperature: 25.5,
            humidity: 65.2,
            pressure: 1013.25,
            timestamp: '2024-01-15T10:30:00Z',
            sensorId: 'TEMP_001'
        };

        const validationResult = await client.dataQuality.validateData(
            sensorData,
            'sensor-readings',
            { strictMode: true }
        );
        console.log('검증 결과:', validationResult);

        // 2. 이상 탐지
        console.log('🚨 이상 탐지 실행...');
        const timeSeriesData = [
            { timestamp: '2024-01-15T10:00:00Z', value: 23.1 },
            { timestamp: '2024-01-15T10:05:00Z', value: 23.8 },
            { timestamp: '2024-01-15T10:10:00Z', value: 24.2 },
            { timestamp: '2024-01-15T10:15:00Z', value: 89.5 }, // 이상값
            { timestamp: '2024-01-15T10:20:00Z', value: 23.9 },
            { timestamp: '2024-01-15T10:25:00Z', value: 24.1 }
        ];

        const anomalyResult = await client.dataQuality.detectAnomalies(
            timeSeriesData,
            {
                algorithms: ['statistical', 'ml'],
                sensitivity: 0.7
            }
        );
        console.log('이상 탐지 결과:', anomalyResult);

        // 3. 기존 이상 조회
        console.log('📋 기존 이상 조회...');
        const existingAnomalies = await client.dataQuality.getAnomalies({
            timeRange: '24h',
            severity: 'high'
        });
        console.log('기존 이상:', existingAnomalies);

        // 4. 데이터 정제
        console.log('🧹 데이터 정제...');
        const rawData = [
            { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
            { id: 2, name: null, email: 'jane@example.com', age: 25 },
            { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 }, // 중복
            { id: 3, name: 'Bob Smith', email: 'invalid-email', age: -5 },
            { id: 4, name: '', email: 'alice@example.com', age: 28 }
        ];

        const cleansingResult = await client.dataQuality.cleanseData(
            rawData,
            ['remove_nulls', 'deduplicate', 'validate_format', 'normalize'],
            {
                emailValidation: true,
                ageRange: { min: 0, max: 120 }
            }
        );
        console.log('정제 결과:', cleansingResult);

    } catch (error) {
        console.error('데이터 품질 예제 실패:', error);
    }
}

dataQualityExamples();`;

        await fs.writeFile(path.join(sampleDir, '03-data-quality.js'), dataQualitySample);

        // GraphQL samples
        const graphqlSample = `/**
 * GraphQL 사용 예제
 */

const { AirisEPMClient } = require('airis-epm-sdk-js');

const client = new AirisEPMClient({
    apiKey: process.env.AIRIS_API_KEY,
    graphqlEndpoint: 'https://api.airis-epm.com/graphql'
});

async function graphqlExamples() {
    try {
        // 1. 시스템 상태 조회
        console.log('❤️ 시스템 상태 조회...');
        const healthQuery = \`
            query GetSystemHealth {
                health {
                    status
                    timestamp
                    version
                    uptime
                    dependencies {
                        service
                        status
                        latency
                        lastCheck
                    }
                    metrics {
                        cpuUsage
                        memoryUsage
                        diskUsage
                        networkLatency
                        activeConnections
                    }
                }
            }
        \`;

        const healthResult = await client.graphql(healthQuery);
        console.log('시스템 상태:', healthResult);

        // 2. 성능 메트릭 조회 (변수 사용)
        console.log('📊 성능 메트릭 조회...');
        const metricsQuery = \`
            query GetMetrics($timeRange: TimeRange!, $metricTypes: [MetricType!], $limit: Int) {
                metrics(timeRange: $timeRange, metricType: $metricTypes, limit: $limit) {
                    success
                    metrics {
                        timestamp
                        metricType
                        value
                        tags
                    }
                    metadata {
                        totalCount
                        timeRange
                        aggregation
                        queryDuration
                    }
                }
            }
        \`;

        const metricsResult = await client.graphql(metricsQuery, {
            timeRange: 'HOUR_1',
            metricTypes: ['CPU', 'MEMORY'],
            limit: 20
        });
        console.log('메트릭 결과:', metricsResult);

        // 3. 뮤테이션 - 알림 규칙 생성
        console.log('🚨 알림 규칙 생성...');
        const createRuleMutation = \`
            mutation CreateAlertRule($input: AlertRuleInput!) {
                createAlertRule(input: $input) {
                    success
                    rule {
                        id
                        name
                        description
                        condition
                        severity
                        enabled
                        createdAt
                        notificationChannels
                    }
                }
            }
        \`;

        const ruleResult = await client.graphql(createRuleMutation, {
            input: {
                name: 'High CPU Usage Alert',
                description: 'CPU 사용률이 80% 이상일 때 알림',
                condition: 'cpu_usage > 80',
                severity: 'HIGH',
                enabled: true,
                notificationChannels: ['email', 'slack'],
                evaluationInterval: 60,
                forDuration: 300
            }
        });
        console.log('알림 규칙 생성 결과:', ruleResult);

        // 4. 복합 쿼리 - 대시보드용 데이터
        console.log('📈 대시보드 데이터 조회...');
        const dashboardQuery = \`
            query GetDashboardData($dashboardId: String!, $timeRange: TimeRange!) {
                dashboard(dashboardId: $dashboardId, timeRange: $timeRange) {
                    success
                    dashboardId
                    title
                    widgets {
                        id
                        type
                        title
                        position {
                            x
                            y
                            width
                            height
                        }
                        data
                        config
                    }
                    lastUpdated
                    refreshInterval
                }
                
                alerts(status: ACTIVE, limit: 5) {
                    success
                    alerts {
                        id
                        title
                        severity
                        status
                        createdAt
                        affectedServices
                    }
                    summary {
                        active
                        critical: bySeverity { critical }
                    }
                }
            }
        \`;

        const dashboardResult = await client.graphql(dashboardQuery, {
            dashboardId: 'main-dashboard',
            timeRange: 'DAY_1'
        });
        console.log('대시보드 데이터:', dashboardResult);

        // 5. 구독 예제 (실시간 데이터)
        console.log('📡 실시간 메트릭 구독 시작...');
        // 참고: 실제 구독을 위해서는 WebSocket 또는 Server-Sent Events 지원 필요
        const subscriptionQuery = \`
            subscription MetricsUpdates($metricTypes: [MetricType!]) {
                metricsUpdates(metricTypes: $metricTypes) {
                    timestamp
                    metricType
                    value
                    tags
                }
            }
        \`;

        // 구독 예제 (의사 코드 - 실제 구현은 WebSocket 필요)
        console.log('구독 쿼리:', subscriptionQuery);
        console.log('변수:', { metricTypes: ['CPU', 'MEMORY', 'DISK'] });

    } catch (error) {
        console.error('GraphQL 예제 실패:', error);
    }
}

graphqlExamples();`;

        await fs.writeFile(path.join(sampleDir, '04-graphql.js'), graphqlSample);

        // Error handling and best practices
        const bestPracticesSample = `/**
 * 모범 사례 및 에러 처리 예제
 */

const { AirisEPMClient } = require('airis-epm-sdk-js');

class AirisEPMManager {
    constructor(options = {}) {
        this.client = new AirisEPMClient({
            apiKey: options.apiKey || process.env.AIRIS_API_KEY,
            baseURL: options.baseURL || 'https://api.airis-epm.com/v1',
            timeout: options.timeout || 30000
        });
        
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
    }

    /**
     * 재시도 로직을 포함한 안전한 API 호출
     */
    async safeApiCall(apiFunction, ...args) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const result = await apiFunction(...args);
                return result;
            } catch (error) {
                lastError = error;
                
                console.warn(\`API 호출 실패 (시도 \${attempt}/\${this.retryAttempts}):\`, error.message);
                
                // 재시도 가능한 에러인지 확인
                if (!this.isRetryableError(error) || attempt === this.retryAttempts) {
                    throw error;
                }
                
                // 지수 백오프 적용
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    }

    /**
     * 재시도 가능한 에러 판단
     */
    isRetryableError(error) {
        // 네트워크 에러, 타임아웃, 5xx 서버 에러는 재시도
        if (error.code === 'ECONNRESET' || 
            error.code === 'ETIMEDOUT' ||
            error.message.includes('timeout')) {
            return true;
        }
        
        if (error.response) {
            const status = error.response.status;
            return status >= 500 || status === 429; // 5xx 또는 Too Many Requests
        }
        
        return false;
    }

    /**
     * 슬립 유틸리티
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 배치 메트릭 제출 (성능 최적화)
     */
    async submitMetricsBatch(metrics, batchSize = 100) {
        const results = [];
        
        for (let i = 0; i < metrics.length; i += batchSize) {
            const batch = metrics.slice(i, i + batchSize);
            
            try {
                const result = await this.safeApiCall(
                    this.client.performance.submitMetrics.bind(this.client.performance),
                    batch
                );
                results.push(result);
                
                console.log(\`배치 \${Math.floor(i / batchSize) + 1} 제출 완료 (\${batch.length}개 메트릭)\`);
                
            } catch (error) {
                console.error(\`배치 \${Math.floor(i / batchSize) + 1} 제출 실패:\`, error.message);
                // 개별 메트릭으로 재시도
                await this.submitMetricsIndividually(batch);
            }
        }
        
        return results;
    }

    /**
     * 개별 메트릭 제출 (장애 복구)
     */
    async submitMetricsIndividually(metrics) {
        const results = { success: 0, failed: 0, errors: [] };
        
        for (const metric of metrics) {
            try {
                await this.safeApiCall(
                    this.client.performance.submitMetrics.bind(this.client.performance),
                    [metric]
                );
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    metric: metric,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * 시스템 상태 모니터링
     */
    async monitorSystemHealth() {
        try {
            const health = await this.safeApiCall(
                this.client.system.getHealth.bind(this.client.system)
            );
            
            // 상태별 처리
            switch (health.status) {
                case 'healthy':
                    console.log('✅ 시스템 정상');
                    break;
                    
                case 'degraded':
                    console.warn('⚠️ 시스템 성능 저하 감지');
                    await this.handleDegradedStatus(health);
                    break;
                    
                case 'unhealthy':
                    console.error('🚨 시스템 장애 감지');
                    await this.handleUnhealthyStatus(health);
                    break;
            }
            
            return health;
            
        } catch (error) {
            console.error('시스템 상태 확인 실패:', error.message);
            // 폴백 처리
            return { status: 'unknown', error: error.message };
        }
    }

    /**
     * 성능 저하 상태 처리
     */
    async handleDegradedStatus(health) {
        // 의존성 상태 확인
        const failedDependencies = Object.entries(health.dependencies || {})
            .filter(([_, status]) => status.status !== 'healthy')
            .map(([service, status]) => ({ service, ...status }));
        
        if (failedDependencies.length > 0) {
            console.log('문제가 있는 서비스:', failedDependencies);
        }
    }

    /**
     * 장애 상태 처리
     */
    async handleUnhealthyStatus(health) {
        // 긴급 알림 발송
        try {
            await this.client.alerts.createAlertRule({
                name: 'System Health Critical',
                condition: 'system_status == "unhealthy"',
                severity: 'critical',
                enabled: true,
                notificationChannels: ['email', 'slack', 'sms']
            });
        } catch (error) {
            console.error('긴급 알림 생성 실패:', error.message);
        }
    }

    /**
     * 정리 작업
     */
    async cleanup() {
        console.log('클린업 작업 수행 중...');
        // 연결 정리, 캐시 클리어 등
    }
}

// 사용 예제
async function bestPracticesExample() {
    const manager = new AirisEPMManager({
        retryAttempts: 3,
        retryDelay: 1000,
        timeout: 30000
    });

    try {
        // 시스템 상태 모니터링
        await manager.monitorSystemHealth();

        // 배치 메트릭 제출
        const metrics = Array.from({ length: 250 }, (_, i) => ({
            timestamp: new Date(Date.now() - i * 60000).toISOString(),
            metricType: 'cpu_usage',
            value: Math.random() * 100,
            tags: { host: \`server-\${(i % 5) + 1}\` }
        }));

        await manager.submitMetricsBatch(metrics, 50);

    } catch (error) {
        console.error('예제 실행 실패:', error);
    } finally {
        await manager.cleanup();
    }
}

// 프로세스 종료 시 정리 작업
process.on('SIGINT', async () => {
    console.log('애플리케이션 종료 중...');
    process.exit(0);
});

bestPracticesExample();`;

        await fs.writeFile(path.join(sampleDir, '05-best-practices.js'), bestPracticesSample);

        return {
            language: 'javascript',
            files: [
                '01-setup.js',
                '02-performance.js',
                '03-data-quality.js',
                '04-graphql.js',
                '05-best-practices.js'
            ],
            path: sampleDir
        };
    }

    /**
     * Generate Python samples
     */
    async generatePythonSamples() {
        const sampleDir = path.join(this.outputDir, 'python');
        
        // Basic setup
        const setupSample = `"""
AIRIS EPM Python SDK 기본 설정
"""

import os
from airis_epm_sdk import create_client, AirisEPMException

# 클라이언트 초기화
client = create_client(
    api_key=os.getenv('AIRIS_API_KEY', 'your-api-key-here'),
    base_url='https://api.airis-epm.com/v1',
    timeout=30
)

def test_connection():
    """연결 테스트"""
    try:
        result = client.test_connection()
        print(f"연결 성공: {result}")
        return result['success']
    except AirisEPMException as e:
        print(f"연결 실패: {e}")
        return False
    except Exception as e:
        print(f"예상치 못한 오류: {e}")
        return False

if __name__ == '__main__':
    test_connection()`;

        await fs.writeFile(path.join(sampleDir, '01_setup.py'), setupSample);

        // Performance monitoring
        const performanceSample = `"""
성능 모니터링 예제
"""

import os
from datetime import datetime, timedelta
from airis_epm_sdk import create_client, AirisEPMException

client = create_client(api_key=os.getenv('AIRIS_API_KEY'))

def performance_examples():
    """성능 모니터링 예제들"""
    
    try:
        # 1. 성능 메트릭 조회
        print("📊 성능 메트릭 조회...")
        metrics = client.performance.get_metrics(
            timeRange='1h',
            metricType='cpu',
            aggregation='avg'
        )
        print(f"메트릭 결과: {metrics}")
        
        # 2. 메트릭 제출
        print("📤 메트릭 제출...")
        current_time = datetime.now().isoformat()
        
        metrics_data = [
            {
                'timestamp': current_time,
                'metricType': 'cpu_usage',
                'value': 75.5,
                'tags': {
                    'host': 'web-server-01',
                    'region': 'ap-northeast-2',
                    'environment': 'production'
                }
            },
            {
                'timestamp': current_time,
                'metricType': 'memory_usage', 
                'value': 68.2,
                'tags': {
                    'host': 'web-server-01',
                    'region': 'ap-northeast-2',
                    'environment': 'production'
                }
            }
        ]
        
        submit_result = client.performance.submit_metrics(metrics_data)
        print(f"제출 결과: {submit_result}")
        
        # 3. 캐시 통계 조회
        print("💾 캐시 통계 조회...")
        cache_stats = client.performance.get_cache_stats()
        print(f"캐시 통계: {cache_stats}")
        
        # 4. 캐시 데이터 관리
        print("🔄 캐시 데이터 관리...")
        
        # 캐시에 데이터 저장
        user_session_data = {
            'userId': 123,
            'sessionId': 'sess_abc123',
            'loginTime': current_time,
            'preferences': {
                'theme': 'dark',
                'language': 'ko'
            }
        }
        
        client.performance.set_cached_data(
            'user-session', 
            'user-123', 
            user_session_data,
            ttl=3600
        )
        
        # 캐시에서 데이터 조회
        cached_data = client.performance.get_cached_data('user-session', 'user-123')
        print(f"캐시된 데이터: {cached_data}")
        
        # 캐시 무효화
        client.performance.invalidate_cache('user-session', 'user-123')
        print("캐시 무효화 완료")
        
    except AirisEPMException as e:
        print(f"API 오류: {e}")
    except Exception as e:
        print(f"성능 모니터링 예제 실패: {e}")

if __name__ == '__main__':
    performance_examples()`;

        await fs.writeFile(path.join(sampleDir, '02_performance.py'), performanceSample);

        return {
            language: 'python',
            files: ['01_setup.py', '02_performance.py'],
            path: sampleDir
        };
    }

    /**
     * Generate simple samples for other languages
     */
    async generateJavaSamples() {
        const sampleDir = path.join(this.outputDir, 'java');
        
        const javaSample = `/**
 * AIRIS EPM Java SDK 기본 사용법
 */

import com.airis.epm.AirisEPMClient;
import com.airis.epm.models.Metric;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class AirisEPMExample {
    
    public static void main(String[] args) {
        // 클라이언트 초기화
        AirisEPMClient client = new AirisEPMClient.Builder()
            .apiKey(System.getenv("AIRIS_API_KEY"))
            .baseUrl("https://api.airis-epm.com/v1")
            .timeout(30000)
            .build();
        
        try {
            // 연결 테스트
            boolean connected = client.testConnection();
            System.out.println("연결 상태: " + connected);
            
            // 메트릭 제출
            Map<String, String> tags = new HashMap<>();
            tags.put("host", "java-server-01");
            tags.put("region", "ap-northeast-2");
            
            Metric metric = new Metric.Builder()
                .timestamp(System.currentTimeMillis())
                .metricType("cpu_usage")
                .value(75.5)
                .tags(tags)
                .build();
            
            client.performance().submitMetrics(Arrays.asList(metric));
            System.out.println("메트릭 제출 완료");
            
        } catch (Exception e) {
            System.err.println("예제 실행 실패: " + e.getMessage());
        }
    }
}`;

        await fs.writeFile(path.join(sampleDir, 'AirisEPMExample.java'), javaSample);

        return {
            language: 'java',
            files: ['AirisEPMExample.java'],
            path: sampleDir
        };
    }

    async generateCSharpSamples() {
        const sampleDir = path.join(this.outputDir, 'csharp');
        
        const csharpSample = `using System;
using System.Threading.Tasks;
using AirisEPM.SDK;

namespace AirisEPM.Examples
{
    class Program
    {
        static async Task Main(string[] args)
        {
            // 클라이언트 초기화
            var client = new AirisEPMClient(new AirisEPMClientOptions
            {
                ApiKey = Environment.GetEnvironmentVariable("AIRIS_API_KEY"),
                BaseUrl = "https://api.airis-epm.com/v1",
                Timeout = TimeSpan.FromSeconds(30)
            });

            try
            {
                // 연결 테스트
                var connectionResult = await client.TestConnectionAsync();
                Console.WriteLine($"연결 상태: {connectionResult.Success}");

                // 메트릭 제출
                var metrics = new[]
                {
                    new Metric
                    {
                        Timestamp = DateTime.UtcNow,
                        MetricType = "cpu_usage",
                        Value = 75.5,
                        Tags = new Dictionary<string, string>
                        {
                            ["host"] = "csharp-server-01",
                            ["region"] = "ap-northeast-2"
                        }
                    }
                };

                await client.Performance.SubmitMetricsAsync(metrics);
                Console.WriteLine("메트릭 제출 완료");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"예제 실행 실패: {ex.Message}");
            }
        }
    }
}`;

        await fs.writeFile(path.join(sampleDir, 'Program.cs'), csharpSample);

        return {
            language: 'csharp',
            files: ['Program.cs'],
            path: sampleDir
        };
    }

    async generateGoSamples() {
        const sampleDir = path.join(this.outputDir, 'go');
        
        const goSample = `package main

import (
    "fmt"
    "log"
    "os"
    "time"

    "github.com/airis-epm/sdk-go"
)

func main() {
    // 클라이언트 초기화
    client, err := airisepm.NewClient(&airisepm.Config{
        APIKey:  os.Getenv("AIRIS_API_KEY"),
        BaseURL: "https://api.airis-epm.com/v1",
        Timeout: 30 * time.Second,
    })
    if err != nil {
        log.Fatal("클라이언트 초기화 실패:", err)
    }

    // 연결 테스트
    if connected := client.TestConnection(); connected {
        fmt.Println("연결 성공")
    } else {
        fmt.Println("연결 실패")
        return
    }

    // 메트릭 제출
    metrics := []airisepm.Metric{
        {
            Timestamp:  time.Now(),
            MetricType: "cpu_usage",
            Value:      75.5,
            Tags: map[string]string{
                "host":   "go-server-01",
                "region": "ap-northeast-2",
            },
        },
    }

    if err := client.Performance.SubmitMetrics(metrics); err != nil {
        log.Fatal("메트릭 제출 실패:", err)
    }

    fmt.Println("메트릭 제출 완료")
}`;

        await fs.writeFile(path.join(sampleDir, 'main.go'), goSample);

        return {
            language: 'go',
            files: ['main.go'],
            path: sampleDir
        };
    }

    async generatePHPSamples() {
        const sampleDir = path.join(this.outputDir, 'php');
        
        const phpSample = `<?php
require_once 'vendor/autoload.php';

use Airis\\EPM\\AirisEPMClient;

// 클라이언트 초기화
$client = new AirisEPMClient([
    'apiKey' => $_ENV['AIRIS_API_KEY'] ?? 'your-api-key-here',
    'baseUrl' => 'https://api.airis-epm.com/v1',
    'timeout' => 30
]);

try {
    // 연결 테스트
    $connectionResult = $client->testConnection();
    echo "연결 상태: " . ($connectionResult['success'] ? '성공' : '실패') . "\\n";

    // 메트릭 제출
    $metrics = [
        [
            'timestamp' => date('c'),
            'metricType' => 'cpu_usage',
            'value' => 75.5,
            'tags' => [
                'host' => 'php-server-01',
                'region' => 'ap-northeast-2'
            ]
        ]
    ];

    $client->performance()->submitMetrics($metrics);
    echo "메트릭 제출 완료\\n";

} catch (Exception $e) {
    error_log("예제 실행 실패: " . $e->getMessage());
}
?>`;

        await fs.writeFile(path.join(sampleDir, 'example.php'), phpSample);

        return {
            language: 'php',
            files: ['example.php'],
            path: sampleDir
        };
    }

    async generateRubySamples() {
        const sampleDir = path.join(this.outputDir, 'ruby');
        
        const rubySample = `require 'airis_epm_sdk'

# 클라이언트 초기화
client = AirisEPM::Client.new(
  api_key: ENV['AIRIS_API_KEY'] || 'your-api-key-here',
  base_url: 'https://api.airis-epm.com/v1',
  timeout: 30
)

begin
  # 연결 테스트
  connection_result = client.test_connection
  puts "연결 상태: #{connection_result[:success] ? '성공' : '실패'}"

  # 메트릭 제출
  metrics = [
    {
      timestamp: Time.now.iso8601,
      metric_type: 'cpu_usage',
      value: 75.5,
      tags: {
        host: 'ruby-server-01',
        region: 'ap-northeast-2'
      }
    }
  ]

  client.performance.submit_metrics(metrics)
  puts '메트릭 제출 완료'

rescue AirisEPM::Error => e
  puts "예제 실행 실패: #{e.message}"
end`;

        await fs.writeFile(path.join(sampleDir, 'example.rb'), rubySample);

        return {
            language: 'ruby',
            files: ['example.rb'],
            path: sampleDir
        };
    }

    async generateSwiftSamples() {
        const sampleDir = path.join(this.outputDir, 'swift');
        
        const swiftSample = `import Foundation
import AirisEPMSDK

// 클라이언트 초기화
let client = AirisEPMClient(
    apiKey: ProcessInfo.processInfo.environment["AIRIS_API_KEY"] ?? "your-api-key-here",
    baseURL: "https://api.airis-epm.com/v1",
    timeout: 30.0
)

// 연결 테스트
client.testConnection { result in
    switch result {
    case .success(let connectionResult):
        print("연결 상태: \\(connectionResult.success ? "성공" : "실패")")
        
        // 메트릭 제출
        let metrics = [
            Metric(
                timestamp: Date(),
                metricType: "cpu_usage",
                value: 75.5,
                tags: [
                    "host": "swift-server-01",
                    "region": "ap-northeast-2"
                ]
            )
        ]
        
        client.performance.submitMetrics(metrics) { submitResult in
            switch submitResult {
            case .success:
                print("메트릭 제출 완료")
            case .failure(let error):
                print("메트릭 제출 실패: \\(error)")
            }
        }
        
    case .failure(let error):
        print("연결 테스트 실패: \\(error)")
    }
}

RunLoop.main.run()`;

        await fs.writeFile(path.join(sampleDir, 'example.swift'), swiftSample);

        return {
            language: 'swift',
            files: ['example.swift'],
            path: sampleDir
        };
    }

    async generateKotlinSamples() {
        const sampleDir = path.join(this.outputDir, 'kotlin');
        
        const kotlinSample = `import com.airis.epm.AirisEPMClient
import com.airis.epm.models.Metric
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    // 클라이언트 초기화
    val client = AirisEPMClient.Builder()
        .apiKey(System.getenv("AIRIS_API_KEY") ?: "your-api-key-here")
        .baseUrl("https://api.airis-epm.com/v1")
        .timeout(30000)
        .build()

    try {
        // 연결 테스트
        val connectionResult = client.testConnection()
        println("연결 상태: \${if (connectionResult.success) "성공" else "실패"}")

        // 메트릭 제출
        val metrics = listOf(
            Metric(
                timestamp = System.currentTimeMillis(),
                metricType = "cpu_usage",
                value = 75.5,
                tags = mapOf(
                    "host" to "kotlin-server-01",
                    "region" to "ap-northeast-2"
                )
            )
        )

        client.performance.submitMetrics(metrics)
        println("메트릭 제출 완료")

    } catch (e: Exception) {
        println("예제 실행 실패: \${e.message}")
    }
}`;

        await fs.writeFile(path.join(sampleDir, 'Example.kt'), kotlinSample);

        return {
            language: 'kotlin',
            files: ['Example.kt'],
            path: sampleDir
        };
    }

    /**
     * Generate meta files
     */
    async generateMetaFiles(results) {
        // Generate overview README
        const overviewReadme = `# AIRIS EPM 코드 샘플

AIRIS Enterprise Performance Management API를 위한 다양한 프로그래밍 언어별 코드 샘플입니다.

## 지원 언어

${this.languages.map(lang => `- [${lang.charAt(0).toUpperCase() + lang.slice(1)}](./${lang}/)`).join('\n')}

## 샘플 카테고리

### 🚀 기본 설정 및 연결
- 클라이언트 초기화
- API 키 설정
- 연결 테스트

### 📊 성능 모니터링
- 메트릭 조회 및 제출
- 캐시 관리
- 실시간 성능 추적

### 🔍 데이터 품질 관리
- 데이터 검증
- 이상 탐지
- 데이터 정제

### 📈 분석 및 리포팅
- 대시보드 데이터 조회
- 커스텀 리포트 생성
- 분석 결과 시각화

### 🚨 알림 관리
- 알림 규칙 생성
- 알림 상태 관리
- 실시간 알림 처리

### 🔧 GraphQL
- 쿼리, 뮤테이션, 구독
- 복합 데이터 조회
- 실시간 데이터 스트리밍

### 💡 모범 사례
- 에러 처리 및 재시도 로직
- 배치 처리 최적화
- 보안 및 인증 관리

## 빠른 시작

1. 원하는 프로그래밍 언어 디렉토리로 이동
2. 해당 언어의 설치 및 설정 가이드 참조
3. API 키 설정: \`export AIRIS_API_KEY="your-api-key-here"\`
4. 예제 코드 실행

## API 키 획득

1. [AIRIS EPM 개발자 포털](https://developer.airis-epm.com)에 가입
2. 새 애플리케이션 생성
3. API 키 발급 및 복사
4. 환경 변수 설정

## 지원

- 📚 [API 문서](https://docs.airis-epm.com)
- 🛠️ [SDK 다운로드](https://github.com/airis-epm/sdks)
- 💬 [커뮤니티 포럼](https://community.airis-epm.com)
- 📧 [기술 지원](mailto:support@airis-epm.com)

생성일: ${new Date().toISOString()}
`;

        await fs.writeFile(path.join(this.outputDir, 'README.md'), overviewReadme);

        // Generate samples report
        const report = {
            generated_at: new Date().toISOString(),
            languages: Object.keys(results).length,
            total_samples: Object.values(results).reduce((sum, lang) => sum + lang.files.length, 0),
            samples_by_language: results,
            categories: [
                'setup',
                'performance',
                'data-quality',
                'analytics',
                'alerts',
                'graphql',
                'best-practices'
            ]
        };

        await fs.writeFile(
            path.join(this.outputDir, 'samples-report.json'),
            JSON.stringify(report, null, 2)
        );

        console.log(`✅ Generated ${report.total_samples} code samples in ${report.languages} languages`);
    }
}

export default CodeSamplesGenerator;