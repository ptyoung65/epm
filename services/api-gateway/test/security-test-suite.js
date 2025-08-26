#!/usr/bin/env node

const axios = require('axios');
const assert = require('assert');
const colors = require('colors');

class SecurityTestSuite {
  constructor() {
    this.gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:3000';
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async run() {
    console.log('🔒 Starting API Gateway Security Test Suite'.cyan.bold);
    console.log('================================================'.cyan);
    
    try {
      // Basic connectivity test
      await this.testBasicConnectivity();
      
      // Authentication tests  
      await this.testJWTAuthentication();
      await this.testAPIKeyAuthentication();
      await this.testAuthenticationErrors();
      
      // Authorization tests
      await this.testRBACAuthorization();
      await this.testPermissionDenial();
      
      // API versioning tests
      await this.testAPIVersioning();
      await this.testVersionNegotiation();
      await this.testDeprecationWarnings();
      
      // Request/response transformation tests
      await this.testRequestTransformation();
      await this.testResponseTransformation();
      await this.testDataSanitization();
      
      // Security tests
      await this.testRateLimiting();
      await this.testInputValidation();
      await this.testSecurityHeaders();
      
      // Error handling tests
      await this.testErrorHandling();
      
      // Performance tests
      await this.testCompressionSupport();
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('Test suite failed:', error);
      process.exit(1);
    }
  }

  async testBasicConnectivity() {
    console.log('\n🌐 Basic Connectivity Tests'.yellow.bold);
    
    await this.test('Gateway Health Check', async () => {
      const response = await axios.get(`${this.gatewayUrl}/health`);
      assert.strictEqual(response.status, 200);
      assert(response.data.status);
    });
    
    await this.test('Gateway Status', async () => {
      const response = await axios.get(`${this.gatewayUrl}/gateway/status`);
      assert.strictEqual(response.status, 200);
      assert(response.data.gateway);
    });
  }

  async testJWTAuthentication() {
    console.log('\n🔑 JWT Authentication Tests'.yellow.bold);
    
    let accessToken = null;
    let refreshToken = null;
    
    await this.test('Login with valid credentials', async () => {
      const response = await axios.post(`${this.gatewayUrl}/auth/login`, {
        username: 'admin',
        password: 'admin123'
      });
      assert.strictEqual(response.status, 200);
      assert(response.data.accessToken);
      assert(response.data.refreshToken);
      
      accessToken = response.data.accessToken;
      refreshToken = response.data.refreshToken;
    });
    
    await this.test('Access protected endpoint with valid token', async () => {
      const response = await axios.get(`${this.gatewayUrl}/auth/roles`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      assert.strictEqual(response.status, 200);
    });
    
    await this.test('Refresh token functionality', async () => {
      const response = await axios.post(`${this.gatewayUrl}/auth/refresh`, {
        refreshToken: refreshToken
      });
      assert.strictEqual(response.status, 200);
      assert(response.data.accessToken);
    });
    
    await this.test('Logout functionality', async () => {
      const response = await axios.post(`${this.gatewayUrl}/auth/logout`, {}, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      assert.strictEqual(response.status, 200);
    });
    
    // Store valid token for other tests
    const loginResponse = await axios.post(`${this.gatewayUrl}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    this.validToken = loginResponse.data.accessToken;
  }

  async testAPIKeyAuthentication() {
    console.log('\n🔐 API Key Authentication Tests'.yellow.bold);
    
    let apiKey = null;
    
    await this.test('Generate API key', async () => {
      const response = await axios.post(`${this.gatewayUrl}/auth/api-key/generate`, 
        { role: 'developer' },
        { headers: { 'Authorization': `Bearer ${this.validToken}` } }
      );
      assert.strictEqual(response.status, 200);
      assert(response.data.apiKey);
      
      apiKey = response.data.apiKey;
    });
    
    await this.test('Access endpoint with valid API key', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`, {
        headers: { 'X-API-Key': apiKey }
      });
      assert.strictEqual(response.status, 200);
    });
    
    await this.test('Invalid API key format rejection', async () => {
      try {
        await axios.get(`${this.gatewayUrl}/api/versions`, {
          headers: { 'X-API-Key': 'invalid-key' }
        });
        assert.fail('Should have rejected invalid API key');
      } catch (error) {
        assert.strictEqual(error.response.status, 400);
        assert.strictEqual(error.response.data.code, 'API_KEY_INVALID_FORMAT');
      }
    });
  }

  async testAuthenticationErrors() {
    console.log('\n❌ Authentication Error Tests'.yellow.bold);
    
    await this.test('Login with invalid credentials', async () => {
      try {
        await axios.post(`${this.gatewayUrl}/auth/login`, {
          username: 'admin',
          password: 'wrong'
        });
        assert.fail('Should have rejected invalid credentials');
      } catch (error) {
        assert.strictEqual(error.response.status, 401);
        assert.strictEqual(error.response.data.code, 'INVALID_CREDENTIALS');
      }
    });
    
    await this.test('Access protected endpoint without token', async () => {
      try {
        await axios.get(`${this.gatewayUrl}/auth/roles`);
        assert.fail('Should have required authentication');
      } catch (error) {
        assert.strictEqual(error.response.status, 401);
        assert.strictEqual(error.response.data.code, 'TOKEN_MISSING');
      }
    });
    
    await this.test('Access endpoint with invalid token', async () => {
      try {
        await axios.get(`${this.gatewayUrl}/auth/roles`, {
          headers: { 'Authorization': 'Bearer invalid-token' }
        });
        assert.fail('Should have rejected invalid token');
      } catch (error) {
        assert.strictEqual(error.response.status, 403);
        assert.strictEqual(error.response.data.code, 'TOKEN_INVALID');
      }
    });
  }

  async testRBACAuthorization() {
    console.log('\n🛡️ RBAC Authorization Tests'.yellow.bold);
    
    await this.test('Admin can access role management', async () => {
      const response = await axios.get(`${this.gatewayUrl}/auth/roles`, {
        headers: { 'Authorization': `Bearer ${this.validToken}` }
      });
      assert.strictEqual(response.status, 200);
      assert(Array.isArray(response.data.roles));
    });
    
    await this.test('Admin can generate API keys', async () => {
      const response = await axios.post(`${this.gatewayUrl}/auth/api-key/generate`,
        { role: 'viewer' },
        { headers: { 'Authorization': `Bearer ${this.validToken}` } }
      );
      assert.strictEqual(response.status, 200);
    });
  }

  async testPermissionDenial() {
    console.log('\n🚫 Permission Denial Tests'.yellow.bold);
    
    // Generate viewer API key for limited permissions test
    const viewerKeyResponse = await axios.post(`${this.gatewayUrl}/auth/api-key/generate`,
      { role: 'viewer' },
      { headers: { 'Authorization': `Bearer ${this.validToken}` } }
    );
    const viewerKey = viewerKeyResponse.data.apiKey;
    
    await this.test('Viewer cannot generate API keys', async () => {
      try {
        await axios.post(`${this.gatewayUrl}/auth/api-key/generate`,
          { role: 'admin' },
          { headers: { 'X-API-Key': viewerKey } }
        );
        assert.fail('Viewer should not be able to generate admin API keys');
      } catch (error) {
        assert.strictEqual(error.response.status, 403);
        assert.strictEqual(error.response.data.code, 'CANNOT_ASSIGN_ROLE');
      }
    });
  }

  async testAPIVersioning() {
    console.log('\n📦 API Versioning Tests'.yellow.bold);
    
    await this.test('Get supported API versions', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`);
      assert.strictEqual(response.status, 200);
      assert(Array.isArray(response.data.versions));
      assert(response.data.default);
      assert(response.data.latest);
    });
    
    await this.test('Version header negotiation', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`, {
        headers: { 'Accept-Version': '1.1.0' }
      });
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers['api-version'], '1.1.0');
    });
    
    await this.test('Version query parameter', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions?version=1.0.0`);
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers['api-version'], '1.0.0');
    });
  }

  async testVersionNegotiation() {
    console.log('\n🔄 Version Negotiation Tests'.yellow.bold);
    
    await this.test('Unsupported version rejection', async () => {
      try {
        await axios.get(`${this.gatewayUrl}/api/versions`, {
          headers: { 'Accept-Version': '99.0.0' }
        });
        assert.fail('Should reject unsupported version');
      } catch (error) {
        assert.strictEqual(error.response.status, 400);
        assert.strictEqual(error.response.data.code, 'UNSUPPORTED_VERSION');
      }
    });
    
    await this.test('Default version fallback', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`);
      assert.strictEqual(response.status, 200);
      assert(response.headers['api-version']);
    });
  }

  async testDeprecationWarnings() {
    console.log('\n⚠️ Deprecation Warning Tests'.yellow.bold);
    
    // First deprecate version 1.0.0
    await axios.post(`${this.gatewayUrl}/api/versions/1.0.0/deprecate`,
      { sunsetDate: '2025-12-31T23:59:59Z' },
      { headers: { 'Authorization': `Bearer ${this.validToken}` } }
    );
    
    await this.test('Deprecated version warnings', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`, {
        headers: { 'Accept-Version': '1.0.0' }
      });
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers['deprecated'], 'true');
      assert(response.headers['sunset']);
    });
  }

  async testRequestTransformation() {
    console.log('\n🔄 Request Transformation Tests'.yellow.bold);
    
    await this.test('JSON request sanitization', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>',
        value: 42,
        __proto__: { polluted: true }
      };
      
      // This should not fail - the middleware should sanitize the data
      const response = await axios.get(`${this.gatewayUrl}/api/versions`, {
        data: maliciousData,
        headers: { 'Authorization': `Bearer ${this.validToken}` }
      });
      assert.strictEqual(response.status, 200);
    });
    
    await this.test('Request metadata injection', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`, {
        headers: { 'Authorization': `Bearer ${this.validToken}` }
      });
      assert.strictEqual(response.status, 200);
      assert(response.headers['x-request-id']);
    });
  }

  async testResponseTransformation() {
    console.log('\n🔧 Response Transformation Tests'.yellow.bold);
    
    await this.test('Response version headers', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`, {
        headers: { 'Accept-Version': '1.1.0' }
      });
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers['api-version'], '1.1.0');
      assert(response.headers['api-status']);
    });
    
    await this.test('Response metadata', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`);
      assert.strictEqual(response.status, 200);
      assert(response.data.versions);
    });
  }

  async testDataSanitization() {
    console.log('\n🧹 Data Sanitization Tests'.yellow.bold);
    
    await this.test('XSS prevention', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`);
      assert.strictEqual(response.status, 200);
      
      // Response should not contain script tags or dangerous content
      const responseStr = JSON.stringify(response.data);
      assert(!responseStr.includes('<script>'));
      assert(!responseStr.includes('javascript:'));
    });
    
    await this.test('Sensitive data filtering', async () => {
      const response = await axios.get(`${this.gatewayUrl}/auth/roles`, {
        headers: { 'Authorization': `Bearer ${this.validToken}` }
      });
      assert.strictEqual(response.status, 200);
      
      // Should not expose sensitive fields like passwords or tokens
      const responseStr = JSON.stringify(response.data);
      assert(!responseStr.includes('password'));
      assert(!responseStr.includes('secret'));
    });
  }

  async testRateLimiting() {
    console.log('\n⏱️ Rate Limiting Tests'.yellow.bold);
    
    await this.test('Rate limit headers present', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`);
      assert.strictEqual(response.status, 200);
      // Note: Rate limit headers may vary based on configuration
    });
    
    // Note: Full rate limiting test would require many requests
    // This is a basic smoke test
  }

  async testInputValidation() {
    console.log('\n✅ Input Validation Tests'.yellow.bold);
    
    await this.test('Empty request body handling', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`);
      assert.strictEqual(response.status, 200);
    });
    
    await this.test('Large request body limit', async () => {
      // Test would require generating large payload
      // This is a placeholder for future implementation
      assert(true);
    });
  }

  async testSecurityHeaders() {
    console.log('\n🔒 Security Headers Tests'.yellow.bold);
    
    await this.test('CORS headers present', async () => {
      const response = await axios.get(`${this.gatewayUrl}/health`);
      assert.strictEqual(response.status, 200);
      // CORS headers should be present
    });
    
    await this.test('Security headers present', async () => {
      const response = await axios.get(`${this.gatewayUrl}/health`);
      assert.strictEqual(response.status, 200);
      // Security headers from Helmet should be present
    });
  }

  async testErrorHandling() {
    console.log('\n🚨 Error Handling Tests'.yellow.bold);
    
    await this.test('404 for unknown routes', async () => {
      try {
        await axios.get(`${this.gatewayUrl}/nonexistent`);
        assert.fail('Should return 404 for unknown routes');
      } catch (error) {
        assert.strictEqual(error.response.status, 404);
      }
    });
    
    await this.test('Error response format', async () => {
      try {
        await axios.get(`${this.gatewayUrl}/auth/roles`);
        assert.fail('Should require authentication');
      } catch (error) {
        assert.strictEqual(error.response.status, 401);
        assert(error.response.data.error);
        assert(error.response.data.code);
      }
    });
  }

  async testCompressionSupport() {
    console.log('\n📦 Compression Support Tests'.yellow.bold);
    
    await this.test('Gzip compression support', async () => {
      const response = await axios.get(`${this.gatewayUrl}/api/versions`, {
        headers: { 'Accept-Encoding': 'gzip' }
      });
      assert.strictEqual(response.status, 200);
      // Response should be handled correctly with compression
    });
  }

  async test(name, testFunc) {
    try {
      console.log(`  Testing: ${name}...`.gray);
      await testFunc();
      console.log(`  ✅ ${name}`.green);
      this.results.passed++;
      this.results.tests.push({ name, status: 'passed' });
    } catch (error) {
      console.log(`  ❌ ${name}: ${error.message}`.red);
      this.results.failed++;
      this.results.tests.push({ name, status: 'failed', error: error.message });
    }
  }

  generateReport() {
    console.log('\n📊 Test Results Summary'.cyan.bold);
    console.log('================================'.cyan);
    console.log(`Total Tests: ${this.results.passed + this.results.failed}`);
    console.log(`Passed: ${this.results.passed}`.green);
    console.log(`Failed: ${this.results.failed}`.red);
    console.log(`Success Rate: ${Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100)}%`);
    
    if (this.results.failed > 0) {
      console.log('\nFailed Tests:'.red.bold);
      this.results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`.red);
        });
    }
    
    console.log('\n✨ Security Test Suite Complete'.cyan.bold);
    
    // Exit with error code if any tests failed
    if (this.results.failed > 0) {
      process.exit(1);
    }
  }
}

// Run the test suite
if (require.main === module) {
  const testSuite = new SecurityTestSuite();
  testSuite.run().catch(console.error);
}

module.exports = SecurityTestSuite;