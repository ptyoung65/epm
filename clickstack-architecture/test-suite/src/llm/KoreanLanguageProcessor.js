/**
 * Korean Language Processor
 * 한국어 특화 언어 처리 시스템
 * 프롬프트 최적화, 텍스트 전처리, 품질 평가
 */

class KoreanLanguageProcessor {
    constructor() {
        this.taskTemplates = new Map();
        this.contextPatterns = new Map();
        this.qualityMetrics = new Map();
        this.initializeTemplates();
        this.initializePatterns();
    }

    /**
     * 한국어 특화 프롬프트 템플릿 초기화
     */
    initializeTemplates() {
        // 일반 대화 템플릿
        this.taskTemplates.set('korean-chat', {
            systemPrompt: `당신은 한국어에 특화된 AI 어시스턴트입니다.
다음 지침을 따라주세요:
- 자연스럽고 정확한 한국어로 응답하세요
- 전문 용어는 필요시 설명을 추가하세요
- 대화 맥락을 이해하고 일관성 있게 대답하세요
- 한국 문화와 관습을 고려하여 대답하세요`,
            userPrefix: '사용자',
            assistantPrefix: 'AI 어시스턴트',
            contextInstructions: '이전 대화 내용을 참고하여 일관성 있게 대답해주세요.'
        });

        // 코드 생성 템플릿
        this.taskTemplates.set('code-generation', {
            systemPrompt: `당신은 한국어를 사용하는 프로그래밍 전문가 AI입니다.
코드 생성 시 다음을 준수하세요:
- 코드는 영어로 작성하되, 주석은 한국어로 작성하세요
- 변수명과 함수명은 영어로 작성하세요
- 설명과 도움말은 한국어로 제공하세요
- 베스트 프랙티스를 따라 코드를 작성하세요`,
            userPrefix: '개발자',
            assistantPrefix: '코딩 어시스턴트',
            contextInstructions: '이전에 작성한 코드와 일관성을 유지하여 작성해주세요.'
        });

        // 데이터 분석 템플릿
        this.taskTemplates.set('analysis', {
            systemPrompt: `당신은 데이터 분석 전문가 AI입니다.
분석 결과를 제공할 때:
- 한국어로 명확하고 이해하기 쉬게 설명하세요
- 주요 인사이트를 강조하여 제시하세요
- 데이터에 기반한 경향과 패턴을 설명하세요
- 실행 가능한 추천사항을 제공하세요`,
            userPrefix: '분석가',
            assistantPrefix: '데이터 전문가',
            contextInstructions: '이전 분석 결과와 연관성을 고려하여 설명해주세요.'
        });

        // 번역 템플릿
        this.taskTemplates.set('translation', {
            systemPrompt: `당신은 전문 번역가 AI입니다.
번역 시 다음을 준수하세요:
- 원문의 의미와 뉘앙스를 정확히 전달하세요
- 한국어로 번역시 자연스럽고 일반적인 표현을 사용하세요
- 전문 용어는 적절한 한국어 대역어를 사용하세요
- 문화적 쉠스를 고려하여 번역하세요`,
            userPrefix: '번역 요청자',
            assistantPrefix: '번역가',
            contextInstructions: '이전 번역 내용과 일관성을 유지하여 번역해주세요.'
        });

        // 기술 지원 템플릿
        this.taskTemplates.set('tech-support', {
            systemPrompt: `당신은 AIRIS-MON AIOps 시스템의 기술 지원 전문가 AI입니다.
기술 지원 시:
- 문제를 체계적으로 분석하고 해결책을 제시하세요
- 단계별 지침을 명확하게 설명하세요
- 관련 로그나 오류 메시지 해석을 도와주세요
- 예방 방법과 모니터링 방안을 추천하세요`,
            userPrefix: '사용자',
            assistantPrefix: '기술 지원 전문가',
            contextInstructions: '이전 문제 해결 과정을 참고하여 도움을 제공해주세요.'
        });
    }

