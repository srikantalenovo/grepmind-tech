import { localModelClient } from '../utils/localModelClient.js';
import { AI_CONFIG } from '../config/aiConfig.js';

/**
 * Production LLM Service
 * Only works with real model inference - strict production requirements
 */
class LLMService {
  constructor() {
    this.requestQueue = [];
    this.activeRequests = new Set();
    this.requestHistory = new Map(); // Store recent requests for analytics
    this.isProcessingQueue = false;
    this.initialized = false;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.averageResponseTime = 0;
  }

  /**
   * Initialize production LLM service
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Production LLM Service...');
      
      // Strict requirement: local model client must be initialized
      if (!localModelClient.isInitialized) {
        console.log('📥 Initializing local model client first...');
        await localModelClient.initialize();
      }
      
      // Verify LLM model is available
      const isAvailable = await localModelClient.isModelAvailable('llm');
      if (!isAvailable) {
        throw new Error('Production LLM service requires LLM model to be available');
      }
      
      this.initialized = true;
      console.log('✅ Production LLM Service initialized successfully');
      
      return { 
        success: true, 
        productionMode: true,
        modelSupport: 'native'
      };
    } catch (error) {
      console.error('❌ Failed to initialize Production LLM Service:', error.message);
      this.initialized = false;
      throw new Error(`Production LLM service initialization failed: ${error.message}`);
    }
  }

  /**
   * Generate production LLM response
   */
  async generateResponse(prompt, options = {}) {
    const startTime = Date.now();
    this.totalRequests++;
    
    try {
      // Strict production validation
      if (!this.initialized) {
        throw new Error('LLM service not initialized. Production mode requires proper initialization.');
      }

      if (!prompt || prompt.trim().length === 0) {
        throw new Error('Prompt cannot be empty');
      }

      // Production input validation
      const maxInputLength = AI_CONFIG.safety?.maxInputLength || 8000;
      if (prompt.length > maxInputLength) {
        throw new Error(`Prompt too long. Maximum length is ${maxInputLength} characters.`);
      }

      // Production concurrency control
      const maxConcurrent = AI_CONFIG.performance?.maxConcurrentRequests || 3;
      if (this.activeRequests.size >= maxConcurrent) {
        if (AI_CONFIG.performance?.requestQueue) {
          return await this.queueRequest(prompt, options, startTime);
        } else {
          throw new Error('Production system at capacity. Please try again later.');
        }
      }

      const requestId = this.generateRequestId();
      this.activeRequests.add(requestId);

      try {
        // Process with production model
        const response = await this.processPromptWithModel(prompt, options);
        const processingTime = Date.now() - startTime;

        // Update metrics
        this.successfulRequests++;
        this.updateAverageResponseTime(processingTime);

        // Store in request history for analytics
        this.addToHistory(prompt, response, processingTime);

        console.log(`✅ [PRODUCTION LLM] Response generated in ${processingTime}ms`);

        return {
          success: true,
          response,
          requestId,
          timestamp: new Date().toISOString(),
          processingTime,
          tokensEstimate: this.estimateTokens(prompt + response),
          productionMode: true
        };

      } finally {
        this.activeRequests.delete(requestId);
        this.processNextInQueue();
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ [PRODUCTION LLM] Error generating response:', error.message);
      
      // In production, we fail fast rather than providing fallback responses
      throw new Error(`Production LLM error: ${error.message}`);
    }
  }

  /**
   * Process prompt with production model
   */
  async processPromptWithModel(prompt, options) {
    try {
      // Prepare production prompt
      const enrichedPrompt = this.enrichPromptForProduction(prompt, options);
      
      console.log(`🤖 [PRODUCTION LLM] Processing with local model...`);
      console.log(`📝 [PRODUCTION LLM] Prompt length: ${enrichedPrompt.length} characters`);
      
      // Use production generation
      const response = await localModelClient.generate('llm', enrichedPrompt, {
        maxTokens: options.maxTokens || AI_CONFIG.models?.llm?.maxTokens || 1024,
        temperature: options.temperature || AI_CONFIG.models?.llm?.temperature || 0.7,
        topP: options.topP || 0.9,
        topK: options.topK || 40,
        contextSize: options.contextSize || 4096
      });

      if (!response || response.trim().length === 0) {
        throw new Error('Empty response from production LLM model');
      }

      return response.trim();
    } catch (error) {
      console.error('❌ [PRODUCTION LLM] Model processing failed:', error.message);
      throw new Error(`Production LLM generation failed: ${error.message}`);
    }
  }

  /**
   * Enrich prompt for production use
   */
  enrichPromptForProduction(prompt, options) {
    let enrichedPrompt = prompt;

    // Add production context if specified
    if (options.context) {
      enrichedPrompt = `Context: ${options.context}\n\nQuery: ${prompt}`;
    }

    // Add formatting instructions for production
    if (options.format === 'structured') {
      enrichedPrompt += '\n\nPlease provide a well-structured, professional response with clear sections and bullet points where appropriate.';
    }

    // Add task-specific instructions
    if (options.task) {
      const taskInstructions = {
        'code': '\n\nProvide clean, production-ready code with proper error handling and documentation.',
        'analysis': '\n\nProvide a comprehensive analysis with clear conclusions and actionable insights.',
        'explanation': '\n\nProvide a clear, step-by-step explanation that is easy to understand.',
        'summary': '\n\nProvide a concise summary highlighting the key points.'
      };
      
      if (taskInstructions[options.task]) {
        enrichedPrompt += taskInstructions[options.task];
      }
    }

    return enrichedPrompt;
  }

  /**
   * Stream LLM response for production
   */
  async* streamResponse(prompt, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('LLM service not initialized for streaming');
      }

      const enrichedPrompt = this.enrichPromptForProduction(prompt, options);
      
      console.log(`🤖 [PRODUCTION LLM STREAM] Starting stream with local model...`);
      
      let fullResponse = '';
      
      // Stream from production model
      for await (const chunk of localModelClient.generateStream('llm', enrichedPrompt, options)) {
        if (chunk.type === 'content' && !chunk.done) {
          fullResponse += chunk.content;
          yield {
            type: 'content',
            content: chunk.content,
            done: false
          };
        } else if (chunk.type === 'complete' || chunk.done) {
          yield {
            type: 'complete',
            content: fullResponse,
            done: true
          };
          break;
        } else if (chunk.type === 'error') {
          throw new Error(chunk.content);
        }
      }
      
    } catch (error) {
      console.error('❌ [PRODUCTION LLM STREAM] Streaming failed:', error.message);
      yield {
        type: 'error',
        content: `Production LLM streaming error: ${error.message}`,
        error: true
      };
    }
  }

  /**
   * Queue request for production processing
   */
  async queueRequest(prompt, options, startTime) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        prompt,
        options,
        startTime,
        resolve,
        reject,
        queuedAt: Date.now()
      };

      this.requestQueue.push(queueItem);
      console.log(`🔄 [PRODUCTION LLM] Request queued. Queue length: ${this.requestQueue.length}`);

      // Set timeout for queued requests
      setTimeout(() => {
        const index = this.requestQueue.indexOf(queueItem);
        if (index > -1) {
          this.requestQueue.splice(index, 1);
          reject(new Error('Request timeout in queue'));
        }
      }, 30000); // 30 second timeout

      this.processNextInQueue();
    });
  }

  /**
   * Process next request in queue
   */
  async processNextInQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    const maxConcurrent = AI_CONFIG.performance?.maxConcurrentRequests || 3;
    if (this.activeRequests.size >= maxConcurrent) {
      return;
    }

    this.isProcessingQueue = true;
    const queueItem = this.requestQueue.shift();

    try {
      const result = await this.generateResponse(queueItem.prompt, queueItem.options);
      queueItem.resolve(result);
    } catch (error) {
      queueItem.reject(error);
    } finally {
      this.isProcessingQueue = false;
      // Try to process next item
      if (this.requestQueue.length > 0) {
        setImmediate(() => this.processNextInQueue());
      }
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add to request history for analytics
   */
  addToHistory(prompt, response, processingTime) {
    const historyItem = {
      prompt: prompt.slice(0, 200), // Store first 200 chars for analytics
      responseLength: response.length,
      processingTime,
      timestamp: new Date().toISOString()
    };

    // Keep last 100 requests for analytics
    const maxHistorySize = 100;
    if (this.requestHistory.size >= maxHistorySize) {
      const oldestKey = this.requestHistory.keys().next().value;
      this.requestHistory.delete(oldestKey);
    }

    this.requestHistory.set(Date.now().toString(), historyItem);
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(newTime) {
    if (this.successfulRequests === 1) {
      this.averageResponseTime = newTime;
    } else {
      this.averageResponseTime = ((this.averageResponseTime * (this.successfulRequests - 1)) + newTime) / this.successfulRequests;
    }
  }

  /**
   * Estimate tokens (rough approximation)
   */
  estimateTokens(text) {
    // Rough estimation: ~4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  /**
   * Get production service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      activeRequests: this.activeRequests.size,
      queueLength: this.requestQueue.length,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      successRate: this.totalRequests > 0 ? ((this.successfulRequests / this.totalRequests) * 100).toFixed(2) + '%' : '0%',
      averageResponseTime: Math.round(this.averageResponseTime),
      productionMode: true,
      modelRequired: true
    };
  }

  /**
   * Get analytics data
   */
  getAnalytics() {
    const history = Array.from(this.requestHistory.values());
    
    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      averageResponseTime: Math.round(this.averageResponseTime),
      recentRequests: history.slice(-20), // Last 20 requests
      responseTimes: history.map(h => h.processingTime),
      requestVolume: this.getRequestVolumeByHour()
    };
  }

  /**
   * Get request volume by hour (last 24 hours)
   */
  getRequestVolumeByHour() {
    const now = new Date();
    const hours = [];
    
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const hourStart = hour.getTime();
      const hourEnd = hourStart + (60 * 60 * 1000);
      
      const requestsInHour = Array.from(this.requestHistory.values())
        .filter(req => {
          const reqTime = new Date(req.timestamp).getTime();
          return reqTime >= hourStart && reqTime < hourEnd;
        }).length;
      
      hours.push({
        hour: hour.getHours(),
        requests: requestsInHour
      });
    }
    
    return hours;
  }

  /**
   * Production cleanup
   */
  async cleanup() {
    console.log('🧹 [PRODUCTION LLM] Cleaning up LLM service...');
    
    // Clear old request history (keep only last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const [key, request] of this.requestHistory.entries()) {
      const requestTime = new Date(request.timestamp).getTime();
      if (requestTime < oneDayAgo) {
        this.requestHistory.delete(key);
      }
    }
    
    // Clear any stuck queue items (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.requestQueue = this.requestQueue.filter(item => item.queuedAt > oneHourAgo);
    
    console.log('✅ [PRODUCTION LLM] Cleanup completed');
  }
}

// Export production singleton instance
export const llmService = new LLMService();