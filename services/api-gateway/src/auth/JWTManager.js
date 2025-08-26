const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Redis = require('ioredis');

class JWTManager {
  constructor(config = {}) {
    this.secret = config.jwtSecret || process.env.JWT_SECRET || 'airis-secret-key';
    this.refreshSecret = config.refreshSecret || process.env.JWT_REFRESH_SECRET || 'airis-refresh-secret';
    this.tokenExpiry = config.tokenExpiry || '15m';
    this.refreshExpiry = config.refreshExpiry || '7d';
    
    // Redis for token blacklist and refresh tokens
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
    
    // User roles and permissions (in production, this would come from a database)
    this.roles = {
      admin: {
        permissions: ['*'], // Full access
        level: 100
      },
      operator: {
        permissions: ['read:*', 'write:metrics', 'write:logs', 'write:traces'],
        level: 50
      },
      viewer: {
        permissions: ['read:*'],
        level: 10
      },
      user: {
        permissions: ['read:own', 'write:own'],
        level: 1
      }
    };
  }

  // Generate access token
  generateAccessToken(payload) {
    const tokenPayload = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      permissions: this.roles[payload.role]?.permissions || [],
      level: this.roles[payload.role]?.level || 0,
      type: 'access'
    };

    return jwt.sign(tokenPayload, this.secret, {
      expiresIn: this.tokenExpiry,
      issuer: 'airis-api-gateway',
      audience: 'airis-services'
    });
  }

  // Generate refresh token
  generateRefreshToken(payload) {
    const tokenPayload = {
      userId: payload.userId,
      username: payload.username,
      type: 'refresh'
    };

    const token = jwt.sign(tokenPayload, this.refreshSecret, {
      expiresIn: this.refreshExpiry,
      issuer: 'airis-api-gateway',
      audience: 'airis-services'
    });

    // Store refresh token in Redis
    this.redis.setex(`refresh:${payload.userId}`, 7 * 24 * 60 * 60, token);

    return token;
  }

  // Verify access token
  async verifyAccessToken(token) {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.redis.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new Error('Token is blacklisted');
      }

      const decoded = jwt.verify(token, this.secret);
      
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  // Verify refresh token
  async verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists in Redis
      const storedToken = await this.redis.get(`refresh:${decoded.userId}`);
      if (storedToken !== token) {
        throw new Error('Refresh token not found or expired');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Refresh token verification failed: ${error.message}`);
    }
  }

  // Refresh tokens
  async refreshTokens(refreshToken) {
    try {
      const decoded = await this.verifyRefreshToken(refreshToken);
      
      // In production, fetch user data from database
      const userData = {
        userId: decoded.userId,
        username: decoded.username,
        role: 'user' // Should fetch from database
      };

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(userData);
      const newRefreshToken = this.generateRefreshToken(userData);

      // Remove old refresh token
      await this.redis.del(`refresh:${decoded.userId}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  // Blacklist token (logout)
  async blacklistToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret, { ignoreExpiration: true });
      const remaining = decoded.exp - Math.floor(Date.now() / 1000);
      
      if (remaining > 0) {
        await this.redis.setex(`blacklist:${token}`, remaining, 'blacklisted');
      }

      // Remove refresh token
      if (decoded.userId) {
        await this.redis.del(`refresh:${decoded.userId}`);
      }

      return true;
    } catch (error) {
      throw new Error(`Token blacklist failed: ${error.message}`);
    }
  }

  // Check permissions
  hasPermission(userPermissions, requiredPermission) {
    // Admin has full access
    if (userPermissions.includes('*')) {
      return true;
    }

    // Check specific permission
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Check wildcard permissions
    const [resource, action] = requiredPermission.split(':');
    return userPermissions.some(perm => {
      const [permResource, permAction] = perm.split(':');
      return (permResource === resource || permResource === '*') &&
             (permAction === action || permAction === '*');
    });
  }

  // Check minimum role level
  hasMinimumLevel(userLevel, requiredLevel) {
    return userLevel >= requiredLevel;
  }

  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate API key
  generateApiKey(prefix = 'ak') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${prefix}_${timestamp}_${random}`;
  }

  // Validate API key format
  validateApiKeyFormat(apiKey) {
    const regex = /^[a-zA-Z]{2,4}_[a-zA-Z0-9]{6,12}_[a-zA-Z0-9]{13,20}$/;
    return regex.test(apiKey);
  }
}

module.exports = JWTManager;