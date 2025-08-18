/**
 * LLM Configuration Manager
 * 다중 LLM 제공자 관리 및 설정 시스템
 * Primary: Ollama Gemma 3.1B
 * Fallback: Gemini, OpenAI, Claude
 */

class LLMConfigManager {
    constructor() {
        this.providers = new Map();
        this.currentProvider = 'ollama';
        this.healthStatus = new Map();
        this.metrics = new Map();
        this.initializeProviders();
    }

    /**
     * LLM 제공자 초기화
     */
    initializeProviders() {
        // Ollama Gemma 3.1B (Primary)
        this.providers.set('ollama', {
            name: 'Ollama Gemma 3.1B',
            type: 'local',
            endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
            model: 'gemma2:3b',
            config: {
                temperature: 0.7,
                max_tokens: 2048,
                top_p: 0.9,
                repeat_penalty: 1.1,
                num_ctx: 4096,
                stream: true
            },
            korean_optimization: {
                system_prompt: "당신은 한국어에 특화된 AI 어시스턴트입니다. 자연스럽고 정확한 한국어로 응답해주세요.",
                preprocessing: true,
                postprocessing: true,
                quality_check: true
            },
            priority: 1,
            cost_per_token: 0,
            status: 'inactive'
        });

        // Google Gemini Pro (Cloud Fallback)
        this.providers.set('gemini', {
            name: 'Google Gemini Pro',
            type: 'cloud',
            endpoint: 'https://generativelanguage.googleapis.com/v1beta',
            model: 'gemini-pro',
            config: {
                temperature: 0.7,
                maxOutputTokens: 2048,
                topP: 0.9,
                topK: 40
            },
            korean_optimization: {
                system_prompt: "한국어 전문 AI 어시스턴트로서 정확하고 자연스러운 한국어 응답을 제공합니다.",
                preprocessing: true,
                postprocessing: true,
                quality_check: true
            },
            priority: 2,
            cost_per_token: 0.00025,
            status: 'inactive'
        });

        // OpenAI GPT-4 (Premium Option)
        this.providers.set('openai', {
            name: 'OpenAI GPT-4',
            type: 'cloud',
            endpoint: 'https://api.openai.com/v1',
            model: 'gpt-4',
            config: {
                temperature: 0.7,
                max_tokens: 2048,
                top_p: 0.9,
                frequency_penalty: 0,
                presence_penalty: 0
            },
            korean_optimization: {
                system_prompt: "You are a Korean language specialist AI assistant. Please respond in natural and accurate Korean.",
                preprocessing: true,
                postprocessing: true,
                quality_check: true
            },
            priority: 3,
            cost_per_token: 0.03,
            status: 'inactive'
        });

        // Anthropic Claude (Alternative Option)
        this.providers.set('claude', {
            name: 'Anthropic Claude',
            type: 'cloud',
            endpoint: 'https://api.anthropic.com/v1',
            model: 'claude-3-sonnet-20240229',
            config: {
                temperature: 0.7,
                max_tokens: 2048,
                top_p: 0.9
            },
            korean_optimization: {
                system_prompt: "한국어 전문 AI로서 정확하고 자연스러운 한국어 응답을 제공해주세요.",
                preprocessing: true,
                postprocessing: true,
                quality_check: true
            },
            priority: 4,
            cost_per_token: 0.015,
            status: 'inactive'
        });
    }

    /**
     * 제공자 상태 확인
     */
    async checkProviderHealth(providerId) {
        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }

