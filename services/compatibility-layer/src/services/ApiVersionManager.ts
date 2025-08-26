import { config } from '../config/environment';
import { logger } from '../utils/logger';

/**
 * API Version information
 */
export interface ApiVersion {
  version: string;
  releaseDate: Date;
  deprecated: boolean;
  eolDate?: Date;
  supportLevel: 'full' | 'limited' | 'security-only' | 'eol';
  features: string[];
  breaking_changes: string[];
  migration_guide?: string;
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  isLegacy: boolean;
  isSupported: boolean;
  isDeprecated: boolean;
  requiresTransformation: boolean;
  recommendedVersion: string;
  warningMessage?: string;
}

/**
 * API Version Manager
 * 
 * Manages API version compatibility, deprecation warnings,
 * and data transformation requirements between versions.
 */
export class ApiVersionManager {
  private versions: Map<string, ApiVersion> = new Map();
  private transformationRules: Map<string, any> = new Map();

  constructor() {
    this.initializeVersions();
    this.initializeTransformationRules();
  }

  /**
   * Initialize supported API versions
   */
  private initializeVersions(): void {
    const versionDefinitions: ApiVersion[] = [
      {
        version: '1.0',
        releaseDate: new Date('2021-01-01'),
        deprecated: true,
        eolDate: new Date('2024-12-31'),
        supportLevel: 'security-only',
        features: ['basic-monitoring', 'simple-alerts'],
        breaking_changes: [],
        migration_guide: '/docs/migration/v1-to-v3',
      },
      {
        version: '1.1',
        releaseDate: new Date('2021-06-01'),
        deprecated: true,
        eolDate: new Date('2025-06-01'),
        supportLevel: 'limited',
        features: ['basic-monitoring', 'simple-alerts', 'user-management'],
        breaking_changes: ['authentication-method-changed'],
        migration_guide: '/docs/migration/v1-to-v3',
      },
      {
        version: '1.2',
        releaseDate: new Date('2022-01-01'),
        deprecated: true,
        supportLevel: 'limited',
        features: ['basic-monitoring', 'simple-alerts', 'user-management', 'dashboards'],
        breaking_changes: ['response-format-changed', 'error-handling-updated'],
        migration_guide: '/docs/migration/v1-to-v3',
      },
      {
        version: '2.0',
        releaseDate: new Date('2022-07-01'),
        deprecated: true,
        supportLevel: 'limited',
        features: [
          'advanced-monitoring',
          'complex-alerts',
          'user-management',
          'dashboards',
          'trace-analysis',
        ],
        breaking_changes: [
          'rest-endpoints-restructured',
          'authentication-jwt-required',
          'response-wrapper-changed',
        ],
        migration_guide: '/docs/migration/v2-to-v3',
      },
      {
        version: '2.1',
        releaseDate: new Date('2023-01-01'),
        deprecated: false,
        supportLevel: 'full',
        features: [
          'advanced-monitoring',
          'complex-alerts',
          'user-management',
          'dashboards',
          'trace-analysis',
          'log-analysis',
          'performance-insights',
        ],
        breaking_changes: ['date-format-standardized'],
        migration_guide: '/docs/migration/v2-to-v3',
      },
      {
        version: '3.0',
        releaseDate: new Date('2024-01-01'),
        deprecated: false,
        supportLevel: 'full',
        features: [
          'enterprise-monitoring',
          'ai-powered-alerts',
          'advanced-user-management',
          'interactive-dashboards',
          'distributed-tracing',
          'structured-logging',
          'predictive-analytics',
          'graphql-api',
          'real-time-subscriptions',
          'multi-tenant-support',
        ],
        breaking_changes: [
          'graphql-first-architecture',
          'rest-api-restructured',
          'websocket-subscriptions',
          'tenant-isolation-required',
        ],
      },
    ];

    // Populate versions map
    versionDefinitions.forEach((version) => {
      this.versions.set(version.version, version);
    });

    logger.info('API versions initialized', {
      totalVersions: this.versions.size,
      supportedVersions: this.getSupportedVersions(),
      deprecatedVersions: this.getDeprecatedVersions(),
      currentVersion: config.compatibility.currentVersion,
    });
  }

