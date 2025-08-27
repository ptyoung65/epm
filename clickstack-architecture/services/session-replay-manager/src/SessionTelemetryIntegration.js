/**
 * 세션 리플레이와 OpenTelemetry 통합 관리 서비스
 * AIRIS APM 시스템용 통합 세션 추적 및 분석 엔진
 */

const { Pool } = require('pg');
const logger = require('./utils/logger');

class SessionTelemetryIntegration {
    constructor(config = {}) {
        this.config = {
            database: {
                host: process.env.POSTGRES_HOST || 'localhost',
                port: process.env.POSTGRES_PORT || 5432,
                database: process.env.POSTGRES_DB || 'airis_apm',
                user: process.env.POSTGRES_USER || 'postgres',
                password: process.env.POSTGRES_PASSWORD || 'postgres',
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            },
            clickhouse: {
                host: process.env.CLICKHOUSE_HOST || 'localhost',
                port: process.env.CLICKHOUSE_PORT || 8123,
                database: process.env.CLICKHOUSE_DB || 'airis_apm'
            },
            correlation: {
                timeToleranceMs: 5000,  // 5초 허용 오차
                confidenceThreshold: 0.7,
                batchSize: 100,
                maxRetries: 3
            },
            ...config
        };

        this.pgPool = new Pool(this.config.database);
        this.clickhouseClient = null;
        this.isInitialized = false;
        
        this.metrics = {
            sessionsCreated: 0,
            correlationsFound: 0,
            insightsGenerated: 0,
            errors: 0
        };
    }

    async initialize() {
        try {
            logger.info('세션-텔레메트리 통합 서비스 초기화 중...', {
                service: 'session-telemetry-integration'
            });

            // PostgreSQL 연결 테스트
            const client = await this.pgPool.connect();
            await client.query('SELECT NOW()');
            client.release();

            // ClickHouse 클라이언트 설정 (선택적)
            try {
                const { ClickHouseClient } = require('@clickhouse/client');
                this.clickhouseClient = new ClickHouseClient({
                    host: `http://${this.config.clickhouse.host}:${this.config.clickhouse.port}`,
                    database: this.config.clickhouse.database,
                });
                await this.clickhouseClient.ping();
                logger.info('ClickHouse 연결 성공');
            } catch (error) {
                logger.warn('ClickHouse 연결 실패 - PostgreSQL만 사용합니다', {
                    error: error.message
                });
            }

            this.isInitialized = true;
            logger.info('세션-텔레메트리 통합 서비스 초기화 완료');

        } catch (error) {
            logger.error('세션-텔레메트리 통합 서비스 초기화 실패', {
                error: error.message,
                service: 'session-telemetry-integration'
            });
            throw error;
        }
    }

    /**
     * 새로운 세션 추적 시작
     */
    async createSessionTracking(sessionData) {
        try {
            const {
                airisSessionId,
                otelSessionId = null,
                otelTraceId = null,
                userId = null,
                userAgent = null,
                ipAddress = null,
                geoLocation = null
            } = sessionData;

            const client = await this.pgPool.connect();
            
            try {
                const query = `
                    INSERT INTO session_tracking (
                        airis_session_id, otel_session_id, otel_trace_id,
                        user_id, user_agent, ip_address, geo_location,
                        session_start_time, replay_status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'active')
                    RETURNING id, airis_session_id, session_start_time
                `;
                
                const values = [
                    airisSessionId, otelSessionId, otelTraceId,
                    userId, userAgent, ipAddress, 
                    geoLocation ? JSON.stringify(geoLocation) : null
                ];

                const result = await client.query(query, values);
                const session = result.rows[0];

                this.metrics.sessionsCreated++;

                logger.info('새로운 세션 추적 생성', {
                    sessionId: airisSessionId,
                    otelSessionId,
                    dbId: session.id
                });

                return session;

            } finally {
                client.release();
            }

        } catch (error) {
            this.metrics.errors++;
            logger.error('세션 추적 생성 실패', {
                error: error.message,
                sessionData
            });
            throw error;
        }
    }

