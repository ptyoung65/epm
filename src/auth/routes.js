const express = require('express');
const JWTAuthService = require('./jwt');
const OAuth2Service = require('./oauth2');
const AuthMiddleware = require('./middleware');

const router = express.Router();
const jwtService = new JWTAuthService();
const oauth2Service = new OAuth2Service();
const authMiddleware = new AuthMiddleware();

// 가상 사용자 데이터베이스 (실제 환경에서는 실제 DB 사용)
const users = new Map([
    ['admin@airis.com', {
        id: '1',
        email: 'admin@airis.com',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcqAg7UoK', // 'admin123' hashed
        role: 'admin',
        tenantId: 'default',
        permissions: ['*'],
        isActive: true,
        createdAt: new Date('2024-01-01')
    }],
    ['user@airis.com', {
        id: '2',
        email: 'user@airis.com',
        password: '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password123' hashed
        role: 'user',
        tenantId: 'default',
        permissions: ['read', 'write'],
        isActive: true,
        createdAt: new Date('2024-01-01')
    }]
]);

// Rate limiting 적용
router.use(authMiddleware.rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    maxRequests: 100,
    keyGenerator: (req) => req.ip
}));

// 보안 헤더 적용
router.use(authMiddleware.securityHeaders());

// CORS 설정
router.use(authMiddleware.cors());

// === JWT 인증 엔드포인트 ===

// 로그인
router.post('/login', async (req, res) => {
    try {
        const { email, password, rememberMe = false } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password required'
            });
        }

        // 사용자 조회
        const user = users.get(email);
        if (!user || !user.isActive) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // 패스워드 검증
        const isValidPassword = await jwtService.verifyPassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // 토큰 생성
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            permissions: user.permissions
        };

        const accessToken = jwtService.generateAccessToken(tokenPayload);
        const refreshToken = jwtService.generateRefreshToken(tokenPayload);

        // 쿠키 설정 (보안)
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : undefined // 7일 또는 세션
        };

        res.cookie('access_token', accessToken, cookieOptions);
        res.cookie('refresh_token', refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 항상 7일
        });

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
                permissions: user.permissions
            },
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: '15m'
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// 토큰 갱신
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken || req.cookies.refresh_token;

        if (!refreshToken) {
            return res.status(401).json({
                error: 'Refresh token required'
            });
        }

        // 가상 사용자 서비스
        const userService = {
            getUserById: (id) => {
                return Array.from(users.values()).find(user => user.id === id);
            }
        };

        const tokens = await jwtService.refreshTokens(refreshToken, userService);

        // 새 쿠키 설정
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        };

        res.cookie('access_token', tokens.accessToken, cookieOptions);
        res.cookie('refresh_token', tokens.refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            message: 'Tokens refreshed',
            ...tokens
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            error: 'Token refresh failed',
            message: error.message
        });
    }
});

// 로그아웃
router.post('/logout', authMiddleware.authenticateJWT(), (req, res) => {
    try {
        // 토큰 블랙리스트 추가
        jwtService.blacklistToken(req.auth.token);

        // 쿠키 제거
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');

        res.json({
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Logout failed'
        });
    }
});

// === OAuth2 엔드포인트 ===

// OAuth2 인증 시작
router.get('/oauth2/authorize', (req, res) => {
    try {
        const { client_id, redirect_uri, scope = 'read', state, response_type = 'code' } = req.query;

        if (!client_id || !redirect_uri) {
            return res.status(400).json({
                error: 'client_id and redirect_uri required'
            });
        }

        // 클라이언트 검증
        const clientInfo = oauth2Service.getClientInfo(client_id);
        if (!clientInfo) {
            return res.status(400).json({
                error: 'Invalid client_id'
            });
        }

        // 사용자 로그인 확인 (간단한 예제)
        const isLoggedIn = req.session?.userId || req.cookies.access_token;
        
        if (!isLoggedIn) {
            // 로그인 페이지로 리다이렉트
            const loginUrl = `/auth/login?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${scope}&state=${state || ''}`;
            return res.redirect(loginUrl);
        }

        // 권한 부여 페이지 표시 (실제로는 HTML 페이지)
        res.json({
            message: 'Authorization required',
            client: {
                name: client_id,
                scope: scope.split(' '),
                redirectUri: redirect_uri
            },
            authorizeUrl: `/auth/oauth2/authorize/confirm?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${scope}&state=${state || ''}`
        });

    } catch (error) {
        console.error('OAuth2 authorize error:', error);
        res.status(500).json({
            error: 'Authorization failed'
        });
    }
});

