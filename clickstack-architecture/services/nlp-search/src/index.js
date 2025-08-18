/**
 * Natural Language Processing Search Engine for AIRIS-MON
 * Korean-optimized semantic search across logs, metrics, and traces
 */

const EventEmitter = require('events');
const logger = require('./utils/logger');

class NLPSearchEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxResults: config.maxResults || 50,
      searchTimeoutMs: config.searchTimeoutMs || 30000,
      minSimilarity: config.minSimilarity || 0.3,
      cacheExpiryMs: config.cacheExpiryMs || 300000, // 5 minutes
      enableKoreanNLP: config.enableKoreanNLP !== false,
      koreanDictionary: config.koreanDictionary || 'default',
      ...config
    };

    this.clickhouseService = null;
    this.redisService = null;
    
    this.searchCache = new Map();
    this.queryAnalyzer = new KoreanQueryAnalyzer();
    this.semanticProcessor = new SemanticProcessor();
    
    this.metrics = {
      totalSearches: 0,
      cacheHits: 0,
      avgResponseTime: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.isRunning = false;

    // Korean technical terms dictionary
    this.koreanTechTerms = {
      '서버': ['server', 'instance', 'node'],
      '데이터베이스': ['database', 'db', 'mysql', 'postgresql'],
      '메모리': ['memory', 'ram', 'heap'],
      '디스크': ['disk', 'storage', 'ssd', 'hdd'],
      '네트워크': ['network', 'tcp', 'udp', 'http'],
      '오류': ['error', 'exception', 'fail'],
      '응답시간': ['response_time', 'latency', 'duration'],
      '사용률': ['usage', 'utilization', 'percent'],
      '처리량': ['throughput', 'tps', 'qps'],
      '장애': ['failure', 'outage', 'incident'],
      '알림': ['alert', 'notification', 'alarm'],
      '모니터링': ['monitoring', 'observe', 'metric'],
      '로그': ['log', 'trace', 'event'],
      '성능': ['performance', 'perf', 'speed'],
      '부하': ['load', 'stress', 'pressure']
    };
  }

  /**
   * Initialize with required services
   */
  async initialize(services) {
    this.clickhouseService = services.clickhouse;
    this.redisService = services.redis;

    if (!this.clickhouseService) {
      throw new Error('ClickHouse 서비스가 필요합니다');
    }

    // Initialize NLP components
    await this.queryAnalyzer.initialize(this.config);
    await this.semanticProcessor.initialize(this.config);

    logger.info('자연어 검색 엔진 초기화됨', {
      service: 'nlp-search',
      koreanNLP: this.config.enableKoreanNLP,
      maxResults: this.config.maxResults
    });
  }

  async start() {
    try {
      logger.info('자연어 검색 엔진 시작 중...', { service: 'nlp-search' });
      
      this.isRunning = true;
      
      // Start cache cleanup
      this.startCacheCleanup();
      
      logger.info('자연어 검색 엔진이 시작되었습니다', { 
        service: 'nlp-search',
        config: this.config
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('자연어 검색 엔진 시작 실패', {
        error: error.message,
        service: 'nlp-search'
      });
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('자연어 검색 엔진 종료 중...', { service: 'nlp-search' });
      
      this.isRunning = false;
      
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      logger.info('자연어 검색 엔진이 종료되었습니다', { service: 'nlp-search' });

    } catch (error) {
      this.metrics.errors++;
      logger.error('자연어 검색 엔진 종료 중 오류', {
        error: error.message,
        service: 'nlp-search'
      });
    }
  }

  /**
   * Search using natural language query
   */
  async search(query, options = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('자연어 검색 시작', {
        query: query.substring(0, 100),
        service: 'nlp-search'
      });

      // Check cache first
      const cacheKey = this.generateCacheKey(query, options);
      const cachedResult = this.searchCache.get(cacheKey);
      
      if (cachedResult && Date.now() - cachedResult.timestamp < this.config.cacheExpiryMs) {
        this.metrics.cacheHits++;
        logger.debug('캐시에서 검색 결과 반환', {
          query: query.substring(0, 50),
          cacheAge: Date.now() - cachedResult.timestamp,
          service: 'nlp-search'
        });
        return cachedResult.data;
      }

      // Analyze the natural language query
      const queryAnalysis = await this.queryAnalyzer.analyze(query);
      
      // Generate search strategy based on analysis
      const searchStrategy = this.generateSearchStrategy(queryAnalysis, options);
      
      // Execute search across different data sources
      const searchResults = await this.executeSearch(searchStrategy);
      
      // Apply semantic ranking and filtering
      const rankedResults = await this.semanticProcessor.rankResults(searchResults, queryAnalysis);
      
      // Build final response
      const result = {
        query: query,
        query_analysis: queryAnalysis,
        search_strategy: searchStrategy,
        results: rankedResults.slice(0, this.config.maxResults),
        total_found: rankedResults.length,
        processing_time_ms: Date.now() - startTime,
        timestamp: Date.now(),
        korean_timestamp: new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul'
        }),
        suggestions: this.generateSuggestions(queryAnalysis, rankedResults)
      };

      // Cache the result
      this.searchCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      this.metrics.totalSearches++;
      this.updateAverageResponseTime(Date.now() - startTime);

      logger.info('자연어 검색 완료', {
        query: query.substring(0, 50),
        resultsFound: result.total_found,
        processingTime: result.processing_time_ms,
        service: 'nlp-search'
      });

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('자연어 검색 실패', {
        query: query.substring(0, 100),
        error: error.message,
        service: 'nlp-search'
      });
      throw error;
    }
  }

  /**
   * Generate search strategy based on query analysis
   */
  generateSearchStrategy(queryAnalysis, options) {
    const strategy = {
      search_types: [],
      time_range: options.timeRange || this.extractTimeRange(queryAnalysis),
      filters: this.extractFilters(queryAnalysis),
      sort_criteria: this.extractSortCriteria(queryAnalysis),
      korean_context: this.extractKoreanContext(queryAnalysis)
    };

    // Determine what to search based on query intent
    if (queryAnalysis.intent.includes('log') || queryAnalysis.entities.includes('로그')) {
      strategy.search_types.push('logs');
    }
    if (queryAnalysis.intent.includes('metric') || queryAnalysis.entities.includes('메트릭')) {
      strategy.search_types.push('metrics');
    }
    if (queryAnalysis.intent.includes('trace') || queryAnalysis.entities.includes('트레이스')) {
      strategy.search_types.push('traces');
    }
    if (queryAnalysis.intent.includes('alert') || queryAnalysis.entities.includes('알림')) {
      strategy.search_types.push('alerts');
    }

    // Default to searching everything if no specific type detected
    if (strategy.search_types.length === 0) {
      strategy.search_types = ['logs', 'metrics', 'traces', 'alerts'];
    }

    return strategy;
  }

  /**
   * Execute search across different data sources
   */
  async executeSearch(strategy) {
    const searchPromises = [];
    
    // Search logs
    if (strategy.search_types.includes('logs')) {
      searchPromises.push(this.searchLogs(strategy));
    }
    
    // Search metrics
    if (strategy.search_types.includes('metrics')) {
      searchPromises.push(this.searchMetrics(strategy));
    }
    
    // Search traces
    if (strategy.search_types.includes('traces')) {
      searchPromises.push(this.searchTraces(strategy));
    }
    
    // Search alerts
    if (strategy.search_types.includes('alerts')) {
      searchPromises.push(this.searchAlerts(strategy));
    }

    // Execute all searches in parallel
    const results = await Promise.all(searchPromises);
    
    // Combine and flatten results
    return results.flat();
  }

  /**
   * Search logs with natural language processing
   */
  async searchLogs(strategy) {
    try {
      let query = `
        SELECT 
          timestamp,
          service_name,
          log_level,
          log_message,
          trace_id,
          span_id,
          korean_timestamp,
          korean_business_hours,
          'log' as result_type
        FROM wide_events
        WHERE event_type = 'log'
      `;

      // Add time range filter
      if (strategy.time_range) {
        query += ` AND timestamp >= '${strategy.time_range.start}' AND timestamp <= '${strategy.time_range.end}'`;
      } else {
        query += ` AND timestamp >= now() - INTERVAL 24 HOUR`;
      }

      // Add filters
      if (strategy.filters.service_name) {
        query += ` AND service_name = '${strategy.filters.service_name}'`;
      }
      if (strategy.filters.log_level) {
        query += ` AND log_level = '${strategy.filters.log_level}'`;
      }
      if (strategy.filters.korean_business_hours !== undefined) {
        query += ` AND korean_business_hours = ${strategy.filters.korean_business_hours}`;
      }

      // Add text search
      if (strategy.filters.search_text) {
        const searchTerms = this.expandKoreanTerms(strategy.filters.search_text);
        const textConditions = searchTerms.map(term => `log_message LIKE '%${term}%'`).join(' OR ');
        query += ` AND (${textConditions})`;
      }

      query += ` ORDER BY timestamp DESC LIMIT ${this.config.maxResults * 2}`;

      const result = await this.clickhouseService.query(query);
      return result.data || [];

    } catch (error) {
      logger.error('로그 검색 실패', {
        error: error.message,
        service: 'nlp-search'
      });
      return [];
    }
  }

  /**
   * Search metrics with semantic understanding
   */
  async searchMetrics(strategy) {
    try {
      let query = `
        SELECT 
          timestamp,
          service_name,
          metric_name,
          metric_value,
          metric_unit,
          tags,
          korean_timestamp,
          korean_business_hours,
          'metric' as result_type
        FROM wide_events
        WHERE event_type = 'metric'
      `;

      // Add time range filter
      if (strategy.time_range) {
        query += ` AND timestamp >= '${strategy.time_range.start}' AND timestamp <= '${strategy.time_range.end}'`;
      } else {
        query += ` AND timestamp >= now() - INTERVAL 24 HOUR`;
      }

      // Add filters
      if (strategy.filters.service_name) {
        query += ` AND service_name = '${strategy.filters.service_name}'`;
      }
      if (strategy.filters.metric_threshold) {
        query += ` AND metric_value >= ${strategy.filters.metric_threshold}`;
      }

      // Add semantic metric search
      if (strategy.filters.search_text) {
        const metricTerms = this.expandKoreanTerms(strategy.filters.search_text, 'metrics');
        const metricConditions = metricTerms.map(term => `metric_name LIKE '%${term}%'`).join(' OR ');
        query += ` AND (${metricConditions})`;
      }

      query += ` ORDER BY timestamp DESC LIMIT ${this.config.maxResults}`;

      const result = await this.clickhouseService.query(query);
      return result.data || [];

    } catch (error) {
      logger.error('메트릭 검색 실패', {
        error: error.message,
        service: 'nlp-search'
      });
      return [];
    }
  }

  /**
   * Search traces with distributed tracing context
   */
  async searchTraces(strategy) {
    try {
      let query = `
        SELECT 
          timestamp,
          service_name,
          trace_id,
          span_id,
          parent_span_id,
          operation_name,
          duration,
          status_code,
          korean_timestamp,
          'trace' as result_type
        FROM wide_events
        WHERE event_type = 'trace'
      `;

      // Add time range filter
      if (strategy.time_range) {
        query += ` AND timestamp >= '${strategy.time_range.start}' AND timestamp <= '${strategy.time_range.end}'`;
      } else {
        query += ` AND timestamp >= now() - INTERVAL 24 HOUR`;
      }

      // Add filters
      if (strategy.filters.service_name) {
        query += ` AND service_name = '${strategy.filters.service_name}'`;
      }
      if (strategy.filters.min_duration) {
        query += ` AND duration >= ${strategy.filters.min_duration}`;
      }
      if (strategy.filters.status_code) {
        query += ` AND status_code = '${strategy.filters.status_code}'`;
      }

      // Add operation name search
      if (strategy.filters.search_text) {
        const operationTerms = this.expandKoreanTerms(strategy.filters.search_text, 'operations');
        const operationConditions = operationTerms.map(term => `operation_name LIKE '%${term}%'`).join(' OR ');
        query += ` AND (${operationConditions})`;
      }

      query += ` ORDER BY timestamp DESC LIMIT ${this.config.maxResults}`;

      const result = await this.clickhouseService.query(query);
      return result.data || [];

    } catch (error) {
      logger.error('트레이스 검색 실패', {
        error: error.message,
        service: 'nlp-search'
      });
      return [];
    }
  }

  /**
   * Search alerts with contextual understanding
   */
  async searchAlerts(strategy) {
    try {
      let query = `
        SELECT 
          timestamp,
          service_name,
          alert_name,
          alert_severity,
          alert_message,
          alert_state,
          korean_timestamp,
          korean_business_hours,
          'alert' as result_type
        FROM wide_events
        WHERE event_type = 'alert'
      `;

      // Add time range filter
      if (strategy.time_range) {
        query += ` AND timestamp >= '${strategy.time_range.start}' AND timestamp <= '${strategy.time_range.end}'`;
      } else {
        query += ` AND timestamp >= now() - INTERVAL 7 DAY`;
      }

      // Add filters
      if (strategy.filters.service_name) {
        query += ` AND service_name = '${strategy.filters.service_name}'`;
      }
      if (strategy.filters.alert_severity) {
        query += ` AND alert_severity = '${strategy.filters.alert_severity}'`;
      }
      if (strategy.filters.alert_state) {
        query += ` AND alert_state = '${strategy.filters.alert_state}'`;
      }

      // Add alert message search
      if (strategy.filters.search_text) {
        const alertTerms = this.expandKoreanTerms(strategy.filters.search_text);
        const alertConditions = alertTerms.map(term => 
          `(alert_name LIKE '%${term}%' OR alert_message LIKE '%${term}%')`
        ).join(' OR ');
        query += ` AND (${alertConditions})`;
      }

      query += ` ORDER BY timestamp DESC LIMIT ${this.config.maxResults}`;

      const result = await this.clickhouseService.query(query);
      return result.data || [];

    } catch (error) {
      logger.error('알림 검색 실패', {
        error: error.message,
        service: 'nlp-search'
      });
      return [];
    }
  }

  /**
   * Expand Korean terms to include English equivalents
   */
  expandKoreanTerms(searchText, domain = 'general') {
    const terms = [searchText];
    
    // Split into individual Korean terms
    const koreanTerms = searchText.split(/\s+/);
    
    koreanTerms.forEach(term => {
      // Look up in Korean tech terms dictionary
      if (this.koreanTechTerms[term]) {
        terms.push(...this.koreanTechTerms[term]);
      }
      
      // Add the original term
      if (!terms.includes(term)) {
        terms.push(term);
      }
      
      // Domain-specific expansions
      if (domain === 'metrics') {
        this.addMetricSpecificTerms(term, terms);
      } else if (domain === 'operations') {
        this.addOperationSpecificTerms(term, terms);
      }
    });
    
    return terms;
  }

  addMetricSpecificTerms(term, terms) {
    const metricMappings = {
      'CPU': ['cpu_usage', 'processor', 'load'],
      '메모리': ['memory_usage', 'heap_usage', 'ram'],
      '디스크': ['disk_usage', 'storage_usage', 'filesystem'],
      '네트워크': ['network_io', 'bandwidth', 'packets']
    };
    
    if (metricMappings[term]) {
      terms.push(...metricMappings[term]);
    }
  }

  addOperationSpecificTerms(term, terms) {
    const operationMappings = {
      '로그인': ['login', 'authenticate', 'auth'],
      '결제': ['payment', 'checkout', 'billing'],
      '업로드': ['upload', 'file_upload', 'media_upload'],
      '다운로드': ['download', 'file_download', 'export']
    };
    
    if (operationMappings[term]) {
      terms.push(...operationMappings[term]);
    }
  }

  /**
   * Extract time range from natural language
   */
  extractTimeRange(queryAnalysis) {
    const timeKeywords = queryAnalysis.time_expressions;
    const now = new Date();
    
    for (const timeExpr of timeKeywords) {
      if (timeExpr.includes('지난 시간') || timeExpr.includes('last hour')) {
        return {
          start: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
          end: now.toISOString()
        };
      }
      if (timeExpr.includes('오늘') || timeExpr.includes('today')) {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        return {
          start: startOfDay.toISOString(),
          end: now.toISOString()
        };
      }
      if (timeExpr.includes('어제') || timeExpr.includes('yesterday')) {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const startOfYesterday = new Date(yesterday);
        startOfYesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        return {
          start: startOfYesterday.toISOString(),
          end: endOfYesterday.toISOString()
        };
      }
      if (timeExpr.includes('지난 주') || timeExpr.includes('last week')) {
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: now.toISOString()
        };
      }
    }
    
    return null;
  }

  /**
   * Extract filters from query analysis
   */
  extractFilters(queryAnalysis) {
    const filters = {};
    
    // Service name extraction
    const services = queryAnalysis.entities.filter(entity => 
      entity.type === 'service' || entity.value.includes('service')
    );
    if (services.length > 0) {
      filters.service_name = services[0].value;
    }
    
    // Log level extraction
    const logLevels = ['error', 'warn', 'info', 'debug', '오류', '경고', '정보'];
    for (const level of logLevels) {
      if (queryAnalysis.tokens.includes(level)) {
        filters.log_level = level.toUpperCase();
        break;
      }
    }
    
    // Alert severity extraction
    const severities = ['critical', 'high', 'medium', 'low', '심각', '높음', '보통', '낮음'];
    for (const severity of severities) {
      if (queryAnalysis.tokens.includes(severity)) {
        filters.alert_severity = severity;
        break;
      }
    }
    
    // Korean business hours
    if (queryAnalysis.tokens.includes('업무시간') || queryAnalysis.tokens.includes('business_hours')) {
      filters.korean_business_hours = true;
    }
    if (queryAnalysis.tokens.includes('업무외시간') || queryAnalysis.tokens.includes('after_hours')) {
      filters.korean_business_hours = false;
    }
    
    // Extract search text (remove time and filter keywords)
    const searchText = queryAnalysis.original_query
      .replace(/(지난|last|오늘|today|어제|yesterday|지난 주|last week)/g, '')
      .replace(/(error|warn|info|debug|오류|경고|정보)/g, '')
      .replace(/(critical|high|medium|low|심각|높음|보통|낮음)/g, '')
      .trim();
      
    if (searchText) {
      filters.search_text = searchText;
    }
    
    return filters;
  }

  /**
   * Extract sort criteria
   */
  extractSortCriteria(queryAnalysis) {
    const criteria = {
      field: 'timestamp',
      direction: 'desc'
    };
    
    if (queryAnalysis.tokens.includes('오래된') || queryAnalysis.tokens.includes('oldest')) {
      criteria.direction = 'asc';
    }
    
    if (queryAnalysis.tokens.includes('심각한') || queryAnalysis.tokens.includes('critical')) {
      criteria.field = 'severity';
      criteria.direction = 'desc';
    }
    
    return criteria;
  }

  /**
   * Extract Korean cultural context
   */
  extractKoreanContext(queryAnalysis) {
    return {
      business_context: queryAnalysis.tokens.includes('업무') || queryAnalysis.tokens.includes('business'),
      urgency_level: this.extractUrgencyLevel(queryAnalysis.tokens),
      cultural_markers: this.extractCulturalMarkers(queryAnalysis.tokens)
    };
  }

  extractUrgencyLevel(tokens) {
    if (tokens.some(t => ['긴급', 'urgent', '즉시'].includes(t))) {
      return 'urgent';
    }
    if (tokens.some(t => ['빨리', 'quickly', '신속'].includes(t))) {
      return 'high';
    }
    return 'normal';
  }

  extractCulturalMarkers(tokens) {
    const markers = [];
    
    if (tokens.includes('빨리빨리')) markers.push('ppalli_culture');
    if (tokens.includes('정확히')) markers.push('precision_focus');
    if (tokens.includes('완벽히')) markers.push('perfectionism');
    
    return markers;
  }

  /**
   * Generate search suggestions
   */
  generateSuggestions(queryAnalysis, results) {
    const suggestions = [];
    
    // Time-based suggestions
    if (!queryAnalysis.time_expressions.length) {
      suggestions.push({
        type: 'time_filter',
        korean_text: '시간 범위를 지정해보세요',
        english_text: 'Try specifying a time range',
        examples: ['지난 1시간', '오늘', '어제']
      });
    }
    
    // Service-based suggestions
    if (results.length > 0) {
      const services = [...new Set(results.map(r => r.service_name))];
      if (services.length > 1) {
        suggestions.push({
          type: 'service_filter',
          korean_text: '특정 서비스로 필터링해보세요',
          english_text: 'Try filtering by specific service',
          examples: services.slice(0, 3)
        });
      }
    }
    
    // Severity suggestions
    const hasAlerts = results.some(r => r.result_type === 'alert');
    if (hasAlerts) {
      suggestions.push({
        type: 'severity_filter',
        korean_text: '알림 심각도로 필터링해보세요',
        english_text: 'Try filtering by alert severity',
        examples: ['심각한 알림', '높은 우선순위', '중요한 이슈']
      });
    }
    
    return suggestions;
  }

  /**
   * Generate cache key for search results
   */
  generateCacheKey(query, options) {
    return `nlp_search:${Buffer.from(query + JSON.stringify(options)).toString('base64')}`;
  }

  /**
   * Start cache cleanup process
   */
  startCacheCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // Every minute
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > this.config.cacheExpiryMs) {
        this.searchCache.delete(key);
      }
    }
  }

  updateAverageResponseTime(responseTime) {
    if (this.metrics.totalSearches === 1) {
      this.metrics.avgResponseTime = responseTime;
    } else {
      this.metrics.avgResponseTime = (
        (this.metrics.avgResponseTime * (this.metrics.totalSearches - 1)) + responseTime
      ) / this.metrics.totalSearches;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      return {
        status: this.isRunning ? 'healthy' : 'stopped',
        running: this.isRunning,
        metrics: this.getMetrics(),
        cache_size: this.searchCache.size,
        services: {
          clickhouse: !!this.clickhouseService,
          redis: !!this.redisService
        },
        nlp_components: {
          query_analyzer: this.queryAnalyzer.isReady(),
          semantic_processor: this.semanticProcessor.isReady()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        error: error.message
      };
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      search_rate: this.metrics.totalSearches / ((Date.now() - this.metrics.startTime) / 1000) || 0,
      cache_hit_rate: this.metrics.totalSearches > 0 ? this.metrics.cacheHits / this.metrics.totalSearches : 0
    };
  }
}

