const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
// const Redis = require('redis'); // Temporarily disabled
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3013;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 사용자당 15분에 100개 요청 제한
  message: { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' }
});

app.use('/api/chatbot', chatbotLimiter);

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'airis_epm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection disabled temporarily
let redisClient = null;

// LLM Clients initialization
const llmClients = {
  openai: null,
  claude: null,
  gemini: null,
  ollama: null
};

// Initialize database tables
async function initializeDatabase() {
  try {
    console.log('Creating chatbot_configs table...');
    // Chatbot configurations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_configs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100) NOT NULL,
        system_prompt TEXT,
        temperature NUMERIC(3,2) DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 2000,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ chatbot_configs table created');

    console.log('Creating api_configs table...');
    // API configurations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_configs (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL UNIQUE,
        api_key TEXT NOT NULL,
        base_url VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ api_configs table created');

    console.log('Creating chat_history table...');
    // Chat history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(100),
        chatbot_id INTEGER REFERENCES chatbot_configs(id),
        user_message TEXT NOT NULL,
        bot_response TEXT NOT NULL,
        context_info JSONB,
        response_time_ms INTEGER,
        tokens_used INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ chat_history table created');

    // Create indexes for chat_history
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at)`);

    // Initialize default chatbots if none exist
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM chatbot_configs');
    if (parseInt(rows[0].count) === 0) {
      await initializeDefaultChatbots();
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Initialize default chatbots
async function initializeDefaultChatbots() {
  const defaultBots = [
    {
      name: 'AIRIS 성능 분석가',
      description: 'J2EE, WAS, 데이터베이스 성능 분석 전문 챗봇',
      provider: 'openai',
      model: 'gpt-4o-mini',
      system_prompt: `당신은 AIRIS EPM (Enterprise Performance Management) 시스템의 전문 성능 분석가입니다.

주요 역할:
- J2EE 애플리케이션 성능 문제 진단 및 해결책 제시
- WAS (Tomcat, WebLogic, WebSphere) 최적화 가이드
- 데이터베이스 쿼리 성능 분석 및 튜닝 방안
- 시스템 메트릭 해석 및 임계값 설정 권장
- 실시간 모니터링 데이터 기반 이상 패턴 탐지

응답 스타일:
- 구체적이고 실행 가능한 해결책 제시
- 성능 수치와 근거 데이터 기반 분석
- 단계별 해결 프로세스 제공
- 한국어로 전문적이면서도 이해하기 쉽게 설명`
    },
    {
      name: 'AIRIS 장애 대응 매니저',
      description: '시스템 장애 대응 및 에스컬레이션 전문 챗봇',
      provider: 'openai',
      model: 'gpt-4o-mini',
      system_prompt: `당신은 AIRIS EPM 시스템의 장애 대응 매니저입니다.

주요 역할:
- 장애 상황 신속 분석 및 심각도 판정
- 에스컬레이션 절차 가이드
- 복구 작업 우선순위 결정
- 장애 원인 분석 및 재발 방지 방안
- 비상 대응 프로세스 실행 지원

응답 특징:
- 긴급도에 따른 단계적 대응 절차 제시
- 명확한 체크리스트 및 검증 포인트 제공
- 실시간 상태 모니터링 가이드
- 의사결정 지원을 위한 객관적 정보 제공`
    },
    {
      name: 'AIRIS AI 인사이트',
      description: 'AI 기반 예측 분석 및 인사이트 제공 챗봇',
      provider: 'openai',
      model: 'gpt-4o',
      system_prompt: `당신은 AIRIS EPM의 AI 인사이트 전문가입니다.

주요 기능:
- 시계열 데이터 패턴 분석 및 트렌드 예측
- 이상 징후 탐지 및 사전 경고
- 비즈니스 임팩트 분석
- 용량 계획 및 확장성 예측
- 머신러닝 모델 결과 해석

분석 접근법:
- 데이터 기반 객관적 분석
- 통계적 유의성 검증
- 시각적 차트 및 그래프 활용한 설명
- 예측 신뢰도 및 불확실성 명시
- 비즈니스 관점에서의 실용적 권장사항`
    }
  ];

  for (const bot of defaultBots) {
    await pool.query(
      `INSERT INTO chatbot_configs (name, description, provider, model, system_prompt, temperature, max_tokens) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [bot.name, bot.description, bot.provider, bot.model, bot.system_prompt, 0.7, 2000]
    );
  }
  
  console.log('Default chatbots initialized');
}