    /**
     * 한국어 패턴 초기화
     */
    initializePatterns() {
        // 정중한 표현 패턴
        this.contextPatterns.set('formal', {
            honorifics: ['습니다', '십시오', '해주세요', '바랍니다'],
            transitions: ['그러나', '하지만', '또한', '따라서'],
            closings: ['감사합니다', '도움이 되셨기를 바랍니다', '추가 질문이 있으시면 말씀해주세요']
        });

        // 친근한 표현 패턴
        this.contextPatterns.set('casual', {
            honorifics: ['어요', '아요', '해요', '되어요'],
            transitions: ['그래도', '하지만', '아무튼', '그래서'],
            closings: ['도움되었나요?', '더 궁금한 게 있으면 말해주세요', '잘 해결되길 바라요']
        });

        // 기술 문서 패턴
        this.contextPatterns.set('technical', {
            terms: ['설정', '구성', '실행', '배포', '모니터링', '디버깅'],
            structures: ['다음 단계로', '첫 번째로', '마지막으로', '결과적으로'],
            warnings: ['주의사항', '중요', '필수', '권장사항']
        });
    }

    /**
     * 메시지 전처리
     */
    preprocessMessage(message, taskType = 'korean-chat', options = {}) {
        const {
            formality = 'formal',
            addContext = true,
            optimizeForModel = true
        } = options;

        let processed = {
            ...message,
            content: this.preprocessText(message.content, taskType)
        };

        // 작업 유형에 따른 시스템 프롬프트 추가
        if (message.role === 'system' && addContext) {
            const template = this.taskTemplates.get(taskType);
            if (template) {
                processed.content = template.systemPrompt + '\n\n' + processed.content;
            }
        }

        // 문체 조정
        if (message.role === 'user' && formality) {
            processed.content = this.adjustFormality(processed.content, formality);
        }

        return processed;
    }

