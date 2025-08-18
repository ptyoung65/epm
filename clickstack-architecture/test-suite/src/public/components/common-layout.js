/**
 * AIRIS-MON 공통 레이아웃 시스템
 * 모든 페이지에서 일관된 사이드바와 디자인을 제공
 */

class AirisCommonLayout {
    constructor() {
        this.sidebarWidth = '260px';
        this.init();
    }

    init() {
        this.injectCommonStyles();
        this.createSidebar();
        this.createHeader();
        this.adjustMainContent();
        this.setupEventListeners();
        this.updateTime();
    }

    injectCommonStyles() {
        const styleId = 'airis-common-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            :root {
                --primary: #2563eb;
                --primary-light: #3b82f6;
                --primary-dark: #1d4ed8;
                --white: #ffffff;
                --gray-50: #f8fafc;
                --gray-100: #f1f5f9;
                --gray-200: #e2e8f0;
                --gray-600: #475569;
                --gray-800: #1e293b;
                --gray-900: #0f172a;
                --success: #10b981;
                --warning: #f59e0b;
                --error: #ef4444;
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Noto Sans KR', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background-color: var(--gray-50);
                color: var(--gray-800);
                line-height: 1.6;
            }

            .airis-app-container {
                display: flex;
                min-height: 100vh;
            }

            /* 사이드바 스타일 */
            .airis-sidebar {
                width: 260px;
                background: var(--white);
                border-right: 1px solid var(--gray-200);
                position: fixed;
                top: 0;
                left: 0;
                height: 100vh;
                overflow-y: auto;
                z-index: 1000;
                transition: transform 0.3s ease;
            }

            .airis-sidebar.collapsed {
                width: 60px;
            }

            .airis-sidebar.collapsed .airis-nav-section-title,
            .airis-sidebar.collapsed .airis-nav-link span:not(.airis-nav-icon) {
                display: none;
            }

            .airis-sidebar.collapsed .airis-nav-link {
                justify-content: center;
                padding: 12px 8px;
            }

            .airis-sidebar.collapsed .airis-nav-section {
                margin-bottom: 16px;
            }