// Initialize LLM client based on provider
function initializeLLMClient(provider, config) {
  try {
    switch (provider) {
      case 'openai':
        return new OpenAI({
          apiKey: config.api_key,
          baseURL: config.base_url || 'https://api.openai.com/v1'
        });
      
      case 'claude':
        return new Anthropic({
          apiKey: config.api_key,
          baseURL: config.base_url || 'https://api.anthropic.com'
        });
      
      case 'gemini':
        return new GoogleGenerativeAI(config.api_key);
      
      case 'ollama':
        return {
          baseURL: config.base_url || 'http://localhost:11434',
          apiKey: config.api_key || 'ollama'
        };
      
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error) {
    console.error(`Failed to initialize ${provider} client:`, error);
    return null;
  }
}

// Get LLM response based on provider
async function getLLMResponse(provider, model, messages, config = {}) {
  const startTime = Date.now();
  let tokensUsed = 0;
  
  try {
    const apiConfig = await getApiConfig(provider);
    if (!apiConfig) {
      throw new Error(`API configuration not found for provider: ${provider}`);
    }

    const client = initializeLLMClient(provider, apiConfig);
    if (!client) {
      throw new Error(`Failed to initialize client for provider: ${provider}`);
    }

    let response;
    
    switch (provider) {
      case 'openai':
        response = await client.chat.completions.create({
          model: model,
          messages: messages,
          temperature: config.temperature || 0.7,
          max_tokens: config.max_tokens || 2000,
          stream: false
        });
        
        return {
          content: response.choices[0].message.content,
          tokensUsed: response.usage?.total_tokens || 0,
          responseTime: Date.now() - startTime
        };

      case 'claude':
        const systemMessage = messages.find(m => m.role === 'system');
        const userMessages = messages.filter(m => m.role !== 'system');
        
        response = await client.messages.create({
          model: model,
          max_tokens: config.max_tokens || 2000,
          temperature: config.temperature || 0.7,
          system: systemMessage?.content || '',
          messages: userMessages
        });
        
        return {
          content: response.content[0].text,
          tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || 0,
          responseTime: Date.now() - startTime
        };

      case 'gemini':
        const genModel = client.getGenerativeModel({ model: model });
        const prompt = messages.map(m => m.content).join('\n');
        
        response = await genModel.generateContent(prompt);
        
        return {
          content: response.response.text(),
          tokensUsed: 0, // Gemini doesn't provide token count in free tier
          responseTime: Date.now() - startTime
        };

      case 'ollama':
        response = await axios.post(`${client.baseURL}/api/generate`, {
          model: model,
          prompt: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
          stream: false,
          options: {
            temperature: config.temperature || 0.7,
            num_predict: config.max_tokens || 2000
          }
        });
        
        return {
          content: response.data.response,
          tokensUsed: 0, // Ollama doesn't provide token count
          responseTime: Date.now() - startTime
        };

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error) {
    console.error(`LLM API Error (${provider}):`, error);
    throw error;
  }
}

// Database helper functions
async function getApiConfig(provider) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM api_configs WHERE provider = $1 AND is_active = true',
      [provider]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error fetching API config:', error);
    return null;
  }
}

async function getChatbotConfig(id) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM chatbot_configs WHERE id = $1 AND is_active = true',
      [id]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error fetching chatbot config:', error);
    return null;
  }
}