/**
 * Korean Query Analyzer - Analyzes Korean natural language queries
 */
class KoreanQueryAnalyzer {
  constructor() {
    this.ready = false;
    this.koreanPatterns = new Map();
  }

  async initialize(config) {
    // Initialize Korean language patterns
    this.initializeKoreanPatterns();
    this.ready = true;
  }

  initializeKoreanPatterns() {
    // Time expression patterns
    this.koreanPatterns.set('time', [
      /지난\s*(\d+)\s*(시간|일|주)/g,
      /(\d+)\s*(시간|일|주)\s*전/g,
      /(오늘|어제|그저께)/g,
      /(이번\s*주|지난\s*주|다음\s*주)/g
    ]);

    // Service patterns
    this.koreanPatterns.set('service', [
      /(\w+)\s*서비스/g,
      /(\w+)\s*시스템/g,
      /(\w+)\s*애플리케이션/g
    ]);

    // Intent patterns
    this.koreanPatterns.set('intent', [
      /(보여줘|찾아줘|검색해줘|알려줘)/g,
      /(오류|에러|문제|장애)/g,
      /(성능|속도|응답시간)/g,
      /(로그|기록|이벤트)/g
    ]);
  }

  async analyze(query) {
    const analysis = {
      original_query: query,
      tokens: this.tokenize(query),
      entities: this.extractEntities(query),
      intent: this.extractIntent(query),
      time_expressions: this.extractTimeExpressions(query),
      korean_grammar: this.analyzeKoreanGrammar(query)
    };

    return analysis;
  }

