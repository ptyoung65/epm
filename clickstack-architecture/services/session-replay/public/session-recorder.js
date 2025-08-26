/**
 * AIRIS Session Recorder - rrweb 기반 사용자 세션 기록
 * 사용자 세션을 자동으로 기록하고 서버로 전송합니다
 */

class AIRISSessionRecorder {
  constructor(options = {}) {
    this.options = {
      apiEndpoint: options.apiEndpoint || '/api/v1/sessions',
      autoStart: options.autoStart !== false,
      userId: options.userId || this.generateUserId(),
      maxDuration: options.maxDuration || 30 * 60 * 1000, // 30분
      batchSize: options.batchSize || 50,
      batchTimeout: options.batchTimeout || 10000, // 10초
      maskAllInputs: options.maskAllInputs !== false,
      collectFonts: options.collectFonts !== false,
      inlineStylesheet: options.inlineStylesheet !== false,
      ...options
    };

    this.sessionId = null;
    this.recorder = null;
    this.events = [];
    this.isRecording = false;
    this.startTime = null;
    this.batchTimer = null;
    this.heartbeatTimer = null;

    // rrweb 로드 확인
    if (typeof rrweb === 'undefined') {
      console.error('AIRIS Session Recorder: rrweb 라이브러리가 로드되지 않았습니다');
      return;
    }

    // 자동 시작
    if (this.options.autoStart) {
      this.start();
    }

    // 페이지 언로드 시 세션 종료
    window.addEventListener('beforeunload', () => {
      this.stop();
    });

    // 페이지 숨김/표시 처리
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.sendBatch(); // 페이지가 숨겨질 때 배치 전송
      }
    });
  }

  /**
   * 사용자 ID 생성
   */
  generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  /**
   * 세션 기록 시작
   */
  async start() {
    if (this.isRecording) {
      console.warn('AIRIS Session Recorder: 이미 기록이 진행 중입니다');
      return;
    }

    try {
      console.log('AIRIS Session Recorder: 세션 기록을 시작합니다...');

      // 세션 정보
      const sessionInfo = {
        userId: this.options.userId,
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        device: this.getDeviceType(),
        browser: this.getBrowserInfo(),
        tags: this.options.tags || [],
        timestamp: new Date().toISOString()
      };

      // 서버에 세션 시작 요청
      const response = await fetch(`${this.options.apiEndpoint}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionInfo)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '세션 시작 실패');
      }

      this.sessionId = result.sessionId;
      this.startTime = Date.now();
      this.isRecording = true;

      // rrweb 기록 시작
      this.recorder = rrweb.record({
        emit: (event) => this.handleEvent(event),
        maskAllInputs: this.options.maskAllInputs,
        collectFonts: this.options.collectFonts,
        inlineStylesheet: this.options.inlineStylesheet,
        // 추가 옵션들
        slimDOMOptions: {
          comment: true,
          script: true,
          headFavicon: true,
          headWhitespace: true,
          headMetaSocial: true,
          headMetaRobots: true,
          headMetaHttpEquiv: true,
          headMetaVerification: true,
          headMetaAuthorship: true,
          headMetaDescKeywords: true
        },
        dataURLOptions: {
          type: 'image/webp',
          quality: 0.6
        }
      });

      // 배치 전송 타이머 시작
      this.startBatchTimer();

      // 하트비트 시작
      this.startHeartbeat();

      // 최대 기록 시간 설정
      setTimeout(() => {
        if (this.isRecording) {
          this.stop();
          console.log('AIRIS Session Recorder: 최대 기록 시간에 도달하여 자동 종료됩니다');
        }
      }, this.options.maxDuration);

      console.log(`AIRIS Session Recorder: 세션 기록이 시작되었습니다 (ID: ${this.sessionId})`);

      // 커스텀 이벤트 발생
      this.dispatchCustomEvent('sessionStarted', { sessionId: this.sessionId });

    } catch (error) {
      console.error('AIRIS Session Recorder: 세션 시작 실패:', error);
      this.isRecording = false;
    }
  }

  /**
   * 세션 기록 종료
   */
  async stop() {
    if (!this.isRecording || !this.sessionId) {
      return;
    }

    try {
      console.log('AIRIS Session Recorder: 세션 기록을 종료합니다...');

      // 기록 중지
      if (this.recorder) {
        this.recorder();
        this.recorder = null;
      }

      // 타이머 정리
      this.clearTimers();

      // 남은 이벤트 전송
      if (this.events.length > 0) {
        await this.sendBatch();
      }

      // 서버에 세션 종료 요청
      const response = await fetch(`${this.options.apiEndpoint}/${this.sessionId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        console.log('AIRIS Session Recorder: 세션 기록이 성공적으로 종료되었습니다');
        
        // 커스텀 이벤트 발생
        this.dispatchCustomEvent('sessionStopped', { 
          sessionId: this.sessionId,
          duration: Date.now() - this.startTime 
        });
      } else {
        console.warn('AIRIS Session Recorder: 세션 종료 요청 실패:', result.error);
      }

    } catch (error) {
      console.error('AIRIS Session Recorder: 세션 종료 실패:', error);
    } finally {
      this.reset();
    }
  }

  /**
   * 이벤트 처리
   */
  handleEvent(event) {
    if (!this.isRecording) return;

    // 이벤트에 타임스탬프와 세션 정보 추가
    event.sessionId = this.sessionId;
    event.relativeTime = Date.now() - this.startTime;

    this.events.push(event);

    // 배치 크기 도달 시 즉시 전송
    if (this.events.length >= this.options.batchSize) {
      this.sendBatch();
    }
  }

  /**
   * 이벤트 배치 전송
   */
  async sendBatch() {
    if (this.events.length === 0 || !this.sessionId) {
      return;
    }

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      const response = await fetch(`${this.options.apiEndpoint}/${this.sessionId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events: eventsToSend })
      });

      const result = await response.json();

      if (!result.success) {
        console.warn('AIRIS Session Recorder: 이벤트 전송 실패:', result.error);
        // 실패한 이벤트를 다시 큐에 추가 (최대 3회까지)
        eventsToSend.forEach(event => {
          event.retryCount = (event.retryCount || 0) + 1;
          if (event.retryCount <= 3) {
            this.events.unshift(event);
          }
        });
      } else {
        console.debug(`AIRIS Session Recorder: ${eventsToSend.length}개 이벤트 전송 완료`);
      }

    } catch (error) {
      console.error('AIRIS Session Recorder: 이벤트 전송 오류:', error);
      // 네트워크 오류 시 이벤트를 다시 큐에 추가
      eventsToSend.forEach(event => {
        event.retryCount = (event.retryCount || 0) + 1;
        if (event.retryCount <= 3) {
          this.events.unshift(event);
        }
      });
    }
  }

  /**
   * 배치 전송 타이머 시작
   */
  startBatchTimer() {
    this.clearBatchTimer();
    this.batchTimer = setInterval(() => {
      this.sendBatch();
    }, this.options.batchTimeout);
  }

  /**
   * 하트비트 시작
   */
  startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isRecording && this.sessionId) {
        // 하트비트 이벤트 추가
        this.handleEvent({
          type: 99, // 커스텀 타입
          data: {
            tag: 'heartbeat',
            timestamp: Date.now(),
            url: window.location.href
          },
          timestamp: Date.now()
        });
      }
    }, 60000); // 1분마다
  }

  /**
   * 타이머 정리
   */
  clearTimers() {
    this.clearBatchTimer();
    this.clearHeartbeat();
  }

  clearBatchTimer() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 상태 초기화
   */
  reset() {
    this.sessionId = null;
    this.recorder = null;
    this.events = [];
    this.isRecording = false;
    this.startTime = null;
    this.clearTimers();
  }

  /**
   * 디바이스 타입 감지
   */
  getDeviceType() {
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  /**
   * 브라우저 정보 감지
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    
    if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (ua.indexOf('Safari') > -1) browser = 'Safari';
    else if (ua.indexOf('Edge') > -1) browser = 'Edge';
    else if (ua.indexOf('Opera') > -1) browser = 'Opera';

    return browser;
  }

  /**
   * 커스텀 이벤트 발생
   */
  dispatchCustomEvent(eventName, detail) {
    const event = new CustomEvent(`airis:${eventName}`, { detail });
    window.dispatchEvent(event);
  }

  /**
   * 수동 이벤트 추가
   */
  addCustomEvent(eventData) {
    if (!this.isRecording) return;

    this.handleEvent({
      type: 99, // 커스텀 타입
      data: {
        tag: 'custom',
        ...eventData
      },
      timestamp: Date.now()
    });
  }

  /**
   * 세션 정보 조회
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      isRecording: this.isRecording,
      startTime: this.startTime,
      duration: this.startTime ? Date.now() - this.startTime : 0,
      eventsCount: this.events.length,
      userId: this.options.userId
    };
  }
}

// 전역 객체로 등록
window.AIRISSessionRecorder = AIRISSessionRecorder;

// 자동 초기화 (옵션)
if (window.AIRIS_AUTO_RECORD !== false) {
  window.airisRecorder = new AIRISSessionRecorder(window.AIRIS_RECORDER_OPTIONS || {});
}