/**
 * Session Replay Service for AIRIS-MON
 * Records and replays user sessions for debugging and analysis
 */

const EventEmitter = require('events');
const rrweb = require('rrweb');
const logger = require('./utils/logger');

class SessionReplayService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxSessionDuration: config.maxSessionDuration || 30 * 60 * 1000, // 30 minutes
      maxEventBufferSize: config.maxEventBufferSize || 10000,
      samplingRate: config.samplingRate || 1.0, // 100% sampling by default
      maskAllInputs: config.maskAllInputs !== false, // Privacy: mask inputs by default
      maskTextSelector: config.maskTextSelector || '.sensitive',
      blockSelector: config.blockSelector || '.blocked',
      ignoreSelector: config.ignoreSelector || '.ignore-recording',
      checkoutEveryNth: config.checkoutEveryNth || 100, // Full snapshot frequency
      checkoutEveryNms: config.checkoutEveryNms || 60000, // Full snapshot every minute
      ...config
    };

    this.clickhouseService = null;
    this.redisService = null;
    this.kafkaService = null;
    
    this.activeSessions = new Map();
    this.sessionBuffers = new Map();
    this.sessions = new Map(); // 세션 데이터 저장용
    
    this.metrics = {
      totalSessions: 0,
      activeSessions: 0,
      totalEvents: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.isRunning = false;
  }

  /**
   * Initialize with optional services
   */
  async initialize(services = {}) {
    this.clickhouseService = services.clickhouse;
    this.redisService = services.redis;
    this.kafkaService = services.kafka;

    // ClickHouse is optional - service can work with local storage only
    if (!this.clickhouseService) {
      logger.warn('ClickHouse 서비스가 없습니다 - 로컬 저장소만 사용됩니다', {
        service: 'session-replay'
      });
    }

    logger.info('세션 리플레이 서비스 초기화됨', {
      service: 'session-replay',
      samplingRate: this.config.samplingRate,
      maskInputs: this.config.maskAllInputs,
      hasClickHouse: !!this.clickhouseService,
      hasRedis: !!this.redisService,
      hasKafka: !!this.kafkaService
    });
  }

  async start() {
    try {
      logger.info('세션 리플레이 서비스 시작 중...', { service: 'session-replay' });
      
      this.isRunning = true;
      
      // Start periodic flush
      this.startPeriodicFlush();
      
      // Setup Kafka consumer for session events
      if (this.kafkaService) {
        await this.setupKafkaConsumer();
      }

      logger.info('세션 리플레이 서비스가 시작되었습니다', { 
        service: 'session-replay',
        config: this.config
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('세션 리플레이 서비스 시작 실패', {
        error: error.message,
        service: 'session-replay'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('세션 리플레이 서비스 종료 중...', { service: 'session-replay' });
      
      this.isRunning = false;
      
      // Flush all remaining sessions
      await this.flushAllSessions();
      
      // Clear intervals
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }

      logger.info('세션 리플레이 서비스가 종료되었습니다', { service: 'session-replay' });

    } catch (error) {
      this.metrics.errors++;
      logger.error('세션 리플레이 서비스 종료 중 오류', {
        error: error.message,
        service: 'session-replay'
      });
    }
  }

  /**
   * Start recording a new session
   */
  async startRecording(sessionId, metadata = {}) {
    try {
      // Check sampling rate
      if (Math.random() > this.config.samplingRate) {
        logger.debug('세션이 샘플링 비율에 의해 제외되었습니다', {
          sessionId,
          samplingRate: this.config.samplingRate,
          service: 'session-replay'
        });
        return null;
      }

      const sessionData = {
        id: sessionId,
        userId: metadata.userId,
        userAgent: metadata.userAgent,
        url: metadata.url,
        viewport: metadata.viewport,
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        startTime: Date.now(),
        events: [],
        metadata,
        korean_business_hours: this.isKoreanBusinessHours()
      };

      this.activeSessions.set(sessionId, sessionData);
      this.sessionBuffers.set(sessionId, []);
      this.metrics.totalSessions++;
      this.metrics.activeSessions++;

      // Create rrweb recorder configuration
      const recordConfig = {
        emit: (event) => {
          this.handleRecordedEvent(sessionId, event);
        },
        checkoutEveryNth: this.config.checkoutEveryNth,
        checkoutEveryNms: this.config.checkoutEveryNms,
        maskAllInputs: this.config.maskAllInputs,
        maskTextSelector: this.config.maskTextSelector,
        blockSelector: this.config.blockSelector,
        ignoreSelector: this.config.ignoreSelector,
        recordCanvas: true,
        recordCrossOriginIframes: false,
        mousemoveWait: 50,
        // Korean-specific configuration
        maskTextFn: (text) => {
          // Mask Korean personal information patterns
          if (this.containsKoreanPersonalInfo(text)) {
            return '***';
          }
          return text;
        }
      };

      // Store session in Redis for quick access
      if (this.redisService) {
        await this.redisService.setSession(sessionId, sessionData, 86400); // 24 hours
      }

      logger.info('세션 녹화 시작', {
        sessionId,
        userId: metadata.userId,
        url: metadata.url,
        service: 'session-replay'
      });

      // Return recorder function for client
      return {
        sessionId,
        config: recordConfig,
        stop: () => this.stopRecording(sessionId)
      };

    } catch (error) {
      this.metrics.errors++;
      logger.error('세션 녹화 시작 실패', {
        sessionId,
        error: error.message,
        service: 'session-replay'
      });
      throw error;
    }
  }

  /**
   * Stop recording a session
   */
  async stopRecording(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        logger.warn('존재하지 않는 세션 종료 시도', {
          sessionId,
          service: 'session-replay'
        });
        return false;
      }

      session.endTime = Date.now();
      session.duration = session.endTime - session.startTime;
      session.korean_end_timestamp = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul'
      });

      // Flush session to storage
      await this.flushSession(sessionId);

      // Clean up
      this.activeSessions.delete(sessionId);
      this.sessionBuffers.delete(sessionId);
      this.metrics.activeSessions--;

      logger.info('세션 녹화 종료', {
        sessionId,
        duration: session.duration,
        eventCount: session.events.length,
        service: 'session-replay'
      });

      return true;

    } catch (error) {
      this.metrics.errors++;
      logger.error('세션 녹화 종료 실패', {
        sessionId,
        error: error.message,
        service: 'session-replay'
      });
      throw error;
    }
  }

  /**
   * Handle recorded events from rrweb
   */
  handleRecordedEvent(sessionId, event) {
    try {
      const buffer = this.sessionBuffers.get(sessionId);
      
      if (!buffer) {
        logger.warn('세션 버퍼를 찾을 수 없습니다', {
          sessionId,
          service: 'session-replay'
        });
        return;
      }

      // Enrich event with Korean context
      const enrichedEvent = {
        ...event,
        sessionId,
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        recorded_at: Date.now()
      };

      buffer.push(enrichedEvent);
      this.metrics.totalEvents++;

      // Check buffer size
      if (buffer.length >= this.config.maxEventBufferSize) {
        setImmediate(() => this.flushSession(sessionId));
      }

      // Emit event for real-time processing
      this.emit('session-event', enrichedEvent);

      // Send critical events to Kafka
      if (this.kafkaService && this.isCriticalEvent(event)) {
        this.kafkaService.sendMessage('airis-mon-session-events', enrichedEvent);
      }

    } catch (error) {
      this.metrics.errors++;
      logger.error('세션 이벤트 처리 실패', {
        sessionId,
        error: error.message,
        service: 'session-replay'
      });
    }
  }

  /**
   * Replay a recorded session
   */
  async replay(sessionId, options = {}) {
    try {
      // Get session data from storage
      const sessionData = await this.getSessionData(sessionId);
      
      if (!sessionData || !sessionData.events || sessionData.events.length === 0) {
        throw new Error('세션 데이터를 찾을 수 없습니다');
      }

      logger.info('세션 리플레이 시작', {
        sessionId,
        eventCount: sessionData.events.length,
        duration: sessionData.duration,
        service: 'session-replay'
      });

      // Create replayer configuration
      const replayerConfig = {
        events: sessionData.events,
        speed: options.speed || 1,
        root: options.root || document.body,
        loadTimeout: options.loadTimeout || 30000,
        skipInactive: options.skipInactive !== false,
        showWarning: options.showWarning !== false,
        showDebug: options.showDebug === true,
        blockClass: 'rr-block',
        liveMode: options.liveMode === true,
        insertStyleRules: [],
        triggerFocus: true,
        UNSAFE_replayCanvas: true,
        pauseAnimation: options.pauseAnimation === true,
        mouseTail: options.mouseTail !== false,
        // Event callbacks
        onError: (error) => {
          logger.error('리플레이 오류', {
            sessionId,
            error: error.message,
            service: 'session-replay'
          });
        },
        onFinish: () => {
          logger.info('리플레이 완료', {
            sessionId,
            service: 'session-replay'
          });
        }
      };

      // Return replayer instance
      return new rrweb.Replayer(sessionData.events, replayerConfig);

    } catch (error) {
      this.metrics.errors++;
      logger.error('세션 리플레이 실패', {
        sessionId,
        error: error.message,
        service: 'session-replay'
      });
      throw error;
    }
  }

  /**
   * Get session data from storage
   */
  async getSessionData(sessionId) {
    try {
      // Try Redis first
      if (this.redisService) {
        const cachedSession = await this.redisService.getSession(sessionId);
        if (cachedSession) {
          return cachedSession;
        }
      }

      // Get from ClickHouse
      if (this.clickhouseService) {
        const query = `
          SELECT 
            session_id,
            user_id,
            url,
            events,
            metadata,
            korean_timestamp,
            duration,
            korean_business_hours
          FROM session_replays
          WHERE session_id = '${sessionId}'
          ORDER BY timestamp DESC
          LIMIT 1
        `;

        const result = await this.clickhouseService.query(query);
        
        if (result.rows > 0) {
          const sessionData = result.data[0];
          
          // Parse events if stored as JSON string
          if (typeof sessionData.events === 'string') {
            sessionData.events = JSON.parse(sessionData.events);
          }

          // Cache in Redis
          if (this.redisService) {
            await this.redisService.setSession(sessionId, sessionData, 3600); // 1 hour
          }

          return sessionData;
        }
      }

      return null;

    } catch (error) {
      logger.error('세션 데이터 조회 실패', {
        sessionId,
        error: error.message,
        service: 'session-replay'
      });
      throw error;
    }
  }

  /**
   * Search sessions by criteria
   */
  async searchSessions(criteria = {}) {
    try {
      let query = `
        SELECT 
          session_id,
          user_id,
          url,
          korean_timestamp,
          duration,
          event_count,
          korean_business_hours,
          metadata
        FROM session_replays
        WHERE 1=1
      `;

      // Add filters
      if (criteria.userId) {
        query += ` AND user_id = '${criteria.userId}'`;
      }
      if (criteria.url) {
        query += ` AND url LIKE '%${criteria.url}%'`;
      }
      if (criteria.startTime) {
        query += ` AND timestamp >= '${criteria.startTime}'`;
      }
      if (criteria.endTime) {
        query += ` AND timestamp <= '${criteria.endTime}'`;
      }
      if (criteria.koreanBusinessHours !== undefined) {
        query += ` AND korean_business_hours = ${criteria.koreanBusinessHours}`;
      }
      if (criteria.minDuration) {
        query += ` AND duration >= ${criteria.minDuration}`;
      }
      if (criteria.hasErrors) {
        query += ` AND error_count > 0`;
      }

      query += ` ORDER BY timestamp DESC LIMIT ${criteria.limit || 100}`;

      const result = await this.clickhouseService.query(query);

      logger.info('세션 검색 완료', {
        criteria,
        resultCount: result.rows,
        service: 'session-replay'
      });

      return result.data;

    } catch (error) {
      logger.error('세션 검색 실패', {
        criteria,
        error: error.message,
        service: 'session-replay'
      });
      throw error;
    }
  }

  /**
   * Analyze session for insights
   */
  async analyzeSession(sessionId) {
    try {
      const sessionData = await this.getSessionData(sessionId);
      
      if (!sessionData) {
        throw new Error('세션을 찾을 수 없습니다');
      }

      const analysis = {
        sessionId,
        duration: sessionData.duration,
        eventCount: sessionData.events.length,
        eventTypes: {},
        userActions: [],
        errors: [],
        performance: {
          domContentLoaded: null,
          firstPaint: null,
          largestContentfulPaint: null
        },
        rage_clicks: [],
        dead_clicks: [],
        korean_patterns: {}
      };

      // Analyze events
      for (const event of sessionData.events) {
        // Count event types
        analysis.eventTypes[event.type] = (analysis.eventTypes[event.type] || 0) + 1;

        // Extract user actions
        if (event.type === 3) { // Mouse interaction
          analysis.userActions.push({
            type: 'click',
            timestamp: event.timestamp,
            target: event.data?.target
          });
        }

        // Find errors
        if (event.data?.plugin === 'rrweb/console' && event.data?.level === 'error') {
          analysis.errors.push({
            timestamp: event.timestamp,
            message: event.data.payload.join(' ')
          });
        }

        // Detect rage clicks (rapid successive clicks)
        if (this.isRageClick(event, sessionData.events)) {
          analysis.rage_clicks.push({
            timestamp: event.timestamp,
            target: event.data?.target
          });
        }
      }

      // Korean-specific analysis
      analysis.korean_patterns = this.analyzeKoreanPatterns(sessionData);

      logger.info('세션 분석 완료', {
        sessionId,
        analysis,
        service: 'session-replay'
      });

      return analysis;

    } catch (error) {
      logger.error('세션 분석 실패', {
        sessionId,
        error: error.message,
        service: 'session-replay'
      });
      throw error;
    }
  }

  /**
   * Flush session to storage
   */
  async flushSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      const buffer = this.sessionBuffers.get(sessionId);
      
      if (!session || !buffer || buffer.length === 0) {
        return;
      }

      // Add buffered events to session
      session.events.push(...buffer);
      session.event_count = session.events.length;

      // Store in ClickHouse
      if (this.clickhouseService) {
        await this.clickhouseService.insertWideEvent({
          event_type: 'session_replay',
          service_name: 'session-replay',
          session_id: sessionId,
          user_id: session.userId,
          url: session.url,
          events: JSON.stringify(session.events),
          event_count: session.event_count,
          duration: session.duration || (Date.now() - session.startTime),
          metadata: session.metadata,
          korean_business_hours: session.korean_business_hours
        });
      }

      // Clear buffer
      this.sessionBuffers.set(sessionId, []);

      logger.debug('세션 플러시 완료', {
        sessionId,
        eventCount: buffer.length,
        service: 'session-replay'
      });

    } catch (error) {
      logger.error('세션 플러시 실패', {
        sessionId,
        error: error.message,
        service: 'session-replay'
      });
      throw error;
    }
  }

  /**
   * Start periodic flush
   */
  startPeriodicFlush() {
    this.flushInterval = setInterval(async () => {
      await this.flushAllSessions();
    }, 30000); // Every 30 seconds
  }

  /**
   * Flush all active sessions
   */
  async flushAllSessions() {
    const flushPromises = [];
    
    for (const sessionId of this.activeSessions.keys()) {
      flushPromises.push(this.flushSession(sessionId));
    }

    await Promise.all(flushPromises);
    
    logger.debug('모든 세션 플러시 완료', {
      sessionCount: flushPromises.length,
      service: 'session-replay'
    });
  }

  /**
   * Setup Kafka consumer
   */
  async setupKafkaConsumer() {
    const consumer = await this.kafkaService.createConsumer({
      groupId: 'session-replay-consumer',
      consumerName: 'session-replay'
    });

    await consumer.subscribe(['airis-mon-session-commands']);
    
    await consumer.run(async (message) => {
      const command = message.command;
      const payload = message.payload;

      switch (command) {
        case 'start_recording':
          await this.startRecording(payload.sessionId, payload.metadata);
          break;
        case 'stop_recording':
          await this.stopRecording(payload.sessionId);
          break;
        case 'analyze_session':
          await this.analyzeSession(payload.sessionId);
          break;
        default:
          logger.warn('알 수 없는 명령', {
            command,
            service: 'session-replay'
          });
      }
    });
  }

  /**
   * Utility methods
   */
  isKoreanBusinessHours() {
    const now = new Date();
    const koreanTime = new Date(now.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul'
    }));
    
    const hour = koreanTime.getHours();
    const day = koreanTime.getDay();
    
    return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
  }

  containsKoreanPersonalInfo(text) {
    // Korean personal information patterns
    const patterns = [
      /\d{6}-\d{7}/, // 주민등록번호
      /\d{3}-\d{4}-\d{4}/, // 전화번호
      /[가-힣]+[\s]*(님|씨|선생님|고객님)/, // 이름 패턴
      /\d{5,6}/, // 우편번호
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  isCriticalEvent(event) {
    // Define critical events that should be immediately processed
    return event.type === 3 && event.data?.source === 5; // Console error
  }

  isRageClick(event, allEvents) {
    if (event.type !== 3 || event.data?.source !== 2) return false; // Not a click
    
    const clickTime = event.timestamp;
    const nearbyClicks = allEvents.filter(e => 
      e.type === 3 && 
      e.data?.source === 2 &&
      Math.abs(e.timestamp - clickTime) < 1000 && // Within 1 second
      e.data?.x === event.data?.x &&
      e.data?.y === event.data?.y
    );

    return nearbyClicks.length >= 3; // 3+ clicks in same location
  }

  analyzeKoreanPatterns(sessionData) {
    const patterns = {
      navigation_style: 'linear', // Korean users prefer linear navigation
      form_completion_time: null,
      scroll_behavior: 'fast', // 빨리빨리 culture
      interaction_density: 'high'
    };

    // Analyze Korean-specific UX patterns
    // This would be extended with actual pattern analysis

    return patterns;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      return {
        status: this.isRunning ? 'healthy' : 'stopped',
        running: this.isRunning,
        metrics: this.getMetrics(),
        active_sessions: this.activeSessions.size,
        services: {
          clickhouse: !!this.clickhouseService,
          redis: !!this.redisService,
          kafka: !!this.kafkaService
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        error: error.message
      };
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      event_rate: this.metrics.totalEvents / 
                 ((Date.now() - this.metrics.startTime) / 1000) || 0
    };
  }
}

module.exports = SessionReplayService;