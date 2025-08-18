/**
 * Multi-LLM Router
 * 지능형 모델 라우팅 및 로드 밸런싱 시스템
 * 작업 유형에 따른 최적 모델 선택
 */

const LLMConfigManager = require('./LLMConfigManager');
const OllamaClient = require('./OllamaClient');
const EventEmitter = require('events');

class MultiLLMRouter extends EventEmitter {
    constructor() {
        super();
        this.configManager = new LLMConfigManager();
        this.ollamaClient = null;
        this.requestQueue = new Map();
        this.metrics = {
            totalRequests: 0,
            totalTokens: 0,
            totalCost: 0,
            averageResponseTime: 0,
            providerUsage: new Map(),
            errorCounts: new Map()
        };
        this.initialize();
    }

    /**
     * 라우터 초기화
     */
    async initialize() {
        try {
            // Ollama 클라이언트 초기화
            this.ollamaClient = new OllamaClient();
            
            // 모든 제공자 상태 확인
            await this.configManager.checkAllProvidersHealth();
            
            console.log('Multi-LLM 라우터 초기화 완료');
        } catch (error) {
            console.error('라우터 초기화 실패:', error.message);
        }
    }

    /**
     * 작업 유형에 따른 최적 제공자 선택
     */
    selectProviderForTask(taskType, options = {}) {
        const {
            preferLocal = true,
            maxCost = null,
            minQuality = 'medium',
            requireStream = false
        } = options;

        // 작업 유형별 우선순위 매트릭스
        const taskPriorities = {
            'korean-chat': {
                ollama: 10,
                gemini: 8,
                openai: 6,
                claude: 7
            },
            'code-generation': {
                ollama: 8,
                openai: 10,
                claude: 9,
                gemini: 7
            },
            'analysis': {
                ollama: 9,
                claude: 10,
                openai: 8,
                gemini: 8
            },
            'translation': {
                ollama: 8,
                gemini: 10,
                openai: 7,
                claude: 8
            },
            'general': {
                ollama: 10,
                gemini: 8,
                openai: 7,
                claude: 8
            }
        };

        const priorities = taskPriorities[taskType] || taskPriorities['general'];
        const availableProviders = this.configManager.getAllProviders()
            .filter(provider => {
                // 상태 확인
                if (provider.status !== 'active') return false;
                
                // 비용 제한 확인
                if (maxCost && provider.cost_per_token > maxCost) return false;
                
                // 스트리밍 요구사항 확인
                if (requireStream && provider.id === 'claude') return false;
                
                return true;
            })
            .map(provider => ({
                ...provider,
                score: this.calculateProviderScore(provider, priorities, {
                    preferLocal,
                    taskType
                })
            }))
            .sort((a, b) => b.score - a.score);

        if (availableProviders.length === 0) {
            throw new Error(`작업 유형 '${taskType}'에 사용 가능한 제공자가 없습니다`);
        }

        return availableProviders[0];
    }

    /**
     * 제공자 점수 계산
     */
    calculateProviderScore(provider, priorities, options) {
        let score = priorities[provider.id] || 0;
        
        // 로컬 우선 보너스
        if (options.preferLocal && provider.type === 'local') {
            score += 5;
        }
        
        // 성능 메트릭 반영
        const metrics = this.configManager.getMetrics(provider.id);
        if (metrics.averageResponseTime) {
            // 빠른 응답시간 보너스 (역수 스케일)
            score += Math.max(0, 5 - (metrics.averageResponseTime / 1000));
        }
        
        // 오류율 패널티
        if (metrics.errorCount && metrics.totalRequests) {
            const errorRate = metrics.errorCount / metrics.totalRequests;
            score -= errorRate * 10;
        }
        
        // 비용 효율성 (저비용 보너스)
        if (provider.cost_per_token === 0) {
            score += 3; // 무료 모델 보너스
        } else {
            score += Math.max(0, 3 - (provider.cost_per_token * 100));
        }
        
        return score;
    }

