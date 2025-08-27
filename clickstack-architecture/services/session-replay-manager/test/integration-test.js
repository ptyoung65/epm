/**
 * AIRIS 세션 리플레이 - OpenTelemetry 통합 연계 시스템 통합 테스트
 * 전체 연계 시스템의 동작을 검증하는 통합 테스트 스위트
 */

const axios = require('axios');
const { Pool } = require('pg');

class SessionTelemetryIntegrationTest {
    constructor() {
        this.config = {
            sessionReplayApi: process.env.SESSION_API_URL || 'http://localhost:3004/api',
            otelCollectorUrl: process.env.OTEL_COLLECTOR_URL || 'http://localhost:4318',
            database: {
                host: process.env.POSTGRES_HOST || 'localhost',
                port: process.env.POSTGRES_PORT || 5432,
                database: process.env.POSTGRES_DB || 'airis_apm',
                user: process.env.POSTGRES_USER || 'postgres',
                password: process.env.POSTGRES_PASSWORD || 'postgres'
            }
        };

        this.pgPool = new Pool(this.config.database);
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: [],
            details: []
        };
    }

    /**
     * 전체 통합 테스트 실행
     */
    async runAllTests() {
        console.log('🧪 AIRIS 세션-텔레메트리 통합 테스트 시작');
        console.log('=' .repeat(60));

        try {
            // 1. 시스템 연결성 테스트
            await this.testSystemConnectivity();
            
            // 2. 데이터베이스 스키마 테스트
            await this.testDatabaseSchema();
            
            // 3. 세션 생성 및 관리 테스트
            await this.testSessionManagement();
            
            // 4. OpenTelemetry 연계 테스트
            await this.testOpenTelemetryIntegration();
            
            // 5. 상관관계 분석 테스트
            await this.testCorrelationAnalysis();
            
            // 6. AI 인사이트 생성 테스트
            await this.testInsightGeneration();
            
            // 7. 성능 및 확장성 테스트
            await this.testPerformanceScalability();
            
            // 8. 데이터 무결성 테스트
            await this.testDataIntegrity();

            this.printResults();

        } catch (error) {
            console.error('❌ 통합 테스트 실행 중 치명적 오류:', error.message);
            this.testResults.errors.push({
                test: 'System Error',
                error: error.message,
                stack: error.stack
            });
        } finally {
            await this.cleanup();
        }
    }

    /**
     * 1. 시스템 연결성 테스트
     */
    async testSystemConnectivity() {
        console.log('🔌 시스템 연결성 테스트');

        // PostgreSQL 연결 테스트
        await this.runTest('PostgreSQL 연결', async () => {
            const client = await this.pgPool.connect();
            const result = await client.query('SELECT NOW() as current_time');
            client.release();
            
            if (!result.rows[0].current_time) {
                throw new Error('PostgreSQL 응답 없음');
            }
        });

        // Session Replay API 연결 테스트
        await this.runTest('세션 리플레이 API 연결', async () => {
            const response = await axios.get(`${this.config.sessionReplayApi}/info`, {
                timeout: 10000
            });
            
            if (response.status !== 200) {
                throw new Error(`API 응답 상태: ${response.status}`);
            }
        });

        // Health Check 테스트
        await this.runTest('헬스 체크', async () => {
            const response = await axios.get(`${this.config.sessionReplayApi}/../health`, {
                timeout: 5000
            });
            
            if (!response.data || response.data.status !== 'healthy') {
                throw new Error('헬스 체크 실패');
            }
        });

        console.log('');
    }

    /**
     * 2. 데이터베이스 스키마 테스트
     */
    async testDatabaseSchema() {
        console.log('🗄️ 데이터베이스 스키마 테스트');

        const requiredTables = [
            'session_tracking',
            'session_page_views',
            'session_telemetry_correlation',
            'session_analysis_insights',
            'session_tags'
        ];

        for (const table of requiredTables) {
            await this.runTest(`테이블 존재 확인: ${table}`, async () => {
                const client = await this.pgPool.connect();
                const result = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = $1
                    )
                `, [table]);
                client.release();

                if (!result.rows[0].exists) {
                    throw new Error(`테이블 ${table}이 존재하지 않음`);
                }
            });
        }

        // 뷰 존재 확인
        await this.runTest('뷰 존재 확인: session_summary', async () => {
            const client = await this.pgPool.connect();
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.views 
                    WHERE table_name = 'session_summary'
                )
            `);
            client.release();

            if (!result.rows[0].exists) {
                throw new Error('session_summary 뷰가 존재하지 않음');
            }
        });

        console.log('');
    }

    /**
     * 3. 세션 생성 및 관리 테스트
     */
    async testSessionManagement() {
        console.log('📝 세션 생성 및 관리 테스트');

        let testSessionId = null;

        // 세션 생성 테스트
        await this.runTest('세션 생성', async () => {
            const sessionData = {
                userId: 'test-user-001',
                otelSessionId: 'test-otel-session-001',
                otelTraceId: 'test-trace-001',
                geoLocation: { country: 'KR', region: 'Seoul' }
            };

            const response = await axios.post(
                `${this.config.sessionReplayApi}/sessions`,
                sessionData,
                { timeout: 10000 }
            );

            if (!response.data.success) {
                throw new Error(response.data.message || '세션 생성 실패');
            }

            testSessionId = response.data.data.airis_session_id;
            if (!testSessionId) {
                throw new Error('세션 ID가 반환되지 않음');
            }
        });

        // 세션 조회 테스트
        await this.runTest('세션 조회', async () => {
            if (!testSessionId) throw new Error('테스트 세션 ID가 없음');

            const response = await axios.get(
                `${this.config.sessionReplayApi}/sessions/${testSessionId}`,
                { timeout: 10000 }
            );

            if (!response.data.success || !response.data.data) {
                throw new Error('세션 조회 실패');
            }

            const session = response.data.data;
            if (session.airis_session_id !== testSessionId) {
                throw new Error('잘못된 세션 데이터');
            }
        });

        // 페이지뷰 추가 테스트
        await this.runTest('페이지뷰 추가', async () => {
            if (!testSessionId) throw new Error('테스트 세션 ID가 없음');

            const pageViewData = {
                pageUrl: '/test-page',
                pageTitle: '테스트 페이지',
                domContentLoadedMs: 1250,
                firstContentfulPaintMs: 1800,
                clickCount: 5,
                scrollDepthPercentage: 75
            };

            const response = await axios.post(
                `${this.config.sessionReplayApi}/sessions/${testSessionId}/pageviews`,
                pageViewData,
                { timeout: 10000 }
            );

            if (!response.data.success) {
                throw new Error(response.data.message || '페이지뷰 추가 실패');
            }
        });

        // 세션 완료 테스트
        await this.runTest('세션 완료', async () => {
            if (!testSessionId) throw new Error('테스트 세션 ID가 없음');

            const completionData = {
                replayEventCount: 150,
                conversionEvents: [{ type: 'form_submit', value: 1 }],
                customerSatisfactionScore: 4
            };

            const response = await axios.post(
                `${this.config.sessionReplayApi}/sessions/${testSessionId}/complete`,
                completionData,
                { timeout: 10000 }
            );

            if (!response.data.success) {
                throw new Error(response.data.message || '세션 완료 실패');
            }
        });

        console.log('');
    }

    /**
     * 4. OpenTelemetry 연계 테스트
     */
    async testOpenTelemetryIntegration() {
        console.log('📡 OpenTelemetry 연계 테스트');

        let testSessionId = 'test-session-otel-001';

        // 테스트 세션 생성
        await this.runTest('OpenTelemetry 세션 생성', async () => {
            const sessionData = {
                sessionId: testSessionId,
                otelSessionId: 'otel-session-integration-test',
                otelTraceId: 'trace-integration-test-001',
                userId: 'otel-test-user'
            };

            const response = await axios.post(
                `${this.config.sessionReplayApi}/sessions`,
                sessionData,
                { timeout: 10000 }
            );

            if (!response.data.success) {
                throw new Error('OpenTelemetry 세션 생성 실패');
            }

            testSessionId = response.data.data.airis_session_id;
        });

        // OpenTelemetry 정보 업데이트 테스트
        await this.runTest('OpenTelemetry 정보 업데이트', async () => {
            const telemetryData = {
                otelSessionId: 'otel-session-updated',
                otelTraceId: 'trace-updated-001',
                spanCount: 25,
                errorCount: 2,
                avgResponseTime: 185.5,
                totalRequests: 30
            };

            const response = await axios.put(
                `${this.config.sessionReplayApi}/sessions/${testSessionId}/telemetry`,
                telemetryData,
                { timeout: 10000 }
            );

            if (!response.data.success) {
                throw new Error('OpenTelemetry 정보 업데이트 실패');
            }
        });

        // 상관관계 생성 테스트
        await this.runTest('상관관계 생성', async () => {
            const correlationData = {
                otelSpanId: 'span-test-001',
                otelTraceId: 'trace-integration-test-001',
                otelServiceName: 'test-service',
                otelOperationName: 'test-operation',
                otelStartTime: new Date().toISOString(),
                otelEndTime: new Date(Date.now() + 5000).toISOString(),
                otelDurationUs: 5000000,
                replayEventTimestamp: new Date().toISOString(),
                replayEventType: 'click',
                replayEventData: { x: 100, y: 200, element: 'button' },
                isError: false,
                httpStatusCode: 200
            };

            const response = await axios.post(
                `${this.config.sessionReplayApi}/sessions/${testSessionId}/correlations`,
                correlationData,
                { timeout: 10000 }
            );

            if (!response.data.success) {
                throw new Error('상관관계 생성 실패');
            }
        });

        console.log('');
    }

    /**
     * 5. 상관관계 분석 테스트
     */
    async testCorrelationAnalysis() {
        console.log('🔗 상관관계 분석 테스트');

        // 데이터베이스에서 상관관계 데이터 조회
        await this.runTest('상관관계 데이터 조회', async () => {
            const client = await this.pgPool.connect();
            const result = await client.query(`
                SELECT COUNT(*) as count FROM session_telemetry_correlation 
                WHERE correlation_confidence > 0.5
            `);
            client.release();

            const count = parseInt(result.rows[0].count);
            if (count < 1) {
                throw new Error('상관관계 데이터가 충분하지 않음');
            }
        });

        // 높은 신뢰도 상관관계 분석
        await this.runTest('높은 신뢰도 상관관계 분석', async () => {
            const client = await this.pgPool.connect();
            const result = await client.query(`
                SELECT 
                    session_id,
                    AVG(correlation_confidence) as avg_confidence,
                    COUNT(*) as correlation_count
                FROM session_telemetry_correlation 
                WHERE correlation_confidence > 0.8
                GROUP BY session_id
                HAVING COUNT(*) > 0
            `);
            client.release();

            if (result.rows.length === 0) {
                throw new Error('높은 신뢰도 상관관계가 없음');
            }

            // 평균 신뢰도가 0.8 이상인지 확인
            const avgConfidence = parseFloat(result.rows[0].avg_confidence);
            if (avgConfidence < 0.8) {
                throw new Error(`평균 신뢰도가 낮음: ${avgConfidence}`);
            }
        });

        // 시간 기반 상관관계 검증
        await this.runTest('시간 기반 상관관계 검증', async () => {
            const client = await this.pgPool.connect();
            const result = await client.query(`
                SELECT 
                    otel_start_time,
                    replay_event_timestamp,
                    EXTRACT(EPOCH FROM (replay_event_timestamp - otel_start_time)) * 1000 as time_diff_ms
                FROM session_telemetry_correlation 
                WHERE correlation_confidence > 0.7
                ORDER BY time_diff_ms
                LIMIT 10
            `);
            client.release();

            // 시간 차이가 허용 범위(5초) 내인지 확인
            for (const row of result.rows) {
                const timeDiff = Math.abs(parseFloat(row.time_diff_ms));
                if (timeDiff > 5000) {
                    throw new Error(`시간 차이가 허용 범위 초과: ${timeDiff}ms`);
                }
            }
        });

        console.log('');
    }

    /**
     * 6. AI 인사이트 생성 테스트
     */
    async testInsightGeneration() {
        console.log('🤖 AI 인사이트 생성 테스트');

        let testSessionId = 'test-session-insight-001';

        // 테스트 세션 생성
        await this.runTest('인사이트 테스트 세션 생성', async () => {
            const sessionData = {
                sessionId: testSessionId,
                userId: 'insight-test-user'
            };

            const response = await axios.post(
                `${this.config.sessionReplayApi}/sessions`,
                sessionData
            );

            if (response.data.success) {
                testSessionId = response.data.data.airis_session_id;
            }
        });

        // 성능 인사이트 생성
        await this.runTest('성능 인사이트 생성', async () => {
            const insightData = {
                analysisType: 'performance',
                insightTitle: '높은 페이지 로딩 시간 감지',
                insightDescription: '페이지 로딩 시간이 평균보다 3초 높습니다.',
                insightSeverity: 'high',
                insightCategory: 'performance',
                metricName: 'page_load_time',
                metricValue: 5500,
                metricUnit: 'ms',
                baselineValue: 2500,
                recommendations: [
                    '이미지 최적화 검토',
                    'JavaScript 번들 크기 축소',
                    'CDN 사용 고려'
                ],
                estimatedImpact: 'high'
            };

            const response = await axios.post(
                `${this.config.sessionReplayApi}/sessions/${testSessionId}/insights`,
                insightData
            );

            if (!response.data.success) {
                throw new Error('성능 인사이트 생성 실패');
            }
        });

        // 사용자 행동 인사이트 생성
        await this.runTest('사용자 행동 인사이트 생성', async () => {
            const insightData = {
                analysisType: 'user_behavior',
                insightTitle: '사용자 이탈 패턴 발견',
                insightDescription: '특정 페이지에서 사용자 이탈률이 높습니다.',
                insightSeverity: 'medium',
                insightCategory: 'ux',
                metricName: 'bounce_rate',
                metricValue: 75,
                metricUnit: 'percent',
                baselineValue: 45,
                recommendations: [
                    'UX/UI 개선',
                    '콘텐츠 관련성 검토',
                    '페이지 성능 최적화'
                ],
                estimatedImpact: 'medium'
            };

            const response = await axios.post(
                `${this.config.sessionReplayApi}/sessions/${testSessionId}/insights`,
                insightData
            );

            if (!response.data.success) {
                throw new Error('사용자 행동 인사이트 생성 실패');
            }
        });

        // 생성된 인사이트 검증
        await this.runTest('인사이트 데이터 검증', async () => {
            const client = await this.pgPool.connect();
            const result = await client.query(`
                SELECT COUNT(*) as count 
                FROM session_analysis_insights 
                WHERE session_id = $1
            `, [testSessionId]);
            client.release();

            const count = parseInt(result.rows[0].count);
            if (count < 2) {
                throw new Error(`인사이트가 충분히 생성되지 않음: ${count}개`);
            }
        });

        console.log('');
    }

    /**
     * 7. 성능 및 확장성 테스트
     */
    async testPerformanceScalability() {
        console.log('⚡ 성능 및 확장성 테스트');

        // 동시 세션 생성 테스트
        await this.runTest('동시 세션 생성 성능', async () => {
            const sessionCount = 50;
            const promises = [];

            const startTime = Date.now();

            for (let i = 0; i < sessionCount; i++) {
                const sessionData = {
                    userId: `perf-test-user-${i}`,
                    otelSessionId: `perf-test-otel-${i}`
                };

                promises.push(
                    axios.post(
                        `${this.config.sessionReplayApi}/sessions`,
                        sessionData,
                        { timeout: 15000 }
                    ).catch(error => ({ error: error.message }))
                );
            }

            const results = await Promise.all(promises);
            const endTime = Date.now();

            const successCount = results.filter(r => !r.error && r.data?.success).length;
            const duration = endTime - startTime;

            console.log(`    📊 ${sessionCount}개 세션 중 ${successCount}개 성공 (${duration}ms 소요)`);

            if (successCount < sessionCount * 0.8) {
                throw new Error(`성공률이 너무 낮음: ${successCount}/${sessionCount}`);
            }

            if (duration > 30000) {
                throw new Error(`응답 시간이 너무 길음: ${duration}ms`);
            }
        });

        // 대용량 이벤트 처리 테스트
        await this.runTest('대용량 이벤트 처리', async () => {
            const testSessionId = 'perf-test-session-bulk';
            
            // 테스트 세션 생성
            const sessionResponse = await axios.post(
                `${this.config.sessionReplayApi}/sessions`,
                { sessionId: testSessionId }
            );

            const sessionId = sessionResponse.data.data.airis_session_id;

            // 대용량 이벤트 배치 생성
            const events = [];
            for (let i = 0; i < 100; i++) {
                events.push({
                    type: 'correlation',
                    sessionId: sessionId,
                    data: {
                        otelSpanId: `bulk-span-${i}`,
                        otelTraceId: `bulk-trace-${i}`,
                        otelServiceName: 'bulk-test-service',
                        otelOperationName: `bulk-operation-${i}`,
                        otelStartTime: new Date().toISOString(),
                        otelEndTime: new Date(Date.now() + 1000).toISOString(),
                        otelDurationUs: 1000000,
                        replayEventTimestamp: new Date().toISOString(),
                        replayEventType: 'bulk_event',
                        replayEventData: { index: i, data: 'test' }
                    }
                });
            }

            const startTime = Date.now();
            
            const response = await axios.post(
                `${this.config.sessionReplayApi}/sessions/events/batch`,
                { events },
                { timeout: 30000 }
            );

            const endTime = Date.now();
            const duration = endTime - startTime;

            if (!response.data.success) {
                throw new Error('대용량 이벤트 처리 실패');
            }

            console.log(`    📊 100개 이벤트 배치 처리: ${duration}ms 소요`);

            if (duration > 15000) {
                throw new Error(`배치 처리 시간이 너무 길음: ${duration}ms`);
            }
        });

        console.log('');
    }

    /**
     * 8. 데이터 무결성 테스트
     */
    async testDataIntegrity() {
        console.log('🔒 데이터 무결성 테스트');

        // 외래 키 제약 조건 테스트
        await this.runTest('외래 키 제약 조건', async () => {
            const client = await this.pgPool.connect();
            
            // 존재하지 않는 세션에 페이지뷰 추가 시도
            try {
                await client.query(`
                    INSERT INTO session_page_views (session_id, page_url)
                    VALUES ('non-existent-session', '/test')
                `);
                throw new Error('외래 키 제약 조건이 작동하지 않음');
            } catch (error) {
                if (!error.message.includes('violates foreign key constraint')) {
                    throw new Error('예상과 다른 오류: ' + error.message);
                }
                // 외래 키 제약 조건이 올바르게 작동함
            } finally {
                client.release();
            }
        });

        // 트리거 동작 테스트
        await this.runTest('타임스탬프 자동 갱신 트리거', async () => {
            const client = await this.pgPool.connect();
            
            try {
                // 테스트 세션 생성
                const insertResult = await client.query(`
                    INSERT INTO session_tracking (airis_session_id)
                    VALUES ('trigger-test-session')
                    RETURNING created_at, updated_at
                `);
                
                const originalUpdatedAt = insertResult.rows[0].updated_at;
                
                // 1초 대기 후 업데이트
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                await client.query(`
                    UPDATE session_tracking 
                    SET replay_status = 'completed'
                    WHERE airis_session_id = 'trigger-test-session'
                `);
                
                // updated_at이 자동으로 갱신되었는지 확인
                const updateResult = await client.query(`
                    SELECT updated_at FROM session_tracking
                    WHERE airis_session_id = 'trigger-test-session'
                `);
                
                const newUpdatedAt = updateResult.rows[0].updated_at;
                
                if (newUpdatedAt <= originalUpdatedAt) {
                    throw new Error('updated_at 트리거가 작동하지 않음');
                }
                
                // 테스트 데이터 정리
                await client.query(`
                    DELETE FROM session_tracking 
                    WHERE airis_session_id = 'trigger-test-session'
                `);
                
            } finally {
                client.release();
            }
        });

        // JSON 데이터 유효성 검사
        await this.runTest('JSON 데이터 유효성', async () => {
            const client = await this.pgPool.connect();
            
            try {
                // 올바른 JSON 데이터 삽입
                await client.query(`
                    INSERT INTO session_tracking (airis_session_id, geo_location)
                    VALUES ('json-test-session', '{"country": "KR", "city": "Seoul"}')
                `);
                
                // JSON 데이터 조회 및 검증
                const result = await client.query(`
                    SELECT geo_location FROM session_tracking
                    WHERE airis_session_id = 'json-test-session'
                `);
                
                const geoLocation = result.rows[0].geo_location;
                if (!geoLocation || !geoLocation.country) {
                    throw new Error('JSON 데이터가 올바르게 저장되지 않음');
                }
                
                // 테스트 데이터 정리
                await client.query(`
                    DELETE FROM session_tracking 
                    WHERE airis_session_id = 'json-test-session'
                `);
                
            } finally {
                client.release();
            }
        });

        console.log('');
    }

    /**
     * 개별 테스트 실행 헬퍼
     */
    async runTest(testName, testFunction) {
        try {
            const startTime = Date.now();
            await testFunction();
            const duration = Date.now() - startTime;
            
            console.log(`  ✅ ${testName} (${duration}ms)`);
            this.testResults.passed++;
            this.testResults.details.push({
                test: testName,
                status: 'PASSED',
                duration: duration
            });
            
        } catch (error) {
            console.log(`  ❌ ${testName}: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push({
                test: testName,
                error: error.message,
                stack: error.stack
            });
            this.testResults.details.push({
                test: testName,
                status: 'FAILED',
                error: error.message
            });
        }
    }

    /**
     * 테스트 결과 출력
     */
    printResults() {
        console.log('=' .repeat(60));
        console.log('📊 테스트 결과 요약');
        console.log('=' .repeat(60));
        
        const total = this.testResults.passed + this.testResults.failed;
        const successRate = total > 0 ? Math.round((this.testResults.passed / total) * 100) : 0;
        
        console.log(`총 테스트: ${total}`);
        console.log(`통과: ${this.testResults.passed} ✅`);
        console.log(`실패: ${this.testResults.failed} ❌`);
        console.log(`성공률: ${successRate}%`);
        console.log('');

        if (this.testResults.errors.length > 0) {
            console.log('🚨 실패한 테스트 상세:');
            this.testResults.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.test}`);
                console.log(`   오류: ${error.error}`);
                if (process.env.DEBUG === 'true' && error.stack) {
                    console.log(`   스택: ${error.stack}`);
                }
                console.log('');
            });
        }

        // 테스트 리포트 파일 생성
        this.generateTestReport();
    }

    /**
     * 테스트 리포트 파일 생성
     */
    generateTestReport() {
        const fs = require('fs');
        const path = require('path');

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.testResults.passed + this.testResults.failed,
                passed: this.testResults.passed,
                failed: this.testResults.failed,
                successRate: Math.round((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100)
            },
            details: this.testResults.details,
            errors: this.testResults.errors,
            environment: {
                sessionReplayApi: this.config.sessionReplayApi,
                database: {
                    host: this.config.database.host,
                    port: this.config.database.port,
                    database: this.config.database.database
                }
            }
        };

        const reportPath = path.join(__dirname, `test-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📄 테스트 리포트가 저장되었습니다: ${reportPath}`);
    }

    /**
     * 리소스 정리
     */
    async cleanup() {
        try {
            console.log('🧹 테스트 리소스 정리 중...');
            
            // 테스트 데이터 정리
            const client = await this.pgPool.connect();
            await client.query(`
                DELETE FROM session_tracking 
                WHERE airis_session_id LIKE 'test-%' 
                   OR airis_session_id LIKE 'perf-test-%'
                   OR airis_session_id LIKE 'trigger-test-%'
                   OR airis_session_id LIKE 'json-test-%'
            `);
            client.release();
            
            // 연결 종료
            await this.pgPool.end();
            
            console.log('✅ 리소스 정리 완료');
            
        } catch (error) {
            console.error('❌ 리소스 정리 중 오류:', error.message);
        }
    }
}

// 테스트 실행
if (require.main === module) {
    const test = new SessionTelemetryIntegrationTest();
    test.runAllTests().then(() => {
        process.exit(test.testResults.failed > 0 ? 1 : 0);
    }).catch(error => {
        console.error('테스트 실행 실패:', error);
        process.exit(1);
    });
}

module.exports = SessionTelemetryIntegrationTest;