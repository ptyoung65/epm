const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class SecurityAuditService {
    constructor() {
        this.auditLogs = new Map();
        this.securityEvents = new Map();
        this.loginAttempts = new Map();
        this.suspiciousActivities = new Map();
        this.logFile = process.env.AUDIT_LOG_FILE || path.join(process.cwd(), 'logs', 'security-audit.log');
        
        this.eventTypes = {
            // 인증 관련
            LOGIN_SUCCESS: 'login_success',
            LOGIN_FAILED: 'login_failed',
            LOGOUT: 'logout',
            TOKEN_ISSUED: 'token_issued',
            TOKEN_RENEWED: 'token_renewed',
            TOKEN_REVOKED: 'token_revoked',
            PASSWORD_CHANGED: 'password_changed',
            PASSWORD_RESET: 'password_reset',
            
            // 권한 관련
            PERMISSION_GRANTED: 'permission_granted',
            PERMISSION_DENIED: 'permission_denied',
            ROLE_ASSIGNED: 'role_assigned',
            ROLE_REMOVED: 'role_removed',
            PRIVILEGE_ESCALATION: 'privilege_escalation',
            
            // 데이터 접근
            DATA_ACCESS: 'data_access',
            DATA_EXPORT: 'data_export',
            DATA_MODIFICATION: 'data_modification',
            DATA_DELETION: 'data_deletion',
            SENSITIVE_DATA_ACCESS: 'sensitive_data_access',
            
            // 시스템 관리
            ADMIN_LOGIN: 'admin_login',
            SYSTEM_CONFIG_CHANGE: 'system_config_change',
            USER_CREATED: 'user_created',
            USER_DELETED: 'user_deleted',
            BACKUP_CREATED: 'backup_created',
            
            // 보안 위협
            BRUTE_FORCE_ATTEMPT: 'brute_force_attempt',
            SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
            XSS_ATTEMPT: 'xss_attempt',
            SUSPICIOUS_ACTIVITY: 'suspicious_activity',
            RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
            UNAUTHORIZED_ACCESS: 'unauthorized_access',
            
            // SSO 관련
            SSO_LOGIN: 'sso_login',
            SSO_FAILED: 'sso_failed',
            SSO_LOGOUT: 'sso_logout'
        };

        this.severityLevels = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        };

        this.initializeLogFile();
    }

    // 로그 파일 초기화
    async initializeLogFile() {
        try {
            const logDir = path.dirname(this.logFile);
            await fs.mkdir(logDir, { recursive: true });
            
            // 로그 파일이 없으면 생성
            try {
                await fs.access(this.logFile);
            } catch (error) {
                await fs.writeFile(this.logFile, '');
            }
        } catch (error) {
            console.error('Failed to initialize audit log file:', error);
        }
    }

    // 보안 이벤트 로깅
    async logSecurityEvent({
        type,
        severity = this.severityLevels.LOW,
        userId = null,
        sessionId = null,
        ipAddress = null,
        userAgent = null,
        resource = null,
        action = null,
        details = {},
        success = true,
        error = null
    }) {
        const eventId = crypto.randomUUID();
        const timestamp = new Date();

        const auditEvent = {
            eventId,
            type,
            severity,
            timestamp,
            userId,
            sessionId,
            ipAddress,
            userAgent,
            resource,
            action,
            details,
            success,
            error: error ? error.message : null,
            
            // 추가 메타데이터
            hostname: require('os').hostname(),
            pid: process.pid,
            memoryUsage: process.memoryUsage(),
            timestamp_unix: timestamp.getTime()
        };

        // 메모리에 저장
        this.auditLogs.set(eventId, auditEvent);

        // 파일에 로깅
        await this.writeToLogFile(auditEvent);

        // 심각도에 따른 추가 처리
        if (severity === this.severityLevels.HIGH || severity === this.severityLevels.CRITICAL) {
            this.handleHighSeverityEvent(auditEvent);
        }

        // 의심스러운 활동 탐지
        this.detectSuspiciousActivity(auditEvent);

        return eventId;
    }

    // 파일에 로그 기록
    async writeToLogFile(event) {
        try {
            const logLine = JSON.stringify({
                timestamp: event.timestamp.toISOString(),
                eventId: event.eventId,
                type: event.type,
                severity: event.severity,
                userId: event.userId,
                ipAddress: event.ipAddress,
                resource: event.resource,
                action: event.action,
                success: event.success,
                details: event.details,
                error: event.error
            }) + '\n';

            await fs.appendFile(this.logFile, logLine);
        } catch (error) {
            console.error('Failed to write to audit log file:', error);
        }
    }

    // 로그인 시도 추적
    trackLoginAttempt(ipAddress, userId, success) {
        const key = `${ipAddress}_${userId || 'unknown'}`;
        const now = new Date();
        
        if (!this.loginAttempts.has(key)) {
            this.loginAttempts.set(key, []);
        }

        const attempts = this.loginAttempts.get(key);
        attempts.push({ timestamp: now, success });

        // 5분 이내의 시도만 유지
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const recentAttempts = attempts.filter(attempt => attempt.timestamp > fiveMinutesAgo);
        this.loginAttempts.set(key, recentAttempts);

        // 브루트 포스 공격 탐지
        const failedAttempts = recentAttempts.filter(attempt => !attempt.success);
        if (failedAttempts.length >= 5) {
            this.logSecurityEvent({
                type: this.eventTypes.BRUTE_FORCE_ATTEMPT,
                severity: this.severityLevels.HIGH,
                userId,
                ipAddress,
                details: {
                    failedAttempts: failedAttempts.length,
                    timeWindow: '5 minutes'
                }
            });
        }

        return recentAttempts.length;
    }

    // 의심스러운 활동 탐지
    detectSuspiciousActivity(event) {
        const patterns = [
            this.detectAbnormalAccess.bind(this),
            this.detectPrivilegeEscalation.bind(this),
            this.detectDataExfiltration.bind(this),
            this.detectOffHoursAccess.bind(this)
        ];

        patterns.forEach(pattern => {
            try {
                pattern(event);
            } catch (error) {
                console.error('Error in suspicious activity detection:', error);
            }
        });
    }

    // 비정상적 접근 탐지
    detectAbnormalAccess(event) {
        if (!event.userId || !event.ipAddress) return;

        const userKey = event.userId;
        const now = new Date();
        const oneHour = 60 * 60 * 1000;

        // 사용자의 최근 활동 조회
        const userEvents = Array.from(this.auditLogs.values())
            .filter(log => log.userId === event.userId && now - log.timestamp < oneHour)
            .sort((a, b) => b.timestamp - a.timestamp);

        if (userEvents.length < 2) return;

        // IP 주소 변경 감지
        const uniqueIPs = new Set(userEvents.map(e => e.ipAddress));
        if (uniqueIPs.size > 3) {
            this.logSecurityEvent({
                type: this.eventTypes.SUSPICIOUS_ACTIVITY,
                severity: this.severityLevels.MEDIUM,
                userId: event.userId,
                ipAddress: event.ipAddress,
                details: {
                    reason: 'Multiple IP addresses in short time',
                    uniqueIPs: Array.from(uniqueIPs),
                    timeWindow: '1 hour'
                }
            });
        }

        // 지역 기반 이상 탐지 (간단한 예제)
        const previousIP = userEvents[1]?.ipAddress;
        if (previousIP && this.detectGeographicalAnomaly(previousIP, event.ipAddress)) {
            this.logSecurityEvent({
                type: this.eventTypes.SUSPICIOUS_ACTIVITY,
                severity: this.severityLevels.HIGH,
                userId: event.userId,
                ipAddress: event.ipAddress,
                details: {
                    reason: 'Geographical location anomaly',
                    previousIP,
                    currentIP: event.ipAddress
                }
            });
        }
    }

    // 권한 상승 탐지
    detectPrivilegeEscalation(event) {
        if (event.type === this.eventTypes.ROLE_ASSIGNED || 
            event.type === this.eventTypes.PERMISSION_GRANTED) {
            
            // 관리자 권한 부여 감지
            if (event.details.role === 'admin' || 
                event.details.permission?.includes('admin')) {
                
                this.logSecurityEvent({
                    type: this.eventTypes.PRIVILEGE_ESCALATION,
                    severity: this.severityLevels.HIGH,
                    userId: event.userId,
                    ipAddress: event.ipAddress,
                    details: {
                        targetUser: event.details.targetUserId,
                        newRole: event.details.role,
                        newPermissions: event.details.permission
                    }
                });
            }
        }
    }

    // 데이터 유출 탐지
    detectDataExfiltration(event) {
        if (event.type === this.eventTypes.DATA_EXPORT) {
            const userId = event.userId;
            const now = new Date();
            const oneHour = 60 * 60 * 1000;

            // 동일 사용자의 최근 내보내기 활동 조회
            const exportEvents = Array.from(this.auditLogs.values())
                .filter(log => 
                    log.userId === userId && 
                    log.type === this.eventTypes.DATA_EXPORT &&
                    now - log.timestamp < oneHour
                );

            // 대량 데이터 내보내기 감지
            if (exportEvents.length > 5) {
                this.logSecurityEvent({
                    type: this.eventTypes.SUSPICIOUS_ACTIVITY,
                    severity: this.severityLevels.HIGH,
                    userId,
                    ipAddress: event.ipAddress,
                    details: {
                        reason: 'Excessive data export activity',
                        exportCount: exportEvents.length,
                        timeWindow: '1 hour'
                    }
                });
            }
        }
    }

    // 근무 시간 외 접근 탐지
    detectOffHoursAccess(event) {
        if (event.type === this.eventTypes.LOGIN_SUCCESS) {
            const hour = event.timestamp.getHours();
            const day = event.timestamp.getDay();

            // 평일 18시-9시, 주말 전체를 근무 시간 외로 간주
            const isOffHours = (day === 0 || day === 6) || (hour < 9 || hour >= 18);

            if (isOffHours) {
                this.logSecurityEvent({
                    type: this.eventTypes.SUSPICIOUS_ACTIVITY,
                    severity: this.severityLevels.MEDIUM,
                    userId: event.userId,
                    ipAddress: event.ipAddress,
                    details: {
                        reason: 'Off-hours access',
                        accessTime: event.timestamp.toISOString(),
                        dayOfWeek: day,
                        hour: hour
                    }
                });
            }
        }
    }

    // 지역적 이상 탐지 (간단한 예제)
    detectGeographicalAnomaly(previousIP, currentIP) {
        // 실제 구현에서는 GeoIP 데이터베이스 사용
        // 여기서는 IP 주소 대역이 크게 다른 경우만 체크
        const prevParts = previousIP.split('.');
        const currParts = currentIP.split('.');
        
        // 첫 번째 옥텟이 다르면 다른 지역으로 간주 (매우 단순한 예제)
        return prevParts[0] !== currParts[0];
    }

    // 고위험 이벤트 처리
    async handleHighSeverityEvent(event) {
        // 실시간 알림 발송 (이메일, Slack, 웹훅 등)
        console.warn(`HIGH SEVERITY SECURITY EVENT: ${event.type}`, {
            eventId: event.eventId,
            userId: event.userId,
            ipAddress: event.ipAddress,
            details: event.details
        });

        // 외부 SIEM 시스템으로 전송
        await this.sendToSIEM(event);

        // 자동 대응 조치 (필요한 경우)
        await this.autoResponseAction(event);
    }

    // SIEM 시스템으로 이벤트 전송
    async sendToSIEM(event) {
        try {
            // 실제 구현에서는 SIEM API 호출
            console.log('Sending to SIEM:', event.eventId);
        } catch (error) {
            console.error('Failed to send event to SIEM:', error);
        }
    }

    // 자동 대응 조치
    async autoResponseAction(event) {
        switch (event.type) {
            case this.eventTypes.BRUTE_FORCE_ATTEMPT:
                // IP 주소 일시적 차단
                await this.blockIP(event.ipAddress, 15 * 60 * 1000); // 15분
                break;

            case this.eventTypes.PRIVILEGE_ESCALATION:
                // 관리자에게 즉시 알림
                await this.notifyAdministrators(event);
                break;

            case this.eventTypes.SQL_INJECTION_ATTEMPT:
                // 요청 차단 및 세션 무효화
                if (event.sessionId) {
                    await this.invalidateSession(event.sessionId);
                }
                break;
        }
    }

    // IP 주소 차단 (간단한 예제)
    async blockIP(ipAddress, duration) {
        console.log(`Blocking IP ${ipAddress} for ${duration}ms`);
        // 실제 구현에서는 방화벽 규칙 추가
    }

    // 관리자 알림
    async notifyAdministrators(event) {
        console.log('Notifying administrators:', event.eventId);
        // 실제 구현에서는 이메일/SMS/Slack 알림 발송
    }

    // 세션 무효화
    async invalidateSession(sessionId) {
        console.log('Invalidating session:', sessionId);
        // 실제 구현에서는 세션 서비스 호출
    }

    // 보안 보고서 생성
    generateSecurityReport(timeRange = { days: 7 }) {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - timeRange.days * 24 * 60 * 60 * 1000);

        const events = Array.from(this.auditLogs.values())
            .filter(event => event.timestamp >= startDate && event.timestamp <= endDate);

        const report = {
            timeRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            },
            totalEvents: events.length,
            eventsBySeverity: {},
            eventsByType: {},
            topUsers: {},
            topIPs: {},
            failedLogins: 0,
            successfulLogins: 0,
            suspiciousActivities: 0,
            dataExports: 0,
            adminActivities: 0
        };

        // 통계 계산
        events.forEach(event => {
            // 심각도별 통계
            report.eventsBySeverity[event.severity] = (report.eventsBySeverity[event.severity] || 0) + 1;

            // 이벤트 타입별 통계
            report.eventsByType[event.type] = (report.eventsByType[event.type] || 0) + 1;

            // 사용자별 활동
            if (event.userId) {
                report.topUsers[event.userId] = (report.topUsers[event.userId] || 0) + 1;
            }

            // IP별 활동
            if (event.ipAddress) {
                report.topIPs[event.ipAddress] = (report.topIPs[event.ipAddress] || 0) + 1;
            }

            // 특정 이벤트 카운트
            switch (event.type) {
                case this.eventTypes.LOGIN_FAILED:
                    report.failedLogins++;
                    break;
                case this.eventTypes.LOGIN_SUCCESS:
                    report.successfulLogins++;
                    break;
                case this.eventTypes.SUSPICIOUS_ACTIVITY:
                    report.suspiciousActivities++;
                    break;
                case this.eventTypes.DATA_EXPORT:
                    report.dataExports++;
                    break;
                case this.eventTypes.ADMIN_LOGIN:
                case this.eventTypes.SYSTEM_CONFIG_CHANGE:
                    report.adminActivities++;
                    break;
            }
        });

        // 상위 항목만 유지
        report.topUsers = this.getTopItems(report.topUsers, 10);
        report.topIPs = this.getTopItems(report.topIPs, 10);

        return report;
    }

    // 상위 N개 항목 반환
    getTopItems(items, count) {
        return Object.entries(items)
            .sort(([,a], [,b]) => b - a)
            .slice(0, count)
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});
    }

    // 특정 이벤트 검색
    searchEvents(criteria) {
        let events = Array.from(this.auditLogs.values());

        if (criteria.userId) {
            events = events.filter(event => event.userId === criteria.userId);
        }

        if (criteria.type) {
            events = events.filter(event => event.type === criteria.type);
        }

        if (criteria.severity) {
            events = events.filter(event => event.severity === criteria.severity);
        }

        if (criteria.ipAddress) {
            events = events.filter(event => event.ipAddress === criteria.ipAddress);
        }

        if (criteria.startDate) {
            events = events.filter(event => event.timestamp >= criteria.startDate);
        }

        if (criteria.endDate) {
            events = events.filter(event => event.timestamp <= criteria.endDate);
        }

        return events.sort((a, b) => b.timestamp - a.timestamp);
    }

    // 규정 준수 보고서
    generateComplianceReport() {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const events = this.searchEvents({ startDate: lastMonth });

        return {
            reportDate: new Date().toISOString(),
            period: 'Last 30 days',
            totalAuditEvents: events.length,
            dataAccess: events.filter(e => e.type === this.eventTypes.DATA_ACCESS).length,
            dataModification: events.filter(e => e.type === this.eventTypes.DATA_MODIFICATION).length,
            adminAccess: events.filter(e => e.type === this.eventTypes.ADMIN_LOGIN).length,
            failedAuthentications: events.filter(e => e.type === this.eventTypes.LOGIN_FAILED).length,
            privilegeChanges: events.filter(e => 
                e.type === this.eventTypes.ROLE_ASSIGNED || 
                e.type === this.eventTypes.ROLE_REMOVED
            ).length,
            securityIncidents: events.filter(e => 
                e.severity === this.severityLevels.HIGH || 
                e.severity === this.severityLevels.CRITICAL
            ).length
        };
    }

    // 메모리 정리 (오래된 로그)
    cleanupOldLogs(retentionDays = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        let cleanedCount = 0;
        for (const [eventId, event] of this.auditLogs.entries()) {
            if (event.timestamp < cutoffDate) {
                this.auditLogs.delete(eventId);
                cleanedCount++;
            }
        }

        console.log(`Cleaned up ${cleanedCount} old audit logs`);
        return cleanedCount;
    }

    // 서비스 상태 조회
    getServiceStatus() {
        return {
            totalEvents: this.auditLogs.size,
            trackedLoginAttempts: this.loginAttempts.size,
            suspiciousActivities: this.suspiciousActivities.size,
            logFile: this.logFile,
            memoryUsage: process.memoryUsage()
        };
    }
}

module.exports = SecurityAuditService;