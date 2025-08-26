const JWTAuthService = require('./jwt');
const OAuth2Service = require('./oauth2');

class AuthMiddleware {
    constructor() {
        this.jwtService = new JWTAuthService();
        this.oauth2Service = new OAuth2Service();
        this.rateLimitStore = new Map();
    }

    // JWT 인증 미들웨어
    authenticateJWT = (options = {}) => {
        return async (req, res, next) => {
            try {
                // 토큰 추출
                const token = this.extractToken(req);
                if (!token) {
                    return res.status(401).json({
                        error: 'Authentication required',
                        code: 'MISSING_TOKEN'
                    });
                }

                // 토큰 검증
                const decoded = this.jwtService.verifyAccessToken(token);
                
                // 사용자 정보 설정
                req.user = {
                    userId: decoded.userId,
                    email: decoded.email,
                    role: decoded.role,
                    tenantId: decoded.tenantId,
                    permissions: decoded.permissions || []
                };

                // 토큰 정보 설정
                req.auth = {
                    token,
                    type: 'jwt',
                    expiresAt: new Date(decoded.exp * 1000)
                };

                next();
            } catch (error) {
                return res.status(401).json({
                    error: 'Invalid token',
                    message: error.message,
                    code: 'INVALID_TOKEN'
                });
            }
        };
    };

    // OAuth2 인증 미들웨어
    authenticateOAuth2 = (requiredScope = []) => {
        return async (req, res, next) => {
            try {
                const token = this.extractBearerToken(req);
                if (!token) {
                    return res.status(401).json({
                        error: 'Authentication required',
                        code: 'MISSING_TOKEN'
                    });
                }

                // OAuth2 토큰 검증
                const tokenData = this.oauth2Service.validateAccessToken(token);
                
                // 스코프 검증
                if (requiredScope.length > 0) {
                    const hasScope = this.checkScope(tokenData.scope, requiredScope);
                    if (!hasScope) {
                        return res.status(403).json({
                            error: 'Insufficient scope',
                            required: requiredScope,
                            provided: tokenData.scope,
                            code: 'INSUFFICIENT_SCOPE'
                        });
                    }
                }

                // 사용자 정보 설정
                req.user = {
                    userId: tokenData.userId,
                    email: tokenData.userEmail
                };

                req.oauth = {
                    clientId: tokenData.clientId,
                    scope: tokenData.scope,
                    expiresAt: tokenData.expiresAt
                };

                next();
            } catch (error) {
                return res.status(401).json({
                    error: 'Invalid OAuth2 token',
                    message: error.message,
                    code: 'INVALID_OAUTH_TOKEN'
                });
            }
        };
    };

    // 역할 기반 인가
    requireRole = (requiredRoles) => {
        return (req, res, next) => {
            if (!req.user || !req.user.role) {
                return res.status(403).json({
                    error: 'Access denied',
                    code: 'NO_ROLE'
                });
            }

            const userRole = req.user.role;
            const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

            if (!roles.includes(userRole)) {
                return res.status(403).json({
                    error: 'Insufficient role',
                    required: roles,
                    current: userRole,
                    code: 'INSUFFICIENT_ROLE'
                });
            }

            next();
        };
    };

    // 권한 기반 인가
    requirePermission = (requiredPermissions) => {
        return (req, res, next) => {
            if (!req.user || !req.user.permissions) {
                return res.status(403).json({
                    error: 'Access denied',
                    code: 'NO_PERMISSIONS'
                });
            }

            const userPermissions = req.user.permissions;
            const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

            const hasPermission = permissions.some(perm => 
                userPermissions.includes(perm) || userPermissions.includes('*')
            );

            if (!hasPermission) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    required: permissions,
                    current: userPermissions,
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            next();
        };
    };

    // 테넌트 격리
    requireTenant = (tenantIdParam = 'tenantId') => {
        return (req, res, next) => {
            const requestedTenantId = req.params[tenantIdParam] || req.query[tenantIdParam];
            const userTenantId = req.user?.tenantId;

            if (!userTenantId) {
                return res.status(403).json({
                    error: 'No tenant association',
                    code: 'NO_TENANT'
                });
            }

            if (requestedTenantId && requestedTenantId !== userTenantId) {
                // 관리자는 모든 테넌트 접근 가능
                if (req.user.role !== 'admin') {
                    return res.status(403).json({
                        error: 'Tenant access denied',
                        code: 'TENANT_MISMATCH'
                    });
                }
            }

            next();
        };
    };