  tokenize(query) {
    // Simple Korean tokenization (in production, use proper Korean NLP library)
    return query.toLowerCase()
      .split(/[\s\.,\?!]+/)
      .filter(token => token.length > 0);
  }

  extractEntities(query) {
    const entities = [];

    // Extract using patterns
    for (const [type, patterns] of this.koreanPatterns.entries()) {
      for (const pattern of patterns) {
        const matches = [...query.matchAll(pattern)];
        for (const match of matches) {
          entities.push({
            type,
            value: match[1] || match[0],
            position: match.index
          });
        }
      }
    }

    return entities;
  }

  extractIntent(query) {
    const intents = [];
    
    if (query.includes('보여') || query.includes('찾아') || query.includes('검색')) {
      intents.push('search');
    }
    if (query.includes('오류') || query.includes('에러') || query.includes('문제')) {
      intents.push('troubleshoot');
    }
    if (query.includes('성능') || query.includes('속도') || query.includes('느려')) {
      intents.push('performance');
    }
    if (query.includes('알림') || query.includes('알려') || query.includes('경고')) {
      intents.push('alert');
    }

    return intents.length > 0 ? intents : ['search'];
  }

  extractTimeExpressions(query) {
    const timeExpressions = [];
    const timePatterns = this.koreanPatterns.get('time') || [];

    for (const pattern of timePatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        timeExpressions.push(match[0]);
      }
    }

