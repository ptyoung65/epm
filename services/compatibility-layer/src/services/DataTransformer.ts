import { logger } from '../utils/logger';
import { config } from '../config/environment';
import moment from 'moment';
import _ from 'lodash';
import { ApiVersionManager } from './ApiVersionManager';

/**
 * Data transformation interface
 */
export interface TransformationRule {
  requestTransforms?: {
    dateFields?: string[];
    dateFormat?: {
      from: string;
      to: string;
    };
    fieldMappings?: Record<string, string>;
    removeFields?: string[];
    addFields?: Record<string, any>;
  };
  responseTransforms?: {
    wrapper?: Record<string, any>;
    fieldMappings?: Record<string, string>;
    dateFields?: string[];
    dateFormat?: {
      from: string;
      to: string;
    };
    removeFields?: string[];
    addFields?: Record<string, any>;
  };
}

/**
 * Data Transformer Service
 * 
 * Handles data format transformation between different API versions
 */
export class DataTransformer {
  private transformationCache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  /**
   * Transform request data from one version to another
   */
  public async transformRequest(
    data: any,
    fromVersion: string,
    toVersion: string = config.compatibility.currentVersion
  ): Promise<any> {
    if (!data || fromVersion === toVersion) {
      return data;
    }

    const cacheKey = `request:${fromVersion}:${toVersion}:${JSON.stringify(data).substring(0, 100)}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      logger.debug('Using cached request transformation', {
        fromVersion,
        toVersion,
        cacheKey: cacheKey.substring(0, 50) + '...',
      });
      return cached;
    }

    try {
      const transformKey = `${fromVersion}->${toVersion}`;
      const rules = this.getTransformationRules(transformKey);
      
      if (!rules || !rules.requestTransforms) {
        logger.warn('No request transformation rules found', {
          fromVersion,
          toVersion,
          transformKey,
        });
        return data;
      }

      let transformed = _.cloneDeep(data);
      const transforms = rules.requestTransforms;

      // Apply field mappings
      if (transforms.fieldMappings) {
        transformed = this.applyFieldMappings(transformed, transforms.fieldMappings);
      }

      // Transform date fields
      if (transforms.dateFields && transforms.dateFormat) {
        transformed = this.transformDateFields(
          transformed,
          transforms.dateFields,
          transforms.dateFormat.from,
          transforms.dateFormat.to
        );
      }

      // Remove unwanted fields
      if (transforms.removeFields) {
        transformed = this.removeFields(transformed, transforms.removeFields);
      }

      // Add required fields
      if (transforms.addFields) {
        transformed = this.addFields(transformed, transforms.addFields);
      }

      // Cache the result
      this.setCache(cacheKey, transformed);

      logger.debug('Request data transformed', {
        fromVersion,
        toVersion,
        originalSize: JSON.stringify(data).length,
        transformedSize: JSON.stringify(transformed).length,
      });

      return transformed;
    } catch (error) {
      logger.error('Request transformation failed', {
        error: error.message,
        stack: error.stack,
        fromVersion,
        toVersion,
        data: JSON.stringify(data).substring(0, 200),
      });
      return data; // Return original data on transformation failure
    }
  }

  /**
   * Transform response data from one version to another
   */
  public async transformResponse(
    data: any,
    fromVersion: string,
    toVersion: string = config.compatibility.currentVersion
  ): Promise<any> {
    if (!data || fromVersion === toVersion) {
      return data;
    }

    const cacheKey = `response:${fromVersion}:${toVersion}:${JSON.stringify(data).substring(0, 100)}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      logger.debug('Using cached response transformation', {
        fromVersion,
        toVersion,
      });
      return cached;
    }

