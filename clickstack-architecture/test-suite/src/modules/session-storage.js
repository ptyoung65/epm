/**
 * 세션 리플레이 데이터 저장소 관리자
 * 실시간 세션 녹화 데이터를 메모리와 파일에 저장/관리
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class SessionStorage {
    constructor() {
        this.activeSessions = new Map(); // 현재 진행 중인 세션들
        this.completedSessions = new Map(); // 완료된 세션들
        this.storageDir = path.join(__dirname, '../../storage/sessions');
        this.maxActiveSessions = 100;
        this.sessionTimeout = 30 * 60 * 1000; // 30분 타임아웃
        
        this.initializeStorage();
        this.startCleanupTimer();
    }

    async initializeStorage() {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
            console.log('📁 세션 저장소 초기화 완료:', this.storageDir);
        } catch (error) {
            console.error('❌ 세션 저장소 초기화 실패:', error);
        }
    }

    // 모든 세션 데이터 삭제 (초기화용)
    async clearAllSessions() {
        try {
            // 메모리 세션 클리어
            this.activeSessions.clear();
            this.completedSessions.clear();
            
            // 파일 시스템 세션 클리어
            const files = await fs.readdir(this.storageDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    await fs.unlink(path.join(this.storageDir, file));
                }
            }
            
            console.log('🧹 모든 세션 데이터가 삭제되었습니다');
            return { success: true, message: '모든 세션 데이터 삭제 완료' };
        } catch (error) {
            console.error('❌ 세션 데이터 삭제 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 새 세션 시작
    startSession(scenario, userAgent = '', ipAddress = '127.0.0.1') {
        const sessionId = uuidv4();
        const startTime = new Date();
        
        const sessionData = {
            id: sessionId,
            scenario: scenario,
            startTime: startTime.toISOString(),
            lastActivity: startTime.toISOString(),
            userAgent: userAgent,
            ipAddress: ipAddress,
            events: [],
            status: 'active',
            metadata: {
                viewport: { width: 1920, height: 1080 },
                userAgent: userAgent,
                device: this.parseUserAgent(userAgent)
            }
        };

        // 활성 세션 수 제한
        if (this.activeSessions.size >= this.maxActiveSessions) {
            const oldestSession = [...this.activeSessions.entries()]
                .sort(([,a], [,b]) => new Date(a.lastActivity) - new Date(b.lastActivity))[0];
            this.endSession(oldestSession[0], 'session_limit_reached');
        }

        this.activeSessions.set(sessionId, sessionData);
        console.log(`🎬 새 세션 시작: ${sessionId} (${scenario})`);
        
        return sessionId;
    }

    // 세션에 이벤트 추가 (rrweb 이벤트 지원)
    addEvent(sessionId, eventData) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            console.warn(`⚠️ 활성 세션을 찾을 수 없음: ${sessionId}`);
            return false;
        }

        // rrweb 이벤트인지 확인
        if (eventData.event && eventData.event.type !== undefined) {
            // rrweb 이벤트 처리
            const rrwebEvent = eventData.event;
            const processedEvent = {
                id: uuidv4(),
                sessionId: sessionId,
                timestamp: rrwebEvent.timestamp || (Date.now() - new Date(session.startTime).getTime()),
                recordedAt: new Date().toISOString(),
                type: 'rrweb_event',
                rrwebType: rrwebEvent.type,
                rrwebData: rrwebEvent.data,
                originalEvent: rrwebEvent
            };
            
            session.events.push(processedEvent);
        } else {
            // 기존 이벤트 처리 (하위 호환성)
            const event = {
                id: uuidv4(),
                sessionId: sessionId,
                timestamp: Date.now() - new Date(session.startTime).getTime(),
                recordedAt: new Date().toISOString(),
                ...eventData
            };
            
            session.events.push(event);
        }

        session.lastActivity = new Date().toISOString();
        
        // 메모리 사용량 관리 (이벤트가 2000개 초과시 자동 종료 - rrweb는 더 많은 이벤트 생성)
        if (session.events.length > 2000) {
            this.endSession(sessionId, 'max_events_reached');
        }

        return true;
    }

    // 세션 종료
    async endSession(sessionId, reason = 'user_ended') {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return { success: false, error: '세션을 찾을 수 없음' };
        }

        // 세션 종료 처리
        const endTime = new Date();
        session.endTime = endTime.toISOString();
        session.duration = endTime.getTime() - new Date(session.startTime).getTime();
        session.status = 'completed';
        session.endReason = reason;

        // 세션 통계 계산
        session.statistics = this.calculateSessionStats(session);

        // 활성 세션에서 제거하고 완료된 세션으로 이동
        this.activeSessions.delete(sessionId);
        this.completedSessions.set(sessionId, session);

        // 파일로 저장
        await this.saveSessionToFile(session);

        console.log(`✅ 세션 종료: ${sessionId} (${session.events.length}개 이벤트, ${session.duration}ms)`);
        
        return { success: true, session: session };
    }

    // 세션 통계 계산
    calculateSessionStats(session) {
        const events = session.events;
        
        const stats = {
            totalEvents: events.length,
            eventTypes: {},
            clicks: events.filter(e => e.type === 'click').length,
            formInputs: events.filter(e => e.type === 'form_input').length,
            pageViews: events.filter(e => e.type === 'page_load').length,
            errors: events.filter(e => e.type === 'javascript_error' || e.type.includes('error')).length,
            scrollEvents: events.filter(e => e.type === 'scroll').length
        };

        // 이벤트 타입별 통계
        events.forEach(event => {
            stats.eventTypes[event.type] = (stats.eventTypes[event.type] || 0) + 1;
        });

        // 사용자 행동 패턴 분석
        stats.userBehavior = {
            avgTimeBetweenEvents: events.length > 1 ? 
                (events[events.length - 1].timestamp - events[0].timestamp) / events.length : 0,
            hasErrors: stats.errors > 0,
            hasFormInteraction: stats.formInputs > 0,
            hasNavigation: stats.pageViews > 1
        };

        return stats;
    }

    // 파일로 세션 저장
    async saveSessionToFile(session) {
        try {
            const filename = `session_${session.id}_${Date.now()}.json`;
            const filepath = path.join(this.storageDir, filename);
            await fs.writeFile(filepath, JSON.stringify(session, null, 2));
        } catch (error) {
            console.error(`❌ 세션 파일 저장 실패 (${session.id}):`, error);
        }
    }

    // 세션 목록 조회 (시나리오별)
    getSessionsByScenario(scenario) {
        const activeSessions = [...this.activeSessions.values()]
            .filter(s => s.scenario === scenario)
            .map(s => this.getSessionSummary(s));

        const completedSessions = [...this.completedSessions.values()]
            .filter(s => s.scenario === scenario)
            .map(s => this.getSessionSummary(s));

        return [...completedSessions, ...activeSessions]
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    }

    // 특정 세션 조회
    getSession(sessionId) {
        return this.activeSessions.get(sessionId) || this.completedSessions.get(sessionId) || null;
    }

    // 세션 요약 정보
    getSessionSummary(session) {
        return {
            id: session.id,
            scenario: session.scenario,
            user: session.ipAddress || 'unknown',
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration || (Date.now() - new Date(session.startTime).getTime()),
            status: session.status,
            eventCount: session.events.length,
            errors: session.statistics ? session.statistics.errors : 
                    session.events.filter(e => e.type.includes('error')).length,
            device: session.metadata?.device?.type || 'unknown'
        };
    }

    // User Agent 파싱
    parseUserAgent(userAgent) {
        const device = {
            type: 'desktop',
            browser: 'unknown',
            os: 'unknown'
        };

        if (!userAgent) return device;

        // 브라우저 감지
        if (userAgent.includes('Chrome')) device.browser = 'Chrome';
        else if (userAgent.includes('Firefox')) device.browser = 'Firefox';
        else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) device.browser = 'Safari';
        else if (userAgent.includes('Edge')) device.browser = 'Edge';

        // OS 감지
        if (userAgent.includes('Windows')) device.os = 'Windows';
        else if (userAgent.includes('Mac OS X')) device.os = 'macOS';
        else if (userAgent.includes('Linux')) device.os = 'Linux';
        else if (userAgent.includes('Android')) device.os = 'Android';
        else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) device.os = 'iOS';

        // 디바이스 타입
        if (userAgent.includes('Mobile') || userAgent.includes('Android')) device.type = 'mobile';
        else if (userAgent.includes('iPad') || userAgent.includes('Tablet')) device.type = 'tablet';

        return device;
    }

    // 타임아웃된 세션 정리
    startCleanupTimer() {
        setInterval(() => {
            const now = Date.now();
            const timeoutSessions = [];

            for (const [sessionId, session] of this.activeSessions.entries()) {
                const lastActivity = new Date(session.lastActivity).getTime();
                if (now - lastActivity > this.sessionTimeout) {
                    timeoutSessions.push(sessionId);
                }
            }

            timeoutSessions.forEach(sessionId => {
                this.endSession(sessionId, 'session_timeout');
            });

            if (timeoutSessions.length > 0) {
                console.log(`🧹 타임아웃된 세션 ${timeoutSessions.length}개 정리 완료`);
            }
        }, 5 * 60 * 1000); // 5분마다 정리
    }

    // 전체 세션 저장 (rrweb 완전한 세션)
    async saveFullSession(sessionData) {
        try {
            const sessionId = sessionData.id;
            
            // 메모리에서 활성 세션 제거 (있다면)
            if (this.activeSessions.has(sessionId)) {
                this.activeSessions.delete(sessionId);
            }
            
            // 완전한 세션 데이터 구성
            const completeSession = {
                id: sessionId,
                scenario: sessionData.scenario || 'real_dom_recording',
                startTime: sessionData.startTime ? new Date(sessionData.startTime).toISOString() : new Date().toISOString(),
                endTime: sessionData.endTime ? new Date(sessionData.endTime).toISOString() : new Date().toISOString(),
                duration: sessionData.duration || 0,
                events: sessionData.events || [],
                eventCount: sessionData.events ? sessionData.events.length : 0,
                status: 'completed',
                metadata: {
                    viewport: sessionData.viewport || { width: 1920, height: 1080 },
                    userAgent: sessionData.userAgent || '',
                    device: this.parseUserAgent(sessionData.userAgent || ''),
                    timestamp: sessionData.timestamp || new Date().toISOString()
                }
            };
            
            // 파일에 저장
            const fileName = `${sessionId}.json`;
            const filePath = path.join(this.storageDir, fileName);
            await fs.writeFile(filePath, JSON.stringify(completeSession, null, 2));
            
            // 완료된 세션 메모리에 추가
            this.completedSessions.set(sessionId, completeSession);
            
            console.log(`💾 전체 세션 파일 저장 완료: ${fileName}`);
            
            return {
                success: true,
                sessionId: sessionId,
                eventCount: completeSession.eventCount,
                message: '세션이 성공적으로 저장되었습니다'
            };
            
        } catch (error) {
            console.error('전체 세션 저장 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 활성 세션 목록 조회
    getActiveSessions() {
        return Array.from(this.activeSessions.values());
    }

    // 전체 통계
    getOverallStats() {
        const activeCount = this.activeSessions.size;
        const completedCount = this.completedSessions.size;
        
        return {
            activeSessions: activeCount,
            completedSessions: completedCount,
            totalSessions: activeCount + completedCount,
            scenarios: {
                bug_payment: this.getSessionsByScenario('bug_payment').length,
                ux_navigation: this.getSessionsByScenario('ux_navigation').length,
                security_attack: this.getSessionsByScenario('security_attack').length,
                performance_slow: this.getSessionsByScenario('performance_slow').length,
                real_dom_recording: this.getSessionsByScenario('real_dom_recording').length,
                integrated_test: this.getSessionsByScenario('integrated_test').length,
                enhanced_recording: this.getSessionsByScenario('enhanced_recording').length
            }
        };
    }
}

module.exports = SessionStorage;