#!/usr/bin/env node

/**
 * AI Services Test Script
 * Tests the AI backend integration
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api/ai';

class AITester {
  constructor() {
    this.testResults = [];
  }

  async runTest(name, testFunction) {
    console.log(`\n🧪 Testing: ${name}`);
    try {
      const result = await testFunction();
      console.log(`✅ ${name}: PASSED`);
      this.testResults.push({ name, status: 'PASSED', result });
      return result;
    } catch (error) {
      console.log(`❌ ${name}: FAILED - ${error.message}`);
      this.testResults.push({ name, status: 'FAILED', error: error.message });
      throw error;
    }
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  }

  async testHealthCheck() {
    const result = await this.makeRequest('/health');
    if (!result.success) {
      throw new Error('Health check failed');
    }
    return result;
  }

  async testStatus() {
    const result = await this.makeRequest('/status');
    if (!result.success) {
      throw new Error('Status check failed');
    }
    return result;
  }

  async testInitialization() {
    const result = await this.makeRequest('/initialize', { method: 'POST' });
    if (!result.success) {
      throw new Error('Initialization failed');
    }
    return result;
  }

  async testModels() {
    const result = await this.makeRequest('/models');
    if (!result.success) {
      throw new Error('Models request failed');
    }
    return result;
  }

  async testChat() {
    const chatData = {
      sessionId: 'test_session_' + Date.now(),
      message: 'Hello, this is a test message for the chat AI.',
      options: {}
    };

    const result = await this.makeRequest('/chat', {
      method: 'POST',
      body: JSON.stringify(chatData)
    });

    if (!result.success) {
      throw new Error('Chat request failed');
    }

    return result;
  }

  async testLLM() {
    const llmData = {
      prompt: 'This is a test prompt for the LLM service. Please respond with a test message.',
      options: {}
    };

    const result = await this.makeRequest('/generate', {
      method: 'POST',
      body: JSON.stringify(llmData)
    });

    if (!result.success) {
      throw new Error('LLM request failed');
    }

    return result;
  }

  async testStreaming() {
    // Simple streaming test - just check if endpoint responds
    try {
      const response = await fetch(`${API_BASE}/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Short test prompt for streaming',
          options: {}
        })
      });

      if (!response.ok) {
        throw new Error(`Streaming failed: HTTP ${response.status}`);
      }

      return { success: true, message: 'Streaming endpoint accessible' };
    } catch (error) {
      throw new Error(`Streaming test failed: ${error.message}`);
    }
  }

  async runAllTests() {
    console.log('🚀 Starting AI Services Test Suite');
    console.log('=====================================');

    try {
      // Basic connectivity tests
      await this.runTest('Health Check', () => this.testHealthCheck());
      await this.runTest('Service Status', () => this.testStatus());
      
      // Service initialization
      await this.runTest('AI Initialization', () => this.testInitialization());
      
      // Wait a moment for initialization
      console.log('\n⏳ Waiting for services to initialize...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Model and feature tests
      await this.runTest('Available Models', () => this.testModels());
      await this.runTest('Chat Service', () => this.testChat());
      await this.runTest('LLM Service', () => this.testLLM());
      await this.runTest('Streaming Endpoints', () => this.testStreaming());

      // Final status check
      await this.runTest('Final Status Check', () => this.testStatus());

    } catch (error) {
      console.log(`\n💥 Test suite stopped due to error: ${error.message}`);
    }

    this.printResults();
  }

  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    
    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    const total = this.testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAILED')
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }

    if (passed === total) {
      console.log('\n🎉 All tests passed! AI services are working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the backend server and try again.');
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new AITester();
  
  console.log('🔧 Make sure the backend server is running on http://localhost:5000');
  console.log('   Start it with: cd backend && npm run dev\n');
  
  tester.runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export default AITester;