    /**
     * OpenTelemetry 정보로 세션 업데이트
     */
    async updateSessionWithTelemetry(airisSessionId, telemetryData) {
        try {
            const {
                otelSessionId,
                otelTraceId,
                spanCount = 0,
                errorCount = 0,
                avgResponseTime = null,
                totalRequests = 0
            } = telemetryData;

            const client = await this.pgPool.connect();
            
            try {
                const query = `
                    UPDATE session_tracking 
                    SET otel_session_id = COALESCE($2, otel_session_id),
                        otel_trace_id = COALESCE($3, otel_trace_id),
                        otel_span_count = $4,
                        otel_error_count = $5,
                        avg_response_time_ms = COALESCE($6, avg_response_time_ms),
                        total_requests = $7,
                        updated_at = NOW()
                    WHERE airis_session_id = $1
                    RETURNING airis_session_id, otel_session_id, otel_trace_id
                `;

                const values = [
                    airisSessionId, otelSessionId, otelTraceId,
                    spanCount, errorCount, avgResponseTime, totalRequests
                ];

                const result = await client.query(query, values);
                
                if (result.rows.length > 0) {
                    logger.info('세션 텔레메트리 정보 업데이트', {
                        sessionId: airisSessionId,
                        otelSessionId,
                        spanCount,
                        errorCount
                    });
                    return result.rows[0];
                } else {
                    logger.warn('업데이트할 세션을 찾을 수 없음', { sessionId: airisSessionId });
                    return null;
                }

            } finally {
                client.release();
            }

        } catch (error) {
            this.metrics.errors++;
            logger.error('세션 텔레메트리 업데이트 실패', {
                error: error.message,
                sessionId: airisSessionId
            });
            throw error;
        }
    }

    /**
     * 페이지 뷰 기록 추가
     */
    async addPageView(sessionId, pageData) {
        try {
            const {
                pageUrl,
                pageTitle = null,
                pageLoadTime = null,
                pageUnloadTime = null,
                domContentLoadedMs = null,
                firstContentfulPaintMs = null,
                largestContentfulPaintMs = null,
                otelPageSpanId = null,
                otelPageTraceId = null,
                clickCount = 0,
                scrollDepthPercentage = 0,
                formInteractions = 0,
                errorCount = 0
            } = pageData;

            const client = await this.pgPool.connect();
            
            try {
                const query = `
                    INSERT INTO session_page_views (
                        session_id, page_url, page_title, page_load_time, page_unload_time,
                        dom_content_loaded_ms, first_contentful_paint_ms, largest_contentful_paint_ms,
                        otel_page_span_id, otel_page_trace_id,
                        click_count, scroll_depth_percentage, form_interactions, error_count
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    RETURNING id, page_url, page_load_time
                `;

                const values = [
                    sessionId, pageUrl, pageTitle, pageLoadTime, pageUnloadTime,
                    domContentLoadedMs, firstContentfulPaintMs, largestContentfulPaintMs,
                    otelPageSpanId, otelPageTraceId,
                    clickCount, scrollDepthPercentage, formInteractions, errorCount
                ];

                const result = await client.query(query, values);
                const pageView = result.rows[0];

                // 세션의 페이지 뷰 카운트 업데이트
                await client.query(
                    'UPDATE session_tracking SET total_page_views = total_page_views + 1 WHERE airis_session_id = $1',
                    [sessionId]
                );

                logger.info('페이지 뷰 기록 추가', {
                    sessionId,
                    pageUrl,
                    pageViewId: pageView.id
                });

                return pageView;

            } finally {
                client.release();
            }

        } catch (error) {
            this.metrics.errors++;
            logger.error('페이지 뷰 기록 실패', {
                error: error.message,
                sessionId,
                pageUrl: pageData.pageUrl
            });
            throw error;
        }
    }

