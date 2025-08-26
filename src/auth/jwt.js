const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class JWTAuthService {
    constructor() {
        this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || crypto.randomBytes(64).toString('hex');
        this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
        this.accessTokenExpiry = '15m';
        this.refreshTokenExpiry = '7d';
        this.tokenBlacklist = new Set();
    }

    // 액세스 토큰 생성
    generateAccessToken(payload) {
        const tokenPayload = {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            tenantId: payload.tenantId,
            permissions: payload.permissions || [],
            type: 'access'
        };

        return jwt.sign(tokenPayload, this.accessTokenSecret, {
            expiresIn: this.accessTokenExpiry,
            issuer: 'AIRIS_EPM',
            audience: 'AIRIS_EPM_CLIENT'
        });
    }

    // 리프레시 토큰 생성
    generateRefreshToken(payload) {
        const tokenPayload = {
            userId: payload.userId,
            email: payload.email,
            tenantId: payload.tenantId,
            type: 'refresh',
            tokenId: crypto.randomUUID()
        };

        return jwt.sign(tokenPayload, this.refreshTokenSecret, {
            expiresIn: this.refreshTokenExpiry,
            issuer: 'AIRIS_EPM',
            audience: 'AIRIS_EPM_CLIENT'
        });
    }

    // 토큰 검증
    verifyAccessToken(token) {
        try {
            if (this.tokenBlacklist.has(token)) {
                throw new Error('Token is blacklisted');
            }

            const decoded = jwt.verify(token, this.accessTokenSecret, {
                issuer: 'AIRIS_EPM',
                audience: 'AIRIS_EPM_CLIENT'
            });

            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }

            return decoded;
        } catch (error) {
            throw new Error(`Token verification failed: ${error.message}`);
        }
    }

    // 리프레시 토큰 검증
    verifyRefreshToken(token) {
        try {
            if (this.tokenBlacklist.has(token)) {
                throw new Error('Token is blacklisted');
            }

            const decoded = jwt.verify(token, this.refreshTokenSecret, {
                issuer: 'AIRIS_EPM',
                audience: 'AIRIS_EPM_CLIENT'
            });

            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }

            return decoded;
        } catch (error) {
            throw new Error(`Refresh token verification failed: ${error.message}`);
        }
    }

    // 토큰 블랙리스트 추가
    blacklistToken(token) {
        this.tokenBlacklist.add(token);
        // 실제 운영환경에서는 Redis나 DB에 저장
        console.log(`Token blacklisted: ${token.substring(0, 20)}...`);
    }

    // 패스워드 해싱
    async hashPassword(password) {
        const salt = await bcrypt.genSalt(12);
        return bcrypt.hash(password, salt);
    }

    // 패스워드 검증
    async verifyPassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }

    // 토큰 페이로드 추출 (검증 없이)
    decodeToken(token) {
        try {
            return jwt.decode(token);
        } catch (error) {
            throw new Error(`Token decode failed: ${error.message}`);
        }
    }

    // 토큰 만료 시간 확인
    isTokenExpired(token) {
        try {
            const decoded = this.decodeToken(token);
            const now = Math.floor(Date.now() / 1000);
            return decoded.exp < now;
        } catch (error) {
            return true;
        }
    }

    // 토큰 갱신
    async refreshTokens(refreshToken, userService) {
        try {
            const decoded = this.verifyRefreshToken(refreshToken);
            
            // 사용자 정보 재조회
            const user = await userService.getUserById(decoded.userId);
            if (!user || !user.isActive) {
                throw new Error('User not found or inactive');
            }

            // 기존 리프레시 토큰 블랙리스트 추가
            this.blacklistToken(refreshToken);

            // 새 토큰 생성
            const newAccessToken = this.generateAccessToken({
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
                permissions: user.permissions
            });

            const newRefreshToken = this.generateRefreshToken({
                userId: user.id,
                email: user.email,
                tenantId: user.tenantId
            });

            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresIn: this.accessTokenExpiry
            };
        } catch (error) {
            throw new Error(`Token refresh failed: ${error.message}`);
        }
    }
}

module.exports = JWTAuthService;