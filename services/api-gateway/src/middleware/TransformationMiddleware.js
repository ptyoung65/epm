const { Transform } = require('stream');
const zlib = require('zlib');
const Joi = require('joi');

class TransformationMiddleware {
  constructor(options = {}) {
    this.config = {
      maxBodySize: options.maxBodySize || 10 * 1024 * 1024, // 10MB
      enableCompression: options.enableCompression !== false,
      enableValidation: options.enableValidation !== false,
      enableSanitization: options.enableSanitization !== false,
      transformationRules: options.transformationRules || new Map()
    };

    // Default transformation rules for different content types
    this.setupDefaultTransformations();
  }

  setupDefaultTransformations() {
    // JSON transformation rules
    this.config.transformationRules.set('application/json', {
      request: {
        sanitize: this.sanitizeJson.bind(this),
        validate: this.validateJsonRequest.bind(this),
        transform: this.transformJsonRequest.bind(this)
      },
      response: {
        transform: this.transformJsonResponse.bind(this),
        compress: this.compressResponse.bind(this)
      }
    });

    // XML transformation rules (future enhancement)
    this.config.transformationRules.set('application/xml', {
      request: {
        sanitize: this.sanitizeXml.bind(this),
        validate: this.validateXmlRequest.bind(this),
        transform: this.transformXmlRequest.bind(this)
      },
      response: {
        transform: this.transformXmlResponse.bind(this)
      }
    });

    // Form data transformation rules
    this.config.transformationRules.set('application/x-www-form-urlencoded', {
      request: {
        sanitize: this.sanitizeFormData.bind(this),
        validate: this.validateFormRequest.bind(this),
        transform: this.transformFormRequest.bind(this)
      },
      response: {
        transform: this.transformJsonResponse.bind(this)
      }
    });
  }

  // Main middleware function
  middleware() {
    return (req, res, next) => {
      // Apply request transformations
      this.transformRequest(req, res)
        .then(() => {
          // Intercept response for transformation
          this.interceptResponse(req, res);
          next();
        })
        .catch(error => {
          req.app.get('logger')?.error('Request transformation failed:', error);
          res.status(400).json({
            error: 'Request transformation failed',
            code: 'TRANSFORMATION_ERROR',
            details: error.message
          });
        });
    };
  }

  // Transform incoming request
  async transformRequest(req, res) {
    const contentType = req.headers['content-type'] || 'application/json';
    const baseType = contentType.split(';')[0];
    const rules = this.config.transformationRules.get(baseType);

    if (!rules || !req.body) {
      return;
    }

    try {
      // Apply sanitization
      if (this.config.enableSanitization && rules.request.sanitize) {
        req.body = await rules.request.sanitize(req.body, req);
      }

      // Apply validation
      if (this.config.enableValidation && rules.request.validate) {
        const validation = await rules.request.validate(req.body, req);
        if (validation.error) {
          throw new Error(`Validation failed: ${validation.error.message}`);
        }
        req.body = validation.value || req.body;
      }

      // Apply transformation
      if (rules.request.transform) {
        req.body = await rules.request.transform(req.body, req);
      }

      // Add transformation metadata
      req.transformationMeta = {
        contentType: baseType,
        transformedAt: new Date().toISOString(),
        originalSize: JSON.stringify(req.originalBody || {}).length,
        transformedSize: JSON.stringify(req.body).length
      };

    } catch (error) {
      throw new Error(`Request transformation failed: ${error.message}`);
    }
  }

  // Intercept and transform response
  interceptResponse(req, res) {
    const originalSend = res.send;
    const originalJson = res.json;
    const self = this;

    // Override res.send
    res.send = function(data) {
      self.transformResponse(data, req, res)
        .then(transformedData => {
          originalSend.call(res, transformedData);
        })
        .catch(error => {
          req.app.get('logger')?.error('Response transformation failed:', error);
          originalSend.call(res, data); // Send original data if transformation fails
        });
    };

    // Override res.json
    res.json = function(data) {
      self.transformResponse(data, req, res)
        .then(transformedData => {
          try {
            const jsonData = typeof transformedData === 'string' 
              ? JSON.parse(transformedData) 
              : transformedData;
            originalJson.call(res, jsonData);
          } catch (error) {
            originalJson.call(res, data); // Fallback to original data
          }
        })
        .catch(error => {
          req.app.get('logger')?.error('Response transformation failed:', error);
          originalJson.call(res, data);
        });
    };
  }

