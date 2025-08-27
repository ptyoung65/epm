/**
 * AIRIS 통합 세션 추적기 - OpenTelemetry 연계 강화 버전
 * 세션 리플레이와 OpenTelemetry 메트릭을 실시간으로 연계하여 통합 추적하는 클라이언트 라이브러리
 */

(function(global) {
    'use strict';

    // 설정 상수
    const CONFIG = {
        sendBatchSize: 20,          // 배치 크기
        sendInterval: 3000,         // 자동 전송 간격 (3초)
        pageChangeDelay: 500,       // 페이지 변경 지연
        maxEventBuffer: 1000,       // 최대 이벤트 버퍼 크기
        apiTimeout: 10000,          // API 타임아웃
        retryAttempts: 3,           // 재시도 횟수
        retryDelay: 1000,           // 재시도 지연
        
        // OpenTelemetry 연계 설정
        otelTrackingEnabled: true,  // OpenTelemetry 연계 활성화
        otelCorrelationEnabled: true, // 상관관계 분석 활성화
        performanceMetrics: true,   // 성능 메트릭 수집
        userInteractionTracking: true, // 사용자 상호작용 추적
        
        // API 엔드포인트
        apiBaseUrl: '/api',
        endpoints: {
            sessions: '/sessions',
            events: '/sessions/{sessionId}/events',
            correlations: '/sessions/{sessionId}/correlations',
            pageviews: '/sessions/{sessionId}/pageviews',
            complete: '/sessions/{sessionId}/complete'
        }
    };

    class AIRISSessionTracker {
        constructor(options = {}) {
            this.config = { ...CONFIG, ...options };
            
            // 세션 상태
            this.sessionId = null;
            this.otelSessionId = null;
            this.otelTraceId = null;
            this.isRecording = false;
            this.isInitialized = false;
            
            // 이벤트 버퍼링
            this.eventBuffer = [];
            this.correlationBuffer = [];
            this.performanceBuffer = [];
            
            // rrweb 관련
            this.rrwebStopFn = null;
            this.eventCount = 0;
            
            // 타이머 및 리스너
            this.sendTimer = null;
            this.beforeUnloadHandler = null;
            this.visibilityChangeHandler = null;
            
            // 성능 및 상호작용 추적
            this.pageStartTime = Date.now();
            this.interactionMetrics = {
                clicks: 0,
                scrollDepth: 0,
                formInteractions: 0,
                timeSpent: 0
            };
            
            // OpenTelemetry 통합
            this.otelObserver = null;
            this.correlationMap = new Map(); // timestamp -> otel data
            
            this.logger = this.createLogger();
            
            this.logger.info('AIRIS 통합 세션 추적기 초기화됨', {
                config: this.config,
                otelEnabled: this.config.otelTrackingEnabled
            });
        }

        /**
         * 세션 추적 시작
         */
        async start(options = {}) {
            try {
                if (this.isRecording) {
                    this.logger.warn('이미 기록 중입니다');
                    return false;
                }

                this.logger.info('세션 추적 시작 중...');
                
                // 세션 생성 또는 복원
                await this.initializeSession(options);
                
                // rrweb 기록 시작
                this.startRRWebRecording();
                
                // OpenTelemetry 연계 설정
                if (this.config.otelTrackingEnabled) {
                    this.setupOpenTelemetryIntegration();
                }
                
                // 성능 및 상호작용 추적 시작
                this.startPerformanceTracking();
                this.startUserInteractionTracking();
                
                // 자동 전송 타이머 시작
                this.startAutoSend();
                
                // 페이지 이벤트 리스너 설정
                this.setupPageEventListeners();
                
                this.isRecording = true;
                this.isInitialized = true;
                
                this.logger.info('세션 추적 시작됨', {
                    sessionId: this.sessionId,
                    otelSessionId: this.otelSessionId,
                    url: window.location.href
                });

                // 초기 페이지뷰 기록
                await this.recordPageView();
                
                return true;

            } catch (error) {
                this.logger.error('세션 추적 시작 실패', { error: error.message });
                return false;
            }
        }

        /**
         * 세션 초기화
         */
        async initializeSession(options) {
            // sessionStorage에서 기존 세션 정보 확인
            const existingSession = this.loadSessionFromStorage();
            
            if (existingSession && existingSession.sessionId) {
                // 기존 세션 복원
                this.sessionId = existingSession.sessionId;
                this.otelSessionId = existingSession.otelSessionId;
                this.otelTraceId = existingSession.otelTraceId;
                this.eventCount = existingSession.eventCount || 0;
                
                this.logger.info('기존 세션 복원됨', {
                    sessionId: this.sessionId,
                    otelSessionId: this.otelSessionId
                });
                
            } else {
                // 새 세션 생성
                await this.createNewSession(options);
            }
        }

        /**
         * 새 세션 생성
         */
        async createNewSession(options) {
            this.sessionId = this.generateSessionId();
            
            // OpenTelemetry 정보 감지 시도
            if (this.config.otelTrackingEnabled) {
                this.detectOpenTelemetryContext();
            }
            
            const sessionData = {
                sessionId: this.sessionId,
                otelSessionId: this.otelSessionId,
                otelTraceId: this.otelTraceId,
                userId: options.userId,
                geoLocation: await this.detectGeoLocation(),
                ...options
            };

            try {
                const response = await this.makeApiCall('POST', CONFIG.endpoints.sessions, sessionData);
                
                if (response.success) {
                    this.sessionId = response.data.airis_session_id;
                    this.saveSessionToStorage();
                    
                    this.logger.info('새 세션 생성됨', {
                        sessionId: this.sessionId,
                        otelSessionId: this.otelSessionId
                    });
                } else {
                    throw new Error(response.message || '세션 생성 실패');
                }

            } catch (error) {
                this.logger.warn('서버 세션 생성 실패, 로컬에서만 동작', { error: error.message });
                this.saveSessionToStorage();
            }
        }

        /**
         * OpenTelemetry 컨텍스트 감지
         */
        detectOpenTelemetryContext() {
            try {
                // 전역 OpenTelemetry API 확인
                if (window.opentelemetry || window.__OTEL_API__) {
                    const api = window.opentelemetry || window.__OTEL_API__;
                    const activeSpan = api.trace?.getActiveSpan?.();
                    
                    if (activeSpan) {
                        const spanContext = activeSpan.spanContext();
                        this.otelTraceId = spanContext.traceId;
                        this.otelSessionId = `otel-session-${spanContext.traceId}`;
                        
                        this.logger.info('OpenTelemetry 컨텍스트 감지됨', {
                            traceId: this.otelTraceId,
                            spanId: spanContext.spanId
                        });
                    }
                }

                // HTTP 헤더에서 trace ID 확인 (만약 설정된 경우)
                if (!this.otelTraceId && document.currentScript) {
                    const traceId = document.currentScript.getAttribute('data-trace-id');
                    if (traceId) {
                        this.otelTraceId = traceId;
                        this.otelSessionId = `otel-session-${traceId}`;
                    }
                }

                // 쿠키에서 trace ID 확인
                if (!this.otelTraceId) {
                    const traceCookie = document.cookie
                        .split('; ')
                        .find(row => row.startsWith('otel-trace-id='));
                    
                    if (traceCookie) {
                        this.otelTraceId = traceCookie.split('=')[1];
                        this.otelSessionId = `otel-session-${this.otelTraceId}`;
                    }
                }

            } catch (error) {
                this.logger.debug('OpenTelemetry 컨텍스트 감지 실패', { error: error.message });
            }
        }

        /**
         * OpenTelemetry 통합 설정
         */
        setupOpenTelemetryIntegration() {
            if (!this.config.otelCorrelationEnabled) return;

            try {
                // Performance Observer로 네트워크 요청 감지
                if ('PerformanceObserver' in window) {
                    this.otelObserver = new PerformanceObserver((list) => {
                        list.getEntries().forEach(entry => {
                            this.processPerformanceEntry(entry);
                        });
                    });
                    
                    this.otelObserver.observe({ entryTypes: ['navigation', 'resource', 'measure', 'mark'] });
                }

                // 네트워크 요청 인터셉트
                this.interceptNetworkRequests();

                this.logger.info('OpenTelemetry 통합 설정 완료');

            } catch (error) {
                this.logger.error('OpenTelemetry 통합 설정 실패', { error: error.message });
            }
        }

        /**
         * 성능 엔트리 처리
         */
        processPerformanceEntry(entry) {
            const correlationData = {
                timestamp: Date.now(),
                type: entry.entryType,
                name: entry.name,
                duration: entry.duration,
                startTime: entry.startTime,
                
                // 네트워크 요청 관련 정보
                ...(entry.entryType === 'resource' && {
                    transferSize: entry.transferSize,
                    encodedBodySize: entry.encodedBodySize,
                    decodedBodySize: entry.decodedBodySize,
                    responseStart: entry.responseStart,
                    responseEnd: entry.responseEnd
                }),
                
                // 페이지 네비게이션 관련 정보
                ...(entry.entryType === 'navigation' && {
                    domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
                    loadComplete: entry.loadEventEnd - entry.loadEventStart,
                    firstPaint: entry.responseEnd - entry.requestStart
                })
            };

            this.correlationBuffer.push(correlationData);
            
            // 버퍼가 가득 차면 전송
            if (this.correlationBuffer.length >= this.config.sendBatchSize) {
                this.sendCorrelationBatch();
            }
        }

        /**
         * 네트워크 요청 인터셉트
         */
        interceptNetworkRequests() {
            // fetch 인터셉트
            const originalFetch = window.fetch;
            window.fetch = (...args) => {
                const startTime = Date.now();
                
                return originalFetch.apply(window, args)
                    .then(response => {
                        this.recordNetworkRequest('fetch', args[0], startTime, response);
                        return response;
                    })
                    .catch(error => {
                        this.recordNetworkRequest('fetch', args[0], startTime, null, error);
                        throw error;
                    });
            };

            // XMLHttpRequest 인터셉트
            const originalXHROpen = XMLHttpRequest.prototype.open;
            const originalXHRSend = XMLHttpRequest.prototype.send;
            
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
                this._airis_method = method;
                this._airis_url = url;
                this._airis_startTime = Date.now();
                return originalXHROpen.apply(this, [method, url, ...args]);
            };
            
            XMLHttpRequest.prototype.send = function(...args) {
                const xhr = this;
                
                xhr.addEventListener('load', function() {
                    window.airisTracker?.recordNetworkRequest('xhr', xhr._airis_url, xhr._airis_startTime, {
                        status: xhr.status,
                        statusText: xhr.statusText
                    });
                });
                
                xhr.addEventListener('error', function() {
                    window.airisTracker?.recordNetworkRequest('xhr', xhr._airis_url, xhr._airis_startTime, null, new Error('Network error'));
                });
                
                return originalXHRSend.apply(this, args);
            };
        }

        /**
         * 네트워크 요청 기록
         */
        recordNetworkRequest(type, url, startTime, response, error = null) {
            const endTime = Date.now();
            const duration = endTime - startTime;

            const networkData = {
                type: 'network_request',
                method: type,
                url: typeof url === 'string' ? url : url.url || url.href,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
                duration,
                success: !error,
                ...(response && {
                    status: response.status || response.status,
                    statusText: response.statusText || response.statusText
                }),
                ...(error && {
                    error: error.message
                })
            };

            this.correlationBuffer.push(networkData);
        }

        /**
         * rrweb 기록 시작
         */
        startRRWebRecording() {
            if (!window.rrweb) {
                this.logger.error('rrweb 라이브러리가 로드되지 않았습니다');
                return;
            }

            const recordConfig = {
                emit: (event) => {
                    this.handleRRWebEvent(event);
                },
                checkoutEveryNth: 100,
                checkoutEveryNms: 60000,
                maskAllInputs: true,
                maskTextSelector: '.sensitive',
                blockSelector: '.blocked',
                ignoreSelector: '.ignore-recording',
                sampling: {
                    scroll: 150,
                    mousemove: 50,
                    mouseinteraction: true,
                    input: 'all'
                }
            };

            try {
                this.rrwebStopFn = window.rrweb.record(recordConfig);
                this.logger.info('rrweb 기록 시작됨');
            } catch (error) {
                this.logger.error('rrweb 기록 시작 실패', { error: error.message });
            }
        }

        /**
         * rrweb 이벤트 처리
         */
        handleRRWebEvent(event) {
            this.eventCount++;
            
            // 이벤트에 타임스탬프와 세션 정보 추가
            const enhancedEvent = {
                ...event,
                sessionId: this.sessionId,
                otelSessionId: this.otelSessionId,
                otelTraceId: this.otelTraceId,
                url: window.location.href,
                userAgent: navigator.userAgent,
                timestamp: Date.now()
            };

            this.eventBuffer.push(enhancedEvent);
            
            // 사용자 상호작용 메트릭 업데이트
            this.updateInteractionMetrics(event);
            
            // 버퍼가 가득 차면 전송
            if (this.eventBuffer.length >= this.config.sendBatchSize) {
                this.sendEventBatch();
            }
        }

        /**
         * 상호작용 메트릭 업데이트
         */
        updateInteractionMetrics(event) {
            switch (event.type) {
                case 3: // IncrementalSource
                    if (event.data.source === 2) { // MouseMove
                        // 마우스 이동은 별도 처리 안함 (너무 빈번)
                    } else if (event.data.source === 3) { // MouseInteraction
                        if (event.data.type === 0 || event.data.type === 1) { // Click
                            this.interactionMetrics.clicks++;
                        }
                    } else if (event.data.source === 4) { // Scroll
                        const scrollTop = event.data.y || 0;
                        const documentHeight = document.documentElement.scrollHeight;
                        const windowHeight = window.innerHeight;
                        
                        if (documentHeight > windowHeight) {
                            const scrollDepth = Math.round((scrollTop + windowHeight) / documentHeight * 100);
                            this.interactionMetrics.scrollDepth = Math.max(this.interactionMetrics.scrollDepth, scrollDepth);
                        }
                    } else if (event.data.source === 5) { // Input
                        this.interactionMetrics.formInteractions++;
                    }
                    break;
            }
        }

        /**
         * 성능 추적 시작
         */
        startPerformanceTracking() {
            if (!this.config.performanceMetrics) return;

            // 페이지 로드 성능 메트릭 수집
            if (document.readyState === 'complete') {
                this.collectPagePerformance();
            } else {
                window.addEventListener('load', () => {
                    setTimeout(() => this.collectPagePerformance(), 0);
                });
            }

            // 정기적 성능 메트릭 수집
            setInterval(() => {
                this.collectRuntimePerformance();
            }, 30000); // 30초마다
        }

        /**
         * 페이지 성능 메트릭 수집
         */
        collectPagePerformance() {
            try {
                const navigation = performance.getEntriesByType('navigation')[0];
                const paint = performance.getEntriesByType('paint');
                
                const performanceData = {
                    type: 'page_performance',
                    timestamp: Date.now(),
                    url: window.location.href,
                    
                    // 페이지 로드 타이밍
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                    firstByteTime: navigation.responseStart - navigation.requestStart,
                    domInteractive: navigation.domInteractive - navigation.domLoading,
                    
                    // 페인트 메트릭
                    firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                    firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
                    
                    // 리소스 타이밍
                    totalResources: performance.getEntriesByType('resource').length,
                    transferSize: navigation.transferSize || 0,
                    
                    // 메모리 정보 (가능한 경우)
                    ...(performance.memory && {
                        memoryUsed: performance.memory.usedJSHeapSize,
                        memoryTotal: performance.memory.totalJSHeapSize,
                        memoryLimit: performance.memory.jsHeapSizeLimit
                    })
                };

                this.performanceBuffer.push(performanceData);

            } catch (error) {
                this.logger.debug('페이지 성능 수집 실패', { error: error.message });
            }
        }

        /**
         * 런타임 성능 메트릭 수집
         */
        collectRuntimePerformance() {
            try {
                const now = Date.now();
                this.interactionMetrics.timeSpent = now - this.pageStartTime;

                const runtimeData = {
                    type: 'runtime_performance',
                    timestamp: now,
                    url: window.location.href,
                    
                    // 사용자 상호작용 메트릭
                    ...this.interactionMetrics,
                    
                    // 현재 메모리 사용량 (가능한 경우)
                    ...(performance.memory && {
                        currentMemoryUsed: performance.memory.usedJSHeapSize
                    }),
                    
                    // 연결 정보 (가능한 경우)
                    ...(navigator.connection && {
                        connectionType: navigator.connection.effectiveType,
                        downlink: navigator.connection.downlink,
                        rtt: navigator.connection.rtt
                    })
                };

                this.performanceBuffer.push(runtimeData);

            } catch (error) {
                this.logger.debug('런타임 성능 수집 실패', { error: error.message });
            }
        }

        /**
         * 사용자 상호작용 추적 시작
         */
        startUserInteractionTracking() {
            if (!this.config.userInteractionTracking) return;

            // 추가적인 사용자 상호작용 리스너
            document.addEventListener('click', (event) => {
                this.recordUserInteraction('click', event);
            });

            document.addEventListener('scroll', (event) => {
                this.recordUserInteraction('scroll', event);
            }, { passive: true });

            document.addEventListener('keydown', (event) => {
                this.recordUserInteraction('keydown', event);
            });

            // 폼 상호작용 추적
            document.addEventListener('input', (event) => {
                if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                    this.recordUserInteraction('form_input', event);
                }
            });

            document.addEventListener('change', (event) => {
                if (event.target.tagName === 'SELECT') {
                    this.recordUserInteraction('form_change', event);
                }
            });
        }

        /**
         * 사용자 상호작용 기록
         */
        recordUserInteraction(type, event) {
            const interactionData = {
                type: 'user_interaction',
                interactionType: type,
                timestamp: Date.now(),
                url: window.location.href,
                target: {
                    tagName: event.target?.tagName,
                    id: event.target?.id,
                    className: event.target?.className,
                    textContent: event.target?.textContent?.substring(0, 100) // 처음 100자만
                },
                ...(type === 'click' && {
                    clickX: event.clientX,
                    clickY: event.clientY
                }),
                ...(type === 'scroll' && {
                    scrollX: window.scrollX,
                    scrollY: window.scrollY
                }),
                ...(type === 'keydown' && {
                    keyCode: event.keyCode,
                    key: event.key
                })
            };

            this.correlationBuffer.push(interactionData);
        }

        /**
         * 페이지 뷰 기록
         */
        async recordPageView() {
            try {
                const pageViewData = {
                    pageUrl: window.location.href,
                    pageTitle: document.title,
                    pageLoadTime: new Date().toISOString(),
                    domContentLoadedMs: this.getDOMContentLoadedTime(),
                    firstContentfulPaintMs: this.getFirstContentfulPaint(),
                    largestContentfulPaintMs: this.getLargestContentfulPaint(),
                    otelPageSpanId: this.generateSpanId(),
                    otelPageTraceId: this.otelTraceId,
                    clickCount: this.interactionMetrics.clicks,
                    scrollDepthPercentage: this.interactionMetrics.scrollDepth,
                    formInteractions: this.interactionMetrics.formInteractions
                };

                const endpoint = CONFIG.endpoints.pageviews.replace('{sessionId}', this.sessionId);
                await this.makeApiCall('POST', endpoint, pageViewData);
                
                this.logger.info('페이지뷰 기록됨', { url: pageViewData.pageUrl });

            } catch (error) {
                this.logger.error('페이지뷰 기록 실패', { error: error.message });
            }
        }

        /**
         * 이벤트 배치 전송
         */
        async sendEventBatch() {
            if (this.eventBuffer.length === 0) return;

            try {
                const events = this.eventBuffer.splice(0, this.config.sendBatchSize);
                const endpoint = CONFIG.endpoints.events.replace('{sessionId}', this.sessionId);
                
                const payload = {
                    sessionId: this.sessionId,
                    events: events,
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    batchSize: events.length,
                    totalEventCount: this.eventCount
                };

                await this.makeApiCall('POST', endpoint, payload);
                this.logger.debug(`이벤트 배치 전송 완료: ${events.length}개`);

            } catch (error) {
                this.logger.error('이벤트 배치 전송 실패', { error: error.message });
                // 실패한 이벤트를 버퍼 앞쪽에 다시 추가 (재시도용)
                // this.eventBuffer.unshift(...events);
            }
        }

        /**
         * 상관관계 배치 전송
         */
        async sendCorrelationBatch() {
            if (this.correlationBuffer.length === 0) return;

            try {
                const correlations = this.correlationBuffer.splice(0, this.config.sendBatchSize);
                
                for (const correlation of correlations) {
                    const correlationData = {
                        otelSpanId: correlation.spanId || this.generateSpanId(),
                        otelTraceId: this.otelTraceId || this.generateTraceId(),
                        otelServiceName: 'airis-frontend',
                        otelOperationName: correlation.name || correlation.type,
                        otelStartTime: new Date(correlation.timestamp - (correlation.duration || 0)).toISOString(),
                        otelEndTime: new Date(correlation.timestamp).toISOString(),
                        otelDurationUs: (correlation.duration || 0) * 1000,
                        replayEventTimestamp: new Date(correlation.timestamp).toISOString(),
                        replayEventType: correlation.type,
                        replayEventData: correlation,
                        isError: correlation.error ? true : false,
                        errorMessage: correlation.error,
                        httpStatusCode: correlation.status
                    };

                    const endpoint = CONFIG.endpoints.correlations.replace('{sessionId}', this.sessionId);
                    await this.makeApiCall('POST', endpoint, correlationData);
                }

                this.logger.debug(`상관관계 배치 전송 완료: ${correlations.length}개`);

            } catch (error) {
                this.logger.error('상관관계 배치 전송 실패', { error: error.message });
            }
        }

        /**
         * 페이지 이벤트 리스너 설정
         */
        setupPageEventListeners() {
            // 페이지 언로드 처리
            this.beforeUnloadHandler = (event) => {
                this.sendAllBufferedData(true); // 동기 전송
            };
            window.addEventListener('beforeunload', this.beforeUnloadHandler);

            // Visibility API를 사용한 페이지 숨김/표시 처리
            this.visibilityChangeHandler = () => {
                if (document.hidden) {
                    this.sendAllBufferedData(false);
                } else {
                    // 페이지가 다시 보일 때 성능 메트릭 재수집
                    this.pageStartTime = Date.now();
                    this.interactionMetrics = { clicks: 0, scrollDepth: 0, formInteractions: 0, timeSpent: 0 };
                }
            };
            document.addEventListener('visibilitychange', this.visibilityChangeHandler);

            // History API 감지 (SPA 페이지 변경)
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            
            history.pushState = (...args) => {
                originalPushState.apply(history, args);
                setTimeout(() => this.recordPageView(), this.config.pageChangeDelay);
            };
            
            history.replaceState = (...args) => {
                originalReplaceState.apply(history, args);
                setTimeout(() => this.recordPageView(), this.config.pageChangeDelay);
            };

            window.addEventListener('popstate', () => {
                setTimeout(() => this.recordPageView(), this.config.pageChangeDelay);
            });
        }

        /**
         * 자동 전송 타이머 시작
         */
        startAutoSend() {
            this.sendTimer = setInterval(() => {
                if (this.eventBuffer.length > 0) {
                    this.sendEventBatch();
                }
                if (this.correlationBuffer.length > 0) {
                    this.sendCorrelationBatch();
                }
                if (this.performanceBuffer.length > 0) {
                    this.sendPerformanceBatch();
                }
            }, this.config.sendInterval);
        }

        /**
         * 성능 데이터 배치 전송
         */
        async sendPerformanceBatch() {
            if (this.performanceBuffer.length === 0) return;

            try {
                const performances = this.performanceBuffer.splice(0, this.config.sendBatchSize);
                
                for (const perf of performances) {
                    // 성능 데이터를 인사이트로 변환하여 전송
                    const insightData = {
                        analysisType: 'performance',
                        insightTitle: `성능 메트릭: ${perf.type}`,
                        insightDescription: `페이지 성능 데이터 - ${perf.url}`,
                        insightSeverity: this.calculatePerformanceSeverity(perf),
                        insightCategory: 'performance',
                        metricName: perf.type,
                        metricValue: perf.domContentLoaded || perf.timeSpent || 0,
                        metricUnit: 'ms',
                        recommendations: this.generatePerformanceRecommendations(perf),
                        estimatedImpact: 'medium',
                        relatedEvents: perf
                    };

                    const endpoint = `/api/sessions/${this.sessionId}/insights`;
                    await this.makeApiCall('POST', endpoint, insightData);
                }

                this.logger.debug(`성능 데이터 배치 전송 완료: ${performances.length}개`);

            } catch (error) {
                this.logger.error('성능 데이터 배치 전송 실패', { error: error.message });
            }
        }

        /**
         * 모든 버퍼된 데이터 전송
         */
        sendAllBufferedData(useBeacon = false) {
            try {
                const allData = {
                    sessionId: this.sessionId,
                    events: [...this.eventBuffer],
                    correlations: [...this.correlationBuffer],
                    performances: [...this.performanceBuffer],
                    finalMetrics: {
                        ...this.interactionMetrics,
                        totalEventCount: this.eventCount,
                        sessionDuration: Date.now() - this.pageStartTime
                    }
                };

                if (allData.events.length > 0 || allData.correlations.length > 0 || allData.performances.length > 0) {
                    const endpoint = `${this.config.apiBaseUrl}${CONFIG.endpoints.events.replace('{sessionId}', this.sessionId)}`;
                    const payload = JSON.stringify(allData);

                    if (useBeacon && navigator.sendBeacon) {
                        // Beacon API 사용 (페이지 언로드시 안전한 전송)
                        const blob = new Blob([payload], { type: 'application/json' });
                        navigator.sendBeacon(endpoint, blob);
                        this.logger.info('Beacon으로 최종 데이터 전송 완료');
                    } else {
                        // 일반 fetch 사용
                        this.makeApiCall('POST', CONFIG.endpoints.events.replace('{sessionId}', this.sessionId), allData)
                            .then(() => {
                                this.logger.info('최종 데이터 전송 완료');
                            })
                            .catch(error => {
                                this.logger.error('최종 데이터 전송 실패', { error: error.message });
                            });
                    }

                    // 버퍼 초기화
                    this.eventBuffer = [];
                    this.correlationBuffer = [];
                    this.performanceBuffer = [];
                }

            } catch (error) {
                this.logger.error('전체 데이터 전송 실패', { error: error.message });
            }
        }

        /**
         * 세션 추적 중지
         */
        async stop() {
            try {
                this.logger.info('세션 추적 중지 중...');

                // 버퍼된 모든 데이터 전송
                await this.sendAllBufferedData(false);

                // rrweb 기록 중지
                if (this.rrwebStopFn) {
                    this.rrwebStopFn();
                    this.rrwebStopFn = null;
                }

                // 타이머 정리
                if (this.sendTimer) {
                    clearInterval(this.sendTimer);
                    this.sendTimer = null;
                }

                // 이벤트 리스너 정리
                if (this.beforeUnloadHandler) {
                    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
                }
                if (this.visibilityChangeHandler) {
                    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
                }

                // Observer 정리
                if (this.otelObserver) {
                    this.otelObserver.disconnect();
                    this.otelObserver = null;
                }

                // 세션 완료 API 호출
                const completionData = {
                    sessionEndTime: new Date().toISOString(),
                    replayEventCount: this.eventCount,
                    conversionEvents: [],
                    customerSatisfactionScore: null
                };

                const endpoint = CONFIG.endpoints.complete.replace('{sessionId}', this.sessionId);
                await this.makeApiCall('POST', endpoint, completionData);

                this.isRecording = false;
                this.clearSessionFromStorage();

                this.logger.info('세션 추적 중지됨', {
                    sessionId: this.sessionId,
                    eventCount: this.eventCount,
                    duration: Date.now() - this.pageStartTime
                });

                return true;

            } catch (error) {
                this.logger.error('세션 추적 중지 실패', { error: error.message });
                return false;
            }
        }

        // === 유틸리티 메서드들 ===

        generateSessionId() {
            return `airis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        generateSpanId() {
            return Math.random().toString(16).substr(2, 16);
        }

        generateTraceId() {
            return Math.random().toString(16).substr(2, 32);
        }

        saveSessionToStorage() {
            try {
                const sessionData = {
                    sessionId: this.sessionId,
                    otelSessionId: this.otelSessionId,
                    otelTraceId: this.otelTraceId,
                    eventCount: this.eventCount,
                    startTime: this.pageStartTime
                };
                sessionStorage.setItem('airis_session', JSON.stringify(sessionData));
            } catch (error) {
                this.logger.debug('세션 저장 실패', { error: error.message });
            }
        }

        loadSessionFromStorage() {
            try {
                const stored = sessionStorage.getItem('airis_session');
                return stored ? JSON.parse(stored) : null;
            } catch (error) {
                this.logger.debug('세션 로드 실패', { error: error.message });
                return null;
            }
        }

        clearSessionFromStorage() {
            try {
                sessionStorage.removeItem('airis_session');
            } catch (error) {
                this.logger.debug('세션 삭제 실패', { error: error.message });
            }
        }

        async detectGeoLocation() {
            return new Promise((resolve) => {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            resolve({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                accuracy: position.coords.accuracy
                            });
                        },
                        () => resolve(null),
                        { timeout: 5000, enableHighAccuracy: false }
                    );
                } else {
                    resolve(null);
                }
            });
        }

        getDOMContentLoadedTime() {
            try {
                const navigation = performance.getEntriesByType('navigation')[0];
                return navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
            } catch (error) {
                return null;
            }
        }

        getFirstContentfulPaint() {
            try {
                const paint = performance.getEntriesByType('paint');
                return paint.find(p => p.name === 'first-contentful-paint')?.startTime || null;
            } catch (error) {
                return null;
            }
        }

        getLargestContentfulPaint() {
            try {
                const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
                return lcpEntries[lcpEntries.length - 1]?.startTime || null;
            } catch (error) {
                return null;
            }
        }

        calculatePerformanceSeverity(perfData) {
            if (perfData.domContentLoaded > 3000 || perfData.timeSpent < 5000) return 'high';
            if (perfData.domContentLoaded > 1500 || perfData.timeSpent < 15000) return 'medium';
            return 'low';
        }

        generatePerformanceRecommendations(perfData) {
            const recommendations = [];
            
            if (perfData.domContentLoaded > 2000) {
                recommendations.push('DOM 콘텐츠 로딩 시간 최적화 필요');
            }
            if (perfData.firstContentfulPaint > 1500) {
                recommendations.push('First Contentful Paint 개선 필요');
            }
            if (perfData.totalResources > 100) {
                recommendations.push('리소스 수 최적화 고려');
            }
            
            return recommendations;
        }

        async makeApiCall(method, endpoint, data = null) {
            const url = `${this.config.apiBaseUrl}${endpoint}`;
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId || '',
                    'X-OTEL-Trace-ID': this.otelTraceId || ''
                },
                ...(data && { body: JSON.stringify(data) })
            };

            let attempts = 0;
            while (attempts < this.config.retryAttempts) {
                try {
                    const response = await fetch(url, options);
                    const result = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${result.message || 'API 오류'}`);
                    }
                    
                    return result;

                } catch (error) {
                    attempts++;
                    
                    if (attempts >= this.config.retryAttempts) {
                        throw error;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempts));
                }
            }
        }

        createLogger() {
            const logLevel = this.config.debug ? 'debug' : 'info';
            const levels = { error: 0, warn: 1, info: 2, debug: 3 };
            const currentLevel = levels[logLevel] || 2;

            return {
                error: (message, data) => {
                    if (currentLevel >= 0) console.error(`[AIRIS Session Tracker] ${message}`, data || '');
                },
                warn: (message, data) => {
                    if (currentLevel >= 1) console.warn(`[AIRIS Session Tracker] ${message}`, data || '');
                },
                info: (message, data) => {
                    if (currentLevel >= 2) console.info(`[AIRIS Session Tracker] ${message}`, data || '');
                },
                debug: (message, data) => {
                    if (currentLevel >= 3) console.debug(`[AIRIS Session Tracker] ${message}`, data || '');
                }
            };
        }

        /**
         * 현재 상태 조회
         */
        getStatus() {
            return {
                sessionId: this.sessionId,
                otelSessionId: this.otelSessionId,
                otelTraceId: this.otelTraceId,
                isRecording: this.isRecording,
                isInitialized: this.isInitialized,
                eventCount: this.eventCount,
                eventBufferSize: this.eventBuffer.length,
                correlationBufferSize: this.correlationBuffer.length,
                performanceBufferSize: this.performanceBuffer.length,
                interactionMetrics: { ...this.interactionMetrics },
                sessionDuration: Date.now() - this.pageStartTime
            };
        }
    }

    // 전역 객체에 등록
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AIRISSessionTracker;
    } else {
        global.AIRISSessionTracker = AIRISSessionTracker;
        
        // 자동 초기화 (옵션)
        if (global.autoInitAirisTracker !== false) {
            global.airisTracker = new AIRISSessionTracker();
        }
    }

})(typeof window !== 'undefined' ? window : this);