    /**
     * 세션-텔레메트리 이벤트 상관관계 분석 및 저장
     */
    async correlateSessionTelemetryEvents(sessionId, correlationData) {
        try {
            const {
                otelSpanId,
                otelTraceId,
                otelServiceName = null,
                otelOperationName = null,
                otelStartTime,
                otelEndTime,
                otelDurationUs,
                replayEventTimestamp,
                replayEventType,
                replayEventData = {},
                isError = false,
                errorMessage = null,
                httpStatusCode = null
            } = correlationData;

            // 시간 기반 상관관계 신뢰도 계산
            const timeDiff = Math.abs(new Date(replayEventTimestamp) - new Date(otelStartTime));
            const confidence = Math.max(0, 1 - (timeDiff / this.config.correlation.timeToleranceMs));
            
            if (confidence < this.config.correlation.confidenceThreshold) {
                logger.debug('상관관계 신뢰도가 임계치 미달', {
                    sessionId,
                    confidence,
                    threshold: this.config.correlation.confidenceThreshold
                });
                return null;
            }

            const client = await this.pgPool.connect();
            
            try {
                const query = `
                    INSERT INTO session_telemetry_correlation (
                        session_id, otel_span_id, otel_trace_id,
                        otel_service_name, otel_operation_name,
                        otel_start_time, otel_end_time, otel_duration_us,
                        replay_event_timestamp, replay_event_type, replay_event_data,
                        correlation_confidence, correlation_type,
                        is_error, error_message, http_status_code
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    RETURNING id, correlation_confidence
                `;

                const values = [
                    sessionId, otelSpanId, otelTraceId,
                    otelServiceName, otelOperationName,
                    otelStartTime, otelEndTime, otelDurationUs,
                    replayEventTimestamp, replayEventType, JSON.stringify(replayEventData),
                    confidence, 'inferred',
                    isError, errorMessage, httpStatusCode
                ];

                const result = await client.query(query, values);
                const correlation = result.rows[0];

                this.metrics.correlationsFound++;

                logger.info('세션-텔레메트리 상관관계 생성', {
                    sessionId,
                    correlationId: correlation.id,
                    confidence: correlation.correlation_confidence,
                    spanId: otelSpanId
                });

                return correlation;

            } finally {
                client.release();
            }

        } catch (error) {
            this.metrics.errors++;
            logger.error('세션-텔레메트리 상관관계 분석 실패', {
                error: error.message,
                sessionId
            });
            throw error;
        }
    }

    /**
     * AI 기반 세션 분석 인사이트 생성
     */
    async generateSessionInsight(sessionId, analysisData) {
        try {
            const {
                analysisType,
                insightTitle,
                insightDescription,
                insightSeverity = 'medium',
                insightCategory = 'performance',
                metricName = null,
                metricValue = null,
                metricUnit = null,
                baselineValue = null,
                recommendations = [],
                estimatedImpact = 'medium',
                relatedSpans = [],
                relatedEvents = {}
            } = analysisData;

            const deviationPercentage = baselineValue && metricValue ? 
                ((metricValue - baselineValue) / baselineValue) * 100 : null;

            const client = await this.pgPool.connect();
            
            try {
                const query = `
                    INSERT INTO session_analysis_insights (
                        session_id, analysis_type, insight_title, insight_description,
                        insight_severity, insight_category,
                        metric_name, metric_value, metric_unit, baseline_value, deviation_percentage,
                        recommendations, estimated_impact,
                        related_spans, related_events
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    RETURNING id, insight_title, insight_severity
                `;

                const values = [
                    sessionId, analysisType, insightTitle, insightDescription,
                    insightSeverity, insightCategory,
                    metricName, metricValue, metricUnit, baselineValue, deviationPercentage,
                    JSON.stringify(recommendations), estimatedImpact,
                    relatedSpans, JSON.stringify(relatedEvents)
                ];

                const result = await client.query(query, values);
                const insight = result.rows[0];

                this.metrics.insightsGenerated++;

                logger.info('세션 분석 인사이트 생성', {
                    sessionId,
                    insightId: insight.id,
                    title: insight.insight_title,
                    severity: insight.insight_severity
                });

                return insight;

            } finally {
                client.release();
            }

        } catch (error) {
            this.metrics.errors++;
            logger.error('세션 인사이트 생성 실패', {
                error: error.message,
                sessionId,
                analysisType: analysisData.analysisType
            });
            throw error;
        }
    }