        try {
            const startTime = Date.now();
            let isHealthy = false;
            let responseTime = 0;

            switch (providerId) {
                case 'ollama':
                    isHealthy = await this.checkOllamaHealth(provider);
                    break;
                case 'gemini':
                    isHealthy = await this.checkGeminiHealth(provider);
                    break;
                case 'openai':
                    isHealthy = await this.checkOpenAIHealth(provider);
                    break;
                case 'claude':
                    isHealthy = await this.checkClaudeHealth(provider);
                    break;
            }

            responseTime = Date.now() - startTime;
            
            const health = {
                status: isHealthy ? 'healthy' : 'unhealthy',
                responseTime,
                lastCheck: new Date().toISOString(),
                provider: provider.name
            };

            this.healthStatus.set(providerId, health);
            provider.status = isHealthy ? 'active' : 'inactive';
            
            return health;
        } catch (error) {
            const health = {
                status: 'error',
                error: error.message,
                lastCheck: new Date().toISOString(),
                provider: provider.name
            };

            this.healthStatus.set(providerId, health);
            provider.status = 'error';
            
            return health;
        }
    }

    /**
     * Ollama 상태 확인
     */
    async checkOllamaHealth(provider) {
        try {
            const response = await fetch(`${provider.endpoint}/api/tags`);
            if (response.ok) {
                const data = await response.json();
                const hasGemma = data.models?.some(model => 
                    model.name.includes('gemma2:3b')
                );
                return hasGemma;
            }
            return false;
        } catch (error) {
            console.error('Ollama health check failed:', error);
            return false;
        }
    }

    /**
     * Gemini 상태 확인
     */
    async checkGeminiHealth(provider) {
        if (!process.env.GEMINI_API_KEY) {
            return false;
        }

        try {
            const response = await fetch(
                `${provider.endpoint}/models?key=${process.env.GEMINI_API_KEY}`
            );
            return response.ok;
        } catch (error) {
            console.error('Gemini health check failed:', error);
            return false;
        }
    }

    /**
     * OpenAI 상태 확인
     */
    async checkOpenAIHealth(provider) {
        if (!process.env.OPENAI_API_KEY) {
            return false;
        }

        try {
            const response = await fetch(`${provider.endpoint}/models`, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                }
            });
            return response.ok;
        } catch (error) {
            console.error('OpenAI health check failed:', error);
            return false;
        }
    }

    /**
     * Claude 상태 확인
     */
    async checkClaudeHealth(provider) {
        if (!process.env.CLAUDE_API_KEY) {
            return false;
        }

        // Claude는 직접적인 health check 엔드포인트가 없으므로
        // API 키 존재 여부로 판단
        return true;
    }

    /**
     * 모든 제공자 상태 확인
     */
    async checkAllProvidersHealth() {
        const healthChecks = Array.from(this.providers.keys()).map(async (providerId) => {
            const health = await this.checkProviderHealth(providerId);
            return { providerId, health };
        });

        const results = await Promise.all(healthChecks);
        return results.reduce((acc, { providerId, health }) => {
            acc[providerId] = health;
            return acc;
        }, {});
    }

    /**
     * 최적 제공자 선택
     */
    selectOptimalProvider(taskType = 'general', preferLocal = true) {
        const availableProviders = Array.from(this.providers.entries())
            .filter(([_, provider]) => provider.status === 'active')
            .sort((a, b) => {
                // 로컬 우선 선택
                if (preferLocal) {
                    if (a[1].type === 'local' && b[1].type !== 'local') return -1;
                    if (a[1].type !== 'local' && b[1].type === 'local') return 1;
                }
                
                // 우선순위에 따른 정렬
                return a[1].priority - b[1].priority;
            });

        if (availableProviders.length === 0) {
            throw new Error('사용 가능한 LLM 제공자가 없습니다');
        }

        return availableProviders[0][0];
    }

    /**
     * 제공자 전환
     */
    async switchProvider(providerId) {
        if (!this.providers.has(providerId)) {
            throw new Error(`Provider ${providerId} not found`);
        }

        const health = await this.checkProviderHealth(providerId);
        if (health.status !== 'healthy') {
            throw new Error(`Provider ${providerId} is not healthy`);
        }

        const previousProvider = this.currentProvider;
        this.currentProvider = providerId;
        
        console.log(`LLM 제공자 전환: ${previousProvider} → ${providerId}`);
        return {
            previous: previousProvider,
            current: providerId,
            provider: this.providers.get(providerId)
        };
    }

    /**
     * 제공자 설정 가져오기
     */
    getProvider(providerId = null) {
        const id = providerId || this.currentProvider;
        return this.providers.get(id);
    }

    /**
     * 모든 제공자 목록 가져오기
     */
    getAllProviders() {
        return Array.from(this.providers.entries()).map(([id, provider]) => ({
            id,
            ...provider,
            health: this.healthStatus.get(id)
        }));
    }

    /**
     * 메트릭 업데이트
     */
    updateMetrics(providerId, metrics) {
        const existing = this.metrics.get(providerId) || {
            totalRequests: 0,
            totalTokens: 0,
            totalCost: 0,
            averageResponseTime: 0,
            errorCount: 0
        };

        const updated = {
            ...existing,
            ...metrics,
            lastUpdated: new Date().toISOString()
        };

        this.metrics.set(providerId, updated);
        return updated;
    }

    /**
     * 메트릭 가져오기
     */
    getMetrics(providerId = null) {
        if (providerId) {
            return this.metrics.get(providerId) || {};
        }
        
        return Object.fromEntries(this.metrics);
    }

    /**
     * 한국어 최적화 설정 가져오기
     */
    getKoreanOptimization(providerId = null) {
        const provider = this.getProvider(providerId);
        return provider?.korean_optimization || {};
    }

    /**
     * 비용 계산
     */
    calculateCost(providerId, tokenCount) {
        const provider = this.getProvider(providerId);
        if (!provider) return 0;
        
        return tokenCount * provider.cost_per_token;
    }
}

module.exports = LLMConfigManager;