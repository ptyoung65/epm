/**
 * Ollama Client
 * Ollama Gemma 3.1B 직접 통합 클라이언트
 * 한국어 최적화 및 스트리밍 지원
 */

const EventEmitter = require('events');
const fetch = require('node-fetch');

class OllamaClient extends EventEmitter {
    constructor(endpoint = 'http://localhost:11434', options = {}) {
        super();
        this.endpoint = endpoint;
        this.modelName = options.modelName || 'gemma2:3b';
        this.timeout = options.timeout || 30000;
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
    }

    /**
     * 모델 상태 확인
     */
    async checkModel() {
        try {
            const response = await this.makeRequest('/api/tags');
            const models = response.models || [];
            
            const modelExists = models.some(model => 
                model.name === this.modelName || 
                model.name.includes('gemma2:3b')
            );

            if (!modelExists) {
                console.log(`모델 ${this.modelName}이 없습니다. 자동 다운로드를 시도합니다.`);
                await this.pullModel();
            }

            return true;
        } catch (error) {
            console.error('모델 확인 실패:', error.message);
            return false;
        }
    }

    /**
     * 모델 다운로드
     */
    async pullModel(modelName = null) {
        const model = modelName || this.modelName;
        console.log(`모델 다운로드 시작: ${model}`);

        try {
            const response = await fetch(`${this.endpoint}/api/pull`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: model, stream: false })
            });

            if (!response.ok) {
                throw new Error(`모델 다운로드 실패: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`모델 다운로드 완료: ${model}`);
            return result;
        } catch (error) {
            console.error('모델 다운로드 오류:', error.message);
            throw error;
        }
    }

    /**
     * 채팅 완성 (스트리밍)
     */
    async chatStream(messages, options = {}) {
        const payload = {
            model: this.modelName,
            messages: this.preprocessKoreanMessages(messages),
            stream: true,
            options: {
                temperature: options.temperature || 0.7,
                top_p: options.top_p || 0.9,
                repeat_penalty: options.repeat_penalty || 1.1,
                num_ctx: options.num_ctx || 4096,
                ...options
            }
        };

        try {
            const response = await fetch(`${this.endpoint}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                timeout: this.timeout
            });

            if (!response.ok) {
                throw new Error(`Ollama API 오류: ${response.statusText}`);
            }

            return this.handleStreamResponse(response);
        } catch (error) {
            console.error('채팅 스트림 오류:', error.message);
            throw error;
        }
    }

    /**
     * 채팅 완성 (일반)
     */
    async chat(messages, options = {}) {
        const payload = {
            model: this.modelName,
            messages: this.preprocessKoreanMessages(messages),
            stream: false,
            options: {
                temperature: options.temperature || 0.7,
                top_p: options.top_p || 0.9,
                repeat_penalty: options.repeat_penalty || 1.1,
                num_ctx: options.num_ctx || 4096,
                ...options
            }
        };

        try {
            const response = await this.makeRequestWithRetry('/api/chat', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (response.message && response.message.content) {
                response.message.content = this.postprocessKoreanText(
                    response.message.content
                );
            }

            return response;
        } catch (error) {
            console.error('채팅 완성 오류:', error.message);
            throw error;
        }
    }

    /**
     * 텍스트 생성
     */
    async generate(prompt, options = {}) {
        const payload = {
            model: this.modelName,
            prompt: this.preprocessKoreanText(prompt),
            stream: false,
            options: {
                temperature: options.temperature || 0.7,
                top_p: options.top_p || 0.9,
                repeat_penalty: options.repeat_penalty || 1.1,
                num_ctx: options.num_ctx || 4096,
                ...options
            }
        };

        try {
            const response = await this.makeRequestWithRetry('/api/generate', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (response.response) {
                response.response = this.postprocessKoreanText(response.response);
            }

            return response;
        } catch (error) {
            console.error('텍스트 생성 오류:', error.message);
            throw error;
        }
    }

    /**
     * 임베딩 생성
     */
    async embed(text, options = {}) {
        const payload = {
            model: this.modelName,
            prompt: this.preprocessKoreanText(text)
        };

        try {
            const response = await this.makeRequestWithRetry('/api/embeddings', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            return response;
        } catch (error) {
            console.error('임베딩 생성 오류:', error.message);
            throw error;
        }
    }

    /**
     * 한국어 메시지 전처리
     */
    preprocessKoreanMessages(messages) {
        return messages.map(message => ({
            ...message,
            content: this.preprocessKoreanText(message.content)
        }));
    }

    /**
     * 한국어 텍스트 전처리
     */
    preprocessKoreanText(text) {
        if (typeof text !== 'string') return text;
        
        // 한국어 특화 전처리
        let processed = text
            // 불필요한 공백 제거
            .replace(/\s{2,}/g, ' ')
            // 한글 띄어쓰기 정규화
            .replace(/([가-힣])\s+([가-힣])/g, (match, p1, p2) => {
                // 조사나 어미 앞의 불필요한 공백 제거
                const particles = ['은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로'];
                if (particles.includes(p2)) {
                    return p1 + p2;
                }
                return match;
            })
            // 문장 부호 정규화
            .replace(/([.!?])\s*([가-힣])/g, '$1 $2')
            .trim();

        return processed;
    }

    /**
     * 한국어 응답 후처리
     */
    postprocessKoreanText(text) {
        if (typeof text !== 'string') return text;
        
        let processed = text
            // 중복 공백 제거
            .replace(/\s{2,}/g, ' ')
            // 문장 부호 정리
            .replace(/([.!?])([가-힣])/g, '$1 $2')
            // 불완전한 문장 처리
            .replace(/([가-힣])\s*$/, (match) => {
                if (!match.match(/[.!?]$/)) {
                    return match + '.';
                }
                return match;
            })
            .trim();

        return processed;
    }

    /**
     * 스트림 응답 처리
     */
    async handleStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const data = JSON.parse(line);
                            if (data.message && data.message.content) {
                                const content = data.message.content;
                                fullResponse += content;
                                this.emit('data', {
                                    content,
                                    fullResponse,
                                    done: data.done || false
                                });
                            }
                            
                            if (data.done) {
                                this.emit('end', {
                                    fullResponse: this.postprocessKoreanText(fullResponse),
                                    totalTokens: data.eval_count || 0,
                                    promptTokens: data.prompt_eval_count || 0
                                });
                                return fullResponse;
                            }
                        } catch (parseError) {
                            console.error('JSON 파싱 오류:', parseError.message);
                        }
                    }
                }
            }
        } catch (error) {
            this.emit('error', error);
            throw error;
        } finally {
            reader.releaseLock();
        }

        return this.postprocessKoreanText(fullResponse);
    }

    /**
     * HTTP 요청 (재시도 포함)
     */
    async makeRequestWithRetry(path, options = {}, retryCount = 0) {
        try {
            return await this.makeRequest(path, options);
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.log(`요청 재시도 (${retryCount + 1}/${this.maxRetries}): ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
                return this.makeRequestWithRetry(path, options, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * HTTP 요청
     */
    async makeRequest(path, options = {}) {
        const url = `${this.endpoint}${path}`;
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: this.timeout,
            ...options
        };

        const response = await fetch(url, config);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * 연결 테스트
     */
    async testConnection() {
        try {
            const response = await this.makeRequest('/api/version');
            console.log('Ollama 연결 성공:', response);
            return true;
        } catch (error) {
            console.error('Ollama 연결 실패:', error.message);
            return false;
        }
    }

    /**
     * 모델 정보 가져오기
     */
    async getModelInfo(modelName = null) {
        const model = modelName || this.modelName;
        try {
            const response = await this.makeRequest('/api/show', {
                method: 'POST',
                body: JSON.stringify({ name: model })
            });
            return response;
        } catch (error) {
            console.error('모델 정보 가져오기 실패:', error.message);
            throw error;
        }
    }

    /**
     * 실행 중인 모델 목록
     */
    async getRunningModels() {
        try {
            const response = await this.makeRequest('/api/ps');
            return response.models || [];
        } catch (error) {
            console.error('실행 중인 모델 목록 가져오기 실패:', error.message);
            throw error;
        }
    }

    /**
     * 모델 언로드
     */
    async unloadModel(modelName = null) {
        const model = modelName || this.modelName;
        try {
            const response = await this.makeRequest('/api/generate', {
                method: 'POST',
                body: JSON.stringify({
                    name: model,
                    keep_alive: 0
                })
            });
            console.log(`모델 언로드 완료: ${model}`);
            return response;
        } catch (error) {
            console.error('모델 언로드 실패:', error.message);
            throw error;
        }
    }
}

module.exports = OllamaClient;