// Generate enhanced system prompt with context
function generateContextualPrompt(basePrompt, contextInfo) {
  if (!contextInfo || !contextInfo.pageUrl) {
    return basePrompt;
  }

  let contextPrompt = basePrompt + '\n\n현재 컨텍스트 정보:\n';
  
  // Page-specific context
  if (contextInfo.pageUrl.includes('j2ee-dashboard')) {
    contextPrompt += '- 현재 J2EE 모니터링 대시보드를 보고 있습니다\n';
    contextPrompt += '- Servlet, JSP, EJB 성능 메트릭에 집중하여 답변해주세요\n';
  } else if (contextInfo.pageUrl.includes('was-dashboard')) {
    contextPrompt += '- 현재 WAS 모니터링 대시보드를 보고 있습니다\n';
    contextPrompt += '- Tomcat, WebLogic, WebSphere 성능에 집중하여 답변해주세요\n';
  } else if (contextInfo.pageUrl.includes('exception-dashboard')) {
    contextPrompt += '- 현재 예외 추적 대시보드를 보고 있습니다\n';
    contextPrompt += '- 에러 분석 및 해결방안에 집중하여 답변해주세요\n';
  } else if (contextInfo.pageUrl.includes('topology-dashboard')) {
    contextPrompt += '- 현재 서비스 토폴로지 대시보드를 보고 있습니다\n';
    contextPrompt += '- 서비스 간 의존성 및 통신 패턴에 집중하여 답변해주세요\n';
  } else if (contextInfo.pageUrl.includes('alert-dashboard')) {
    contextPrompt += '- 현재 알림 관리 대시보드를 보고 있습니다\n';
    contextPrompt += '- 알림 설정 및 임계값 관리에 집중하여 답변해주세요\n';
  }

  // Add metrics context if available
  if (contextInfo.metrics) {
    contextPrompt += '\n현재 시스템 메트릭:\n';
    if (contextInfo.metrics.responseTime) {
      contextPrompt += `- 평균 응답시간: ${contextInfo.metrics.responseTime}ms\n`;
    }
    if (contextInfo.metrics.errorRate) {
      contextPrompt += `- 에러율: ${contextInfo.metrics.errorRate}%\n`;
    }
    if (contextInfo.metrics.throughput) {
      contextPrompt += `- 처리량: ${contextInfo.metrics.throughput} req/sec\n`;
    }
  }

  contextPrompt += '\n위 컨텍스트를 고려하여 구체적이고 실용적인 답변을 제공해주세요.';
  
  return contextPrompt;
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'airis-chatbot-api' 
  });
});