    return timeExpressions;
  }

  analyzeKoreanGrammar(query) {
    return {
      has_honorifics: /님|씨|선생님/.test(query),
      formality_level: this.detectFormalityLevel(query),
      question_type: this.detectQuestionType(query)
    };
  }

  detectFormalityLevel(query) {
    if (/습니다|십니다/.test(query)) return 'formal';
    if (/해요|예요/.test(query)) return 'polite';
    if (/해|야/.test(query)) return 'casual';
    return 'neutral';
  }

  detectQuestionType(query) {
    if (query.includes('?')) return 'direct_question';
    if (/어떻게|왜|언제|어디서|무엇을/.test(query)) return 'wh_question';
    if (/인가요|나요/.test(query)) return 'yes_no_question';
    return 'statement';
  }

  isReady() {
    return this.ready;
  }
}

/**
 * Semantic Processor - Handles semantic ranking and relevance scoring
 */
class SemanticProcessor {
  constructor() {
    this.ready = false;
    this.semanticWeights = new Map();
  }

  async initialize(config) {
    this.initializeSemanticWeights();
    this.ready = true;
  }

  initializeSemanticWeights() {
    this.semanticWeights.set('exact_match', 1.0);
    this.semanticWeights.set('korean_term_match', 0.9);
    this.semanticWeights.set('english_equivalent', 0.8);
    this.semanticWeights.set('time_relevance', 0.7);
    this.semanticWeights.set('service_match', 0.8);
    this.semanticWeights.set('severity_match', 0.9);
  }

