/**
 * CDN Integration and Static Resource Optimization
 * AIRIS EPM - Enterprise Performance Management
 * CDN 통합 및 정적 자원 최적화 시스템
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

// CDN 제공자 인터페이스
export class CDNProvider {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  async upload(file, options = {}) {
    throw new Error('upload method must be implemented');
  }

  async delete(key) {
    throw new Error('delete method must be implemented');
  }

  async invalidate(paths) {
    throw new Error('invalidate method must be implemented');
  }

  getUrl(key) {
    throw new Error('getUrl method must be implemented');
  }

  async getStats() {
    throw new Error('getStats method must be implemented');
  }
}

// AWS CloudFront CDN 제공자
export class CloudFrontProvider extends CDNProvider {
  constructor(config) {
    super('cloudfront', config);
    this.distributionId = config.distributionId;
    this.bucketName = config.bucketName;
    this.region = config.region;
    this.domainName = config.domainName;
  }

  async upload(file, options = {}) {
    try {
      const key = options.key || this.generateKey(file.name);
      const contentType = this.getContentType(file.name);
      
      // S3 업로드 시뮬레이션
      const result = {
        key,
        url: this.getUrl(key),
        size: file.size,
        contentType,
        etag: this.generateETag(file.content),
        uploadedAt: new Date().toISOString()
      };
      
      console.log(`Uploaded ${file.name} to CloudFront: ${result.url}`);
      return result;
    } catch (error) {
      console.error('CloudFront upload failed:', error);
      throw error;
    }
  }

  async delete(key) {
    try {
      console.log(`Deleted ${key} from CloudFront`);
      return { deleted: true, key };
    } catch (error) {
      console.error('CloudFront delete failed:', error);
      throw error;
    }
  }

  async invalidate(paths) {
    try {
      const invalidationId = `inv_${Date.now()}`;
      console.log(`Created invalidation ${invalidationId} for paths:`, paths);
      
      return {
        invalidationId,
        paths,
        status: 'InProgress',
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('CloudFront invalidation failed:', error);
      throw error;
    }
  }

  getUrl(key) {
    return `https://${this.domainName}/${key}`;
  }

  async getStats() {
    return {
      provider: 'cloudfront',
      distributionId: this.distributionId,
      domainName: this.domainName,
      requestCount: Math.floor(Math.random() * 1000000),
      dataTransfer: Math.floor(Math.random() * 1000) + ' GB',
      cacheHitRate: (Math.random() * 30 + 70).toFixed(2) + '%'
    };
  }

  generateKey(filename) {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(filename + timestamp).digest('hex').substring(0, 8);
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    return `assets/${timestamp}/${name}_${hash}${ext}`;
  }

  generateETag(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };
    return contentTypes[ext] || 'application/octet-stream';
  }
}

// Cloudflare CDN 제공자
export class CloudflareProvider extends CDNProvider {
  constructor(config) {
    super('cloudflare', config);
    this.zoneId = config.zoneId;
    this.apiToken = config.apiToken;
    this.domainName = config.domainName;
  }

  async upload(file, options = {}) {
    try {
      const key = options.key || this.generateKey(file.name);
      
      const result = {
        key,
        url: this.getUrl(key),
        size: file.size,
        contentType: this.getContentType(file.name),
        uploadedAt: new Date().toISOString()
      };
      
      console.log(`Uploaded ${file.name} to Cloudflare: ${result.url}`);
      return result;
    } catch (error) {
      console.error('Cloudflare upload failed:', error);
      throw error;
    }
  }

  async delete(key) {
    try {
      console.log(`Deleted ${key} from Cloudflare`);
      return { deleted: true, key };
    } catch (error) {
      console.error('Cloudflare delete failed:', error);
      throw error;
    }
  }

  async invalidate(paths) {
    try {
      console.log(`Purged cache for paths:`, paths);
      
      return {
        success: true,
        paths,
        purgedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Cloudflare purge failed:', error);
      throw error;
    }
  }

  getUrl(key) {
    return `https://${this.domainName}/${key}`;
  }

  async getStats() {
    return {
      provider: 'cloudflare',
      zoneId: this.zoneId,
      domainName: this.domainName,
      requestCount: Math.floor(Math.random() * 2000000),
      bandwidth: Math.floor(Math.random() * 500) + ' GB',
      cacheRatio: (Math.random() * 20 + 75).toFixed(2) + '%',
      threats: Math.floor(Math.random() * 1000)
    };
  }

  generateKey(filename) {
    const timestamp = Date.now();
    const hash = crypto.createHash('sha1').update(filename + timestamp).digest('hex').substring(0, 10);
    return `static/${hash}/${filename}`;
  }

  getContentType(filename) {
    // CloudFrontProvider와 동일한 로직 재사용
    return new CloudFrontProvider({}).getContentType(filename);
  }
}

// 자원 최적화기
export class ResourceOptimizer {
  constructor(options = {}) {
    this.options = {
      enableMinification: options.enableMinification !== false,
      enableCompression: options.enableCompression !== false,
      enableImageOptimization: options.enableImageOptimization !== false,
      compressionLevel: options.compressionLevel || 6,
      imageQuality: options.imageQuality || 85,
      ...options
    };
    
    this.cache = new Map();
    this.stats = {
      processed: 0,
      totalSaved: 0,
      minified: 0,
      compressed: 0,
      optimized: 0
    };
  }

  // 파일 최적화
  async optimize(file) {
    const ext = path.extname(file.name).toLowerCase();
    const optimizationResult = {
      originalSize: file.size,
      optimizedSize: file.size,
      saved: 0,
      techniques: []
    };

    try {
      let optimizedContent = file.content;

      // 텍스트 파일 최적화
      if (this.isTextFile(ext)) {
        if (this.options.enableMinification) {
          optimizedContent = await this.minify(optimizedContent, ext);
          optimizationResult.techniques.push('minification');
          this.stats.minified++;
        }

        if (this.options.enableCompression) {
          optimizedContent = await this.compress(optimizedContent);
          optimizationResult.techniques.push('compression');
          this.stats.compressed++;
        }
      }

      // 이미지 최적화
      if (this.isImageFile(ext) && this.options.enableImageOptimization) {
        optimizedContent = await this.optimizeImage(optimizedContent, ext);
        optimizationResult.techniques.push('image-optimization');
        this.stats.optimized++;
      }

      // 결과 계산
      optimizationResult.optimizedSize = optimizedContent.length;
      optimizationResult.saved = optimizationResult.originalSize - optimizationResult.optimizedSize;
      optimizationResult.savingPercentage = ((optimizationResult.saved / optimizationResult.originalSize) * 100).toFixed(2);

      this.stats.processed++;
      this.stats.totalSaved += optimizationResult.saved;

      return {
        ...file,
        content: optimizedContent,
        size: optimizationResult.optimizedSize,
        optimization: optimizationResult
      };
    } catch (error) {
      console.error('Resource optimization failed:', error);
      return file; // 원본 반환
    }
  }

  // 텍스트 파일 여부 확인
  isTextFile(ext) {
    return ['.js', '.css', '.html', '.json', '.svg'].includes(ext);
  }

  // 이미지 파일 여부 확인
  isImageFile(ext) {
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  }

  // 파일 압축 (간단한 시뮬레이션)
  async minify(content, ext) {
    // 실제로는 terser, csso, html-minifier 등 사용
    let minified = content;

    if (ext === '.js') {
      // JavaScript 간단 최적화
      minified = minified
        .replace(/\/\*[\s\S]*?\*\//g, '') // 주석 제거
        .replace(/\/\/.*$/gm, '') // 한 줄 주석 제거
        .replace(/\s+/g, ' ') // 공백 최적화
        .trim();
    } else if (ext === '.css') {
      // CSS 간단 최적화
      minified = minified
        .replace(/\/\*[\s\S]*?\*\//g, '') // 주석 제거
        .replace(/\s+/g, ' ') // 공백 최적화
        .replace(/;\s*}/g, '}') // 세미콜론 최적화
        .trim();
    } else if (ext === '.html') {
      // HTML 간단 최적화
      minified = minified
        .replace(/<!--[\s\S]*?-->/g, '') // 주석 제거
        .replace(/\s+/g, ' ') // 공백 최적화
        .replace(/>\s+</g, '><') // 태그 간 공백 제거
        .trim();
    }

    return minified;
  }

  // 압축 (시뮬레이션)
  async compress(content) {
    // 실제로는 gzip, brotli 등 사용
    // 여기서는 단순 시뮬레이션
    const compressionRatio = 0.7; // 30% 압축률
    return content.substring(0, Math.floor(content.length * compressionRatio));
  }

  // 이미지 최적화 (시뮬레이션)
  async optimizeImage(content, ext) {
    // 실제로는 sharp, imagemin 등 사용
    const optimizationRatio = 0.8; // 20% 크기 감소
    return content.substring(0, Math.floor(content.length * optimizationRatio));
  }

  // 통계 조회
  getStats() {
    return {
      ...this.stats,
      averageSavings: this.stats.processed > 0 ? this.stats.totalSaved / this.stats.processed : 0
    };
  }
}

// CDN 관리자
export class CDNManager {
  constructor(options = {}) {
    this.providers = new Map();
    this.optimizer = new ResourceOptimizer(options.optimization || {});
    this.primaryProvider = null;
    this.fallbackProvider = null;
    
    this.options = {
      enableOptimization: options.enableOptimization !== false,
      enableMultiCDN: options.enableMultiCDN === true,
      cacheHeaders: options.cacheHeaders || {
        'Cache-Control': 'public, max-age=31536000', // 1년
        'Expires': new Date(Date.now() + 31536000000).toUTCString()
      },
      ...options
    };
    
    this.stats = {
      uploads: 0,
      deletes: 0,
      invalidations: 0,
      bandwidth: 0,
      errors: 0
    };
    
    this.uploadHistory = [];
    this.errorLog = [];
  }

  // CDN 제공자 등록
  addProvider(provider, isPrimary = false, isFallback = false) {
    this.providers.set(provider.name, provider);
    
    if (isPrimary) {
      this.primaryProvider = provider.name;
    }
    
    if (isFallback) {
      this.fallbackProvider = provider.name;
    }
    
    console.log(`Added CDN provider: ${provider.name}`);
  }

  // 제공자 조회
  getProvider(name = null) {
    if (name) {
      return this.providers.get(name);
    }
    
    // 기본 제공자 반환
    if (this.primaryProvider) {
      return this.providers.get(this.primaryProvider);
    }
    
    // 첫 번째 제공자 반환
    return this.providers.values().next().value;
  }

  // 파일 업로드
  async upload(file, options = {}) {
    const startTime = Date.now();
    
    try {
      let processedFile = file;
      
      // 자원 최적화
      if (this.options.enableOptimization) {
        processedFile = await this.optimizer.optimize(file);
      }
      
      // 주 제공자로 업로드 시도
      const provider = this.getProvider(options.provider);
      if (!provider) {
        throw new Error('No CDN provider available');
      }
      
      const uploadOptions = {
        ...options,
        cacheHeaders: this.options.cacheHeaders
      };
      
      const result = await provider.upload(processedFile, uploadOptions);
      
      // 멀티 CDN 설정시 백업 업로드
      if (this.options.enableMultiCDN && this.fallbackProvider && options.provider !== this.fallbackProvider) {
        try {
          const fallbackProvider = this.getProvider(this.fallbackProvider);
          await fallbackProvider.upload(processedFile, uploadOptions);
          result.fallbackUrl = fallbackProvider.getUrl(result.key);
        } catch (fallbackError) {
          console.warn('Fallback CDN upload failed:', fallbackError);
          result.fallbackError = fallbackError.message;
        }
      }
      
      // 업로드 기록
      const uploadRecord = {
        file: file.name,
        provider: provider.name,
        key: result.key,
        url: result.url,
        size: processedFile.size,
        originalSize: file.size,
        optimization: processedFile.optimization,
        uploadTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
      
      this.uploadHistory.push(uploadRecord);
      this.stats.uploads++;
      this.stats.bandwidth += processedFile.size;
      
      // 기록 제한
      if (this.uploadHistory.length > 1000) {
        this.uploadHistory.splice(0, this.uploadHistory.length - 1000);
      }
      
      return {
        ...result,
        uploadTime: uploadRecord.uploadTime,
        optimization: processedFile.optimization
      };
    } catch (error) {
      this.stats.errors++;
      this.errorLog.push({
        operation: 'upload',
        file: file.name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.error('CDN upload failed:', error);
      throw error;
    }
  }

  // 배치 업로드
  async uploadBatch(files, options = {}) {
    const results = [];
    const concurrency = options.concurrency || 5;
    
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const promises = batch.map(file => this.upload(file, options));
      
      try {
        const batchResults = await Promise.allSettled(promises);
        results.push(...batchResults);
      } catch (error) {
        console.error('Batch upload error:', error);
      }
    }
    
    return results;
  }

  // 파일 삭제
  async delete(key, options = {}) {
    try {
      const provider = this.getProvider(options.provider);
      const result = await provider.delete(key);
      
      // 멀티 CDN에서 삭제
      if (this.options.enableMultiCDN) {
        const deletePromises = [];
        
        for (const [name, p] of this.providers.entries()) {
          if (name !== provider.name) {
            deletePromises.push(
              p.delete(key).catch(err => 
                console.warn(`Delete from ${name} failed:`, err)
              )
            );
          }
        }
        
        await Promise.allSettled(deletePromises);
      }
      
      this.stats.deletes++;
      return result;
    } catch (error) {
      this.stats.errors++;
      this.errorLog.push({
        operation: 'delete',
        key,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  // 캐시 무효화
  async invalidate(paths, options = {}) {
    try {
      const results = [];
      const providers = options.provider ? [options.provider] : Array.from(this.providers.keys());
      
      for (const providerName of providers) {
        const provider = this.getProvider(providerName);
        if (provider) {
          try {
            const result = await provider.invalidate(paths);
            results.push({ provider: providerName, ...result });
          } catch (error) {
            console.error(`Invalidation failed for ${providerName}:`, error);
            results.push({ 
              provider: providerName, 
              error: error.message,
              success: false
            });
          }
        }
      }
      
      this.stats.invalidations++;
      return results;
    } catch (error) {
      this.stats.errors++;
      this.errorLog.push({
        operation: 'invalidate',
        paths,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  // URL 생성
  getUrl(key, options = {}) {
    const provider = this.getProvider(options.provider);
    if (!provider) {
      throw new Error('No CDN provider available');
    }
    
    return provider.getUrl(key);
  }

  // 모든 제공자의 통계 조회
  async getAllStats() {
    const providerStats = {};
    
    for (const [name, provider] of this.providers.entries()) {
      try {
        providerStats[name] = await provider.getStats();
      } catch (error) {
        providerStats[name] = { error: error.message };
      }
    }
    
    return {
      manager: this.stats,
      optimization: this.optimizer.getStats(),
      providers: providerStats,
      uploadHistory: this.uploadHistory.slice(-100), // 최근 100개
      errorLog: this.errorLog.slice(-50) // 최근 50개
    };
  }

  // 성능 보고서 생성
  async generatePerformanceReport() {
    const stats = await this.getAllStats();
    const recommendations = [];
    
    // 최적화 성과 분석
    const optStats = stats.optimization;
    if (optStats.processed > 0) {
      const avgSavings = (optStats.totalSaved / optStats.processed / 1024).toFixed(2);
      recommendations.push({
        type: 'optimization',
        message: `평균 ${avgSavings}KB 절약됨. 최적화가 효과적으로 작동중입니다.`,
        priority: 'info'
      });
    }
    
    // 오류율 분석
    const errorRate = this.stats.uploads > 0 ? (this.stats.errors / this.stats.uploads) * 100 : 0;
    if (errorRate > 5) {
      recommendations.push({
        type: 'error_rate',
        message: `오류율이 ${errorRate.toFixed(2)}%입니다. CDN 설정을 확인해주세요.`,
        priority: 'high'
      });
    }
    
    // 대역폭 사용량 분석
    const bandwidthGB = (this.stats.bandwidth / 1024 / 1024 / 1024).toFixed(2);
    if (bandwidthGB > 100) {
      recommendations.push({
        type: 'bandwidth',
        message: `대역폭 사용량이 ${bandwidthGB}GB입니다. 비용 최적화를 고려하세요.`,
        priority: 'medium'
      });
    }
    
    return {
      timestamp: new Date().toISOString(),
      stats,
      recommendations,
      summary: {
        totalUploads: this.stats.uploads,
        totalDeletes: this.stats.deletes,
        totalBandwidth: `${bandwidthGB}GB`,
        errorRate: `${errorRate.toFixed(2)}%`,
        optimizationSavings: `${(optStats.totalSaved / 1024 / 1024).toFixed(2)}MB`
      }
    };
  }

  // 헬스체크
  async health() {
    const healthStatus = {
      status: 'healthy',
      providers: {},
      issues: []
    };
    
    // 각 제공자 헬스체크
    for (const [name, provider] of this.providers.entries()) {
      try {
        const stats = await provider.getStats();
        healthStatus.providers[name] = { status: 'healthy', stats };
      } catch (error) {
        healthStatus.providers[name] = { status: 'error', error: error.message };
        healthStatus.issues.push(`Provider ${name} is unhealthy: ${error.message}`);
      }
    }
    
    // 전체 상태 결정
    const errorCount = Object.values(healthStatus.providers).filter(p => p.status === 'error').length;
    if (errorCount === this.providers.size) {
      healthStatus.status = 'critical';
    } else if (errorCount > 0) {
      healthStatus.status = 'warning';
    }
    
    // 최근 오류율 확인
    const recentErrors = this.errorLog.filter(e => 
      Date.now() - new Date(e.timestamp).getTime() < 300000 // 5분
    ).length;
    
    if (recentErrors > 10) {
      healthStatus.status = 'warning';
      healthStatus.issues.push(`High error rate: ${recentErrors} errors in last 5 minutes`);
    }
    
    return healthStatus;
  }
}

export default {
  CDNProvider,
  CloudFrontProvider,
  CloudflareProvider,
  ResourceOptimizer,
  CDNManager
};