  // Transform outgoing response
  async transformResponse(data, req, res) {
    const acceptHeader = req.headers['accept'] || 'application/json';
    const preferredType = this.getPreferredContentType(acceptHeader);
    const rules = this.config.transformationRules.get(preferredType);

    if (!rules || !rules.response.transform) {
      return data;
    }

    try {
      // Apply response transformation
      let transformedData = await rules.response.transform(data, req, res);

      // Apply compression if enabled and client supports it
      if (this.config.enableCompression && 
          req.headers['accept-encoding'] && 
          req.headers['accept-encoding'].includes('gzip')) {
        
        if (rules.response.compress) {
          transformedData = await rules.response.compress(transformedData);
          res.setHeader('Content-Encoding', 'gzip');
        }
      }

      // Add transformation metadata to headers
      if (req.transformationMeta) {
        res.setHeader('X-Request-Transformed', 'true');
        res.setHeader('X-Transformation-Time', req.transformationMeta.transformedAt);
        res.setHeader('X-Size-Reduction', 
          Math.round((1 - req.transformationMeta.transformedSize / req.transformationMeta.originalSize) * 100) + '%'
        );
      }

      return transformedData;
    } catch (error) {
      throw new Error(`Response transformation failed: ${error.message}`);
    }
  }

  // JSON specific transformations
  async sanitizeJson(data, req) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    // Remove potentially dangerous fields
    const sanitized = JSON.parse(JSON.stringify(data));
    this.removeDangerousFields(sanitized);
    this.sanitizeStrings(sanitized);
    