            .airis-sidebar-header {
                padding: 24px 20px;
                border-bottom: 1px solid var(--gray-200);
                background: var(--primary);
                color: var(--white);
                position: relative;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .airis-toggle-btn {
                background: none;
                border: none;
                color: var(--white);
                font-size: 18px;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background-color 0.2s;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .airis-toggle-btn:hover {
                background-color: rgba(255, 255, 255, 0.2);
            }

            .airis-sidebar.collapsed .airis-sidebar-logo {
                display: none;
            }

            .airis-sidebar.collapsed .airis-sidebar-header {
                padding: 20px 14px;
                justify-content: center;
            }

            .airis-sidebar.collapsed .airis-toggle-btn {
                margin: 0;
            }

            .airis-sidebar-logo {
                font-size: 18px;
                font-weight: 700;
            }

            .airis-sidebar-nav {
                padding: 20px 0;
            }

            .airis-nav-section {
                margin-bottom: 32px;
            }

            .airis-nav-section-title {
                padding: 0 20px 8px;
                font-size: 12px;
                font-weight: 600;
                color: var(--gray-600);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .airis-nav-item {
                margin: 4px 12px;
            }

            .airis-nav-link {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                color: var(--gray-600);
                text-decoration: none;
                border-radius: 8px;
                transition: all 0.2s;
                font-weight: 500;
            }

            .airis-nav-link:hover {
                background: var(--gray-100);
                color: var(--primary);
            }

            .airis-nav-link.active {
                background: var(--primary);
                color: var(--white);
            }

            .airis-nav-icon {
                margin-right: 12px;
                font-size: 16px;
            }

            /* 메인 컨텐츠 */
            .airis-main-content {
                flex: 1;
                margin-left: 260px;
                background: var(--gray-50);
                min-height: 100vh;
                transition: margin-left 0.3s ease;
            }

            .airis-main-content.sidebar-collapsed {
                margin-left: 60px;
            }

            .airis-main-header {
                background: var(--white);
                border-bottom: 1px solid var(--gray-200);
                padding: 20px 32px;
                position: sticky;
                top: 0;
                z-index: 100;
            }

            .airis-header-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .airis-page-title {
                font-size: 24px;
                font-weight: 600;
                color: var(--gray-900);
            }

            .airis-header-actions {
                display: flex;
                align-items: center;
                gap: 16px;
            }

            .airis-status-badge {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: #ecfdf5;
                color: var(--success);
                border-radius: 20px;
                font-size: 14px;
                font-weight: 500;
            }

            .airis-status-dot {
                width: 8px;
                height: 8px;
                background: var(--success);
                border-radius: 50%;
                animation: pulse 2s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            .airis-content-wrapper {
                padding: 32px;
            }

            .airis-card {
                background: var(--white);
                border: 1px solid var(--gray-200);
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 24px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }

            .airis-btn {
                display: inline-flex;
                align-items: center;
                padding: 12px 20px;
                border: 1px solid transparent;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                text-decoration: none;
                cursor: pointer;
                transition: all 0.2s;
                background: none;
            }

            .airis-btn-primary {
                background: var(--primary);
                color: var(--white);
            }

            .airis-btn-primary:hover {
                background: var(--primary-dark);
            }

            .airis-btn-secondary {
                background: var(--gray-100);
                color: var(--gray-700);
                border-color: var(--gray-200);
            }

            .airis-btn-secondary:hover {
                background: var(--gray-200);
            }

            /* 반응형 */
            @media (max-width: 768px) {
                .airis-sidebar {
                    transform: translateX(-100%);
                    transition: transform 0.3s;
                }
                
                .airis-sidebar.mobile-open {
                    transform: translateX(0);
                }
                
                .airis-main-content {
                    margin-left: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    createSidebar() {
        // 기존 사이드바가 있으면 제거
        const existingSidebar = document.querySelector('.airis-sidebar');
        if (existingSidebar) {
            existingSidebar.remove();
        }

        const sidebar = document.createElement('nav');
        sidebar.className = 'airis-sidebar';
        sidebar.innerHTML = `
            <div class="airis-sidebar-header">
                <div class="airis-sidebar-logo">AIRIS-MON</div>
                <button class="airis-toggle-btn" id="airis-toggle-btn" title="사이드바 접기/펼치기">
                    <span id="toggle-icon">«</span>
                </button>
            </div>
            
            <div class="airis-sidebar-nav">
                <div class="airis-nav-section">
                    <div class="airis-nav-section-title">대시보드</div>
                    <div class="airis-nav-item">
                        <a href="/" class="airis-nav-link">
                            <span class="airis-nav-icon">■</span>
                            <span>메인 대시보드</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/integrated-dashboard.html" class="airis-nav-link">
                            <span class="airis-nav-icon">■</span>
                            <span>통합 대시보드</span>
                        </a>
                    </div>
                </div>

                <div class="airis-nav-section">
                    <div class="airis-nav-section-title">세션 리플레이</div>
                    <div class="airis-nav-item">
                        <a href="/integrated-session-recorder-fixed.html" class="airis-nav-link">
                            <span class="airis-nav-icon">■</span>
                            <span>통합 녹화기</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/enhanced-recorder.html" class="airis-nav-link">
                            <span class="airis-nav-icon">■</span>
                            <span>향상된 녹화기</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/enhanced-player.html" class="airis-nav-link">
                            <span class="airis-nav-icon">■</span>
                            <span>향상된 플레이어</span>
                        </a>
                    </div>
                </div>

                <div class="airis-nav-section">
                    <div class="airis-nav-section-title">프로젝트 분석</div>
                    <div class="airis-nav-item">
                        <a href="/project-analysis.html" class="airis-nav-link">
                            <span class="airis-nav-icon">■</span>
                            <span>프로젝트 분석기</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/application-analysis.html" class="airis-nav-link">
                            <span class="airis-nav-icon">■</span>
                            <span>CRUD 매트릭스</span>
                        </a>
                    </div>
                </div>

                <div class="airis-nav-section">
                    <div class="airis-nav-section-title">모니터링</div>
                    <div class="airis-nav-item">
                        <a href="/application-apm.html" class="airis-nav-link">
                            <span class="airis-nav-icon">📱</span>
                            <span>Application APM</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/infrastructure-monitoring.html" class="airis-nav-link">
                            <span class="airis-nav-icon">📡</span>
                            <span>인프라 모니터링</span>
                        </a>
                    </div>
                </div>

                <div class="airis-nav-section">
                    <div class="airis-nav-section-title">OpenTelemetry</div>
                    <div class="airis-nav-item">
                        <a href="/trace-detail-analyzer.html" class="airis-nav-link">
                            <span class="airis-nav-icon">📊</span>
                            <span>추적 상세 분석</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/opentelemetry-trace-viewer.html" class="airis-nav-link">
                            <span class="airis-nav-icon">👁️</span>
                            <span>추적 뷰어</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/trace-anomaly-dashboard.html" class="airis-nav-link">
                            <span class="airis-nav-icon">⚠️</span>
                            <span>이상 징후 대시보드</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/clickhouse-data-query.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🔍</span>
                            <span>ClickHouse 조회</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/opentelemetry-management.html" class="airis-nav-link">
                            <span class="airis-nav-icon">⚙️</span>
                            <span>OpenTelemetry 관리</span>
                        </a>
                    </div>
                </div>

                <div class="airis-nav-section">
                    <div class="airis-nav-section-title">분석 도구</div>
                    <div class="airis-nav-item">
                        <a href="/unified-analytics-dashboard.html" class="airis-nav-link">
                            <span class="airis-nav-icon">📊</span>
                            <span>통합 분석 대시보드</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/detailed-metrics-dashboard.html" class="airis-nav-link">
                            <span class="airis-nav-icon">📈</span>
                            <span>상세 메트릭 대시보드</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/trace-analysis-dashboard.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🔍</span>
                            <span>Trace 분석 대시보드</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/click-heatmap-analyzer.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🔥</span>
                            <span>클릭 히트맵</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/trace-sequence-diagram.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🔀</span>
                            <span>시퀀스 다이어그램</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/trace-api-endpoints.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🔗</span>
                            <span>API 엔드포인트</span>
                        </a>
                    </div>
                </div>

                <div class="airis-nav-section">
                    <div class="airis-nav-section-title">데이터베이스</div>
                    <div class="airis-nav-item">
                        <a href="/mongodb-data-query.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🍃</span>
                            <span>MongoDB 조회</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/clickhouse-data-query.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🔍</span>
                            <span>ClickHouse 조회</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/database-apm.html" class="airis-nav-link">
                            <span class="airis-nav-icon">📋</span>
                            <span>Database APM</span>
                        </a>
                    </div>
                </div>

                <div class="airis-nav-section">
                    <div class="airis-nav-section-title">AIOps/MLOps</div>
                    <div class="airis-nav-item">
                        <a href="/aiops-dashboard.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🤖</span>
                            <span>AIOps 대시보드</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/mlops-pipeline.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🧠</span>
                            <span>MLOps 파이프라인</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/ai-models.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🔮</span>
                            <span>AI 모델 관리</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/knowledge-base.html" class="airis-nav-link">
                            <span class="airis-nav-icon">📚</span>
                            <span>지식 베이스</span>
                        </a>
                    </div>
                </div>

                <div class="airis-nav-section">
                    <div class="airis-nav-section-title">관리</div>
                    <div class="airis-nav-item">
                        <a href="/system-installation.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🖥️</span>
                            <span>시스템 설치</span>
                            <span class="airis-nav-badge">NEW</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/alert-management.html" class="airis-nav-link">
                            <span class="airis-nav-icon">🚨</span>
                            <span>알림 관리</span>
                        </a>
                    </div>
                    <div class="airis-nav-item">
                        <a href="/admin-settings.html" class="airis-nav-link">
                            <span class="airis-nav-icon">⚙️</span>
                            <span>관리자 설정</span>
                        </a>
                    </div>
                </div>
            </div>
        `;

        document.body.insertBefore(sidebar, document.body.firstChild);
        this.setActiveNavItem();
    }

    createHeader() {
        // 기존 헤더가 있으면 제거
        const existingHeader = document.querySelector('.airis-main-header');
        if (existingHeader) {
            existingHeader.remove();
        }

        const header = document.createElement('header');
        header.className = 'airis-main-header';
        header.innerHTML = `
            <div class="airis-header-content">
                <h1 class="airis-page-title" id="airis-page-title">${this.getPageTitle()}</h1>
                <div class="airis-header-actions">
                    <div class="airis-status-badge">
                        <div class="airis-status-dot"></div>
                        시스템 정상
                    </div>
                    <div id="airis-current-time" style="color: var(--gray-600); font-size: 14px;"></div>
                </div>
            </div>
        `;

        const mainContent = document.querySelector('.airis-main-content') || this.createMainContentWrapper();
        mainContent.insertBefore(header, mainContent.firstChild);
    }

    createMainContentWrapper() {
        // body의 내용을 감싸는 메인 컨텐츠 래퍼 생성
        const existingContent = Array.from(document.body.children).filter(el => 
            !el.classList.contains('airis-sidebar') && 
            !el.classList.contains('airis-main-content')
        );

        const mainContent = document.createElement('main');
        mainContent.className = 'airis-main-content';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'airis-content-wrapper';

        existingContent.forEach(el => {
            contentWrapper.appendChild(el);
        });

        mainContent.appendChild(contentWrapper);
        document.body.appendChild(mainContent);

        return mainContent;
    }

    adjustMainContent() {
        // 기존 메인 컨텐츠를 래핑하거나 조정
        let mainContent = document.querySelector('.airis-main-content');
        
        if (!mainContent) {
            mainContent = this.createMainContentWrapper();
        }

        // 컨테이너 클래스 추가
        if (!document.body.classList.contains('airis-app-container')) {
            document.body.classList.add('airis-app-container');
        }
    }

    setActiveNavItem() {
        const currentPath = window.location.pathname;
        console.log('Setting active nav item for path:', currentPath);
        
        // 모든 가능한 네비게이션 링크 선택자
        const allNavLinks = document.querySelectorAll('.airis-nav-link, .nav-link, #sidebar .nav-link');
        
        // 먼저 모든 링크에서 active 클래스 제거
        allNavLinks.forEach(link => {
            link.classList.remove('active');
        });
        
        // 정확한 매칭을 위한 로직
        allNavLinks.forEach(link => {
            const href = link.getAttribute('href');
            let isMatch = false;
            
            if (href === currentPath) {
                isMatch = true;
            } else if (currentPath === '/' && href === '/index.html') {
                isMatch = true;
            } else if (currentPath === '/index.html' && href === '/') {
                isMatch = true;
            } else if (href && href !== '/' && href !== '/index.html' && currentPath.includes(href.replace('.html', ''))) {
                isMatch = true;
            }
            
            if (isMatch) {
                link.classList.add('active');
                console.log('Activated link:', href);
            }
        });
    }

    getPageTitle() {
        const path = window.location.pathname;
        const titles = {
            '/': 'AIRIS-MON 메인 대시보드',
            '/integrated-dashboard.html': '통합 대시보드',
            '/integrated-session-recorder-fixed.html': '통합 녹화기',
            '/enhanced-recorder.html': '향상된 녹화기',
            '/enhanced-player.html': '향상된 플레이어',
            '/project-analysis.html': '프로젝트 분석기',
            '/application-analysis.html': 'CRUD 매트릭스',
            '/unified-analytics-dashboard.html': '통합 분석 대시보드',
            '/detailed-metrics-dashboard.html': '상세 메트릭 대시보드',
            '/click-heatmap-analyzer.html': '클릭 히트맵',
            '/trace-sequence-diagram.html': '시퀀스 다이어그램',
            '/trace-detail-analyzer.html': '추적 상세 분석',
            '/opentelemetry-trace-viewer.html': '추적 뷰어',
            '/trace-anomaly-dashboard.html': '이상 징후 대시보드',
            '/trace-analysis-dashboard.html': 'Trace 분석 대시보드',
            '/clickhouse-data-query.html': 'ClickHouse 조회',
            '/mongodb-data-query.html': 'MongoDB 조회',
            '/opentelemetry-management.html': 'OpenTelemetry 관리',
            '/application-apm.html': 'Application APM',
            '/database-apm.html': 'Database APM',
            '/infrastructure-monitoring.html': '인프라 모니터링',
            '/aiops-dashboard.html': 'AIOps 대시보드',
            '/mlops-pipeline.html': 'MLOps 파이프라인',
            '/ai-models.html': 'AI 모델 관리',
            '/knowledge-base.html': '지식 베이스',
            '/alert-management.html': '알림 관리',
            '/admin-settings.html': '관리자 설정'
        };
        return titles[path] || 'AIRIS-MON';
    }

    setupEventListeners() {
        // 사이드바 토글 버튼 이벤트
        const toggleBtn = document.getElementById('airis-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // 저장된 사이드바 상태 복원
        const isCollapsed = localStorage.getItem('airis-sidebar-collapsed') === 'true';
        if (isCollapsed) {
            this.setSidebarCollapsed(true, false);
        }

        // MutationObserver로 DOM 변경 감지 및 활성화 상태 재설정
        const observer = new MutationObserver(() => {
            this.setActiveNavItem();
        });
        
        // 사이드바가 로드되면 감시 시작
        setTimeout(() => {
            const sidebar = document.querySelector('#sidebar');
            if (sidebar) {
                observer.observe(sidebar, { childList: true, subtree: true });
            }
        }, 100);

        // 모바일 메뉴 토글 (필요시)
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                const sidebar = document.querySelector('.airis-sidebar');
                if (sidebar) {
                    sidebar.classList.remove('mobile-open');
                }
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.airis-sidebar');
        const isCollapsed = sidebar.classList.contains('collapsed');
        this.setSidebarCollapsed(!isCollapsed, true);
    }

    setSidebarCollapsed(collapsed, saveState = true) {
        const sidebar = document.querySelector('.airis-sidebar');
        const mainContent = document.querySelector('.airis-main-content');
        const toggleIcon = document.getElementById('toggle-icon');

        if (collapsed) {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('sidebar-collapsed');
            if (toggleIcon) {
                toggleIcon.textContent = '»';
                toggleIcon.parentElement.title = '사이드바 펼치기';
            }
        } else {
            sidebar.classList.remove('collapsed');
            mainContent.classList.remove('sidebar-collapsed');
            if (toggleIcon) {
                toggleIcon.textContent = '«';
                toggleIcon.parentElement.title = '사이드바 접기';
            }
        }

        if (saveState) {
            localStorage.setItem('airis-sidebar-collapsed', collapsed.toString());
        }
    }

    updateTime() {
        const updateCurrentTime = () => {
            const now = new Date();
            const timeString = now.toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            const timeElement = document.getElementById('airis-current-time');
            if (timeElement) {
                timeElement.textContent = timeString;
            }
        };

        updateCurrentTime();
        setInterval(updateCurrentTime, 1000);
    }

    // 페이지별 컨텐츠 래핑 유틸리티
    static wrapPageContent(content, title = '') {
        return `
            <div class="airis-content-wrapper">
                ${title ? `<div style="margin-bottom: 2rem;">
                    <h2 style="font-size: 1.875rem; font-weight: 700; color: var(--gray-900); margin-bottom: 0.5rem;">${title}</h2>
                </div>` : ''}
                ${content}
            </div>
        `;
    }
}

// 페이지 로드 시 자동 초기화
document.addEventListener('DOMContentLoaded', function() {
    // Google Fonts 로드
    if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }

    // 공통 레이아웃 초기화
    window.airisLayout = new AirisCommonLayout();
    
    // 네비게이션 상태 강제 업데이트 (여러 번 실행)
    setTimeout(() => {
        if (window.airisLayout) {
            window.airisLayout.setActiveNavItem();
        }
    }, 200);
    
    setTimeout(() => {
        if (window.airisLayout) {
            window.airisLayout.setActiveNavItem();
        }
    }, 1000);
});

// 윈도우 로드 완료 후에도 실행
window.addEventListener('load', function() {
    if (window.airisLayout) {
        window.airisLayout.setActiveNavItem();
    }
});

// 전역 유틸리티 함수
window.AirisCommonLayout = AirisCommonLayout;