// OAuth2 권한 승인
router.post('/oauth2/authorize/confirm', authMiddleware.authenticateJWT(), (req, res) => {
    try {
        const { client_id, redirect_uri, scope = 'read', state } = req.body;

        // 인증 코드 생성
        const code = oauth2Service.generateAuthorizationCode({
            clientId: client_id,
            redirectUri: redirect_uri,
            scope,
            userId: req.user.userId,
            userEmail: req.user.email
        });

        // 클라이언트로 리다이렉트
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (state) {
            redirectUrl.searchParams.set('state', state);
        }

        res.json({
            message: 'Authorization granted',
            redirectUrl: redirectUrl.toString()
        });

    } catch (error) {
        console.error('OAuth2 confirm error:', error);
        res.status(500).json({
            error: 'Authorization confirmation failed'
        });
    }
});

// OAuth2 토큰 교환
router.post('/oauth2/token', async (req, res) => {
    try {
        const { grant_type, code, client_id, client_secret, redirect_uri, refresh_token } = req.body;

        if (grant_type === 'authorization_code') {
            const tokens = await oauth2Service.exchangeCodeForToken({
                code,
                clientId: client_id,
                clientSecret: client_secret,
                redirectUri: redirect_uri
            });

            res.json(tokens);

        } else if (grant_type === 'refresh_token') {
            const tokens = await oauth2Service.refreshAccessToken({
                refreshToken: refresh_token,
                clientId: client_id,
                clientSecret: client_secret
            });

            res.json(tokens);

        } else {
            res.status(400).json({
                error: 'unsupported_grant_type',
                error_description: 'Only authorization_code and refresh_token grant types are supported'
            });
        }

    } catch (error) {
        console.error('OAuth2 token error:', error);
        res.status(400).json({
            error: 'invalid_grant',
            error_description: error.message
        });
    }
});

// OAuth2 토큰 해지
router.post('/oauth2/revoke', (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                error: 'Token required'
            });
        }

        const revoked = oauth2Service.revokeToken(token);

        res.json({
            message: revoked ? 'Token revoked' : 'Token not found'
        });

    } catch (error) {
        console.error('OAuth2 revoke error:', error);
        res.status(500).json({
            error: 'Token revocation failed'
        });
    }
});

// === 보호된 엔드포인트 ===

// 사용자 프로필 (JWT)
router.get('/profile', authMiddleware.authenticateJWT(), (req, res) => {
    res.json({
        user: req.user,
        auth: {
            type: req.auth.type,
            expiresAt: req.auth.expiresAt
        }
    });
});

// API 정보 (OAuth2)
router.get('/api/info', authMiddleware.authenticateOAuth2(['read']), (req, res) => {
    res.json({
        message: 'API accessed with OAuth2',
        user: req.user,
        oauth: req.oauth,
        timestamp: new Date().toISOString()
    });
});

// 관리자 전용 (JWT + Role)
router.get('/admin/stats', 
    authMiddleware.authenticateJWT(),
    authMiddleware.requireRole('admin'),
    (req, res) => {
        res.json({
            users: users.size,
            activeTokens: oauth2Service.getActiveTokensCount(),
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    }
);

// === 유틸리티 엔드포인트 ===

// 토큰 검증
router.post('/verify', (req, res) => {
    try {
        const { token, type = 'jwt' } = req.body;

        if (!token) {
            return res.status(400).json({
                error: 'Token required'
            });
        }

        if (type === 'jwt') {
            const decoded = jwtService.verifyAccessToken(token);
            res.json({
                valid: true,
                decoded,
                expiresAt: new Date(decoded.exp * 1000)
            });
        } else if (type === 'oauth2') {
            const tokenData = oauth2Service.validateAccessToken(token);
            res.json({
                valid: true,
                ...tokenData
            });
        } else {
            res.status(400).json({
                error: 'Invalid token type'
            });
        }

    } catch (error) {
        res.json({
            valid: false,
            error: error.message
        });
    }
});

// OAuth2 클라이언트 정보
router.get('/oauth2/client/:clientId', (req, res) => {
    try {
        const clientInfo = oauth2Service.getClientInfo(req.params.clientId);
        
        if (!clientInfo) {
            return res.status(404).json({
                error: 'Client not found'
            });
        }

        res.json(clientInfo);

    } catch (error) {
        console.error('Client info error:', error);
        res.status(500).json({
            error: 'Failed to get client info'
        });
    }
});

// 시스템 상태
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            jwt: 'active',
            oauth2: 'active',
            rateLimit: 'active'
        }
    });
});

module.exports = router;