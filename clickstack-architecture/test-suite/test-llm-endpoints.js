#!/usr/bin/env node

/**
 * LLM API 엔드포인트 테스트 스크립트
 * AIRIS-MON Test Suite LLM Integration Verification
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:3100';

// LLM API 엔드포인트 목록
const LLM_ENDPOINTS = [
  { method: 'POST', path: '/api/llm/chat', name: 'Chat Completion' },
  { method: 'POST', path: '/api/llm/analyze', name: 'Analysis Tasks' },
  { method: 'GET', path: '/api/llm/models', name: 'Available Models' },
  { method: 'POST', path: '/api/llm/switch', name: 'Switch Model' },
  { method: 'GET', path: '/api/llm/health', name: 'Health Check' },
  { method: 'POST', path: '/api/llm/test-gemini', name: 'Test Gemini 2.5 API' },
  { method: 'POST', path: '/api/llm/benchmark', name: 'Performance Benchmark' },
  { method: 'POST', path: '/api/llm/korean-quality', name: 'Korean Quality Assessment' }
];

async function testLLMEndpoints() {
  console.log('🚀 AIRIS-MON LLM API 엔드포인트 테스트 시작...\n');
  
  // 환경변수 확인
  console.log('📋 환경변수 설정 확인:');
  console.log(`  - Gemini API Key: ${process.env.GEMINI_API_KEY ? '✅ 설정됨' : '❌ 미설정'}`);
  console.log(`  - Ollama Model: ${process.env.OLLAMA_MODEL || '❌ 미설정'}`);
  console.log(`  - Primary LLM: ${process.env.PRIMARY_LLM || '❌ 미설정'}`);
  console.log(`  - Fallback LLM: ${process.env.FALLBACK_LLM || '❌ 미설정'}\n`);

  // 서버 연결 확인
  try {
    const response = await axios.get(`${BASE_URL}/api/status`, { timeout: 3000 });
    console.log('✅ AIRIS-MON 서버 연결 성공\n');
  } catch (error) {
    console.log('❌ AIRIS-MON 서버에 연결할 수 없습니다.');
    console.log('   서버를 먼저 시작해주세요: npm start\n');
    return;
  }

  // LLM 엔드포인트 테스트
  console.log('🧪 LLM API 엔드포인트 테스트:');
  
  for (const endpoint of LLM_ENDPOINTS) {
    try {
      let testData = {};
      
      // 엔드포인트별 테스트 데이터 설정
      switch (endpoint.path) {
        case '/api/llm/chat':
          testData = {
            messages: [{ role: 'user', content: '안녕하세요. 테스트입니다.' }]
          };
          break;
        case '/api/llm/analyze':
          testData = {
            data: { test: 'sample data' },
            analysisType: 'general',
            language: 'korean'
          };
          break;
        case '/api/llm/switch':
          testData = { providerId: 'ollama' };
          break;
        case '/api/llm/test-gemini':
          testData = {
            testMessage: '안녕하세요. Gemini API 연결 테스트입니다.'
          };
          break;
        case '/api/llm/benchmark':
          testData = {
            testPrompt: '간단한 한국어 텍스트 생성 테스트'
          };
          break;
        case '/api/llm/korean-quality':
          testData = {
            text: '안녕하세요. 한국어 품질 평가 테스트 문장입니다.'
          };
          break;
      }

      const config = {
        method: endpoint.method.toLowerCase(),
        url: `${BASE_URL}${endpoint.path}`,
        timeout: 10000,
        ...(endpoint.method === 'POST' && { data: testData })
      };

      const response = await axios(config);
      
      if (response.status === 200) {
        console.log(`  ✅ ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
        
        // Gemini 테스트 결과 상세 출력
        if (endpoint.path === '/api/llm/test-gemini' && response.data.success) {
          console.log(`     🌟 Gemini 2.5 API 연결 성공!`);
          console.log(`     📝 응답: ${response.data.data.response.substring(0, 100)}...`);
        }
      } else {
        console.log(`  ⚠️ ${endpoint.name} - HTTP ${response.status}`);
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`  ❌ ${endpoint.name} - 서버 연결 실패`);
      } else if (error.response) {
        console.log(`  ⚠️ ${endpoint.name} - HTTP ${error.response.status}: ${error.response.data?.error || 'Unknown error'}`);
      } else {
        console.log(`  ❌ ${endpoint.name} - ${error.message}`);
      }
    }
  }

  console.log('\n🎉 LLM API 엔드포인트 테스트 완료!');
  console.log('\n💡 사용 가능한 API 엔드포인트:');
  LLM_ENDPOINTS.forEach(endpoint => {
    console.log(`   ${endpoint.method} ${endpoint.path} - ${endpoint.name}`);
  });
}

// 스크립트 실행
if (require.main === module) {
  testLLMEndpoints().catch(console.error);
}

module.exports = { testLLMEndpoints, LLM_ENDPOINTS };