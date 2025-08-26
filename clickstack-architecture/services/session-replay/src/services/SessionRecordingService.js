const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * 세션 기록 관리 서비스
 * rrweb 기록 데이터를 저장하고 관리합니다.
 */
class SessionRecordingService {
  constructor() {
    this.storageDir = path.join(process.cwd(), 'recordings');
    this.metadataFile = path.join(this.storageDir, 'metadata.json');
    this.ensureStorageDirectory();
  }

  async ensureStorageDirectory() {
    try {
      await fs.ensureDir(this.storageDir);
      
      // metadata.json 파일이 없으면 초기화
      if (!(await fs.pathExists(this.metadataFile))) {
        await fs.writeJson(this.metadataFile, { sessions: [] });
      }
    } catch (error) {
      logger.error('스토리지 디렉토리 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 새 세션 기록 시작
   */
  async startRecording(sessionInfo) {
    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const sessionData = {
      id: sessionId,
      userId: sessionInfo.userId || 'anonymous',
      url: sessionInfo.url || 'unknown',
      userAgent: sessionInfo.userAgent || 'unknown',
      startTime: timestamp,
      status: 'recording',
      eventsCount: 0,
      duration: 0,
      tags: sessionInfo.tags || [],
      metadata: {
        viewport: sessionInfo.viewport || {},
        device: sessionInfo.device || 'desktop',
        browser: sessionInfo.browser || 'unknown'
      }
    };

    // 메타데이터 업데이트
    const metadata = await fs.readJson(this.metadataFile);
    metadata.sessions.push(sessionData);
    await fs.writeJson(this.metadataFile, metadata, { spaces: 2 });

    // 세션 데이터 파일 초기화
    const sessionFile = path.join(this.storageDir, `${sessionId}.json`);
    await fs.writeJson(sessionFile, { 
      session: sessionData, 
      events: [] 
    });

    logger.info(`세션 기록 시작: ${sessionId}`);
    return sessionId;
  }

  /**
   * 세션 이벤트 추가
   */
  async addEvents(sessionId, events) {
    try {
      const sessionFile = path.join(this.storageDir, `${sessionId}.json`);
      
      if (!(await fs.pathExists(sessionFile))) {
        throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
      }

      const sessionData = await fs.readJson(sessionFile);
      sessionData.events.push(...events);

      await fs.writeJson(sessionFile, sessionData);

      // 메타데이터 업데이트
      await this.updateSessionMetadata(sessionId, {
        eventsCount: sessionData.events.length,
        lastUpdate: new Date().toISOString()
      });

      logger.debug(`세션 이벤트 추가: ${sessionId}, 이벤트 수: ${events.length}`);
      return true;
    } catch (error) {
      logger.error('세션 이벤트 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 세션 기록 종료
   */
  async stopRecording(sessionId) {
    try {
      const endTime = new Date().toISOString();
      const sessionFile = path.join(this.storageDir, `${sessionId}.json`);
      
      if (!(await fs.pathExists(sessionFile))) {
        throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
      }

      const sessionData = await fs.readJson(sessionFile);
      const startTime = new Date(sessionData.session.startTime);
      const duration = new Date(endTime) - startTime;

      // 세션 데이터 업데이트
      sessionData.session.endTime = endTime;
      sessionData.session.duration = duration;
      sessionData.session.status = 'completed';

      await fs.writeJson(sessionFile, sessionData);

      // 메타데이터 업데이트
      await this.updateSessionMetadata(sessionId, {
        endTime,
        duration,
        status: 'completed'
      });

      logger.info(`세션 기록 완료: ${sessionId}, 시간: ${duration}ms`);
      return sessionData.session;
    } catch (error) {
      logger.error('세션 기록 종료 실패:', error);
      throw error;
    }
  }

  /**
   * 세션 목록 조회
   */
  async getSessionList(filters = {}) {
    try {
      const metadata = await fs.readJson(this.metadataFile);
      let sessions = metadata.sessions;

      // 필터 적용
      if (filters.userId) {
        sessions = sessions.filter(s => s.userId === filters.userId);
      }
      if (filters.status) {
        sessions = sessions.filter(s => s.status === filters.status);
      }
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        sessions = sessions.filter(s => new Date(s.startTime) >= fromDate);
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        sessions = sessions.filter(s => new Date(s.startTime) <= toDate);
      }

      // 최신순 정렬
      sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      return sessions;
    } catch (error) {
      logger.error('세션 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 세션 데이터 조회
   */
  async getSession(sessionId) {
    try {
      const sessionFile = path.join(this.storageDir, `${sessionId}.json`);
      
      if (!(await fs.pathExists(sessionFile))) {
        throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
      }

      const sessionData = await fs.readJson(sessionFile);
      return sessionData;
    } catch (error) {
      logger.error('세션 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId) {
    try {
      const sessionFile = path.join(this.storageDir, `${sessionId}.json`);
      
      if (await fs.pathExists(sessionFile)) {
        await fs.remove(sessionFile);
      }

      // 메타데이터에서 제거
      const metadata = await fs.readJson(this.metadataFile);
      metadata.sessions = metadata.sessions.filter(s => s.id !== sessionId);
      await fs.writeJson(this.metadataFile, metadata, { spaces: 2 });

      logger.info(`세션 삭제 완료: ${sessionId}`);
      return true;
    } catch (error) {
      logger.error('세션 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 세션 메타데이터 업데이트
   */
  async updateSessionMetadata(sessionId, updates) {
    try {
      const metadata = await fs.readJson(this.metadataFile);
      const sessionIndex = metadata.sessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex === -1) {
        throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
      }

      // 메타데이터 업데이트
      Object.assign(metadata.sessions[sessionIndex], updates);
      await fs.writeJson(this.metadataFile, metadata, { spaces: 2 });

      return metadata.sessions[sessionIndex];
    } catch (error) {
      logger.error('세션 메타데이터 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 통계 조회
   */
  async getStatistics() {
    try {
      const metadata = await fs.readJson(this.metadataFile);
      const sessions = metadata.sessions;

      const stats = {
        total: sessions.length,
        recording: sessions.filter(s => s.status === 'recording').length,
        completed: sessions.filter(s => s.status === 'completed').length,
        failed: sessions.filter(s => s.status === 'failed').length,
        totalDuration: sessions
          .filter(s => s.duration)
          .reduce((sum, s) => sum + s.duration, 0),
        averageDuration: 0,
        totalEvents: sessions.reduce((sum, s) => sum + (s.eventsCount || 0), 0),
        recentSessions: sessions
          .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
          .slice(0, 10)
      };

      if (stats.completed > 0) {
        const completedSessions = sessions.filter(s => s.status === 'completed' && s.duration);
        stats.averageDuration = completedSessions.reduce((sum, s) => sum + s.duration, 0) / completedSessions.length;
      }

      return stats;
    } catch (error) {
      logger.error('통계 조회 실패:', error);
      throw error;
    }
  }
}

module.exports = SessionRecordingService;