// Get all chatbot configurations
app.get('/api/chatbot/configs', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, description, provider, model, is_active, created_at FROM chatbot_configs ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching chatbot configs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific chatbot configuration
app.get('/api/chatbot/configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const chatbot = await getChatbotConfig(id);
    
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }
    
    res.json(chatbot);
  } catch (error) {
    console.error('Error fetching chatbot config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chat endpoint - main functionality
app.post('/api/chatbot/chat', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      chatbotId, 
      message, 
      sessionId, 
      userId = 'anonymous',
      contextInfo = {} 
    } = req.body;

    if (!chatbotId || !message || !sessionId) {
      return res.status(400).json({ 
        error: 'Missing required fields: chatbotId, message, sessionId' 
      });
    }

    // Get chatbot configuration
    const chatbot = await getChatbotConfig(chatbotId);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Generate contextual system prompt
    const systemPrompt = generateContextualPrompt(chatbot.system_prompt, contextInfo);
    
    // Prepare messages for LLM
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    // Get LLM response
    const llmResponse = await getLLMResponse(
      chatbot.provider, 
      chatbot.model, 
      messages,
      {
        temperature: chatbot.temperature,
        max_tokens: chatbot.max_tokens
      }
    );

    // Save chat history
    await pool.query(
      `INSERT INTO chat_history 
       (session_id, user_id, chatbot_id, user_message, bot_response, context_info, response_time_ms, tokens_used) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionId, 
        userId, 
        chatbotId, 
        message, 
        llmResponse.content,
        JSON.stringify(contextInfo),
        llmResponse.responseTime,
        llmResponse.tokensUsed
      ]
    );

    // Cache response disabled temporarily
    // TODO: Re-enable Redis caching after fixing connection issues

    res.json({
      response: llmResponse.content,
      responseTime: llmResponse.responseTime,
      tokensUsed: llmResponse.tokensUsed,
      chatbotName: chatbot.name,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    const errorResponse = {
      error: '죄송합니다. 현재 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      responseTime: Date.now() - startTime
    };
    
    res.status(500).json(errorResponse);
  }
});

// Get chat history for a session
app.get('/api/chatbot/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const { rows } = await pool.query(
      `SELECT 
        ch.id, ch.user_message, ch.bot_response, ch.created_at, ch.response_time_ms, ch.tokens_used,
        cc.name as chatbot_name, cc.provider
       FROM chat_history ch
       JOIN chatbot_configs cc ON ch.chatbot_id = cc.id
       WHERE ch.session_id = $1
       ORDER BY ch.created_at DESC
       LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics endpoint
app.get('/api/chatbot/analytics', async (req, res) => {
  try {
    // Get basic stats
    const statsQueries = [
      'SELECT COUNT(*) as total_chats FROM chat_history WHERE created_at >= NOW() - INTERVAL \'24 hours\'',
      'SELECT COUNT(DISTINCT session_id) as active_sessions FROM chat_history WHERE created_at >= NOW() - INTERVAL \'1 hour\'',
      'SELECT AVG(response_time_ms) as avg_response_time FROM chat_history WHERE created_at >= NOW() - INTERVAL \'24 hours\'',
      'SELECT SUM(tokens_used) as total_tokens FROM chat_history WHERE created_at >= NOW() - INTERVAL \'24 hours\'',
      'SELECT COUNT(*) as active_bots FROM chatbot_configs WHERE is_active = true'
    ];
    
    const results = await Promise.all(
      statsQueries.map(query => pool.query(query))
    );
    
    const analytics = {
      totalChats: parseInt(results[0].rows[0].total_chats),
      activeSessions: parseInt(results[1].rows[0].active_sessions),
      avgResponseTime: Math.round(parseFloat(results[2].rows[0].avg_response_time) || 0),
      totalTokens: parseInt(results[3].rows[0].total_tokens) || 0,
      activeBots: parseInt(results[4].rows[0].active_bots)
    };
    
    // Get popular chatbots
    const { rows: popularBots } = await pool.query(`
      SELECT 
        cc.name, 
        COUNT(*) as usage_count,
        AVG(ch.response_time_ms) as avg_response_time
      FROM chat_history ch
      JOIN chatbot_configs cc ON ch.chatbot_id = cc.id
      WHERE ch.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY cc.id, cc.name
      ORDER BY usage_count DESC
      LIMIT 5
    `);
    
    analytics.popularChatbots = popularBots;
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API configuration management
app.get('/api/chatbot/api-configs', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT provider, base_url, is_active, created_at FROM api_configs ORDER BY provider'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching API configs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chatbot/api-configs', async (req, res) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and API key are required' });
    }
    
    await pool.query(
      `INSERT INTO api_configs (provider, api_key, base_url, is_active) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider) 
       DO UPDATE SET api_key = $2, base_url = $3, updated_at = CURRENT_TIMESTAMP`,
      [provider, apiKey, baseUrl, true]
    );
    
    res.json({ success: true, message: 'API configuration saved successfully' });
  } catch (error) {
    console.error('Error saving API config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test API connection
app.post('/api/chatbot/test-connection', async (req, res) => {
  try {
    const { provider, model } = req.body;
    
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }
    
    const testMessage = [
      { role: 'system', content: 'You are a test assistant.' },
      { role: 'user', content: 'Hello, this is a connection test.' }
    ];
    
    const response = await getLLMResponse(provider, model || 'gpt-3.5-turbo', testMessage);
    
    res.json({ 
      success: true, 
      message: 'Connection successful',
      responseTime: response.responseTime,
      tokensUsed: response.tokensUsed
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Initialize and start server
async function startServer() {
  try {
    // Skip Redis for now - TODO: Fix Redis connection issues
    console.log('⚠️  Redis disabled temporarily');
    
    // Try to initialize database - don't block server startup if it fails
    try {
      await initializeDatabase();
    } catch (dbError) {
      console.error('Database initialization failed, but server will continue:', dbError.message);
    }
    
    app.listen(port, () => {
      console.log(`🤖 AIRIS Chatbot API Server running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`💬 Chat endpoint: http://localhost:${port}/api/chatbot/chat`);
      console.log(`🔄 Redis caching: ${redisClient ? 'enabled' : 'disabled'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  if (redisClient) {
    try {
      await redisClient.disconnect();
      console.log('Redis disconnected');
    } catch (error) {
      console.log('Redis disconnect error:', error.message);
    }
  }
  
  try {
    await pool.end();
    console.log('Database disconnected');
  } catch (error) {
    console.log('Database disconnect error:', error.message);
  }
  
  process.exit(0);
});

startServer();

module.exports = app;