  /**
   * Initialize data transformation rules between versions
   */
  private initializeTransformationRules(): void {
    // Transformation rules from legacy to new versions
    this.transformationRules.set('1.0->3.0', {
      requestTransforms: {
        // Date format changes
        dateFields: ['timestamp', 'created_at', 'updated_at'],
        dateFormat: {
          from: 'YYYY-MM-DD HH:mm:ss',
          to: 'ISO8601',
        },
        // Field name mappings
        fieldMappings: {
          'user_id': 'userId',
          'tenant_id': 'tenantId',
          'alert_id': 'alertId',
          'dashboard_id': 'dashboardId',
        },
        // Remove deprecated fields
        removeFields: ['legacy_status', 'old_format_data'],
        // Add required fields with defaults
        addFields: {
          'tenantId': 'default',
          'version': '3.0',
        },
      },
      responseTransforms: {
        // Wrap response in legacy format
        wrapper: {
          data: '$.response',
          status: 'success',
          timestamp: () => new Date().toISOString(),
        },
        // Field name mappings (reverse)
        fieldMappings: {
          'userId': 'user_id',
          'tenantId': 'tenant_id',
          'alertId': 'alert_id',
          'dashboardId': 'dashboard_id',
          'createdAt': 'created_at',
          'updatedAt': 'updated_at',
        },
        // Convert date formats
        dateFields: ['created_at', 'updated_at', 'timestamp'],
        dateFormat: {
          from: 'ISO8601',
          to: 'YYYY-MM-DD HH:mm:ss',
        },
        // Remove new fields not supported in legacy
        removeFields: [
          'metadata',
          'traceId',
          'spanId',
          'tenantId', // Remove if client doesn't support multi-tenancy
        ],
      },
    });

    // Similar rules for other version transitions
    this.transformationRules.set('2.0->3.0', {
      requestTransforms: {
        fieldMappings: {
          'timestamp': 'createdAt',
          'updated': 'updatedAt',
        },
        addFields: {
          'version': '3.0',
        },
      },
      responseTransforms: {
        fieldMappings: {
          'createdAt': 'timestamp',
          'updatedAt': 'updated',
        },
        removeFields: ['metadata.traceContext'],
      },
    });

    this.transformationRules.set('2.1->3.0', {
      requestTransforms: {
        // Minimal transformation needed
        addFields: {
          'version': '3.0',
        },
      },
      responseTransforms: {
        // Remove advanced features not supported in 2.1
        removeFields: [
          'aiInsights',
          'predictiveMetrics',
          'realTimeSubscriptions',
        ],
      },
    });

    logger.info('Transformation rules initialized', {
      ruleCount: this.transformationRules.size,
      supportedTransitions: Array.from(this.transformationRules.keys()),
    });
  }

  /**
   * Get version information
   */
  public getVersion(version: string): ApiVersion | undefined {
    return this.versions.get(version);
  }

  /**
   * Get all supported versions
   */
  public getSupportedVersions(): string[] {
    return Array.from(this.versions.keys());
  }

  /**
   * Get deprecated versions
   */
  public getDeprecatedVersions(): string[] {
    return Array.from(this.versions.values())
      .filter(v => v.deprecated)
      .map(v => v.version);
  }

  /**
   * Check if version is legacy (requires compatibility layer)
   */
  public isLegacyVersion(version: string): boolean {
    const versionInfo = this.versions.get(version);
    if (!versionInfo) return true; // Unknown versions are treated as legacy
    
    return this.compareVersions(version, config.compatibility.currentVersion) < 0;
  }

  /**
   * Check if version is supported
   */
  public isVersionSupported(version: string): boolean {
    const versionInfo = this.versions.get(version);
    if (!versionInfo) return false;
    
    return versionInfo.supportLevel !== 'eol' && 
           (!versionInfo.eolDate || versionInfo.eolDate > new Date());
  }

  /**
   * Check if version is deprecated
   */
  public isVersionDeprecated(version: string): boolean {
    const versionInfo = this.versions.get(version);
    return versionInfo?.deprecated || false;
  }

  /**
   * Check if version requires data transformation
   */
  public requiresTransformation(version: string): boolean {
    if (version === config.compatibility.currentVersion) return false;
    
    const transformKey = `${version}->${config.compatibility.currentVersion}`;
    return this.transformationRules.has(transformKey);
  }

