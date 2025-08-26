const semver = require('semver');

class APIVersionManager {
  constructor() {
    // API version configurations
    this.versions = new Map([
      ['1.0.0', {
        status: 'active',
        routes: {
          '/api/v1/metrics': { service: 'metrics-service', endpoint: '/api/metrics' },
          '/api/v1/logs': { service: 'logs-service', endpoint: '/api/logs' },
          '/api/v1/traces': { service: 'traces-service', endpoint: '/api/traces' },
          '/api/v1/alerts': { service: 'alerts-service', endpoint: '/api/alerts' },
          '/api/v1/etl': { service: 'etl-pipeline', endpoint: '/api/etl' }
        },
        deprecated: false,
        sunsetDate: null,
        documentation: '/docs/v1.0.0'
      }],
      ['1.1.0', {
        status: 'active',
        routes: {
          '/api/v1.1/metrics': { service: 'metrics-service', endpoint: '/api/v2/metrics' },
          '/api/v1.1/logs': { service: 'logs-service', endpoint: '/api/v2/logs' },
          '/api/v1.1/traces': { service: 'traces-service', endpoint: '/api/v2/traces' },
          '/api/v1.1/alerts': { service: 'alerts-service', endpoint: '/api/v2/alerts' },
          '/api/v1.1/etl': { service: 'etl-pipeline', endpoint: '/api/v2/etl' }
        },
        deprecated: false,
        sunsetDate: null,
        documentation: '/docs/v1.1.0',
        changelog: [
          'Enhanced error responses with detailed codes',
          'Added pagination support for all list endpoints',
          'Improved filtering capabilities',
          'Added bulk operations for metrics and logs'
        ]
      }],
      ['2.0.0', {
        status: 'beta',
        routes: {
          '/api/v2/metrics': { service: 'metrics-service', endpoint: '/api/v3/metrics' },
          '/api/v2/logs': { service: 'logs-service', endpoint: '/api/v3/logs' },
          '/api/v2/traces': { service: 'traces-service', endpoint: '/api/v3/traces' },
          '/api/v2/alerts': { service: 'alerts-service', endpoint: '/api/v3/alerts' },
          '/api/v2/etl': { service: 'etl-pipeline', endpoint: '/api/v3/etl' },
          '/api/v2/analytics': { service: 'analytics-service', endpoint: '/api/analytics' }
        },
        deprecated: false,
        sunsetDate: null,
        documentation: '/docs/v2.0.0',
        changelog: [
          'Breaking: Restructured response formats',
          'Added real-time streaming endpoints',
          'New analytics and AI-powered insights',
          'GraphQL support for complex queries',
          'Enhanced security with OAuth 2.0',
          'Webhook support for event notifications'
        ]
      }]
    ]);

    // Version negotiation settings
    this.defaultVersion = '1.1.0';
    this.latestVersion = '2.0.0';
    this.supportedVersions = Array.from(this.versions.keys());
    
    // Deprecation timeline (in months)
    this.deprecationPeriod = 12;
    this.sunsetPeriod = 18;
  }

  // Extract version from request
  extractVersion(req) {
    // Priority order:
    // 1. Header: Accept-Version or API-Version
    // 2. Query parameter: version or api_version  
    // 3. URL path: /api/v1/... or /api/v1.1/...
    // 4. Default version

    // Check headers
    const acceptVersion = req.headers['accept-version'] || req.headers['api-version'];
    if (acceptVersion && this.isValidVersion(acceptVersion)) {
      return acceptVersion;
    }

    // Check query parameters
    const queryVersion = req.query.version || req.query.api_version;
    if (queryVersion && this.isValidVersion(queryVersion)) {
      return queryVersion;
    }

    // Extract from URL path
    const pathVersion = this.extractVersionFromPath(req.path);
    if (pathVersion && this.isValidVersion(pathVersion)) {
      return pathVersion;
    }

    // Return default version
    return this.defaultVersion;
  }

