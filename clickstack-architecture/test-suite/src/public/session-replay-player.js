/**
 * 세션 리플레이 플레이어 JavaScript
 * 사용자 세션을 시각적으로 재생하고 분석하는 플레이어
 */

class SessionReplayPlayer {
    constructor() {
        this.currentSession = null;
        this.events = [];
        this.currentEventIndex = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        this.playbackTimer = null;
        this.startTime = 0;
        
        this.initializeElements();
        this.bindEvents();
        this.loadAvailableSessions();
        this.checkUrlParameters();
    }

    initializeElements() {
        // Selectors
        this.scenarioSelect = document.getElementById('scenarioSelect');
        this.sessionSelect = document.getElementById('sessionSelect');
        this.qualitySelect = document.getElementById('qualitySelect');
        this.loadSessionBtn = document.getElementById('loadSessionBtn');
        
        // Player elements
        this.playerContainer = document.getElementById('playerContainer');
        this.viewport = document.getElementById('viewport');
        this.viewportContent = document.getElementById('viewportContent');
        this.cursor = document.getElementById('cursor');
        this.pageIndicator = document.getElementById('pageIndicator');
        
        // Controls
        this.playBtn = document.getElementById('playBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.speedSelect = document.getElementById('speedSelect');
        
        // Timeline
        this.timeline = document.getElementById('timeline');
        this.timelineProgress = document.getElementById('timelineProgress');
        this.timelineThumb = document.getElementById('timelineThumb');
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');
        
        // Info displays
        this.sessionTitle = document.getElementById('sessionTitle');
        this.sessionMeta = document.getElementById('sessionMeta');
        this.totalEvents = document.getElementById('totalEvents');
        this.sessionDuration = document.getElementById('sessionDuration');
        this.errorCount = document.getElementById('errorCount');
        this.eventsList = document.getElementById('eventsList');
        
        // Loading
        this.loading = document.getElementById('loading');
    }

    bindEvents() {
        // Session selection
        this.scenarioSelect.addEventListener('change', () => this.onScenarioChange());
        this.sessionSelect.addEventListener('change', () => this.onSessionChange());
        this.loadSessionBtn.addEventListener('click', () => this.loadSession());
        
        // Player controls
        this.playBtn.addEventListener('click', () => this.togglePlayback());
        this.prevBtn.addEventListener('click', () => this.previousEvent());
        this.nextBtn.addEventListener('click', () => this.nextEvent());
        this.restartBtn.addEventListener('click', () => this.restartPlayback());
        this.speedSelect.addEventListener('change', (e) => {
            this.playbackSpeed = parseFloat(e.target.value);
        });
        
        // Timeline interaction
        this.timeline.addEventListener('click', (e) => this.onTimelineClick(e));
        this.timelineThumb.addEventListener('mousedown', (e) => this.onTimelineThumbDrag(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    async loadAvailableSessions() {
        try {
            // 초기화: 빈 세션 목록으로 시작
            this.availableSessions = {};
        } catch (error) {
            console.error('세션 목록 로드 실패:', error);
        }
    }

    checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const scenario = urlParams.get('scenario');
        const sessionId = urlParams.get('session');
        
        if (scenario && sessionId) {
            // URL 파라미터로 전달된 세션을 자동 로드
            console.log(`URL에서 세션 파라미터 감지: ${scenario} / ${sessionId}`);
            
            // 시나리오 선택
            this.scenarioSelect.value = scenario;
            
            // 시나리오 변경 이벤트 트리거하여 세션 목록 로드
            this.onScenarioChange().then(() => {
                // 세션 목록 로드 완료 후 특정 세션 선택
                setTimeout(() => {
                    this.sessionSelect.value = sessionId;
                    this.updateLoadButton();
                    
                    // 자동으로 세션 로드
                    setTimeout(() => {
                        this.loadSession();
                    }, 500);
                }, 1000);
            });
        }
    }

    async onScenarioChange() {
        const scenario = this.scenarioSelect.value;
        this.sessionSelect.innerHTML = '<option value="">로딩 중...</option>';
        this.sessionSelect.disabled = true;
        
        if (scenario) {
            try {
                // API에서 세션 목록 로드
                const response = await fetch(`/api/session-replay/sessions/${scenario}`);
                const data = await response.json();
                
                if (data.success && data.sessions) {
                    this.sessionSelect.innerHTML = '<option value="">세션을 선택하세요</option>';
                    this.sessionSelect.disabled = false;
                    
                    data.sessions.forEach(session => {
                        const option = document.createElement('option');
                        option.value = session.id;
                        option.textContent = `${session.id} (${session.user}) - ${this.formatDuration(session.duration)}`;
                        this.sessionSelect.appendChild(option);
                    });
                    
                    // 세션 목록 캐시
                    this.availableSessions[scenario] = data.sessions;
                } else {
                    throw new Error('세션 목록을 가져올 수 없습니다');
                }
            } catch (error) {
                console.error('세션 목록 로드 실패:', error);
                this.sessionSelect.innerHTML = '<option value="">세션 목록 로드 실패</option>';
            }
        } else {
            this.sessionSelect.innerHTML = '<option value="">먼저 시나리오를 선택하세요</option>';
        }
        
        this.updateLoadButton();
    }

    onSessionChange() {
        this.updateLoadButton();
    }

    updateLoadButton() {
        const hasScenario = this.scenarioSelect.value;
        const hasSession = this.sessionSelect.value;
        this.loadSessionBtn.disabled = !hasScenario || !hasSession;
    }

    async loadSession() {
        const scenario = this.scenarioSelect.value;
        const sessionId = this.sessionSelect.value;
        
        if (!scenario || !sessionId) return;
        
        this.showLoading(true);
        
        try {
            // 실제 세션 데이터 로드 (현재는 시뮬레이션)
            await this.simulateSessionLoad(scenario, sessionId);
            
            this.playerContainer.style.display = 'block';
            this.setupPlayer();
            this.startPlayback();
            
        } catch (error) {
            console.error('세션 로드 실패:', error);
            alert('세션을 로드할 수 없습니다: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async simulateSessionLoad(scenario, sessionId) {
        try {
            // API에서 실제 세션 데이터 로드
            const response = await fetch(`/api/session-replay/session/${sessionId}`);
            const data = await response.json();
            
            if (data.success) {
                this.currentSession = data.session;
                this.events = data.events;
                this.currentEventIndex = 0;
                
                console.log(`✅ 세션 로드 완료: ${sessionId} (${this.events.length}개 이벤트)`);
            } else {
                throw new Error('세션 데이터를 가져올 수 없습니다');
            }
        } catch (error) {
            console.error('세션 로드 실패:', error);
            // 폴백으로 시뮬레이션 데이터 사용
            this.currentSession = await this.generateSessionData(scenario, sessionId);
            this.events = this.currentSession.events;
            this.currentEventIndex = 0;
        }
    }

    async generateSessionData(scenario, sessionId) {
        const sessionData = {
            id: sessionId,
            scenario: scenario,
            user: `user_${Math.floor(Math.random() * 10000)}`,
            startTime: new Date(Date.now() - Math.random() * 86400000).toISOString(),
            events: []
        };

        // 시나리오별 이벤트 생성
        switch (scenario) {
            case 'bug_payment':
                sessionData.events = this.generateBugScenarioEvents();
                break;
            case 'ux_navigation':
                sessionData.events = this.generateUXScenarioEvents();
                break;
            case 'security_attack':
                sessionData.events = this.generateSecurityScenarioEvents();
                break;
            case 'performance_slow':
                sessionData.events = this.generatePerformanceScenarioEvents();
                break;
        }

        return sessionData;
    }

    generateBugScenarioEvents() {
        return [
            { type: 'page_load', timestamp: 0, page: '/checkout', title: '결제 페이지', x: 0, y: 0, duration: 2300 },
            { type: 'click', timestamp: 5000, element: '#card-option', x: 300, y: 200, duration: 100 },
            { type: 'form_input', timestamp: 8000, element: '#cardNumber', value: '****-****-****-1234', x: 450, y: 320 },
            { type: 'form_input', timestamp: 12000, element: '#expiry', value: '12/25', x: 600, y: 320 },
            { type: 'form_input', timestamp: 16000, element: '#cvv', value: '***', x: 750, y: 320 },
            { type: 'click', timestamp: 20000, element: '#paymentButton', x: 550, y: 420, duration: 100 },
            { type: 'javascript_error', timestamp: 20100, error: 'Cannot read property validate of undefined', file: 'payment.js', line: 245 },
            { type: 'click', timestamp: 25000, element: '#paymentButton', x: 550, y: 420, duration: 100 },
            { type: 'click', timestamp: 30000, element: '#paymentButton', x: 550, y: 420, duration: 100 },
            { type: 'page_unload', timestamp: 35000, reason: 'user_frustration' }
        ];
    }

    generateUXScenarioEvents() {
        return [
            { type: 'page_load', timestamp: 0, page: '/products', title: '상품 목록', x: 0, y: 0, duration: 1800 },
            { type: 'click', timestamp: 3000, element: '#nav-categories', x: 200, y: 100, duration: 100 },
            { type: 'click', timestamp: 6000, element: '#nav-brands', x: 300, y: 100, duration: 100 },
            { type: 'click', timestamp: 9000, element: '#nav-deals', x: 400, y: 100, duration: 100 },
            { type: 'click', timestamp: 12000, element: '#nav-products', x: 150, y: 100, duration: 100 },
            { type: 'scroll', timestamp: 15000, direction: 'down', x: 500, y: 400, scrollY: 300 },
            { type: 'click', timestamp: 18000, element: '#nav-support', x: 500, y: 100, duration: 100 },
            { type: 'click', timestamp: 21000, element: '#nav-account', x: 600, y: 100, duration: 100 },
            { type: 'page_unload', timestamp: 25000, reason: 'user_confusion' }
        ];
    }

    generateSecurityScenarioEvents() {
        const events = [];
        const startTime = 0;
        
        for (let i = 0; i < 10; i++) {
            events.push({
                type: 'login_attempt',
                timestamp: startTime + (i * 2000),
                username: ['admin', 'root', 'user'][i % 3],
                ip: '192.168.1.100',
                success: false,
                x: 400,
                y: 300
            });
        }
        
        events.push({
            type: 'account_lockout',
            timestamp: startTime + 20000,
            reason: 'excessive_failed_attempts'
        });

        return events;
    }

    generatePerformanceScenarioEvents() {
        return [
            { type: 'page_load', timestamp: 0, page: '/dashboard', title: '대시보드', x: 0, y: 0, duration: 7500 },
            { type: 'api_request', timestamp: 8000, endpoint: '/api/sales-data', duration: 5200 },
            { type: 'click', timestamp: 15000, element: '#sales-chart', x: 300, y: 200, duration: 3200 },
            { type: 'chart_render_start', timestamp: 18000, chart: 'sales_chart' },
            { type: 'chart_render_complete', timestamp: 23200, chart: 'sales_chart', renderTime: 5200 },
            { type: 'click', timestamp: 26000, element: '#users-chart', x: 500, y: 200, duration: 100 },
            { type: 'click', timestamp: 26500, element: '#users-chart', x: 500, y: 200, duration: 100 },
            { type: 'click', timestamp: 27000, element: '#users-chart', x: 500, y: 200, duration: 100 },
            { type: 'page_unload', timestamp: 30000, reason: 'performance_timeout' }
        ];
    }

    setupPlayer() {
        // 세션 정보 업데이트
        this.updateSessionInfo();
        
        // 이벤트 목록 생성
        this.populateEventsList();
        
        // 뷰포트 초기화
        this.initializeViewport();
        
        // 타임라인 설정
        this.setupTimeline();
        
        // 첫 번째 이벤트로 이동
        this.goToEvent(0);
    }

    updateSessionInfo() {
        const session = this.currentSession;
        const events = this.events;
        
        this.sessionTitle.textContent = `${session.scenario} - ${session.id}`;
        this.sessionMeta.textContent = `사용자: ${session.user} | 시작: ${new Date(session.startTime).toLocaleString()}`;
        
        this.totalEvents.textContent = events.length;
        this.sessionDuration.textContent = this.formatDuration(events[events.length - 1]?.timestamp || 0);
        this.errorCount.textContent = events.filter(e => e.type.includes('error')).length;
    }

    populateEventsList() {
        this.eventsList.innerHTML = '';
        
        this.events.forEach((event, index) => {
            const eventItem = document.createElement('div');
            eventItem.className = 'event-item';
            eventItem.setAttribute('data-type', event.type);
            eventItem.setAttribute('data-index', index);
            
            eventItem.innerHTML = `
                <div class="event-time">${this.formatTime(event.timestamp)}</div>
                <div class="event-type">${this.getEventTypeDisplay(event.type)}</div>
                <div class="event-details">${this.getEventDetails(event)}</div>
            `;
            
            eventItem.addEventListener('click', () => {
                this.goToEvent(index);
            });
            
            this.eventsList.appendChild(eventItem);
        });
    }

    getEventTypeDisplay(type) {
        const typeMap = {
            'page_load': '🌐 페이지 로드',
            'click': '👆 클릭',
            'form_input': '✏️ 입력',
            'scroll': '🔄 스크롤',
            'javascript_error': '❌ JS 오류',
            'api_request': '📡 API 요청',
            'login_attempt': '🔐 로그인 시도',
            'account_lockout': '🚫 계정 잠금',
            'chart_render_start': '📊 차트 렌더링 시작',
            'chart_render_complete': '✅ 차트 렌더링 완료',
            'page_unload': '🚪 페이지 나가기'
        };
        
        return typeMap[type] || type;
    }

    getEventDetails(event) {
        switch (event.type) {
            case 'page_load':
                return `${event.page_url || event.page} (${event.load_time || event.duration || 0}ms)`;
            case 'click':
                return `${event.element_id || event.element} (${event.x || 0}, ${event.y || 0})`;
            case 'form_input':
                return `${event.element_id || event.element}: ${event.value_masked || event.value || ''}`;
            case 'scroll':
                return `${event.direction || 'down'} (${event.scrollY || 0}px)`;
            case 'javascript_error':
                return `${event.error_message || event.error} (${event.source_file || event.file}:${event.line_number || event.line})`;
            case 'api_request':
                return `${event.endpoint || event.url} (${event.response_time || event.duration || 0}ms)`;
            case 'login_attempt':
                return `${event.username}@${event.ip_address || event.ip} - ${event.success ? '성공' : '실패'}`;
            default:
                return JSON.stringify(event).slice(0, 50) + '...';
        }
    }

    initializeViewport() {
        // 뷰포트 크기 설정 (1920x1080을 기준으로 스케일링)
        const containerWidth = this.viewport.parentElement.clientWidth - 40;
        const containerHeight = this.viewport.parentElement.clientHeight - 40;
        
        const targetWidth = 1920;
        const targetHeight = 1080;
        
        const scaleX = containerWidth / targetWidth;
        const scaleY = containerHeight / targetHeight;
        const scale = Math.min(scaleX, scaleY, 0.8); // 최대 80% 스케일
        
        const scaledWidth = targetWidth * scale;
        const scaledHeight = targetHeight * scale;
        
        this.viewport.style.width = `${scaledWidth}px`;
        this.viewport.style.height = `${scaledHeight}px`;
        
        // 뷰포트 배경 설정
        this.viewportContent.style.background = `
            linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%),
            url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"%3E%3Crect width="20" height="20" fill="%23f8f9fa"/%3E%3Crect width="10" height="10" fill="%23e9ecef"/%3E%3Crect x="10" y="10" width="10" height="10" fill="%23e9ecef"/%3E%3C/svg%3E')
        `;
    }

    setupTimeline() {
        const totalDuration = this.events[this.events.length - 1]?.timestamp || 0;
        this.totalTime.textContent = this.formatTime(totalDuration);
        this.currentTime.textContent = this.formatTime(0);
        this.updateTimelineProgress(0);
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.pausePlayback();
        } else {
            this.startPlayback();
        }
    }

    startPlayback() {
        this.isPlaying = true;
        this.playBtn.innerHTML = '⏸';
        this.playBtn.title = '일시정지';
        
        this.startTime = Date.now() - (this.events[this.currentEventIndex]?.timestamp || 0) / this.playbackSpeed;
        this.playbackTimer = setInterval(() => {
            this.updatePlayback();
        }, 50); // 20 FPS
    }

    pausePlayback() {
        this.isPlaying = false;
        this.playBtn.innerHTML = '▶';
        this.playBtn.title = '재생';
        
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }
    }

    updatePlayback() {
        const currentTime = (Date.now() - this.startTime) * this.playbackSpeed;
        const totalDuration = this.events[this.events.length - 1]?.timestamp || 0;
        
        // 현재 시간에 해당하는 이벤트 찾기
        let targetEventIndex = this.events.findIndex(event => event.timestamp > currentTime) - 1;
        if (targetEventIndex < 0) targetEventIndex = this.events.length - 1;
        
        if (targetEventIndex !== this.currentEventIndex) {
            this.goToEvent(targetEventIndex);
        }
        
        // 타임라인 업데이트
        this.updateTimelineProgress(currentTime / totalDuration);
        this.currentTime.textContent = this.formatTime(currentTime);
        
        // 재생 완료 확인
        if (currentTime >= totalDuration) {
            this.pausePlayback();
            this.goToEvent(this.events.length - 1);
        }
    }

    goToEvent(eventIndex) {
        if (eventIndex < 0 || eventIndex >= this.events.length) return;
        
        this.currentEventIndex = eventIndex;
        const event = this.events[eventIndex];
        
        // 이벤트 목록에서 현재 이벤트 하이라이트
        document.querySelectorAll('.event-item').forEach((item, index) => {
            item.classList.toggle('active', index === eventIndex);
        });
        
        // 현재 이벤트를 보이는 위치로 스크롤
        const activeItem = document.querySelector('.event-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // 페이지 정보 업데이트
        if (event.page_url || event.page) {
            this.pageIndicator.textContent = event.page_url || event.page;
        }
        
        // 이벤트 시각화
        this.visualizeEvent(event);
    }

    visualizeEvent(event) {
        // 페이지 로드 시 화면 구성
        if (event.type === 'page_load' && event.page_url) {
            this.renderPageMockup(event.page_url, event.page_title);
        }
        
        // 커서 위치 업데이트
        if (event.x !== undefined && event.y !== undefined) {
            const viewportRect = this.viewportContent.getBoundingClientRect();
            const scaleX = viewportRect.width / 1920;
            const scaleY = viewportRect.height / 1080;
            
            const scaledX = event.x * scaleX;
            const scaledY = event.y * scaleY;
            
            this.cursor.style.left = `${scaledX}px`;
            this.cursor.style.top = `${scaledY}px`;
            this.cursor.classList.add('visible');
            
            // 클릭 이벤트 시각화
            if (event.type === 'click') {
                this.showClickEffect(scaledX, scaledY);
                this.highlightElement(event.element_id, scaledX, scaledY);
            }
        } else {
            this.cursor.classList.remove('visible');
        }
        
        // 폼 입력 시각화
        if (event.type === 'form_input') {
            this.showFormInput(event);
        }
        
        // 스크롤 시각화
        if (event.type === 'scroll' && event.scrollY !== undefined) {
            this.viewportContent.style.transform = `translateY(-${event.scrollY * 0.1}px)`;
        }
        
        // 오류 시각화
        if (event.type === 'javascript_error') {
            this.showErrorEffect();
        }
    }

    showClickEffect(x, y) {
        const clickEffect = document.createElement('div');
        clickEffect.className = 'click-effect';
        clickEffect.style.left = `${x}px`;
        clickEffect.style.top = `${y}px`;
        
        this.viewportContent.appendChild(clickEffect);
        
        setTimeout(() => {
            if (clickEffect.parentElement) {
                clickEffect.parentElement.removeChild(clickEffect);
            }
        }, 500);
    }

    renderPageMockup(pageUrl, pageTitle) {
        // 기존 페이지 콘텐츠 제거
        const existingMockup = this.viewportContent.querySelector('.page-mockup');
        if (existingMockup) {
            existingMockup.remove();
        }
        
        // 새로운 페이지 목업 생성
        const mockup = document.createElement('div');
        mockup.className = 'page-mockup';
        mockup.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            z-index: 1;
        `;
        
        // 페이지별 목업 HTML 생성
        switch (pageUrl) {
            case '/checkout':
                mockup.innerHTML = this.createCheckoutMockup();
                break;
            case '/products':
                mockup.innerHTML = this.createProductsMockup();
                break;
            case '/dashboard':
                mockup.innerHTML = this.createDashboardMockup();
                break;
            case '/login':
                mockup.innerHTML = this.createLoginMockup();
                break;
            default:
                mockup.innerHTML = this.createDefaultMockup(pageUrl, pageTitle);
        }
        
        this.viewportContent.appendChild(mockup);
    }
    
    createCheckoutMockup() {
        // 실제 시나리오 페이지와 동일한 레이아웃으로 수정
        // 기록된 좌표: cardNumber(450,320), expiry(600,320), cvv(750,320), paymentButton(550,420)
        return `
            <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px;">
                <div style="max-width: 1400px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); overflow: hidden;">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); color: white; padding: 30px; text-align: center;">
                        <h1 style="font-size: 2.5em; margin-bottom: 10px; font-weight: 300;">🐛 버그 재현 및 디버깅</h1>
                        <p style="font-size: 1.1em; opacity: 0.9;">결제 버튼을 눌렀는데 아무 반응이 없어요</p>
                    </div>
                    
                    <!-- Test Interface Area matching the original scenario page -->
                    <div style="padding: 30px; background: #f8f9fa; border-bottom: 1px solid #eee;">
                        <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 2px dashed #e9ecef; min-height: 200px; position: relative;">
                            
                            <!-- Interface Label -->
                            <div style="position: absolute; top: -10px; left: 15px; background: white; padding: 5px 10px; border-radius: 5px; font-size: 0.9rem; color: #6c757d; font-weight: bold;">
                                🛒 결제 페이지 시뮬레이션
                            </div>
                            
                            <!-- Payment Form matching coordinates from recorded session -->
                            <div style="display: flex; flex-direction: column; gap: 15px; padding-top: 30px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                    
                                    <!-- Card Number Field - positioned at recorded coordinates -->
                                    <div style="display: flex; flex-direction: column; position: absolute; left: 400px; top: 280px; width: 200px;">
                                        <label style="margin-bottom: 5px; font-weight: bold; color: #495057;">카드 번호</label>
                                        <input id="cardNumber" type="text" placeholder="1234-5678-9012-3456" style="padding: 10px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; width: 100%;" readonly>
                                    </div>
                                    
                                    <!-- Expiry Field - positioned at recorded coordinates -->
                                    <div style="display: flex; flex-direction: column; position: absolute; left: 550px; top: 280px; width: 100px;">
                                        <label style="margin-bottom: 5px; font-weight: bold; color: #495057;">만료일</label>
                                        <input id="expiry" type="text" placeholder="MM/YY" style="padding: 10px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; width: 100%;" readonly>
                                    </div>
                                    
                                    <!-- CVV Field - positioned at recorded coordinates -->
                                    <div style="display: flex; flex-direction: column; position: absolute; left: 700px; top: 280px; width: 80px;">
                                        <label style="margin-bottom: 5px; font-weight: bold; color: #495057;">CVV</label>
                                        <input id="cvv" type="text" placeholder="123" style="padding: 10px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; width: 100%;" readonly>
                                    </div>
                                    
                                    <!-- Card Type Field -->
                                    <div style="display: flex; flex-direction: column; position: absolute; left: 820px; top: 280px; width: 150px;">
                                        <label style="margin-bottom: 5px; font-weight: bold; color: #495057;">카드 타입</label>
                                        <select id="cardType" style="padding: 10px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; background: white; width: 100%;" disabled>
                                            <option value="">선택하세요</option>
                                            <option value="visa">Visa</option>
                                            <option value="master">MasterCard</option>
                                            <option value="amex">American Express</option>
                                        </select>
                                    </div>
                                    
                                    <!-- Payment Button - positioned at recorded coordinates -->
                                    <button id="paymentButton" style="
                                        position: absolute; 
                                        left: 500px; 
                                        top: 380px; 
                                        width: 200px;
                                        grid-column: 1 / -1; 
                                        background: #dc3545; 
                                        color: white; 
                                        border: none; 
                                        padding: 15px 30px; 
                                        border-radius: 8px; 
                                        font-size: 1.1rem; 
                                        font-weight: bold; 
                                        cursor: not-allowed;
                                        transition: all 0.3s ease;
                                    ">💳 결제하기 (₩50,000)</button>
                                </div>
                            </div>
                            
                            <!-- Error message area -->
                            <div style="position: absolute; left: 400px; top: 450px; width: 400px; padding: 10px; background: #f8d7da; color: #721c24; border-radius: 5px; font-size: 0.9rem; display: none;" id="errorMessage">
                                ❌ 결제 처리 중 오류가 발생했습니다. JavaScript 오류: Cannot read property validate of undefined
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    createProductsMockup() {
        return `
            <div style="font-family: Arial, sans-serif;">
                <nav style="background: #f8f9fa; padding: 20px; border-bottom: 1px solid #ddd;">
                    <div style="max-width: 1200px; margin: 0 auto; display: flex; gap: 30px; align-items: center;">
                        <h1 style="margin: 0; color: #333;">🛍️ 온라인 쇼핑몰</h1>
                        <div style="display: flex; gap: 20px;">
                            <a id="nav-products" href="#" style="padding: 10px 15px; text-decoration: none; color: #007bff; position: absolute; left: 150px; top: 100px;">상품</a>
                            <a id="nav-categories" href="#" style="padding: 10px 15px; text-decoration: none; color: #666; position: absolute; left: 200px; top: 100px;">카테고리</a>
                            <a id="nav-brands" href="#" style="padding: 10px 15px; text-decoration: none; color: #666; position: absolute; left: 300px; top: 100px;">브랜드</a>
                            <a id="nav-deals" href="#" style="padding: 10px 15px; text-decoration: none; color: #666; position: absolute; left: 400px; top: 100px;">특가</a>
                            <a id="nav-support" href="#" style="padding: 10px 15px; text-decoration: none; color: #666; position: absolute; left: 500px; top: 100px;">고객센터</a>
                            <a id="nav-account" href="#" style="padding: 10px 15px; text-decoration: none; color: #666; position: absolute; left: 600px; top: 100px;">내 계정</a>
                        </div>
                    </div>
                </nav>
                <div style="padding: 40px; max-width: 1200px; margin: 0 auto;">
                    <h2 style="margin-bottom: 30px; color: #333;">인기 상품</h2>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                        ${Array(8).fill(0).map((_, i) => `
                            <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden; background: white;">
                                <div style="height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999;">상품 ${i+1}</div>
                                <div style="padding: 15px;">
                                    <h3 style="margin: 0 0 10px 0; font-size: 16px;">상품명 ${i+1}</h3>
                                    <p style="margin: 0; color: #007bff; font-weight: bold;">${(Math.random() * 100000 + 10000).toFixed(0)}원</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    createDashboardMockup() {
        return `
            <div style="font-family: Arial, sans-serif; background: #f5f5f5; min-height: 100vh;">
                <nav style="background: #2c3e50; color: white; padding: 20px;">
                    <div style="max-width: 1200px; margin: 0 auto;">
                        <h1 style="margin: 0;">📊 관리자 대시보드</h1>
                    </div>
                </nav>
                <div style="padding: 40px; max-width: 1200px; margin: 0 auto;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
                        <div id="sales-chart" style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); position: absolute; left: 300px; top: 200px; width: 400px; height: 250px; cursor: pointer;">
                            <h3 style="margin: 0 0 20px 0; color: #333;">📈 매출 차트</h3>
                            <div style="height: 180px; background: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%); background-size: 20px 20px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #999;">차트 로딩 중...</div>
                        </div>
                        <div id="users-chart" style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); position: absolute; left: 500px; top: 200px; width: 400px; height: 250px; cursor: pointer;">
                            <h3 style="margin: 0 0 20px 0; color: #333;">👥 사용자 차트</h3>
                            <div style="height: 180px; background: linear-gradient(45deg, #e3f2fd 25%, transparent 25%), linear-gradient(-45deg, #e3f2fd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e3f2fd 75%), linear-gradient(-45deg, transparent 75%, #e3f2fd 75%); background-size: 20px 20px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #1976d2;">사용자 분석</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                        ${['총 매출', '신규 고객', '주문 수', '전환율'].map((title, i) => `
                            <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center;">
                                <h4 style="margin: 0 0 15px 0; color: #666; font-size: 14px;">${title}</h4>
                                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #2c3e50;">${['₩2.4M', '1,234', '856', '12.3%'][i]}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    createLoginMockup() {
        return `
            <div style="display: flex; min-height: 100vh; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: Arial, sans-serif;">
                <div style="background: white; padding: 50px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); width: 400px;">
                    <h1 style="text-align: center; margin-bottom: 40px; color: #333;">🔐 로그인</h1>
                    <form>
                        <div style="margin-bottom: 25px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">사용자명</label>
                            <input type="text" placeholder="사용자명을 입력하세요" style="width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; position: absolute; left: 400px; top: 300px;" readonly>
                        </div>
                        <div style="margin-bottom: 35px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">비밀번호</label>
                            <input type="password" placeholder="비밀번호를 입력하세요" style="width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px;" readonly>
                        </div>
                        <button type="button" style="width: 100%; background: #007bff; color: white; padding: 18px; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; cursor: pointer;">로그인</button>
                    </form>
                </div>
            </div>
        `;
    }
    
    createDefaultMockup(pageUrl, pageTitle) {
        return `
            <div style="padding: 40px; font-family: Arial, sans-serif; text-align: center;">
                <h1 style="color: #333; margin-bottom: 30px;">${pageTitle || '페이지'}</h1>
                <p style="color: #666; font-size: 18px; margin-bottom: 40px;">URL: ${pageUrl}</p>
                <div style="background: #f8f9fa; padding: 60px; border-radius: 12px; border: 2px dashed #ddd;">
                    <p style="color: #999; font-size: 16px; margin: 0;">페이지 콘텐츠가 여기에 표시됩니다</p>
                </div>
            </div>
        `;
    }
    
    highlightElement(elementId, x, y) {
        if (!elementId) return;
        
        // 요소 하이라이트 효과
        const highlight = document.createElement('div');
        highlight.className = 'element-highlight';
        highlight.style.cssText = `
            position: absolute;
            left: ${x - 10}px;
            top: ${y - 10}px;
            width: 200px;
            height: 40px;
            border: 3px solid #ff6b35;
            border-radius: 8px;
            background: rgba(255, 107, 53, 0.1);
            z-index: 999;
            pointer-events: none;
            animation: highlightPulse 1s ease-out;
        `;
        
        this.viewportContent.appendChild(highlight);
        
        setTimeout(() => {
            if (highlight.parentElement) {
                highlight.parentElement.removeChild(highlight);
            }
        }, 1000);
    }
    
    showFormInput(event) {
        if (!event.value_masked || !event.x || !event.y) return;
        
        const viewportRect = this.viewportContent.getBoundingClientRect();
        const scaleX = viewportRect.width / 1920;
        const scaleY = viewportRect.height / 1080;
        
        const scaledX = event.x * scaleX;
        const scaledY = event.y * scaleY;
        
        // 기존 입력 표시 제거
        const existingInputs = this.viewportContent.querySelectorAll('.form-input-overlay');
        existingInputs.forEach(input => {
            if (input.dataset.elementId === event.element_id) {
                input.remove();
            }
        });
        
        // 입력값 오버레이 생성
        const inputOverlay = document.createElement('div');
        inputOverlay.className = 'form-input-overlay';
        inputOverlay.dataset.elementId = event.element_id;
        inputOverlay.style.cssText = `
            position: absolute;
            left: ${scaledX}px;
            top: ${scaledY}px;
            background: rgba(0, 123, 255, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            transform: translateY(-40px);
            white-space: nowrap;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        
        inputOverlay.innerHTML = `
            <div style="font-size: 11px; opacity: 0.8; margin-bottom: 2px;">${event.element_id}</div>
            <div>"${event.value_masked}"</div>
        `;
        
        this.viewportContent.appendChild(inputOverlay);
        
        // 2초 후 제거
        setTimeout(() => {
            if (inputOverlay.parentElement) {
                inputOverlay.parentElement.removeChild(inputOverlay);
            }
        }, 2000);
    }
    
    showErrorEffect() {
        const errorOverlay = document.createElement('div');
        errorOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(220, 53, 69, 0.1);
            z-index: 998;
            pointer-events: none;
            animation: errorFlash 0.5s ease-out;
        `;
        
        this.viewportContent.appendChild(errorOverlay);
        
        setTimeout(() => {
            if (errorOverlay.parentElement) {
                errorOverlay.parentElement.removeChild(errorOverlay);
            }
        }, 500);
    }

    previousEvent() {
        this.pausePlayback();
        this.goToEvent(this.currentEventIndex - 1);
    }

    nextEvent() {
        this.pausePlayback();
        this.goToEvent(this.currentEventIndex + 1);
    }

    restartPlayback() {
        this.pausePlayback();
        this.goToEvent(0);
        this.startPlayback();
    }

    updateTimelineProgress(progress) {
        const percentage = Math.max(0, Math.min(100, progress * 100));
        this.timelineProgress.style.width = `${percentage}%`;
    }

    onTimelineClick(e) {
        const rect = this.timeline.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const progress = clickX / rect.width;
        
        const totalDuration = this.events[this.events.length - 1]?.timestamp || 0;
        const targetTime = progress * totalDuration;
        
        let targetEventIndex = this.events.findIndex(event => event.timestamp > targetTime) - 1;
        if (targetEventIndex < 0) targetEventIndex = this.events.length - 1;
        
        this.pausePlayback();
        this.goToEvent(targetEventIndex);
    }

    onTimelineThumbDrag(e) {
        e.preventDefault();
        const rect = this.timeline.getBoundingClientRect();
        
        const onMouseMove = (e) => {
            const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            this.updateTimelineProgress(progress);
            
            const totalDuration = this.events[this.events.length - 1]?.timestamp || 0;
            const targetTime = progress * totalDuration;
            this.currentTime.textContent = this.formatTime(targetTime);
        };
        
        const onMouseUp = (e) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const totalDuration = this.events[this.events.length - 1]?.timestamp || 0;
            const targetTime = progress * totalDuration;
            
            let targetEventIndex = this.events.findIndex(event => event.timestamp > targetTime) - 1;
            if (targetEventIndex < 0) targetEventIndex = this.events.length - 1;
            
            this.pausePlayback();
            this.goToEvent(targetEventIndex);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    handleKeyboard(e) {
        if (!this.currentSession) return;
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlayback();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.previousEvent();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextEvent();
                break;
            case 'Home':
                e.preventDefault();
                this.restartPlayback();
                break;
        }
    }

    showLoading(show) {
        this.loading.style.display = show ? 'flex' : 'none';
    }

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        
        if (minutes > 0) {
            return `${minutes}분 ${seconds % 60}초`;
        } else {
            return `${seconds}초`;
        }
    }
}

// 페이지 로드 시 플레이어 초기화
document.addEventListener('DOMContentLoaded', () => {
    const player = new SessionReplayPlayer();
    
    // 전역에서 접근 가능하도록 설정 (디버깅용)
    window.sessionPlayer = player;
});