    /**
     * 채팅 완성 (스트리밍)
     */
    async chatStream(messages, options = {}) {
        const {
            taskType = 'korean-chat',
            providerId = null,
            ...routerOptions
        } = options;

        let provider;
        if (providerId) {
            provider = this.configManager.getAllProviders()
                .find(p => p.id === providerId);
            if (!provider) {
                throw new Error(`제공자 ${providerId}를 찾을 수 없습니다`);
            }
        } else {
            provider = this.selectProviderForTask(taskType, {
                ...routerOptions,
                requireStream: true
            });
        }

        const startTime = Date.now();
        this.emit('providerSelected', {
            provider: provider.id,
            taskType,
            timestamp: new Date().toISOString()
        });

        try {
            let response;
            
            switch (provider.id) {
                case 'ollama':
                    response = await this.handleOllamaStream(messages, routerOptions);
                    break;
                case 'gemini':
                    response = await this.handleGeminiStream(messages, routerOptions);
                    break;
                case 'openai':
                    response = await this.handleOpenAIStream(messages, routerOptions);
                    break;
                default:
                    throw new Error(`스트리밍을 지원하지 않는 제공자: ${provider.id}`);
            }

            this.updateMetrics(provider.id, {
                responseTime: Date.now() - startTime,
                success: true
            });

            return response;
        } catch (error) {
            this.updateMetrics(provider.id, {
                responseTime: Date.now() - startTime,
                success: false,
                error: error.message
            });
            
            // 폴백 시도
            if (!providerId) {
                return this.handleFallback(messages, taskType, provider.id, routerOptions);
            }
            
            throw error;
        }
    }

    /**
     * 채팅 완성 (일반)
     */
    async chat(messages, options = {}) {
        const {
            taskType = 'korean-chat',
            providerId = null,
            ...routerOptions
        } = options;

        let provider;
        if (providerId) {
            provider = this.configManager.getAllProviders()
                .find(p => p.id === providerId);
            if (!provider) {
                throw new Error(`제공자 ${providerId}를 찾을 수 없습니다`);
            }
        } else {
            provider = this.selectProviderForTask(taskType, routerOptions);
        }

        const startTime = Date.now();
        this.emit('providerSelected', {
            provider: provider.id,
            taskType,
            timestamp: new Date().toISOString()
        });

        try {
            let response;
            
            switch (provider.id) {
                case 'ollama':
                    response = await this.handleOllamaChat(messages, routerOptions);
                    break;
                case 'gemini':
                    response = await this.handleGeminiChat(messages, routerOptions);
                    break;
                case 'openai':
                    response = await this.handleOpenAIChat(messages, routerOptions);
                    break;
                case 'claude':
                    response = await this.handleClaudeChat(messages, routerOptions);
                    break;
                default:
                    throw new Error(`지원하지 않는 제공자: ${provider.id}`);
            }

            this.updateMetrics(provider.id, {
                responseTime: Date.now() - startTime,
                success: true,
                tokens: response.usage?.total_tokens || 0
            });

            return {
                ...response,
                provider: provider.id,
                taskType
            };
        } catch (error) {
            this.updateMetrics(provider.id, {
                responseTime: Date.now() - startTime,
                success: false,
                error: error.message
            });
            
            // 폴백 시도
            if (!providerId) {
                return this.handleFallback(messages, taskType, provider.id, routerOptions);
            }
            
            throw error;
        }
    }

    /**
     * Ollama 채팅 처리
     */
    async handleOllamaChat(messages, options) {
        const config = this.configManager.getProvider('ollama');
        const koreanConfig = config.korean_optimization;
        
        // 한국어 시스템 프롬프트 추가
        const enhancedMessages = [
            {
                role: 'system',
                content: koreanConfig.system_prompt
            },
            ...messages
        ];

        return await this.ollamaClient.chat(enhancedMessages, {
            ...config.config,
            ...options
        });
    }

    /**
     * Ollama 스트리밍 처리
     */
    async handleOllamaStream(messages, options) {
        const config = this.configManager.getProvider('ollama');
        const koreanConfig = config.korean_optimization;
        
        // 한국어 시스템 프롬프트 추가
        const enhancedMessages = [
            {
                role: 'system',
                content: koreanConfig.system_prompt
            },
            ...messages
        ];

        return await this.ollamaClient.chatStream(enhancedMessages, {
            ...config.config,
            ...options
        });
    }

