/**
 * AI 모델 관리 API 핸들러
 * AIRIS-MON AI 모델 라이프사이클 관리를 위한 RESTful API
 * 
 * ===== 지원 엔드포인트 =====
 * 
 * 모델 관리:
 * - GET /list - 모델 목록 조회 (프로바이더 필터링 지원)
 * - GET /:id - 특정 모델 상세 정보 및 이력
 * - POST /:id/start - 모델 시작/활성화
 * - POST /:id/stop - 모델 중지/비활성화
 * - PUT /:id/config - 모델 설정 업데이트
 * 
 * 모델 테스팅:
 * - POST /:id/test - 인터랙티브 모델 테스팅
 * - POST /batch-test - 배치 테스팅 (다중 모델)
 * - POST /compare - 모델 성능 비교
 * - GET /:id/test-history - 테스팅 이력 조회
 * 
 * 성능 및 분석:
 * - GET /:id/metrics - 실시간 성능 메트릭
 * - GET /:id/performance-history - 성능 이력 데이터
 * - GET /usage-analytics - 전체 사용량 분석
 * - GET /cost-tracking - 비용 추적 (프로바이더별)
 * 
 * 배포 관리:
 * - POST /:id/deploy - 모델 배포 (환경별)
 * - POST /:id/rollback - 이전 버전 롤백
 * - GET /:id/deployment-status - 배포 파이프라인 상태
 * - POST /:id/scale - 인스턴스 자동 스케일링
 * 
 * 프로바이더 관리:
 * - GET /providers/status - 모든 프로바이더 상태
 * - GET /providers/ollama - Ollama 프로바이더 상세
 * - GET /providers/gemini - Gemini 프로바이더 상세
 * - POST /providers/health-check - 수동 헬스체크
 * 
 * 기능: Korean 응답, 실시간 데이터, 배포 시뮬레이션, 비용 추적
 */

const express = require('express');
const router = express.Router();

// 모델 데이터 저장소 (실제 환경에서는 데이터베이스 사용)
let modelsDatabase = [
    {
        id: 'llama2-korean',
        name: 'Llama 2 Korean',
        provider: 'ollama',
        status: 'active',
        version: '13B',
        accuracy: 92.5,
        responseTime: 245,
        throughput: 156,
        resourceUsage: 67,
        availability: 99.2,
        requests24h: 2847,
        cost24h: 12.45,
        environment: 'production',
        instances: 2,
        autoScale: true,
        lastUpdated: new Date().toISOString(),
        metadata: {
            modelType: 'language',
            parameters: '13B',
            contextLength: 4096,
            trainingData: 'Korean corpus + LLaMA base',
            deployment: 'local',
            deploymentStatus: 'deployed',
            healthStatus: 'healthy'
        }
    },
    {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        provider: 'gemini',
        status: 'active',
        version: '1.0',
        accuracy: 95.8,
        responseTime: 128,
        throughput: 342,
        resourceUsage: 23,
        availability: 99.9,
        requests24h: 5432,
        cost24h: 28.76,
        environment: 'production',
        instances: 1,
        autoScale: false,
        lastUpdated: new Date().toISOString(),
        metadata: {
            modelType: 'multimodal',
            parameters: 'Unknown',
            contextLength: 32768,
            trainingData: 'Google proprietary',
            deployment: 'cloud',
            deploymentStatus: 'deployed',
            healthStatus: 'healthy'
        }
    },
    {
        id: 'mistral-7b',
        name: 'Mistral 7B',
        provider: 'ollama',
        status: 'loading',
        version: '7B',
        accuracy: 89.3,
        responseTime: 189,
        throughput: 198,
        resourceUsage: 45,
        availability: 98.5,
        requests24h: 1623,
        cost24h: 8.23,
        environment: 'staging',
        instances: 1,
        autoScale: false,
        lastUpdated: new Date().toISOString(),
        metadata: {
            modelType: 'language',
            parameters: '7B',
            contextLength: 8192,
            trainingData: 'Mistral base model',
            deployment: 'local',
            deploymentStatus: 'deploying',
            healthStatus: 'degraded'
        }
    },
    {
        id: 'custom-bert',
        name: 'Custom BERT Korean',
        provider: 'custom',
        status: 'inactive',
        version: 'v2.1',
        accuracy: 87.2,
        responseTime: 95,
        throughput: 89,
        resourceUsage: 78,
        availability: 95.3,
        requests24h: 456,
        cost24h: 3.21,
        environment: 'development',
        instances: 0,
        autoScale: false,
        lastUpdated: new Date().toISOString(),
        metadata: {
            modelType: 'embedding',
            parameters: '110M',
            contextLength: 512,
            trainingData: 'Korean BERT corpus',
            deployment: 'local',
            deploymentStatus: 'stopped',
            healthStatus: 'offline'
        }
    },
    {
        id: 'gemini-flash',
        name: 'Gemini Flash',
        provider: 'gemini',
        status: 'active',
        version: '1.5',
        accuracy: 93.2,
        responseTime: 85,
        throughput: 456,
        resourceUsage: 18,
        availability: 99.7,
        requests24h: 8934,
        cost24h: 15.67,
        environment: 'production',
        instances: 3,
        autoScale: true,
        lastUpdated: new Date().toISOString(),
        metadata: {
            modelType: 'language',
            parameters: 'Optimized',
            contextLength: 16384,
            trainingData: 'Google optimized corpus',
            deployment: 'cloud',
            deploymentStatus: 'deployed',
            healthStatus: 'healthy'
        }
    },
    {
        id: 'ollama-codellama',
        name: 'Code Llama 13B',
        provider: 'ollama',
        status: 'error',
        version: '13B',
        accuracy: 88.7,
        responseTime: 312,
        throughput: 145,
        resourceUsage: 89,
        availability: 92.1,
        requests24h: 234,
        cost24h: 1.34,
        environment: 'development',
        instances: 0,
        autoScale: false,
        lastUpdated: new Date().toISOString(),
        metadata: {
            modelType: 'code',
            parameters: '13B',
            contextLength: 4096,
            trainingData: 'Code repository corpus',
            deployment: 'local',
            deploymentStatus: 'failed',
            healthStatus: 'offline'
        }
    }
];

