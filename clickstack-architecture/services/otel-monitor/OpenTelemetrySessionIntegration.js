/**
 * OpenTelemetry에서 세션 리플레이 시스템으로의 통합 연계 모듈
 * AIRIS APM 시스템용 OpenTelemetry → Session Replay 브릿지
 */

const { SpanProcessor, SpanExporter } = require('@opentelemetry/sdk-trace-base');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { getNodeSDK } = require('@opentelemetry/auto-instrumentations-node');
const axios = require('axios');

class SessionReplaySpanExporter {
    constructor(config = {}) {
        this.config = {
            sessionReplayApiUrl: config.sessionReplayApiUrl || 'http://localhost:3004/api',
            batchSize: config.batchSize || 50,
            timeout: config.timeout || 10000,
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000,
            ...config
        };

        this.pendingSpans = [];
        this.sessionMappings = new Map(); // traceId -> sessionId 매핑
        this.exportTimer = null;
        
        this.metrics = {
            spansExported: 0,
            correlationsCreated: 0,
            errors: 0,
            lastExport: null
        };

        console.log('SessionReplaySpanExporter 초기화됨', {
            apiUrl: this.config.sessionReplayApiUrl,
            batchSize: this.config.batchSize
        });
    }

    /**
     * OpenTelemetry Span을 세션 리플레이 시스템으로 내보내기
     */
    async export(spans, resultCallback) {
        try {
            console.log(`${spans.length}개 span 내보내기 시작`);
            
            const correlationData = await this.processSpans(spans);
            
            if (correlationData.length > 0) {
                await this.sendCorrelationData(correlationData);
                this.metrics.spansExported += spans.length;
                this.metrics.correlationsCreated += correlationData.length;
                this.metrics.lastExport = new Date();
            }

            resultCallback({ code: 0 }); // SUCCESS

        } catch (error) {
            this.metrics.errors++;
            console.error('Span 내보내기 실패:', error.message);
            resultCallback({ code: 1, error }); // FAILED
        }
    }

    /**
     * Span 데이터 처리 및 상관관계 데이터 생성
     */
    async processSpans(spans) {
        const correlationData = [];

        for (const span of spans) {
            try {
                const sessionId = await this.findOrCreateSessionMapping(span);
                if (!sessionId) continue;

                const correlation = this.createCorrelationData(span, sessionId);
                if (correlation) {
                    correlationData.push(correlation);
                }

                // 페이지 뷰 이벤트 감지 및 처리
                if (this.isPageViewSpan(span)) {
                    const pageViewData = this.createPageViewData(span, sessionId);
                    if (pageViewData) {
                        correlationData.push({
                            type: 'pageview',
                            sessionId,
                            data: pageViewData
                        });
                    }
                }

                // 에러 스팬 감지 및 인사이트 생성
                if (this.isErrorSpan(span)) {
                    const insightData = this.createErrorInsight(span, sessionId);
                    if (insightData) {
                        correlationData.push({
                            type: 'insight',
                            sessionId,
                            data: insightData
                        });
                    }
                }

            } catch (error) {
                console.error('Span 처리 중 오류:', {
                    spanId: span.spanId,
                    traceId: span.traceId,
                    error: error.message
                });
            }
        }

        return correlationData;
    }

    /**
     * 세션 매핑 찾기 또는 생성
     */
    async findOrCreateSessionMapping(span) {
        const traceId = span.traceId;
        
        // 기존 매핑 확인
        if (this.sessionMappings.has(traceId)) {
            return this.sessionMappings.get(traceId);
        }

        // 새로운 세션 생성
        try {
            const sessionId = await this.createNewSession(span);
            if (sessionId) {
                this.sessionMappings.set(traceId, sessionId);
                
                // 매핑 자동 정리 (1시간 후)
                setTimeout(() => {
                    this.sessionMappings.delete(traceId);
                }, 60 * 60 * 1000);
                
                return sessionId;
            }
        } catch (error) {
            console.error('세션 매핑 생성 실패:', {
                traceId,
                error: error.message
            });
        }

        return null;
    }