    /**
     * 세션에 태그 추가
     */
    async addSessionTag(sessionId, tagKey, tagValue, tagSource = 'manual', confidenceScore = 1.0, createdBy = 'system') {
        try {
            const client = await this.pgPool.connect();
            
            try {
                const query = `
                    INSERT INTO session_tags (
                        session_id, tag_key, tag_value, tag_source, confidence_score, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (session_id, tag_key, tag_value) DO UPDATE SET
                        confidence_score = EXCLUDED.confidence_score,
                        created_by = EXCLUDED.created_by
                    RETURNING id, tag_key, tag_value
                `;

                const values = [sessionId, tagKey, tagValue, tagSource, confidenceScore, createdBy];
                const result = await client.query(query, values);
                const tag = result.rows[0];

                logger.debug('세션 태그 추가', {
                    sessionId,
                    tagId: tag.id,
                    key: tag.tag_key,
                    value: tag.tag_value
                });

                return tag;

            } finally {
                client.release();
            }

        } catch (error) {
            this.metrics.errors++;
            logger.error('세션 태그 추가 실패', {
                error: error.message,
                sessionId,
                tagKey,
                tagValue
            });
            throw error;
        }
    }

    /**
     * 통합 세션 요약 조회
     */
    async getSessionSummary(sessionId) {
        try {
            const client = await this.pgPool.connect();
            
            try {
                const query = `
                    SELECT * FROM session_summary 
                    WHERE airis_session_id = $1
                `;

                const result = await client.query(query, [sessionId]);
                
                if (result.rows.length > 0) {
                    const summary = result.rows[0];
                    
                    logger.debug('세션 요약 조회', {
                        sessionId,
                        totalPageViews: summary.total_page_views,
                        replayEventCount: summary.replay_event_count,
                        otelSpanCount: summary.otel_span_count
                    });

                    return summary;
                } else {
                    logger.warn('세션 요약을 찾을 수 없음', { sessionId });
                    return null;
                }

            } finally {
                client.release();
            }

        } catch (error) {
            this.metrics.errors++;
            logger.error('세션 요약 조회 실패', {
                error: error.message,
                sessionId
            });
            throw error;
        }
    }

    /**
     * 세션 완료 처리
     */
    async completeSession(sessionId, completionData = {}) {
        try {
            const {
                sessionEndTime = new Date(),
                sessionDurationMs = null,
                replayEventCount = 0,
                replayFileSize = 0,
                conversionEvents = [],
                businessValue = null,
                customerSatisfactionScore = null
            } = completionData;

            const client = await this.pgPool.connect();
            
            try {
                const query = `
                    UPDATE session_tracking 
                    SET session_end_time = $2,
                        session_duration_ms = COALESCE($3, EXTRACT(EPOCH FROM ($2 - session_start_time)) * 1000),
                        replay_event_count = $4,
                        replay_file_size = $5,
                        replay_status = 'completed',
                        conversion_events = $6,
                        business_value = $7,
                        customer_satisfaction_score = $8,
                        updated_at = NOW()
                    WHERE airis_session_id = $1
                    RETURNING airis_session_id, session_duration_ms, replay_status
                `;

                const values = [
                    sessionId, sessionEndTime, sessionDurationMs, replayEventCount, replayFileSize,
                    JSON.stringify(conversionEvents), businessValue, customerSatisfactionScore
                ];

                const result = await client.query(query, values);
                
                if (result.rows.length > 0) {
                    const completedSession = result.rows[0];

                    logger.info('세션 완료 처리', {
                        sessionId: completedSession.airis_session_id,
                        duration: completedSession.session_duration_ms,
                        status: completedSession.replay_status
                    });

                    return completedSession;
                } else {
                    logger.warn('완료 처리할 세션을 찾을 수 없음', { sessionId });
                    return null;
                }

            } finally {
                client.release();
            }

        } catch (error) {
            this.metrics.errors++;
            logger.error('세션 완료 처리 실패', {
                error: error.message,
                sessionId
            });
            throw error;
        }
    }

    /**
     * 서비스 메트릭 조회
     */
    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.startTime || 0,
            isInitialized: this.isInitialized
        };
    }

    /**
     * 리소스 정리
     */
    async cleanup() {
        try {
            logger.info('세션-텔레메트리 통합 서비스 종료 중...');
            
            await this.pgPool.end();
            
            if (this.clickhouseClient) {
                await this.clickhouseClient.close();
            }

            logger.info('세션-텔레메트리 통합 서비스 종료 완료');

        } catch (error) {
            logger.error('서비스 종료 중 오류', {
                error: error.message,
                service: 'session-telemetry-integration'
            });
        }
    }
}

module.exports = SessionTelemetryIntegration;