// 테스트 이력 데이터 저장소
let testHistory = {};

// 배포 이력 데이터 저장소
let deploymentHistory = {};

// 프로바이더 상태 데이터
let providerStatus = {
    ollama: {
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        responseTime: 145,
        availability: 98.2,
        activeModels: 2,
        totalModels: 3,
        version: '0.1.47',
        endpoint: 'http://localhost:11434'
    },
    gemini: {
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        responseTime: 89,
        availability: 99.8,
        activeModels: 2,
        totalModels: 2,
        version: '1.5',
        endpoint: 'https://generativelanguage.googleapis.com'
    },
    custom: {
        status: 'degraded',
        lastCheck: new Date().toISOString(),
        responseTime: 234,
        availability: 95.3,
        activeModels: 0,
        totalModels: 2,
        version: 'v2.1',
        endpoint: 'http://internal-api:8080'
    }
};

// 성능 이력 데이터
const performanceHistory = {};

// 모델 목록 조회
router.get('/list', (req, res) => {
    try {
        const { provider, status } = req.query;
        
        let filteredModels = [...modelsDatabase];
        
        if (provider && provider !== 'all') {
            filteredModels = filteredModels.filter(model => model.provider === provider);
        }
        
        if (status) {
            filteredModels = filteredModels.filter(model => model.status === status);
        }
        
        res.json(filteredModels);
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ error: '모델 목록 조회 실패' });
    }
});

// 특정 모델 상세 정보 조회
router.get('/:modelId', (req, res) => {
    try {
        const { modelId } = req.params;
        const model = modelsDatabase.find(m => m.id === modelId);
        
        if (!model) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        // 성능 이력 데이터 추가
        const history = performanceHistory[modelId] || generateSampleHistory();
        
        res.json({
            ...model,
            performanceHistory: history
        });
    } catch (error) {
        console.error('Error fetching model details:', error);
        res.status(500).json({ error: '모델 상세 정보 조회 실패' });
    }
});

// 모델 시작
router.post('/:modelId/start', async (req, res) => {
    try {
        const { modelId } = req.params;
        const modelIndex = modelsDatabase.findIndex(m => m.id === modelId);
        
        if (modelIndex === -1) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        // 모델 시작 시뮬레이션
        modelsDatabase[modelIndex].status = 'loading';
        modelsDatabase[modelIndex].lastUpdated = new Date().toISOString();
        
        // 2초 후 활성 상태로 변경 (실제로는 모델 로딩 시간)
        setTimeout(() => {
            const currentModelIndex = modelsDatabase.findIndex(m => m.id === modelId);
            if (currentModelIndex !== -1) {
                modelsDatabase[currentModelIndex].status = 'active';
                modelsDatabase[currentModelIndex].lastUpdated = new Date().toISOString();
            }
        }, 2000);
        
        res.json({ 
            success: true, 
            message: '모델 시작 요청이 처리되었습니다',
            modelId: modelId
        });
    } catch (error) {
        console.error('Error starting model:', error);
        res.status(500).json({ error: '모델 시작 실패' });
    }
});

