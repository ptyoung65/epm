/**
 * AIRIS 세션 리플레이 전역 레코더
 * 모든 페이지에서 동작하는 세션 기록 스크립트
 */

class AIRISGlobalRecorder {
  constructor() {
    this.recorder = null;
    this.events = [];
    this.sessionId = null;
    this.isRecording = false;
    this.userId = 'anonymous';
    this.startTime = null;
    this.pageViews = [];
    
    // 로컬 스토리지에서 기록 상태 복원
    this.restoreRecordingState();
    
    // 페이지 언로드시 이벤트 저장
    this.setupPageUnloadHandler();
    
    console.log('AIRIS 글로벌 레코더 초기화됨');
  }

  // 기록 상태 복원
  restoreRecordingState() {
    const savedState = localStorage.getItem('airis_recording_state');
    if (savedState) {
      const state = JSON.parse(savedState);
      if (state.isRecording && Date.now() - state.startTime < 30 * 60 * 1000) { // 30분 제한
        console.log('기존 세션 기록 복원');
        this.sessionId = state.sessionId;
        this.userId = state.userId;
        this.startTime = state.startTime;
        this.events = state.events || [];
        this.pageViews = state.pageViews || [];
        this.startRecording(true); // 복원 모드
      } else {
        // 만료된 세션 정리
        localStorage.removeItem('airis_recording_state');
      }
    }
  }

  // 기록 상태 저장
  saveRecordingState() {
    if (this.isRecording) {
      const state = {
        isRecording: this.isRecording,
        sessionId: this.sessionId,
        userId: this.userId,
        startTime: this.startTime,
        events: this.events,
        pageViews: this.pageViews
      };
      localStorage.setItem('airis_recording_state', JSON.stringify(state));
    }
  }

  // 기록 시작
  startRecording(isRestore = false) {
    if (this.isRecording && !isRestore) {
      console.log('이미 기록 중입니다');
      return;
    }

    if (!isRestore) {
      this.sessionId = 'session_' + Date.now();
      this.startTime = Date.now();
      this.events = [];
      this.pageViews = [];
      this.userId = this.getUserId();
    }

    this.isRecording = true;

    // 현재 페이지 정보 추가
    this.addPageView();

    // rrweb 레코더 시작
    if (typeof rrweb !== 'undefined') {
      this.recorder = rrweb.record({
        emit: (event) => {
          this.events.push({
            ...event,
            timestamp: Date.now(),
            page: window.location.href
          });
          
          // 100개 이벤트마다 저장
          if (this.events.length % 100 === 0) {
            this.saveRecordingState();
            console.log(`이벤트 저장됨: ${this.events.length}개 (페이지: ${this.pageViews.length}개)`);
          }
        },
        recordCanvas: true,
        recordCrossOriginIframes: false,
        checkoutEveryNms: 30000, // 30초마다 체크아웃
      });

      console.log(`세션 기록 시작 (${isRestore ? '복원' : '새 세션'}): ${this.sessionId}`);
      this.saveRecordingState();
      
      // 상태 표시 업데이트 (세션 리플레이 페이지에 있는 경우)
      this.updateUIStatus();
      
    } else {
      console.error('rrweb 라이브러리가 로드되지 않았습니다');
    }
  }

  // 페이지 뷰 추가
  addPageView() {
    const pageView = {
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      referrer: document.referrer
    };
    this.pageViews.push(pageView);
    console.log('페이지 뷰 추가:', pageView.url);
  }

  // 기록 중지
  stopRecording() {
    if (!this.isRecording) {
      console.log('기록 중이 아닙니다');
      return;
    }

    this.isRecording = false;

    if (this.recorder) {
      try {
        if (typeof this.recorder === 'function') {
          // rrweb.record()가 stop 함수를 직접 반환하는 경우
          this.recorder();
        } else if (this.recorder.stop && typeof this.recorder.stop === 'function') {
          // recorder 객체에 stop 메서드가 있는 경우
          this.recorder.stop();
        } else {
          console.warn('알 수 없는 recorder 타입:', typeof this.recorder);
        }
      } catch (error) {
        console.error('레코더 중지 중 오류:', error);
      }
      this.recorder = null;
    }

    // 최종 세션 데이터 저장
    const sessionData = {
      id: this.sessionId,
      userId: this.userId,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      events: [...this.events],
      eventsCount: this.events.length,
      pageViews: [...this.pageViews],
      pageCount: this.pageViews.length,
      url: this.pageViews[0]?.url || window.location.href,
      status: 'completed'
    };

    // 로컬 스토리지에 세션 저장
    const savedSessions = JSON.parse(localStorage.getItem('recordedSessions') || '[]');
    savedSessions.unshift(sessionData);
    localStorage.setItem('recordedSessions', JSON.stringify(savedSessions.slice(0, 20))); // 최대 20개 보관

    // 기록 상태 제거
    localStorage.removeItem('airis_recording_state');

    console.log(`세션 기록 완료: ${sessionData.eventsCount}개 이벤트, ${sessionData.pageCount}개 페이지`);
    
    // 상태 표시 업데이트
    this.updateUIStatus();

    return sessionData;
  }