    // Rate Limiting
    rateLimit = (options = {}) => {
        const {
            windowMs = 15 * 60 * 1000, // 15분
            maxRequests = 100,
            keyGenerator = (req) => req.ip
        } = options;

        return (req, res, next) => {
            const key = keyGenerator(req);
            const now = Date.now();
            const windowStart = now - windowMs;

            // 현재 윈도우에서의 요청 기록 가져오기
            let requests = this.rateLimitStore.get(key) || [];
            
            // 윈도우 밖의 요청 제거
            requests = requests.filter(timestamp => timestamp > windowStart);
            
            // 요청 수 확인
            if (requests.length >= maxRequests) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    limit: maxRequests,
                    windowMs,
                    retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000),
                    code: 'RATE_LIMIT_EXCEEDED'
                });
            }

            // 현재 요청 추가
            requests.push(now);
            this.rateLimitStore.set(key, requests);

            // 헤더 추가
            res.set({
                'X-RateLimit-Limit': maxRequests,
                'X-RateLimit-Remaining': maxRequests - requests.length,
                'X-RateLimit-Reset': Math.ceil((windowStart + windowMs) / 1000)
            });

            next();
        };
    };

    // 토큰 추출 (Authorization 헤더 또는 쿠키)
    extractToken(req) {
        // Authorization 헤더
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // JWT 헤더
        if (authHeader && authHeader.startsWith('JWT ')) {
            return authHeader.substring(4);
        }

        // 쿠키
        if (req.cookies && req.cookies.access_token) {
            return req.cookies.access_token;
        }

        // 쿼리 파라미터 (보안상 권장하지 않음)
        if (req.query.access_token) {
            return req.query.access_token;
        }

        return null;
    }

    // Bearer 토큰 추출
    extractBearerToken(req) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return null;
    }

    // 스코프 확인
    checkScope(userScope, requiredScope) {
        if (!userScope || !requiredScope) return false;

        const userScopes = typeof userScope === 'string' ? userScope.split(' ') : userScope;
        const required = Array.isArray(requiredScope) ? requiredScope : [requiredScope];

        return required.every(scope => userScopes.includes(scope));
    }

    // 옵셔널 인증 (토큰이 있으면 검증, 없어도 통과)
    optionalAuth = () => {
        return async (req, res, next) => {
            try {
                const token = this.extractToken(req);
                if (token) {
                    const decoded = this.jwtService.verifyAccessToken(token);
                    req.user = {
                        userId: decoded.userId,
                        email: decoded.email,
                        role: decoded.role,
                        tenantId: decoded.tenantId,
                        permissions: decoded.permissions || []
                    };
                }
            } catch (error) {
                // 토큰이 유효하지 않아도 계속 진행
                console.log('Optional auth failed:', error.message);
            }
            next();
        };
    };

    // 보안 헤더 설정
    securityHeaders = () => {
        return (req, res, next) => {
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
            });
            next();
        };
    };

    // CORS 설정
    cors = (options = {}) => {
        const {
            origin = process.env.CORS_ORIGIN || '*',
            methods = 'GET,POST,PUT,DELETE,OPTIONS',
            allowedHeaders = 'Origin,X-Requested-With,Content-Type,Accept,Authorization',
            credentials = true
        } = options;

        return (req, res, next) => {
            res.set({
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Methods': methods,
                'Access-Control-Allow-Headers': allowedHeaders,
                'Access-Control-Allow-Credentials': credentials
            });

            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }

            next();
        };
    };

    // Rate limit 저장소 정리 (주기적으로 실행)
    cleanupRateLimit() {
        const now = Date.now();
        for (const [key, requests] of this.rateLimitStore.entries()) {
            const validRequests = requests.filter(timestamp => timestamp > now - (15 * 60 * 1000));
            if (validRequests.length === 0) {
                this.rateLimitStore.delete(key);
            } else {
                this.rateLimitStore.set(key, validRequests);
            }
        }
    }
}

module.exports = AuthMiddleware;