// 모델 중지
router.post('/:modelId/stop', async (req, res) => {
    try {
        const { modelId } = req.params;
        const modelIndex = modelsDatabase.findIndex(m => m.id === modelId);
        
        if (modelIndex === -1) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        modelsDatabase[modelIndex].status = 'inactive';
        modelsDatabase[modelIndex].lastUpdated = new Date().toISOString();
        
        res.json({ 
            success: true, 
            message: '모델이 중지되었습니다',
            modelId: modelId
        });
    } catch (error) {
        console.error('Error stopping model:', error);
        res.status(500).json({ error: '모델 중지 실패' });
    }
});

// 모델 테스트
router.post('/:modelId/test', async (req, res) => {
    try {
        const { modelId } = req.params;
        const { prompt, parameters = {} } = req.body;
        
        const model = modelsDatabase.find(m => m.id === modelId);
        
        if (!model) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        if (model.status !== 'active') {
            return res.status(400).json({ error: '모델이 활성 상태가 아닙니다' });
        }
        
        if (!prompt) {
            return res.status(400).json({ error: '프롬프트가 필요합니다' });
        }
        
        // 테스트 응답 시뮬레이션
        const startTime = Date.now();
        
        // 모델별 응답 시뮬레이션
        let response = '';
        let confidence = 0;
        
        switch (model.provider) {
            case 'ollama':
                response = `[${model.name}] ${prompt}에 대한 응답입니다. 로컬에서 실행되는 Ollama 모델의 테스트 응답입니다.`;
                confidence = Math.floor(Math.random() * 20) + 80; // 80-99%
                break;
            case 'gemini':
                response = `[${model.name}] Google Gemini의 고급 AI 기능을 활용한 응답입니다: ${prompt}`;
                confidence = Math.floor(Math.random() * 10) + 90; // 90-99%
                break;
            case 'custom':
                response = `[${model.name}] 커스텀 모델의 특화된 응답입니다. 프롬프트: "${prompt}"`;
                confidence = Math.floor(Math.random() * 30) + 70; // 70-99%
                break;
            default:
                response = `기본 모델 응답: ${prompt}`;
                confidence = 85;
        }
        
        const responseTime = Date.now() - startTime + Math.floor(Math.random() * model.responseTime);
        const tokens = Math.floor(response.length / 4); // 대략적인 토큰 수
        
        // 요청 카운트 업데이트
        const modelIndex = modelsDatabase.findIndex(m => m.id === modelId);
        if (modelIndex !== -1) {
            modelsDatabase[modelIndex].requests24h += 1;
        }
        
        res.json({
            success: true,
            response: response,
            responseTime: responseTime,
            tokens: tokens,
            confidence: confidence,
            model: model.name,
            provider: model.provider,
            parameters: parameters,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error testing model:', error);
        res.status(500).json({ error: '모델 테스트 실패' });
    }
});

// 모델 성능 메트릭 조회
router.get('/:modelId/metrics', (req, res) => {
    try {
        const { modelId } = req.params;
        const { timeRange = '1h' } = req.query;
        
        const model = modelsDatabase.find(m => m.id === modelId);
        
        if (!model) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        // 시간 범위별 메트릭 데이터 생성
        const metrics = generateMetricsData(model, timeRange);
        
        res.json({
            modelId: modelId,
            timeRange: timeRange,
            metrics: metrics,
            summary: {
                avgResponseTime: model.responseTime,
                totalRequests: model.requests24h,
                accuracy: model.accuracy,
                availability: model.availability,
                resourceUsage: model.resourceUsage
            }
        });
        
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: '메트릭 조회 실패' });
    }
});