    /**
     * 텍스트 전처리
     */
    preprocessText(text, taskType = 'korean-chat') {
        if (typeof text !== 'string') return text;

        let processed = text
            // 가독성을 위한 공백 정리
            .replace(/\s{2,}/g, ' ')
            // 한글 띄어쓰기 정규화
            .replace(/([가-힣])\s+([가-힣])/g, (match, p1, p2) => {
                const particles = ['은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '과', '와', '도'];
                if (particles.includes(p2)) {
                    return p1 + p2;
                }
                return match;
            })
            // 문장 부호 정리
            .replace(/([.!?])\s*([가-힣])/g, '$1 $2')
            // 중복 문장부호 제거
            .replace(/([.!?]){2,}/g, '$1')
            .trim();

        // 작업 유형별 추가 처리
        switch (taskType) {
            case 'code-generation':
                processed = this.preprocessCodeRequest(processed);
                break;
            case 'analysis':
                processed = this.preprocessAnalysisRequest(processed);
                break;
            case 'translation':
                processed = this.preprocessTranslationRequest(processed);
                break;
        }

        return processed;
    }

    /**
     * 코드 생성 요청 전처리
     */
    preprocessCodeRequest(text) {
        // 코드 생성 요청에 명확한 지침 추가
        const codeKeywords = ['코드', '함수', '클래스', '스크립트', '알고리즘'];
        const hasCodeKeyword = codeKeywords.some(keyword => text.includes(keyword));
        
        if (hasCodeKeyword && !text.includes('주석')) {
            text += '\n(* 코드에 한국어 주석을 추가해주세요)';
        }
        
        return text;
    }

    /**
     * 분석 요청 전처리
     */
    preprocessAnalysisRequest(text) {
        // 분석 요청에 구체적인 결과 형태 요청 추가
        const analysisKeywords = ['분석', '통계', '데이터', '트렌드'];
        const hasAnalysisKeyword = analysisKeywords.some(keyword => text.includes(keyword));
        
        if (hasAnalysisKeyword && !text.includes('결과')) {
            text += '\n(분석 결과를 체계적으로 정리하여 제시해주세요)';
        }
        
        return text;
    }

    /**
     * 번역 요청 전처리
     */
    preprocessTranslationRequest(text) {
        // 번역 요청에 원문 언어와 대상 언어 명시
        const translateKeywords = ['번역', 'translate', '영어로', '한국어로'];
        const hasTranslateKeyword = translateKeywords.some(keyword => text.includes(keyword));
        
        if (hasTranslateKeyword && !text.includes('자연스럽')) {
            text += '\n(자연스럽고 일반적인 표현으로 번역해주세요)';
        }
        
        return text;
    }

    /**
     * 문체 조정
     */
    adjustFormality(text, formality) {
        const patterns = this.contextPatterns.get(formality);
        if (!patterns) return text;

        let adjusted = text;

        // 존댓말 조정
        if (formality === 'formal') {
            adjusted = adjusted
                .replace(/해요\.?$/gm, '합니다.')
                .replace(/어요\.?$/gm, '습니다.')
                .replace(/아요\.?$/gm, '습니다.');
        } else if (formality === 'casual') {
            adjusted = adjusted
                .replace(/합니다\.?$/gm, '해요.')
                .replace(/습니다\.?$/gm, '어요.');
        }

        return adjusted;
    }

    /**
     * 응답 후처리
     */
    postprocessResponse(response, taskType = 'korean-chat', options = {}) {
        const {
            improveReadability = true,
            addStructure = true,
            validateKorean = true
        } = options;

        let processed = response;

        if (typeof processed === 'string') {
            // 기본 후처리
            processed = this.postprocessText(processed);
            
            // 가독성 향상
            if (improveReadability) {
                processed = this.improveReadability(processed, taskType);
            }
            
            // 구조 개선
            if (addStructure) {
                processed = this.addStructure(processed, taskType);
            }
            
            // 한국어 품질 검증
            if (validateKorean) {
                const quality = this.validateKoreanQuality(processed);
                if (quality.score < 0.7) {
                    console.warn('한국어 품질이 낮습니다:', quality.issues);
                }
            }
        }

        return processed;
    }

    /**
     * 텍스트 후처리
     */
    postprocessText(text) {
        if (typeof text !== 'string') return text;

        return text
            // 중복 공백 제거
            .replace(/\s{2,}/g, ' ')
            // 문장 부호 정리
            .replace(/([.!?])([가-힣])/g, '$1 $2')
            // 줄바꿈 정리
            .replace(/\n{3,}/g, '\n\n')
            // 불완전한 문장 처리
            .replace(/([가-힣])\s*$/gm, (match, p1) => {
                if (!match.match(/[.!?]$/)) {
                    return match.trim() + '.';
                }
                return match;
            })
            .trim();
    }

    /**
     * 가독성 향상
     */
    improveReadability(text, taskType) {
        let improved = text;

        switch (taskType) {
            case 'code-generation':
                // 코드 블록 구분
                improved = improved.replace(/(```[\s\S]*?```)/g, '\n$1\n');
                break;
            
            case 'analysis':
                // 분석 결과 구조화
                improved = this.structureAnalysisResult(improved);
                break;
                
            case 'tech-support':
                // 기술 지원 단계 구조화
                improved = this.structureTechSupport(improved);
                break;
        }

        return improved;
    }

    /**
     * 분석 결과 구조화
     */
    structureAnalysisResult(text) {
        // 주요 인사이트를 강조 표시
        let structured = text.replace(/(주요 인사이트|Key Insight|결론)/gi, '\n## $1\n');
        
        // 숫자 데이터 강조
        structured = structured.replace(/(\d+(?:[.,]\d+)*[%백만의천개]*)/g, '**$1**');
        
        return structured;
    }

    /**
     * 기술 지원 구조화
     */
    structureTechSupport(text) {
        // 단계별 지침 구조화
        let structured = text.replace(/(단계|Step|[0-9]+\.|\d+\))/gi, '\n### $1');
        
        // 주의사항 강조
        structured = structured.replace(/(주의사항|중요|경고|Warning)/gi, '\n> ⚠️ **$1**');
        
        return structured;
    }

    /**
     * 구조 추가
     */
    addStructure(text, taskType) {
        const template = this.taskTemplates.get(taskType);
        if (!template) return text;

        let structured = text;

        // 마무리 멘트 추가
        if (!text.includes('추가') && !text.includes('도움')) {
            const patterns = this.contextPatterns.get('formal');
            if (patterns && patterns.closings) {
                const randomClosing = patterns.closings[Math.floor(Math.random() * patterns.closings.length)];
                structured += '\n\n' + randomClosing;
            }
        }

        return structured;
    }