    try {
      const transformKey = `${toVersion}->${fromVersion}`; // Reverse for response
      const rules = this.getTransformationRules(transformKey);
      
      if (!rules || !rules.responseTransforms) {
        logger.warn('No response transformation rules found', {
          fromVersion,
          toVersion,
          transformKey,
        });
        return data;
      }

      let transformed = _.cloneDeep(data);
      const transforms = rules.responseTransforms;

      // Apply wrapper if needed
      if (transforms.wrapper) {
        transformed = this.applyWrapper(transformed, transforms.wrapper);
      }

      // Apply field mappings
      if (transforms.fieldMappings) {
        transformed = this.applyFieldMappings(transformed, transforms.fieldMappings);
      }

      // Transform date fields
      if (transforms.dateFields && transforms.dateFormat) {
        transformed = this.transformDateFields(
          transformed,
          transforms.dateFields,
          transforms.dateFormat.from,
          transforms.dateFormat.to
        );
      }

      // Remove unwanted fields
      if (transforms.removeFields) {
        transformed = this.removeFields(transformed, transforms.removeFields);
      }

      // Add required fields
      if (transforms.addFields) {
        transformed = this.addFields(transformed, transforms.addFields);
      }

      // Cache the result
      this.setCache(cacheKey, transformed);

      logger.debug('Response data transformed', {
        fromVersion,
        toVersion,
        originalSize: JSON.stringify(data).length,
        transformedSize: JSON.stringify(transformed).length,
      });

      return transformed;
    } catch (error) {
      logger.error('Response transformation failed', {
        error: error.message,
        stack: error.stack,
        fromVersion,
        toVersion,
        data: JSON.stringify(data).substring(0, 200),
      });
      return data; // Return original data on transformation failure
    }
  }

  /**
   * Apply field name mappings
   */
  private applyFieldMappings(data: any, mappings: Record<string, string>): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.applyFieldMappings(item, mappings));
    }

    const result: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      const newKey = mappings[key] || key;
      
      if (typeof value === 'object' && value !== null) {
        result[newKey] = this.applyFieldMappings(value, mappings);
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  /**
   * Transform date fields between formats
   */
  private transformDateFields(
    data: any,
    dateFields: string[],
    fromFormat: string,
    toFormat: string
  ): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.transformDateFields(item, dateFields, fromFormat, toFormat));
    }

    const result = _.cloneDeep(data);
    
    dateFields.forEach(field => {
      if (result[field]) {
        try {
          if (toFormat === 'ISO8601') {
            // Convert to ISO string
            const date = fromFormat === 'ISO8601' 
              ? new Date(result[field])
              : moment(result[field], fromFormat).toDate();
            result[field] = date.toISOString();
          } else if (fromFormat === 'ISO8601') {
            // Convert from ISO string to specific format
            result[field] = moment(result[field]).format(toFormat);
          } else {
            // Convert between specific formats
            result[field] = moment(result[field], fromFormat).format(toFormat);
          }
        } catch (error) {
          logger.warn('Date transformation failed for field', {
            field,
            value: result[field],
            fromFormat,
            toFormat,
            error: error.message,
          });
        }
      }
    });

    return result;
  }

  /**
   * Remove specified fields from data
   */
  private removeFields(data: any, fieldsToRemove: string[]): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.removeFields(item, fieldsToRemove));
    }

    const result = _.cloneDeep(data);
    
    fieldsToRemove.forEach(field => {
      if (field.includes('.')) {
        // Handle nested field paths
        _.unset(result, field);
      } else {
        delete result[field];
      }
    });

    return result;
  }

  /**
   * Add fields to data
   */
  private addFields(data: any, fieldsToAdd: Record<string, any>): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.addFields(item, fieldsToAdd));
    }

    const result = _.cloneDeep(data);
    
    Object.entries(fieldsToAdd).forEach(([field, value]) => {
      if (field.includes('.')) {
        // Handle nested field paths
        _.set(result, field, typeof value === 'function' ? value() : value);
      } else {
        result[field] = typeof value === 'function' ? value() : value;
      }
    });

    return result;
  }

  /**
   * Apply response wrapper
   */
  private applyWrapper(data: any, wrapper: Record<string, any>): any {
    const result: any = {};
    
    Object.entries(wrapper).forEach(([key, value]) => {
      if (typeof value === 'string' && value.startsWith('$.')) {
        // JSON path reference
        const path = value.substring(2);
        result[key] = _.get(data, path, data);
      } else if (typeof value === 'function') {
        result[key] = value();
      } else {
        result[key] = value;
      }
    });

    return result;
  }

  /**
   * Get transformation rules
   */
  private getTransformationRules(transformKey: string): TransformationRule | undefined {
    // This would typically come from ApiVersionManager or a dedicated rules service
    const versionManager = new ApiVersionManager();
    return versionManager.getTransformationRules(transformKey.split('->')[0], transformKey.split('->')[1]);
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.transformationCache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.transformationCache.get(key);
  }

  private setCache(key: string, value: any): void {
    this.transformationCache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
    
    // Clean up old cache entries occasionally
    if (this.transformationCache.size > 1000) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cacheExpiry.forEach((expiry, key) => {
      if (now > expiry) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.transformationCache.delete(key);
      this.cacheExpiry.delete(key);
    });
    
    logger.debug('Cache cleanup completed', {
      removedEntries: keysToDelete.length,
      remainingEntries: this.transformationCache.size,
    });
  }

  /**
   * Validate transformed data
   */
  public validateTransformation(
    originalData: any,
    transformedData: any,
    expectedSchema?: any
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic validation
      if (originalData && !transformedData) {
        errors.push('Transformed data is null or undefined');
      }

      if (typeof originalData !== typeof transformedData) {
        warnings.push(`Type changed from ${typeof originalData} to ${typeof transformedData}`);
      }

      if (Array.isArray(originalData) && Array.isArray(transformedData)) {
        if (originalData.length !== transformedData.length) {
          warnings.push(`Array length changed from ${originalData.length} to ${transformedData.length}`);
        }
      }

      // Schema validation (if provided)
      if (expectedSchema) {
        // This would integrate with a schema validation library like Joi or Ajv
        // For now, just a placeholder
        logger.debug('Schema validation not implemented yet');
      }

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get transformation statistics
   */
  public getStats(): {
    cacheSize: number;
    cacheHitRate: number;
    averageTransformationTime: number;
  } {
    return {
      cacheSize: this.transformationCache.size,
      cacheHitRate: 0, // Would need to track hits vs misses
      averageTransformationTime: 0, // Would need to track timing
    };
  }
}
