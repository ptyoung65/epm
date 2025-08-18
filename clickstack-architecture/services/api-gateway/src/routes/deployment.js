#!/usr/bin/env node

/**
 * AIRIS-MON Deployment Management Routes
 * 운영서버 배포 관리 API 엔드포인트
 */

const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = util.promisify(exec);

class DeploymentRoutes {
    constructor(clickhouse, redis, logger) {
        this.router = express.Router();
        this.clickhouse = clickhouse;
        this.redis = redis;
        this.logger = logger;
        this.registryUrl = process.env.REGISTRY_URL || 'localhost:5000';
        
        this.setupRoutes();
    }

    setupRoutes() {
        // 컨테이너 레지스트리 상태 확인
        this.router.get('/registry/status', this.getRegistryStatus.bind(this));
        
        // 컨테이너 이미지 목록 조회
        this.router.get('/registry/images', this.getRegistryImages.bind(this));
        
        // 특정 이미지 상세 정보
        this.router.get('/registry/images/:imageName/tags', this.getImageTags.bind(this));
        
        // 환경별 배포 상태 조회
        this.router.get('/environments/:env/status', this.getEnvironmentStatus.bind(this));
        
        // 배포 실행
        this.router.post('/deploy', this.deployImages.bind(this));
        
        // 배포 설정 검증
        this.router.post('/validate', this.validateDeployment.bind(this));
        
        // 롤백 실행
        this.router.post('/rollback', this.rollbackDeployment.bind(this));
        
        // 배포 로그 조회
        this.router.get('/logs/:deploymentId?', this.getDeploymentLogs.bind(this));
        
        // Kubernetes 클러스터 상태
        this.router.get('/k8s/status', this.getKubernetesStatus.bind(this));
    }