    /**
     * 한국어 품질 검증
     */
    validateKoreanQuality(text) {
        const metrics = {
            score: 1.0,
            issues: []
        };

        // 한글 비율 검사
        const koreanChars = (text.match(/[가-힣]/g) || []).length;
        const totalChars = text.replace(/\s/g, '').length;
        const koreanRatio = totalChars > 0 ? koreanChars / totalChars : 0;
        
        if (koreanRatio < 0.3) {
            metrics.score -= 0.3;
            metrics.issues.push('한글 비율이 낮음');
        }

        // 문장 부호 검사
        const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
        const incompleteSentences = sentences.filter(s => 
            s.trim().length > 10 && !/[가-힣]$/.test(s.trim())
        ).length;
        
        if (incompleteSentences > sentences.length * 0.3) {
            metrics.score -= 0.2;
            metrics.issues.push('불완전한 문장이 많음');
        }

        // 존댓말 일관성 검사
        const formalEndings = text.match(/[습십]니다/g) || [];
        const casualEndings = text.match(/[어아여야]요/g) || [];
        
        if (formalEndings.length > 0 && casualEndings.length > 0) {
            const ratio = Math.min(formalEndings.length, casualEndings.length) / 
                         Math.max(formalEndings.length, casualEndings.length);
            if (ratio > 0.3) {
                metrics.score -= 0.1;
                metrics.issues.push('존댓말 일관성 부족');
            }
        }

        // 단어 반복 검사
        const words = text.match(/[가-힣]+/g) || [];
        const wordCount = {};
        words.forEach(word => {
            if (word.length > 1) {
                wordCount[word] = (wordCount[word] || 0) + 1;
            }
        });
        
        const repeatedWords = Object.values(wordCount).filter(count => count > 5).length;
        if (repeatedWords > 0) {
            metrics.score -= 0.1;
            metrics.issues.push('단어 과도 반복');
        }

        return metrics;
    }

    /**
     * 작업 유형 감지
     */
    detectTaskType(text) {
        const patterns = {
            'code-generation': ['코드', '프로그램', '함수', '클래스', '스크립트', 'javascript', 'python'],
            'analysis': ['분석', '데이터', '통계', '결과', '리포트', '인사이트'],
            'translation': ['번역', 'translate', '영어로', '한국어로', '중국어로'],
            'tech-support': ['오류', '문제', '설치', '설정', '해결', '도움말', '지원']
        };

        const scores = {};
        
        Object.entries(patterns).forEach(([taskType, keywords]) => {
            scores[taskType] = keywords.reduce((score, keyword) => {
                const regex = new RegExp(keyword, 'gi');
                const matches = (text.match(regex) || []).length;
                return score + matches;
            }, 0);
        });

        const maxScore = Math.max(...Object.values(scores));
        if (maxScore === 0) return 'korean-chat';
        
        return Object.entries(scores).find(([_, score]) => score === maxScore)[0];
    }

    /**
     * 컴텍스트 기반 프롬프트 생성
     */
    generateContextualPrompt(userMessage, conversationHistory = [], taskType = null) {
        // 작업 유형 자동 감지
        const detectedTaskType = taskType || this.detectTaskType(userMessage);
        const template = this.taskTemplates.get(detectedTaskType) || this.taskTemplates.get('korean-chat');
        
        // 대화 내역에서 컴텍스트 추출
        const recentContext = conversationHistory
            .slice(-3) // 최근 3개 대화
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n');
        
        let contextualPrompt = template.systemPrompt;
        
        if (recentContext) {
            contextualPrompt += `\n\n이전 대화 내용:\n${recentContext}\n\n${template.contextInstructions}`;
        }
        
        return {
            systemPrompt: contextualPrompt,
            taskType: detectedTaskType,
            template: template
        };
    }

    /**
     * 팩터리 메서드: 전체 메시지 처리
     */
    processMessages(messages, options = {}) {
        const {
            taskType = null,
            formality = 'formal',
            addSystemPrompt = true
        } = options;

        // 작업 유형 감지
        const userMessages = messages.filter(m => m.role === 'user');
        const lastUserMessage = userMessages[userMessages.length - 1];
        const detectedTaskType = taskType || (lastUserMessage ? this.detectTaskType(lastUserMessage.content) : 'korean-chat');
        
        let processedMessages = [...messages];
        
        // 시스템 프롬프트 추가
        if (addSystemPrompt && !messages.some(m => m.role === 'system')) {
            const contextualPrompt = this.generateContextualPrompt(
                lastUserMessage?.content || '',
                messages,
                detectedTaskType
            );
            
            processedMessages.unshift({
                role: 'system',
                content: contextualPrompt.systemPrompt
            });
        }
        
        // 모든 메시지 전처리
        processedMessages = processedMessages.map(message => 
            this.preprocessMessage(message, detectedTaskType, { formality })
        );
        
        return {
            messages: processedMessages,
            taskType: detectedTaskType
        };
    }
}

module.exports = KoreanLanguageProcessor;