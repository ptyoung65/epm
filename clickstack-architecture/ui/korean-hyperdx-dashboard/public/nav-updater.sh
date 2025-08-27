#!/bin/bash

# AIRIS EPM 네비게이션 자동 업데이트 스크립트
# 각 페이지의 구식 onclick 네비게이션을 드롭다운 방식으로 대체

declare -A page_configs=(
    ["exception-dashboard.html"]="예외 추적:🚨"
    ["topology-dashboard.html"]="서비스 토폴로지:🗺️"
    ["alert-dashboard.html"]="알림 관리:🔔"
    ["app-monitoring.html"]="애플리케이션 모니터링:📱"
    ["system-monitoring.html"]="시스템 모니터링:⚙️"
    ["db-monitoring.html"]="데이터베이스 모니터링:🗃️"
    ["web-monitoring.html"]="웹 성능 모니터링:🌐"
    ["logs-dashboard.html"]="로그 대시보드:📋"
    ["metrics-dashboard.html"]="메트릭 대시보드:📊"
    ["traces-dashboard.html"]="트레이스 대시보드:🔗"
    ["session-analysis.html"]="세션 분석:📈"
    ["session-telemetry-dashboard.html"]="세션 텔레메트리:🛰️"
    ["session-replay.html"]="세션 리플레이:🎬"
    ["ontology.html"]="온톨로지 시스템:🧠"
    ["deployment-manager.html"]="배포 관리:🚀"
)

# 표준 드롭다운 네비게이션 생성 함수
generate_nav() {
    local page_title="$1"
    local page_icon="$2"
    local active_group="$3"
    local active_item="$4"
    
    cat << 'EOF'
    <header class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
      <div class="container mx-auto flex h-14 items-center px-4">
        <div class="mr-4 flex items-center space-x-2">
          <h1 class="font-bold text-xl text-foreground">AIRIS EPM</h1>
          <span class="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-medium">PAGE_TITLE</span>
        </div>
        
        <!-- Navigation Menu with Dropdown -->
        <nav class="flex items-center space-x-6 text-sm ml-6">
          <!-- 메인 대시보드 -->
          <a href="/" class="text-foreground/60 hover:text-foreground/80 px-3 py-2 text-sm font-medium transition-colors">📊 메인</a>
          
          <!-- APM 모니터링 드롭다운 -->
          <div class="relative group">
            <button class="APM_BUTTON_CLASS transition-colors border-none cursor-pointer flex items-center px-3 py-2 text-sm font-medium rounded-md">
              ⚡ APM 모니터링 ▾
            </button>
            <div class="absolute top-full left-0 mt-1 w-48 bg-background border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <a href="/j2ee-dashboard.html" class="APM_J2EE_CLASS">☕ J2EE 모니터링</a>
              <a href="/was-dashboard.html" class="APM_WAS_CLASS">🏗️ WAS 모니터링</a>
              <a href="/exception-dashboard.html" class="APM_EXCEPTION_CLASS">🚨 예외 추적</a>
              <a href="/topology-dashboard.html" class="APM_TOPOLOGY_CLASS">🗺️ 서비스 토폴로지</a>
              <a href="/alert-dashboard.html" class="APM_ALERT_CLASS">🔔 알림 관리</a>
            </div>
          </div>

          <!-- 인프라 모니터링 드롭다운 -->
          <div class="relative group">
            <button class="INFRA_BUTTON_CLASS transition-colors border-none cursor-pointer flex items-center px-3 py-2 text-sm font-medium">
              🖥️ 인프라 모니터링 ▾
            </button>
            <div class="absolute top-full left-0 mt-1 w-48 bg-background border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <a href="/app-monitoring.html" class="INFRA_APP_CLASS">📱 애플리케이션 모니터링</a>
              <a href="/system-monitoring.html" class="INFRA_SYSTEM_CLASS">⚙️ 시스템 모니터링</a>
              <a href="/db-monitoring.html" class="INFRA_DB_CLASS">🗃️ 데이터베이스 모니터링</a>
              <a href="/web-monitoring.html" class="INFRA_WEB_CLASS">🌐 웹 성능 모니터링</a>
            </div>
          </div>

          <!-- 관찰성 드롭다운 -->
          <div class="relative group">
            <button class="OBS_BUTTON_CLASS transition-colors border-none cursor-pointer flex items-center px-3 py-2 text-sm font-medium">
              🔍 관찰성 ▾
            </button>
            <div class="absolute top-full left-0 mt-1 w-48 bg-background border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <a href="/logs-dashboard.html" class="OBS_LOGS_CLASS">📋 로그 대시보드</a>
              <a href="/metrics-dashboard.html" class="OBS_METRICS_CLASS">📊 메트릭 대시보드</a>
              <a href="/traces-dashboard.html" class="OBS_TRACES_CLASS">🔗 트레이스 대시보드</a>
            </div>
          </div>

          <!-- 세션 분석 드롭다운 -->
          <div class="relative group">
            <button class="SESSION_BUTTON_CLASS transition-colors border-none cursor-pointer flex items-center px-3 py-2 text-sm font-medium">
              👥 세션 분석 ▾
            </button>
            <div class="absolute top-full left-0 mt-1 w-48 bg-background border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <a href="/session-analysis.html" class="SESSION_ANALYSIS_CLASS">📈 세션 분석</a>
              <a href="/session-telemetry-dashboard.html" class="SESSION_TELEMETRY_CLASS">🛰️ 세션 텔레메트리</a>
              <a href="/session-replay.html" class="SESSION_REPLAY_CLASS">🎬 세션 리플레이</a>
            </div>
          </div>

          <!-- 시스템 관리 드롭다운 -->
          <div class="relative group">
            <button class="MGMT_BUTTON_CLASS transition-colors border-none cursor-pointer flex items-center px-3 py-2 text-sm font-medium">
              🛠️ 시스템 관리 ▾
            </button>
            <div class="absolute top-full left-0 mt-1 w-48 bg-background border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <a href="/services-management.html" class="MGMT_SERVICES_CLASS">⚙️ 서비스 관리</a>
              <a href="/deployment-manager.html" class="MGMT_DEPLOY_CLASS">🚀 배포 관리</a>
              <a href="/ontology.html" class="MGMT_ONTOLOGY_CLASS">🧠 온톨로지 시스템</a>
            </div>
          </div>

          <!-- 포털 링크 -->
          <a href="/portal.html" class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 px-3 py-2 text-sm font-medium">🏠 포털</a>
        </nav>
        
        <div class="flex items-center space-x-4 ml-auto">
          <button id="themeToggle" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9">
            🌙
          </button>
        </div>
      </div>
    </header>
EOF
}

echo "✅ 네비게이션 자동 업데이트 스크립트 준비 완료"
echo "📝 15개 대시보드 페이지 설정:"
for page in "${!page_configs[@]}"; do
    IFS=':' read -r title icon <<< "${page_configs[$page]}"
    echo "   - $page: $title $icon"
done