  /**
   * Get version comparison information
   */
  public compareVersionInfo(clientVersion: string): VersionComparison {
    const versionInfo = this.versions.get(clientVersion);
    const isLegacy = this.isLegacyVersion(clientVersion);
    const isSupported = this.isVersionSupported(clientVersion);
    const isDeprecated = this.isVersionDeprecated(clientVersion);
    const requiresTransformation = this.requiresTransformation(clientVersion);

    let warningMessage: string | undefined;
    
    if (isDeprecated && versionInfo?.eolDate) {
      const daysUntilEol = Math.ceil(
        (versionInfo.eolDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilEol <= config.compatibility.eolWarningThreshold) {
        warningMessage = `API version ${clientVersion} will reach end-of-life in ${daysUntilEol} days. Please upgrade to version ${config.compatibility.currentVersion}.`;
      } else if (daysUntilEol <= config.compatibility.deprecatedWarningThreshold) {
        warningMessage = `API version ${clientVersion} is deprecated. Please consider upgrading to version ${config.compatibility.currentVersion}.`;
      }
    }

    return {
      isLegacy,
      isSupported,
      isDeprecated,
      requiresTransformation,
      recommendedVersion: config.compatibility.currentVersion,
      warningMessage,
    };
  }

  /**
   * Get transformation rules for version transition
   */
  public getTransformationRules(fromVersion: string, toVersion?: string): any {
    const targetVersion = toVersion || config.compatibility.currentVersion;
    const transformKey = `${fromVersion}->${targetVersion}`;
    return this.transformationRules.get(transformKey);
  }

  /**
   * Negotiate API version from client headers
   */
  public negotiateVersion(
    acceptVersionHeader?: string,
    clientVersionHeader?: string,
    userAgent?: string
  ): {
    version: string;
    isCompatible: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let negotiatedVersion = config.compatibility.currentVersion;

    // Priority order: Accept-Version header > Client-Version header > User-Agent parsing
    let requestedVersion: string | undefined;

    if (acceptVersionHeader) {
      requestedVersion = this.parseAcceptVersionHeader(acceptVersionHeader);
    } else if (clientVersionHeader) {
      requestedVersion = clientVersionHeader;
    } else if (userAgent) {
      requestedVersion = this.parseVersionFromUserAgent(userAgent);
    }

    if (requestedVersion) {
      const comparison = this.compareVersionInfo(requestedVersion);
      
      if (comparison.isSupported) {
        negotiatedVersion = requestedVersion;
        
        if (comparison.warningMessage) {
          warnings.push(comparison.warningMessage);
        }
        
        if (comparison.isLegacy) {
          warnings.push(`Using legacy API version ${requestedVersion}. Consider upgrading to ${config.compatibility.currentVersion} for better performance and features.`);
        }
      } else {
        warnings.push(`Requested version ${requestedVersion} is not supported. Using current version ${config.compatibility.currentVersion}.`);
      }
    }

    return {
      version: negotiatedVersion,
      isCompatible: true,
      warnings,
    };
  }

  /**
   * Parse Accept-Version header (e.g., "application/vnd.api+json;version=2.1")
   */
  private parseAcceptVersionHeader(header: string): string | undefined {
    const versionMatch = header.match(/version=([0-9.]+)/);
    return versionMatch?.[1];
  }

  /**
   * Parse version from User-Agent string
   */
  private parseVersionFromUserAgent(userAgent: string): string | undefined {
    // Look for patterns like "AIRIS-Client/2.1.0" or "AIRIS/2.1"
    const patterns = [
      /AIRIS[^/]*\/([0-9.]+)/i,
      /airis[^/]*client[^/]*\/([0-9.]+)/i,
      /version[\/\s]([0-9.]+)/i,
    ];

    for (const pattern of patterns) {
      const match = userAgent.match(pattern);
      if (match) {
        // Extract major.minor version
        const fullVersion = match[1];
        const majorMinor = fullVersion.split('.').slice(0, 2).join('.');
        return majorMinor;
      }
    }

    return undefined;
  }

  /**
   * Compare two version strings
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  /**
   * Get migration information for a version
   */
  public getMigrationInfo(fromVersion: string): {
    available: boolean;
    targetVersion: string;
    guideUrl?: string;
    breakingChanges: string[];
    estimatedEffort: 'low' | 'medium' | 'high';
  } {
    const versionInfo = this.versions.get(fromVersion);
    const currentVersionInfo = this.versions.get(config.compatibility.currentVersion);

    if (!versionInfo || !currentVersionInfo) {
      return {
        available: false,
        targetVersion: config.compatibility.currentVersion,
        breakingChanges: [],
        estimatedEffort: 'high',
      };
    }

    // Calculate estimated effort based on version gap and breaking changes
    const versionGap = this.compareVersions(config.compatibility.currentVersion, fromVersion);
    const breakingChanges = currentVersionInfo.breaking_changes || [];
    
    let estimatedEffort: 'low' | 'medium' | 'high' = 'low';
    if (versionGap >= 2 || breakingChanges.length > 3) {
      estimatedEffort = 'high';
    } else if (versionGap >= 1 || breakingChanges.length > 0) {
      estimatedEffort = 'medium';
    }

    return {
      available: true,
      targetVersion: config.compatibility.currentVersion,
      guideUrl: versionInfo.migration_guide,
      breakingChanges,
      estimatedEffort,
    };
  }
}