    /**
     * 새로운 세션 생성
     */
    async createNewSession(span) {
        try {
            const sessionData = {
                otelSessionId: `otel-${span.traceId}`,
                otelTraceId: span.traceId,
                userId: this.extractUserId(span),
                geoLocation: this.extractGeoLocation(span)
            };

            const response = await this.makeApiCall('/sessions', 'POST', sessionData);
            
            if (response.success && response.data) {
                const sessionId = response.data.airis_session_id;
                console.log('새로운 세션 생성됨:', {
                    sessionId,
                    traceId: span.traceId,
                    otelSessionId: sessionData.otelSessionId
                });
                return sessionId;
            }

        } catch (error) {
            console.error('세션 생성 API 호출 실패:', error.message);
        }

        return null;
    }

    /**
     * 상관관계 데이터 생성
     */
    createCorrelationData(span, sessionId) {
        const startTime = new Date(span.startTime[0] * 1000 + span.startTime[1] / 1000000);
        const endTime = new Date(span.endTime[0] * 1000 + span.endTime[1] / 1000000);
        const durationUs = (span.endTime[0] - span.startTime[0]) * 1000000 + (span.endTime[1] - span.startTime[1]) / 1000;

        return {
            type: 'correlation',
            sessionId,
            data: {
                otelSpanId: span.spanId,
                otelTraceId: span.traceId,
                otelServiceName: this.extractServiceName(span),
                otelOperationName: span.name,
                otelStartTime: startTime.toISOString(),
                otelEndTime: endTime.toISOString(),
                otelDurationUs: Math.round(durationUs),
                replayEventTimestamp: startTime.toISOString(),
                replayEventType: this.determineEventType(span),
                replayEventData: {
                    spanKind: span.kind,
                    attributes: span.attributes || {},
                    resource: span.resource?.attributes || {},
                    status: span.status
                },
                isError: span.status?.code === 2, // ERROR
                errorMessage: span.status?.message,
                httpStatusCode: span.attributes?.['http.status_code']
            }
        };
    }

    /**
     * 페이지 뷰 데이터 생성
     */
    createPageViewData(span, sessionId) {
        if (!this.isPageViewSpan(span)) return null;

        const startTime = new Date(span.startTime[0] * 1000 + span.startTime[1] / 1000000);
        const endTime = new Date(span.endTime[0] * 1000 + span.endTime[1] / 1000000);
        const durationMs = endTime - startTime;

        return {
            pageUrl: span.attributes?.['http.url'] || span.attributes?.['http.target'] || 'unknown',
            pageTitle: span.attributes?.['http.route'] || span.name,
            pageLoadTime: startTime.toISOString(),
            pageUnloadTime: endTime.toISOString(),
            timeSpentMs: durationMs,
            domContentLoadedMs: span.attributes?.['browser.dom_content_loaded'] || null,
            firstContentfulPaintMs: span.attributes?.['browser.first_contentful_paint'] || null,
            largestContentfulPaintMs: span.attributes?.['browser.largest_contentful_paint'] || null,
            otelPageSpanId: span.spanId,
            otelPageTraceId: span.traceId,
            clickCount: span.attributes?.['user.click_count'] || 0,
            scrollDepthPercentage: span.attributes?.['user.scroll_depth'] || 0,
            formInteractions: span.attributes?.['user.form_interactions'] || 0,
            errorCount: span.status?.code === 2 ? 1 : 0
        };
    }