  async rankResults(results, queryAnalysis) {
    const rankedResults = results.map(result => ({
      ...result,
      relevance_score: this.calculateRelevanceScore(result, queryAnalysis)
    }));

    // Sort by relevance score
    rankedResults.sort((a, b) => b.relevance_score - a.relevance_score);

    return rankedResults;
  }

  calculateRelevanceScore(result, queryAnalysis) {
    let score = 0;

    // Base score for result type match
    if (queryAnalysis.intent.includes('log') && result.result_type === 'log') {
      score += 0.3;
    }
    if (queryAnalysis.intent.includes('metric') && result.result_type === 'metric') {
      score += 0.3;
    }

    // Time relevance (more recent = higher score)
    const ageHours = (Date.now() - new Date(result.timestamp).getTime()) / (1000 * 60 * 60);
    const timeScore = Math.max(0, 1 - (ageHours / 24)); // Decay over 24 hours
    score += timeScore * this.semanticWeights.get('time_relevance');

    // Text relevance
    const textFields = [
      result.log_message,
      result.alert_message,
      result.operation_name,
      result.metric_name
    ].filter(Boolean);

    for (const field of textFields) {
      score += this.calculateTextRelevance(field, queryAnalysis);
    }

    // Severity bonus for alerts
    if (result.result_type === 'alert' && result.alert_severity) {
      const severityScores = { critical: 1.0, high: 0.8, medium: 0.6, low: 0.4 };
      score += (severityScores[result.alert_severity] || 0) * 0.2;
    }

    // Korean business hours relevance
    if (result.korean_business_hours && queryAnalysis.tokens.includes('업무시간')) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  calculateTextRelevance(text, queryAnalysis) {
    if (!text) return 0;

    let relevance = 0;
    const normalizedText = text.toLowerCase();

    // Check for exact matches
    for (const token of queryAnalysis.tokens) {
      if (normalizedText.includes(token.toLowerCase())) {
        relevance += this.semanticWeights.get('exact_match') * 0.1;
      }
    }

    // Check for entity matches
    for (const entity of queryAnalysis.entities) {
      if (normalizedText.includes(entity.value.toLowerCase())) {
        relevance += 0.2;
      }
    }

    return Math.min(0.5, relevance);
  }

  isReady() {
    return this.ready;
  }
}

module.exports = NLPSearchEngine;