import { localModelClient } from '../utils/localModelClient.js';
import { AI_CONFIG } from '../config/aiConfig.js';

/**
 * Production ChatBot Service
 * Only works with real model inference - strict production requirements
 */
class ChatBotService {
  constructor() {
    this.conversationHistory = new Map(); // Store conversation per session
    this.activeChats = new Set();
    this.rateLimitMap = new Map(); // Production rate limiting
    this.initialized = false;
    this.totalRequests = 0;
    this.successfulRequests = 0;
  }

  /**
   * Initialize production chat service
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Production ChatBot Service...');
      
      // Strict requirement: local model client must be initialized
      if (!localModelClient.isInitialized) {
        console.log('📥 Initializing local model client first...');
        await localModelClient.initialize();
      }
      
      // Verify chat model is available
      const isAvailable = await localModelClient.isModelAvailable('chat');
      if (!isAvailable) {
        throw new Error('Production chat service requires chat model to be available');
      }
      
      this.initialized = true;
      console.log('✅ Production ChatBot Service initialized successfully');
      
      return { 
        success: true, 
        productionMode: true,
        modelSupport: 'native'
      };
    } catch (error) {
      console.error('❌ Failed to initialize Production ChatBot Service:', error.message);
      this.initialized = false;
      throw new Error(`Production chat service initialization failed: ${error.message}`);
    }
  }

  /**
   * Generate production chat response
   */
  async generateResponse(sessionId, message, options = {}) {
    this.totalRequests++;
    
    try {
      // Strict production validation
      if (!this.initialized) {
        throw new Error('Chat service not initialized. Production mode requires proper initialization.');
      }

      if (!message || message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      if (message.trim().length > 4000) {
        throw new Error('Message too long. Maximum 4000 characters allowed.');
      }

      // Production rate limiting
      if (this.isRateLimited(sessionId)) {
        throw new Error('Rate limit exceeded. Please wait before sending another message.');
      }

      // Get or create conversation history
      const history = this.getConversationHistory(sessionId);
      
      // Add user message to history
      const userMessage = {
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString()
      };
      history.push(userMessage);

      // Generate response using production model
      const startTime = Date.now();
      const response = await this.processMessageWithModel(message, history, options);
      const responseTime = Date.now() - startTime;

      // Validate response
      if (!response || typeof response !== 'string') {
        throw new Error('Invalid response from production model');
      }

      // Add AI response to history
      const aiMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        responseTime: responseTime
      };
      history.push(aiMessage);

      // Maintain conversation history (production limit: 20 messages)
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }
      this.conversationHistory.set(sessionId, history);

      // Update rate limiting and metrics
      this.updateRateLimit(sessionId);
      this.successfulRequests++;

      console.log(`✅ [PRODUCTION CHAT] Response generated in ${responseTime}ms`);

      return {
        success: true,
        response,
        sessionId,
        timestamp: new Date().toISOString(),
        messageCount: history.length,
        responseTime,
        productionMode: true
      };

    } catch (error) {
      console.error('❌ [PRODUCTION CHAT] Error generating response:', error.message);
      throw error; // Fail fast in production
    }
  }

  /**
   * Process message with production model
   */
  async processMessageWithModel(message, history, options) {
    try {
      // Prepare messages for production chat model
      const messages = this.buildProductionMessagesArray(history);
      
      console.log(`🤖 [PRODUCTION CHAT] Processing with local model...`);
      
      // Use production chat method
      const response = await localModelClient.chat('chat', messages, {
        maxTokens: options.maxTokens || AI_CONFIG.models.chat.maxTokens || 512,
        temperature: options.temperature || AI_CONFIG.models.chat.temperature || 0.7,
        topP: options.topP || 0.9,
        topK: options.topK || 40,
        contextSize: options.contextSize || 4096
      });

      if (!response || response.trim().length === 0) {
        throw new Error('Empty response from production model');
      }

      return response.trim();
    } catch (error) {
      console.error('❌ [PRODUCTION CHAT] Model processing failed:', error.message);
      throw new Error(`Production model chat failed: ${error.message}`);
    }
  }

  /**
   * Build messages array for production chat
   */
  buildProductionMessagesArray(history) {
    const messages = [];
    
    // Production system message
    messages.push({
      role: 'system',
      content: `You are a professional AI assistant designed for production use. Provide accurate, helpful, and well-structured responses. Maintain a professional yet friendly tone. Be concise but comprehensive in your answers.`
    });
    
    // Add recent conversation history (production limit: 10 messages)
    const recentHistory = history.slice(-10);
    recentHistory.forEach(msg => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });
    
    return messages;
  }

  /**
   * Stream chat response for production
   */
  async* streamResponse(sessionId, message, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Chat service not initialized for streaming');
      }

      const history = this.getConversationHistory(sessionId);
      
      // Add user message to history
      history.push({
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString()
      });

      const messages = this.buildProductionMessagesArray(history);
      
      console.log(`🤖 [PRODUCTION STREAM] Starting stream with local model...`);
      
      let fullResponse = '';
      
      // Stream from production model
      for await (const chunk of localModelClient.generateStream('chat', messages[messages.length - 1].content, options)) {
        if (chunk.type === 'content' && !chunk.done) {
          fullResponse += chunk.content;
          yield {
            type: 'content',
            content: chunk.content,
            done: false,
            sessionId
          };
        } else if (chunk.type === 'complete' || chunk.done) {
          // Add complete response to history
          history.push({
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString()
          });
          
          this.conversationHistory.set(sessionId, history);
          
          yield {
            type: 'complete',
            content: fullResponse,
            done: true,
            sessionId
          };
          break;
        } else if (chunk.type === 'error') {
          throw new Error(chunk.content);
        }
      }
      
    } catch (error) {
      console.error('❌ [PRODUCTION STREAM] Streaming failed:', error.message);
      yield {
        type: 'error',
        content: `Production streaming error: ${error.message}`,
        error: true
      };
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(sessionId) {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    return this.conversationHistory.get(sessionId);
  }

  /**
   * Clear conversation history
   */
  clearConversation(sessionId) {
    this.conversationHistory.delete(sessionId);
    return { success: true, cleared: sessionId };
  }

  /**
   * Get conversation stats
   */
  getConversationStats(sessionId) {
    const history = this.getConversationHistory(sessionId);
    const userMessages = history.filter(msg => msg.role === 'user').length;
    const assistantMessages = history.filter(msg => msg.role === 'assistant').length;
    
    return {
      sessionId,
      totalMessages: history.length,
      userMessages,
      assistantMessages,
      conversationStarted: history.length > 0 ? history[0].timestamp : null,
      lastActivity: history.length > 0 ? history[history.length - 1].timestamp : null
    };
  }

  /**
   * Production rate limiting
   */
  isRateLimited(sessionId) {
    const now = Date.now();
    const rateLimit = this.rateLimitMap.get(sessionId);
    
    if (!rateLimit) {
      return false;
    }
    
    // Production: 10 messages per minute
    const timeWindow = 60 * 1000; // 1 minute
    const maxRequests = 10;
    
    const recentRequests = rateLimit.requests.filter(timestamp => now - timestamp < timeWindow);
    
    return recentRequests.length >= maxRequests;
  }

  /**
   * Update rate limit tracking
   */
  updateRateLimit(sessionId) {
    const now = Date.now();
    
    if (!this.rateLimitMap.has(sessionId)) {
      this.rateLimitMap.set(sessionId, { requests: [] });
    }
    
    const rateLimit = this.rateLimitMap.get(sessionId);
    rateLimit.requests.push(now);
    
    // Clean old entries (older than 5 minutes)
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    rateLimit.requests = rateLimit.requests.filter(timestamp => timestamp > fiveMinutesAgo);
  }

  /**
   * Get production service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      activeSessions: this.conversationHistory.size,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      successRate: this.totalRequests > 0 ? ((this.successfulRequests / this.totalRequests) * 100).toFixed(2) + '%' : '0%',
      productionMode: true,
      modelRequired: true
    };
  }

  /**
   * Production cleanup
   */
  async cleanup() {
    console.log('🧹 [PRODUCTION CHAT] Cleaning up chat service...');
    
    // Clean up old conversations (older than 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const [sessionId, history] of this.conversationHistory.entries()) {
      if (history.length > 0) {
        const lastActivity = new Date(history[history.length - 1].timestamp).getTime();
        if (lastActivity < oneDayAgo) {
          this.conversationHistory.delete(sessionId);
          console.log(`🧹 Cleaned up old conversation: ${sessionId}`);
        }
      }
    }
    
    // Clean up rate limit tracking
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    for (const [sessionId, rateLimit] of this.rateLimitMap.entries()) {
      rateLimit.requests = rateLimit.requests.filter(timestamp => timestamp > fiveMinutesAgo);
      if (rateLimit.requests.length === 0) {
        this.rateLimitMap.delete(sessionId);
      }
    }
    
    console.log('✅ [PRODUCTION CHAT] Cleanup completed');
  }
}

// Export production singleton instance
export const chatBotService = new ChatBotService();