    /**
     * 에러 인사이트 데이터 생성
     */
    createErrorInsight(span, sessionId) {
        if (!this.isErrorSpan(span)) return null;

        const severity = this.calculateErrorSeverity(span);
        const category = this.determineErrorCategory(span);

        return {
            analysisType: 'error_analysis',
            insightTitle: `OpenTelemetry 에러 감지: ${span.name}`,
            insightDescription: span.status?.message || '알 수 없는 에러가 발생했습니다',
            insightSeverity: severity,
            insightCategory: category,
            metricName: 'error_count',
            metricValue: 1,
            metricUnit: 'count',
            recommendations: this.generateErrorRecommendations(span),
            estimatedImpact: severity === 'critical' ? 'high' : severity === 'high' ? 'medium' : 'low',
            relatedSpans: [span.spanId],
            relatedEvents: {
                spanName: span.name,
                spanKind: span.kind,
                serviceName: this.extractServiceName(span),
                attributes: span.attributes || {}
            }
        };
    }

    /**
     * 상관관계 데이터를 세션 리플레이 API로 전송
     */
    async sendCorrelationData(correlationData) {
        const batches = this.createBatches(correlationData, this.config.batchSize);

        for (const batch of batches) {
            await this.sendBatch(batch);
        }
    }

    /**
     * 배치 단위로 데이터 전송
     */
    async sendBatch(batch) {
        const groupedBySession = this.groupBySession(batch);

        for (const [sessionId, events] of groupedBySession.entries()) {
            for (const event of events) {
                try {
                    await this.sendSingleEvent(sessionId, event);
                } catch (error) {
                    console.error('이벤트 전송 실패:', {
                        sessionId,
                        eventType: event.type,
                        error: error.message
                    });
                }
            }
        }
    }

    /**
     * 개별 이벤트 전송
     */
    async sendSingleEvent(sessionId, event) {
        let endpoint;
        let method = 'POST';
        let data = event.data;

        switch (event.type) {
            case 'correlation':
                endpoint = `/sessions/${sessionId}/correlations`;
                break;
            case 'pageview':
                endpoint = `/sessions/${sessionId}/pageviews`;
                break;
            case 'insight':
                endpoint = `/sessions/${sessionId}/insights`;
                break;
            default:
                throw new Error(`지원하지 않는 이벤트 타입: ${event.type}`);
        }

        const response = await this.makeApiCall(endpoint, method, data);
        
        if (response.success) {
            console.log(`${event.type} 이벤트 전송 성공:`, {
                sessionId,
                endpoint,
                dataId: response.data?.id
            });
        } else {
            throw new Error(response.message || '알 수 없는 API 오류');
        }
    }

