const crypto = require('crypto');
const { URL } = require('url');

class OAuth2Service {
    constructor() {
        this.authorizationCodes = new Map(); // 실제 환경에서는 Redis 사용
        this.clientCredentials = new Map();
        this.accessTokens = new Map();
        
        // 기본 클라이언트 등록
        this.registerClient({
            clientId: 'airis-epm-dashboard',
            clientSecret: process.env.OAUTH_CLIENT_SECRET || crypto.randomBytes(32).toString('hex'),
            redirectUris: [
                'http://localhost:3000/auth/callback',
                'http://localhost:3002/auth/callback',
                'https://airis-epm.com/auth/callback'
            ],
            scope: ['read', 'write', 'admin']
        });
    }

    // OAuth2 클라이언트 등록
    registerClient({ clientId, clientSecret, redirectUris, scope }) {
        this.clientCredentials.set(clientId, {
            clientSecret,
            redirectUris,
            scope,
            createdAt: new Date()
        });
        
        console.log(`OAuth2 client registered: ${clientId}`);
        return { clientId, redirectUris, scope };
    }

    // 인증 URL 생성
    generateAuthorizationUrl({
        clientId,
        redirectUri,
        scope = 'read',
        state,
        responseType = 'code'
    }) {
        // 클라이언트 검증
        const client = this.clientCredentials.get(clientId);
        if (!client) {
            throw new Error('Invalid client_id');
        }

        // 리다이렉트 URI 검증
        if (!client.redirectUris.includes(redirectUri)) {
            throw new Error('Invalid redirect_uri');
        }

        // 스코프 검증
        const requestedScopes = scope.split(' ');
        const validScopes = requestedScopes.every(s => client.scope.includes(s));
        if (!validScopes) {
            throw new Error('Invalid scope');
        }

        const authUrl = new URL('/oauth2/authorize', process.env.BASE_URL || 'http://localhost:3000');
        authUrl.searchParams.set('response_type', responseType);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', scope);
        
        if (state) {
            authUrl.searchParams.set('state', state);
        }

        return authUrl.toString();
    }

    // 인증 코드 생성
    generateAuthorizationCode({
        clientId,
        redirectUri,
        scope,
        userId,
        userEmail
    }) {
        const code = crypto.randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분

        this.authorizationCodes.set(code, {
            clientId,
            redirectUri,
            scope,
            userId,
            userEmail,
            expiresAt,
            used: false
        });

        // 만료된 코드 정리
        setTimeout(() => {
            this.authorizationCodes.delete(code);
        }, 10 * 60 * 1000);

        return code;
    }

    // 액세스 토큰 교환
    async exchangeCodeForToken({
        code,
        clientId,
        clientSecret,
        redirectUri,
        grantType = 'authorization_code'
    }) {
        // grant_type 검증
        if (grantType !== 'authorization_code') {
            throw new Error('Unsupported grant_type');
        }

        // 클라이언트 인증
        const client = this.clientCredentials.get(clientId);
        if (!client || client.clientSecret !== clientSecret) {
            throw new Error('Invalid client credentials');
        }

        // 인증 코드 검증
        const authData = this.authorizationCodes.get(code);
        if (!authData) {
            throw new Error('Invalid authorization code');
        }

        if (authData.used) {
            throw new Error('Authorization code already used');
        }

        if (new Date() > authData.expiresAt) {
            this.authorizationCodes.delete(code);
            throw new Error('Authorization code expired');
        }

        if (authData.clientId !== clientId || authData.redirectUri !== redirectUri) {
            throw new Error('Invalid code parameters');
        }

        // 코드 사용 표시
        authData.used = true;

        // 액세스 토큰 생성
        const accessToken = crypto.randomBytes(32).toString('base64url');
        const refreshToken = crypto.randomBytes(32).toString('base64url');
        const expiresIn = 3600; // 1시간
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        // 토큰 저장
        this.accessTokens.set(accessToken, {
            clientId,
            userId: authData.userId,
            userEmail: authData.userEmail,
            scope: authData.scope,
            expiresAt,
            refreshToken
        });

        // 인증 코드 삭제
        this.authorizationCodes.delete(code);

        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            refresh_token: refreshToken,
            scope: authData.scope
        };
    }

    // 액세스 토큰 검증
    validateAccessToken(accessToken) {
        const tokenData = this.accessTokens.get(accessToken);
        
        if (!tokenData) {
            throw new Error('Invalid access token');
        }

        if (new Date() > tokenData.expiresAt) {
            this.accessTokens.delete(accessToken);
            throw new Error('Access token expired');
        }

        return {
            clientId: tokenData.clientId,
            userId: tokenData.userId,
            userEmail: tokenData.userEmail,
            scope: tokenData.scope,
            expiresAt: tokenData.expiresAt
        };
    }

    // 리프레시 토큰으로 액세스 토큰 갱신
    async refreshAccessToken({
        refreshToken,
        clientId,
        clientSecret,
        grantType = 'refresh_token'
    }) {
        if (grantType !== 'refresh_token') {
            throw new Error('Unsupported grant_type');
        }

        // 클라이언트 인증
        const client = this.clientCredentials.get(clientId);
        if (!client || client.clientSecret !== clientSecret) {
            throw new Error('Invalid client credentials');
        }

        // 현재 액세스 토큰 찾기
        const currentTokenEntry = Array.from(this.accessTokens.entries())
            .find(([token, data]) => data.refreshToken === refreshToken);

        if (!currentTokenEntry) {
            throw new Error('Invalid refresh token');
        }

        const [currentAccessToken, tokenData] = currentTokenEntry;

        // 새 액세스 토큰 생성
        const newAccessToken = crypto.randomBytes(32).toString('base64url');
        const newRefreshToken = crypto.randomBytes(32).toString('base64url');
        const expiresIn = 3600;
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        // 기존 토큰 제거
        this.accessTokens.delete(currentAccessToken);

        // 새 토큰 저장
        this.accessTokens.set(newAccessToken, {
            clientId: tokenData.clientId,
            userId: tokenData.userId,
            userEmail: tokenData.userEmail,
            scope: tokenData.scope,
            expiresAt,
            refreshToken: newRefreshToken
        });

        return {
            access_token: newAccessToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            refresh_token: newRefreshToken,
            scope: tokenData.scope
        };
    }

    // 토큰 해지
    revokeToken(token) {
        // 액세스 토큰 해지
        if (this.accessTokens.has(token)) {
            this.accessTokens.delete(token);
            return true;
        }

        // 리프레시 토큰으로 검색하여 해지
        const tokenEntry = Array.from(this.accessTokens.entries())
            .find(([accessToken, data]) => data.refreshToken === token);

        if (tokenEntry) {
            this.accessTokens.delete(tokenEntry[0]);
            return true;
        }

        return false;
    }

    // 클라이언트 정보 조회
    getClientInfo(clientId) {
        const client = this.clientCredentials.get(clientId);
        if (!client) {
            return null;
        }

        return {
            clientId,
            redirectUris: client.redirectUris,
            scope: client.scope,
            createdAt: client.createdAt
        };
    }

    // 활성 토큰 수 조회
    getActiveTokensCount() {
        return this.accessTokens.size;
    }

    // 만료된 토큰 정리
    cleanupExpiredTokens() {
        const now = new Date();
        let cleanedCount = 0;

        for (const [token, data] of this.accessTokens.entries()) {
            if (now > data.expiresAt) {
                this.accessTokens.delete(token);
                cleanedCount++;
            }
        }

        console.log(`Cleaned up ${cleanedCount} expired tokens`);
        return cleanedCount;
    }
}

module.exports = OAuth2Service;