    return sanitized;
  }

  async validateJsonRequest(data, req) {
    // Get schema based on endpoint
    const schema = this.getValidationSchema(req.path, req.method);
    
    if (schema) {
      return schema.validate(data, { abortEarly: false, stripUnknown: true });
    }
    
    return { value: data };
  }

  async transformJsonRequest(data, req) {
    // Apply common transformations
    let transformed = { ...data };

    // Normalize timestamps
    transformed = this.normalizeTimestamps(transformed);
    
    // Apply field mapping based on API version
    if (req.apiVersion) {
      transformed = this.applyFieldMapping(transformed, req.apiVersion, 'request');
    }
    
    // Add request metadata
    transformed._meta = {
      requestId: req.id,
      timestamp: new Date().toISOString(),
      version: req.apiVersion,
      source: 'api-gateway'
    };

    return transformed;
  }

  async transformJsonResponse(data, req, res) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    let transformed = { ...data };

    // Apply field mapping based on API version
    if (req.apiVersion) {
      transformed = this.applyFieldMapping(transformed, req.apiVersion, 'response');
    }

    // Add response metadata
    transformed._meta = {
      ...transformed._meta,
      responseTime: Date.now() - (req.startTime || Date.now()),
      version: req.apiVersion,
      transformedAt: new Date().toISOString()
    };

    // Remove sensitive fields from response
    this.removeSensitiveFields(transformed);

    return transformed;
  }

  // XML transformations (placeholder)
  async sanitizeXml(data, req) {
    // XML sanitization logic
    return data;
  }

  async validateXmlRequest(data, req) {
    // XML validation logic
    return { value: data };
  }

  async transformXmlRequest(data, req) {
    // XML transformation logic
    return data;
  }

  async transformXmlResponse(data, req, res) {
    // XML response transformation logic
    return data;
  }

  // Form data transformations
  async sanitizeFormData(data, req) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  async validateFormRequest(data, req) {
    // Form validation logic
    return { value: data };
  }

  async transformFormRequest(data, req) {
    // Transform form data to JSON format
    return data;
  }

  // Compression
  async compressResponse(data) {
    return new Promise((resolve, reject) => {
      const input = typeof data === 'string' ? data : JSON.stringify(data);
      
      zlib.gzip(input, (err, compressed) => {
        if (err) {
          reject(err);
        } else {
          resolve(compressed);
        }
      });
    });
  }

  // Utility methods
  removeDangerousFields(obj) {
    const dangerousFields = ['__proto__', 'constructor', 'prototype', 'password', 'token', 'secret'];
    
    const removeFields = (item) => {
      if (Array.isArray(item)) {
        item.forEach(removeFields);
      } else if (typeof item === 'object' && item !== null) {
        dangerousFields.forEach(field => {
          delete item[field];
        });
        Object.values(item).forEach(removeFields);
      }
    };

    removeFields(obj);
  }

  sanitizeStrings(obj) {
    const sanitizeString = (str) => {
      return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    };

    const sanitize = (item) => {
      if (Array.isArray(item)) {
        return item.map(sanitize);
      } else if (typeof item === 'object' && item !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(item)) {
          sanitized[key] = sanitize(value);
        }
        return sanitized;
      } else if (typeof item === 'string') {
        return sanitizeString(item);
      }
      return item;
    };

    return sanitize(obj);
  }

  sanitizeString(str) {
    if (typeof str !== 'string') return str;
    
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '')
              .trim();
  }

  normalizeTimestamps(obj) {
    const timestampFields = ['timestamp', 'createdAt', 'updatedAt', 'date', 'time'];
    
    const normalize = (item) => {
      if (Array.isArray(item)) {
        return item.map(normalize);
      } else if (typeof item === 'object' && item !== null) {
        const normalized = {};
        for (const [key, value] of Object.entries(item)) {
          if (timestampFields.includes(key) && value) {
            normalized[key] = new Date(value).toISOString();
          } else {
            normalized[key] = normalize(value);
          }
        }
        return normalized;
      }
      return item;
    };

    return normalize(obj);
  }

  applyFieldMapping(data, version, direction) {
    // Field mapping rules for different API versions
    const mappings = {
      '1.0.0': {
        request: {
          'page_size': 'pageSize',
          'page_number': 'pageNumber'
        },
        response: {
          'pageSize': 'page_size',
          'pageNumber': 'page_number'
        }
      },
      '1.1.0': {
        request: {},
        response: {}
      },
      '2.0.0': {
        request: {
          'timestamp': 'eventTime',
          'user_id': 'userId'
        },
        response: {
          'eventTime': 'timestamp',
          'userId': 'user_id'
        }
      }
    };

    const versionMapping = mappings[version];
    if (!versionMapping || !versionMapping[direction]) {
      return data;
    }

    const mapping = versionMapping[direction];
    const mapped = { ...data };

    for (const [oldField, newField] of Object.entries(mapping)) {
      if (mapped.hasOwnProperty(oldField)) {
        mapped[newField] = mapped[oldField];
        delete mapped[oldField];
      }
    }

    return mapped;
  }

  removeSensitiveFields(obj) {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey', 'privateKey'];
    
    const removeSensitive = (item) => {
      if (Array.isArray(item)) {
        item.forEach(removeSensitive);
      } else if (typeof item === 'object' && item !== null) {
        sensitiveFields.forEach(field => {
          if (item.hasOwnProperty(field)) {
            item[field] = '[REDACTED]';
          }
        });
        Object.values(item).forEach(removeSensitive);
      }
    };

    removeSensitive(obj);
  }

  getPreferredContentType(acceptHeader) {
    // Simple content type negotiation
    if (acceptHeader.includes('application/json')) {
      return 'application/json';
    } else if (acceptHeader.includes('application/xml')) {
      return 'application/xml';
    }
    return 'application/json'; // Default
  }

  getValidationSchema(path, method) {
    // Define validation schemas for different endpoints
    const schemas = {
      '/api/metrics': {
        POST: Joi.object({
          name: Joi.string().required(),
          value: Joi.number().required(),
          tags: Joi.object(),
          timestamp: Joi.date().optional()
        })
      },
      '/api/logs': {
        POST: Joi.object({
          message: Joi.string().required(),
          level: Joi.string().valid('debug', 'info', 'warn', 'error').required(),
          service: Joi.string().required(),
          timestamp: Joi.date().optional()
        })
      }
    };

    // Try to match exact path first, then try pattern matching
    const exactMatch = schemas[path];
    if (exactMatch && exactMatch[method]) {
      return exactMatch[method];
    }

    // Pattern matching for dynamic routes
    for (const [pattern, methods] of Object.entries(schemas)) {
      if (this.matchesPattern(path, pattern) && methods[method]) {
        return methods[method];
      }
    }

    return null;
  }

  matchesPattern(path, pattern) {
    const pathParts = path.split('/');
    const patternParts = pattern.split('/');

    if (pathParts.length !== patternParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        continue; // Parameter - matches anything
      }
      if (pathParts[i] !== patternParts[i]) {
        return false;
      }
    }

    return true;
  }
}

module.exports = TransformationMiddleware;