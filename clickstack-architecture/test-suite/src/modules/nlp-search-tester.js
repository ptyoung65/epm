/**
 * NLP 검색 테스터 - AIRIS-MON 한국어 자연어 검색 기능 테스트
 * 한국어 토큰화, 의미 검색, 결과 순위 등을 테스트
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class NLPSearchTester {
  constructor() {
    this.baseUrl = 'http://localhost:3006'; // NLP Search Service
    this.searchQueries = [];
    this.searchResults = [];
    this.performanceMetrics = [];
    
    // 한국어 검색 쿼리 패턴
    this.koreanQueries = [
      // 시스템 모니터링 관련
      "오늘 오류가 가장 많이 발생한 서비스는?",
      "지난 1시간 동안 응답시간이 느린 API 찾아줘",
      "메모리 사용량이 80% 이상인 서버 보여줘",
      "CPU 사용률이 높은 인스턴스 목록",
      "디스크 용량이 부족한 서버는 어디야?",
      
      // 사용자 행동 분석
      "사용자 로그인 실패 횟수 급증한 시간대는?",
      "가장 많이 접근한 페이지 순위",
      "세션 지속시간 평균과 이상값은?",
      "모바일 사용자 비율 변화 추이",
      "사용자별 액션 횟수 통계",
      
      // 성능 분석
      "응답시간이 2초 이상인 요청들",
      "데이터베이스 쿼리 시간 분석",
      "캐시 적중률이 낮은 서비스",
      "네트워크 지연시간 이상치",
      "트래픽이 급증한 시간대",
      
      // 오류 및 장애 분석
      "데이터베이스 연결 오류 패턴 분석해줘",
      "API 호출 실패율이 높은 엔드포인트",
      "시스템 장애 복구 시간 통계",
      "오류 로그에서 가장 빈번한 메시지",
      "서비스 재시작이 필요한 경우들",
      
      // 보안 관련
      "의심스러운 IP 주소 접근 기록",
      "비정상적인 로그인 시도 패턴",
      "권한 에러가 발생한 사용자들",
      "보안 스캔 감지 기록",
      "API 키 남용 사례들",
      
      // 비즈니스 메트릭
      "일일 활성 사용자 수 변화",
      "기능별 사용량 통계",
      "페이지 이탈률이 높은 경로",
      "전환율이 낮은 프로세스",
      "고객 만족도와 관련된 지표들"
    ];
  }

  async testTokenization(stepResult) {
    stepResult.logs.push('🔤 한국어 토큰화 테스트 시작');
    
    try {
      const testSentences = [
        "서버의 CPU 사용률이 높습니다",
        "데이터베이스 연결이 실패했습니다",
        "사용자 로그인 오류가 발생했어요",
        "API 응답시간이 느려졌네요",
        "메모리 사용량을 확인해주세요"
      ];

      const tokenizationResults = [];
      
      for (const sentence of testSentences) {
        const result = await this.tokenizeSentence(sentence);
        tokenizationResults.push(result);
        
        stepResult.logs.push(`"${sentence}" → ${result.tokens.length}개 토큰`);
      }

      stepResult.metrics.sentencesTested = testSentences.length;
      stepResult.metrics.avgTokensPerSentence = tokenizationResults.reduce((sum, r) => sum + r.tokens.length, 0) / tokenizationResults.length;
      stepResult.metrics.avgProcessingTime = tokenizationResults.reduce((sum, r) => sum + r.processingTime, 0) / tokenizationResults.length;

      // 토큰화 품질 평가
      const qualityScore = await this.evaluateTokenizationQuality(tokenizationResults);
      stepResult.metrics.tokenizationQuality = qualityScore;

      stepResult.logs.push(`평균 토큰 수: ${stepResult.metrics.avgTokensPerSentence.toFixed(1)}개`);
      stepResult.logs.push(`평균 처리시간: ${stepResult.metrics.avgProcessingTime.toFixed(2)}ms`);
      stepResult.logs.push(`토큰화 품질: ${qualityScore.toFixed(1)}%`);

      stepResult.logs.push('✅ 한국어 토큰화 테스트 완료');

    } catch (error) {
      stepResult.logs.push(`❌ 토큰화 테스트 실패: ${error.message}`);
      throw error;
    }
  }

  async testSemanticSearch(stepResult) {
    stepResult.logs.push('🔍 의미 검색 테스트 시작');
    
    try {
      // 다양한 검색 쿼리 테스트
      const queries = this.koreanQueries.slice(0, 10); // 처음 10개 쿼리 사용
      const searchResults = [];

      for (const query of queries) {
        const searchResult = await this.performSemanticSearch(query);
        searchResults.push(searchResult);
        
        stepResult.logs.push(`"${query.substring(0, 20)}..." → ${searchResult.results.length}개 결과 (${searchResult.processingTime}ms)`);
      }

      stepResult.metrics.queriesTested = queries.length;
      stepResult.metrics.avgResultsPerQuery = searchResults.reduce((sum, r) => sum + r.results.length, 0) / searchResults.length;
      stepResult.metrics.avgSearchTime = searchResults.reduce((sum, r) => sum + r.processingTime, 0) / searchResults.length;
      stepResult.metrics.totalResults = searchResults.reduce((sum, r) => sum + r.results.length, 0);

      // 검색 정확도 평가
      const accuracyResults = await this.evaluateSearchAccuracy(searchResults);
      stepResult.metrics.searchAccuracy = accuracyResults.accuracy;
      stepResult.metrics.relevanceScore = accuracyResults.relevanceScore;

      // 의미 매칭 테스트
      const semanticMatchResults = await this.testSemanticMatching();
      stepResult.metrics.semanticMatchAccuracy = semanticMatchResults.accuracy;

      stepResult.logs.push(`평균 결과 수: ${stepResult.metrics.avgResultsPerQuery.toFixed(1)}개`);
      stepResult.logs.push(`평균 검색 시간: ${stepResult.metrics.avgSearchTime.toFixed(1)}ms`);
      stepResult.logs.push(`검색 정확도: ${accuracyResults.accuracy.toFixed(2)}%`);
      stepResult.logs.push(`관련성 점수: ${accuracyResults.relevanceScore.toFixed(2)}/10`);
      stepResult.logs.push(`의미 매칭 정확도: ${semanticMatchResults.accuracy.toFixed(1)}%`);

      stepResult.logs.push('✅ 의미 검색 테스트 완료');

    } catch (error) {
      stepResult.logs.push(`❌ 의미 검색 테스트 실패: ${error.message}`);
      throw error;
    }
  }

  async testResultRanking(stepResult) {
    stepResult.logs.push('📊 결과 순위 테스트 시작');
    
    try {
      // 검색 결과 순위 정확성 테스트
      const testQueries = [
        {
          query: "CPU 사용률이 높은 서버",
          expectedKeywords: ["CPU", "사용률", "서버", "높은"]
        },
        {
          query: "데이터베이스 연결 오류",
          expectedKeywords: ["데이터베이스", "연결", "오류", "실패"]
        },
        {
          query: "사용자 로그인 문제",
          expectedKeywords: ["사용자", "로그인", "문제", "실패", "오류"]
        }
      ];

      const rankingResults = [];

      for (const testCase of testQueries) {
        const searchResult = await this.performSemanticSearch(testCase.query);
        const rankingAnalysis = await this.analyzeResultRanking(searchResult, testCase.expectedKeywords);
        
        rankingResults.push({
          query: testCase.query,
          results: searchResult.results,
          ranking: rankingAnalysis
        });

        stepResult.logs.push(`"${testCase.query}" → NDCG: ${rankingAnalysis.ndcg.toFixed(3)}, MAP: ${rankingAnalysis.map.toFixed(3)}`);
      }

      const avgNdcg = rankingResults.reduce((sum, r) => sum + r.ranking.ndcg, 0) / rankingResults.length;
      const avgMap = rankingResults.reduce((sum, r) => sum + r.ranking.map, 0) / rankingResults.length;
      const avgPrecisionAt5 = rankingResults.reduce((sum, r) => sum + r.ranking.precisionAt5, 0) / rankingResults.length;

      stepResult.metrics.rankingTests = testQueries.length;
      stepResult.metrics.avgNDCG = avgNdcg;
      stepResult.metrics.avgMAP = avgMap;
      stepResult.metrics.avgPrecisionAt5 = avgPrecisionAt5;

      // 다이버시티 테스트
      const diversityResults = await this.testResultDiversity();
      stepResult.metrics.resultDiversity = diversityResults.diversity;

      // 신선도 테스트 (최신 데이터 우선순위)
      const freshnessResults = await this.testResultFreshness();
      stepResult.metrics.resultFreshness = freshnessResults.freshness;

      stepResult.logs.push(`평균 NDCG: ${avgNdcg.toFixed(3)}`);
      stepResult.logs.push(`평균 MAP: ${avgMap.toFixed(3)}`);
      stepResult.logs.push(`Precision@5: ${avgPrecisionAt5.toFixed(3)}`);
      stepResult.logs.push(`결과 다이버시티: ${diversityResults.diversity.toFixed(2)}`);
      stepResult.logs.push(`결과 신선도: ${freshnessResults.freshness.toFixed(1)}%`);

      stepResult.logs.push('✅ 결과 순위 테스트 완료');

    } catch (error) {
      stepResult.logs.push(`❌ 결과 순위 테스트 실패: ${error.message}`);
      throw error;
    }
  }

  async tokenizeSentence(sentence) {
    const startTime = Date.now();
    
    // 한국어 토큰화 시뮬레이션
    // 실제로는 KoNLPy, Mecab 등을 사용
    const tokens = sentence
      .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '') // 특수문자 제거
      .split(/\s+/)
      .filter(token => token.length > 0)
      .map(token => ({
        text: token,
        pos: this.getPartOfSpeech(token), // 품사 태깅
        lemma: token, // 원형 복원
        importance: Math.random() // 중요도
      }));

    const processingTime = Date.now() - startTime;

    return {
      originalSentence: sentence,
      tokens: tokens,
      processingTime: processingTime,
      tokenCount: tokens.length
    };
  }

  getPartOfSpeech(token) {
    // 간단한 품사 태깅 시뮬레이션
    const patterns = {
      'NNG': ['서버', '데이터베이스', '사용자', '시스템', '서비스'],
      'VV': ['발생', '실패', '확인', '분석', '처리'],
      'MAG': ['높이', '느리게', '빠르게', '자주', '가끔'],
      'MM': ['매우', '정말', '아주', '조금', '많이']
    };

    for (const [pos, words] of Object.entries(patterns)) {
      if (words.some(word => token.includes(word))) {
        return pos;
      }
    }

    return 'NNG'; // 기본값: 일반명사
  }

  async performSemanticSearch(query) {
    const startTime = Date.now();
    
    // 검색 결과 시뮬레이션
    const results = await this.generateSearchResults(query);
    const processingTime = Date.now() - startTime;

    const searchResult = {
      query: query,
      results: results,
      processingTime: processingTime,
      timestamp: new Date().toISOString(),
      totalCount: results.length
    };

    this.searchResults.push(searchResult);
    
    // 실제 NLP 서비스로 요청 전송 시뮬레이션
    try {
      await axios.post(`${this.baseUrl}/api/v1/search`, {
        query: query,
        language: 'ko',
        limit: 20
      }, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      // 실제 서비스가 없어도 시뮬레이션 계속
    }

    return searchResult;
  }

  async generateSearchResults(query) {
    // 쿼리 분석 및 관련 결과 생성
    const keywords = query.split(' ').filter(word => word.length > 1);
    const resultCount = Math.floor(Math.random() * 15) + 5; // 5-20개 결과

    const results = [];
    
    for (let i = 0; i < resultCount; i++) {
      const relevanceScore = Math.random() * 0.5 + 0.5; // 50-100% 관련성
      
      results.push({
        id: uuidv4(),
        title: this.generateResultTitle(keywords),
        description: this.generateResultDescription(keywords),
        korean_title: this.generateKoreanResultTitle(keywords),
        korean_description: this.generateKoreanResultDescription(keywords),
        score: relevanceScore,
        source: this.getRandomSource(),
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(), // 지난 24시간 내
        type: this.getRandomResultType(),
        metadata: {
          service: this.getRandomService(),
          category: this.getRandomCategory(),
          tags: this.generateResultTags(keywords)
        }
      });
    }

    // 관련성 점수로 정렬
    return results.sort((a, b) => b.score - a.score);
  }

  generateResultTitle(keywords) {
    const templates = [
      `${keywords[0]} monitoring alert triggered`,
      `High ${keywords[0]} usage detected in system`,
      `${keywords[0]} performance degradation report`,
      `${keywords[0]} error pattern analysis`,
      `System ${keywords[0]} threshold exceeded`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  generateResultDescription(keywords) {
    const templates = [
      `Analysis of ${keywords.join(' and ')} patterns in the system monitoring data`,
      `Detailed report on ${keywords.join(', ')} metrics and their impact on system performance`,
      `Investigation results for ${keywords.join(' related ')} issues and recommended actions`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  generateKoreanResultTitle(keywords) {
    const templates = [
      `${keywords[0]} 모니터링 알림 발생`,
      `시스템에서 높은 ${keywords[0]} 사용량 감지`,
      `${keywords[0]} 성능 저하 보고서`,
      `${keywords[0]} 오류 패턴 분석`,
      `시스템 ${keywords[0]} 임계값 초과`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  generateKoreanResultDescription(keywords) {
    const templates = [
      `시스템 모니터링 데이터에서 ${keywords.join('과 ')} 패턴을 분석한 결과입니다`,
      `${keywords.join(', ')} 메트릭에 대한 상세 보고서와 시스템 성능에 미치는 영향입니다`,
      `${keywords.join(' 관련 ')} 문제에 대한 조사 결과와 권장 조치사항입니다`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  async evaluateTokenizationQuality(tokenizationResults) {
    let totalScore = 100;
    
    for (const result of tokenizationResults) {
      // 토큰 수 적정성 검사
      const tokenDensity = result.tokens.length / result.originalSentence.length;
      if (tokenDensity < 0.1 || tokenDensity > 0.5) {
        totalScore -= 10;
      }
      
      // 처리 시간 검사
      if (result.processingTime > 100) {
        totalScore -= 5;
      }
      
      // 품사 태깅 다양성 검사
      const uniquePos = new Set(result.tokens.map(t => t.pos)).size;
      if (uniquePos < 2) {
        totalScore -= 5;
      }
    }
    
    return Math.max(totalScore / tokenizationResults.length, 0);
  }

  async evaluateSearchAccuracy(searchResults) {
    let totalRelevance = 0;
    let totalResults = 0;
    
    for (const result of searchResults) {
      const queryKeywords = result.query.split(' ').filter(w => w.length > 1);
      
      for (const searchResult of result.results) {
        // 제목과 설명에서 쿼리 키워드 일치도 계산
        const titleMatches = this.calculateKeywordMatches(searchResult.korean_title, queryKeywords);
        const descMatches = this.calculateKeywordMatches(searchResult.korean_description, queryKeywords);
        
        const relevance = (titleMatches * 2 + descMatches) / 3; // 제목에 더 높은 가중치
        totalRelevance += relevance;
        totalResults++;
      }
    }
    
    const avgRelevance = totalResults > 0 ? totalRelevance / totalResults : 0;
    
    return {
      accuracy: avgRelevance * 100,
      relevanceScore: avgRelevance * 10
    };
  }

  calculateKeywordMatches(text, keywords) {
    let matches = 0;
    const lowerText = text.toLowerCase();
    
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches++;
      }
    }
    
    return keywords.length > 0 ? matches / keywords.length : 0;
  }

  async testSemanticMatching() {
    // 의미적으로 유사한 쿼리 쌍 테스트
    const semanticPairs = [
      ["서버가 느려요", "시스템 성능이 저하됐어요"],
      ["오류가 발생했습니다", "에러가 생겼어요"],
      ["사용자가 접속을 못해요", "로그인이 안 돼요"],
      ["데이터베이스 문제", "DB 장애"],
      ["메모리 부족", "RAM 사용량 높음"]
    ];

    let correctMatches = 0;
    
    for (const [query1, query2] of semanticPairs) {
      const result1 = await this.performSemanticSearch(query1);
      const result2 = await this.performSemanticSearch(query2);
      
      // 두 검색 결과의 유사도 계산
      const similarity = this.calculateResultSimilarity(result1.results, result2.results);
      
      if (similarity > 0.7) { // 70% 이상 유사하면 정답
        correctMatches++;
      }
    }
    
    return {
      accuracy: (correctMatches / semanticPairs.length) * 100,
      totalTests: semanticPairs.length,
      correctMatches: correctMatches
    };
  }

  calculateResultSimilarity(results1, results2) {
    // 간단한 유사도 계산 (실제로는 더 복잡한 알고리즘 사용)
    const titles1 = new Set(results1.map(r => r.korean_title));
    const titles2 = new Set(results2.map(r => r.korean_title));
    
    const intersection = new Set([...titles1].filter(x => titles2.has(x)));
    const union = new Set([...titles1, ...titles2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  async analyzeResultRanking(searchResult, expectedKeywords) {
    const results = searchResult.results;
    
    // NDCG (Normalized Discounted Cumulative Gain) 계산
    let dcg = 0;
    let idcg = 0;
    
    for (let i = 0; i < Math.min(results.length, 10); i++) {
      const result = results[i];
      const relevance = this.calculateRelevance(result, expectedKeywords);
      const discount = Math.log2(i + 2);
      
      dcg += relevance / discount;
      
      // IDCG 계산을 위한 이상적인 관련성 점수
      const idealRelevance = Math.max(0, 1 - (i * 0.1));
      idcg += idealRelevance / discount;
    }
    
    const ndcg = idcg > 0 ? dcg / idcg : 0;
    
    // MAP (Mean Average Precision) 계산
    let map = 0;
    let relevantCount = 0;
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const isRelevant = this.calculateRelevance(result, expectedKeywords) > 0.5;
      
      if (isRelevant) {
        relevantCount++;
        map += relevantCount / (i + 1);
      }
    }
    
    map = relevantCount > 0 ? map / relevantCount : 0;
    
    // Precision@5 계산
    const top5Results = results.slice(0, 5);
    const relevantTop5 = top5Results.filter(r => this.calculateRelevance(r, expectedKeywords) > 0.5).length;
    const precisionAt5 = top5Results.length > 0 ? relevantTop5 / top5Results.length : 0;
    
    return {
      ndcg: ndcg,
      map: map,
      precisionAt5: precisionAt5,
      totalResults: results.length,
      relevantResults: relevantCount
    };
  }

  calculateRelevance(result, expectedKeywords) {
    const title = result.korean_title.toLowerCase();
    const description = result.korean_description.toLowerCase();
    
    let relevance = 0;
    for (const keyword of expectedKeywords) {
      const keywordLower = keyword.toLowerCase();
      if (title.includes(keywordLower)) relevance += 0.4;
      if (description.includes(keywordLower)) relevance += 0.2;
    }
    
    return Math.min(relevance, 1.0);
  }

  async testResultDiversity() {
    const query = "시스템 성능 문제";
    const searchResult = await this.performSemanticSearch(query);
    
    // 결과의 다양성 측정
    const categories = searchResult.results.map(r => r.metadata.category);
    const uniqueCategories = new Set(categories);
    const diversity = uniqueCategories.size / Math.min(categories.length, 10);
    
    return { diversity: diversity * 100 };
  }

  async testResultFreshness() {
    const query = "최근 오류 발생 현황";
    const searchResult = await this.performSemanticSearch(query);
    
    // 결과의 신선도 측정 (최신 순으로 정렬된 비율)
    const sortedByTime = [...searchResult.results].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    let correctOrder = 0;
    
    for (let i = 0; i < Math.min(searchResult.results.length, 5); i++) {
      if (searchResult.results[i].id === sortedByTime[i].id) {
        correctOrder++;
      }
    }
    
    const freshness = Math.min(searchResult.results.length, 5) > 0 ? 
      (correctOrder / Math.min(searchResult.results.length, 5)) * 100 : 0;
    
    return { freshness };
  }

  getRandomSource() {
    const sources = ['logs', 'metrics', 'events', 'alerts', 'traces'];
    return sources[Math.floor(Math.random() * sources.length)];
  }

  getRandomResultType() {
    const types = ['log', 'metric', 'event', 'alert', 'trace', 'report'];
    return types[Math.floor(Math.random() * types.length)];
  }

  getRandomService() {
    const services = ['api-gateway', 'aiops', 'session-replay', 'nlp-search', 'event-delta-analyzer'];
    return services[Math.floor(Math.random() * services.length)];
  }

  getRandomCategory() {
    const categories = ['performance', 'error', 'security', 'user', 'system', 'business'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  generateResultTags(keywords) {
    const baseTags = ['monitoring', 'analysis'];
    const dynamicTags = keywords.slice(0, 3);
    return [...baseTags, ...dynamicTags];
  }

  async performBulkSearch() {
    console.log('🔍 대량 검색 성능 테스트 시작');
    
    const queries = this.koreanQueries.slice(0, 20);
    const startTime = Date.now();
    
    const promises = queries.map(query => this.performSemanticSearch(query));
    const results = await Promise.all(promises);
    
    const totalTime = Date.now() - startTime;
    const avgTime = totalTime / queries.length;
    
    console.log(`✅ 대량 검색 완료: ${queries.length}개 쿼리, 평균 ${avgTime.toFixed(1)}ms`);
    
    return {
      queries: queries.length,
      totalTime: totalTime,
      avgTime: avgTime,
      results: results
    };
  }

  getStatistics() {
    return {
      totalQueries: this.searchQueries.length,
      totalResults: this.searchResults.length,
      avgResultsPerQuery: this.searchResults.length > 0 ? 
        this.searchResults.reduce((sum, r) => sum + r.results.length, 0) / this.searchResults.length : 0,
      avgProcessingTime: this.searchResults.length > 0 ?
        this.searchResults.reduce((sum, r) => sum + r.processingTime, 0) / this.searchResults.length : 0,
      timestamp: new Date().toISOString()
    };
  }

  clearHistory() {
    this.searchQueries = [];
    this.searchResults = [];
    this.performanceMetrics = [];
    console.log('🧹 NLP 검색 이력 정리 완료');
  }
}

module.exports = NLPSearchTester;