  // 사용자 ID 가져오기
  getUserId() {
    // 세션 리플레이 페이지의 입력값 시도
    const userIdInput = document.getElementById('userId');
    if (userIdInput && userIdInput.value) {
      return userIdInput.value;
    }
    
    // 로컬 스토리지에서 시도
    const savedUserId = localStorage.getItem('airis_user_id');
    if (savedUserId) {
      return savedUserId;
    }
    
    return 'anonymous_' + Date.now().toString().slice(-6);
  }

  // UI 상태 업데이트 (세션 리플레이 페이지에 있는 경우)
  updateUIStatus() {
    const recordBtn = document.getElementById('recordBtn');
    const statusDiv = document.getElementById('recordingStatus');
    
    if (recordBtn && statusDiv) {
      if (this.isRecording) {
        recordBtn.textContent = '기록 중지';
        recordBtn.className = 'bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium';
        statusDiv.textContent = `글로벌 기록 중... (${this.events.length}개 이벤트, ${this.pageViews.length}개 페이지)`;
        statusDiv.className = 'text-red-600 font-medium';
      } else {
        recordBtn.textContent = '기록 시작';
        recordBtn.className = 'bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium';
        statusDiv.textContent = '새 세션을 시작할 수 있습니다.';
        statusDiv.className = 'text-gray-600';
      }
    }
    
    // 디버그 로그
    console.log('UI 상태 업데이트:', {
      isRecording: this.isRecording,
      events: this.events.length,
      pages: this.pageViews.length,
      hasButton: !!recordBtn,
      hasStatus: !!statusDiv
    });
  }

  // 페이지 언로드 핸들러 설정
  setupPageUnloadHandler() {
    window.addEventListener('beforeunload', () => {
      if (this.isRecording) {
        this.saveRecordingState();
        console.log('페이지 언로드: 기록 상태 저장됨');
      }
    });

    // 페이지 로드 완료 시 페이지 뷰 업데이트
    window.addEventListener('load', () => {
      if (this.isRecording) {
        this.addPageView();
        this.saveRecordingState();
      }
    });

    // 해시 변경 감지 (SPA 네비게이션)
    window.addEventListener('hashchange', () => {
      if (this.isRecording) {
        this.addPageView();
        this.saveRecordingState();
      }
    });

    // History API 감지
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      if (window.airisRecorder && window.airisRecorder.isRecording) {
        setTimeout(() => {
          window.airisRecorder.addPageView();
          window.airisRecorder.saveRecordingState();
        }, 100);
      }
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      if (window.airisRecorder && window.airisRecorder.isRecording) {
        setTimeout(() => {
          window.airisRecorder.addPageView();
          window.airisRecorder.saveRecordingState();
        }, 100);
      }
    };

    // popstate 이벤트
    window.addEventListener('popstate', () => {
      if (this.isRecording) {
        setTimeout(() => {
          this.addPageView();
          this.saveRecordingState();
        }, 100);
      }
    });
  }

  // 현재 기록 상태 정보
  getStatus() {
    return {
      isRecording: this.isRecording,
      sessionId: this.sessionId,
      userId: this.userId,
      eventsCount: this.events.length,
      pageCount: this.pageViews.length,
      duration: this.startTime ? Date.now() - this.startTime : 0,
      currentPage: window.location.href
    };
  }
}

// 전역 레코더 인스턴스 생성
if (typeof window !== 'undefined') {
  // rrweb 라이브러리 로드 확인 및 대기
  function initializeRecorder() {
    if (typeof rrweb !== 'undefined') {
      window.airisRecorder = new AIRISGlobalRecorder();
      console.log('✅ AIRIS 글로벌 레코더 준비 완료');
    } else {
      console.log('⏳ rrweb 라이브러리 로딩 대기 중...');
      setTimeout(initializeRecorder, 1000);
    }
  }

  // 페이지 로드 후 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRecorder);
  } else {
    initializeRecorder();
  }
}