// 모델 배치 테스트
router.post('/batch-test', async (req, res) => {
    try {
        const { modelIds, testCases } = req.body;
        
        if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
            return res.status(400).json({ error: '테스트할 모델 ID가 필요합니다' });
        }
        
        const activeModels = modelsDatabase.filter(m => 
            modelIds.includes(m.id) && m.status === 'active'
        );
        
        if (activeModels.length === 0) {
            return res.status(400).json({ error: '활성 상태의 모델이 없습니다' });
        }
        
        // 배치 테스트 시뮬레이션
        const results = activeModels.map(model => ({
            modelId: model.id,
            modelName: model.name,
            provider: model.provider,
            testResults: {
                avgResponseTime: model.responseTime + Math.floor(Math.random() * 50),
                successRate: Math.floor(Math.random() * 10) + 90,
                accuracy: model.accuracy + Math.floor(Math.random() * 6) - 3,
                throughput: model.throughput + Math.floor(Math.random() * 20) - 10
            }
        }));
        
        res.json({
            success: true,
            message: '배치 테스트가 완료되었습니다',
            testId: generateTestId(),
            testedModels: activeModels.length,
            results: results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error running batch test:', error);
        res.status(500).json({ error: '배치 테스트 실패' });
    }
});

// 모델 비교
router.post('/compare', (req, res) => {
    try {
        const { modelIds } = req.body;
        
        if (!modelIds || !Array.isArray(modelIds) || modelIds.length < 2) {
            return res.status(400).json({ error: '비교할 모델이 최소 2개 필요합니다' });
        }
        
        const models = modelsDatabase.filter(m => modelIds.includes(m.id));
        
        if (models.length < 2) {
            return res.status(400).json({ error: '유효한 모델이 부족합니다' });
        }
        
        const comparison = {
            models: models.map(model => ({
                id: model.id,
                name: model.name,
                provider: model.provider,
                metrics: {
                    responseTime: model.responseTime,
                    accuracy: model.accuracy,
                    throughput: model.throughput,
                    resourceUsage: model.resourceUsage,
                    availability: model.availability
                }
            })),
            analysis: {
                fastest: models.reduce((min, model) => 
                    model.responseTime < min.responseTime ? model : min
                ).name,
                mostAccurate: models.reduce((max, model) => 
                    model.accuracy > max.accuracy ? model : max
                ).name,
                mostEfficient: models.reduce((min, model) => 
                    model.resourceUsage < min.resourceUsage ? model : min
                ).name
            }
        };
        
        res.json(comparison);
        
    } catch (error) {
        console.error('Error comparing models:', error);
        res.status(500).json({ error: '모델 비교 실패' });
    }
});

// ===== 새로운 API 엔드포인트들 =====

// 모델 설정 업데이트
router.put('/:modelId/config', async (req, res) => {
    try {
        const { modelId } = req.params;
        const { config } = req.body;
        
        const modelIndex = modelsDatabase.findIndex(m => m.id === modelId);
        
        if (modelIndex === -1) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        // 설정 업데이트
        if (config.autoScale !== undefined) {
            modelsDatabase[modelIndex].autoScale = config.autoScale;
        }
        if (config.instances !== undefined) {
            modelsDatabase[modelIndex].instances = config.instances;
        }
        if (config.environment !== undefined) {
            modelsDatabase[modelIndex].environment = config.environment;
        }
        
        modelsDatabase[modelIndex].lastUpdated = new Date().toISOString();
        
        res.json({
            success: true,
            message: '모델 설정이 업데이트되었습니다',
            model: modelsDatabase[modelIndex]
        });
        
    } catch (error) {
        console.error('Error updating model config:', error);
        res.status(500).json({ error: '모델 설정 업데이트 실패' });
    }
});

// 테스트 이력 조회
router.get('/:modelId/test-history', (req, res) => {
    try {
        const { modelId } = req.params;
        const { limit = 20, offset = 0 } = req.query;
        
        const model = modelsDatabase.find(m => m.id === modelId);
        
        if (!model) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        // 테스트 이력 생성 (실제로는 데이터베이스에서 조회)
        const history = generateTestHistory(modelId, parseInt(limit), parseInt(offset));
        
        res.json({
            modelId: modelId,
            total: 150, // 전체 테스트 수
            limit: parseInt(limit),
            offset: parseInt(offset),
            tests: history
        });
        
    } catch (error) {
        console.error('Error fetching test history:', error);
        res.status(500).json({ error: '테스트 이력 조회 실패' });
    }
});

// 성능 이력 조회
router.get('/:modelId/performance-history', (req, res) => {
    try {
        const { modelId } = req.params;
        const { timeRange = '7d', metric = 'all' } = req.query;
        
        const model = modelsDatabase.find(m => m.id === modelId);
        
        if (!model) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        const history = generatePerformanceHistory(model, timeRange, metric);
        
        res.json({
            modelId: modelId,
            timeRange: timeRange,
            metric: metric,
            data: history
        });
        
    } catch (error) {
        console.error('Error fetching performance history:', error);
        res.status(500).json({ error: '성능 이력 조회 실패' });
    }
});

// 전체 모델 사용량 분석
router.get('/usage-analytics', (req, res) => {
    try {
        const { timeRange = '24h', groupBy = 'model' } = req.query;
        
        const analytics = generateUsageAnalytics(timeRange, groupBy);
        
        res.json({
            timeRange: timeRange,
            groupBy: groupBy,
            generatedAt: new Date().toISOString(),
            analytics: analytics
        });
        
    } catch (error) {
        console.error('Error fetching usage analytics:', error);
        res.status(500).json({ error: '사용량 분석 조회 실패' });
    }
});

// 비용 추적
router.get('/cost-tracking', (req, res) => {
    try {
        const { timeRange = '30d', provider } = req.query;
        
        let models = [...modelsDatabase];
        if (provider && provider !== 'all') {
            models = models.filter(m => m.provider === provider);
        }
        
        const costData = generateCostTracking(models, timeRange);
        
        res.json({
            timeRange: timeRange,
            provider: provider || 'all',
            generatedAt: new Date().toISOString(),
            costData: costData
        });
        
    } catch (error) {
        console.error('Error fetching cost tracking:', error);
        res.status(500).json({ error: '비용 추적 조회 실패' });
    }
});

// 모델 배포
router.post('/:modelId/deploy', async (req, res) => {
    try {
        const { modelId } = req.params;
        const { environment = 'production', instances = 1, config = {} } = req.body;
        
        const modelIndex = modelsDatabase.findIndex(m => m.id === modelId);
        
        if (modelIndex === -1) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        const deploymentId = generateDeploymentId();
        
        // 배포 상태 업데이트
        modelsDatabase[modelIndex].metadata.deploymentStatus = 'deploying';
        modelsDatabase[modelIndex].environment = environment;
        modelsDatabase[modelIndex].instances = instances;
        modelsDatabase[modelIndex].lastUpdated = new Date().toISOString();
        
        // 배포 이력 저장
        if (!deploymentHistory[modelId]) {
            deploymentHistory[modelId] = [];
        }
        
        deploymentHistory[modelId].push({
            id: deploymentId,
            modelId: modelId,
            environment: environment,
            instances: instances,
            config: config,
            status: 'deploying',
            startTime: new Date().toISOString(),
            endTime: null,
            logs: ['배포 시작됨', '환경 준비 중...']
        });
        
        // 3초 후 배포 완료 시뮬레이션
        setTimeout(() => {
            const currentModelIndex = modelsDatabase.findIndex(m => m.id === modelId);
            if (currentModelIndex !== -1) {
                modelsDatabase[currentModelIndex].metadata.deploymentStatus = 'deployed';
                modelsDatabase[currentModelIndex].status = 'active';
                
                // 배포 이력 업데이트
                const deployment = deploymentHistory[modelId].find(d => d.id === deploymentId);
                if (deployment) {
                    deployment.status = 'deployed';
                    deployment.endTime = new Date().toISOString();
                    deployment.logs.push('배포 완료');
                }
            }
        }, 3000);
        
        res.json({
            success: true,
            message: '모델 배포가 시작되었습니다',
            deploymentId: deploymentId,
            modelId: modelId,
            environment: environment
        });
        
    } catch (error) {
        console.error('Error deploying model:', error);
        res.status(500).json({ error: '모델 배포 실패' });
    }
});

// 모델 롤백
router.post('/:modelId/rollback', async (req, res) => {
    try {
        const { modelId } = req.params;
        const { version } = req.body;
        
        const modelIndex = modelsDatabase.findIndex(m => m.id === modelId);
        
        if (modelIndex === -1) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        // 롤백 시뮬레이션
        const previousVersion = modelsDatabase[modelIndex].version;
        const rollbackVersion = version || 'previous';
        
        modelsDatabase[modelIndex].metadata.deploymentStatus = 'rolling-back';
        modelsDatabase[modelIndex].lastUpdated = new Date().toISOString();
        
        // 2초 후 롤백 완료
        setTimeout(() => {
            const currentModelIndex = modelsDatabase.findIndex(m => m.id === modelId);
            if (currentModelIndex !== -1) {
                modelsDatabase[currentModelIndex].metadata.deploymentStatus = 'deployed';
                modelsDatabase[currentModelIndex].version = rollbackVersion;
            }
        }, 2000);
        
        res.json({
            success: true,
            message: '모델 롤백이 시작되었습니다',
            modelId: modelId,
            fromVersion: previousVersion,
            toVersion: rollbackVersion
        });
        
    } catch (error) {
        console.error('Error rolling back model:', error);
        res.status(500).json({ error: '모델 롤백 실패' });
    }
});

// 배포 상태 조회
router.get('/:modelId/deployment-status', (req, res) => {
    try {
        const { modelId } = req.params;
        
        const model = modelsDatabase.find(m => m.id === modelId);
        
        if (!model) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        const deployments = deploymentHistory[modelId] || [];
        const latestDeployment = deployments[deployments.length - 1];
        
        res.json({
            modelId: modelId,
            currentStatus: model.metadata.deploymentStatus,
            environment: model.environment,
            instances: model.instances,
            latestDeployment: latestDeployment,
            deploymentHistory: deployments.slice(-5) // 최근 5개
        });
        
    } catch (error) {
        console.error('Error fetching deployment status:', error);
        res.status(500).json({ error: '배포 상태 조회 실패' });
    }
});

// 모델 스케일링
router.post('/:modelId/scale', async (req, res) => {
    try {
        const { modelId } = req.params;
        const { instances, autoScale = false } = req.body;
        
        const modelIndex = modelsDatabase.findIndex(m => m.id === modelId);
        
        if (modelIndex === -1) {
            return res.status(404).json({ error: '모델을 찾을 수 없습니다' });
        }
        
        if (!instances || instances < 0) {
            return res.status(400).json({ error: '유효한 인스턴스 수가 필요합니다' });
        }
        
        const currentInstances = modelsDatabase[modelIndex].instances;
        
        modelsDatabase[modelIndex].instances = instances;
        modelsDatabase[modelIndex].autoScale = autoScale;
        modelsDatabase[modelIndex].lastUpdated = new Date().toISOString();
        
        res.json({
            success: true,
            message: '모델 스케일링이 완료되었습니다',
            modelId: modelId,
            fromInstances: currentInstances,
            toInstances: instances,
            autoScale: autoScale
        });
        
    } catch (error) {
        console.error('Error scaling model:', error);
        res.status(500).json({ error: '모델 스케일링 실패' });
    }
});

// 모든 프로바이더 상태 조회
router.get('/providers/status', (req, res) => {
    try {
        // 실시간 상태 업데이트 시뮬레이션
        Object.keys(providerStatus).forEach(provider => {
            providerStatus[provider].lastCheck = new Date().toISOString();
            providerStatus[provider].responseTime += Math.floor(Math.random() * 20) - 10;
            providerStatus[provider].availability = Math.max(90, 
                providerStatus[provider].availability + (Math.random() - 0.5) * 2
            );
        });
        
        res.json({
            providers: providerStatus,
            lastUpdated: new Date().toISOString(),
            summary: {
                totalProviders: Object.keys(providerStatus).length,
                healthyProviders: Object.values(providerStatus).filter(p => p.status === 'healthy').length,
                degradedProviders: Object.values(providerStatus).filter(p => p.status === 'degraded').length,
                offlineProviders: Object.values(providerStatus).filter(p => p.status === 'offline').length
            }
        });
        
    } catch (error) {
        console.error('Error fetching provider status:', error);
        res.status(500).json({ error: '프로바이더 상태 조회 실패' });
    }
});

// Ollama 프로바이더 상세 상태
router.get('/providers/ollama', (req, res) => {
    try {
        const ollamaModels = modelsDatabase.filter(m => m.provider === 'ollama');
        
        res.json({
            provider: 'ollama',
            status: providerStatus.ollama,
            models: ollamaModels,
            systemInfo: {
                version: providerStatus.ollama.version,
                endpoint: providerStatus.ollama.endpoint,
                totalModels: ollamaModels.length,
                activeModels: ollamaModels.filter(m => m.status === 'active').length,
                loadingModels: ollamaModels.filter(m => m.status === 'loading').length,
                errorModels: ollamaModels.filter(m => m.status === 'error').length
            }
        });
        
    } catch (error) {
        console.error('Error fetching Ollama status:', error);
        res.status(500).json({ error: 'Ollama 상태 조회 실패' });
    }
});

// Gemini 프로바이더 상세 상태
router.get('/providers/gemini', (req, res) => {
    try {
        const geminiModels = modelsDatabase.filter(m => m.provider === 'gemini');
        
        res.json({
            provider: 'gemini',
            status: providerStatus.gemini,
            models: geminiModels,
            systemInfo: {
                version: providerStatus.gemini.version,
                endpoint: providerStatus.gemini.endpoint,
                totalModels: geminiModels.length,
                activeModels: geminiModels.filter(m => m.status === 'active').length,
                quotas: {
                    daily: {
                        used: 15420,
                        limit: 50000,
                        remaining: 34580
                    },
                    monthly: {
                        used: 342156,
                        limit: 1000000,
                        remaining: 657844
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching Gemini status:', error);
        res.status(500).json({ error: 'Gemini 상태 조회 실패' });
    }
});

// 프로바이더 헬스체크
router.post('/providers/health-check', async (req, res) => {
    try {
        const { provider } = req.body;
        
        if (provider && !providerStatus[provider]) {
            return res.status(404).json({ error: '프로바이더를 찾을 수 없습니다' });
        }
        
        const checkProviders = provider ? [provider] : Object.keys(providerStatus);
        const results = {};
        
        for (const prov of checkProviders) {
            // 헬스체크 시뮬레이션
            const isHealthy = Math.random() > 0.1; // 90% 확률로 정상
            
            results[prov] = {
                status: isHealthy ? 'healthy' : 'degraded',
                responseTime: Math.floor(Math.random() * 200) + 50,
                lastCheck: new Date().toISOString(),
                checks: {
                    connectivity: isHealthy,
                    authentication: isHealthy,
                    quota: Math.random() > 0.05, // 95% 확률로 정상
                    performance: Math.random() > 0.2 // 80% 확률로 정상
                }
            };
            
            // 상태 업데이트
            providerStatus[prov] = {
                ...providerStatus[prov],
                ...results[prov]
            };
        }
        
        res.json({
            success: true,
            message: '헬스체크가 완료되었습니다',
            results: results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error running health check:', error);
        res.status(500).json({ error: '헬스체크 실행 실패' });
    }
});

// 헬퍼 함수들

function generateSampleHistory() {
    const now = new Date();
    const history = [];
    
    for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
        history.push({
            timestamp: timestamp.toISOString(),
            responseTime: Math.floor(Math.random() * 200) + 100,
            throughput: Math.floor(Math.random() * 100) + 50,
            accuracy: Math.floor(Math.random() * 10) + 85,
            resourceUsage: Math.floor(Math.random() * 40) + 30
        });
    }
    
    return history;
}

function generateMetricsData(model, timeRange) {
    const now = new Date();
    const intervals = timeRange === '1h' ? 12 : timeRange === '1d' ? 24 : 168; // 5분, 1시간, 1시간 간격
    const intervalMs = timeRange === '1h' ? 5 * 60 * 1000 : timeRange === '1d' ? 60 * 60 * 1000 : 60 * 60 * 1000;
    
    const metrics = [];
    
    for (let i = intervals - 1; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * intervalMs);
        metrics.push({
            timestamp: timestamp.toISOString(),
            responseTime: model.responseTime + Math.floor(Math.random() * 100) - 50,
            requests: Math.floor(Math.random() * 20) + 5,
            errors: Math.floor(Math.random() * 3),
            cpuUsage: model.resourceUsage + Math.floor(Math.random() * 20) - 10,
            memoryUsage: Math.floor(Math.random() * 30) + 40
        });
    }
    
    return metrics;
}

function generateTestId() {
    return 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateDeploymentId() {
    return 'deploy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateTestHistory(modelId, limit, offset) {
    const tests = [];
    const now = new Date();
    
    for (let i = 0; i < limit; i++) {
        const testTime = new Date(now.getTime() - (offset + i) * 60 * 60 * 1000);
        const success = Math.random() > 0.1; // 90% 성공률
        
        tests.push({
            id: generateTestId(),
            modelId: modelId,
            prompt: `테스트 프롬프트 ${offset + i + 1}`,
            response: success ? `테스트 응답 ${offset + i + 1}` : null,
            responseTime: Math.floor(Math.random() * 500) + 100,
            tokens: Math.floor(Math.random() * 100) + 20,
            confidence: success ? Math.floor(Math.random() * 20) + 80 : 0,
            success: success,
            errorMessage: success ? null : '모델 응답 오류',
            timestamp: testTime.toISOString(),
            parameters: {
                temperature: Math.random(),
                maxTokens: Math.floor(Math.random() * 1000) + 100
            }
        });
    }
    
    return tests;
}

function generatePerformanceHistory(model, timeRange, metric) {
    const now = new Date();
    const intervals = timeRange === '1h' ? 12 : timeRange === '1d' ? 24 : timeRange === '7d' ? 168 : 720; // 5분, 1시간, 1시간, 1시간 간격
    const intervalMs = timeRange === '1h' ? 5 * 60 * 1000 : 60 * 60 * 1000;
    
    const data = [];
    
    for (let i = intervals - 1; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * intervalMs);
        const dataPoint = {
            timestamp: timestamp.toISOString()
        };
        
        if (metric === 'all' || metric === 'responseTime') {
            dataPoint.responseTime = model.responseTime + Math.floor(Math.random() * 100) - 50;
        }
        if (metric === 'all' || metric === 'throughput') {
            dataPoint.throughput = model.throughput + Math.floor(Math.random() * 50) - 25;
        }
        if (metric === 'all' || metric === 'accuracy') {
            dataPoint.accuracy = Math.max(0, Math.min(100, model.accuracy + Math.floor(Math.random() * 10) - 5));
        }
        if (metric === 'all' || metric === 'resourceUsage') {
            dataPoint.resourceUsage = Math.max(0, Math.min(100, model.resourceUsage + Math.floor(Math.random() * 20) - 10));
        }
        if (metric === 'all' || metric === 'requests') {
            dataPoint.requests = Math.floor(Math.random() * 20) + 1;
        }
        if (metric === 'all' || metric === 'errors') {
            dataPoint.errors = Math.floor(Math.random() * 3);
        }
        
        data.push(dataPoint);
    }
    
    return data;
}

function generateUsageAnalytics(timeRange, groupBy) {
    const analytics = {
        summary: {
            totalRequests: 0,
            totalCost: 0,
            avgResponseTime: 0,
            totalErrors: 0
        },
        breakdown: []
    };
    
    if (groupBy === 'model') {
        modelsDatabase.forEach(model => {
            const requests = Math.floor(Math.random() * 1000) + 100;
            const cost = requests * 0.002 + Math.random() * 5;
            const errors = Math.floor(requests * 0.05);
            
            analytics.breakdown.push({
                id: model.id,
                name: model.name,
                provider: model.provider,
                requests: requests,
                cost: parseFloat(cost.toFixed(2)),
                avgResponseTime: model.responseTime + Math.floor(Math.random() * 50) - 25,
                errors: errors,
                successRate: parseFloat(((requests - errors) / requests * 100).toFixed(1))
            });
            
            analytics.summary.totalRequests += requests;
            analytics.summary.totalCost += cost;
            analytics.summary.totalErrors += errors;
        });
    } else if (groupBy === 'provider') {
        const providers = [...new Set(modelsDatabase.map(m => m.provider))];
        
        providers.forEach(provider => {
            const providerModels = modelsDatabase.filter(m => m.provider === provider);
            const requests = providerModels.reduce((sum, model) => sum + Math.floor(Math.random() * 1000) + 100, 0);
            const cost = requests * 0.002 + Math.random() * 10;
            const errors = Math.floor(requests * 0.03);
            
            analytics.breakdown.push({
                provider: provider,
                modelCount: providerModels.length,
                requests: requests,
                cost: parseFloat(cost.toFixed(2)),
                avgResponseTime: Math.floor(providerModels.reduce((sum, m) => sum + m.responseTime, 0) / providerModels.length),
                errors: errors,
                successRate: parseFloat(((requests - errors) / requests * 100).toFixed(1))
            });
            
            analytics.summary.totalRequests += requests;
            analytics.summary.totalCost += cost;
            analytics.summary.totalErrors += errors;
        });
    }
    
    analytics.summary.totalCost = parseFloat(analytics.summary.totalCost.toFixed(2));
    analytics.summary.avgResponseTime = analytics.breakdown.length > 0 ? 
        Math.floor(analytics.breakdown.reduce((sum, item) => sum + item.avgResponseTime, 0) / analytics.breakdown.length) : 0;
    
    return analytics;
}

function generateCostTracking(models, timeRange) {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 30;
    const now = new Date();
    
    const costData = {
        summary: {
            totalCost: 0,
            avgDailyCost: 0,
            costByProvider: {},
            costByModel: {}
        },
        timeSeries: [],
        breakdown: {
            byProvider: [],
            byModel: []
        }
    };
    
    // 시계열 데이터 생성
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dailyCost = models.reduce((sum, model) => {
            const baseCost = model.cost24h || 5;
            const variation = baseCost * (Math.random() * 0.4 - 0.2); // ±20% 변동
            return sum + Math.max(0, baseCost + variation);
        }, 0);
        
        costData.timeSeries.push({
            date: date.toISOString().split('T')[0],
            cost: parseFloat(dailyCost.toFixed(2))
        });
        
        costData.summary.totalCost += dailyCost;
    }
    
    // 프로바이더별 비용
    const providers = [...new Set(models.map(m => m.provider))];
    providers.forEach(provider => {
        const providerModels = models.filter(m => m.provider === provider);
        const providerCost = providerModels.reduce((sum, model) => sum + (model.cost24h || 5) * days, 0);
        
        costData.summary.costByProvider[provider] = parseFloat(providerCost.toFixed(2));
        costData.breakdown.byProvider.push({
            provider: provider,
            cost: parseFloat(providerCost.toFixed(2)),
            percentage: parseFloat((providerCost / costData.summary.totalCost * 100).toFixed(1))
        });
    });
    
    // 모델별 비용
    models.forEach(model => {
        const modelCost = (model.cost24h || 5) * days;
        costData.summary.costByModel[model.id] = parseFloat(modelCost.toFixed(2));
        costData.breakdown.byModel.push({
            modelId: model.id,
            modelName: model.name,
            provider: model.provider,
            cost: parseFloat(modelCost.toFixed(2)),
            percentage: parseFloat((modelCost / costData.summary.totalCost * 100).toFixed(1))
        });
    });
    
    costData.summary.totalCost = parseFloat(costData.summary.totalCost.toFixed(2));
    costData.summary.avgDailyCost = parseFloat((costData.summary.totalCost / days).toFixed(2));
    
    return costData;
}

module.exports = router;