    /**
     * API 호출 헬퍼
     */
    async makeApiCall(endpoint, method = 'GET', data = null) {
        const url = `${this.config.sessionReplayApiUrl}${endpoint}`;
        const config = {
            method,
            url,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'AIRIS-OpenTelemetry-Integration/1.0.0'
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.data = data;
        }

        let attempts = 0;
        while (attempts < this.config.retryAttempts) {
            try {
                const response = await axios(config);
                return response.data;
            } catch (error) {
                attempts++;
                
                if (attempts >= this.config.retryAttempts) {
                    throw new Error(`API 호출 실패 (${attempts}회 시도): ${error.message}`);
                }
                
                console.warn(`API 호출 재시도 (${attempts}/${this.config.retryAttempts}):`, {
                    url,
                    error: error.message
                });
                
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempts));
            }
        }
    }

    // === 유틸리티 메서드들 ===

    isPageViewSpan(span) {
        return span.kind === 1 && // SERVER
               (span.attributes?.['http.method'] === 'GET' &&
                span.attributes?.['http.url'] &&
                !span.attributes?.['http.url'].includes('/api/'));
    }

    isErrorSpan(span) {
        return span.status?.code === 2; // ERROR
    }

    determineEventType(span) {
        if (span.attributes?.['http.method']) return 'http_request';
        if (span.attributes?.['db.statement']) return 'database_query';
        if (span.attributes?.['messaging.operation']) return 'message_processing';
        return 'operation';
    }

    extractServiceName(span) {
        return span.resource?.attributes?.[SemanticResourceAttributes.SERVICE_NAME] || 'unknown-service';
    }

    extractUserId(span) {
        return span.attributes?.['user.id'] || 
               span.attributes?.['enduser.id'] || 
               span.attributes?.['user.name'] || 
               null;
    }

    extractGeoLocation(span) {
        const country = span.attributes?.['user.country'];
        const region = span.attributes?.['user.region'];
        const city = span.attributes?.['user.city'];
        
        if (country || region || city) {
            return { country, region, city };
        }
        return null;
    }

    calculateErrorSeverity(span) {
        const statusCode = span.attributes?.['http.status_code'];
        
        if (statusCode >= 500) return 'critical';
        if (statusCode >= 400) return 'high';
        if (span.status?.code === 2) return 'medium';
        return 'low';
    }

    determineErrorCategory(span) {
        const statusCode = span.attributes?.['http.status_code'];
        
        if (statusCode === 401 || statusCode === 403) return 'security';
        if (statusCode >= 500) return 'performance';
        if (statusCode >= 400) return 'ux';
        return 'error';
    }

    generateErrorRecommendations(span) {
        const statusCode = span.attributes?.['http.status_code'];
        const recommendations = [];

        if (statusCode >= 500) {
            recommendations.push('서버 로그 확인 및 에러 원인 분석');
            recommendations.push('서버 리소스 모니터링 강화');
        } else if (statusCode >= 400) {
            recommendations.push('클라이언트 요청 검증 로직 개선');
            recommendations.push('사용자 입력 가이드 제공');
        }

        recommendations.push('해당 트레이스의 세션 리플레이 확인');
        return recommendations;
    }

    createBatches(data, batchSize) {
        const batches = [];
        for (let i = 0; i < data.length; i += batchSize) {
            batches.push(data.slice(i, i + batchSize));
        }
        return batches;
    }

    groupBySession(events) {
        const grouped = new Map();
        
        events.forEach(event => {
            if (!grouped.has(event.sessionId)) {
                grouped.set(event.sessionId, []);
            }
            grouped.get(event.sessionId).push(event);
        });

        return grouped;
    }

    /**
     * 내보내기 종료 처리
     */
    async shutdown() {
        try {
            console.log('SessionReplaySpanExporter 종료 중...');
            
            if (this.exportTimer) {
                clearInterval(this.exportTimer);
            }

            // 대기 중인 span들 처리
            if (this.pendingSpans.length > 0) {
                await this.export(this.pendingSpans, () => {});
                this.pendingSpans = [];
            }

            console.log('SessionReplaySpanExporter 종료 완료');
            return Promise.resolve();
        } catch (error) {
            console.error('SessionReplaySpanExporter 종료 실패:', error.message);
            return Promise.resolve(); // ExportResult.SUCCESS
        }
    }

    /**
     * 메트릭 조회
     */
    getMetrics() {
        return {
            ...this.metrics,
            pendingSpans: this.pendingSpans.length,
            activeSessions: this.sessionMappings.size
        };
    }
}

/**
 * OpenTelemetry에 세션 리플레이 통합을 설정하는 팩토리 함수
 */
function setupOpenTelemetrySessionIntegration(config = {}) {
    const exporter = new SessionReplaySpanExporter(config);
    
    // SpanProcessor를 사용하여 실시간으로 span을 처리
    class SessionReplaySpanProcessor {
        constructor(exporter) {
            this.exporter = exporter;
        }

        onStart(span) {
            // Span 시작 시 처리할 로직이 있다면 여기에 추가
        }

        onEnd(span) {
            // Span 종료 시 즉시 처리
            this.exporter.export([span], () => {});
        }

        shutdown() {
            return this.exporter.shutdown();
        }

        forceFlush() {
            return Promise.resolve();
        }
    }

    console.log('OpenTelemetry 세션 리플레이 통합 설정 완료');
    
    return {
        exporter,
        processor: new SessionReplaySpanProcessor(exporter),
        getMetrics: () => exporter.getMetrics()
    };
}

module.exports = {
    SessionReplaySpanExporter,
    setupOpenTelemetrySessionIntegration
};