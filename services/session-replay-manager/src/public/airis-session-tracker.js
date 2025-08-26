/**
 * AIRIS Session Tracker
 * 다중 페이지 세션 추적 라이브러리
 */
(function(window) {
    'use strict';

    // 설정
    const CONFIG = {
        apiBaseUrl: window.location.origin + '/api',
        sessionStorageKey: 'airis_session_id',
        recordingStateKey: 'airis_recording',
        startTimeKey: 'airis_start_time',
        eventsKey: 'airis_events',
        maxEvents: 10000,
        sendBatchSize: 20,  // 100 -> 20으로 감소 (더 자주 전송)
        sendInterval: 3000, // 3초마다 자동 전송
        pageChangeDelay: 500 // 페이지 변경 시 지연 시간
    };

    // AIRIS 세션 추적기
    class AIRISSessionTracker {
        constructor() {
            this.sessionId = this.getOrCreateSessionId();
            this.isRecording = this.checkRecordingState();
            this.startTime = this.getSessionStartTime();
            this.rrwebStopFn = null;
            this.eventBuffer = [];
            this.eventCount = 0;
            this.sendTimer = null;
            
            this.init();
        }

        init() {
            console.log('🔍 AIRIS Session Tracker 초기화:', {
                sessionId: this.sessionId,
                isRecording: this.isRecording,
                startTime: this.startTime,
                url: window.location.href
            });

            // 기록 중이면 자동으로 추적 시작
            if (this.isRecording) {
                this.startTracking();
                console.log('📹 기존 세션 기록 중 - 추적 재개');
            }

            // 페이지 이탈 시 데이터 전송
            this.setupPageUnloadHandler();
        }

        // 세션 ID 관리
        getOrCreateSessionId() {
            // URL 파라미터 확인
            const urlParams = new URLSearchParams(window.location.search);
            const urlSessionId = urlParams.get('sessionId');
            if (urlSessionId) {
                sessionStorage.setItem(CONFIG.sessionStorageKey, urlSessionId);
                return urlSessionId;
            }

            // 세션 스토리지 확인
            const storedSessionId = sessionStorage.getItem(CONFIG.sessionStorageKey);
            if (storedSessionId) {
                return storedSessionId;
            }

            // 새 세션 ID 생성
            const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem(CONFIG.sessionStorageKey, newSessionId);
            return newSessionId;
        }

        // 기록 상태 확인
        checkRecordingState() {
            return sessionStorage.getItem(CONFIG.recordingStateKey) === 'true';
        }

        // 세션 시작 시간 확인
        getSessionStartTime() {
            const storedStartTime = sessionStorage.getItem(CONFIG.startTimeKey);
            if (storedStartTime && this.checkRecordingState()) {
                return new Date(storedStartTime);
            }
            return null;
        }

        // 세션 상태 저장
        saveSessionState() {
            sessionStorage.setItem(CONFIG.sessionStorageKey, this.sessionId);
            sessionStorage.setItem(CONFIG.recordingStateKey, this.isRecording ? 'true' : 'false');
            if (this.startTime) {
                sessionStorage.setItem(CONFIG.startTimeKey, this.startTime.toISOString());
            }
        }

        // 자동 전송 타이머 시작
        startAutoSend() {
            if (this.sendTimer) {
                clearInterval(this.sendTimer);
            }
            
            this.sendTimer = setInterval(() => {
                if (this.eventBuffer.length > 0) {
                    console.log('⏰ 자동 전송:', this.eventBuffer.length, '개 이벤트');
                    this.sendEventBatch();
                }
            }, CONFIG.sendInterval);
            
            console.log('⏰ 자동 전송 타이머 시작:', CONFIG.sendInterval, 'ms 간격');
        }
        
        // 자동 전송 타이머 중지
        stopAutoSend() {
            if (this.sendTimer) {
                clearInterval(this.sendTimer);
                this.sendTimer = null;
                console.log('⏰ 자동 전송 타이머 중지');
            }
        }

        // 추적 시작
        startTracking() {
            if (typeof rrweb === 'undefined') {
                console.warn('⚠️ rrweb 라이브러리가 로드되지 않았습니다');
                return false;
            }

            try {
                // rrweb 기록 시작
                this.rrwebStopFn = rrweb.record({
                    emit: (event) => this.handleRrwebEvent(event),
                    recordCanvas: false,
                    collectFonts: false,
                    inlineStylesheet: false,
                    maskInputOptions: {
                        password: true
                    },
                    slimDOMOptions: {
                        script: false,
                        comment: false,
                        headFavicon: false,
                        headWhitespace: false
                    }
                });

                console.log('🎬 rrweb 추적 시작됨:', this.sessionId);
                
                // 페이지 이동 이벤트 추가
                this.addNavigationEvent();
                
                // 자동 전송 시작
                this.startAutoSend();
                
                return true;
            } catch (error) {
                console.error('❌ rrweb 추적 시작 실패:', error);
                return false;
            }
        }

        // rrweb 이벤트 처리
        handleRrwebEvent(event) {
            // 메모리 보호
            if (this.eventBuffer.length >= CONFIG.maxEvents) {
                console.warn('⚠️ 이벤트 버퍼 제한 도달');
                return;
            }

            this.eventBuffer.push(event);
            this.eventCount++;

            // 배치 전송
            if (this.eventBuffer.length >= CONFIG.sendBatchSize) {
                this.sendEventBatch();
            }
        }

        // 네비게이션 이벤트 추가
        addNavigationEvent() {
            const navigationEvent = {
                type: 'navigation',
                data: {
                    href: window.location.href,
                    title: document.title,
                    referrer: document.referrer,
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            };

            this.handleRrwebEvent(navigationEvent);
        }

        // 이벤트 배치 전송
        async sendEventBatch() {
            if (this.eventBuffer.length === 0) return;

            const events = [...this.eventBuffer];
            this.eventBuffer = [];

            try {
                const response = await fetch(`${CONFIG.apiBaseUrl}/sessions/events`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId: this.sessionId,
                        events: events,
                        url: window.location.href,
                        timestamp: new Date().toISOString()
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                console.log(`📤 이벤트 배치 전송 완료: ${events.length}개`);
            } catch (error) {
                console.error('❌ 이벤트 배치 전송 실패:', error);
                // 실패한 이벤트는 다시 버퍼에 추가
                this.eventBuffer = events.concat(this.eventBuffer);
            }
        }

        // 페이지 이탈 처리
        setupPageUnloadHandler() {
            // 페이지 숨김/이탈 시 강제 전송
            const handleUnload = () => {
                console.log('📡 페이지 이탈 감지 - 강제 이벤트 전송');
                
                if (this.eventBuffer.length > 0) {
                    // Beacon API로 즉시 전송 (비동기 제한 없음)
                    const data = JSON.stringify({
                        sessionId: this.sessionId,
                        events: this.eventBuffer,
                        url: window.location.href,
                        timestamp: new Date().toISOString(),
                        unload: true
                    });

                    if (navigator.sendBeacon) {
                        navigator.sendBeacon(`${CONFIG.apiBaseUrl}/sessions/events`, data);
                        console.log('📡 Beacon으로 이벤트 전송:', this.eventBuffer.length, '개');
                    } else {
                        // Beacon이 지원되지 않으면 동기 요청
                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', `${CONFIG.apiBaseUrl}/sessions/events`, false);
                        xhr.setRequestHeader('Content-Type', 'application/json');
                        xhr.send(data);
                        console.log('📡 동기 요청으로 이벤트 전송:', this.eventBuffer.length, '개');
                    }
                    
                    this.eventBuffer = [];
                }
            };

            // 다양한 이벤트에 대응
            window.addEventListener('beforeunload', handleUnload);
            window.addEventListener('pagehide', handleUnload);
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    handleUnload();
                }
            });
            
            // 페이지 포커스 잃을 때도 전송
            window.addEventListener('blur', () => {
                if (this.eventBuffer.length > 0) {
                    console.log('🔄 페이지 포커스 잃음 - 이벤트 전송');
                    this.sendEventBatch();
                }
            });
        }

        // 공개 API
        start() {
            if (this.isRecording) {
                console.log('⚠️ 이미 기록 중입니다');
                return false;
            }

            this.isRecording = true;
            this.startTime = new Date();
            this.saveSessionState();
            
            return this.startTracking();
        }

        stop() {
            if (!this.isRecording) {
                console.log('⚠️ 기록 중이 아닙니다');
                return false;
            }

            this.isRecording = false;
            
            // 자동 전송 중지
            this.stopAutoSend();
            
            if (this.rrwebStopFn) {
                this.rrwebStopFn();
                this.rrwebStopFn = null;
            }

            // 남은 이벤트 전송
            if (this.eventBuffer.length > 0) {
                this.sendEventBatch();
            }

            // 상태 클리어
            sessionStorage.removeItem(CONFIG.recordingStateKey);
            sessionStorage.removeItem(CONFIG.startTimeKey);

            console.log('⏹️ 세션 기록 중지됨');
            return true;
        }

        // 상태 조회
        getStatus() {
            return {
                sessionId: this.sessionId,
                isRecording: this.isRecording,
                startTime: this.startTime,
                eventCount: this.eventCount,
                bufferSize: this.eventBuffer.length
            };
        }
    }

    // 전역 객체에 추가
    window.AIRISSessionTracker = AIRISSessionTracker;
    
    // 자동 초기화 (옵션)
    if (!window.AIRIS_NO_AUTO_INIT) {
        window.airisTracker = new AIRISSessionTracker();
    }

    console.log('✅ AIRIS Session Tracker 라이브러리 로드됨');

})(window);