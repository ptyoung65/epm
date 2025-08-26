const crypto = require('crypto');
const { URL } = require('url');

class SSOService {
    constructor() {
        this.providers = new Map();
        this.sessions = new Map();
        this.samlRequests = new Map();
        
        this.initializeProviders();
    }

    // SSO 제공자 초기화
    initializeProviders() {
        // SAML 제공자
        this.addProvider({
            id: 'azure-ad',
            name: 'Azure Active Directory',
            type: 'saml',
            enabled: true,
            config: {
                entryPoint: process.env.AZURE_SSO_ENTRY_POINT || 'https://login.microsoftonline.com/tenant-id/saml2',
                issuer: process.env.AZURE_SSO_ISSUER || 'urn:airis-epm',
                cert: process.env.AZURE_SSO_CERT || '',
                identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
                callbackUrl: process.env.BASE_URL + '/auth/sso/saml/callback',
                signatureAlgorithm: 'sha256'
            },
            attributeMapping: {
                email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
                firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
                lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
                role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
            }
        });

        // OIDC 제공자
        this.addProvider({
            id: 'google',
            name: 'Google',
            type: 'oidc',
            enabled: true,
            config: {
                clientId: process.env.GOOGLE_CLIENT_ID || '',
                clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
                discoveryUrl: 'https://accounts.google.com/.well-known/openid_configuration',
                scope: 'openid email profile',
                redirectUri: process.env.BASE_URL + '/auth/sso/oidc/callback',
                responseType: 'code'
            },
            attributeMapping: {
                email: 'email',
                firstName: 'given_name',
                lastName: 'family_name',
                picture: 'picture'
            }
        });

        // Active Directory/LDAP
        this.addProvider({
            id: 'company-ad',
            name: 'Company Active Directory',
            type: 'ldap',
            enabled: false,
            config: {
                url: process.env.LDAP_URL || 'ldap://company.local:389',
                bindDN: process.env.LDAP_BIND_DN || 'cn=admin,dc=company,dc=local',
                bindPassword: process.env.LDAP_BIND_PASSWORD || '',
                searchBase: process.env.LDAP_SEARCH_BASE || 'ou=users,dc=company,dc=local',
                searchFilter: '(sAMAccountName={{username}})',
                tlsOptions: {
                    rejectUnauthorized: false
                }
            },
            attributeMapping: {
                email: 'mail',
                firstName: 'givenName',
                lastName: 'sn',
                department: 'department',
                title: 'title'
            }
        });
    }

