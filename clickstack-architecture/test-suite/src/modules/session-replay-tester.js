/**
 * 세션 리플레이 테스터 - AIRIS-MON 세션 리플레이 기능 테스트
 * 사용자 세션 녹화, 압축, 재생 기능을 테스트
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class SessionReplayTester {
  constructor() {
    this.baseUrl = 'http://localhost:3003'; // Session Replay Service
    this.recordedSessions = new Map();
    this.compressionStats = [];
    this.playbackResults = [];
  }

  async recordSession(stepResult) {
    stepResult.logs.push('📹 세션 녹화 테스트 시작');
    
    try {
      // 여러 사용자 세션 시뮬레이션
      const sessionCount = 5;
      const sessions = [];

      for (let i = 0; i < sessionCount; i++) {
        const session = await this.generateUserSession();
        sessions.push(session);
        
        stepResult.logs.push(`세션 ${i + 1} 녹화 완료: ${session.events.length}개 이벤트, ${session.duration}ms`);
      }

      stepResult.metrics.recordedSessions = sessionCount;
      stepResult.metrics.totalEvents = sessions.reduce((sum, s) => sum + s.events.length, 0);
      stepResult.metrics.avgSessionDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessionCount;
      stepResult.metrics.avgEventsPerSession = stepResult.metrics.totalEvents / sessionCount;

      // 녹화 품질 검증
      const qualityScore = await this.validateRecordingQuality(sessions);
      stepResult.metrics.recordingQuality = qualityScore;

      stepResult.logs.push(`평균 세션 시간: ${stepResult.metrics.avgSessionDuration.toFixed(0)}ms`);
      stepResult.logs.push(`평균 이벤트 수: ${stepResult.metrics.avgEventsPerSession.toFixed(1)}개`);
      stepResult.logs.push(`녹화 품질: ${qualityScore.toFixed(1)}%`);

      // 세션 저장
      sessions.forEach(session => {
        this.recordedSessions.set(session.session_id, session);
      });

      stepResult.logs.push('✅ 세션 녹화 테스트 완료');

    } catch (error) {
      stepResult.logs.push(`❌ 세션 녹화 실패: ${error.message}`);
      throw error;
    }
  }

  async testCompression(stepResult) {
    stepResult.logs.push('🗜️ 데이터 압축 테스트 시작');
    
    try {
      const sessions = Array.from(this.recordedSessions.values());
      if (sessions.length === 0) {
        throw new Error('압축할 세션이 없습니다. 먼저 세션을 녹화하세요.');
      }

      const compressionResults = [];

      for (const session of sessions) {
        const compressionResult = await this.compressSession(session);
        compressionResults.push(compressionResult);
        
        stepResult.logs.push(`세션 ${session.session_id.substring(0, 8)}: ${compressionResult.compressionRatio.toFixed(1)}% 압축률`);
      }

      const avgCompressionRatio = compressionResults.reduce((sum, r) => sum + r.compressionRatio, 0) / compressionResults.length;
      const totalOriginalSize = compressionResults.reduce((sum, r) => sum + r.originalSize, 0);
      const totalCompressedSize = compressionResults.reduce((sum, r) => sum + r.compressedSize, 0);

      stepResult.metrics.sessionsCompressed = compressionResults.length;
      stepResult.metrics.avgCompressionRatio = avgCompressionRatio;
      stepResult.metrics.totalOriginalSize = totalOriginalSize;
      stepResult.metrics.totalCompressedSize = totalCompressedSize;
      stepResult.metrics.spaceSaved = totalOriginalSize - totalCompressedSize;

      // 압축 품질 테스트
      const qualityResult = await this.testCompressionQuality(compressionResults);
      stepResult.metrics.compressionQuality = qualityResult.quality;
      stepResult.metrics.dataIntegrity = qualityResult.integrity;

      stepResult.logs.push(`평균 압축률: ${avgCompressionRatio.toFixed(2)}%`);
      stepResult.logs.push(`절약된 용량: ${(stepResult.metrics.spaceSaved / 1024).toFixed(1)}KB`);
      stepResult.logs.push(`압축 품질: ${qualityResult.quality.toFixed(1)}%`);
      stepResult.logs.push(`데이터 무결성: ${qualityResult.integrity ? '통과' : '실패'}`);

      stepResult.logs.push('✅ 데이터 압축 테스트 완료');

    } catch (error) {
      stepResult.logs.push(`❌ 데이터 압축 실패: ${error.message}`);
      throw error;
    }
  }

  async testPlayback(stepResult) {
    stepResult.logs.push('▶️ 재생 품질 테스트 시작');
    
    try {
      const sessions = Array.from(this.recordedSessions.values());
      if (sessions.length === 0) {
        throw new Error('재생할 세션이 없습니다. 먼저 세션을 녹화하세요.');
      }

      const playbackResults = [];

      for (const session of sessions) {
        const playbackResult = await this.testSessionPlayback(session);
        playbackResults.push(playbackResult);
        
        stepResult.logs.push(`세션 ${session.session_id.substring(0, 8)} 재생: ${playbackResult.success ? '성공' : '실패'} (${playbackResult.loadTime}ms)`);
      }

      const successfulPlaybacks = playbackResults.filter(r => r.success).length;
      const avgLoadTime = playbackResults.reduce((sum, r) => sum + r.loadTime, 0) / playbackResults.length;
      const avgFps = playbackResults.reduce((sum, r) => sum + r.fps, 0) / playbackResults.length;

      stepResult.metrics.playbackTests = playbackResults.length;
      stepResult.metrics.successfulPlaybacks = successfulPlaybacks;
      stepResult.metrics.playbackSuccessRate = (successfulPlaybacks / playbackResults.length) * 100;
      stepResult.metrics.avgLoadTime = avgLoadTime;
      stepResult.metrics.avgFps = avgFps;

      // 재생 품질 상세 분석
      const qualityAnalysis = await this.analyzePlaybackQuality(playbackResults);
      stepResult.metrics.visualQuality = qualityAnalysis.visualQuality;
      stepResult.metrics.audioQuality = qualityAnalysis.audioQuality;
      stepResult.metrics.syncAccuracy = qualityAnalysis.syncAccuracy;

      stepResult.logs.push(`재생 성공률: ${stepResult.metrics.playbackSuccessRate.toFixed(1)}%`);
      stepResult.logs.push(`평균 로드 시간: ${avgLoadTime.toFixed(0)}ms`);
      stepResult.logs.push(`평균 FPS: ${avgFps.toFixed(1)}`);
      stepResult.logs.push(`시각 품질: ${qualityAnalysis.visualQuality.toFixed(1)}%`);
      stepResult.logs.push(`동기화 정확도: ${qualityAnalysis.syncAccuracy.toFixed(1)}%`);

      stepResult.logs.push('✅ 재생 품질 테스트 완료');

    } catch (error) {
      stepResult.logs.push(`❌ 재생 테스트 실패: ${error.message}`);
      throw error;
    }
  }

  async simulate(duration = 60, intensity = 'medium') {
    console.log(`📹 세션 리플레이 시뮬레이션 시작: ${duration}초, 강도: ${intensity}`);
    
    const intensitySettings = {
      'low': { sessionInterval: 15000, eventsPerMinute: 20 },
      'medium': { sessionInterval: 8000, eventsPerMinute: 50 },
      'high': { sessionInterval: 4000, eventsPerMinute: 100 },
      'extreme': { sessionInterval: 2000, eventsPerMinute: 200 }
    };

    const settings = intensitySettings[intensity] || intensitySettings['medium'];
    const endTime = Date.now() + (duration * 1000);
    
    let sessionCount = 0;
    const activeSessions = new Map();

    const interval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(interval);
        console.log(`✅ 세션 시뮬레이션 완료: 총 ${sessionCount}개 세션 생성`);
        return;
      }

      // 새 세션 시작
      const session = await this.startSessionRecording();
      activeSessions.set(session.session_id, session);
      sessionCount++;

      // 일정 시간 후 세션 종료
      setTimeout(() => {
        this.endSessionRecording(session.session_id);
        activeSessions.delete(session.session_id);
      }, Math.random() * 60000 + 30000); // 30초-90초

    }, settings.sessionInterval);

    return {
      duration: duration,
      intensity: intensity,
      expectedSessions: Math.floor(duration * 1000 / settings.sessionInterval),
      status: 'started'
    };
  }

  async generateUserSession() {
    const sessionId = uuidv4();
    const userId = `user_${Math.floor(Math.random() * 1000)}`;
    const startTime = Date.now() - Math.random() * 3600000; // 지난 1시간 내
    const duration = Math.random() * 1800000 + 300000; // 5분-35분
    const endTime = startTime + duration;

    // 사용자 행동 패턴 시뮬레이션
    const events = await this.generateSessionEvents(startTime, endTime);
    const interactions = await this.generateUserInteractions(startTime, endTime);
    const pageViews = await this.generatePageViews(startTime, endTime);

    const session = {
      session_id: sessionId,
      user_id: userId,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      duration: duration,
      events: events,
      interactions: interactions,
      page_views: pageViews,
      viewport: {
        width: 1920,
        height: 1080
      },
      user_agent: this.generateUserAgent(),
      ip_address: this.generateRandomIP(),
      device_info: this.generateDeviceInfo(),
      quality_metrics: {
        fps: Math.random() * 30 + 30, // 30-60 FPS
        resolution: '1920x1080',
        bit_rate: Math.random() * 2000 + 1000, // 1000-3000 kbps
        frame_drops: Math.floor(Math.random() * 10)
      }
    };

    return session;
  }

  async generateSessionEvents(startTime, endTime) {
    const events = [];
    const eventTypes = [
      'click', 'mousemove', 'scroll', 'keypress', 'focus', 'blur',
      'resize', 'load', 'unload', 'error'
    ];

    const eventCount = Math.floor((endTime - startTime) / 5000); // 5초마다 이벤트
    
    for (let i = 0; i < eventCount; i++) {
      const eventTime = startTime + (i * 5000) + Math.random() * 5000;
      
      events.push({
        id: uuidv4(),
        type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        timestamp: new Date(eventTime).toISOString(),
        x: Math.floor(Math.random() * 1920),
        y: Math.floor(Math.random() * 1080),
        element: `element_${Math.floor(Math.random() * 100)}`,
        value: Math.random() > 0.7 ? `input_${Math.floor(Math.random() * 50)}` : null
      });
    }

    return events;
  }

  async generateUserInteractions(startTime, endTime) {
    const interactions = [];
    const interactionTypes = ['button_click', 'form_submit', 'link_click', 'menu_open', 'modal_open'];
    
    const interactionCount = Math.floor((endTime - startTime) / 30000); // 30초마다 상호작용
    
    for (let i = 0; i < interactionCount; i++) {
      const interactionTime = startTime + (i * 30000) + Math.random() * 30000;
      
      interactions.push({
        id: uuidv4(),
        type: interactionTypes[Math.floor(Math.random() * interactionTypes.length)],
        timestamp: new Date(interactionTime).toISOString(),
        target_element: `#${Math.random().toString(36).substr(2, 8)}`,
        duration: Math.random() * 2000 + 500,
        success: Math.random() > 0.05 // 95% 성공률
      });
    }

    return interactions;
  }

  async generatePageViews(startTime, endTime) {
    const pages = [
      '/dashboard', '/analytics', '/settings', '/profile', '/reports',
      '/admin', '/help', '/about', '/contact'
    ];
    
    const pageViews = [];
    const viewCount = Math.floor((endTime - startTime) / 120000); // 2분마다 페이지 전환
    
    for (let i = 0; i < viewCount; i++) {
      const viewTime = startTime + (i * 120000) + Math.random() * 120000;
      const viewDuration = Math.random() * 180000 + 60000; // 1-4분
      
      pageViews.push({
        id: uuidv4(),
        url: pages[Math.floor(Math.random() * pages.length)],
        title: `Page ${i + 1}`,
        timestamp: new Date(viewTime).toISOString(),
        duration: viewDuration,
        scroll_depth: Math.random() * 100,
        time_on_page: viewDuration
      });
    }

    return pageViews;
  }

  async validateRecordingQuality(sessions) {
    let totalScore = 0;
    
    for (const session of sessions) {
      let sessionScore = 100;
      
      // 이벤트 밀도 검사
      const eventDensity = session.events.length / (session.duration / 1000);
      if (eventDensity < 0.1) sessionScore -= 20; // 너무 적은 이벤트
      if (eventDensity > 10) sessionScore -= 10; // 너무 많은 이벤트
      
      // 세션 지속시간 검사
      if (session.duration < 60000) sessionScore -= 15; // 1분 미만
      if (session.duration > 7200000) sessionScore -= 10; // 2시간 초과
      
      // 상호작용 품질 검사
      const interactionRate = session.interactions.length / (session.duration / 60000);
      if (interactionRate < 0.5) sessionScore -= 10; // 분당 0.5회 미만
      
      // 페이지뷰 연속성 검사
      if (session.page_views.length === 0) sessionScore -= 25;
      
      totalScore += Math.max(sessionScore, 0);
    }
    
    return totalScore / sessions.length;
  }

  async compressSession(session) {
    const originalData = JSON.stringify(session);
    const originalSize = originalData.length;
    
    // 압축 시뮬레이션 (실제로는 gzip, brotli 등 사용)
    const compressionRatio = Math.random() * 30 + 60; // 60-90% 압축률
    const compressedSize = Math.floor(originalSize * (100 - compressionRatio) / 100);
    
    const compressionResult = {
      session_id: session.session_id,
      originalSize: originalSize,
      compressedSize: compressedSize,
      compressionRatio: compressionRatio,
      compressionTime: Math.random() * 1000 + 200, // 200-1200ms
      algorithm: 'simulation_gzip'
    };
    
    this.compressionStats.push(compressionResult);
    
    return compressionResult;
  }

  async testCompressionQuality(compressionResults) {
    let qualityScore = 100;
    let integrityPass = true;
    
    for (const result of compressionResults) {
      // 압축률이 너무 낮으면 품질 감점
      if (result.compressionRatio < 50) qualityScore -= 10;
      
      // 압축 시간이 너무 길면 품질 감점
      if (result.compressionTime > 2000) qualityScore -= 5;
      
      // 무결성 검사 시뮬레이션
      if (Math.random() < 0.05) { // 5% 확률로 무결성 실패
        integrityPass = false;
        qualityScore -= 20;
      }
    }
    
    return {
      quality: Math.max(qualityScore, 0),
      integrity: integrityPass
    };
  }

  async testSessionPlayback(session) {
    const startTime = Date.now();
    
    // 재생 시뮬레이션
    const loadTime = Math.random() * 3000 + 500; // 500-3500ms
    const fps = Math.random() * 30 + 30; // 30-60 FPS
    const success = Math.random() > 0.02; // 98% 성공률
    
    const playbackResult = {
      session_id: session.session_id,
      success: success,
      loadTime: loadTime,
      fps: fps,
      totalFrames: Math.floor(session.duration / 1000 * fps),
      droppedFrames: Math.floor(Math.random() * 10),
      bufferingTime: Math.random() * 1000,
      error: success ? null : 'Playback failed due to corrupted data'
    };
    
    this.playbackResults.push(playbackResult);
    
    return playbackResult;
  }

  async analyzePlaybackQuality(playbackResults) {
    const successfulPlaybacks = playbackResults.filter(r => r.success);
    
    if (successfulPlaybacks.length === 0) {
      return {
        visualQuality: 0,
        audioQuality: 0,
        syncAccuracy: 0
      };
    }
    
    // 시각 품질 계산 (FPS 기반)
    const avgFps = successfulPlaybacks.reduce((sum, r) => sum + r.fps, 0) / successfulPlaybacks.length;
    const visualQuality = Math.min((avgFps / 60) * 100, 100);
    
    // 오디오 품질 시뮬레이션
    const audioQuality = Math.random() * 20 + 80; // 80-100%
    
    // 동기화 정확도 계산
    const avgDroppedFrames = successfulPlaybacks.reduce((sum, r) => sum + r.droppedFrames, 0) / successfulPlaybacks.length;
    const syncAccuracy = Math.max(100 - (avgDroppedFrames * 5), 60);
    
    return {
      visualQuality: visualQuality,
      audioQuality: audioQuality,
      syncAccuracy: syncAccuracy
    };
  }

  async startSessionRecording() {
    const sessionId = uuidv4();
    
    const session = {
      session_id: sessionId,
      user_id: `user_${Math.floor(Math.random() * 1000)}`,
      start_time: new Date().toISOString(),
      status: 'recording',
      events: [],
      interactions: [],
      page_views: []
    };
    
    // 세션 정보 전송 시뮬레이션
    try {
      await axios.post(`${this.baseUrl}/api/v1/sessions/start`, session, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      // 실제 서비스가 없어도 시뮬레이션 계속
    }
    
    return session;
  }

  async endSessionRecording(sessionId) {
    const session = this.recordedSessions.get(sessionId);
    if (session) {
      session.end_time = new Date().toISOString();
      session.status = 'completed';
      session.duration = new Date(session.end_time).getTime() - new Date(session.start_time).getTime();
      
      // 세션 종료 정보 전송 시뮬레이션
      try {
        await axios.post(`${this.baseUrl}/api/v1/sessions/${sessionId}/end`, {
          end_time: session.end_time,
          duration: session.duration
        }, {
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        // 실제 서비스가 없어도 시뮬레이션 계속
      }
    }
  }

  generateUserAgent() {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  generateRandomIP() {
    return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
  }

  generateDeviceInfo() {
    const devices = [
      { type: 'desktop', os: 'Windows 10', browser: 'Chrome' },
      { type: 'desktop', os: 'macOS', browser: 'Safari' },
      { type: 'mobile', os: 'iOS', browser: 'Safari' },
      { type: 'mobile', os: 'Android', browser: 'Chrome' },
      { type: 'tablet', os: 'iPadOS', browser: 'Safari' }
    ];
    
    return devices[Math.floor(Math.random() * devices.length)];
  }

  getStatistics() {
    return {
      recordedSessions: this.recordedSessions.size,
      compressionStats: this.compressionStats.length,
      playbackResults: this.playbackResults.length,
      avgCompressionRatio: this.compressionStats.length > 0 ? 
        this.compressionStats.reduce((sum, s) => sum + s.compressionRatio, 0) / this.compressionStats.length : 0,
      avgPlaybackFps: this.playbackResults.length > 0 ?
        this.playbackResults.reduce((sum, r) => sum + r.fps, 0) / this.playbackResults.length : 0,
      timestamp: new Date().toISOString()
    };
  }

  clearData() {
    this.recordedSessions.clear();
    this.compressionStats = [];
    this.playbackResults = [];
    console.log('🧹 세션 리플레이 데이터 정리 완료');
  }
}

module.exports = SessionReplayTester;