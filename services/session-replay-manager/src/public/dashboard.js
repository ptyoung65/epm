/**
 * AIRIS EPM 세션 리플레이 관리자 대시보드 JavaScript
 */

class OpenReplayAdminDashboard {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.currentSessionId = null;
        this.refreshInterval = null;
        
        this.init();
    }

    /**
     * 대시보드 초기화
     */
    async init() {
        console.log('🚀 OpenReplay Admin Dashboard 초기화 중...');
        
        try {
            // WebSocket 연결
            await this.initializeWebSocket();
            
            // 차트 초기화
            this.initializeCharts();
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            // OpenReplay SDK 초기화
            this.initializeOpenReplay();
            
            // 초기 데이터 로드
            await this.loadInitialData();
            
            // 자동 새로고침 시작
            this.startAutoRefresh();
            
            console.log('✅ 대시보드 초기화 완료');
            
        } catch (error) {
            console.error('❌ 대시보드 초기화 실패:', error);
            this.showNotification('대시보드 초기화에 실패했습니다.', 'error');
        }
    }

    /**
     * WebSocket 연결 초기화
     */
    async initializeWebSocket() {
        try {
            this.socket = io({
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true,
            });

            this.socket.on('connect', () => {
                console.log('🔌 WebSocket 연결됨');
                this.updateConnectionStatus('connected');
            });

            this.socket.on('disconnect', () => {
                console.log('🔌 WebSocket 연결 끊어짐');
                this.updateConnectionStatus('disconnected');
            });

            this.socket.on('sessionUpdate', (data) => {
                this.handleSessionUpdate(data);
            });

            this.socket.on('alertCreated', (alert) => {
                this.handleNewAlert(alert);
            });

            this.socket.on('systemHealthUpdate', (health) => {
                this.handleSystemHealthUpdate(health);
            });

            this.socket.on('metricsUpdate', (metrics) => {
                this.handleMetricsUpdate(metrics);
            });

        } catch (error) {
            console.error('WebSocket 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * 차트 초기화
     */
    initializeCharts() {
        // 세션 트렌드 차트
        const sessionTrendCtx = document.getElementById('sessionTrendChart').getContext('2d');
        this.charts.sessionTrend = new Chart(sessionTrendCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '총 세션',
                    data: [],
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                }, {
                    label: '활성 세션',
                    data: [],
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                }, {
                    label: '에러 세션',
                    data: [],
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });

        // 에러 분포 차트 (도넛 차트)
        const errorDistributionCtx = document.getElementById('errorDistributionChart').getContext('2d');
        this.charts.errorDistribution = new Chart(errorDistributionCtx, {
            type: 'doughnut',
            data: {
                labels: ['JavaScript 에러', '네트워크 에러', 'UI 에러', '기타'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(107, 114, 128, 0.8)',
                    ],
                    borderColor: [
                        'rgb(239, 68, 68)',
                        'rgb(245, 158, 11)',
                        'rgb(139, 92, 246)',
                        'rgb(107, 114, 128)',
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.raw} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 새로고침 버튼
        document.getElementById('refreshSessions')?.addEventListener('click', () => {
            this.refreshSessions();
        });

        // 내보내기 버튼
        document.getElementById('exportSessions')?.addEventListener('click', () => {
            this.exportSessions();
        });

        // 알림 버튼
        document.getElementById('alertsButton')?.addEventListener('click', () => {
            this.showAlertsModal();
        });

        // 모든 알림 지우기
        document.getElementById('clearAllAlerts')?.addEventListener('click', () => {
            this.clearAllAlerts();
        });

        // 세션 모달 닫기
        document.getElementById('closeSessionModal')?.addEventListener('click', () => {
            this.closeSessionModal();
        });

        document.getElementById('closeSessionModal2')?.addEventListener('click', () => {
            this.closeSessionModal();
        });

        // 리플레이 재생 버튼
        document.getElementById('playRecording')?.addEventListener('click', () => {
            this.playSessionRecording();
        });

        // 세션 다운로드 버튼
        document.getElementById('downloadSession')?.addEventListener('click', () => {
            this.downloadSession();
        });

        // 키보드 이벤트
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeSessionModal();
            }
        });

        // 창 크기 변경시 차트 리사이즈
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        });
    }

    /**
     * OpenReplay SDK 초기화
     */
    initializeOpenReplay() {
        try {
            // OpenReplay 추적 초기화 (관리자 대시보드도 추적)
            if (typeof OpenReplay !== 'undefined') {
                const tracker = new OpenReplay({
                    projectKey: 'admin-dashboard',
                    ingestPoint: window.location.origin + '/ingest',
                    defaultInputMode: 0, // 민감한 데이터 마스킹
                    captureIFrames: false,
                });
                
                tracker.start();
                console.log('📹 OpenReplay 추적 시작됨');
            }
        } catch (error) {
            console.warn('OpenReplay 초기화 실패:', error);
        }
    }

    /**
     * 초기 데이터 로드
     */
    async loadInitialData() {
        try {
            // 병렬로 데이터 로드
            const [metrics, sessions, alerts, systemHealth] = await Promise.all([
                this.fetchMetrics(),
                this.fetchSessions(),
                this.fetchAlerts(),
                this.fetchSystemHealth()
            ]);

            // UI 업데이트
            this.updateMetricsDisplay(metrics);
            this.updateSessionsTable(sessions);
            this.updateAlertsList(alerts);
            this.updateSystemHealth(systemHealth);

        } catch (error) {
            console.error('초기 데이터 로드 실패:', error);
            this.showNotification('데이터를 불러오는데 실패했습니다.', 'error');
        }
    }

    /**
     * API 호출 헬퍼
     */
    async apiCall(endpoint, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        };

        const response = await fetch(`/api${endpoint}`, { ...defaultOptions, ...options });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * 메트릭 데이터 가져오기
     */
    async fetchMetrics() {
        return this.apiCall('/dashboard/metrics');
    }

    /**
     * 세션 데이터 가져오기
     */
    async fetchSessions(params = {}) {
        const queryString = new URLSearchParams({
            limit: 20,
            ...params
        }).toString();
        
        return this.apiCall(`/sessions?${queryString}`);
    }

    /**
     * 알림 데이터 가져오기
     */
    async fetchAlerts() {
        return this.apiCall('/admin/alerts');
    }

    /**
     * 시스템 상태 가져오기
     */
    async fetchSystemHealth() {
        return this.apiCall('/admin/health');
    }

    /**
     * 메트릭 표시 업데이트
     */
    updateMetricsDisplay(metrics) {
        if (!metrics) return;

        // 개요 카드 업데이트
        this.updateElement('totalSessions', this.formatNumber(metrics.sessions?.total || 0));
        this.updateElement('activeSessions', this.formatNumber(metrics.sessions?.active || 0));
        this.updateElement('errorSessions', this.formatNumber(metrics.sessions?.failed || 0));
        this.updateElement('avgSessionDuration', this.formatDuration(metrics.sessions?.avgDuration || 0));

        // 차트 데이터 업데이트
        this.updateSessionTrendChart(metrics);
        this.updateErrorDistributionChart(metrics);
    }

    /**
     * 세션 트렌드 차트 업데이트
     */
    updateSessionTrendChart(metrics) {
        if (!this.charts.sessionTrend || !metrics.trends) return;

        const chart = this.charts.sessionTrend;
        const trends = metrics.trends;

        chart.data.labels = trends.labels || [];
        chart.data.datasets[0].data = trends.totalSessions || [];
        chart.data.datasets[1].data = trends.activeSessions || [];
        chart.data.datasets[2].data = trends.errorSessions || [];

        chart.update('none');
    }

    /**
     * 에러 분포 차트 업데이트
     */
    updateErrorDistributionChart(metrics) {
        if (!this.charts.errorDistribution || !metrics.errors) return;

        const chart = this.charts.errorDistribution;
        const errors = metrics.errors;

        chart.data.datasets[0].data = [
            errors.javascriptErrors || 0,
            errors.networkErrors || 0,
            errors.uiErrors || 0,
            errors.otherErrors || 0,
        ];

        chart.update('none');
    }

    /**
     * 세션 테이블 업데이트
     */
    updateSessionsTable(sessions) {
        const tbody = document.getElementById('sessionsTableBody');
        if (!tbody || !sessions?.sessions) return;

        tbody.innerHTML = '';

        sessions.sessions.forEach(session => {
            const row = this.createSessionTableRow(session);
            tbody.appendChild(row);
        });
    }

    /**
     * 세션 테이블 행 생성
     */
    createSessionTableRow(session) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 cursor-pointer session-card';
        
        // 상태에 따른 색상
        const statusColors = {
            active: 'bg-green-100 text-green-800',
            completed: 'bg-blue-100 text-blue-800',
            failed: 'bg-red-100 text-red-800',
        };

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <span class="font-mono">${session.sessionId.substring(0, 12)}...</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${session.userEmail || session.userId || '익명'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${this.formatDateTime(session.startTime)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${this.formatDuration(session.duration)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${session.events || 0}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span class="${session.errors > 0 ? 'text-red-600 font-medium' : ''}">${session.errors || 0}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[session.status] || 'bg-gray-100 text-gray-800'}">
                    ${this.getStatusText(session.status)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button class="text-blue-600 hover:text-blue-900 mr-3" onclick="dashboard.viewSession('${session.sessionId}')">
                    상세보기
                </button>
                <button class="text-green-600 hover:text-green-900" onclick="dashboard.playSession('${session.sessionId}')">
                    재생
                </button>
            </td>
        `;

        return row;
    }

    /**
     * 알림 목록 업데이트
     */
    updateAlertsList(alerts) {
        const container = document.getElementById('alertsList');
        const badge = document.getElementById('alertsBadge');
        
        if (!container) return;

        // 알림 배지 업데이트
        const activeAlerts = alerts?.alerts?.filter(alert => !alert.acknowledged) || [];
        if (badge) {
            badge.textContent = activeAlerts.length;
            badge.classList.toggle('hidden', activeAlerts.length === 0);
        }

        // 알림 목록 업데이트
        if (!alerts?.alerts || alerts.alerts.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">알림이 없습니다.</p>';
            return;
        }

        container.innerHTML = '';
        alerts.alerts.slice(0, 5).forEach(alert => {
            const alertElement = this.createAlertElement(alert);
            container.appendChild(alertElement);
        });
    }

    /**
     * 알림 요소 생성
     */
    createAlertElement(alert) {
        const div = document.createElement('div');
        div.className = 'border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors';

        const alertTypeColors = {
            critical: 'alert-critical',
            warning: 'alert-warning',
            info: 'alert-info',
            error: 'alert-critical',
        };

        div.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center mb-1">
                        <span class="alert-badge ${alertTypeColors[alert.type] || 'alert-info'}">${alert.type.toUpperCase()}</span>
                        <span class="text-xs text-gray-500 ml-2">${this.formatRelativeTime(alert.timestamp)}</span>
                    </div>
                    <h4 class="text-sm font-medium text-gray-900">${alert.title}</h4>
                    <p class="text-sm text-gray-600 mt-1">${alert.message}</p>
                    <p class="text-xs text-gray-500 mt-1">컴포넌트: ${alert.component}</p>
                </div>
                ${!alert.acknowledged ? `
                <button class="text-xs text-blue-600 hover:text-blue-800 ml-2" onclick="dashboard.acknowledgeAlert('${alert.id}')">
                    확인
                </button>
                ` : ''}
            </div>
        `;

        return div;
    }

    /**
     * 시스템 상태 업데이트
     */
    updateSystemHealth(health) {
        if (!health) return;

        // 전체 시스템 상태 업데이트
        this.updateSystemStatus(health.status);

        // 컴포넌트별 상태 업데이트
        this.updateSystemComponents(health.components);
    }

    /**
     * 시스템 상태 표시기 업데이트
     */
    updateSystemStatus(status) {
        const statusElement = document.getElementById('systemStatus');
        if (!statusElement) return;

        const statusConfig = {
            healthy: { class: 'status-healthy', text: '시스템 정상' },
            warning: { class: 'status-warning', text: '주의 필요' },
            critical: { class: 'status-critical', text: '긴급 상황' },
        };

        const config = statusConfig[status] || statusConfig.healthy;
        
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('span:last-child');

        if (indicator) {
            indicator.className = `status-indicator ${config.class} pulse-animation`;
        }
        
        if (text) {
            text.textContent = config.text;
        }
    }

    /**
     * 시스템 컴포넌트 상태 업데이트
     */
    updateSystemComponents(components) {
        const container = document.getElementById('systemComponents');
        if (!container || !components) return;

        container.innerHTML = '';

        const allComponents = [
            components.openreplay,
            components.database,
            components.redis,
            components.storage,
            ...(components.services || [])
        ].filter(Boolean);

        allComponents.forEach(component => {
            const componentElement = this.createComponentElement(component);
            container.appendChild(componentElement);
        });
    }

    /**
     * 컴포넌트 상태 요소 생성
     */
    createComponentElement(component) {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between py-2';

        const statusColors = {
            up: 'status-healthy',
            degraded: 'status-warning',
            down: 'status-critical',
        };

        div.innerHTML = `
            <div class="flex items-center">
                <span class="status-indicator ${statusColors[component.status] || 'status-critical'}"></span>
                <span class="text-sm font-medium text-gray-900">${component.name}</span>
            </div>
            <div class="text-right">
                <div class="text-xs text-gray-500">${component.responseTime}ms</div>
                ${component.lastError ? `<div class="text-xs text-red-500" title="${component.lastError}">오류</div>` : ''}
            </div>
        `;

        return div;
    }

    /**
     * WebSocket 이벤트 핸들러들
     */
    handleSessionUpdate(data) {
        console.log('세션 업데이트:', data);
        // 실시간 세션 테이블 업데이트
        this.refreshSessions();
    }

    handleNewAlert(alert) {
        console.log('새 알림:', alert);
        
        // 알림 목록에 추가
        this.addAlertToList(alert);
        
        // 브라우저 알림 표시
        this.showBrowserNotification(alert);
        
        // 오디오 알림 (critical한 경우만)
        if (alert.type === 'critical') {
            this.playAlertSound();
        }
    }

    handleSystemHealthUpdate(health) {
        console.log('시스템 상태 업데이트:', health);
        this.updateSystemHealth(health);
    }

    handleMetricsUpdate(metrics) {
        console.log('메트릭 업데이트:', metrics);
        this.updateMetricsDisplay(metrics);
    }

    /**
     * 세션 관련 메서드들
     */
    async viewSession(sessionId) {
        try {
            this.currentSessionId = sessionId;
            
            // 세션 상세 정보 가져오기
            const sessionData = await this.apiCall(`/sessions/${sessionId}`);
            
            // 모달에 세션 정보 표시
            this.showSessionModal(sessionData);
            
        } catch (error) {
            console.error('세션 조회 실패:', error);
            this.showNotification('세션 정보를 불러올 수 없습니다.', 'error');
        }
    }

    async playSession(sessionId) {
        try {
            // OpenReplay 플레이어로 세션 재생
            const recordingData = await this.apiCall(`/sessions/${sessionId}/recording`);
            
            if (recordingData && recordingData.url) {
                // 새 창에서 리플레이 재생
                window.open(recordingData.url, '_blank', 'width=1200,height=800');
            } else {
                this.showNotification('리플레이 데이터를 찾을 수 없습니다.', 'warning');
            }
            
        } catch (error) {
            console.error('세션 재생 실패:', error);
            this.showNotification('세션을 재생할 수 없습니다.', 'error');
        }
    }

    showSessionModal(sessionData) {
        const modal = document.getElementById('sessionModal');
        const details = document.getElementById('sessionDetails');
        
        if (!modal || !details) return;

        details.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">기본 정보</h4>
                    <dl class="space-y-1 text-sm">
                        <div class="flex"><dt class="w-20 text-gray-500">세션 ID:</dt><dd class="font-mono">${sessionData.sessionId}</dd></div>
                        <div class="flex"><dt class="w-20 text-gray-500">사용자:</dt><dd>${sessionData.userEmail || sessionData.userId || '익명'}</dd></div>
                        <div class="flex"><dt class="w-20 text-gray-500">시작:</dt><dd>${this.formatDateTime(sessionData.startTime)}</dd></div>
                        <div class="flex"><dt class="w-20 text-gray-500">종료:</dt><dd>${sessionData.endTime ? this.formatDateTime(sessionData.endTime) : '진행중'}</dd></div>
                        <div class="flex"><dt class="w-20 text-gray-500">지속시간:</dt><dd>${this.formatDuration(sessionData.duration)}</dd></div>
                    </dl>
                </div>
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">활동 통계</h4>
                    <dl class="space-y-1 text-sm">
                        <div class="flex"><dt class="w-20 text-gray-500">페이지뷰:</dt><dd>${sessionData.pageViews || 0}</dd></div>
                        <div class="flex"><dt class="w-20 text-gray-500">이벤트:</dt><dd>${sessionData.events || 0}</dd></div>
                        <div class="flex"><dt class="w-20 text-gray-500">에러:</dt><dd class="${sessionData.errors > 0 ? 'text-red-600 font-medium' : ''}">${sessionData.errors || 0}</dd></div>
                        <div class="flex"><dt class="w-20 text-gray-500">크래시:</dt><dd class="${sessionData.crashes > 0 ? 'text-red-600 font-medium' : ''}">${sessionData.crashes || 0}</dd></div>
                        <div class="flex"><dt class="w-20 text-gray-500">상태:</dt><dd><span class="px-2 py-1 rounded-full text-xs ${this.getStatusBadgeClass(sessionData.status)}">${this.getStatusText(sessionData.status)}</span></dd></div>
                    </dl>
                </div>
            </div>
            
            <div class="mt-4">
                <h4 class="font-medium text-gray-900 mb-2">기술 정보</h4>
                <dl class="space-y-1 text-sm">
                    <div class="flex"><dt class="w-20 text-gray-500">User Agent:</dt><dd class="break-all">${sessionData.userAgent || 'N/A'}</dd></div>
                    <div class="flex"><dt class="w-20 text-gray-500">위치:</dt><dd>${sessionData.location?.country || 'N/A'} ${sessionData.location?.city || ''}</dd></div>
                    <div class="flex"><dt class="w-20 text-gray-500">IP:</dt><dd>${sessionData.location?.ip || 'N/A'}</dd></div>
                </dl>
            </div>
            
            ${sessionData.metadata ? `
            <div class="mt-4">
                <h4 class="font-medium text-gray-900 mb-2">메타데이터</h4>
                <pre class="bg-gray-100 p-3 rounded text-xs overflow-auto">${JSON.stringify(sessionData.metadata, null, 2)}</pre>
            </div>
            ` : ''}
        `;

        modal.classList.remove('hidden');
    }

    closeSessionModal() {
        const modal = document.getElementById('sessionModal');
        if (modal) {
            modal.classList.add('hidden');
            this.currentSessionId = null;
        }
    }

    async playSessionRecording() {
        if (!this.currentSessionId) return;
        
        await this.playSession(this.currentSessionId);
    }

    async downloadSession() {
        if (!this.currentSessionId) return;
        
        try {
            const response = await fetch(`/api/sessions/${this.currentSessionId}/export`, {
                method: 'GET',
                credentials: 'include',
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `session_${this.currentSessionId}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                this.showNotification('세션 데이터를 다운로드했습니다.', 'success');
            } else {
                throw new Error('Export failed');
            }
            
        } catch (error) {
            console.error('세션 다운로드 실패:', error);
            this.showNotification('세션 다운로드에 실패했습니다.', 'error');
        }
    }

    /**
     * 알림 관련 메서드들
     */
    async acknowledgeAlert(alertId) {
        try {
            await this.apiCall(`/admin/alerts/${alertId}/acknowledge`, {
                method: 'POST'
            });
            
            this.showNotification('알림을 확인했습니다.', 'success');
            
            // 알림 목록 새로고침
            const alerts = await this.fetchAlerts();
            this.updateAlertsList(alerts);
            
        } catch (error) {
            console.error('알림 확인 실패:', error);
            this.showNotification('알림 확인에 실패했습니다.', 'error');
        }
    }

    async clearAllAlerts() {
        if (!confirm('모든 알림을 지우시겠습니까?')) return;
        
        try {
            await this.apiCall('/admin/alerts/clear-all', {
                method: 'POST'
            });
            
            this.showNotification('모든 알림을 지웠습니다.', 'success');
            
            // 알림 목록 새로고침
            const alerts = await this.fetchAlerts();
            this.updateAlertsList(alerts);
            
        } catch (error) {
            console.error('알림 지우기 실패:', error);
            this.showNotification('알림 지우기에 실패했습니다.', 'error');
        }
    }

    addAlertToList(alert) {
        const container = document.getElementById('alertsList');
        if (!container) return;

        const alertElement = this.createAlertElement(alert);
        container.insertBefore(alertElement, container.firstChild);

        // 최대 5개까지만 표시
        while (container.children.length > 5) {
            container.removeChild(container.lastChild);
        }

        // 알림 배지 업데이트
        const badge = document.getElementById('alertsBadge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            badge.textContent = currentCount + 1;
            badge.classList.remove('hidden');
        }
    }

    showBrowserNotification(alert) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`${alert.title}`, {
                body: alert.message,
                icon: '/static/icon-192.png',
                tag: alert.id,
                requireInteraction: alert.type === 'critical',
            });
        }
    }

    playAlertSound() {
        // 간단한 비프음 생성
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'square';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.warn('알림 소리 재생 실패:', error);
        }
    }

    /**
     * 유틸리티 메서드들
     */
    async refreshSessions() {
        try {
            const sessions = await this.fetchSessions();
            this.updateSessionsTable(sessions);
            this.showNotification('세션 목록을 새로고침했습니다.', 'success');
        } catch (error) {
            console.error('세션 새로고침 실패:', error);
            this.showNotification('세션 새로고침에 실패했습니다.', 'error');
        }
    }

    async exportSessions() {
        try {
            const response = await fetch('/api/sessions/export', {
                method: 'GET',
                credentials: 'include',
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `sessions_export_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                this.showNotification('세션 데이터를 내보냈습니다.', 'success');
            } else {
                throw new Error('Export failed');
            }
            
        } catch (error) {
            console.error('세션 내보내기 실패:', error);
            this.showNotification('세션 내보내기에 실패했습니다.', 'error');
        }
    }

    startAutoRefresh() {
        // 30초마다 데이터 새로고침
        this.refreshInterval = setInterval(async () => {
            try {
                const [metrics, sessions] = await Promise.all([
                    this.fetchMetrics(),
                    this.fetchSessions()
                ]);
                
                this.updateMetricsDisplay(metrics);
                this.updateSessionsTable(sessions);
                
            } catch (error) {
                console.error('자동 새로고침 실패:', error);
            }
        }, 30000);
        
        console.log('📱 자동 새로고침 시작됨 (30초 간격)');
    }

    updateConnectionStatus(status) {
        // 연결 상태에 따라 UI 업데이트
        const systemStatus = document.getElementById('systemStatus');
        if (!systemStatus) return;

        if (status === 'connected') {
            systemStatus.style.opacity = '1';
        } else {
            systemStatus.style.opacity = '0.5';
        }
    }

    updateElement(elementId, content) {
        const element = document.getElementById(elementId);
        if (element && content !== undefined) {
            element.textContent = content;
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0초';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}시간 ${minutes}분`;
        } else if (minutes > 0) {
            return `${minutes}분 ${secs}초`;
        } else {
            return `${secs}초`;
        }
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatRelativeTime(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) {
            return '방금 전';
        } else if (diffInSeconds < 3600) {
            return `${Math.floor(diffInSeconds / 60)}분 전`;
        } else if (diffInSeconds < 86400) {
            return `${Math.floor(diffInSeconds / 3600)}시간 전`;
        } else {
            return `${Math.floor(diffInSeconds / 86400)}일 전`;
        }
    }

    getStatusText(status) {
        const statusMap = {
            active: '활성',
            completed: '완료',
            failed: '실패',
        };
        return statusMap[status] || status;
    }

    getStatusBadgeClass(status) {
        const classMap = {
            active: 'bg-green-100 text-green-800',
            completed: 'bg-blue-100 text-blue-800',
            failed: 'bg-red-100 text-red-800',
        };
        return classMap[status] || 'bg-gray-100 text-gray-800';
    }

    showNotification(message, type = 'info') {
        // 간단한 토스트 알림 생성
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 max-w-sm`;
        
        const colors = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-white',
            info: 'bg-blue-500 text-white',
        };
        
        toast.className += ` ${colors[type] || colors.info}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 애니메이션
        setTimeout(() => toast.classList.add('translate-x-0'), 10);
        
        // 3초 후 제거
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    // 정리 메서드
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        
        console.log('🧹 대시보드 정리됨');
    }
}

// 전역 대시보드 인스턴스 생성
const dashboard = new OpenReplayAdminDashboard();

// 페이지 언로드시 정리
window.addEventListener('beforeunload', () => {
    dashboard.destroy();
});

// 브라우저 알림 권한 요청
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}