  // Extract version from URL path
  extractVersionFromPath(path) {
    const versionRegex = /^\/api\/v(\d+(?:\.\d+(?:\.\d+)?)?)/;
    const match = path.match(versionRegex);
    
    if (match) {
      const versionString = match[1];
      
      // Convert short versions to full semver
      if (versionString.match(/^\d+$/)) {
        return `${versionString}.0.0`;
      } else if (versionString.match(/^\d+\.\d+$/)) {
        return `${versionString}.0`;
      }
      
      return versionString;
    }
    
    return null;
  }

  // Validate version format and availability
  isValidVersion(version) {
    if (!semver.valid(version)) {
      return false;
    }
    
    return this.versions.has(version);
  }

  // Get version information
  getVersionInfo(version) {
    return this.versions.get(version);
  }

  // Check if version is deprecated
  isDeprecated(version) {
    const versionInfo = this.getVersionInfo(version);
    return versionInfo ? versionInfo.deprecated : false;
  }

  // Check if version is near sunset
  isNearSunset(version) {
    const versionInfo = this.getVersionInfo(version);
    if (!versionInfo || !versionInfo.sunsetDate) {
      return false;
    }
    
    const now = new Date();
    const sunsetDate = new Date(versionInfo.sunsetDate);
    const daysUntilSunset = Math.ceil((sunsetDate - now) / (1000 * 60 * 60 * 24));
    
    return daysUntilSunset <= 90; // Warning 90 days before sunset
  }

  // Get route mapping for version
  getRouteMapping(version, path) {
    const versionInfo = this.getVersionInfo(version);
    if (!versionInfo) {
      return null;
    }

    // Try exact path match first
    if (versionInfo.routes[path]) {
      return versionInfo.routes[path];
    }

    // Try pattern matching for dynamic routes
    for (const [routePath, mapping] of Object.entries(versionInfo.routes)) {
      if (this.matchesRoute(path, routePath)) {
        return mapping;
      }
    }

    return null;
  }

  // Match dynamic routes (e.g., /api/v1/metrics/:id)
  matchesRoute(actualPath, routePattern) {
    const patternSegments = routePattern.split('/');
    const pathSegments = actualPath.split('/');

    if (patternSegments.length !== pathSegments.length) {
      return false;
    }

    for (let i = 0; i < patternSegments.length; i++) {
      const pattern = patternSegments[i];
      const segment = pathSegments[i];

      if (pattern.startsWith(':')) {
        continue; // Parameter segment - matches anything
      }

      if (pattern !== segment) {
        return false;
      }
    }

    return true;
  }

  // Transform request based on version
  transformRequest(req, version) {
    const versionInfo = this.getVersionInfo(version);
    if (!versionInfo) {
      throw new Error(`Unsupported API version: ${version}`);
    }

    const transformedReq = { ...req };

    // Version-specific request transformations
    switch (version) {
      case '1.0.0':
        // Legacy format support
        this.transformV1Request(transformedReq);
        break;
      
      case '1.1.0':
        // Enhanced format with pagination
        this.transformV1_1Request(transformedReq);
        break;
      
      case '2.0.0':
        // New format with extended capabilities
        this.transformV2Request(transformedReq);
        break;
      
      default:
        // No transformation needed
        break;
    }

    return transformedReq;
  }

  // Transform response based on version
  transformResponse(response, version, req) {
    const versionInfo = this.getVersionInfo(version);
    if (!versionInfo) {
      return response;
    }

    let transformedResponse = { ...response };

    // Add version headers
    if (response.headers) {
      response.headers['API-Version'] = version;
      response.headers['API-Status'] = versionInfo.status;
      
      if (this.isDeprecated(version)) {
        response.headers['Deprecated'] = 'true';
        response.headers['Sunset'] = versionInfo.sunsetDate || 'TBD';
        response.headers['Link'] = `</docs/${version}>; rel="deprecation"`;
      }

      if (this.isNearSunset(version)) {
        response.headers['Warning'] = `299 - "API version ${version} will be sunset on ${versionInfo.sunsetDate}"`;
      }
    }

    // Version-specific response transformations
    switch (version) {
      case '1.0.0':
        transformedResponse = this.transformV1Response(transformedResponse);
        break;
      
      case '1.1.0':
        transformedResponse = this.transformV1_1Response(transformedResponse);
        break;
      
      case '2.0.0':
        transformedResponse = this.transformV2Response(transformedResponse);
        break;
    }

    return transformedResponse;
  }

