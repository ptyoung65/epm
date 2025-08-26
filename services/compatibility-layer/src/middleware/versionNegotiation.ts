import { Request, Response, NextFunction } from 'express';
import { ApiVersionManager } from '../services/ApiVersionManager';
import { logger } from '../utils/logger';

/**
 * Version negotiation middleware
 * 
 * Handles API version detection and negotiation from client headers
 */
export const versionNegotiation = (versionManager: ApiVersionManager) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const acceptVersionHeader = req.headers['accept-version'] as string;
    const clientVersionHeader = req.headers['x-client-version'] as string;
    const apiVersionHeader = req.headers['x-api-version'] as string;
    const userAgent = req.headers['user-agent'] as string;

    // Negotiate API version
    const negotiationResult = versionManager.negotiateVersion(
      acceptVersionHeader,
      clientVersionHeader || apiVersionHeader,
      userAgent
    );

    // Store negotiated version in request context
    (req as any).apiVersion = negotiationResult.version;
    (req as any).clientVersion = clientVersionHeader;
    (req as any).versionWarnings = negotiationResult.warnings;

    // Add version information to response headers
    res.set({
      'X-API-Version': negotiationResult.version,
      'X-Compatible': negotiationResult.isCompatible.toString(),
    });

    // Add deprecation warnings to response headers if applicable
    if (negotiationResult.warnings.length > 0) {
      res.set('X-API-Warnings', negotiationResult.warnings.join('; '));
      
      // Log deprecation warnings
      logger.warn('API version warnings', {
        path: req.path,
        method: req.method,
        negotiatedVersion: negotiationResult.version,
        clientVersion: clientVersionHeader,
        warnings: negotiationResult.warnings,
        userAgent: userAgent?.substring(0, 100), // Truncate for logging
        ip: req.ip,
        requestId: (req as any).requestId,
      });
    }

    // Check if version is supported
    if (!versionManager.isVersionSupported(negotiationResult.version)) {
      logger.error('Unsupported API version requested', {
        path: req.path,
        method: req.method,
        requestedVersion: negotiationResult.version,
        supportedVersions: versionManager.getSupportedVersions(),
        clientVersion: clientVersionHeader,
        userAgent: userAgent?.substring(0, 100),
        ip: req.ip,
        requestId: (req as any).requestId,
      });

      return res.status(400).json({
        error: 'Unsupported API Version',
        message: `API version ${negotiationResult.version} is not supported`,
        supportedVersions: versionManager.getSupportedVersions(),
        recommendedVersion: versionManager.getSupportedVersions().slice(-1)[0],
        deprecatedVersions: versionManager.getDeprecatedVersions(),
      });
    }

    // Get version comparison information
    const versionInfo = versionManager.compareVersionInfo(negotiationResult.version);
    
    // Add additional headers based on version status
    if (versionInfo.isDeprecated) {
      res.set('X-API-Deprecated', 'true');
      res.set('X-API-Recommended-Version', versionInfo.recommendedVersion);
    }

    if (versionInfo.isLegacy) {
      res.set('X-API-Legacy', 'true');
      res.set('X-Migration-Available', 'true');
    }

    if (versionInfo.requiresTransformation) {
      res.set('X-API-Transformation', 'true');
    }

    // Log version negotiation for analytics
    logger.debug('API version negotiated', {
      path: req.path,
      method: req.method,
      negotiatedVersion: negotiationResult.version,
      clientVersion: clientVersionHeader,
      isLegacy: versionInfo.isLegacy,
      isDeprecated: versionInfo.isDeprecated,
      requiresTransformation: versionInfo.requiresTransformation,
      requestId: (req as any).requestId,
    });

    next();
  };
};

/**
 * Middleware to validate API version format
 */
export const validateApiVersion = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiVersion = req.headers['x-api-version'] as string;
  
  if (apiVersion && !isValidVersionFormat(apiVersion)) {
    logger.warn('Invalid API version format', {
      path: req.path,
      method: req.method,
      providedVersion: apiVersion,
      ip: req.ip,
      requestId: (req as any).requestId,
    });

    return res.status(400).json({
      error: 'Invalid Version Format',
      message: 'API version must be in format X.Y or X.Y.Z',
      providedVersion: apiVersion,
      validExamples: ['1.0', '2.1', '3.0'],
    }) as any;
  }

  next();
};

/**
 * Middleware to handle version-specific features
 */
export const versionFeatures = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiVersion = (req as any).apiVersion || '1.0';
  
  // Store version-specific feature flags
  (req as any).features = getVersionFeatures(apiVersion);
  
  // Add feature information to response headers
  const features = (req as any).features;
  if (features.graphqlSupported) {
    res.set('X-GraphQL-Supported', 'true');
  }
  if (features.realTimeSupported) {
    res.set('X-Real-Time-Supported', 'true');
  }
  if (features.multiTenantSupported) {
    res.set('X-Multi-Tenant-Supported', 'true');
  }
  
  next();
};

/**
 * Check if version format is valid
 */
function isValidVersionFormat(version: string): boolean {
  const versionRegex = /^\d+\.\d+(\.\d+)?$/;
  return versionRegex.test(version);
}

/**
 * Get feature flags for a specific version
 */
function getVersionFeatures(version: string) {
  const majorMinor = version.split('.').slice(0, 2).join('.');
  
  const featureMatrix = {
    '1.0': {
      graphqlSupported: false,
      realTimeSupported: false,
      multiTenantSupported: false,
      advancedMetrics: false,
      aiInsights: false,
    },
    '1.1': {
      graphqlSupported: false,
      realTimeSupported: false,
      multiTenantSupported: false,
      advancedMetrics: true,
      aiInsights: false,
    },
    '1.2': {
      graphqlSupported: false,
      realTimeSupported: false,
      multiTenantSupported: false,
      advancedMetrics: true,
      aiInsights: false,
    },
    '2.0': {
      graphqlSupported: false,
      realTimeSupported: true,
      multiTenantSupported: false,
      advancedMetrics: true,
      aiInsights: false,
    },
    '2.1': {
      graphqlSupported: false,
      realTimeSupported: true,
      multiTenantSupported: false,
      advancedMetrics: true,
      aiInsights: true,
    },
    '3.0': {
      graphqlSupported: true,
      realTimeSupported: true,
      multiTenantSupported: true,
      advancedMetrics: true,
      aiInsights: true,
    },
  };

  return featureMatrix[majorMinor] || featureMatrix['1.0'];
}