    // SSO 제공자 추가
    addProvider(provider) {
        this.providers.set(provider.id, {
            ...provider,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    // SSO 제공자 조회
    getProvider(providerId) {
        return this.providers.get(providerId);
    }

    // 활성화된 SSO 제공자 목록
    getEnabledProviders() {
        return Array.from(this.providers.values()).filter(provider => provider.enabled);
    }

    // SAML 인증 요청 생성
    generateSAMLRequest(providerId) {
        const provider = this.getProvider(providerId);
        if (!provider || provider.type !== 'saml') {
            throw new Error('Invalid SAML provider');
        }

        const requestId = '_' + crypto.randomBytes(16).toString('hex');
        const issueInstant = new Date().toISOString();
        
        // 간단한 SAML AuthnRequest 생성 (실제 환경에서는 saml2-js 같은 라이브러리 사용 권장)
        const samlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                    ID="${requestId}"
                    Version="2.0"
                    IssueInstant="${issueInstant}"
                    Destination="${provider.config.entryPoint}"
                    AssertionConsumerServiceURL="${provider.config.callbackUrl}">
    <saml:Issuer>${provider.config.issuer}</saml:Issuer>
    <samlp:NameIDPolicy Format="${provider.config.identifierFormat}" AllowCreate="true"/>
</samlp:AuthnRequest>`;

        // 요청 저장 (검증용)
        this.samlRequests.set(requestId, {
            providerId,
            timestamp: new Date(),
            relayState: crypto.randomBytes(16).toString('hex')
        });

        // Base64 인코딩
        const encodedRequest = Buffer.from(samlRequest).toString('base64');
        const relayState = this.samlRequests.get(requestId).relayState;

        // 리다이렉트 URL 생성
        const redirectUrl = new URL(provider.config.entryPoint);
        redirectUrl.searchParams.set('SAMLRequest', encodedRequest);
        redirectUrl.searchParams.set('RelayState', relayState);

        return {
            requestId,
            redirectUrl: redirectUrl.toString(),
            relayState
        };
    }

    // OIDC 인증 URL 생성
    generateOIDCAuthUrl(providerId, state = null) {
        const provider = this.getProvider(providerId);
        if (!provider || provider.type !== 'oidc') {
            throw new Error('Invalid OIDC provider');
        }

        const stateParam = state || crypto.randomBytes(16).toString('hex');
        const nonce = crypto.randomBytes(16).toString('hex');

        // 세션에 state와 nonce 저장
        this.sessions.set(stateParam, {
            providerId,
            nonce,
            timestamp: new Date()
        });

        // 인증 URL 생성 (실제 환경에서는 discovery document에서 authorization_endpoint 사용)
        let authUrl;
        if (providerId === 'google') {
            authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        } else {
            // 다른 OIDC 제공자의 경우 discovery URL 사용
            throw new Error('Provider discovery not implemented');
        }

        authUrl.searchParams.set('client_id', provider.config.clientId);
        authUrl.searchParams.set('response_type', provider.config.responseType);
        authUrl.searchParams.set('scope', provider.config.scope);
        authUrl.searchParams.set('redirect_uri', provider.config.redirectUri);
        authUrl.searchParams.set('state', stateParam);
        authUrl.searchParams.set('nonce', nonce);

        return {
            authUrl: authUrl.toString(),
            state: stateParam
        };
    }

    // SAML Response 처리
    async processSAMLResponse(samlResponse, relayState) {
        try {
            // Base64 디코딩
            const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8');
            
            // RelayState로 원본 요청 확인
            const originalRequest = Array.from(this.samlRequests.values())
                .find(req => req.relayState === relayState);
            
            if (!originalRequest) {
                throw new Error('Invalid relay state');
            }

            const provider = this.getProvider(originalRequest.providerId);
            if (!provider) {
                throw new Error('Provider not found');
            }

            // SAML Response 파싱 (실제 환경에서는 XML 파서와 서명 검증 필요)
            const userData = this.parseSAMLResponse(decodedResponse, provider);

            // 사용자 정보 매핑
            const mappedUser = this.mapUserAttributes(userData, provider.attributeMapping);

            // 세션 생성
            const sessionId = crypto.randomUUID();
            this.sessions.set(sessionId, {
                userId: mappedUser.email, // 이메일을 사용자 ID로 사용
                provider: originalRequest.providerId,
                userData: mappedUser,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8시간
            });

            // 요청 정리
            this.samlRequests.delete(originalRequest.requestId);

            return {
                sessionId,
                user: mappedUser,
                provider: originalRequest.providerId
            };

        } catch (error) {
            throw new Error(`SAML response processing failed: ${error.message}`);
        }
    }

    // OIDC 토큰 교환 및 처리
    async processOIDCCallback(code, state) {
        try {
            const sessionData = this.sessions.get(state);
            if (!sessionData) {
                throw new Error('Invalid state parameter');
            }

            const provider = this.getProvider(sessionData.providerId);
            if (!provider) {
                throw new Error('Provider not found');
            }

            // 토큰 교환 (실제 환경에서는 HTTP 요청)
            const tokenData = await this.exchangeCodeForToken(code, provider);
            
            // ID 토큰 검증 및 사용자 정보 추출
            const userData = this.parseIDToken(tokenData.id_token, sessionData.nonce);
            
            // 사용자 정보 매핑
            const mappedUser = this.mapUserAttributes(userData, provider.attributeMapping);

            // 세션 업데이트
            const sessionId = crypto.randomUUID();
            this.sessions.set(sessionId, {
                userId: mappedUser.email,
                provider: sessionData.providerId,
                userData: mappedUser,
                tokens: tokenData,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
            });

            // 임시 세션 정리
            this.sessions.delete(state);

            return {
                sessionId,
                user: mappedUser,
                provider: sessionData.providerId
            };

        } catch (error) {
            throw new Error(`OIDC callback processing failed: ${error.message}`);
        }
    }

    // LDAP 인증
    async authenticateLDAP(providerId, username, password) {
        const provider = this.getProvider(providerId);
        if (!provider || provider.type !== 'ldap') {
            throw new Error('Invalid LDAP provider');
        }

        try {
            // LDAP 클라이언트 연결 및 인증 (실제 환경에서는 ldapjs 사용)
            // 여기서는 시뮬레이션
            const userData = await this.performLDAPAuth(username, password, provider);
            
            // 사용자 정보 매핑
            const mappedUser = this.mapUserAttributes(userData, provider.attributeMapping);

            // 세션 생성
            const sessionId = crypto.randomUUID();
            this.sessions.set(sessionId, {
                userId: mappedUser.email,
                provider: providerId,
                userData: mappedUser,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
            });

            return {
                sessionId,
                user: mappedUser,
                provider: providerId
            };

        } catch (error) {
            throw new Error(`LDAP authentication failed: ${error.message}`);
        }
    }

    // 사용자 속성 매핑
    mapUserAttributes(userData, mapping) {
        const mappedUser = {};
        
        for (const [localAttr, remoteAttr] of Object.entries(mapping)) {
            if (userData[remoteAttr]) {
                mappedUser[localAttr] = userData[remoteAttr];
            }
        }

        return mappedUser;
    }

    // SSO 세션 조회
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    // SSO 세션 무효화
    invalidateSession(sessionId) {
        return this.sessions.delete(sessionId);
    }

    // 모든 SSO 세션 무효화 (사용자별)
    invalidateUserSessions(userId) {
        let count = 0;
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.userId === userId) {
                this.sessions.delete(sessionId);
                count++;
            }
        }
        return count;
    }

    // SAML 메타데이터 생성
    generateSAMLMetadata() {
        const entityId = process.env.SAML_ENTITY_ID || 'urn:airis-epm';
        const callbackUrl = process.env.BASE_URL + '/auth/sso/saml/callback';
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${entityId}">
    <md:SPSSODescriptor AuthnRequestsSigned="false"
                        WantAssertionsSigned="false"
                        protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                   Location="${callbackUrl}"
                                   index="0"/>
    </md:SPSSODescriptor>
</md:EntityDescriptor>`;
    }

    // 제공자별 설정 업데이트
    updateProvider(providerId, updates) {
        const provider = this.getProvider(providerId);
        if (!provider) {
            throw new Error('Provider not found');
        }

        const updatedProvider = {
            ...provider,
            ...updates,
            updatedAt: new Date()
        };

        this.providers.set(providerId, updatedProvider);
        return updatedProvider;
    }

    // 제공자 활성화/비활성화
    toggleProvider(providerId, enabled) {
        return this.updateProvider(providerId, { enabled });
    }

    // SSO 통계
    getStatistics() {
        const stats = {
            totalProviders: this.providers.size,
            enabledProviders: Array.from(this.providers.values()).filter(p => p.enabled).length,
            activeSessions: this.sessions.size,
            providerTypes: {},
            sessionsByProvider: {}
        };

        // 제공자 타입별 통계
        for (const provider of this.providers.values()) {
            stats.providerTypes[provider.type] = (stats.providerTypes[provider.type] || 0) + 1;
        }

        // 세션 제공자별 통계
        for (const session of this.sessions.values()) {
            stats.sessionsByProvider[session.provider] = (stats.sessionsByProvider[session.provider] || 0) + 1;
        }

        return stats;
    }

    // 헬퍼 메서드들 (실제 구현에서는 외부 라이브러리 사용)
    parseSAMLResponse(response, provider) {
        // SAML Response 파싱 시뮬레이션
        return {
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'user@company.com',
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'John',
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'Doe',
            'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'user'
        };
    }

    async exchangeCodeForToken(code, provider) {
        // OAuth2 토큰 교환 시뮬레이션
        return {
            access_token: 'mock_access_token',
            id_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InVzZXJAZ21haWwuY29tIiwiZ2l2ZW5fbmFtZSI6IkpvaG4iLCJmYW1pbHlfbmFtZSI6IkRvZSJ9.mock_signature',
            token_type: 'Bearer',
            expires_in: 3600
        };
    }

    parseIDToken(idToken, nonce) {
        // ID 토큰 파싱 시뮬레이션 (실제로는 JWT 검증 필요)
        const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
        return payload;
    }

    async performLDAPAuth(username, password, provider) {
        // LDAP 인증 시뮬레이션
        if (password === 'correct_password') {
            return {
                mail: username + '@company.com',
                givenName: 'John',
                sn: 'Doe',
                department: 'IT',
                title: 'Developer'
            };
        }
        throw new Error('Invalid credentials');
    }

    // 만료된 세션 정리 (주기적으로 실행)
    cleanupExpiredSessions() {
        const now = new Date();
        let cleanedCount = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.expiresAt && now > session.expiresAt) {
                this.sessions.delete(sessionId);
                cleanedCount++;
            }
        }

        // 만료된 SAML 요청도 정리
        for (const [requestId, request] of this.samlRequests.entries()) {
            if (now - request.timestamp > 10 * 60 * 1000) { // 10분
                this.samlRequests.delete(requestId);
            }
        }

        console.log(`Cleaned up ${cleanedCount} expired SSO sessions`);
        return cleanedCount;
    }
}

module.exports = SSOService;