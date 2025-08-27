/**
 * AIRIS Session Tracker Library
 * rrweb 기반 다중 페이지 세션 추적 시스템
 */

class AIRISSessionTracker {
    constructor(config = {}) {
        this.config = {
            apiEndpoint: config.apiEndpoint || 'http://localhost:3003',
            sendBatchSize: config.sendBatchSize || 20,
            sendInterval: config.sendInterval || 3000,
            pageChangeDelay: config.pageChangeDelay || 500,
            maxEvents: config.maxEvents || 10000,
            ...config
        };
        
        this.sessionId = this.getOrCreateSessionId();
        this.eventBuffer = [];
        this.recording = false;
        this.stopFn = null;
        this.sendTimer = null;
        this.pageUnloading = false;
    }

    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('airis_session_id');
        if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('airis_session_id', sessionId);
        }
        return sessionId;
    }

    startRecording() {
        if (this.recording) {
            console.log('이미 녹화 중입니다');
            return;
        }

        console.log('세션 녹화 시작:', this.sessionId);
        
        // rrweb 녹화 시작
        this.stopFn = rrweb.record({
            emit: (event) => {
                this.eventBuffer.push(event);
                
                // 버퍼 크기 체크
                if (this.eventBuffer.length >= this.config.sendBatchSize) {
                    this.sendEventBatch();
                }

                // 최대 이벤트 수 체크
                if (this.eventBuffer.length > this.config.maxEvents) {
                    console.warn('최대 이벤트 수 초과, 오래된 이벤트 제거');
                    this.eventBuffer.splice(0, this.eventBuffer.length - this.config.maxEvents);
                }
            },
            checkoutEveryNms: 10000,
            blockClass: 'airis-no-record',
            maskTextClass: 'airis-mask-text',
            maskAllInputs: false,
            maskInputOptions: {
                password: true
            }
        });

        this.recording = true;
        
        // 자동 전송 타이머 시작
        this.startAutoSend();
        
        // 페이지 언로드 핸들러 설정
        this.setupPageUnloadHandler();
        
        // 세션 시작 API 호출
        this.sendSessionStart();
    }

    stopRecording() {
        if (!this.recording) {
            console.log('녹화가 진행 중이지 않습니다');
            return;
        }

        console.log('세션 녹화 중지');
        
        // 녹화 중지
        if (this.stopFn) {
            this.stopFn();
            this.stopFn = null;
        }
        
        // 자동 전송 타이머 중지
        this.stopAutoSend();
        
        // 남은 이벤트 전송
        if (this.eventBuffer.length > 0) {
            this.sendEventBatch(true);
        }
        
        this.recording = false;
        
        // 세션 종료 API 호출
        this.sendSessionStop();
    }

    startAutoSend() {
        this.stopAutoSend();
        this.sendTimer = setInterval(() => {
            if (this.eventBuffer.length > 0 && !this.pageUnloading) {
                this.sendEventBatch();
            }
        }, this.config.sendInterval);
    }

    stopAutoSend() {
        if (this.sendTimer) {
            clearInterval(this.sendTimer);
            this.sendTimer = null;
        }
    }

    sendEventBatch(isUnload = false) {
        if (this.eventBuffer.length === 0) return;
        
        const events = [...this.eventBuffer];
        this.eventBuffer = [];
        
        const payload = {
            sessionId: this.sessionId,
            events: events,
            url: window.location.href,
            timestamp: Date.now(),
            unload: isUnload
        };

        // 페이지 언로드 중이면 동기 전송
        if (isUnload || this.pageUnloading) {
            this.sendBeacon(payload);
        } else {
            // 일반 비동기 전송
            fetch(`${this.config.apiEndpoint}/api/sessions/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }).then(response => {
                if (response.ok) {
                    console.log(`${events.length}개 이벤트 전송 완료`);
                }
            }).catch(error => {
                console.error('이벤트 전송 실패:', error);
                // 실패한 이벤트를 다시 버퍼에 추가
                this.eventBuffer.unshift(...events);
            });
        }
    }

    sendBeacon(payload) {
        const url = `${this.config.apiEndpoint}/api/sessions/events`;
        const data = JSON.stringify(payload);
        
        // Beacon API 시도
        if (navigator.sendBeacon) {
            const success = navigator.sendBeacon(url, data);
            if (success) {
                console.log('Beacon으로 이벤트 전송');
                return;
            }
        }
        
        // Beacon 실패시 동기 XHR
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(data);
            console.log('동기 XHR로 이벤트 전송');
        } catch (error) {
            console.error('동기 전송 실패:', error);
        }
    }

    setupPageUnloadHandler() {
        const handleUnload = () => {
            if (!this.pageUnloading && this.eventBuffer.length > 0) {
                this.pageUnloading = true;
                this.sendEventBatch(true);
            }
        };

        // 다양한 언로드 이벤트 처리
        window.addEventListener('beforeunload', handleUnload);
        window.addEventListener('pagehide', handleUnload);
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                handleUnload();
            }
        });
        
        // 링크 클릭 감지
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && !link.target) {
                // 페이지 전환 전에 이벤트 전송
                setTimeout(() => {
                    if (this.eventBuffer.length > 0) {
                        this.sendEventBatch(true);
                    }
                }, this.config.pageChangeDelay);
            }
        });
    }

    sendSessionStart() {
        fetch(`${this.config.apiEndpoint}/api/sessions/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: this.sessionId,
                metadata: {
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    timestamp: Date.now(),
                    screen: {
                        width: window.screen.width,
                        height: window.screen.height
                    }
                }
            })
        }).catch(error => {
            console.error('세션 시작 API 호출 실패:', error);
        });
    }

    sendSessionStop() {
        fetch(`${this.config.apiEndpoint}/api/sessions/${this.sessionId}/stop`, {
            method: 'POST'
        }).catch(error => {
            console.error('세션 종료 API 호출 실패:', error);
        });
    }

    getSessionId() {
        return this.sessionId;
    }

    isRecording() {
        return this.recording;
    }
}

// 전역 객체로 export
window.AIRISSessionTracker = AIRISSessionTracker;