    /**
     * Gemini 채팅 처리
     */
    async handleGeminiChat(messages, options) {
        const config = this.configManager.getProvider('gemini');
        
        // Gemini API 호출 구현
        const payload = {
            contents: messages.map(msg => ({
                parts: [{ text: msg.content }],
                role: msg.role === 'assistant' ? 'model' : 'user'
            })),
            generationConfig: {
                ...config.config,
                ...options
            }
        };

        const response = await fetch(
            `${config.endpoint}/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API 오류: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * OpenAI 채팅 처리
     */
    async handleOpenAIChat(messages, options) {
        const config = this.configManager.getProvider('openai');
        
        const payload = {
            model: config.model,
            messages,
            ...config.config,
            ...options
        };

        const response = await fetch(`${config.endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`OpenAI API 오류: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Claude 채팅 처리
     */
    async handleClaudeChat(messages, options) {
        const config = this.configManager.getProvider('claude');
        
        const payload = {
            model: config.model,
            messages,
            ...config.config,
            ...options
        };

        const response = await fetch(`${config.endpoint}/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': process.env.CLAUDE_API_KEY,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Claude API 오류: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * 폴백 처리
     */
    async handleFallback(messages, taskType, failedProviderId, options) {
        console.log(`제공자 ${failedProviderId} 실패, 폴백 시도 중...`);
        
        const availableProviders = this.configManager.getAllProviders()
            .filter(p => p.id !== failedProviderId && p.status === 'active')
            .sort((a, b) => a.priority - b.priority);

        if (availableProviders.length === 0) {
            throw new Error('사용 가능한 폴백 제공자가 없습니다');
        }

        const fallbackProvider = availableProviders[0];
        console.log(`폴백 제공자: ${fallbackProvider.id}`);
        
        return await this.chat(messages, {
            ...options,
            taskType,
            providerId: fallbackProvider.id
        });
    }

    /**
     * 메트릭 업데이트
     */
    updateMetrics(providerId, data) {
        this.metrics.totalRequests++;
        
        if (data.success) {
            if (data.tokens) {
                this.metrics.totalTokens += data.tokens;
                const provider = this.configManager.getProvider(providerId);
                this.metrics.totalCost += this.configManager.calculateCost(providerId, data.tokens);
            }
        } else {
            const errorCount = this.metrics.errorCounts.get(providerId) || 0;
            this.metrics.errorCounts.set(providerId, errorCount + 1);
        }
        
        // 제공자별 사용량 추적
        const usage = this.metrics.providerUsage.get(providerId) || {
            requests: 0,
            tokens: 0,
            cost: 0,
            responseTime: 0
        };
        
        usage.requests++;
        if (data.tokens) usage.tokens += data.tokens;
        if (data.responseTime) {
            usage.responseTime = (usage.responseTime * (usage.requests - 1) + data.responseTime) / usage.requests;
        }
        
        this.metrics.providerUsage.set(providerId, usage);
        
        // 전체 평균 응답시간 계산
        if (data.responseTime) {
            this.metrics.averageResponseTime = (
                this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + data.responseTime
            ) / this.metrics.totalRequests;
        }
        
        // 설정 관리자에 메트릭 전달
        this.configManager.updateMetrics(providerId, usage);
    }

    /**
     * 로드 밸런싱 상태 가져오기
     */
    getLoadBalancingStatus() {
        return {
            totalRequests: this.metrics.totalRequests,
            totalTokens: this.metrics.totalTokens,
            totalCost: this.metrics.totalCost,
            averageResponseTime: this.metrics.averageResponseTime,
            providerUsage: Object.fromEntries(this.metrics.providerUsage),
            errorCounts: Object.fromEntries(this.metrics.errorCounts),
            availableProviders: this.configManager.getAllProviders()
                .filter(p => p.status === 'active')
                .map(p => ({ id: p.id, name: p.name, type: p.type }))
        };
    }

    /**
     * 성능 벤치마크
     */
    async runPerformanceBenchmark(testPrompt = '한국어로 안녕하세요라고 답해주세요') {
        const results = new Map();
        const providers = this.configManager.getAllProviders()
            .filter(p => p.status === 'active');

        for (const provider of providers) {
            const startTime = Date.now();
            try {
                const response = await this.chat(
                    [{ role: 'user', content: testPrompt }],
                    { providerId: provider.id }
                );
                
                results.set(provider.id, {
                    success: true,
                    responseTime: Date.now() - startTime,
                    tokenCount: response.usage?.total_tokens || 0,
                    cost: this.configManager.calculateCost(provider.id, response.usage?.total_tokens || 0)
                });
            } catch (error) {
                results.set(provider.id, {
                    success: false,
                    responseTime: Date.now() - startTime,
                    error: error.message
                });
            }
        }

        return Object.fromEntries(results);
    }
}

module.exports = MultiLLMRouter;