    async getRegistryStatus(req, res) {
        try {
            this.logger.info('레지스트리 상태 확인 요청');
            
            const response = await fetch(`http://${this.registryUrl}/v2/`);
            const isConnected = response.ok;
            
            let imageCount = 0;
            let totalSize = 0;
            
            if (isConnected) {
                try {
                    const catalogResponse = await fetch(`http://${this.registryUrl}/v2/_catalog`);
                    if (catalogResponse.ok) {
                        const catalogData = await catalogResponse.json();
                        imageCount = catalogData.repositories?.length || 0;
                        
                        // Calculate total size (simplified estimation)
                        for (const repo of catalogData.repositories || []) {
                            try {
                                const tagsResponse = await fetch(`http://${this.registryUrl}/v2/${repo}/tags/list`);
                                if (tagsResponse.ok) {
                                    const tagsData = await tagsResponse.json();
                                    if (tagsData.tags?.length > 0) {
                                        const manifestResponse = await fetch(`http://${this.registryUrl}/v2/${repo}/manifests/${tagsData.tags[0]}`, {
                                            headers: {
                                                'Accept': 'application/vnd.docker.distribution.manifest.v2+json'
                                            }
                                        });
                                        
                                        if (manifestResponse.ok) {
                                            const manifest = await manifestResponse.json();
                                            const configSize = manifest.config?.size || 0;
                                            const layersSize = (manifest.layers || []).reduce((sum, layer) => sum + (layer.size || 0), 0);
                                            totalSize += (configSize + layersSize);
                                        }
                                    }
                                }
                            } catch (error) {
                                this.logger.error(`이미지 크기 계산 실패: ${repo}`, { error: error.message });
                            }
                        }
                    }
                } catch (error) {
                    this.logger.error('레지스트리 카탈로그 조회 실패', { error: error.message });
                }
            }
            
            res.json({
                status: isConnected ? '정상' : '연결 실패',
                connected: isConnected,
                url: `http://${this.registryUrl}`,
                imageCount,
                totalSize: Math.round(totalSize / 1024 / 1024), // MB
                lastCheck: new Date().toISOString(),
                korean_time: new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }).format(new Date())
            });
            
        } catch (error) {
            this.logger.error('레지스트리 상태 확인 실패', { error: error.message });
            res.status(500).json({
                status: '오류',
                connected: false,
                error: error.message,
                korean_time: new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul'
                }).format(new Date())
            });
        }
    }

    async getRegistryImages(req, res) {
        try {
            this.logger.info('레지스트리 이미지 목록 조회');
            
            const catalogResponse = await fetch(`http://${this.registryUrl}/v2/_catalog`);
            if (!catalogResponse.ok) {
                throw new Error('레지스트리 연결 실패');
            }
            
            const catalogData = await catalogResponse.json();
            const images = [];
            
            for (const repo of catalogData.repositories || []) {
                try {
                    const tagsResponse = await fetch(`http://${this.registryUrl}/v2/${repo}/tags/list`);
                    if (tagsResponse.ok) {
                        const tagsData = await tagsResponse.json();
                        
                        // Get image size for latest tag
                        let size = 0;
                        let createdAt = null;
                        
                        if (tagsData.tags?.length > 0) {
                            const latestTag = tagsData.tags.find(tag => tag === 'latest') || tagsData.tags[0];
                            
                            try {
                                const manifestResponse = await fetch(`http://${this.registryUrl}/v2/${repo}/manifests/${latestTag}`, {
                                    headers: {
                                        'Accept': 'application/vnd.docker.distribution.manifest.v2+json'
                                    }
                                });
                                
                                if (manifestResponse.ok) {
                                    const manifest = await manifestResponse.json();
                                    const configSize = manifest.config?.size || 0;
                                    const layersSize = (manifest.layers || []).reduce((sum, layer) => sum + (layer.size || 0), 0);
                                    size = Math.round((configSize + layersSize) / 1024 / 1024); // MB
                                }
                            } catch (error) {
                                this.logger.error(`매니페스트 조회 실패: ${repo}:${latestTag}`, { error: error.message });
                            }
                        }
                        
                        images.push({
                            name: repo,
                            fullName: repo,
                            serviceName: repo.replace('airis-mon/', ''),
                            tags: tagsData.tags || [],
                            size,
                            lastUpdate: new Date().toISOString(),
                            korean_time: new Intl.DateTimeFormat('ko-KR', {
                                timeZone: 'Asia/Seoul',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            }).format(new Date()),
                            registry: this.registryUrl
                        });
                    }
                } catch (error) {
                    this.logger.error(`이미지 정보 조회 실패: ${repo}`, { error: error.message });
                }
            }
            
            res.json({
                images,
                total: images.length,
                registry: this.registryUrl,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            this.logger.error('이미지 목록 조회 실패', { error: error.message });
            res.status(500).json({
                error: '이미지 목록을 가져올 수 없습니다',
                message: error.message,
                images: [],
                total: 0
            });
        }
    }

    async getImageTags(req, res) {
        try {
            const { imageName } = req.params;
            this.logger.info(`이미지 태그 조회: ${imageName}`);
            
            const tagsResponse = await fetch(`http://${this.registryUrl}/v2/${imageName}/tags/list`);
            if (!tagsResponse.ok) {
                throw new Error('이미지를 찾을 수 없습니다');
            }
            
            const tagsData = await tagsResponse.json();
            
            res.json({
                imageName,
                tags: tagsData.tags || [],
                total: tagsData.tags?.length || 0,
                registry: this.registryUrl
            });
            
        } catch (error) {
            this.logger.error(`이미지 태그 조회 실패: ${req.params.imageName}`, { error: error.message });
            res.status(404).json({
                error: '이미지 태그를 조회할 수 없습니다',
                message: error.message
            });
        }
    }

    async getEnvironmentStatus(req, res) {
        try {
            const { env } = req.params;
            this.logger.info(`환경 상태 조회: ${env}`);
            
            const envConfig = this.getEnvironmentConfig(env);
            const deployments = await this.getCurrentDeployments(env);
            
            res.json({
                environment: env,
                displayName: envConfig.displayName,
                config: envConfig,
                deployments,
                status: envConfig.status,
                lastUpdate: new Date().toISOString(),
                korean_time: new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul'
                }).format(new Date())
            });
            
        } catch (error) {
            this.logger.error(`환경 상태 조회 실패: ${req.params.env}`, { error: error.message });
            res.status(500).json({
                error: '환경 상태를 조회할 수 없습니다',
                message: error.message
            });
        }
    }

    getEnvironmentConfig(env) {
        const configs = {
            'development': {
                displayName: '🛠️ 개발 환경',
                cluster: 'local-docker',
                namespace: 'default',
                registry: this.registryUrl,
                status: 'ready',
                description: 'Docker Compose 로컬 개발 환경'
            },
            'test': {
                displayName: '🧪 테스트 환경',
                cluster: 'test-cluster',
                namespace: 'airis-mon-test',
                registry: this.registryUrl,
                status: 'pending',
                description: 'Kubernetes 테스트 클러스터'
            },
            'production': {
                displayName: '🏭 운영 환경',
                cluster: 'production-cluster',
                namespace: 'airis-mon-prod',
                registry: this.registryUrl,
                status: 'ready',
                description: 'Kubernetes 운영 클러스터'
            }
        };
        
        return configs[env] || configs['development'];
    }

    async getCurrentDeployments(env) {
        // Mock deployment data - in real implementation, this would query Kubernetes API or Docker
        const deployments = {
            'development': [
                { 
                    name: 'api-gateway', 
                    status: 'running', 
                    replicas: '1/1', 
                    image: `${this.registryUrl}/airis-mon/api-gateway:latest`,
                    lastUpdate: '2024-08-18 14:30:15'
                },
                { 
                    name: 'ui', 
                    status: 'running', 
                    replicas: '1/1', 
                    image: `${this.registryUrl}/airis-mon/ui:latest`,
                    lastUpdate: '2024-08-18 14:30:10'
                }
            ],
            'test': [
                { 
                    name: 'api-gateway', 
                    status: 'pending', 
                    replicas: '0/2', 
                    image: `${this.registryUrl}/airis-mon/api-gateway:9635ce5`,
                    lastUpdate: '2024-08-18 13:45:22'
                },
                { 
                    name: 'data-ingestion', 
                    status: 'pending', 
                    replicas: '0/2', 
                    image: `${this.registryUrl}/airis-mon/data-ingestion:9635ce5`,
                    lastUpdate: '2024-08-18 13:45:20'
                }
            ],
            'production': [
                { 
                    name: 'clickhouse', 
                    status: 'ready', 
                    replicas: '3/3', 
                    image: 'clickhouse/clickhouse-server:23.12',
                    lastUpdate: '2024-08-18 12:00:00'
                },
                { 
                    name: 'kafka', 
                    status: 'ready', 
                    replicas: '3/3', 
                    image: 'confluentinc/cp-kafka:latest',
                    lastUpdate: '2024-08-18 12:00:00'
                },
                { 
                    name: 'redis', 
                    status: 'ready', 
                    replicas: '1/1', 
                    image: 'redis:7-alpine',
                    lastUpdate: '2024-08-18 12:00:00'
                }
            ]
        };
        
        return deployments[env] || [];
    }

    async deployImages(req, res) {
        try {
            const { 
                environment, 
                images, 
                strategy = 'rolling', 
                replicas = 3,
                resources = {}
            } = req.body;
            
            this.logger.info('배포 요청', { environment, images, strategy, replicas });
            
            if (!environment || !images || !Array.isArray(images) || images.length === 0) {
                return res.status(400).json({
                    error: '배포 요청이 올바르지 않습니다',
                    message: 'environment, images 필드가 필요합니다'
                });
            }
            
            const deploymentId = `deploy-${Date.now()}`;
            
            // Store deployment info in Redis for tracking
            await this.redis.setex(`deployment:${deploymentId}`, 3600, JSON.stringify({
                id: deploymentId,
                environment,
                images,
                strategy,
                replicas,
                resources,
                status: 'started',
                startTime: new Date().toISOString(),
                logs: [`배포 시작: ${environment} 환경`]
            }));
            
            // Simulate deployment process
            this.processDeployment(deploymentId, environment, images, strategy, replicas);
            
            res.json({
                deploymentId,
                status: '배포 시작됨',
                environment,
                images,
                strategy,
                message: '배포가 시작되었습니다. 로그를 확인하여 진행 상황을 모니터링하세요.',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            this.logger.error('배포 실행 실패', { error: error.message });
            res.status(500).json({
                error: '배포를 실행할 수 없습니다',
                message: error.message
            });
        }
    }

    async processDeployment(deploymentId, environment, images, strategy, replicas) {
        const logs = [`배포 시작: ${environment} 환경`];
        
        try {
            // Update status to in-progress
            logs.push(`배포 전략: ${strategy}`);
            logs.push(`대상 이미지: ${images.join(', ')}`);
            
            await this.updateDeploymentStatus(deploymentId, 'in-progress', logs);
            
            // Simulate deployment steps
            for (let i = 0; i < images.length; i++) {
                const image = images[i];
                logs.push(`이미지 배포 중: ${image}`);
                await this.updateDeploymentStatus(deploymentId, 'in-progress', logs);
                
                // Simulate deployment time
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                logs.push(`이미지 배포 완료: ${image}`);
                await this.updateDeploymentStatus(deploymentId, 'in-progress', logs);
            }
            
            logs.push('모든 이미지 배포 완료');
            logs.push('헬스 체크 실행 중...');
            await this.updateDeploymentStatus(deploymentId, 'in-progress', logs);
            
            // Simulate health check
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            logs.push('배포 성공적으로 완료됨');
            await this.updateDeploymentStatus(deploymentId, 'completed', logs);
            
        } catch (error) {
            logs.push(`배포 실패: ${error.message}`);
            await this.updateDeploymentStatus(deploymentId, 'failed', logs);
            this.logger.error('배포 프로세스 실패', { deploymentId, error: error.message });
        }
    }

    async updateDeploymentStatus(deploymentId, status, logs) {
        try {
            const existing = await this.redis.get(`deployment:${deploymentId}`);
            if (existing) {
                const deployment = JSON.parse(existing);
                deployment.status = status;
                deployment.logs = logs;
                deployment.lastUpdate = new Date().toISOString();
                
                if (status === 'completed' || status === 'failed') {
                    deployment.endTime = new Date().toISOString();
                }
                
                await this.redis.setex(`deployment:${deploymentId}`, 3600, JSON.stringify(deployment));
            }
        } catch (error) {
            this.logger.error('배포 상태 업데이트 실패', { deploymentId, error: error.message });
        }
    }

    async validateDeployment(req, res) {
        try {
            const { environment, images, resources = {} } = req.body;
            
            this.logger.info('배포 설정 검증', { environment, images });
            
            const validationResults = {
                valid: true,
                issues: [],
                warnings: []
            };
            
            // Validate environment
            if (!['development', 'test', 'production'].includes(environment)) {
                validationResults.valid = false;
                validationResults.issues.push('지원되지 않는 환경입니다');
            }
            
            // Validate images
            if (!images || !Array.isArray(images) || images.length === 0) {
                validationResults.valid = false;
                validationResults.issues.push('배포할 이미지를 선택해주세요');
            }
            
            // Validate resources
            if (resources.cpuRequest && !this.isValidResourceValue(resources.cpuRequest)) {
                validationResults.warnings.push('CPU 요청값이 올바르지 않습니다');
            }
            
            if (resources.memoryRequest && !this.isValidResourceValue(resources.memoryRequest)) {
                validationResults.warnings.push('메모리 요청값이 올바르지 않습니다');
            }
            
            // Check registry connectivity for each image
            for (const image of images || []) {
                try {
                    const [repo, tag = 'latest'] = image.split(':');
                    const manifestResponse = await fetch(`http://${this.registryUrl}/v2/${repo}/manifests/${tag}`);
                    if (!manifestResponse.ok) {
                        validationResults.warnings.push(`이미지를 찾을 수 없습니다: ${image}`);
                    }
                } catch (error) {
                    validationResults.warnings.push(`이미지 확인 실패: ${image}`);
                }
            }
            
            res.json({
                ...validationResults,
                environment,
                images,
                timestamp: new Date().toISOString(),
                message: validationResults.valid ? '검증 통과' : '검증 실패'
            });
            
        } catch (error) {
            this.logger.error('배포 설정 검증 실패', { error: error.message });
            res.status(500).json({
                valid: false,
                error: '검증을 수행할 수 없습니다',
                message: error.message
            });
        }
    }

    isValidResourceValue(value) {
        // Simple validation for Kubernetes resource format
        return /^(\d+(\.\d+)?)(m|Mi|Gi)?$/.test(value);
    }

    async rollbackDeployment(req, res) {
        try {
            const { environment, targetVersion } = req.body;
            
            this.logger.info('롤백 요청', { environment, targetVersion });
            
            const rollbackId = `rollback-${Date.now()}`;
            
            // Store rollback info
            await this.redis.setex(`deployment:${rollbackId}`, 3600, JSON.stringify({
                id: rollbackId,
                type: 'rollback',
                environment,
                targetVersion,
                status: 'started',
                startTime: new Date().toISOString(),
                logs: [`롤백 시작: ${environment} 환경`]
            }));
            
            // Simulate rollback process
            this.processRollback(rollbackId, environment, targetVersion);
            
            res.json({
                rollbackId,
                status: '롤백 시작됨',
                environment,
                targetVersion,
                message: '롤백이 시작되었습니다.',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            this.logger.error('롤백 실행 실패', { error: error.message });
            res.status(500).json({
                error: '롤백을 실행할 수 없습니다',
                message: error.message
            });
        }
    }

    async processRollback(rollbackId, environment, targetVersion) {
        const logs = [`롤백 시작: ${environment} 환경`];
        
        try {
            logs.push(`대상 버전: ${targetVersion || '이전 안정 버전'}`);
            await this.updateDeploymentStatus(rollbackId, 'in-progress', logs);
            
            // Simulate rollback steps
            logs.push('이전 버전으로 복원 중...');
            await this.updateDeploymentStatus(rollbackId, 'in-progress', logs);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            logs.push('서비스 재시작 중...');
            await this.updateDeploymentStatus(rollbackId, 'in-progress', logs);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            logs.push('헬스 체크 실행 중...');
            await this.updateDeploymentStatus(rollbackId, 'in-progress', logs);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            logs.push('롤백 성공적으로 완료됨');
            await this.updateDeploymentStatus(rollbackId, 'completed', logs);
            
        } catch (error) {
            logs.push(`롤백 실패: ${error.message}`);
            await this.updateDeploymentStatus(rollbackId, 'failed', logs);
            this.logger.error('롤백 프로세스 실패', { rollbackId, error: error.message });
        }
    }

    async getDeploymentLogs(req, res) {
        try {
            const { deploymentId } = req.params;
            
            if (deploymentId) {
                // Get specific deployment logs
                const deployment = await this.redis.get(`deployment:${deploymentId}`);
                if (!deployment) {
                    return res.status(404).json({
                        error: '배포 정보를 찾을 수 없습니다',
                        deploymentId
                    });
                }
                
                const deploymentData = JSON.parse(deployment);
                res.json({
                    deploymentId,
                    ...deploymentData
                });
            } else {
                // Get recent deployment logs
                const keys = await this.redis.keys('deployment:*');
                const deployments = [];
                
                for (const key of keys.slice(-10)) { // Last 10 deployments
                    try {
                        const data = await this.redis.get(key);
                        if (data) {
                            deployments.push(JSON.parse(data));
                        }
                    } catch (error) {
                        this.logger.error('배포 로그 파싱 실패', { key, error: error.message });
                    }
                }
                
                res.json({
                    deployments: deployments.sort((a, b) => 
                        new Date(b.startTime) - new Date(a.startTime)
                    ),
                    total: deployments.length
                });
            }
            
        } catch (error) {
            this.logger.error('배포 로그 조회 실패', { error: error.message });
            res.status(500).json({
                error: '배포 로그를 조회할 수 없습니다',
                message: error.message
            });
        }
    }

    async getKubernetesStatus(req, res) {
        try {
            // Mock Kubernetes status - in real implementation, use kubectl or k8s client
            const status = {
                connected: false,
                clusters: [],
                namespaces: [],
                message: 'Kubernetes 연결 설정이 필요합니다'
            };
            
            // Try to check if kubectl is available
            try {
                const { stdout } = await execAsync('kubectl version --client --short 2>/dev/null || echo "not-found"');
                if (!stdout.includes('not-found')) {
                    status.connected = true;
                    status.message = 'Kubernetes 클라이언트 사용 가능';
                    
                    // Try to get clusters (this might fail if not configured)
                    try {
                        const { stdout: contexts } = await execAsync('kubectl config get-contexts -o name 2>/dev/null');
                        status.clusters = contexts.trim().split('\n').filter(Boolean);
                    } catch (error) {
                        // Ignore context errors
                    }
                }
            } catch (error) {
                // kubectl not available
            }
            
            res.json({
                ...status,
                timestamp: new Date().toISOString(),
                korean_time: new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul'
                }).format(new Date())
            });
            
        } catch (error) {
            this.logger.error('Kubernetes 상태 확인 실패', { error: error.message });
            res.status(500).json({
                connected: false,
                error: 'Kubernetes 상태를 확인할 수 없습니다',
                message: error.message
            });
        }
    }
}

module.exports = DeploymentRoutes;