  // Version-specific transformations
  transformV1Request(req) {
    // Convert new parameter names to legacy format
    if (req.query) {
      if (req.query.pageSize) {
        req.query.limit = req.query.pageSize;
        delete req.query.pageSize;
      }
      if (req.query.pageNumber) {
        req.query.offset = (req.query.pageNumber - 1) * (req.query.limit || 10);
        delete req.query.pageNumber;
      }
    }
  }

  transformV1_1Request(req) {
    // Enhanced request format with proper pagination
    if (req.query) {
      // Ensure pagination parameters are properly formatted
      if (req.query.page && req.query.size) {
        req.query.offset = (parseInt(req.query.page) - 1) * parseInt(req.query.size);
        req.query.limit = parseInt(req.query.size);
      }
    }
  }

  transformV2Request(req) {
    // Future format - no transformation needed yet
    // Add GraphQL query support, streaming parameters, etc.
  }

  transformV1Response(response) {
    // Legacy response format
    if (response.data && Array.isArray(response.data)) {
      return {
        success: true,
        count: response.data.length,
        results: response.data,
        timestamp: new Date().toISOString()
      };
    }
    return response;
  }

  transformV1_1Response(response) {
    // Enhanced response format with pagination metadata
    if (response.data && Array.isArray(response.data)) {
      return {
        success: true,
        data: response.data,
        pagination: {
          total: response.total || response.data.length,
          page: response.page || 1,
          size: response.size || response.data.length,
          pages: Math.ceil((response.total || response.data.length) / (response.size || response.data.length))
        },
        timestamp: new Date().toISOString()
      };
    }
    return response;
  }

  transformV2Response(response) {
    // Future response format with enhanced metadata
    return {
      ...response,
      meta: {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        requestId: response.requestId || 'unknown'
      }
    };
  }

  // Get all supported versions
  getSupportedVersions() {
    return Array.from(this.versions.entries()).map(([version, info]) => ({
      version,
      status: info.status,
      deprecated: info.deprecated,
      sunsetDate: info.sunsetDate,
      documentation: info.documentation
    }));
  }

  // Deprecate a version
  deprecateVersion(version, sunsetDate = null) {
    const versionInfo = this.versions.get(version);
    if (!versionInfo) {
      throw new Error(`Version ${version} not found`);
    }

    versionInfo.deprecated = true;
    versionInfo.status = 'deprecated';
    
    if (sunsetDate) {
      versionInfo.sunsetDate = sunsetDate;
    }

    this.versions.set(version, versionInfo);
    
    return true;
  }

  // Add new version
  addVersion(version, config) {
    if (!semver.valid(version)) {
      throw new Error(`Invalid version format: ${version}`);
    }

    if (this.versions.has(version)) {
      throw new Error(`Version ${version} already exists`);
    }

    this.versions.set(version, {
      status: config.status || 'active',
      routes: config.routes || {},
      deprecated: false,
      sunsetDate: null,
      documentation: config.documentation || `/docs/${version}`,
      changelog: config.changelog || []
    });

    this.supportedVersions = Array.from(this.versions.keys());
    
    return true;
  }

  // Get version compatibility matrix
  getCompatibilityMatrix() {
    const matrix = {};
    
    for (const version of this.supportedVersions) {
      matrix[version] = {
        backwardCompatible: this.getBackwardCompatibleVersions(version),
        forwardCompatible: this.getForwardCompatibleVersions(version)
      };
    }
    
    return matrix;
  }

  // Get backward compatible versions
  getBackwardCompatibleVersions(version) {
    return this.supportedVersions.filter(v => 
      semver.gte(version, v) && semver.major(version) === semver.major(v)
    );
  }

  // Get forward compatible versions  
  getForwardCompatibleVersions(version) {
    return this.supportedVersions.filter(v => 
      semver.gte(v, version) && semver.major(version) === semver.major(v)
    );
  }
}

module.exports = APIVersionManager;